<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ECROWDSEC+CONF_" alt="SOC 0xCyberLiTech" />
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

<h2 align="center">Collections installées</h2>

```bash
cscli collections install \
  crowdsecurity/linux \
  crowdsecurity/nginx \
  crowdsecurity/http-cve \
  crowdsecurity/sshd \
  crowdsecurity/whitelist-good-actors \
  crowdsecurity/iptables \
  crowdsecurity/appsec-generic-rules \
  crowdsecurity/appsec-virtual-patching
```

| Collection | Rôle |
|------------|------|
| `linux` | Détection attaques système génériques |
| `nginx` | Analyse logs nginx — scans, 4xx excessifs |
| `http-cve` | CVE web connues (Log4Shell, Spring4Shell…) |
| `sshd` | Brute force SSH |
| `whitelist-good-actors` | Crawlers légitimes (Googlebot…) |
| `iptables` | Intégration nftables |
| `appsec-generic-rules` | WAF règles génériques |
| `appsec-virtual-patching` | ~207 vpatch CVE actifs |

---

<h2 align="center">config.yaml — Configuration LAPI</h2>

`/etc/crowdsec/config.yaml`

```yaml
common:
  daemonize: true
  log_media: file
  log_level: info
  log_dir: /var/log/crowdsec/
  working_dir: /var/lib/crowdsec/data/

config_paths:
  config_dir: /etc/crowdsec/
  data_dir: /var/lib/crowdsec/data/
  simulation_path: /etc/crowdsec/simulation.yaml
  hub_dir: /etc/crowdsec/hub/
  index_path: /etc/crowdsec/hub/.index.json

crowdsec_service:
  acquisition_path: /etc/crowdsec/acquis.yaml
  parser_routines: 1

cscli:
  output: human

db_config:
  type: sqlite
  db_path: /var/lib/crowdsec/data/crowdsec.db
  flush:
    max_items: 5000
    max_age: 7d

api:
  client:
    insecure_skip_verify: false
    credentials_path: /etc/crowdsec/local_api_credentials.yaml
  server:
    log_level: info
    listen_uri: 127.0.0.1:8080
    profiles_path: /etc/crowdsec/profiles.yaml
    online_client:
      credentials_path: /etc/crowdsec/online_api_credentials.yaml
```

---

<h2 align="center">Acquisition — Sources de logs</h2>

`/etc/crowdsec/acquis.yaml`

```yaml
# Logs nginx
filenames:
  - /var/log/nginx/access.log
  - /var/log/nginx/error.log
labels:
  type: nginx
---
# Logs SSH
filenames:
  - /var/log/auth.log
labels:
  type: syslog
---
# AppSec WAF — écoute sur socket nginx
listen_addr: 127.0.0.1:7422
appsec_config: crowdsecurity/virtual-patching
name: appsec
source: appsec
labels:
  type: appsec
```

---

<h2 align="center">Bouncer nftables</h2>

`/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml`

```yaml
mode: nftables
update_frequency: 10s
log_mode: file
log_dir: /var/log/crowdsec/
log_level: info
api_key: <BOUNCER-API-KEY>          # généré : cscli bouncers add cs-nftables-bouncer
api_url: http://127.0.0.1:8080/

nftables:
  ipv4:
    enabled: true
    set-only: false
    table: crowdsec
    chain: crowdsec-chain
  ipv6:
    enabled: false
```

---

<h2 align="center">Scénarios custom</h2>

`/etc/crowdsec/scenarios/custom-nginx-404-scan.yaml`

```yaml
type: leaky
name: <GITHUB-USER>/nginx-404-scan
description: "Détection scan 404 intensif — 30 erreurs en 2 min"
filter: "evt.Meta.service == 'nginx' && evt.Meta.http_status == '404'"
groupby: "evt.Meta.source_ip"
capacity: 30
leakspeed: "10s"
blackhole: 5m
labels:
  service: nginx
  type: scan
  remediation: true
```

`/etc/crowdsec/scenarios/custom-nginx-bot-ua.yaml`

```yaml
type: leaky
name: <GITHUB-USER>/nginx-bot-useragent
description: "User-Agent de bot/scanner connu"
filter: >
  evt.Meta.service == 'nginx' &&
  evt.Parsed.http_user_agent contains any ('sqlmap', 'nikto', 'masscan', 'zgrab', 'nuclei')
groupby: "evt.Meta.source_ip"
capacity: 5
leakspeed: "60s"
blackhole: 10m
labels:
  service: nginx
  type: bot
  remediation: true
```

`/etc/crowdsec/scenarios/custom-ssh-slowbrute.yaml`

```yaml
type: leaky
name: <GITHUB-USER>/ssh-slow-bruteforce
description: "Brute force SSH lent — évite les seuils fail2ban"
filter: "evt.Meta.log_type == 'ssh_failed-auth'"
groupby: "evt.Meta.source_ip"
capacity: 10
leakspeed: "120s"
blackhole: 24h
labels:
  service: ssh
  type: bruteforce
  remediation: true
```

---

<h2 align="center">Whitelist LAN</h2>

`/etc/crowdsec/parsers/s02-enrich/whitelist-lan.yaml`

```yaml
name: crowdsecurity/whitelist-lan
description: "Whitelist LAN — ne jamais bannir le réseau local"
whitelist:
  reason: "LAN réseau local"
  ip:
    - "127.0.0.1"
  cidr:
    - "<LAN-SUBNET>"
```

---

<h2 align="center">Commandes de référence</h2>

```bash
# État général
cscli decisions list
cscli alerts list
cscli metrics

# Vérifier CAPI (cloud CrowdSec)
cscli capi status

# Bannir / débannir manuellement
cscli decisions add --ip 1.2.3.4 --duration 24h --reason "test"
cscli decisions delete --ip 1.2.3.4

# Inspecter les scénarios déclenchés
cscli scenarios list
cscli collections list

# Logs temps réel
tail -f /var/log/crowdsec/crowdsec.log
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
