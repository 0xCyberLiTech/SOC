# 03 — Sécurité — Les 8 couches de défense

## Principe : Défense en profondeur

Chaque couche opère **indépendamment**. Si une couche est contournée, les suivantes continuent à opérer. L'attaquant doit franchir 8 obstacles distincts.

```
INTERNET
   │
   ▼  [1] UFW + nftables CrowdSec ←── IPs bannies nftables (sets CAPI + cscli + local)
   │
   ▼  [2] CrowdSec LAPI + Fail2ban ←── Décisions ban 24h, sync F2B→CS
   │
   ▼  [3] AppSec WAF CrowdSec ←── 207 vpatch CVE + OWASP CRS inline nginx
   │
   ▼  [4] Suricata IDS ←── 106 789 règles ET Pro + Emerging Threats
   │
   ▼  [5] AppArmor ←── nginx + suricata confinés (deny /dev/mem, /proc/*/mem...)
   │
   ▼  [6] nginx ←── CSP stricte, HSTS 2ans, X-Frame DENY, headers-more
   │
   ▼  [7] SOC Dashboard ←── ThreatScore 24 briques, Kill Chain, IP Deep, XDR
   │
   ▼  [8] JARVIS IA ←── Ban auto, restart services, analyse LLM, TTS
```

---

## [1] UFW + nftables bouncer

### UFW (pare-feu Linux)
- **Default** : `deny incoming` · `deny outgoing` · `disabled routed`
- SSH port <SSH-PORT> : LAN uniquement (<LAN-SUBNET> + <ROUTER-SUBNET>)
- Dashboard :8080 : LAN uniquement
- rsyslog :514 : LAN uniquement
- 80/443 : public

### nftables bouncer CrowdSec
Trois sets nftables gérés automatiquement :
- `crowdsec_blacklists` — IPs bannies via CAPI (communauté mondiale)
- `crowdsec_cscli` — IPs bannies manuellement ou par JARVIS
- `crowdsec_decisions` — IPs bannies par règles locales

---

## [2] CrowdSec LAPI + Fail2ban

### CrowdSec — 8 collections actives

| Collection | Rôle |
|-----------|------|
| `crowdsecurity/nginx` | Scans, requêtes malveillantes nginx |
| `crowdsecurity/http-cve` | Exploitation CVE HTTP connues |
| `crowdsecurity/http-dos` | Détection DoS/DDoS |
| `crowdsecurity/linux` | Connexions SSH suspectes |
| `crowdsecurity/sshd` | Brute force SSH |
| `crowdsecurity/suricata` | Alertes Suricata → décisions CrowdSec |
| `crowdsecurity/whitelist-good-actors` | Bots légitimes (Googlebot...) |
| AppSec WAF | 207 vpatch CVE + OWASP CRS (module inline) |

### Fail2ban — 3 jails (rôle : détecteur → alimente CrowdSec)
Depuis 2026-04-12, Fail2ban ne gère plus les bans nftables directement.
Il parse les logs et transmet à CrowdSec via `crowdsec-sync`.

| Jail | Seuil | Durée | Source |
|------|-------|-------|--------|
| `sshd` | 3 tentatives | 24h | /var/log/auth.log |
| `nginx-cve` | 1 hit | 24h | /var/log/nginx/access.log |
| `nginx-botsearch` | 2 hits | 24h | /var/log/nginx/access.log |

---

## [3] AppSec WAF CrowdSec

- **207 vpatch CVE** actifs (correctifs virtuels pour vulnérabilités connues)
- **OWASP Core Rule Set** — protection SQLi, XSS, LFI, RFI, traversal
- Intégré inline dans nginx (module CrowdSec AppSec)
- Bloque avant que la requête atteigne le backend

---

## [4] Suricata IDS

- **Mode** : IDS (détection + log, pas de blocage inline)
- **Règles** : 106 789 (Emerging Threats Pro + ET Open)
- **Interface** : AF_PACKET eth0 (capture tout le trafic)
- **Ring buffer** : 100k paquets (0 truncations)
- **Workers** : 6 threads W#01→W#06
- **Sortie** : `eve.json` → lu par monitoring_gen.py
- **Intégration** : collection `crowdsecurity/suricata` → décisions CrowdSec

Alertes classées : sév.1 (critique), sév.2 (élevée), sév.3 (info)

---

## [5] AppArmor — confinement processus

9 profils en mode **enforce** (actif + bloquant) :

| Profil | Restrictions notables |
|--------|----------------------|
| `/usr/sbin/nginx` | deny `/dev/mem`, `/proc/*/mem`, accès SSH keys, D-Bus, cron |
| `/usr/bin/suricata` | deny accès fichiers système sensibles |
| `tcpdump` | lecture réseau uniquement |
| `nvidia_modprobe` | restreint aux ops GPU |

Si nginx ou Suricata tente d'accéder à des ressources interdites → blocage + log.

---

## [6] nginx — Headers sécurité

Tous présents sur HTTPS (vérifiés) :

| Header | Valeur |
|--------|--------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | geolocation, microphone, camera, payment, usb, bluetooth = `()` |
| `Content-Security-Policy` | `default-src 'self'` · `script-src 'self'` · `frame-ancestors 'none'` |
| `Server` | *absent* (supprimé via `more_clear_headers Server`) |

---

## [7] SOC Dashboard

- **ThreatScore** : calcul temps réel 0-100 (24 briques, voir doc 06)
- **Kill Chain MITRE ATT&CK** : RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ
- **IP Deep** : GeoIP + WHOIS + CrowdSec + Fail2ban + rsyslog (fenêtre 7j)
- **XDR** : corrélation cross-sources (fail2ban, ufw, CrowdSec, Suricata, rsyslog)
- **AIDE** : intégrité fichiers système (vérification nightly 03h00)

---

## [8] JARVIS IA — Réponse autonome

Boucle 60s permanente (voir doc 08) :
- Ban auto IPs critiques → CrowdSec
- Restart services tombés
- Alertes TTS vocales (Antoine/Piper)
- Analyse LLM gap défensif

---

## Matrice couverture par vecteur d'attaque

| Vecteur | Couches actives |
|---------|----------------|
| Brute force SSH | Fail2ban (sshd) → CrowdSec → UFW |
| Scanner réseau | Fail2ban (nginx-botsearch) + CrowdSec nginx + Suricata scan |
| Exploitation CVE HTTP | AppSec WAF (207 vpatch) + F2B nginx-cve + CrowdSec http-cve + Suricata |
| DoS / DDoS | CrowdSec http-dos + Suricata + UFW rate-limit |
| C2 outbound | Suricata ET + nftables + rsyslog correlation (JARVIS) |
| SQL Injection | AppSec OWASP CRS + nginx CSP |
| XSS | AppSec OWASP CRS + nginx CSP |
| LFI / Path traversal | AppSec vpatch CVE + OWASP CRS |
| Escalade privilèges process | AppArmor enforce (deny /dev/mem, /proc/*/mem) |
| IP malveillante connue | CrowdSec CAPI (communauté mondiale) + nftables |

---

*Document : 03-SECURITE-BRIQUES.md · Projet SOC 0xCyberLiTech · 2026-04-25*
