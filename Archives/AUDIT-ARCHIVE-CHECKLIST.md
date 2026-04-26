<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=%3EAUDIT+3+PHASES_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>🔍 Audit 3 phases &nbsp;·&nbsp; Avant création · Contrôle archive · Validation post-restore</h3>

<br/>

<p>
  <a href="https://0xcyberlitech.com">
    <img src="https://img.shields.io/badge/🌐%20Site-0xcyberlitech.com-00B4D8?style=flat-square" alt="Site" />
  </a>
  &nbsp;
  <a href="https://github.com/0xCyberLiTech/SOC">
    <img src="https://img.shields.io/badge/GitHub-SOC-00B4D8?style=flat-square&logo=github&logoColor=white" alt="SOC" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Phases-3-00B4D8?style=flat-square" alt="Phases" />
  &nbsp;  <img src="https://img.shields.io/badge/Contrôle-Complet-00FF88?style=flat-square" alt="Contrôle" />
  &nbsp;
</p>

<br/>

<p>
  <a href="CONTENU-ARCHIVE.md"><img src="https://img.shields.io/badge/◄-Contenu+archive-555555?style=flat-square" alt="← Contenu archive" /></a>
  &nbsp;&nbsp;
  <a href="../README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>
  &nbsp;&nbsp;
  <a href="../README.md"><img src="https://img.shields.io/badge/README-►-555555?style=flat-square" alt="README →" /></a>
</p>

</div>

---

> Checklist en trois phases : **AVANT** (créer l'archive), **PENDANT** (vérifier l'archive), **APRÈS** (valider la restauration)  
> Référence : `create-archive.sh` v4 · `restore-soc.sh` · Archive `soc-config-2026-04-25_2159.tar.gz`

---

## PHASE 1 — Avant de créer l'archive (audit live srv-ngix)

### Réseau — BLOC 0
- [ ] `/etc/network/interfaces` contient IP statique <SRV-NGIX-IP>, GW <LAN-IP>, DNS
- [ ] `/etc/hostname` = `srv-ngix`
- [ ] `/etc/hosts` contient entrée localhost + srv-ngix
- [ ] `/etc/ssh/sshd_config` — port <SSH-PORT>, PasswordAuthentication no, MaxAuthTries 3
- [ ] `/etc/sysctl.d/99-hardening.conf` — `net.ipv4.conf.all.rp_filter = 2` (requis Suricata AF_PACKET)
- [ ] `/etc/sysctl.d/99-disable-ipv6.conf` — IPv6 désactivé
- [ ] `/etc/exim4/passwd.client` — credentials SMTP <MAIL-PROVIDER> (alertes mail SOC)
- [ ] `/etc/nftables.conf` — règles de base présentes

### nginx — BLOC 1
- [ ] `/etc/nginx/nginx.conf` — config principale présente
- [ ] `/etc/nginx/sites-available/` — tous les vhosts (0xcyberlitech.com, site-02, monitoring...)
- [ ] `/etc/nginx/sites-enabled/` — symlinks actifs vérifiés
- [ ] `/etc/nginx/snippets/` — security-headers, ssl-params, geoip-block présents
- [ ] `/usr/share/GeoIP/*.mmdb` — 3 bases MaxMind (GeoLite2-Country, City, ASN)
- [ ] `/etc/letsencrypt/` — certificats valides (expiration vérifiée)
- [ ] `/etc/nginx/api-keys.conf` — clés NVD + AbuseIPDB (via BLOC 11 api-keys)

### CrowdSec — BLOC 2
- [ ] `/etc/crowdsec/config.yaml` — LAPI url, db path, log level
- [ ] `/etc/crowdsec/local_api_credentials.yaml` — token LAPI (sensible 🔴)
- [ ] `/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml` — bouncer nftables
- [ ] `/etc/crowdsec/scenarios/0xclt-*.yaml` — 3 scénarios custom présents
- [ ] `/etc/crowdsec/parsers/s02-enrich/whitelist-lan.yaml` — whitelist LAN
- [ ] `cscli decisions list -o json` — export décisions actives
- [ ] `cscli collections list -o json` — liste collections installées
- [ ] `cscli bouncers list -o json` — bouncer actif

### Fail2ban — BLOC 3
- [ ] `/etc/fail2ban/jail.local` — jails custom (sshd, nginx-cve, nginx-botsearch)
- [ ] `/etc/fail2ban/action.d/crowdsec-sync.conf` — **CLÉ chaîne défense F2B→CS**
- [ ] `/etc/fail2ban/filter.d/` — 102 filtres dont custom 0xclt

