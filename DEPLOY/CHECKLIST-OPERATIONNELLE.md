<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EOPERATIONS_" alt="SOC 0xCyberLiTech" />
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

Vérifications à effectuer chaque jour pour s'assurer que le SOC fonctionne correctement.  
Durée estimée : **5 à 10 minutes**.

---

## Vérification quotidienne (chaque matin)

### 1. État global du dashboard

Ouvrir `http://<SRV-NGIX-IP>:8080/` depuis le LAN.

- [ ] Dashboard se charge sans erreur
- [ ] ThreatScore affiché (valeur entre 0 et 100)
- [ ] Dernière mise à jour `monitoring.json` : moins de 10 minutes
- [ ] Aucun service en rouge dans la tuile Services systemd

### 2. Services critiques

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "systemctl is-active nginx crowdsec suricata fail2ban rsyslog"
```

Résultat attendu : `active` × 5

- [ ] nginx → active
- [ ] crowdsec → active
- [ ] suricata → active
- [ ] fail2ban → active
- [ ] rsyslog → active

### 3. Rapport email JARVIS

- [ ] Email reçu à 8h00 de `soc-daily-report.py`
- [ ] Score ThreatScore de la veille cohérent
- [ ] Nombre de bans non aberrant (> 500 → investiguer)

### 4. Bans CrowdSec

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "cscli decisions list | head -20"
```

- [ ] Bans actifs visibles
- [ ] Aucun faux positif évident (IPs LAN, bots légitimes)
- [ ] Aucune IP interne bannie (192.168.x.x)

---

## Vérification hebdomadaire (lundi)

### 5. Mise à jour des règles CrowdSec

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "cscli hub update && cscli hub upgrade"
```

- [ ] Collections à jour
- [ ] AppSec rules à jour
- [ ] CrowdSec redémarré si mise à jour : `systemctl restart crowdsec`

### 6. Mise à jour des règles Suricata

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "suricata-update && systemctl reload suricata"
```

- [ ] Règles mises à jour sans erreur
- [ ] Suricata rechargé : vérifier `systemctl is-active suricata` → active

### 7. Mises à jour système

```bash
# srv-ngix
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "apt-get update -qq && apt list --upgradable 2>/dev/null"

# site-01
ssh -i ~/.ssh/id_site-01 -p <SSH-PORT> root@<CLT-IP> \
  "apt-get update -qq && apt list --upgradable 2>/dev/null"

# site-02
ssh -i ~/.ssh/id_site-02 -p <SSH-PORT> root@<PA85-IP> \
  "apt-get update -qq && apt list --upgradable 2>/dev/null"
```

- [ ] Paquets critiques de sécurité → appliquer immédiatement
- [ ] Autres paquets → planifier weekend

### 8. Rotation logs

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "du -sh /var/log/central/ /var/log/nginx/ /var/log/suricata/"
```

- [ ] Aucun dossier > 2 Go
- [ ] logrotate fonctionnel : fichiers .gz présents

### 9. Backup hebdomadaire AIDE

Vérifier que la vérification AIDE nocturne (03h00) s'est bien exécutée :

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "tail -20 /var/log/aide/aide.log"
```

- [ ] Date du dernier rapport = aujourd'hui ou hier
- [ ] Aucun fichier système modifié de manière inattendue
- [ ] Si des changements légitimes → re-baseline : `aide --update`

---

## Vérification mensuelle (1er du mois)

### 10. Revue des bans permanents

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "cscli decisions list --type ban | grep -v '24h' | grep -v '1h'"
```

- [ ] Aucun ban permanent inattendu
- [ ] Nettoyer les vieux bans si nécessaire

### 11. Test de réponse à incident (simulation)

```bash
# Simuler un ban JARVIS
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "cscli decisions add --ip 10.255.255.1 --reason 'test-mensuel' --duration 5m"

# Vérifier apparition dans dashboard
# Attendre 60s → monitoring.json mis à jour → tuile CrowdSec

# Nettoyer
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "cscli decisions delete --ip 10.255.255.1"
```

- [ ] IP bannie visible dans dashboard
- [ ] IP débannie après commande delete

### 12. Revue des règles UFW

```bash
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "ufw status verbose"
```

- [ ] Aucune règle orpheline ajoutée sans documentation
- [ ] Default policies inchangées

### 13. Backup configuration SOC

```bash
# Exécuter le script d'archive depuis srv-ngix
ssh -i ~/.ssh/id_nginx -p <SSH-PORT> root@<SRV-NGIX-IP> \
  "/opt/site-01/scripts/create-archive.sh"
```

- [ ] Archive créée dans `/opt/backup-config/`
- [ ] Archive copiée sur Windows (D:\BACKUP-PROXMOX\ ou équivalent)

---

## Procédures d'urgence

### IP légitime bannie par erreur (faux positif)

```bash
# 1. Débannir dans CrowdSec
cscli decisions delete --ip <IP>

# 2. Débannir dans chaque jail Fail2ban
fail2ban-client unbanip sshd <IP>
fail2ban-client unbanip nginx-cve <IP>
fail2ban-client unbanip nginx-botsearch <IP>

# 3. Ajouter en whitelist pour éviter re-ban
echo "<IP>" >> /etc/crowdsec/local_api_credentials.yaml  # ou via parsers whitelist
```

### Service down — redémarrage d'urgence

```bash
# nginx
systemctl restart nginx && systemctl is-active nginx

# CrowdSec
systemctl restart crowdsec && cscli decisions list | head -3

# Suricata
systemctl restart suricata && tail -5 /var/log/suricata/suricata.log

# Fail2ban
systemctl restart fail2ban && fail2ban-client status
```

### ThreatScore > 75 — Procédure d'investigation

1. Ouvrir dashboard → Kill Chain → identifier les IPs en phase EXPLOIT/BRUTE
2. Pour chaque IP suspecte → clic `⊙` → modal IP Deep (GeoIP, réputation, historique)
3. Si IP malveillante confirmée → `cscli decisions add --ip <IP> --reason "manual-emergency" --duration 48h`
4. Vérifier logs Suricata → `tail -100 /var/log/suricata/eve.json | grep '"event_type":"alert"'`
5. Après résolution → documenter dans le rapport journalier

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
