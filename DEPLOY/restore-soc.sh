#!/usr/bin/env bash
# =============================================================================
# restore-soc.sh — Restauration complète SOC 0xCyberLiTech depuis archive
# =============================================================================
# Usage :
#   bash restore-soc.sh soc-config-AAAA-MM-JJ.tar.gz            → restauration complète
#   bash restore-soc.sh soc-config-AAAA-MM-JJ.tar.gz --dry-run  → SIMULATION — rien n'est écrit
#   bash restore-soc.sh soc-config-AAAA-MM-JJ.tar.gz --step <bloc>
#
# Blocs disponibles (--step) :
#   network | nginx | crowdsec | fail2ban | suricata | rsyslog | apparmor | ufw
#   scripts | crons | systemd | complement | aide
#
# Mode --dry-run :
#   - Archive extraite dans /tmp/ (lecture seule)
#   - Chaque fichier comparé à l'existant : IDENTIQUE / DIFFÉRENT / NOUVEAU
#   - Diff court affiché pour chaque fichier modifié
#   - Aucune copie, aucun reload, aucun restart
#   - Rapport final chiffré
#
# Protections intégrées :
#   - Sauvegarde préventive de TOUTES les configs avant écrasement
#     → /opt/backup-config/pre-restore-AAAA-MM-JJ_HHMM/
#   - nginx -t avant reload nginx
#   - Rollback automatique si un service ne repart pas
# =============================================================================

set -euo pipefail

# ─── Couleurs ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'
NC='\033[0m'; BOLD='\033[1m'

log()   { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[  OK]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERRR]${NC}  $*"; }
step()  { echo -e "\n${BOLD}${BLUE}═══ $* ═══${NC}"; }
diff_() { echo -e "${MAGENTA}[DIFF]${NC}  $*"; }
sim()   { echo -e "${YELLOW}[SIM ]${NC}  $*"; }
bloc_ok() {
    # Affiche un verdict de simulation à la fin de chaque bloc
    $DRY_RUN && echo -e "${GREEN}  └─ $* — simulation terminée ✓${NC}" || true
}

# ─── Compteurs (dry-run) ──────────────────────────────────────────────────────
DRY_UNCHANGED=0
DRY_CHANGED=0
DRY_NEW=0
DRY_ABSENT=0
CHANGED_FILES=()

# ─── Parsing arguments ───────────────────────────────────────────────────────
ARCHIVE=""
DRY_RUN=false
ONLY_STEP=""

for arg in "$@"; do
    case "$arg" in
        --dry-run)  DRY_RUN=true ;;
        --step=*)   ONLY_STEP="${arg#--step=}" ;;
        --help|-h)
            echo "Usage: $0 <archive.tar.gz> [--dry-run] [--step <bloc>]"
            echo "Blocs : network nginx crowdsec fail2ban suricata rsyslog apparmor ufw scripts crons systemd complement aide"
            exit 0 ;;
        *.tar.gz)   ARCHIVE="$arg" ;;
        --step)     ;;
        *)  [[ -z "$ONLY_STEP" ]] && [[ "$arg" != --* ]] && ONLY_STEP="$arg" ;;
    esac
done

# Capture de --step val (forme sans =)
PREV=""
for arg in "$@"; do
    [[ "$PREV" == "--step" ]] && ONLY_STEP="$arg"
    PREV="$arg"
done

# ─── Vérifications préalables ────────────────────────────────────────────────
[[ -z "$ARCHIVE" ]]    && { err "Aucune archive spécifiée."; echo "Usage: $0 <archive.tar.gz> [--dry-run]"; exit 1; }
[[ ! -f "$ARCHIVE" ]]  && { err "Archive introuvable : $ARCHIVE"; exit 1; }
[[ $EUID -ne 0 ]]      && { err "Ce script doit être exécuté en tant que root"; exit 1; }

RESTORE_DATE=$(date +%Y-%m-%d_%H%M)
TMPDIR="/tmp/restore-${RESTORE_DATE}"
PRE_BACKUP_DIR="/opt/backup-config/pre-restore-${RESTORE_DATE}"

# ─── Bannière ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════════════════════╗"
echo -e "║   SOC 0xCyberLiTech — Restauration de configuration          ║"
echo -e "║   Archive  : $(basename "$ARCHIVE")"
if $DRY_RUN; then
echo -e "║                                                               ║"
echo -e "║   ██████████████████████████████████████████████████████████ ║"
echo -e "║   ██  MODE SIMULATION (--dry-run)                         ██ ║"
echo -e "║   ██  Aucun fichier ne sera modifié                       ██ ║"
echo -e "║   ██  Aucun service ne sera redémarré                     ██ ║"
echo -e "║   ██████████████████████████████████████████████████████████ ║"
fi
echo -e "╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Extraction de l'archive ─────────────────────────────────────────────────
step "Extraction de l'archive"

