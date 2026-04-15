# Positionnement — Analyse comparative

## Pourquoi ce projet existe

Ce projet est né d'un constat simple : les outils SOC du marché sont soit trop lourds pour un homelab (Wazuh, Elastic SIEM, Graylog), soit trop limités (Grafana, pfSense dashboards). Aucun ne combine une stack défensive réelle, une corrélation multi-sources unifiée et une réponse autonome IA dans un environnement minimal.

Ce SOC homelab répond à ce besoin — architecture légère, 0 dépendance cloud, déployé sur une VM Debian avec 2 vCPU / 4 Go RAM.

---

## Comparaison avec les outils existants

| Outil | Similitude | Différence clé |
|-------|-----------|----------------|
| **Grafana** | Dashboards temps réel, alertes | Multi-source générique — pas de logique de ban ni de réponse intégrée |
| **Wazuh** | SIEM, corrélation, alertes | Agent-based, infra lourde (Elasticsearch requis), pas d'IA locale |
| **Graylog** | Logs centralisés, alertes | Orienté logs uniquement — pas de Kill Chain ni ThreatScore custom |
| **Security Onion** | IDS/IPS, Suricata, dashboards | Distribution complète mais rigide — pas adaptable composant par composant |
| **CrowdSec Console** | Vue CrowdSec centralisée | Limité à CrowdSec — ce projet intègre 7 couches indépendantes |
| **pfSense / OPNsense** | Dashboard firewall/IDS | Pas d'IA, pas de corrélation multi-sources, pas de ThreatScore |
| **Splunk / Elastic Security** | SIEM complet | Licences commerciales, infra dédiée, pas d'IA locale intégrée |

---

## Ce que ce projet fait différemment

### Kill Chain calculée localement

La Kill Chain est construite à partir des logs nginx propres au serveur — pas de dépendance à un service cloud, pas d'agent externe. Les stades RECON → SCAN → BRUTE → EXPLOIT sont détectés et corrélés en temps réel.

### ThreatScore unifié sur 20 briques

Un score global 0–100 agrège 20 sources de données (GeoIP, CrowdSec, Suricata, fail2ban, UFW, AppSec WAF, routeur, mises à jour...) avec 5 règles anti-doublons pour éviter de compter deux fois le même événement entre CrowdSec et fail2ban.

```
Exemple anti-doublon :
fail2ban → crowdsec-sync → cscli decisions add
→ Le ban est dans CrowdSec. fail2ban.cur_banned exclu du ThreatScore.
```

### Réponse autonome JARVIS

Un LLM local (Ollama) surveille le dashboard en boucle 60s et agit automatiquement :
- Ban IP via CrowdSec si exploit détecté non bloqué
- Restart service si service DOWN
- Alerte vocale TTS si niveau ÉLEVÉ/CRITIQUE
- Rapport LLM de l'état de sécurité à la demande

Aucun outil du marché n'intègre un LLM local avec réponse autonome à ce niveau de personnalisation.

### 7 couches défensives corrélées

```
Internet
  │
  ▼ UFW + nftables         — ports non autorisés rejetés
  ▼ GeoIP Block            — pays à risque bloqués (nginx)
  ▼ AppSec WAF CrowdSec    — ~207 vpatch CVE (SQLi/XSS/LFI/RCE)
  ▼ CrowdSec IDS/IPS       — détection comportementale + ban partagé
  ▼ Suricata IDS            — DPI ~90k règles — sév.1 → ban CS 168h
  ▼ fail2ban               — 4 hôtes — logs nginx/SSH/Apache
  ▼ nginx                  — reverse proxy + bouncer CrowdSec natif
  │
  ▼ AppArmor               — workers nginx/Apache confinés (enforce)
     ModSecurity           — OWASP CRS sur site-01 + site-02 (BLOCAGE)
     JARVIS IA             — boucle autonome 60s
```

---

## Ce que ce projet ne fait pas

| Limitation | Contexte |
|-----------|---------|
| Pas scalable multi-site | Conçu pour un homelab mono-site — une seule instance |
| Pas de ticketing formel multi-opérateur | Conçu pour un opérateur unique — pas de workflow Jira/TheHive |
| Pas de conformité certifiée | SOC2, ISO 27001... hors scope homelab |
| Pas d'agent distribué | Collecte centralisée via SSH depuis le serveur principal |

---

## Coût infrastructure

| Composant | Coût |
|-----------|------|
| Licences logicielles | **0€** — tout open source |
| Services cloud | **0€** — 0 dépendance externe |
| Hardware | VM existante — 2 vCPU / 4 Go RAM / 50 Go |
| LLM IA | GPU local (optionnel) — Ollama gratuit |

Wazuh avec stack ELK nécessite 8–16 Go RAM minimum. Splunk est payant au-delà de 500 Mo/jour.

---

## Positionnement résumé

```
                    COMPLEXITÉ INFRASTRUCTURE
                    Faible ◄─────────────────────► Élevée

Réponse     Élevée  ┌──────────────┐
autonome            │  CE PROJET   │              Wazuh / Splunk
                    │  (homelab)   │              SIEM enterprise
            Faible  └──────────────┘
                    pfSense        Grafana        Security Onion
                    dashboards     alertes        distribution
```

**Niche unique** : réponse autonome élevée + infrastructure minimale + IA locale intégrée + 0€.

Ce projet n'a pas d'équivalent publié dans l'espace homelab. La combinaison stack défensive réelle + LLM local + corrélation unifiée + audit code rigoureux sur infrastructure Proxmox personnelle est, à ce jour, introuvable sous cette forme ailleurs.
