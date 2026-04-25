<div align="center">

# ⬡ SOC 0xCyberLiTech

**Système de supervision sécurité homelab — autonome, temps réel, IA intégrée**

[![Debian](https://img.shields.io/badge/Debian-13-A81D33?style=flat-square&logo=debian&logoColor=white)](https://www.debian.org/)
[![nginx](https://img.shields.io/badge/nginx-1.26-009639?style=flat-square&logo=nginx&logoColor=white)](https://nginx.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org/)
[![JavaScript](https://img.shields.io/badge/JS-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/fr/docs/Web/JavaScript)
[![CrowdSec](https://img.shields.io/badge/CrowdSec-WAF-00A3E0?style=flat-square)](https://crowdsec.net/)
[![Suricata](https://img.shields.io/badge/Suricata-IDS-EF3B2D?style=flat-square)](https://suricata.io/)
[![Audit](https://img.shields.io/badge/Audit-10%2F10-00FF88?style=flat-square)]()
[![Status](https://img.shields.io/badge/Status-Production-brightgreen?style=flat-square)]()

</div>

---

## Aperçu

<div align="center">

### Kill Chain — Progression des attaques en temps réel
![Kill Chain](assets/screenshot-kill-chain.png)

### GeoIP — Cartographie mondiale des menaces 24h
![GeoIP World](assets/screenshot-geoip-world.png)

### GeoIP — Statistiques & carte des sources d'attaque
![GeoIP Stats](assets/screenshot-geoip-stats.png)

### SOC Map — Vue tactique Europe
![SOC Map Europe](assets/screenshot-socmap-europe.png)

### XDR — Moteur de corrélation cross-source
![XDR Correlation](assets/screenshot-xdr.png)

### Chaîne de défense — Pipeline sécurité en couches
![Defense Chain](assets/screenshot-defense-chain.png)

### Suricata IDS — Analyse réseau AF_PACKET
![Suricata IDS](assets/screenshot-suricata.png)

</div>

---

## Points forts

| | Capacité | Détail |
|--|----------|--------|
| 🛡️ | **8 couches défense** | UFW · nftables · GeoIP Block · CrowdSec WAF · Suricata IDS · Fail2ban · AppArmor · AID HIDS |
| 🧠 | **IA défensive** | JARVIS (Ollama) — ban auto, alertes TTS, analyse LLM sur événements critiques |
| 📡 | **Logs centralisés** | 5 hôtes via rsyslog — corrélation cross-host temps réel |
| 🎯 | **Kill Chain** | Tracking RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ par IP |
| 📊 | **Score menace** | 24 briques, calcul temps réel — seuils FAIBLE / MOYEN / ÉLEVÉ / CRITIQUE |
| 🔍 | **XDR** | Corrélation Fail2ban + ModSec + UFW + Suricata + rsyslog + routeur |
| 🗺️ | **GeoIP** | Cartographie Leaflet + MaxMind · arcs d'attaque animés · top pays |
| 🔄 | **Plug-and-play** | Archive 13 blocs · restauration complète sur VM vierge en < 30 min |
| ✅ | **Audit 10/10** | Zéro dette technique · 85 passes CI · 120 NDT corrigés |

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
│                    srv-ngix (<SRV-NGIX-IP>)          │
│                                                      │
│  UFW + nftables ──→ GeoIP Block ──→ CrowdSec WAF   │
│       ──→ Suricata IDS ──→ Fail2ban ──→ nginx       │
│       ──→ AppArmor ──→ AID HIDS                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         Dashboard SOC (port 8080)             │   │
│  │  24 modules JS · polling 60s · WebSocket     │   │
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
| [RUNBOOK-DEBIAN13.md](DEPLOY/RUNBOOK-DEBIAN13.md) | Runbook complet — installation pas à pas sur Debian 13 |
| [create-archive.sh](DEPLOY/create-archive.sh) | Export config complète — 13 blocs (réseau · nginx · crowdsec · …) |
| [restore-soc.sh](DEPLOY/restore-soc.sh) | Restauration depuis archive — `--dry-run` · `--step` · rollback auto |
| [CHECKLIST-DEPLOY.md](DEPLOY/CHECKLIST-DEPLOY.md) | 61 points de vérification post-déploiement |
| [CHECKLIST-OPERATIONNELLE.md](DEPLOY/CHECKLIST-OPERATIONNELLE.md) | Checklist exploitation quotidienne |

### Restauration rapide

```bash
# Sur VM Debian 13 vierge (même IP, même port SSH)
scp soc-config-*.tar.gz root@<SRV-NGIX-IP>:/tmp/
ssh root@<SRV-NGIX-IP>

tar -xzf /tmp/soc-config-*.tar.gz -C /tmp/soc-restore/
bash /tmp/soc-restore/restore-soc.sh --dry-run   # simulation
bash /tmp/soc-restore/restore-soc.sh             # restauration
```

---

## Archives

| Document | Description |
|----------|-------------|
| [CONTENU-ARCHIVE.md](Archives/CONTENU-ARCHIVE.md) | Inventaire archive v4 — 13 blocs vérifiés |
| [AUDIT-ARCHIVE-CHECKLIST.md](Archives/AUDIT-ARCHIVE-CHECKLIST.md) | Checklist audit 3 phases (avant · vérification · post-restore) |

---

<div align="center">

*0xCyberLiTech — Homelab SOC · mis à jour le 2026-04-25*

</div>
