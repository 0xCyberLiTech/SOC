#!/usr/bin/env bash
# =============================================================================
# create-archive.sh — Export complet de la configuration SOC 0xCyberLiTech
# =============================================================================
# Usage :
#   ./create-archive.sh              → archive dans /opt/backup-config/
#   ./create-archive.sh --dry-run    → liste les fichiers sans copier
#   ./create-archive.sh --output /mnt/usb/  → dossier de sortie personnalisé
#
# L'archive produite contient TOUTE la configuration nécessaire pour
# reconstruire un srv-ngix identique sur une nouvelle VM Debian 13.
#
# Structure de l'archive :
#   soc-config-AAAA-MM-JJ.tar.gz
#     ├── network/         ← interfaces, hostname, hosts, resolv.conf, sysctl, SSH, exim4, nftables
#     ├── nginx/           ← vhosts, nginx.conf, SSL
#     ├── crowdsec/        ← config, parsers, scenarios, bouncers
#     ├── fail2ban/        ← jail.local, filters, actions
#     ├── suricata/        ← suricata.yaml, rules/
#     ├── rsyslog/         ← rsyslog.conf, conf.d/
#     ├── apparmor/        ← profils enforce
#     ├── ufw/             ← règles UFW complètes
#     ├── scripts/         ← monitoring_gen.py, soc.py, monitoring.sh...
#     ├── crons/           ← /etc/cron.d/ complet
#     ├── systemd/         ← units custom (soc-report-trigger, sshd)
#     ├── aide/            ← config AIDE intégrité
#     ├── logrotate/       ← /etc/logrotate.d/
#     ├── geoip/           ← GeoIP.conf (Account ID + License Key MaxMind)
#     ├── api-keys/        ← api-keys.conf (NVD + AbuseIPDB)
#     ├── ssh/             ← authorized_keys + clés privées sync
#     └── README-RESTORE.md ← instructions de restauration
# =============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
ARCHIVE_DATE=$(date +%Y-%m-%d_%H%M)
ARCHIVE_NAME="soc-config-${ARCHIVE_DATE}"
DEFAULT_OUTPUT="/opt/backup-config"
OUTPUT_DIR="${DEFAULT_OUTPUT}"
DRY_RUN=false
PUBLIC_MODE=false    # --public : archive sanitisée sans credentials (partageable)

# ─── Couleurs ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[  OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERRR]${NC}  $*"; }
step() { echo -e "\n${BOLD}${BLUE}═══ $* ═══${NC}"; }

dry()  {
    if $DRY_RUN; then
        echo -e "${YELLOW}[DRY ]${NC}  $*"
    else
        eval "$*"
    fi
}

# ─── Parsing arguments ───────────────────────────────────────────────────────
for arg in "$@"; do
    case "$arg" in
        --dry-run)   DRY_RUN=true ;;
        --public)    PUBLIC_MODE=true ;;
        --output=*)  OUTPUT_DIR="${arg#--output=}" ;;
        --output)    shift; OUTPUT_DIR="$1" ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--public] [--output /chemin/]"
            echo "  --public  Archive sanitisée sans credentials (partageable GitHub/demo)"
            exit 0
            ;;
    esac
done

# ─── Vérifications préalables ────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "Ce script doit être exécuté en tant que root"
    exit 1
fi

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════════════╗"
echo -e "║   SOC 0xCyberLiTech — Export Configuration           ║"
echo -e "║   Archive : ${ARCHIVE_NAME}           ║"
if $DRY_RUN; then
echo -e "║   MODE : SIMULATION (--dry-run) — aucune écriture    ║"
fi
if $PUBLIC_MODE; then
echo -e "║   MODE : PUBLIC — credentials exclus (partageable)   ║"
fi
echo -e "╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Préparation dossier temporaire ──────────────────────────────────────────
TMPDIR="/tmp/${ARCHIVE_NAME}"
RESTOREPATH="${TMPDIR}"

if ! $DRY_RUN; then
    rm -rf "${TMPDIR}"
    mkdir -p "${TMPDIR}"
    mkdir -p "${OUTPUT_DIR}"
fi

