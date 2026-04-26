#!/usr/bin/env bash
# =============================================================================
# deploy-soc.sh — Déploiement complet SOC 0xCyberLiTech sur Debian 13
# =============================================================================
# Usage :
#   bash DEPLOY/deploy-soc.sh              # installation complète
#   bash DEPLOY/deploy-soc.sh --dry-run    # simulation (aucune modification)
#   bash DEPLOY/deploy-soc.sh --step nginx # une seule étape
#
# Prérequis :
#   - Debian 13 (Trixie) avec accès root
#   - Ce script doit être lancé depuis la racine du dépôt SOC cloné
#   - Adapter le bloc CONFIG ci-dessous à votre infrastructure
#
# Étapes couvertes :
#   system · ssh · ufw · nginx · geoip · tls · crowdsec · fail2ban
#   suricata · apparmor · rsyslog · scripts · dashboard · configs
#   crons · mail · aide · logrotate
# =============================================================================

set -euo pipefail

# ═════════════════════════════════════════════════════════════════════════════
# CONFIG — ADAPTER À VOTRE INFRASTRUCTURE AVANT DE LANCER
# ═════════════════════════════════════════════════════════════════════════════
VM_IP="<SRV-NGIX-IP>"          # IP VM nginx + SOC          ex: 203.0.113.10
CLT_IP="<CLT-IP>"              # IP VM site-01 (Apache)      ex: 203.0.113.11
PA85_IP="<PA85-IP>"            # IP VM site-02 (Apache)      ex: 203.0.113.12
PROXMOX_IP="<PROXMOX-IP>"      # IP hyperviseur Proxmox VE   ex: 203.0.113.1
BOX_IP="<BOX-IP>"              # IP locale de la box FAI     ex: 192.168.0.1
ROUTER_IP="<ROUTER-IP>"        # IP du routeur               ex: 192.168.0.254
LAN_CIDR="<LAN-CIDR>"          # Sous-réseau LAN             ex: 203.0.113.0/24
LAN2_CIDR="<ROUTER-SUBNET>"    # Sous-réseau routeur/gestion ex: 203.0.113.128/25
SSH_PORT="<SSH-PORT>"          # Port SSH non standard       ex: 2222
SSH_KEY="<SSH-KEY>"            # Nom de clé SSH (dashboard)  ex: id_nginx
SSH_KEY_NGIX="<SSH-KEY-NGIX>"  # Clé SSH monitoring→ngix     ex: /root/.ssh/id_nginx_sync
SSH_KEY_CLT="<SSH-KEY-CLT>"    # Clé SSH monitoring→clt      ex: /root/.ssh/id_clt_sync
SSH_KEY_PA85="<SSH-KEY-PA85>"  # Clé SSH monitoring→pa85     ex: /root/.ssh/id_pa85_sync
SSH_KEY_PVE="<SSH-KEY-PVE>"    # Clé SSH monitoring→proxmox  ex: /root/.ssh/id_proxmox_sync
DOMAIN_COM="<DOMAIN-COM>"      # Domaine principal           ex: monsite.com
DOMAIN_FR="<DOMAIN-FR>"        # Domaine secondaire          ex: monsite.fr
MAIL_DEST="<MAIL-DEST>"        # Email alertes SOC           ex: admin@monsite.com
WAN_LAT="0.0"                  # Latitude de la box (décimal) ex: 48.8566 (Paris)
WAN_LON="0.0"                  # Longitude de la box (décimal) ex: 2.3522 (Paris)
ISP_HOST_1="<ISP-HOST-1>"      # Sonde ISP primaire           ex: www.orange.fr
ISP_HOST_2="<ISP-HOST-2>"      # Sonde ISP secondaire         ex: assistance.orange.fr
ISP_NAME="<ISP-NAME>"          # Nom de l'opérateur FAI       ex: Orange Fibre
ISP_SLUG="<ISP-SLUG>"          # Slug downdetector.fr         ex: orange
ISP_SUPPORT_NUM="<ISP-SUPPORT-NUM>" # N° hotline FAI         ex: 3900

