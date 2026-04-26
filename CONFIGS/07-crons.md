<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ECRONS+SOC_" alt="SOC 0xCyberLiTech" />
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
    <a href="../README.md">
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

<h2 align="center">Vue d'ensemble des tâches planifiées</h2>

Le SOC repose sur **9 crons** qui assurent la collecte, la détection, les alertes et la maintenance.

| Fréquence | Tâche | Fichier cron |
|-----------|-------|-------------|
| Toutes les minutes | Statistiques protocoles temps réel | `/etc/cron.d/soc-monitoring` |
| Toutes les 5 min | Génération `monitoring.json` | `/etc/cron.d/soc-monitoring` |
| 03h00 quotidien | Vérification intégrité AIDE | `/etc/cron.d/soc-monitoring` |
| 03h15 quotidien | Mise à jour règles Suricata | `/etc/cron.d/soc-monitoring` |
| 03h30 quotidien | Mise à jour règles CrowdSec | `/etc/cron.d/soc-monitoring` |
| 08h00 quotidien | Rapport SOC par mail | `/etc/cron.d/soc-monitoring` |
| Dimanche 01h00 | Mise à jour bases GeoIP2 | `/etc/cron.d/geoipupdate` |
| 2× par jour | Renouvellement certificat TLS | `/etc/cron.d/certbot` |
| Dimanche 02h00 | Archive configuration complète | à planifier |

---

<h2 align="center">/etc/cron.d/soc-monitoring</h2>

`/etc/cron.d/soc-monitoring`

```cron
# SOC 0xCyberLiTech — tâches planifiées principales
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Stats protocoles temps réel (chaque minute → tuile TRAFIC RÉSEAU)
* * * * *   root  python3 /opt/soc/proto-live.py >> /var/log/proto-live.log 2>&1

# Génération monitoring.json (toutes les 5 min → dashboard SOC)
*/5 * * * * root  /opt/soc/monitoring.sh >> /var/log/monitoring-gen.log 2>&1

# Vérification intégrité AIDE (03h00 — re-baseline requis après modif système)
0 3 * * *   root  /usr/bin/aide --config /etc/aide/aide.conf --check >> /var/log/aide/aide.log 2>&1

# Mise à jour règles Suricata + rechargement à chaud (03h15)
15 3 * * *  root  suricata-update >> /var/log/suricata-update.log 2>&1 && systemctl reload suricata

# Mise à jour règles CrowdSec (03h30)
30 3 * * *  root  cscli hub update && cscli hub upgrade >> /var/log/crowdsec-update.log 2>&1

# Rapport SOC quotidien par mail (08h00)
0 8 * * *   root  python3 /opt/soc/soc-daily-report.py >> /var/log/soc-report.log 2>&1
```

---

<h2 align="center">/etc/cron.d/geoipupdate</h2>

`/etc/cron.d/geoipupdate`

```cron
# Mise à jour bases GeoIP2 MaxMind (dimanche 01h00)
# Nécessite un compte MaxMind (gratuit) et /etc/GeoIP.conf configuré
0 1 * * 0   root  geoipupdate >> /var/log/geoipupdate.log 2>&1
```

---

<h2 align="center">Certbot — renouvellement TLS</h2>

Certbot installe son propre timer systemd ou cron lors de l'installation :

```bash
# Vérifier le timer certbot
systemctl status certbot.timer

# Tester le renouvellement (dry-run)
certbot renew --dry-run

# Si le timer est absent — cron manuel
# /etc/cron.d/certbot
0 */12 * * * root certbot -q renew --deploy-hook "systemctl reload nginx"
```

---

<h2 align="center">Archive configuration — à planifier</h2>

Le script `create-archive.sh` produit une archive complète du SOC (configs, scripts, clés publiques). À planifier en cron hebdomadaire :

```bash
# À ajouter dans /etc/cron.d/soc-monitoring sur srv-ngix
# Archive automatique dimanche 02h00
0 2 * * 0   root  /opt/soc/scripts/create-archive.sh --auto >> /var/log/soc-archive.log 2>&1
```

---

<h2 align="center">Logrotate — logs SOC</h2>

`/etc/logrotate.d/soc-monitoring`

```conf
/var/log/monitoring-gen.log
/var/log/proto-live.log
/var/log/soc-report.log
/var/log/suricata-update.log
/var/log/crowdsec-update.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}

/var/log/central/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    maxsize 20M
    postrotate
        pkill -HUP rsyslogd 2>/dev/null || true
    endscript
}
```

---

<h2 align="center">Commandes de référence</h2>

```bash
# Lister les crons actifs
crontab -l
ls -la /etc/cron.d/
cat /etc/cron.d/soc-monitoring

# Surveiller l'exécution en temps réel
tail -f /var/log/monitoring-gen.log
tail -f /var/log/suricata-update.log
tail -f /var/log/soc-report.log

# Historique d'exécution cron
grep CRON /var/log/syslog | tail -30
journalctl -u cron --since "24h ago"

# Forcer une régénération immédiate du monitoring.json
/opt/soc/monitoring.sh

# Forcer une mise à jour Suricata manuelle
suricata-update && systemctl reload suricata
grep "rules loaded" /var/log/suricata/suricata.log | tail -3

# Vérifier le dernier rapport SOC envoyé
tail -20 /var/log/soc-report.log
```

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
