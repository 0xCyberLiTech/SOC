# Contenu de l'archive SOC — Inventaire v4

> Audit effectué le 2026-04-25 sur srv-ngix (<SRV-NGIX-IP>)  
> Archive de référence : `soc-config-2026-04-25_2159.tar.gz` (v4 — 38 Mo)  
> Script : `create-archive.sh` · 13 blocs (0/13 → 12/13)

---

## Contenu vérifié — bloc par bloc

### network/ ✅ (nouveau — BLOC 0)
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `interfaces` | `/etc/network/interfaces` (IP <SRV-NGIX-IP>, GW .254, DNS) | ✅ |
| `hostname` | `/etc/hostname` (srv-ngix) | ✅ |
| `hosts` | `/etc/hosts` | ✅ |
| `resolv.conf` | `/etc/resolv.conf` | ✅ |
| `nsswitch.conf` | `/etc/nsswitch.conf` | ✅ |
| `mailname` | `/etc/mailname` | ✅ |
| `ssh/sshd_config` | `/etc/ssh/sshd_config` (port <SSH-PORT>, PasswordAuth no) | ✅ |
| `sysctl/sysctl.conf` | `/etc/sysctl.conf` | ✅ |
| `sysctl/sysctl.d/` | `/etc/sysctl.d/` (99-hardening + 99-disable-ipv6) | ✅ |
| `nftables.conf` | `/etc/nftables.conf` | ✅ |
| `exim4/` | `/etc/exim4/` (43 fichiers — smarthost laposte.net) | ✅ ⚠️ passwd.client |
| `hosts.allow` | `/etc/hosts.allow` | ✅ |
| `hosts.deny` | `/etc/hosts.deny` | ✅ |
| `ip-addr.txt` | `ip addr` (état live au moment export) | ✅ |
| `ip-route.txt` | `ip route` (routes live) | ✅ |
| `ports-ouverts.txt` | `ss -tlnup` (ports en écoute) | ✅ |

> `rp_filter=2` dans `sysctl.d/99-hardening.conf` est **critique** pour Suricata AF_PACKET.

### nginx/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `nginx.conf` | `/etc/nginx/nginx.conf` | ✅ |
| `sites-available/` | `/etc/nginx/sites-available/` (5 fichiers) | ✅ |
| `sites-enabled/` | `/etc/nginx/sites-enabled/` (3 symlinks) | ✅ |
| `conf.d/` | `/etc/nginx/conf.d/` (0 fichiers) | ✅ |
| `snippets/` | `/etc/nginx/snippets/` (5 fichiers) | ✅ |
| `geoip/` | `/usr/share/GeoIP/` (3 fichiers .mmdb) | ✅ |
| `letsencrypt/` | `/etc/letsencrypt/` (40 fichiers) | ✅ ⚠️ clés privées incluses |

### crowdsec/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `config/` | `/etc/crowdsec/` (321 fichiers) | ✅ |
| `config.yaml` | `/etc/crowdsec/config.yaml` | ✅ |
| `local_api_credentials.yaml` | `/etc/crowdsec/local_api_credentials.yaml` | ✅ ⚠️ sensible |
| `bouncers/crowdsec-firewall-bouncer.yaml` | `/etc/crowdsec/bouncers/` | ✅ |
| `decisions-export.json` | `cscli decisions list -o json` | ✅ |
| `bouncers.json` | `cscli bouncers list -o json` | ✅ |
| `collections.json` | `cscli collections list -o json` | ✅ |
| Scenarios custom | `/etc/crowdsec/scenarios/0xclt-*.yaml` (3 fichiers) | ✅ inclus dans config/ |
| Parsers custom | `/etc/crowdsec/parsers/s02-enrich/whitelist-lan.yaml` | ✅ inclus dans config/ |

### fail2ban/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `jail.local` | `/etc/fail2ban/jail.local` | ✅ |
| `jail.conf` | `/etc/fail2ban/jail.conf` | ✅ |
| `filter.d/` | `/etc/fail2ban/filter.d/` (102 fichiers) | ✅ |
| `action.d/` | `/etc/fail2ban/action.d/` (67 fichiers) | ✅ |
| `action.d/crowdsec-sync.conf` | Custom — clé chaîne défense F2B→CS | ✅ |

