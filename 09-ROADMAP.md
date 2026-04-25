<div align="center">

# 🗺️ Roadmap — Axes d'évolution

*Décisions d'architecture · fonctionnalités planifiées · historique*

![État](https://img.shields.io/badge/État-Production-brightgreen?style=flat-square) ![Dette](https://img.shields.io/badge/Dette-Zéro-00FF88?style=flat-square)

[← 08 — JARVIS](08-JARVIS-DEFENSE.md) &nbsp;·&nbsp; [⬡ SOC 0xCyberLiTech](README.md) &nbsp;·&nbsp; [README →](README.md)

</div>

---

## État actuel (2026-04-25)

| Composant | Version | Statut |
|-----------|---------|--------|
| Dashboard SOC | v3.97.155 | ✅ Production |
| monitoring_gen.py | stable | ✅ Production |
| JARVIS | v3.2 | ✅ Production |
| deploy-soc.sh | v1.0 | ✅ Livré |
| Documentation PROJET-SOC | v1.0 | ✅ Complet |
| Archive config (create-archive.sh) | v1.0 | ✅ Livré |

---

## Axes d'évolution court terme

### 1. Alertes enrichies par email

Actuellement : rapport quotidien `soc-daily-report.py` envoyé à 8h00.

Évolution : alertes email immédiates si ThreatScore ≥ 75, avec résumé de l'incident (IP, phase Kill Chain, signaux déclencheurs).

### 2. Rétention ThreatScore 30 jours

Actuellement : score calculé à l'instant T, pas de persistance longue durée.

Évolution : stocker l'historique dans un fichier JSON rotatif → graphe tendance 30j dans le dashboard.

### 3. Honeypot HTTP réel

Actuellement : simulation via les logs nginx (404/403 patterns).

Évolution : déployer un vrai honeypot HTTP (cowrie / opencanary) sur un port secondaire — détection plus précise des scanners.

### 4. Feed AbuseIPDB automatique

Actuellement : consultation manuelle AbuseIPDB depuis la tuile IP Deep.

Évolution : `monitoring_gen.py` consulte AbuseIPDB API pour les top 10 IPs actives → score de réputation intégré dans le ThreatScore.

### 5. Détection anomalies DNS (<ROUTER>)

Actuellement : logs <ROUTER> analysés pour C2 sortant.

Évolution : détecter les requêtes DNS vers domaines nouveaux/suspects (NXD excessif, DGA patterns).

---

## Axes d'évolution moyen terme

### 6. Backup automatique configuration

Script `create-archive.sh` livré — à planifier en cron hebdomadaire.

```bash
# Cron srv-ngix — à ajouter
0 2 * * 0  /opt/site-01/scripts/create-archive.sh --auto
```

### 7. Dashboard mobile (responsive)

Actuellement : optimisé écran 1920×1080.

Évolution : media queries pour consultation sur tablette/téléphone (alertes nomades).

### 8. Intégration MISP (Threat Intelligence)

Partage d'indicateurs avec la communauté via un serveur MISP local.

### 9. Second nœud SOC (Pi5)

Déployer le SOC_SECOURS (déjà développé en v3.89.91) sur un Raspberry Pi 5 comme mirror cold-standby.

---

## Ce qui ne sera PAS ajouté

| Fonctionnalité | Raison du refus |
|----------------|-----------------|
| Mode IPS inline (coupure réseau) | Risque réseau inacceptable en prod homelab |
| Cloud SOC (Splunk, Datadog) | Principe zéro dépendance externe |
| Base de données SQL (MySQL/PostgreSQL) | Complexité inutile — JSON files suffisent |
| Agent sur chaque VM | SSH polling suffit, overhead justifié |
| npm dans le dashboard | Principe vanilla JS conservé |

---

## Idées en réflexion

- **Corrélation temporelle** : détecter les campagnes d'attaque distribuées dans le temps (même sous-réseau /24, délais aléatoires pour éviter F2B)
- **Score IP historique** : mémoriser les IPs vues précédemment → "IP déjà vue il y a 14 jours"
- **Rapport hebdomadaire PDF** : export du dashboard en rapport PDF via headless Chrome
- **Intégration Proxmox alerts** : recevoir les alertes backup/VM dans le SOC dashboard

---

*Document : 09-ROADMAP.md · Projet SOC 0xCyberLiTech · 2026-04-25*
---

<div align="center">

[← 08 — JARVIS](08-JARVIS-DEFENSE.md) &nbsp;·&nbsp; [⬡ README](README.md) &nbsp;·&nbsp; [README →](README.md)

*0xCyberLiTech — SOC Homelab · 2026*

</div>
