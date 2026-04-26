<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EAUDIT_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Dashboard sécurité homelab · CrowdSec WAF · Suricata IDS · JARVIS IA.</h2>

  <p align="center">
    <a href="https://0xcyberlitech.github.io/">
      <img src="https://img.shields.io/badge/Portfolio-0xCyberLiTech-181717?logo=github&style=flat-square" alt="Portfolio" />
    </a>
    <a href="https://github.com/0xCyberLiTech">
      <img src="https://img.shields.io/badge/Profil-GitHub-181717?logo=github&style=flat-square" alt="Profil GitHub" />
    </a>
    <a href="https://github.com/0xCyberLiTech/SOC">
      <img src="https://img.shields.io/badge/Dépôt-SOC-00B4D8?logo=github&style=flat-square" alt="Dépôt SOC" />
    </a>
    <a href="../README.md">
      <img src="https://img.shields.io/badge/📄%20README-SOC-00B4D8?style=flat-square" alt="README" />
    </a>
    <a href="https://github.com/0xCyberLiTech?tab=repositories">
      <img src="https://img.shields.io/badge/Dépôts-publics-blue?style=flat-square" alt="Dépôts publics" />
    </a>
  </p>

</div>

<div align="center">
  <img src="https://img.icons8.com/fluency/96/000000/cyber-security.png" alt="CyberSec" width="80"/>
</div>

<div align="center">
  <p>
    <strong>Cybersécurité défensive</strong> <img src="https://img.icons8.com/color/24/000000/lock--v1.png"/> &nbsp;•&nbsp; <strong>Homelab en production</strong> <img src="https://img.icons8.com/color/24/000000/linux.png"/> &nbsp;•&nbsp; <strong>IA locale intégrée</strong> <img src="https://img.icons8.com/color/24/000000/shield-security.png"/>
  </p>
</div>

---

> Checklist en trois phases : **AVANT** (créer l'archive), **PENDANT** (vérifier l'archive), **APRÈS** (valider la restauration)  
> Référence : `create-archive.sh` v4 · `restore-soc.sh` · Archive `soc-config-2026-04-25_2159.tar.gz`

---

<h2 align="center">PHASE 1 — Avant de créer l'archive (audit live srv-ngix)</h2>

<h3 align="center">Réseau — BLOC 0</h3>

- [ ] `/etc/network/interfaces` contient IP statique <SRV-NGIX-IP>, GW <LAN-IP>, DNS
- [ ] `/etc/hostname` = `srv-ngix`
- [ ] `/etc/hosts` contient entrée localhost + srv-ngix
- [ ] `/etc/ssh/sshd_config` — port <SSH-PORT>, PasswordAuthentication no, MaxAuthTries 3
- [ ] `/etc/sysctl.d/99-hardening.conf` — `net.ipv4.conf.all.rp_filter = 2` (requis Suricata AF_PACKET)
- [ ] `/etc/sysctl.d/99-disable-ipv6.conf` — IPv6 désactivé
- [ ] `/etc/exim4/passwd.client` — credentials SMTP <MAIL-PROVIDER> (alertes mail SOC)
- [ ] `/etc/nftables.conf` — règles de base présentes

<h3 align="center">nginx — BLOC 1</h3>

- [ ] `/etc/nginx/nginx.conf` — config principale présente
- [ ] `/etc/nginx/sites-available/` — tous les vhosts (<DOMAIN-COM>, site-02, monitoring...)
- [ ] `/etc/nginx/sites-enabled/` — symlinks actifs vérifiés
- [ ] `/etc/nginx/snippets/` — security-headers, ssl-params, geoip-block présents
- [ ] `/usr/share/GeoIP/*.mmdb` — 3 bases MaxMind (GeoLite2-Country, City, ASN)
- [ ] `/etc/letsencrypt/` — certificats valides (expiration vérifiée)
- [ ] `/etc/nginx/api-keys.conf` — clé NVD (via BLOC 11 api-keys)

<h3 align="center">CrowdSec — BLOC 2</h3>