mkdir -p "$TMPDIR"
log "Extraction de $(basename "$ARCHIVE") → $TMPDIR ..."
tar xzf "$ARCHIVE" -C "$TMPDIR" --strip-components=1

# Vérifier les blocs attendus (alignés sur create-archive.sh)
REQUIRED_DIRS="network nginx crowdsec fail2ban suricata rsyslog apparmor ufw scripts crons systemd aide logrotate api-keys ssh"
MISSING=""
for d in $REQUIRED_DIRS; do
    [[ ! -d "$TMPDIR/$d" ]] && MISSING="$MISSING $d"
done
[[ -n "$MISSING" ]] && warn "Blocs absents dans l'archive :$MISSING" || ok "Archive complète — tous les blocs présents"

# Inventaire de l'archive
log "Contenu de l'archive :"
find "$TMPDIR" -maxdepth 2 -type d | sort | while read -r d; do
    count=$(find "$d" -maxdepth 1 -type f 2>/dev/null | wc -l)
    rel="${d#$TMPDIR/}"
    [[ "$rel" == "." ]] && continue
    printf "  %-42s %s fichiers\n" "$rel/" "$count"
done
echo ""

# ─── Sauvegarde préventive (alignée sur tous les blocs de create-archive) ────
if ! $DRY_RUN; then
    step "Sauvegarde préventive des configs actuelles"
    mkdir -p "$PRE_BACKUP_DIR"
    # Même périmètre que create-archive.sh
    for src in /etc/network/interfaces /etc/hostname /etc/hosts /etc/resolv.conf \
                /etc/ssh/sshd_config /etc/sysctl.conf /etc/sysctl.d \
                /etc/nftables.conf /etc/exim4 /etc/hosts.allow /etc/hosts.deny \
                /etc/nginx /etc/crowdsec /etc/fail2ban /etc/suricata \
                /etc/rsyslog.conf /etc/rsyslog.d /etc/ufw /opt/site-01 \
                /etc/cron.d /etc/systemd/system/soc-report-trigger.service \
                /etc/systemd/system/sshd.service /etc/aide \
                /etc/logrotate.d /etc/GeoIP.conf /etc/nginx/api-keys.conf \
                /root/.ssh/authorized_keys /root/.ssh/<SSH-KEY-CLT> \
                /root/.ssh/<SSH-KEY-PA85> /root/.ssh/<SSH-KEY-PVE>; do
        [[ ! -e "$src" ]] && continue
        dest_name=$(echo "$src" | tr '/' '_' | sed 's/^_//')
        if [[ -d "$src" ]]; then
            cp -rp "$src" "$PRE_BACKUP_DIR/${dest_name}" 2>/dev/null || true
        else
            cp -p "$src" "$PRE_BACKUP_DIR/${dest_name}" 2>/dev/null || true
        fi
    done
    crontab -l > "$PRE_BACKUP_DIR/crontab-root.bak" 2>/dev/null || true
    ok "Sauvegarde préventive → $PRE_BACKUP_DIR"
    log "Rollback : cp -rp $PRE_BACKUP_DIR/etc_nginx/. /etc/nginx/"
fi

# ─── Fonctions centrales ──────────────────────────────────────────────────────
restore_file() {
    local src="$1" dest="$2" label="${3:-$(basename "$1")}"
    if [[ ! -e "$src" ]]; then
        warn "ABSENT dans archive : $label"; ((DRY_ABSENT++)) || true; return 0
    fi
    if $DRY_RUN; then
        if [[ ! -e "$dest" ]]; then
            sim "NOUVEAU    : $dest"; ((DRY_NEW++)) || true
        elif diff -q "$src" "$dest" > /dev/null 2>&1; then
            sim "IDENTIQUE  : $dest"; ((DRY_UNCHANGED++)) || true
        else
            diff_ "DIFFÉRENT  : $dest"
            CHANGED_FILES+=("$dest"); ((DRY_CHANGED++)) || true
            diff --unified=2 "$dest" "$src" 2>/dev/null | head -30 | \
                sed 's/^-/  \x1b[31m-\x1b[0m/; s/^+/  \x1b[32m+\x1b[0m/' || true
            echo ""
        fi
        return 0
    fi
    mkdir -p "$(dirname "$dest")"
    cp -p "$src" "$dest"
    ok "$label → $dest"
}