### Suricata — BLOC 4
- [ ] `/etc/suricata/suricata.yaml` — interface af-packet configurée
- [ ] `/etc/suricata/rules/` — règles custom (pas les 106k ET qui seront re-téléchargées)
- [ ] `/etc/suricata/update.yaml` — sources rules (si présent)

### rsyslog — BLOC 5
- [ ] `/etc/rsyslog.conf` — config receiver UDP 514
- [ ] `/etc/rsyslog.d/` — règles par hôte (site-01, site-02, pve, <ROUTER>)

### AppArmor — BLOC 6
- [ ] `/etc/apparmor.d/usr.sbin.nginx` — profil nginx
- [ ] `/etc/apparmor.d/usr.bin.suricata` — profil suricata
- [ ] `aa-status --json` — état référence

### UFW — BLOC 7
- [ ] `/etc/ufw/` complet (before.rules, after.rules, user.rules...)
- [ ] `ufw status verbose` exporté lisible

### Scripts — BLOC 8
- [ ] `/opt/site-01/` — 72 fichiers (monitoring_gen.py, soc.py, soc-daily-report.py, monitoring.sh...)
- [ ] `/usr/local/bin/pve-monitor-write` — script réception stats Proxmox
- [ ] `/var/www/monitoring/` — dashboard HTML+JS+CSS (sans monitoring.json live)

### Crons — BLOC 9
- [ ] `/etc/cron.d/aide-soc` — AIDE 03h00
- [ ] `/etc/cron.d/site-01-cve-fetch` — CVE 3x/jour
- [ ] `/etc/cron.d/site-01-threat-fetch` — Threat 03h00
- [ ] `/etc/cron.d/crowdsec-hub-update` — Hub 03h45
- [ ] `/etc/cron.d/geoipupdate` — MaxMind 03h00
- [ ] `/etc/cron.d/monitoring` — Dashboard 1 min
- [ ] `/etc/cron.d/proto-live` — Protocoles 1 min
- [ ] `/etc/cron.d/soc-daily-report` — Rapport 08h00
- [ ] `/etc/cron.d/sqlite-maintenance` — VACUUM dim 02h00
- [ ] `/etc/cron.d/suricata-update` — Règles 03h30
- [ ] `/etc/cron.d/ufw-snapshot` — UFW snapshot 1h
- [ ] **11 fichiers total dans `/etc/cron.d/`**

### Systemd — BLOC 10
- [ ] `/etc/systemd/system/soc-report-trigger.service` — service SOC custom
- [ ] `/etc/systemd/system/sshd.service` — SSH custom (port <SSH-PORT>)
- [ ] `systemctl list-units` — référence services actifs

### AIDE — BLOC 11 (via complement)
- [ ] `/etc/aide/` — 247 fichiers (aide.conf + règles)
- [ ] ⚠ `/var/lib/aide/aide.db.gz` absent = NORMAL (recalculé après restore)

### Logrotate — BLOC 11
- [ ] `/etc/logrotate.d/` — 20 fichiers (nginx, fail2ban, suricata, crowdsec...)

### GeoIP — BLOC 11
- [ ] `/etc/GeoIP.conf` — Account ID + License Key MaxMind (sensible 🟡)
- [ ] ⚠ `/etc/default/geoipupdate` absent = NORMAL sur ce serveur

### Clés API — BLOC 11
- [ ] `/etc/nginx/api-keys.conf` — NVD_API_KEY + ABUSEIPDB_API_KEY (sensible 🔴)

### Clés SSH — BLOC 11
- [ ] `/root/.ssh/authorized_keys` — clé pve-monitor (Proxmox → srv-ngix)
- [ ] `/root/.ssh/id_site-01_sync` + `.pub` — connexion root@<CLT-IP>
- [ ] `/root/.ssh/id_site-02_sync` + `.pub` — connexion root@<PA85-IP>
- [ ] `/root/.ssh/id_proxmox_sync` + `.pub` — connexion root@<PROXMOX-IP>

---

## PHASE 2 — Vérification de l'archive produite

```bash
# Lister le contenu de l'archive
tar tzf soc-config-AAAA-MM-JJ.tar.gz | sort | head -100

# Vérifier la présence de chaque bloc
tar tzf soc-config-AAAA-MM-JJ.tar.gz | grep -E "^[^/]+/(network|nginx|crowdsec|fail2ban|suricata|rsyslog|apparmor|ufw|scripts|crons|systemd|aide|logrotate|geoip|api-keys|ssh)/" | awk -F/ '{print $2}' | sort -u

# Vérifier les fichiers sensibles présents (les attendre !)
tar tzf soc-config-AAAA-MM-JJ.tar.gz | grep -E "(letsencrypt|api-keys\.conf|GeoIP\.conf|id_site-01_sync|id_site-02_sync|local_api_credentials)"

# Vérifier le nombre de fichiers cron
tar tzf soc-config-AAAA-MM-JJ.tar.gz | grep "crons/cron.d/" | wc -l
# Attendu : 11 fichiers

# Vérifier le script de restauration inclus
tar tzf soc-config-AAAA-MM-JJ.tar.gz | grep README-RESTORE
```

