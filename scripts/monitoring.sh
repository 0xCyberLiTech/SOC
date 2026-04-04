#!/usr/bin/env bash
# =============================================================================
# monitoring.sh — Wrapper d'exécution pour monitoring_gen.py
# =============================================================================
# Lancé par cron toutes les 5 minutes.
# Gère le verrouillage (évite les exécutions simultanées) et le logging.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="/usr/bin/python3"
MONITORING_PY="$SCRIPT_DIR/monitoring_gen.py"
LOCK_FILE="/tmp/monitoring_gen.lock"
LOG_FILE="/var/log/soc.log"
MAX_LOG_SIZE=10485760  # 10 Mo

# ── Rotation log simple ───────────────────────────────────────────────────────
if [[ -f "$LOG_FILE" ]]; then
    size=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if [[ "$size" -gt "$MAX_LOG_SIZE" ]]; then
        mv "$LOG_FILE" "${LOG_FILE}.1"
    fi
fi

# ── Verrouillage (évite les exécutions simultanées) ───────────────────────────
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SKIP — monitoring_gen.py déjà en cours" >> "$LOG_FILE"
    exit 0
fi

# ── Exécution ─────────────────────────────────────────────────────────────────
echo "[$(date '+%Y-%m-%d %H:%M:%S')] START" >> "$LOG_FILE"
START_TS=$(date +%s)

"$PYTHON" "$MONITORING_PY" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

END_TS=$(date +%s)
DURATION=$((END_TS - START_TS))

if [[ "$EXIT_CODE" -eq 0 ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK — ${DURATION}s" >> "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERR exit=$EXIT_CODE — ${DURATION}s" >> "$LOG_FILE"
fi

exit "$EXIT_CODE"