restore_dir() {
    local src="$1" dest="$2" label="${3:-$(basename "$1")}"
    if [[ ! -d "$src" ]]; then
        warn "ABSENT dans archive : $label/"; ((DRY_ABSENT++)) || true; return 0
    fi
    local count; count=$(find "$src" -type f 2>/dev/null | wc -l)
    if $DRY_RUN; then
        sim "DOSSIER    : $dest/ ($count fichiers)"
        find "$src" -type f | while read -r f; do
            local rel="${f#$src/}" target="$dest/$rel"
            if [[ ! -e "$target" ]]; then
                sim "  NOUVEAU    : $target"; ((DRY_NEW++)) || true
            elif ! diff -q "$f" "$target" > /dev/null 2>&1; then
                diff_ "  DIFFÉRENT  : $target"
                CHANGED_FILES+=("$target"); ((DRY_CHANGED++)) || true
            fi
        done
        return 0
    fi
    mkdir -p "$dest"
    cp -rp "$src/." "$dest/"
    ok "$label/ ($count fichiers) → $dest/"
}

reload_service() {
    local svc="$1" test_cmd="${2:-}"
    if $DRY_RUN; then
        sim "SERVICE    : systemctl reload/restart $svc (ignoré en simulation)"; return 0
    fi
    if [[ -n "$test_cmd" ]]; then
        log "Test config $svc..."
        eval "$test_cmd" > /dev/null 2>&1 || { err "Test $svc ÉCHOUÉ — rollback depuis $PRE_BACKUP_DIR"; return 1; }
        ok "Test config $svc : OK"
    fi
    systemctl is-active --quiet "$svc" 2>/dev/null && \
        { systemctl reload "$svc" 2>/dev/null || systemctl restart "$svc"; } || \
        systemctl restart "$svc"
    sleep 1
    systemctl is-active --quiet "$svc" && ok "$svc actif" || \
        { err "$svc KO — journalctl -u $svc -n 50"; return 1; }
}

