<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ECHECKLIST_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Dashboard sécurité homelab · CrowdSec WAF · Suricata IDS · JARVIS IA.</h2>

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

Exécuter après le script `deploy-soc.sh` pour valider que tout est opérationnel.

---

<h2 align="center">Instructions</h2>

- ✅ = Vérifié OK
- ❌ = Problème à corriger
- ⚠️ = À surveiller
- Cocher chaque point **dans l'ordre** — certains dépendent des précédents

---

<h2 align="center">BLOC 1 — Système de base</h2>

- [ ] **OS** : `cat /etc/debian_version` → 13.x (Trixie)
- [ ] **Kernel** : `uname -r` → 6.12.x ou supérieur
- [ ] **Hostname** : `hostname` → `srv-ngix`
- [ ] **Réseau** : `ip a` → eth0 a l'IP <SRV-NGIX-IP>
- [ ] **Heure système** : `timedatectl` → synchronized: yes + timezone Europe/Paris
- [ ] **SSH** : port <SSH-PORT> uniquement — `ss -tlnp | grep sshd` → port <SSH-PORT>

---

<h2 align="center">BLOC 2 — UFW pare-feu</h2>

- [ ] **UFW actif** : `ufw status` → Status: active
- [ ] **Default policies** : deny incoming, deny outgoing, disabled routed
- [ ] **Règle HTTP** : 80/tcp ALLOW Anywhere
- [ ] **Règle HTTPS** : 443/tcp ALLOW Anywhere
- [ ] **Règle SSH** : <SSH-PORT>/tcp ALLOW <LAN-SUBNET>
- [ ] **Règle Dashboard** : 8080/tcp ALLOW <LAN-SUBNET>
- [ ] **Règle rsyslog** : 514/tcp+udp ALLOW <LAN-SUBNET>
- [ ] **Accès dashboard** : depuis LAN → `curl http://<SRV-NGIX-IP>:8080/` → HTML reçu

---

<h2 align="center">BLOC 3 — nginx</h2>

- [ ] **nginx actif** : `systemctl is-active nginx` → active
- [ ] **nginx version** : `nginx -v` → 1.26.x
- [ ] **Module GeoIP2** : `nginx -V 2>&1 | grep geoip2` → présent
- [ ] **Module headers-more** : `nginx -V 2>&1 | grep headers-more` → présent
- [ ] **Test config** : `nginx -t` → syntax ok
- [ ] **HTTP → HTTPS redirect** : `curl -I http://<SRV-NGIX-IP>/` → 301 Location: https://
- [ ] **Header Server absent** : `curl -sI https://ton-domaine/ | grep -i server` → rien
- [ ] **HSTS** : `curl -sI https://ton-domaine/ | grep Strict` → max-age=63072000
- [ ] **CSP** : `curl -sI https://ton-domaine/ | grep Content-Security` → présent
- [ ] **GeoIP fonctionne** : accès depuis IP externe → log contient code pays

---

<h2 align="center">BLOC 4 — CrowdSec</h2>

- [ ] **LAPI actif** : `systemctl is-active crowdsec` → active
- [ ] **Bouncer nftables** : `cscli bouncers list` → `cs-nftables-bouncer` inscrit
- [ ] **Collections** : `cscli collections list` → 8 collections actives (nginx, http-cve, sshd...)
- [ ] **AppSec WAF** : `cscli appsec-rules list` → vpatch CVE présents
- [ ] **CAPI connecté** : `cscli capi status` → OK
- [ ] **Sets nftables** : `nft list set inet crowdsec crowdsec_blacklists` → set présent
- [ ] **Test ban** : `cscli decisions add --ip 1.2.3.4 --duration 5m` puis `cscli decisions list` → IP présente, puis `cscli decisions delete --ip 1.2.3.4`

---

<h2 align="center">BLOC 5 — Fail2ban</h2>

- [ ] **Fail2ban actif** : `systemctl is-active fail2ban` → active
- [ ] **Jail sshd** : `fail2ban-client status sshd` → Jail is up
- [ ] **Jail nginx-cve** : `fail2ban-client status nginx-cve` → Jail is up
- [ ] **Jail nginx-botsearch** : `fail2ban-client status nginx-botsearch` → Jail is up
- [ ] **Action crowdsec-sync** : `cat /etc/fail2ban/action.d/crowdsec-sync.conf` → actionban présent

---

<h2 align="center">BLOC 6 — Suricata</h2>

- [ ] **Suricata actif** : `systemctl is-active suricata` → active
- [ ] **Mode AF_PACKET** : `ps aux | grep suricata` → `--af-packet` présent
- [ ] **Règles chargées** : `grep "rules loaded" /var/log/suricata/suricata.log` → ~106k règles
- [ ] **eve.json** : `ls -la /var/log/suricata/eve.json` → fichier récent (< 5 min)
- [ ] **Ring buffer** : `grep "ring" /var/log/suricata/suricata.log` → 100k packets
- [ ] **Alertes live** : `tail -f /var/log/suricata/eve.json | grep event_type` → events en direct

