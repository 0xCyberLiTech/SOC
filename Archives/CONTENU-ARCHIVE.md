<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EARCHIVE_" alt="SOC 0xCyberLiTech" />
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

> Audit effectué le 2026-04-25 sur srv-ngix (<SRV-NGIX-IP>)  
> Archive de référence : `soc-config-2026-04-25_2159.tar.gz` (v4 — 38 Mo)  
> Script : `create-archive.sh` · 13 blocs (0/13 → 12/13)

---

<h2 align="center">Contenu vérifié — bloc par bloc</h2>

<h3 align="center">network/ ✅ (nouveau — BLOC 0)</h3>
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
| `exim4/` | `/etc/exim4/` (43 fichiers — smarthost <MAIL-PROVIDER>) | ✅ ⚠️ passwd.client |
| `hosts.allow` | `/etc/hosts.allow` | ✅ |
| `hosts.deny` | `/etc/hosts.deny` | ✅ |
| `ip-addr.txt` | `ip addr` (état live au moment export) | ✅ |
| `ip-route.txt` | `ip route` (routes live) | ✅ |
| `ports-ouverts.txt` | `ss -tlnup` (ports en écoute) | ✅ |

> `rp_filter=2` dans `sysctl.d/99-hardening.conf` est **critique** pour Suricata AF_PACKET.

<h3 align="center">nginx/ ✅</h3>
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `nginx.conf` | `/etc/nginx/nginx.conf` | ✅ |
| `sites-available/` | `/etc/nginx/sites-available/` (5 fichiers) | ✅ |
| `sites-enabled/` | `/etc/nginx/sites-enabled/` (3 symlinks) | ✅ |
| `conf.d/` | `/etc/nginx/conf.d/` (0 fichiers) | ✅ |
| `snippets/` | `/etc/nginx/snippets/` (5 fichiers) | ✅ |
| `geoip/` | `/usr/share/GeoIP/` (3 fichiers .mmdb) | ✅ |
| `letsencrypt/` | `/etc/letsencrypt/` (40 fichiers) | ✅ ⚠️ clés privées incluses |

<h3 align="center">crowdsec/ ✅</h3>
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

<h3 align="center">fail2ban/ ✅</h3>
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `jail.local` | `/etc/fail2ban/jail.local` | ✅ |
| `jail.conf` | `/etc/fail2ban/jail.conf` | ✅ |
| `filter.d/` | `/etc/fail2ban/filter.d/` (102 fichiers) | ✅ |
| `action.d/` | `/etc/fail2ban/action.d/` (67 fichiers) | ✅ |
| `action.d/crowdsec-sync.conf` | Custom — clé chaîne défense F2B→CS | ✅ |

<h3 align="center">suricata/ ✅</h3>
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `suricata.yaml` | `/etc/suricata/suricata.yaml` | ✅ |
| `rules/` | `/etc/suricata/rules/` (22 fichiers) | ✅ |
| `threshold.config` | `/etc/suricata/threshold.config` | ⚠️ absent sur le serveur |

> Les ~106k règles Emerging Threats ne sont PAS dans l'archive.  
> Elles sont retéléchargées via `suricata-update` lors de la restauration.

<h3 align="center">rsyslog/ ✅</h3>
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `rsyslog.conf` | `/etc/rsyslog.conf` | ✅ |
| `rsyslog.d/` | `/etc/rsyslog.d/` (2 fichiers) | ✅ |

<h3 align="center">apparmor/ ✅</h3>
| Fichier | Source | Statut |
|---------|--------|--------|
| `usr.sbin.nginx` | `/etc/apparmor.d/usr.sbin.nginx` | ✅ |
| `usr.bin.suricata` | `/etc/apparmor.d/usr.bin.suricata` | ✅ |
| `aa-status.json` | `aa-status --json` | ✅ |

<h3 align="center">ufw/ ✅</h3>
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `/etc/ufw/` complet | 22 fichiers (before.rules, after.rules, user.rules...) | ✅ |
| `ufw-status-verbose.txt` | `ufw status verbose` | ✅ |

<h3 align="center">scripts/ ✅</h3>
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `opt-site-01/` | `/opt/site-01/` (72 fichiers) | ✅ |
| `usr-local-bin/pve-monitor-write` | `/usr/local/bin/pve-monitor-write` | ✅ |
| `dashboard/` | `/var/www/monitoring/` (HTML+JS+CSS, sans .json live) | ✅ |

<h3 align="center">crons/ ✅</h3>
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