# ─── Fonction de copie avec vérification ─────────────────────────────────────
backup_file() {
    local src="$1"
    local dest_subdir="$2"
    local dest="${TMPDIR}/${dest_subdir}"

    if [[ ! -e "$src" ]]; then
        warn "ABSENT : ${src}"
        return 0
    fi

    if $DRY_RUN; then
        echo -e "  ${YELLOW}[DRY]${NC} $(ls -lh "$src" 2>/dev/null | awk '{print $5, $9}') → ${dest_subdir}/"
        return 0
    fi

    mkdir -p "${dest}"
    if [[ -d "$src" ]]; then
        cp -a "${src}/." "${dest}/"
    else
        cp -p "$src" "${dest}/"
    fi
    ok "$(basename "$src") → ${dest_subdir}/"
}

backup_dir() {
    local src="$1"
    local dest_subdir="$2"

    if [[ ! -d "$src" ]]; then
        warn "ABSENT : ${src}"
        return 0
    fi

    if $DRY_RUN; then
        local count
        count=$(find "$src" -type f 2>/dev/null | wc -l)
        echo -e "  ${YELLOW}[DRY]${NC} ${src}/ (${count} fichiers) → ${dest_subdir}/"
        return 0
    fi

    mkdir -p "${TMPDIR}/${dest_subdir}"
    cp -rp "${src}/." "${TMPDIR}/${dest_subdir}/"
    local count
    count=$(find "${TMPDIR}/${dest_subdir}" -type f | wc -l)
    ok "${src}/ (${count} fichiers) → ${dest_subdir}/"
}

# ─── BLOC 0 : Réseau — CRITIQUE pour plug and play ────────────────────────────
step "0/13 Réseau (interfaces, hostname, SSH, sysctl, exim4, nftables)"

# Config réseau — IP statique, gateway, DNS
backup_file "/etc/network/interfaces"                  "network"
backup_dir  "/etc/network/interfaces.d"                "network/interfaces.d"

# Identité machine
backup_file "/etc/hostname"                            "network"
backup_file "/etc/hosts"                               "network"
backup_file "/etc/resolv.conf"                         "network"
backup_file "/etc/nsswitch.conf"                       "network"
backup_file "/etc/mailname"                            "network"

# SSH — config du démon (port <SSH-PORT>, PasswordAuth no, MaxAuthTries...)
backup_file "/etc/ssh/sshd_config"                     "network/ssh"
backup_dir  "/etc/ssh/sshd_config.d"                   "network/ssh/sshd_config.d"

# Sysctl — hardening + IPv6 désactivé + rp_filter Suricata
backup_file "/etc/sysctl.conf"                         "network/sysctl"
backup_dir  "/etc/sysctl.d"                            "network/sysctl/sysctl.d"

# nftables base
backup_file "/etc/nftables.conf"                       "network"

# exim4 MTA — SMTP sortant (alertes mail SOC)
if $PUBLIC_MODE; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/network/exim4"
        cp -rp /etc/exim4/. "${TMPDIR}/network/exim4/" 2>/dev/null || true
        # Supprimer passwd.client (contient login:password SMTP)
        rm -f "${TMPDIR}/network/exim4/passwd.client"
        echo "# passwd.client — EXCLU (--public mode)" > "${TMPDIR}/network/exim4/passwd.client.example"
        echo "# Format: smtp.laposte.net:587:user@laposte.net:PASSWORD" >> "${TMPDIR}/network/exim4/passwd.client.example"
        ok "exim4/ → copié (passwd.client exclu)"
    else
        echo -e "  ${YELLOW}[DRY]${NC} exim4/ → copié sans passwd.client (mode public)"
    fi
else
    backup_dir  "/etc/exim4"                           "network/exim4"
fi

# hosts.allow / hosts.deny (TCP wrappers)
backup_file "/etc/hosts.allow"                         "network"
backup_file "/etc/hosts.deny"                          "network"

# Export état réseau pour référence (lecture seule)
if ! $DRY_RUN; then
    mkdir -p "${TMPDIR}/network"
    ip addr  > "${TMPDIR}/network/ip-addr.txt"   2>/dev/null || true
    ip route > "${TMPDIR}/network/ip-route.txt"  2>/dev/null || true
    ss -tlnup > "${TMPDIR}/network/ports-ouverts.txt" 2>/dev/null || true
    ok "État réseau live exporté (ip addr + routes + ports)"
