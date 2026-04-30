<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EJARVIS+IA_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Défense proactive IA — auto-engine · 12 déclencheurs · TTS · actions autonomes.</h2>

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
    <a href="README.md">
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

<div align="center">
## À propos & Objectifs.
</div>

Ce document couvre l'intégration JARVIS dans le SOC : auto-engine de surveillance, déclencheurs, routes SOC (ban-ip, restart-service), alertes TTS vocales. JARVIS est une couche optionnelle — le SOC se défend sans lui.

- 🤖 Auto-engine — boucle 60s, lit monitoring.json, analyse les deltas
- 📢 Alertes TTS vocales — edge-tts fr-CA-AntoineNeural si niveau ÉLEVÉ/CRITIQUE
- ⚡ Actions proactives — ban-ip via cscli, restart-service avec liste blanche
- 🔒 Garde-fou LLM — blocklist des tool calls non autorisés, journal traçabilité
- 🖥️ Couche optionnelle — actif quand la machine Windows est en service

---

<h2 align="center">Rôle dans le SOC</h2>

JARVIS est l'**interface IA** du SOC — il tourne sur la machine Windows (<LAN-IP>, port 5000).

Il opère en **boucle autonome** toutes les 60 secondes : lit `monitoring.json`, analyse les menaces, prend des décisions.

```
JARVIS (Windows localhost:5000)
      │
      ├── fetch monitoring.json (srv-ngix :8080)
      ├── Analyse LLM (phi4-reasoning via Ollama)
      ├── Décisions → routes soc.py (srv-ngix)
      │       ├── POST /ban-ip      → cscli decisions add
      │       ├── POST /unban-ip    → cscli decisions delete
      │       └── POST /restart-svc → systemctl restart
      └── TTS alertes vocales (edge-tts Antoine / Piper fallback)
```

---

<h2 align="center">Stack technique JARVIS</h2>

| Composant | Détail |
|-----------|--------|
| Serveur | Flask 3.x (Python 3.11) |
| LLM principal | phi4-reasoning:plus (Ollama local) |
| LLMs alternatifs | deepseek-r1:14b, phi4:14b, qwen2.5:14b, mistral-small3.1:24b |
| TTS | edge-tts fr-CA-AntoineNeural → Piper (fallback local) |
| STT | faster-whisper "small" FR |
| GPU | RTX 5080 16GB GDDR7 (inférence Ollama) |

---

<h2 align="center">Boucle autonome (60s)</h2>

```python
# Logique simplifiée de la boucle auto-engine

while True:
    data = fetch_monitoring_json()
    score = data['threat_score']
    
    # Règle 1 — Ban auto si IP en phase EXPLOIT non bannie
    for ip in data['kill_chain']:
        if ip['phase'] == 'EXPLOIT' and not ip['banned']:
            ban_ip(ip['addr'], 'jarvis-autoban-exploit')
    
    # Règle 2 — Restart si service down
    for svc in data['services_down']:
        restart_service(svc)
    
    # Règle 3 — Alerte TTS si niveau CRITIQUE
    if score >= 75:
        tts_alert(f"Niveau critique, score {score}")
    
    # Règle 4 — Analyse LLM si seuil élevé
    if score >= 50:
        analysis = llm_analyze(data)
        log_to_soc_tab(analysis)
    
    sleep(60)
```

---

<h2 align="center">12 déclencheurs automatiques</h2>

| # | Condition | Action | Raison ban |
|---|-----------|--------|------------|
| 1 | Phase EXPLOIT détectée, IP non bannie | Ban 24h | `jarvis-autoban-exploit-cve` |
| 2 | CVE connue détectée non bannie | Ban 24h | `jarvis-autoban-exploit-cve` |
| 3 | Honeypot EXPLOIT touché | Ban 24h | `jarvis-autoban-exploit-h` |
| 4 | Honeypot SCAN touché | Ban 24h | `jarvis-autoban-scan-h` |
| 5 | Honeypot BRUTE touché | Ban 24h | `jarvis-autoban-brute-h` |
| 6 | Alerte Suricata sév.1 < 1h | Ban 24h | `jarvis-suricata-sev1` |
| 7 | Scan réseau Suricata détecté | Ban 24h | `jarvis-suricata-scan` |
| 8 | Trafic C2 sortant (rsyslog <ROUTER>) | Ban 24h | `jarvis-rsyslog-c2` |
| 9 | Recon multi-cibles rsyslog | Ban 24h | `jarvis-rsyslog-recon` |
| 10 | Service nginx/crowdsec/suricata down | Restart | — |
| 11 | Score ≥ 75 | Alerte TTS urgence | — |
| 12 | Score ≥ 50 | Analyse LLM + log onglet SOC | — |

---

<h2 align="center">Routes soc.py (API Flask sur srv-ngix)</h2>

`soc.py` tourne sur `srv-ngix` et expose des routes locales consommées par JARVIS via SSH tunnel ou réseau LAN.

```python
# Exemples de routes exposées
POST /ban-ip        body: {"ip": "1.2.3.4", "reason": "jarvis-autoban", "duration": "24h"}
POST /unban-ip      body: {"ip": "1.2.3.4"}
POST /restart-svc   body: {"service": "nginx"}
GET  /status        → état courant services + décisions
```

Chaque appel exécute la commande `cscli` ou `systemctl` correspondante sur srv-ngix.

---

<h2 align="center">Alertes TTS</h2>

Deux moteurs TTS, en cascade :

```
1. edge-tts fr-CA-AntoineNeural (via Internet Microsoft)
      → latence ~300ms
      → qualité optimale
      
2. Piper TTS (local, installé sur Windows)
      → fallback si edge-tts indisponible
      → voix locale FR
      
Jamais : window.speechSynthesis (voix Windows exclue)
```

**Règle de priorité** : le navigateur tente AudioContext (qualité optimale), sinon `<audio>` blob (fallback silencieux), jamais voix système.

---

<h2 align="center">Onglet SOC dans JARVIS</h2>

L'interface JARVIS (port 5000) contient un onglet `◈ SOC` qui affiche :

- Journal des actions proactives (bans auto, restarts)
- Compteurs par type d'action
- Dernière analyse LLM du gap défensif
- Boutons quick-prompts (analyser logs, évaluer menace, recommandations)

---

<h2 align="center">Intégration dashboard SOC → JARVIS</h2>

La tuile JARVIS dans le dashboard SOC fait des requêtes vers `http://localhost:5000/api/status` pour afficher l'état de JARVIS en temps réel.

Cette route est appelée depuis le navigateur Windows (même machine que JARVIS), donc `localhost` fonctionne.

---

<h2 align="center">Démarrage / Arrêt JARVIS</h2>

```bash
# Démarrage
cd <YOUR-JARVIS-PATH>\scripts
python jarvis.py
# → accessible sur http://localhost:5000

# Arrêt propre
# Raccourci bureau : "JARVIS - Arrêt.lnk"
# Ou : stop_jarvis.bat
```

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
