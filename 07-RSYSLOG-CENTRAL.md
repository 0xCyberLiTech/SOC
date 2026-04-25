# 07 — rsyslog central — Collecte et corrélation logs

## Architecture

`srv-ngix` est le **récepteur rsyslog central** pour 5 hôtes du homelab.

```
<VM1> (<CLT-IP>)   ──→ rsyslog TCP/UDP :514
<VM2> (<PA85-IP>)  ──→ rsyslog TCP/UDP :514
pve (<PROXMOX-IP>)   ──→ rsyslog TCP/UDP :514
GT-BE98 (<ROUTER-IP>)──→ rsyslog UDP :514
srv-ngix (local)     ──→ rsyslog fichiers locaux
                           │
                     /var/log/central/
                     ├── <VM1>/
                     ├── <VM2>/
                     ├── pve/
                     ├── GT-BE98/
                     └── srv-ngix/
```

---

## Configuration rsyslog récepteur (srv-ngix)

```
# /etc/rsyslog.conf — section réception

module(load="imtcp")
module(load="imudp")

input(type="imtcp" port="514")
input(type="imudp" port="514")

# Routage par hôte source vers dossier dédié
if ($fromhost-ip == '<CLT-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/vm1/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
if ($fromhost-ip == '<PA85-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/vm2/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
if ($fromhost-ip == '<PROXMOX-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/pve/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
if ($fromhost-ip == '<ROUTER-IP>') then {
    action(type="omfile" dirCreateMode="0755"
           file="/var/log/central/GT-BE98/%$YEAR%-%$MONTH%-%$DAY%.log")
    stop
}
```

---

## Configuration rsyslog émetteur (<VM1> / <VM2>)

```
# /etc/rsyslog.conf — section émission (<VM1> et <VM2>)

# Envoyer tous les logs vers srv-ngix
*.* @@<SRV-NGIX-IP>:514    # @@ = TCP (fiable)
```

---

## Rétention des logs

- **Rotation** : `logrotate` — 7 jours pour les logs `/var/log/central/`
- **Format fichier** : `AAAA-MM-JJ.log` (un fichier par jour par hôte)
- **Taille max** : non limitée (rotation temporelle uniquement)

```
# /etc/logrotate.d/rsyslog-central
/var/log/central/*/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    postrotate
        systemctl reload rsyslog
    endscript
}
```

---

## Sources de logs par hôte

| Hôte | Logs envoyés |
|------|-------------|
| **<VM1>** | auth.log, apache2/access.log, apache2/error.log, fail2ban.log, syslog |
| **<VM2>** | auth.log, apache2/access.log, apache2/error.log, fail2ban.log, syslog |
| **pve** | syslog, auth.log, pve-firewall.log, task.log (backups VM) |
| **GT-BE98** | syslog routeur (connexions WAN, DHCP, firewall, trafic sortant) |
| **srv-ngix** | auth.log, nginx/access.log, nginx/error.log, fail2ban.log, crowdsec.log |

---

## Corrélations détectées par monitoring_gen.py

`monitoring_gen.py` lit tous les logs centralisés et détecte les patterns suivants :

### Corrélation cross-hôte (XHC)

Une IP est vue dans les logs **nginx (srv-ngix)** ET **apache (<VM1>)** ET **apache (<VM2>)** dans une fenêtre de 15 minutes.

→ Badge `⊙XHC` dans le Kill Chain dashboard  
→ Score ThreatScore +10

### Connexion SSH depuis IP bannie

Une IP présente dans les `active_decisions` CrowdSec tente une connexion SSH sur `auth.log`.

→ Score ThreatScore +8

### Trafic C2 sortant (GT-BE98)

Le routeur GT-BE98 logue une connexion sortante vers une IP connue (Threat Intel) ou un port C2 caractéristique (IRC 6667, Tor, .onion via DNS).

→ ThreatScore +15  
→ JARVIS alerte TTS + ban automatique IP destination

### Scan multi-cibles

La même IP source touche **plus de 5 hôtes distincts** dans la fenêtre 15 min.

→ ThreatScore +5  
→ JARVIS alerte

---

## Vérification du fonctionnement

```bash
# Sur srv-ngix — vérifier réception logs <VM1>
ls -la /var/log/central/vm1/
tail -20 /var/log/central/vm1/$(date +%Y-%m-%d).log

# Vérifier le port rsyslog ouvert
ss -tlnup | grep 514

# Tester envoi depuis <VM1>
ssh -i ~/.ssh/id_vm1 -p <SSH-PORT> root@<CLT-IP> \
  "logger -n <SRV-NGIX-IP> -P 514 -T 'TEST rsyslog <VM1>→ngix'"

# Vérifier réception immédiate
grep 'TEST rsyslog' /var/log/central/vm1/$(date +%Y-%m-%d).log
```

---

## UFW — Règle autorisant rsyslog entrant

```bash
# Sur srv-ngix — déjà configuré
ufw allow from <LAN-SUBNET> to any port 514 proto tcp
ufw allow from <LAN-SUBNET> to any port 514 proto udp
ufw allow from <ROUTER-SUBNET> to any port 514 proto udp  # GT-BE98
```

---

*Document : 07-RSYSLOG-CENTRAL.md · Projet SOC 0xCyberLiTech · 2026-04-25*
