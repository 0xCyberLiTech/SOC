<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EARCHITECTURE_" alt="SOC 0xCyberLiTech" />
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

<h2 align="center">Schéma réseau</h2>

```
INTERNET
    │
    │ HTTP/HTTPS (80/443)
    ▼
┌─────────────────────────────────────────────────────┐
│  srv-ngix — <SRV-NGIX-IP>  (VM Proxmox 108)          │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  UFW     │  │  nftables    │  │  CrowdSec     │  │
│  │ (pare-feu│  │  (bouncer    │  │  LAPI + AppSec│  │
│  │  Linux)  │  │  CrowdSec)   │  │  WAF          │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  nginx 1.26                                  │   │
│  │  • Reverse proxy → site-01 (<CLT-IP>:80)     │   │
│  │  • Reverse proxy → site-02 (<PA85-IP>:80)    │   │
│  │  • Dashboard SOC :8080 (LAN only)            │   │
│  │  • GeoIP2 · Log format enrichi               │   │
│  │  • Headers sécurité (HSTS, CSP, X-Frame...)  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Suricata │  │ Fail2ban │  │ rsyslog récepteur │  │
│  │ IDS      │  │ 3 jails  │  │ TCP+UDP :514      │  │
│  │ 106k règ.│  │          │  │ 5 hôtes           │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Python 3.11                                 │   │
│  │  • monitoring_gen.py → monitoring.json       │   │
│  │  • soc.py (API ban/unban/restart)            │   │
│  │  • soc-daily-report.py (mail 8h00)           │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │                          │
         │ :80                      │ rsyslog :514
         ▼                          ▼
┌──────────────────┐    ┌────────────────────┐
│ site-01 <CLT-IP> │    │ site-02 <PA85-IP>  │
│ Apache · site CLT│    │ Apache · site PA85 │
│ fail2ban local   │    │ fail2ban local     │
└──────────────────┘    └────────────────────┘

                    ┌─────────────────────────┐
                    │ Proxmox VE <PROXMOX-IP> │
                    │ Hyperviseur VMs 106/107 │
                    │ /108                    │
                    └─────────────────────────┘

                    ┌──────────────────────────┐
                    │ JARVIS <LAN-IP>     │
                    │ Windows · localhost:5000 │
                    │ Ollama phi4-reasoning    │
                    └──────────────────────────┘

                    ┌──────────────────────┐
                    │ Routeur <ROUTER>      │
                    │ <ROUTER-IP>         │
                    │ Source logs WAN/DHCP │
                    └──────────────────────┘
```

---

<h2 align="center">Infrastructure VMs Proxmox</h2>

| VM ID | Nom | IP | RAM | Disque | Rôle |
|-------|-----|----|-----|--------|------|
| 108 | srv-ngix | <SRV-NGIX-IP> | 14 Go | 50 Go | Reverse proxy · SOC · sécurité |
| 106 | srv-site-01 | <CLT-IP> | 2 Go | 50 Go | Backend Apache · site CLT |
| 107 | srv-site-02 | <PA85-IP> | 2 Go | 50 Go | Backend Apache · site PA85 |

**Proxmox VE** : <PROXMOX-IP> · SSH port <SSH-PORT> · clé `~/.ssh/id_proxmox`

---

<h2 align="center">Ports exposés</h2>

<h3 align="center">Entrants (srv-ngix)</h3>

| Port | Proto | Source | Service |
|------|-------|--------|---------|
| 80 | TCP | Anywhere | HTTP (redirect HTTPS) |
| 443 | TCP | Anywhere | HTTPS nginx |
| <SSH-PORT> | TCP | <LAN-SUBNET> | SSH (LAN uniquement) |
| 8080 | TCP | <LAN-SUBNET> | Dashboard SOC (LAN uniquement) |
| 514 | TCP+UDP | <LAN-SUBNET> | rsyslog central (LAN uniquement) |

<h3 align="center">Sortants (srv-ngix)</h3>

| Port | Proto | Destination | Usage |
|------|-------|-------------|-------|
| 80 | TCP | <CLT-IP>/13 | Proxy → backends |
| 443 | TCP | Anywhere | Updates, CrowdSec CAPI, edge-tts |
| 53 | UDP | Anywhere | DNS |
| 123 | UDP | Anywhere | NTP |
| 587 | TCP | Anywhere | SMTP (alertes mail) |
| <SSH-PORT> | TCP | <CLT-IP>/13/20 | SSH monitoring |

