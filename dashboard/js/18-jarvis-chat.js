'use strict';
// ── 18-jarvis-chat.js — §7+§8 (DT-09 — 2026-04-13) ─────────────────
// ═══════════════════════════════════════════════════════════════
// §7 — CHAT UI & LLM
// ═══════════════════════════════════════════════════════════════
function pingWan(){
  clearChat();
  var d = window._lastData;
  var wanRaw = (d&&d.wan_ip) || (d&&d.traffic&&d.traffic.wan_ip);
  var wanIp = (wanRaw&&typeof wanRaw==='object' ? wanRaw.ip : wanRaw) || '8.8.8.8';
  appendMsg('user', '🌐 Ping WAN — ' + wanIp);
  _msgs.push({role:'user', content:'Ping WAN '+wanIp});
  showThinking();
  fetch(JV_URL+'/api/ping',{
    method:'POST', mode:'cors',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({host: wanIp}),
    signal: AbortSignal.timeout(20000)
  }).then(function(r){ return r.json(); })
  .then(function(res){
    removeThinking();
    var status = res.ok ? '✅ Joignable' : '❌ Injoignable';
    var lines  = (res.lines||[]).slice(-6).join('\n');
    var txt    = status + ' — ' + wanIp + '\n\n' + (lines||res.error||'Pas de réponse');
    var el = appendMsg('jarvis', txt);
    _msgs.push({role:'assistant', content:txt});
    addSpeakBtn(el);
    saveToHistory('🌐 Ping WAN', txt);
    if(_ttsEnabled && el){ var _pb=el.querySelector('.jv-msg-body'); if(_pb) speakText(_pb.textContent); }
  })
  .catch(function(){
    removeThinking();
    appendMsg('jarvis','⚠ Impossible de joindre JARVIS pour le ping. JARVIS doit être actif sur le PC.');
  });
}

// ── Clear chat (historique + UI) ──────────────────────────────
function clearChat(){
  _msgs = [];
  var d = document.getElementById('jv-msgs');
  if(d) d.innerHTML = '';
}