else
    echo -e "  ${YELLOW}[DRY]${NC} ip addr + ip route + ss -tlnup → network/"
fi

# ─── BLOC 1 : nginx ───────────────────────────────────────────────────────────
step "1/13 nginx"

backup_file "/etc/nginx/nginx.conf"                    "nginx"
backup_dir  "/etc/nginx/sites-available"               "nginx/sites-available"
backup_dir  "/etc/nginx/sites-enabled"                 "nginx/sites-enabled"
backup_dir  "/etc/nginx/conf.d"                        "nginx/conf.d"
backup_dir  "/etc/nginx/snippets"                      "nginx/snippets"

# GeoIP databases (importantes pour la reconstruction)
if [[ -d "/usr/share/GeoIP" ]]; then
    backup_dir "/usr/share/GeoIP" "nginx/geoip"
fi
if [[ -d "/var/lib/GeoIP" ]]; then
    backup_dir "/var/lib/GeoIP" "nginx/geoip"
fi

# Certificats SSL (Let's Encrypt ou auto-signés)
if $PUBLIC_MODE; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/nginx/letsencrypt"
        echo "# Certificats Let's Encrypt — EXCLUS (--public mode)" > "${TMPDIR}/nginx/letsencrypt/README.txt"
        echo "# Régénérer avec : certbot renew --force-renewal" >> "${TMPDIR}/nginx/letsencrypt/README.txt"
        ok "letsencrypt/ → placeholder (clés privées exclues)"
    else
        echo -e "  ${YELLOW}[DRY]${NC} letsencrypt/ → placeholder (mode public)"
    fi
elif [[ -d "/etc/letsencrypt/live" ]]; then
    backup_dir "/etc/letsencrypt" "nginx/letsencrypt"
elif [[ -d "/etc/nginx/ssl" ]]; then
    backup_dir "/etc/nginx/ssl" "nginx/ssl"
fi

# ─── BLOC 2 : CrowdSec ────────────────────────────────────────────────────────
step "2/13 CrowdSec"

backup_dir  "/etc/crowdsec"                            "crowdsec/config"
backup_file "/etc/crowdsec/config.yaml"                "crowdsec"
backup_file "/etc/crowdsec/local_api_credentials.yaml" "crowdsec"

# AppSec rules (vpatch CVE — important)
if [[ -d "/etc/crowdsec/appsec-rules" ]]; then
    backup_dir "/etc/crowdsec/appsec-rules" "crowdsec/appsec-rules"
fi
if [[ -d "/etc/crowdsec/appsec-configs" ]]; then
    backup_dir "/etc/crowdsec/appsec-configs" "crowdsec/appsec-configs"
fi

# Export des décisions actives
if ! $DRY_RUN; then
    mkdir -p "${TMPDIR}/crowdsec"
    cscli decisions list -o json > "${TMPDIR}/crowdsec/decisions-export.json" 2>/dev/null || true
    cscli bouncers list -o json  > "${TMPDIR}/crowdsec/bouncers.json" 2>/dev/null || true
    cscli collections list -o json > "${TMPDIR}/crowdsec/collections.json" 2>/dev/null || true
    ok "CrowdSec decisions + bouncers + collections exportés"
else
    echo -e "  ${YELLOW}[DRY]${NC} cscli decisions export → crowdsec/decisions-export.json"
    echo -e "  ${YELLOW}[DRY]${NC} cscli collections list → crowdsec/collections.json"
fi

# Bouncer nftables config
backup_file "/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml" "crowdsec/bouncers"

# ─── BLOC 3 : Fail2ban ────────────────────────────────────────────────────────
step "3/13 Fail2ban"

backup_file "/etc/fail2ban/jail.local"                 "fail2ban"
backup_file "/etc/fail2ban/jail.conf"                  "fail2ban"
backup_dir  "/etc/fail2ban/filter.d"                   "fail2ban/filter.d"
backup_dir  "/etc/fail2ban/action.d"                   "fail2ban/action.d"

# Fichier crowdsec-sync.conf (custom — clé pour la chaîne de défense)
backup_file "/etc/fail2ban/action.d/crowdsec-sync.conf" "fail2ban/action.d"