### suricata/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `suricata.yaml` | `/etc/suricata/suricata.yaml` | ✅ |
| `rules/` | `/etc/suricata/rules/` (22 fichiers) | ✅ |
| `threshold.config` | `/etc/suricata/threshold.config` | ⚠️ absent sur le serveur |

> Les ~106k règles Emerging Threats ne sont PAS dans l'archive.  
> Elles sont retéléchargées via `suricata-update` lors de la restauration.

### rsyslog/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `rsyslog.conf` | `/etc/rsyslog.conf` | ✅ |
| `rsyslog.d/` | `/etc/rsyslog.d/` (2 fichiers) | ✅ |

### apparmor/ ✅
| Fichier | Source | Statut |
|---------|--------|--------|
| `usr.sbin.nginx` | `/etc/apparmor.d/usr.sbin.nginx` | ✅ |
| `usr.bin.suricata` | `/etc/apparmor.d/usr.bin.suricata` | ✅ |
| `aa-status.json` | `aa-status --json` | ✅ |

### ufw/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `/etc/ufw/` complet | 22 fichiers (before.rules, after.rules, user.rules...) | ✅ |
| `ufw-status-verbose.txt` | `ufw status verbose` | ✅ |

### scripts/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `opt-site-01/` | `/opt/site-01/` (72 fichiers) | ✅ |
| `usr-local-bin/pve-monitor-write` | `/usr/local/bin/pve-monitor-write` | ✅ |
| `dashboard/` | `/var/www/monitoring/` (HTML+JS+CSS, sans .json live) | ✅ |

### crons/ ✅
| Fichier | Source | Statut |
|---------|--------|--------|
| `cron.d/aide-soc` | AIDE vérification 03h00 | ✅ |
| `cron.d/site-01-cve-fetch` | CVE fetch 3x/jour | ✅ |
| `cron.d/site-01-threat-fetch` | Threat fetch 03h00 | ✅ |
| `cron.d/crowdsec-hub-update` | Hub update 03h45 | ✅ |
| `cron.d/geoipupdate` | GeoIP MaxMind 03h00 | ✅ |
| `cron.d/monitoring` | Dashboard refresh 1 min | ✅ |
| `cron.d/proto-live` | Protocoles temps réel 1 min | ✅ |
| `cron.d/soc-daily-report` | Rapport email 08h00 | ✅ |
| `cron.d/sqlite-maintenance` | VACUUM SQLite dimanche 02h00 | ✅ |
| `cron.d/suricata-update` | Règles Suricata 03h30 | ✅ |
| `cron.d/ufw-snapshot` | Snapshot UFW toutes les heures | ✅ |
| `crontab-root.txt` | `crontab -l` (vide — crons dans cron.d) | ✅ |

### systemd/ ✅
| Fichier | Source | Statut |
|---------|--------|--------|
| `soc-report-trigger.service` | Service custom SOC | ✅ |
| `sshd.service` | SSH config custom (port <SSH-PORT>) | ✅ |
| `services-actifs.txt` | `systemctl list-units` (référence) | ✅ |

### aide/ ✅
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `/etc/aide/` | 247 fichiers (aide.conf + règles) | ✅ |
| `aide.db.gz` | `/var/lib/aide/aide.db.gz` | ⚠️ absent (recalculée après restore) |

### logrotate/ ✅
| Fichier | Source | Statut |
|---------|--------|--------|
| `/etc/logrotate.d/` | 20 fichiers (nginx, fail2ban, suricata...) | ✅ |

### geoip/ ✅
| Fichier | Source | Statut |
|---------|--------|--------|
| `GeoIP.conf` | `/etc/GeoIP.conf` (Account ID + License Key MaxMind) | ✅ ⚠️ sensible |

### api-keys/ ✅ (nouveau — v3+)
| Fichier | Source | Statut |
|---------|--------|--------|
| `api-keys.conf` | `/etc/nginx/api-keys.conf` (NVD_API_KEY + ABUSEIPDB_API_KEY) | ✅ ⚠️ sensible |