// ── Quick prompts ─────────────────────────────────────────────
function buildQuickPrompts(){
  var qc = document.getElementById('jv-quick');
  if(!qc) return;
  var prompts = [
    {lbl:'🎙 État vocal',     fn: _jvQuickRoutine(null, true, '🎙 État vocal')},
    {lbl:'📊 Situation',      fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement :\n'
      +'Score de menace exact et niveau (FAIBLE/MOYEN/ÉLEVÉ/CRITIQUE).\n'
      +'Les 2-3 facteurs actifs les plus importants avec leurs valeurs exactes.\n'
      +'État défenses : fail2ban, CrowdSec, UFW en une ligne.\n'
      +'Recommandation prioritaire concrète. Stop.',
      false, '📊 Situation')},
    {lbl:'🔥 Attaques',       fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement :\n'
      +'Kill chain nginx — pour chaque attaquant actif : IP, pays, stage (EXPLOIT/BRUTE/SCAN/RECON), nombre de requêtes, statut CrowdSec.\n'
      +'Suricata IDS réseau — alertes sév.1 critiques : IPs sources, signatures, statut ban.\n'
      +'Pattern d\'attaque dominant (HTTP vs réseau L3/L4).\n'
      +'Niveau de dangerosité global et action manuelle requise : OUI/NON. Stop.',
      false, '🔥 Attaques')},
    {lbl:'🌍 Géolocalisation', fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement :\n'
      +'Top 3 pays sources d\'attaque : nombre de requêtes/IPs, type d\'attaque dominant, présence dans le kill chain.\n'
      +'GeoIP efficace : OUI/NON — ajustement utile : OUI/NON. Stop.',
      false, '🌍 Géolocalisation')},
    {lbl:'🛡 Défenses',       fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement :\n'
      +'Fail2ban : IPs bannies total (4 hôtes : srv-ngix, Proxmox, site01, site02), tentatives SSH bloquées.\n'
      +'CrowdSec WAF : décisions actives, stages couverts.\n'
      +'Suricata IDS : alertes sév.1 critiques actives, sév.2 high, couverture réseau.\n'
      +'UFW : paquets bloqués.\n'
      +'Défenses : SUFFISANTES / RENFORCEMENT NÉCESSAIRE. Stop.',
      false, '🛡 Défenses')},
    {lbl:'💻 Ressources PC',  fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement :\n'
      +'CPU : usage % et température.\n'
      +'GPU RTX 5080 : charge, température, VRAM utilisée.\n'
      +'Risque surchauffe/saturation : OUI/NON.\n'
      +'État machine : NORMAL / DÉGRADÉ / CRITIQUE. Stop.',
      false, '💻 Ressources PC')},
    {lbl:'⚠️ Alertes',       fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Liste uniquement les anomalies réelles (exclure les états normaux).\n'
      +'Par ordre de priorité CRITIQUE → ÉLEVÉE → MOYENNE uniquement.\n'
      +'Inclure : alertes Suricata sév.1 réseau, kill chain EXPLOIT, anomalies fail2ban, surchauffe, erreurs 5xx.\n'
      +'Pour chaque anomalie : cause, valeur mesurée, action recommandée.\n'
      +'Si aucune anomalie : "Aucune alerte active."\n'
      +'Intervention immédiate requise : OUI/NON. Stop.',
      false, '⚠️ Alertes')},
    {lbl:'💡 Conseils',       fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Identifie les 3 menaces les plus actives dans le kill chain.\n'
      +'Pour chacune, une ligne avec les chiffres 1. 2. 3. (pas de mots) : urgence selon stage (EXPLOIT=CRITIQUE, BRUTE=ÉLEVÉE, SCAN=MOYENNE), IP source exacte, commande système adaptée. Stop.',
      false, '💡 Conseils')},
    {lbl:'🌐 Ping WAN',       fn: function(){ if(!_online||!_enabled||_thinking) return; _currentRoutineLabel='🌐 Ping WAN'; pingWan(); }},
    {lbl:'📡 État FAI',       fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement ton évaluation de la connectivité WAN et de la stabilité réseau.\n'
      +'Cite les chiffres exacts (erreurs 5xx, volume trafic, débit WAN si disponible).\n'
      +'Conclus par le niveau de stabilité : STABLE / DÉGRADÉ / INSTABLE. Stop.',
      false, '📡 État FAI')},
    {lbl:'🕵 IPs suspectes',  fn: function(){
      if(!_online||!_enabled||_thinking) return;
      clearChat();
      _ttsSingleShot = true;
      _currentRoutineLabel = '🕵 IPs suspectes';
      _pendingBanParse = true;
      sendMessage(
        'Contexte SOC complet disponible. Donne directement l\'inventaire des IPs suspectes.\n'
        +'Pour chaque IP active dans le kill chain : IP, pays, stage, nombre de requêtes, statut CrowdSec.\n'
        +'IP la plus dangereuse : laquelle et pourquoi.\n'
        +'IPs à bannir manuellement : liste IPv4 séparées par des virgules, ou AUCUNE. Stop.'
      );
    }},
    {lbl:'🔒 SSL / Certs',    fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement l\'état des certificats SSL.\n'
      +'Pour chaque certificat : domaine, jours restants, statut.\n'
      +'Expiration < 30 jours : OUI/NON — si oui, commande certbot à exécuter. Stop.',
      false, '🔒 SSL/Certs')},
    {lbl:'⚙ Services',        fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement l\'état des services critiques.\n'
      +'nginx : statut, requêtes traitées, erreurs 5xx.\n'
      +'fail2ban : statut, bans actifs (4 hôtes).\n'
      +'CrowdSec WAF : statut, décisions actives, scénarios déclenchés.\n'
      +'Suricata IDS : statut, alertes actives sév.1/sév.2.\n'
      +'Service dégradé ou en risque : OUI/NON. Stop.',
      false, '⚙ Services')},
    {lbl:'⏱ Uptime',          fn: _jvQuickRoutine(
      'Contexte SOC complet disponible. Donne directement :\n'
      +'srv-ngix : uptime exact, CPU %, RAM %.\n'
      +'Surcharge ou dégradation détectée : OUI/NON.\n'
      +'Stabilité serveur : STABLE / DÉGRADÉ / CRITIQUE. Stop.',
      false, '⏱ Uptime')},
  ];
  qc.innerHTML = '';
  prompts.forEach(function(p){
    var chip = document.createElement('div');
    chip.className = 'jv-chip';
    if(p.lbl.startsWith('🎙')) chip.style.cssText='background:rgba(191,95,255,0.13);border-color:rgba(191,95,255,0.45);color:var(--purple);font-weight:700';
    chip.textContent = p.lbl;
    chip.onclick = p.fn;
    qc.appendChild(chip);
  });
}

// ── État vocal SOC ────────────────────────────────────────────
function vocalSocStatus(){
  if(!_online || !_enabled || _thinking) return;
  _ttsSingleShot = true;
  // Adapte le niveau de détail au preset actif
  var isFullAlerte = (_autoThresh.voiceMinScore <= 10 && _autoThresh.alertCooldownMin <= 2);
  var prompt = isFullAlerte
    ? 'Contexte SOC complet disponible. Rapport vocal complet :\n'
      + 'Score de menace exact et niveau.\n'
      + 'Tous les attaquants actifs dans le kill chain : IP, pays, stage.\n'
      + 'Actions proactives JARVIS récentes.\n'
      + 'État des défenses avec chiffres exacts.\n'
      + '2 actions prioritaires recommandées. Stop.'
    : 'Contexte SOC complet disponible.\n'
      + 'Score de menace et niveau en premier.\n'
      + 'Point(s) le(s) plus important(s) avec valeurs exactes.\n'
      + '1 recommandation concrète. Stop.';
  sendMessage(prompt);
}

