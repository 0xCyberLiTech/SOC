<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EKILL+CHAIN_" alt="SOC 0xCyberLiTech" />
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

```
ATTAQUE ENTRANTE
      │
      ▼
nginx (access.log + error.log)
      │
      ├──→ Fail2ban parse les logs
      │          │
      │          └──→ crowdsec-sync : cscli decisions add --ip <IP> --reason "fail2ban-<jail>" --duration 24h
      │
      ├──→ CrowdSec AppSec WAF (inline) ──→ BLOCK si match vpatch/CRS
      │
      └──→ Suricata IDS (AF_PACKET)
                 │
                 └──→ eve.json → collection crowdsecurity/suricata
                                      │
                                      └──→ CrowdSec LAPI
                                                 │
                                                 └──→ nftables bouncer
                                                       (ban immédiat)

CrowdSec LAPI (source unique vérité bans depuis 2026-04-12)
      │
      ├──→ CAPI (partage communauté mondiale)
      ├──→ nftables sets (3 sets : CAPI + cscli + local)
      └──→ Dashboard SOC (monitoring.json → active_decisions)

rsyslog /var/log/central/
      │
      └──→ monitoring_gen.py → corrélations cross-hôtes
                 │
                 └──→ JARVIS soc.py → analyse → ban auto si critique
```

---

<h2 align="center">CrowdSec — Source unique de vérité des bans</h2>

Depuis la refactorisation du 2026-04-12, **CrowdSec est l'unique autorité de ban**.

| Avant (legacy) | Après (actuel) |
|----------------|----------------|
| Fail2ban gérait ses propres chaînes nftables | Fail2ban → crowdsec-sync uniquement |
| CrowdSec gérait ses sets nftables | CrowdSec LAPI gère tout |
| Double bans possibles | Source unique, pas de doublons |

---

<h2 align="center">Fail2ban — Rôle détecteur uniquement</h2>

<h3 align="center">Jails configurées</h3>

```ini
# /etc/fail2ban/jail.local

[sshd]
enabled  = true
port     = <SSH-PORT>
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400
action   = crowdsec-sync[name=sshd]

[nginx-cve]
enabled  = true
filter   = nginx-cve
logpath  = /var/log/nginx/access.log
maxretry = 1
bantime  = 86400
action   = crowdsec-sync[name=nginx-cve]

[nginx-botsearch]
enabled  = true
filter   = nginx-http-auth
logpath  = /var/log/nginx/access.log
maxretry = 2
bantime  = 86400
action   = crowdsec-sync[name=nginx-botsearch]
```

<h3 align="center">Action crowdsec-sync</h3>

```bash
# /etc/fail2ban/action.d/crowdsec-sync.conf
actionban   = cscli decisions add --ip <ip> --reason "fail2ban-%(name)s" --duration 24h
actionunban = cscli decisions delete --ip <ip>
```

---

<h2 align="center">Unban atomique</h2>

Pour débannir une IP proprement (CrowdSec + Fail2ban) :

```bash
# 1. Supprimer la décision CrowdSec
cscli decisions delete --ip <IP>

# 2. Débannir dans chaque jail Fail2ban
fail2ban-client unbanip sshd <IP>
fail2ban-client unbanip nginx-cve <IP>
fail2ban-client unbanip nginx-botsearch <IP>
```

---

<h2 align="center">Corrélations cross-hôtes (rsyslog)</h2>

`monitoring_gen.py` lit les logs de tous les hôtes et détecte :

| Pattern | Détection | Action |
|---------|-----------|--------|
| Même IP dans logs nginx + fail2ban site-01 + site-02 | `cross_host_correlation` | Badge ⊙XHC kill chain |
| Connexions SSH suspectes depuis IP bannies | Corrélation CrowdSec + sshd | Score +15 |
| Trafic sortant inhabituel (C2 potentiel) | rsyslog routeur <ROUTER> | Score +15 · JARVIS alerte |
| Scans multi-cibles (>5 hôtes touchés) | rsyslog correlation | Score +5 · JARVIS alerte |

---

<h2 align="center">Kill Chain MITRE ATT&CK</h2>

Classification automatique des IPs par phase d'attaque (fenêtre 15 min) :

| Phase | MITRE | Critères | Couleur |
|-------|-------|----------|---------|
| RECON | T1595 | Pas de pattern défini — surveillance | Violet |
| SCAN | T1046 | Requêtes anormales, 404/403 excessifs, botsearch | Orange |
| EXPLOIT | T1190 | CVE détectée, AppSec bloqué, Suricata alerte | Jaune |
| BRUTE | T1110 | Tentatives SSH, auth failures répétées | Rouge |
| NEUTRALISÉ | DEF | IP bannie CrowdSec active | Vert |

---

<h2 align="center">Nomenclature des bans JARVIS</h2>

| Raison ban | Déclencheur |
|------------|------------|
| `jarvis-autoban-exploit-cve` | CVE détectée non bannie |
| `jarvis-autoban-exploit-h` | Honeypot EXPLOIT touché |
| `jarvis-autoban-scan-h` | Honeypot SCAN touché |
| `jarvis-autoban-brute-h` | Honeypot BRUTE touché |
| `jarvis-suricata-sev1` | Alerte Suricata sév.1 < 1h |
| `jarvis-suricata-scan` | Scan réseau détecté Suricata |
| `jarvis-rsyslog-c2` | Trafic C2 sortant détecté |
| `jarvis-rsyslog-recon` | Recon multi-cibles rsyslog |

---
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