# ─── BLOC 4 : Suricata ────────────────────────────────────────────────────────
step "4/13 Suricata"

backup_file "/etc/suricata/suricata.yaml"              "suricata"
backup_dir  "/etc/suricata/rules"                      "suricata/rules"
backup_dir  "/etc/suricata/threshold.config"           "suricata" 2>/dev/null || true

# Suricata update sources
if [[ -f "/etc/suricata/update.yaml" ]]; then
    backup_file "/etc/suricata/update.yaml" "suricata"
fi

# ─── BLOC 5 : rsyslog ─────────────────────────────────────────────────────────
step "5/13 rsyslog"

backup_file "/etc/rsyslog.conf"                        "rsyslog"
backup_dir  "/etc/rsyslog.d"                           "rsyslog/rsyslog.d"

# ─── BLOC 6 : AppArmor ────────────────────────────────────────────────────────
step "6/13 AppArmor"

# Profils enforce uniquement (pas toute la base)
if [[ -d "/etc/apparmor.d" ]]; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/apparmor"
        # Copier seulement les profils customisés (nginx, suricata)
        for profile in nginx suricata usr.sbin.nginx usr.bin.suricata; do
            if [[ -f "/etc/apparmor.d/${profile}" ]]; then
                cp -p "/etc/apparmor.d/${profile}" "${TMPDIR}/apparmor/"
                ok "AppArmor profil ${profile}"
            fi
        done
        # Lister l'état de tous les profils
        aa-status --json 2>/dev/null > "${TMPDIR}/apparmor/aa-status.json" || true
    else
        echo -e "  ${YELLOW}[DRY]${NC} AppArmor profils nginx/suricata → apparmor/"
        echo -e "  ${YELLOW}[DRY]${NC} aa-status --json → apparmor/aa-status.json"
    fi
fi

# ─── BLOC 7 : UFW ─────────────────────────────────────────────────────────────
step "7/13 UFW"

backup_dir  "/etc/ufw"                                 "ufw"

# Export règles lisibles
if ! $DRY_RUN; then
    mkdir -p "${TMPDIR}/ufw"
    ufw status verbose > "${TMPDIR}/ufw/ufw-status-verbose.txt" 2>/dev/null || true
    ok "UFW status verbose exporté"
else
    echo -e "  ${YELLOW}[DRY]${NC} ufw status verbose → ufw/ufw-status-verbose.txt"
fi

# ─── BLOC 8 : Scripts Python + Dashboard ─────────────────────────────────────
step "8/13 Scripts + Dashboard"

backup_dir  "/opt/site-01"                                 "scripts/opt-site-01"

# /usr/local/bin — scripts système custom (pve-monitor-write etc.)
if ! $DRY_RUN; then
    mkdir -p "${TMPDIR}/scripts/usr-local-bin"
    find /usr/local/bin /usr/local/sbin -maxdepth 1 -type f -exec cp -p {} "${TMPDIR}/scripts/usr-local-bin/" \; 2>/dev/null || true
    local_count=$(find "${TMPDIR}/scripts/usr-local-bin" -type f 2>/dev/null | wc -l)
    ok "/usr/local/bin+sbin (${local_count} scripts custom) → scripts/usr-local-bin/"
else
    find /usr/local/bin /usr/local/sbin -maxdepth 1 -type f 2>/dev/null | while read -r f; do
        echo -e "  ${YELLOW}[DRY]${NC} $(basename "$f") → scripts/usr-local-bin/"
    done
fi

# Dashboard (HTML + JS + CSS)
if [[ -d "/var/www/monitoring" ]]; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/scripts/dashboard"
        rsync -a --exclude="monitoring.json" --exclude="*.json" \
              /var/www/monitoring/ "${TMPDIR}/scripts/dashboard/" 2>/dev/null || \
        { cp -rp /var/www/monitoring/index.html "${TMPDIR}/scripts/dashboard/" 2>/dev/null || true
          cp -rp /var/www/monitoring/js "${TMPDIR}/scripts/dashboard/" 2>/dev/null || true
          cp -rp /var/www/monitoring/css "${TMPDIR}/scripts/dashboard/" 2>/dev/null || true; }
        ok "Dashboard HTML/JS/CSS exporté"
    else
        echo -e "  ${YELLOW}[DRY]${NC} /var/www/monitoring/ → scripts/dashboard/"
    fi