### Checklist blocs attendus
- [ ] `network/` présent (interfaces, hostname, ssh/, sysctl/, exim4/)
- [ ] `nginx/` présent (nginx.conf, sites-available/, snippets/, geoip/, letsencrypt/)
- [ ] `crowdsec/` présent (config/, bouncers/, decisions-export.json, collections.json)
- [ ] `fail2ban/` présent (jail.local, filter.d/, action.d/, crowdsec-sync.conf)
- [ ] `suricata/` présent (suricata.yaml, rules/)
- [ ] `rsyslog/` présent (rsyslog.conf, rsyslog.d/)
- [ ] `apparmor/` présent (profils nginx + suricata + aa-status.json)
- [ ] `ufw/` présent (configs + ufw-status-verbose.txt)
- [ ] `scripts/` présent (opt-site-01/, usr-local-bin/, dashboard/)
- [ ] `crons/` présent (cron.d/ avec 11 fichiers)
- [ ] `systemd/` présent (soc-report-trigger.service + services-actifs.txt)
- [ ] `aide/` présent (/etc/aide/ complet)
- [ ] `logrotate/` présent (20 fichiers)
- [ ] `geoip/` présent (GeoIP.conf)
- [ ] `api-keys/` présent (api-keys.conf)
- [ ] `ssh/` présent (authorized_keys + 3 clés privées sync)
- [ ] `metadata/` présent (versions.txt, dpkg-selections.txt)
- [ ] `README-RESTORE.md` présent à la racine

### Vérification simulation restauration
```bash
bash restore-soc.sh soc-config-AAAA-MM-JJ.tar.gz --dry-run 2>&1 | tee restore-simulation.txt

# Rapport attendu :
# - Fichiers DIFFÉRENTS : liste les vrais changements (sur VM prod = 0)
# - Fichiers NOUVEAUX   : liste les configs absentes sur la cible
# - Aucun ERRR (rouge) dans la sortie
grep -c "DIFFÉRENT\|NOUVEAU" restore-simulation.txt
```

- [ ] `--dry-run` se termine sans erreur (exit 0)
- [ ] Rapport final affiché (╔═══╗ vert ou jaune)
- [ ] Nombre de fichiers différents = cohérent (0 si archive créée depuis la même VM)

---

## PHASE 3 — Vérification post-restauration (nouveau serveur)

### Réseau
- [ ] `hostname` → `srv-ngix`
- [ ] `ip addr show` → <SRV-NGIX-IP>/24
- [ ] `ip route` → default via <LAN-IP>
- [ ] `ssh -p <SSH-PORT> root@<SRV-NGIX-IP> hostname` → `srv-ngix` (depuis LAN)
- [ ] `sysctl net.ipv4.conf.all.rp_filter` → `2`
- [ ] `echo "test SOC" | mail -s test admin@domain.fr` → mail reçu (exim4 SMTP <MAIL-PROVIDER>)

### Services actifs
```bash
systemctl is-active nginx crowdsec suricata fail2ban rsyslog
# Attendu : active × 5
```
- [ ] nginx → active
- [ ] crowdsec → active
- [ ] suricata → active
- [ ] fail2ban → active
- [ ] rsyslog → active

### CrowdSec
```bash
cscli decisions list | wc -l      # > 0
cscli bouncers list                # crowdsec-firewall-bouncer présent
cscli collections list | grep linux-lpe  # collection installée
```
- [ ] Bouncers actifs
- [ ] Décisions restaurées
- [ ] Collections installées

### nginx
```bash
nginx -t                           # OK
curl -sI https://0xcyberlitech.com/ | head -3  # 200 ou 301
curl -sI http://<SRV-NGIX-IP>:8080/ | head -3   # dashboard
```
- [ ] `nginx -t` → OK
- [ ] Sites répondent (0xcyberlitech.com, site-02)
- [ ] Dashboard SOC accessible http://<SRV-NGIX-IP>:8080/

### Crons
```bash
ls -la /etc/cron.d/               # 11 fichiers
ls -la /etc/cron.d/ | wc -l       # ≥ 13 (11 + . + ..)
```
- [ ] 11 fichiers présents dans `/etc/cron.d/`
- [ ] permissions 644 sur tous les fichiers cron.d