// ── Build SOC context ─────────────────────────────────────────
function buildContext(){
  var d = window._lastData;
  if(!d) return 'Données SOC non disponibles.';
  var t = d.traffic||{}, f2b = d.fail2ban||{}, sys = d.system||{}, ufw = d.ufw||{};
  var wd = d.windows_disk||{}, cpu = wd.cpu||{}, gpu = wd.gpu||{};
  var kc = d.kill_chain||{}, sc = kc.stage_counts||{};
  var ts = computeThreatScore(d);
  var lines = [
    '=== CONTEXTE SOC — 0xCyberLiTech ===',
    'Mise à jour : ' + (d.generated_at||'--'),
    '',
    '--- SCORE DE MENACE ---',
    'Score : ' + ts.score + '/100 | Niveau : ' + ts.level,
    ts.factors.length ? 'Facteurs actifs : ' + ts.factors.map(function(f){return f.t;}).join(' | ') : 'Aucun facteur critique',
    '',
    '--- KILL CHAIN nginx ---',
    'EXPLOIT : '+(sc.EXPLOIT||0)+' IP | BRUTE : '+(sc.BRUTE||0)+' IP | SCAN : '+(sc.SCAN||0)+' IP | RECON : '+(sc.RECON||0)+' IP',
    'Total actifs : '+(kc.total_active||0)+' | Décisions CrowdSec : '+((d.crowdsec&&(d.crowdsec.active_decisions||d.crowdsec.decisions))||0),
  ];
  if(kc.active_ips && kc.active_ips.length){
    lines.push('');
    lines.push('--- TOP ATTAQUANTS ACTIFS (15 min) ---');
    kc.active_ips.slice(0,6).forEach(function(ip,i){
      var country = ip.country||ip.cc||'?';
      var stage   = ip.stage||'?';
      var reqs    = ip.count||ip.requests||0;
      var banTag  = ip.cs_decision ? ' [CS-BANNI — neutralisé, aucune action requise]'
                  : ip.banned      ? ' [F2B-BANNI — neutralisé, aucune action requise]'
                  : '';
      lines.push('#'+(i+1)+' '+ip.ip+' ('+country+') — Stage:'+stage+' — '+reqs+' req'+banTag);
    });
  }
  if(t.top_ips && t.top_ips.length){
    lines.push('');
    lines.push('--- TOP IPs 24H ---');
    t.top_ips.slice(0,5).forEach(function(ip,i){
      var a = Array.isArray(ip) ? ip : [ip.ip||ip, ip.count||0];
      lines.push('#'+(i+1)+' '+a[0]+' — '+a[1]+' req');
    });
  }
  lines.push(
    '',
    '--- TRAFIC ---',
    'Requêtes totales : '+(t.total_requests||0)+' | Erreurs 5xx : '+(t.error_rate||0)+'% | GeoIP bloqués : '+(t.geo_blocks||0),
    '',
    '--- SURICATA IDS (réseau) ---',
    (d.suricata&&d.suricata.available)
      ?'Alertes 24h : '+(d.suricata.total_alerts||0)+' | Critique sév.1 : '+(d.suricata.sev1_critical||0)+' | High sév.2 : '+(d.suricata.sev2_high||0)+' | Medium sév.3 : '+(d.suricata.sev3_medium||0)+' | Sources actives : '+((d.suricata.enabled_sources||[]).length||'?')
      :'Suricata non disponible',
    (d.suricata&&d.suricata.available&&(d.suricata.sev1_critical||0)>0)
      ?'Top alertes critiques : '+((d.suricata.recent_critical||[]).slice(0,3).map(function(a){return a.src_ip+' — '+a.signature.substring(0,50);}).join(' | '))
      :'',
    (d.suricata&&d.suricata.available&&(d.suricata.recent_scans||[]).length>0)
      ?'Port scans détectés : '+((d.suricata.recent_scans||[]).slice(0,3).map(function(a){return a.src_ip+' ('+a.count+' hits)';}).join(' | '))
      :'',
    '',
    '--- DÉFENSES ---',
    'Fail2ban : '+(f2b.total_banned||0)+' IPs bannies | SSH tentatives 24h : '+(f2b.ssh_attempts||0),
    'UFW bloqués : '+(ufw.blocked_total||0)+' | CrowdSec décisions : '+((d.crowdsec&&(d.crowdsec.active_decisions||d.crowdsec.decisions))||0),
    '',
    '--- SYSTÈME srv-ngix ---',
    'CPU : '+(sys.cpu_pct||0)+'% | RAM : '+((sys.memory||{}).pct||0)+'%'+(sys.uptime?' | Uptime : '+sys.uptime:''),
    '',
    '--- MACHINE WINDOWS ---',
    'CPU : '+(cpu.usage||0)+'% ('+( cpu.temp||'?')+'°C) | GPU '+( gpu.name||'RTX 5080')+' : '+(gpu.usage||0)+'% charge / '+(gpu.temp||'?')+'°C / VRAM '+(gpu.vram_pct||0)+'%'
  );
  if(_PRO_DATA && _PRO_DATA.total > 0){
    lines.push('');
    lines.push('--- ACTIONS PROACTIVES JARVIS ---');
    var bt = _PRO_DATA.by_type||{};
    lines.push('Total : '+_PRO_DATA.total+' | Ban IP : '+(bt.ban_ip||0)+' | Unban : '+(bt.unban_ip||0)+' | Restart service : '+(bt.restart_service||0));
    if(_PRO_DATA.actions && _PRO_DATA.actions.length){
      _PRO_DATA.actions.slice(-6).forEach(function(a){
        lines.push('  ['+( a.timestamp||a.ts||'?')+'] '+(a.type||'?')+' → '+(a.ip||a.service||a.detail||a.target||''));
      });
    }
  } else {
    lines.push('', '--- ACTIONS PROACTIVES JARVIS ---', 'Aucune action exécutée récemment.');
  }
  if(d.ssl) lines.push('', '--- CERTIFICATS SSL ---', d.ssl.map(function(s){return s.domain+' → '+s.days_left+'j restants';}).join(' | '));

  // ── Freebox Delta ──
  var fbx = d.freebox || d.fbx || {};
  if(fbx && fbx.available !== false){
    lines.push('', '--- FREEBOX DELTA ---');
    var wanState = fbx.wan_state || fbx.state || '?';
    var wanIp    = fbx.wan_ipv4 || fbx.ipv4 || '?';
    var rDown    = fbx.rate_down !== undefined ? Math.round((fbx.rate_down||0)/1000) : '?';
    var rUp      = fbx.rate_up   !== undefined ? Math.round((fbx.rate_up||0)/1000)   : '?';
    var bDown    = fbx.bandwidth_down !== undefined ? Math.round((fbx.bandwidth_down||0)/1000) : '?';
    var bUp      = fbx.bandwidth_up   !== undefined ? Math.round((fbx.bandwidth_up||0)/1000)   : '?';
    lines.push('WAN : '+wanState+' | IP : '+wanIp);
    lines.push('Débit DOWN : '+rDown+' Mbps (max '+bDown+' Mbps) | Débit UP : '+rUp+' Mbps (max '+bUp+' Mbps)');
    if(fbx.sfp_pwr_rx !== undefined){
      var rx = fbx.sfp_pwr_rx;
      var qual = rx < -27 ? 'FAIBLE (risque coupure)' : rx < -15 ? 'NORMAL' : rx < -8 ? 'BON' : 'FORT';
      lines.push('Signal GPON RX : '+rx+' dBm ('+qual+') | TX : '+(fbx.sfp_pwr_tx||'?')+' dBm');
      lines.push('Lien fibre : '+(fbx.link?'ACTIF':'INACTIF')+' | SFP : '+(fbx.sfp_present?'présent':'absent'));
    }
    if(fbx.sensors && fbx.sensors.length){
      var temps = fbx.sensors.map(function(s){return (s.name||'?')+' '+s.value+'°C';}).join(' | ');
      lines.push('Températures box : '+temps);
    }
    if(fbx.fans && fbx.fans.length){
      var fans = fbx.fans.map(function(f){return (f.name||'?')+' '+f.value+' RPM';}).join(' | ');
      lines.push('Ventilateurs : '+fans);
    }
    if(fbx.incidents && fbx.incidents.length){
      var last = fbx.incidents[fbx.incidents.length-1];
      var dur  = last.dur ? ' durée '+Math.round(last.dur/60)+'min' : '';
      lines.push('Dernière coupure : '+(last.ts||last.start||'?')+dur+' ('+( last.type||last.status||'?')+')');
    } else {
      lines.push('Coupures récentes : aucune');
    }
  } else if(fbx && fbx.auth_error){
    lines.push('', '--- FREEBOX DELTA ---', 'API non disponible — erreur auth : '+fbx.auth_error);
  }

  return lines.join('\n');
}

