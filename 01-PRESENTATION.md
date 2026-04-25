<div align="center">

# ⬡ Présentation du projet SOC

*Objectifs · points forts · chiffres clés · contexte homelab*

![Status](https://img.shields.io/badge/Status-Production-brightgreen?style=flat-square) ![Audit](https://img.shields.io/badge/Audit-10%2F10-00FF88?style=flat-square) ![Couches](https://img.shields.io/badge/Couches-8 défense-0D1117?style=flat-square)

[← README](README.md) &nbsp;·&nbsp; [⬡ SOC 0xCyberLiTech](README.md) &nbsp;·&nbsp; [02 — Architecture →](02-ARCHITECTURE.md)

</div>

---

## Qu'est-ce que ce projet ?

**0xCyberLiTech SOC** est un système de supervision sécurité (Security Operations Center) homelab entièrement conçu et maintenu de zéro. Il surveille en temps réel deux sites web hébergés sur des VMs Proxmox et réagit automatiquement aux menaces sans intervention humaine.

Le projet démontre qu'il est possible de construire un SOC professionnel avec des outils open source, sans cloud, sans abonnement, sans dépendance externe — sur du matériel domestique.

---

## Objectifs

| Objectif | Description |
|----------|-------------|
| **Visibilité** | Voir en temps réel ce qui se passe sur l'infrastructure |
| **Protection** | Bloquer automatiquement les attaques (scans, CVE, brute force) |
| **Résilience** | Maintenir les services en ligne malgré les attaques |
| **Traçabilité** | Centraliser les logs de 5 hôtes, détecter les corrélations |
| **Autonomie** | Réagir sans intervention humaine via JARVIS IA |

---

## Points forts

### Défense en profondeur — 8 couches indépendantes
De l'UFW/nftables jusqu'à l'IA locale, chaque couche opère indépendamment. La compromission d'une couche ne désactive pas les autres.

### Zéro dépendance externe
- Pas de cloud SOC (pas de Splunk, Datadog, ELK cloud)
- Pas de NPM dans le dashboard (vanilla JS pur)
- GeoIP en local (MaxMind MMDB)
- IA locale (Ollama, pas d'API OpenAI)

### Score menace temps réel — 24 briques
Un algorithme original calcule un score 0-100 toutes les 60 secondes en agrégeant 24 sources de données. Anti-doublons explicites évitent la surpondération.

### Kill Chain MITRE ATT&CK
Les IPs actives sont classées automatiquement en phases : RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ.

### JARVIS — réponse autonome
Une boucle IA tourne en permanence (60s), analyse les données SOC et :
- Bannit les IPs critiques via CrowdSec
- Redémarre les services tombés
- Alerte vocalement en cas de niveau CRITIQUE
- Analyse les gaps défensifs avec un LLM local (phi4-reasoning)

### Audit qualité 10/10
85 passes d'audit manuel couvrant : XSS, NDT (Non-Déterminisme Technique), hardcodes, dette CSS, robustesse. Score parfait maintenu.

---

## Comparaison avec les solutions commerciales

| Critère | 0xCyberLiTech SOC | Wazuh | Graylog | pfSense |
|---------|-------------------|-------|---------|---------|
| Coût | **0 €** | Freemium | Freemium | Gratuit |
| Cloud requis | **Non** | Optionnel | Optionnel | Non |
| IA autonome | **Oui (local)** | Non | Non | Non |
| Kill Chain | **Oui (MITRE)** | Partiel | Non | Non |
| Score menace | **Oui (24 briques)** | Partiel | Non | Non |
| Dashboard custom | **Oui (SPA)** | Limité | Oui | Limité |
| WAF intégré | **Oui (AppSec)** | Non | Non | Oui |

---

## Ce que ce projet n'est PAS

- Un produit commercial
- Un IPS inline (pas de coupure réseau active — risque réseau refusé intentionnellement)
- Dépendant d'un fournisseur (pas de lock-in)
- Conçu pour un datacenter (homelab, échelle 2-5 serveurs)

---

## Technologies utilisées

### Couche réseau / système
- **Debian 13 (Trixie)** — OS des VMs
- **Proxmox VE** — Hyperviseur
- **UFW + nftables** — Firewall
- **AppArmor** — Confinement processus (9 profils enforce)

### Couche détection / blocage
- **CrowdSec** — LAPI collaborative + 8 collections + AppSec WAF (207 vpatch)
- **Fail2ban** — Détecteur logs → alimente CrowdSec (3 jails)
- **Suricata** — IDS réseau (106 789 règles ET Pro + Emerging Threats)

### Couche collecte / corrélation
- **rsyslog** — Récepteur central TCP+UDP :514 (5 hôtes)
- **nginx** — Reverse proxy + logs avec GeoIP country + format enrichi
- **GeoIP2 MaxMind** — Géolocalisation IP temps réel

### Couche visualisation
- **Dashboard SPA vanilla JS** — 24 modules, 0 dépendance NPM
- **Python 3.11** — monitoring_gen.py (générateur JSON), soc.py (API JARVIS)
- **monitoring.json** — Agrégation toutes sources, polling 60s

### Couche IA / réponse
- **JARVIS** — Flask + Ollama (phi4-reasoning) — boucle autonome
- **edge-tts / Piper** — Synthèse vocale alertes
- **faster-whisper** — Reconnaissance vocale commandes

---

*Document : 01-PRESENTATION.md · Projet SOC 0xCyberLiTech · 2026-04-25*
---

<div align="center">

[← README](README.md) &nbsp;·&nbsp; [⬡ README](README.md) &nbsp;·&nbsp; [02 — Architecture →](02-ARCHITECTURE.md)

*0xCyberLiTech — SOC Homelab · 2026*

</div>
