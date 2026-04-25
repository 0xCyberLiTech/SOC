<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=%3ETHREATSCORE_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>🎯 Score menace temps réel &nbsp;·&nbsp; 24 briques &nbsp;·&nbsp; Seuils FAIBLE / ÉLEVÉ / CRITIQUE</h3>

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
  <img src="https://img.shields.io/badge/Score-0%E2%80%94100-FF8C00?style=flat-square" alt="Score" />
  &nbsp;  <img src="https://img.shields.io/badge/Briques-24-00B4D8?style=flat-square" alt="Briques" />
  &nbsp;  <img src="https://img.shields.io/badge/Refresh-60s-00FF88?style=flat-square" alt="Refresh" />
  &nbsp;
</p>

<br/>

<p>
  <a href="05-CHAINE-DEFENSE.md"><img src="https://img.shields.io/badge/◄-05+Kill+Chain-555555?style=flat-square" alt="← 05 Kill Chain" /></a>
  &nbsp;&nbsp;
  <a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>
  &nbsp;&nbsp;
  <a href="07-RSYSLOG-CENTRAL.md"><img src="https://img.shields.io/badge/07+rsyslog-►-555555?style=flat-square" alt="07 rsyslog →" /></a>
</p>

</div>

---

## Principe

Le ThreatScore est un entier **0 à 100** calculé toutes les 60 secondes par `monitoring_gen.py`.

Il agrège **24 briques indépendantes**. Chaque brique contribue avec un poids fixe.  
Un système d'**anti-doublons explicites** évite que deux signaux corrélés gonflent artificiellement le score.

---

## Seuils d'alerte

| Score | Niveau | Couleur | Action JARVIS |
|-------|--------|---------|---------------|
| 0–29 | NORMAL | Vert | Aucune |
| 30–49 | SURVEILLÉ | Jaune | Log |
| 50–74 | ÉLEVÉ | Orange | Alerte TTS |
| 75–100 | CRITIQUE | Rouge | Ban auto + TTS urgence |

---

## Les 24 briques

### Briques réseau / volumétrie (max ~30 pts)

| # | Brique | Poids | Déclencheur |
|---|--------|-------|-------------|
| 1 | Taux de requêtes anormal | +10 | req/h > seuil baseline |
| 2 | Taux d'erreurs HTTP élevé | +8 | 4xx/5xx > 15% du trafic |
| 3 | Volume bande passante anormal | +5 | bytes > 3× baseline |
| 4 | IPs uniques actives > seuil | +7 | distinct_ips > 50/h |

### Briques détection active (max ~35 pts)

| # | Brique | Poids | Déclencheur |
|---|--------|-------|-------------|
| 5 | Bans CrowdSec actifs | +8 | active_decisions > 0 |
| 6 | Nouvelles décisions CrowdSec 1h | +10 | decisions_1h > 5 |
| 7 | Alertes Suricata sév.1 (critique) | +12 | sev1_count > 0 |
| 8 | Alertes Suricata sév.2 (élevée) | +6 | sev2_count > 10 |
| 9 | AppSec WAF bloquages | +8 | appsec_blocked > 0 |
| 10 | Fail2ban bans actifs | +5 | f2b_bans > 0 |

### Briques corrélation (max ~20 pts)

| # | Brique | Poids | Déclencheur |
|---|--------|-------|-------------|
| 11 | Corrélation cross-hôte (XHC) | +10 | même IP vue nginx + site-01 + site-02 |
| 12 | Corrélation SSH + ban actif | +8 | IP bannie + tentative SSH |
| 13 | Trafic sortant C2 potentiel | +15 | rsyslog routeur <ROUTER> pattern C2 |
| 14 | Scan multi-cibles (>5 hôtes) | +5 | rsyslog correlation |

### Briques état système (max ~15 pts)

| # | Brique | Poids | Déclencheur |
|---|--------|-------|-------------|
| 15 | Service critique down | +15 | nginx / crowdsec / suricata KO |
| 16 | AIDE anomalie intégrité | +10 | aide.log changed files |
| 17 | AppArmor denied récent | +5 | kernel audit AppArmor deny |
| 18 | Fail2ban jail inactive | +3 | jail absent ou disabled |

### Briques contextuelles (max ~10 pts)

| # | Brique | Poids | Déclencheur |
|---|--------|-------|-------------|
| 19 | IP Kill Chain phase EXPLOIT | +8 | phase == EXPLOIT |
| 20 | IP Kill Chain phase BRUTE | +6 | phase == BRUTE |
| 21 | CVE critique non patchée connue | +5 | CVE dans NVD feed + non vpatch |
| 22 | Honeypot touché (EXPLOIT) | +8 | honeypot_hits phase EXPLOIT |
| 23 | Honeypot touché (SCAN) | +3 | honeypot_hits phase SCAN |
| 24 | Paquets système critiques à MAJ | +2 | security updates pending > 0 |

---

## Anti-doublons

Règles explicites pour éviter la surpondération :

| Signaux corrélés | Règle |
|-----------------|-------|
| Brique 5 (bans CS) ET brique 6 (nouvelles décisions) | Maximum des deux, pas somme |
| Brique 7 (Suricata sév.1) ET brique 9 (AppSec WAF) | même IP → compte une seule fois |
| Brique 11 (XHC) ET briques 19/20 (Kill Chain) | XHC bonus plafonné à +5 si déjà en phase EXPLOIT/BRUTE |
| Briques 10 + 5 (F2B + CrowdSec) | même ban → une seule contribution |

---

## Formule de calcul

```python
def compute_threat_score(data):
    score = 0
    
    # Briques réseau
    if data['req_hour'] > REQ_BASELINE * 2:
        score += 10
    if data['error_rate'] > 0.15:
        score += 8
    # ... (24 briques)
    
    # Anti-doublons
    cs_contrib = max(brique5, brique6)
    score += cs_contrib  # pas +brique5+brique6
    
    # Plafonner à 100
    return min(score, 100)
```

---

## Évolution dans le temps

Le ThreatScore est archivé dans `monitoring.json` avec horodatage.  
Le dashboard affiche :
- Score courant (tuile principale)
- Mini-graphe 24h (historique)
- Tendance ↑↓ (comparaison heure précédente)

---

*Document : 06-THREATSCORE.md · Projet SOC 0xCyberLiTech · 2026-04-25*
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
  <a href="05-CHAINE-DEFENSE.md"><img src="https://img.shields.io/badge/◄-05+Kill+Chain-555555?style=flat-square" alt="← 05 Kill Chain" /></a>&nbsp;&nbsp;<a href="README.md"><img src="https://img.shields.io/badge/⬡-SOC+0xCyberLiTech-00B4D8?style=flat-square" alt="Home" /></a>&nbsp;&nbsp;<a href="07-RSYSLOG-CENTRAL.md"><img src="https://img.shields.io/badge/07+rsyslog-►-555555?style=flat-square" alt="07 rsyslog →" /></a>
</p>

</div>