// ── Send message ──────────────────────────────────────────────
function sendMessage(text){
  if(!_online || _thinking) return;
  text = text || (document.getElementById('jv-input')||{}).value || '';
  text = text.trim();
  if(!text) return;
  var inp = document.getElementById('jv-input');
  if(inp){ inp.value = ''; inp.style.height='auto'; }

  appendMsg('user', text);
  _msgs.push({role:'user', content: text});

  // Limite historique : 10 messages max (context réduit = inférence plus rapide)
  if(_msgs.length > 10) _msgs = _msgs.slice(-10);

  _thinking = true;
  updateSendBtn();
  showThinking();

  // Injecter le contexte SOC dans le dernier message utilisateur
  // soc_ctx_injected:true → JARVIS Python ne re-fetche PAS monitoring.json (évite doublon ~800 tokens)
  var socCtx = '[CONTEXTE SOC EN TEMPS RÉEL]\n' + buildContext() + '\n\n[DEMANDE]\n';
  var historyToSend = _msgs.map(function(m, i){
    if(i === _msgs.length-1 && m.role === 'user')
      return {role:'user', content: socCtx + m.content};
    return m;
  });
  var payload = {history: historyToSend, soc_ctx_injected: true, num_predict: _socNumPredict()};

  var msgsDiv = document.getElementById('jv-msgs');
  var jarvisEl = null;
  var fullText = '';
  var _finalized = false;

  if(_abortCtrl) try{_abortCtrl.abort();}catch(e){if(location.hostname==='localhost')console.error('[SOC]',e);}
  _abortCtrl = new AbortController();

  fetch(JV_URL + '/api/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload),
    signal: _abortCtrl.signal
  })
  .then(function(r){
    removeThinking();
    jarvisEl = appendMsg('jarvis', '', true);
    var reader = r.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    function read(){
      reader.read().then(function(res){
        if(res.done){ finalize(); return; }
        buf += decoder.decode(res.value, {stream:true});
        var lines = buf.split('\n');
        buf = lines.pop();
        lines.forEach(function(line){
          if(!line.startsWith('data:')) return;
          var data = line.slice(5).trim();
          if(data==='[DONE]'){ finalize(); return; }
          try{
            var obj = JSON.parse(data);
            // Ignorer les events speak/tool/tool_result — ne traiter que les tokens
            if(obj.type && obj.type !== 'token') return;
            var chunk = obj.token||obj.text||obj.content||obj.delta||'';
            if(chunk){
              fullText+=chunk;
              updateMsg(jarvisEl, fullText);
            }
          }catch(e){ /* ligne SSE non-JSON ignorée */ }
        });
        if(msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
        read();
      }).catch(function(){ finalize(); });
    }
    read();
  })
  .catch(function(e){
    removeThinking();
    if(e.name!=='AbortError'){
      appendMsg('jarvis', '⚠ JARVIS hors ligne ou erreur de connexion.');
      setOnline(false);
    }
    _thinking = false; updateSendBtn();
  });

  function finalize(){
    if(_finalized) return;
    _finalized = true;
    if(jarvisEl){ jarvisEl.classList.remove('streaming'); addSpeakBtn(jarvisEl); }
    if(fullText) _msgs.push({role:'assistant', content:fullText});
    _thinking = false; updateSendBtn();
    if(msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
    // Lire exactement ce qui est affiché — body.textContent est déjà <think>-filtré par updateMsg
    if(_ttsEnabled || _ttsSingleShot){
      var _force = _ttsSingleShot;
      _ttsSingleShot = false;
      var body = jarvisEl && jarvisEl.querySelector('.jv-msg-body');
      var displayed = body ? body.textContent.trim() : '';
      if(displayed) speakText(displayed, _force);
    }
    if(fullText && _currentRoutineLabel) saveToHistory(_currentRoutineLabel, fullText);

    // ── Auto-ban sur recommandation LLM ──────────────────────────
    if(_pendingBanParse && fullText){
      _pendingBanParse = false;
      _execRecommendedBans(fullText);
    }
  }
}

// ── Exécute les bans recommandés par le LLM ───────────────────
function _execRecommendedBans(text){
  // Cherche le bloc "IPs à bannir manuellement : ..."
  var match = text.match(/IPs?\s+[àa]\s+bannir\s+manuellement\s*[:：]\s*([^\n.]+)/i);
  if(!match) return;
  var segment = match[1].trim();
  if(/^aucune/i.test(segment)) return; // rien à faire

  // Extrait toutes les IPv4 valides du segment
  var ipRe = /\b((?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))\b/g;
  var ips = [], m;
  while((m = ipRe.exec(segment)) !== null) ips.push(m[1]);
  if(!ips.length) return;

  // Filtre les IPs déjà bannies cette session ou CrowdSec
  var csDetail = window._csDetail || {};
  var candidates = ips.filter(function(ip){
    if(window._kcAutoBanned && window._kcAutoBanned[ip]) return false; // déjà banni session
    if(csDetail[ip]) return false; // déjà banni CrowdSec
    return true;
  });
  if(!candidates.length){
    appendMsg('jarvis', '✅ JARVIS — IPs recommandées déjà toutes bannies. Aucune action nécessaire.');
    return;
  }

  // Annonce vocale + message de confirmation
  var listTxt = candidates.join(', ');
  appendMsg('jarvis', '⚡ JARVIS exécute les bans recommandés : ' + esc(listTxt));
  speakText('Je banne les IPs suivantes sur recommandation : ' + candidates.join(', '), true);

  // Exécute les bans en séquence
  var idx = 0;
  function banNext(){
    if(idx >= candidates.length) return;
    var ip = candidates[idx++];
    var reason = 'ban manuel JARVIS — recommandation LLM IPs suspectes';
    _socRetryFetch(JV_URL+'/api/soc/ban-ip', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ip: ip, reason: reason})
    }).then(function(res){
      if(res && res.ok){
        if(window._kcAutoBanned) window._kcAutoBanned[ip] = Date.now();
        if(window._PRO_DATA){ _PRO_DATA.total++; _PRO_DATA.by_type.ban_ip = (_PRO_DATA.by_type.ban_ip||0)+1; _PRO_DATA.actions.unshift({type:'ban_ip',ip:ip,reason:reason,ts:Date.now()}); updateProTile(_PRO_DATA); }
        appendMsg('jarvis', '✅ ' + esc(ip) + ' — bannie.');
      } else {
        appendMsg('jarvis', '⚠ ' + esc(ip) + ' — échec du ban (vérifiez SSH).');
        speakText('Échec du ban pour ' + ip, true);
      }
      banNext();
    }).catch(function(){ appendMsg('jarvis','⚠ '+esc(ip)+' — erreur réseau.'); banNext(); });
  }
  banNext();
}

