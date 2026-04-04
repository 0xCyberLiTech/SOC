<div align="center">

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=30&duration=6000&pause=1000000000&color=00D9FF&center=true&vCenter=true&width=900&lines=%3ESOC+DASHBOARD+—+0xCyberLiTech_" alt="SOC Dashboard" />
  </a>

  <h3>Tableau de bord SOC homelab — Production 24/7</h3>

  <p>
    <img src="https://img.shields.io/badge/Version-v3.80.5-00D9FF?style=flat-square" />
    <img src="https://img.shields.io/badge/Stack-nginx%20%7C%20CrowdSec%20%7C%20Suricata%20%7C%20fail2ban-red?style=flat-square" />
    <img src="https://img.shields.io/badge/Runtime-Debian%2013-A81D33?style=flat-square&logo=debian" />
    <img src="https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python" />
    <img src="https://img.shields.io/badge/IA-JARVIS%20intégré-blueviolet?style=flat-square" />
    <img src="https://img.shields.io/badge/Statut-Production-brightgreen?style=flat-square" />
  </p>

</div>

---

## Présentation

Dashboard de sécurité **monolithique** (un seul fichier HTML/CSS/JS) déployé en production sur un homelab Proxmox.  
Surveille en temps réel : nginx, CrowdSec, Suricata IDS, fail2ban (4 hôtes), UFW, Proxmox, routeur, Freebox Delta.

> Ce n'est pas un projet de démonstration. C'est un SOC opérationnel, mis à jour hebdomadairement depuis plusieurs mois.

---

## Guide d'installation — étape par étape

| Étape | Description | Lien |
|-------|-------------|------|
| **01** | Prérequis, OS, SSH, UFW de base | [01 — Prérequis](./docs/01-PREREQUIS.md) |
| **02** | nginx, virtual host, déploiement web | [02 — nginx & Web](./docs/02-NGINX-WEB.md) |
| **03** | CrowdSec IPS + AppSec WAF (~150 vPatch CVE) | [03 — CrowdSec](./docs/03-CROWDSEC.md) |
| **04** | Suricata IDS (90K+ signatures, alertes 24h) | [04 — Suricata](./docs/04-SURICATA.md) |
| **05** | fail2ban multi-hôtes (SSH, nginx, CVE jails) | [05 — fail2ban](./docs/05-FAIL2BAN.md) |
| **06** | Collecte des données — monitoring_gen.py | [06 — Collecte](./docs/06-COLLECTE-MONITORING.md) |
| **07** | Dashboard HTML + déploiement final | [07 — Dashboard](./docs/07-DASHBOARD.md) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (navigateur LAN)                   │
│              http://VOTRE_IP:8080 — Dashboard SOC            │
└──────────────────────────┬──────────────────────────────────┘
                           │ LAN
┌──────────────────────────▼──────────────────────────────────┐
│               Serveur principal (Debian 13)                   │
│                                                              │
│  Internet → nginx (80/443)                                   │
│              ↓                                               │
│  CrowdSec AppSec WAF  ← bloque exploits CVE                  │
│  CrowdSec IPS (nftables) ← bloque IPs malveillantes          │
│  Suricata IDS ← alerte sur le trafic réseau                  │
│  fail2ban ← bloque brute force SSH/web                       │
│  UFW ← politique deny par défaut                             │
│              ↓                                               │
│  monitoring_gen.py (cron 5 min) → monitoring.json            │
│              ↓                                               │
│  nginx → /var/www/monitoring/ → Dashboard                    │
└─────────────────────────────────────────────────────────────┘
         ↑ SSH (paramiko)
┌────────┴────────────────┐
│  Hôtes secondaires       │
│  clt, pa85, Proxmox VE  │
│  fail2ban remote stats   │
└─────────────────────────┘
```

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Sécurité périmètre** | CrowdSec AppSec WAF, Suricata IDS, fail2ban, UFW |
| **Reverse proxy** | nginx |
| **Collecte** | Python 3 — `monitoring_gen.py` |
| **Frontend** | HTML/CSS/JS — aucune dépendance externe |
| **Virtualisation** | Proxmox VE |
| **IA intégrée** | JARVIS (voir [dépôt JARVIS](https://github.com/0xCyberLiTech/JARVIS)) |

---

## Scripts disponibles

| Script | Description |
|--------|-------------|
| [`scripts/monitoring.sh`](./scripts/monitoring.sh) | Wrapper cron avec verrouillage et logging |
| [`scripts/ufw-snapshot.sh`](./scripts/ufw-snapshot.sh) | Export des règles UFW en JSON |
| [`config/alert.conf.example`](./config/alert.conf.example) | Template de configuration des alertes |
| [`nginx/monitoring.conf.example`](./nginx/monitoring.conf.example) | Virtual host nginx commenté |

---

## Fonctionnalités — 27 tuiles

<details>
<summary>Voir la liste complète</summary>

| Tuile | Données |
|-------|---------|
| KILL CHAIN | MITRE ATT&CK — IPs actives par stage |
| CROWDSEC | Décisions, scénarios, AppSec WAF |
| SURICATA IDS | Alertes 24h sév.1/sév.2 |
| FAIL2BAN | 4 hôtes — jails, IPs bannies |
| UFW FIREWALL | Matrice règles, anomalies |
| HONEYPOT | Tentatives sur ports non exposés |
| CVE WATCH | Feed CVE récentes |
| ROUTEUR | WAN tx/rx, conntrack, flux |
| FREEBOX DELTA | BOX/WAN/SFP, graphiques, alertes trafic |
| NGINX TRAFIC | Requêtes 24h, erreurs, GeoIP |
| PROTOCOLES ACTIFS | Répartition protocoles/ports |
| CARTE MONDIALE | Géolocalisation attaques |
| PROXMOX VE | CPU/RAM, VMs, sparklines |
| WINDOWS | Disques, GPU, sauvegarde |
| SSH | Sessions actives, uptimes |
| SERVICES | État services critiques |
| CRONS | Tâches planifiées |
| MISES À JOUR | Paquets en attente |
| THREAT SCORE | Score 0-100 sur 14 sources |
| JARVIS IA | Actions proactives, quick prompts |

</details>

---

## Déploiement rapide

```bash
# 1. Cloner
git clone https://github.com/0xCyberLiTech/SOC.git
cd SOC

# 2. Suivre le guide étape par étape
# Commencer par : docs/01-PREREQUIS.md

# 3. Déployer le dashboard
scp -P 2222 dashboard/monitoring-index.html user@VOTRE_IP:/var/www/monitoring/index.html
```

---

## Sécurité — ce qui n'est pas dans ce dépôt

- Aucune IP réelle
- Aucun token, clé SSH ou mot de passe
- Aucun fichier JSON de monitoring
- Aucune donnée personnelle

---

<div align="center">
  <a href="https://github.com/0xCyberLiTech/JARVIS">
    <img src="https://img.shields.io/badge/Intégration-JARVIS%20IA-blueviolet?style=for-the-badge&logo=github" />
  </a>
  <a href="https://github.com/0xCyberLiTech">
    <img src="https://img.shields.io/badge/Profil-0xCyberLiTech-181717?style=for-the-badge&logo=github" />
  </a>
</div>

<div align="center">
  <br/>
  <b>🔒 Projet par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> — Cybersécurité défensive en production 🔒</b>
</div>
