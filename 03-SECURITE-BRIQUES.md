<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EDEFENSE_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>8 couches de défense — matrice de couverture par vecteur d'attaque.</h2>

  <p align="center">
    <a href="https://0xcyberlitech.github.io/">
      <img src="https://img.shields.io/badge/Portfolio-0xCyberLiTech-181717?logo=github&style=flat-square" alt="Portfolio" />
    </a>
    <a href="https://github.com/0xCyberLiTech">
      <img src="https://img.shields.io/badge/Profil-GitHub-181717?logo=github&style=flat-square" alt="Profil GitHub" />
    </a>
    <a href="https://github.com/0xCyberLiTech/SOC">
      <img src="https://img.shields.io/badge/Dépôt-SOC-00B4D8?logo=github&style=flat-square" alt="Dépôt SOC" />
    </a>
    <a href="README.md">
      <img src="https://img.shields.io/badge/📄%20README-SOC-00B4D8?style=flat-square" alt="README" />
    </a>
    <a href="https://github.com/0xCyberLiTech?tab=repositories">
      <img src="https://img.shields.io/badge/Dépôts-publics-blue?style=flat-square" alt="Dépôts publics" />
    </a>
  </p>

</div>

<div align="center">
  <img src="https://img.icons8.com/fluency/96/000000/cyber-security.png" alt="CyberSec" width="80"/>
</div>

<div align="center">
  <p>
    <strong>Cybersécurité défensive</strong> <img src="https://img.icons8.com/color/24/000000/lock--v1.png"/> &nbsp;•&nbsp; <strong>Homelab en production</strong> <img src="https://img.icons8.com/color/24/000000/linux.png"/> &nbsp;•&nbsp; <strong>IA locale intégrée</strong> <img src="https://img.icons8.com/color/24/000000/shield-security.png"/>
  </p>
</div>

---

<div align="center">
## À propos & Objectifs.
</div>

Ce document décrit chaque brique de sécurité : son rôle, sa position dans la chaîne, les vecteurs qu'elle couvre. La philosophie est la défense en profondeur — chaque couche opère indépendamment.

- 🛡️ UFW + nftables — pare-feu stateful kernel-space
- 🤖 CrowdSec WAF + bouncer — blocage comportemental + AppSec 150+ règles
- 🔒 Fail2ban — jails par pattern (SSH, nginx-CVE, botsearch)
- 🕵️ Suricata IDS 7 — détection réseau passive, 49k règles Emerging Threats
- 🔐 AppArmor + AIDE HIDS — confinement processus + intégrité fichiers

---

<h2 align="center">Principe : Défense en profondeur</h2>

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

<h2 align="center">[1] UFW + nftables bouncer</h2>

<h3 align="center">UFW (pare-feu Linux)</h3>

- **Default** : `deny incoming` · `deny outgoing` · `disabled routed`
- SSH port <SSH-PORT> : LAN uniquement (<LAN-SUBNET> + <ROUTER-SUBNET>)
- Dashboard :8080 : LAN uniquement
- rsyslog :514 : LAN uniquement
- 80/443 : public

<h3 align="center">nftables bouncer CrowdSec</h3>

Trois sets nftables gérés automatiquement :
- `crowdsec_blacklists` — IPs bannies via CAPI (communauté mondiale)
- `crowdsec_cscli` — IPs bannies manuellement ou par JARVIS
- `crowdsec_decisions` — IPs bannies par règles locales

---

<h2 align="center">[2] CrowdSec LAPI + Fail2ban</h2>

<h3 align="center">CrowdSec — 8 collections actives</h3>

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

<h3 align="center">Fail2ban — 3 jails (rôle : détecteur → alimente CrowdSec)</h3>

Depuis 2026-04-12, Fail2ban ne gère plus les bans nftables directement.
Il parse les logs et transmet à CrowdSec via `crowdsec-sync`.

| Jail | Seuil | Durée | Source |
|------|-------|-------|--------|
| `sshd` | 3 tentatives | 24h | /var/log/auth.log |
| `nginx-cve` | 1 hit | 24h | /var/log/nginx/access.log |
| `nginx-botsearch` | 2 hits | 24h | /var/log/nginx/access.log |

---

<h2 align="center">[3] AppSec WAF CrowdSec</h2>

- **207 vpatch CVE** actifs (correctifs virtuels pour vulnérabilités connues)
- **OWASP Core Rule Set** — protection SQLi, XSS, LFI, RFI, traversal
- Intégré inline dans nginx (module CrowdSec AppSec)
- Bloque avant que la requête atteigne le backend

---

<h2 align="center">[4] Suricata IDS</h2>