function appendMsg(role, text, streaming){
  var msgsDiv = document.getElementById('jv-msgs');
  if(!msgsDiv) return null;
  var el = document.createElement('div');
  el.className = 'jv-msg ' + role + (streaming?' streaming':'');
  var lbl = role==='user' ? 'VOUS' : 'JARVIS · '+(_jvActiveModel||'phi4');
  el.innerHTML = '<div class="jv-msg-lbl">'+lbl+'</div><div class="jv-msg-body">'+esc(text)+'</div>';
  msgsDiv.appendChild(el);
  msgsDiv.scrollTop = msgsDiv.scrollHeight;
  if(role==='jarvis' && !streaming) addSpeakBtn(el);
  return el;
}

// ── Ajouter bouton 🔊 quand streaming terminé ─────────────────
function addSpeakBtn(el){
  if(!el) return;
  var lbl = el.querySelector('.jv-msg-lbl');
  if(!lbl || lbl.querySelector('.jv-speak-btn')) return;
  var btn = document.createElement('button');
  btn.className = 'jv-speak-btn';
  btn.title = 'Lire à voix haute';
  btn.textContent = '🔊';
  btn.addEventListener('click', function(){
    var body = el.querySelector('.jv-msg-body');
    if(body) speakText(body.textContent, true);
  });
  lbl.appendChild(btn);
}

