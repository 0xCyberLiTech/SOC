<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EUFW+APPARMOR_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Configuration UFW & AppArmor — pare-feu stateful · bouncer nftables · confinement.</h2>

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
    <a href="../README.md">
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

Ce document couvre les règles UFW et nftables (pare-feu) ainsi que les profils AppArmor (confinement processus) sur srv-ngix, site-01 et site-02.

- 🔥 UFW — règles entrantes (SSH, HTTP, HTTPS, rsyslog) · règles sortantes limitées
- 🛡️ Bouncer nftables CrowdSec — sets IP dynamiques kernel-space
- 🔒 AppArmor nginx — profil enforce, accès restreint aux répertoires web
- 🔒 AppArmor apache2 — profils site-01 et site-02, isolation par vhost

---

<h2 align="center">Rôle dans la chaîne défensive</h2>

UFW et AppArmor forment la **couche périmétrique** du SOC.

```
[1] UFW       — filtre réseau : deny all par défaut, whitelist explicite
[5] AppArmor  — confinement processus : nginx et suricata limités à leurs ressources légitimes
```

UFW opère **avant** que les paquets atteignent nginx — CrowdSec bouncer (nftables) s'intercale entre UFW et nginx pour bloquer les IPs bannies.

---

<h2 align="center">UFW — Politique et règles entrantes</h2>

```bash
# Politique par défaut
ufw default deny incoming
ufw default deny outgoing
ufw default disabled routed

# HTTP / HTTPS — public
ufw allow 80/tcp  comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# SSH — LAN uniquement (port non standard)
ufw allow from <LAN-SUBNET>    to any port <SSH-PORT> proto tcp comment 'SSH from LAN'
ufw allow from <ROUTER-SUBNET> to any port <SSH-PORT> proto tcp comment 'SSH from LAN2'

# Dashboard monitoring :8080 — LAN uniquement
ufw allow from <LAN-SUBNET>    to <SRV-NGIX-IP> port 8080 proto tcp comment 'Monitoring LAN'
ufw allow from <ROUTER-SUBNET> to any           port 8080 proto tcp comment 'Monitoring LAN2'

# rsyslog réception — LAN uniquement
ufw allow from <LAN-SUBNET>    to any port 514 proto tcp comment 'rsyslog-central-tcp'
ufw allow from <LAN-SUBNET>    to any port 514 proto udp comment 'rsyslog-central-udp'
ufw allow from <ROUTER-SUBNET> to any port 514 proto udp comment 'rsyslog-router-udp'

# Activer UFW
ufw --force enable
```

---

<h2 align="center">UFW — Règles sortantes</h2>

```bash
# DNS
ufw allow out 53 comment 'DNS'

# Mises à jour système + règles Suricata + CAPI CrowdSec
ufw allow out 80/tcp  comment 'Updates HTTP'
ufw allow out 443/tcp comment 'HTTPS out'

# NTP
ufw allow out 123/udp comment 'NTP'

# Alertes mail
ufw allow out 587/tcp comment 'SMTP alertes'

# Proxy vers backends Apache
ufw allow out to <CLT-IP>  port 80 comment 'Backend Apache site-01'
ufw allow out to <PA85-IP> port 80 comment 'Backend Apache site-02'

# SSH vers hôtes surveillés
ufw allow out to <CLT-IP>  port <SSH-PORT> proto tcp comment 'SSH monitoring site-01'
ufw allow out to <PA85-IP> port <SSH-PORT> proto tcp comment 'SSH monitoring site-02'
```

---

<h2 align="center">nftables CrowdSec bouncer</h2>

Le bouncer nftables gère **3 sets** mis à jour toutes les 10 secondes :

| Set nftables | Source | Contenu |
|---|---|---|
| `crowdsec_blacklists` | CAPI cloud | IPs bannies par la communauté mondiale CrowdSec |
| `crowdsec_cscli` | `cscli decisions add` | Bans manuels + bans JARVIS automatiques |
| `crowdsec_decisions` | Scénarios locaux | Bans issus des collections installées |

Ces sets sont évalués **avant** les règles UFW — un paquet d'une IP bannie est droppé au niveau nftables sans jamais atteindre nginx.

---

<h2 align="center">AppArmor — Profils nginx et suricata</h2>

AppArmor confine `nginx` et `suricata` en mode **enforce** — toute tentative d'accès hors profil est bloquée et loguée.

```bash
# Vérifier le statut AppArmor
aa-status

# Mettre en mode enforce (si en complain)
aa-enforce /etc/apparmor.d/usr.sbin.nginx
aa-enforce /etc/apparmor.d/usr.bin.suricata

# Recharger les profils après modification
apparmor_parser -r /etc/apparmor.d/usr.sbin.nginx
apparmor_parser -r /etc/apparmor.d/usr.bin.suricata
```

<h3 align="center">Profil nginx — permissions clés</h3>

```
/etc/apparmor.d/usr.sbin.nginx
  ✅ Lecture : /etc/nginx/, /var/www/, /usr/share/GeoIP/, /etc/ssl/
  ✅ Écriture : /var/log/nginx/, /run/nginx.pid, /var/lib/nginx/
  ✅ Réseau  : tcp bind :80 :443 :8080
  ❌ Refusé  : /dev/mem, /proc/*/mem, /etc/shadow, /root/
```

<h3 align="center">Profil suricata — permissions clés</h3>

```
/etc/apparmor.d/usr.bin.suricata
  ✅ Lecture : /etc/suricata/, /var/lib/suricata/rules/, /proc/net/
  ✅ Écriture : /var/log/suricata/ (eve.json, fast.log, stats.log)
  ✅ Réseau  : raw socket (AF_PACKET)
  ❌ Refusé  : /etc/passwd, /home/, /root/, /var/lib/crowdsec/
```

---

<h2 align="center">Commandes de référence</h2>

```bash
# État UFW
ufw status verbose
ufw status numbered

# Supprimer une règle par numéro
ufw delete <NUMERO>

# État AppArmor
aa-status
aa-status | grep -E '(enforce|complain)'

# Logs violations AppArmor
grep 'apparmor' /var/log/syslog | tail -20
journalctl -k --since "1h ago" | grep apparmor

# Logs nftables CrowdSec
nft list set inet crowdsec crowdsec_blacklists | wc -l
nft list ruleset | grep -A5 crowdsec

# Vérifier IPs bloquées nftables
cscli decisions list
```

---

<div align="center">

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
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  <br/><br/>
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projets proposés par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Développés en collaboration avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>
