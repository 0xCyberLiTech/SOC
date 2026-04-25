# SOC 0xCyberLiTech — Documentation Projet

> Dashboard de sécurité homelab · Debian 13 · nginx · CrowdSec · Suricata · JARVIS IA

---

## Index

| # | Document | Description |
|---|----------|-------------|
| 01 | [PRESENTATION.md](01-PRESENTATION.md) | Présentation du projet, objectifs, points forts |
| 02 | [ARCHITECTURE.md](02-ARCHITECTURE.md) | Infrastructure, stack technique, schéma réseau |
| 03 | [SECURITE-BRIQUES.md](03-SECURITE-BRIQUES.md) | Les 8 couches défense, matrice couverture par vecteur |
| 04 | [DASHBOARD-SOC.md](04-DASHBOARD-SOC.md) | Dashboard : modules JS, tuiles, polling, CSS |
| 05 | [CHAINE-DEFENSE.md](05-CHAINE-DEFENSE.md) | Flux attaque→détection→ban, intégrations |
| 06 | [THREATSCORE.md](06-THREATSCORE.md) | Score menace : 24 briques, formule, anti-doublons |
| 07 | [RSYSLOG-CENTRAL.md](07-RSYSLOG-CENTRAL.md) | Logs centralisés : 5 hôtes, filtres, rétention |
| 08 | [JARVIS-DEFENSE.md](08-JARVIS-DEFENSE.md) | Défense proactive IA : boucle 60s, 12 déclencheurs |
| 09 | [ROADMAP.md](09-ROADMAP.md) | Axes d'évolution, décisions d'architecture |
| — | [DEPLOY/GUIDE-DEPLOIEMENT-RAPIDE.md](DEPLOY/GUIDE-DEPLOIEMENT-RAPIDE.md) | **🚀 Guide plug-and-play** : transférer + lancer en 8 étapes |
| — | [DEPLOY/RUNBOOK-DEBIAN13.md](DEPLOY/RUNBOOK-DEBIAN13.md) | Runbook complet déploiement sur VM Debian 13 vierge |
| — | [DEPLOY/CHECKLIST-DEPLOY.md](DEPLOY/CHECKLIST-DEPLOY.md) | Checklist post-déploiement (61 points) |
| — | [DEPLOY/CHECKLIST-OPERATIONNELLE.md](DEPLOY/CHECKLIST-OPERATIONNELLE.md) | Checklist exploitation quotidienne |
| — | [DEPLOY/create-archive.sh](DEPLOY/create-archive.sh) | **Script export config complète** (13 blocs — réseau+nginx+crowdsec+...) |
| — | [DEPLOY/restore-soc.sh](DEPLOY/restore-soc.sh) | **Script restauration depuis archive** (--dry-run avec ✓ par bloc, --step, rollback auto) |
| — | [Archives/AUDIT-ARCHIVE-CHECKLIST.md](Archives/AUDIT-ARCHIVE-CHECKLIST.md) | Checklist audit archive plug-and-play (3 phases) |
| — | [Archives/CONTENU-ARCHIVE.md](Archives/CONTENU-ARCHIVE.md) | Inventaire archive v4 (16 blocs vérifiés) |

---

## Résumé exécutif

**0xCyberLiTech SOC** est un système de supervision sécurité homelab autonome protégeant deux sites web (`site-01` et `site-02`) via une VM nginx (`srv-ngix`) faisant office de reverse proxy, WAF et collecteur de logs centraux.

### Chiffres clés
- **Score audit** : 10/10 — dette technique zéro
- **Couches défense** : 8 (UFW → nftables → CrowdSec → Fail2ban → AppSec WAF → Suricata IDS → AppArmor → SOC/JARVIS)
- **Règles IDS actives** : 106 789 (Suricata)
- **Sources log centralisées** : 5 hôtes (site-01, site-02, pve, routeur GT-BE98, srv-ngix)
- **Score menace** : 24 briques, calcul temps réel, seuils FAIBLE/MOYEN/ÉLEVÉ/CRITIQUE
- **Réponse autonome** : JARVIS IA locale — ban automatique, TTS alertes, analyse LLM

### Stack technique
```
Debian 13 · nginx 1.26 · Python 3.11 · CrowdSec · Fail2ban · Suricata
AppArmor · rsyslog · Let's Encrypt · GeoIP2 (MaxMind)
Dashboard SPA vanilla JS (24 modules) · JARVIS (Ollama phi4-reasoning)
```

---

## Infrastructure réseau

| Hôte | IP | Rôle |
|------|----|------|
| srv-ngix | <SRV-NGIX-IP> | Reverse proxy · nginx · SOC dashboard · CrowdSec · Suricata |
| site-01 | <CLT-IP> | Backend Apache · site CLT |
| site-02 | <PA85-IP> | Backend Apache · site PA85 |
| Proxmox VE | <PROXMOX-IP> | Hyperviseur (héberge les 3 VMs) |
| Routeur GT-BE98 | <ROUTER-IP> | Passerelle WAN · source logs rsyslog |
| JARVIS | <LAN-IP> | IA locale Windows · localhost:5000 |

---

*Dernière mise à jour : 2026-04-25*
