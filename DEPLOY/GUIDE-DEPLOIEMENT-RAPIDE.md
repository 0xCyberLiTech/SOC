<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=>DEPLOIEMENT_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>🚀 Plug-and-play &nbsp;·&nbsp; 8 étapes &nbsp;·&nbsp; VM vierge → SOC opérationnel</h3>

<br/>

<p>
  <a href="https://0xcyberlitech.com">
    <img src="https://img.shields.io/badge/🌐%20Site-0xcyberlitech.com-00B4D8?style=flat-square" alt="Site web" />
  </a>
  &nbsp;
  <a href="https://github.com/0xCyberLiTech/SOC">
    <img src="https://img.shields.io/badge/Dépôt-SOC-00B4D8?style=flat-square&logo=github&logoColor=white" alt="SOC" />
  </a>
  &nbsp;
  ![Debian](https://img.shields.io/badge/Debian-13-A81D33?style=flat-square&logo=debian&logoColor=white) ![Bash](https://img.shields.io/badge/Bash-script-4EAA25?style=flat-square&logo=gnubash&logoColor=white) ![Durée](https://img.shields.io/badge/Durée-< 30 min-00FF88?style=flat-square)
</p>

<br/>

[← README](../README.md) &nbsp;·&nbsp; [⬡ README](../README.md) &nbsp;·&nbsp; [Runbook →](RUNBOOK-DEBIAN13.md)

</div>

---

> Procédure complète pour reconstruire srv-ngix à l'identique sur une nouvelle VM Debian 13.  
> Durée estimée : **15 à 30 minutes**.

---

## Prérequis

### VM à préparer (nouveau srv-ngix)
- OS : **Debian 13 (Trixie)** installation minimale
- IP : **<SRV-NGIX-IP>** (configurée pendant l'install Debian — DHCP ou statique, peu importe pour l'instant)
- SSH : port **22** (par défaut — sera changé à <SSH-PORT> par le script de restauration)
- Accès : root avec mot de passe (le script SSH clés sera restauré)
- Réseau : accessible depuis votre poste Windows

### Fichiers à avoir sur Windows
- **Archive** : `D:\BACKUP-PROXMOX\soc-config-AAAA-MM-JJ.tar.gz` (38 Mo)
- **Dossier DEPLOY** : `C:\Users\mmsab\Documents\0xCyberLiTech\SOC\docs\PROJET-SOC\DEPLOY\`
  - `deploy-soc.sh` — installe les paquets (nginx, crowdsec, suricata...)
  - `restore-soc.sh` — restaure toutes les configs depuis l'archive

---

## Étape 1 — Transférer les fichiers sur la nouvelle VM

Depuis **Git Bash sur Windows** :

```bash
# Variables (adapter si besoin)
NEW_VM="<SRV-NGIX-IP>"
ARCHIVE="D:/BACKUP-PROXMOX/soc-config-2026-04-25_2159.tar.gz"
DEPLOY="C:/Users/mmsab/Documents/0xCyberLiTech/SOC/docs/PROJET-SOC/DEPLOY"

# Créer le dossier de travail sur la VM (port 22 — avant restore SSH)
ssh root@${NEW_VM} "mkdir -p /root/deploy-soc"

# Copier les scripts de déploiement
scp "${DEPLOY}/deploy-soc.sh"    root@${NEW_VM}:/root/deploy-soc/
scp "${DEPLOY}/restore-soc.sh"   root@${NEW_VM}:/root/deploy-soc/

# Copier l'archive de configuration (peut prendre 30-60s selon le réseau)
scp "${ARCHIVE}" root@${NEW_VM}:/root/deploy-soc/
```

**Résultat attendu sur la VM** :
```
/root/deploy-soc/
├── deploy-soc.sh
├── restore-soc.sh
└── soc-config-2026-04-25_2159.tar.gz
```

---

## Étape 2 — Se connecter à la nouvelle VM

```bash
ssh root@<SRV-NGIX-IP>
cd /root/deploy-soc
```

---

## Étape 3 — Installer les paquets (deploy-soc.sh)

```bash
# Simulation d'abord (sans rien modifier)
bash deploy-soc.sh --dry-run

# Déploiement complet (installe nginx, crowdsec, suricata, fail2ban, rsyslog, aide...)
bash deploy-soc.sh
```

> Cette étape installe tous les paquets nécessaires. Durée : **5 à 10 min** selon la connexion internet.

---

## Étape 4 — Simuler la restauration (--dry-run)

```bash
bash restore-soc.sh soc-config-2026-04-25_2159.tar.gz --dry-run
```

**Lire le rapport final** (affiché en jaune) :
- `Fichiers DIFFÉRENTS` → configs qui vont être modifiées
- `Fichiers NOUVEAUX` → configs absentes sur la VM vierge (normal)
- Aucune erreur rouge `[ERRR]` → tout est prêt

---

## Étape 5 — Restaurer toutes les configurations

```bash
bash restore-soc.sh soc-config-2026-04-25_2159.tar.gz
```

Le script restaure dans l'ordre :
```
0/13 Réseau       → interfaces, hostname, SSH (port <SSH-PORT>), sysctl, exim4
1/13 nginx        → vhosts, SSL, snippets, GeoIP databases
2/13 CrowdSec     → config, parsers, scenarios, collections
3/13 Fail2ban     → jail.local, filters, actions
4/13 Suricata     → config + téléchargement règles ET (~106k)
5/13 rsyslog      → config centrale logs
6/13 AppArmor     → profils nginx + suricata
7/13 UFW          → règles firewall
8/13 Scripts      → /opt/site-01/, /usr/local/bin/, dashboard
9/13 Crons        → /etc/cron.d/ (11 tâches planifiées)
10/13 Systemd     → units custom (soc-report-trigger)
11/13 Compléments → AIDE, logrotate, GeoIP license, API keys, SSH keys
12/13 AIDE        → recalcul baseline intégrité
```

> ⚠️ **Après BLOC 0 (réseau)**, le script redémarre SSH sur le port **<SSH-PORT>**.  
> Votre session SSH actuelle (port 22) reste active jusqu'à sa fin.

---

## Étape 6 — Rebooter

```bash
reboot
```

> Le reboot applique : `/etc/network/interfaces` (IP statique) et `/etc/hostname` (srv-ngix).

---

## Étape 7 — Reconnexion sur le bon port

Depuis **Git Bash sur Windows** (après le reboot) :

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP>
```

---

## Étape 8 — Validation finale

```bash
# Services actifs ?
systemctl is-active nginx crowdsec suricata fail2ban rsyslog
# Attendu : active × 5

# Crons en place ?
ls /etc/cron.d/
# Attendu : 11 fichiers

# CrowdSec opérationnel ?
cscli decisions list | head -5
cscli bouncers list
```

### Accès dashboard SOC (depuis n'importe quel PC du LAN)

| URL | Description | Disponible sans JARVIS ? |
|-----|-------------|--------------------------|
| `http://<SRV-NGIX-IP>:8080/` | Dashboard SOC principal — ThreatScore, tuiles, Kill Chain | ✅ Oui |
| `http://<SRV-NGIX-IP>:8080/goaccess.html` | Rapport GoAccess — stats HTTP nginx temps réel | ✅ Oui |

> **Note** : Si JARVIS (Windows <LAN-IP>) est éteint, la tuile JARVIS affiche "OFFLINE" mais tout le reste du dashboard fonctionne normalement — CrowdSec, Suricata, bans, ThreatScore, Kill Chain, logs centraux.

Suivre ensuite la **CHECKLIST-DEPLOY.md** (61 points de validation).

---

## En cas de problème — Rollback

Le script `restore-soc.sh` crée automatiquement une sauvegarde avant d'écraser quoi que ce soit :
```
/opt/backup-config/pre-restore-AAAA-MM-JJ_HHMM/
```

Pour restaurer un fichier spécifique :
```bash
cp /opt/backup-config/pre-restore-*/etc_nginx_nginx.conf /etc/nginx/nginx.conf
```

Pour rejouer un seul bloc :
```bash
bash restore-soc.sh archive.tar.gz --step nginx
bash restore-soc.sh archive.tar.gz --step crowdsec
bash restore-soc.sh archive.tar.gz --step crons
```

---

## Récapitulatif des commandes (copier-coller)

```bash
# ─── Depuis Git Bash Windows ──────────────────────────────────────────
NEW_VM="<SRV-NGIX-IP>"
ARCHIVE="/d/BACKUP-PROXMOX/soc-config-2026-04-25_2159.tar.gz"
DEPLOY="/c/Users/mmsab/Documents/0xCyberLiTech/SOC/docs/PROJET-SOC/DEPLOY"

ssh root@${NEW_VM} "mkdir -p /root/deploy-soc"
scp "${DEPLOY}/deploy-soc.sh" "${DEPLOY}/restore-soc.sh" root@${NEW_VM}:/root/deploy-soc/
scp "${ARCHIVE}" root@${NEW_VM}:/root/deploy-soc/

# ─── Depuis la nouvelle VM ────────────────────────────────────────────
ssh root@${NEW_VM}
cd /root/deploy-soc

bash deploy-soc.sh                                          # 1. paquets
bash restore-soc.sh soc-config-*.tar.gz --dry-run          # 2. simulation
bash restore-soc.sh soc-config-*.tar.gz                    # 3. restauration
reboot                                                      # 4. reboot

# ─── Depuis Git Bash Windows (après reboot) ───────────────────────────
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP>           # 5. reconnexion
```

---

*Guide créé le 2026-04-25 — archive v4 · 13 blocs*
---

<div align="center">

<table>
<tr>
<td align="center"><b>🖥️ Infrastructure &amp; Sécurité</b></td>
<td align="center"><b>💻 Développement &amp; Web</b></td>
<td align="center"><b>🤖 Intelligence Artificielle</b></td>
</tr>
<tr>
<td align="center">
  <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="40" title="Debian" /></a>
  <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="40" title="Nginx" /></a>
  <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="40" title="Bash" /></a>
  <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="40" title="Git" /></a>
</td>
<td align="center">
  <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="40" title="Python" /></a>
  <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="40" title="Flask" /></a>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="40" title="JavaScript" /></a>
  <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="40" title="VS Code" /></a>
</td>
<td align="center">
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  &nbsp;
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projet par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> &nbsp;·&nbsp; Co-développé avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>

---

<div align="center">

[← README](../README.md) &nbsp;·&nbsp; [⬡ README](../README.md) &nbsp;·&nbsp; [Runbook →](RUNBOOK-DEBIAN13.md)

</div>
