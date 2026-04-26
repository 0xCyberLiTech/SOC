<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=%3EVALIDATION+DEPLOY_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>✅ 61 points de vérification &nbsp;·&nbsp; Validation post-déploiement &nbsp;·&nbsp; 6 phases</h3>

<br/>

<p>
  <a href="https://0xcyberlitech.com">
    <img src="https://img.shields.io/badge/🌐%20Site-0xcyberlitech.com-00B4D8?style=flat-square" alt="Site" />
  </a>
  &nbsp;
  <a href="https://github.com/0xCyberLiTech/SOC">
    <img src="https://img.shields.io/badge/GitHub-SOC-00B4D8?style=flat-square&logo=github&logoColor=white" alt="SOC" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Points-61-00FF88?style=flat-square" alt="Points" />
  &nbsp;  <img src="https://img.shields.io/badge/Phases-6-00B4D8?style=flat-square" alt="Phases" />
  &nbsp;
</p>

<br/>

<p>
  <a href="RUNBOOK-DEBIAN13.md"><img src="https://img.shields.io/badge/◄-Runbook-555555?style=flat-square" alt="← Runbook" /></a>
  &nbsp;&nbsp;
  <a href="../README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>
  &nbsp;&nbsp;
  <a href="CHECKLIST-OPERATIONNELLE.md"><img src="https://img.shields.io/badge/Checklist+ops-►-555555?style=flat-square" alt="Checklist ops →" /></a>
</p>

</div>

---

Exécuter après le script `deploy-soc.sh` pour valider que tout est opérationnel.

---

## Instructions

- ✅ = Vérifié OK
- ❌ = Problème à corriger
- ⚠️ = À surveiller
- Cocher chaque point **dans l'ordre** — certains dépendent des précédents

---

## BLOC 1 — Système de base

- [ ] **OS** : `cat /etc/debian_version` → 13.x (Trixie)
- [ ] **Kernel** : `uname -r` → 6.12.x ou supérieur
- [ ] **Hostname** : `hostname` → `srv-ngix`
- [ ] **Réseau** : `ip a` → eth0 a l'IP <SRV-NGIX-IP>
- [ ] **Heure système** : `timedatectl` → synchronized: yes + timezone Europe/Paris
- [ ] **SSH** : port <SSH-PORT> uniquement — `ss -tlnp | grep sshd` → port <SSH-PORT>

---

## BLOC 2 — UFW pare-feu

- [ ] **UFW actif** : `ufw status` → Status: active
- [ ] **Default policies** : deny incoming, deny outgoing, disabled routed
- [ ] **Règle HTTP** : 80/tcp ALLOW Anywhere
- [ ] **Règle HTTPS** : 443/tcp ALLOW Anywhere
- [ ] **Règle SSH** : <SSH-PORT>/tcp ALLOW <LAN-SUBNET>
- [ ] **Règle Dashboard** : 8080/tcp ALLOW <LAN-SUBNET>
- [ ] **Règle rsyslog** : 514/tcp+udp ALLOW <LAN-SUBNET>
- [ ] **Accès dashboard** : depuis LAN → `curl http://<SRV-NGIX-IP>:8080/` → HTML reçu

---

## BLOC 3 — nginx

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

## BLOC 4 — CrowdSec

- [ ] **LAPI actif** : `systemctl is-active crowdsec` → active
- [ ] **Bouncer nftables** : `cscli bouncers list` → `cs-nftables-bouncer` inscrit
- [ ] **Collections** : `cscli collections list` → 8 collections actives (nginx, http-cve, sshd...)
- [ ] **AppSec WAF** : `cscli appsec-rules list` → vpatch CVE présents
- [ ] **CAPI connecté** : `cscli capi status` → OK
- [ ] **Sets nftables** : `nft list set inet crowdsec crowdsec_blacklists` → set présent
- [ ] **Test ban** : `cscli decisions add --ip 1.2.3.4 --duration 5m` puis `cscli decisions list` → IP présente, puis `cscli decisions delete --ip 1.2.3.4`

---

## BLOC 5 — Fail2ban

