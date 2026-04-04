# Étape 3 — CrowdSec

## Objectif
CrowdSec est un IPS collaboratif : il analyse les logs nginx en temps réel,  
détecte les comportements malveillants et partage les décisions avec la communauté.

```
Internet → nginx → logs → CrowdSec (analyse) → bouncer (blocage nftables)
```

---

## Étape 3.1 — Installation

```bash
# Ajouter le dépôt officiel
curl -s https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh | bash

# Installer CrowdSec + bouncer firewall
apt install -y crowdsec crowdsec-firewall-bouncer-nftables
```

---

## Étape 3.2 — Collections essentielles

Les **collections** sont des ensembles de règles de détection thématiques.

```bash
# Nginx — attaques web, scans, exploits
cscli collections install crowdsecurity/nginx

# Bases communes
cscli collections install crowdsecurity/linux

# CVE critiques (exploits connus)
cscli collections install crowdsecurity/http-cve

# Bots et crawlers malveillants
cscli collections install crowdsecurity/http-crawlers-whitelist

# Vérification
cscli collections list
```

---

## Étape 3.3 — AppSec WAF (vPatch CVE)

Le module AppSec est un WAF intégré à CrowdSec. Il bloque les exploits CVE  
**avant même que la requête atteigne nginx**.

```bash
# Installer le composant AppSec
cscli appsec-configs install crowdsecurity/appsec-default
cscli appsec-rules install crowdsecurity/base-config

# Configurer l'acquisition nginx pour AppSec
# Fichier : /etc/crowdsec/acquis.d/nginx.yaml
```

```yaml
# /etc/crowdsec/acquis.d/nginx.yaml
filenames:
  - /var/log/nginx/access.log
  - /var/log/nginx/error.log
labels:
  type: nginx
---
source: appsec
listen_addr: 127.0.0.1:7422
path: /
appsec_config: crowdsecurity/appsec-default
labels:
  type: appsec
```

```bash
systemctl restart crowdsec
```

---

## Étape 3.4 — Bouncer firewall

Le bouncer applique les décisions CrowdSec au niveau nftables (kernel).

```bash
# Configurer le bouncer
# Fichier : /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml

# mode: nftables (recommandé sur Debian 12+)
# api_url: http://127.0.0.1:8080
# api_key: GENERE_AUTOMATIQUEMENT_A_L_INSTALLATION

systemctl enable --now crowdsec-firewall-bouncer
```

---

## Étape 3.5 — Vérification

```bash
# Statut général
cscli metrics

# Décisions actives (IPs bannies)
cscli decisions list

# Alertes récentes
cscli alerts list --limit 20

# Scenarios actifs
cscli scenarios list | grep enabled
```

**Exemple de sortie `cscli decisions list` :**
```
+--------+----------+-------------------+--------------------+--------+----------+
|   ID   |  Source  |      Scenario     |        IP          | Action | Duration |
+--------+----------+-------------------+--------------------+--------+----------+
|  1234  | crowdsec | http-scan-uniques | 198.51.100.42      |  ban   |  24h0m   |
|  1235  | crowdsec | http-bf-uniques   | 203.0.113.15       |  ban   |  24h0m   |
+--------+----------+-------------------+--------------------+--------+----------+
```

---

## Étape 3.6 — Collecte des métriques pour le dashboard

Le script `monitoring_gen.py` interroge CrowdSec via son API locale pour alimenter le dashboard.

```python
# Exemple : récupérer les décisions actives via l'API CrowdSec
import requests

CROWDSEC_API = "http://127.0.0.1:8080"
CROWDSEC_KEY = "VOTRE_API_KEY_LOCALE"  # dans /etc/crowdsec/local_api_credentials.yaml

headers = {"X-Api-Key": CROWDSEC_KEY}

def get_crowdsec_decisions():
    resp = requests.get(f"{CROWDSEC_API}/v1/decisions", headers=headers, timeout=5)
    if resp.status_code == 200:
        decisions = resp.json() or []
        return {
            "active_decisions": len(decisions),
            "scenarios": list({d["scenario"] for d in decisions}),
        }
    return {"active_decisions": 0, "scenarios": []}
```

---

## Cron de mise à jour automatique

CrowdSec se met à jour via un timer systemd intégré :

```bash
# Vérifier le timer
systemctl list-timers | grep crowdsec

# Forcer une mise à jour manuelle
cscli hub update && cscli hub upgrade
```

---

**Étape suivante →** [04 — Suricata IDS](./04-SURICATA.md)
