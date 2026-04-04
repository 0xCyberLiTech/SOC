<div align="center">

<img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=36&duration=6000&pause=1000000000&color=00D9FF&center=true&vCenter=true&width=960&lines=%3E+SOC+Dashboard+—+Sécurité+Défensive_" alt="SOC Dashboard" />

<br/>

<p>
  <img src="https://img.shields.io/badge/Version-v3.80-00D9FF?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Runtime-Debian%2013-A81D33?style=for-the-badge&logo=debian&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/nginx-Reverse%20Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white" />
  <img src="https://img.shields.io/badge/Statut-Production-00FF88?style=for-the-badge" />
</p>

<p>
  <img src="https://img.shields.io/badge/CrowdSec-IPS%20%2B%20AppSec%20WAF-E01E5A?style=flat-square" />
  <img src="https://img.shields.io/badge/Suricata-IDS%2090K%2B%20sigs-FF6600?style=flat-square" />
  <img src="https://img.shields.io/badge/fail2ban-4%20hôtes-FFD700?style=flat-square" />
  <img src="https://img.shields.io/badge/Tuiles-27-00D9FF?style=flat-square" />
  <img src="https://img.shields.io/badge/Cloud-Zéro-00FF88?style=flat-square" />
  <img src="https://img.shields.io/badge/IA-JARVIS%20intégré-9B59B6?style=flat-square" />
</p>

<br/>

<img src="./images/soc-01.jpg" alt="SOC — Carte mondiale des attaques" width="95%" />

<br/><br/>

<i>Dashboard de sécurité monolithique opérationnel 24/7 — surveillance en temps réel de nginx, CrowdSec, Suricata IDS,<br/>
fail2ban sur 4 hôtes et JARVIS IA. Aucune dépendance externe. Aucune donnée transmise à des tiers.</i>

</div>

---

## Sommaire

<div align="center">
<table border="0" width="700">
  <tr>
    <td align="center" width="175"><a href="#vue-densemble">Vue d'ensemble</a></td>
    <td align="center" width="175"><a href="#architecture">Architecture</a></td>
    <td align="center" width="175"><a href="#screenshots">Screenshots</a></td>
    <td align="center" width="175"><a href="#déploiement-rapide">Installation</a></td>
  </tr>
  <tr>
    <td align="center"><a href="#guide-dinstallation--étape-par-étape">Guide complet</a></td>
    <td align="center"><a href="#27-tuiles-de-surveillance">27 Tuiles</a></td>
    <td align="center"><a href="#stack-technique">Stack technique</a></td>
    <td align="center"><a href="#intégration-jarvis-ia">Intégration JARVIS</a></td>
  </tr>
</table>
</div>

---

## Vue d'ensemble

**SOC Dashboard** est un tableau de bord de sécurité complet, opérationnel en production 24/7.

| Capacité | Détail |
|----------|--------|
| **Périmètre** | CrowdSec AppSec WAF (~150 vPatch CVE) + IPS nftables |
| **IDS** | Suricata — 90 000+ signatures, alertes classées par sévérité |
| **Brute Force** | fail2ban — 4 hôtes (srv-ngix, clt, pa85, Proxmox) |
| **Firewall** | UFW — politique deny par défaut, matrice de règles |
| **Kill Chain** | MITRE ATT&CK — IPs actives par stage d'attaque |
| **Dashboard** | 27 tuiles — HTML/CSS/JS monolithique — zéro dépendance externe |
| **IA** | JARVIS intégré — analyse LLM, ban auto, alertes vocales |

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
│  CrowdSec AppSec WAF  ← bloque exploits CVE (~150 vPatch)    │
│  CrowdSec IPS (nftables) ← bloque IPs malveillantes          │
│  Suricata IDS ← alerte sur le trafic réseau                  │
│  fail2ban ← bloque brute force SSH/web                       │
│  UFW ← politique deny par défaut                             │
│              ↓                                               │
│  monitoring_gen.py (cron 5 min) → monitoring.json            │
│              ↓                                               │
│  nginx → /var/www/monitoring/ → Dashboard HTML               │
└─────────────────────────────────────────────────────────────┘
         ↑ SSH (paramiko)
