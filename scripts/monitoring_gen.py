#!/usr/bin/env python3
# /opt/clt/monitoring_gen.py — Monitoring dashboard data generator
# Version : 3.7.0
# Date    : 2026-03-10
# Modifié le : 2026-05-14
# Serveur : srv-nginx (<SRV-NGINX-IP>)
# Usage   : python3 /opt/clt/monitoring_gen.py
# Sortie  : /var/www/monitoring/monitoring.json
# Cron    : /etc/cron.d/monitoring (*/5 min via monitoring.sh)
# Changelog : v1.1.0 — geo_blocks, error_rate, top_scanners, threat_sync, nginx_connections
#             v1.2.0 — cpu_pct, cpu_cores, net_rx/tx LAN+WAN
#             v1.3.0 — proxmox stats (nodes, VMs/LXC, CPU/RAM) — auth ticket ou token
#             v1.4.0 — storage pools, swap, rootfs, services PVE, VM CPU/RAM graphs
#             v1.5.0 — carte geoip menaces (recent_geoips)
#             v1.6.0 — historique bande passante reseau 24h (net_history)
#             v1.7.0 — surveillance SSH (port + sessions + journalctl 24h)
#             v1.8.0 — blocks_per_hour, errors_per_hour, get_ufw_stats()
#             v1.9.0 — get_firewall_matrix() : UFW + ports écoute par machine (SSH) + Proxmox FW
#             v2.0.0 — error_rate = 5xx uniquement · fix doublons blocks/errors_per_hour · /usr/sbin/ufw
#             v2.1.0 — LOG_RE scheme optionnel · proto_breakdown aligné proto-live (CLOSED/RATE_LIMIT/GEO_BLOCK/HTTP/HTTPS/ASSETS/ERROR_5XX)
#             v2.2.0 — parse_ufw_verbose retourne rule_lines → ufw_rule_lines dans JSON (règles firewall dynamiques)
#             v2.3.0 — get_wan_ip() : détection IP WAN publique + géoloc via ipinfo.io → champ wan_ip dans JSON
#             v2.4.0 — proto_breakdown : HTTP scindé en HTTP (bots port 80) + HTTP_REDIRECT (301/302 légitimes)
#             v2.5.0 — get_active_attacks() : Kill Chain live — classification IPs par stage (15 min glissantes)
#             v2.6.0 — get_honeypot_hits() : détection pièges/scanners 24h · BRUTE stage SSH journalctl 15 min
#             v2.7.0 — fail2ban enrichi : bantime par jail + banned_ips [{ip,country}] depuis seen_ips
#             v2.7.1 — _send_mail : multi-destinataires (split virgule) pour alertes
#             v2.7.2 — Kill Chain : 403 GeoIP→RECON (plus EXPLOIT) · _LAN_RE filtre IPs privées
#             v2.7.3 — Kill Chain : suppression code mort SCANNER_RE dans branche 403 (inaccessible — déjà capturé ligne SCAN)
#             v2.8.0 — get_crowdsec_stats() : décisions actives, alertes 24h, scénarios → Kill Chain CrowdSec
#             v2.8.1 — kill_chain enrichi : cs_decisions, cs_stage_counts, cs_decision flag par IP
#             v2.8.2 — recent_geoips enrichi : cs_banned + cs_scenario + cs_stage par IP bannie
#             v2.8.3 — tile CrowdSec enrichie : parser_stats, top scénarios avec stage, top_ips avec pays+AS+durée
#             v2.8.4 — parser_stats : fallback cs_parser_hits_ok_total si cs_reader_hits_total absent
#             v2.9.0 — kill_chain enrichi honeypot : ip_stages depuis chemins pièges → merge sans doublon, source NH
#             v3.0.0 — get_windows_disk() : lecture windows-disk.json (BOM utf-8-sig) → windows_disk dans JSON
#             v3.0.0 — get_cron_jobs()    : statut crons srv-nginx via mtime logs → crons dans JSON
#             v3.0.1 — get_proxmox_fail2ban() : lecture proxmox-fail2ban.json (push Proxmox) → fail2ban.proxmox dans JSON
#             v3.3.0 — get_wan_monitoring() : ping box (<BOX-IP>) + WAN (8.8.8.8/1.1.1.1) + HTTP check
#                      historique 24h dans wan-history.json — status UP/DEGRADED/DOWN_ISP/DOWN_LOCAL
#             v3.3.1 — get_freebox_stats() : API Freebox Delta locale — WAN state, débits, signal fibre SFP dBm, températures
#             v3.5.1 — recent_geoips enrichi : lat/lon/city via GeoLite2-City local (zéro API) · trié par count desc
#             v3.5.2 — auto-ban récidive : ≥3 bans antérieurs → durée 8760h (1 an) au lieu de 24h · _count_autoban_recidives()
#             v3.6.0 — ModSec enrichi : _parse_modsec_audit + _get_modsec_data — blocs 24h, mode BLOCAGE/DÉTECTION, classification attaque/FP
#             v3.6.1 — get_nginx_stats() : req/1h, req/24h, top 10 URLs externes (hors LAN + assets) → nginx_stats dans JSON
#             v3.6.2 — _ts_nginx_stats() : spike req/h + chemins dangereux ciblés → intégré compute_threat_score (14e brique)
#             v3.7.0 — bot_verify.py : crawlers légitimes (Googlebot/Bingbot…) vérifiés FCrDNS → sortis de
#                      la Kill Chain (kill_chain.verified_bots) ; usurpateurs UA → flag spoofed_bot

import re
import json
import os
import subprocess
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import security_events as _security_events
import honeypot_loader as _honeypot_loader
import soc_infra as _soc_infra
import threat_score as _threat_score
import ioc_collect as _ioc_collect
import alerting as _alerting
import crowdsec_stats as _crowdsec_stats
import proxmox_collect as _proxmox_collect
import bot_verify as _bot_verify
import monitoring_validator as _monitoring_validator
import system_metrics as _system_metrics
import freebox_collect as _freebox_collect
import wan_monitor as _wan_monitor
import suricata_collect as _suricata_collect
import xdr_events as _xdr_events
import modsec_apparmor as _modsec_apparmor
import rsyslog_collect as _rsyslog_collect

# GeoLite2-City — enrichissement lat/lon/city pour recent_geoips (zéro API, lookup local)
_CITY_MMDB = '/usr/share/GeoIP/GeoLite2-City.mmdb'
try:
    import geoip2.database as _geoip2_mod
    _city_reader = _geoip2_mod.Reader(_CITY_MMDB) if os.path.exists(_CITY_MMDB) else None
except ImportError:
    _city_reader = None

# IPs / ports / clés SSH — dérivés de soc_infra.yaml (Sprint 1A 2026-05-16).
# Source unique : scripts/soc_infra.yaml. Pour ajouter un host : éditer le yaml.
IP_SRV_NGINX   = _soc_infra.get_host('srv-nginx').get('ip', '')
IP_CLT        = _soc_infra.get_host('clt').get('ip', '')
IP_PA85       = _soc_infra.get_host('pa85').get('ip', '')
IP_PROXMOX    = _soc_infra.get_host('proxmox').get('ip', '')
IP_SRV_DEV1   = _soc_infra.get_host('srv-dev-1').get('ip', '')
SSH_PORT      = _soc_infra.SSH_PORT
SSH_KEY_NGINX  = _soc_infra.SSH_KEYS.get('nginx', '')
SSH_KEY_CLT   = _soc_infra.SSH_KEYS.get('clt', '')
SSH_KEY_PA85  = _soc_infra.SSH_KEYS.get('pa85', '')
SSH_KEY_PVE   = _soc_infra.SSH_KEYS.get('proxmox', '')
SSH_KEY_DEV1  = _soc_infra.SSH_KEYS.get('dev1', '')
DASHBOARD_URL = _soc_infra.DASHBOARD_URL

LOG_FILE      = '/var/log/nginx/access.log'
OUTPUT_PATH   = '/var/www/monitoring/monitoring.json'
SERVICES      = {
    # (url IP brute, Host header à envoyer pour éviter ModSec 920350 sur l'IP literal)
    'clt (<DOMAIN-COM>)': ('http://' + IP_CLT,  '<DOMAIN-COM>'),
    'pa85 (<DOMAIN-FR>)': ('http://' + IP_PA85, '<DOMAIN-FR>'),
}
SSL_DOMAINS   = ['<DOMAIN-COM>', '<DOMAIN-FR>']
SSH_MACHINES  = [
    {'name': 'srv-nginx',  'ip': IP_SRV_NGINX,  'port': SSH_PORT, 'local': True,  'role': 'Reverse Proxy'},
    {'name': 'clt',       'ip': IP_CLT,        'port': SSH_PORT, 'local': False, 'role': 'Backend Web',  'ssh_key': SSH_KEY_CLT},
    {'name': 'pa85',      'ip': IP_PA85,       'port': SSH_PORT, 'local': False, 'role': 'Backend Web',  'ssh_key': SSH_KEY_PA85},
    {'name': 'proxmox',   'ip': IP_PROXMOX,    'port': SSH_PORT, 'local': False, 'role': 'Hyperviseur',  'push_json': '/var/www/monitoring/proxmox-ufw.json', 'ssh_key': SSH_KEY_PVE},
    {'name': 'srv-dev-1', 'ip': IP_SRV_DEV1,   'port': SSH_PORT, 'local': False, 'role': 'Dev JARVIS',   'ssh_key': SSH_KEY_DEV1},
]
CVE_INDEX     = '/var/www/clt/assets/data/index.json'
THREAT_STATS  = '/var/www/clt/assets/data/threat-stats.json'
THREAT_HISTORY_FILE = '/var/www/monitoring/threat_history.json'
NET_HISTORY_FILE    = '/var/www/monitoring/net-history.json'
PVE_CPU_HISTORY_FILE = '/var/www/monitoring/proxmox-cpu-history.json'
SYS_CPU_HISTORY_FILE = '/var/www/monitoring/sys-cpu-history.json'
PVE_NET_HISTORY_FILE = '/var/www/monitoring/pve-net-history.json'
SFP_HISTORY_FILE = '/var/www/monitoring/sfp-history.json'
JARVIS_URL       = 'http://localhost:5000'
SYS_SERVICES_MONITORED = ['nginx', 'crowdsec', 'fail2ban', 'rsyslog', 'ssh']
# Services PVE coeur affiches/tries dans la tuile Proxmox (filtre + ordre — source unique)
# Note : 'corosync' retiré 2026-05-15 — Proxmox standalone (pas de cluster) → corosync
# inactive est NORMAL mais affiché en rouge dans le dashboard. À ré-ajouter SI passage
# en cluster Proxmox un jour (corosync devient critique pour la communication inter-nœuds).
_PVE_SERVICES_ORDER = ['pve-cluster', 'pvedaemon', 'pveproxy', 'pvestatd',
                       'pve-firewall', 'pvescheduler', 'spiceproxy',
                       'pve-ha-crm', 'pve-ha-lrm']

# Proxmox — deux méthodes d'auth (une seule suffit) :
#   1. Token API : renseigner PROXMOX_TOKEN  (PVEAPIToken=user@realm!id=uuid)
#   2. Login/password : renseigner PROXMOX_USER + PROXMOX_PASS (plus simple)
# Laisser PROXMOX_USER et PROXMOX_TOKEN vides pour désactiver le panneau Proxmox
PROXMOX_HOST  = IP_PROXMOX
PROXMOX_PORT  = 8006
PROXMOX_USER  = 'root@pam'   # ex: 'root@pam' ou 'monitor@pam'
try:
    PROXMOX_PASS = open('/opt/clt/.proxmox_pass').read().strip() if __import__('os').path.exists('/opt/clt/.proxmox_pass') else ''  # srv-nginx : /opt/clt/.proxmox_pass (chmod 600)
except Exception:
    PROXMOX_PASS = ''
PROXMOX_TOKEN = ''            # PVEAPIToken=user@realm!tokenid=uuid (alternatif)

ALERT_CONF   = '/opt/clt/alert.conf'
ALERT_STATE  = '/var/www/monitoring/alert-state.json'
AUTOBAN_LOG  = '/var/www/monitoring/autoban-log.json'
BOT_VERIFY_CACHE = '/var/www/monitoring/bot-verify-cache.json'
ALERT_COOLDOWNS = {
    'AUTOBAN':    14400,  # 4h — throttle email auto-ban consolide (R1+R2+R3+R4)
    'F2B_BAN':    7200,   # 2h — delta-based (fire seulement si count augmente)
    'SERVICE_DN': 14400,  # 4h
    'SSL_EXPIRE': 86400,  # 24h (inutilise — cles SSL_<domain> dynamiques, fallback 86400s)
    '5XX_ERROR':  7200,   # 2h
    # Cles SSL dynamiques : SSL_<domain> — cooldown via fallback ALERT_COOLDOWNS.get(key, 86400)
}
AUTOBAN_HIT_THRESHOLD    = 10  # hits/15 min → ban automatique
AUTOBAN_RECIDIVE_SEUIL   = 3   # nb de bans antérieurs → ban permanent (8760h)
# Durées de ban par type — P2 renforcement 2026-04-15
AUTOBAN_DUR_EXPLOIT      = '168h'   # EXPLOIT CVE → 1 semaine (attaque délibérée)
AUTOBAN_DUR_HONEYPOT     = '72h'    # Honeypot hit → 3 jours (intention claire)
AUTOBAN_DUR_BRUTE        = '48h'    # Brute force → 2 jours
AUTOBAN_DUR_HIGHFREQ     = '24h'    # High-freq → 1 jour (peut être scan légitime)

