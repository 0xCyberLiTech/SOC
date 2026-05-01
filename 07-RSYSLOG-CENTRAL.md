<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ERSYSLOG_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Logs centralisés — 5 hôtes rsyslog · corrélation cross-host · rétention.</h2>

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

<div align="center">
## À propos & Objectifs.
</div>

Ce document décrit l'architecture de centralisation des logs rsyslog : srv-ngix comme récepteur central, 5 hôtes émetteurs, templates par hôte et corrélation cross-host pour le XDR.

- 📡 5 hôtes centralisés — site-01, site-02, pve, routeur, srv-ngix local
- 🔌 Transport TCP/UDP port 514 — récepteur configuré sur srv-ngix
- 📂 Templates par hôte — séparation des fichiers de logs entrants
- 🔄 Logrotate 7 règles — rétention nginx, fail2ban, monitoring, aide, ufw
- 🔍 Corrélation XDR — analyse cross-host depuis un point unique

---

<h2 align="center">Architecture</h2>

`srv-ngix` est le **récepteur rsyslog central** pour 5 hôtes du homelab.

```
site-01 (<CLT-IP>)   ──→ rsyslog TCP/UDP :514
site-02 (<PA85-IP>)  ──→ rsyslog TCP/UDP :514
pve (<PROXMOX-IP>)   ──→ rsyslog TCP/UDP :514
<ROUTER> (<ROUTER-IP>)──→ rsyslog UDP :514
srv-ngix (local)     ──→ rsyslog fichiers locaux
                           │
                     /var/log/central/
                     ├── site-01/
                     ├── site-02/
                     ├── pve/
                     ├── <ROUTER>/
                     └── srv-ngix/
```

---

<h2 align="center">Configuration rsyslog récepteur (srv-ngix)</h2>

```
# /etc/rsyslog.conf — section réception

module(load="imtcp")
module(load="imudp")

input(type="imtcp" port="514")
input(type="imudp" port="514")

# Routage par hôte source vers dossier dédié
if ($fromhost-ip == '<CLT-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/site-01/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
if ($fromhost-ip == '<PA85-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/site-02/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
if ($fromhost-ip == '<PROXMOX-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/pve/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
if ($fromhost-ip == '<ROUTER-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/router/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
```

---

<h2 align="center">Configuration rsyslog émetteur (site-01 / site-02)</h2>

```
# /etc/rsyslog.conf — section émission (site-01 et site-02)

# Envoyer tous les logs vers srv-ngix
*.* @@<SRV-NGIX-IP>:514    # @@ = TCP (fiable)
```

---

<h2 align="center">Rétention des logs</h2>

- **Rotation** : `logrotate` — 7 jours pour les logs `/var/log/central/`
- **Format fichier** : `AAAA-MM-JJ.log` (un fichier par jour par hôte)
- **Taille max** : non limitée (rotation temporelle uniquement)

```
# /etc/logrotate.d/rsyslog-central
/var/log/central/*/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    postrotate
        systemctl reload rsyslog
    endscript
}
```

---

<h2 align="center">Sources de logs par hôte</h2>

| Hôte | Logs envoyés |
|------|-------------|
| **site-01** | auth.log, apache2/access.log, apache2/error.log, fail2ban.log, syslog |
| **site-02** | auth.log, apache2/access.log, apache2/error.log, fail2ban.log, syslog |
| **pve** | syslog, auth.log, pve-firewall.log, task.log (backups VM) |
| **<ROUTER>** | syslog routeur (connexions WAN, DHCP, firewall, trafic sortant) |
| **srv-ngix** | auth.log, nginx/access.log, nginx/error.log, fail2ban.log, crowdsec.log |

---

<h2 align="center">Corrélations détectées par monitoring_gen.py</h2>

`monitoring_gen.py` lit tous les logs centralisés et détecte les patterns suivants :

<h3 align="center">Corrélation cross-hôte (XHC)</h3>

Une IP est vue dans les logs **nginx (srv-ngix)** ET **apache (site-01)** ET **apache (site-02)** dans une fenêtre de 15 minutes.

→ Badge `⊙XHC` dans le Kill Chain dashboard  
→ Score ThreatScore +10

<h3 align="center">Connexion SSH depuis IP bannie</h3>

Une IP présente dans les `active_decisions` CrowdSec tente une connexion SSH sur `auth.log`.

→ Score ThreatScore +8

<h3 align="center">Trafic C2 sortant (<ROUTER>)</h3>

Le routeur <ROUTER> logue une connexion sortante vers une IP connue (Threat Intel) ou un port C2 caractéristique (IRC 6667, Tor, .onion via DNS).

→ ThreatScore +15  
→ JARVIS alerte TTS + ban automatique IP destination

<h3 align="center">Scan multi-cibles</h3>

La même IP source touche **plus de 5 hôtes distincts** dans la fenêtre 15 min.

→ ThreatScore +5  
→ JARVIS alerte

---

<h2 align="center">Vérification du fonctionnement</h2>

```bash
# Sur srv-ngix — vérifier réception logs site-01
ls -la /var/log/central/site-01/
tail -20 /var/log/central/site-01/$(date +%Y-%m-%d).log

# Vérifier le port rsyslog ouvert
ss -tlnup | grep 514

# Tester envoi depuis site-01
ssh -i ~/.ssh/id_site-01 -p <SSH-PORT> root@<CLT-IP> \
  "logger -n <SRV-NGIX-IP> -P 514 -T 'TEST rsyslog site-01→ngix'"

# Vérifier réception immédiate
grep 'TEST rsyslog' /var/log/central/site-01/$(date +%Y-%m-%d).log
```

---

<h2 align="center">UFW — Règle autorisant rsyslog entrant</h2>

```bash
# Sur srv-ngix — déjà configuré
ufw allow from <LAN-SUBNET> to any port 514 proto tcp
ufw allow from <LAN-SUBNET> to any port 514 proto udp
ufw allow from <ROUTER-SUBNET> to any port 514 proto udp  # <ROUTER>
```

---

<h2 align="center">Configuration de référence</h2>

Configuration complète rsyslog récepteur + émetteurs + logrotate + corrélations :
→ [CONFIGS/05-rsyslog.md](CONFIGS/05-rsyslog.md)

---

<div align="center">

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
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  <br/><br/>
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projets proposés par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Développés en collaboration avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>
