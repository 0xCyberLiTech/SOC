<div align="center">

# ⬡ SOC 0xCyberLiTech

**Système de supervision sécurité homelab — autonome, temps réel, IA intégrée**

[![Debian](https://img.shields.io/badge/Debian-13-A81D33?style=flat-square&logo=debian&logoColor=white)](https://www.debian.org/)
[![nginx](https://img.shields.io/badge/nginx-1.26-009639?style=flat-square&logo=nginx&logoColor=white)](https://nginx.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org/)
[![JavaScript](https://img.shields.io/badge/JS-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/fr/docs/Web/JavaScript)
[![CrowdSec](https://img.shields.io/badge/CrowdSec-WAF%20%2B%20IPS-00A3E0?style=flat-square)](https://crowdsec.net/)
[![Suricata](https://img.shields.io/badge/Suricata-IDS%2096k%20règles-EF3B2D?style=flat-square)](https://suricata.io/)
[![Audit](https://img.shields.io/badge/Audit-10%2F10-00FF88?style=flat-square)]()
[![Status](https://img.shields.io/badge/Status-Production-brightgreen?style=flat-square)]()

> Dashboard de sécurité homelab full-stack · 8 couches défense · Kill Chain temps réel · IA défensive JARVIS

</div>

---

## Cartographie des menaces — Live

<div align="center">

![GeoIP World](assets/geoip-world.jpg)

*GeoIP — Cartographie mondiale des menaces 24h · arcs d'attaque animés · top pays · 169 IPs actives · 25 pays sources*

</div>

---

## Kill Chain — Progression des attaques

<div align="center">

![Kill Chain](assets/kill-chain.png)

*Tracking en temps réel : RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ · fenêtre 15 min · score menace par IP*

</div>

---

## Vue tactique Europe & Investigation IP

<div align="center">

| SOC Map — Vue Europe | Investigation IP |
|:--------------------:|:----------------:|
| ![SOC Map Europe](assets/socmap-europe.png) | ![IP Investigation](assets/ip-investigation.png) |
| *Score ÉLEVÉ 53 · 169 hostiles · 78% neutralisation · arcs kill chain* | *Modal forensique : Kill Chain · CrowdSec · Fail2ban · WHOIS · verdict* |

</div>

---

## GeoIP — Statistiques & Corrélations

<div align="center">

![GeoIP Stats](assets/geoip-stats.png)

*Kill Chain 15 min · Top pays attaquants · Scénarios CrowdSec · Heatmap activité · Top 60 IPs 24h*

</div>

---

## Moteur de corrélation & Chaîne de défense

<div align="center">

| XDR — Corrélation cross-source | Chaîne de défense — Pipeline sécurité |
|:------------------------------:|:-------------------------------------:|
| ![XDR Engine](assets/xdr-engine.png) | ![Defense Chain](assets/defense-chain.png) |
| *COLLECT · NORMALIZE · CORRELATE · RESPOND · Score 200* | *UFW → GeoIP → WAF → CrowdSec → Suricata → Fail2ban → nginx · 8 couches* |

</div>

---

## Heatmap & Monitoring système

<div align="center">

| Heatmap Attaques 24h | Windows / GPU Metrics |
|:--------------------:|:---------------------:|
| ![Heatmap](assets/heatmap.png) | ![Windows Metrics](assets/windows-metrics.png) |
| *13.2k req · 358 bloqués · 2.7% · pics horaires détectés* | *CPU · RAM · GPU RTX · disques — supervision machine hôte* |

</div>

---

## JARVIS — IA défensive intégrée

<div align="center">

![JARVIS AI](assets/jarvis-ai.png)

*JARVIS (Ollama phi4-reasoning) · réponse proactive automatique · alertes TTS · analyse LLM événements critiques · ban auto*

</div>

---

## Points forts

| | Capacité | Détail |
|--|----------|--------|
| 🛡️ | **8 couches défense** | UFW · nftables · GeoIP Block · CrowdSec WAF · Suricata IDS · Fail2ban · AppArmor · AID HIDS |
| 🧠 | **IA défensive** | JARVIS (Ollama phi4-reasoning) — ban auto · alertes TTS · analyse LLM |
| 📡 | **Logs centralisés** | 5 hôtes via rsyslog — corrélation cross-host temps réel |
| 🎯 | **Kill Chain** | Tracking RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ par IP |
| 📊 | **Score menace** | 24 briques · calcul temps réel · seuils FAIBLE / MOYEN / ÉLEVÉ / CRITIQUE |
| 🔍 | **XDR** | Corrélation Fail2ban + ModSec + UFW + Suricata + rsyslog + routeur |
| 🗺️ | **GeoIP** | Cartographie Leaflet + MaxMind · arcs d'attaque animés · top pays |
| 🔄 | **Plug-and-play** | Archive 13 blocs · restauration complète sur VM vierge en < 30 min |
| ✅ | **Audit 10/10** | Zéro dette technique · 85 passes · 120 NDT corrigés |

---

## Stack technique

```
OS          Debian 13 (Bookworm)
Proxy       nginx 1.26 — reverse proxy · TLS · vhosts
Sécurité    CrowdSec (WAF AppSec ~207 vpatch CVE) · Suricata IDS (96k règles)
            Fail2ban · AppArmor · UFW + nftables · AID HIDS
Logs        rsyslog centralisé (5 hôtes) · GoAccess
Dashboard   SPA vanilla JS — 24 modules · 35 tuiles · zéro dépendance NPM
Backend     Python 3.11 — monitoring_gen.py (génération JSON live)
IA          JARVIS — Ollama phi4-reasoning · Flask · edge-tts
GeoIP       MaxMind GeoLite2 · Leaflet.js
Infra       Proxmox VE — 3 VMs (srv-ngix · site-01 · site-02)
```

---

## Architecture

```
INTERNET
   │
   ▼
┌─────────────────────────────────────────────────────┐
│                    srv-ngix                          │
│                                                      │
│  UFW + nftables ──→ GeoIP Block ──→ CrowdSec WAF   │
│       ──→ Suricata IDS ──→ Fail2ban ──→ nginx       │
│       ──→ AppArmor · AID HIDS                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Dashboard SOC (port 8080)             │   │
│  │  24 modules JS · polling 60s · Kill Chain    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  rsyslog ◄── site-01 · site-02 · pve · <ROUTER>    │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   site-01                site-02
   Apache · AppArmor      Apache · AppArmor
   ModSecurity WAF        ModSecurity WAF
```

---

## Documentation

| # | Document | Description |
|---|----------|-------------|
| 01 | [PRESENTATION.md](01-PRESENTATION.md) | Présentation, objectifs, points forts |
| 02 | [ARCHITECTURE.md](02-ARCHITECTURE.md) | Infrastructure, stack, schéma réseau |
| 03 | [SECURITE-BRIQUES.md](03-SECURITE-BRIQUES.md) | 8 couches défense · matrice couverture par vecteur |
| 04 | [DASHBOARD-SOC.md](04-DASHBOARD-SOC.md) | Dashboard : modules JS · tuiles · polling · CSS |
| 05 | [CHAINE-DEFENSE.md](05-CHAINE-DEFENSE.md) | Flux attaque → détection → ban · intégrations |
| 06 | [THREATSCORE.md](06-THREATSCORE.md) | Score menace : 24 briques · formule · anti-doublons |
| 07 | [RSYSLOG-CENTRAL.md](07-RSYSLOG-CENTRAL.md) | Logs centralisés : 5 hôtes · filtres · rétention |
| 08 | [JARVIS-DEFENSE.md](08-JARVIS-DEFENSE.md) | Défense proactive IA : boucle 60s · 12 déclencheurs |
| 09 | [ROADMAP.md](09-ROADMAP.md) | Axes d'évolution · décisions d'architecture |

---

## Déploiement

| Script / Guide | Rôle |
|----------------|------|
| [GUIDE-DEPLOIEMENT-RAPIDE.md](DEPLOY/GUIDE-DEPLOIEMENT-RAPIDE.md) | **🚀 8 étapes plug-and-play** — VM vierge → SOC opérationnel |
| [RUNBOOK-DEBIAN13.md](DEPLOY/RUNBOOK-DEBIAN13.md) | Runbook complet installation sur Debian 13 |
| [create-archive.sh](DEPLOY/create-archive.sh) | Export config complète — 13 blocs |
| [restore-soc.sh](DEPLOY/restore-soc.sh) | Restauration — `--dry-run` · `--step` · rollback auto |
| [CHECKLIST-DEPLOY.md](DEPLOY/CHECKLIST-DEPLOY.md) | 61 points de vérification post-déploiement |
| [CHECKLIST-OPERATIONNELLE.md](DEPLOY/CHECKLIST-OPERATIONNELLE.md) | Checklist exploitation quotidienne |

```bash
# Restauration sur VM Debian 13 vierge
scp soc-config-*.tar.gz root@<SRV-NGIX-IP>:/tmp/
ssh root@<SRV-NGIX-IP> "tar -xzf /tmp/soc-config-*.tar.gz -C /tmp/soc-restore/"
bash /tmp/soc-restore/restore-soc.sh --dry-run   # simulation complète
bash /tmp/soc-restore/restore-soc.sh             # restauration
```

---

<div align="center">

*0xCyberLiTech — Homelab SOC · 2026*

</div>