<h3 align="center">systemd/ ✅</h3>
| Fichier | Source | Statut |
|---------|--------|--------|
| `soc-report-trigger.service` | Service custom SOC | ✅ |
| `sshd.service` | SSH config custom (port <SSH-PORT>) | ✅ |
| `services-actifs.txt` | `systemctl list-units` (référence) | ✅ |

<h3 align="center">aide/ ✅</h3>
| Fichier / Dossier | Source | Statut |
|-------------------|--------|--------|
| `/etc/aide/` | 247 fichiers (aide.conf + règles) | ✅ |
| `aide.db.gz` | `/var/lib/aide/aide.db.gz` | ⚠️ absent (recalculée après restore) |

<h3 align="center">logrotate/ ✅</h3>
| Fichier | Source | Statut |
|---------|--------|--------|
| `/etc/logrotate.d/` | 20 fichiers (nginx, fail2ban, suricata...) | ✅ |

<h3 align="center">geoip/ ✅</h3>
| Fichier | Source | Statut |
|---------|--------|--------|
| `GeoIP.conf` | `/etc/GeoIP.conf` (Account ID + License Key MaxMind) | ✅ ⚠️ sensible |

<h3 align="center">api-keys/ ✅ (nouveau — v3+)</h3>
| Fichier | Source | Statut |
|---------|--------|--------|
| `api-keys.conf` | `/etc/nginx/api-keys.conf` (NVD_API_KEY + ABUSEIPDB_API_KEY) | ✅ ⚠️ sensible |

<h3 align="center">ssh/ ✅</h3>
| Fichier | Source | Statut |
|---------|--------|--------|
| `authorized_keys` | `/root/.ssh/authorized_keys` (clé pve-monitor) | ✅ ⚠️ sensible |
| `id_site-01_sync` + `.pub` | `/root/.ssh/id_site-01_sync` (connexion site-01) | ✅ ⚠️ clé privée |
| `id_site-02_sync` + `.pub` | `/root/.ssh/id_site-02_sync` (connexion site-02) | ✅ ⚠️ clé privée |
| `id_proxmox_sync` + `.pub` | `/root/.ssh/id_proxmox_sync` (connexion pve) | ✅ ⚠️ clé privée |

<h3 align="center">metadata/ ✅</h3>
| Fichier | Contenu |
|---------|---------|
| `versions.txt` | Versions nginx, crowdsec, suricata, fail2ban, rsyslog, apparmor, aide |
| `network.txt` | `ip a` — interfaces réseau |
| `routes.txt` | `ip r` — table de routage |
| `dpkg-selections.txt` | Liste complète des paquets installés |

---

<h2 align="center">Fichiers sensibles dans l'archive</h2>

| Fichier | Sensibilité | Raison |
|---------|------------|--------|
| `nginx/letsencrypt/` | 🔴 Élevée | Clés privées SSL Let's Encrypt |
| `crowdsec/local_api_credentials.yaml` | 🔴 Élevée | Token API CrowdSec LAPI |
| `api-keys/api-keys.conf` | 🔴 Élevée | NVD API Key + AbuseIPDB API Key |
| `network/exim4/passwd.client` | 🔴 Élevée | Password SMTP <MAIL-PROVIDER> |
| `ssh/id_site-01_sync` + autres | 🔴 Élevée | Clés SSH privées (sync vers VMs) |
| `geoip/GeoIP.conf` | 🟡 Moyenne | License Key MaxMind |
| `ssh/authorized_keys` | 🟡 Moyenne | Clé SSH pve-monitor Proxmox |

**→ Stocker l'archive dans `D:\BACKUP-PROXMOX\` uniquement (pas sur un NAS public).**

---

<h2 align="center">Ce que l'archive NE contient PAS (intentionnel)</h2>

| Élément | Raison |
|---------|--------|
| Règles Suricata ET Pro (~106k) | Trop volumineuses — retéléchargées via `suricata-update` |
| `monitoring.json` | Données live — recalculées par monitoring_gen.py |
| Logs `/var/log/` | Données opérationnelles, pas de config |
| JARVIS | Tourne sur Windows (<LAN-IP>), hors périmètre srv-ngix |
| Base AIDE `/var/lib/aide/aide.db.gz` | Recalculée via `aide --init` après restore |
| Clés SSH privées `/root/.ssh/id_rsa*` | Clés d'authentification personnelles — restaurer manuellement |

---

<h2 align="center">Flux restauration plug-and-play</h2>

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

<h2 align="center">Utilisation par blocs</h2>

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