function updateMsg(el, text){
  if(!el) return;
  var body = el.querySelector('.jv-msg-body');
  if(body) body.textContent = text.replace(/<think>[\s\S]*?<\/think>/gi,'').trim() || text;
}

// ── TTS ───────────────────────────────────────────────────────
// ── Historique analyses ───────────────────────────────────────
var _JV_HIST_MAX = 50;
var _jvHistory = (function(){
  try{ return JSON.parse(localStorage.getItem(_LS_KEYS.JV_HISTORY)||'[]'); }catch(e){ return []; }
})();
var _currentRoutineLabel = '';

function saveToHistory(label, text){
  if(!text || !text.trim()) return;
  _jvHistory.unshift({ts: Date.now(), label: label||'Analyse', text: text});
  if(_jvHistory.length > _JV_HIST_MAX) _jvHistory = _jvHistory.slice(0, _JV_HIST_MAX);
  try{ localStorage.setItem(_LS_KEYS.JV_HISTORY, JSON.stringify(_jvHistory)); }catch(e){if(location.hostname==='localhost')console.error('[SOC]',e);}
  refreshHistPanel();
}

function refreshHistPanel(){
  var list = document.getElementById('jv-hist-list');
  if(!list) return;
  if(!_jvHistory.length){
    list.innerHTML = '<div class="jv-hist-empty">Aucune analyse enregistrée</div>';
    return;
  }
  list.innerHTML = _jvHistory.map(function(e, i){
    var d = new Date(e.ts);
    var date = d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})
             + ' ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    var preview = e.text.replace(/\*\*/g,'').replace(/###/g,'').replace(/\n/g,' ').slice(0,100)+'…';
    return '<div class="jv-hist-entry" data-hist-idx="'+i+'">'
      +'<div class="jv-hist-meta"><span class="jv-hist-lbl">'+esc(e.label)+'</span><span class="jv-hist-date">'+date+'</span></div>'
      +'<div class="jv-hist-preview">'+esc(preview)+'</div>'
      +'</div>';
  }).join('');
  list.querySelectorAll('.jv-hist-entry[data-hist-idx]').forEach(function(el){
    el.addEventListener('click',function(){
      if(window._jvOpenHistEntry)window._jvOpenHistEntry(parseInt(this.dataset.histIdx));
    });
  });
}

window._jvOpenHistEntry = function(i){
  var e = _jvHistory[i];
  if(!e) return;
  closeHistPanel();
  clearChat();
  appendMsg('jarvis', e.text);
  speakText(e.text, true);
};