# Règles auto-ban — SOURCE UNIQUE (2026-05-14) : label + icône + durée par règle.
# Le label part dans le reason cscli ('auto-ban SOC <label>') ET dans monitoring.json.
# L'icône part dans monitoring.json (clé 'rule_icon') → le dashboard la lit directement,
# plus aucun mapping label→icône hard-codé côté JS.
# La durée est résolue via la CLÉ de règle (rule_key) — plus de matching fragile par
# sous-chaîne sur le label (l'ancien `if 'HONEYPOT' in label` cassait sur la casse).
# Wording : "non banni CS" (et non "non bloqué") — la requête peut être bloquée par
# nginx (HTTP 444) sans que CrowdSec ait une décision de ban active sur l'IP.
AUTOBAN_RULES = {
    'exploit':  {'label': 'EXPLOIT non banni CS',     'icon': '⊛', 'duration': AUTOBAN_DUR_EXPLOIT},
    'highfreq': {'label': 'haute fréquence',          'icon': '⚡', 'duration': AUTOBAN_DUR_HIGHFREQ},
    'honeypot': {'label': 'honeypot 1-hit',           'icon': '⬡', 'duration': AUTOBAN_DUR_HONEYPOT},
    'brute':    {'label': 'BRUTE non banni CS/f2b',   'icon': '⊗', 'duration': AUTOBAN_DUR_BRUTE},
}

F2B_DEFAULT_BANTIME      = 86400  # durée ban fail2ban par défaut si fail2ban-client ne répond pas (1 jour)
INFRA_SCORE_UFW_INACTIVE = 40    # pénalité score audit infra — UFW inactif
INFRA_SCORE_PORT22       = 20    # pénalité score audit infra — port 22 SSH exposé
INFRA_SCORE_FW_RULES_LOW = 10    # pénalité score audit infra — règles UFW insuffisantes (< 3)

# Format log nginx (v1.1) : $remote_addr [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" country=...
LOG_RE = re.compile(
    r'^(?P<ip>\S+) \[(?P<time>[^\]]+)\] "(?P<request>[^"]+)" '
    r'(?P<status>\d{3}) (?P<bytes>\d+) "(?:[^"]*)" "(?P<ua>[^"]*)" country=(?P<country>\S+)'
    r'(?: scheme=(?P<scheme>\S+))?'
)

# Bots légitimes exclus des "suspects"
LEGIT_BOTS = re.compile(r'Googlebot|Bingbot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|WhatsApp', re.I)
# Scanners / outils offensifs
SCANNER_RE = re.compile(r'masscan|zgrab|nuclei|nikto|sqlmap|nmap|dirbuster|gobuster|hydra|metasploit|burpsuite|acunetix|nessus|openvas|wfuzz|ffuf|feroxbuster|curl/|python-requests|Go-http-client|libwww-perl', re.I)

_BOT_RE = re.compile(r'bot|crawl|spider|slurp', re.I)

# RFC1918 + loopback — IPs internes a exclure des evenements/tops (source unique
# pour tous les filtres KC/menaces du SOC : PROBE, RECON, SCAN, EXPLOIT, WAF, BRUTE).
# Injectee dans alerting.py et security_events.py via .init(). Cf _GCC_RFC1918 plus
# bas pour la variante routeur (etend avec 0. et 255. broadcast).
_rfc1918 = re.compile(r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)')

# ── Système d'alertes SOC — extrait dans alerting.py (split incrémental) ──────
# Injection des constantes partagées (source unique) ; check_and_send_alerts
# reste exposé ici (alias) pour le call site interne (_main_write).
_alerting.init(ALERT_CONF, ALERT_STATE, AUTOBAN_LOG, ALERT_COOLDOWNS,
               AUTOBAN_RULES, AUTOBAN_HIT_THRESHOLD, AUTOBAN_RECIDIVE_SEUIL,
               DASHBOARD_URL, _rfc1918)
check_and_send_alerts = _alerting.check_and_send_alerts
_PVE_SSH_KEY = SSH_KEY_PVE

# ── Collecteur Proxmox VE — extrait dans proxmox_collect.py (split incrémental) ─
_proxmox_collect.init(_PVE_SERVICES_ORDER, _PVE_SSH_KEY, SSH_PORT, PROXMOX_HOST,
                      PROXMOX_PORT, PROXMOX_USER, PROXMOX_PASS, PROXMOX_TOKEN)
get_proxmox_stats = _proxmox_collect.get_proxmox_stats

# ── Vérification FCrDNS des crawlers légitimes — module bot_verify.py ─────────
# Anti-spoof User-Agent : un crawler vérifié sort de la Kill Chain, un
# usurpateur (UA de bot mais FCrDNS KO) y reste classé comme menace.
_bot_verify.init(BOT_VERIFY_CACHE)
_SCANNER_LABELS = (
    ('masscan','masscan'), ('zgrab','zgrab'), ('nuclei','nuclei'),
    ('nikto','nikto'), ('sqlmap','sqlmap'), ('nmap','nmap'),
    ('dirbuster','dirbuster'), ('gobuster','gobuster'),
    ('hydra','hydra'), ('metasploit','metasploit'),
    ('burpsuite','burpsuite'), ('acunetix','acunetix'),
    ('nessus','nessus'), ('openvas','openvas'),
    ('wfuzz','wfuzz'), ('ffuf','ffuf'), ('feroxbuster','feroxbuster'),
    ('curl/','curl'), ('python-requests','python-requests'),
    ('go-http-client','Go-http-client'), ('libwww-perl','libwww-perl'),
)

_ASSETS_RE = re.compile(r'\.(css|js|png|jpg|jpeg|gif|ico|woff2?|svg|webp|ttf)(\?|$)', re.I)


# Stage par chemin honeypot
# HONEYPOT — chargés depuis honeypot.yaml (source unique, Sprint 1B 2026-05-16).
# HONEYPOT_STAGE  : dict {chemin → stage Kill Chain RECON/SCAN/EXPLOIT/BRUTE}
# HONEYPOT_PATHS  : liste plate (ordre yaml) — dérivée pour _scan_re ci-dessous.
# Ajouter/retirer un honeypot = éditer scripts/honeypot.yaml (zéro touche au code).
HONEYPOT_STAGE, HONEYPOT_PATHS = _honeypot_loader.load()

# Regex de detection scan apache — derivee de HONEYPOT_PATHS (source unique, pas de hard-code)
_scan_re = re.compile('|'.join(re.escape(_p) for _p in HONEYPOT_PATHS), re.I)


def _city_lookup(ip):
    """Retourne (city, lat, lon) depuis GeoLite2-City, (None, None, None) si indisponible."""
    if not _city_reader:
        return None, None, None
    try:
        res = _city_reader.city(ip)
        return res.city.name or None, res.location.latitude, res.location.longitude
    except Exception:
        return None, None, None

def _mk_geoip(ip, v):
    """Construit une entrée recent_geoips enrichie avec lat/lon/city si disponible."""
    d = {'ip': ip, 'country': v['country'], 'blocked': v['blocked'],
         'count': v['count'], 'last_seen': v.get('last_seen', '')}
    city, lat, lon = _city_lookup(ip)
    if city:             d['city'] = city
    if lat  is not None: d['lat']  = round(lat,  4)
    if lon  is not None: d['lon']  = round(lon,  4)
    return d


# ── Infrastructure réseau ─────────────────────────────────────────────────────

def _accum_proto(stats, status, ua, _scheme, _path):
    """Mise à jour proto_breakdown (donut) depuis un log nginx."""
    _pb = stats.setdefault('_proto', {})
    if   status == 444:                                  _pb['CLOSED']        = _pb.get('CLOSED',        0) + 1
    elif status == 429:                                  _pb['RATE_LIMIT']    = _pb.get('RATE_LIMIT',    0) + 1
    elif status == 403:                                  _pb['GEO_BLOCK']     = _pb.get('GEO_BLOCK',     0) + 1
    elif SCANNER_RE.search(ua) and not LEGIT_BOTS.search(ua): _pb['SCANNER'] = _pb.get('SCANNER',       0) + 1
    elif LEGIT_BOTS.search(ua):                          _pb['LEGIT_BOT']     = _pb.get('LEGIT_BOT',     0) + 1
    elif _BOT_RE.search(ua):                             _pb['BOT']           = _pb.get('BOT',           0) + 1
    elif status in (301, 302):                           _pb['HTTP_REDIRECT'] = _pb.get('HTTP_REDIRECT', 0) + 1
    elif _scheme == 'http':                              _pb['HTTP']          = _pb.get('HTTP',          0) + 1
    elif status == 404:                                  _pb['NOT_FOUND']     = _pb.get('NOT_FOUND',     0) + 1
    elif status >= 500:                                  _pb['ERROR_5XX']     = _pb.get('ERROR_5XX',     0) + 1
    elif _ASSETS_RE.search(_path):                       _pb['ASSETS']        = _pb.get('ASSETS',        0) + 1
    elif 200 <= status < 300:                            _pb['HTTPS']         = _pb.get('HTTPS',         0) + 1
    else:                                                _pb['OTHER']         = _pb.get('OTHER',         0) + 1

def _accumulate_log_entry(m, ts, stats, full=True):
    """Accumule une entrée de log nginx dans stats. full=True : inclut ua/proto/pages."""
    ip      = m.group('ip')
    status  = int(m.group('status'))
    country = m.group('country')
    nbytes  = int(m.group('bytes'))
    hour    = ts.strftime('%H:00')
    last_seen_hm = ts.strftime('%H:%M')

    stats['total_requests'] += 1
    stats['total_bytes']    += nbytes
    stats['bytes_per_hour'][hour]   += nbytes
    stats['requests_per_hour'][hour] += 1
    stats['top_ips'][ip]             += 1
    if status in (403, 444, 429): stats['blocks_per_hour'][hour] += 1
    if status >= 500:             stats['errors_per_hour'][hour] += 1

    if   200 <= status < 300: stats['status_2xx'] += 1
    elif 300 <= status < 400: stats['status_3xx'] += 1
    elif 400 <= status < 500: stats['status_4xx'] += 1
    elif 500 <= status < 600: stats['status_5xx'] += 1

    if status == 403 and country not in ('FR', '-'):
        stats['geo_blocks'] += 1

    blocked = (status in (403, 444) and country not in ('FR', '-', 'XX'))
    if ip not in stats['seen_ips']:
        stats['seen_ips'][ip] = {'country': country, 'blocked': blocked, 'count': 1, 'last_seen': last_seen_hm}
    else:
        stats['seen_ips'][ip]['count'] += 1
        stats['seen_ips'][ip]['last_seen'] = last_seen_hm
        if blocked:
            stats['seen_ips'][ip]['blocked'] = True

    if country not in ('-', 'XX'):
        stats['top_countries'][country] += 1

    if not full:
        return

    # ── Champs full uniquement (access.log courant) ──
    req = m.group('request')
    ua  = m.group('ua')

    if _BOT_RE.search(ua):
        stats['bots'] += 1

    if SCANNER_RE.search(ua) and not LEGIT_BOTS.search(ua):
        _ua_low = ua.lower()
        _label  = ua[:80]
        for _pat, _lbl in _SCANNER_LABELS:
            if _pat in _ua_low:
                _label = _lbl
                break
        stats['top_scanners'][_label] += 1

    parts = req.split()
    if len(parts) >= 2:
        stats['top_pages'][parts[1].split('?')[0]] += 1

    # Proto breakdown (donut chart)
    _path = parts[1] if len(parts) >= 2 else ''
    try:
        _scheme = m.group('scheme') or ''
    except Exception:
        _scheme = ''

    _accum_proto(stats, status, ua, _scheme, _path)


def _parse_log_file(path, stats, cutoff, full=True):
    """Parse un fichier access.log nginx et accumule dans stats."""
    try:
        with open(path, 'r', errors='replace') as f:
            for line in f:
                m = LOG_RE.match(line)
                if not m:
                    continue
                try:
                    ts = datetime.strptime(m.group('time'), '%d/%b/%Y:%H:%M:%S %z')
                except ValueError:
                    continue
                if ts < cutoff:
                    continue
                _accumulate_log_entry(m, ts, stats, full=full)
    except (FileNotFoundError, OSError):
        pass