---

<h2 align="center">BLOC 7 — AppArmor</h2>

- [ ] **AppArmor actif** : `aa-status | head -5` → apparmor module is loaded
- [ ] **nginx en enforce** : `aa-status | grep nginx` → `/usr/sbin/nginx` en enforce
- [ ] **suricata en enforce** : `aa-status | grep suricata` → `/usr/bin/suricata` en enforce
- [ ] **Nombre profils** : `aa-status | grep enforce` → ≥ 9 profils

---

<h2 align="center">BLOC 8 — Scripts Python / Dashboard</h2>

- [ ] **monitoring_gen.py** : `python3 /opt/site-01/monitoring_gen.py --dry-run` → OK, pas d'erreur
- [ ] **Cron actif** : `crontab -l` → `*/5 * * * * /opt/site-01/monitoring.sh`
- [ ] **monitoring.json généré** : `ls -la /var/www/monitoring/monitoring.json` → < 5 min
- [ ] **monitoring.json valide** : `python3 -c "import json; json.load(open('/var/www/monitoring/monitoring.json'))"` → OK
- [ ] **Dashboard accessible** : `curl http://<SRV-NGIX-IP>:8080/` → HTML complet
- [ ] **ThreatScore calculé** : `python3 -c "import json; d=json.load(open('/var/www/monitoring/monitoring.json')); print(d.get('threat_score','ABSENT'))"` → entier 0-100

---

<h2 align="center">BLOC 9 — rsyslog</h2>

- [ ] **rsyslog actif** : `systemctl is-active rsyslog` → active
- [ ] **Port 514 ouvert** : `ss -ulnp | grep 514` + `ss -tlnp | grep 514` → présent
- [ ] **Dossier central** : `ls /var/log/central/` → site-01/ site-02/ pve/ <ROUTER>/ srv-ngix/
- [ ] **Logs site-01 reçus** : `ls -la /var/log/central/site-01/` → fichier du jour présent
- [ ] **Logs site-02 reçus** : `ls -la /var/log/central/site-02/` → fichier du jour présent

---

<h2 align="center">BLOC 10 — AIDE intégrité</h2>

- [ ] **AIDE installé** : `aide --version` → version affichée
- [ ] **Base de données** : `ls -la /var/lib/aide/aide.db.gz` → présent
- [ ] **Cron nightly** : `crontab -l | grep aide` → 0 3 * * * /opt/site-01/aide-check.sh
- [ ] **Dernier rapport** : `ls -la /var/log/aide/aide.log` → présent, < 24h

---

<h2 align="center">Récapitulatif</h2>

```
BLOC 1 Système       : _/6
BLOC 2 UFW           : _/8
BLOC 3 nginx         : _/10
BLOC 4 CrowdSec      : _/7
BLOC 5 Fail2ban      : _/5
BLOC 6 Suricata      : _/6
BLOC 7 AppArmor      : _/4
BLOC 8 Dashboard     : _/6
BLOC 9 rsyslog       : _/5
BLOC 10 AIDE         : _/4
─────────────────────────
TOTAL                : _/61
```

**Déploiement validé si score = 61/61.**

En cas de point rouge → consulter le RUNBOOK-DEBIAN13.md section correspondante.

---
---

<div align="center">

  <br></br>

  <table>
  <tr>
  <td align="center" width="33%"><b>🖥️ Infrastructure &amp; Sécurité</b></td>
  <td align="center" width="33%"><b>💻 Développement &amp; Web</b></td>
  <td align="center" width="33%"><b>🤖 Intelligence Artificielle</b></td>
  </tr>
  <tr>
  <td align="center">
    <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="40" title="Debian" /></a>&nbsp;
    <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="40" title="Nginx" /></a>&nbsp;
    <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="40" title="Bash" /></a>&nbsp;
    <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="40" title="Git" /></a>
  </td>
  <td align="center">
    <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="40" title="Python" /></a>&nbsp;
    <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="40" title="Flask" /></a>&nbsp;
    <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="40" title="JavaScript" /></a>&nbsp;
    <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="40" title="VS Code" /></a>
  </td>
  <td align="center">
    <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
    <br/><br/>
    <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
  </td>
  </tr>
  </table>

  <br></br>

  <sub>🔒 Projet <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> &nbsp;·&nbsp; Co-développé avec <a href="https://claude.ai">Claude AI</a> · Anthropic 🔒</sub>

  <br></br>

  <a href="../README.md">
    <img src="https://img.shields.io/badge/↑%20Retour%20au%20README-SOC-00B4D8?style=flat-square&logo=github" alt="Retour README" />
  </a>

</div>
