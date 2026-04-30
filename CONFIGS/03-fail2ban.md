<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EFAIL2BAN+CONF_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Configuration Fail2ban — jails · filtres nginx · synchronisation CrowdSec.</h2>

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

<div align="center">
## À propos & Objectifs.
</div>

Ce document détaille la configuration fail2ban : jail.local avec 3 jails actives, action de synchronisation bidirectionnelle avec CrowdSec, filtres nginx-cve et nginx-botsearch.

- 🔒 3 jails actives — sshd, nginx-cve, nginx-botsearch
- ⏱️ Paramètres — bantime 24h, findtime 10min, maxretry par jail
- 🔗 Sync CrowdSec — action crowdsec-sync : ban F2B → décision CS
- 📝 Filtres custom — regex nginx-cve (CVE paths), nginx-botsearch (UA malveillants)

---

<h2 align="center">Rôle dans la chaîne défensive</h2>

Fail2ban analyse les logs en temps réel et alimente **CrowdSec** via l'action `crowdsec-sync` — chaque ban Fail2ban devient automatiquement une décision CrowdSec (blocage nftables).

```
nginx access.log / auth.log
        │
        ▼
   Fail2ban (analyse regex)
        │
        ├──→ ban local iptables/nftables
        └──→ crowdsec-sync → cscli decisions add → nftables set
```

---

<h2 align="center">jail.local — 3 jails actifs</h2>

`/etc/fail2ban/jail.local`

```ini
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = auto

# Action par défaut : ban local + sync CrowdSec
action = %(action_)s
         crowdsec-sync

# Ignorer le réseau local
ignoreip = 127.0.0.1/8 <LAN-SUBNET>

# ---------------------------------------------------
# Jail SSH
# ---------------------------------------------------
[sshd]
enabled  = true
port     = <SSH-PORT>
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 24h

# ---------------------------------------------------
# Jail nginx — exploitation CVE
# ---------------------------------------------------
[nginx-cve]
enabled  = true
port     = http,https
filter   = nginx-cve
logpath  = /var/log/nginx/access.log
maxretry = 2
bantime  = 48h
findtime = 5m

# ---------------------------------------------------
# Jail nginx — botsearch (scanners, crawlers malveillants)
# ---------------------------------------------------
[nginx-botsearch]
enabled  = true
port     = http,https
filter   = nginx-botsearch
logpath  = /var/log/nginx/access.log
maxretry = 10
bantime  = 2h
findtime = 5m
```

---

<h2 align="center">Action CrowdSec-sync</h2>

`/etc/fail2ban/action.d/crowdsec-sync.conf`

```ini
[Definition]
actionstart =
actionstop  =
actioncheck =

# Quand Fail2ban banne une IP → l'envoyer à CrowdSec
actionban   = cscli decisions add --ip <ip> --duration <bantime>s --reason "fail2ban-<name>"

# Quand Fail2ban déban une IP → la retirer de CrowdSec
actionunban = cscli decisions delete --ip <ip>

[Init]
name = default
```

---

<h2 align="center">Filtre nginx-cve</h2>

`/etc/fail2ban/filter.d/nginx-cve.conf`

```ini
[Definition]
# Détection tentatives d'exploitation de CVE dans les URLs
failregex = ^<HOST> .* "(GET|POST|HEAD) .*(\.\./|etc/passwd|wp-login|phpMyAdmin|\.env|\.git/|eval\(|base64_decode|union.*select|<script) .*" (400|403|404|405|444|500)

ignoreregex =
```

---

<h2 align="center">Filtre nginx-botsearch</h2>

`/etc/fail2ban/filter.d/nginx-botsearch.conf`

```ini
[Definition]
# Scanners et crawlers malveillants identifiés par User-Agent ou patterns
failregex = ^<HOST> .* "(GET|POST) .*(\.php|\.asp|\.cgi|\.env|\.bak|\.sql|\.zip|\.tar|backup|admin|shell|cmd=) .*" (400|403|404)

ignoreregex = Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider
```

---

<h2 align="center">Commandes de référence</h2>

```bash
# État des jails
fail2ban-client status
fail2ban-client status sshd
fail2ban-client status nginx-cve
fail2ban-client status nginx-botsearch

# Débannir une IP
fail2ban-client set sshd unbanip 1.2.3.4

# Tester un filtre sur les logs
fail2ban-regex /var/log/nginx/access.log /etc/fail2ban/filter.d/nginx-cve.conf

# Logs fail2ban
tail -f /var/log/fail2ban.log
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
