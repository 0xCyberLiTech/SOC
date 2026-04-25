<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=%3EKILL+CHAIN_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>⛓️ Flux attaque → ban &nbsp;·&nbsp; Kill Chain MITRE &nbsp;·&nbsp; Corrélation XDR cross-source</h3>

<br/>

<p>
  <a href="https://0xcyberlitech.com">
    <img src="https://img.shields.io/badge/🌐%20Site-0xcyberlitech.com-00B4D8?style=flat-square" alt="Site" />
  </a>
  &nbsp;
  <a href="https://github.com/0xCyberLiTech/SOC">
    <img src="https://img.shields.io/badge/GitHub-SOC-00B4D8?style=flat-square&logo=github&logoColor=white" alt="SOC" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Kill Chain-5+stades-EF4444?style=flat-square" alt="Kill Chain" />
  &nbsp;  <img src="https://img.shields.io/badge/Réponse-automatique-00FF88?style=flat-square" alt="Réponse" />
  &nbsp;  <img src="https://img.shields.io/badge/XDR-corrélation-00B4D8?style=flat-square" alt="XDR" />
  &nbsp;
</p>

<br/>

<p>
  <a href="04-DASHBOARD-SOC.md"><img src="https://img.shields.io/badge/◄-04+Dashboard-555555?style=flat-square" alt="← 04 Dashboard" /></a>
  &nbsp;&nbsp;
  <a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>
  &nbsp;&nbsp;
  <a href="06-THREATSCORE.md"><img src="https://img.shields.io/badge/06+ThreatScore-►-555555?style=flat-square" alt="06 ThreatScore →" /></a>
</p>

</div>

---

## Vue d'ensemble

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

## CrowdSec — Source unique de vérité des bans

Depuis la refactorisation du 2026-04-12, **CrowdSec est l'unique autorité de ban**.

| Avant (legacy) | Après (actuel) |
|----------------|----------------|
| Fail2ban gérait ses propres chaînes nftables | Fail2ban → crowdsec-sync uniquement |
| CrowdSec gérait ses sets nftables | CrowdSec LAPI gère tout |
| Double bans possibles | Source unique, pas de doublons |

---

## Fail2ban — Rôle détecteur uniquement

### Jails configurées

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

### Action crowdsec-sync
```bash
# /etc/fail2ban/action.d/crowdsec-sync.conf
actionban   = cscli decisions add --ip <ip> --reason "fail2ban-%(name)s" --duration 24h
actionunban = cscli decisions delete --ip <ip>
```

---

## Unban atomique

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

## Corrélations cross-hôtes (rsyslog)

`monitoring_gen.py` lit les logs de tous les hôtes et détecte :

| Pattern | Détection | Action |
|---------|-----------|--------|
| Même IP dans logs nginx + fail2ban site-01 + site-02 | `cross_host_correlation` | Badge ⊙XHC kill chain |
| Connexions SSH suspectes depuis IP bannies | Corrélation CrowdSec + sshd | Score +15 |
| Trafic sortant inhabituel (C2 potentiel) | rsyslog routeur <ROUTER> | Score +15 · JARVIS alerte |
| Scans multi-cibles (>5 hôtes touchés) | rsyslog correlation | Score +5 · JARVIS alerte |

---

## Kill Chain MITRE ATT&CK

Classification automatique des IPs par phase d'attaque (fenêtre 15 min) :

| Phase | MITRE | Critères | Couleur |
|-------|-------|----------|---------|
| RECON | T1595 | Pas de pattern défini — surveillance | Violet |
| SCAN | T1046 | Requêtes anormales, 404/403 excessifs, botsearch | Orange |
| EXPLOIT | T1190 | CVE détectée, AppSec bloqué, Suricata alerte | Jaune |
| BRUTE | T1110 | Tentatives SSH, auth failures répétées | Rouge |
| NEUTRALISÉ | DEF | IP bannie CrowdSec active | Vert |

---

## Nomenclature des bans JARVIS

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

*Document : 05-CHAINE-DEFENSE.md · Projet SOC 0xCyberLiTech · 2026-04-25*
---

<div align="center">

<br/>

<table>
<tr>
<td align="center" width="33%"><b>🖥️ Infrastructure &amp; Sécurité</b></td>
<td align="center" width="33%"><b>💻 Développement &amp; Web</b></td>
<td align="center" width="33%"><b>🤖 Intelligence Artificielle</b></td>
</tr>
<tr>
<td align="center">
  <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="40" title="Debian" /></a>&nbsp;
  <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="40" title="Nginx" /></a>&nbsp;
  <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="40" title="Bash" /></a>&nbsp;
  <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="40" title="Git" /></a>
</td>
<td align="center">
  <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="40" title="Python" /></a>&nbsp;
  <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="40" title="Flask" /></a>&nbsp;
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="40" title="JavaScript" /></a>&nbsp;
  <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="40" title="VS Code" /></a>
</td>
<td align="center">
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  <br/><br/>
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projet <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> &nbsp;·&nbsp; Co-développé avec <a href="https://claude.ai">Claude AI</a> · Anthropic 🔒</sub>

</div>

<div align="center">

<p>
  <a href="04-DASHBOARD-SOC.md"><img src="https://img.shields.io/badge/◄-04+Dashboard-555555?style=flat-square" alt="← 04 Dashboard" /></a>&nbsp;&nbsp;<a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>&nbsp;&nbsp;<a href="06-THREATSCORE.md"><img src="https://img.shields.io/badge/06+ThreatScore-►-555555?style=flat-square" alt="06 ThreatScore →" /></a>
</p>

</div>