- [ ] `/etc/crowdsec/config.yaml` — LAPI url, db path, log level
- [ ] `/etc/crowdsec/local_api_credentials.yaml` — token LAPI (sensible 🔴)
- [ ] `/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml` — bouncer nftables
- [ ] `/etc/crowdsec/scenarios/custom-*.yaml` — 3 scénarios custom présents
- [ ] `/etc/crowdsec/parsers/s02-enrich/whitelist-lan.yaml` — whitelist LAN
- [ ] `cscli decisions list -o json` — export décisions actives
- [ ] `cscli collections list -o json` — liste collections installées
- [ ] `cscli bouncers list -o json` — bouncer actif

<h3 align="center">Fail2ban — BLOC 3</h3>

- [ ] `/etc/fail2ban/jail.local` — jails custom (sshd, nginx-cve, nginx-botsearch)
- [ ] `/etc/fail2ban/action.d/crowdsec-sync.conf` — **CLÉ chaîne défense F2B→CS**
- [ ] `/etc/fail2ban/filter.d/` — 102 filtres dont custom

<h3 align="center">Suricata — BLOC 4</h3>

- [ ] `/etc/suricata/suricata.yaml` — interface af-packet configurée
- [ ] `/etc/suricata/rules/` — règles custom (pas les 106k ET qui seront re-téléchargées)
- [ ] `/etc/suricata/update.yaml` — sources rules (si présent)

<h3 align="center">rsyslog — BLOC 5</h3>

- [ ] `/etc/rsyslog.conf` — config receiver UDP 514
- [ ] `/etc/rsyslog.d/` — règles par hôte (site-01, site-02, pve, <ROUTER>)

<h3 align="center">AppArmor — BLOC 6</h3>

- [ ] `/etc/apparmor.d/usr.sbin.nginx` — profil nginx
- [ ] `/etc/apparmor.d/usr.bin.suricata` — profil suricata
- [ ] `aa-status --json` — état référence

<h3 align="center">UFW — BLOC 7</h3>

- [ ] `/etc/ufw/` complet (before.rules, after.rules, user.rules...)
- [ ] `ufw status verbose` exporté lisible

<h3 align="center">Scripts — BLOC 8</h3>

- [ ] `/opt/soc/` — 72 fichiers (monitoring_gen.py, soc.py, soc-daily-report.py, monitoring.sh...)
- [ ] `/usr/local/bin/pve-monitor-write` — script réception stats Proxmox
- [ ] `/var/www/monitoring/` — dashboard HTML+JS+CSS (sans monitoring.json live)

<h3 align="center">Crons — BLOC 9</h3>

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

<h3 align="center">Systemd — BLOC 10</h3>

- [ ] `/etc/systemd/system/soc-report-trigger.service` — service SOC custom
- [ ] `/etc/systemd/system/sshd.service` — SSH custom (port <SSH-PORT>)
- [ ] `systemctl list-units` — référence services actifs

<h3 align="center">AIDE — BLOC 11 (via complement)</h3>

- [ ] `/etc/aide/` — 247 fichiers (aide.conf + règles)
- [ ] ⚠ `/var/lib/aide/aide.db.gz` absent = NORMAL (recalculé après restore)

<h3 align="center">Logrotate — BLOC 11</h3>

- [ ] `/etc/logrotate.d/` — 20 fichiers (nginx, fail2ban, suricata, crowdsec...)

<h3 align="center">GeoIP — BLOC 11</h3>

- [ ] `/etc/GeoIP.conf` — Account ID + License Key MaxMind (sensible 🟡)
- [ ] ⚠ `/etc/default/geoipupdate` absent = NORMAL sur ce serveur

<h3 align="center">Clés API — BLOC 11</h3>

- [ ] `/etc/nginx/api-keys.conf` — NVD_API_KEY (sensible 🔴)

<h3 align="center">Clés SSH — BLOC 11</h3>

- [ ] `/root/.ssh/authorized_keys` — clé pve-monitor (Proxmox → srv-ngix)
- [ ] `/root/.ssh/<SSH-KEY-CLT>` + `.pub` — connexion root@<CLT-IP>
- [ ] `/root/.ssh/<SSH-KEY-PA85>` + `.pub` — connexion root@<PA85-IP>
- [ ] `/root/.ssh/<SSH-KEY-PVE>` + `.pub` — connexion root@<PROXMOX-IP>

