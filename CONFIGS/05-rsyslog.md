<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ERSYSLOG+CONF_" alt="SOC 0xCyberLiTech" />
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

<h2 align="center">Architecture — récepteur central</h2>

`srv-ngix` collecte les logs de **5 hôtes** du homelab via TCP/UDP port 514.

```
site-01 (<CLT-IP>)       ──→ rsyslog TCP :514
site-02 (<PA85-IP>)      ──→ rsyslog TCP :514
pve     (<PROXMOX-IP>)   ──→ rsyslog TCP :514
<ROUTER> (<ROUTER-IP>)   ──→ rsyslog UDP :514
srv-ngix (local)         ──→ fichiers locaux uniquement

                              /var/log/central/
                              ├── site-01/
                              │     └── <PROGRAMME>.log
                              ├── site-02/
                              ├── pve/
                              ├── <ROUTER>/
                              └── srv-ngix/
```

---

<h2 align="center">Récepteur — /etc/rsyslog.d/10-central-receiver.conf</h2>

`/etc/rsyslog.d/10-central-receiver.conf`

```conf
# Récepteur central rsyslog — TCP + UDP port 514

module(load="imtcp")
module(load="imudp")
input(type="imtcp" port="514")
input(type="imudp" port="514")

# Template : un fichier par hôte + programme
$template RemoteLogs,"/var/log/central/%HOSTNAME%/%PROGRAMNAME%.log"

# Filtres bruit — éviter les logs système verbeux
if $programname contains '(sd-pam)' then stop
if $programname startswith 'systemd' then stop
if $programname == 'CRON' then stop

# Tout ce qui vient d'un hôte distant → fichier séparé
if $fromhost-ip != '127.0.0.1' then {
  action(type="omfile" dynaFile="RemoteLogs" FileCreateMode="0640")
  stop
}
```

```bash
# Appliquer
mkdir -p /var/log/central
systemctl restart rsyslog
```

---

<h2 align="center">Émetteur — /etc/rsyslog.conf (site-01 / site-02 / pve)</h2>

`/etc/rsyslog.conf` — section à ajouter sur chaque hôte émetteur

```conf
# Envoyer tous les logs vers srv-ngix
# @@ = TCP (fiable · avec retransmission)
# @  = UDP (léger · pour routeur/équipement sans client TCP)

*.* @@<SRV-NGIX-IP>:514    # TCP — Linux (site-01, site-02, pve)
# *.* @<SRV-NGIX-IP>:514   # UDP — routeur/équipement réseau
```

---

<h2 align="center">Sources de logs par hôte</h2>

| Hôte | Logs envoyés |
|------|-------------|
| **site-01** | auth.log · apache2/access.log · apache2/error.log · fail2ban.log · syslog |
| **site-02** | auth.log · apache2/access.log · apache2/error.log · fail2ban.log · syslog |
| **pve** | syslog · auth.log · pve-firewall.log · task.log (backups VM) |
| **`<ROUTER>`** | syslog routeur (connexions WAN, DHCP, firewall, trafic sortant) |
| **srv-ngix** | auth.log · nginx/access.log · nginx/error.log · fail2ban.log · crowdsec.log |

---

<h2 align="center">Rétention — /etc/logrotate.d/rsyslog-central</h2>

`/etc/logrotate.d/rsyslog-central`

```conf
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

<h2 align="center">UFW — Règles entrantes rsyslog</h2>

```bash
# Sur srv-ngix — autoriser la réception depuis le LAN
ufw allow from <LAN-SUBNET> to any port 514 proto tcp comment 'rsyslog-central-tcp'
ufw allow from <LAN-SUBNET> to any port 514 proto udp comment 'rsyslog-central-udp'
ufw allow from <ROUTER-SUBNET> to any port 514 proto udp comment 'rsyslog-router-udp'
```

---

<h2 align="center">Corrélations exploitées par monitoring_gen.py</h2>

`monitoring_gen.py` analyse les logs centralisés pour détecter :

| Détection | Condition | Impact ThreatScore |
|-----------|-----------|-------------------|
| **XHC** Cross-Host Correlation | Même IP vue sur nginx + site-01 + site-02 (15 min) | +10 |
| **SSH bannié connecté** | IP dans decisions CrowdSec tente SSH sur auth.log | +8 |
| **C2 sortant** | `<ROUTER>` logue connexion vers port IRC/Tor/C2 connu | +15 |
| **Scan multi-cibles** | Même IP source touche >5 hôtes distincts (15 min) | +5 |

---

<h2 align="center">Commandes de référence</h2>

```bash
# Vérifier la réception des logs
ls -la /var/log/central/
ls -la /var/log/central/site-01/

# Logs en temps réel d'un hôte
tail -f /var/log/central/site-01/$(date +%Y-%m-%d).log

# Vérifier le port rsyslog ouvert
ss -tlnup | grep 514

# Tester l'envoi depuis site-01
logger -n <SRV-NGIX-IP> -P 514 -T "TEST rsyslog site-01"
grep 'TEST rsyslog' /var/log/central/site-01/*.log

# Statut rsyslog
systemctl status rsyslog
journalctl -u rsyslog --since "1h ago"
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
