<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ERUNBOOK_" alt="SOC 0xCyberLiTech" />
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

> Ce document décrit le déploiement complet du SOC sur une VM Debian 13 fraîchement installée.
> Le script `deploy-soc.sh` automatise toutes les étapes avec mode simulation.

---

<h2 align="center">Prérequis VM</h2>

| Élément | Minimum | Recommandé |
|---------|---------|-----------|
| OS | Debian 13 (Trixie) | Debian 13 + mises à jour |
| RAM | 4 Go | 14 Go |
| Disque | 30 Go | 50 Go |
| CPU | 2 vCPU | 4 vCPU |
| Réseau | 1 interface | eth0 avec IP fixe |
| Accès | root SSH | root SSH clé publique |

**Backends à protéger :** deux serveurs Apache accessibles depuis srv-ngix
- `site-01` : <CLT-IP>:80
- `site-02` : <PA85-IP>:80

---

<h2 align="center">Utilisation du script de déploiement</h2>

```bash
# Télécharger le script sur la VM cible
scp deploy-soc.sh root@<IP_VM>:/root/

# Mode simulation (aucune modification — aperçu de ce qui sera fait)
bash deploy-soc.sh --dry-run

# Déploiement complet
bash deploy-soc.sh

# Étape spécifique uniquement
bash deploy-soc.sh --step nginx
bash deploy-soc.sh --step crowdsec
bash deploy-soc.sh --step fail2ban
bash deploy-soc.sh --step suricata
bash deploy-soc.sh --step apparmor
bash deploy-soc.sh --step rsyslog
bash deploy-soc.sh --step dashboard
```

---

<h2 align="center">Script de déploiement `deploy-soc.sh`</h2>