function openHistPanel(){
  var hp  = document.getElementById('jv-hist-panel');
  var qc  = document.getElementById('jv-quick');
  var ms  = document.getElementById('jv-msgs');
  var btn = document.getElementById('jv-hist-btn');
  var sp  = document.getElementById('jv-settings-panel');
  if(sp) sp.classList.remove('open');
  document.getElementById('jv-settings-btn') && document.getElementById('jv-settings-btn').classList.remove('active');
  if(hp){ hp.classList.add('open'); refreshHistPanel(); }
  if(qc) qc.style.display = 'none';
  if(ms) ms.style.display = 'none';
  if(btn) btn.classList.add('active');
}
function closeHistPanel(){
  var hp  = document.getElementById('jv-hist-panel');
  var qc  = document.getElementById('jv-quick');
  var ms  = document.getElementById('jv-msgs');
  var btn = document.getElementById('jv-hist-btn');
  if(hp) hp.classList.remove('open');
  if(qc) qc.style.display = '';
  if(ms) ms.style.display = '';
  if(btn) btn.classList.remove('active');
}
window._jvToggleHist = function(){
  var hp = document.getElementById('jv-hist-panel');
  hp && hp.classList.contains('open') ? closeHistPanel() : openHistPanel();
};

// ── LLM Settings ──────────────────────────────────────────────
function loadLlmSettings(){
  fetch(JV_URL+'/api/llm-params',{mode:'cors',signal:AbortSignal.timeout(3000)})
  .then(function(r){return r.json();})
  .then(function(d){
    var p=d.params||d;
    _jvSet('sr-temp', p.temperature||0.7,   'sv-temp');
    _jvSet('sr-topp', p.top_p||0.9,         'sv-topp');
    _jvSet('sr-topk', p.top_k||40,          'sv-topk');
    _jvSet('sr-rep',  p.repeat_penalty||1.1,'sv-rep');
    _jvSet('sr-pred', p.num_predict||1024,  'sv-pred');
    _jvSet('sr-ctx',  p.num_ctx||4096,      'sv-ctx');
  }).catch(function(e){ if(location.hostname==='localhost')console.warn('[JARVIS] loadLlmSettings failed:',e); });
}

window._jvToggleSettings = function(){
  var sp=document.getElementById('jv-settings-panel');
  var btn=document.getElementById('jv-settings-btn');
  if(!sp) return;
  var open=sp.classList.contains('open');
  sp.classList.toggle('open');
  if(btn) btn.classList.toggle('active',!open);
  if(!open) loadLlmSettings();
};

window._jvSaveSettings = function(){
  var g=function(id){var el=document.getElementById(id);return el?parseFloat(el.value):null;};
  var r2=function(v){return Math.round(v*100)/100;}; // aligne la précision avec l'affichage toFixed(2)
  var params={
    temperature:   r2(g('sr-temp')),
    top_p:         r2(g('sr-topp')),
    top_k:         parseInt(document.getElementById('sr-topk').value),
    repeat_penalty:r2(g('sr-rep')),
    num_predict:   parseInt(document.getElementById('sr-pred').value),
    num_ctx:       parseInt(document.getElementById('sr-ctx').value)
  };
  fetch(JV_URL+'/api/llm-params',{
    method:'POST', mode:'cors',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({params:params}),
    signal:AbortSignal.timeout(5000)
  }).then(function(){
    var st=document.getElementById('jv-set-status');
    if(st){st.style.display='inline';setTimeout(function(){st.style.display='none';},_UI_STATUS_MS);}
  }).catch(function(e){ if(location.hostname==='localhost')console.warn('[JARVIS] saveLlmSettings failed:',e); });
};

function stopSpeak(){
  _ttsQueue = []; // vider la queue
  _ttsRelease();
  fetch(JV_URL + '/api/speak/stop', {method:'POST', mode:'cors', signal:AbortSignal.timeout(3000)}).catch(function(e){ if(location.hostname==='localhost')console.warn('[JARVIS] speak/stop failed:',e); });
}
window._jvStopSpeak = stopSpeak;

// ═══════════════════════════════════════════════════════════════
// §8 — TTS (Text-To-Speech) — file d'attente + AudioContext
// ═══════════════════════════════════════════════════════════════
var _ttsQueue   = [];
var _ttsBusy    = false;
var _ttsWdog    = null;  // watchdog timer — débloque si JARVIS ne répond pas
var _TTS_MAX_Q  = 8;     // max items en queue — aligné Python maxsize=8
var _TTS_TMO    = 30000; // timeout 30s (TTS raisonnable < 30s)

function _ttsRelease(){
  _ttsBusy = false;
  if(_ttsWdog){ clearTimeout(_ttsWdog); _ttsWdog = null; }
  var b = document.getElementById('jv-speaking-bar'); if(b) b.classList.remove('active');
}

// ── AudioContext partagé — unlock autoplay au premier geste utilisateur ──
var _jvAudioCtx = null;
function _getAudioCtx(){
  if(!_jvAudioCtx || _jvAudioCtx.state === 'closed'){
    _jvAudioCtx = new (window.AudioContext||window.webkitAudioContext)();
  }
  return _jvAudioCtx;
}
// Pré-unlock au premier clic (AudioContext suspendu par défaut)
document.addEventListener('click', function(){
  try{ _getAudioCtx().resume(); }catch(e){}
}, {once:false, capture:true, passive:true});

