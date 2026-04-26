#!/bin/bash
# /opt/clt/monitoring.sh — Monitoring data refresh wrapper
# Version : 1.1.0 — 2026-03-11
# Log format nginx (v1.1) : IP [date:time TZ] "REQUEST" STATUS BYTES "REFERER" "UA" country=XX

LOCK=/tmp/monitoring.lock
LOG_DIR=/var/log/nginx
GOACCESS_OUT=/var/www/monitoring/goaccess.html

if [ -f "$LOCK" ]; then
    PID=$(cat "$LOCK")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[SKIP] Already running (PID $PID)"
        exit 0
    fi
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

python3 /opt/clt/monitoring_gen.py

if command -v goaccess >/dev/null 2>&1 && [ -f "$LOG_DIR/access.log" ]; then
    # CSS dans le webroot (GoAccess crée un <link href=...>, pas d'inline)
    cp /opt/clt/goaccess-soc-theme.css /var/www/monitoring/goaccess-soc-theme.css
    # Pipe stdin : root lit les logs (rw-r----- www-data:adm), GoAccess lit stdin
    # 14 jours : archives .gz + .1 (delaycompress) + log courant
    (zcat "$LOG_DIR"/access.log.*.gz 2>/dev/null; \
     cat "$LOG_DIR/access.log.1" 2>/dev/null; \
     cat "$LOG_DIR/access.log") \
    | goaccess - \
        --log-format='%h [%d:%t %^] "%r" %s %b "%R" "%u" country=%^ scheme=%^' \
        --date-format='%d/%b/%Y' \
        --time-format='%H:%M:%S' \
        --output="$GOACCESS_OUT" \
        --no-global-config \
        --ignore-crawlers \
        --geoip-database=/usr/share/GeoIP/GeoLite2-City.mmdb \
        --html-report-title='0xCyberLiTech - srv-ngix - Nginx Analytics (14j)' \
        --html-custom-css=goaccess-soc-theme.css \
        2>/dev/null && echo "[OK] goaccess.html generated"
fi

chown www-data:www-data /var/www/monitoring/monitoring.json 2>/dev/null || true
chown www-data:www-data /var/www/monitoring/goaccess.html   2>/dev/null || true
chmod 644 /var/www/monitoring/monitoring.json               2>/dev/null || true
chmod 644 /var/www/monitoring/goaccess.html                 2>/dev/null || true
