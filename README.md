<div align="center">

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=30&duration=6000&pause=1000000000&color=00D9FF&center=true&vCenter=true&width=900&lines=%3ESOC+DASHBOARD+—+0xCyberLiTech_" alt="SOC Dashboard" />
  </a>

  <h3>Tableau de bord SOC — Homelab cybersécurité en production</h3>

  <p>
    <img src="https://img.shields.io/badge/Version-v3.80.5-00D9FF?style=flat-square" />
    <img src="https://img.shields.io/badge/Stack-nginx%20%7C%20CrowdSec%20%7C%20Suricata%20%7C%20fail2ban-red?style=flat-square" />
    <img src="https://img.shields.io/badge/Runtime-Debian%2013-A81D33?style=flat-square&logo=debian" />
    <img src="https://img.shields.io/badge/IA-JARVIS%20intégré-blueviolet?style=flat-square" />
    <img src="https://img.shields.io/badge/Statut-Production-brightgreen?style=flat-square" />
  </p>

</div>

---

## Vue d'ensemble

Dashboard de sécurité monolithique (HTML/CSS/JS — fichier unique) déployé en production sur un homelab Proxmox.  
Surveille en temps réel l'ensemble de l'infrastructure réseau : nginx, CrowdSec, Suricata IDS, fail2ban (4 hôtes), UFW, Proxmox, routeur, Freebox Delta.

> Pas un projet de démonstration — un outil en production 24/7, mis à jour hebdomadairement.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WINDOWS 11 (Client)                       │
│  Dashboard SOC (navigateur) ←→ JARVIS IA (localhost:5000)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ LAN
┌──────────────────────────▼──────────────────────────────────┐
│                  Proxmox VE (Hyperviseur)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  srv-ngix (VM)                                        │   │
│  │  nginx  ←  CrowdSec AppSec WAF  ←  Internet          │   │
│  │  Suricata IDS  |  fail2ban  |  UFW                   │   │
│  │  /var/www/monitoring/ ← monitoring_gen.py (5 min)    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌────────────────┐  ┌────────────────┐                     │
│  │  clt (VM)      │  │  pa85 (VM)     │                     │
│  │  Apache2       │  │  Apache2       │                     │
│  │  fail2ban/UFW  │  │  fail2ban/UFW  │                     │
│  └────────────────┘  └────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────┐
│  Routeur GT-BE98        │
│  SNMP + SSH (paramiko)  │
│  Freebox Delta API      │
└─────────────────────────┘
```

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Sécurité périmètre** | CrowdSec (AppSec WAF + ~150 vPatch CVE), Suricata IDS (90K+ signatures), fail2ban, UFW |
| **Reverse proxy** | nginx (vhost monitoring, TLS, GeoIP) |
| **Collecte données** | Python 3 — `monitoring_gen.py` (2 600 lignes, 40+ fonctions) |
| **Frontend** | HTML/CSS/JS monolithique (~12 300 lignes) — aucune dépendance externe, aucun framework |
| **Virtualisation** | Proxmox VE, vzdump snapshot zstd |
| **IA intégrée** | JARVIS (Ollama local — voir dépôt JARVIS) |
| **Réseau** | paramiko (SSH), SNMP, Freebox API (token OAuth), nf_conntrack |

---

## Fonctionnalités — 27 tuiles de monitoring

### Sécurité
| Tuile | Description |
|-------|-------------|
| **KILL CHAIN** | MITRE ATT&CK — suivi des IPs actives par stage (RECON→SCAN→EXPLOIT→BRUTE) |
| **CROWDSEC** | Décisions actives, scénarios déclenchés, AppSec WAF, ban velocity |
| **SURICATA IDS** | Alertes 24h sév.1/sév.2, top règles, Kill Chain enrichi |
| **FAIL2BAN** | 4 hôtes (srv-ngix, clt, pa85, Proxmox) — jails, IPs bannies, modal détail |
| **UFW FIREWALL** | Matrice règles entrantes/sortantes, anomalies détectées |
| **HONEYPOT** | Détection tentatives sur ports non exposés |
| **CVE WATCH** | Feed CVE synchronisé — alertes sur CVEs récentes |

### Réseau & Infrastructure
| Tuile | Description |
|-------|-------------|
| **ROUTEUR GT-BE98** | WAN tx/rx temps réel, conntrack, FW drops, matrice flux top destinations |
| **FREEBOX DELTA** | État BOX/WAN/fibre, SFP optique dBm, latence, graphiques 24h, alertes trafic |
| **NGINX TRAFIC** | Requêtes 24h, taux d'erreur, GeoIP blocks, top IPs |
| **PROTOCOLES ACTIFS** | Donut répartition protocoles, ports top 10 |
| **CARTE MONDIALE** | Géolocalisation attaques en temps réel |

### Systèmes
| Tuile | Description |
|-------|-------------|
| **PROXMOX VE** | CPU/RAM/disques, sparklines CPU 24h, 3 VMs (uptime, ressources) |
| **WINDOWS** | Disques, GPU RTX 5080 (VRAM, temp), sauvegarde dernière exécution |
| **SSH** | Sessions actives sur 3 hôtes, uptimes VMs |
| **SERVICES** | État de tous les services critiques (nginx, crowdsec, suricata, apache2...) |
| **CRONS** | État des tâches planifiées |
| **MISES À JOUR** | Paquets apt en attente sur srv-ngix |

### IA & Alertes
| Tuile | Description |
|-------|-------------|
| **THREAT SCORE** | Score de menace global calculé sur 14 sources (0–100) |
| **JARVIS** | Statut de l'assistant IA, actions proactives récentes, quick prompts SOC |
| **ALERTES ACTIVES** | Synthèse des alertes critiques en cours |

---

## Sécurité des données

Aucune donnée sensible dans ce dépôt :
- Les IPs LAN, tokens, clés SSH restent hors dépôt
- Les fichiers JSON de monitoring ne sont pas versionnés
- Le dashboard ne contient aucune credential hardcodée

---

## Déploiement

Le dashboard est un fichier HTML unique déployé par `scp` vers le serveur nginx.  
Un script `sync-and-pack.sh` synchronise les scripts serveur et repackage une archive de déploiement.

```bash
# Déploiement rapide
scp monitoring-index.html root@srv-ngix:/var/www/monitoring/index.html
```

---

## Métriques projet

| Indicateur | Valeur |
|-----------|--------|
| Lignes de code (dashboard) | ~12 300 |
| Lignes Python (collecte) | ~2 600 |
| Sources de données | 14 |
| Fréquence de mise à jour | 5 minutes |
| Uptime en production | > 6 mois |
| Passes d'audit code | 4 (zéro code mort) |

---

<div align="center">
  <a href="https://github.com/0xCyberLiTech/JARVIS">
    <img src="https://img.shields.io/badge/Voir%20aussi-JARVIS%20IA-blueviolet?style=for-the-badge&logo=github" />
  </a>
  <a href="https://github.com/0xCyberLiTech">
    <img src="https://img.shields.io/badge/Profil-0xCyberLiTech-181717?style=for-the-badge&logo=github" />
  </a>
</div>

<div align="center">
  <br/>
  <b>🔒 Projet homelab par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> — Cybersécurité défensive en production 🔒</b>
</div>