fi

# ─── BLOC 9 : Crons (/etc/cron.d/ — source réelle) ───────────────────────────
step "9/13 Crons (/etc/cron.d/)"

# Les crons sont dans /etc/cron.d/ — PAS dans crontab -l (qui est vide sur ce serveur)
backup_dir  "/etc/cron.d"                              "crons/cron.d"

if ! $DRY_RUN; then
    mkdir -p "${TMPDIR}/crons"
    # Sauvegarder aussi crontab -l au cas où (peut être vide)
    crontab -l > "${TMPDIR}/crons/crontab-root.txt" 2>/dev/null || echo "# crontab -l vide — crons dans cron.d/" > "${TMPDIR}/crons/crontab-root.txt"
    cron_count=$(find "${TMPDIR}/crons/cron.d" -type f 2>/dev/null | wc -l)
    ok "/etc/cron.d/ (${cron_count} fichiers) exporté"
else
    cron_count=$(find /etc/cron.d -type f 2>/dev/null | wc -l)
    echo -e "  ${YELLOW}[DRY]${NC} /etc/cron.d/ (${cron_count} fichiers) → crons/cron.d/"
fi

# ─── BLOC 10 : Systemd units custom ───────────────────────────────────────────
step "10/13 Systemd units custom"

if [[ -d "/etc/systemd/system" ]]; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/systemd"
        # Services vraiment custom : soc-report-trigger + sshd custom
        for unit in soc-report-trigger.service sshd.service; do
            if [[ -f "/etc/systemd/system/$unit" ]]; then
                cp -p "/etc/systemd/system/$unit" "${TMPDIR}/systemd/"
                ok "Systemd unit : $unit"
            fi
        done
        # Timers custom (dailyaidecheck, crowdsec-hubupdate s'ils ont été modifiés)
        find /etc/systemd/system -maxdepth 1 -name "*.service" -o -name "*.timer" 2>/dev/null | \
            while read -r f; do
                # Garder seulement les fichiers (pas symlinks vers distrib)
                [[ -L "$f" ]] && continue
                cp -p "$f" "${TMPDIR}/systemd/" 2>/dev/null || true
            done
        # Liste des services actifs pour référence
        systemctl list-units --type=service --state=active --no-legend > \
            "${TMPDIR}/systemd/services-actifs.txt" 2>/dev/null || true
        systemd_count=$(find "${TMPDIR}/systemd" -type f ! -name "services-actifs.txt" | wc -l)
        ok "Systemd (${systemd_count} units custom + liste services actifs)"
    else
        echo -e "  ${YELLOW}[DRY]${NC} soc-report-trigger.service + sshd.service → systemd/"
        echo -e "  ${YELLOW}[DRY]${NC} systemctl list-units → systemd/services-actifs.txt"
    fi
fi

# ─── BLOC 11 : Configs système complémentaires ────────────────────────────────
step "11/13 Configs complémentaires (AIDE, logrotate, GeoIP)"

# AIDE
backup_dir  "/etc/aide"                                "aide"
backup_file "/var/lib/aide/aide.db.gz"                 "aide"

# Logrotate (configs custom)
backup_dir  "/etc/logrotate.d"                         "logrotate"

# GeoIP update (contient Account ID + License Key MaxMind)
if $PUBLIC_MODE; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/geoip"
        echo "# GeoIP.conf — CREDENTIALS EXCLUS (--public mode)" > "${TMPDIR}/geoip/GeoIP.conf"
        echo "# AccountID YOUR_MAXMIND_ACCOUNT_ID" >> "${TMPDIR}/geoip/GeoIP.conf"
        echo "# LicenseKey YOUR_MAXMIND_LICENSE_KEY" >> "${TMPDIR}/geoip/GeoIP.conf"
        ok "GeoIP.conf → placeholder (mode public)"
    else
        echo -e "  ${YELLOW}[DRY]${NC} GeoIP.conf → placeholder (credentials exclus)"
    fi