```bash
#!/usr/bin/env bash
# =============================================================================
# deploy-soc.sh — Déploiement SOC 0xCyberLiTech sur Debian 13
# Version : 1.0.0 — 2026-04-25
# Usage   : bash deploy-soc.sh [--dry-run] [--step <nom>]
# =============================================================================

set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Configuration — ADAPTER À VOTRE ENVIRONNEMENT ────────────────────────────
VM_IP="<SRV-NGIX-IP>"
CLT_IP="<CLT-IP>"
PA85_IP="<PA85-IP>"
LAN_CIDR="<LAN-SUBNET>"
LAN2_CIDR="<ROUTER-SUBNET>"
SSH_PORT="<SSH-PORT>"
DOMAIN_COM="0xcyberlitech.com"
DOMAIN_FR="0xcyberlitech.fr"
MONITORING_DIR="/var/www/monitoring"
SCRIPTS_DIR="/opt/site-01"
GEOIP_ACCOUNT_ID=""         # Renseigner votre MaxMind Account ID
GEOIP_LICENSE_KEY=""        # Renseigner votre MaxMind License Key
MAIL_DEST="admin@example.com"

# ── Paramètres runtime ────────────────────────────────────────────────────────
DRY_RUN=false
STEP_ONLY=""

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --step) STEP_ONLY="${2:-}" ; shift ;;
    *) ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo -e "${CYAN}[SOC]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC}  $*"; }
skip() { echo -e "${YELLOW}[SKIP]${NC} $* (mode simulation)"; }

run() {
  # Exécute une commande ou affiche en mode dry-run
  if $DRY_RUN; then
    skip "CMD: $*"
  else
    eval "$@"
  fi
}

pkg_installed() {
  dpkg -l "$1" 2>/dev/null | grep -q '^ii'
}

pkg_ensure() {
  local pkg="$1"
  if pkg_installed "$pkg"; then
    ok "Paquet déjà installé : $pkg"
  else
    warn "Paquet manquant : $pkg — installation..."
    run "apt-get install -y $pkg"
  fi
}

service_active() {
  systemctl is-active --quiet "$1" 2>/dev/null
}

step_active() {
  [[ -z "$STEP_ONLY" || "$STEP_ONLY" == "$1" ]]
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   SOC 0xCyberLiTech — Déploiement Debian 13             ║"
echo "║   Version 1.0.0 · $(date '+%Y-%m-%d %H:%M')                     ║"
$DRY_RUN && echo "║   MODE SIMULATION — aucune modification                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Vérifications préalables ──────────────────────────────────────────────────
log "Vérification des prérequis système..."

[[ $EUID -ne 0 ]] && { err "Ce script doit être exécuté en root."; exit 1; }

OS_ID=$(grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
OS_VER=$(grep '^VERSION_CODENAME=' /etc/os-release | cut -d= -f2 | tr -d '"')
[[ "$OS_ID" != "debian" ]] && { err "OS non supporté : $OS_ID (Debian requis)"; exit 1; }
[[ "$OS_VER" != "trixie" ]] && warn "Version Debian : $OS_VER (trixie recommandé)"
ok "OS détecté : Debian $OS_VER"

RAM_MB=$(free -m | awk '/Mem:/{print $2}')
[[ $RAM_MB -lt 2048 ]] && warn "RAM faible : ${RAM_MB} Mo (2048 Mo minimum recommandé)"
ok "RAM disponible : ${RAM_MB} Mo"

DISK_GB=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
[[ $DISK_GB -lt 10 ]] && { err "Espace disque insuffisant : ${DISK_GB} Go (10 Go minimum)"; exit 1; }
ok "Espace disque libre : ${DISK_GB} Go"

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 1 — Configuration système initiale
# ══════════════════════════════════════════════════════════════════════════════
if step_active "system"; then
  log "══ ÉTAPE 1 — Configuration système ══"

  run "apt-get update -qq"
  run "apt-get upgrade -y"
  run "apt-get install -y curl wget git unzip gnupg2 lsb-release ca-certificates \
       software-properties-common apt-transport-https python3 python3-pip \
       python3-venv logrotate cron rsyslog ufw fail2ban apparmor apparmor-utils \
       exim4 mailutils"

  ok "Paquets système de base installés"

  # Timezone
  run "timedatectl set-timezone Europe/Paris"
  ok "Timezone : Europe/Paris"

  # Hostname
  run "hostnamectl set-hostname srv-ngix"
  ok "Hostname : srv-ngix"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 2 — SSH hardening (port <SSH-PORT>, clé uniquement)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "ssh"; then
  log "══ ÉTAPE 2 — Hardening SSH ══"

  SSH_CFG="/etc/ssh/sshd_config"

  if grep -q "^Port <SSH-PORT>" "$SSH_CFG" 2>/dev/null; then
    ok "SSH déjà configuré sur port <SSH-PORT>"
  else
    warn "Configuration SSH à modifier..."
    run "sed -i 's/^#\?Port .*/Port <SSH-PORT>/' $SSH_CFG"
    run "sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' $SSH_CFG"
    run "sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' $SSH_CFG"
    run "sed -i 's/^#\?MaxAuthTries .*/MaxAuthTries 3/' $SSH_CFG"
    run "sed -i 's/^#\?X11Forwarding .*/X11Forwarding no/' $SSH_CFG"
    run "systemctl reload sshd"
    ok "SSH configuré : port <SSH-PORT> · clé uniquement · MaxAuthTries 3"
    warn "⚠️  Ouvrir le port <SSH-PORT> dans UFW AVANT de se déconnecter !"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 3 — UFW
# ══════════════════════════════════════════════════════════════════════════════
if step_active "ufw"; then
  log "══ ÉTAPE 3 — UFW ══"

  pkg_ensure ufw

  if ufw status | grep -q "Status: active"; then
    ok "UFW déjà actif"
  else
    run "ufw --force reset"
    run "ufw default deny incoming"
    run "ufw default deny outgoing"
    run "ufw default disabled routed"

    # Entrants
    run "ufw allow 80/tcp comment 'HTTP'"
    run "ufw allow 443/tcp comment 'HTTPS'"
    run "ufw allow from ${LAN_CIDR} to any port ${SSH_PORT} proto tcp comment 'SSH from LAN'"
    run "ufw allow from ${LAN2_CIDR} to any port ${SSH_PORT} proto tcp comment 'SSH from LAN2'"
    run "ufw allow from ${LAN_CIDR} to ${VM_IP} port 8080 proto tcp comment 'Monitoring LAN'"
    run "ufw allow from ${LAN2_CIDR} to any port 8080 proto tcp comment 'Monitoring LAN2'"
    run "ufw allow from ${LAN_CIDR} to any port 514 proto tcp comment 'rsyslog-central-tcp'"
    run "ufw allow from ${LAN_CIDR} to any port 514 proto udp comment 'rsyslog-central-udp'"

    # Sortants
    run "ufw allow out to ${CLT_IP} port 80 comment 'Backend Apache CLT'"
    run "ufw allow out to ${PA85_IP} port 80 comment 'Backend Apache PA85'"
    run "ufw allow out 53 comment 'DNS'"
    run "ufw allow out 80/tcp comment 'Updates HTTP'"
    run "ufw allow out 443/tcp comment 'HTTPS out'"
    run "ufw allow out 123/udp comment 'NTP'"
    run "ufw allow out 587/tcp comment 'SMTP alertes'"
    run "ufw allow out to ${CLT_IP} port ${SSH_PORT} proto tcp comment 'SSH sync site-01'"
    run "ufw allow out to ${PA85_IP} port ${SSH_PORT} proto tcp comment 'SSH monitoring site-02'"

    run "ufw --force enable"
    ok "UFW configuré et activé"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 4 — nginx + modules
# ══════════════════════════════════════════════════════════════════════════════
if step_active "nginx"; then
  log "══ ÉTAPE 4 — nginx ══"

  pkg_ensure nginx
  pkg_ensure libnginx-mod-http-geoip2
  pkg_ensure libnginx-mod-http-headers-more-filter

  # Vérifier server_tokens
  if grep -q 'server_tokens off' /etc/nginx/nginx.conf 2>/dev/null; then
    ok "server_tokens off déjà présent"
  else
    run "sed -i '/sendfile on;/a\\        server_tokens off;\\n        more_clear_headers Server;' /etc/nginx/nginx.conf"
  fi

  # Créer le répertoire monitoring
  run "mkdir -p ${MONITORING_DIR}/{js,css,libs}"
  run "chown -R www-data:www-data ${MONITORING_DIR}"

  ok "nginx configuré"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 5 — GeoIP2 MaxMind
# ══════════════════════════════════════════════════════════════════════════════
if step_active "geoip"; then
  log "══ ÉTAPE 5 — GeoIP2 MaxMind ══"

  pkg_ensure geoipupdate

  if [[ -z "$GEOIP_ACCOUNT_ID" || -z "$GEOIP_LICENSE_KEY" ]]; then
    warn "GEOIP_ACCOUNT_ID / GEOIP_LICENSE_KEY non renseignés — GeoIP ignoré"
    warn "Renseignez ces variables en haut du script et relancez avec --step geoip"
  else
    GEOIP_CFG="/etc/GeoIP.conf"
    run "cat > $GEOIP_CFG << 'EOF'
AccountID ${GEOIP_ACCOUNT_ID}
LicenseKey ${GEOIP_LICENSE_KEY}
EditionIDs GeoLite2-Country GeoLite2-City
DatabaseDirectory /usr/share/GeoIP
EOF"
    run "geoipupdate"
    ok "Bases GeoIP2 téléchargées"

    # Cron mise à jour hebdomadaire (dimanche 01h00)
    run "echo '0 1 * * 0 root geoipupdate >> /var/log/geoipupdate.log 2>&1' > /etc/cron.d/geoipupdate"
    ok "Cron GeoIP2 configuré (dim. 01h00)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 6 — TLS Let's Encrypt
# ══════════════════════════════════════════════════════════════════════════════
if step_active "tls"; then
  log "══ ÉTAPE 6 — TLS Let's Encrypt ══"

  pkg_ensure certbot
  pkg_ensure python3-certbot-nginx

  if [[ -f "/etc/letsencrypt/live/${DOMAIN_COM}/fullchain.pem" ]]; then
    ok "Certificat ${DOMAIN_COM} déjà présent"
  else
    warn "Certificat absent — à générer manuellement :"
    warn "certbot --nginx -d ${DOMAIN_COM} -d www.${DOMAIN_COM} -d ${DOMAIN_FR}"
    warn "(Nécessite le DNS pointant vers cette VM)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 7 — CrowdSec
# ══════════════════════════════════════════════════════════════════════════════
if step_active "crowdsec"; then
  log "══ ÉTAPE 7 — CrowdSec ══"

  if pkg_installed crowdsec; then
    ok "CrowdSec déjà installé — version : $(cscli version 2>/dev/null | head -1)"
  else
    warn "Installation CrowdSec..."
    run "curl -s https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh | bash"
    run "apt-get install -y crowdsec"
    ok "CrowdSec installé"
  fi

  # Bouncer nftables
  if pkg_installed crowdsec-firewall-bouncer-nftables; then
    ok "Bouncer nftables déjà installé"
  else
    run "apt-get install -y crowdsec-firewall-bouncer-nftables"
    ok "Bouncer nftables installé"
  fi

  # Collections
  COLLECTIONS="crowdsecurity/nginx crowdsecurity/http-cve crowdsecurity/http-dos
               crowdsecurity/linux crowdsecurity/sshd crowdsecurity/suricata
               crowdsecurity/whitelist-good-actors"

  for col in $COLLECTIONS; do
    if cscli collections list 2>/dev/null | grep -q "${col}.*enabled"; then
      ok "Collection déjà active : $col"
    else
      run "cscli collections install $col"
      ok "Collection installée : $col"
    fi
  done

  # AppSec (WAF)
  if cscli appsec-configs list 2>/dev/null | grep -q 'crowdsecurity/appsec-default'; then
    ok "AppSec WAF déjà configuré"
  else
    run "cscli appsec-configs install crowdsecurity/appsec-default"
    run "cscli appsec-rules install crowdsecurity/appsec-default"
    ok "AppSec WAF configuré"
  fi

  run "systemctl enable --now crowdsec"
  ok "CrowdSec actif"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 8 — Fail2ban
# ══════════════════════════════════════════════════════════════════════════════
if step_active "fail2ban"; then
  log "══ ÉTAPE 8 — Fail2ban ══"

  pkg_ensure fail2ban

  F2B_LOCAL="/etc/fail2ban/jail.local"

  if [[ -f "$F2B_LOCAL" ]] && grep -q 'crowdsec-sync' "$F2B_LOCAL" 2>/dev/null; then
    ok "jail.local déjà configuré avec crowdsec-sync"
  else
    warn "Configuration jail.local..."
    run "cat > $F2B_LOCAL << 'JAILEOF'
[DEFAULT]
bantime  = 86400
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8 ::1 ${LAN_CIDR}

[sshd]
enabled  = true
port     = ${SSH_PORT}
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400
action   = crowdsec-sync[name=sshd]

[nginx-cve]
enabled  = true
filter   = nginx-cve
logpath  = /var/log/nginx/access.log
maxretry = 1
bantime  = 86400
action   = crowdsec-sync[name=nginx-cve]

[nginx-botsearch]
enabled  = true
filter   = nginx-http-auth
logpath  = /var/log/nginx/access.log
maxretry = 2
bantime  = 86400
action   = crowdsec-sync[name=nginx-botsearch]
JAILEOF"
    ok "jail.local configuré"
  fi

  # Action crowdsec-sync
  F2B_ACTION="/etc/fail2ban/action.d/crowdsec-sync.conf"
  if [[ ! -f "$F2B_ACTION" ]]; then
    run "cat > $F2B_ACTION << 'ACTEOF'
[Definition]
actionban   = cscli decisions add --ip <ip> --reason "fail2ban-%(name)s" --duration 24h
actionunban = cscli decisions delete --ip <ip>
ACTEOF"
    ok "Action crowdsec-sync créée"
  else
    ok "Action crowdsec-sync déjà présente"
  fi

  run "systemctl enable --now fail2ban"
  ok "Fail2ban actif — jails : sshd · nginx-cve · nginx-botsearch"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 9 — Suricata IDS
# ══════════════════════════════════════════════════════════════════════════════
if step_active "suricata"; then
  log "══ ÉTAPE 9 — Suricata IDS ══"

  if pkg_installed suricata; then
    ok "Suricata déjà installé — version : $(suricata --build-info 2>/dev/null | grep 'Version' | head -1)"
  else
    run "apt-get install -y suricata suricata-update"
    ok "Suricata installé"
  fi

  # Mise à jour des règles
  run "suricata-update"

  # Interface réseau
  ETH=$(ip route | grep default | awk '{print $5}' | head -1)
  if grep -q "interface: ${ETH}" /etc/suricata/suricata.yaml 2>/dev/null; then
    ok "Suricata interface déjà configurée : $ETH"
  else
    run "sed -i \"s/interface: eth0/interface: ${ETH}/\" /etc/suricata/suricata.yaml"
    ok "Suricata interface : $ETH"
  fi

  # Collection CrowdSec pour Suricata
  run "cscli collections install crowdsecurity/suricata 2>/dev/null || true"

  run "systemctl enable --now suricata"
  ok "Suricata actif"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 10 — AppArmor
# ══════════════════════════════════════════════════════════════════════════════
if step_active "apparmor"; then
  log "══ ÉTAPE 10 — AppArmor ══"

  pkg_ensure apparmor
  pkg_ensure apparmor-utils

  for svc in nginx suricata; do
    PROFILE=$(aa-status 2>/dev/null | grep -c "$svc" || echo 0)
    if [[ $PROFILE -gt 0 ]]; then
      ok "AppArmor profil $svc déjà chargé"
    else
      warn "Profil $svc absent — vérifier /etc/apparmor.d/"
    fi
  done

  # S'assurer que nginx et suricata sont en enforce
  for svc in usr.sbin.nginx usr.bin.suricata; do
    PROF="/etc/apparmor.d/$svc"
    [[ -f "$PROF" ]] && run "aa-enforce $PROF 2>/dev/null || true"
  done

  ok "AppArmor vérifié"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 11 — rsyslog récepteur central
# ══════════════════════════════════════════════════════════════════════════════
if step_active "rsyslog"; then
  log "══ ÉTAPE 11 — rsyslog récepteur central ══"

  pkg_ensure rsyslog

  RSYSLOG_CFG="/etc/rsyslog.d/10-central-receiver.conf"

  if [[ -f "$RSYSLOG_CFG" ]]; then
    ok "Récepteur rsyslog déjà configuré"
  else
    warn "Configuration récepteur rsyslog..."
    run "cat > $RSYSLOG_CFG << 'RSEOF'
# Récepteur central rsyslog — SOC 0xCyberLiTech
# TCP + UDP port 514 — tous hôtes LAN

module(load=\"imtcp\")
module(load=\"imudp\")
input(type=\"imtcp\" port=\"514\")
input(type=\"imudp\" port=\"514\")

# Template : fichier par hôte/programme
\\\$template RemoteLogs,\"/var/log/central/%HOSTNAME%/%PROGRAMNAME%.log\"

# Filtres bruit global
if \\\$programname contains '(sd-pam)' then stop
if \\\$programname startswith 'systemd' then stop
if \\\$programname == 'CRON' then stop

# Tout ce qui vient d'un hôte distant → fichier séparé
if \\\$fromhost-ip != '127.0.0.1' then {
  action(type=\"omfile\" dynaFile=\"RemoteLogs\" FileCreateMode=\"0640\")
  stop
}
RSEOF"
    run "mkdir -p /var/log/central"
    run "systemctl restart rsyslog"
    ok "Récepteur rsyslog configuré — logs dans /var/log/central/"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 12 — Scripts Python SOC
# ══════════════════════════════════════════════════════════════════════════════
if step_active "scripts"; then
  log "══ ÉTAPE 12 — Scripts Python SOC ══"

  pkg_ensure python3
  pkg_ensure python3-pip

  # Dépendances Python
  PYTHON_PKGS="flask requests geoip2 python-dateutil"
  for pkg in $PYTHON_PKGS; do
    if python3 -c "import ${pkg//-/_}" 2>/dev/null; then
      ok "Python : $pkg déjà installé"
    else
      run "pip3 install $pkg --break-system-packages"
      ok "Python : $pkg installé"
    fi
  done

  run "mkdir -p $SCRIPTS_DIR"

  # Copier les scripts depuis le poste de dev
  warn "⚠️  Copier manuellement les scripts depuis votre poste :"
  warn "  scp monitoring_gen.py soc.py soc-daily-report.py proto-live.py root@${VM_IP}:${SCRIPTS_DIR}/"

  ok "Répertoire scripts : $SCRIPTS_DIR"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 13 — Dashboard SOC (fichiers statiques)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "dashboard"; then
  log "══ ÉTAPE 13 — Dashboard SOC ══"

  run "mkdir -p ${MONITORING_DIR}/{js,css,libs}"

  warn "⚠️  Copier manuellement les fichiers dashboard depuis votre poste :"
  warn "  scp index.html root@${VM_IP}:${MONITORING_DIR}/"
  warn "  scp js/*.js root@${VM_IP}:${MONITORING_DIR}/js/"
  warn "  scp css/monitoring.css root@${VM_IP}:${MONITORING_DIR}/css/"

  run "chown -R www-data:www-data $MONITORING_DIR"
  ok "Répertoire dashboard préparé : $MONITORING_DIR"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 14 — Crons
# ══════════════════════════════════════════════════════════════════════════════
if step_active "crons"; then
  log "══ ÉTAPE 14 — Crons ══"

  CRON_SOC="/etc/cron.d/soc-monitoring"

  if [[ -f "$CRON_SOC" ]]; then
    ok "Crons SOC déjà présents"
  else
    run "cat > $CRON_SOC << 'CRONEOF'
# SOC 0xCyberLiTech — tâches planifiées
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Génération monitoring.json toutes les 5 minutes
*/5 * * * * root ${SCRIPTS_DIR}/monitoring.sh >> /var/log/monitoring-gen.log 2>&1

# Stats protocoles temps réel (toutes les minutes)
* * * * * root python3 ${SCRIPTS_DIR}/proto-live.py >> /var/log/proto-live.log 2>&1

# Rapport quotidien mail 8h00
0 8 * * * root python3 ${SCRIPTS_DIR}/soc-daily-report.py >> /var/log/soc-report.log 2>&1

# Mise à jour règles Suricata (quotidien 03h15)
15 3 * * * root suricata-update >> /var/log/suricata-update.log 2>&1 && systemctl reload suricata

# Vérification intégrité AIDE (nightly 03h00)
0 3 * * * root /usr/bin/aide --config /etc/aide/aide.conf --check >> /var/log/aide/aide.log 2>&1
CRONEOF"
    ok "Crons SOC configurés"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 15 — Mail (exim4)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "mail"; then
  log "══ ÉTAPE 15 — Mail (exim4) ══"

  pkg_ensure exim4
  pkg_ensure mailutils

  if exim4 --version 2>/dev/null | grep -q 'Exim'; then
    ok "Exim4 déjà configuré"
    warn "Vérifier la configuration : dpkg-reconfigure exim4-config"
    warn "Type : internet site ou smarthost selon votre FAI"
  else
    warn "Configurer exim4 manuellement : dpkg-reconfigure exim4-config"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 16 — AIDE (intégrité fichiers)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "aide"; then
  log "══ ÉTAPE 16 — AIDE intégrité ══"

  pkg_ensure aide

  if [[ -f "/var/lib/aide/aide.db" ]]; then
    ok "Base AIDE déjà initialisée"
  else
    warn "Initialisation base AIDE (peut prendre plusieurs minutes)..."
    run "aideinit -y -f"
    run "cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db"
    ok "Base AIDE initialisée — re-baseline requis après chaque modification système"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ÉTAPE 17 — Logrotate
# ══════════════════════════════════════════════════════════════════════════════
if step_active "logrotate"; then
  log "══ ÉTAPE 17 — Logrotate ══"

  run "cat > /etc/logrotate.d/soc-monitoring << 'LREOF'
/var/log/monitoring-gen.log
/var/log/proto-live.log
/var/log/soc-report.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}

/var/log/central/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    maxsize 20M
    postrotate
        pkill -HUP rsyslogd 2>/dev/null || true
    endscript
}
LREOF"
  ok "Logrotate SOC configuré (7j, compress)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Déploiement terminé${NC}"
$DRY_RUN && echo -e "${YELLOW}  MODE SIMULATION — aucune modification effectuée${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Étapes manuelles restantes :"
echo "  1. Copier les scripts Python : monitoring_gen.py soc.py etc."
echo "  2. Copier les fichiers dashboard (js/ css/ index.html)"
echo "  3. Configurer les vhosts nginx (site-01, site-02, monitoring)"
echo "  4. Générer les certificats TLS : certbot --nginx -d ${DOMAIN_COM}"
echo "  5. Tester : bash deploy-soc.sh --step aide (initialisation AIDE)"
echo "  6. Consulter la checklist : CHECKLIST-DEPLOY.md"
echo ""
```

