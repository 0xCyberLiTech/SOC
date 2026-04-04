#!/usr/bin/env bash
# =============================================================================
# ufw-snapshot.sh — Export des règles UFW au format JSON
# =============================================================================
# Produit ufw-cache-[hostname].json dans /var/www/monitoring/
# Lancé par cron quotidiennement ou à chaque changement de règle.
# =============================================================================

set -euo pipefail

HOSTNAME=$(hostname -s)
OUTPUT="/var/www/monitoring/ufw-cache-${HOSTNAME}.json"
TMP="${OUTPUT}.tmp"

# Vérifier que UFW est actif
if ! ufw status | grep -q "Status: active"; then
    echo '{"active":false,"rules":[]}' > "$TMP"
    mv "$TMP" "$OUTPUT"
    exit 0
fi

# Récupérer les règles verbose
UFW_OUTPUT=$(ufw status verbose 2>/dev/null)

# Exporter en JSON via Python
python3 - "$UFW_OUTPUT" "$OUTPUT" "$TMP" << 'PYEOF'
import sys, json, re, os

ufw_text = sys.argv[1] if len(sys.argv) > 1 else ""
output   = sys.argv[2] if len(sys.argv) > 2 else "/tmp/ufw-cache.json"
tmp      = sys.argv[3] if len(sys.argv) > 3 else "/tmp/ufw-cache.json.tmp"

# Lire UFW status verbose depuis stdin si pas d'argument
if not ufw_text:
    import subprocess
    ufw_text = subprocess.check_output(["ufw", "status", "verbose"], text=True)

rules = []
for line in ufw_text.splitlines():
    # Format : "PORT/PROTOCOL    ACTION    FROM"
    m = re.match(r'^\s*(\S+)\s+(ALLOW|DENY|REJECT|LIMIT)\s+(.*)', line)
    if m:
        rules.append({
            "port":   m.group(1),
            "action": m.group(2),
            "from":   m.group(3).strip() or "Anywhere",
        })

result = {
    "active":   True,
    "hostname": os.uname().nodename,
    "ts":       int(__import__("time").time()),
    "rules":    rules,
    "count":    len(rules),
}

with open(tmp, "w") as f:
    json.dump(result, f, indent=2, ensure_ascii=False)
os.replace(tmp, output)
print(f"[OK] {len(rules)} règles exportées → {output}")
PYEOF