---

<h2 align="center">PHASE 2 — Vérification de l'archive produite</h2>

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

<h3 align="center">Checklist blocs attendus</h3>

- [ ] `network/` présent (interfaces, hostname, ssh/, sysctl/, exim4/)
- [ ] `nginx/` présent (nginx.conf, sites-available/, snippets/, geoip/, letsencrypt/)
- [ ] `crowdsec/` présent (config/, bouncers/, decisions-export.json, collections.json)
- [ ] `fail2ban/` présent (jail.local, filter.d/, action.d/, crowdsec-sync.conf)
- [ ] `suricata/` présent (suricata.yaml, rules/)
- [ ] `rsyslog/` présent (rsyslog.conf, rsyslog.d/)
- [ ] `apparmor/` présent (profils nginx + suricata + aa-status.json)
- [ ] `ufw/` présent (configs + ufw-status-verbose.txt)
- [ ] `scripts/` présent (opt-soc/, usr-local-bin/, dashboard/)
- [ ] `crons/` présent (cron.d/ avec 11 fichiers)
- [ ] `systemd/` présent (soc-report-trigger.service + services-actifs.txt)
- [ ] `aide/` présent (/etc/aide/ complet)
- [ ] `logrotate/` présent (20 fichiers)
- [ ] `geoip/` présent (GeoIP.conf)
- [ ] `api-keys/` présent (api-keys.conf)
- [ ] `ssh/` présent (authorized_keys + 3 clés privées sync)
- [ ] `metadata/` présent (versions.txt, dpkg-selections.txt)
- [ ] `README-RESTORE.md` présent à la racine

<h3 align="center">Vérification simulation restauration</h3>

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

<h2 align="center">PHASE 3 — Vérification post-restauration (nouveau serveur)</h2>

<h3 align="center">Réseau</h3>

- [ ] `hostname` → `srv-ngix`
- [ ] `ip addr show` → <SRV-NGIX-IP>/24
- [ ] `ip route` → default via <LAN-IP>
- [ ] `ssh -p <SSH-PORT> root@<SRV-NGIX-IP> hostname` → `srv-ngix` (depuis LAN)
- [ ] `sysctl net.ipv4.conf.all.rp_filter` → `2`
- [ ] `echo "test SOC" | mail -s test admin@domain.fr` → mail reçu (exim4 SMTP <MAIL-PROVIDER>)

<h3 align="center">Services actifs</h3>

```bash
systemctl is-active nginx crowdsec suricata fail2ban rsyslog
# Attendu : active × 5
```
- [ ] nginx → active
- [ ] crowdsec → active
- [ ] suricata → active
- [ ] fail2ban → active
- [ ] rsyslog → active

<h3 align="center">CrowdSec</h3>

```bash
cscli decisions list | wc -l      # > 0
cscli bouncers list                # crowdsec-firewall-bouncer présent
cscli collections list | grep linux-lpe  # collection installée
```
- [ ] Bouncers actifs
- [ ] Décisions restaurées
- [ ] Collections installées

<h3 align="center">nginx</h3>

```bash
nginx -t                           # OK
curl -sI https://<DOMAIN-COM>/ | head -3  # 200 ou 301
curl -sI http://<SRV-NGIX-IP>:8080/ | head -3   # dashboard
```
- [ ] `nginx -t` → OK
- [ ] Sites répondent (<DOMAIN-COM>, site-02)
- [ ] Dashboard SOC accessible http://<SRV-NGIX-IP>:8080/

<h3 align="center">Crons</h3>

```bash
ls -la /etc/cron.d/               # 11 fichiers
ls -la /etc/cron.d/ | wc -l       # ≥ 13 (11 + . + ..)
```
- [ ] 11 fichiers présents dans `/etc/cron.d/`
- [ ] permissions 644 sur tous les fichiers cron.d

<h3 align="center">Suricata</h3>