---

<h2 align="center">Étapes manuelles post-script</h2>

<h3 align="center">1. Vhosts nginx</h3>

```nginx
# /etc/nginx/sites-available/site-01
server {
    listen 80;
    server_name 0xcyberlitech.com www.0xcyberlitech.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name 0xcyberlitech.com www.0xcyberlitech.com;

    ssl_certificate     /etc/letsencrypt/live/0xcyberlitech.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/0xcyberlitech.com/privkey.pem;

    # Headers sécurité
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; object-src 'none';" always;

    location / {
        proxy_pass http://<CLT-IP>:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```nginx
# /etc/nginx/sites-available/monitoring
server {
    listen 8080;
    server_name _;

    # Accès LAN uniquement (redondant avec UFW — double sécurité)
    allow <LAN-SUBNET>;
    allow <ROUTER-SUBNET>;
    deny all;

    root /var/www/monitoring;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(json)$ {
        add_header Cache-Control "no-cache, no-store";
    }
}
```

<h3 align="center">2. Copie des fichiers dashboard</h3>

```bash
# Depuis le poste de développement Windows
scp -i ~/.ssh/id_nginx -P <SSH-PORT> -o IdentitiesOnly=yes \
  "C:/Users/mmsab/Documents/0xCyberLiTech/SOC/dashboard/index.html" \
  root@<SRV-NGIX-IP>:/var/www/monitoring/index.html