---

<h2 align="center">Stack logicielle srv-ngix</h2>

```
OS          : Debian 13 (Trixie)
Kernel      : Linux 6.12.x
nginx       : 1.26.3  (+ mod-geoip2, mod-headers-more-filter)
Python      : 3.11
CrowdSec    : dernière stable (LAPI + bouncer nftables + AppSec)
Fail2ban    : dernière stable
Suricata    : dernière stable (IDS mode, ring 100k)
AppArmor    : actif — 9 profils enforce (nginx, suricata...)
rsyslog     : récepteur TCP+UDP :514
Exim4       : MTA local (alertes mail)
GeoIP2      : MaxMind GeoLite2-Country + GeoLite2-City
AIDE        : Vérification intégrité nightly 03h00
```

---

<h2 align="center">Flux de données</h2>

```
nginx access.log
      │
      ├──→ Fail2ban (parsing regex → crowdsec-sync)
      ├──→ monitoring_gen.py (stats req/h, error rate, top IPs)
      └──→ rsyslog (apache_access.log via syslog site-01/site-02)

CrowdSec LAPI
      │
      ├──→ nftables bouncer (ban nftables sets)
      ├──→ AppSec WAF (207 vpatch inline nginx)
      └──→ monitoring_gen.py (decisions, alerts_30d, scenarios)

Suricata (AF_PACKET eth0)
      │
      └──→ eve.json → monitoring_gen.py (alertes sév.1/2/3)

rsyslog /var/log/central/
      │
      ├──→ site-01/  site-02/  pve/  <ROUTER>/  srv-ngix/
      └──→ monitoring_gen.py (cross-host correlation)

monitoring_gen.py (cron */5 min)
      │
      └──→ /var/www/monitoring/monitoring.json

Dashboard JS (polling 60s)
      │
      └──→ fetch monitoring.json → render 35 tuiles

JARVIS soc.py (boucle 60s)
      │
      ├──→ CrowdSec : ban/unban IPs
      ├──→ systemctl : restart services down
      ├──→ TTS : alertes vocales
      └──→ LLM : analyse gap défensif
```

---

<h2 align="center">Clés SSH</h2>

| Clé | Machine cible | Chemin local |
|-----|--------------|--------------|
| id_nginx | srv-ngix (<SRV-NGIX-IP>) | ~/.ssh/id_nginx |
| id_site-01 | site-01 (<CLT-IP>) | ~/.ssh/id_site-01 |
| id_site-02 | site-02 (<PA85-IP>) | ~/.ssh/id_site-02 |
| id_proxmox | Proxmox (<PROXMOX-IP>) | ~/.ssh/id_proxmox |

Toutes les connexions SSH : **port <SSH-PORT> · IdentitiesOnly=yes · BatchMode=yes**

---

<h2 align="center">Structure fichiers srv-ngix</h2>

```
/var/www/monitoring/
├── index.html              ← Dashboard SPA
├── monitoring.json         ← Données sécurité (généré par monitoring_gen.py)
├── *.json                  ← Autres données (router, proto-live, windows-disk)
├── js/                     ← 24 modules JS (01-utils → 22-ip-deep)
├── css/
│   └── monitoring.css      ← Styles (1 400 lignes, tokens CSS --fs-*)
└── libs/                   ← Librairies tierces (Leaflet...)

/opt/site-01/
├── monitoring_gen.py       ← Générateur monitoring.json
├── monitoring.sh           ← Wrapper bash (appelé par cron)
├── soc.py                  ← API Flask ban/unban/restart (port interne)
├── soc-daily-report.py     ← Rapport mail quotidien
└── proto-live.py           ← Stats protocoles temps réel

/etc/nginx/
├── nginx.conf              ← Config principale (server_tokens off, headers-more)
├── sites-available/        ← Vhosts (site-01, site-02, monitoring)
└── sites-enabled/          ← Symlinks actifs

/etc/crowdsec/
├── config.yaml
├── parsers/                ← Parsers custom
└── scenarios/              ← Scénarios custom

/var/log/central/           ← Logs rsyslog centralisés
├── site-01/
├── site-02/
├── pve/
├── <ROUTER>/
└── srv-ngix/
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