```bash
suricata-update                   # téléchargement règles ET
systemctl reload suricata
tail -5 /var/log/suricata/suricata.log  # pas d'erreur AF_PACKET
```
- [ ] Règles ET téléchargées (~106k)
- [ ] Suricata rechargé sans erreur
- [ ] Log ne contient pas "rp_filter" warning

<h3 align="center">AIDE</h3>

```bash
aide --init                       # 1-2 min
mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
aide --check                      # 0 changement
```
- [ ] `aide --init` termine sans erreur
- [ ] `aide --check` → aucune modification détectée

<h3 align="center">Clés API</h3>

```bash
grep -v "^#" /etc/nginx/api-keys.conf  # NVD_API_KEY présente
stat -c "%a %U" /etc/nginx/api-keys.conf  # 600 root
```
- [ ] api-keys.conf présent avec la clé NVD
- [ ] Permissions 600 root:root

<h3 align="center">Dashboard SOC</h3>

- [ ] http://<SRV-NGIX-IP>:8080/ charge sans erreur JS
- [ ] ThreatScore affiché (pas N/A)
- [ ] Tuile Services : nginx/crowdsec/suricata/fail2ban tous verts
- [ ] Tuile CrowdSec : bans affichés

---

<h2 align="center">Récapitulatif fichiers sensibles à protéger</h2>

| Fichier | Risque | Action |
|---------|--------|--------|
| `nginx/letsencrypt/` | 🔴 Clés privées SSL | Archive sur support chiffré uniquement |
| `crowdsec/local_api_credentials.yaml` | 🔴 Token API CrowdSec | Stocker hors NAS public |
| `api-keys/api-keys.conf` | 🔴 NVD API key | Stocker hors NAS public |
| `network/exim4/passwd.client` | 🔴 Password SMTP <MAIL-PROVIDER> | Stocker hors NAS public |
| `geoip/GeoIP.conf` | 🟡 License Key MaxMind | Accès restreint |
| `ssh/id_site-01_sync` + autres | 🟡 Clés SSH privées sync | Stocker hors NAS public |
| `ssh/authorized_keys` | 🟡 Clé SSH pve-monitor | Accès restreint |

**Règle absolue : stocker l'archive dans `D:\BACKUP-PROXMOX\` uniquement — jamais sur un NAS accessible depuis le LAN non chiffré.**

---

<h2 align="center">Commandes de vérification rapide (one-liner)</h2>

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

## Stack technique

<table>
<tr>
<td align="center"><b>🖥️ Infrastructure & Sécurité</b></td>
<td align="center"><b>💻 Développement & Web</b></td>
<td align="center"><b>🤖 Intelligence Artificielle</b></td>
</tr>
<tr>
<td align="center">
  <a href="https://www.kernel.org/"><img src="https://skillicons.dev/icons?i=linux" width="48" title="Linux" /></a>
  <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="48" title="Debian" /></a>
  <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="48" title="Bash" /></a>
  <br/>
  <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="48" title="Nginx" /></a>
  <a href="https://www.docker.com"><img src="https://skillicons.dev/icons?i=docker" width="48" title="Docker" /></a>
  <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="48" title="Git" /></a>
</td>
<td align="center">
  <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="48" title="Python" /></a>
  <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="48" title="Flask" /></a>
  <a href="https://developer.mozilla.org/docs/Web/HTML"><img src="https://skillicons.dev/icons?i=html" width="48" title="HTML5" /></a>
  <br/>
  <a href="https://developer.mozilla.org/docs/Web/CSS"><img src="https://skillicons.dev/icons?i=css" width="48" title="CSS3" /></a>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="48" title="JavaScript" /></a>
  <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="48" title="VS Code" /></a>
</td>
<td align="center">
  <a href="https://pytorch.org"><img src="https://skillicons.dev/icons?i=pytorch" width="48" title="PyTorch" /></a>
  <a href="https://www.tensorflow.org"><img src="https://skillicons.dev/icons?i=tensorflow" width="48" title="TensorFlow" /></a>
  <a href="https://www.raspberrypi.com"><img src="https://skillicons.dev/icons?i=raspberrypi" width="48" title="Raspberry Pi" /></a>
  <br/><br/>
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  &nbsp;
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projets proposés par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Développés en collaboration avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>
