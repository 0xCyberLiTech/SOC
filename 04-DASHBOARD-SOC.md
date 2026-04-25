<div align="center">

# 📊 Dashboard SOC — Architecture front-end

*SPA vanilla JS · 24 modules · 35 tuiles · zéro dépendance NPM*

![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=white) ![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white) ![Modules](https://img.shields.io/badge/Modules-24 JS-00D9FF?style=flat-square) ![Tuiles](https://img.shields.io/badge/Tuiles-35-00FF88?style=flat-square)

[← 03 — Défense](03-SECURITE-BRIQUES.md) &nbsp;·&nbsp; [⬡ SOC 0xCyberLiTech](README.md) &nbsp;·&nbsp; [05 — Chaîne →](05-CHAINE-DEFENSE.md)

</div>

---

## Vue d'ensemble

Single Page Application (SPA) vanilla JS — zéro dépendance NPM.

- **Fichier** : `/var/www/monitoring/index.html`
- **Version** : v3.97.x (ligne 1 du HTML)
- **Polling** : toutes les 60 secondes vers `monitoring.json`
- **Résolution** : 24 modules JS, 35 tuiles, 1 400 lignes CSS

---

## Architecture modules JS

```
/var/www/monitoring/js/
├── 01-utils.js          ← Fonctions utilitaires (fmtBytes, fmtDate, escHtml...)
├── 02-canvas-kc.js      ← Kill Chain canvas + modal tactique _kcInvestigateIP
├── 03-geo.js            ← Carte Leaflet + marqueurs GeoIP
├── 04-metrics.js        ← Métriques nginx (req/h, error rate, bande passante)
├── 05-crowdsec.js       ← Tuile CrowdSec (décisions, scénarios, CAPI)
├── 06-suricata.js       ← Tuile Suricata (alertes sév.1/2/3, top rules)
├── 07-render.js         ← Moteur de rendu principal (35 tuiles)
├── 08-fail2ban.js       ← Tuile Fail2ban (jails, bans actifs)
├── 09-modals-core.js    ← Système modal centralisé (open/close/overlay)
├── 10-ip-info.js        ← Modal informations IP (quick lookup)
├── 11-bind.js           ← Event bindings globaux (data-action dispatcher)
├── 12-threatscore.js    ← Calcul ThreatScore 0-100 (24 briques)
├── 13-aide.js           ← Tuile AIDE (intégrité système)
├── 14-ufw.js            ← Tuile UFW (règles pare-feu)
├── 15-apparmor.js       ← Tuile AppArmor (profils enforce)
├── 16-nginx-headers.js  ← Tuile headers sécurité nginx
├── 17-honeypot.js       ← Tuile honeypot (touchés par phase Kill Chain)
├── 18-jarvis-chat.js    ← Widget JARVIS (TTS, chat, analyse LLM)
├── 19-xdr.js            ← Tuile XDR (corrélation cross-sources)
├── 20-rsyslog.js        ← Tuile rsyslog (5 hôtes, log central)
├── 21-cve.js            ← Tuile CVE (feed NVD, alertes critiques)
├── 22-ip-deep.js        ← Modal IP Deep (GeoIP+WHOIS+Fail2ban+CrowdSec 30j)
├── 23-network.js        ← Tuile réseau (proto-live, bande passante)
└── 24-windows.js        ← Tuile Windows (disque D: + CPU/GPU + backup Proxmox)
```

---

## 35 Tuiles en production

### Rangée 1 — Indicateurs globaux
| # | Tuile | Source données |
|---|-------|----------------|
| 1 | ThreatScore (0-100 + jauge) | 24 briques monitoring.json |
| 2 | Kill Chain MITRE ATT&CK | active_decisions + logs |
| 3 | Carte GeoIP mondiale | top_ips + GeoIP2 |
| 4 | Métriques nginx (req/h, erreurs) | nginx access.log |

### Rangée 2 — Sécurité
| # | Tuile | Source données |
|---|-------|----------------|
| 5 | CrowdSec LAPI | cscli decisions + CAPI |
| 6 | Fail2ban | fail2ban-client status |
| 7 | Suricata alertes | eve.json |
| 8 | AppSec WAF | CrowdSec AppSec logs |

### Rangée 3 — Système
| # | Tuile | Source données |
|---|-------|----------------|
| 9 | UFW règles | ufw status |
| 10 | AppArmor profils | aa-status |
| 11 | AIDE intégrité | /var/log/aide/aide.log |
| 12 | Headers sécurité nginx | curl -I |

### Rangée 4 — Réseau / Corrélation
| # | Tuile | Source données |
|---|-------|----------------|
| 13 | XDR corrélation | cross-source signals |
| 14 | rsyslog central | /var/log/central/ (5 hôtes) |
| 15 | CVE actives | NVD feed + AppSec |
| 16 | Honeypot | fake services logs |

### Rangée 5 — Infrastructure
| # | Tuile | Source données |
|---|-------|----------------|
| 17 | Mise à jour système nginx | apt |
| 18 | Mise à jour système site-01 | apt via SSH |
| 19 | Mise à jour système site-02 | apt via SSH |
| 20 | Windows (disque/GPU/backup) | windows-disk.json |
| 21 | Protocoles réseau live | proto-live.py |
| 22 | JARVIS IA | localhost:5000/api/status |

### Rangée 6 — Hôtes distants + services
| # | Tuile | Source données |
|---|-------|----------------|
| 23 | Services systemd | systemctl --failed |
| 24-35 | ... | (tuiles supplémentaires selon version) |

---

## Flux données monitoring.json

```
monitoring_gen.py (cron */5 min)
      │
      ├── nginx logs        → stats : req_hour, error_rate, top_ips, bytes
      ├── CrowdSec LAPI     → active_decisions, alerts_30d, scenarios
      ├── Fail2ban           → bans par jail, total_banned
      ├── Suricata eve.json  → alertes sév.1/2/3, top_signatures
      ├── UFW               → règles actives
      ├── AppArmor          → profils enforce/complain
      ├── AIDE              → dernière vérification, statut
      ├── apt (SSH site-01/site-02)→ paquets à mettre à jour
      ├── rsyslog central   → logs 5 hôtes, corrélations
      ├── ThreatScore       → calcul 24 briques → score 0-100
      └── Kill Chain        → classification IPs actives
      │
      └──→ /var/www/monitoring/monitoring.json
```

---

## Système modal centralisé (09-modals-core.js)

Tout modal du dashboard utilise le même mécanisme :

```html
<!-- Déclencheur dans index.html -->
<div class="card" data-panel="nom-du-panel" data-panel-title="TITRE AFFICHÉ">
  ...contenu tuile...
</div>
```

Le handler global dans `11-bind.js` intercepts les clics sur `[data-panel]` et ouvre le modal avec `openPanel(panelName, title)`.

**Aucun JS supplémentaire nécessaire** pour une nouvelle tuile avec modal.

---

## Conventions de développement

### Cache-busters
Chaque module JS est chargé avec un cache-buster dans `index.html` :
```html
<script src="js/07-render.js?v=3.97.152"></script>
```
À chaque modification d'un module, incrémenter son cache-buster **ET** le numéro de version global (ligne 1 du HTML).

### Versioning HTML
```html
<!-- v3.97.155 — SOC Dashboard 0xCyberLiTech -->
```
Format : `v{majeur}.{fonctionnel}.{patch}`

### NDT (Non-Déterminisme Technique)
Convention audit qualité — score cible 99/100 :
- Tous les accès à des valeurs potentiellement `undefined` → guards `||0`, `||''`, `(x||[])`
- Pas de `var` dans des closures (utiliser `let`/`const`)
- Division : toujours `(a/(b||1))`
- `.slice()` / `.toUpperCase()` : toujours `(str||'').slice()`

### Pas de dépendances NPM
Le dashboard est vanilla JS pur. Seule exception : **Leaflet.js** (carte) chargé depuis `/libs/`.

---

*Document : 04-DASHBOARD-SOC.md · Projet SOC 0xCyberLiTech · 2026-04-25*
---

<div align="center">

[← 03 — Défense](03-SECURITE-BRIQUES.md) &nbsp;·&nbsp; [⬡ README](README.md) &nbsp;·&nbsp; [05 — Chaîne →](05-CHAINE-DEFENSE.md)

*0xCyberLiTech — SOC Homelab · 2026*

</div>