- [ ] **Fail2ban actif** : `systemctl is-active fail2ban` → active
- [ ] **Jail sshd** : `fail2ban-client status sshd` → Jail is up
- [ ] **Jail nginx-cve** : `fail2ban-client status nginx-cve` → Jail is up
- [ ] **Jail nginx-botsearch** : `fail2ban-client status nginx-botsearch` → Jail is up
- [ ] **Action crowdsec-sync** : `cat /etc/fail2ban/action.d/crowdsec-sync.conf` → actionban présent

---

## BLOC 6 — Suricata

- [ ] **Suricata actif** : `systemctl is-active suricata` → active
- [ ] **Mode AF_PACKET** : `ps aux | grep suricata` → `--af-packet` présent
- [ ] **Règles chargées** : `grep "rules loaded" /var/log/suricata/suricata.log` → ~106k règles
- [ ] **eve.json** : `ls -la /var/log/suricata/eve.json` → fichier récent (< 5 min)
- [ ] **Ring buffer** : `grep "ring" /var/log/suricata/suricata.log` → 100k packets
- [ ] **Alertes live** : `tail -f /var/log/suricata/eve.json | grep event_type` → events en direct

---

## BLOC 7 — AppArmor

- [ ] **AppArmor actif** : `aa-status | head -5` → apparmor module is loaded
- [ ] **nginx en enforce** : `aa-status | grep nginx` → `/usr/sbin/nginx` en enforce
- [ ] **suricata en enforce** : `aa-status | grep suricata` → `/usr/bin/suricata` en enforce
- [ ] **Nombre profils** : `aa-status | grep enforce` → ≥ 9 profils

---

## BLOC 8 — Scripts Python / Dashboard

- [ ] **monitoring_gen.py** : `python3 /opt/site-01/monitoring_gen.py --dry-run` → OK, pas d'erreur
- [ ] **Cron actif** : `crontab -l` → `*/5 * * * * /opt/site-01/monitoring.sh`
- [ ] **monitoring.json généré** : `ls -la /var/www/monitoring/monitoring.json` → < 5 min
- [ ] **monitoring.json valide** : `python3 -c "import json; json.load(open('/var/www/monitoring/monitoring.json'))"` → OK
- [ ] **Dashboard accessible** : `curl http://<SRV-NGIX-IP>:8080/` → HTML complet
- [ ] **ThreatScore calculé** : `python3 -c "import json; d=json.load(open('/var/www/monitoring/monitoring.json')); print(d.get('threat_score','ABSENT'))"` → entier 0-100

---

## BLOC 9 — rsyslog

- [ ] **rsyslog actif** : `systemctl is-active rsyslog` → active
- [ ] **Port 514 ouvert** : `ss -ulnp | grep 514` + `ss -tlnp | grep 514` → présent
- [ ] **Dossier central** : `ls /var/log/central/` → site-01/ site-02/ pve/ <ROUTER>/ srv-ngix/
- [ ] **Logs site-01 reçus** : `ls -la /var/log/central/site-01/` → fichier du jour présent
- [ ] **Logs site-02 reçus** : `ls -la /var/log/central/site-02/` → fichier du jour présent

---

## BLOC 10 — AIDE intégrité

- [ ] **AIDE installé** : `aide --version` → version affichée
- [ ] **Base de données** : `ls -la /var/lib/aide/aide.db.gz` → présent
- [ ] **Cron nightly** : `crontab -l | grep aide` → 0 3 * * * /opt/site-01/aide-check.sh
- [ ] **Dernier rapport** : `ls -la /var/log/aide/aide.log` → présent, < 24h

---

## Récapitulatif

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

*Document : CHECKLIST-DEPLOY.md · Projet SOC 0xCyberLiTech · 2026-04-25*
---

<div align="center">

<br/>

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

<br/>

<sub>🔒 Projet <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> &nbsp;·&nbsp; Co-développé avec <a href="https://claude.ai">Claude AI</a> · Anthropic 🔒</sub>

</div>

<div align="center">

<p>
  <a href="RUNBOOK-DEBIAN13.md"><img src="https://img.shields.io/badge/◄-Runbook-555555?style=flat-square" alt="← Runbook" /></a>&nbsp;&nbsp;<a href="../README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>&nbsp;&nbsp;<a href="CHECKLIST-OPERATIONNELLE.md"><img src="https://img.shields.io/badge/Checklist+ops-►-555555?style=flat-square" alt="Checklist ops →" /></a>
</p>

</div>