scp -i ~/.ssh/id_nginx -P <SSH-PORT> -o IdentitiesOnly=yes \
  "C:/Users/mmsab/Documents/0xCyberLiTech/SOC/dashboard/js/"*.js \
  root@<SRV-NGIX-IP>:/var/www/monitoring/js/

scp -i ~/.ssh/id_nginx -P <SSH-PORT> -o IdentitiesOnly=yes \
  "C:/Users/mmsab/Documents/0xCyberLiTech/SOC/dashboard/css/monitoring.css" \
  root@<SRV-NGIX-IP>:/var/www/monitoring/css/
```

<h3 align="center">3. Copie des scripts Python</h3>

```bash
scp -i ~/.ssh/id_nginx -P <SSH-PORT> -o IdentitiesOnly=yes \
  "C:/Users/mmsab/Documents/0xCyberLiTech/SOC/scripts/"*.py \
  root@<SRV-NGIX-IP>:/opt/site-01/
```

<h3 align="center">4. Test final</h3>

```bash
# Vérification services
systemctl is-active nginx crowdsec fail2ban ufw rsyslog suricata

# Test dashboard
curl -s http://localhost:8080/ | head -5

# Test CrowdSec
cscli bouncers list

# Test mail
echo "Test SOC" | mail -s "[SOC] Test déploiement" admin@example.com
```

---
---

<div align="center">

  <br></br>

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

  <br></br>

  <sub>🔒 Projet <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> &nbsp;·&nbsp; Co-développé avec <a href="https://claude.ai">Claude AI</a> · Anthropic 🔒</sub>

  <br></br>

  <a href="../README.md">
    <img src="https://img.shields.io/badge/↑%20Retour%20au%20README-SOC-00B4D8?style=flat-square&logo=github" alt="Retour README" />
  </a>

</div>
