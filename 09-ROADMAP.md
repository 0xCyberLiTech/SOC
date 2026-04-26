<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EROADMAP_" alt="SOC 0xCyberLiTech" />
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

<h2 align="center">État actuel (2026-04-25)</h2>

| Composant | Version | Statut |
|-----------|---------|--------|
| Dashboard SOC | v3.97.155 | ✅ Production |
| monitoring_gen.py | stable | ✅ Production |
| JARVIS | v3.2 | ✅ Production |
| deploy-soc.sh | v1.0 | ✅ Livré |
| Documentation PROJET-SOC | v1.0 | ✅ Complet |
| Archive config (create-archive.sh) | v1.0 | ✅ Livré |

---

<h2 align="center">Axes d'évolution court terme</h2>

<h3 align="center">1. Alertes enrichies par email</h3>

Actuellement : rapport quotidien `soc-daily-report.py` envoyé à 8h00.

Évolution : alertes email immédiates si ThreatScore ≥ 75, avec résumé de l'incident (IP, phase Kill Chain, signaux déclencheurs).

<h3 align="center">2. Rétention ThreatScore 30 jours</h3>

Actuellement : score calculé à l'instant T, pas de persistance longue durée.

Évolution : stocker l'historique dans un fichier JSON rotatif → graphe tendance 30j dans le dashboard.

<h3 align="center">3. Honeypot HTTP réel</h3>

Actuellement : simulation via les logs nginx (404/403 patterns).

Évolution : déployer un vrai honeypot HTTP (cowrie / opencanary) sur un port secondaire — détection plus précise des scanners.

<h3 align="center">4. Feed AbuseIPDB automatique</h3>

Actuellement : consultation manuelle AbuseIPDB depuis la tuile IP Deep.

Évolution : `monitoring_gen.py` consulte AbuseIPDB API pour les top 10 IPs actives → score de réputation intégré dans le ThreatScore.

<h3 align="center">5. Détection anomalies DNS (<ROUTER>)</h3>

Actuellement : logs <ROUTER> analysés pour C2 sortant.

Évolution : détecter les requêtes DNS vers domaines nouveaux/suspects (NXD excessif, DGA patterns).

---

<h2 align="center">Axes d'évolution moyen terme</h2>

<h3 align="center">6. Backup automatique configuration</h3>

Script `create-archive.sh` livré — à planifier en cron hebdomadaire.

```bash
# Cron srv-ngix — à ajouter
0 2 * * 0  /opt/site-01/scripts/create-archive.sh --auto
```

<h3 align="center">7. Dashboard mobile (responsive)</h3>

Actuellement : optimisé écran 1920×1080.

Évolution : media queries pour consultation sur tablette/téléphone (alertes nomades).

<h3 align="center">8. Intégration MISP (Threat Intelligence)</h3>

Partage d'indicateurs avec la communauté via un serveur MISP local.

<h3 align="center">9. Second nœud SOC (Pi5)</h3>

Déployer le SOC_SECOURS (déjà développé en v3.89.91) sur un Raspberry Pi 5 comme mirror cold-standby.

---

<h2 align="center">Ce qui ne sera PAS ajouté</h2>

| Fonctionnalité | Raison du refus |
|----------------|-----------------|
| Mode IPS inline (coupure réseau) | Risque réseau inacceptable en prod homelab |
| Cloud SOC (Splunk, Datadog) | Principe zéro dépendance externe |
| Base de données SQL (MySQL/PostgreSQL) | Complexité inutile — JSON files suffisent |
| Agent sur chaque VM | SSH polling suffit, overhead justifié |
| npm dans le dashboard | Principe vanilla JS conservé |

---

<h2 align="center">Idées en réflexion</h2>

- **Corrélation temporelle** : détecter les campagnes d'attaque distribuées dans le temps (même sous-réseau /24, délais aléatoires pour éviter F2B)
- **Score IP historique** : mémoriser les IPs vues précédemment → "IP déjà vue il y a 14 jours"
- **Rapport hebdomadaire PDF** : export du dashboard en rapport PDF via headless Chrome
- **Intégration Proxmox alerts** : recevoir les alertes backup/VM dans le SOC dashboard

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
