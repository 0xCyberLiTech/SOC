<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ESOC+HOMELAB_" alt="SOC 0xCyberLiTech" />
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

<h2 align="center">Cartographie des menaces — Live</h2>

<div align="center">

![GeoIP World](assets/geoip-world.jpg)

*GeoIP — Cartographie mondiale des menaces 24h · arcs d'attaque animés · top pays · 169 IPs actives · 25 pays sources*

</div>

---

<h2 align="center">Kill Chain — Progression des attaques</h2>

<div align="center">

![Kill Chain](assets/kill-chain.png)

*Tracking en temps réel : RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ · fenêtre 15 min · score menace par IP*

</div>

---

<h2 align="center">Vue tactique Europe & Investigation IP</h2>

<div align="center">

| SOC Map — Vue Europe | Investigation IP |
|:--------------------:|:----------------:|
| ![SOC Map Europe](assets/socmap-europe.png) | ![IP Investigation](assets/ip-investigation.png) |
| *Score ÉLEVÉ 53 · 169 hostiles · 78% neutralisation · arcs kill chain* | *Modal forensique : Kill Chain · CrowdSec · Fail2ban · WHOIS · verdict* |

</div>

---

<h2 align="center">GeoIP — Statistiques & Corrélations</h2>

<div align="center">

![GeoIP Stats](assets/geoip-stats.png)

*Kill Chain 15 min · Top pays attaquants · Scénarios CrowdSec · Heatmap activité · Top 60 IPs 24h*

</div>

---

<h2 align="center">Moteur de corrélation & Chaîne de défense</h2>

<div align="center">

| XDR — Corrélation cross-source | Chaîne de défense — Pipeline sécurité |
|:------------------------------:|:-------------------------------------:|
| ![XDR Engine](assets/xdr-engine.png) | ![Defense Chain](assets/defense-chain.png) |
| *COLLECT · NORMALIZE · CORRELATE · RESPOND · Score 200* | *UFW → GeoIP → WAF → CrowdSec → Suricata → Fail2ban → nginx · 8 couches* |

</div>

---

<h2 align="center">Heatmap & Monitoring système</h2>

<div align="center">

| Heatmap Attaques 24h | Windows / GPU Metrics |
|:--------------------:|:---------------------:|
| ![Heatmap](assets/heatmap.png) | ![Windows Metrics](assets/windows-metrics.png) |
| *13.2k req · 358 bloqués · 2.7% · pics horaires détectés* | *CPU · RAM · GPU RTX · disques — supervision machine hôte* |

</div>

---

<h2 align="center">JARVIS — IA défensive intégrée</h2>

<div align="center">

![JARVIS AI](assets/jarvis-ai.png)

*JARVIS (Ollama phi4-reasoning) · réponse proactive automatique · alertes TTS · analyse LLM événements critiques · ban auto*

</div>

---

<h2 align="center">Points forts</h2>

| | Capacité | Détail |
|--|----------|--------|
| 🛡️ | **8 couches défense** | UFW · nftables · GeoIP Block · CrowdSec WAF · Suricata IDS · Fail2ban · AppArmor · AID HIDS |
| 🧠 | **IA défensive** | JARVIS (Ollama phi4-reasoning) — ban auto · alertes TTS · analyse LLM |
| 📡 | **Logs centralisés** | 5 hôtes via rsyslog — corrélation cross-host temps réel |
| 🎯 | **Kill Chain** | Tracking RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ par IP |
| 📊 | **Score menace** | 24 briques · calcul temps réel · seuils FAIBLE / MOYEN / ÉLEVÉ / CRITIQUE |
| 🔍 | **XDR** | Corrélation Fail2ban + ModSec + UFW + Suricata + rsyslog + routeur |
| 🗺️ | **GeoIP** | Cartographie Leaflet + MaxMind · arcs d'attaque animés · top pays |
| 🔄 | **Plug-and-play** | Archive 13 blocs · restauration complète sur VM vierge en < 30 min |
| ✅ | **Audit 10/10** | Zéro dette technique · 85 passes · 120 NDT corrigés |

---

<h2 align="center">Stack technique</h2>

