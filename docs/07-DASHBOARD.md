# Étape 7 — Dashboard et déploiement final

## Objectif
Le dashboard SOC est un **fichier HTML/CSS/JS unique** (~12 300 lignes).  
Aucune dépendance externe, aucun framework — tout est auto-contenu.  
Il se déploie par un simple `scp`.

---

## Architecture du dashboard

```
monitoring-index.html
├── <head>
│   └── <style> — ~700 lignes CSS (thème dark, glassmorphism, animations)
├── <body>
│   ├── Header fixe (version, actions rapides, score menace global)
│   ├── Grille de tuiles (27 tuiles, responsive)
│   └── Modals de détail (1 par tuile)
└── <script>
    ├── Collecte données (fetch monitoring.json toutes les 30s)
    ├── Rendu de chaque tuile (fonctions buildXxx)
    ├── Modals (openXxxModal)
    ├── computeThreatScore() — score global 0-100
    ├── Graphiques Canvas (sparklines, donut, histogrammes)
    └── Intégration JARVIS (actions SOC, alertes vocales)
```

---

## Structure JavaScript — pattern de base

Chaque source de données suit le même pattern :

```javascript
// 1. Récupération (fetch toutes les 30s)
function fetchData() {
    var ts = Date.now();
    fetch('/monitoring.json?t=' + ts)
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
            if (!data) return;
            window._lastData = data;
            renderAll(data);
        })
        .catch(function() { /* fail silencieux */ });
}

// 2. Rendu (appelé à chaque refresh)
function renderAll(data) {
    buildTrafficTile(data.traffic);
    buildCrowdSecTile(data.crowdsec);
    buildSuricataTile(data.suricata);
    buildFail2banTile(data.fail2ban);
    // ...
    computeThreatScore(data);
}

// 3. Exemple : tuile simple
function buildSuricataTile(sur) {
    var el = document.getElementById('suricata-tile');
    if (!el || !sur || !sur.available) return;

    var sev1 = sur.sev1 || 0;
    var sev2 = sur.sev2 || 0;
    var color = sev1 > 0 ? 'var(--red)' : sev2 > 0 ? 'var(--amber)' : 'var(--green)';

    el.innerHTML =
        '<div class="ct" style="color:' + color + '">◈ SURICATA IDS</div>' +
        '<div class="stat-box">' +
            '<div class="sval" style="color:' + color + '">' + sev1 + '</div>' +
            '<div class="slbl">CRITIQUE sév.1</div>' +
        '</div>';
}
```

---

## computeThreatScore — Score global

```javascript
/**
 * Calcule un score de menace 0-100 à partir de toutes les sources.
 * Chaque source contribue un nombre de points, plafonné.
 *
 * Sources :
 *   CrowdSec décisions, scénarios, AppSec
 *   fail2ban bans (4 hôtes)
 *   Suricata sev1/sev2
 *   UFW anomalies
 *   Services DOWN
 *   Routeur (WAN flood, conntrack, FW drops)
 */
function computeThreatScore(data) {
    var score = 0;

    // CrowdSec — max 20 pts
    var cs = data.crowdsec || {};
    if (cs.active_decisions > 100) score += 8;
    else if (cs.active_decisions > 50) score += 5;
    else if (cs.active_decisions > 10) score += 2;

    // fail2ban — max 12 pts (3 pts × 4 hôtes)
    var f2b = data.fail2ban || {};
    var allBanned = (f2b.total_banned || 0);
    if (allBanned > 50) score += 12;
    else if (allBanned > 20) score += 8;
    else if (allBanned > 5)  score += 4;

    // Suricata — max 15 pts
    var sur = data.suricata || {};
    if ((sur.sev1 || 0) > 10) score += 15;
    else if ((sur.sev1 || 0) > 0) score += 8;
    if ((sur.sev2 || 0) > 50) score += 5;

    // Services DOWN — max 20 pts
    var services = data.services || [];
    var downCount = services.filter(function(s) {
        return s.status !== 'active';
    }).length;
    score += Math.min(downCount * 5, 20);

    // Plafonner à 100
    score = Math.min(score, 100);

    // Affichage
    var level = score >= 70 ? 'CRITIQUE' :
                score >= 40 ? 'ÉLEVÉ'    :
                score >= 20 ? 'MODÉRÉ'   : 'NOMINAL';

    document.getElementById('threat-score').textContent = score;
    document.getElementById('threat-level').textContent = level;

    return { score: score, level: level };
}
```

---

## Déploiement

### Depuis Linux/Mac
```bash
scp -P 2222 monitoring-index.html socadmin@VOTRE_IP:/var/www/monitoring/index.html
```

### Depuis Windows (PowerShell)
```powershell
scp -i ~/.ssh/id_soc -P 2222 `
    "C:\Projets\SOC\dashboard\monitoring-index.html" `
    socadmin@VOTRE_IP:/var/www/monitoring/index.html
```

### Vérification post-déploiement
```bash
# Code HTTP 200 ?
curl -s -o /dev/null -w "%{http_code}" http://VOTRE_IP:8080/

# Version dans le fichier ?
head -1 /var/www/monitoring/index.html | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+'
```

---

## Script de déploiement complet (optionnel)

```bash
#!/usr/bin/env bash
# deploy.sh — Déploiement rapide du dashboard SOC

set -euo pipefail

SSH_KEY="$HOME/.ssh/id_soc"
SSH_HOST="socadmin@VOTRE_IP"
SSH_PORT="2222"
SOURCE="./dashboard/monitoring-index.html"
REMOTE="/var/www/monitoring/index.html"

echo "Déploiement en cours..."

scp -i "$SSH_KEY" -P "$SSH_PORT" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=no \
    "$SOURCE" "$SSH_HOST:$REMOTE"

# Vérification
HTTP=$(ssh -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_HOST" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/")

if [[ "$HTTP" == "200" ]]; then
    echo "[OK] Dashboard déployé — HTTP $HTTP"
else
    echo "[ERR] Vérifier nginx — HTTP $HTTP"
    exit 1
fi
```

---

## Résumé de la stack complète

```
┌─────────────────────────────────────────────────────────────────┐
│  INTERNET                                                        │
│      ↓                                                           │
│  nginx (port 80/443)                                             │
│      ↓                                                           │
│  CrowdSec AppSec WAF → bloque exploits CVE avant nginx           │
│  CrowdSec IPS → bloque IPs malveillantes (nftables)             │
│  Suricata IDS → alerte sur le trafic réseau                      │
│  fail2ban → bloque brute force SSH/web                           │
│  UFW → pare-feu réseau (politique deny)                          │
│      ↓                                                           │
│  monitoring_gen.py (cron 5 min)                                  │
│      ↓                                                           │
│  monitoring.json → Dashboard HTML → Navigateur LAN               │
└─────────────────────────────────────────────────────────────────┘
```

---

**Félicitations — votre SOC homelab est opérationnel.**

Pour aller plus loin : intégrer [JARVIS](https://github.com/0xCyberLiTech/JARVIS)  
pour automatiser les bans, les redémarrages de services, et recevoir des alertes vocales.