- **Mode** : IDS (détection + log, pas de blocage inline)
- **Règles** : 106 789 (Emerging Threats Pro + ET Open)
- **Interface** : AF_PACKET eth0 (capture tout le trafic)
- **Ring buffer** : 100k paquets (0 truncations)
- **Workers** : 6 threads W#01→W#06
- **Sortie** : `eve.json` → lu par monitoring_gen.py
- **Intégration** : collection `crowdsecurity/suricata` → décisions CrowdSec

Alertes classées : sév.1 (critique), sév.2 (élevée), sév.3 (info)

---

<h2 align="center">[5] AppArmor — confinement processus</h2>

9 profils en mode **enforce** (actif + bloquant) :

| Profil | Restrictions notables |
|--------|----------------------|
| `/usr/sbin/nginx` | deny `/dev/mem`, `/proc/*/mem`, accès SSH keys, D-Bus, cron |
| `/usr/bin/suricata` | deny accès fichiers système sensibles |
| `tcpdump` | lecture réseau uniquement |
| `nvidia_modprobe` | restreint aux ops GPU |

Si nginx ou Suricata tente d'accéder à des ressources interdites → blocage + log.

---

<h2 align="center">[6] nginx — Headers sécurité</h2>

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

<h2 align="center">[7] SOC Dashboard</h2>

- **ThreatScore** : calcul temps réel 0-100 (24 briques, voir doc 06)
- **Kill Chain MITRE ATT&CK** : RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ
- **IP Deep** : GeoIP + WHOIS + CrowdSec + Fail2ban + rsyslog (fenêtre 7j)
- **XDR** : corrélation cross-sources (fail2ban, ufw, CrowdSec, Suricata, rsyslog)
- **AIDE** : intégrité fichiers système (vérification nightly 03h00)

---

<h2 align="center">[8] JARVIS IA — Réponse autonome</h2>

Boucle 60s permanente (voir doc 08) :
- Ban auto IPs critiques → CrowdSec
- Restart services tombés
- Alertes TTS vocales (Antoine/Piper)
- Analyse LLM gap défensif

---

<h2 align="center">Matrice couverture par vecteur d'attaque</h2>

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

<h2 align="center">Configurations de référence</h2>

Fichiers de configuration anonymisés pour chaque couche défensive :

| Couche | Configuration |
|--------|--------------|
| nginx + SSL + headers | [CONFIGS/01-nginx.md](CONFIGS/01-nginx.md) |
| CrowdSec LAPI + AppSec WAF | [CONFIGS/02-crowdsec.md](CONFIGS/02-crowdsec.md) |
| Fail2ban + crowdsec-sync | [CONFIGS/03-fail2ban.md](CONFIGS/03-fail2ban.md) |
| UFW + nftables + AppArmor | [CONFIGS/06-ufw-apparmor.md](CONFIGS/06-ufw-apparmor.md) |

---

<div align="center">

## Stack technique

<table>
<tr>
<td align="center"><b>🖥️ Infrastructure & Sécurité</b></td>
<td align="center"><b>💻 Développement & Web</b></td>
<td align="center"><b>🤖 Intelligence Artificielle</b></td>
</tr>
<tr>
<td align="center">
  <a href="https://www.kernel.org/"><img src="https://skillicons.dev/icons?i=linux" width="48" title="Linux" /></a>
  <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="48" title="Debian" /></a>
  <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="48" title="Bash" /></a>
  <br/>
  <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="48" title="Nginx" /></a>
  <a href="https://www.docker.com"><img src="https://skillicons.dev/icons?i=docker" width="48" title="Docker" /></a>
  <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="48" title="Git" /></a>
</td>
<td align="center">
  <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="48" title="Python" /></a>
  <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="48" title="Flask" /></a>
  <a href="https://developer.mozilla.org/docs/Web/HTML"><img src="https://skillicons.dev/icons?i=html" width="48" title="HTML5" /></a>
  <br/>
  <a href="https://developer.mozilla.org/docs/Web/CSS"><img src="https://skillicons.dev/icons?i=css" width="48" title="CSS3" /></a>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="48" title="JavaScript" /></a>
  <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="48" title="VS Code" /></a>
</td>
<td align="center">
  <a href="https://pytorch.org"><img src="https://skillicons.dev/icons?i=pytorch" width="48" title="PyTorch" /></a>
  <a href="https://www.tensorflow.org"><img src="https://skillicons.dev/icons?i=tensorflow" width="48" title="TensorFlow" /></a>
  <a href="https://www.raspberrypi.com"><img src="https://skillicons.dev/icons?i=raspberrypi" width="48" title="Raspberry Pi" /></a>
  <br/><br/>
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  &nbsp;
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projets proposés par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Développés en collaboration avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>
