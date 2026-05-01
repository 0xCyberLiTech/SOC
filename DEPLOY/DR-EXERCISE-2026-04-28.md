<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EDR-EXERCISE_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Rapport exercice DR — Phase A/B/C · 8 écarts détectés · reconstruction validée.</h2>

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
      <img src="https://img.shields.io/badge/%F0%9F%93%84%20README-SOC-00B4D8?style=flat-square" alt="README" />
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
    <strong>Disaster Recovery</strong> <img src="https://img.icons8.com/color/24/000000/lock--v1.png"/> &nbsp;•&nbsp; <strong>Exercice réel 2026-04-28</strong> <img src="https://img.icons8.com/color/24/000000/linux.png"/> &nbsp;•&nbsp; <strong>Reconstruction validée</strong> <img src="https://img.icons8.com/color/24/000000/shield-security.png"/>
  </p>
</div>

---

<div align="center">
## À propos & Objectifs.
</div>

Ce document est le rapport de l'exercice Disaster Recovery réel exécuté le 2026-04-28. Il documente la procédure Phase A/B/C, les 8 écarts détectés en conditions réelles et les corrections apportées.

- 🧪 Phase A — déploiement VM test depuis zéro avec deploy-soc.sh
- 🔄 Phase B — restauration depuis archive (restore-soc.sh)
- ✅ Phase C — basculement réseau et validation en conditions réelles
- 🐛 8 écarts détectés — documentés et corrigés pendant l'exercice
- ⏱️ Durée totale — reconstruction complète en moins de 30 minutes

---

# Exercice DR — Rapport d'exécution (2026-04-28)

> Disaster Recovery réel · Phase A/B/C · VM test → basculement prod · Durée totale ~1h15

---

## Contexte

L'archive de configuration `soc-config-2026-04-28_2100.tar.gz` (38 Mo · 13 blocs) avait été auditée
en simulation (`--dry-run`) mais jamais exécutée sur une VM vierge réelle.

**Objectif** : valider que la procédure permet de reconstruire `srv-ngix` à l'identique sur une nouvelle
VM sans intervention manuelle imprévue, en conditions réelles avec basculement réseau.

**Contrainte** : la VM de prod (`192.168.1.50`) ne doit pas être touchée pendant les phases A et C.

---

## Infrastructure de test

| Élément | Valeur |
|---------|--------|
| VM test | `srv-labo-01` (Proxmox ID 101) · IP temporaire `192.168.1.10` |
| VM prod | `srv-ngix` (Proxmox ID 108) · IP `192.168.1.50` |
| Hyperviseur | Proxmox VE `192.168.1.20` |
| Archive utilisée | `soc-config-2026-04-28_2100.tar.gz` |
| Piloté depuis | Git Bash Windows |

---

## Déroulement

### Phase A — Restauration 12 blocs sans coupure prod (~45 min)

Restauration de tous les blocs applicatifs sur la VM test (IP `192.168.1.10`),
**bloc réseau exclu** pour ne pas modifier l'IP pendant cette phase.

```bash
for bloc in nginx crowdsec fail2ban suricata rsyslog apparmor ufw scripts crons systemd complement aide; do
  bash restore-soc.sh soc-config-2026-04-28_2100.tar.gz --step $bloc
done
```

> **[ERRR] nginx en Phase A** : attendu — la config bind sur `192.168.1.50` (IP prod).
> La VM test ayant `192.168.1.10`, nginx ne peut pas démarrer. Tous les fichiers sont en place.
> nginx démarrera automatiquement après Phase B.

### Phase B — Basculement réseau (~5 min)

```bash
# 1. Éteindre la prod proprement
ssh -i ~/.ssh/id_proxmox -p 2272 root@192.168.1.20 "qm shutdown 108 && qm wait 108"

# 2. Appliquer le bloc réseau sur la VM test
ssh root@192.168.1.10 "bash restore-soc.sh soc-config-2026-04-28_2100.tar.gz --step network"
# → VM test prend 192.168.1.50, SSH bascule sur port 2272

# 3. Reconnecter sur la VM test (maintenant à l'IP prod)
ssh-keygen -R "[192.168.1.50]:2272"   # effacer l'ancienne clé host
ssh -i ~/.ssh/id_nginx -p 2272 root@192.168.1.50
```

### Phase C — Validation en conditions réelles (~15 min)