def parse_logs_24h():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    stats = {
        'total_requests': 0, 'total_bytes': 0,
        'status_2xx': 0, 'status_3xx': 0, 'status_4xx': 0, 'status_5xx': 0,
        'geo_blocks': 0, 'bots': 0,
        'top_ips':           defaultdict(int),
        'top_pages':         defaultdict(int),
        'top_countries':     defaultdict(int),
        'top_scanners':      defaultdict(int),
        'requests_per_hour': defaultdict(int),
        'bytes_per_hour':    defaultdict(int),
        'blocks_per_hour':   defaultdict(int),
        'errors_per_hour':   defaultdict(int),
        'seen_ips': {},
    }

    _parse_log_file(LOG_FILE, stats, cutoff, full=True)
    # access.log.1 = log rotaté minuit → couvre les 24h complètes (stats de base, sans ua/proto)
    _log1 = LOG_FILE + '.1'
    if os.path.exists(_log1):
        _parse_log_file(_log1, stats, cutoff, full=False)

    total     = stats['total_requests']
    error_rate = round(stats['status_5xx'] * 100 / total, 1) if total > 0 else 0.0
    unique_ips = len(stats['seen_ips'])
    unique_visitors = sum(1 for v in stats['seen_ips'].values() if not v['blocked'])

    return {
        'total_requests':    total,
        'total_bytes':       stats['total_bytes'],
        'unique_ips':        unique_ips,
        'unique_visitors':   unique_visitors,
        'status_2xx':        stats['status_2xx'],
        'status_3xx':        stats['status_3xx'],
        'status_4xx':        stats['status_4xx'],
        'status_5xx':        stats['status_5xx'],
        'geo_blocks':        stats['geo_blocks'],
        'error_rate':        error_rate,
        'bots':              stats['bots'],
        'top_ips':           sorted(stats['top_ips'].items(),       key=lambda x: -x[1])[:10],
        'top_pages':         sorted(stats['top_pages'].items(),     key=lambda x: -x[1])[:10],
        'top_countries':     sorted(stats['top_countries'].items(), key=lambda x: -x[1])[:15],
        'top_scanners':      sorted(stats['top_scanners'].items(),  key=lambda x: -x[1])[:8],
        'requests_per_hour': dict(sorted(stats['requests_per_hour'].items())),
        'bytes_per_hour':    dict(sorted(stats['bytes_per_hour'].items())),
        'blocks_per_hour':   dict(sorted(stats['blocks_per_hour'].items())),
        'errors_per_hour':   dict(sorted(stats['errors_per_hour'].items())),
        'proto_breakdown':   stats.get('_proto', {}),
        'recent_geoips': sorted([
            _mk_geoip(ip, v)
            for ip, v in stats['seen_ips'].items()
            if v['country'] not in ('-', 'XX', '')
        ], key=lambda x: x['count'], reverse=True)[:200],
        '_seen_ips': stats['seen_ips'],
    }

def check_services():
    results = {}
    for name, (url, host) in SERVICES.items():
        t0 = time.time()
        try:
            # Host header explicite : évite ModSec 920350 (Host=numeric IP) côté backend.
            # Sans ça, le check spam les logs CLT/PA85 d'1 alerte WAF par minute.
            req = Request(url, headers={
                'User-Agent': '0xCyberLiTech-Monitor/1.0',
                'Host': host,
            })
            with urlopen(req, timeout=5) as r:
                status = r.status
            ms = int((time.time() - t0) * 1000)
            results[name] = {'status': 'UP', 'http_code': status, 'ms': ms}
        except HTTPError as e:
            ms = int((time.time() - t0) * 1000)
            # 4xx = service répond (Apache en ligne, accès refusé normal) → UP
            # 5xx = erreur serveur → DOWN
            if e.code < 500:
                results[name] = {'status': 'UP', 'http_code': e.code, 'ms': ms}
            else:
                results[name] = {'status': 'DOWN', 'http_code': e.code, 'error': str(e)[:80], 'ms': ms}
        except Exception as e:
            ms = int((time.time() - t0) * 1000)
            results[name] = {'status': 'DOWN', 'error': str(e)[:80], 'ms': ms}
    return results

def get_ssl_expiry(domain):
    try:
        out = subprocess.check_output(
            ['openssl', 's_client', '-connect', f'{domain}:443', '-servername', domain],
            input=b'', stderr=subprocess.DEVNULL, timeout=10
        )
        cert = subprocess.check_output(
            ['openssl', 'x509', '-noout', '-enddate'],
            input=out, stderr=subprocess.DEVNULL, timeout=5
        ).decode()
        date_str = cert.strip().split('=', 1)[1]
        expiry = datetime.strptime(date_str, '%b %d %H:%M:%S %Y %Z').replace(tzinfo=timezone.utc)
        days = (expiry - datetime.now(timezone.utc)).days
        return {'domain': domain, 'expiry': expiry.strftime('%Y-%m-%d'), 'days_left': days}
    except Exception as e:
        return {'domain': domain, 'error': str(e)[:80], 'days_left': -1}

# ── Métriques système Linux → module system_metrics.py (Sprint 2A 2026-05-16) ─
get_system_metrics = _system_metrics.get_system_metrics


def get_nginx_info():
    """Version nginx + workers actifs via pgrep."""
    info = {'version': None, 'workers': None}
    try:
        out = subprocess.check_output(['/usr/sbin/nginx', '-v'], stderr=subprocess.STDOUT, timeout=5).decode()
        m = re.search(r'nginx/([\d.]+)', out)
        if m:
            info['version'] = m.group(1)
    except Exception:
        pass
    try:
        out = subprocess.check_output(['pgrep', '-c', 'nginx'], timeout=5).decode().strip()
        info['workers'] = max(0, int(out) - 1)
    except Exception:
        pass
    return info


CVE_RECENT  = '/var/www/clt/assets/data/cve-recent.json'
CVE_SUMMARY = '/var/www/clt/assets/data/cve-summary.json'

def get_cve_sync():
    try:
        with open(CVE_INDEX) as f:
            idx = json.load(f)
        months = idx.get('months', [])
        last_update = idx.get('generated', 'unknown')

        # Cache: ne re-parse que si cve-recent.json est plus récent que le résumé
        recent_mtime  = os.path.getmtime(CVE_RECENT) if os.path.exists(CVE_RECENT) else 0
        summary_mtime = os.path.getmtime(CVE_SUMMARY) if os.path.exists(CVE_SUMMARY) else 0
        if summary_mtime >= recent_mtime and os.path.exists(CVE_SUMMARY):
            with open(CVE_SUMMARY) as f:
                cached = json.load(f)
            cached['months'] = len(months)
            cached['last_update'] = last_update
            return cached

        # Parse complet de cve-recent.json
        counts = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        network_count = 0
        total = 0
        with open(CVE_RECENT) as f:
            cves = json.load(f)
        for item in cves:
            m = item.get('cve', {}).get('metrics', {})
            entries = (m.get('cvssMetricV31') or m.get('cvssMetricV30') or
                       m.get('cvssMetricV40') or m.get('cvssMetricV2') or [])
            if not entries:
                continue
            cd = entries[0].get('cvssData', {})
            sev = cd.get('baseSeverity', '').upper()
            if sev in counts:
                counts[sev] += 1
                total += 1
                if 'AV:N' in cd.get('vectorString', ''):
                    network_count += 1

        summary = {
            'last_update':  last_update,
            'months':       len(months),
            'total':        total,
            'critical':     counts['CRITICAL'],
            'high':         counts['HIGH'],
            'medium':       counts['MEDIUM'],
            'low':          counts['LOW'],
            'network_av':   network_count,
        }
        try:
            tmp = CVE_SUMMARY + '.tmp'
            with open(tmp, 'w') as f:
                json.dump(summary, f)
            os.replace(tmp, CVE_SUMMARY)
        except Exception:
            pass
        return summary
    except Exception as e:
        return {'error': str(e)[:80]}

def get_threat_sync():
    # threat-stats.json keys: generated, date, urlhaus, malwarebazaar, threatfox, feodo
    try:
        with open(THREAT_STATS) as f:
            data = json.load(f)
        # Compter les samples dans chaque source
        total = 0
        sources = {}
        # Clés spécifiques par source
        src_keys = {
            'urlhaus':       'urls_online',
            'malwarebazaar': 'samples_today',
            'threatfox':     'iocs_today',
            'feodo':         'c2s_active',
        }
        for src, key in src_keys.items():
            if src in data and isinstance(data[src], dict):
                count = data[src].get(key, 0)
                sources[src] = count
                total += count
        return {
            'last_update':   data.get('generated', 'unknown'),
            'total_samples': total,
            'sources':       sources,
        }
    except Exception as e:
        return {'error': str(e)[:80]}

def update_pve_cpu_history(cpu_pct, cpu_temp):
    """Accumule l'historique CPU/temp Proxmox (48 points max = 4h à 5 min)."""
    MAX_POINTS = 48
    points = []
    if os.path.exists(PVE_CPU_HISTORY_FILE):
        try:
            with open(PVE_CPU_HISTORY_FILE) as f:
                points = json.load(f)
        except Exception:
            pass
    points.append({'ts': int(time.time()), 'cpu': cpu_pct, 'temp': cpu_temp})
    points = points[-MAX_POINTS:]
    try:
        tmp = PVE_CPU_HISTORY_FILE + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(points, f)
        os.replace(tmp, PVE_CPU_HISTORY_FILE)
    except Exception:
        pass
    return points


def update_sys_cpu_history(cpu_pct, cpu_temp=None):
    """Accumule l'historique CPU/temp srv-nginx (48 points max = 4h à 5 min)."""
    MAX_POINTS = 48
    points = []
    if os.path.exists(SYS_CPU_HISTORY_FILE):
        try:
            with open(SYS_CPU_HISTORY_FILE) as f:
                points = json.load(f)
        except Exception:
            pass
    points.append({'ts': int(time.time()), 'cpu': cpu_pct, 'temp': cpu_temp})
    points = points[-MAX_POINTS:]
    try:
        tmp = SYS_CPU_HISTORY_FILE + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(points, f)
        os.replace(tmp, SYS_CPU_HISTORY_FILE)
    except Exception:
        pass
    return points


def get_sys_services():
    """État des services système clés via systemctl."""
    svcs = SYS_SERVICES_MONITORED
    result = {}
    for svc in svcs:
        try:
            r = subprocess.run(['systemctl', 'is-active', svc],
                               capture_output=True, text=True, timeout=3)
            result[svc] = r.stdout.strip() == 'active'
        except Exception:
            result[svc] = None
    return result


def update_net_history():
    """Accumule l'historique bande passante reseau 24h (snapshots toutes les 5 min)."""
    try:
        rx_total, tx_total, iface = 0, 0, None
        with open('/proc/net/dev') as f:
            for line in f:
                p = line.split()
                if not p or ':' not in p[0]:
                    continue
                name = p[0].rstrip(':')
                if name == 'lo':
                    continue
                try:
                    rx_total, tx_total, iface = int(p[1]), int(p[9]), name
                    break
                except (IndexError, ValueError):
                    continue
        if not iface:
            return []
        ts = int(time.time())
        raw = {}
        points = []
        if os.path.exists(NET_HISTORY_FILE):
            try:
                with open(NET_HISTORY_FILE) as f:
                    saved = json.load(f)
                    raw = saved.get('raw', {})
                    points = saved.get('points', [])
            except Exception:
                pass
        cutoff = ts - _soc_infra.DAILY_WINDOW_S   # 24h en secondes — source unique soc_infra.yaml
        points = [p for p in points if p.get('ts', 0) > cutoff]
        if raw.get('ts') and 0 < ts - raw['ts'] < 600:
            dt = ts - raw['ts']
            rx_rate = max(0, (rx_total - raw.get('rx', rx_total))) // dt
            tx_rate = max(0, (tx_total - raw.get('tx', tx_total))) // dt
            points.append({'ts': ts, 'rx': rx_rate, 'tx': tx_rate})
        tmp = NET_HISTORY_FILE + '.tmp'
        with open(tmp, 'w') as f:
            json.dump({'raw': {'ts': ts, 'rx': rx_total, 'tx': tx_total},
                       'iface': iface, 'points': points}, f)
        os.replace(tmp, NET_HISTORY_FILE)
        return points[-48:]  # 4h max (48 x 5min)
    except Exception:
        return []

def _ssh_local_stats():
    """Sessions actives SSH + stats 24h journalctl sur srv-nginx."""
    active_sessions = 0
    active_ips = []
    try:
        res = subprocess.run(['ss', '-tnp', 'sport', '=', f':{SSH_PORT}'],
                             capture_output=True, text=True, timeout=3)
        for line in res.stdout.strip().split('\n'):
            if 'ESTAB' in line:
                parts = line.split()
                peer = parts[4] if len(parts) > 4 else ''
                ip = peer.rsplit(':', 1)[0]
                active_sessions += 1
                if ip and ip not in active_ips:
                    active_ips.append(ip)
    except Exception:
        pass
    accepted_24h = 0
    failed_24h   = 0
    accepted_ips_24h = []
    try:
        res = subprocess.run(
            ['journalctl', '-u', 'ssh', '--since', '24 hours ago', '--no-pager', '-q'],
            capture_output=True, text=True, timeout=8)
        for line in res.stdout.split('\n'):
            if 'Accepted' in line:
                accepted_24h += 1
                m2 = re.search(r'from\s+(\d+\.\d+\.\d+\.\d+)', line)
                if m2:
                    ip2 = m2.group(1)
                    if ip2 not in accepted_ips_24h:
                        accepted_ips_24h.append(ip2)
            elif 'Failed password' in line or 'Invalid user' in line:
                failed_24h += 1
    except Exception:
        pass
    return active_sessions, active_ips, accepted_24h, failed_24h, accepted_ips_24h


