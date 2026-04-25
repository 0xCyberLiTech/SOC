<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=%3EROADMAP_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>🗺️ Axes d'évolution &nbsp;·&nbsp; Décisions d'architecture &nbsp;·&nbsp; Historique</h3>

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
  <img src="https://img.shields.io/badge/État-Production-brightgreen?style=flat-square" alt="État" />
  &nbsp;  <img src="https://img.shields.io/badge/Dette technique-Zéro-00FF88?style=flat-square" alt="Dette technique" />
  &nbsp;
</p>

<br/>

<p>
  <a href="08-JARVIS-DEFENSE.md"><img src="https://img.shields.io/badge/◄-08+JARVIS-555555?style=flat-square" alt="← 08 JARVIS" /></a>
  &nbsp;&nbsp;
  <a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>
  &nbsp;&nbsp;
  <a href="README.md"><img src="https://img.shields.io/badge/README-►-555555?style=flat-square" alt="README →" /></a>
</p>

</div>

---

## État actuel (2026-04-25)

| Composant | Version | Statut |
|-----------|---------|--------|
| Dashboard SOC | v3.97.155 | ✅ Production |
| monitoring_gen.py | stable | ✅ Production |
| JARVIS | v3.2 | ✅ Production |
| deploy-soc.sh | v1.0 | ✅ Livré |
| Documentation PROJET-SOC | v1.0 | ✅ Complet |
| Archive config (create-archive.sh) | v1.0 | ✅ Livré |

---

## Axes d'évolution court terme

### 1. Alertes enrichies par email

Actuellement : rapport quotidien `soc-daily-report.py` envoyé à 8h00.

Évolution : alertes email immédiates si ThreatScore ≥ 75, avec résumé de l'incident (IP, phase Kill Chain, signaux déclencheurs).

### 2. Rétention ThreatScore 30 jours

Actuellement : score calculé à l'instant T, pas de persistance longue durée.

Évolution : stocker l'historique dans un fichier JSON rotatif → graphe tendance 30j dans le dashboard.

### 3. Honeypot HTTP réel

Actuellement : simulation via les logs nginx (404/403 patterns).

Évolution : déployer un vrai honeypot HTTP (cowrie / opencanary) sur un port secondaire — détection plus précise des scanners.

### 4. Feed AbuseIPDB automatique

Actuellement : consultation manuelle AbuseIPDB depuis la tuile IP Deep.

Évolution : `monitoring_gen.py` consulte AbuseIPDB API pour les top 10 IPs actives → score de réputation intégré dans le ThreatScore.

### 5. Détection anomalies DNS (<ROUTER>)

Actuellement : logs <ROUTER> analysés pour C2 sortant.

Évolution : détecter les requêtes DNS vers domaines nouveaux/suspects (NXD excessif, DGA patterns).

---

## Axes d'évolution moyen terme

### 6. Backup automatique configuration

Script `create-archive.sh` livré — à planifier en cron hebdomadaire.

```bash
# Cron srv-ngix — à ajouter
0 2 * * 0  /opt/site-01/scripts/create-archive.sh --auto
```

### 7. Dashboard mobile (responsive)

Actuellement : optimisé écran 1920×1080.

Évolution : media queries pour consultation sur tablette/téléphone (alertes nomades).

### 8. Intégration MISP (Threat Intelligence)

Partage d'indicateurs avec la communauté via un serveur MISP local.

### 9. Second nœud SOC (Pi5)

Déployer le SOC_SECOURS (déjà développé en v3.89.91) sur un Raspberry Pi 5 comme mirror cold-standby.

---

## Ce qui ne sera PAS ajouté

| Fonctionnalité | Raison du refus |
|----------------|-----------------|
| Mode IPS inline (coupure réseau) | Risque réseau inacceptable en prod homelab |
| Cloud SOC (Splunk, Datadog) | Principe zéro dépendance externe |
| Base de données SQL (MySQL/PostgreSQL) | Complexité inutile — JSON files suffisent |
| Agent sur chaque VM | SSH polling suffit, overhead justifié |
| npm dans le dashboard | Principe vanilla JS conservé |

---

## Idées en réflexion

- **Corrélation temporelle** : détecter les campagnes d'attaque distribuées dans le temps (même sous-réseau /24, délais aléatoires pour éviter F2B)
- **Score IP historique** : mémoriser les IPs vues précédemment → "IP déjà vue il y a 14 jours"
- **Rapport hebdomadaire PDF** : export du dashboard en rapport PDF via headless Chrome
- **Intégration Proxmox alerts** : recevoir les alertes backup/VM dans le SOC dashboard

---

*Document : 09-ROADMAP.md · Projet SOC 0xCyberLiTech · 2026-04-25*
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
  <a href="08-JARVIS-DEFENSE.md"><img src="https://img.shields.io/badge/◄-08+JARVIS-555555?style=flat-square" alt="← 08 JARVIS" /></a>&nbsp;&nbsp;<a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>&nbsp;&nbsp;<a href="README.md"><img src="https://img.shields.io/badge/README-►-555555?style=flat-square" alt="README →" /></a>
</p>

</div>
