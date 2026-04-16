# Étape 7 — Dashboard et déploiement final

## Objectif

Le dashboard SOC est une **architecture modulaire** : `index.html` + `css/monitoring.css` + **22 modules JavaScript**.  
Aucune dépendance externe, aucun framework — tout est auto-contenu.  
Il se déploie fichier par fichier par `scp`.

---

## Architecture du dashboard

```
dashboard/
├── index.html                  ← structure HTML + chargement des 22 modules
├── css/
│   └── monitoring.css          ← thème dark, variables CSS, animations
└── js/
    ├── 01-utils.js             ← esc(), fmt(), fmtB(), constantes SOC_INFRA
    ├── 02-canvas-kc.js         ← Kill Chain canvas (hexagones, IPs par stage)
    ├── 03-canvas-kci.js        ← Kill Chain Investigation mini-chain
    ├── 04-canvas-misc.js       ← Sparklines, latence, graphes trafic
    ├── 05-canvas-leaflet.js    ← Carte Leaflet interactive + computeThreatScore()
    ├── 06-canvas-geomap.js     ← Canvas geomap world polygons
    ├── 07-render.js            ← Rendu principal + orchestrateur tuiles
    ├── 08-modals-fbx.js        ← Modals AUTO-BAN, Freebox, Mises à jour
    ├── 09-modals-core.js       ← Modals Proxmox, Suricata, CrowdSec, fail2ban
    ├── 10-modals-win.js        ← Modals Windows, GPU, Sauvegardes
    ├── 11-bind.js              ← Event bindings + click handlers tuiles
    ├── 12-router.js            ← Modal Routeur + graphes
    ├── 13-fw-fetch.js          ← Firewall fetch + matrix rendu
    ├── 14-modal-firewall.js    ← Modal Firewall
    ├── 15-modal-traffic.js     ← Modal analyse trafic
    ├── 16-soc-enhancements.js  ← Strip alertes, freshness, mode projection
    ├── 16b-defense-chain.js    ← CHAÎNE DE DÉFENSE (tuile interactive)
    ├── 17-fetch.js             ← Boucle fetch principale (30s)
    ├── 18-jarvis-ui.js         ← JARVIS interface (onglets, journal)
    ├── 18-jarvis-chat.js       ← JARVIS Chat (streaming LLM)
    ├── 18-jarvis-engine.js     ← JARVIS Engine SOC (boucle autonome 60s)
    └── 19-xdr.js               ← XDR Correlation Engine
```

---

## Modules clés

### `07-render.js` — Orchestrateur principal

Appelé à chaque refresh (fetch `monitoring.json` toutes les 30s).  
Délègue à chaque `_renderXxx(d, g)` — `d` = données JSON, `g` = élément grid.

```javascript
// Pattern de base — rendu modulaire
function _renderSuricata(d, g) {
    var sur = d.suricata || {};
    var sev1 = sur.sev1_24h || 0;
    var col = sev1 > 0 ? 'var(--red)' : 'var(--green)';
    var h = '<div class="card" id="sur-tile">'
        + '<div class="card-inner">'
        + '<div class="ct" style="color:' + col + '">◈ SURICATA IDS</div>'
        + '<div class="sval" style="color:' + col + '">' + esc(String(sev1)) + '</div>'
        + '</div></div>';
    g.insertAdjacentHTML('beforeend', h);
}
```

### `05-canvas-leaflet.js` — ThreatScore + Carte

`computeThreatScore(data)` — score 0–100 sur **20 briques** avec **5 règles anti-doublons** :

| Anti-doublon | Description |
|-------------|-------------|
| `exploitUnblocked` | Pivot central — Kill Chain + CS EXPLOIT + Suricata simultanément |
| Kill Rate | `_kcNeutralized` = csD + satellites F2B — srv-ngix F2B exclu (dans csD via crowdsec-sync) |
| F2B satellites | `totalBansAll` = proxmox + site-01 + site-02 — srv-ngix exclu |
| nginx-botsearch | `tot_failed` uniquement — `cur_banned` exclu (dans csD) |
| Escalade Suricata | Supprimée si CS auto-ban actif et EXPLOIT neutralisé |

### `16b-defense-chain.js` — CHAÎNE DE DÉFENSE

Tuile interactive affichant l'état temps réel de chaque couche défensive.

**7 nœuds principaux** (ordre flux) :

| Nœud | Rôle |
|------|------|
| UFW + nftables | 1ère ligne — ports, stateless drop |
| GeoIP Block | Filtrage géographique nginx |
| AppSec WAF | CrowdSec WAF ~207 vPatch CVE |
| CrowdSec IDS/IPS | Détection comportementale + ban nftables |
| Suricata IDS | DPI ~90k règles — sév.1 → ban 168h |
| fail2ban | 4 hôtes — logs nginx/SSH/Apache |
| nginx | Reverse proxy + bouncer natif |