def get_ssh_stats():
    """Surveillance SSH : port, sessions actives, connexions 24h via journalctl."""
    import socket as _sock
    active_sessions, active_ips, accepted_24h, failed_24h, accepted_ips_24h = _ssh_local_stats()

    results = []
    for m in SSH_MACHINES:
        port_open = False
        try:
            s = _sock.socket(_sock.AF_INET, _sock.SOCK_STREAM)
            s.settimeout(2)
            port_open = (s.connect_ex((m['ip'], m['port'])) == 0)
            s.close()
        except Exception:
            pass

        entry = {
            'name':      m['name'],
            'ip':        m['ip'],
            'port':      m['port'],
            'port_open': port_open,
        }
        if m.get('local'):
            entry['accepted_24h']     = accepted_24h
            entry['failed_24h']       = failed_24h
            entry['active_sessions']  = active_sessions
            entry['active_ips']       = active_ips
            entry['accepted_ips_24h'] = accepted_ips_24h
            try:
                with open('/proc/uptime') as f:
                    secs = float(f.read().split()[0])
                tot_m = int(secs // 60)
                d_u = tot_m // 1440; h_u = (tot_m % 1440) // 60; m_u = tot_m % 60
                entry['uptime'] = f'{d_u}j {h_u}h {m_u}m'
            except Exception:
                entry['uptime'] = '?'
        elif m.get('ssh_key') and port_open:
            try:
                cmd_base = ['ssh', '-i', m['ssh_key'], '-p', str(m['port']),
                            '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                            '-o', 'ConnectTimeout=3', '-o', 'BatchMode=yes',
                            f"root@{m['ip']}"]
                script = (
                    f"echo SESSIONS=$(ss -tnp sport = :{SSH_PORT} 2>/dev/null | grep -c ESTAB || echo 0); "
                    "echo ACCEPTED=$(journalctl -u ssh --since '24 hours ago' --no-pager -q 2>/dev/null | grep -c Accepted || echo 0); "
                    "echo FAILED=$(journalctl -u ssh --since '24 hours ago' --no-pager -q 2>/dev/null | grep -cE 'Failed|Invalid' || echo 0); "
                    "echo UPTIME=$(awk '{d=int($1/86400);h=int(($1%86400)/3600);m=int(($1%3600)/60);printf \"%dj %dh %dm\",d,h,m}' /proc/uptime)"
                )
                out = subprocess.check_output(cmd_base + [script],
                    stderr=subprocess.DEVNULL, timeout=6).decode()
                kv = dict(line.split('=', 1) for line in out.strip().split('\n') if '=' in line)
                entry['active_sessions'] = int(kv.get('SESSIONS', 0))
                entry['accepted_24h']    = int(kv.get('ACCEPTED', 0))
                entry['failed_24h']      = int(kv.get('FAILED', 0))
                entry['active_ips']      = []
                entry['uptime']          = kv.get('UPTIME', '?')
            except Exception:
                entry['ssh_unavailable'] = True
        elif not m.get('ssh_key') and not m.get('local'):
            entry['ssh_unavailable'] = True
        results.append(entry)
    return results
def get_fail2ban_stats():
    """Statistiques fail2ban : jails actifs, bans actifs, total bans."""
    try:
        status_out = subprocess.check_output(
            ['fail2ban-client', 'status'], stderr=subprocess.DEVNULL, timeout=5
        ).decode()
        jail_line = re.search(r'Jail list:\s*(.*)', status_out)
        jails_order = [j.strip() for j in jail_line.group(1).split(',')] if jail_line else ['sshd']
    except Exception:
        jails_order = ['sshd']
    results = []
    total_banned = 0
    total_failed = 0
    try:
        for jail in jails_order:
            try:
                out = subprocess.check_output(
                    ['fail2ban-client', 'status', jail],
                    stderr=subprocess.DEVNULL, timeout=5
                ).decode()
                cur_failed  = int(re.search(r'Currently failed:\s+(\d+)', out).group(1))
                tot_failed  = int(re.search(r'Total failed:\s+(\d+)', out).group(1))
                cur_banned  = int(re.search(r'Currently banned:\s+(\d+)', out).group(1))
                tot_banned  = int(re.search(r'Total banned:\s+(\d+)', out).group(1))
                banned_list = re.search(r'Banned IP list:\s*(.*)', out)
                banned_ips  = banned_list.group(1).split() if banned_list else []
                try:
                    bt_out = subprocess.check_output(
                        ['fail2ban-client', 'get', jail, 'bantime'],
                        stderr=subprocess.DEVNULL, timeout=3
                    ).decode().strip()
                    bantime = int(bt_out)
                except Exception:
                    bantime = F2B_DEFAULT_BANTIME
                total_banned += cur_banned
                total_failed += tot_failed
                results.append({
                    'jail': jail,
                    'cur_failed': cur_failed,
                    'tot_failed': tot_failed,
                    'cur_banned': cur_banned,
                    'tot_banned': tot_banned,
                    'banned_ips': banned_ips[:5],
                    'bantime': bantime,
                })
            except Exception:
                results.append({'jail': jail, 'cur_failed': 0, 'tot_failed': 0,
                                 'cur_banned': 0, 'tot_banned': 0, 'banned_ips': []})
    except Exception:
        pass
    return {'jails': results, 'total_banned': total_banned, 'total_failed': total_failed}

def get_ufw_stats():
    """Statistiques pare-feu UFW 24h via journalctl kernel logs."""
    blocked_total = 0
    top_ports = {}
    top_ips = {}
    top_protos = {}
    try:
        res = subprocess.run(
            ['journalctl', '-k', '--since', '24 hours ago', '--no-pager', '-q'],
            capture_output=True, text=True, timeout=10)
        for line in res.stdout.split('\n'):
            if 'UFW BLOCK' not in line:
                continue
            blocked_total += 1
            m = re.search(r'DPT=(\d+)', line)
            if m:
                p = m.group(1)
                top_ports[p] = top_ports.get(p, 0) + 1
            m = re.search(r'SRC=([\d.a-f:]+)', line)
            if m:
                ip = m.group(1)
                top_ips[ip] = top_ips.get(ip, 0) + 1
            m = re.search(r'PROTO=(\w+)', line)
            if m:
                proto = m.group(1)
                top_protos[proto] = top_protos.get(proto, 0) + 1
    except Exception:
        pass
    return {
        'blocked_total': blocked_total,
        'top_ports': sorted(top_ports.items(), key=lambda x: -x[1])[:8],
        'top_ips':   sorted(top_ips.items(),   key=lambda x: -x[1])[:5],
        'protos':    top_protos,
    }

UFW_CACHE_DIR = '/var/www/monitoring'

def _save_ufw_cache(name, rule_lines):
    try:
        path = os.path.join(UFW_CACHE_DIR, f'ufw-cache-{name}.json')
        with open(path + '.tmp', 'w') as f:
            json.dump(rule_lines, f)
        os.replace(path + '.tmp', path)
    except Exception:
        pass

def _load_ufw_cache(name):
    try:
        path = os.path.join(UFW_CACHE_DIR, f'ufw-cache-{name}.json')
        with open(path) as f:
            return json.load(f)
    except Exception:
        return []

def _fw_parse_ufw_verbose(text):
    """Strip ANSI codes, detect UFW active status and rule list."""
    clean = re.sub(r'\x1b\[[0-9;]*[mK]', '', text)
    active = 'Status: active' in clean
    rules, in_rules, has_rules_section = [], False, False
    for line in clean.split('\n'):
        s = line.strip()
        if s.startswith('--') and '----' in s:
            in_rules = True; has_rules_section = True; continue
        if in_rules and s and '(v6)' not in s:
            rules.append(s)
    # Si pas de section règles (fallback sysctl), ne pas pénaliser → retourner 99
    count      = len(rules) if has_rules_section else 99
    rule_lines = rules      if has_rules_section else []
    return active, count, rule_lines


def _fw_parse_ss_ports(text):
    """Parse ss -tlnp output → sorted list of listening TCP ports."""
    ports = set()
    for line in text.split('\n'):
        if 'LISTEN' not in line:
            continue
        cols = line.split()
        if len(cols) < 4:
            continue
        addr = cols[3]
        if ':' in addr:
            p = addr.rsplit(':', 1)[-1]
            if p.isdigit():
                n = int(p)
                if 0 < n < 65536:
                    ports.add(n)
    return sorted(ports)


def _fw_conformity(ufw_active, listening_ports, ufw_rules):
    """Compute conformity score (0–100) and issue list for a host."""
    score, issues = 100, []
    if not ufw_active:
        score -= INFRA_SCORE_UFW_INACTIVE; issues.append('UFW inactif')
    if 22 in listening_ports:
        score -= INFRA_SCORE_PORT22; issues.append('Port 22 exposé')
    if ufw_active and ufw_rules < 3:
        score -= INFRA_SCORE_FW_RULES_LOW; issues.append('Règles UFW insuffisantes')
    return max(0, score), issues


def _fw_local_nginx():
    """Collecte UFW + ports en écoute sur srv-nginx (local), retourne entry dict."""
    try:
        ufw_out = subprocess.run(['/usr/sbin/ufw', 'status', 'verbose'],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=6).stdout
        if 'problem running sysctl' in ufw_out or len(ufw_out) < 50:
            import time as _t; _t.sleep(1)
            ufw_out2 = subprocess.run(['/usr/sbin/ufw', 'status', 'verbose'],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=6).stdout
            if 'Status: active' in ufw_out2:
                ufw_out = ufw_out2
            else:
                svc = subprocess.run(['systemctl', 'is-active', 'ufw'],
                    capture_output=True, text=True, timeout=3).stdout.strip()
                if svc == 'active':
                    ufw_out = 'Status: active\n' + ufw_out
        ss_out = subprocess.run(['ss', '-tlnp'],
            capture_output=True, text=True, timeout=5).stdout
        active, rules, rule_lines = _fw_parse_ufw_verbose(ufw_out)
        if rule_lines:
            _save_ufw_cache('srv-nginx', rule_lines)
        else:
            rule_lines = _load_ufw_cache('srv-nginx')
        ports = _fw_parse_ss_ports(ss_out)
        score, issues = _fw_conformity(active, ports, rules)
        return {
            'name': 'srv-nginx', 'ip': IP_SRV_NGINX, 'role': 'Reverse Proxy',
            'ufw_active': active, 'ufw_rules': rules, 'ufw_rule_lines': rule_lines,
            'listening_ports': ports, 'conformity': score, 'issues': issues,
        }
    except Exception as ex:
        return {'name': 'srv-nginx', 'ip': IP_SRV_NGINX, 'role': 'Reverse Proxy',
                'error': str(ex)[:80]}


def get_firewall_matrix():
    """Collecte état UFW + ports en écoute sur chaque machine pour la matrice firewall SOC."""
    results = [_fw_local_nginx()]

    for m in SSH_MACHINES:
        if m.get('local') or not m.get('push_json'):
            continue
        try:
            with open(m['push_json']) as f:
                d = json.load(f)
            if not d.get('available', False):
                results.append({'name': m['name'], 'ip': m['ip'], 'role': m.get('role', 'Hyperviseur'),
                                'error': 'proxmox-ufw.json non disponible'})
                continue
            results.append({
                'name':            d.get('name', m['name']),
                'ip':              d.get('ip', m['ip']),
                'role':            d.get('role', m.get('role', 'Hyperviseur')),
                'ufw_active':      d.get('ufw_active', False),
                'ufw_rules':       d.get('ufw_rules', 0),
                'ufw_rule_lines':  d.get('ufw_rule_lines', []),
                'listening_ports': d.get('listening_ports', []),
                'conformity':      d.get('conformity', 0),
                'issues':          d.get('issues', []),
            })
        except Exception as ex:
            results.append({'name': m['name'], 'ip': m['ip'], 'role': m.get('role', 'Hyperviseur'),
                            'error': str(ex)[:80]})

    for m in SSH_MACHINES:
        if m.get('local') or not m.get('ssh_key') or m.get('push_json'):
            continue
        try:
            cmd = ['ssh', '-i', m['ssh_key'], '-p', str(m['port']),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=3', '-o', 'BatchMode=yes',
                   f"root@{m['ip']}"]
            script = "ufw status verbose 2>/dev/null; printf '\\n===SS===\\n'; ss -tlnp 2>/dev/null"
            out = subprocess.check_output(cmd + [script],
                stderr=subprocess.DEVNULL, timeout=8).decode()
            parts = out.split('===SS===')
            active, rules, rule_lines = _fw_parse_ufw_verbose(parts[0])
            if rule_lines:
                _save_ufw_cache(m['name'], rule_lines)
            else:
                rule_lines = _load_ufw_cache(m['name'])
            ports = _fw_parse_ss_ports(parts[1] if len(parts) > 1 else '')
            score, issues = _fw_conformity(active, ports, rules)
            results.append({
                'name': m['name'], 'ip': m['ip'], 'role': m.get('role', 'Backend Web'),
                'ufw_active': active, 'ufw_rules': rules, 'ufw_rule_lines': rule_lines,
                'listening_ports': ports, 'conformity': score, 'issues': issues,
            })
        except Exception as ex:
            results.append({'name': m['name'], 'ip': m['ip'], 'role': m.get('role', 'Backend Web'),
                            'error': str(ex)[:80]})

    return {'hosts': results}

# ── Collecteur Proxmox VE → module proxmox_collect.py (split incrémental) ─────
# get_proxmox_stats exposé via alias (voir init plus haut). update_pve_net_history
# reste ici (appelée par le builder principal, hors famille _pve_*).

def update_pve_net_history(node_network):
    """Historique débit réseau Proxmox — bytes/s par interface (48 pts max = 4h)."""
    MAX_POINTS = 48
    SKIP_PFX = ('tap', 'veth', 'fwbr', 'fwln', 'fwpr', 'docker', 'lxc', 'virbr', 'wg')
    ifaces = {i['name']: i for i in (node_network or [])
              if not any(i['name'].startswith(p) for p in SKIP_PFX)}
    if not ifaces:
        return []
    now = int(time.time())
    history = []
    if os.path.exists(PVE_NET_HISTORY_FILE):
        try:
            with open(PVE_NET_HISTORY_FILE) as f:
                history = json.load(f)
        except Exception:
            pass
    cur_raw = {name: {'rx': ifc['rx_bytes'], 'tx': ifc['tx_bytes']} for name, ifc in ifaces.items()}
    new_ifaces = {}
    if history:
        prev = history[-1]
        prev_raw = prev.get('_raw', {})
        prev_ts  = prev.get('ts', now - 300)
        dt = max(now - prev_ts, 1)
        for name, cur in cur_raw.items():
            if name in prev_raw:
                rx_d = max(0, cur['rx'] - prev_raw[name].get('rx', 0))
                tx_d = max(0, cur['tx'] - prev_raw[name].get('tx', 0))
                new_ifaces[name] = {'rx_bps': round(rx_d / dt), 'tx_bps': round(tx_d / dt)}
            else:
                new_ifaces[name] = {'rx_bps': 0, 'tx_bps': 0}
    history.append({'ts': now, '_raw': cur_raw, 'ifaces': new_ifaces})
    history = history[-MAX_POINTS:]
    try:
        tmp = PVE_NET_HISTORY_FILE + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(history, f)
        os.replace(tmp, PVE_NET_HISTORY_FILE)
    except Exception:
        pass
    return [{'ts': p['ts'], 'ifaces': p['ifaces']} for p in history if p.get('ifaces')]

# ── Freebox API → module freebox_collect.py (Sprint 2A 2026-05-16) ───────────
get_wan_ip       = _freebox_collect.get_wan_ip
get_freebox_stats = _freebox_collect.get_freebox_stats


# ── WAN monitoring → module wan_monitor.py (Sprint 2A 2026-05-16) ─────
get_wan_monitoring = _wan_monitor.get_wan_monitoring

def _attack_nginx(cutoff, stage_idx):
    """Parse access.log nginx (15 min) — retourne ip_data dict."""
    ip_data = {}
    try:
        with open(LOG_FILE, 'r', errors='replace') as f:
            for line in f:
                m = LOG_RE.match(line)
                if not m:
                    continue
                try:
                    ts = datetime.strptime(m.group('time'), '%d/%b/%Y:%H:%M:%S %z')
                except ValueError:
                    continue
                if ts < cutoff:
                    continue
                ip = m.group('ip')
                if _rfc1918.match(ip):
                    continue
                status  = int(m.group('status'))
                ua      = m.group('ua')
                country = m.group('country')
                if status == 444:
                    stage = 'RECON'
                elif status == 400 or (SCANNER_RE.search(ua) and not LEGIT_BOTS.search(ua)):
                    stage = 'SCAN'
                elif status == 429:
                    stage = 'EXPLOIT'
                elif status == 403:
                    stage = 'EXPLOIT' if country in ('FR', '-') else 'RECON'
                else:
                    continue
                sidx = stage_idx[stage]
                if ip not in ip_data:
                    ip_data[ip] = {'stage_idx': sidx, 'count': 1, 'country': country, 'ua': ua}
                else:
                    d = ip_data[ip]
                    d['count'] += 1
                    d['ua'] = ua
                    if sidx > d['stage_idx']:
                        d['stage_idx'] = sidx
    except FileNotFoundError:
        pass
    return ip_data


def get_active_attacks():
    """Parse les 15 dernières minutes du log nginx + journalctl SSH.
    Stages : RECON (444/geoblock) → SCAN (400/scanner) → EXPLOIT (403 FR/LAN ou 429) → BRUTE (SSH failed).
    Note : 403 étranger (GeoIP block) → RECON — pas EXPLOIT (faux positif).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    STAGE_ORDER = ['RECON', 'SCAN', 'EXPLOIT', 'BRUTE']
    STAGE_IDX   = {s: i for i, s in enumerate(STAGE_ORDER)}
    ip_data = _attack_nginx(cutoff, STAGE_IDX)

    _ssh_brute_re = re.compile(r'(?:Failed password|Invalid user).*from (\d{1,3}(?:\.\d{1,3}){3})')
    try:
        res = subprocess.run(
            ['journalctl', '-u', 'ssh', '--since', '15 minutes ago', '--no-pager', '-q'],
            capture_output=True, text=True, timeout=5)
        for line in res.stdout.split('\n'):
            bm = _ssh_brute_re.search(line)
            if not bm:
                continue
            ip = bm.group(1)
            if _rfc1918.match(ip):   # exclure RFC1918/loopback — jamais en BRUTE KC
                continue
            sidx = STAGE_IDX['BRUTE']
            if ip not in ip_data:
                ip_data[ip] = {'stage_idx': sidx, 'count': 1, 'country': '-'}
            else:
                ip_data[ip]['count'] += 1
                if sidx > ip_data[ip]['stage_idx']:
                    ip_data[ip]['stage_idx'] = sidx
    except Exception:
        pass

    # ── Filtrage des crawlers légitimes (anti-spoof FCrDNS) ──────────────────
    # Un crawler vérifié sort de la Kill Chain (ce n'est pas une menace) ; un
    # usurpateur — UA de bot mais FCrDNS KO — y reste, marqué spoofed_bot.
    verified_bots = []
    for ip in list(ip_data.keys()):
        v = ip_data[ip]
        cls, bot = _bot_verify.classify(ip, v.get('ua', ''))
        if cls == 'verified':
            verified_bots.append({'ip': ip, 'bot': bot, 'country': v['country']})
            del ip_data[ip]
        elif cls == 'spoofed':
            v['spoofed_bot'] = bot

    stage_counts = {s: 0 for s in STAGE_ORDER}
    for v in ip_data.values():
        stage_counts[STAGE_ORDER[v['stage_idx']]] += 1
    top = sorted(ip_data.items(), key=lambda x: -x[1]['count'])[:10]
    active_ips = []
    for ip, v in top:
        entry = {'ip': ip, 'stage': STAGE_ORDER[v['stage_idx']],
                 'count': v['count'], 'country': v['country']}
        if v.get('spoofed_bot'):
            entry['spoofed_bot'] = v['spoofed_bot']
        active_ips.append(entry)
    return {
        'stage_counts':        stage_counts,
        'active_ips':          active_ips,
        'total_active':        len(ip_data),
        'window_minutes':      15,
        'verified_bots':       verified_bots,
        'verified_bots_count': len(verified_bots),
    }

def get_nginx_stats():
    """Parse access.log — req/1h, req/24h, top 10 URLs externes (hors LAN et assets statiques)."""
    _LAN   = re.compile(r'^(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|127\.)')
    _ASSET = re.compile(r'\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|map)(\?|$)', re.I)
    _RE    = re.compile(r'^(\S+) \[([^\]]+)\] "(?:[A-Z]+) ([^ "]+)[^"]*" \d+ ')
    now        = datetime.now(tz=timezone.utc)
    cutoff_1h  = now - timedelta(hours=1)
    cutoff_24h = now - timedelta(hours=24)
    req_1h = req_24h = 0
    path_counts: dict = defaultdict(int)
    try:
        with open(LOG_FILE, 'r', errors='replace') as fh:
            for line in fh:
                m = _RE.match(line)
                if not m:
                    continue
                ip, ts_str, path = m.group(1), m.group(2), m.group(3)
                if _LAN.match(ip):
                    continue
                try:
                    ts = datetime.strptime(ts_str[:20], '%d/%b/%Y:%H:%M:%S').replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
                if ts < cutoff_24h:
                    continue
                req_24h += 1
                if ts >= cutoff_1h:
                    req_1h += 1
                p = path.split('?')[0]
                if not _ASSET.search(p):
                    path_counts[p] += 1
    except FileNotFoundError:
        pass
    top_paths = sorted(
        [{'path': p, 'count': c} for p, c in path_counts.items()],
        key=lambda x: -x['count']
    )[:10]
    return {'req_1h': req_1h, 'req_24h': req_24h, 'top_paths': top_paths}

def get_honeypot_hits():
    """Parse 24h de logs nginx — requêtes vers chemins pièges (scanners / attaquants ciblés).
    Retourne aussi ip_stages {ip: {stage, country}} pour enrichissement Kill Chain.
    """
    STAGE_ORDER = ['RECON', 'SCAN', 'EXPLOIT', 'BRUTE']
    STAGE_IDX   = {s: i for i, s in enumerate(STAGE_ORDER)}
    cutoff      = datetime.now(timezone.utc) - timedelta(hours=24)
    kc_cutoff   = datetime.now(timezone.utc) - timedelta(minutes=15)
    path_counts = defaultdict(lambda: {'count': 0, 'ips': set()})
    total_ips   = set()
    ip_stages   = {}  # ip -> {stage_idx, country} — 15min window (Kill Chain = activité en cours)

    def _extract_path(req):
        parts = req.split(' ')
        if len(parts) < 2:
            return ''
        return parts[1].split('?')[0].split('#')[0].rstrip('/') or '/'

    try:
        with open(LOG_FILE, 'r', errors='replace') as f:
            for line in f:
                m = LOG_RE.match(line)
                if not m:
                    continue
                try:
                    ts = datetime.strptime(m.group('time'), '%d/%b/%Y:%H:%M:%S %z')
                except ValueError:
                    continue
                if ts < cutoff:
                    continue
                path    = _extract_path(m.group('request'))
                ip      = m.group('ip')
                country = m.group('country')
                if _rfc1918.match(ip):
                    continue
                for trap in HONEYPOT_PATHS:
                    if path == trap or path.startswith(trap):
                        path_counts[trap]['count'] += 1
                        path_counts[trap]['ips'].add(ip)
                        total_ips.add(ip)
                        # Stage pour Kill Chain (15min window — activité en cours seulement)
                        if ts >= kc_cutoff:
                            stage = HONEYPOT_STAGE.get(trap, 'RECON')
                            sidx  = STAGE_IDX[stage]
                            if ip not in ip_stages:
                                ip_stages[ip] = {'stage_idx': sidx, 'country': country}
                            elif sidx > ip_stages[ip]['stage_idx']:
                                ip_stages[ip]['stage_idx'] = sidx
                        break
    except FileNotFoundError:
        pass

    top_paths = sorted(
        [{'path': p, 'count': v['count'], 'unique_ips': len(v['ips'])}
         for p, v in path_counts.items()],
        key=lambda x: -x['count']
    )[:15]

    # ip_stages sérialisable : remplace stage_idx par stage label
    ip_stages_out = {
        ip: {'stage': STAGE_ORDER[v['stage_idx']], 'country': v['country']}
        for ip, v in ip_stages.items()
    }

    return {
        'total_hits':   sum(v['count'] for v in path_counts.values()),
        'total_ips':    len(total_ips),
        'top_paths':    top_paths,
        'window_hours': 24,
        'ip_stages':    ip_stages_out,
    }


# ══════════════════════════════════════════════════════════
# SYSTÈME D'ALERTES SOC → module alerting.py (split incrémental)
# ══════════════════════════════════════════════════════════

def _get_autoban_log():
    """Lit autoban-log.json, retourne les 20 dernières entrées (plus récent en premier)."""
    try:
        with open(AUTOBAN_LOG) as f:
            log = json.load(f)
        return list(reversed(log[-20:]))
    except Exception:
        return []

def get_slow_campaigns(days=14, min_ips=3):
    """Détecte campagnes lentes : ≥min_ips IPs distinctes d'un même /24 sur les N derniers jours."""
    try:
        with open(AUTOBAN_LOG) as f:
            log = json.load(f)
    except Exception:
        return []
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).timestamp()
    subnets = {}
    for e in log:
        try:
            ts = datetime.strptime(e.get('ts', ''), '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc).timestamp()
        except Exception:
            continue
        if ts < cutoff:
            continue
        ip = e.get('ip', '')
        parts = ip.split('.')
        if len(parts) != 4:
            continue
        subnet = '.'.join(parts[:3])
        rec = subnets.setdefault(subnet, {'ips': set(), 'last_seen': e.get('ts', ''), 'countries': set()})
        rec['ips'].add(ip)
        rec['countries'].add(e.get('country', '-'))
        if e.get('ts', '') > rec['last_seen']:
            rec['last_seen'] = e['ts']
    result = []
    for subnet, rec in subnets.items():
        if len(rec['ips']) >= min_ips:
            result.append({
                'subnet':    subnet + '.0/24',
                'count':     len(rec['ips']),
                'last_seen': rec['last_seen'],
                'countries': sorted(rec['countries']),
            })
    return sorted(result, key=lambda x: x['count'], reverse=True)


# CrowdSec → module crowdsec_stats.py (split incrémental).
get_crowdsec_stats = _crowdsec_stats.get_crowdsec_stats


WINDOWS_DISK_PATH = '/var/www/monitoring/windows-disk.json'

# Crons à surveiller : label, fichier log, âge max acceptable en minutes, schedule affiché, catégorie
_CRON_JOBS_CFG = [
    # ── Monitoring & collecte ──
    {'label': 'monitoring.sh',       'log': '/var/log/monitoring.log',                    'max_age_min': 10,          'schedule': '*/1 min', 'cat': 'Monitoring'},
    {'label': 'proto-live',          'log': '/var/www/monitoring/proto-live.json',         'max_age_min': 5,           'schedule': '*/1 min', 'cat': 'Monitoring'},
    {'label': 'ufw-snapshot',        'log': '/var/log/ufw-snapshots/cron.log',             'max_age_min': 75,          'schedule': 'H:05',    'cat': 'Monitoring'},
    # ── Rapports & feeds ──
    {'label': 'soc-daily-report',    'log': '/var/log/clt-soc-report.log',                'max_age_min': 26 * 60,     'schedule': '08h00',   'cat': 'Rapports'},
    {'label': 'clt-cve-fetch',       'log': '/var/log/clt-cve-fetch.log',                 'max_age_min': 500,         'schedule': '06·13·21h','cat': 'Rapports'},
    {'label': 'clt-threat-fetch',    'log': '/var/log/clt-threat-fetch.log',              'max_age_min': 26 * 60,     'schedule': '03h00',   'cat': 'Rapports'},
    # ── Sécurité & intégrité ──
    {'label': 'crowdsec-hub-update', 'log': '/var/log/crowdsec-hub-update.log',           'max_age_min': 26 * 60,     'schedule': '03h45',   'cat': 'Sécurité'},
    {'label': 'suricata-update',     'log': '/var/log/suricata-update.log',               'max_age_min': 26 * 60,     'schedule': '03h30',   'cat': 'Sécurité'},
    {'label': 'geoipupdate',         'log': '/usr/share/GeoIP/GeoLite2-City.mmdb',        'max_age_min': 8 * 24 * 60, 'schedule': '03h00',   'cat': 'Sécurité'},
    {'label': 'aide-soc',            'log': '/var/log/aide/aide.log',                     'max_age_min': 26 * 60,     'schedule': '03h00',   'cat': 'Sécurité'},
    {'label': 'sqlite-maintenance',  'log': '/var/log/sqlite-maintenance.log',            'max_age_min': 7 * 24 * 60, 'schedule': 'dim 02h', 'cat': 'Sécurité'},
]


def get_windows_disk():
    """Lit windows-disk.json (encodage utf-8-sig depuis PowerShell) et l'inclut dans le JSON."""
    try:
        with open(WINDOWS_DISK_PATH, encoding='utf-8-sig') as f:
            data = json.load(f)
        data['available'] = True
        return data
    except Exception:
        return {'available': False}


def get_cron_jobs():
    """Retourne le statut des crons srv-nginx basé sur la date de modification des fichiers log."""
    from datetime import datetime as _dt
    now = time.time()
    jobs = []
    for cfg in _CRON_JOBS_CFG:
        try:
            mtime = os.path.getmtime(cfg['log'])
            age_min = (now - mtime) / 60
            jobs.append({
                'label':    cfg['label'],
                'ok':       age_min <= cfg['max_age_min'],
                'last_run': _dt.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M'),
                'age_min':  round(age_min),
                'schedule': cfg.get('schedule', ''),
                'cat':      cfg.get('cat', ''),
            })
        except Exception:
            jobs.append({'label': cfg['label'], 'ok': False, 'last_run': None, 'age_min': None,
                         'schedule': cfg.get('schedule', ''), 'cat': cfg.get('cat', '')})
    return {'jobs': jobs}


PVE_F2B_PATH = '/var/www/monitoring/proxmox-fail2ban.json'


def get_proxmox_fail2ban():
    """Lit le fichier JSON fail2ban poussé par Proxmox toutes les 5 min."""
    try:
        with open(PVE_F2B_PATH) as f:
            data = json.load(f)
        if not data.get('available'):
            return {'available': False}
        # Fraîcheur : si > 15 min, marquer comme stale
        try:
            from datetime import datetime as _dt2, timezone as _tz2
            gen = _dt2.strptime(data['generated_at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=_tz2.utc)
            age_s = (datetime.now(timezone.utc) - gen).total_seconds()
            data['stale'] = age_s > 900
        except Exception:
            data['stale'] = False
        return data
    except Exception:
        return {'available': False}



def get_local_fail2ban(hostname, label):
    """Collecte fail2ban depuis /var/log/central/<hostname>/ (fallback SSH)."""
    actions_log = f'/var/log/central/{hostname}/fail2ban.actions.log'
    jail_log    = f'/var/log/central/{hostname}/fail2ban.jail.log'
    if not os.path.exists(actions_log):
        return {'available': False, 'label': label, 'source': 'local'}
    _ban_re   = re.compile(r'fail2ban\.actions.*\] (Ban|Unban) ([\d.]+)')
    _jail_re  = re.compile(r"fail2ban\.actions.*\] (?:Ban|Unban).*jail '?([^'\"]+)'?")
    _jailnm   = re.compile(r'\[([^\]]+)\].*(?:Ban|Unban)')
    ban_net   = {}   # ip → net count (ban+1, unban-1)
    jail_cnt  = {}   # jail → ban count
    try:
        with open(actions_log, 'r', errors='replace') as f:
            for line in f:
                m = _ban_re.search(line)
                if not m:
                    continue
                action, ip = m.group(1), m.group(2)
                delta = 1 if action == 'Ban' else -1
                ban_net[ip] = ban_net.get(ip, 0) + delta
                mj = _jailnm.search(line)
                if mj and action == 'Ban':
                    j = mj.group(1)
                    jail_cnt[j] = jail_cnt.get(j, 0) + 1
    except Exception:
        pass
    jails_list = []
    if os.path.exists(jail_log):
        try:
            seen = set()
            with open(jail_log, 'r', errors='replace') as f:
                for line in f:
                    m = re.search(r"Creating new jail '([^']+)'", line)
                    if m and m.group(1) not in seen:
                        seen.add(m.group(1))
                        jname = m.group(1)
                        jails_list.append({'jail': jname,
                                           'cur_banned': max(0, ban_net.get(jname, 0)),
                                           'tot_banned': jail_cnt.get(jname, 0),
                                           'tot_failed': 0})
        except Exception:
            pass
    cur_banned = sum(max(0, v) for v in ban_net.values())
    return {
        'available':    True,
        'label':        label,
        'source':       'local',
        'jails':        jails_list,
        'total_banned': cur_banned,
        'total_failed': 0,
        'banned_ips':   [ip for ip, v in ban_net.items() if v > 0],
    }


def get_remote_fail2ban(host, port, ssh_key, label):
    """Collecte fail2ban via SSH sur un hôte distant (clt, pa85)."""
    try:
        base_cmd = ['ssh', '-i', ssh_key, '-p', str(port),
                    '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                    '-o', 'ConnectTimeout=5', f'root@{host}']
        status_raw = subprocess.check_output(
            base_cmd + ['fail2ban-client status'], stderr=subprocess.DEVNULL, timeout=8
        ).decode()
        jail_line = re.search(r'Jail list:\s*(.*)', status_raw)
        jails = [j.strip() for j in jail_line.group(1).split(',')] if jail_line else []
        results = []
        total_banned = 0
        total_failed = 0
        for jail in jails:
            try:
                out = subprocess.check_output(
                    base_cmd + [f'fail2ban-client status {jail}'],
                    stderr=subprocess.DEVNULL, timeout=8
                ).decode()
                cur_banned = int(re.search(r'Currently banned:\s+(\d+)', out).group(1))
                tot_banned = int(re.search(r'Total banned:\s+(\d+)', out).group(1))
                tot_failed = int(re.search(r'Total failed:\s+(\d+)', out).group(1))
                total_banned += cur_banned
                total_failed += tot_failed
                results.append({'jail': jail, 'cur_banned': cur_banned,
                                 'tot_banned': tot_banned, 'tot_failed': tot_failed})
            except Exception:
                results.append({'jail': jail, 'cur_banned': 0, 'tot_banned': 0, 'tot_failed': 0})
        return {'available': True, 'label': label, 'jails': results,
                'total_banned': total_banned, 'total_failed': total_failed}
    except Exception:
        hostname = host.split('.')[-1] if '.' in host else host
        _host_map = {IP_CLT: 'clt', IP_PA85: 'pa85', IP_SRV_DEV1: 'srv_dev1'}
        local_host = _host_map.get(host, hostname)
        return get_local_fail2ban(local_host, label)


def _updates_parse_apt(output):
    pkgs = []
    for line in output.splitlines():
        line = line.strip()
        if not line or 'Listing' in line or 'En train' in line or 'WARNING' in line:
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        raw   = parts[0]
        pkg   = raw.split('/')[0]
        repo  = raw.split('/')[1] if '/' in raw else ''
        ver   = parts[1]
        sec   = 'security' in repo.lower()
        pkgs.append({'name': pkg, 'version': ver, 'repo': repo, 'security': sec})
    return pkgs

def _updates_run_apt(m):
    # Rafraîchit le cache apt si >12h — évite les faux 0 sur nouvelles CVE
    APT_UPDATE_CMD = (
        'age=$(( $(date +%s) - $(stat -c %Y /var/lib/apt/lists 2>/dev/null || echo 0) ));'
        ' [ $age -gt 43200 ] && apt-get update -qq 2>/dev/null;'
        ' LANG=C apt list --upgradable 2>/dev/null'
    )
    try:
        if m['local']:
            r = subprocess.run(
                ['bash', '-c', APT_UPDATE_CMD],
                capture_output=True, text=True, timeout=30
            )
            return r.stdout
        else:
            cmd = ['ssh', '-i', m['ssh_key'], '-p', str(SSH_PORT),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=8', '-o', 'BatchMode=yes',
                   f'root@{m["ip"]}',
                   APT_UPDATE_CMD]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
            return r.stdout
    except Exception:
        return None

def get_updates():
    """Vérifie les mises à jour disponibles sur toutes les machines SSH_MACHINES."""
    machines_cfg = [
        {'name': m['name'], 'ip': m['ip'], 'role': m['role'],
         'local': m.get('local', False), 'ssh_key': m.get('ssh_key')}
        for m in SSH_MACHINES
    ]

    results = []
    total_count = 0
    total_security = 0

    for m in machines_cfg:
        entry = {
            'name':           m['name'],
            'ip':             m['ip'],
            'role':           m['role'],
            'packages':       [],
            'count':          0,
            'security_count': 0,
            'reachable':      False,
        }
        out = _updates_run_apt(m)
        if out is not None:
            pkgs = _updates_parse_apt(out)
            entry['packages']       = pkgs
            entry['count']          = len(pkgs)
            entry['security_count'] = sum(1 for p in pkgs if p['security'])
            entry['reachable']      = True
        total_count    += entry['count']
        total_security += entry['security_count']
        results.append(entry)

    return {
        'machines':        results,
        'total_count':     total_count,
        'total_security':  total_security,
        'generated_at':    datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }

# ── Suricata IDS → module suricata_collect.py (Sprint 2A 2026-05-16) ─
get_suricata_stats = _suricata_collect.get_suricata_stats

def _main_build_fail2ban():
    """Collect traffic + fail2ban from all sources (local + SSH remotes)."""
    traffic = parse_logs_24h()
    _seen   = traffic.pop('_seen_ips', {})
    f2b     = get_fail2ban_stats()
    for jail in f2b.get('jails', []):
        jail['banned_ips'] = [
            {'ip': ip, 'country': _seen.get(ip, {}).get('country', '-')}
            for ip in jail['banned_ips']
        ]
    f2b['proxmox']   = get_proxmox_fail2ban()
    f2b['clt']       = get_remote_fail2ban(IP_CLT,      SSH_PORT, SSH_KEY_CLT,  'CLT')
    f2b['pa85']      = get_remote_fail2ban(IP_PA85,     SSH_PORT, SSH_KEY_PA85, 'PA85')
    f2b['srv_dev1']  = get_remote_fail2ban(IP_SRV_DEV1, SSH_PORT, SSH_KEY_DEV1, 'SRV-DEV-1')
    return traffic, f2b




# ── XDR events → module xdr_events.py (Sprint 2A 2026-05-16) ─────────
get_xdr_events = _xdr_events.get_xdr_events

def get_aide_status():
    """Vérifie l'état AIDE : base initialisée, dernière vérification, diff fichiers."""
    log_path = '/var/log/aide/aide.log'
    db_path  = '/var/lib/aide/aide.db'
    now = datetime.now(timezone.utc)
    result = {
        'available':      os.path.exists(db_path),
        'db_init_ts':     None,
        'last_check_ts':  None,
        'status':         'PENDING',
        'added':          0,
        'removed':        0,
        'changed':        0,
        'entries_total':  0,
        'changed_files':  [],
        'error':          None,
    }
    if not result['available']:
        result['error'] = 'base non initialisée'
        return result
    try:
        mtime = os.path.getmtime(db_path)
        result['db_init_ts'] = datetime.fromtimestamp(mtime, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception:
        pass
    if not os.path.exists(log_path):
        result['status'] = 'PENDING'
        result['error']  = 'aucune vérification encore effectuée (cron 03h00)'
        return result
    try:
        with open(log_path, 'r', errors='replace') as f:
            content = f.read()
        blocks = content.split('Start timestamp:')
        if len(blocks) < 2:
            result['status'] = 'PENDING'
            return result
        last_block = 'Start timestamp:' + blocks[-1]
        m_ts = re.search(r'Start timestamp:\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) ([+-]\d{4})', last_block)
        if m_ts:
            try:
                ts = datetime.strptime(m_ts.group(1) + ' ' + m_ts.group(2), '%Y-%m-%d %H:%M:%S %z').astimezone(timezone.utc)
                result['last_check_ts'] = ts.strftime('%Y-%m-%dT%H:%M:%SZ')
                result['age_hours']     = round((now - ts).total_seconds() / 3600, 1)
            except Exception:
                pass
        no_diff = ('AIDE found NO differences' in last_block
                   or ('[AIDE]' in last_block and 'OK' in last_block))
        if no_diff:
            result['status'] = 'OK'
        elif 'AIDE found differences' in last_block or 'Added entries' in last_block:
            result['status'] = 'ALERT'
            m_add = re.search(r'Added entries:\s+(\d+)', last_block)
            m_rem = re.search(r'Removed entries:\s+(\d+)', last_block)
            m_chg = re.search(r'Changed entries:\s+(\d+)', last_block)
            result['added']   = int(m_add.group(1)) if m_add else 0
            result['removed'] = int(m_rem.group(1)) if m_rem else 0
            result['changed'] = int(m_chg.group(1)) if m_chg else 0
            files = re.findall(r'^(?:added|changed|removed):\s+(.+)$', last_block, re.MULTILINE)
            result['changed_files'] = files[:20]
        else:
            result['status'] = 'PENDING'
        m_total = re.search(r'Total number of entries:\s+(\d+)', last_block)
        if m_total:
            result['entries_total'] = int(m_total.group(1))
    except Exception as e:
        result['error'] = str(e)[:120]
    return result


# Variante RFC1918 + broadcast/null-route (0./255.) — utilisée par _gcc_apache
# pour filtrer les IPs LAN/broadcast dans les apache_hits cross-hôtes.
# (Avant 2026-05-17 servait aussi au parser routeur, supprimé suite à
# la .)
_GCC_RFC1918 = re.compile(
    r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|255\.)')


# _gcc_router : supprime 2026-05-17
# Logs kernel.log routeur ne sont plus collectes par rsyslog central (cf.
# rsyslog-10-central-receiver.conf : bloc routeur retire). Les compteurs
# SRC/DST routeur disparaissent de get_cross_host_correlation().

def _gcc_f2b(central_dir):
    """Fail2ban bans depuis clt, pa85 et srv-dev-1 — dict ip → [hosts]."""
    f2b_bans = {}
    _f2b_ban_re = re.compile(
        r'fail2ban\.actions.*\bBan\b.*?([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})')
    for host, logf in [
        ('clt',      '/var/log/central/clt/fail2ban.actions.log'),
        ('pa85',     '/var/log/central/pa85/fail2ban.actions.log'),
        ('srv-dev-1','/var/log/central/srv-dev-1/fail2ban.actions.log'),
    ]:
        if not os.path.exists(logf):
            continue
        try:
            with open(logf, 'r', errors='replace') as f:
                for line in f:
                    m = _f2b_ban_re.search(line)
                    if m:
                        ip = m.group(1)
                        if ip not in f2b_bans:
                            f2b_bans[ip] = []
                        if host not in f2b_bans[ip]:
                            f2b_bans[ip].append(host)
        except Exception:
            pass
    return f2b_bans


def _gcc_apache(central_dir):
    """Apache access logs clt+pa85 — dict ip → {total, errors, hosts}."""
    apache_hits = {}
    _apache_re = re.compile(
        r'apache_access: ([\d.]+) [^ ]+ [^ ]+ \[[^\]]+\] "[^"]*" (\d{3}) ')
    for host, logf in [
        ('clt',  '/var/log/central/clt/apache_access.log'),
        ('pa85', '/var/log/central/pa85/apache_access.log'),
    ]:
        if not os.path.exists(logf):
            continue
        try:
            with open(logf, 'r', errors='replace') as f:
                for line in f:
                    m = _apache_re.search(line)
                    if not m:
                        continue
                    ip = m.group(1)
                    if _GCC_RFC1918.match(ip):
                        continue
                    status = int(m.group(2))
                    if ip not in apache_hits:
                        apache_hits[ip] = {'total': 0, 'errors': 0, 'hosts': []}
                    apache_hits[ip]['total'] += 1
                    if status >= 400:
                        apache_hits[ip]['errors'] += 1
                    if host not in apache_hits[ip]['hosts']:
                        apache_hits[ip]['hosts'].append(host)
        except Exception:
            pass
    return apache_hits


def get_cross_host_correlation():
    """Corrélation IPs cross-hôtes : fail2ban vs Apache.

    NOTE 2026-05-17 : `router_src/router_dst` retires (migration vers
    Freebox direct). Plus de logs kernel.log routeur dispo.
    """
    central_dir = '/var/log/central'
    f2b_bans    = _gcc_f2b(central_dir)
    apache_hits = _gcc_apache(central_dir)
    multi_apache = {
        ip: info for ip, info in apache_hits.items()
        if len(info['hosts']) >= 2 and ip not in f2b_bans
    }
    return {
        'f2b_bans':      f2b_bans,
        'f2b_total':     len(f2b_bans),
        'apache_hits':   apache_hits,
        'apache_total':  len(apache_hits),
        'multi_apache':  multi_apache,
        'multi_count':   len(multi_apache),
    }
def _build_structured_events():
    """Timeline structurée 24h — délègue à security_events (module extrait)."""
    return _security_events.build_structured_events(_rfc1918, _scan_re)
def _main_build_data(traffic, f2b, prx_stats, pve_cpu_hist, pve_net_hist,
                     sys_metrics=None, sys_cpu_hist=None, sys_svcs=None):
    """Assemble the full monitoring data dict from all collectors."""
    return {
        'generated_at':    datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'traffic':         traffic,
        'services':        check_services(),
        'ssl':             [get_ssl_expiry(d) for d in SSL_DOMAINS],
        'system':          sys_metrics if sys_metrics is not None else get_system_metrics(),
        'nginx_info':      get_nginx_info(),
        'sys_cpu_history': sys_cpu_hist or [],
        'sys_services':    sys_svcs or {},
        'cve_sync':        get_cve_sync(),
        'threat_sync':     get_threat_sync(),
        'proxmox':         prx_stats,
        'pve_cpu_history': pve_cpu_hist,
        'pve_net_history': pve_net_hist,
        'net_history':     update_net_history(),
        'ssh':             get_ssh_stats(),
        'ufw':             get_ufw_stats(),
        'fail2ban':        f2b,
        'firewall_matrix': get_firewall_matrix(),
        'wan_ip':          get_wan_ip(),
        'kill_chain':      get_active_attacks(),
        'honeypot':        get_honeypot_hits(),
        'nginx_stats':     get_nginx_stats(),
        'crowdsec':        get_crowdsec_stats(),
        'windows_disk':    get_windows_disk(),
        'crons':           get_cron_jobs(),
        'autoban_log':     _get_autoban_log(),
        'slow_campaigns':  get_slow_campaigns(),
        'wan_monitor':     get_wan_monitoring(),
        'freebox':         get_freebox_stats(),
        'updates':         get_updates(),
        'suricata':        get_suricata_stats(),
        'tls':             get_tls_expiry(),
        'apparmor_nginx':  get_apparmor_nginx(),
        'clt_apparmor':    get_apparmor_clt(),
        'clt_modsec':      get_modsec_clt(),
        'pa85_apparmor':   get_apparmor_pa85(),
        'pa85_modsec':     get_modsec_pa85(),
        'autoupdate':      get_autoupdate(),
        'xdr_events':      get_xdr_events(),
        'aide':            get_aide_status(),
        'jarvis':          get_jarvis_status(),
        'rsyslog':         get_rsyslog_status(),
        'xhosts':          get_cross_host_correlation(),
        'events':          _build_structured_events(),
    }


def _main_enrich_crowdsec(data):
    """Enrich recent_geoips and kill_chain with CrowdSec decisions."""
    cs = data['crowdsec']
    if cs.get('available') and cs.get('decisions_detail'):
        cs_detail = cs['decisions_detail']
        for geoip in data['traffic'].get('recent_geoips', []):
            det = cs_detail.get(geoip['ip'])
            if det:
                geoip['cs_banned']   = True
                geoip['cs_scenario'] = det['scenario']
                geoip['cs_stage']    = det['stage']
    kc = data['kill_chain']
    if cs.get('available'):
        kc['cs_decisions']    = cs.get('active_decisions', 0)
        kc['cs_stage_counts'] = cs.get('stage_counts', {})
        cs_banned = set(cs.get('decisions_detail', {}).keys())
        for ip_entry in kc.get('active_ips', []):
            if ip_entry['ip'] in cs_banned:
                ip_entry['cs_decision'] = True


_KC_STAGE_ORDER = ["RECON", "SCAN", "EXPLOIT", "BRUTE"]
_KC_STAGE_IDX   = {s: i for i, s in enumerate(_KC_STAGE_ORDER)}

def _main_enrich_honeypot(data):
    """Merge honeypot IPs into kill_chain (no duplicate, most-advanced stage wins)."""
    cs        = data['crowdsec']
    kc        = data['kill_chain']
    hp_stages = data['honeypot'].get('ip_stages', {})
    if not hp_stages:
        return
    existing = {e['ip']: e for e in kc.get('active_ips', [])}
    for ip, meta in hp_stages.items():
        hp_sidx = _KC_STAGE_IDX.get(meta['stage'], 0)
        if ip in existing:
            cur_sidx = _KC_STAGE_IDX.get(existing[ip]['stage'], 0)
            if hp_sidx > cur_sidx:
                existing[ip]['stage'] = _KC_STAGE_ORDER[hp_sidx]
            existing[ip].setdefault('sources', ['nginx'])
            if 'NH' not in existing[ip]['sources']:
                existing[ip]['sources'].append('NH')
        else:
            existing[ip] = {
                'ip':      ip,
                'stage':   meta['stage'],
                'count':   1,
                'country': meta['country'],
                'sources': ['NH'],
            }
    kc['active_ips'] = sorted(
        existing.values(),
        key=lambda x: (-_KC_STAGE_IDX.get(x['stage'], 0), -x.get('count', 0))
    )[:15]
    for s in _KC_STAGE_ORDER:
        kc['stage_counts'][s] = sum(1 for e in kc['active_ips'] if e['stage'] == s)
    kc['total_active'] = len(kc['active_ips'])
    # Second pass cs_decision — covers IPs added by honeypot after first pass
    if cs.get('available'):
        cs_banned = set(cs.get('decisions_detail', {}).keys())
        for ip_entry in kc.get('active_ips', []):
            if ip_entry['ip'] in cs_banned:
                ip_entry['cs_decision'] = True


def _main_enrich_kc_geoips(data):
    """Tag recent_geoips with kc_stage from kill_chain (map colouring)."""
    kc_ip_stage = {e['ip']: e['stage'] for e in data['kill_chain'].get('active_ips', [])}
    for geoip in data['traffic'].get('recent_geoips', []):
        s = kc_ip_stage.get(geoip['ip'])
        if s:
            geoip['kc_stage'] = s


def _main_enrich_crosshost(data):
    """Tag kill_chain IPs vues dans fail2ban et logs Apache CLT/PA85.

    NOTE 2026-05-17 : enrichissements `router_seen/router_hits/router_out`
    retirés ( direct, plus de logs routeur).
    """
    xh = data.get('xhosts', {})
    f2b = xh.get('f2b_bans', {})
    apache = xh.get('apache_hits', {})
    if not f2b and not apache:
        return
    corr_count = 0
    for entry in data['kill_chain'].get('active_ips', []):
        ip = entry['ip']
        if ip in f2b:
            entry['f2b_vms'] = f2b[ip]   # ['clt','pa85'] — banni sur ces VMs aussi
            corr_count += 1
        if ip in apache:
            entry['apache_vms'] = apache[ip]['hosts']
            entry['apache_total'] = apache[ip]['total']
            entry['apache_errors'] = apache[ip]['errors']
    data['xhosts']['corr_count'] = corr_count


def _crowdsec_alerts_recent_list(minutes=None):
    """Liste des alertes CrowdSec créées dans la dernière fenêtre N minutes.
    Source TEMPS RÉEL via cscli (local sur srv-nginx). Retourne [] si KO.
    Permet d'avoir un PROBE vivant ET sa liste d'IPs même quand UFW/f2b calmes.

    minutes = None → utilise _soc_infra.KC_WINDOW_MIN (no hardcode).
    Format de chaque entrée : {ip, scenario, country, ts}
    """
    if minutes is None:
        minutes = _soc_infra.KC_WINDOW_MIN
    try:
        out = subprocess.check_output(
            ['cscli', 'alerts', 'list', '-o', 'json', '--since', f'{minutes}m'],
            stderr=subprocess.DEVNULL, timeout=5,
        )
        alerts = json.loads(out.decode('utf-8', errors='replace'))
        if not isinstance(alerts, list):
            return []
        out_list = []
        for a in alerts:
            # Format cscli alerts : a['source']['ip'] + a['scenario'] + a['source']['cn']
            src = a.get('source', {}) or {}
            out_list.append({
                'ip':       src.get('ip', '?'),
                'scenario': a.get('scenario', '?'),
                'country':  src.get('cn', '-'),
                'ts':       a.get('created_at', ''),
            })
        return out_list
    except Exception:
        return []


def _crowdsec_alerts_recent_count(minutes=None):
    """Compte les alertes CrowdSec récentes. Wrapper rétrocompatible."""
    return len(_crowdsec_alerts_recent_list(minutes))


def _main_enrich_kc_layers(data):
    """Étend kill_chain.stage_counts avec 2 maillons défensifs (2026-05-16) :
    - PROBE : 'qui frappe à la porte' TEMPS RÉEL 15min = combinaison de 3 sources
              au mur réseau :
                · UFW packet drops (ports fermés)
                · fail2ban Ban events (IPs détectées au flow)
                · CrowdSec alerts récentes (vraies frappes détectées par engine
                  comportemental — source dominante en pratique, ~1/15min sur
                  homelab nominal vs 6% chance d'avoir un Ban f2b dans 15min)
    - WAF   : blocages ModSecurity inline sur backends Apache CLT+PA85

    Fenêtre 15min cohérente avec get_active_attacks() (RECON/SCAN/EXPLOIT/BRUTE).
    """
    kc = data.get('kill_chain', {})
    if 'stage_counts' not in kc:
        return
    _kc_min = _soc_infra.KC_WINDOW_MIN
    cutoff_iso = (datetime.now(timezone.utc) - timedelta(minutes=_kc_min)).strftime('%Y-%m-%dT%H:%M:%SZ')
    # Liste TEMPS RÉEL des IPs PROBE (source dominante = CrowdSec alerts récentes)
    # ⚠ Filtre RFC1918/loopback (_rfc1918) appliqué partout : les IPs internes
    # (192.168., 10., 172.16-31., 127.) NE DOIVENT JAMAIS apparaître dans la KC
    # — règle absolue cohérente avec _LAN_PREFIXES côté JARVIS + CrowdSec.
    probe_ips = []
    waf_ips = []
    for a in _crowdsec_alerts_recent_list(_kc_min):
        if not a.get('ip') or _rfc1918.match(a['ip']):
            continue
        probe_ips.append({
            'ip': a['ip'], 'src': 'crowdsec', 'detail': a['scenario'],
            'country': a['country'], 'ts': a.get('ts', ''),
        })
    # Compléter avec xdr_events 15min : UFW packet drops + fail2ban Ban + ModSec WAF
    for ev in data.get('xdr_events', []):
        ts = ev.get('ts', '')
        if ts < cutoff_iso:
            continue
        ip = ev.get('ip', '')
        if not ip or _rfc1918.match(ip):   # exclure RFC1918/loopback (jamais menace)
            continue
        src = ev.get('src', '')
        if src == 'ufw':
            probe_ips.append({'ip': ip, 'src': 'ufw',
                              'detail': ev.get('detail', 'UFW BLOCK'),
                              'country': '-', 'ts': ts})
        elif src == 'fail2ban' and ev.get('type') == 'Ban':
            probe_ips.append({'ip': ip, 'src': 'fail2ban',
                              'detail': ev.get('detail', 'f2b ban'),
                              'country': '-', 'ts': ts})
        elif src.startswith('modsec_'):  # modsec_clt, modsec_pa85
            waf_ips.append({'ip': ip, 'src': src,
                            'detail': ev.get('detail', 'WAF block'),
                            'country': '-', 'ts': ts})
    # Exposé pour le frontend (colonnes IP PROBE/WAF dans la grille KC)
    kc['probe_ips_15min'] = probe_ips[:20]
    kc['waf_ips_15min']   = waf_ips[:20]
    # Compteurs hexagones = IPs UNIQUES (cohérent avec RECON/SCAN/EXPLOIT/BRUTE
    # qui comptent aussi des IPs uniques via active_ips). Le nombre de hits par
    # IP reste visible dans la colonne via le ×N.
    kc['stage_counts']['PROBE'] = len({e['ip'] for e in probe_ips if e.get('ip')})
    kc['stage_counts']['WAF']   = len({e['ip'] for e in waf_ips if e.get('ip')})


def _main_enrich_ssh_uptime(data):
    """Fill missing SSH uptime entries from Proxmox VM uptime data."""
    vm_uptime_map = {}
    for node in data['proxmox'].get('nodes', []):
        for vm in node.get('vms', []):
            ut = vm.get('uptime', '?')
            if ut and ut != '?':
                n = vm['name']
                vm_uptime_map[n] = ut
                if n.startswith('srv-'):
                    vm_uptime_map[n[4:]] = ut   # srv-clt → clt, srv-pa85 → pa85
    for entry in data['ssh']:
        if entry.get('uptime', '?') == '?':
            ut = vm_uptime_map.get(entry['name'])
            if ut:
                entry['uptime'] = ut


# ── Threat Score — source de vérité unique ────────────────────────────────────
# Calculé ici (monitoring_gen.py), stocké dans monitoring.json.
# SOC dashboard + JARVIS vocal lisent directement le résultat — aucun recalcul.

# Score de menace — extrait dans threat_score.py (split incrémental).
# compute_threat_score reste exposé ici (alias) : call site interne + rétro-compat.
compute_threat_score = _threat_score.compute_threat_score
# IoC POST-COMPROMISSION (Sprint 18a) — agrégateur pur de `data`, injecte clé 'ioc'
compute_ioc_status = _ioc_collect.compute_ioc_status


def _ts_to_epoch(ts: str) -> float:
    """Convertit 'YYYY-MM-DDTHH:MM:SS' en timestamp float."""
    try:
        return datetime.strptime(ts, '%Y-%m-%dT%H:%M:%S').timestamp()
    except Exception:
        return 0.0


def _append_threat_history(score: int, level: str) -> dict:
    """Ajoute un point horaire dans threat_history.json — retourne stats 7j/30j."""
    now        = datetime.now()
    hour_key   = now.strftime('%Y-%m-%dT%H:00:00')
    cutoff_30d = now.timestamp() - 30 * 86400
    cutoff_7d  = now.timestamp() -  7 * 86400
    try:
        with open(THREAT_HISTORY_FILE, encoding='utf-8') as fh:
            history = json.load(fh)
        if not isinstance(history, list):
            history = []
    except Exception:
        history = []
    # Un seul point par heure — on met à jour le score si on est dans la même heure
    if history and history[-1].get('ts') == hour_key:
        history[-1]['score'] = score
        history[-1]['level'] = level
    else:
        history.append({'ts': hour_key, 'score': score, 'level': level})
    # Purge entrées >30j
    history = [e for e in history if _ts_to_epoch(e.get('ts', '')) > cutoff_30d]
    # Stats 7j
    h7d  = [e['score'] for e in history if _ts_to_epoch(e.get('ts', '')) > cutoff_7d]
    avg7 = round(sum(h7d) / len(h7d)) if h7d else score
    trend7 = (score - h7d[0]) if len(h7d) >= 2 else 0   # positif = montée, négatif = baisse
    # Stats 30j
    h30d  = [e['score'] for e in history]
    avg30 = round(sum(h30d) / len(h30d)) if h30d else score
    # Série 72h pour sparkline tuile
    h72   = [e['score'] for e in history[-72:]]
    # Écriture atomique
    tmp = THREAT_HISTORY_FILE + f'.tmp.{os.getpid()}'
    try:
        with open(tmp, 'w', encoding='utf-8') as fh:
            json.dump(history, fh, ensure_ascii=False)
        os.replace(tmp, THREAT_HISTORY_FILE)
    except Exception:
        try: os.remove(tmp)
        except Exception: pass
    return {'avg7d': avg7, 'trend7d': trend7, 'avg30d': avg30, 'count': len(history), 'h72': h72}


def _main_write(data):
    """Run autoban, write monitoring.json atomically, print summary."""
    check_and_send_alerts(data)
    data['autoban_log'] = _get_autoban_log()
    # Score de menace calculé après autoban (autoban_log final) — source de vérité unique
    data.update(compute_threat_score(data))
    # IoC POST-COMPROMISSION (Sprint 18a) — calculé après tous les collecteurs
    data.update(compute_ioc_status(data))
    # Historique ThreatScore 30j — un point par heure, stats 7j/30j injectées dans monitoring.json
    _th = _append_threat_history(data['threat_score'], data['threat_level'])
    data['threat_avg7d']         = _th['avg7d']
    data['threat_trend7d']       = _th['trend7d']
    data['threat_avg30d']        = _th['avg30d']
    data['threat_history_count'] = _th['count']
    data['threat_history_72h']   = _th.get('h72', [])
    # Validation jsonschema (Sprint 4 2026-05-16) : log les violations sans bloquer
    # le write — la prod doit toujours produire monitoring.json même si une clé dérive.
    _ok, _errs = _monitoring_validator.validate(data)
    if not _ok:
        print(f'[SCHEMA] {len(_errs)} violation(s) détectée(s) dans monitoring.json :')
        for _e in _errs[:10]:
            print(f'[SCHEMA]   - {_e}')
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    tmp = OUTPUT_PATH + f'.tmp.{os.getpid()}'
    try:
        with open(tmp, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, OUTPUT_PATH)
    except Exception:
        try: os.remove(tmp)
        except Exception: pass
        raise
    prx      = data['proxmox']
    prx_info = (f'proxmox: {prx.get("vms_running","?")} VMs running'
                if prx.get('configured') else 'proxmox: non configuré')
    print(f'[OK] monitoring.json v3.7.0 — {data["traffic"]["total_requests"]} req/24h — '
          f'{data["traffic"]["geo_blocks"]} GeoIP blocks — '
          f'{data["traffic"]["error_rate"]}% errors — {prx_info}')


# ── Fraicheur signatures sécurité ────────────────────────────────────────────

def get_autoupdate():
    """Verifie la fraicheur des bases de signatures : CrowdSec hub, Suricata rules, GeoIP."""
    # Seuils par source — le cron quotidien 03h45 touch .index.json après chaque check réussi
    # → .index.json reflète le dernier CHECK (pas la dernière publication CrowdSec)
    STALE_SURICATA = 2   # règles Suricata : cron quotidien 03h30 → alerte si >2j
    STALE_CROWDSEC = 2   # CrowdSec hub : cron quotidien 03h45 + touch → alerte si >2j
    STALE_GEOIP    = 5   # GeoIP : mise à jour bi-hebdomadaire MaxMind → alerte si >5j
    now = datetime.now(timezone.utc).timestamp()

    def _age(path):
        """Retourne l'age en jours d'un fichier, ou None si absent."""
        try:
            return (now - os.path.getmtime(path)) / 86400
        except Exception:
            return None

    def _entry(age, stale_days):
        if age is None:
            return None
        return {'age_days': round(age, 1), 'stale': age > stale_days}

    # CrowdSec hub — index des collections/parsers
    cs_candidates = [
        '/etc/crowdsec/hub/.index.json',
        '/var/lib/crowdsec/data/hub.json',
        '/etc/crowdsec/hub/index.json',
    ]
    cs_age = next((a for a in (_age(p) for p in cs_candidates) if a is not None), None)

    # Suricata rules — fichier règles compilées (priorité) ou répertoire fallback
    # /var/lib/suricata/update/cache exclu : mis à jour seulement lors du téléchargement source,
    # pas lors du reload suricata — donne un âge incorrect (fausse alarme stale)
    sur_candidates = [
        '/var/lib/suricata/rules/suricata.rules',  # fichier règles actives — mis à jour par suricata-update
        '/var/lib/suricata/rules',                  # répertoire fallback
        '/etc/suricata/rules',
    ]
    sur_age = next((a for a in (_age(p) for p in sur_candidates) if a is not None), None)

    # GeoIP databases
    geo_country_age = _age('/usr/share/GeoIP/GeoLite2-Country.mmdb')
    geo_city_age    = _age('/usr/share/GeoIP/GeoLite2-City.mmdb')

    result = {}
    if cs_age          is not None: result['crowdsec_hub']   = _entry(cs_age,          STALE_CROWDSEC)
    if sur_age         is not None: result['suricata_rules'] = _entry(sur_age,          STALE_SURICATA)
    if geo_country_age is not None: result['geoip_country']  = _entry(geo_country_age,  STALE_GEOIP)
    if geo_city_age    is not None: result['geoip_city']     = _entry(geo_city_age,     STALE_GEOIP)
    return result


# ── Fonctions sécurité infra (TLS, AppArmor, ModSec) ─────────────────────────

# ── TLS + AppArmor + ModSec → module modsec_apparmor.py (Sprint 2A 2026-05-16) ─
get_tls_expiry     = _modsec_apparmor.get_tls_expiry
get_apparmor_nginx = _modsec_apparmor.get_apparmor_nginx
get_apparmor_clt   = _modsec_apparmor.get_apparmor_clt
get_apparmor_pa85  = _modsec_apparmor.get_apparmor_pa85
get_modsec_clt     = _modsec_apparmor.get_modsec_clt
get_modsec_pa85    = _modsec_apparmor.get_modsec_pa85


def get_jarvis_status():
    """Ping JARVIS localhost:5000/api/status — timeout 3s."""
    try:
        req = Request(JARVIS_URL + '/api/status',
                      headers={'Accept': 'application/json'})
        with urlopen(req, timeout=3) as r:
            data = json.loads(r.read().decode('utf-8', errors='replace'))
        return {
            'available':        True,
            'model':            data.get('model') or data.get('llm_model') or data.get('active_model') or '',
            'soc_engine_active':bool(data.get('soc_engine_active') or data.get('soc_engine')),
            'bans_24h':         int(data.get('bans_24h') or data.get('total_bans') or 0),
            'alerts_24h':       int(data.get('alerts_24h') or data.get('tts_alerts') or 0),
            'uptime':           data.get('uptime') or '',
        }
    except Exception:
        return {'available': False}


# ── rsyslog central → module rsyslog_collect.py (Sprint 2A 2026-05-16) ─
get_rsyslog_status = _rsyslog_collect.get_rsyslog_status


def main():
    traffic, f2b = _main_build_fail2ban()
    prx_stats    = get_proxmox_stats()
    _pve_node0   = prx_stats.get('nodes', [{}])[0] if prx_stats.get('nodes') else {}
    pve_cpu_hist = update_pve_cpu_history(_pve_node0.get('cpu_pct'), _pve_node0.get('cpu_temp'))
    pve_net_hist = update_pve_net_history(_pve_node0.get('network', []))
    sys_metrics  = get_system_metrics()
    sys_cpu_hist = update_sys_cpu_history(sys_metrics.get('cpu_pct'), sys_metrics.get('cpu_temp'))
    sys_svcs     = get_sys_services()
    data         = _main_build_data(traffic, f2b, prx_stats, pve_cpu_hist, pve_net_hist,
                                    sys_metrics, sys_cpu_hist, sys_svcs)
    if not data['wan_ip']:
        fbx = data.get('freebox') or {}
        if isinstance(fbx, dict) and fbx.get('ipv4'):
            data['wan_ip'] = {
                'ip':      fbx['ipv4'],
                'city':    "Les Sables-d'Olonne",
                'country': 'FR',
                'lat':     46.4978,
                'lon':     -1.7831,
            }
    _main_enrich_crowdsec(data)
    _main_enrich_honeypot(data)
    _main_enrich_kc_geoips(data)
    _main_enrich_ssh_uptime(data)
    _main_enrich_crosshost(data)
    _main_enrich_kc_layers(data)
    _main_write(data)

if __name__ == '__main__':
    main()


