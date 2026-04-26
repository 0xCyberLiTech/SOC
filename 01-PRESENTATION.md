<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EPRESENTATION_" alt="SOC 0xCyberLiTech" />
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

<h2 align="center">Qu'est-ce que ce projet ?</h2>

**0xCyberLiTech SOC** est un système de supervision sécurité (Security Operations Center) homelab entièrement conçu et maintenu de zéro. Il surveille en temps réel deux sites web hébergés sur des VMs Proxmox et réagit automatiquement aux menaces sans intervention humaine.

Le projet démontre qu'il est possible de construire un SOC professionnel avec des outils open source, sans cloud, sans abonnement, sans dépendance externe — sur du matériel domestique.

---

<h2 align="center">Objectifs</h2>

| Objectif | Description |
|----------|-------------|
| **Visibilité** | Voir en temps réel ce qui se passe sur l'infrastructure |
| **Protection** | Bloquer automatiquement les attaques (scans, CVE, brute force) |
| **Résilience** | Maintenir les services en ligne malgré les attaques |
| **Traçabilité** | Centraliser les logs de 5 hôtes, détecter les corrélations |
| **Autonomie** | Réagir sans intervention humaine via JARVIS IA |

---

<h2 align="center">Points forts</h2>

<h3 align="center">Défense en profondeur — 8 couches indépendantes</h3>
De l'UFW/nftables jusqu'à l'IA locale, chaque couche opère indépendamment. La compromission d'une couche ne désactive pas les autres.

<h3 align="center">Zéro dépendance externe</h3>
- Pas de cloud SOC (pas de Splunk, Datadog, ELK cloud)
- Pas de NPM dans le dashboard (vanilla JS pur)
- GeoIP en local (MaxMind MMDB)
- IA locale (Ollama, pas d'API OpenAI)

<h3 align="center">Score menace temps réel — 24 briques</h3>
Un algorithme original calcule un score 0-100 toutes les 60 secondes en agrégeant 24 sources de données. Anti-doublons explicites évitent la surpondération.

<h3 align="center">Kill Chain MITRE ATT&CK</h3>
Les IPs actives sont classées automatiquement en phases : RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ.

<h3 align="center">JARVIS — réponse autonome</h3>
Une boucle IA tourne en permanence (60s), analyse les données SOC et :
- Bannit les IPs critiques via CrowdSec
- Redémarre les services tombés
- Alerte vocalement en cas de niveau CRITIQUE
- Analyse les gaps défensifs avec un LLM local (phi4-reasoning)

<h3 align="center">Audit qualité 10/10</h3>
85 passes d'audit manuel couvrant : XSS, NDT (Non-Déterminisme Technique), hardcodes, dette CSS, robustesse. Score parfait maintenu.

---

<h2 align="center">Comparaison avec les solutions commerciales</h2>

| Critère | 0xCyberLiTech SOC | Wazuh | Graylog | pfSense |
|---------|-------------------|-------|---------|---------|
| Coût | **0 €** | Freemium | Freemium | Gratuit |
| Cloud requis | **Non** | Optionnel | Optionnel | Non |
| IA autonome | **Oui (local)** | Non | Non | Non |
| Kill Chain | **Oui (MITRE)** | Partiel | Non | Non |
| Score menace | **Oui (24 briques)** | Partiel | Non | Non |
| Dashboard custom | **Oui (SPA)** | Limité | Oui | Limité |
| WAF intégré | **Oui (AppSec)** | Non | Non | Oui |

---

<h2 align="center">Ce que ce projet n'est PAS</h2>

- Un produit commercial
- Un IPS inline (pas de coupure réseau active — risque réseau refusé intentionnellement)
- Dépendant d'un fournisseur (pas de lock-in)
- Conçu pour un datacenter (homelab, échelle 2-5 serveurs)

---

<h2 align="center">Technologies utilisées</h2>

<h3 align="center">Couche réseau / système</h3>
- **Debian 13 (Trixie)** — OS des VMs
- **Proxmox VE** — Hyperviseur
- **UFW + nftables** — Firewall
- **AppArmor** — Confinement processus (9 profils enforce)

<h3 align="center">Couche détection / blocage</h3>
- **CrowdSec** — LAPI collaborative + 8 collections + AppSec WAF (207 vpatch)
- **Fail2ban** — Détecteur logs → alimente CrowdSec (3 jails)
- **Suricata** — IDS réseau (106 789 règles ET Pro + Emerging Threats)

<h3 align="center">Couche collecte / corrélation</h3>
- **rsyslog** — Récepteur central TCP+UDP :514 (5 hôtes)
- **nginx** — Reverse proxy + logs avec GeoIP country + format enrichi
- **GeoIP2 MaxMind** — Géolocalisation IP temps réel

<h3 align="center">Couche visualisation</h3>
- **Dashboard SPA vanilla JS** — 24 modules, 0 dépendance NPM
- **Python 3.11** — monitoring_gen.py (générateur JSON), soc.py (API JARVIS)
- **monitoring.json** — Agrégation toutes sources, polling 60s

<h3 align="center">Couche IA / réponse</h3>
- **JARVIS** — Flask + Ollama (phi4-reasoning) — boucle autonome
- **edge-tts / Piper** — Synthèse vocale alertes
- **faster-whisper** — Reconnaissance vocale commandes

---
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

  <a href="README.md">
    <img src="https://img.shields.io/badge/↑%20Retour%20au%20README-SOC-00B4D8?style=flat-square&logo=github" alt="Retour README" />
  </a>

</div>
