#!/usr/bin/env python3
# /opt/clt/monitoring_gen.py — Monitoring dashboard data generator
# Version : 3.6.6
# Date    : 2026-03-10
# Modifié le : 2026-04-25
# Serveur : srv-ngix (<SRV-NGIX-IP>)
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
#             v3.0.0 — get_cron_jobs()    : statut crons srv-ngix via mtime logs → crons dans JSON
#             v3.0.1 — get_proxmox_fail2ban() : lecture proxmox-fail2ban.json (push Proxmox) → fail2ban.proxmox dans JSON
#             v3.3.0 — get_wan_monitoring() : ping box (<BOX-IP>) + WAN (8.8.8.8/1.1.1.1) + HTTP check
#                      historique 24h dans wan-history.json — status UP/DEGRADED/DOWN_ISP/DOWN_LOCAL
#             v3.3.1 — get_freebox_stats() : API Freebox Delta locale — WAN state, débits, signal fibre SFP dBm, températures
#             v3.5.1 — recent_geoips enrichi : lat/lon/city via GeoLite2-City local (zéro API) · trié par count desc
#             v3.5.2 — auto-ban récidive : ≥3 bans antérieurs → durée 8760h (1 an) au lieu de 24h · _count_autoban_recidives()
#             v3.6.0 — ModSec enrichi : _parse_modsec_audit + _get_modsec_data — blocs 24h, mode BLOCAGE/DÉTECTION, classification attaque/FP

import re, json, os, subprocess, time, ssl
import configparser, smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError

# GeoLite2-City — enrichissement lat/lon/city pour recent_geoips (zéro API, lookup local)
_CITY_MMDB = '/usr/share/GeoIP/GeoLite2-City.mmdb'
try:
    import geoip2.database as _geoip2_mod
    _city_reader = _geoip2_mod.Reader(_CITY_MMDB) if os.path.exists(_CITY_MMDB) else None
except ImportError:
    _city_reader = None

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
IP_SRV_NGIX   = '<SRV-NGIX-IP>'   # VM 108 — nginx · CrowdSec · dashboard SOC
IP_CLT        = '<CLT-IP>'   # VM 106 — Apache · site CLT
IP_PA85       = '<PA85-IP>'   # VM 107 — Apache · site PA85
IP_PROXMOX    = '<PROXMOX-IP>'   # Machine physique — hyperviseur Proxmox VE
SSH_PORT      = '<SSH-PORT>'   # ← ADAPTER: votre port SSH non-standard
SSH_KEY_NGIX  = '<SSH-KEY-NGIX>'   # ex: /root/.ssh/id_nginx_sync
SSH_KEY_CLT   = '<SSH-KEY-CLT>'    # ex: /root/.ssh/id_clt_sync
SSH_KEY_PA85  = '<SSH-KEY-PA85>'   # ex: /root/.ssh/id_pa85_sync
SSH_KEY_PVE   = '<SSH-KEY-PVE>'    # ex: /root/.ssh/id_proxmox_sync
DASHBOARD_URL = 'http://' + IP_SRV_NGIX + ':8080/'

LOG_FILE      = '/var/log/nginx/access.log'
OUTPUT_PATH   = '/var/www/monitoring/monitoring.json'
SERVICES      = {
    'clt (<DOMAIN-COM>)': 'http://' + IP_CLT,
    'pa85 (<DOMAIN-FR>)': 'http://' + IP_PA85,
}
SSL_DOMAINS   = ['<DOMAIN-COM>', '<DOMAIN-FR>']
SSH_MACHINES  = [
    {'name': 'srv-ngix', 'ip': IP_SRV_NGIX, 'port': SSH_PORT, 'local': True,  'role': 'Reverse Proxy'},
    {'name': 'clt',      'ip': IP_CLT,       'port': SSH_PORT, 'local': False, 'role': 'Backend Web',  'ssh_key': SSH_KEY_CLT},
    {'name': 'pa85',     'ip': IP_PA85,      'port': SSH_PORT, 'local': False, 'role': 'Backend Web',  'ssh_key': SSH_KEY_PA85},
    {'name': 'proxmox',  'ip': IP_PROXMOX,   'port': SSH_PORT, 'local': False, 'role': 'Hyperviseur',  'push_json': '/var/www/monitoring/proxmox-ufw.json', 'ssh_key': SSH_KEY_PVE},
]
CVE_INDEX     = '/var/www/clt/assets/data/index.json'
THREAT_STATS  = '/var/www/clt/assets/data/threat-stats.json'
NET_HISTORY_FILE    = '/var/www/monitoring/net-history.json'
PVE_CPU_HISTORY_FILE = '/var/www/monitoring/proxmox-cpu-history.json'
SYS_CPU_HISTORY_FILE = '/var/www/monitoring/sys-cpu-history.json'
PVE_NET_HISTORY_FILE = '/var/www/monitoring/pve-net-history.json'
WAN_HISTORY_FILE = '/var/www/monitoring/wan-history.json'
WAN_BOX_IP       = '<BOX-IP>'   # Free Delta box
SFP_HISTORY_FILE = '/var/www/monitoring/sfp-history.json'
WAN_HISTORY_MAX  = 288               # 24h à 5 min d'intervalle
JARVIS_URL       = 'http://localhost:5000'
SYS_SERVICES_MONITORED = ['nginx', 'crowdsec', 'fail2ban', 'rsyslog', 'ssh']

# Proxmox — deux méthodes d'auth (une seule suffit) :
#   1. Token API : renseigner PROXMOX_TOKEN  (PVEAPIToken=user@realm!id=uuid)
#   2. Login/password : renseigner PROXMOX_USER + PROXMOX_PASS (plus simple)
# Laisser PROXMOX_USER et PROXMOX_TOKEN vides pour désactiver le panneau Proxmox
PROXMOX_HOST  = IP_PROXMOX
PROXMOX_PORT  = 8006
PROXMOX_USER  = '<PROXMOX-USER>'   # ex: 'root@pam' ou 'monitor@pam'
try:
    PROXMOX_PASS = open('/opt/clt/.proxmox_pass').read().strip() if __import__('os').path.exists('/opt/clt/.proxmox_pass') else ''  # srv-ngix : /opt/clt/.proxmox_pass (chmod 600)
except Exception:
    PROXMOX_PASS = ''
PROXMOX_TOKEN = ''            # PVEAPIToken=user@realm!tokenid=uuid (alternatif)

ALERT_CONF   = '/opt/clt/alert.conf'
ALERT_STATE  = '/var/www/monitoring/alert-state.json'
AUTOBAN_LOG  = '/var/www/monitoring/autoban-log.json'
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
    _pb   = stats.setdefault('_proto', {})
    _path = parts[1] if len(parts) >= 2 else ''
    try:
        _scheme = m.group('scheme') or ''
    except Exception:
        _scheme = ''

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
    for name, url in SERVICES.items():
        t0 = time.time()
        try:
            req = Request(url, headers={'User-Agent': '0xCyberLiTech-Monitor/1.0'})
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

def _get_volumes():
    """Volumes disques montés (hors tmpfs/proc/sys/dev)."""
    SKIP_FS = {'tmpfs', 'devtmpfs', 'proc', 'sysfs', 'devpts', 'cgroup',
               'cgroup2', 'pstore', 'autofs', 'hugetlbfs', 'mqueue',
               'debugfs', 'tracefs', 'configfs', 'overlay', 'bpf',
               'securityfs', 'fusectl', 'efivarfs', 'squashfs'}
    volumes, seen = [], set()
    try:
        with open('/proc/mounts') as f:
            for line in f:
                parts = line.split()
                if len(parts) < 3:
                    continue
                mount, fstype = parts[1], parts[2]
                if fstype in SKIP_FS or mount in seen:
                    continue
                seen.add(mount)
                try:
                    st = os.statvfs(mount)
                    total = st.f_blocks * st.f_frsize
                    free  = st.f_bfree  * st.f_frsize
                    used  = total - free
                    if total < 200 * 1024 * 1024:
                        continue
                    volumes.append({
                        'mount':    mount,
                        'fstype':   fstype,
                        'used_gb':  round(used  / 1e9, 1),
                        'total_gb': round(total / 1e9, 1),
                        'pct':      round(used * 100 / total, 1) if total > 0 else 0,
                    })
                except Exception:
                    pass
    except Exception:
        pass
    return sorted(volumes, key=lambda v: v['mount'])


