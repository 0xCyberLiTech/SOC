# Schémas — CHAÎNE DE DÉFENSE & XDR

> **Note :** Les adresses IP mentionnées dans ce dépôt (`VOTRE_IP`, `192.168.x.0/24`) sont des **IP fictives et anonymisées**, utilisées comme placeholders pour illustrer la configuration au démarrage du projet. Aucune adresse IP réelle de production n'est publiée ici.

---

## Schéma 1 — CHAÎNE DE DÉFENSE

Architecture défensive en 7 couches séquentielles + 4 branches terminales.  
Implémentée dans `js/16b-defense-chain.js` — tuile interactive avec popups métriques temps réel.

```
                              INTERNET
                                 │
                       ┌─────────▼──────────┐
                       │   UFW + nftables   │  Ports non autorisés rejetés (stateless drop)
                       └─────────┬──────────┘
                                 │
                       ┌─────────▼──────────┐
                       │    GeoIP Block     │  Pays à risque bloqués — module nginx ngx_http_geoip2
                       └─────────┬──────────┘
                                 │
                       ┌─────────▼──────────┐
                       │   AppSec WAF       │  ~207 vPatch CVE — bouncer CrowdSec
                       │   CrowdSec         │  SQLi / XSS / LFI / RCE / Path traversal
                       └─────────┬──────────┘
                                 │
                       ┌─────────▼──────────┐
                       │  CrowdSec IDS/IPS  │  Détection comportementale
                       │                    │  Ban nftables — décisions partagées
                       └─────────┬──────────┘
                                 │
                       ┌─────────▼──────────┐
                       │   Suricata IDS     │  DPI — ~90 000 règles (8 sources)
                       │                    │  Sév.1 → scénario custom → ban CS 168h
                       └─────────┬──────────┘
                                 │
                       ┌─────────▼──────────┐
                       │     fail2ban       │  4 hôtes — bantime 24h
                       │                    │  nginx-botsearch / sshd / nginx-http-auth
                       └─────────┬──────────┘
                                 │
                       ┌─────────▼──────────┐
                       │       nginx        │  Reverse proxy + TLS
                       │                    │  Bouncer CrowdSec natif
                       └─────────┬──────────┘
                                 │
           ┌─────────────────────┼─────────────────────┬──────────────┐
           │                     │                     │              │
  ┌────────▼────────┐  ┌─────────▼───────┐  ┌─────────▼──────┐  ┌───▼──────────┐
  │ Serveur         │  │ Site-01         │  │ Site-02        │  │ JARVIS IA    │
  │ principal       │  │                 │  │                │  │              │
  │─────────────────│  │─────────────────│  │────────────────│  │──────────────│
  │ AppArmor enforce│  │ AppArmor enforce│  │ AppArmor       │  │ Boucle 60s   │
  │ Workers nginx   │  │ Workers Apache  │  │ enforce        │  │ Auto-ban CS  │
  │ confinés        │  │ confinés        │  │                │  │ Restart svc  │
  │                 │  │ ModSecurity     │  │ ModSecurity    │  │ Alertes TTS  │
  │                 │  │ OWASP CRS       │  │ OWASP CRS      │  │ Analyse LLM  │
  │                 │  │ (BLOCAGE)       │  │ (BLOCAGE)      │  │              │
  └─────────────────┘  └─────────────────┘  └────────────────┘  └──────────────┘
```

### Légende des couches

| # | Couche | Rôle | Portée |
|---|--------|------|--------|
| 1 | UFW + nftables | Filtrage stateless — ports non autorisés | Serveur principal |
| 2 | GeoIP Block | Filtrage géographique nginx | Tout le trafic entrant |
| 3 | AppSec WAF | ~207 vPatch CVE — blocage applicatif | Requêtes HTTP/HTTPS |
| 4 | CrowdSec IDS/IPS | Détection comportementale + partage communauté | Toutes les IPs |
| 5 | Suricata IDS | Deep Packet Inspection ~90k règles | Couche réseau |
| 6 | fail2ban | Analyse logs post-facto — 4 hôtes | nginx / SSH / Apache |
| 7 | nginx | Terminaison TLS — reverse proxy — bouncer | Requêtes HTTP/HTTPS |
| 8 | AppArmor | Confinement processus workers | nginx (srv) / Apache (sites) |
| 9 | ModSecurity | WAF OWASP CRS Layer-7 | Apache site-01 / site-02 |
| 10 | JARVIS IA | Réponse autonome — boucle 60s | Dashboard SOC entier |

---

## Schéma 2 — XDR CORRELATION ENGINE

