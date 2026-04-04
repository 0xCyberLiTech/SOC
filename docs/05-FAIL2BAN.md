# Étape 5 — fail2ban

## Objectif
fail2ban analyse les logs système et bannit automatiquement les IPs qui dépassent  
des seuils d'échecs (SSH, web, etc.) via des règles iptables/nftables.

```
Logs système → fail2ban (règles jail) → ban IP (iptables/nftables)
```

---

## Étape 5.1 — Installation

```bash
apt install -y fail2ban
systemctl enable fail2ban
```

---

## Étape 5.2 — Configuration principale

Ne jamais modifier `jail.conf` directement — utiliser `jail.local`.

Fichier : `/etc/fail2ban/jail.local`

```ini
[DEFAULT]
# Ban de 24h par défaut
bantime  = 86400
# Fenêtre d'analyse : 10 minutes
findtime = 600
# Seuil : 5 tentatives
maxretry = 5

# Backend de logs
backend = systemd

# Ne jamais bannir votre propre IP (à adapter)
ignoreip = 127.0.0.1/8 192.168.x.0/24

# Action par défaut : ban sans notification
banaction = iptables-multiport


# ── Jails ──────────────────────────────────────────────────────

[sshd]
enabled  = true
port     = 2222    # Votre port SSH
logpath  = %(sshd_log)s
maxretry = 3
bantime  = 604800  # 7 jours pour SSH

[nginx-http-auth]
enabled  = true
port     = http,https,8080
logpath  = /var/log/nginx/error.log
maxretry = 5

[nginx-limit-req]
enabled  = true
port     = http,https,8080
logpath  = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled  = true
port     = http,https,8080
logpath  = /var/log/nginx/access.log
maxretry = 2

# Jail personnalisé — CVE scanners
[nginx-cve]
enabled  = true
port     = http,https,8080
filter   = nginx-cve
logpath  = /var/log/nginx/access.log
maxretry = 1
bantime  = 604800  # 7 jours
```

---

## Étape 5.3 — Filtre personnalisé CVE scanners

Fichier : `/etc/fail2ban/filter.d/nginx-cve.conf`

```ini
[Definition]
# Détecte les tentatives d'exploitation de CVEs connues dans les URLs
failregex = ^<HOST> .* "(GET|POST|HEAD) .*(\.env|\.git|wp-login|phpmyadmin|cgi-bin|\.php\?.*=http).*" \d+ .*$
            ^<HOST> .* "(GET|POST) .*(\.\./|%2e%2e|%252e).*" \d+ .*$
ignoreregex =
```

```bash
# Tester le filtre
fail2ban-regex /var/log/nginx/access.log /etc/fail2ban/filter.d/nginx-cve.conf

# Démarrer
systemctl restart fail2ban
fail2ban-client status
```

---

## Étape 5.4 — Commandes utiles

```bash
# Liste des jails actives
fail2ban-client status

# Détail d'une jail
fail2ban-client status sshd

# Bannir manuellement une IP
fail2ban-client set sshd banip 198.51.100.42

# Débannir une IP
fail2ban-client set sshd unbanip 198.51.100.42

# Lister les IPs bannies
fail2ban-client banned
```

---

## Étape 5.5 — Collecte pour le dashboard

```python
# Exemple : récupérer les stats fail2ban via fail2ban-client
import subprocess, json

JAILS = ["sshd", "nginx-http-auth", "nginx-cve", "nginx-botsearch"]

def get_fail2ban_stats():
    jails = []
    total_banned = 0

    for jail_name in JAILS:
        try:
            out = subprocess.check_output(
                ["fail2ban-client", "status", jail_name],
                stderr=subprocess.DEVNULL, text=True, timeout=5
            )
            # Parser la sortie texte de fail2ban-client
            banned_ips = []
            total = 0
            for line in out.splitlines():
                if "Banned IP list:" in line:
                    ips = line.split("Banned IP list:")[-1].strip()
                    banned_ips = [ip for ip in ips.split() if ip]
                if "Currently banned:" in line:
                    total = int(line.split(":")[-1].strip())

            jails.append({
                "name":       jail_name,
                "banned":     total,
                "banned_ips": banned_ips,
            })
            total_banned += total

        except Exception:
            jails.append({"name": jail_name, "banned": 0, "banned_ips": []})

    return {
        "available":   True,
        "total_banned": total_banned,
        "jails":        jails,
    }
```

---

## Architecture multi-hôtes

Pour surveiller fail2ban sur **plusieurs serveurs** (clt, pa85, Proxmox),  
utiliser SSH pour interroger chaque hôte à distance :

```python
import paramiko

def get_remote_fail2ban(host, port, ssh_key_path, jails):
    """Collecte fail2ban sur un hôte distant via SSH."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    results = []
    try:
        client.connect(host, port=port, key_filename=ssh_key_path, timeout=8)
        for jail in jails:
            _, stdout, _ = client.exec_command(
                f"fail2ban-client status {jail} 2>/dev/null", timeout=5
            )
            output = stdout.read().decode()
            # Parser output...
            results.append({"jail": jail, "output": output})
    except Exception as e:
        return {"available": False, "error": str(e)}
    finally:
        client.close()
    return {"available": True, "jails": results}
```

---

**Étape suivante →** [06 — Collecte et monitoring_gen.py](./06-COLLECTE-MONITORING.md)