### Suricata
```bash
suricata-update                   # téléchargement règles ET
systemctl reload suricata
tail -5 /var/log/suricata/suricata.log  # pas d'erreur AF_PACKET
```
- [ ] Règles ET téléchargées (~106k)
- [ ] Suricata rechargé sans erreur
- [ ] Log ne contient pas "rp_filter" warning

### AIDE
```bash
aide --init                       # 1-2 min
mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
aide --check                      # 0 changement
```
- [ ] `aide --init` termine sans erreur
- [ ] `aide --check` → aucune modification détectée

### Clés API
```bash
grep -v "^#" /etc/nginx/api-keys.conf  # NVD_API_KEY + ABUSEIPDB_API_KEY présentes
stat -c "%a %U" /etc/nginx/api-keys.conf  # 600 root
```
- [ ] api-keys.conf présent avec les deux clés
- [ ] Permissions 600 root:root

### Dashboard SOC
- [ ] http://<SRV-NGIX-IP>:8080/ charge sans erreur JS
- [ ] ThreatScore affiché (pas N/A)
- [ ] Tuile Services : nginx/crowdsec/suricata/fail2ban tous verts
- [ ] Tuile CrowdSec : bans affichés

---

## Récapitulatif fichiers sensibles à protéger

| Fichier | Risque | Action |
|---------|--------|--------|
| `nginx/letsencrypt/` | 🔴 Clés privées SSL | Archive sur support chiffré uniquement |
| `crowdsec/local_api_credentials.yaml` | 🔴 Token API CrowdSec | Stocker hors NAS public |
| `api-keys/api-keys.conf` | 🔴 NVD + AbuseIPDB API keys | Stocker hors NAS public |
| `network/exim4/passwd.client` | 🔴 Password SMTP <MAIL-PROVIDER> | Stocker hors NAS public |
| `geoip/GeoIP.conf` | 🟡 License Key MaxMind | Accès restreint |
| `ssh/id_site-01_sync` + autres | 🟡 Clés SSH privées sync | Stocker hors NAS public |
| `ssh/authorized_keys` | 🟡 Clé SSH pve-monitor | Accès restreint |

**Règle absolue : stocker l'archive dans `D:\BACKUP-PROXMOX\` uniquement — jamais sur un NAS accessible depuis le LAN non chiffré.**

---

## Commandes de vérification rapide (one-liner)

```bash
# Vérifier que l'archive est complète (16 blocs attendus)
BLOCS="network nginx crowdsec fail2ban suricata rsyslog apparmor ufw scripts crons systemd aide logrotate geoip api-keys ssh"
ARCHIVE="soc-config-2026-04-25_2159.tar.gz"
for b in $BLOCS; do
    tar tzf "$ARCHIVE" | grep -q "^[^/]*/$b/" && echo "✅ $b" || echo "❌ $b MANQUANT"
done
```

```bash
# Vérifier les crons (11 attendus)
tar tzf "$ARCHIVE" | grep "crons/cron.d/" | grep -v "/$" | wc -l
```

```bash
# Vérifier les fichiers sensibles
tar tzf "$ARCHIVE" | grep -E "(letsencrypt/live|api-keys\.conf|local_api_credentials|GeoIP\.conf|id_site-01_sync|passwd\.client)"
```

---

*Checklist créée le 2026-04-25 — basée sur audit live srv-ngix (archive v4)*
---

<div align="center">

<br/>

<table>
<tr>
<td align="center" width="33%"><b>🖥️ Infrastructure &amp; Sécurité</b></td>
<td align="center" width="33%"><b>💻 Développement &amp; Web</b></td>
<td align="center" width="33%"><b>🤖 Intelligence Artificielle</b></td>
</tr>
<tr>
<td align="center">
  <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="40" title="Debian" /></a>&nbsp;
  <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="40" title="Nginx" /></a>&nbsp;
  <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="40" title="Bash" /></a>&nbsp;
  <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="40" title="Git" /></a>
</td>
<td align="center">
  <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="40" title="Python" /></a>&nbsp;
  <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="40" title="Flask" /></a>&nbsp;
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="40" title="JavaScript" /></a>&nbsp;
  <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="40" title="VS Code" /></a>
</td>
<td align="center">
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  <br/><br/>
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projet <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> &nbsp;·&nbsp; Co-développé avec <a href="https://claude.ai">Claude AI</a> · Anthropic 🔒</sub>

</div>

<div align="center">

<p>
  <a href="CONTENU-ARCHIVE.md"><img src="https://img.shields.io/badge/◄-Contenu+archive-555555?style=flat-square" alt="← Contenu archive" /></a>&nbsp;&nbsp;<a href="../README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>&nbsp;&nbsp;<a href="../README.md"><img src="https://img.shields.io/badge/README-►-555555?style=flat-square" alt="README →" /></a>
</p>

</div>
