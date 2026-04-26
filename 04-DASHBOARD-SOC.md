<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EDASHBOARD_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Dashboard sécurité homelab · CrowdSec WAF · Suricata IDS · JARVIS IA.</h2>

  <p align="center">
    <a href="https://0xcyberlitech.github.io/">
      <img src="https://img.shields.io/badge/Portfolio-0xCyberLiTech-181717?logo=github&style=flat-square" alt="Portfolio" />
    </a>
    <a href="https://github.com/0xCyberLiTech">
      <img src="https://img.shields.io/badge/Profil-GitHub-181717?logo=github&style=flat-square" alt="Profil GitHub" />
    </a>
    <a href="https://github.com/0xCyberLiTech/SOC">
      <img src="https://img.shields.io/badge/Dépôt-SOC-00B4D8?logo=github&style=flat-square" alt="Dépôt SOC" />
    </a>
    <a href="README.md">
      <img src="https://img.shields.io/badge/📄%20README-SOC-00B4D8?style=flat-square" alt="README" />
    </a>
    <a href="https://github.com/0xCyberLiTech?tab=repositories">
      <img src="https://img.shields.io/badge/Dépôts-publics-blue?style=flat-square" alt="Dépôts publics" />
    </a>
  </p>

</div>

<div align="center">
  <img src="https://img.icons8.com/fluency/96/000000/cyber-security.png" alt="CyberSec" width="80"/>
</div>

<div align="center">
  <p>
    <strong>Cybersécurité défensive</strong> <img src="https://img.icons8.com/color/24/000000/lock--v1.png"/> &nbsp;•&nbsp; <strong>Homelab en production</strong> <img src="https://img.icons8.com/color/24/000000/linux.png"/> &nbsp;•&nbsp; <strong>IA locale intégrée</strong> <img src="https://img.icons8.com/color/24/000000/shield-security.png"/>
  </p>
</div>

---

<h2 align="center">Vue d'ensemble</h2>

Single Page Application (SPA) vanilla JS — zéro dépendance NPM.

- **Fichier** : `/var/www/monitoring/index.html`
- **Version** : v3.97.x (ligne 1 du HTML)
- **Polling** : toutes les 60 secondes vers `monitoring.json`
- **Résolution** : 24 modules JS, 35 tuiles, 1 400 lignes CSS

---

<h2 align="center">Architecture modules JS</h2>

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

<h2 align="center">35 Tuiles en production</h2>

<h3 align="center">Rangée 1 — Indicateurs globaux</h3>

| # | Tuile | Source données |
|---|-------|----------------|
| 1 | ThreatScore (0-100 + jauge) | 24 briques monitoring.json |
| 2 | Kill Chain MITRE ATT&CK | active_decisions + logs |
| 3 | Carte GeoIP mondiale | top_ips + GeoIP2 |
| 4 | Métriques nginx (req/h, erreurs) | nginx access.log |

<h3 align="center">Rangée 2 — Sécurité</h3>

| # | Tuile | Source données |
|---|-------|----------------|
| 5 | CrowdSec LAPI | cscli decisions + CAPI |
| 6 | Fail2ban | fail2ban-client status |
| 7 | Suricata alertes | eve.json |
| 8 | AppSec WAF | CrowdSec AppSec logs |

<h3 align="center">Rangée 3 — Système</h3>

| # | Tuile | Source données |
|---|-------|----------------|
| 9 | UFW règles | ufw status |
| 10 | AppArmor profils | aa-status |
| 11 | AIDE intégrité | /var/log/aide/aide.log |
| 12 | Headers sécurité nginx | curl -I |

<h3 align="center">Rangée 4 — Réseau / Corrélation</h3>

| # | Tuile | Source données |
|---|-------|----------------|
| 13 | XDR corrélation | cross-source signals |
| 14 | rsyslog central | /var/log/central/ (5 hôtes) |
| 15 | CVE actives | NVD feed + AppSec |
| 16 | Honeypot | fake services logs |

