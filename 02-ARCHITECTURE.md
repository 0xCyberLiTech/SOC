<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=%3EINFRASTRUCTURE_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>🏗️ Infrastructure &nbsp;·&nbsp; 🖥️ Stack technique &nbsp;·&nbsp; 🔗 Schéma réseau</h3>

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
  <img src="https://img.shields.io/badge/Debian-13-A81D33?style=flat-square&logo=debian&logoColor=white" alt="Debian" />
  &nbsp;  <img src="https://img.shields.io/badge/nginx-1.26-009639?style=flat-square&logo=nginx&logoColor=white" alt="nginx" />
  &nbsp;  <img src="https://img.shields.io/badge/Proxmox-VE-E57000?style=flat-square" alt="Proxmox" />
  &nbsp;  <img src="https://img.shields.io/badge/VMs-3-00B4D8?style=flat-square" alt="VMs" />
  &nbsp;
</p>

<br/>

<p>
  <a href="01-PRESENTATION.md"><img src="https://img.shields.io/badge/◄-01+Présentation-555555?style=flat-square" alt="← 01 Présentation" /></a>
  &nbsp;&nbsp;
  <a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>
  &nbsp;&nbsp;
  <a href="03-SECURITE-BRIQUES.md"><img src="https://img.shields.io/badge/03+Défense-►-555555?style=flat-square" alt="03 Défense →" /></a>
</p>

</div>

---

## Schéma réseau

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

## Infrastructure VMs Proxmox

| VM ID | Nom | IP | RAM | Disque | Rôle |
|-------|-----|----|-----|--------|------|
| 108 | srv-ngix | <SRV-NGIX-IP> | 14 Go | 50 Go | Reverse proxy · SOC · sécurité |
| 106 | srv-site-01 | <CLT-IP> | 2 Go | 50 Go | Backend Apache · site CLT |
| 107 | srv-site-02 | <PA85-IP> | 2 Go | 50 Go | Backend Apache · site PA85 |

**Proxmox VE** : <PROXMOX-IP> · SSH port <SSH-PORT> · clé `~/.ssh/id_proxmox`

---

## Ports exposés

### Entrants (srv-ngix)

| Port | Proto | Source | Service |
|------|-------|--------|---------|
| 80 | TCP | Anywhere | HTTP (redirect HTTPS) |
| 443 | TCP | Anywhere | HTTPS nginx |
| <SSH-PORT> | TCP | <LAN-SUBNET> | SSH (LAN uniquement) |
| 8080 | TCP | <LAN-SUBNET> | Dashboard SOC (LAN uniquement) |
| 514 | TCP+UDP | <LAN-SUBNET> | rsyslog central (LAN uniquement) |

### Sortants (srv-ngix)

| Port | Proto | Destination | Usage |
|------|-------|-------------|-------|
| 80 | TCP | <CLT-IP>/13 | Proxy → backends |
| 443 | TCP | Anywhere | Updates, CrowdSec CAPI, edge-tts |
| 53 | UDP | Anywhere | DNS |
| 123 | UDP | Anywhere | NTP |
| 587 | TCP | Anywhere | SMTP (alertes mail) |
| <SSH-PORT> | TCP | <CLT-IP>/13/20 | SSH monitoring |

---

## Stack logicielle srv-ngix

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

## Flux de données

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

## Clés SSH

| Clé | Machine cible | Chemin local |
|-----|--------------|--------------|
| id_nginx | srv-ngix (<SRV-NGIX-IP>) | ~/.ssh/id_nginx |
| id_site-01 | site-01 (<CLT-IP>) | ~/.ssh/id_site-01 |
| id_site-02 | site-02 (<PA85-IP>) | ~/.ssh/id_site-02 |
| id_proxmox | Proxmox (<PROXMOX-IP>) | ~/.ssh/id_proxmox |

Toutes les connexions SSH : **port <SSH-PORT> · IdentitiesOnly=yes · BatchMode=yes**

---

## Structure fichiers srv-ngix

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

*Document : 02-ARCHITECTURE.md · Projet SOC 0xCyberLiTech · 2026-04-25*
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
  <a href="01-PRESENTATION.md"><img src="https://img.shields.io/badge/◄-01+Présentation-555555?style=flat-square" alt="← 01 Présentation" /></a>&nbsp;&nbsp;<a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>&nbsp;&nbsp;<a href="03-SECURITE-BRIQUES.md"><img src="https://img.shields.io/badge/03+Défense-►-555555?style=flat-square" alt="03 Défense →" /></a>
</p>

</div>
