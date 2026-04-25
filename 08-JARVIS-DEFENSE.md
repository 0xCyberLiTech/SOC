<div align="center">

<br/>

<a href="https://github.com/0xCyberLiTech/SOC">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=40&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=900&lines=>JARVIS+AI_" alt="SOC 0xCyberLiTech" />
</a>

<br/>

<h3>🤖 IA 100% locale &nbsp;·&nbsp; Ollama phi4-reasoning &nbsp;·&nbsp; Ban automatique &nbsp;·&nbsp; Alertes TTS</h3>

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
  ![Ollama](https://img.shields.io/badge/Ollama-phi4-reasoning-FF8C00?style=flat-square) ![Python](https://img.shields.io/badge/Python-Flask-3776AB?style=flat-square&logo=python&logoColor=white) ![TTS](https://img.shields.io/badge/TTS-Neural-8B5CF6?style=flat-square) ![Déclencheurs](https://img.shields.io/badge/Déclencheurs-12-00FF88?style=flat-square)
</p>

<br/>

[← 07 — rsyslog](07-RSYSLOG-CENTRAL.md) &nbsp;·&nbsp; [⬡ README](README.md) &nbsp;·&nbsp; [09 — Roadmap →](09-ROADMAP.md)

</div>

---

## Rôle dans le SOC

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

## Stack technique JARVIS

| Composant | Détail |
|-----------|--------|
| Serveur | Flask 3.x (Python 3.11) |
| LLM principal | phi4-reasoning:plus (Ollama local) |
| LLMs alternatifs | deepseek-r1:14b, phi4:14b, qwen2.5:14b, mistral-small3.1:24b |
| TTS | edge-tts fr-CA-AntoineNeural → Piper (fallback local) |
| STT | faster-whisper "small" FR |
| GPU | RTX 5080 16GB GDDR7 (inférence Ollama) |

---

## Boucle autonome (60s)

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

## 12 déclencheurs automatiques

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

## Routes soc.py (API Flask sur srv-ngix)

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

## Alertes TTS

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

## Onglet SOC dans JARVIS

L'interface JARVIS (port 5000) contient un onglet `◈ SOC` qui affiche :

- Journal des actions proactives (bans auto, restarts)
- Compteurs par type d'action
- Dernière analyse LLM du gap défensif
- Boutons quick-prompts (analyser logs, évaluer menace, recommandations)

---

## Intégration dashboard SOC → JARVIS

La tuile JARVIS dans le dashboard SOC fait des requêtes vers `http://localhost:5000/api/status` pour afficher l'état de JARVIS en temps réel.

Cette route est appelée depuis le navigateur Windows (même machine que JARVIS), donc `localhost` fonctionne.

---

## Démarrage / Arrêt JARVIS

```bash
# Démarrage
cd C:\Users\mmsab\Documents\0xCyberLiTech\JARVIS\scripts
python jarvis.py
# → accessible sur http://localhost:5000

# Arrêt propre
# Raccourci bureau : "JARVIS - Arrêt.lnk"
# Ou : stop_jarvis.bat
```

---

*Document : 08-JARVIS-DEFENSE.md · Projet SOC 0xCyberLiTech · 2026-04-25*
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

[← 07 — rsyslog](07-RSYSLOG-CENTRAL.md) &nbsp;·&nbsp; [⬡ README](README.md) &nbsp;·&nbsp; [09 — Roadmap →](09-ROADMAP.md)

</div>