Pipeline de corrélation multi-sources en 4 étapes.  
Implémenté dans `js/19-xdr.js` — accessible depuis la tuile CHAÎNE DE DÉFENSE.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         XDR CORRELATION ENGINE                                  │
│                                                                                  │
│  ┌─── COLLECT ──────────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  fail2ban  ──────────────────────────────────────────────────────────┐   │   │
│  │  UFW       ──────────────────────────────────────────────────────┐   │   │   │
│  │  AppArmor  ──────────────────────────────────────────────────┐   │   │   │   │
│  │  ModSec site-01 ─────────────────────────────────────────┐   │   │   │   │   │
│  │  ModSec site-02 ─────────────────────────────────────┐   │   │   │   │   │   │
│  │  Suricata IDS   ─────────────────────────────────┐   │   │   │   │   │   │   │
│  │  AUTOBAN (monitoring_gen.py) ─────────────────┐  │   │   │   │   │   │   │   │
│  │  NGX DROP  ───────────────────────────────┐   │  │   │   │   │   │   │   │   │
│  │                                           ▼   ▼  ▼   ▼   ▼   ▼   ▼   ▼   │   │
│  └───────────────────────────────────────── AGRÉGATEUR BRUT ──────────────┘   │
│                                                   │                            │
│  ┌─── NORMALIZE ─────────────────────────────────▼──────────────────────────┐ │
│  │                                                                            │ │
│  │  Log parser        → 26 événements normalisés (type, IP, ts, sévérité)    │ │
│  │  GEO/IP resolver   → 344 IPs géo-bloquées identifiées                    │ │
│  │  IOC/CTI matching  → 32 indicateurs de compromission actifs              │ │
│  │                                                                            │ │
│  └───────────────────────────────────────────────┬────────────────────────────┘ │
│                                                   │                              │
│  ┌─── CORRELATE ─────────────────────────────────▼──────────────────────────┐   │
│  │                                                                            │   │
│  │  Score de corrélation   → risque agrégé par IP (multi-sources)            │   │
│  │  Kill Chain mapping     → RECON / SCAN / BRUTE / EXPLOIT                  │   │
│  │  MITRE ATT&CK mapping   → T1110 (Brute Force), T1595 (Active Scanning)    │   │
│  │  Timeline IP            → tous événements chronologiques par entité       │   │
│  │                                                                            │   │
│  └───────────────────────────────────────────────┬────────────────────────────┘ │
│                                                   │                              │
│  ┌─── EXPOSE ────────────────────────────────────▼──────────────────────────┐   │
│  │                                                                            │   │
│  │  CrowdSec BAN   → IPs bannies via `cscli decisions add`                   │   │
│  │  fail2ban       → bans multi-hôtes synchronisés                           │   │
│  │  JARVIS agent   → analyse LLM + alerte vocale TTS + ban automatique       │   │
│  │  Dashboard SOC  → tuile XDR + Kill Chain + ThreatScore (vue unifiée)      │   │
│  │                                                                            │   │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Sources XDR détaillées

| Source | Événements collectés | Couleur pipeline |
|--------|---------------------|------------------|
| fail2ban | Bans SSH / nginx / Apache — 4 hôtes | Orange |
| UFW | Drops stateless — ports non autorisés | Bleu |
| AppArmor | Denials enforce — workers nginx/Apache | Violet |
| ModSec site-01 | Blocs WAF OWASP CRS — site-01 | Rouge |
| ModSec site-02 | Blocs WAF OWASP CRS — site-02 | Rouge clair |
| Suricata IDS | Alertes réseau sév.1/sév.2/sév.3 | Jaune |
| AUTOBAN | Bans automatiques monitoring_gen.py (R1→R4) | Vert |
| NGX DROP | Drops nginx (444, rate-limit, geoip) | Magenta |

### Pipeline de corrélation — métriques en production

```
COLLECT   → 8 sources actives
NORMALIZE → 26 événements parsés · 344 IPs géo-bloquées · 32 IOC actifs
CORRELATE → score de corrélation · Kill Chain · MITRE T1110/T1595
EXPOSE    → CrowdSec BAN · fail2ban · JARVIS · Dashboard SOC
```

---

## Relation entre les deux modules

```
CHAÎNE DE DÉFENSE (16b-defense-chain.js)
       │
       ├── Nœud CrowdSec ──► XDR reçoit les décisions CS
       ├── Nœud Suricata ──► XDR reçoit les alertes IDS
       ├── Nœud fail2ban ──► XDR reçoit les bans log-based
       ├── Nœud AppArmor ──► XDR reçoit les denials hôte
       └── Bouton XDR    ──► ouvre window._xdrOpenModal(d)
                                       │
                                       ▼
                         XDR CORRELATION ENGINE (19-xdr.js)
                         Logigramme animé + timeline IP
                         COLLECT → NORMALIZE → CORRELATE → EXPOSE
```

La tuile CHAÎNE DE DÉFENSE est la **vue architecturale** (état temps réel de chaque couche).  
Le moteur XDR est la **vue analytique** (corrélation des événements entre les sources).
