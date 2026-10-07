# Changelog

Évolutions notables de la vitrine **SOC** (0xCyberLiTech).

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · versionnage [SemVer](https://semver.org/lang/fr/).

## [5.5.0] — 2026-10-07

### ⚡ Refonte Majeure — Architecture Extreme HUD v5.5 & Studio Back-Office
- **Cockpit Extreme HUD v5.5** : Réingénierie intégrale du dashboard sans dépendance NPM (< 200 ms), dosimètre Sentinel sub-seconde, caissons étanches en CSS Grid/Flexbox et bargraphes segmentés LED normalisés.
- **Studio Back-Office & Catalogue de Tuiles** : Création d'un Studio complet pilotant 38 tuiles réparties sur 5 pôles et 13 sous-onglets, 10 gabarits étalons (G-1 à G-10), élasticité dynamique millimétrique des étagères (`row1`, `row2`), gestion complète du cycle de vie des tuiles (activation, mise en réserve sans régression, suppression sécurisée) et aperçu temps réel **Quick-Peek**.
- **Synoptique Dynamique d'Attaque (Canvas & Causalité)** : Tableau de bord visuel temps réel de la résultante du moteur Sigma et des honeytraps. Lignes d'attaques dynamiques, tags MITRE ATT&CK et émoticônes adaptatives selon le vecteur hostile, pods cyber interactifs et bus lumineux de corrélation.
- **Géo-Radar Vectoriel 2D** : Planisphère mondial en HTML5 Canvas pur, éliminant tout appel cartographique externe, centroïdes calibrés et arcs balistiques convergents sub-seconde (15 min / 24h).
- **Réacteur d'Inférence IA GPU (JARVIS / Hermès)** : Monitoring panoramique NVIDIA RTX 5080, matrice alvéolaire CUDA & Tensor, inférence LLM locale et synthèse vocale souveraine MCI Antoine HD.
- **Dette Technique Zéro ($\le 400$L)** : 100 % des fichiers JavaScript, Python et Shell scellés sous le plafond strict de 400 lignes (Règle 14.7).
- **Armure Qualité CI/CD** : 19 gardiens déterministes automatisés, bancs d'épreuves hostiles sous Microsoft Edge réel, parité tripartite et barrière anti-fuite hermétique au push.

[5.5.0]: https://github.com/0xCyberLiTech/SOC/releases/tag/v5.5.0

## [1.1.0] — 2026-06-19

## [1.0.0] — 2026-06-15

### Vitrine
- **Galerie de la ligne de défense** — captures réelles du dashboard SOC en production (sanitisées) : chaîne de défense complète, Kill Chain + IP par maillon, neutralisation multi-moteurs (CrowdSec · Sigma · JARVIS · fail2ban), moteur Sigma, ThreatScore, CrowdSec/fail2ban, Suricata IDS, AIDE HIDS, surveillance SSH, cartographie mondiale des menaces.
- **10 documents techniques** : présentation, architecture, briques de sécurité, dashboard, chaîne de défense, ThreatScore, rsyslog centralisé, JARVIS defense, roadmap, détections Sigma.
- **Detection-as-code** : règles Sigma versionnées · cycle de vie `alert → dry-run → enforce` · couverture **MITRE ATT&CK 13/14** · test-driven.

### Sécurité (doctrine vitrine)
- Captures **sanitisées** : IP internes redactées, hostnames anonymisés, port SSH masqué. IP attaquants externes conservées (convention vitrine).
- Scripts opérationnels et sources du dashboard **privés** — la vitrine décrit l'approche, ne branche aucune donnée live.

[1.0.0]: https://github.com/0xCyberLiTech/SOC/releases/tag/v1.0.0