```
OS          Debian 13 (Bookworm)
Proxy       nginx 1.26 — reverse proxy · TLS · vhosts
Sécurité    CrowdSec (WAF AppSec ~207 vpatch CVE) · Suricata IDS (96k règles)
            Fail2ban · AppArmor · UFW + nftables · AID HIDS
Logs        rsyslog centralisé (5 hôtes) · GoAccess
Dashboard   SPA vanilla JS — 24 modules · 35 tuiles · zéro dépendance NPM
Backend     Python 3.11 — monitoring_gen.py (génération JSON live)
IA          JARVIS — Ollama phi4-reasoning · Flask · edge-tts
GeoIP       MaxMind GeoLite2 · Leaflet.js
Infra       Proxmox VE — 3 VMs (srv-ngix · site-01 · site-02)
```

---

<h2 align="center">Architecture</h2>

```
INTERNET
   │
   ▼
┌─────────────────────────────────────────────────────┐
│                    srv-ngix                          │
│                                                      │
│  UFW + nftables ──→ GeoIP Block ──→ CrowdSec WAF   │
│       ──→ Suricata IDS ──→ Fail2ban ──→ nginx       │
│       ──→ AppArmor · AID HIDS                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Dashboard SOC (port 8080)             │   │
│  │  24 modules JS · polling 60s · Kill Chain    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  rsyslog ◄── site-01 · site-02 · pve · <ROUTER>    │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   site-01                site-02
   Apache · AppArmor      Apache · AppArmor
   ModSecurity WAF        ModSecurity WAF
```

---

<h2 align="center">Documentation</h2>

| # | Document | Description |
|---|----------|-------------|
| 01 | [PRESENTATION.md](01-PRESENTATION.md) | Présentation, objectifs, points forts |
| 02 | [ARCHITECTURE.md](02-ARCHITECTURE.md) | Infrastructure, stack, schéma réseau |
| 03 | [SECURITE-BRIQUES.md](03-SECURITE-BRIQUES.md) | 8 couches défense · matrice couverture par vecteur |
| 04 | [DASHBOARD-SOC.md](04-DASHBOARD-SOC.md) | Dashboard : modules JS · tuiles · polling · CSS |
| 05 | [CHAINE-DEFENSE.md](05-CHAINE-DEFENSE.md) | Flux attaque → détection → ban · intégrations |
| 06 | [THREATSCORE.md](06-THREATSCORE.md) | Score menace : 24 briques · formule · anti-doublons |
| 07 | [RSYSLOG-CENTRAL.md](07-RSYSLOG-CENTRAL.md) | Logs centralisés : 5 hôtes · filtres · rétention |
| 08 | [JARVIS-DEFENSE.md](08-JARVIS-DEFENSE.md) | Défense proactive IA : boucle 60s · 12 déclencheurs |
| 09 | [ROADMAP.md](09-ROADMAP.md) | Axes d'évolution · décisions d'architecture |

---

<h2 align="center">Déploiement</h2>

| Script / Guide | Rôle |
|----------------|------|
| [GUIDE-DEPLOIEMENT-RAPIDE.md](DEPLOY/GUIDE-DEPLOIEMENT-RAPIDE.md) | **🚀 8 étapes plug-and-play** — VM vierge → SOC opérationnel |
| [RUNBOOK-DEBIAN13.md](DEPLOY/RUNBOOK-DEBIAN13.md) | Runbook complet installation sur Debian 13 |
| [create-archive.sh](DEPLOY/create-archive.sh) | Export config complète — 13 blocs |
| [restore-soc.sh](DEPLOY/restore-soc.sh) | Restauration — `--dry-run` · `--step` · rollback auto |
| [CHECKLIST-DEPLOY.md](DEPLOY/CHECKLIST-DEPLOY.md) | 61 points de vérification post-déploiement |
| [CHECKLIST-OPERATIONNELLE.md](DEPLOY/CHECKLIST-OPERATIONNELLE.md) | Checklist exploitation quotidienne |

```bash
# Restauration sur VM Debian 13 vierge
scp soc-config-*.tar.gz root@<SRV-NGIX-IP>:/tmp/
ssh root@<SRV-NGIX-IP> "tar -xzf /tmp/soc-config-*.tar.gz -C /tmp/soc-restore/"
bash /tmp/soc-restore/restore-soc.sh --dry-run   # simulation complète
bash /tmp/soc-restore/restore-soc.sh             # restauration
```

---

<div align="center">

  <br></br>

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

  <br></br>

  <sub>🔒 Projet <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> &nbsp;·&nbsp; Co-développé avec <a href="https://claude.ai">Claude AI</a> · Anthropic 🔒</sub>

  <br></br>

</div>
