# 08 — JARVIS — Réponse autonome

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
| 8 | Trafic C2 sortant (rsyslog GT-BE98) | Ban 24h | `jarvis-rsyslog-c2` |
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