**3 branches terminales** (couverture hôtes) :

| Branche | Briques |
|---------|---------|
| Serveur principal | AppArmor enforce (workers nginx) |
| Site-01 | AppArmor enforce + ModSecurity OWASP CRS |
| Site-02 | AppArmor enforce + ModSecurity OWASP CRS |
| JARVIS | IA locale — boucle autonome 60s |

Clic sur un nœud → popup avec métriques temps réel (état, compteurs, mode).

### `19-xdr.js` — XDR Correlation Engine

Moteur de corrélation multi-sources en 4 étapes : **COLLECT → NORMALIZE → CORRELATE → EXPOSE**.

**Sources collectées :**

| Source | Données |
|--------|---------|
| fail2ban | Bans multi-hôtes |
| UFW | Drops stateless |
| AppArmor | Denials enforce |
| ModSecurity site-01/site-02 | Blocs WAF OWASP |
| Suricata IDS | Alertes réseau |
| AUTOBAN | Bans automatiques monitoring_gen.py |
| NGX DROP | Drops nginx |

**Pipeline de corrélation :**

```
COLLECT     → normalisation des événements bruts de chaque source
NORMALIZE   → log parser (26 evt), GEO/IP (344 geo-bloqués), IOC/CTI (32 actifs)
CORRELATE   → score de corrélation, MITRE ATT&CK mapping (Y1110, 91595)
EXPOSE      → CrowdSec BAN (IPs bannies), fail2ban (multi-hôtes), JARVIS agent
```

---

## Déploiement

### Script complet (depuis Windows Git Bash)

```bash
#!/usr/bin/env bash
# deploy-soc.sh — Déploiement complet dashboard SOC

SSH_KEY="$HOME/.ssh/id_soc"
SSH_HOST="socadmin@VOTRE_IP"
SSH_PORT="2222"
DASHBOARD="./dashboard"
REMOTE="/var/www/monitoring"

echo "Déploiement index.html + CSS..."
scp -i "$SSH_KEY" -P "$SSH_PORT" -o IdentitiesOnly=yes \
    "$DASHBOARD/index.html" \
    "$DASHBOARD/css/monitoring.css" \
    "$SSH_HOST:$REMOTE/"

echo "Déploiement modules JS..."
scp -i "$SSH_KEY" -P "$SSH_PORT" -o IdentitiesOnly=yes \
    $DASHBOARD/js/*.js \
    "$SSH_HOST:$REMOTE/js/"

# Vérification
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://VOTRE_IP:8080/)
echo "[HTTP $HTTP] Dashboard $([ "$HTTP" = "200" ] && echo OK || echo ERR)"
```

### Vérification post-déploiement

```bash
# Version déployée
curl -s http://VOTRE_IP:8080/ | head -1 | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+'

# Nombre de modules JS chargés (attendu : 22)
curl -s http://VOTRE_IP:8080/ | grep -c 'src="js/'
```

---

## Stack défensive complète

```
┌─────────────────────────────────────────────────────────────────┐
│  INTERNET                                                       │
│      ↓                                                          │
│  UFW + nftables      → ports non autorisés rejetés              │
│  GeoIP Block         → pays à risque bloqués (nginx)            │
│  AppSec WAF          → ~207 vPatch CVE (CrowdSec bouncer)       │
│  CrowdSec IDS/IPS    → détection comportementale + ban          │
│  Suricata IDS        → DPI ~90k règles — sév.1 → ban CS 168h    │
│  fail2ban            → 4 hôtes — logs nginx/SSH/Apache          │
│  nginx               → reverse proxy + TLS + bouncer natif      │
│      ↓                                                          │
│  AppArmor enforce    → workers nginx/Apache confinés            │
│  ModSecurity CRS     → OWASP Layer-7 sur Apache (site-01/02)    │
│  JARVIS IA           → boucle autonome 60s — ban/restart/TTS    │
│      ↓                                                          │
│  monitoring_gen.py   → cron 5 min → monitoring.json             │
│  Dashboard SOC       → 22 modules JS — 34 tuiles — LAN only     │
│  XDR Engine          → corrélation multi-sources temps réel     │
└─────────────────────────────────────────────────────────────────┘
```

---

**Félicitations — votre SOC homelab est opérationnel.**

Pour aller plus loin : intégrer [JARVIS](https://github.com/0xCyberLiTech/JARVIS)  
pour automatiser les bans, les redémarrages de services, et recevoir des alertes vocales.