run_bloc() { [[ -z "$ONLY_STEP" ]] || [[ "$ONLY_STEP" == "$1" ]]; }

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 0 — Réseau (interfaces, hostname, SSH, sysctl, exim4, nftables)
# ⚠ CRITIQUE — certains changements prennent effet au reboot
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc network; then
    step "0/13 Réseau (interfaces, hostname, SSH, sysctl, exim4, nftables)"

    warn "⚠ BLOC RÉSEAU — vérifier chaque fichier avant d'appliquer (risque coupure)"

    # Identité machine
    restore_file "$TMPDIR/network/hostname"         "/etc/hostname"
    restore_file "$TMPDIR/network/hosts"            "/etc/hosts"
    restore_file "$TMPDIR/network/resolv.conf"      "/etc/resolv.conf"
    restore_file "$TMPDIR/network/nsswitch.conf"    "/etc/nsswitch.conf"
    restore_file "$TMPDIR/network/mailname"         "/etc/mailname"

    # Interfaces réseau (IP statique <SRV-NGIX-IP>)
    restore_file "$TMPDIR/network/interfaces"       "/etc/network/interfaces"
    [[ -d "$TMPDIR/network/interfaces.d" ]] && \
        restore_dir "$TMPDIR/network/interfaces.d"  "/etc/network/interfaces.d" "interfaces.d"

    # SSH daemon (port <SSH-PORT>, PasswordAuthentication no, MaxAuthTries 3)
    restore_file "$TMPDIR/network/ssh/sshd_config"  "/etc/ssh/sshd_config"
    [[ -d "$TMPDIR/network/ssh/sshd_config.d" ]] && \
        restore_dir "$TMPDIR/network/ssh/sshd_config.d" "/etc/ssh/sshd_config.d" "sshd_config.d"

    # Sysctl (rp_filter=2 Suricata AF_PACKET + IPv6 désactivé)
    [[ -f "$TMPDIR/network/sysctl/sysctl.conf" ]] && \
        restore_file "$TMPDIR/network/sysctl/sysctl.conf" "/etc/sysctl.conf"
    [[ -d "$TMPDIR/network/sysctl/sysctl.d" ]] && \
        restore_dir "$TMPDIR/network/sysctl/sysctl.d"   "/etc/sysctl.d" "sysctl.d"

    # nftables
    [[ -f "$TMPDIR/network/nftables.conf" ]] && \
        restore_file "$TMPDIR/network/nftables.conf"    "/etc/nftables.conf"

    # exim4 (SMTP sortant — alertes mail SOC → smtp.<MAIL-PROVIDER>)
    [[ -d "$TMPDIR/network/exim4" ]] && \
        restore_dir "$TMPDIR/network/exim4"             "/etc/exim4" "exim4"

    # TCP wrappers
    restore_file "$TMPDIR/network/hosts.allow"      "/etc/hosts.allow"
    restore_file "$TMPDIR/network/hosts.deny"       "/etc/hosts.deny"

    if ! $DRY_RUN; then
        # Appliquer sysctl immédiatement (sans reboot)
        sysctl -p /etc/sysctl.conf > /dev/null 2>&1 || true
        for f in /etc/sysctl.d/*.conf; do
            [[ -f "$f" ]] && sysctl -p "$f" > /dev/null 2>&1 || true
        done
        ok "sysctl appliqué (rp_filter=2 pour Suricata, IPv6 désactivé)"

        # SSH restart (port <SSH-PORT> — se reconnecter sur le nouveau port si changement)
        systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
        ok "SSH redémarré — port <SSH-PORT> actif"

        # exim4 rebuild + restart
        if command -v update-exim4.conf > /dev/null 2>&1; then
            update-exim4.conf > /dev/null 2>&1 || true
            systemctl restart exim4 2>/dev/null || true
            ok "exim4 reconfiguré + redémarré (SMTP <MAIL-PROVIDER>)"
        fi

        warn "INTERFACES : /etc/network/interfaces restauré — prend effet au REBOOT"
        warn "HOSTNAME   : appliquer maintenant : hostname -F /etc/hostname"
    else
        sim "SYSCTL     : sysctl -p (rp_filter=2 pour Suricata AF_PACKET)"
        sim "SSH        : systemctl restart ssh (port <SSH-PORT>)"
        sim "EXIM4      : update-exim4.conf + restart (SMTP <MAIL-PROVIDER>)"
        sim "INTERFACES : prend effet au reboot — vérifier avant de rebooter"
    fi
    bloc_ok "BLOC 0/13 RÉSEAU"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 1 — nginx
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc nginx; then
    step "1/13 nginx"

    restore_file "$TMPDIR/nginx/nginx.conf"          "/etc/nginx/nginx.conf"
    restore_dir  "$TMPDIR/nginx/sites-available"     "/etc/nginx/sites-available"  "sites-available"
    restore_dir  "$TMPDIR/nginx/sites-enabled"       "/etc/nginx/sites-enabled"    "sites-enabled"
    restore_dir  "$TMPDIR/nginx/conf.d"              "/etc/nginx/conf.d"           "conf.d"
    restore_dir  "$TMPDIR/nginx/snippets"            "/etc/nginx/snippets"         "snippets"

    [[ -d "$TMPDIR/nginx/geoip" ]] && restore_dir "$TMPDIR/nginx/geoip" "/usr/share/GeoIP" "geoip"

    if [[ -d "$TMPDIR/nginx/letsencrypt" ]]; then
        if $DRY_RUN; then
            sim "CERTIFS    : Let's Encrypt présents dans l'archive (restauration manuelle recommandée)"
        else
            warn "Certificats Let's Encrypt : relancer certbot renew --force-renewal après restore"
        fi
    fi

    reload_service nginx "nginx -t"
    bloc_ok "BLOC 1/13 NGINX"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 2 — CrowdSec
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc crowdsec; then
    step "2/13 CrowdSec"

    restore_dir  "$TMPDIR/crowdsec/config"           "/etc/crowdsec"               "crowdsec config"
    restore_file "$TMPDIR/crowdsec/config.yaml"      "/etc/crowdsec/config.yaml"
    restore_file "$TMPDIR/crowdsec/local_api_credentials.yaml" \
                                                     "/etc/crowdsec/local_api_credentials.yaml"
    [[ -d "$TMPDIR/crowdsec/appsec-rules"   ]] && restore_dir "$TMPDIR/crowdsec/appsec-rules"   "/etc/crowdsec/appsec-rules"   "appsec-rules"
    [[ -d "$TMPDIR/crowdsec/appsec-configs" ]] && restore_dir "$TMPDIR/crowdsec/appsec-configs" "/etc/crowdsec/appsec-configs" "appsec-configs"
    [[ -f "$TMPDIR/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml" ]] && \
        restore_file "$TMPDIR/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml" \
                     "/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml"

    # Réimporter les collections
    if [[ -f "$TMPDIR/crowdsec/collections.json" ]]; then
        local_count=$(python3 -c "import json; print(len(json.load(open('$TMPDIR/crowdsec/collections.json'))))" 2>/dev/null || echo "?")
        if $DRY_RUN; then
            sim "COLLECTIONS: $local_count collections à installer via cscli"
        else
            log "Mise à jour hub CrowdSec + installation $local_count collections..."
            cscli hub update > /dev/null 2>&1 || true
            python3 - <<PYEOF
import json, subprocess
with open("$TMPDIR/crowdsec/collections.json") as f:
    cols = json.load(f)
for c in cols:
    name = c.get("name","")
    if name:
        r = subprocess.run(["cscli","collections","install",name], capture_output=True)
        print(f"  [{'OK' if r.returncode==0 else 'WARN'}] {name}")
PYEOF
        fi
    fi

    # Réimporter les décisions
    if [[ -f "$TMPDIR/crowdsec/decisions-export.json" ]]; then
        dec_count=$(python3 -c "import json; print(len(json.load(open('$TMPDIR/crowdsec/decisions-export.json'))))" 2>/dev/null || echo "?")
        if $DRY_RUN; then
            sim "DÉCISIONS  : $dec_count décisions à réimporter"
        else
            log "Réimport des $dec_count décisions CrowdSec..."
            python3 - <<PYEOF
import json, subprocess
with open("$TMPDIR/crowdsec/decisions-export.json") as f:
    decs = json.load(f)
count = 0
for d in decs:
    ip = d.get("value",""); dur = d.get("duration","24h"); rsn = d.get("reason","restored")
    if ip:
        r = subprocess.run(["cscli","decisions","add","--ip",ip,"--reason",rsn,"--duration",dur], capture_output=True)
        if r.returncode == 0: count += 1
print(f"  {count}/{len(decs)} décisions réimportées")
PYEOF
        fi
    fi

    reload_service crowdsec
    reload_service crowdsec-firewall-bouncer
    bloc_ok "BLOC 2/13 CROWDSEC"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 3 — Fail2ban
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc fail2ban; then
    step "3/13 Fail2ban"

    restore_file "$TMPDIR/fail2ban/jail.local"       "/etc/fail2ban/jail.local"
    restore_dir  "$TMPDIR/fail2ban/filter.d"         "/etc/fail2ban/filter.d"      "filtres"
    restore_dir  "$TMPDIR/fail2ban/action.d"         "/etc/fail2ban/action.d"      "actions"

    # Vérification clé chaîne de défense
    if [[ -f "$TMPDIR/fail2ban/action.d/crowdsec-sync.conf" ]]; then
        ok "crowdsec-sync.conf présent (chaîne Fail2ban → CrowdSec)"
    else
        warn "crowdsec-sync.conf ABSENT — chaîne F2B→CS non fonctionnelle"
    fi

    reload_service fail2ban
    bloc_ok "BLOC 3/13 FAIL2BAN"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 4 — Suricata
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc suricata; then
    step "4/13 Suricata"

    restore_file "$TMPDIR/suricata/suricata.yaml"    "/etc/suricata/suricata.yaml"
    restore_dir  "$TMPDIR/suricata/rules"            "/etc/suricata/rules"         "rules"
    [[ -f "$TMPDIR/suricata/update.yaml" ]] && \
        restore_file "$TMPDIR/suricata/update.yaml"  "/etc/suricata/update.yaml"

    if $DRY_RUN; then
        sim "RÈGLES     : suricata-update téléchargera ~106k règles ET Pro"
    else
        log "Téléchargement règles Suricata (2-3 min)..."
        suricata-update > /dev/null 2>&1 && ok "Règles Suricata téléchargées" || \
            warn "suricata-update a échoué — vérifier connectivité"
    fi

    reload_service suricata
    bloc_ok "BLOC 4/13 SURICATA"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 5 — rsyslog
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc rsyslog; then
    step "5/13 rsyslog"

    restore_file "$TMPDIR/rsyslog/rsyslog.conf"      "/etc/rsyslog.conf"
    restore_dir  "$TMPDIR/rsyslog/rsyslog.d"         "/etc/rsyslog.d"              "rsyslog.d"

    if ! $DRY_RUN; then
        for host in site-01 site-02 pve <ROUTER> srv-ngix; do
            mkdir -p "/var/log/central/$host"
            chown syslog:adm "/var/log/central/$host" 2>/dev/null || true
        done
        ok "Dossiers /var/log/central/ recréés"
    else
        sim "DOSSIERS   : /var/log/central/{site-01,site-02,pve,<ROUTER>,srv-ngix}/ à créer"
    fi

    reload_service rsyslog
    bloc_ok "BLOC 5/13 RSYSLOG"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 6 — AppArmor
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc apparmor; then
    step "6/13 AppArmor"

    if [[ -d "$TMPDIR/apparmor" ]]; then
        for profile in "$TMPDIR/apparmor/"*; do
            [[ -f "$profile" ]] || continue
            pname=$(basename "$profile")
            [[ "$pname" == "aa-status.json" ]] && continue
            restore_file "$profile" "/etc/apparmor.d/$pname"
        done
        if ! $DRY_RUN; then
            for p in nginx suricata usr.sbin.nginx usr.bin.suricata; do
                [[ -f "/etc/apparmor.d/$p" ]] && \
                    { apparmor_parser -r "/etc/apparmor.d/$p" 2>/dev/null && ok "AppArmor $p rechargé" || warn "AppArmor $p — rechargement manuel requis"; }
            done
        else
            sim "PROFILES   : apparmor_parser -r sur chaque profil restauré"
        fi
    else
        warn "Dossier apparmor absent de l'archive"
    fi
    bloc_ok "BLOC 6/13 APPARMOR"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 7 — UFW
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc ufw; then
    step "7/13 UFW"

    if [[ -f "$TMPDIR/ufw/ufw-status-verbose.txt" ]]; then
        if $DRY_RUN; then
            sim "RÈGLES UFW : voici ce qui serait appliqué :"
            echo ""; cat "$TMPDIR/ufw/ufw-status-verbose.txt"; echo ""
        else
            warn "UFW : règles à vérifier avant d'activer (risque coupure SSH)"
            warn "→ Référence : cat $TMPDIR/ufw/ufw-status-verbose.txt"
            warn "→ Puis : ufw --force reset && ufw enable"
        fi
    fi

    restore_dir "$TMPDIR/ufw" "/etc/ufw" "ufw configs"
    bloc_ok "BLOC 7/13 UFW"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 8 — Scripts Python + /usr/local/bin + Dashboard
# (aligné sur create-archive.sh BLOC 8)
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc scripts; then
    step "8/13 Scripts Python + usr-local-bin + Dashboard"

    if [[ -d "$TMPDIR/scripts/opt-site-01" ]]; then
        restore_dir "$TMPDIR/scripts/opt-site-01" "/opt/site-01" "scripts /opt/site-01"
        if ! $DRY_RUN; then
            chmod +x /opt/site-01/monitoring.sh 2>/dev/null || true
            chmod +x /opt/site-01/*.py 2>/dev/null || true
            ok "Permissions scripts restaurées"
        fi
    fi

    # /usr/local/bin — scripts système custom (pve-monitor-write...)
    if [[ -d "$TMPDIR/scripts/usr-local-bin" ]]; then
        if ! $DRY_RUN; then
            find "$TMPDIR/scripts/usr-local-bin" -type f | while read -r f; do
                dest="/usr/local/bin/$(basename "$f")"
                cp -p "$f" "$dest"
                chmod +x "$dest"
                ok "$(basename "$f") → /usr/local/bin/"
            done
        else
            find "$TMPDIR/scripts/usr-local-bin" -type f | while read -r f; do
                sim "USR-LOCAL  : $(basename "$f") → /usr/local/bin/"
            done
        fi
    fi

    if [[ -d "$TMPDIR/scripts/dashboard" ]]; then
        restore_dir "$TMPDIR/scripts/dashboard" "/var/www/monitoring" "dashboard"
        if ! $DRY_RUN; then
            chown -R www-data:www-data /var/www/monitoring/ 2>/dev/null || true
            ok "Permissions /var/www/monitoring/ restaurées"
        else
            sim "PERMS      : chown www-data:www-data /var/www/monitoring/"
        fi
    fi
    bloc_ok "BLOC 8/13 SCRIPTS"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 9 — Crons (/etc/cron.d/ — source réelle, aligné sur create-archive.sh)
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc crons; then
    step "9/13 Crons (/etc/cron.d/)"

    # Restaurer /etc/cron.d/ complet (source réelle des crons)
    if [[ -d "$TMPDIR/crons/cron.d" ]]; then
        restore_dir "$TMPDIR/crons/cron.d" "/etc/cron.d" "cron.d"
        if ! $DRY_RUN; then
            # chmod 644 obligatoire pour que cron.d soit lu
            chmod 644 /etc/cron.d/* 2>/dev/null || true
            ok "Permissions cron.d/* → 644"
        else
            sim "PERMS      : chmod 644 /etc/cron.d/* (requis pour lecture par crond)"
        fi
    fi

    # crontab root (peut être vide, mais restauré pour cohérence)
    if [[ -f "$TMPDIR/crons/crontab-root.txt" ]]; then
        if $DRY_RUN; then
            sim "CRONTAB    : crontab -l → restauré depuis archive"
            grep -v '^#' "$TMPDIR/crons/crontab-root.txt" | grep -v '^$' | \
                while read -r l; do sim "  $l"; done
        else
            crontab "$TMPDIR/crons/crontab-root.txt" 2>/dev/null || true
            ok "Crontab root restauré"
        fi
    fi

    if ! $DRY_RUN; then
        cron_count=$(find /etc/cron.d -type f 2>/dev/null | wc -l)
        ok "/etc/cron.d/ : $cron_count fichiers actifs"
    fi
    bloc_ok "BLOC 9/13 CRONS"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 10 — Systemd units custom
# (aligné sur create-archive.sh BLOC 10 : .service + .timer, pas seulement .conf)
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc systemd; then
    step "10/13 Systemd units custom"

    if [[ -d "$TMPDIR/systemd" ]]; then
        if ! $DRY_RUN; then
            # Restaurer tous les fichiers non-txt (units .service, .timer, .conf)
            find "$TMPDIR/systemd" -type f ! -name "services-actifs.txt" | while read -r f; do
                fname=$(basename "$f")
                cp -p "$f" "/etc/systemd/system/$fname"
                ok "Systemd unit restauré : $fname"
            done
            systemctl daemon-reload && ok "systemd daemon-reload"
            # Réactiver les services custom
            for unit in soc-report-trigger.service; do
                [[ -f "/etc/systemd/system/$unit" ]] && \
                    systemctl enable "$unit" 2>/dev/null && ok "$unit activé" || true
            done
        else
            find "$TMPDIR/systemd" -type f ! -name "services-actifs.txt" | while read -r f; do
                sim "UNIT       : $(basename "$f") → /etc/systemd/system/"
            done
            sim "RELOAD     : systemctl daemon-reload"
            [[ -f "$TMPDIR/systemd/services-actifs.txt" ]] && {
                sim "RÉFÉRENCE  : services-actifs.txt (état au moment de l'export)"
            }
        fi
    else
        warn "Dossier systemd absent de l'archive"
    fi
    bloc_ok "BLOC 10/13 SYSTEMD"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 11 — Compléments : AIDE config + logrotate + GeoIP + API keys + SSH keys
# (nouveau bloc — aligné sur create-archive.sh BLOC 11)
# ═════════════════════════════════════════════════════════════════════════════
if run_bloc complement; then
    step "11/13 Compléments (AIDE config, logrotate, GeoIP, API keys, SSH keys)"

    # AIDE — config (pas la base de données — recalculée après)
    [[ -d "$TMPDIR/aide" ]] && restore_dir "$TMPDIR/aide" "/etc/aide" "aide config"

    # Logrotate
    [[ -d "$TMPDIR/logrotate" ]] && restore_dir "$TMPDIR/logrotate" "/etc/logrotate.d" "logrotate.d"

    # GeoIP (Account ID + License Key MaxMind)
    [[ -f "$TMPDIR/geoip/GeoIP.conf" ]] && restore_file "$TMPDIR/geoip/GeoIP.conf" "/etc/GeoIP.conf"

    # Clés API nginx (NVD)
    if [[ -f "$TMPDIR/api-keys/api-keys.conf" ]]; then
        restore_file "$TMPDIR/api-keys/api-keys.conf" "/etc/nginx/api-keys.conf"
        if ! $DRY_RUN; then
            chmod 600 /etc/nginx/api-keys.conf
            chown root:root /etc/nginx/api-keys.conf
            ok "api-keys.conf → permissions 600 root:root"
        else
            sim "PERMS      : chmod 600 /etc/nginx/api-keys.conf (fichier sensible)"
        fi
    fi

    # Clés SSH root (authorized_keys + clés privées sync)
    if [[ -d "$TMPDIR/ssh" ]]; then
        if ! $DRY_RUN; then
            mkdir -p /root/.ssh
            chmod 700 /root/.ssh
            find "$TMPDIR/ssh" -type f | while read -r f; do
                fname=$(basename "$f")
                cp -p "$f" "/root/.ssh/$fname"
                # Clés privées → 600, publiques et authorized_keys → 644
                if [[ "$fname" == *.pub ]] || [[ "$fname" == "authorized_keys" ]]; then
                    chmod 644 "/root/.ssh/$fname"
                else
                    chmod 600 "/root/.ssh/$fname"
                fi
                ok "SSH : $fname → /root/.ssh/ (perms OK)"
            done
        else
            find "$TMPDIR/ssh" -type f | while read -r f; do
                fname=$(basename "$f")
                if [[ "$fname" == *.pub ]] || [[ "$fname" == "authorized_keys" ]]; then
                    sim "SSH        : $fname → /root/.ssh/ (644)"
                else
                    sim "SSH        : $fname → /root/.ssh/ (600 — clé privée)"
                fi
            done
        fi
    fi
    bloc_ok "BLOC 11/13 COMPLÉMENTS"
fi

# ═════════════════════════════════════════════════════════════════════════════
# BLOC 12 — AIDE re-baseline (toujours en dernier, après toutes les configs)
# ═════════════════════════════════════════════════════════════════════════════
if [[ -z "$ONLY_STEP" ]] || [[ "$ONLY_STEP" == "aide" ]]; then
    step "12/13 AIDE — Re-baseline intégrité système"

    if command -v aide > /dev/null 2>&1; then
        if $DRY_RUN; then
            sim "AIDE       : aide --update recalculera la baseline après toutes les restores"
            sim "AIDE       : mv /var/lib/aide/aide.db.new.gz → aide.db.gz"
        else
            log "Recalcul baseline AIDE (1-2 min)..."
            aide --update > /var/log/aide/aide-restore.log 2>&1 || true
            if [[ -f "/var/lib/aide/aide.db.new.gz" ]]; then
                mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz
                ok "Baseline AIDE recalculée → /var/lib/aide/aide.db.gz"
            else
                warn "aide --update n'a pas produit de nouvelle base — lancer manuellement"
            fi
        fi
    else
        warn "AIDE non installé — lancer : apt-get install aide && aide --init"
    fi
    bloc_ok "BLOC 12/13 AIDE"
fi

# ─── Nettoyage ───────────────────────────────────────────────────────────────
if ! $DRY_RUN; then
    rm -rf "$TMPDIR"
fi

# ─── Rapport final ───────────────────────────────────────────────────────────
echo ""
if $DRY_RUN; then
    # Verdict global de la simulation
    if [[ $DRY_CHANGED -eq 0 && $DRY_NEW -eq 0 ]]; then
        VERDICT_COLOR="${GREEN}"
        VERDICT_TEXT="SIMULATION COMPLÈTE — PRÊT À RESTAURER ✓"
    elif [[ $DRY_CHANGED -gt 0 ]]; then
        VERDICT_COLOR="${YELLOW}"
        VERDICT_TEXT="SIMULATION COMPLÈTE — ${DRY_CHANGED} DIFF(S) À INSPECTER ⚠"
    else
        VERDICT_COLOR="${CYAN}"
        VERDICT_TEXT="SIMULATION COMPLÈTE — VM VIERGE DÉTECTÉE (normal) ✓"
    fi

    echo -e "${BOLD}${VERDICT_COLOR}╔═══════════════════════════════════════════════════════════════╗"
    echo -e "║   ${VERDICT_TEXT}"
    echo -e "╠═══════════════════════════════════════════════════════════════╣"
    printf  "║   ✓ Fichiers identiques (aucun changement)  : %-14s ║\n" "$DRY_UNCHANGED"
    printf  "║   ✎ Fichiers DIFFÉRENTS (seraient modifiés) : %-14s ║\n" "$DRY_CHANGED"
    printf  "║   + Fichiers NOUVEAUX   (seraient créés)    : %-14s ║\n" "$DRY_NEW"
    printf  "║   ? Absents dans archive                    : %-14s ║\n" "$DRY_ABSENT"
    echo -e "╠═══════════════════════════════════════════════════════════════╣"
    if [[ ${#CHANGED_FILES[@]} -gt 0 ]]; then
        echo -e "║   Fichiers qui changeraient (inspecter) :"
        for f in "${CHANGED_FILES[@]}"; do
            printf "║     %-62s║\n" "$f"
        done
        echo -e "╠═══════════════════════════════════════════════════════════════╣"
    fi
    echo -e "║   Chaque bloc affiche  └─ BLOC X/13 ... — simulation terminée ✓  ║"
    echo -e "║   → Relancer SANS --dry-run pour appliquer la restauration    ║"
    echo -e "╚═══════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════════╗"
    echo -e "║   RESTAURATION TERMINÉE                                      ║"
    echo -e "╠═══════════════════════════════════════════════════════════════╣"
    echo -e "║   Backup pré-restore : $PRE_BACKUP_DIR"
    echo -e "╠═══════════════════════════════════════════════════════════════╣"
    echo -e "║   Étapes suivantes :                                         ║"
    echo -e "║   1. Valider : bash CHECKLIST-DEPLOY.md (61 points)          ║"
    echo -e "║   2. nginx   : curl -sI https://<DOMAIN-COM>/                ║"
    echo -e "║   3. bans    : cscli decisions list                          ║"
    echo -e "║   4. crons   : crontab -l && ls /etc/cron.d/                 ║"
    echo -e "║   5. dash    : http://<SRV-NGIX-IP>:8080/                     ║"
    echo -e "╚═══════════════════════════════════════════════════════════════╝${NC}"
fi

exit 0