<h3 align="center">Rangée 5 — Infrastructure</h3>

| # | Tuile | Source données |
|---|-------|----------------|
| 17 | Mise à jour système nginx | apt |
| 18 | Mise à jour système site-01 | apt via SSH |
| 19 | Mise à jour système site-02 | apt via SSH |
| 20 | Windows (disque/GPU/backup) | windows-disk.json |
| 21 | Protocoles réseau live | proto-live.py |
| 22 | JARVIS IA | localhost:5000/api/status |

<h3 align="center">Rangée 6 — Hôtes distants + services</h3>

| # | Tuile | Source données |
|---|-------|----------------|
| 23 | Services systemd | systemctl --failed |
| 24-35 | ... | (tuiles supplémentaires selon version) |

---

<h2 align="center">Flux données monitoring.json</h2>

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

<h2 align="center">Système modal centralisé (09-modals-core.js)</h2>

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

<h2 align="center">Conventions de développement</h2>

<h3 align="center">Cache-busters</h3>

Chaque module JS est chargé avec un cache-buster dans `index.html` :
```html
<script src="js/07-render.js?v=3.97.152"></script>
```
À chaque modification d'un module, incrémenter son cache-buster **ET** le numéro de version global (ligne 1 du HTML).

<h3 align="center">Versioning HTML</h3>

```html
<!-- v3.97.155 — SOC Dashboard 0xCyberLiTech -->
```
Format : `v{majeur}.{fonctionnel}.{patch}`

<h3 align="center">NDT (Non-Déterminisme Technique)</h3>

Convention audit qualité — score cible 99/100 :
- Tous les accès à des valeurs potentiellement `undefined` → guards `||0`, `||''`, `(x||[])`
- Pas de `var` dans des closures (utiliser `let`/`const`)
- Division : toujours `(a/(b||1))`
- `.slice()` / `.toUpperCase()` : toujours `(str||'').slice()`

<h3 align="center">Pas de dépendances NPM</h3>

Le dashboard est vanilla JS pur. Seule exception : **Leaflet.js** (carte) chargé depuis `/libs/`.

---

<div align="center">

## Stack technique

<table>
<tr>
<td align="center"><b>🖥️ Infrastructure & Sécurité</b></td>
<td align="center"><b>💻 Développement & Web</b></td>
<td align="center"><b>🤖 Intelligence Artificielle</b></td>
</tr>
<tr>
<td align="center">
  <a href="https://www.kernel.org/"><img src="https://skillicons.dev/icons?i=linux" width="48" title="Linux" /></a>
  <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="48" title="Debian" /></a>
  <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="48" title="Bash" /></a>
  <br/>
  <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="48" title="Nginx" /></a>
  <a href="https://www.docker.com"><img src="https://skillicons.dev/icons?i=docker" width="48" title="Docker" /></a>
  <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="48" title="Git" /></a>
</td>
<td align="center">
  <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="48" title="Python" /></a>
  <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="48" title="Flask" /></a>
  <a href="https://developer.mozilla.org/docs/Web/HTML"><img src="https://skillicons.dev/icons?i=html" width="48" title="HTML5" /></a>
  <br/>
  <a href="https://developer.mozilla.org/docs/Web/CSS"><img src="https://skillicons.dev/icons?i=css" width="48" title="CSS3" /></a>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="48" title="JavaScript" /></a>
  <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="48" title="VS Code" /></a>
</td>
<td align="center">
  <a href="https://pytorch.org"><img src="https://skillicons.dev/icons?i=pytorch" width="48" title="PyTorch" /></a>
  <a href="https://www.tensorflow.org"><img src="https://skillicons.dev/icons?i=tensorflow" width="48" title="TensorFlow" /></a>
  <a href="https://www.raspberrypi.com"><img src="https://skillicons.dev/icons?i=raspberrypi" width="48" title="Raspberry Pi" /></a>
  <br/><br/>
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  &nbsp;
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projets proposés par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Développés en collaboration avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>