MONITORING_DIR="/var/www/monitoring"
SCRIPTS_DIR="/opt/soc"
GEOIP_ACCOUNT_ID=""            # MaxMind Account ID (gratuit sur maxmind.com)
GEOIP_LICENSE_KEY=""           # MaxMind License Key
# ═════════════════════════════════════════════════════════════════════════════

# Racine du dépôt (parent du dossier DEPLOY/)
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Couleurs
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[SOC]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC}  $*"; }
skip() { echo -e "${YELLOW}[SKIP]${NC} $* (simulation)"; }

DRY_RUN=false
STEP_ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --step)    STEP_ONLY="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

run() {
  if $DRY_RUN; then skip "CMD: $*"; else eval "$@"; fi
}
pkg_installed() { dpkg -l "$1" 2>/dev/null | grep -q '^ii'; }
pkg_ensure()    {
  if pkg_installed "$1"; then ok "Paquet : $1 (deja installe)"
  else warn "Installation : $1"; run "apt-get install -y $1"; fi
}
step_active() { [[ -z "$STEP_ONLY" || "$STEP_ONLY" == "$1" ]]; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "============================================================"
echo "  SOC 0xCyberLiTech - Deploiement Debian 13"
echo "  $(date '+%Y-%m-%d %H:%M')  |  Repo : $REPO_DIR"
$DRY_RUN && echo "  MODE SIMULATION - aucune modification"
echo "============================================================"
echo -e "${NC}"

# Verifications
[[ $EUID -ne 0 ]] && { err "Root requis."; exit 1; }
[[ "$VM_IP" == "<SRV-NGIX-IP>" ]] && {
  err "CONFIG non adaptee - editer le bloc CONFIG en haut du script."; exit 1; }
[[ ! -d "$REPO_DIR/scripts" ]] && {
  err "Dossier scripts/ introuvable dans $REPO_DIR"; exit 1; }
[[ ! -d "$REPO_DIR/dashboard" ]] && {
  err "Dossier dashboard/ introuvable dans $REPO_DIR"; exit 1; }

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 1 — Systeme de base
# ══════════════════════════════════════════════════════════════════════════════
if step_active "system"; then
  log "== ETAPE 1 — Systeme de base =="
  run "apt-get update -qq && apt-get upgrade -y"
  run "apt-get install -y curl wget git unzip gnupg2 lsb-release ca-certificates \
       software-properties-common apt-transport-https python3 python3-pip \
       python3-venv logrotate cron rsyslog ufw fail2ban apparmor apparmor-utils \
       exim4 mailutils nftables"
  run "timedatectl set-timezone Europe/Paris"
  run "hostnamectl set-hostname srv-ngix"
  ok "Systeme de base configure"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 2 — SSH hardening
# ══════════════════════════════════════════════════════════════════════════════
if step_active "ssh"; then
  log "== ETAPE 2 — Hardening SSH =="
  SSH_CFG="/etc/ssh/sshd_config"
  if grep -q "^Port ${SSH_PORT}" "$SSH_CFG" 2>/dev/null; then
    ok "SSH deja configure sur port ${SSH_PORT}"
  else
    run "sed -i 's/^#\?Port .*/Port ${SSH_PORT}/' $SSH_CFG"
    run "sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' $SSH_CFG"
    run "sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' $SSH_CFG"
    run "sed -i 's/^#\?MaxAuthTries .*/MaxAuthTries 3/' $SSH_CFG"
    run "sed -i 's/^#\?X11Forwarding .*/X11Forwarding no/' $SSH_CFG"
    run "systemctl reload sshd"
    warn "SSH port ${SSH_PORT} - ouvrir dans UFW AVANT de se deconnecter"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 3 — UFW
# ══════════════════════════════════════════════════════════════════════════════
if step_active "ufw"; then
  log "== ETAPE 3 — UFW =="
  pkg_ensure ufw
  if ufw status | grep -q "Status: active"; then
    ok "UFW deja actif"
  else
    run "ufw --force reset"
    run "ufw default deny incoming"
    run "ufw default deny outgoing"
    run "ufw default disabled routed"
    # Entrants
    run "ufw allow 80/tcp comment 'HTTP'"
    run "ufw allow 443/tcp comment 'HTTPS'"
    run "ufw allow from ${LAN_CIDR}  to any port ${SSH_PORT} proto tcp comment 'SSH-LAN'"
    run "ufw allow from ${LAN2_CIDR} to any port ${SSH_PORT} proto tcp comment 'SSH-LAN2'"
    run "ufw allow from ${LAN_CIDR}  to ${VM_IP} port 8080 proto tcp comment 'Monitoring-LAN'"
    run "ufw allow from ${LAN2_CIDR} to any port 8080 proto tcp comment 'Monitoring-LAN2'"
    run "ufw allow from ${LAN_CIDR}  to any port 514 proto tcp comment 'rsyslog-tcp'"
    run "ufw allow from ${LAN_CIDR}  to any port 514 proto udp comment 'rsyslog-udp'"
    # Sortants
    run "ufw allow out to ${CLT_IP}  port 80   comment 'Backend CLT'"
    run "ufw allow out to ${PA85_IP} port 80   comment 'Backend PA85'"
    run "ufw allow out 53   comment 'DNS'"
    run "ufw allow out 80/tcp  comment 'Updates HTTP'"
    run "ufw allow out 443/tcp comment 'HTTPS out'"
    run "ufw allow out 123/udp comment 'NTP'"
    run "ufw allow out 587/tcp comment 'SMTP alertes'"
    run "ufw allow out to ${CLT_IP}  port ${SSH_PORT} proto tcp comment 'SSH site-01'"
    run "ufw allow out to ${PA85_IP} port ${SSH_PORT} proto tcp comment 'SSH site-02'"
    run "ufw --force enable"
    ok "UFW configure et active"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 4 — nginx + modules
# ══════════════════════════════════════════════════════════════════════════════
if step_active "nginx"; then
  log "== ETAPE 4 — nginx =="
  pkg_ensure nginx
  pkg_ensure libnginx-mod-http-geoip2
  pkg_ensure libnginx-mod-http-headers-more-filter
  run "mkdir -p ${MONITORING_DIR}/{js,css}"

  # Déployer les vhosts depuis le dépôt
  NGINX_CONF_SRC="${REPO_DIR}/CONFIGS/nginx"
  if [[ -d "$NGINX_CONF_SRC" ]]; then
    for f in monitoring.conf site-01.conf site-02.conf; do
      SRC="${NGINX_CONF_SRC}/$f"
      if [[ -f "$SRC" ]]; then
        # Nom cible dans sites-available (sans extension .conf)
        VHOST_NAME="${f%.conf}"
        run "cp '$SRC' /etc/nginx/sites-available/${VHOST_NAME}"
        run "sed -i 's/<SRV-NGIX-IP>/${VM_IP}/g; \
                     s/<CLT-IP>/${CLT_IP}/g; \
                     s/<PA85-IP>/${PA85_IP}/g; \
                     s|<LAN-CIDR>|${LAN_CIDR}|g; \
                     s/<DOMAIN-COM>/${DOMAIN_COM}/g; \
                     s/<DOMAIN-FR>/${DOMAIN_FR}/g; \
                     s/<GITHUB-USER>/<GITHUB-USER>/g' \
             /etc/nginx/sites-available/${VHOST_NAME}"
        ok "nginx vhost : ${VHOST_NAME}"
      fi
    done
    # Snippets
    SNIP_SRC="${NGINX_CONF_SRC}/snippets"
    if [[ -d "$SNIP_SRC" ]]; then
      run "mkdir -p /etc/nginx/snippets"
      for f in "$SNIP_SRC"/*.conf; do
        run "cp '$f' /etc/nginx/snippets/"
      done
      ok "nginx snippets deployes"
    fi
    # Activer les vhosts
    for VHOST in monitoring site-01 site-02; do
      AVAIL="/etc/nginx/sites-available/${VHOST}"
      ENABL="/etc/nginx/sites-enabled/${VHOST}"
      [[ -f "$AVAIL" && ! -L "$ENABL" ]] && run "ln -s '$AVAIL' '$ENABL'"
    done
    # Désactiver le vhost default
    [[ -L /etc/nginx/sites-enabled/default ]] && run "rm /etc/nginx/sites-enabled/default"
    run "nginx -t && systemctl reload nginx 2>/dev/null || true"
    warn "Vhosts deployes — certificats TLS requis (voir etape 6)"
  else
    warn "CONFIGS/nginx/ absent — vhosts non deployes (voir CONFIGS/01-nginx.md)"
  fi
  run "chown -R www-data:www-data ${MONITORING_DIR}"
  ok "nginx configure"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 5 — GeoIP2 MaxMind
# ══════════════════════════════════════════════════════════════════════════════
if step_active "geoip"; then
  log "== ETAPE 5 — GeoIP2 MaxMind =="
  pkg_ensure geoipupdate
  if [[ -z "$GEOIP_ACCOUNT_ID" || -z "$GEOIP_LICENSE_KEY" ]]; then
    warn "GEOIP_ACCOUNT_ID/LICENSE_KEY non renseignes - GeoIP ignore"
    warn "=> Renseigner ces variables en haut du script puis relancer avec --step geoip"
  else
    run "cat > /etc/GeoIP.conf << EOF
AccountID ${GEOIP_ACCOUNT_ID}
LicenseKey ${GEOIP_LICENSE_KEY}
EditionIDs GeoLite2-Country GeoLite2-City
DatabaseDirectory /usr/share/GeoIP
EOF"
    run "mkdir -p /usr/share/GeoIP && geoipupdate"
    run "echo '0 1 * * 0 root geoipupdate >> /var/log/geoipupdate.log 2>&1' > /etc/cron.d/geoipupdate"
    ok "GeoIP2 configure (maj dim. 01h00)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 6 — TLS Let's Encrypt
# ══════════════════════════════════════════════════════════════════════════════
if step_active "tls"; then
  log "== ETAPE 6 — TLS Let's Encrypt =="
  pkg_ensure certbot
  pkg_ensure python3-certbot-nginx
  if [[ -f "/etc/letsencrypt/live/${DOMAIN_COM}/fullchain.pem" ]]; then
    ok "Certificat ${DOMAIN_COM} deja present"
  else
    warn "Certificat absent - generer apres configuration DNS :"
    warn "  certbot --nginx -d ${DOMAIN_COM} -d www.${DOMAIN_COM} -d ${DOMAIN_FR}"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 7 — CrowdSec
# ══════════════════════════════════════════════════════════════════════════════
if step_active "crowdsec"; then
  log "== ETAPE 7 — CrowdSec =="
  if ! pkg_installed crowdsec; then
    run "curl -s https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh | bash"
    run "apt-get install -y crowdsec crowdsec-firewall-bouncer-nftables"
  else
    ok "CrowdSec deja installe"
  fi
  COLLECTIONS="crowdsec/linux crowdsec/nginx crowdsec/http-cve crowdsec/sshd \
               crowdsec/whitelist-good-actors crowdsec/iptables \
               crowdsec/appsec-generic-rules crowdsec/appsec-virtual-patching"
  for col in $COLLECTIONS; do
    run "cscli collections install $col 2>/dev/null || true"
  done
  # Scenarios custom (depuis le depot)
  CS_CUSTOM="${REPO_DIR}/scripts/crowdsec"
  if [[ -d "$CS_CUSTOM" ]]; then
    run "mkdir -p /etc/crowdsec/scenarios/"
    for f in "$CS_CUSTOM"/*.yaml; do
      run "cp '$f' /etc/crowdsec/scenarios/"
    done
    ok "Scenarios CrowdSec custom deployes"
  fi
  run "systemctl enable --now crowdsec"
  ok "CrowdSec actif"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 8 — Fail2ban
# ══════════════════════════════════════════════════════════════════════════════
if step_active "fail2ban"; then
  log "== ETAPE 8 — Fail2ban =="
  pkg_ensure fail2ban
  # jail.local depuis le depot
  JAIL_SRC="${REPO_DIR}/scripts/jail.local"
  if [[ -f "$JAIL_SRC" ]]; then
    run "cp '$JAIL_SRC' /etc/fail2ban/jail.local"
    # Adapter le port SSH dans jail.local
    run "sed -i 's/<SSH-PORT>/${SSH_PORT}/g' /etc/fail2ban/jail.local"
    # Adapter la whitelist LAN
    run "sed -i 's|<LAN-CIDR>|${LAN_CIDR}|g' /etc/fail2ban/jail.local"
    ok "jail.local deploye depuis le depot"
  fi
  # Action crowdsec-sync
  F2B_ACTION="/etc/fail2ban/action.d/crowdsec-sync.conf"
  if [[ ! -f "$F2B_ACTION" ]]; then
    run "cat > $F2B_ACTION << 'ACTEOF'
[Definition]
actionban   = cscli decisions add --ip <ip> --reason \"fail2ban-%(name)s\" --duration 24h
actionunban = cscli decisions delete --ip <ip>
ACTEOF"
  fi
  run "systemctl enable --now fail2ban"
  ok "Fail2ban actif"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 9 — Suricata IDS
# ══════════════════════════════════════════════════════════════════════════════
if step_active "suricata"; then
  log "== ETAPE 9 — Suricata IDS =="
  if ! pkg_installed suricata; then
    run "apt-get install -y suricata suricata-update"
  else
    ok "Suricata deja installe"
  fi
  run "suricata-update"
  ETH=$(ip route | grep default | awk '{print $5}' | head -1)
  run "sed -i \"s/interface: eth0/interface: ${ETH}/\" /etc/suricata/suricata.yaml"
  # Kernel hardening requis pour AF_PACKET
  run "grep -q 'rp_filter' /etc/sysctl.d/99-hardening.conf 2>/dev/null || \
       echo 'net.ipv4.conf.all.rp_filter = 2' >> /etc/sysctl.d/99-hardening.conf"
  run "sysctl -p /etc/sysctl.d/99-hardening.conf 2>/dev/null || true"
  # Cron mise a jour regles (03h30)
  run "echo '30 3 * * * root suricata-update >> /var/log/suricata-update.log 2>&1 && systemctl reload suricata' \
       > /etc/cron.d/suricata-update"
  run "systemctl enable --now suricata"
  ok "Suricata actif - interface ${ETH}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 10 — AppArmor
# ══════════════════════════════════════════════════════════════════════════════
if step_active "apparmor"; then
  log "== ETAPE 10 — AppArmor =="
  pkg_ensure apparmor
  pkg_ensure apparmor-utils
  for prof in usr.sbin.nginx usr.bin.suricata; do
    PFILE="/etc/apparmor.d/$prof"
    [[ -f "$PFILE" ]] && run "aa-enforce '$PFILE' 2>/dev/null || true"
  done
  ok "AppArmor : nginx + suricata en mode enforce"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 11 — rsyslog recepteur central
# ══════════════════════════════════════════════════════════════════════════════
if step_active "rsyslog"; then
  log "== ETAPE 11 — rsyslog recepteur central =="
  pkg_ensure rsyslog
  RCONF_SRC="${REPO_DIR}/scripts/rsyslog-10-central-receiver.conf"
  if [[ -f "$RCONF_SRC" ]]; then
    run "cp '$RCONF_SRC' /etc/rsyslog.d/10-central-receiver.conf"
    run "mkdir -p /var/log/central"
    run "systemctl restart rsyslog"
    ok "Recepteur rsyslog configure"
  else
    warn "rsyslog-10-central-receiver.conf introuvable dans scripts/"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 12 — Scripts Python SOC (depuis le depot)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "scripts"; then
  log "== ETAPE 12 — Scripts Python SOC =="
  pkg_ensure python3
  pkg_ensure python3-pip
  for pkg in flask requests geoip2 python-dateutil; do
    python3 -c "import ${pkg//-/_}" 2>/dev/null \
      && ok "Python : $pkg (present)" \
      || run "pip3 install $pkg --break-system-packages"
  done
  run "mkdir -p $SCRIPTS_DIR"
  # Copie depuis le depot
  for f in monitoring_gen.py soc-daily-report.py proto-live.py monitoring.sh; do
    SRC="${REPO_DIR}/scripts/$f"
    if [[ -f "$SRC" ]]; then
      run "cp '$SRC' '${SCRIPTS_DIR}/$f'"
      [[ "$f" == *.sh ]] && run "chmod +x '${SCRIPTS_DIR}/$f'"
    fi
  done
  # alert.conf depuis l'exemple (a remplir manuellement)
  ALERT_EXAMPLE="${REPO_DIR}/scripts/alert.conf.example"
  if [[ -f "$ALERT_EXAMPLE" && ! -f "${SCRIPTS_DIR}/alert.conf" ]]; then
    run "cp '$ALERT_EXAMPLE' '${SCRIPTS_DIR}/alert.conf'"
    warn "alert.conf copie - editer ${SCRIPTS_DIR}/alert.conf avec vos credentials SMTP"
  fi
  # Adapter les placeholders dans les scripts copies
  run "sed -i 's/<SRV-NGIX-IP>/${VM_IP}/g; \
               s/<CLT-IP>/${CLT_IP}/g; \
               s/<PA85-IP>/${PA85_IP}/g; \
               s/<PROXMOX-IP>/${PROXMOX_IP}/g; \
               s/<BOX-IP>/${BOX_IP}/g; \
               s/<ROUTER-IP>/${ROUTER_IP}/g; \
               s|<LAN-CIDR>|${LAN_CIDR}|g; \
               s/<SSH-PORT>/${SSH_PORT}/g; \
               s|<SSH-KEY-NGIX>|${SSH_KEY_NGIX}|g; \
               s|<SSH-KEY-CLT>|${SSH_KEY_CLT}|g; \
               s|<SSH-KEY-PA85>|${SSH_KEY_PA85}|g; \
               s|<SSH-KEY-PVE>|${SSH_KEY_PVE}|g; \
               s/<DOMAIN-COM>/${DOMAIN_COM}/g; \
               s/<DOMAIN-FR>/${DOMAIN_FR}/g; \
               s/<ISP-HOST-1>/${ISP_HOST_1}/g; \
               s/<ISP-HOST-2>/${ISP_HOST_2}/g' \
       ${SCRIPTS_DIR}/monitoring_gen.py \
       ${SCRIPTS_DIR}/soc-daily-report.py 2>/dev/null || true"
  run "chmod +x ${SCRIPTS_DIR}/monitoring.sh"
  ok "Scripts Python deployes dans ${SCRIPTS_DIR}/"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 13 — Dashboard SOC (depuis le depot)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "dashboard"; then
  log "== ETAPE 13 — Dashboard SOC =="
  run "mkdir -p ${MONITORING_DIR}/{js,css}"
  # Copie depuis le depot
  run "cp '${REPO_DIR}/dashboard/index.html' '${MONITORING_DIR}/index.html'"
  run "cp ${REPO_DIR}/dashboard/js/*.js '${MONITORING_DIR}/js/'"
  run "cp '${REPO_DIR}/dashboard/css/monitoring.css' '${MONITORING_DIR}/css/monitoring.css'"
  # Substitution des placeholders dans tous les fichiers JS
  run "sed -i 's/<SRV-NGIX-IP>/${VM_IP}/g; \
               s/<CLT-IP>/${CLT_IP}/g; \
               s/<PA85-IP>/${PA85_IP}/g; \
               s/<PROXMOX-IP>/${PROXMOX_IP}/g; \
               s/<BOX-IP>/${BOX_IP}/g; \
               s/<ROUTER-IP>/${ROUTER_IP}/g; \
               s|<LAN-CIDR>|${LAN_CIDR}|g; \
               s/<SSH-PORT>/${SSH_PORT}/g; \
               s/<SSH-KEY>/${SSH_KEY}/g; \
               s/<DOMAIN-COM>/${DOMAIN_COM}/g; \
               s/<DOMAIN-FR>/${DOMAIN_FR}/g; \
               s/<WAN-LAT>/${WAN_LAT}/g; \
               s/<WAN-LON>/${WAN_LON}/g; \
               s/<WAN-IP>/${BOX_IP}/g; \
               s/<ISP-HOST-1>/${ISP_HOST_1}/g; \
               s/<ISP-HOST-2>/${ISP_HOST_2}/g; \
               s/<ISP-NAME>/${ISP_NAME}/g; \
               s/<ISP-SLUG>/${ISP_SLUG}/g; \
               s/<ISP-SUPPORT-NUM>/${ISP_SUPPORT_NUM}/g' \
       ${MONITORING_DIR}/js/*.js 2>/dev/null || true"
  run "chown -R www-data:www-data $MONITORING_DIR"
  ok "Dashboard deploye dans ${MONITORING_DIR}/"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 14 — Crons SOC
# ══════════════════════════════════════════════════════════════════════════════
if step_active "crons"; then
  log "== ETAPE 14 — Crons SOC =="
  CRON_SOC="/etc/cron.d/soc-monitoring"
  if [[ -f "$CRON_SOC" ]]; then
    ok "Crons SOC deja presents"
  else
    run "cat > $CRON_SOC << CRONEOF
# SOC — taches planifiees
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Stats protocoles temps reel (chaque minute)
* * * * *   root  python3 ${SCRIPTS_DIR}/proto-live.py >> /var/log/proto-live.log 2>&1

# Generation monitoring.json (toutes les 5 min)
*/5 * * * * root  ${SCRIPTS_DIR}/monitoring.sh >> /var/log/monitoring-gen.log 2>&1

# Mise a jour CrowdSec (03h30)
30 3 * * *  root  cscli hub update && cscli hub upgrade >> /var/log/crowdsec-update.log 2>&1

# Rapport quotidien mail (08h00)
0 8 * * *   root  python3 ${SCRIPTS_DIR}/soc-daily-report.py >> /var/log/soc-report.log 2>&1

# Verification integrite AIDE (03h00)
0 3 * * *   root  /usr/bin/aide --config /etc/aide/aide.conf --check >> /var/log/aide/aide.log 2>&1
CRONEOF"
    ok "Crons SOC configures"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 15 — Mail (exim4)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "mail"; then
  log "== ETAPE 15 — Mail (exim4) =="
  pkg_ensure exim4
  pkg_ensure mailutils
  warn "Configurer exim4 : dpkg-reconfigure exim4-config"
  warn "Type : 'internet site' ou 'smarthost' selon votre FAI"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 16 — AIDE (integrite fichiers)
# ══════════════════════════════════════════════════════════════════════════════
if step_active "aide"; then
  log "== ETAPE 16 — AIDE integrite =="
  pkg_ensure aide
  # Config AIDE depuis le depot (logrotate.d/aide-soc = règle rotation)
  AIDE_LOGR="${REPO_DIR}/scripts/logrotate.d/aide-soc"
  [[ -f "$AIDE_LOGR" ]] && run "cp '$AIDE_LOGR' /etc/logrotate.d/aide-soc"
  if [[ -f "/var/lib/aide/aide.db" ]]; then
    ok "Base AIDE deja initialisee"
  else
    warn "Initialisation AIDE (plusieurs minutes)..."
    run "mkdir -p /var/log/aide"
    run "aideinit -y -f"
    run "cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db"
    ok "Base AIDE initialisee — re-baseline apres toute modif systeme"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# ETAPE 17 — Logrotate
# ══════════════════════════════════════════════════════════════════════════════
if step_active "logrotate"; then
  log "== ETAPE 17 — Logrotate =="
  LOGR_SRC="${REPO_DIR}/scripts/logrotate.d"
  if [[ -d "$LOGR_SRC" ]]; then
    for f in "$LOGR_SRC"/*; do
      run "cp '$f' /etc/logrotate.d/$(basename "$f")"
    done
    ok "Regles logrotate deployees depuis le depot"
  else
    warn "logrotate.d/ introuvable dans scripts/"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# RESUME FINAL
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  Deploiement termine${NC}"
$DRY_RUN && echo -e "${YELLOW}  MODE SIMULATION — aucune modification effectuee${NC}"
echo -e "${BOLD}${GREEN}============================================================${NC}"
echo ""
echo "  Actions manuelles restantes :"
echo "  1. Configurer les vhosts nginx"
echo "     => Modeles dans CONFIGS/01-nginx.md"
echo "  2. Generer les certificats TLS"
echo "     => certbot --nginx -d ${DOMAIN_COM} -d www.${DOMAIN_COM} -d ${DOMAIN_FR}"
echo "  3. Remplir ${SCRIPTS_DIR}/alert.conf (credentials SMTP)"
echo "  4. Renseigner GEOIP_ACCOUNT_ID/LICENSE_KEY puis relancer --step geoip"
echo "  5. Consulter la checklist post-deploy"
echo "     => DEPLOY/CHECKLIST-DEPLOY.md"
echo ""