else
    backup_file "/etc/GeoIP.conf"                      "geoip"
    backup_file "/etc/default/geoipupdate"             "geoip"
fi

# Clés API nginx (NVD + AbuseIPDB)
if $PUBLIC_MODE; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/api-keys"
        echo "# api-keys.conf — CREDENTIALS EXCLUS (--public mode)" > "${TMPDIR}/api-keys/api-keys.conf"
        echo "# NVD_API_KEY=YOUR_NVD_API_KEY" >> "${TMPDIR}/api-keys/api-keys.conf"
        echo "# ABUSEIPDB_API_KEY=YOUR_ABUSEIPDB_KEY" >> "${TMPDIR}/api-keys/api-keys.conf"
        ok "api-keys.conf → placeholder (mode public)"
    else
        echo -e "  ${YELLOW}[DRY]${NC} api-keys.conf → placeholder (credentials exclus)"
    fi
else
    backup_file "/etc/nginx/api-keys.conf"             "api-keys"
fi

# SSH — clés de /root/.ssh/
if $PUBLIC_MODE; then
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/ssh"
        echo "# SSH keys — EXCLUSES (--public mode)" > "${TMPDIR}/ssh/README.txt"
        echo "# Restaurer manuellement depuis D:\\PROJETS\\CLES_SSH_0xcyberlitech\\" >> "${TMPDIR}/ssh/README.txt"
        ok "SSH keys → placeholder (mode public)"
    else
        echo -e "  ${YELLOW}[DRY]${NC} SSH keys → placeholder (credentials exclus)"
    fi
else
    if ! $DRY_RUN; then
        mkdir -p "${TMPDIR}/ssh"
        for f in /root/.ssh/authorized_keys \
                  /root/.ssh/id_site-01_sync     /root/.ssh/id_site-01_sync.pub \
                  /root/.ssh/id_site-02_sync    /root/.ssh/id_site-02_sync.pub \
                  /root/.ssh/id_proxmox_sync /root/.ssh/id_proxmox_sync.pub; do
            [[ -f "$f" ]] && cp -p "$f" "${TMPDIR}/ssh/" && ok "$(basename "$f") → ssh/"
        done
    else
        for f in authorized_keys id_site-01_sync id_site-02_sync id_proxmox_sync; do
            echo -e "  ${YELLOW}[DRY]${NC} /root/.ssh/$f → ssh/"
        done
    fi
fi

# ─── BLOC 12 : Métadonnées système ────────────────────────────────────────────
step "12/13 Métadonnées système"

if ! $DRY_RUN; then
    mkdir -p "${TMPDIR}/metadata"

    # Versions des paquets clés
    {
        echo "# Versions paquets clés — $(date)"
        echo "OS: $(cat /etc/debian_version 2>/dev/null || echo unknown)"
        echo "Kernel: $(uname -r)"
        dpkg -l nginx crowdsec suricata fail2ban rsyslog apparmor aide 2>/dev/null | \
            grep '^ii' | awk '{print $2, $3}' || true
    } > "${TMPDIR}/metadata/versions.txt"

    # Réseau
    ip a > "${TMPDIR}/metadata/network.txt" 2>/dev/null || true
    ip r > "${TMPDIR}/metadata/routes.txt" 2>/dev/null || true

    # Paquets installés (pour référence)
    dpkg --get-selections > "${TMPDIR}/metadata/dpkg-selections.txt" 2>/dev/null || true

    ok "Métadonnées système exportées"
else
    echo -e "  ${YELLOW}[DRY]${NC} versions.txt + network.txt + dpkg-selections.txt"
fi

# ─── README de restauration ───────────────────────────────────────────────────
if ! $DRY_RUN; then
cat > "${TMPDIR}/README-RESTORE.md" << 'EOF'
# Guide de restauration rapide

## Prérequis
- Debian 13 (Trixie) fraîche
- IP : <SRV-NGIX-IP>
- Hostname : srv-ngix

## Étape 1 — Décompresser l'archive
```bash
tar xzf soc-config-AAAA-MM-JJ.tar.gz
cd soc-config-AAAA-MM-JJ/
```

