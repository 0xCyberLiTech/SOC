<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=>OPERATIONS_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>📋 Exploitation quotidienne &nbsp;·&nbsp; Vérifications périodiques &nbsp;·&nbsp; Métriques de santé</h3>

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
  ![Fréquence](https://img.shields.io/badge/Fréquence-Quotidienne-FF8C00?style=flat-square) ![Couverture](https://img.shields.io/badge/Couverture-Complète-00FF88?style=flat-square)
</p>

<br/>

[← Checklist deploy](CHECKLIST-DEPLOY.md) &nbsp;·&nbsp; [⬡ README](../README.md) &nbsp;·&nbsp; [README →](../README.md)

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

*Document : CHECKLIST-OPERATIONNELLE.md · Projet SOC 0xCyberLiTech · 2026-04-25*
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

[← Checklist deploy](CHECKLIST-DEPLOY.md) &nbsp;·&nbsp; [⬡ README](../README.md) &nbsp;·&nbsp; [README →](../README.md)

</div>
