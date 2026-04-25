<div align="center">

# ⛓️ Chaîne de défense

*Flux attaque → détection → ban · Kill Chain · corrélations cross-source*

![Kill Chain](https://img.shields.io/badge/Kill Chain-5 stades-FF4444?style=flat-square) ![Réponse](https://img.shields.io/badge/Réponse-automatique-00FF88?style=flat-square) ![XDR](https://img.shields.io/badge/XDR-corrélation-00D9FF?style=flat-square)

[← 04 — Dashboard](04-DASHBOARD-SOC.md) &nbsp;·&nbsp; [⬡ SOC 0xCyberLiTech](README.md) &nbsp;·&nbsp; [06 — ThreatScore →](06-THREATSCORE.md)

</div>

---

## Vue d'ensemble

```
ATTAQUE ENTRANTE
      │
      ▼
nginx (access.log + error.log)
      │
      ├──→ Fail2ban parse les logs
      │          │
      │          └──→ crowdsec-sync : cscli decisions add --ip <IP> --reason "fail2ban-<jail>" --duration 24h
      │
      ├──→ CrowdSec AppSec WAF (inline) ──→ BLOCK si match vpatch/CRS
      │
      └──→ Suricata IDS (AF_PACKET)
                 │
                 └──→ eve.json → collection crowdsecurity/suricata
                                      │
                                      └──→ CrowdSec LAPI
                                                 │
                                                 └──→ nftables bouncer
                                                       (ban immédiat)

CrowdSec LAPI (source unique vérité bans depuis 2026-04-12)
      │
      ├──→ CAPI (partage communauté mondiale)
      ├──→ nftables sets (3 sets : CAPI + cscli + local)
      └──→ Dashboard SOC (monitoring.json → active_decisions)

rsyslog /var/log/central/
      │
      └──→ monitoring_gen.py → corrélations cross-hôtes
                 │
                 └──→ JARVIS soc.py → analyse → ban auto si critique
```

---

## CrowdSec — Source unique de vérité des bans

Depuis la refactorisation du 2026-04-12, **CrowdSec est l'unique autorité de ban**.

| Avant (legacy) | Après (actuel) |
|----------------|----------------|
| Fail2ban gérait ses propres chaînes nftables | Fail2ban → crowdsec-sync uniquement |
| CrowdSec gérait ses sets nftables | CrowdSec LAPI gère tout |
| Double bans possibles | Source unique, pas de doublons |

---

## Fail2ban — Rôle détecteur uniquement

### Jails configurées

```ini
# /etc/fail2ban/jail.local

[sshd]
enabled  = true
port     = <SSH-PORT>
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400
action   = crowdsec-sync[name=sshd]

[nginx-cve]
enabled  = true
filter   = nginx-cve
logpath  = /var/log/nginx/access.log
maxretry = 1
bantime  = 86400
action   = crowdsec-sync[name=nginx-cve]

[nginx-botsearch]
enabled  = true
filter   = nginx-http-auth
logpath  = /var/log/nginx/access.log
maxretry = 2
bantime  = 86400
action   = crowdsec-sync[name=nginx-botsearch]
```

### Action crowdsec-sync
```bash
# /etc/fail2ban/action.d/crowdsec-sync.conf
actionban   = cscli decisions add --ip <ip> --reason "fail2ban-%(name)s" --duration 24h
actionunban = cscli decisions delete --ip <ip>
```

---

## Unban atomique

Pour débannir une IP proprement (CrowdSec + Fail2ban) :

```bash
# 1. Supprimer la décision CrowdSec
cscli decisions delete --ip <IP>

# 2. Débannir dans chaque jail Fail2ban
fail2ban-client unbanip sshd <IP>
fail2ban-client unbanip nginx-cve <IP>
fail2ban-client unbanip nginx-botsearch <IP>
```

---

## Corrélations cross-hôtes (rsyslog)

`monitoring_gen.py` lit les logs de tous les hôtes et détecte :

| Pattern | Détection | Action |
|---------|-----------|--------|
| Même IP dans logs nginx + fail2ban site-01 + site-02 | `cross_host_correlation` | Badge ⊙XHC kill chain |
| Connexions SSH suspectes depuis IP bannies | Corrélation CrowdSec + sshd | Score +15 |
| Trafic sortant inhabituel (C2 potentiel) | rsyslog routeur <ROUTER> | Score +15 · JARVIS alerte |
| Scans multi-cibles (>5 hôtes touchés) | rsyslog correlation | Score +5 · JARVIS alerte |

---

## Kill Chain MITRE ATT&CK

Classification automatique des IPs par phase d'attaque (fenêtre 15 min) :

| Phase | MITRE | Critères | Couleur |
|-------|-------|----------|---------|
| RECON | T1595 | Pas de pattern défini — surveillance | Violet |
| SCAN | T1046 | Requêtes anormales, 404/403 excessifs, botsearch | Orange |
| EXPLOIT | T1190 | CVE détectée, AppSec bloqué, Suricata alerte | Jaune |
| BRUTE | T1110 | Tentatives SSH, auth failures répétées | Rouge |
| NEUTRALISÉ | DEF | IP bannie CrowdSec active | Vert |

---

## Nomenclature des bans JARVIS

| Raison ban | Déclencheur |
|------------|------------|
| `jarvis-autoban-exploit-cve` | CVE détectée non bannie |
| `jarvis-autoban-exploit-h` | Honeypot EXPLOIT touché |
| `jarvis-autoban-scan-h` | Honeypot SCAN touché |
| `jarvis-autoban-brute-h` | Honeypot BRUTE touché |
| `jarvis-suricata-sev1` | Alerte Suricata sév.1 < 1h |
| `jarvis-suricata-scan` | Scan réseau détecté Suricata |
| `jarvis-rsyslog-c2` | Trafic C2 sortant détecté |
| `jarvis-rsyslog-recon` | Recon multi-cibles rsyslog |

---

*Document : 05-CHAINE-DEFENSE.md · Projet SOC 0xCyberLiTech · 2026-04-25*
---

<div align="center">

[← 04 — Dashboard](04-DASHBOARD-SOC.md) &nbsp;·&nbsp; [⬡ README](README.md) &nbsp;·&nbsp; [06 — ThreatScore →](06-THREATSCORE.md)

*0xCyberLiTech — SOC Homelab · 2026*

</div>
