# Changelog

Évolutions notables de la vitrine **SOC** (0xCyberLiTech).

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) · versionnage [SemVer](https://semver.org/lang/fr/).

## [1.1.0] — 2026-06-19

### Vitrine
- **Globe 3D** — la cartographie des menaces gagne un cockpit **globe 3D plein écran** : arcs d'attaque animés convergeant vers le SOC, ondulations par stade Kill Chain, HUD de métriques temps réel, relief / jour-nuit / atmosphère. Capture sanitisée ajoutée à la galerie.
- **Cohérence vitrine ↔ prod** — métriques alignées (MITRE 13/14, modèle `qwen3:8b`, Sigma 8/8 enforce).

[1.1.0]: https://github.com/0xCyberLiTech/SOC/releases/tag/v1.1.0

## [1.0.0] — 2026-06-15

### Vitrine
- **Galerie de la ligne de défense** — captures réelles du dashboard SOC en production (sanitisées) : chaîne de défense complète, Kill Chain + IP par maillon, neutralisation multi-moteurs (CrowdSec · Sigma · JARVIS · fail2ban), moteur Sigma, ThreatScore, CrowdSec/fail2ban, Suricata IDS, AIDE HIDS, surveillance SSH, cartographie mondiale des menaces.
- **10 documents techniques** : présentation, architecture, briques de sécurité, dashboard, chaîne de défense, ThreatScore, rsyslog centralisé, JARVIS defense, roadmap, détections Sigma.
- **Detection-as-code** : règles Sigma versionnées · cycle de vie `alert → dry-run → enforce` · couverture **MITRE ATT&CK 13/14** · test-driven.

### Sécurité (doctrine vitrine)
- Captures **sanitisées** : IP internes redactées, hostnames anonymisés, port SSH masqué. IP attaquants externes conservées (convention vitrine).
- Scripts opérationnels et sources du dashboard **privés** — la vitrine décrit l'approche, ne branche aucune donnée live.

[1.0.0]: https://github.com/0xCyberLiTech/SOC/releases/tag/v1.0.0