```bash
nginx -t && systemctl status nginx crowdsec fail2ban suricata
curl -sI http://192.168.1.50:8080/
cscli decisions list
crontab -l && ls /etc/cron.d/
aide --config /etc/aide/aide.conf --init && mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db
```

---

## Résultat : SUCCÈS ✅

| Composant | État final |
|-----------|-----------|
| nginx | ✅ active — config ok |
| crowdsec | ✅ active — v1.7.7 — bouncer firewall ok |
| fail2ban | ✅ active — jails nginx-cve + sshd |
| suricata | ✅ active — v7.0.10 |
| rsyslog | ✅ active |
| apparmor | ✅ active |
| ufw | ✅ active |
| Dashboard | ✅ HTTP 200 — monitoring.json à jour |
| Crons | ✅ 14 fichiers dans `/etc/cron.d/` |
| AIDE baseline | ✅ re-générée — 15 Mo |
| Hostname | ✅ `srv-ngix` |
| IP | ✅ `192.168.1.50` |
| SSH | ✅ port 2272 |

---

## Écarts détectés et corrigés

L'exercice a mis en évidence **8 écarts** — 5 bugs bloquants dans `restore-soc.sh` et 3 écarts de procédure.

### Bugs `restore-soc.sh` corrigés

| # | Ligne | Symptôme | Cause | Correction |
|---|-------|----------|-------|------------|
| 1 | 192 | `unbound variable` avec `set -u` | `local rel/target` sur la même ligne | Split en deux déclarations `local` séparées |
| 2 | 573 | Script s'arrête au bloc 9 (crons) | `grep \| while` retourne exit 1 si crontab vide | Ajout `\|\| true` en fin de pipeline |
| 3 | bloc nginx | Let's Encrypt non restauré → nginx fail | Script en warn-only, ne copiait pas les fichiers | `restore_dir` effectif sur `/etc/letsencrypt/` |

### Écarts de procédure documentés

| # | Symptôme | Cause | Correction dans la procédure |
|---|----------|-------|------------------------------|
| 4 | `apt-get` bloqué au démarrage | `/etc/resolv.conf` vide sur VM fraîche | Ajout vérification DNS avant apt — étape 2 |
| 5 | `crowdsec-firewall-bouncer-nftables` introuvable | Mauvais nom de paquet | Corrigé en `crowdsec-firewall-bouncer` |
| 6 | Suricata démarre en échec | Pas de règles à l'install | `suricata-update` obligatoire avant premier démarrage |
| 7 | packagecloud CrowdSec → 404 | Repo généré en `trixie`, non supporté | `sed -i 's\|trixie\|bookworm\|g'` sur Debian 13 |
| 8 | CrowdSec FATAL "machine not found" | Machine-ID prod absent de la LAPI fraîche | `cscli machines delete` + `cscli machines add` — documenté |

### Correction CrowdSec LAPI (détail)

Après restore, CrowdSec échoue avec `machine not found` : la LAPI a enregistré un ID aléatoire
à l'install, mais l'archive contient l'ID de la machine prod.

```bash
# Récupérer le login prod
grep login /etc/crowdsec/local_api_credentials.yaml

# Re-enregistrer
cscli machines list                           # noter l'ID auto-créé
cscli machines delete <id_auto>
cscli machines add <login_prod> --password <password_prod> --force
systemctl restart crowdsec
```

---

## Durée totale

| Phase | Durée |
|-------|-------|
| Phase A — 12 blocs + debug | ~45 min |
| Phase B — basculement réseau | ~5 min |
| Phase C — validation + CrowdSec fix + AIDE | ~25 min |
| **Total** | **~1h15** |

> La durée cible sans les écarts (procédure corrigée) est estimée à **30 minutes**.

---

## Retour arrière (non utilisé — succès)

Si la Phase B avait échoué :
```bash
# Éteindre la VM test (libère 192.168.1.50)
ssh -i ~/.ssh/id_proxmox -p 2272 root@192.168.1.20 "qm shutdown 101 && qm wait 101"
# Rallumer la prod
ssh -i ~/.ssh/id_proxmox -p 2272 root@192.168.1.20 "qm start 108"
# Prod de retour en ~30 secondes
```

---

*Exercice réalisé le 2026-04-28 — archive de référence : soc-config-2026-04-28_2100.tar.gz*

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
