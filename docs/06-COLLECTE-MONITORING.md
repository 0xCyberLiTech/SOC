# Étape 6 — Collecte de données : monitoring_gen.py

## Objectif
`monitoring_gen.py` est le **cœur du SOC** : il s'exécute toutes les 5 minutes,  
collecte les données de tous les outils de sécurité, et produit `monitoring.json`  
que le dashboard lit pour s'afficher.

```
┌──────────────────────────────────────────────────────────────┐
│                    monitoring_gen.py                         │
│                                                              │
│  parse_nginx_logs()    → trafic 24h, GeoIP, top IPs          │
│  get_crowdsec_stats()  → décisions, scénarios, AppSec        │
│  get_suricata_stats()  → alertes IDS 24h, sev1/sev2          │
│  get_fail2ban_stats()  → jails, IPs bannies, 4 hôtes         │
│  get_ufw_stats()       → règles, anomalies                   │
│  get_system_metrics()  → CPU, RAM, disque, charge            │
│  get_proxmox_stats()   → VMs, CPU, RAM via API               │
│  get_freebox_stats()   → WAN, SFP, débit via API Freebox     │
│                    ↓                                         │
│              monitoring.json                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Étape 6.1 — Structure du script

```python
#!/usr/bin/env python3
"""
monitoring_gen.py — Collecte SOC
Génère /var/www/monitoring/monitoring.json toutes les 5 minutes.
"""

import json
import os
import subprocess
import time
from datetime import datetime, timezone, timedelta

# ── Configuration ──────────────────────────────────────────────
OUTPUT_PATH    = "/var/www/monitoring/monitoring.json"
NGINX_LOG      = "/var/log/nginx/access.log"
FAIL2BAN_JAILS = ["sshd", "nginx-http-auth", "nginx-cve"]


def main():
    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "traffic":      parse_nginx_logs(),
        "crowdsec":     get_crowdsec_stats(),
        "suricata":     get_suricata_stats(),
        "fail2ban":     get_fail2ban_stats(),
        "ufw":          get_ufw_stats(),
        "system":       get_system_metrics(),
        # Ajouter ici vos modules supplémentaires...
    }

    # Écriture atomique (évite les lectures partielles par nginx)
    tmp = OUTPUT_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, OUTPUT_PATH)

    print(f"[OK] monitoring.json généré — "
          f"{data['traffic']['total_requests']} req/24h")


if __name__ == "__main__":
    main()
```

---

## Étape 6.2 — Parsing des logs nginx

```python
import re
from collections import Counter

# Format Combined Log nginx
LOG_RE = re.compile(
    r'(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] '
    r'"(?P<method>\S+) (?P<path>\S+) \S+" '
    r'(?P<status>\d+) (?P<size>\d+)'
)

def parse_nginx_logs():
    cutoff = time.time() - 86400  # 24h
    total = errors = geo_blocks = 0
    top_ips = Counter()
    top_paths = Counter()

    try:
        with open(NGINX_LOG) as f:
            for line in f:
                m = LOG_RE.match(line)
                if not m:
                    continue
                # Filtrer sur 24h (approximation via position fichier)
                total += 1
                ip     = m.group("ip")
                status = int(m.group("status"))
                path   = m.group("path")

                if status >= 400:
                    errors += 1
                if status == 444:          # nginx block GeoIP
                    geo_blocks += 1

                top_ips[ip] += 1
                top_paths[path] += 1

    except FileNotFoundError:
        return {"total_requests": 0, "error_rate": 0}

    error_rate = round(errors / max(total, 1) * 100, 1)

    return {
        "total_requests": total,
        "errors":         errors,
        "error_rate":     error_rate,
        "geo_blocks":     geo_blocks,
        "top_ips":        top_ips.most_common(10),
        "top_paths":      top_paths.most_common(10),
    }
```

---

## Étape 6.3 — Métriques système

```python
import psutil

def get_system_metrics():
    cpu    = psutil.cpu_percent(interval=1)
    mem    = psutil.virtual_memory()
    disk   = psutil.disk_usage("/")
    load   = os.getloadavg()

    return {
        "cpu_pct":    cpu,
        "ram_pct":    mem.percent,
        "ram_used_gb": round(mem.used / 1e9, 1),
        "ram_total_gb": round(mem.total / 1e9, 1),
        "disk_pct":   disk.percent,
        "disk_used_gb": round(disk.used / 1e9, 1),
        "disk_total_gb": round(disk.total / 1e9, 1),
        "load_1":     load[0],
        "load_5":     load[1],
    }
```

---

## Étape 6.4 — Historique bande passante réseau

```python
NET_HISTORY_FILE = "/var/www/monitoring/net-history.json"
NET_HISTORY_MAX  = 288  # 24h à 5 min

