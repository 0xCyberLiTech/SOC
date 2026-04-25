# CHECKLIST DÉPLOIEMENT — 36 points de vérification post-installation

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

- [ ] **monitoring_gen.py** : `python3 /opt/clt/monitoring_gen.py --dry-run` → OK, pas d'erreur
- [ ] **Cron actif** : `crontab -l` → `*/5 * * * * /opt/clt/monitoring.sh`
- [ ] **monitoring.json généré** : `ls -la /var/www/monitoring/monitoring.json` → < 5 min
- [ ] **monitoring.json valide** : `python3 -c "import json; json.load(open('/var/www/monitoring/monitoring.json'))"` → OK
- [ ] **Dashboard accessible** : `curl http://<SRV-NGIX-IP>:8080/` → HTML complet
- [ ] **ThreatScore calculé** : `python3 -c "import json; d=json.load(open('/var/www/monitoring/monitoring.json')); print(d.get('threat_score','ABSENT'))"` → entier 0-100

---

## BLOC 9 — rsyslog

- [ ] **rsyslog actif** : `systemctl is-active rsyslog` → active
- [ ] **Port 514 ouvert** : `ss -ulnp | grep 514` + `ss -tlnp | grep 514` → présent
- [ ] **Dossier central** : `ls /var/log/central/` → clt/ pa85/ pve/ GT-BE98/ srv-ngix/
- [ ] **Logs clt reçus** : `ls -la /var/log/central/clt/` → fichier du jour présent
- [ ] **Logs pa85 reçus** : `ls -la /var/log/central/pa85/` → fichier du jour présent

---

## BLOC 10 — AIDE intégrité

- [ ] **AIDE installé** : `aide --version` → version affichée
- [ ] **Base de données** : `ls -la /var/lib/aide/aide.db.gz` → présent
- [ ] **Cron nightly** : `crontab -l | grep aide` → 0 3 * * * /opt/clt/aide-check.sh
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