## Étape 2 — Installer les paquets
```bash
apt-get update
apt-get install -y nginx libnginx-mod-http-geoip2 libnginx-mod-http-headers-more-filter \
    crowdsec crowdsec-firewall-bouncer-nftables suricata fail2ban rsyslog \
    apparmor apparmor-utils aide python3 python3-flask ufw
```

## Étape 3 — Restaurer les configs
```bash
# nginx
cp -rp nginx/. /etc/nginx/
nginx -t && systemctl restart nginx

# CrowdSec
cp -rp crowdsec/config/. /etc/crowdsec/
systemctl restart crowdsec
# Réimporter les collections
cscli hub update
while IFS= read -r line; do
    name=$(echo "$line" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(x['name']) for x in d]" 2>/dev/null) || true
done < crowdsec/collections.json

# Fail2ban
cp fail2ban/jail.local /etc/fail2ban/
cp fail2ban/action.d/crowdsec-sync.conf /etc/fail2ban/action.d/
systemctl restart fail2ban

# Suricata
cp suricata/suricata.yaml /etc/suricata/
systemctl restart suricata

# rsyslog
cp rsyslog/rsyslog.conf /etc/rsyslog.conf
cp -rp rsyslog/rsyslog.d/. /etc/rsyslog.d/
systemctl restart rsyslog

# UFW
ufw --force reset
cat ufw/ufw-status-verbose.txt  # lire et recréer les règles manuellement
ufw enable

# Scripts Python
cp -rp scripts/opt-site-01/. /opt/site-01/
chmod +x /opt/site-01/monitoring.sh

# Crontab
crontab crons/crontab-root.txt

# Dashboard
cp -rp scripts/dashboard/. /var/www/monitoring/
```

## Étape 4 — AIDE baseline
```bash
aide --init
mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
```

## Étape 5 — Vérification
Suivre la CHECKLIST-DEPLOY.md (61 points).
EOF

ok "README-RESTORE.md créé"
fi

# ─── Compression finale ───────────────────────────────────────────────────────
if ! $DRY_RUN; then
    step "Compression de l'archive"
    ARCHIVE_FILE="${OUTPUT_DIR}/${ARCHIVE_NAME}.tar.gz"
    tar czf "${ARCHIVE_FILE}" -C /tmp "${ARCHIVE_NAME}"
    ARCHIVE_SIZE=$(du -sh "${ARCHIVE_FILE}" | cut -f1)
    rm -rf "${TMPDIR}"

    echo ""
    echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════╗"
    echo -e "║   ARCHIVE CRÉÉE AVEC SUCCÈS                           ║"
    echo -e "╠═══════════════════════════════════════════════════════╣"
    echo -e "║   Fichier  : ${ARCHIVE_FILE}"
    echo -e "║   Taille   : ${ARCHIVE_SIZE}"
    echo -e "║   Date     : ${ARCHIVE_DATE}"
    echo -e "╚═══════════════════════════════════════════════════════╝${NC}"
    echo ""
    log "Pour copier sur Windows :"
    echo "   scp -i ~/.ssh/id_nginx -P <SSH-PORT> root@<SRV-NGIX-IP>:${ARCHIVE_FILE} 'D:\\BACKUP-PROXMOX\\config\\'"

else
    echo ""
    echo -e "${BOLD}${YELLOW}╔═══════════════════════════════════════════════════════╗"
    echo -e "║   SIMULATION TERMINÉE — aucun fichier créé           ║"
    echo -e "║   Relancer sans --dry-run pour créer l'archive       ║"
    echo -e "╚═══════════════════════════════════════════════════════╝${NC}"
fi

# ─── Rotation des anciennes archives (garder 4 dernières) ─────────────────────
if ! $DRY_RUN && [[ -d "${OUTPUT_DIR}" ]]; then
    ARCHIVE_COUNT=$(find "${OUTPUT_DIR}" -name "soc-config-*.tar.gz" | wc -l)
    if [[ "${ARCHIVE_COUNT}" -gt 4 ]]; then
        find "${OUTPUT_DIR}" -name "soc-config-*.tar.gz" -printf '%T+ %p\n' | \
            sort | head -n $((ARCHIVE_COUNT - 4)) | awk '{print $2}' | \
            xargs rm -f
        ok "Rotation : anciennes archives supprimées (gardé 4 dernières)"
    fi
fi

exit 0
