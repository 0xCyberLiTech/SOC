# Étape 4 — Suricata IDS

## Objectif
Suricata est un **IDS réseau** (Intrusion Detection System) : il analyse le trafic  
réseau en temps réel et génère des alertes selon 90 000+ signatures de menaces.

```
Trafic réseau → Suricata (analyse paquets) → eve.json → monitoring_gen.py → dashboard
```

> Mode IDS (détection seule) recommandé sur VM unique sans redondance.  
> Le mode IPS (blocage inline) nécessite une architecture redondante.

---

## Étape 4.1 — Installation

```bash
apt install -y suricata suricata-update
systemctl enable suricata
```

---

## Étape 4.2 — Configuration de base

Fichier : `/etc/suricata/suricata.yaml`

```yaml
# Interface réseau à surveiller
af-packet:
  - interface: eth0        # Adapter à votre interface (ip a)
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes

# Sorties des alertes
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: /var/log/suricata/eve.json
      types:
        - alert:
            payload: no         # Ne pas logger le contenu des paquets
            payload-printable: no
            metadata: yes
        - stats:
            enabled: yes

# Répertoire des règles
default-rule-path: /var/lib/suricata/rules
rule-files:
  - suricata.rules
```

---

## Étape 4.3 — Mise à jour des règles

```bash
# Première mise à jour (télécharge les règles Emerging Threats)
suricata-update

# Vérifier le nombre de règles chargées
suricata -T -c /etc/suricata/suricata.yaml 2>&1 | grep "rules loaded"
# → X rules loaded

# Cron quotidien — 03h30
echo "30 3 * * * root /usr/bin/suricata-update >> /var/log/suricata-update.log 2>&1 && systemctl reload suricata" \
    > /etc/cron.d/suricata-update
```

---

## Étape 4.4 — Démarrage et vérification

```bash
systemctl start suricata
systemctl status suricata

# Vérifier que les alertes s'écrivent
tail -f /var/log/suricata/eve.json | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        e = json.loads(line)
        if e.get('event_type') == 'alert':
            print(f'[ALERT] {e[\"alert\"][\"signature\"]} — {e.get(\"src_ip\",\"?\")}')
    except: pass
"
```

---

## Étape 4.5 — Collecte pour le dashboard

```python
# Exemple : lire les alertes Suricata des 24 dernières heures
import json
from datetime import datetime, timezone, timedelta

EVE_LOG = "/var/log/suricata/eve.json"

def get_suricata_alerts():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    alerts = []
    sev_counts = {1: 0, 2: 0, 3: 0}

    try:
        with open(EVE_LOG) as f:
            for line in f:
                try:
                    e = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if e.get("event_type") != "alert":
                    continue

                ts = datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00"))
                if ts < cutoff:
                    continue

                sev = e["alert"].get("severity", 3)
                sev_counts[sev] = sev_counts.get(sev, 0) + 1
                alerts.append({
                    "ts":        e["timestamp"],
                    "signature": e["alert"]["signature"],
                    "severity":  sev,
                    "src_ip":    e.get("src_ip", ""),
                    "category":  e["alert"].get("category", ""),
                })
    except FileNotFoundError:
        return {"available": False}

    return {
        "available":   True,
        "total_24h":   len(alerts),
        "sev1":        sev_counts.get(1, 0),
        "sev2":        sev_counts.get(2, 0),
        "top_sigs":    _top_signatures(alerts, n=5),
    }

def _top_signatures(alerts, n=5):
    counts = {}
    for a in alerts:
        counts[a["signature"]] = counts.get(a["signature"], 0) + 1
    return sorted(counts.items(), key=lambda x: -x[1])[:n]
```

---

## Comprendre les niveaux de sévérité

| Sévérité | Signification | Exemple |
|----------|--------------|---------|
| **1 — Critique** | Exploit actif, compromission possible | CVE exploitée, shell inversé |
| **2 — Haute** | Scan agressif, tentative d'intrusion | Nmap SYN scan, brute force |
| **3 — Informative** | Trafic suspect, recon passive | DNS inhabituel, beacon HTTP |

---

## Logrotate

```
/var/log/suricata/*.log /var/log/suricata/*.json {
    daily
    rotate 7
    compress
    missingok
    notifempty
    sharedscripts
    postrotate
        systemctl reload suricata
    endscript
}
```

---

**Étape suivante →** [05 — fail2ban](./05-FAIL2BAN.md)