### ssh/ ✅
| Fichier | Source | Statut |
|---------|--------|--------|
| `authorized_keys` | `/root/.ssh/authorized_keys` (clé pve-monitor) | ✅ ⚠️ sensible |
| `id_site-01_sync` + `.pub` | `/root/.ssh/id_site-01_sync` (connexion site-01) | ✅ ⚠️ clé privée |
| `id_site-02_sync` + `.pub` | `/root/.ssh/id_site-02_sync` (connexion site-02) | ✅ ⚠️ clé privée |
| `id_proxmox_sync` + `.pub` | `/root/.ssh/id_proxmox_sync` (connexion pve) | ✅ ⚠️ clé privée |

### metadata/ ✅
| Fichier | Contenu |
|---------|---------|
| `versions.txt` | Versions nginx, crowdsec, suricata, fail2ban, rsyslog, apparmor, aide |
| `network.txt` | `ip a` — interfaces réseau |
| `routes.txt` | `ip r` — table de routage |
| `dpkg-selections.txt` | Liste complète des paquets installés |

---

## Fichiers sensibles dans l'archive

| Fichier | Sensibilité | Raison |
|---------|------------|--------|
| `nginx/letsencrypt/` | 🔴 Élevée | Clés privées SSL Let's Encrypt |
| `crowdsec/local_api_credentials.yaml` | 🔴 Élevée | Token API CrowdSec LAPI |
| `api-keys/api-keys.conf` | 🔴 Élevée | NVD API Key + AbuseIPDB API Key |
| `network/exim4/passwd.client` | 🔴 Élevée | Password SMTP laposte.net |
| `ssh/id_site-01_sync` + autres | 🔴 Élevée | Clés SSH privées (sync vers VMs) |
| `geoip/GeoIP.conf` | 🟡 Moyenne | License Key MaxMind |
| `ssh/authorized_keys` | 🟡 Moyenne | Clé SSH pve-monitor Proxmox |

**→ Stocker l'archive dans `D:\BACKUP-PROXMOX\` uniquement (pas sur un NAS public).**

---

## Ce que l'archive NE contient PAS (intentionnel)

| Élément | Raison |
|---------|--------|
| Règles Suricata ET Pro (~106k) | Trop volumineuses — retéléchargées via `suricata-update` |
| `monitoring.json` | Données live — recalculées par monitoring_gen.py |
| Logs `/var/log/` | Données opérationnelles, pas de config |
| JARVIS | Tourne sur Windows (<LAN-IP>), hors périmètre srv-ngix |
| Base AIDE `/var/lib/aide/aide.db.gz` | Recalculée via `aide --init` après restore |
| Clés SSH privées `/root/.ssh/id_rsa*` | Clés d'authentification personnelles — restaurer manuellement |

---

## Flux restauration plug-and-play

```
1. Nouvelle VM Debian 13 — IP <SRV-NGIX-IP> — port SSH 22 (temporaire)
2. Copier l'archive + les scripts de déploiement sur la VM
3. bash deploy-soc.sh                        ← installe tous les paquets
4. bash restore-soc.sh archive.tar.gz --dry-run   ← SIMULATION
5. bash restore-soc.sh archive.tar.gz             ← RESTAURATION COMPLÈTE
6. Reboot
7. ssh -p <SSH-PORT> root@<SRV-NGIX-IP>             ← reconnexion sur port <SSH-PORT>
8. Valider CHECKLIST-DEPLOY.md (61 points)
```

---

## Utilisation par blocs

```bash
# Simulation complète
bash restore-soc.sh soc-config-2026-04-25_2159.tar.gz --dry-run

# Restauration complète
bash restore-soc.sh soc-config-2026-04-25_2159.tar.gz

# Restauration d'un seul bloc
bash restore-soc.sh soc-config-2026-04-25_2159.tar.gz --step network
bash restore-soc.sh soc-config-2026-04-25_2159.tar.gz --step nginx
bash restore-soc.sh soc-config-2026-04-25_2159.tar.gz --step crons
```

---

*Inventaire mis à jour le 2026-04-25 — archive v4 · 13 blocs · 38 Mo*