┌────────┴─────────────────────┐
│  Hôtes secondaires            │
│  clt · pa85 · Proxmox VE     │
│  fail2ban remote stats        │
└──────────────────────────────┘
```

---

## Screenshots

### Carte mondiale des attaques

<div align="center">
  <img src="./images/soc-01.jpg" alt="Carte mondiale des attaques en temps réel" width="95%" />
  <br/><sub>Tuile <b>CARTE MONDIALE</b> — géolocalisation des IPs bannies, arcs d'attaque, clustering par pays</sub>
</div>

<br/>

### CrowdSec & Activité 24h

<table border="0" cellspacing="0" cellpadding="8">
  <tr>
    <td width="42%">
      <img src="./images/soc-05.jpg" alt="CrowdSec analyse comportementale" width="100%" />
      <p align="center"><sub>Tuile <b>CROWDSEC</b> — 90 décisions actives, Kill Chain scénarios, IPs bannies avec durée</sub></p>
    </td>
    <td width="58%">
      <img src="./images/soc-04.jpg" alt="Activité temps réel 24h" width="100%" />
      <p align="center"><sub>Tuile <b>ACTIVITÉ 24H</b> — requêtes légitimes vs blocages CrowdSec, histogramme horaire</sub></p>
    </td>
  </tr>
</table>

### Threat Score & Flux live

<table border="0" cellspacing="0" cellpadding="8">
  <tr>
    <td width="55%">
      <img src="./images/soc-06.jpg" alt="Niveau de menace global" width="100%" />
      <p align="center"><sub>Tuile <b>THREAT SCORE</b> — score 0-100 sur 14 sources, niveau MOYEN/ÉLEVÉ/CRITIQUE</sub></p>
    </td>
    <td width="45%">
      <img src="./images/soc-07.jpg" alt="Flux live fenêtre 5 min" width="100%" />
      <p align="center"><sub>Tuile <b>FLUX LIVE</b> — req/min fenêtre glissante 5 min, HTTP · Scanner · CS Bans</sub></p>
    </td>
  </tr>
</table>

### Intégration JARVIS IA

<table border="0" cellspacing="0" cellpadding="8">
  <tr>
    <td width="50%">
      <img src="./images/soc-02.jpg" alt="JARVIS IA — Tuile SOC" width="100%" />
      <p align="center"><sub>Tuile <b>JARVIS IA</b> — quick prompts SOC, analyse LLM en temps réel, actions proactives</sub></p>
    </td>
    <td width="50%">
      <img src="./images/soc-03.jpg" alt="JARVIS IA — Auto-engine paramètres" width="100%" />
      <p align="center"><sub>Tuile <b>JARVIS SETTINGS</b> — seuils auto-engine, ban auto, restart services, alertes vocales</sub></p>
    </td>
  </tr>
</table>

### GPU — Intelligence Artificielle

<div align="center">
  <img src="./images/soc-08.jpg" alt="GPU Intelligence Artificielle RTX 5080" width="95%" />
  <br/><sub>Tuile <b>GPU IA</b> — RTX 5080 · usage CUDA, VRAM, température, sparklines 10 dernières secondes</sub>
</div>

---

## Guide d'installation — étape par étape

<table>
  <tr>
    <th>Étape</th>
    <th>Description</th>
    <th>Guide</th>
  </tr>
  <tr>
    <td align="center"><b>01</b></td>
    <td>Prérequis, OS, SSH, UFW de base</td>
    <td><a href="./docs/01-PREREQUIS.md">→ Prérequis</a></td>
  </tr>
  <tr>
    <td align="center"><b>02</b></td>
    <td>nginx, virtual host, déploiement web</td>
    <td><a href="./docs/02-NGINX-WEB.md">→ nginx & Web</a></td>
  </tr>
  <tr>
    <td align="center"><b>03</b></td>
    <td>CrowdSec IPS + AppSec WAF (~150 vPatch CVE)</td>
    <td><a href="./docs/03-CROWDSEC.md">→ CrowdSec</a></td>
  </tr>
  <tr>
    <td align="center"><b>04</b></td>
    <td>Suricata IDS (90K+ signatures, alertes 24h)</td>
    <td><a href="./docs/04-SURICATA.md">→ Suricata</a></td>
  </tr>
  <tr>
    <td align="center"><b>05</b></td>
    <td>fail2ban multi-hôtes (SSH, nginx, CVE jails)</td>
    <td><a href="./docs/05-FAIL2BAN.md">→ fail2ban</a></td>
  </tr>
  <tr>
    <td align="center"><b>06</b></td>
    <td>Collecte des données — monitoring_gen.py</td>
    <td><a href="./docs/06-COLLECTE-MONITORING.md">→ Collecte</a></td>
  </tr>
  <tr>
    <td align="center"><b>07</b></td>
    <td>Dashboard HTML + déploiement final</td>
    <td><a href="./docs/07-DASHBOARD.md">→ Dashboard</a></td>
  </tr>
</table>

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

```
✔  SOC Dashboard disponible sur  →  http://VOTRE_IP:8080
```

---

## 27 Tuiles de surveillance

<details>
<summary>Voir toutes les tuiles</summary>

<br/>

| # | Tuile | Données surveillées |
|---|-------|---------------------|
| 01 | **KILL CHAIN** | MITRE ATT&CK — IPs actives par stage d'attaque |
| 02 | **CROWDSEC IPS** | Décisions nftables, scénarios, bans actifs |
| 03 | **CROWDSEC AppSec** | Requêtes bloquées WAF, vPatch CVE actifs |
| 04 | **SURICATA IDS** | Alertes sév.1 / sév.2 sur 24h |
| 05 | **FAIL2BAN** | 4 hôtes — jails actives, IPs bannies |
| 06 | **UFW FIREWALL** | Matrice règles, anomalies détectées |
| 07 | **HONEYPOT** | Tentatives sur ports non exposés |
| 08 | **CVE WATCH** | Feed CVE récentes (NVD) |
| 09 | **ROUTEUR** | WAN tx/rx, conntrack, flux réseau |
| 10 | **FREEBOX DELTA** | BOX/WAN/SFP, graphiques, alertes trafic |
| 11 | **NGINX TRAFIC** | Requêtes 24h, erreurs, GeoIP |
| 12 | **PROTOCOLES ACTIFS** | Répartition protocoles/ports (live donut) |
| 13 | **CARTE MONDIALE** | Géolocalisation attaques — arcs animés |
| 14 | **PROXMOX VE** | CPU/RAM, VMs, sparklines |
| 15 | **WINDOWS** | Disques, GPU, sauvegarde |
| 16 | **SSH** | Sessions actives, uptimes |
| 17 | **SERVICES** | État services critiques |
| 18 | **CRONS** | Tâches planifiées |
| 19 | **MISES À JOUR** | Paquets en attente |
| 20 | **THREAT SCORE** | Score 0-100 sur 14 sources |
| 21 | **JARVIS IA** | Actions proactives, quick prompts, auto-engine |
| 22 | **ALERTES TRAFIC** | Pics WAN, historique 24h, détection d'anomalies |
| 23 | **FLUX LIVE** | req/min fenêtre glissante 5 min |
| 24 | **ACTIVITÉ 24H** | Volume d'attaques par heure, histogramme |
| 25 | **GPU IA** | RTX — usage CUDA, VRAM, température |
| 26 | **GeoIP TOP** | Top pays attaquants sur 24h |
| 27 | **HISTORIQUE** | Graphes CPU/RAM/réseau sur 24h |

</details>

---

## Stack technique

<div align="center">

| Couche | Technologie | Rôle |
|--------|------------|------|
| Sécurité périmètre | CrowdSec AppSec + IPS | WAF ~150 vPatch CVE + ban IPs nftables |
| IDS | Suricata | 90 000+ signatures réseau |
| Brute Force | fail2ban | SSH/nginx/CVE — 4 hôtes |
| Firewall | UFW | Politique deny par défaut |
| Reverse proxy | nginx | TLS, rate limiting, GeoIP |
| Collecte | Python 3.11 — monitoring_gen.py | Cron 5 min → monitoring.json |
| Frontend | HTML/CSS/JS monolithique | Zéro dépendance externe |
| Virtualisation | Proxmox VE | Hyperviseur VMs |
| IA | JARVIS (Ollama local) | Analyse LLM, ban auto, alertes vocales |

</div>

---

## Intégration JARVIS IA

Le dashboard SOC s'intègre avec [JARVIS](https://github.com/0xCyberLiTech/JARVIS) pour :

- **Analyser** les logs et alertes via LLM local (Ollama — phi4-reasoning)
- **Bannir automatiquement** les IPs si le seuil d'attaque est dépassé (via CrowdSec SSH)
- **Redémarrer** les services critiques détectés DOWN
- **Alerter vocalement** si le threat score atteint ÉLEVÉ ou CRITIQUE
- **Journaliser** chaque action SOC avec horodatage dans l'onglet SOC

---

## Sécurité — ce qui n'est pas dans ce dépôt

```
✔  Aucune IP réelle — VOTRE_IP dans tous les exemples
✔  Aucun token, clé SSH ou mot de passe
✔  Aucun fichier JSON de monitoring (données live)
✔  Aucune donnée personnelle ou réseau privé
✔  Scripts fournis à titre d'exemple — adapter à votre infrastructure
```

---

<div align="center">

<br/>

[![JARVIS IA](https://img.shields.io/badge/Projet%20lié-JARVIS%20IA-9B59B6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0xCyberLiTech/JARVIS)
&nbsp;
[![Profil GitHub](https://img.shields.io/badge/Auteur-0xCyberLiTech-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/0xCyberLiTech)

<br/><br/>

<sub>Projet homelab en production — <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Cybersécurité défensive & IA locale</sub>

</div>