function _ttsWebSpeech(text){
  if(!window.speechSynthesis || !text){ _ttsRelease(); _ttsFlush(); return; }
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'fr-FR'; utt.rate = 1.05; utt.pitch = 1.0;
  utt.onend   = function(){ _ttsRelease(); _ttsFlush(); };
  utt.onerror = function(){ _ttsRelease(); _ttsFlush(); };
  window.speechSynthesis.speak(utt);
}

function _ttsFlush(){
  if(_ttsBusy || !_ttsQueue.length) return;
  var text = _ttsQueue.shift();
  _ttsBusy = true;
  var bar = document.getElementById('jv-speaking-bar');
  if(bar) bar.classList.add('active');
  // AbortController + setTimeout — remplace AbortSignal.timeout() (compat universelle)
  var _ac = new AbortController();
  var _fetchTmo = setTimeout(function(){ _ac.abort(); }, _TTS_TMO);
  _ttsWdog = setTimeout(function(){ _ttsRelease(); _ttsFlush(); }, _TTS_TMO + 10000);
  // ── /api/tts → ArrayBuffer → AudioContext.decodeAudioData → lecture sans restriction autoplay ──
  fetch(JV_URL + '/api/tts', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({text: text}),
    signal: _ac.signal
  })
  .then(function(r){ clearTimeout(_fetchTmo); if(!r.ok) throw new Error('tts_err'); return r.arrayBuffer(); })
  .then(function(buf){
    var ctx = _getAudioCtx();
    return ctx.resume().then(function(){ return ctx.decodeAudioData(buf); });
  })
  .then(function(audioBuffer){
    var ctx = _getAudioCtx();
    var src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.onended = function(){ _ttsRelease(); _ttsFlush(); };
    src.start(0);
  })
  .catch(function(){
    clearTimeout(_fetchTmo);
    // Annuler le watchdog — _ttsWebSpeech gère sa propre fin via _ttsRelease()
    // Sans ce clear, _ttsWdog firerait 10s après l'abort et démarrerait l'item suivant
    // pendant que Web Speech joue encore → double flux audio
    if(_ttsWdog){ clearTimeout(_ttsWdog); _ttsWdog=null; }
    _ttsWebSpeech(text);
  });
}

function _cleanForTts(text){
  // Supprime le markdown pour que le TTS prononce naturellement
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, ''); // raisonnement interne phi4-reasoning
  text = text.replace(/```[\s\S]*?```/g, '');            // blocs code
  text = text.replace(/`([^`]+)`/g, '$1');             // inline code
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');         // **gras**
  text = text.replace(/__(.+?)__/g, '$1');             // __gras__
  text = text.replace(/\*(.+?)\*/g, '$1');             // *italique*
  text = text.replace(/_(.+?)_/g, '$1');               // _italique_
  text = text.replace(/~~(.+?)~~/g, '$1');             // ~~barré~~
  text = text.replace(/^#{1,6}\s+/gm, '');            // titres #
  text = text.replace(/^\s*\d+\.\s+/gm, '');          // listes 1. 2.
  text = text.replace(/^\s*[-*+]\s+/gm, '');          // puces - * +
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1');// liens
  text = text.replace(/!\[[^\]]*\]\([^\)]+\)/g,'');   // images
  text = text.replace(/\|/g, ' ');                     // tableaux
  text = text.replace(/^\s*[-=*_]{3,}\s*$/gm, '');   // séparateurs
  text = text.replace(/^\s*>\s*/gm, '');              // citations
  text = text.replace(/[*_]{1,3}/g, '');              // résidus
  text = text.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, '$1 point $2 point $3 point $4'); // IPs lisibles
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function speakText(text, force){
  if((!_ttsEnabled && !force) || (!_online && !force) || !text) return;
  // Vider la queue si trop pleine (évite rafale de messages)
  if(_ttsQueue.length >= _TTS_MAX_Q) _ttsQueue = _ttsQueue.slice(-1);
  _ttsQueue.push(_cleanForTts(text));
  _ttsFlush();
}
window._jvSpeak = speakText;
window.pingJarvis = pingJarvis;
// ── Sync post-render — appelé par render() après chaque g.innerHTML='' ───────
window._jvAfterRender = function(){
  updateBadge();
  updateFab();
  if(_online){ updateSecTile(_SEC_DATA); updateProTile(_PRO_DATA); }
};

function toggleTts(){
  _ttsEnabled = !_ttsEnabled;
  localStorage.setItem(_LS_KEYS.SOC_AI_TTS, _ttsEnabled ? 'on' : 'off');
  var btn = document.getElementById('jv-tts-toggle');
  if(btn) btn.className = 'jv-tts-btn' + (_ttsEnabled?' active':'');
}
window._jvToggleTts = toggleTts;