def update_net_history():
    """Accumule le débit réseau (bytes/s) toutes les 5 minutes."""
    try:
        # Lire les compteurs bruts du kernel
        rx_total = tx_total = iface = None
        with open("/proc/net/dev") as f:
            for line in f:
                parts = line.split()
                if not parts or ":" not in parts[0]:
                    continue
                name = parts[0].rstrip(":")
                if name == "lo":
                    continue
                rx_total, tx_total, iface = int(parts[1]), int(parts[9]), name
                break

        if not iface:
            return []

        ts  = int(time.time())
        raw = {}
        pts = []

        # Charger l'historique existant
        if os.path.exists(NET_HISTORY_FILE):
            with open(NET_HISTORY_FILE) as f:
                saved = json.load(f)
                raw = saved.get("raw", {})
                pts = saved.get("points", [])

        # Nettoyer les points > 24h
        pts = [p for p in pts if p.get("ts", 0) > ts - 86400]

        # Calculer le débit depuis la dernière mesure
        if raw.get("ts") and 0 < ts - raw["ts"] < 600:
            dt     = ts - raw["ts"]
            rx_bps = max(0, (rx_total - raw.get("rx", rx_total))) // dt
            tx_bps = max(0, (tx_total - raw.get("tx", tx_total))) // dt
            pts.append({"ts": ts, "rx": rx_bps, "tx": tx_bps})

        # Sauvegarder
        tmp = NET_HISTORY_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump({
                "raw":    {"ts": ts, "rx": rx_total, "tx": tx_total},
                "iface":  iface,
                "points": pts,
            }, f)
        os.replace(tmp, NET_HISTORY_FILE)

        return pts[-48:]  # Retourner les 4 dernières heures

    except Exception:
        return []
```

---

## Étape 6.5 — Détection de pics de bande passante

```python
NET_SPIKE_FILE = "/var/www/monitoring/net-spike-log.json"
SPIKE_THRESHOLD_MBPS = 1.5   # Seuil absolu
SPIKE_FACTOR         = 2.0   # Multiplicateur vs moyenne

def detect_net_spikes():
    """Détecte les pics > seuil ET > N× la moyenne glissante. Persiste 7 jours."""
    now    = int(time.time())
    cutoff = now - 7 * 86400

    # Charger l'historique réseau
    try:
        with open(NET_HISTORY_FILE) as f:
            pts = json.load(f).get("points", [])
    except Exception:
        return []

    if len(pts) < 8:
        return []

    # Charger le log de pics existant
    try:
        with open(NET_SPIKE_FILE) as f:
            spike_log = json.load(f)
    except Exception:
        spike_log = []

    logged_ts = {e["ts"] for e in spike_log}
    recent    = pts[-72:]  # 6 dernières heures
    WINDOW    = 12         # Contexte : 1 heure (12 × 5 min)

    for i in range(WINDOW, len(recent)):
        p  = recent[i]
        ts = p["ts"]
        if ts in logged_ts:
            continue

        # Moyenne glissante sur WINDOW points précédents
        ctx    = recent[i - WINDOW:i]
        avg_rx = sum(c["rx"] for c in ctx) / WINDOW
        avg_tx = sum(c["tx"] for c in ctx) / WINDOW

        rx_mbps = p["rx"] / 125_000
        tx_mbps = p["tx"] / 125_000

        is_spike = (
            (rx_mbps > SPIKE_THRESHOLD_MBPS and rx_mbps > SPIKE_FACTOR * max(avg_rx / 125_000, 0.01)) or
            (tx_mbps > SPIKE_THRESHOLD_MBPS and tx_mbps > SPIKE_FACTOR * max(avg_tx / 125_000, 0.01))
        )

        if is_spike:
            spike_log.append({
                "ts":      ts,
                "rx_mbps": round(rx_mbps, 2),
                "tx_mbps": round(tx_mbps, 2),
            })
            logged_ts.add(ts)

    # Nettoyage : > 7 jours et limite 100 entrées
    spike_log = [e for e in spike_log if e["ts"] >= cutoff][-100:]

    # Sauvegarder
    tmp = NET_SPIKE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(spike_log, f, ensure_ascii=False)
    os.replace(tmp, NET_SPIKE_FILE)

    return spike_log
```

---

## Étape 6.6 — Cron d'exécution

```bash
# /etc/cron.d/monitoring
# Exécution toutes les 5 minutes
*/5 * * * * root /usr/bin/python3 /opt/soc/scripts/monitoring_gen.py >> /var/log/soc.log 2>&1
```

---

**Étape suivante →** [07 — Dashboard et déploiement final](./07-DASHBOARD.md)