def get_system_metrics():
    metrics = {}
    try:
        with open('/proc/meminfo') as f:
            mem = {}
            for line in f:
                k, v = line.split(':', 1)
                mem[k.strip()] = int(v.strip().split()[0])
        total = mem.get('MemTotal', 1)
        avail = mem.get('MemAvailable', 0)
        used  = total - avail
        swap_total = mem.get('SwapTotal', 0)
        swap_free  = mem.get('SwapFree', 0)
        swap_used  = swap_total - swap_free
        metrics['memory'] = {
            'total_mb':      total      // 1024,
            'used_mb':       used       // 1024,
            'free_mb':       avail      // 1024,
            'pct':           round(used * 100 / total, 1),
            'swap_total_mb': swap_total // 1024,
            'swap_used_mb':  swap_used  // 1024,
            'swap_pct':      round(swap_used * 100 / swap_total, 1) if swap_total > 0 else 0,
        }
    except Exception:
        pass
    try:
        with open('/proc/loadavg') as f:
            parts = f.read().split()
        metrics['load'] = {'1m': parts[0], '5m': parts[1], '15m': parts[2]}
    except Exception:
        pass
    try:
        stat = os.statvfs('/var/www')
        total = stat.f_blocks * stat.f_frsize
        free  = stat.f_bfree  * stat.f_frsize
        used  = total - free
        metrics['disk'] = {
            'total_gb': round(total / 1e9, 1),
            'used_gb':  round(used  / 1e9, 1),
            'free_gb':  round(free  / 1e9, 1),
            'pct':      round(used * 100 / total, 1),
        }
    except Exception:
        pass
    try:
        with open('/proc/uptime') as f:
            secs = float(f.read().split()[0])
        h, m = divmod(int(secs // 60), 60)
        d, h = divmod(h, 24)
        metrics['uptime'] = f'{d}j {h}h {m}m'
    except Exception:
        pass
    try:
        out = subprocess.check_output(['ss', '-s'], timeout=5).decode()
        for line in out.splitlines():
            if line.startswith('TCP:'):
                estab = re.search(r'estab (\d+)', line)
                metrics['tcp_established'] = int(estab.group(1)) if estab else 0
                break
    except Exception:
        pass
    # CPU usage (delta 150ms)
    try:
        def read_cpu():
            with open('/proc/stat') as f:
                line = f.readline()
            vals = list(map(int, line.split()[1:]))
            idle = vals[3]
            total = sum(vals)
            return idle, total
        i1, t1 = read_cpu()
        time.sleep(0.15)
        i2, t2 = read_cpu()
        dt = t2 - t1
        metrics['cpu_pct'] = round((1 - (i2 - i1) / dt) * 100, 1) if dt > 0 else 0.0
    except Exception:
        pass
    # CPU cores
    try:
        cores = 0
        with open('/proc/cpuinfo') as f:
            for line in f:
                if line.startswith('processor'):
                    cores += 1
        metrics['cpu_cores'] = cores
    except Exception:
        pass
    # Réseau I/O — interfaces LAN (eth0/ens*) et WAN (enp*/eth1)
    try:
        net = {}
        with open('/proc/net/dev') as f:
            for line in f:
                line = line.strip()
                if ':' not in line:
                    continue
                iface, data = line.split(':', 1)
                iface = iface.strip()
                if iface in ('lo',):
                    continue
                cols = data.split()
                net[iface] = {'rx': int(cols[0]), 'tx': int(cols[8])}
        for _iface in net:
            try:
                with open(f'/sys/class/net/{_iface}/speed') as _sf:
                    net[_iface]['speed_mb'] = int(_sf.read().strip())
            except Exception:
                pass
        metrics['net'] = net
    except Exception:
        pass
    # CPU temperature (ACPI thermal zone 0 — best-effort, VMs may expose host temp)
    try:
        import glob as _glob
        tz_files = sorted(_glob.glob('/sys/class/thermal/thermal_zone*/temp'))
        if tz_files:
            with open(tz_files[0]) as f:
                metrics['cpu_temp'] = round(int(f.read().strip()) / 1000, 1)
    except Exception:
        pass
    # Kernel version
    try:
        import platform
        metrics['kernel'] = platform.release()
    except Exception:
        pass
    metrics['volumes'] = _get_volumes()
    return metrics

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
    """Accumule l'historique CPU/temp srv-ngix (48 points max = 4h à 5 min)."""
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
        cutoff = ts - 86400
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

def get_ssh_stats():
    """Surveillance SSH : port, sessions actives, connexions 24h via journalctl."""
    import socket as _sock

    # Sessions actives sur srv-ngix
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

    # Stats SSH 24h via journalctl (srv-ngix local)
    accepted_24h = 0
    failed_24h   = 0
    accepted_ips_24h = []
    try:
        import re as _re
        res = subprocess.run(
            ['journalctl', '-u', 'ssh', '--since', '24 hours ago', '--no-pager', '-q'],
            capture_output=True, text=True, timeout=8)
        for line in res.stdout.split('\n'):
            if 'Accepted' in line:
                accepted_24h += 1
                m2 = _re.search(r'from\s+(\d+\.\d+\.\d+\.\d+)', line)
                if m2:
                    ip2 = m2.group(1)
                    if ip2 not in accepted_ips_24h:
                        accepted_ips_24h.append(ip2)
            elif 'Failed password' in line or 'Invalid user' in line:
                failed_24h += 1
    except Exception:
        pass

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


def get_firewall_matrix():
    """Collecte état UFW + ports en écoute sur chaque machine pour la matrice firewall SOC."""
    results = []

    # srv-ngix (local)
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
        ss_out  = subprocess.run(['ss', '-tlnp'],
            capture_output=True, text=True, timeout=5).stdout
        active, rules, rule_lines = _fw_parse_ufw_verbose(ufw_out)
        if rule_lines:
            _save_ufw_cache('srv-ngix', rule_lines)
        else:
            rule_lines = _load_ufw_cache('srv-ngix')
        ports  = _fw_parse_ss_ports(ss_out)
        score, issues = _fw_conformity(active, ports, rules)
        results.append({
            'name': 'srv-ngix', 'ip': IP_SRV_NGIX, 'role': 'Reverse Proxy',
            'ufw_active': active, 'ufw_rules': rules, 'ufw_rule_lines': rule_lines,
            'listening_ports': ports, 'conformity': score, 'issues': issues,
        })
    except Exception as ex:
        results.append({'name': 'srv-ngix', 'ip': IP_SRV_NGIX, 'role': 'Reverse Proxy',
                        'error': str(ex)[:80]})

    # proxmox via push JSON (proxmox-ufw.json poussé par ufw-monitor-push.sh toutes les 5 min)
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

    # clt + pa85 via SSH (skip machines already handled via push_json)
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
            parts     = out.split('===SS===')
            active, rules, rule_lines = _fw_parse_ufw_verbose(parts[0])
            if rule_lines:
                _save_ufw_cache(m['name'], rule_lines)
            else:
                rule_lines = _load_ufw_cache(m['name'])
            ports     = _fw_parse_ss_ports(parts[1] if len(parts) > 1 else '')
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


_PVE_SERVICES_ORDER = ['pveproxy', 'pvedaemon', 'pvestatd', 'pvescheduler', 'cron']
_PVE_SSH_KEY = SSH_KEY_PVE
_CLT_SSH_KEY = SSH_KEY_CLT
_PA85_SSH_KEY= SSH_KEY_PA85


def _pve_node_metrics(pve_get, name):
    """Métriques CPU/mémoire/swap/rootfs/uptime du nœud Proxmox."""
    r = {'cpu_pct': None, 'mem_pct': None, 'mem_used_mb': 0, 'mem_total_mb': 0,
         'swap_used_mb': 0, 'swap_total_mb': 0, 'swap_pct': 0.0,
         'rootfs_used_gb': 0.0, 'rootfs_total_gb': 0.0, 'rootfs_pct': 0.0, 'uptime': '?'}
    try:
        ns     = pve_get(f'/nodes/{name}/status')
        r['cpu_pct'] = round(ns.get('cpu', 0) * 100, 1)
        mem    = ns.get('memory', {}); mem_t = mem.get('total', 1); mem_u = mem.get('used', 0)
        r['mem_pct']      = round(mem_u * 100 / mem_t, 1) if mem_t else 0
        r['mem_used_mb']  = mem_u // (1024 * 1024)
        r['mem_total_mb'] = mem_t // (1024 * 1024)
        swap   = ns.get('swap', {}); swap_t = swap.get('total', 0); swap_u = swap.get('used', 0)
        r['swap_used_mb']  = swap_u // (1024 * 1024)
        r['swap_total_mb'] = swap_t // (1024 * 1024)
        r['swap_pct']      = round(swap_u * 100 / swap_t, 1) if swap_t else 0.0
        rootfs = ns.get('rootfs', {}); rfs_t = rootfs.get('total', 0); rfs_u = rootfs.get('used', 0)
        r['rootfs_total_gb'] = round(rfs_t / 1e9, 1) if rfs_t else 0.0
        r['rootfs_used_gb']  = round(rfs_u / 1e9, 1) if rfs_u else 0.0
        r['rootfs_pct']      = round(rfs_u * 100 / rfs_t, 1) if rfs_t else 0.0
        secs = ns.get('uptime', 0); hh, mm = divmod(secs // 60, 60); dd, hh = divmod(hh, 24)
        r['uptime'] = f'{dd}j {hh}h {mm}m'
    except Exception:
        pass
    return r


def _pve_node_storages(pve_get, name):
    """Storage pools actifs du nœud."""
    storages = []
    try:
        for st in pve_get(f'/nodes/{name}/storage'):
            if not st.get('active', 0):
                continue
            st_t = st.get('total', 0); st_u = st.get('used', 0)
            storages.append({
                'name':     st.get('storage', '?'),
                'type':     st.get('type',    '?'),
                'total_gb': round(st_t / 1e9, 1) if st_t else 0.0,
                'used_gb':  round(st_u / 1e9, 1) if st_u else 0.0,
                'pct':      round(st_u * 100 / st_t, 1) if st_t else 0.0,
            })
    except Exception:
        pass
    return storages


def _pve_node_services(pve_get, name):
    """Services PVE du nœud (pveproxy, pvedaemon…)."""
    services = []
    try:
        for svc in pve_get(f'/nodes/{name}/services'):
            sname = svc.get('name', '')
            if sname in _PVE_SERVICES_ORDER:
                services.append({'name': sname, 'state': svc.get('state', 'unknown')})
        services.sort(key=lambda x: _PVE_SERVICES_ORDER.index(x['name']) if x['name'] in _PVE_SERVICES_ORDER else 99)
    except Exception:
        pass
    return services


def _pve_vm_networks(pve_get, node_name, vmid, vtype):
    """Bridges réseau d'une VM/LXC depuis sa config Proxmox."""
    nets = []
    try:
        endpoint = f'/nodes/{node_name}/{"qemu" if vtype=="vm" else "lxc"}/{vmid}/config'
        cfg = pve_get(endpoint)
        for k, val in cfg.items():
            if k.startswith('net') and k[3:].isdigit():
                for part in str(val).split(','):
                    if part.startswith('bridge='):
                        nets.append(part.split('=', 1)[1].strip())
                        break
    except Exception:
        pass
    return nets


def _pve_vm_ip(pve_get, node_name, vmid, vtype):
    """Première IP LAN (non-loopback) d'une VM via QEMU agent ou config LXC."""
    try:
        if vtype == 'vm':
            ifaces = pve_get(f'/nodes/{node_name}/qemu/{vmid}/agent/network-get-interfaces')
            for iface in (ifaces.get('result') or []):
                for addr in (iface.get('ip-addresses') or []):
                    ip = addr.get('ip-address', '')
                    if addr.get('ip-address-type') == 'ipv4' and not ip.startswith('127.'):
                        return ip
        else:
            cfg = pve_get(f'/nodes/{node_name}/lxc/{vmid}/config')
            for k, val in cfg.items():
                if k.startswith('net') and k[3:].isdigit():
                    for part in str(val).split(','):
                        if part.startswith('ip='):
                            return part.split('=', 1)[1].split('/')[0]
    except Exception:
        pass
    return None


def _pve_node_vms(pve_get, name):
    """VMs QEMU + conteneurs LXC du nœud (triés par vmid)."""
    vms = []
    try:
        for vm in pve_get(f'/nodes/{name}/qemu'):
            vm_mem = vm.get('mem', 0); vm_max = vm.get('maxmem', 0)
            secs_vm = vm.get('uptime', 0) or 0; tot_m = int(secs_vm // 60)
            d, h, m = tot_m // 1440, (tot_m % 1440) // 60, tot_m % 60
            vmid = vm.get('vmid', '?')
            vms.append({
                'id': vmid, 'name': vm.get('name', '?'),
                'status': vm.get('status', '?'), 'type': 'vm',
                'cpu': round(vm.get('cpu', 0) * 100, 1) if vm.get('cpu') is not None else None,
                'mem': vm_mem, 'maxmem': vm_max,
                'mem_pct': round(vm_mem * 100 / vm_max, 1) if vm_max else 0.0,
                'uptime': f'{d}j {h}h {m}m' if secs_vm else '?',
                'cpus':     vm.get('cpus', vm.get('maxcpu', 1)) or 1,
                'ip':       _pve_vm_ip(pve_get, name, vmid, 'vm'),
                'netin':    vm.get('netin', 0) or 0,
                'netout':   vm.get('netout', 0) or 0,
                'networks': _pve_vm_networks(pve_get, name, vmid, 'vm'),
            })
    except Exception:
        pass
    try:
        for ct in pve_get(f'/nodes/{name}/lxc'):
            ct_mem = ct.get('mem', 0); ct_max = ct.get('maxmem', 0)
            ctid = ct.get('vmid', '?')
            vms.append({
                'id': ctid, 'name': ct.get('name', '?'),
                'status': ct.get('status', '?'), 'type': 'lxc',
                'cpu': round(ct.get('cpu', 0) * 100, 1) if ct.get('cpu') is not None else None,
                'mem': ct_mem, 'maxmem': ct_max,
                'mem_pct': round(ct_mem * 100 / ct_max, 1) if ct_max else 0.0,
                'cpus':     ct.get('cpus', ct.get('maxcpu', 1)) or 1,
                'ip':       _pve_vm_ip(pve_get, name, ctid, 'lxc'),
                'netin':    ct.get('netin', 0) or 0,
                'netout':   ct.get('netout', 0) or 0,
                'networks': _pve_vm_networks(pve_get, name, ctid, 'lxc'),
            })
    except Exception:
        pass
    vms.sort(key=lambda x: int(x['id']) if str(x['id']).isdigit() else 0)
    return vms


def _pve_node_temps(name):
    """Températures CPU/NVMe/ACPI + modèle CPU via SSH sur le nœud Proxmox."""
    r = {'cpu_temp': None, 'nvme_temp': None, 'acpi_temp': None, 'cpu_model': None, 'cpu_cores': None}
    try:
        pve_ssh = ['ssh', '-i', _PVE_SSH_KEY, '-p', str(SSH_PORT),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=5', f'root@{PROXMOX_HOST}']
        raw   = subprocess.check_output(
            pve_ssh + ['cat /sys/class/hwmon/hwmon2/temp1_input '
                       '/sys/class/hwmon/hwmon1/temp1_input '
                       '/sys/class/hwmon/hwmon0/temp1_input '
                       '/proc/cpuinfo'],
            stderr=subprocess.DEVNULL, timeout=8
        ).decode()
        lines = raw.strip().splitlines()
        vals  = []
        for l in lines[:3]:
            try: vals.append(int(l.strip()))
            except (ValueError, TypeError): vals.append(None)
        r['cpu_temp']  = round(vals[0] / 1000, 1) if vals[0] else None
        r['nvme_temp'] = round(vals[1] / 1000, 1) if len(vals) > 1 and vals[1] else None
        r['acpi_temp'] = round(vals[2] / 1000, 1) if len(vals) > 2 and vals[2] else None
        for l in lines[3:]:
            if 'model name' in l and not r['cpu_model']:
                r['cpu_model'] = l.split(':', 1)[1].strip()
            if 'processor' in l:
                try: r['cpu_cores'] = int(l.split(':', 1)[1].strip()) + 1
                except (ValueError, TypeError): pass
    except Exception:
        pass
    return r


def _pve_node_nvme_disks(name):
    """Données par disque NVMe (device, modèle, capacité, température, SMART) via SSH."""
    disks = []
    try:
        pve_ssh = ['ssh', '-i', _PVE_SSH_KEY, '-p', str(SSH_PORT),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=5', f'root@{PROXMOX_HOST}']
        raw = subprocess.check_output(
            pve_ssh + [
                'for hp in $(ls /sys/class/nvme/ 2>/dev/null | sort); do '
                'dev=${hp}n1; '
                'hpath=/sys/class/nvme/$hp; '
                'hw=$(ls "$hpath" 2>/dev/null | grep hwmon | head -1); '
                'tmp=$(cat "$hpath/$hw/temp1_input" 2>/dev/null); '
                'model=$(cat "$hpath/model" 2>/dev/null | xargs); '
                'size=$(cat "/sys/block/$dev/size" 2>/dev/null); '
                'smart=$(smartctl -H /dev/$dev 2>/dev/null | grep -c PASSED); '
                'echo "$dev|$model|$size|$tmp|$smart"; '
                'done'],
            stderr=subprocess.DEVNULL, timeout=15
        ).decode()
        for line in raw.strip().splitlines():
            parts = line.split('|')
            if len(parts) < 2:
                continue
            dev       = parts[0].strip()
            model     = parts[1].strip() if len(parts) > 1 else '?'
            size_sec  = int(parts[2]) if len(parts) > 2 and parts[2].strip().isdigit() else 0
            temp_raw  = int(parts[3]) if len(parts) > 3 and parts[3].strip().isdigit() else None
            smart_raw = parts[4].strip() if len(parts) > 4 else None
            disks.append({
                'device':   dev,
                'model':    model[:32],
                'total_gb': round(size_sec * 512 / 1e9, 0),
                'temp_c':   round(temp_raw / 1000, 1) if temp_raw else None,
                'smart_ok': True if smart_raw == '1' else (None if not smart_raw else False),
            })
    except Exception:
        pass
    return disks


def _pve_node_extra(name):
    """Load average, ZFS pool health, version PVE via SSH sur le nœud Proxmox."""
    result = {'load_avg': None, 'zfs_pools': [], 'pve_version': None}
    try:
        pve_ssh = ['ssh', '-i', _PVE_SSH_KEY, '-p', str(SSH_PORT),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=5', f'root@{PROXMOX_HOST}']
        raw = subprocess.check_output(
            pve_ssh + [
                "awk '{print \"LOAD|\"$1\"|\"$2\"|\"$3}' /proc/loadavg; "
                "v=$(pveversion 2>/dev/null | grep -oP 'pve-manager/\\K[^/]+' | head -1); "
                "[ -n \"$v\" ] && echo \"PVE|$v\"; "
                "zpool list -H -o name,health 2>/dev/null | while read pname phealth; do "
                "  nvme_dev=''; "
                "  for d in $(zpool status -P $pname 2>/dev/null | awk '/\\/dev\\//{print $1}'); do "
                "    r=$(readlink -f $d 2>/dev/null | grep -o 'nvme[0-9]*n[0-9]*' | head -1); "
                "    [ -n \"$r\" ] && nvme_dev=$r && break; "
                "  done; "
                "  echo \"ZFS|$pname|$phealth|$nvme_dev\"; "
                "done"
            ],
            stderr=subprocess.DEVNULL, timeout=10
        ).decode()
        for line in raw.strip().splitlines():
            parts = line.split('|')
            if parts[0] == 'LOAD' and len(parts) >= 4:
                try:
                    result['load_avg'] = [float(parts[1]), float(parts[2]), float(parts[3])]
                except ValueError:
                    pass
            elif parts[0] == 'PVE' and len(parts) >= 2:
                result['pve_version'] = parts[1].strip()
            elif parts[0] == 'ZFS' and len(parts) >= 3:
                result['zfs_pools'].append({
                    'name':        parts[1].strip(),
                    'health':      parts[2].strip(),
                    'nvme_device': parts[3].strip() if len(parts) > 3 and parts[3].strip() else None,
                })
    except Exception:
        pass
    return result


def _pve_node_network(node_name):
    """Interfaces réseau actives du nœud Proxmox (rx/tx cumulatifs + vitesse lien)."""
    SKIP_PREFIXES = ('tap', 'veth', 'fwbr', 'fwln', 'fwpr', 'docker', 'lxc', 'virbr', 'wg')
    ifaces = []
    try:
        pve_ssh = ['ssh', '-i', _PVE_SSH_KEY, '-p', str(SSH_PORT),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=5', f'root@{PROXMOX_HOST}']
        raw = subprocess.check_output(
            pve_ssh + [
                'for iface in $(ls /sys/class/net/ 2>/dev/null); do '
                '[ "$iface" = "lo" ] && continue; '
                'state=$(cat /sys/class/net/$iface/operstate 2>/dev/null); '
                '[ "$state" != "up" ] && continue; '
                'rx=$(cat /sys/class/net/$iface/statistics/rx_bytes 2>/dev/null || echo 0); '
                'tx=$(cat /sys/class/net/$iface/statistics/tx_bytes 2>/dev/null || echo 0); '
                'spd=$(cat /sys/class/net/$iface/speed 2>/dev/null || echo -1); '
                'echo "$iface|$rx|$tx|$spd"; '
                'done'],
            stderr=subprocess.DEVNULL, timeout=8
        ).decode()
        for line in raw.strip().splitlines():
            parts = line.split('|')
            if len(parts) < 3:
                continue
            iface_name = parts[0].strip()
            if any(iface_name.startswith(p) for p in SKIP_PREFIXES):
                continue
            rx = int(parts[1]) if parts[1].strip().isdigit() else 0
            tx = int(parts[2]) if parts[2].strip().isdigit() else 0
            try:
                spd_raw = int(parts[3].strip()) if len(parts) > 3 else -1
                spd = spd_raw if spd_raw > 0 else 0
            except (ValueError, IndexError):
                spd = 0
            ifaces.append({'name': iface_name, 'rx_bytes': rx, 'tx_bytes': tx, 'speed_mb': spd})
    except Exception:
        pass
    return ifaces


def _pve_node_fans(node_name):
    """Vitesses ventilateurs via sensors (best-effort, retourne [] si indisponible)."""
    fans = []
    try:
        pve_ssh = ['ssh', '-i', _PVE_SSH_KEY, '-p', str(SSH_PORT),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=5', f'root@{PROXMOX_HOST}']
        raw = subprocess.check_output(
            pve_ssh + ['sensors 2>/dev/null || true'],
            stderr=subprocess.DEVNULL, timeout=6
        ).decode()
        for line in raw.splitlines():
            m = re.search(r'(fan\d+)[:\s]+(\d+)\s*RPM', line, re.IGNORECASE)
            if m:
                rpm = int(m.group(2))
                if rpm > 0:
                    fans.append({'name': m.group(1).upper(), 'rpm': rpm})
    except Exception:
        pass
    return fans


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


def _pve_node_top_procs(node_name):
    """Top 10 processus par CPU% sur le nœud Proxmox (SSH best-effort)."""
    procs = []
    try:
        pve_ssh = ['ssh', '-i', _PVE_SSH_KEY, '-p', str(SSH_PORT),
                   '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                   '-o', 'ConnectTimeout=5', f'root@{PROXMOX_HOST}']
        raw = subprocess.check_output(
            pve_ssh + ['ps --no-headers -eo user:12,pid,pcpu,pmem,args --sort=-%cpu 2>/dev/null | head -10'],
            stderr=subprocess.DEVNULL, timeout=6
        ).decode('utf-8', errors='replace')
        for line in raw.strip().splitlines():
            parts = line.split(None, 4)
            if len(parts) < 5:
                continue
            try:
                full_args = parts[4].strip()
                base_cmd  = os.path.basename(full_args.split()[0])
                if base_cmd in ('kvm', 'qemu-system-x86_64'):
                    m = re.search(r'-name\s+([^,\s]+)', full_args)
                    cmd = 'kvm(' + m.group(1) + ')' if m else 'kvm'
                else:
                    cmd = base_cmd[:24]
                procs.append({
                    'user': parts[0][:12],
                    'pid':  int(parts[1]),
                    'cpu':  float(parts[2]),
                    'mem':  float(parts[3]),
                    'cmd':  cmd[:28],
                })
            except (ValueError, IndexError):
                continue
    except Exception:
        pass
    return procs


def _pve_build_node(pve_get, node_raw):
    """Construit le dict complet d'un nœud Proxmox."""
    name   = node_raw['node']
    status = node_raw.get('status', '?')
    m    = _pve_node_metrics(pve_get, name)
    tmp  = _pve_node_temps(name)
    nvds = _pve_node_nvme_disks(name)
    net  = _pve_node_network(name)
    fans = _pve_node_fans(name)
    procs = _pve_node_top_procs(name)
    extra = _pve_node_extra(name)
    nvme_temp_val = nvds[0]['temp_c'] if nvds and nvds[0]['temp_c'] is not None else tmp['nvme_temp']
    return {
        'name':            name,
        'status':          status,
        'cpu_pct':         m['cpu_pct'],
        'cpu_model':       tmp['cpu_model'],
        'cpu_cores':       tmp['cpu_cores'],
        'cpu_temp':        tmp['cpu_temp'],
        'nvme_temp':       nvme_temp_val,
        'nvme_disks':      nvds,
        'acpi_temp':       tmp['acpi_temp'],
        'mem_pct':         m['mem_pct'],
        'mem_used_mb':     m['mem_used_mb'],
        'mem_total_mb':    m['mem_total_mb'],
        'swap_used_mb':    m['swap_used_mb'],
        'swap_total_mb':   m['swap_total_mb'],
        'swap_pct':        m['swap_pct'],
        'rootfs_used_gb':  m['rootfs_used_gb'],
        'rootfs_total_gb': m['rootfs_total_gb'],
        'rootfs_pct':      m['rootfs_pct'],
        'uptime':          m['uptime'],
        'load_avg':        extra['load_avg'],
        'pve_version':     extra['pve_version'],
        'zfs_pools':       extra['zfs_pools'],
        'storages':        _pve_node_storages(pve_get, name),
        'services':        _pve_node_services(pve_get, name),
        'vms':             _pve_node_vms(pve_get, name),
        'network':         net,
        'fans':            fans,
        'top_procs':       procs,
    }


def get_proxmox_stats():
    """Interroge l'API Proxmox VE pour récupérer état des nœuds et VMs/LXC."""
    if not PROXMOX_PASS and not PROXMOX_TOKEN:
        return {'configured': False}

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode    = ssl.CERT_NONE
    base = f'https://{PROXMOX_HOST}:{PROXMOX_PORT}/api2/json'

    if PROXMOX_PASS:
        try:
            body = urlencode({'username': PROXMOX_USER, 'password': PROXMOX_PASS}).encode()
            with urlopen(Request(f'{base}/access/ticket', data=body), context=ctx, timeout=6) as r:
                tok = json.loads(r.read().decode())['data']
            auth_headers = {'Cookie': f'PVEAuthCookie={tok["ticket"]}',
                            'CSRFPreventionToken': tok['CSRFPreventionToken']}
        except Exception as e:
            return {'configured': True, 'error': f'Auth failed: {str(e)[:80]}'}
    else:
        auth_headers = {'Authorization': PROXMOX_TOKEN}

    def pve_get(path):
        with urlopen(Request(f'{base}{path}', headers=auth_headers), context=ctx, timeout=6) as r:
            return json.loads(r.read().decode())['data']

    try:
        nodes = [_pve_build_node(pve_get, n) for n in pve_get('/nodes')]
        return {
            'configured':  True,
            'nodes':       nodes,
            'vms_running': sum(1 for n in nodes for v in n['vms'] if v['status'] == 'running'),
            'vms_total':   sum(len(n['vms']) for n in nodes),
        }
    except Exception as e:
        return {'configured': True, 'error': str(e)[:120]}

def get_wan_ip():
    """Détecte l'IP WAN publique — position fixée aux Sables-d'Olonne (85, FR)."""
    try:
        req = Request('https://ipinfo.io/json', headers={'User-Agent': 'monitoring-gen/2.3'})
        with urlopen(req, timeout=6) as r:
            info = json.loads(r.read().decode())
        return {
            'ip':      info.get('ip', ''),
            'city':    "Les Sables-d'Olonne",
            'country': 'FR',
            'lat':     46.4978,
            'lon':     -1.7831,
        }
    except Exception:
        return None

FREEBOX_BASE  = 'http://' + WAN_BOX_IP + '/api/v8'
FREEBOX_APP   = 'soc.monitoring'
FREEBOX_TOKEN = '/opt/clt/freebox_token.txt'


def _fbx_get(sess, path):
    """Authenticated GET to Freebox API — returns result dict or None."""
    try:
        req = Request(FREEBOX_BASE + path, headers={'X-Fbx-App-Auth': sess})
        with urlopen(req, timeout=5) as r:
            d = json.loads(r.read())
        return d.get('result') if d.get('success') else None
    except Exception:
        return None


def _fbx_rrd_sfp(sess, start, end):
    """Fetch SFP LAN RRD data from Freebox — returns list of {ts, tx, rx} points."""
    path = ('/rrd/?db=switch&id=sfp_lan'
            '&date_start=' + str(start) +
            '&date_end='   + str(end) +
            '&precision=120')
    r = _fbx_get(sess, path)
    pts = r.get('data', []) if r and isinstance(r, dict) else []
    return [
        {'ts': p.get('time', 0),
         'tx': p.get('tx_sfp_lan') or 0,
         'rx': p.get('rx_sfp_lan') or 0}
        for p in pts
    ]


def _fbx_downsample(pts, n=60):
    """Downsample list to at most n evenly-spaced points."""
    if len(pts) <= n:
        return pts
    step = max(1, len(pts) // n)
    return pts[::step][-n:]


def _freebox_session():
    """Ouvre une session API Freebox.
    Retourne (session_token, None) en succès ou (None, error_code) en échec.
    Codes d'erreur : 'no_token' | 'unreachable' | 'invalid_token' | 'session_failed'
    Simulation : FBX_SIMULATE=invalid_token python3 monitoring_gen.py
    """
    import hmac as _hmac, hashlib as _hashlib, os as _os
    # Mode simulation (test sans toucher au token)
    _sim = _os.environ.get('FBX_SIMULATE', '').strip()
    if _sim in ('no_token', 'invalid_token', 'unreachable', 'session_failed'):
        return None, _sim
    # Token absent ou vide
    if not _os.path.exists(FREEBOX_TOKEN):
        return None, 'no_token'
    try:
        token = open(FREEBOX_TOKEN).read().strip()
    except Exception:
        return None, 'no_token'
    if not token:
        return None, 'no_token'
    # Freebox joignable ?
    try:
        req = Request(FREEBOX_BASE + '/login/')
        with urlopen(req, timeout=5) as r:
            challenge = json.loads(r.read())['result']['challenge']
    except Exception:
        return None, 'unreachable'
    # Ouverture de session
    try:
        password = _hmac.new(token.encode(), challenge.encode(), _hashlib.sha1).hexdigest()
        data = json.dumps({'app_id': FREEBOX_APP, 'password': password}).encode()
        req2 = Request(FREEBOX_BASE + '/login/session/', data=data,
                       headers={'Content-Type': 'application/json'})
        with urlopen(req2, timeout=5) as r:
            sess = json.loads(r.read())
        if sess.get('success'):
            return sess['result']['session_token'], None
        err_code = sess.get('error_code', '')
        if 'invalid_token' in err_code or 'auth_required' in err_code or 'denied' in err_code:
            return None, 'invalid_token'
        return None, 'session_failed'
    except Exception:
        return None, 'session_failed'

def get_freebox_stats():
    """Collecte état WAN, débits, signal fibre FTTH et température depuis l'API Freebox Delta."""
    sess, auth_err = _freebox_session()
    if not sess:
        return {'available': False, 'auth_error': auth_err}

    def fbx_get(path):
        return _fbx_get(sess, path)

    conn = fbx_get('/connection/')
    ftth = fbx_get('/connection/ftth/')
    sys_  = fbx_get('/system/')

    result = {'available': True}

    if conn:
        result['wan_state']      = conn.get('state', 'unknown')
        result['ipv4']           = conn.get('ipv4', '')
        result['ipv6']           = conn.get('ipv6', '')
        result['rate_down']      = conn.get('rate_down', 0)       # Kbits/s actuel
        result['rate_up']        = conn.get('rate_up', 0)         # Kbits/s actuel
        result['bytes_down']     = conn.get('bytes_down', 0)
        result['bytes_up']       = conn.get('bytes_up', 0)
        bw_d = conn.get('bandwidth_down', 0)
        bw_u = conn.get('bandwidth_up', 0)
        # La Freebox Delta rapporte parfois la bande passante en bits/s (pas Kbits/s)
        # On normalise à Kbits/s pour l'affichage
        result['bandwidth_down'] = bw_d // 1000 if bw_d > 10_000_000 else bw_d
        result['bandwidth_up']   = bw_u // 1000 if bw_u > 10_000_000 else bw_u
        result['media']          = conn.get('media', 'ftth')

    if ftth:
        # L'API retourne les puissances en centièmes de dBm → diviser par 100
        rx_raw = ftth.get('sfp_pwr_rx')
        tx_raw = ftth.get('sfp_pwr_tx')
        rx_dbm = round(rx_raw / 100, 2) if rx_raw is not None and abs(rx_raw) > 100 else rx_raw
        tx_dbm = round(tx_raw / 100, 2) if tx_raw is not None and abs(tx_raw) > 100 else tx_raw
        result['sfp_present']    = ftth.get('sfp_present', False)
        result['sfp_link']       = ftth.get('link', False)
        result['sfp_pwr_rx']     = rx_dbm   # dBm réels
        result['sfp_pwr_tx']     = tx_dbm
        # Qualité signal GPON : -27 à -8 dBm normal
        if rx_dbm is not None:
            if   rx_dbm < -27: result['sfp_quality'] = 'FAIBLE'
            elif rx_dbm < -20: result['sfp_quality'] = 'CORRECT'
            elif rx_dbm < -8:  result['sfp_quality'] = 'BON'
            else:              result['sfp_quality'] = 'FORT'
        else:
            result['sfp_quality'] = None

    if sys_:
        sensors = sys_.get('sensors', [])
        result['temps'] = [
            {'name': s.get('name', '?'), 'value': s.get('value')}
            for s in sensors if s.get('value') is not None
        ]
        fans = sys_.get('fans', [])
        result['fans'] = [
            {'name': f.get('name', '?'), 'value': f.get('value')}
            for f in fans if f.get('value') is not None
        ]
        result['uptime_s'] = sys_.get('uptime_val')

    # ── SFP LAN — jarretière DAC 10G vers Proxmox ──
    switch = fbx_get('/switch/status/')
    sfp_port = None
    if switch:
        for port in switch:
            if port.get('rrd_id') == 'sfp_lan' or port.get('id') == 9999:
                sfp_port = port
                break
    if sfp_port:
        import time as _time
        now = int(_time.time())
        # Stats cumulées (erreurs FCS, paquets)
        stats = fbx_get('/switch/port/9999/stats/')
        # 24h (120s resolution — ~521 points)
        history_24h = _fbx_rrd_sfp(sess, now - 86400, now)
        # 7 jours (même API — Freebox stocke ~1010 points sur 7j)
        history_7d  = _fbx_rrd_sfp(sess, now - 7 * 86400, now)
        rrd_pts = history_24h
        # Débit courant = dernier point non nul
        current_tx = current_rx = None
        for p in reversed(rrd_pts):
            if p['tx'] or p['rx']:
                current_tx = p['tx']
                current_rx = p['rx']
                break
        result['sfp_lan'] = {
            'link':        sfp_port.get('link', 'unknown'),  # 'up' | 'down'
            'speed':       sfp_port.get('speed', '?'),       # '10000' = 10G
            'mode':        sfp_port.get('mode', '?'),
            'duplex':      sfp_port.get('duplex', '?'),
            'mac_list':    sfp_port.get('mac_list', []),
            'tx_bps':      current_tx,   # bytes/s courant
            'rx_bps':      current_rx,   # bytes/s courant
            'tx_bytes':    stats.get('tx_bytes')      if stats else None,
            'rx_bytes':    stats.get('rx_good_bytes') if stats else None,
            'tx_packets':  stats.get('tx_packets')    if stats else None,
            'rx_packets':  stats.get('rx_good_packets') if stats else None,
            'fcs_errors':  stats.get('rx_fcs_packets', 0) if stats else 0,
        }
        # Downsample → 60 points max par période (embarqués dans monitoring.json)
        result['sfp_lan']['chart_24h'] = _fbx_downsample(history_24h)
        result['sfp_lan']['chart_7d']  = _fbx_downsample(history_7d)

    # ── Répéteurs WiFi Free ──
    reps_raw = fbx_get('/repeater/')
    if reps_raw and isinstance(reps_raw, list):
        result['repeaters'] = []
        for r in reps_raw:
            bh_best = next((b for b in r.get('backhaul', []) if b.get('best')), None)
            fh_active = sum(1 for f in r.get('fronthaul', []) if f.get('enabled'))
            result['repeaters'].append({
                'name':         r.get('name'),
                'model':        r.get('model'),
                'status':       r.get('status'),
                'connection':   r.get('connection'),
                'ip':           (r.get('ip') or {}).get('v4'),
                'firmware':     r.get('firmware_version'),
                'bh_band':      bh_best.get('band')        if bh_best else None,
                'bh_signal':    bh_best.get('signal')      if bh_best else None,
                'bh_throughput':bh_best.get('throughput')  if bh_best else None,
                'bh_placement': bh_best.get('placement')   if bh_best else None,
                'fh_count':     fh_active,
            })

    return result


def _ping(host, count=3, timeout=2):
    """Ping host (Linux), retourne avg_ms et packet_loss %.
    Fallback TCP curl si ICMP bloqué (ex : Freebox filtre ICMP des VMs LAN).
    """
    try:
        result = subprocess.run(
            ['ping', '-c', str(count), '-W', str(timeout), host],
            capture_output=True, text=True,
            timeout=count * timeout + 3
        )
        out = result.stdout
        m = re.search(r'rtt min/avg/max/mdev = [\d.]+/([\d.]+)/', out)
        avg_ms = round(float(m.group(1)), 1) if m else None
        m2 = re.search(r'(\d+)% packet loss', out)
        loss = int(m2.group(1)) if m2 else 100
        if loss < 100:
            return {'ms': avg_ms, 'loss': loss, 'ok': True}
        # ICMP perte 100% → fallback TCP connect time via curl
        return _tcp_latency(host, timeout=timeout * count)
    except Exception:
        return _tcp_latency(host, timeout=timeout * count)

def _tcp_latency(host, port=80, timeout=5):
    """Mesure latence TCP via curl time_connect (fallback si ICMP filtré)."""
    try:
        url = f'http://{host}/'
        r = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '--max-time', str(timeout),
             '-w', '%{time_connect}', '--connect-timeout', str(timeout), url],
            capture_output=True, text=True, timeout=timeout + 2
        )
        val = r.stdout.strip()
        connect_s = float(val) if val else None
        if connect_s is not None and connect_s > 0:
            return {'ms': round(connect_s * 1000, 1), 'loss': 0, 'ok': True}
        return {'ms': None, 'loss': 100, 'ok': False}
    except Exception:
        return {'ms': None, 'loss': 100, 'ok': False}


def _wan_iso_to_epoch(s):
    """Convert ISO-8601 UTC string to Unix timestamp (0 on error)."""
    try:
        return int(datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp())
    except Exception:
        return 0


def _wan_detect_incidents(history, now_ts):
    """Scan WAN history for consecutive DOWN/DEGRADED segments → incident list."""
    incidents, in_down = [], False
    inc_start = inc_start_epoch = inc_type = None
    for e in history:
        if e.get('status') in ('DOWN_ISP', 'DOWN_LOCAL', 'DEGRADED'):
            if not in_down:
                in_down         = True
                inc_start       = e['ts']
                inc_start_epoch = _wan_iso_to_epoch(e['ts'])
                inc_type        = e.get('status')
        else:
            if in_down:
                end_epoch = _wan_iso_to_epoch(e['ts'])
                incidents.append({'start': inc_start, 'end': e['ts'],
                                  'dur': end_epoch - inc_start_epoch,
                                  'type': inc_type, 'status': 'RESOLVED'})
                in_down = False
    if in_down:
        now_epoch = _wan_iso_to_epoch(now_ts)
        incidents.append({'start': inc_start, 'end': now_ts,
                          'dur': now_epoch - inc_start_epoch,
                          'type': inc_type, 'status': 'ONGOING'})
    return incidents


def get_wan_monitoring():
    """Mesure latence box Free (<BOX-IP>) + WAN (8.8.8.8 / 1.1.1.1) + check HTTP.
    Maintient un historique glissant 24h dans wan-history.json.
    Status : UP | DEGRADED | DOWN_ISP | DOWN_LOCAL
    """
    # Box : HTTP port 80 direct (API Freebox accessible en HTTP depuis srv-ngix)
    box  = _tcp_latency(WAN_BOX_IP, port=80, timeout=3)
    # WAN : TCP port 443 vers Google et Cloudflare (HTTPS toujours joignable)
    wan1 = _tcp_latency('8.8.8.8',  port=443, timeout=4)
    wan2 = _tcp_latency('1.1.1.1',  port=443, timeout=4)

    # WAN OK si au moins un des deux répond
    wan_ok  = wan1['ok'] or wan2['ok']
    wan_ms  = wan1['ms'] if wan1['ok'] else (wan2['ms'] if wan2['ok'] else None)
    wan_loss = min(wan1['loss'], wan2['loss'])

    # Sondes FAI — HTTPS vers deux serveurs de l'opérateur (backbone + portail)
    # ADAPTER : remplacer par deux hosts représentatifs de votre FAI
    free_dns      = _tcp_latency('<ISP-HOST-1>',  port=443, timeout=5)
    free_backbone = _tcp_latency('<ISP-HOST-2>',  port=443, timeout=5)
    free_dns_ok      = free_dns['ok']
    free_backbone_ok = free_backbone['ok']
    free_dns_ms      = free_dns['ms']
    free_backbone_ms = free_backbone['ms']

    # Check HTTP (sonde neutre — génère_204 Google)
    http_ok = False
    if wan_ok:
        try:
            req = Request('http://www.gstatic.com/generate_204',
                          headers={'User-Agent': 'wan-monitor/1.0'})
            with urlopen(req, timeout=5) as r:
                http_ok = r.status in (200, 204)
        except Exception:
            http_ok = False

    # Diagnostic status
    if not box['ok']:
        status = 'DOWN_LOCAL'   # box ne répond pas → problème local (câble, routeur)
    elif not wan_ok:
        status = 'DOWN_ISP'     # box OK mais WAN inaccessible → panne FAI possible
    elif not http_ok:
        status = 'DEGRADED'     # ping OK mais HTTP échoue → connectivité partielle
    else:
        status = 'UP'

    # Diagnostic Free Telecom affiné
    # Si box OK + WAN DOWN + Free DNS DOWN → panne infrastructure Free (probable secteur)
    # Si box OK + WAN DOWN + Free DNS UP → problème routage / CGNAT
    free_diag = None
    if status in ('DOWN_ISP', 'DEGRADED'):
        if not free_dns_ok and not free_backbone_ok:
            free_diag = 'INFRA_FREE'    # infrastructure Free inaccessible → panne backbone
        elif not free_dns_ok:
            free_diag = 'DNS_FREE'      # DNS Free KO, backbone partiel
        else:
            free_diag = 'ROUTING'       # Free DNS joignable → problème routage spécifique

    ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    entry = {
        'ts':              ts,
        'status':          status,
        'box_ms':          box['ms'],
        'box_loss':        box['loss'],
        'wan_ms':          wan_ms,
        'wan_loss':        wan_loss,
        'http_ok':         http_ok,
        'free_dns_ok':      free_dns_ok,
        'free_dns_ms':      free_dns_ms,
        'free_backbone_ok': free_backbone_ok,
        'free_backbone_ms': free_backbone_ms,
    }

    # Historique glissant
    history = []
    try:
        with open(WAN_HISTORY_FILE) as f:
            history = json.load(f)
    except Exception:
        pass
    history.append(entry)
    history = history[-WAN_HISTORY_MAX:]
    try:
        tmp = WAN_HISTORY_FILE + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(history, f, ensure_ascii=False)
        os.replace(tmp, WAN_HISTORY_FILE)
    except Exception:
        pass

    # Calcul uptime 24h
    total = len(history)
    up_count = sum(1 for e in history if e.get('status') == 'UP')
    uptime_pct = round(up_count / total * 100, 1) if total > 0 else None

    # Détection d'incidents — segments DOWN consécutifs
    incidents = _wan_detect_incidents(history, ts)

    return {
        'status':           status,
        'box':              {'ms': box['ms'], 'loss': box['loss'], 'ok': box['ok']},
        'wan':              {'ms': wan_ms,    'loss': wan_loss,    'ok': wan_ok},
        'http_ok':          http_ok,
        'free_dns_ok':      free_dns_ok,
        'free_dns_ms':      free_dns_ms,
        'free_backbone_ok': free_backbone_ok,
        'free_backbone_ms': free_backbone_ms,
        'free_diag':        free_diag,          # None | INFRA_FREE | DNS_FREE | ROUTING
        'uptime_24h':       uptime_pct,
        'incidents':        incidents[-20:],    # 20 derniers incidents (24h)
        'history':          history[-48:],      # 4h pour sparkline (48 points × 5 min)
    }


_LAN_RE = re.compile(r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)')

def get_active_attacks():
    """Parse les 15 dernières minutes du log nginx + journalctl SSH.
    Stages : RECON (444/geoblock) → SCAN (400/scanner) → EXPLOIT (403 FR/LAN ou 429) → BRUTE (SSH failed).
    Note : 403 étranger (GeoIP block) → RECON — pas EXPLOIT (faux positif).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    STAGE_ORDER = ['RECON', 'SCAN', 'EXPLOIT', 'BRUTE']
    STAGE_IDX   = {s: i for i, s in enumerate(STAGE_ORDER)}
    ip_data = {}  # ip -> {stage_idx, count, country}
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
                ip      = m.group('ip')
                if _LAN_RE.match(ip):
                    continue  # IPs LAN exclues de la Kill Chain
                status  = int(m.group('status'))
                ua      = m.group('ua')
                country = m.group('country')
                # Classification par stage
                if status == 444:
                    stage = 'RECON'
                elif status == 400 or (SCANNER_RE.search(ua) and not LEGIT_BOTS.search(ua)):
                    stage = 'SCAN'
                elif status == 429:
                    stage = 'EXPLOIT'
                elif status == 403:
                    # 403 étranger (GeoIP block) → RECON
                    # 403 FR ou pays inconnu ('-') → restriction réelle, pas GeoIP → EXPLOIT
                    if country in ('FR', '-'):
                        stage = 'EXPLOIT'
                    else:
                        stage = 'RECON'
                else:
                    continue  # trafic normal ignoré
                sidx = STAGE_IDX[stage]
                if ip not in ip_data:
                    ip_data[ip] = {'stage_idx': sidx, 'count': 1, 'country': country}
                else:
                    ip_data[ip]['count'] += 1
                    if sidx > ip_data[ip]['stage_idx']:
                        ip_data[ip]['stage_idx'] = sidx
    except FileNotFoundError:
        pass

    # SSH brute force — journalctl 15 min (port <SSH-PORT>, invisible à nginx)
    _ssh_brute_re = re.compile(r'(?:Failed password|Invalid user).*from (\d{1,3}(?:\.\d{1,3}){3})')
    try:
        res = subprocess.run(
            ['journalctl', '-u', 'ssh', '--since', '15 minutes ago', '--no-pager', '-q'],
            capture_output=True, text=True, timeout=5)
        for line in res.stdout.split('\n'):
            bm = _ssh_brute_re.search(line)
            if not bm:
                continue
            ip   = bm.group(1)
            sidx = STAGE_IDX['BRUTE']
            if ip not in ip_data:
                ip_data[ip] = {'stage_idx': sidx, 'count': 1, 'country': '-'}
            else:
                ip_data[ip]['count'] += 1
                if sidx > ip_data[ip]['stage_idx']:
                    ip_data[ip]['stage_idx'] = sidx
    except Exception:
        pass

    stage_counts = {s: 0 for s in STAGE_ORDER}
    for v in ip_data.values():
        stage_counts[STAGE_ORDER[v['stage_idx']]] += 1
    top = sorted(ip_data.items(), key=lambda x: -x[1]['count'])[:10]
    active_ips = [
        {'ip': ip, 'stage': STAGE_ORDER[v['stage_idx']], 'count': v['count'], 'country': v['country']}
        for ip, v in top
    ]
    return {
        'stage_counts':  stage_counts,
        'active_ips':    active_ips,
        'total_active':  len(ip_data),
        'window_minutes': 15,
    }


# Stage par chemin honeypot — utilisé pour enrichir la Kill Chain
HONEYPOT_STAGE = {
    # RECON — collecte d'infos/credentials
    '/.env': 'RECON', '/.env.bak': 'RECON', '/.env.local': 'RECON',
    '/.env.prod': 'RECON', '/.env.dev': 'RECON',
    '/.git/config': 'RECON', '/.git/HEAD': 'RECON', '/.gitignore': 'RECON',
    '/.aws/credentials': 'RECON', '/.ssh/id_rsa': 'RECON', '/.ssh/authorized_keys': 'RECON',
    '/composer.json': 'RECON', '/package.json': 'RECON',
    '/Dockerfile': 'RECON', '/docker-compose.yml': 'RECON',
    # SCAN — énumération services/panels
    '/wp-admin': 'SCAN', '/wp-login.php': 'SCAN', '/wp-config.php': 'SCAN',
    '/wp-content': 'SCAN', '/xmlrpc.php': 'SCAN',
    '/phpmyadmin': 'SCAN', '/pma': 'SCAN', '/adminer': 'SCAN',
    '/mysql': 'SCAN', '/myadmin': 'SCAN',
    '/admin': 'SCAN', '/administrator': 'SCAN', '/backend': 'SCAN',
    '/console': 'SCAN', '/management': 'SCAN', '/cpanel': 'SCAN',
    '/actuator': 'SCAN', '/actuator/env': 'SCAN', '/actuator/health': 'SCAN',
    '/actuator/mappings': 'SCAN', '/actuator/beans': 'SCAN',
    '/solr/': 'SCAN', '/elasticsearch/': 'SCAN', '/kibana/': 'SCAN', '/_cat/': 'SCAN',
    '/manager/html': 'SCAN', '/jmx-console': 'SCAN', '/web-console': 'SCAN',
    # EXPLOIT — tentatives d'exploitation directe
    '/cgi-bin/': 'EXPLOIT', '/boaform/': 'EXPLOIT', '/setup.cgi': 'EXPLOIT', '/shell': 'EXPLOIT',
    '/.htpasswd': 'EXPLOIT', '/.htaccess': 'EXPLOIT',
    '/etc/passwd': 'EXPLOIT', '/proc/self/environ': 'EXPLOIT',
    '/api/config': 'EXPLOIT', '/api/env': 'EXPLOIT', '/api/v1/config': 'EXPLOIT',
    '/config.php': 'EXPLOIT', '/web.config': 'EXPLOIT',
    '/config.yml': 'EXPLOIT', '/config.json': 'EXPLOIT', '/settings.php': 'EXPLOIT',
    # BRUTE — tentatives d'authentification
    '/login': 'BRUTE', '/signin': 'BRUTE', '/auth': 'BRUTE', '/user/login': 'BRUTE',
}

HONEYPOT_PATHS = [
    '/.env', '/.env.bak', '/.env.local', '/.env.prod', '/.env.dev',
    '/.git/config', '/.git/HEAD', '/.gitignore',
    '/wp-admin', '/wp-login.php', '/xmlrpc.php', '/wp-config.php', '/wp-content',
    '/phpmyadmin', '/pma', '/adminer', '/mysql', '/myadmin',
    '/admin', '/administrator', '/backend', '/console', '/management', '/cpanel',
    '/actuator', '/actuator/env', '/actuator/health', '/actuator/mappings', '/actuator/beans',
    '/api/config', '/api/env', '/api/v1/config',
    '/.aws/credentials', '/.ssh/id_rsa', '/.ssh/authorized_keys',
    '/config.php', '/web.config', '/config.yml', '/config.json', '/settings.php',
    '/composer.json', '/package.json', '/Dockerfile', '/docker-compose.yml',
    '/cgi-bin/', '/boaform/', '/setup.cgi', '/shell',
    '/manager/html', '/jmx-console', '/web-console',
    '/.htpasswd', '/.htaccess', '/etc/passwd', '/proc/self/environ',
    '/solr/', '/elasticsearch/', '/kibana/', '/_cat/',
    '/login', '/signin', '/auth', '/user/login',
]

def get_honeypot_hits():
    """Parse 24h de logs nginx — requêtes vers chemins pièges (scanners / attaquants ciblés).
    Retourne aussi ip_stages {ip: {stage, country}} pour enrichissement Kill Chain.
    """
    STAGE_ORDER = ['RECON', 'SCAN', 'EXPLOIT', 'BRUTE']
    STAGE_IDX   = {s: i for i, s in enumerate(STAGE_ORDER)}
    cutoff      = datetime.now(timezone.utc) - timedelta(hours=24)
    path_counts = defaultdict(lambda: {'count': 0, 'ips': set()})
    total_ips   = set()
    ip_stages   = {}  # ip -> {stage_idx, country}

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
                if _LAN_RE.match(ip):
                    continue
                for trap in HONEYPOT_PATHS:
                    if path == trap or path.startswith(trap):
                        path_counts[trap]['count'] += 1
                        path_counts[trap]['ips'].add(ip)
                        total_ips.add(ip)
                        # Stage pour Kill Chain
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
# SYSTÈME D'ALERTES SOC
# ══════════════════════════════════════════════════════════
def _load_alert_conf():
    if not os.path.exists(ALERT_CONF):
        return None
    cfg = configparser.ConfigParser()
    cfg.read(ALERT_CONF)
    return cfg['smtp'] if 'smtp' in cfg else None

def _load_alert_state():
    try:
        with open(ALERT_STATE) as f:
            return json.load(f)
    except Exception:
        return {}

def _save_alert_state(state):
    try:
        with open(ALERT_STATE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass

def _count_autoban_recidives(ip):
    """Retourne le nombre de bans antérieurs pour cette IP dans autoban-log.json."""
    try:
        with open(AUTOBAN_LOG) as f:
            log = json.load(f)
        return sum(1 for e in log if e.get('ip') == ip)
    except Exception:
        return 0

def _append_autoban_log(entries):
    """Persiste les auto-bans dans autoban-log.json (100 entrées max)."""
    try:
        try:
            with open(AUTOBAN_LOG) as f:
                log = json.load(f)
        except Exception:
            log = []
        now_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        for e in entries:
            log.append({
                'ts':       now_str,
                'ip':       e.get('ip', '?'),
                'country':  e.get('country', '-'),
                'stage':    e.get('stage', '?'),
                'duration': e.get('duration', '24h'),
                'rule':     e.get('rule', '?'),
            })
        log = log[-100:]  # garder les 100 derniers
        with open(AUTOBAN_LOG, 'w') as f:
            json.dump(log, f, indent=2)
    except Exception as ex:
        print(f'[AUTO-BAN] Erreur écriture log: {ex}')

def _get_autoban_log():
    """Lit autoban-log.json, retourne les 20 dernières entrées (plus récent en premier)."""
    try:
        with open(AUTOBAN_LOG) as f:
            log = json.load(f)
        return list(reversed(log[-20:]))
    except Exception:
        return []

def _should_send(state, key):
    # Clés SSL dynamiques (SSL_<domain>) → fallback 24h comme les autres alertes SSL
    cooldown = ALERT_COOLDOWNS.get(key, 86400)
    last = state.get(key)
    if not last:
        return True
    try:
        last_dt = datetime.fromisoformat(last.replace('Z', '+00:00'))
        return (datetime.now(timezone.utc) - last_dt).total_seconds() > cooldown
    except Exception:
        return True

def _send_mail(cfg, subject, body, severity='INFO'):
    try:
        icons = {'CRITICAL': '🔴', 'WARN': '🟡', 'INFO': '🔵'}
        icon  = icons.get(severity, '🔵')
        msg   = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = f"{icon} [SOC {severity}] {subject}"
        msg['From']    = f"SOC 0xCyberLiTech <{cfg['login']}>"
        recipients     = [a.strip() for a in cfg['to'].split(',') if a.strip()]
        msg['To']      = ', '.join(recipients)
        with smtplib.SMTP(cfg['host'], int(cfg['port']), timeout=15) as s:
            s.ehlo()
            s.starttls()
            s.ehlo()
            s.login(cfg['login'], cfg['password'])
            s.sendmail(cfg['login'], recipients, msg.as_string())
        print(f'[ALERT] Mail envoyé : {subject}')
        return True
    except Exception as e:
        print(f'[ALERT] Erreur mail : {e}')
        return False


# ── NDT-10 : check_and_send_alerts helpers ───────────────────────────────────

def _alert_build_ban_candidates(kc, data, already_banned):
    """Build the dict of IPs to ban from kill_chain + honeypot rules."""
    f2b_banned_set = {
        ip['ip'] if isinstance(ip, dict) else ip
        for j in data.get('fail2ban', {}).get('jails', [])
        for ip in j.get('banned_ips', [])
    }
    to_ban = {}
    # Règle 1 : EXPLOIT non bloqué CS
    for e in kc.get('active_ips', []):
        if e.get('stage') == 'EXPLOIT' and not e.get('cs_decision'):
            ip = e['ip']
            if ip not in to_ban:
                to_ban[ip] = dict(e, rule='EXPLOIT non bloqué CS')
    # Règle 2 : Haute fréquence (≥ seuil hits / 15 min)
    for e in kc.get('active_ips', []):
        ip = e['ip']
        if e.get('count', 0) >= AUTOBAN_HIT_THRESHOLD and ip not in already_banned and ip not in to_ban:
            to_ban[ip] = dict(e, rule='haute frequence >=' + str(AUTOBAN_HIT_THRESHOLD) + ' hits/15min')
    # Règle 3 : Honeypot — 1 hit = ban immédiat
    for ip, info in data.get('honeypot', {}).get('ip_stages', {}).items():
        if ip not in already_banned and ip not in to_ban and not _LAN_RE.match(ip):
            to_ban[ip] = {'ip': ip, 'country': info.get('country', '-'),
                          'stage': info.get('stage', 'SCAN'), 'rule': 'honeypot 1-hit'}
    # Règle 4 : BRUTE non bloqué (HTTP — hors fail2ban SSH)
    for e in kc.get('active_ips', []):
        ip = e['ip']
        if e.get('stage') == 'BRUTE' and not e.get('cs_decision') and ip not in f2b_banned_set and ip not in to_ban:
            to_ban[ip] = dict(e, rule='BRUTE non bloque CS/f2b')
    return to_ban


def _alert_exec_bans(to_ban, cfg, state, now_str):
    """Execute cscli bans, append to log, send consolidated mail."""
    auto_banned = []
    for ip_addr, ip_entry in to_ban.items():
        try:
            recidives = _count_autoban_recidives(ip_addr)
            if recidives >= AUTOBAN_RECIDIVE_SEUIL:
                duration = '8760h'
                rule     = ip_entry['rule'] + f'  RECIDIVISTE ({recidives} bans anterieurs)'
            else:
                _r = ip_entry.get('rule', '')
                if 'EXPLOIT' in _r:
                    duration = AUTOBAN_DUR_EXPLOIT
                elif 'HONEYPOT' in _r:
                    duration = AUTOBAN_DUR_HONEYPOT
                elif 'BRUTE' in _r:
                    duration = AUTOBAN_DUR_BRUTE
                else:
                    duration = AUTOBAN_DUR_HIGHFREQ
                rule = ip_entry['rule']
            subprocess.run(
                ['cscli', 'decisions', 'add', '--ip', ip_addr,
                 '--duration', duration, '--reason', 'auto-ban SOC ' + rule],
                capture_output=True, timeout=10, check=True
            )
            ip_entry = dict(ip_entry, rule=rule, duration=duration)
            auto_banned.append(ip_entry)
            print(f'[AUTO-BAN] {ip_addr} — regle: {rule} — durée: {duration}')
        except Exception as e:
            print(f'[AUTO-BAN] Erreur ban {ip_addr}: {e}')
    if auto_banned:
        _append_autoban_log(auto_banned)
        if _should_send(state, 'AUTOBAN'):
            lines = '\n'.join(
                f"  {e['ip']:<18} [{e.get('country','-'):<3}]  {e.get('stage','?'):<7}  {e.get('duration','24h'):<6}  ({e.get('rule','?')})"
                for e in auto_banned
            )
            body = (
                f"Auto-ban SOC — {len(auto_banned)} IP(s) bannies automatiquement.\n\n"
                f"{lines}\n\n"
                f"Fenêtre d'analyse : 15 min\n"
                f"Récidive ≥{AUTOBAN_RECIDIVE_SEUIL} bans → durée 8760h (1 an)\n\n"
                f"Dashboard : {DASHBOARD_URL}\n"
            )
            if _send_mail(cfg, f"Auto-ban SOC — {len(auto_banned)} IP(s) ejectee(s)", body, 'CRITICAL'):
                state['AUTOBAN'] = now_str


def _alert_f2b(f2b, cfg, state, now_str):
    """Fire alert if fail2ban ban count has increased since last cycle."""
    cur_f2b  = f2b.get('total_banned', 0)
    last_f2b = state.get('F2B_BAN_LAST_COUNT', 0)
    state['F2B_BAN_LAST_COUNT'] = cur_f2b
    if cur_f2b > last_f2b and _should_send(state, 'F2B_BAN'):
        new_bans = cur_f2b - last_f2b
        lines = [
            f"  {j['jail']} : {j['cur_banned']} IP(s) — "
            + ', '.join(
                (ip['ip'] + ' (' + ip['country'] + ')') if isinstance(ip, dict) else ip
                for ip in j.get('banned_ips', [])
            )
            for j in f2b.get('jails', []) if j.get('cur_banned', 0) > 0
        ]
        body = (
            f"Fail2ban — {new_bans} nouveau(x) ban(s) (total actif : {cur_f2b}).\n\n"
            + '\n'.join(lines) + f"\n\nDashboard : {DASHBOARD_URL}\n"
        )
        if _send_mail(cfg, f"Fail2ban — {new_bans} nouveau(x) ban(s)", body, 'WARN'):
            state['F2B_BAN'] = now_str


def _alert_services(svcs, cfg, state, now_str):
    """Fire alert if any monitored service is DOWN."""
    down = [s['name'] for s in svcs if not s.get('active', True)]
    if down and _should_send(state, 'SERVICE_DN'):
        body = (
            f"Service(s) inactif(s) détecté(s) :\n\n"
            + '\n'.join(f"  ✗ {s}" for s in down)
            + f"\n\nDashboard : {DASHBOARD_URL}\n"
        )
        if _send_mail(cfg, f"Service DOWN — {', '.join(down)}", body, 'CRITICAL'):
            state['SERVICE_DN'] = now_str


def _alert_ssl(ssl_l, cfg, state, now_str):
    """Fire alert for each SSL certificate expiring within 30 days."""
    for cert in ssl_l:
        key = f"SSL_{cert.get('domain','')}"
        if cert.get('days_left', 999) < 30 and _should_send(state, key):
            body = (
                f"Certificat SSL proche de l'expiration :\n\n"
                f"  Domaine     : {cert.get('domain')}\n"
                f"  Expire dans : {cert.get('days_left')} jours\n"
                f"  Expiration  : {cert.get('expiry')}\n"
            )
            if _send_mail(cfg, f"SSL — {cert.get('domain')} expire dans {cert.get('days_left')}j", body, 'WARN'):
                state[key] = now_str


def _alert_5xx(t, cfg, state, now_str):
    """Fire alert if 5xx error count exceeds threshold."""
    if t.get('status_5xx', 0) > 10 and _should_send(state, '5XX_ERROR'):
        body = (
            f"Erreurs serveur 5xx détectées : {t['status_5xx']} en 24h.\n\n"
            f"Dashboard : {DASHBOARD_URL}\n"
        )
        if _send_mail(cfg, f"Erreurs 5xx — {t['status_5xx']} détectées", body, 'WARN'):
            state['5XX_ERROR'] = now_str


def check_and_send_alerts(data):
    cfg = _load_alert_conf()
    if not cfg:
        return
    state   = _load_alert_state()
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    kc      = data.get('kill_chain', {})
    f2b     = data.get('fail2ban', {})
    svcs_raw = data.get('services', {})
    svcs = ([{'name': k, 'active': v.get('status') == 'UP'} for k, v in svcs_raw.items()]
            if isinstance(svcs_raw, dict) else svcs_raw)
    cs = data.get('crowdsec', {})
    cs_banned_set  = set(cs.get('decisions_detail', {}).keys())
    f2b_banned_set = {
        ip['ip'] if isinstance(ip, dict) else ip
        for j in f2b.get('jails', []) for ip in j.get('banned_ips', [])
    }
    already_banned = cs_banned_set | f2b_banned_set
    to_ban = _alert_build_ban_candidates(kc, data, already_banned)
    _alert_exec_bans(to_ban, cfg, state, now_str)
    _alert_f2b(f2b, cfg, state, now_str)
    _alert_services(svcs, cfg, state, now_str)
    _alert_ssl(data.get('ssl', []), cfg, state, now_str)
    _alert_5xx(data.get('traffic', {}), cfg, state, now_str)
    _save_alert_state(state)


# Correspondance scénario CrowdSec → stage Kill Chain (suffixe après '/')
CS_SCENARIO_STAGE = {
    'http-crawl-non_statics':       'RECON',
    'http-probing':                 'RECON',
    'http-sensitive-files':         'RECON',
    'http-bad-user-agent':          'RECON',
    'http-path-traversal-probing':  'SCAN',
    'http-scan-uniques-404':        'SCAN',
    'http-wordpress-scan':          'SCAN',
    'http-xss-probing':             'EXPLOIT',
    'http-sqli-probing':            'EXPLOIT',
    'http-bf-wordpress':            'BRUTE',
    'http-bf':                      'BRUTE',
    'http-generic-bf':              'BRUTE',
    'ssh-bf':                       'BRUTE',
    'ssh-slow-bf':                  'BRUTE',
}

_CS_BOUNCER_HEALTHY_SEC = 600  # bouncer considéré healthy si last_pull < 600s


def _cs_resolve_stage(short):
    """Résout le stage Kill Chain d'un scénario CrowdSec via table puis fallback lexical."""
    stage = CS_SCENARIO_STAGE.get(short)
    if stage is not None:
        return stage
    sl = short.lower()
    if any(k in sl for k in ('bf', 'brute')):         return 'BRUTE'
    if any(k in sl for k in ('scan', 'probing', 'traversal')): return 'SCAN'
    if any(k in sl for k in ('xss', 'sqli', 'exploit', 'cve', 'rce', 'lfi')): return 'EXPLOIT'
    return 'RECON'


def _cs_get_decisions(result):
    """Décisions actives → result['active_decisions'], ['top_ips'], ['decisions_detail']."""
    try:
        raw = subprocess.check_output(
            ['cscli', 'decisions', 'list', '-o', 'json'],
            stderr=subprocess.DEVNULL, timeout=10
        ).decode()
        decisions = json.loads(raw) or []
        ip_meta = {}
        dec_rows = []
        for alert in decisions:
            src        = alert.get('source', {}) or {}
            country    = src.get('cn', '-') or '-'
            as_name    = src.get('as_name', '') or ''
            as_num     = str(src.get('as_number', '') or '')
            alert_id   = alert.get('id', '')
            events_cnt = alert.get('events_count', 1)
            for dec in (alert.get('decisions') or []):
                ip       = dec.get('value', '')
                scenario = dec.get('scenario', '') or alert.get('scenario', '') or ''
                short    = scenario.split('/')[-1] if '/' in scenario else scenario
                duration = dec.get('duration', '')
                origin   = dec.get('origin', 'crowdsec')
                dec_id   = dec.get('id', '')
                if not ip:
                    continue
                if ip not in ip_meta:
                    ip_meta[ip] = {
                        'count': 0, 'country': country, 'as_name': as_name[:30],
                        'scenario': short, 'stage': _cs_resolve_stage(short), 'duration': duration,
                    }
                ip_meta[ip]['count'] += 1
                result['decisions_detail'][ip] = {'scenario': short, 'stage': _cs_resolve_stage(short)}
                dec_rows.append({
                    'id':       dec_id,
                    'alert_id': alert_id,
                    'origin':   origin,
                    'ip':       ip,
                    'scenario': short,
                    'stage':    _cs_resolve_stage(short),
                    'country':  country,
                    'as_name':  as_name[:35],
                    'as_num':   as_num,
                    'events':   events_cnt,
                    'duration': duration,
                })
        result['active_decisions'] = len(ip_meta)
        result['decisions_list'] = sorted(dec_rows, key=lambda x: -(x['id'] or 0))
        result['top_ips'] = [
            {'ip': ip, 'count': m['count'], 'country': m['country'],
             'as_name': m['as_name'], 'scenario': m['scenario'],
             'stage': m['stage'], 'duration': m['duration']}
            for ip, m in sorted(ip_meta.items(), key=lambda x: -x[1]['count'])[:8]
        ]
    except Exception:
        pass


def _cs_get_alerts(result):
    """Alertes 24h → result['alerts_24h'], ['scenarios'], ['stage_counts']."""
    try:
        raw = subprocess.check_output(
            ['cscli', 'alerts', 'list', '--since', '24h', '-o', 'json'],
            stderr=subprocess.DEVNULL, timeout=10
        ).decode()
        alerts  = json.loads(raw) or []
        result['alerts_24h'] = len(alerts)
        sc_cnt, sc_stage = defaultdict(int), {}
        for alert in alerts:
            scenario = alert.get('scenario', '') or ''
            short    = scenario.split('/')[-1] if '/' in scenario else scenario
            if short.startswith('auto-ban SOC') or short.startswith('auto-ban soc'):
                continue
            sc_cnt[short] += 1
            stage = _cs_resolve_stage(short)
            sc_stage[short] = stage
            result['stage_counts'][stage] = result['stage_counts'].get(stage, 0) + 1
        result['scenarios'] = [
            {'name': n, 'count': c, 'stage': sc_stage.get(n, 'RECON')}
            for n, c in sorted(sc_cnt.items(), key=lambda x: -x[1])[:8]
        ]
    except Exception:
        pass


def _cs_get_parser_stats(result):
    """Stats parser CrowdSec via Prometheus (port 6061) → result['parser_stats']."""
    try:
        prom = subprocess.check_output(
            ['curl', '-s', 'http://127.0.0.1:6061/metrics'],
            stderr=subprocess.DEVNULL, timeout=3
        ).decode()
        lines_read, lines_parsed = 0, 0
        for line in prom.splitlines():
            if line.startswith('cs_reader_hits_total{') and 'type="file"' in line:
                lines_read += int(float(line.split()[-1]))
            if line.startswith('cs_parser_hits_ok_total{') or line.startswith('cs_parser_hits_ok_total '):
                lines_parsed += int(float(line.split()[-1]))
        if lines_read == 0 and lines_parsed > 0:
            lines_read = lines_parsed  # fallback si cs_reader_hits_total absent
        result['parser_stats'] = {'lines_read': lines_read, 'lines_parsed': lines_parsed}
    except Exception:
        result['parser_stats'] = {}


def _cs_get_bouncers(result):
    """Bouncer health → result['bouncers']."""
    try:
        raw = subprocess.check_output(
            ['cscli', 'bouncers', 'list', '-o', 'json'],
            stderr=subprocess.DEVNULL, timeout=5
        ).decode()
        bouncers_raw = json.loads(raw) or []
        _now = datetime.now(timezone.utc)
        bouncer_list = []
        for b in bouncers_raw:
            lp = b.get('last_pull')
            age_sec, healthy = None, False
            if lp:
                try:
                    lp_dt   = datetime.fromisoformat(lp.replace('Z', '+00:00'))
                    age_sec = int((_now - lp_dt).total_seconds())
                    healthy = age_sec < _CS_BOUNCER_HEALTHY_SEC
                except Exception:
                    pass
            bouncer_list.append({'name': b.get('name', ''), 'healthy': healthy, 'age_sec': age_sec})
        result['bouncers'] = bouncer_list
    except Exception:
        result['bouncers'] = []


def _cs_get_ban_velocity(result):
    """Ban velocity 1h vs moyenne 48h → result['ban_velocity']."""
    try:
        r1   = subprocess.check_output(['cscli', 'decisions', 'list', '--since',  '1h', '-o', 'json'], stderr=subprocess.DEVNULL, timeout=10).decode()
        r48  = subprocess.check_output(['cscli', 'decisions', 'list', '--since', '48h', '-o', 'json'], stderr=subprocess.DEVNULL, timeout=10).decode()
        bans_1h, bans_48h = len(json.loads(r1) or []), len(json.loads(r48) or [])
        avg_h = round(bans_48h / 48, 1)
        result['ban_velocity'] = {
            'last_1h': bans_1h, 'avg_per_h': avg_h,
            'spike': bans_1h > max(avg_h * 2, 1) and bans_1h > 3,
        }
    except Exception:
        result['ban_velocity'] = {}


def _cs_get_alerts_trend(result):
    """Tendance alertes 24h vs J-1 → result['alerts_trend']."""
    try:
        r48a     = subprocess.check_output(['cscli', 'alerts', 'list', '--since', '48h', '-o', 'json'], stderr=subprocess.DEVNULL, timeout=10).decode()
        total_48 = len(json.loads(r48a) or [])
        prev_24h = max(0, total_48 - result['alerts_24h'])
        pct = round((result['alerts_24h'] - prev_24h) / prev_24h * 100) if prev_24h > 0 else (100 if result['alerts_24h'] > 0 else 0)
        result['alerts_trend'] = {
            'prev_24h': prev_24h, 'pct': pct,
            'dir': 'up' if pct > 10 else 'down' if pct < -10 else 'stable',
        }
    except Exception:
        result['alerts_trend'] = {}


def _cs_get_appsec(result):
    """AppSec + bytes bloqués (cscli metrics) → result['appsec'], ['bouncer_stats']."""
    try:
        raw_m = subprocess.check_output(['cscli', 'metrics', '-o', 'json'], stderr=subprocess.DEVNULL, timeout=5).decode()
        m = json.loads(raw_m)
        appsec_eng = m.get('appsec-engine', {})
        ap_proc    = sum(v.get('processed', 0) for v in appsec_eng.values())
        ap_block   = sum(v.get('blocked',   0) for v in appsec_eng.values())
        result['appsec'] = {'processed': ap_proc, 'blocked': ap_block, 'active': ap_proc > 0}
        dropped_b = dropped_p = 0
        for _bname, bdata in m.get('bouncers', {}).items():
            for _src, sdata in bdata.items():
                d = sdata.get('dropped', {})
                dropped_b += d.get('byte',   0)
                dropped_p += d.get('packet', 0)
        result['bouncer_stats'] = {'dropped_bytes': dropped_b, 'dropped_packets': dropped_p}
    except Exception:
        result['appsec']       = {'processed': 0, 'blocked': 0, 'active': False}
        result['bouncer_stats'] = {}


def get_crowdsec_stats():
    """CrowdSec : décisions, alertes, scénarios, bouncers, velocity, AppSec."""
    result = {
        'available':        False,
        'active_decisions': 0,
        'alerts_24h':       0,
        'stage_counts':     {'RECON': 0, 'SCAN': 0, 'EXPLOIT': 0, 'BRUTE': 0},
        'scenarios':        [],
        'top_ips':          [],
        'decisions_detail': {},
        'decisions_list':   [],
    }
    try:
        subprocess.run(['cscli', 'version'], capture_output=True, timeout=3, check=True)
    except Exception:
        return result
    result['available'] = True

    _cs_get_decisions(result)
    _cs_get_alerts(result)
    _cs_get_parser_stats(result)
    _cs_get_bouncers(result)
    _cs_get_ban_velocity(result)
    _cs_get_alerts_trend(result)
    _cs_get_appsec(result)
    return result


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
    """Retourne le statut des crons srv-ngix basé sur la date de modification des fichiers log."""
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
    tot_banned = sum(1 for v in ban_net.values() if v >= 0 and sum(1 for x in [v] if x > 0) > 0)
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
        _host_map = {IP_CLT: 'clt', IP_PA85: 'pa85'}
        local_host = _host_map.get(host, hostname)
        return get_local_fail2ban(local_host, label)


def get_updates():
    """Vérifie les mises à jour disponibles sur srv-ngix, proxmox, clt, pa85 via SSH."""
    machines_cfg = [
        {'name': 'srv-ngix', 'ip': IP_SRV_NGIX, 'role': 'Reverse Proxy', 'local': True,  'ssh_key': None},
        {'name': 'proxmox',  'ip': IP_PROXMOX,   'role': 'Hyperviseur',   'local': False, 'ssh_key': SSH_KEY_PVE},
        {'name': 'clt',      'ip': IP_CLT,       'role': 'Backend CLT',   'local': False, 'ssh_key': SSH_KEY_CLT},
        {'name': 'pa85',     'ip': IP_PA85,      'role': 'Backend PA85',  'local': False, 'ssh_key': SSH_KEY_PA85},
    ]

    def parse_apt(output):
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

    def run_apt(m):
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
        out = run_apt(m)
        if out is not None:
            pkgs = parse_apt(out)
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

_SURICATA_EVE_PATH     = '/var/log/suricata/eve.json'
_SURICATA_LAN_PREFIXES = ('192.168.', '10.', '172.16.', '172.17.', '127.')


def _suricata_rules_loaded():
    """Return number of rules successfully loaded from suricata.log (0 on error)."""
    try:
        out = subprocess.check_output(
            ['grep', '-a', 'rules successfully loaded', '/var/log/suricata/suricata.log'],
            stderr=subprocess.DEVNULL
        ).decode(errors='replace')
        for line in reversed(out.strip().splitlines()):
            m = re.search(r'(\d+)\s+rules successfully loaded', line)
            if m:
                return int(m.group(1))
    except Exception:
        pass
    return 0


def _suricata_thread_stats():
    """Appelle suricatasc dump-counters — retourne stats par worker thread + global."""
    try:
        import subprocess
        r = subprocess.run(['suricatasc', '-c', 'dump-counters'],
                          capture_output=True, text=True, timeout=4)
        if r.returncode != 0:
            return None
        d = json.loads(r.stdout)
        m = d.get('message', {})
        cap = m.get('capture', {})
        afp = cap.get('afpacket', {})
        threads = m.get('threads', {})
        workers = sorted([(k, v) for k, v in threads.items() if k.startswith('W#')])
        thread_list = []
        for wname, wdata in workers:
            wcap = wdata.get('capture', {})
            wdec = wdata.get('decoder', {})
            trunc = wdec.get('event', {}).get('afpacket', {}).get('trunc_pkt', 0)
            det  = wdata.get('detect', {})
            flow = wdata.get('flow', {})
            tcp  = wdata.get('tcp', {})
            thread_list.append({
                'name':    wname,
                'pkts':    wcap.get('kernel_packets', 0),
                'drops':   wcap.get('kernel_drops', 0),
                'trunc':   trunc,
                'bytes':   wdec.get('bytes', 0),
                'avg_pkt': wdec.get('avg_pkt_size', 0),
                'ipv4':    wdec.get('ipv4', 0),
                'tcp_pkts':wdec.get('tcp', 0),
                'udp_pkts':wdec.get('udp', 0),
                'alerts_detect':    det.get('alert', 0),
                'alerts_suppressed':det.get('alerts_suppressed', 0),
                'queue_overflow':   det.get('alert_queue_overflow', 0),
                'flows_active': flow.get('active', 0),
                'flows_tcp':    flow.get('tcp', 0),
                'flows_udp':    flow.get('udp', 0),
                'flows_total':  flow.get('total', 0),
                'tcp_rst':      tcp.get('rst', 0),
                'tcp_sessions': tcp.get('sessions', 0),
            })
        total_trunc_live = sum(w['trunc'] for w in thread_list)
        def _sum(key): return sum(w.get(key, 0) for w in thread_list)
        nic = {}
        try:
            with open('/proc/net/dev') as f:
                for line in f:
                    line = line.strip()
                    if ':' not in line:
                        continue
                    iface, data = line.split(':', 1)
                    if iface.strip() == 'ens18':
                        cols = data.split()
                        nic = {
                            'rx_bytes':  int(cols[0]),
                            'rx_pkts':   int(cols[1]),
                            'rx_errors': int(cols[2]),
                            'rx_drop':   int(cols[3]),
                            'tx_bytes':  int(cols[8]),
                            'tx_pkts':   int(cols[9]),
                            'tx_errors': int(cols[10]),
                        }
                        break
        except Exception:
            pass
        return {
            'global_pkts':       cap.get('kernel_packets', 0),
            'global_drops':      cap.get('kernel_drops', 0),
            'polls':             afp.get('polls', 0),
            'worker_count':      len(thread_list),
            'workers':           thread_list,
            'total_trunc_live':  total_trunc_live,
            'nic':               nic,
            'decoder': {
                'pkts':    _sum('pkts'),
                'bytes':   _sum('bytes'),
                'ipv4':    _sum('ipv4'),
                'tcp':     _sum('tcp_pkts'),
                'udp':     _sum('udp_pkts'),
                'avg_pkt': int(sum(w['avg_pkt'] for w in thread_list) / max(len(thread_list), 1)),
            },
            'detect': {
                'alerts':     _sum('alerts_detect'),
                'suppressed': _sum('alerts_suppressed'),
                'overflow':   _sum('queue_overflow'),
            },
            'flows': {
                'active': _sum('flows_active'),
                'tcp':    _sum('flows_tcp'),
                'udp':    _sum('flows_udp'),
                'total':  _sum('flows_total'),
                'rst':    _sum('tcp_rst'),
                'sessions': _sum('tcp_sessions'),
            },
        }
    except Exception:
        return None


def get_suricata_stats():
    """Lit /var/log/suricata/eve.json — alertes 24h, top IPs, top signatures, sévérités."""
    if not os.path.exists(_SURICATA_EVE_PATH):
        return {'available': False}
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        alerts = []
        dns_count = http_count = tls_count = ssh_count = flow_count = truncated_count = 0
        with open(_SURICATA_EVE_PATH, 'r', errors='replace') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                # Parse timestamp
                ts_str = e.get('timestamp', '')
                try:
                    ts = datetime.fromisoformat(ts_str[:26]).replace(tzinfo=timezone.utc)
                    if ts < cutoff:
                        continue
                except Exception:
                    pass
                et = e.get('event_type', '')
                if et == 'dns':    dns_count  += 1
                elif et == 'http': http_count += 1
                elif et == 'tls':  tls_count  += 1
                elif et == 'ssh':  ssh_count  += 1
                elif et == 'flow': flow_count += 1
                elif et == 'alert':
                    al = e.get('alert', {})
                    sig = al.get('signature', '')
                    # Compter événements internes moteur Suricata (truncated packets, etc.)
                    if sig.startswith('SURICATA '):
                        truncated_count += 1
                        continue
                    src_ip = e.get('src_ip') or e.get('dest_ip', '')
                    # Filtrer IPs internes Suricata (None, loopback)
                    if not src_ip or src_ip.startswith('127.') or src_ip == '::1':
                        src_ip = e.get('dest_ip', '')
                    alerts.append({
                        'ts':        ts_str[:19],
                        'src_ip':    src_ip or '?',
                        'severity':  al.get('severity', 3),
                        'category':  al.get('category', ''),
                        'signature': sig[:80],
                        'proto':     e.get('proto', ''),
                        'dest_port': e.get('dest_port', ''),
                    })

        # Stats par sévérité
        sev1 = [a for a in alerts if a['severity'] == 1]
        sev2 = [a for a in alerts if a['severity'] == 2]
        sev3 = [a for a in alerts if a['severity'] == 3]

        # Top IPs attaquantes (sévérité 1+2 seulement — IPs LAN exclues)
        ip_counts = defaultdict(int)
        for a in alerts:
            ip = a['src_ip']
            if not ip or ip == '?':
                continue
            if any(ip.startswith(p) for p in _SURICATA_LAN_PREFIXES):
                continue  # filtrer srv-ngix lui-même et IPs LAN
            if a['severity'] <= 2:
                ip_counts[ip] += 1
        top_ips = sorted(ip_counts.items(), key=lambda x: -x[1])[:8]

        # Top signatures
        sig_counts = defaultdict(int)
        for a in alerts:
            if a['signature']:
                sig_counts[a['signature']] += 1
        top_sigs = sorted(sig_counts.items(), key=lambda x: -x[1])[:8]

        # Alertes critiques récentes (sév 1) pour le modal
        recent_critical = sorted(sev1, key=lambda x: x['ts'], reverse=True)[:10]

        # Port scans confirmés (sév 3) — agrégés par IP source, ≥3 hits
        sev3_ip_counts: dict = defaultdict(int)
        for _a in sev3:
            _ip = _a['src_ip']
            if _ip and _ip != '?':
                sev3_ip_counts[_ip] += 1
        recent_scans = sorted(
            [{'src_ip': ip, 'count': c} for ip, c in sev3_ip_counts.items() if c >= 3],
            key=lambda x: -x['count']
        )[:10]

        rules_loaded = _suricata_rules_loaded()
        thread_stats = _suricata_thread_stats()
        # Préférer la valeur live suricatasc (depuis dernier restart) si disponible
        trunc_final = (thread_stats['total_trunc_live']
                       if thread_stats and 'total_trunc_live' in thread_stats
                       else truncated_count)

        return {
            'available':       True,
            'total_alerts':    len(alerts),
            'sev1_critical':   len(sev1),
            'sev2_high':       len(sev2),
            'sev3_medium':     len(sev3),
            'top_ips':         [{'ip': ip, 'count': c} for ip, c in top_ips],
            'top_signatures':  [{'sig': s, 'count': c} for s, c in top_sigs],
            'recent_critical': recent_critical,
            'recent_scans':    recent_scans,
            'truncated_24h':   trunc_final,
            'events':          {'dns': dns_count, 'http': http_count, 'tls': tls_count,
                                'ssh': ssh_count, 'flow': flow_count},
            'rules_loaded':    rules_loaded,
            'thread_stats':    thread_stats,
        }
    except Exception as ex:
        return {'available': False, 'error': str(ex)[:80]}


# ── NDT-06 : main() helpers ──────────────────────────────────────────────────

_KC_STAGE_ORDER = ['RECON', 'SCAN', 'EXPLOIT', 'BRUTE']
_KC_STAGE_IDX   = {s: i for i, s in enumerate(_KC_STAGE_ORDER)}


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
    f2b['proxmox'] = get_proxmox_fail2ban()
    f2b['clt']     = get_remote_fail2ban(IP_CLT,  SSH_PORT, SSH_KEY_CLT,  'CLT')
    f2b['pa85']    = get_remote_fail2ban(IP_PA85, SSH_PORT, SSH_KEY_PA85, 'PA85')
    return traffic, f2b


def get_xdr_events():
    """Collecte evenements XDR unifies depuis fail2ban, UFW, AppArmor, ModSec (CLT/PA85).
    Retourne liste [{ts, ip, src, type, detail, sev}] triee desc, max 150 evenements."""
    events = []
    now = datetime.now(timezone.utc)

    # ── fail2ban.log ──────────────────────────────────────────────────────────
    try:
        with open('/var/log/fail2ban.log', 'r', errors='replace') as f:
            f.seek(0, 2); pos = f.tell()
            f.seek(max(0, pos - 2_000_000))
            lines = f.read().splitlines()[-400:]
        re_f2b = re.compile(
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+\s+\S+\s+\[\d+\]:\s+\w+\s+\[([^\]]+)\]\s+(Ban|Unban)\s+([\d\.]+)'
        )
        _HIGH_JAILS = {'nginx-cve', 'sshd', 'nginx-http-auth'}
        for line in lines:
            m = re_f2b.search(line)
            if not m:
                continue
            try:
                ts = datetime.strptime(m.group(1), '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
            except Exception:
                continue
            if (now - ts).total_seconds() > 86400:
                continue
            action = m.group(3)
            jail   = m.group(2)
            sev    = 3 if (action == 'Ban' and jail in _HIGH_JAILS) else (2 if action == 'Ban' else 1)
            events.append({
                'ts':     ts.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'ip':     m.group(4),
                'src':    'fail2ban',
                'type':   action,
                'detail': jail,
                'sev':    sev,
            })
    except Exception:
        pass

    # ── UFW journal (journalctl -k) ───────────────────────────────────────────
    try:
        r_ufw = subprocess.run(
            ['journalctl', '-k', '--grep=UFW BLOCK', '--since=24 hours ago',
             '--no-pager', '-n', '300', '--output=short-iso'],
            capture_output=True, text=True, timeout=8
        )
        re_ufw_ts  = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})')
        re_ufw_src = re.compile(r'SRC=([\d\.a-fA-F:]+)')
        re_ufw_dpt = re.compile(r'DPT=(\d+)')
        re_ufw_pro = re.compile(r'PROTO=(\w+)')
        re_ufw_in  = re.compile(r'\bIN=(\S*)')
        _RFC1918 = re.compile(r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)')
        for line in r_ufw.stdout.splitlines():
            if 'UFW BLOCK' not in line:
                continue
            m_ts  = re_ufw_ts.match(line)
            m_src = re_ufw_src.search(line)
            if not m_ts or not m_src:
                continue
            src_ip = m_src.group(1)
            if _RFC1918.match(src_ip):
                continue
            m_in = re_ufw_in.search(line)
            if not (m_in and m_in.group(1)):
                continue  # ignorer les blocs sortants (OUT seulement)
            try:
                ts = datetime.fromisoformat(m_ts.group(1)).replace(tzinfo=timezone.utc)
            except Exception:
                continue
            if (now - ts).total_seconds() > 86400:
                continue
            m_dpt = re_ufw_dpt.search(line)
            m_pro = re_ufw_pro.search(line)
            detail = 'BLOCK IN'
            if m_pro:
                detail += f' {m_pro.group(1)}'
            if m_dpt:
                detail += f' :{m_dpt.group(1)}'
            events.append({
                'ts':     ts.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'ip':     src_ip,
                'src':    'ufw',
                'type':   'BLOCK',
                'detail': detail,
                'sev':    2,
            })
    except Exception:
        pass

    # ── AppArmor DENIED (syslog) ──────────────────────────────────────────────
    try:
        cmd_aa = ['grep', '-a', 'apparmor="DENIED"', '/var/log/syslog']
        r_aa = subprocess.run(cmd_aa, capture_output=True, text=True, timeout=8)
        if r_aa.returncode == 0 and r_aa.stdout.strip():
            re_aa_ts  = re.compile(r'^(\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})')
            re_aa_op  = re.compile(r'operation="([^"]+)"')
            re_aa_pro = re.compile(r'profile="([^"]+)"')
            re_aa_nm  = re.compile(r'name="([^"]+)"')
            year = now.year
            for line in r_aa.stdout.splitlines()[-60:]:
                m_ts = re_aa_ts.match(line)
                if not m_ts:
                    continue
                try:
                    ts = datetime.strptime(f'{year} {m_ts.group(1)}', '%Y %b %d %H:%M:%S').replace(tzinfo=timezone.utc)
                except Exception:
                    continue
                if (now - ts).total_seconds() > 86400:
                    continue
                _m_op  = re_aa_op.search(line);  op  = _m_op.group(1)  if _m_op  else '?'
                _m_pro = re_aa_pro.search(line); pro = _m_pro.group(1) if _m_pro else '?'
                _m_nm  = re_aa_nm.search(line);  nm  = _m_nm.group(1)  if _m_nm  else ''
                detail = f'DENIED {op} — {pro}'
                if nm:
                    detail += f' → {nm[:40]}'
                events.append({
                    'ts':     ts.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'ip':     '',
                    'src':    'apparmor',
                    'type':   'DENIED',
                    'detail': detail[:80],
                    'sev':    3,
                })
    except Exception:
        pass

    # ── ModSec CLT (Apache error.log via SSH) ─────────────────────────────────
    for host, label, key in [(IP_CLT, 'clt', _CLT_SSH_KEY),
                              (IP_PA85, 'pa85', _PA85_SSH_KEY)]:
        try:
            cmd_ms = ['ssh', '-i', key, '-p', str(SSH_PORT),
                      '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
                      '-o', 'ConnectTimeout=6', '-o', 'BatchMode=yes',
                      f'root@{host}',
                      'grep -a "ModSecurity" /var/log/apache2/error.log 2>/dev/null | tail -50']
            r_ms = subprocess.run(cmd_ms, capture_output=True, text=True, timeout=12)
            if r_ms.returncode != 0 or not r_ms.stdout.strip():
                continue
            re_ms_ts = re.compile(r'\[(\w{3} \w{3} \d{2} \d{2}:\d{2}:\d{2}\.\d+ \d{4})\]')
            re_ms_ip = re.compile(r'\[client ([\d\.]+)(?::\d+)?\]')
            re_ms_id = re.compile(r'\[id "(\d+)"\]')
            re_ms_ms = re.compile(r'ModSecurity[:\s]+(.+?)(?:\s+\[|$)')
            for line in r_ms.stdout.splitlines():
                if 'ModSecurity' not in line:
                    continue
                m_ts = re_ms_ts.search(line)
                m_ip = re_ms_ip.search(line)
                if not m_ts:
                    continue
                try:
                    ts = datetime.strptime(m_ts.group(1), '%a %b %d %H:%M:%S.%f %Y').replace(tzinfo=timezone.utc)
                except Exception:
                    continue
                if (now - ts).total_seconds() > 86400:
                    continue
                rule_id = re_ms_id.search(line)
                detail = f'WAF {label.upper()}'
                if rule_id:
                    detail += f' rule={rule_id.group(1)}'
                m_msg = re_ms_ms.search(line)
                if m_msg:
                    detail += f' — {m_msg.group(1)[:40]}'
                events.append({
                    'ts':     ts.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'ip':     m_ip.group(1) if m_ip else '',
                    'src':    f'modsec_{label}',
                    'type':   'WAF_BLOCK',
                    'detail': detail[:80],
                    'sev':    2,
                })
        except Exception:
            pass

    # ── nginx DROP 444 (security-php-rce.conf) ───────────────────────────────
    # Parse access.log pour les connexions droppées (status 444) — php-rce snippet
    # Format : IP [date] "METHOD URI PROTO" 444 ...
    _PHP_RCE_RE = re.compile(
        r'allow_url_include|auto_prepend_file|php://(input|filter|fd)'
        r'|/cgi-bin/|/bin/(sh|bash)|%ADd|base64_decode|passthru\(|system\(|assert\(',
        re.IGNORECASE
    )
    _NGINX_LOG_RE = re.compile(
        r'^([\d\.a-fA-F:]+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+HTTP/[^"]+"\s+444\b'
    )
    _NGINX_TS_FMT = '%d/%b/%Y:%H:%M:%S %z'
    try:
        with open('/var/log/nginx/access.log', 'r', errors='replace') as f:
            f.seek(0, 2); pos = f.tell()
            f.seek(max(0, pos - 5_000_000))
            lines = f.read().splitlines()[-500:]
        for line in lines:
            m = _NGINX_LOG_RE.match(line)
            if not m:
                continue
            uri = m.group(4)
            if not _PHP_RCE_RE.search(uri):
                continue
            try:
                ts = datetime.strptime(m.group(2), _NGINX_TS_FMT).astimezone(timezone.utc)
            except Exception:
                continue
            if (now - ts).total_seconds() > 86400:
                continue
            # Catégoriser le vecteur d'attaque
            u = uri.lower()
            if 'allow_url_include' in u or 'auto_prepend_file' in u:
                detail = 'PHP-CGI RCE (CVE-2024-4577)'
            elif 'php://' in u:
                detail = 'PHP RFI php://input'
            elif '/cgi-bin/' in u:
                detail = 'CGI path traversal'
            else:
                detail = 'PHP-RCE pattern'
            detail += f' — {uri[:50]}'
            events.append({
                'ts':     ts.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'ip':     m.group(1),
                'src':    'nginx_drop',
                'type':   'DROP_444',
                'detail': detail[:80],
                'sev':    4,
            })
    except Exception:
        pass

    # ── Apache access logs clt / pa85 — IPs agressives (≥5 erreurs 4xx/5xx) ──
    _ap_re = re.compile(r'apache_access: ([\d.]+) [^ ]+ [^ ]+ \[([^\]]+)\] "[^"]*" (\d{3}) ')
    _ap_rfc = re.compile(r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)')
    _ap_ts_fmt = '%d/%b/%Y:%H:%M:%S %z'
    for host_label, logf in [
        ('CLT',  '/var/log/central/clt/apache_access.log'),
        ('PA85', '/var/log/central/pa85/apache_access.log'),
    ]:
        if not os.path.exists(logf):
            continue
        try:
            _ap_err_cnt = {}
            _ap_lines = []
            with open(logf, 'r', errors='replace') as f:
                _ap_lines = f.read().splitlines()[-2000:]
            for line in _ap_lines:
                m = _ap_re.search(line)
                if not m:
                    continue
                ip = m.group(1)
                if _ap_rfc.match(ip):
                    continue
                status = int(m.group(3))
                if status >= 400:
                    _ap_err_cnt[ip] = _ap_err_cnt.get(ip, 0) + 1
            for ip, cnt in sorted(_ap_err_cnt.items(), key=lambda x: -x[1])[:10]:
                if cnt < 5:
                    continue
                events.append({
                    'ts':     now.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'ip':     ip,
                    'src':    'vmf2b',
                    'type':   'APACHE_ATTACK',
                    'detail': 'Apache '+host_label+' ×'+str(cnt)+' err 4xx/5xx',
                    'sev':    3 if cnt >= 20 else 2,
                })
        except Exception:
            pass

    # ── Tri par ts desc, max 150 ──────────────────────────────────────────────
    events.sort(key=lambda e: e['ts'], reverse=True)
    return events[:150]



# ── AIDE — Intégrité fichiers (Advanced Intrusion Detection Environment) ──────


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


def get_cross_host_correlation():
    """Corrélation IPs cross-hôtes : router kernel.log vs kill_chain nginx."""
    import glob as _glob
    central_dir = '/var/log/central'
    _rfc1918 = re.compile(
        r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|255\.)')

    def _ext(ip):
        return ip and not _rfc1918.match(ip)

    router_src = {}   # ip → count (SRC externe → inbound tentatives WAN)
    router_dst = {}   # ip → count (DST externe → outbound depuis LAN)

    be98_pattern = os.path.join(central_dir, 'GT-BE98*', 'kernel.log')
    for logf in _glob.glob(be98_pattern):
        try:
            with open(logf, 'r', errors='replace') as f:
                for line in f:
                    m_src = re.search(r'\bSRC=([\d.]+)', line)
                    m_dst = re.search(r'\bDST=([\d.]+)', line)
                    if m_src and _ext(m_src.group(1)):
                        ip = m_src.group(1)
                        router_src[ip] = router_src.get(ip, 0) + 1
                    if m_dst and _ext(m_dst.group(1)):
                        ip = m_dst.group(1)
                        router_dst[ip] = router_dst.get(ip, 0) + 1
        except Exception:
            pass

    # fail2ban bans depuis clt et pa85
    f2b_bans = {}  # ip → [hosts]
    _f2b_ban_re = re.compile(r'fail2ban\.actions.*\bBan\b.*?([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})')
    for host, logf in [
        ('clt',  '/var/log/central/clt/fail2ban.actions.log'),
        ('pa85', '/var/log/central/pa85/fail2ban.actions.log'),
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

    # Apache access logs depuis clt et pa85 (via rsyslog local7.info)
    apache_hits = {}  # ip → {'total': n, 'errors': n, 'hosts': []}
    _apache_re = re.compile(r'apache_access: ([\d.]+) [^ ]+ [^ ]+ \[[^\]]+\] "[^"]*" (\d{3}) ')
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
                    if _rfc1918.match(ip):
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

    # IPs ayant frappé clt ET pa85 sous le seuil fail2ban — recon multi-cibles
    multi_apache = {
        ip: info for ip, info in apache_hits.items()
        if len(info['hosts']) >= 2 and ip not in f2b_bans
    }
    return {
        'router_src':    router_src,
        'router_dst':    router_dst,
        'total_src':     len(router_src),
        'total_dst':     len(router_dst),
        'f2b_bans':      f2b_bans,
        'f2b_total':     len(f2b_bans),
        'apache_hits':   apache_hits,
        'apache_total':  len(apache_hits),
        'multi_apache':  multi_apache,  # recon cross-hôtes non encore banni
        'multi_count':   len(multi_apache),
    }


def _build_structured_events():
    """Timeline structurée des événements sécurité/infra des 24h pour JARVIS et dashboard."""
    central_dir = '/var/log/central'
    now_ts = datetime.now(timezone.utc).timestamp()
    cutoff = now_ts - 86400
    events = []

    _ts_re   = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})')
    _rfc1918 = re.compile(r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)')
    _scan_re = re.compile(
        r'(/\.env|/\.git|/wp-admin|/wp-login|/phpmyadmin|/admin/|/config\b|'
        r'/\.htaccess|/xmlrpc|/backup|/shell|/cmd\b|/cgi-bin|etc/passwd|'
        r'actuator|/api/v[0-9].*auth)',
        re.IGNORECASE
    )

    def _parse_ts(line):
        m = _ts_re.match(line)
        if not m:
            return None
        try:
            from datetime import datetime as _dt
            return _dt.fromisoformat(m.group(1)).replace(
                tzinfo=timezone.utc).timestamp()
        except Exception:
            return None

    def _short_ts(line):
        return line[11:19] if len(line) >= 19 else line[:19]

    # ── fail2ban bans / unbans ────────────────────────────────────────
    _f2b_re = re.compile(
        r'\bfail2ban\.actions.*?\b(Ban|Unban)\b.*?'
        r'([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})'
    )
    for host, logf in [('clt',  central_dir + '/clt/fail2ban.actions.log'),
                        ('pa85', central_dir + '/pa85/fail2ban.actions.log')]:
        if not os.path.exists(logf):
            continue
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    m = _f2b_re.search(line)
                    if m:
                        events.append({
                            'ts':     _short_ts(line),
                            'type':   'f2b_' + m.group(1).lower(),
                            'ip':     m.group(2),
                            'host':   host,
                            'detail': m.group(1) + ' fail2ban',
                        })
        except Exception:
            pass

    # ── apache : scans sur chemins suspects ──────────────────────────
    _ap_re = re.compile(
        r'apache_access: ([\d.]+) [^ ]+ [^ ]+ \[[^\]]+\] '
        r'"(\w+) ([^ "]+)[^"]*" (\d{3}) '
    )
    for host, logf in [('clt',  central_dir + '/clt/apache_access.log'),
                        ('pa85', central_dir + '/pa85/apache_access.log')]:
        if not os.path.exists(logf):
            continue
        seen_scan = set()
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    m = _ap_re.search(line)
                    if not m:
                        continue
                    ip, method, path, status = (
                        m.group(1), m.group(2), m.group(3), int(m.group(4)))
                    if _rfc1918.match(ip):
                        continue
                    key = (ip, host)
                    if _scan_re.search(path) and key not in seen_scan:
                        seen_scan.add(key)
                        events.append({
                            'ts':     _short_ts(line),
                            'type':   'http_scan',
                            'ip':     ip,
                            'host':   host,
                            'detail': method + ' ' + path[:60],
                        })
        except Exception:
            pass

    # ── pvedaemon : échecs qemu-ga / auth failures ────────────────────
    _pve_re = re.compile(
        r'(qga command failed|authentication failure|VM \d+ .* failed)',
        re.IGNORECASE
    )
    logf = central_dir + '/pve/pvedaemon.log'
    if os.path.exists(logf):
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    if _pve_re.search(line):
                        events.append({
                            'ts':     _short_ts(line),
                            'type':   'vm_event',
                            'ip':     None,
                            'host':   'pve',
                            'detail': line[40:100].strip(),
                        })
        except Exception:
            pass

    # ── sshd-session : auth failures (clt, pa85, pve — port <SSH-PORT>) ──────────
    _ssh_re = re.compile(
        r'\b(Failed password|Invalid user)\b.*?from\s+'
        r'([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})',
        re.IGNORECASE
    )
    for host, logf in [('clt',  central_dir + '/clt/sshd-session.log'),
                        ('pa85', central_dir + '/pa85/sshd-session.log'),
                        ('pve',  central_dir + '/pve/sshd-session.log')]:
        if not os.path.exists(logf):
            continue
        seen_ssh = set()
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    m = _ssh_re.search(line)
                    if not m:
                        continue
                    ip = m.group(2)
                    if _rfc1918.match(ip):
                        continue
                    key = (ip, host)
                    if key not in seen_ssh:
                        seen_ssh.add(key)
                        events.append({
                            'ts':     _short_ts(line),
                            'type':   'ssh_fail',
                            'ip':     ip,
                            'host':   host,
                            'detail': m.group(1),
                        })
        except Exception:
            pass

    # ── vzdump : événements sauvegarde (pve) — succès et erreurs ──────────
    _vz_err_re = re.compile(r'\b(ERROR|failed|abort)\b', re.IGNORECASE)
    _vz_ok_re  = re.compile(r'\bBackup job finished successfully\b', re.IGNORECASE)
    logf = central_dir + '/pve/vzdump.log'
    if os.path.exists(logf):
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    if _vz_err_re.search(line):
                        events.append({'ts': _short_ts(line), 'type': 'backup_fail',
                                       'ip': None, 'host': 'pve', 'detail': line[40:90].strip()})
                    elif _vz_ok_re.search(line):
                        events.append({'ts': _short_ts(line), 'type': 'backup_ok',
                                       'ip': None, 'host': 'pve', 'detail': line[40:90].strip()})
        except Exception:
            pass

    # ── pvefw-logger : paquets droppés par le firewall Proxmox (pve) ────
    _fw_src_re = re.compile(r'\bSRC=([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})')
    logf = central_dir + '/pve/pvefw-logger.log'
    if os.path.exists(logf):
        seen_fw = set()
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    m = _fw_src_re.search(line)
                    if not m:
                        continue
                    ip = m.group(1)
                    if _rfc1918.match(ip) or ip in seen_fw:
                        continue
                    seen_fw.add(ip)
                    events.append({
                        'ts':     _short_ts(line),
                        'type':   'fw_drop',
                        'ip':     ip,
                        'host':   'pve',
                        'detail': 'pvefw drop',
                    })
        except Exception:
            pass

    # ── dnsmasq-dhcp : baux DHCP (<ROUTER-HOSTNAME>) — un seul par MAC sur 24h ────
    _dhcp_re = re.compile(
        r'DHCPACK\(\w+\)\s+([\d.]+)\s+([\da-fA-F:]{17})(?:\s+(\S+))?'
    )
    logf = central_dir + '/GT-BE98-87B0-011D764-C/dnsmasq-dhcp.log'
    if os.path.exists(logf):
        seen_mac = set()
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    m = _dhcp_re.search(line)
                    if not m or m.group(2) in seen_mac:
                        continue
                    seen_mac.add(m.group(2))
                    hostname = m.group(3) or m.group(2)
                    events.append({
                        'ts':     _short_ts(line),
                        'type':   'dhcp_lease',
                        'ip':     m.group(1),
                        'host':   '<ROUTER-HOSTNAME>',
                        'detail': hostname,
                    })
        except Exception:
            pass

    # ── WAN events : reconnexions WAN (<ROUTER-HOSTNAME>) ──────────────────────────────
    logf = central_dir + '/GT-BE98-87B0-011D764-C/WAN.log'
    if os.path.exists(logf):
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    ts = _parse_ts(line)
                    if ts is None or ts < cutoff:
                        continue
                    if 'WAN was restored' in line:
                        ev_type = 'wan_restored'
                        detail  = 'WAN reconnecté'
                    elif 'disconnected' in line.lower() or 'down' in line.lower():
                        ev_type = 'wan_down'
                        detail  = 'WAN déconnecté'
                    else:
                        continue
                    events.append({
                        'ts':     _short_ts(line),
                        'type':   ev_type,
                        'ip':     '',
                        'host':   '<ROUTER-HOSTNAME>',
                        'detail': detail,
                    })
        except Exception:
            pass

    events.sort(key=lambda e: e['ts'], reverse=True)
    return events[:100]


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
        'crowdsec':        get_crowdsec_stats(),
        'windows_disk':    get_windows_disk(),
        'crons':           get_cron_jobs(),
        'autoban_log':     _get_autoban_log(),
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
    """Tag kill_chain IPs vues dans les logs routeur (router_seen / router_out)."""
    xh = data.get('xhosts', {})
    r_src = xh.get('router_src', {})
    r_dst = xh.get('router_dst', {})
    if not r_src and not r_dst:
        return
    f2b = xh.get('f2b_bans', {})
    corr_count = 0
    for entry in data['kill_chain'].get('active_ips', []):
        ip = entry['ip']
        in_src = r_src.get(ip, 0)
        in_dst = r_dst.get(ip, 0)
        if in_src or in_dst:
            entry['router_seen'] = True
            entry['router_hits'] = in_src
            entry['router_out']  = in_dst
            corr_count += 1
        if ip in f2b:
            entry['f2b_vms'] = f2b[ip]   # ['clt','pa85'] — banni sur ces VMs aussi
        apache = xh.get('apache_hits', {})
        if ip in apache:
            entry['apache_vms'] = apache[ip]['hosts']
            entry['apache_total'] = apache[ip]['total']
            entry['apache_errors'] = apache[ip]['errors']
    data['xhosts']['corr_count'] = corr_count


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


def _main_write(data):
    """Run autoban, write monitoring.json atomically, print summary."""
    check_and_send_alerts(data)
    data['autoban_log'] = _get_autoban_log()
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
    print(f'[OK] monitoring.json v1.5.0 — {data["traffic"]["total_requests"]} req/24h — '
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

def get_tls_expiry():
    """Verifie expiration certs TLS Let's Encrypt sur srv-ngix (local)."""
    domains = [
        ('<DOMAIN-COM>', '/etc/letsencrypt/live/<DOMAIN-COM>/cert.pem'),
        ('<DOMAIN-FR>',  '/etc/letsencrypt/live/<DOMAIN-FR>/cert.pem'),
    ]
    results = {}
    for domain, cert_path in domains:
        key = domain.replace('.', '_').replace('-', '_')
        try:
            out = subprocess.check_output(
                ['openssl', 'x509', '-enddate', '-noout', '-in', cert_path],
                stderr=subprocess.DEVNULL, timeout=5
            ).decode().strip()
            date_str = out.split('=', 1)[1]
            exp = datetime.strptime(date_str, '%b %d %H:%M:%S %Y %Z').replace(
                tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            days_left = (exp - now).days
            results[key] = {
                'domain':    domain,
                'expires':   date_str,
                'days_left': days_left,
                'warning':   days_left < 30,
                'critical':  days_left < 7,
            }
        except Exception:
            results[key] = {'domain': domain, 'available': False}
    return results


def get_apparmor_nginx():
    """Verifie confinement AppArmor workers nginx (local sur srv-ngix)."""
    try:
        out = subprocess.check_output(
            ['/usr/sbin/aa-status'], stderr=subprocess.DEVNULL, timeout=10
        ).decode()
        enforce = False
        in_enforce_section = False
        proc_count = 0
        for line in out.splitlines():
            if 'profiles are in enforce mode' in line:
                in_enforce_section = True
            elif 'profiles are in complain mode' in line:
                in_enforce_section = False
            if in_enforce_section and '/usr/sbin/nginx' in line and '(' not in line:
                enforce = True
            if '/usr/sbin/nginx (' in line:
                proc_count += 1
        return {'available': True, 'enforce': enforce, 'processes_confined': proc_count}
    except Exception:
        return {'available': False, 'enforce': False, 'processes_confined': 0}


def get_apparmor_clt():
    """Verifie confinement AppArmor Apache2 sur CLT via SSH."""
    try:
        cmd = ['ssh', '-i', _CLT_SSH_KEY, '-p', str(SSH_PORT),
               '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
               '-o', 'ConnectTimeout=8', '-o', 'BatchMode=yes',
               f'root@{IP_CLT}',
               'aa-status 2>/dev/null']
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if r.returncode != 0 or not r.stdout.strip():
            return {'available': False, 'enforce': False}
        enforce = False
        in_enforce = False
        for line in r.stdout.splitlines():
            if 'profiles are in enforce mode' in line:
                in_enforce = True
            elif 'profiles are in complain mode' in line:
                in_enforce = False
            if in_enforce and '/usr/sbin/apache2' in line and '(' not in line:
                enforce = True
        return {'available': True, 'enforce': enforce}
    except Exception:
        return {'available': False, 'enforce': False}


# ─── ModSecurity audit log — helpers ─────────────────────────────────────────

_MODSEC_LAN_RE     = re.compile(r'^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)')
_MODSEC_BROWSER_RE = re.compile(r'Mozilla|Chrome|Firefox|Safari|Edge|Opera', re.I)
_MODSEC_ATTACK_RANGES = (
    (930000, 930999), (931000, 931999), (932000, 932999), (933000, 933999),
    (941000, 941999), (942000, 942999), (943000, 943999), (944000, 944999),
)

def _modsec_is_attack_rule(rule_id_str):
    try:
        r = int(rule_id_str)
        return any(lo <= r <= hi for lo, hi in _MODSEC_ATTACK_RANGES)
    except Exception:
        return False

def _modsec_ts_in_last_hour(ts_hm):
    """Vérifie si un timestamp HH:MM est dans la dernière heure (UTC)."""
    try:
        now = datetime.now(timezone.utc)
        h, mn = map(int, ts_hm.split(':'))
        t = now.replace(hour=h, minute=mn, second=0, microsecond=0)
        if t > now:
            t -= timedelta(days=1)
        return (now - t).total_seconds() <= 3600
    except Exception:
        return False

def _parse_modsec_audit(log_content, hours=24):
    """Parse ModSecurity audit log (format multi-section ABCFHEZ).
    Retourne liste [{ts, ip, rule_id, rule_msg, severity, uri, ua, is_fp, label}]."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    blocks = []
    parts  = re.split(r'--[0-9a-f]+-A--\n?', log_content)
    for part in parts:
        if not part.strip():
            continue
        # Section A : [timestamp] unique_id client_ip ...
        ma = re.match(r'\[([^\]]+)\]\s+\S+\s+([\d\.a-fA-F:]+)', part)
        if not ma:
            continue
        ts_str, client_ip = ma.group(1), ma.group(2)
        try:
            ts = datetime.strptime(re.sub(r'\.\d+', '', ts_str), '%d/%b/%Y:%H:%M:%S %z')
        except Exception:
            continue
        if ts < cutoff:
            continue
        # Section B : request line + UA
        uri, ua = '', ''
        mb = re.search(r'--[0-9a-f]+-B--\n(.*?)--[0-9a-f]+-[CF]--', part, re.DOTALL)
        if mb:
            bl = mb.group(1)
            mr = re.search(r'^\w+\s+(\S+)\s+HTTP/', bl, re.MULTILINE)
            if mr:
                uri = mr.group(1)
            mu = re.search(r'^User-Agent:\s*(.+)', bl, re.MULTILINE | re.I)
            if mu:
                ua = mu.group(1).strip()
        # Section H : messages règles
        mh = re.search(r'--[0-9a-f]+-H--\n(.*?)(?:--[0-9a-f]+-Z--|$)', part, re.DOTALL)
        if not mh:
            continue
        msgs = re.findall(
            r'Message:.*?\[id "(\d+)"\].*?\[msg "([^"]+)"\].*?\[severity "([^"]+)"\]',
            mh.group(1)
        )
        if not msgs:
            continue
        is_lan     = bool(_MODSEC_LAN_RE.match(client_ip))
        is_browser = bool(_MODSEC_BROWSER_RE.search(ua))
        for rule_id, rule_msg, severity in msgs:
            is_attack = _modsec_is_attack_rule(rule_id)
            is_fp     = is_lan or (is_browser and not is_attack)
            blocks.append({
                'ts':       ts.strftime('%H:%M'),
                'ip':       client_ip,
                'rule_id':  rule_id,
                'rule_msg': rule_msg[:80],
                'severity': severity,
                'uri':      uri[:100],
                'ua':       ua[:80],
                'is_fp':    is_fp,
                'label':    'FP probable' if is_fp else 'ATTAQUE',
            })
    return blocks

def _get_modsec_data(host_ip, ssh_key, port=SSH_PORT):
    """Collecte statut ModSec + blocs audit log 24h via SSH. Retourne dict enrichi."""
    try:
        cmd = ['ssh', '-i', ssh_key, '-p', str(port),
               '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
               '-o', 'ConnectTimeout=8', '-o', 'BatchMode=yes',
               f'root@{host_ip}',
               'echo "---MOD---"; apachectl -M 2>/dev/null | grep -c security2; '
               'echo "---ENGINE---"; grep -m1 \'^SecRuleEngine\' /etc/modsecurity/modsecurity.conf 2>/dev/null || echo absent; '
               'echo "---MODE---"; grep \'^SecDefaultAction\' /etc/modsecurity/crs/crs-setup.conf 2>/dev/null | grep -v \'^#\' | head -1; '
               'echo "---LOG---"; tail -c 400000 /var/log/apache2/modsec_audit.log 2>/dev/null']
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        raw = r.stdout
        def _between(t1, t2):
            m = re.search(f'{t1}\n(.*?){t2}', raw, re.DOTALL)
            return m.group(1).strip() if m else ''
        mod_count   = _between('---MOD---',    '---ENGINE---')
        engine_line = _between('---ENGINE---', '---MODE---')
        mode_line   = _between('---MODE---',   '---LOG---')
        log_content = raw.split('---LOG---\n', 1)[1] if '---LOG---' in raw else ''
        module_loaded = mod_count.strip() == '1'
        engine_on  = ('On' in engine_line and not engine_line.startswith('#')
                      and engine_line != 'absent')
        blocking   = 'deny' in mode_line and 'status:403' in mode_line
        blocks     = _parse_modsec_audit(log_content, hours=24) if log_content else []
        attacks    = [b for b in blocks if not b['is_fp']]
        fps        = [b for b in blocks if b['is_fp']]
        return {
            'available':    True,
            'engine_on':    bool(module_loaded and engine_on),
            'blocking':     blocking,
            'blocks_1h':    sum(1 for b in blocks if _modsec_ts_in_last_hour(b['ts'])),
            'blocks_24h':   len(blocks),
            'attack_count': len(attacks),
            'fp_count':     len(fps),
            'attacks':      attacks[-10:],
            'last_updated': datetime.now(timezone.utc).strftime('%H:%M'),
        }
    except Exception:
        return {'available': False, 'engine_on': False, 'blocking': False,
                'blocks_1h': 0, 'blocks_24h': 0, 'attack_count': 0, 'fp_count': 0,
                'attacks': [], 'last_updated': ''}


def get_modsec_clt():
    """ModSecurity statut + blocs audit log CLT (via SSH)."""
    return _get_modsec_data(IP_CLT, _CLT_SSH_KEY)


def get_apparmor_pa85():
    """Verifie confinement AppArmor Apache2 sur PA85 via SSH."""
    try:
        cmd = ['ssh', '-i', _PA85_SSH_KEY, '-p', str(SSH_PORT),
               '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no',
               '-o', 'ConnectTimeout=8', '-o', 'BatchMode=yes',
               f'root@{IP_PA85}',
               'aa-status 2>/dev/null']
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if r.returncode != 0 or not r.stdout.strip():
            return {'available': False, 'enforce': False}
        enforce = False
        in_enforce = False
        for line in r.stdout.splitlines():
            if 'profiles are in enforce mode' in line:
                in_enforce = True
            elif 'profiles are in complain mode' in line:
                in_enforce = False
            if in_enforce and '/usr/sbin/apache2' in line and '(' not in line:
                enforce = True
        return {'available': True, 'enforce': enforce}
    except Exception:
        return {'available': False, 'enforce': False}


def get_modsec_pa85():
    """ModSecurity statut + blocs audit log PA85 (via SSH)."""
    return _get_modsec_data(IP_PA85, SSH_KEY_PA85)


def get_jarvis_status():
    """Ping JARVIS localhost:5000/api/status — timeout 3s."""
    try:
        req = Request(JARVIS_URL + '/api/status',
                      headers={'Accept': 'application/json'})
        with urlopen(req, timeout=3) as r:
            data = json.loads(r.read().decode('utf-8', errors='replace'))
        # Normalise les champs selon l'API JARVIS connue
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


_RSYSLOG_EXPLOITED = {
    'clt':                    {'apache_access', 'fail2ban.actions', 'sshd-session'},
    'pa85':                   {'apache_access', 'fail2ban.actions', 'sshd-session'},
    'pve':                    {'pvedaemon', 'sshd-session', 'vzdump', 'pvefw-logger'},
    'GT-BE98-87B0-011D764-C': {'kernel', 'dnsmasq-dhcp', 'WAN'},
}
_RSYSLOG_SECURITY = {
    'clt':                    {'apache_access', 'fail2ban.actions', 'sshd-session', 'kernel'},
    'pa85':                   {'apache_access', 'fail2ban.actions', 'sshd-session', 'kernel'},
    'pve':                    {'pvedaemon', 'pve-firewall', 'pvefw-logger', 'vzdump', 'sshd-session'},
    'GT-BE98-87B0-011D764-C': {'kernel', 'dnsmasq-dhcp', 'WAN'},
}

def get_rsyslog_status():
    """Métriques rsyslog : service, hôtes actifs, disque, rotation, lignes/min."""
    import glob as _glob, shutil as _shutil
    central_dir = '/var/log/central'
    now_ts = datetime.now(timezone.utc).timestamp()
    result = {
        'service':              'unknown',
        'disk_mb':              0,
        'disk_free_mb':         0,
        'log_files':            0,
        'last_rotate_ts':       None,
        'retention_days':       7,
        'retention_maxsize_mb': 20,
        'hosts':                {},
    }
    try:
        r = subprocess.run(['systemctl', 'is-active', 'rsyslog'],
                           capture_output=True, text=True, timeout=3)
        result['service'] = r.stdout.strip()
    except Exception:
        pass
    try:
        r = subprocess.run(['du', '-sm', central_dir],
                           capture_output=True, text=True, timeout=5)
        result['disk_mb'] = int(r.stdout.split()[0])
    except Exception:
        pass
    try:
        st = _shutil.disk_usage('/var/log')
        result['disk_free_mb'] = int(st.free / 1024 / 1024)
    except Exception:
        pass
    try:
        rotate_status = '/var/lib/logrotate/status'
        if os.path.exists(rotate_status):
            mtime = os.path.getmtime(rotate_status)
            result['last_rotate_ts'] = datetime.fromtimestamp(
                mtime, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception:
        pass
    try:
        lr_conf = '/etc/logrotate.d/central-logs'
        if os.path.exists(lr_conf):
            with open(lr_conf) as fh:
                lr_txt = fh.read()
            m = re.search(r'\brotate\s+(\d+)', lr_txt)
            if m:
                result['retention_days'] = int(m.group(1))
            m = re.search(r'\bmaxsize\s+(\d+)\s*([MmGg]?)', lr_txt)
            if m:
                v, u = int(m.group(1)), m.group(2).upper()
                result['retention_maxsize_mb'] = v * 1024 if u == 'G' else v
    except Exception:
        pass
    _lm_re = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})')
    for host in ('clt', 'pa85', 'pve', 'GT-BE98-87B0-011D764-C'):
        host_dir = os.path.join(central_dir, host)
        if not os.path.isdir(host_dir):
            result['hosts'][host] = {'status': 'absent', 'last_ago_s': None, 'files': 0, 'size_kb': 0, 'lines_min': 0, 'recent_lines': [], 'last_file': '', 'programs_used': [], 'programs_unused': []}
            continue
        logs = _glob.glob(os.path.join(host_dir, '*.log'))
        result['log_files'] += len(logs)
        size_kb = sum(os.path.getsize(f) for f in logs) // 1024 if logs else 0
        lines_min = 0
        try:
            # Compter uniquement les lignes dont le timestamp est dans la dernière minute
            min_ts = now_ts - 60
            for f in [g for g in logs if now_ts - os.path.getmtime(g) < 300]:
                try:
                    with open(f, 'rb') as fh:
                        fh.seek(0, 2)
                        fh.seek(max(0, fh.tell() - 65536))
                        for line in fh.read().decode('utf-8', errors='replace').splitlines():
                            m = _lm_re.match(line)
                            if m:
                                try:
                                    if datetime.fromisoformat(m.group(1)).timestamp() >= min_ts:
                                        lines_min += 1
                                except Exception:
                                    pass
                except Exception:
                    pass
        except Exception:
            pass
        if logs:
            latest_f = max(logs, key=os.path.getmtime)
            latest   = os.path.getmtime(latest_f)
            ago_s    = int(now_ts - latest)
            recent_lines = []
            try:
                with open(latest_f, 'r', errors='replace') as fh:
                    all_lines = fh.readlines()
                    recent_lines = [l.rstrip() for l in all_lines[-5:] if l.strip()]
            except Exception:
                pass
            avail   = set(os.path.splitext(os.path.basename(f))[0] for f in logs)
            used_s  = _RSYSLOG_EXPLOITED.get(host, set())
            sec_s   = _RSYSLOG_SECURITY.get(host, set())
            result['hosts'][host] = {
                'status':          'ok' if ago_s < 300 else 'stale',
                'last_ago_s':      ago_s,
                'files':           len(logs),
                'size_kb':         size_kb,
                'lines_min':       lines_min,
                'recent_lines':    recent_lines,
                'last_file':       os.path.basename(latest_f),
                'programs_used':   sorted(used_s & avail),
                'programs_unused': sorted((sec_s - used_s) & avail),
            }
        else:
            result['hosts'][host] = {'status': 'absent', 'last_ago_s': None, 'files': 0, 'size_kb': 0, 'lines_min': 0, 'recent_lines': [], 'last_file': '', 'programs_used': [], 'programs_unused': []}
    # Top 15 IPs routeur DST (outbound)
    be98_pattern = os.path.join(central_dir, 'GT-BE98*', 'kernel.log')
    router_top = {}
    _rfc1918 = re.compile(r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)')
    for logf in _glob.glob(be98_pattern):
        try:
            with open(logf, 'r', errors='replace') as fh:
                for line in fh:
                    m = re.search(r'\bDST=([\d.]+)', line)
                    if m and not _rfc1918.match(m.group(1)):
                        ip = m.group(1)
                        router_top[ip] = router_top.get(ip, 0) + 1
        except Exception:
            pass
    result['router_top_dst'] = sorted(
        [{'ip': k, 'hits': v} for k, v in router_top.items()],
        key=lambda x: -x['hits'])[:15]
    # Compteur reconnexions WAN sur 24h (instabilité ligne)
    wan_24h = 0
    wan_cutoff = now_ts - 86400
    _wan_ts_re = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})')
    for wan_f in _glob.glob(os.path.join(central_dir, 'GT-BE98*', 'WAN.log')):
        try:
            with open(wan_f, 'r', errors='replace') as fh:
                for line in fh:
                    if 'restored' not in line.lower() and 'disconnected' not in line.lower() and 'down' not in line.lower():
                        continue
                    m = _wan_ts_re.match(line)
                    if m:
                        try:
                            if datetime.fromisoformat(m.group(1)).timestamp() >= wan_cutoff:
                                wan_24h += 1
                        except Exception:
                            pass
        except Exception:
            pass
    result['wan_reconnects_24h'] = wan_24h
    return result


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
    _main_write(data)

if __name__ == '__main__':
    main()


