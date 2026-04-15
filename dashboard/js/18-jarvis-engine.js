'use strict';
// ── 18-jarvis-engine.js — §9+§10 (DT-09 — 2026-04-13) ──────────────
function showThinking(){
  var msgsDiv = document.getElementById('jv-msgs');
  if(!msgsDiv) return;
  var el = document.createElement('div');
  el.className = 'jv-thinking'; el.id = 'jv-thinking-el';
  el.innerHTML = '<span>JARVIS</span><span class="jv-dot-1"></span><span class="jv-dot-2"></span><span class="jv-dot-3"></span>';
  msgsDiv.appendChild(el);
  msgsDiv.scrollTop = msgsDiv.scrollHeight;
}
function removeThinking(){ var el=document.getElementById('jv-thinking-el'); if(el)el.remove(); }
function updateSendBtn(){
  var b=document.getElementById('jv-send');
  var c=document.getElementById('jv-cancel');
  if(b) b.disabled=_thinking||!_online;
  if(c) _thinking ? c.classList.add('visible') : c.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════════
// §9 — UI HELPERS & CYCLE DE VIE
// ═══════════════════════════════════════════════════════════════
function ensureOverlay(){
  if(document.getElementById('jv-overlay')) return;
  var ov = document.createElement('div');
  ov.id = 'jv-overlay';
  ov.addEventListener('click', function(){ closePanel(); });
  document.body.appendChild(ov);
}
function closePanel(){
  var panel = document.getElementById('jarvis-panel');
  var ov    = document.getElementById('jv-overlay');
  var fab   = document.getElementById('jarvis-fab');
  if(panel) panel.classList.remove('open');
  if(ov)    ov.classList.remove('open');
  if(fab)   fab.classList.remove('open');
}
function openPanel(){
  ensureOverlay();
  var panel = document.getElementById('jarvis-panel');
  var ov    = document.getElementById('jv-overlay');
  var fab   = document.getElementById('jarvis-fab');
  if(!panel) return;
  if(!_online){ checkNow(); }
  ov.classList.add('open');
  panel.classList.add('open');
  if(fab) fab.classList.add('open');
  updateStatusLbl();
  if(!_msgs.length) welcomeMsg();
  setTimeout(function(){ var inp=document.getElementById('jv-input'); if(inp)inp.focus(); },200);
}
// ── Panel toggle ──────────────────────────────────────────────
function togglePanel(){
  var panel = document.getElementById('jarvis-panel');
  if(!panel) return;
  panel.classList.contains('open') ? closePanel() : openPanel();
}
window._jvClose  = function(){ closePanel(); };
window._jvSend   = function(){ sendMessage(); };
window._jvCancel = function(){
  // Stoppe la génération LLM
  if(_abortCtrl){ try{ _abortCtrl.abort(); }catch(e){console.error('[SOC]',e);} _abortCtrl=null; }
  // Stoppe le TTS
  stopSpeak();
  // Remet l'état proprement
  removeThinking();
  _thinking = false;
  _ttsSingleShot = false;
  updateSendBtn();
  // Marque le dernier message streaming comme annulé
  var streaming = document.querySelector('#jv-msgs .jv-msg.streaming');
  if(streaming){
    streaming.classList.remove('streaming');
    var lbl = streaming.querySelector('.jv-msg-lbl');
    if(lbl) lbl.innerHTML += ' <span style="color:var(--red);font-size:var(--fs-xs)">— annulé</span>';
    addSpeakBtn(streaming);
  }
};

function welcomeMsg(){
  // N'afficher que si aucun message en cours (évite conflit avec routines)
  if(_thinking) return;
  var d = document.getElementById('jv-msgs');
  if(d && d.children.length) return;
  appendMsg('jarvis', 'Bonjour. Je suis JARVIS, votre assistant IA de sécurité. Je peux analyser les données de votre SOC en temps réel et vous fournir des recommandations. Que puis-je faire pour vous ?');
}

// ── Enabled toggle ────────────────────────────────────────────
function toggleEnabled(){
  _enabled = !_enabled;
  localStorage.setItem(_LS_KEYS.SOC_AI, _enabled ? 'on' : 'off');
  updateBadge();
  updateFab();
  if(_enabled) checkNow();
}

// ── Online/offline ────────────────────────────────────────────
function setOnline(val){
  _online = val; window._jvOnline = val;
  updateBadge();
  updateFab();
  updateStatusLbl();
  updateSendBtn();
  // Badges sec/pro
  if(!val){
    var sb=document.getElementById('sec-badge');
    if(sb){ sb.className='sec-badge'; sb.textContent='⬡ JARVIS OFFLINE'; sb.style.background=''; sb.style.borderColor=''; sb.style.color=''; }
    var pb=document.getElementById('pro-badge');
    if(pb){ pb.className='pro-badge pro-badge-offline'; pb.textContent='⬡ JARVIS OFFLINE'; }
    // Vider la queue TTS + libérer le lock si JARVIS passe offline
    _ttsQueue = []; _ttsRelease();
  }
  // Bouton DÉTAIL COMPLET — visible seulement si online
  var jbd=document.getElementById('jv-btn-detail');
  if(jbd) jbd.style.display = val ? 'block' : 'none';
  // Sync _dcJarvisState (chaîne défensive + XDR)
  if(typeof window._dcJarvisState !== 'undefined'){
    var st=window._jvLastStats||{};
    window._dcJarvisState.available=val;
    if(val){
      window._dcJarvisState.model=st.model||st.llm_model||st.active_model||window._dcJarvisState.model||'';
      window._dcJarvisState.soc_engine_active=!!(st.soc_engine_active||st.soc_engine||_enabled);
    }
  }
  // Sync chaîne défensive — nœud [data-dcid="jarvis_ai"]
  var jnode=document.querySelector('[data-dcid="jarvis_ai"]');
  if(jnode){
    if(val){
      jnode.classList.remove('dc-down');
      var jbdg=jnode.querySelector('.dc-branch-bdg');
      if(jbdg)jbdg.innerHTML='<span class="dc-badge-ok" style="font-size:calc(var(--fs-xs) - 2px);padding:.02rem .25rem">ACTIF</span>';
      jnode.style.animation='dc-pulse-act 5s ease-in-out infinite';
      jnode.style.setProperty('--dc-pa','3px');
    } else {
      jnode.classList.add('dc-down');
      var jbdg2=jnode.querySelector('.dc-branch-bdg');
      if(jbdg2)jbdg2.innerHTML='<span class="dc-badge-down" style="font-size:calc(var(--fs-xs) - 2px);padding:.02rem .25rem">DOWN</span>';
      jnode.style.animation='';
    }
  }
}

function updateBadge(){
  var b = document.getElementById('jarvis-badge');
  var lbl = document.getElementById('jv-lbl');
  if(!b) return;
  b.className = (!_enabled?'disabled':_online?'online':'');
  if(lbl) lbl.textContent = '⬡ JARVIS' + (!_enabled?' [OFF]':_online?' ONLINE':' OFFLINE');
  var tst = document.getElementById('jv-tile-st');
  if(tst){
    tst.className = 'jv-tile-st' + (!_enabled?' disabled':_online?' online':' offline');
    tst.textContent = '⬡ ' + (!_enabled?'DÉSACTIVÉ':_online?'ONLINE':'OFFLINE');
  }
}

function updateFab(){
  var fab = document.getElementById('jarvis-fab');
  if(!fab) return;
  fab.style.display = _online ? 'flex' : 'none';
}

function updateStatusLbl(){
  var el = document.getElementById('jv-status-lbl');
  if(!el) return;
  el.textContent = _online ? 'phi4:14b · RTX 5080' : 'HORS LIGNE';
  el.style.color  = _online ? 'rgba(0,255,136,0.5)' : 'rgba(255,59,92,0.5)';
}

// ── Availability check — vérifie une vraie réponse JARVIS ──────
function checkNow(){
  fetch(JV_URL + '/api/stats', {
    signal: AbortSignal.timeout(5000),
    mode: 'cors'
  })
  .then(function(r){
    if(!r.ok){ setOnline(false); return null; }
    return r.json();
  })
  .then(function(data){
    // JARVIS est online dès qu'il répond HTTP 200 — les données GPU sont optionnelles
    if(data){
      setOnline(true);
      fetchSecStat();
      fetchSocActions();
      // GPU/stats disponibles — màj tuiles spécifiques
      if(data.name || typeof data.gpu_util !== 'undefined'){
        window._jvLastStats = data;
        updateGpuTile(data);
        var gpuShort = (data.name||'').replace('NVIDIA GeForce ','').replace('NVIDIA ','');
        var modelEl = document.getElementById('jv-tile-model');
        if(modelEl) modelEl.textContent = (data.model||'phi4:14b') + ' · ' + (gpuShort||'RTX 5080');
        _updateJvSysBar(data);
      }
    } else {
      setOnline(false);
    }
  })
  .catch(function(e){ console.warn('[JARVIS] checkNow FAILED:', e && (e.name+': '+e.message)); setOnline(false); });
}

// ── GPU tile live — injecte/màj la carte GPU depuis données JARVIS /api/stats ──
function updateGpuTile(data){
  var memTotal = data.mem_total||0;
  var memUsed  = data.mem_used||0;
  var wdGpu = {
    name:          data.name||'',
    usage:         data.gpu_util||0,
    temp:          (typeof data.temp === 'number') ? data.temp : null,
    vram_used_mb:  Math.round(memUsed*1024),
    vram_total_mb: Math.round(memTotal*1024),
    vram_pct:      memTotal>0 ? Math.round(memUsed*100/memTotal) : 0,
    power_w:       data.power_draw||null,
    power_limit_w: data.power_limit||null,
    power_pct:     (data.power_draw&&data.power_limit&&data.power_limit>0) ? Math.round(data.power_draw*100/data.power_limit) : null,
    fan_pct:       (data.fan!=null) ? data.fan : null,
    clock_gpu_mhz: data.clk_gpu||null
  };
  // Mise à jour _lastData pour openGpuModal
  if(window._lastData){
    if(!window._lastData.windows_disk) window._lastData.windows_disk = {available:true};
    window._lastData.windows_disk.gpu = wdGpu;
  }
  // Construire le HTML de la carte
  var gpuU=wdGpu.usage, gpuVP=wdGpu.vram_pct;
  var gpuVU=Math.round(wdGpu.vram_used_mb/1024*10)/10, gpuVT=Math.round(wdGpu.vram_total_mb/1024*10)/10;
  var gpuUC=gpuU>80?'pb-r':gpuU>60?'pb-y':'pb-g';
  var gpuVC=gpuVP>80?'pb-r':gpuVP>60?'pb-y':'pb-g';
  var gpuPC=wdGpu.power_pct!=null?(wdGpu.power_pct>85?'pb-r':wdGpu.power_pct>60?'pb-y':'pb-g'):'';
  var gpuPowerHtml=wdGpu.power_pct!=null
    ?'<div class="pb-row"><div class="pb-hdr"><span style="color:var(--amber)">POWER</span><span>'+(wdGpu.power_w||0).toFixed(0)+'W / '+(wdGpu.power_limit_w||0).toFixed(0)+'W ('+wdGpu.power_pct+'%)</span></div>'
      +'<div class="pb-track"><div class="pb '+gpuPC+'" style="width:'+Math.min(wdGpu.power_pct,100)+'%;background:linear-gradient(90deg,rgba(120,60,0,.8),var(--amber))"></div></div></div>'
    :'';
  var gpuFanClk='';
  if(wdGpu.fan_pct!=null) gpuFanClk+='<span style="color:var(--muted)">Fan <span style="color:var(--text)">'+wdGpu.fan_pct+'%</span></span>';
  if(wdGpu.clock_gpu_mhz!=null) gpuFanClk+='<span style="color:var(--muted)">Clk <span style="color:var(--purple)">'+wdGpu.clock_gpu_mhz+' MHz</span></span>';
  var fanClkHtml=gpuFanClk?'<div style="display:flex;gap:1rem;font-size:var(--fs-xs);margin-top:.2rem;padding-top:.25rem;border-top:1px solid rgba(255,255,255,0.05)">'+gpuFanClk+'</div>':'';
  var h='<div class="card" id="win-gpu-card" data-gpu-modal="1" style="cursor:pointer;border-color:rgba(191,95,255,0.2)">'
   +'<div class="corner tl" style="border-color:rgba(191,95,255,0.4)"></div>'
   +'<div class="corner tr" style="border-color:rgba(191,95,255,0.4)"></div>'
   +'<div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬡</span>GPU — INTELLIGENCE ARTIFICIELLE</div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.35rem;font-family:Courier New,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc((wdGpu.name||'').substring(0,36))+'</div>'
   +'<div class="pb-row"><div class="pb-hdr"><span style="color:var(--purple)">COMPUTE</span><span>'+gpuU+'%'+(wdGpu.temp!=null?' · '+wdGpu.temp+'°C':'')+'</span></div>'
   +'<div class="pb-track"><div class="pb '+gpuUC+'" style="width:'+gpuU+'%;background:linear-gradient(90deg,rgba(100,0,200,.8),var(--purple))"></div></div></div>'
   +'<div class="pb-row"><div class="pb-hdr"><span style="color:var(--cyan)">VRAM</span><span>'+gpuVP+'% · '+gpuVU+'/'+gpuVT+' Go</span></div>'
   +'<div class="pb-track"><div class="pb '+gpuVC+'" style="width:'+gpuVP+'%"></div></div></div>'
   +gpuPowerHtml+fanClkHtml
   +'</div></div>';
  // Insérer ou remplacer la carte dans le DOM
  var existing = document.getElementById('win-gpu-card');
  if(existing){
    existing.outerHTML = h;
  } else {
    // Insérer avant #jv-tile (tuile JARVIS) dans la section INFRASTRUCTURE
    var jvTile = document.getElementById('jv-tile');
    if(jvTile) jvTile.insertAdjacentHTML('beforebegin', h);
  }
  // Accumulation historique GPU (30s/point)
  _winGpuHistory.push(wdGpu.usage); if(_winGpuHistory.length>_winHistMax)_winGpuHistory.shift();
  _winVramHistory.push(wdGpu.vram_pct); if(_winVramHistory.length>_winHistMax)_winVramHistory.shift();
  // Rebind click → openGpuModal
  var card = document.getElementById('win-gpu-card');
  if(card) card.onclick = function(e){ e.stopPropagation(); if(window._lastData) openGpuModal(window._lastData.windows_disk||{}); };
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  injectDOM();
  checkNow();
  window._jvEngineInt = setInterval(checkNow, JV_CHECK);
  _startJvCountdown();
});

// ═══════════════════════════════════════════════════════════════
// §10 — AUTO ENGINE
//       Analyse automatique, alertes seuils, ban auto,
//       résumé quotidien, restart services, voix threat
//       Export unique : window._jvAutoCheck(data) ← 17-fetch.js
// ═══════════════════════════════════════════════════════════════

// ── Persistance seuils ─────────────────────────────────────────
_autoThresh = (function(){
  try{ return JSON.parse(localStorage.getItem(_LS_KEYS.JV_THRESH)||'{}'); }catch(e){ return {}; }
})();
function _saveThresh(){ try{ localStorage.setItem(_LS_KEYS.JV_THRESH,JSON.stringify(_autoThresh)); }catch(e){console.error('[SOC]',e);} }
if(!_autoThresh.cpu)       _autoThresh.cpu       = 90;
if(!_autoThresh.banned)    _autoThresh.banned     = 100;
if(!_autoThresh.errorRate) _autoThresh.errorRate  = 5;
if(!_autoThresh.summaryHr)    _autoThresh.summaryHr    = 8;
if(!_autoThresh.attackDelta)  _autoThresh.attackDelta  = 15;
if(!_autoThresh.banMinCount)  _autoThresh.banMinCount  = 30;  // req/15min stages SCAN/BRUTE (logs nginx)
if(!_autoThresh.reqPerHour)   _autoThresh.reqPerHour   = 500; // seuil req/h heure courante → alerte trafic
if(!_autoThresh.threatVoice)  _autoThresh.threatVoice  = true; // voix si Threat ÉLEVÉ/CRITIQUE
if(_autoThresh.banNhMin===undefined)     _autoThresh.banNhMin     = 1;   // hits honeypot → ban immédiat
if(_autoThresh.banExploitMin===undefined) _autoThresh.banExploitMin = 1; // stage EXPLOIT → ban immédiat (CVE = 1 tentative suffit)
if(!_autoThresh.banStages)    _autoThresh.banStages    = ['EXPLOIT','BRUTE'];
if(!_autoThresh.autoRestart)  _autoThresh.autoRestart  = true; // restart service si DOWN
if(_autoThresh.voiceMinScore===undefined)   _autoThresh.voiceMinScore   = 5;  // FULL ALERTE par défaut
if(_autoThresh.alertCooldownMin===undefined) _autoThresh.alertCooldownMin = 1;  // cooldown 1min
// Migration v3.89+ : upgrade localStorage existant vers FULL ALERTE
if(_autoThresh.voiceMinScore > 5 || _autoThresh.alertCooldownMin > 1){
  _autoThresh.cpu            = 70;
  _autoThresh.banned         = 20;
  _autoThresh.errorRate      = 1;
  _autoThresh.attackDelta    = 5;
  _autoThresh.reqPerHour     = 200;
  _autoThresh.banMinCount    = 10;
  _autoThresh.voiceMinScore  = 5;
  _autoThresh.alertCooldownMin = 1;
  _autoThresh.threatVoice    = true;
  _saveThresh();
}

var _autoState = {
  lastAttackTotal:  null,
  lastAnalysisAt:   0,
  analysisInterval: 5*60*1000,
  lastAlerts:       (function(){
    var raw=JSON.parse(localStorage.getItem(_LS_KEYS.JV_LAST_ALERTS)||'{}');
    var now=Date.now(), cutoff=24*60*60*1000; // purge entrées > 24h
    var clean={};
    Object.keys(raw).forEach(function(k){ if(now-raw[k]<cutoff) clean[k]=raw[k]; });
    return clean;
  })(),
  alertCooldown:    10*60*1000,
  lastSummaryDate:  localStorage.getItem(_LS_KEYS.JV_LAST_SUMMARY)||'',
  summaryResult:    localStorage.getItem(_LS_KEYS.JV_SUMMARY_TEXT)||''
};

// IPs auto-bannies cette session (partagé render() ↔ IIFE via window._kcAutoBanned)
window._kcAutoBanned=window._kcAutoBanned||{}; var _autoBanned=window._kcAutoBanned;
// Cooldown restart par service (ms timestamp dernier restart)
var _autoSvcRestart = {};

// ── Daily report card ──────────────────────────────────────────
function ensureDailyCard(){
  if(document.getElementById('jv-daily-card')) return;
  var hdrRight = document.querySelector('.header-right');
  if(!hdrRight) return;
  var card = document.createElement('div');
  card.id = 'jv-daily-card';
  card.title = 'Rapport quotidien JARVIS — cliquer pour relire';
  card.innerHTML = '&#9671; RAPPORT DU JOUR';
  card.addEventListener('click', openDailyReport);
  var badge = document.getElementById('jarvis-badge');
  if(badge) hdrRight.insertBefore(card, badge);
  else hdrRight.appendChild(card);
}
function openDailyReport(){
  if(!_autoState.summaryResult) return;
  openPanel();
  clearChat();
  appendMsg('jarvis', _autoState.summaryResult);
  if(_online && _enabled) speakText(_autoState.summaryResult, true);
}

// ── Retry fetch helper (SSH/ban/restart) — 1 retry à +5s si réseau KO ──
// Injecte automatiquement X-Requested-With sur toutes les routes SOC sensibles (anti-CSRF)
function _socRetryFetch(url, opts, onDone){
  var o=Object.assign({},opts);
  o.headers=Object.assign({'X-Requested-With':'XMLHttpRequest'},opts.headers||{});
  if(!o.signal) o.signal=AbortSignal.timeout(10000);
  fetch(url, o)
    .then(function(r){return r.json();}).then(onDone)
    .catch(function(){
      setTimeout(function(){
        var o2=Object.assign({},o,{signal:AbortSignal.timeout(10000)});
        fetch(url, o2).then(function(r){return r.json();}).then(onDone)
          .catch(function(e){console.warn('[SOC] retry failed:',url,e);});
      }, 5000);
    });
}

// ── Stream helper (partagé analyse + résumé) ───────────────────
function streamFromJarvis(prompt, onDone){
  var ctx = '[CONTEXTE SOC EN TEMPS RÉEL]\n' + buildContext() + '\n\n[DEMANDE]\n';
  fetch(JV_URL+'/api/chat',{
    method:'POST', mode:'cors',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({history:[{role:'user', content: ctx+prompt}], soc_ctx_injected: true, num_predict: _socNumPredict()}),
    signal: AbortSignal.timeout(90000)
  }).then(function(r){
    var reader = r.body.getReader(), decoder = new TextDecoder();
    var buf = '', fullText = '', fin = false;
    function done(){
      if(fin) return; fin = true;
      // Filtrer <think> — source unique : affiché = lu
      var clean = fullText.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
      onDone(clean || fullText);
    }
    function read(){
      reader.read().then(function(res){
        if(res.done){ done(); return; }
        buf += decoder.decode(res.value,{stream:true});
        var lines = buf.split('\n'); buf = lines.pop();
        lines.forEach(function(line){
          if(!line.startsWith('data:')) return;
          var d = line.slice(5).trim();
          if(d==='[DONE]'){ done(); return; }
          try{
            var obj = JSON.parse(d);
            if(obj.type && obj.type!=='token') return;
            fullText += obj.token||obj.text||obj.content||'';
          }catch(e){console.error('[SOC]',e);}
        });
        read();
      }).catch(done);
    }
    read();
  }).catch(function(e){ console.warn('[JARVIS] streamFromJarvis failed:',e); });
}

// ── 1. Auto-analyse des attaques ───────────────────────────────
function runAutoAnalysis(data){
  if(!_online||!_enabled||_thinking) return;
  var t = data.traffic||{}, f2b = data.fail2ban||{};
  var current = (t.total_requests||0) + (f2b.total_banned||0);
  var now = Date.now();
  if(_autoState.lastAttackTotal === null){ _autoState.lastAttackTotal = current; return; }
  var delta   = current - _autoState.lastAttackTotal;
  var elapsed = now - _autoState.lastAnalysisAt;
  if(delta >= _autoThresh.attackDelta && elapsed >= _autoState.analysisInterval){
    _autoState.lastAnalysisAt   = now;
    _autoState.lastAttackTotal  = current;
    var prompt = 'Activité anormale détectée : +'+delta+' événements depuis la dernière analyse. '
      +'Analyse : origine probable, niveau de risque, action recommandée si nécessaire.';
    streamFromJarvis(prompt, function(text){
      if(!text) return;
      saveToHistory('⚡ Auto-analyse', text);
      updateJarvisTile('analyse', text);
      speakText(text, true);
    });
  }
}

// ── 2. Alertes seuils critiques ────────────────────────────────
function checkThresholds(data){
  if(!_online||!_enabled) return;
  var now = Date.now(), cd = (_autoThresh.alertCooldownMin||10)*60*1000;
  var wd = data.windows_disk||{};
  var cpu = (wd.cpu||{}).usage||0;
  if(cpu >= _autoThresh.cpu && _jvCanAlert('cpu',now,cd))
    _jvDoAlert('cpu','CPU Windows à '+cpu+'% — seuil '+_autoThresh.cpu+'% dépassé.',now);
  var banned = (data.fail2ban||{}).total_banned||0;
  if(banned >= _autoThresh.banned && _jvCanAlert('banned',now,cd))
    _jvDoAlert('banned', banned+' IPs bannies — seuil '+_autoThresh.banned+' dépassé.',now);
  var errRate = (data.traffic||{}).error_rate||0;
  if(errRate >= _autoThresh.errorRate && _jvCanAlert('errRate',now,cd))
    _jvDoAlert('errRate','Erreurs 5xx à '+errRate+'% — seuil '+_autoThresh.errorRate+'% dépassé.',now);
}

// ── 3. Résumé quotidien ────────────────────────────────────────
function checkDailySummary(){
  if(!_online||!_enabled) return;
  var now = new Date(), today = now.toISOString().slice(0,10);
  if(now.getHours() !== _autoThresh.summaryHr) return;
  if(_autoState.lastSummaryDate === today) return;
  _autoState.lastSummaryDate = today;
  localStorage.setItem(_LS_KEYS.JV_LAST_SUMMARY, today);
  var prompt = 'Génère un résumé quotidien de sécurité. '
    +'Couvre : niveau de menace global, activité récente, état des défenses, ressources système, recommandation du jour. '
    +'Parle naturellement, comme un briefing matinal.';
  streamFromJarvis(prompt, function(text){
    if(!text) return;
    saveToHistory('📋 Résumé quotidien', text);
    _autoState.summaryResult = text;
    localStorage.setItem(_LS_KEYS.JV_SUMMARY_TEXT, text);
    ensureDailyCard();
    var card = document.getElementById('jv-daily-card');
    if(card) card.classList.add('visible');
    updateJarvisTile('resume', text);
    speakText(text, true);
  });
}

// ── Presets JARVIS ─────────────────────────────────────────────
var _jvPresets = {
  silencieux:{
    label:'🔇 SILENCIEUX', col:'rgba(122,154,184,0.35)',
    thresh:{cpu:95,banned:200,errorRate:10,attackDelta:30,reqPerHour:1000,banMinCount:50,banNhMin:1,banExploitMin:1,autoRestart:true,threatVoice:true,voiceMinScore:70,alertCooldownMin:30,summaryHr:8},
    llm:{temperature:0.7,top_p:0.9,top_k:40,repeat_penalty:1.1,num_predict:1024,num_ctx:4096}
  },
  standard:{
    label:'⚖ STANDARD', col:'rgba(0,217,255,0.4)',
    thresh:{cpu:90,banned:100,errorRate:5,attackDelta:15,reqPerHour:500,banMinCount:30,banNhMin:1,banExploitMin:1,autoRestart:true,threatVoice:true,voiceMinScore:50,alertCooldownMin:10,summaryHr:8},
    llm:{temperature:0.7,top_p:0.9,top_k:40,repeat_penalty:1.1,num_predict:1024,num_ctx:4096}
  },
  verbeux:{
    label:'🔊 VERBEUX', col:'rgba(255,170,0,0.45)',
    thresh:{cpu:80,banned:50,errorRate:3,attackDelta:10,reqPerHour:300,banMinCount:20,banNhMin:1,banExploitMin:1,autoRestart:true,threatVoice:true,voiceMinScore:30,alertCooldownMin:5,summaryHr:8},
    llm:{temperature:0.5,top_p:0.85,top_k:30,repeat_penalty:1.1,num_predict:2048,num_ctx:4096}
  },
  fullalerte:{
    label:'🚨 FULL ALERTE', col:'rgba(255,59,92,0.45)',
    thresh:{cpu:70,banned:20,errorRate:1,attackDelta:5,reqPerHour:200,banMinCount:10,banNhMin:1,banExploitMin:1,autoRestart:true,threatVoice:true,voiceMinScore:5,alertCooldownMin:1,summaryHr:8},
    llm:{temperature:0.4,top_p:0.85,top_k:30,repeat_penalty:1.05,num_predict:4096,num_ctx:8192}
  }
};
function _jvHighlightPreset(name){
  Object.keys(_jvPresets).forEach(function(k){
    var btn=document.getElementById('jv-preset-'+k);
    if(!btn) return;
    btn.classList.toggle('active', k===name);
    btn.style.opacity = k===name ? '1' : '0.45';
  });
}
window._jvApplyPreset = function(name){
  var p = _jvPresets[name]; if(!p) return;
  Object.assign(_autoThresh, p.thresh);
  _saveThresh();
  _syncThreshSliders();
  fetch(JV_URL+'/api/llm-params',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p.llm),signal:AbortSignal.timeout(5000)}).catch(function(e){ console.warn('[JARVIS] applyPreset llm-params failed:',e); });
  _jvHighlightPreset(name);
  var st=document.getElementById('jv-thresh-status');
  if(st){st.textContent='✓ Preset '+p.label.replace(/[^ -~]/g,'').trim()+' appliqué';st.style.display='inline';setTimeout(function(){st.style.display='none';st.textContent='✓ Seuils sauvés';},_UI_STATUS_MS);}
};

// ── UI seuils dans ⚙ Settings panel ───────────────────────────
function buildThreshSection(){
  var sp = document.getElementById('jv-settings-panel');
  if(!sp || document.getElementById('jv-thresh-section')) return;
  var sec = document.createElement('div');
  sec.id = 'jv-thresh-section';
  sec.className = 'jv-thresh-section';
  var presetHtml='<div class="jv-thresh-title" style="margin-bottom:.35rem">🎚 Profils rapides</div>'
    +'<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.8rem">';
  Object.keys(_jvPresets).forEach(function(k){
    var p=_jvPresets[k];
    presetHtml+='<button id="jv-preset-'+k+'" class="jv-preset-btn" style="border-color:'+p.col+';color:'+p.col.replace(/[\d.]+\)$/,'1)')+'">'+p.label+'</button>';
  });
  presetHtml+='</div>';
  sec.innerHTML = presetHtml
    +'<div class="jv-thresh-title">⚡ Seuils d\'alerte automatique</div>'
    +'<div class="jv-set-row">'
    +'<div class="jv-set-item"><div class="jv-set-lbl">CPU Windows % <span id="tv-cpu">'+_autoThresh.cpu+'</span></div><input class="jv-set-range" id="tr-cpu" type="range" min="50" max="99" step="1" value="'+_autoThresh.cpu+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl">IPs bannies <span id="tv-ban">'+_autoThresh.banned+'</span></div><input class="jv-set-range" id="tr-ban" type="range" min="10" max="500" step="10" value="'+_autoThresh.banned+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl">Erreurs 5xx % <span id="tv-err">'+_autoThresh.errorRate+'</span></div><input class="jv-set-range" id="tr-err" type="range" min="1" max="20" step="1" value="'+_autoThresh.errorRate+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl">+X événements → analyse <span id="tv-atk">'+_autoThresh.attackDelta+'</span></div><input class="jv-set-range" id="tr-atk" type="range" min="5" max="100" step="5" value="'+_autoThresh.attackDelta+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl">Résumé quotidien heure <span id="tv-hr">'+_autoThresh.summaryHr+'h</span></div><input class="jv-set-range" id="tr-hr" type="range" min="0" max="23" step="1" value="'+_autoThresh.summaryHr+'"></div>'
    +'</div>'
    +'<div class="jv-thresh-title" style="margin-top:.6rem">⬡ Réponse proactive automatique</div>'
    +'<div class="jv-set-row">'
    +'<div class="jv-set-item"><div class="jv-set-lbl">Auto-ban logs nginx — min req/15min <span id="tv-bmc">'+_autoThresh.banMinCount+'</span></div><input class="jv-set-range" id="tr-bmc" type="range" min="10" max="200" step="5" value="'+_autoThresh.banMinCount+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl">Auto-ban honeypot — hits min <span id="tv-nhm">'+_autoThresh.banNhMin+'</span></div><input class="jv-set-range" id="tr-nhm" type="range" min="1" max="10" step="1" value="'+_autoThresh.banNhMin+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl" style="color:var(--orange)">Auto-ban EXPLOIT CVE — min hits <span id="tv-exm">'+(_autoThresh.banExploitMin!==undefined?_autoThresh.banExploitMin:1)+'</span></div><input class="jv-set-range" id="tr-exm" type="range" min="1" max="10" step="1" value="'+(_autoThresh.banExploitMin!==undefined?_autoThresh.banExploitMin:1)+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl" style="display:flex;align-items:center;gap:.5rem">Auto-restart service DOWN <input type="checkbox" id="tr-rst" '+((_autoThresh.autoRestart)?'checked':'')+' style="accent-color:var(--green);width:14px;height:14px"></div></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl">Alerte trafic req/h <span id="tv-rph">'+_autoThresh.reqPerHour+'</span></div><input class="jv-set-range" id="tr-rph" type="range" min="100" max="5000" step="100" value="'+_autoThresh.reqPerHour+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl" style="display:flex;align-items:center;gap:.5rem">Voix Threat ÉLEVÉ/CRITIQUE <input type="checkbox" id="tr-tv" '+((_autoThresh.threatVoice)?'checked':'')+' style="accent-color:var(--orange);width:14px;height:14px"></div></div>'
    +'</div>'
    +'<div class="jv-thresh-title" style="margin-top:.6rem;color:rgba(0,255,136,.65)">🔊 Voix automatique</div>'
    +'<div class="jv-set-row">'
    +'<div class="jv-set-item"><div class="jv-set-lbl">Score min → voix Threat <span id="tv-vms" style="color:var(--green)">'+_autoThresh.voiceMinScore+'</span> <span id="tv-vms-lbl" style="color:rgba(255,255,255,.3);font-size:var(--fs-xs)">'+(_autoThresh.voiceMinScore>=70?'CRITIQUE':_autoThresh.voiceMinScore>=50?'ÉLEVÉ':_autoThresh.voiceMinScore>=30?'MODÉRÉ':'QUASI-TOUT')+'</span></div>'
    +'<input class="jv-set-range" id="tr-vms" type="range" min="5" max="70" step="5" value="'+_autoThresh.voiceMinScore+'"></div>'
    +'<div class="jv-set-item"><div class="jv-set-lbl">Cooldown alertes <span id="tv-cdm" style="color:var(--green)">'+_autoThresh.alertCooldownMin+'</span> min</div>'
    +'<input class="jv-set-range" id="tr-cdm" type="range" min="1" max="30" step="1" value="'+_autoThresh.alertCooldownMin+'"></div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:.6rem;justify-content:flex-end;margin-top:.35rem">'
    +'<span class="jv-set-status" id="jv-thresh-status">✓ Seuils sauvés</span>'
    +'<button id="jv-thresh-save-btn" class="jv-set-save" style="background:rgba(255,59,92,0.09);border-color:rgba(255,59,92,0.3);color:var(--red)">💾 Sauver seuils</button>'
    +'</div>';
  sp.appendChild(sec);
  // ── Bindings CSP-safe — zéro onclick/oninput inline ──────────
  // Preset buttons
  Object.keys(_jvPresets).forEach(function(k){
    var btn = document.getElementById('jv-preset-'+k);
    if(btn) btn.addEventListener('click', function(){ window._jvApplyPreset && window._jvApplyPreset(k); });
  });
  // Sauver seuils
  var saveBtn = document.getElementById('jv-thresh-save-btn');
  if(saveBtn) saveBtn.addEventListener('click', function(){ window._jvSaveThresh && window._jvSaveThresh(); });
  // Sliders seuils
  var _tb = function(id, spanId){ var el=document.getElementById(id); if(el) el.addEventListener('input', function(){ var s=document.getElementById(spanId); if(s) s.textContent=this.value; }); };
  _tb('tr-cpu','tv-cpu'); _tb('tr-ban','tv-ban'); _tb('tr-err','tv-err');
  _tb('tr-atk','tv-atk'); _tb('tr-bmc','tv-bmc'); _tb('tr-nhm','tv-nhm');
  _tb('tr-exm','tv-exm'); _tb('tr-rph','tv-rph'); _tb('tr-cdm','tv-cdm');
  var hrEl = document.getElementById('tr-hr');
  if(hrEl) hrEl.addEventListener('input', function(){ var s=document.getElementById('tv-hr'); if(s) s.textContent=this.value+'h'; });
  var vmsEl = document.getElementById('tr-vms');
  if(vmsEl) vmsEl.addEventListener('input', function(){
    var v = parseInt(this.value);
    var s=document.getElementById('tv-vms'); if(s) s.textContent=v;
    var l=document.getElementById('tv-vms-lbl'); if(l) l.textContent=v>=70?'CRITIQUE':v>=50?'ÉLEVÉ':v>=30?'MODÉRÉ':'QUASI-TOUT';
  });
}
window._jvSaveThresh = function(){
  var gi = function(id){ var el=document.getElementById(id); return el?parseInt(el.value):null; };
  var v;
  v=gi('tr-cpu');  if(v!==null) _autoThresh.cpu          = v;
  v=gi('tr-ban');  if(v!==null) _autoThresh.banned        = v;
  v=gi('tr-err');  if(v!==null) _autoThresh.errorRate     = v;
  v=gi('tr-atk');  if(v!==null) _autoThresh.attackDelta   = v;
  v=gi('tr-hr');   if(v!==null) _autoThresh.summaryHr     = v;
  v=gi('tr-bmc');  if(v!==null) _autoThresh.banMinCount    = v;
  v=gi('tr-nhm');  if(v!==null) _autoThresh.banNhMin       = v;
  v=gi('tr-exm');  if(v!==null) _autoThresh.banExploitMin  = v;
  var rstEl=document.getElementById('tr-rst');
  if(rstEl) _autoThresh.autoRestart = rstEl.checked;
  v=gi('tr-rph'); if(v!==null) _autoThresh.reqPerHour = v;
  var tvEl=document.getElementById('tr-tv');
  if(tvEl) _autoThresh.threatVoice = tvEl.checked;
  v=gi('tr-vms'); if(v!==null) _autoThresh.voiceMinScore   = v;
  v=gi('tr-cdm'); if(v!==null) _autoThresh.alertCooldownMin = v;
  _saveThresh();
  var st = document.getElementById('jv-thresh-status');
  if(st){ st.style.display='inline'; setTimeout(function(){ st.style.display='none'; },_UI_STATUS_MS); }
};

// ── Sync sliders → lecture directe localStorage (source unique de vérité) ──
function _syncThreshSliders(){
  // Relit localStorage à chaque ouverture — garantit la persistance réelle
  var t;
  try{ t=JSON.parse(localStorage.getItem(_LS_KEYS.JV_THRESH)||'{}'); }catch(e){ t={}; }
  // Fusionne avec _autoThresh pour les valeurs manquantes
  var s=Object.assign({},_autoThresh,t);
  _jvSv('tr-cpu', s.cpu);           _jvSt('tv-cpu', s.cpu);
  _jvSv('tr-ban', s.banned);        _jvSt('tv-ban', s.banned);
  _jvSv('tr-err', s.errorRate);     _jvSt('tv-err', s.errorRate);
  _jvSv('tr-atk', s.attackDelta);   _jvSt('tv-atk', s.attackDelta);
  _jvSv('tr-hr',  s.summaryHr);     _jvSt('tv-hr',  s.summaryHr+'h');
  _jvSv('tr-bmc', s.banMinCount);   _jvSt('tv-bmc', s.banMinCount);
  _jvSv('tr-nhm', s.banNhMin);      _jvSt('tv-nhm', s.banNhMin);
  _jvSv('tr-exm', s.banExploitMin); _jvSt('tv-exm', s.banExploitMin);
  _jvSv('tr-rph', s.reqPerHour);    _jvSt('tv-rph', s.reqPerHour);
  var rst=document.getElementById('tr-rst'); if(rst) rst.checked=!!s.autoRestart;
  var tv=document.getElementById('tr-tv');   if(tv)  tv.checked=!!s.threatVoice;
  var vms=s.voiceMinScore!==undefined?s.voiceMinScore:50;
  var cdm=s.alertCooldownMin!==undefined?s.alertCooldownMin:10;
  _jvSv('tr-vms', vms); _jvSt('tv-vms', vms);
  var lbl=document.getElementById('tv-vms-lbl');
  if(lbl) lbl.textContent=vms>=70?'CRITIQUE':vms>=50?'ÉLEVÉ':vms>=30?'MODÉRÉ':'QUASI-TOUT';
  _jvSv('tr-cdm', cdm); _jvSt('tv-cdm', cdm);
  // Synchronise aussi _autoThresh en mémoire avec les valeurs persistées
  Object.assign(_autoThresh, t);
}

// ── Patch toggle settings pour injecter la section seuils ─────
var _origToggleSettings = window._jvToggleSettings;
window._jvToggleSettings = function(){
  if(_origToggleSettings) _origToggleSettings();
  buildThreshSection();
  _syncThreshSliders();
};

// ── Auto-ban IPs EXPLOIT/BRUTE — renforcé v3.89.82+ ────────────
// Améliorations :
//   1. CVE-aware : tout scénario CrowdSec ou signature Suricata contenant un CVE
//      dans une IP BRUTE → traité comme EXPLOIT (ban immédiat, 1 hit)
//   2. Durée ban CVE : 72h (au lieu de 24h)
//   3. Subnet clustering : ≥3 IPs actives d'un même /24 → ban immédiat toute la plage
//   4. Cooldown réduit : 5min (au lieu de 15min)
function checkAutoBan(data){
  if(!_online||!_enabled) return;
  var activeIps=(data.kill_chain||{}).active_ips||[];
  var minCount      = _autoThresh.banMinCount  ||10;
  var minNh         = _autoThresh.banNhMin     ||1;
  var minExploit    = _autoThresh.banExploitMin!==undefined?_autoThresh.banExploitMin:1;
  var stages        = _autoThresh.banStages||['EXPLOIT','BRUTE'];
  var LAN=_LAN_RE;
  var svcCooldown=15*60*1000; // aligné Python 15min
  var now=Date.now();

  // Maps de contexte
  var geoMap={};
  ((data.traffic||{}).recent_geoips||[]).forEach(function(g){ if(g.ip) geoMap[g.ip]=g; });
  var csDetail=(data.crowdsec||{}).decisions_detail||{};

  // Map IP → CVE Suricata (détection croisée)
  var surCveMap={};
  ((data.suricata||{}).recent_critical||[]).forEach(function(a){
    if(!a.src_ip) return;
    var m=(a.signature||'').match(/CVE-\d{4}-\d+/i);
    if(m) surCveMap[a.src_ip]=(surCveMap[a.src_ip]||[]); // init
    if(m&&surCveMap[a.src_ip].indexOf(m[0].toUpperCase())<0) surCveMap[a.src_ip].push(m[0].toUpperCase());
    // Patterns CVE non standards dans la signature
    if(/jira|confluence|log4j|spring4shell|proxylogon|fortinet|citrix/i.test(a.signature||'')){
      if(!surCveMap[a.src_ip]) surCveMap[a.src_ip]=[];
      surCveMap[a.src_ip].push((a.signature||'').slice(0,40));
    }
  });

  // ── Subnet clustering : /24 avec ≥3 IPs actives = attaque coordonnée ──
  var sub24count={};
  activeIps.forEach(function(ipObj){
    var ip=ipObj.ip||'';
    if(!ip||LAN.test(ip)) return;
    if(csDetail[ip]||(geoMap[ip]||{}).cs_banned) return;
    var pfx=ip.split('.').slice(0,3).join('.');
    sub24count[pfx]=(sub24count[pfx]||0)+1;
  });

  // ── Boucle principale ──
  activeIps.forEach(function(ipObj){
    var ip=ipObj.ip||'';
    if(!ip||LAN.test(ip)||_isJvWhitelisted(ip)) return;
    if(stages.indexOf(ipObj.stage)<0) return;

    var geo=geoMap[ip]||{};
    if(geo.cs_banned||csDetail[ip]) return;
    if(_autoBanned[ip]&&(now-_autoBanned[ip])<svcCooldown) return;

    var srcs=ipObj.sources||[];
    var nhOnly    = srcs.length>0 && srcs.every(function(s){return s==='NH';});
    var isExploit = ipObj.stage==='EXPLOIT';

    // CVE-aware : CrowdSec scenario CVE ou signature Suricata CVE → ban immédiat
    var csScenario=(csDetail[ip]||{}).scenario||'';
    var hasCve = surCveMap[ip]&&surCveMap[ip].length>0;
    var hasCveScenario = /cve|jira|log4j|confluence|spring|proxylogon|exploit/i.test(csScenario);
    if(hasCve||hasCveScenario) isExploit=true; // force seuil 1 hit

    // Subnet clustering : /24 avec ≥3 IPs → ban immédiat (coordinated)
    var pfx=ip.split('.').slice(0,3).join('.');
    var isCoordinated = (sub24count[pfx]||0)>=3;
    if(isCoordinated) isExploit=true;

    var threshold = nhOnly ? minNh : isExploit ? minExploit : minCount;
    if((ipObj.count||0)<threshold) return;

    // ── Décision de ban ──
    _autoBanned[ip]=now;
    var cveTag  = hasCve?(surCveMap[ip][0]):(hasCveScenario?csScenario.slice(0,30):'');
    var subTag  = isCoordinated?(' /24×'+(sub24count[pfx])):'';
    var srcLabel= nhOnly?'honeypot':isExploit?('exploit CVE'+(cveTag?' '+cveTag:'')):'logs nginx';
    var banDur  = (isExploit||hasCve||hasCveScenario)?'72h':'24h'; // CVE → 72h
    var reason  = 'auto-ban SOC — '+ipObj.stage+' — '+srcLabel+subTag+' — '+ipObj.count+' détections';
    var ipSpeak = ip.replace(/\./g,' point ');
    var msg = nhOnly
      ? 'JARVIS alerte. Honeypot touché. Ban automatique. IP '+ipSpeak+'.'
      : isCoordinated&&!hasCve&&!hasCveScenario
        ? 'JARVIS alerte. Attaque coordonnée. '+sub24count[pfx]+' IPs du même sous-réseau. Ban automatique. IP '+ipSpeak+'.'
        : isExploit
          ? 'JARVIS alerte. Exploit CVE détecté. Ban automatique '+(banDur)+'. IP '+ipSpeak+'.'+(cveTag?' Scénario '+cveTag.replace(/\//g,' ')+'.'
          :'')
          : 'JARVIS alerte. Ban automatique. IP '+ipSpeak+'. '+ipObj.count+' requêtes en 15 minutes.';
    speakText(msg, true);
    _socRetryFetch(JV_URL+'/api/soc/ban-ip',{
      method:'POST',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ip:ip,reason:reason,duration:banDur})
    },function(res){
      var ok=res.ok;
      var tag=nhOnly?'[HONEYPOT] ':hasCve||hasCveScenario?'[CVE] ':isCoordinated?'[/24] ':'';
      updateJarvisTile('alerte',(ok?'✓ ':'\u2717 ')+tag+'Ban — '+ip+' ['+ipObj.stage+'] '+banDur);
      fetchSocActions();
      if(!ok) speakText('Échec du ban — '+ip+'. Vérifiez la connexion SSH.', true);
    });
  });

  // ── Suricata sév.1 CRITIQUE — IPs non capturées par Kill Chain ──
  var surRcrit=(data.suricata||{}).recent_critical||[];
  var surSeen={};
  surRcrit.forEach(function(a){
    var ip=a.src_ip||'';
    if(!ip||LAN.test(ip)||_isJvWhitelisted(ip)||surSeen[ip]) return;
    surSeen[ip]=true;
    if(csDetail[ip]) return;
    if(_autoBanned[ip]&&(now-_autoBanned[ip])<svcCooldown) return;
    _autoBanned[ip]=now;
    var sig=(a.signature||'Suricata sév.1').slice(0,60);
    var isCveSig=/CVE-\d{4}-\d+|jira|log4j|confluence/i.test(sig);
    var banDur=isCveSig?'72h':'48h';
    var reason='auto-ban SOC — Suricata sév.1 CRITIQUE — '+sig;
    var ipSpeak=ip.replace(/\./g,' point ');
    speakText('JARVIS alerte. Attaque réseau Suricata critique. Ban automatique '+(banDur)+'. IP '+ipSpeak+'.', true);
    _socRetryFetch(JV_URL+'/api/soc/ban-ip',{
      method:'POST',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ip:ip,reason:reason,duration:banDur})
    },function(res){
      updateJarvisTile('alerte',(res.ok?'✓ ':'\u2717 ')+'[SURICATA] Ban — '+ip+' '+banDur);
      fetchSocActions();
      if(!res.ok) speakText('Échec du ban Suricata — '+ip+'. Vérifiez la connexion SSH.', true);
    });
  });
}

// ── 4. Alerte trafic >500 req/h + ban auto IPs actives non bannies ─
function checkReqPerHour(data){
  if(!_online||!_enabled) return;
  var seuil = _autoThresh.reqPerHour || 500;
  var rph   = (data.traffic||{}).requests_per_hour||{};
  var now   = Date.now();
  var nowH  = new Date();
  var hKey  = nowH.getHours().toString().padStart(2,'0');
  var curVal = 0;
  Object.keys(rph).forEach(function(k){
    if(k === hKey || k.slice(-2) === hKey) curVal = Math.max(curVal, rph[k]||0);
  });
  if(curVal < seuil) return;
  var cd = 20*60*1000; // cooldown 20 min
  if(_autoState.lastAlerts['reqh'] && (now - _autoState.lastAlerts['reqh']) < cd) return;
  _autoState.lastAlerts['reqh'] = now;
  localStorage.setItem(_LS_KEYS.JV_LAST_ALERTS, JSON.stringify(_autoState.lastAlerts));

  // ── Ban auto : IPs kill chain non bannies lors d'un pic >500 req/h ──
  var LAN=_LAN_RE;
  var activeIps=(data.kill_chain||{}).active_ips||[];
  var geoMap={};
  ((data.traffic||{}).recent_geoips||[]).forEach(function(g){ if(g.ip) geoMap[g.ip]=g; });
  var csDetail=(data.crowdsec||{}).decisions_detail||{};
  var banCooldown=15*60*1000;
  // Trier par criticité : EXPLOIT > BRUTE > SCAN > RECON, puis par hits desc
  var stageOrder={EXPLOIT:0,BRUTE:1,SCAN:2,RECON:3};
  var candidates=activeIps.filter(function(ipObj){
    var ip=ipObj.ip||'';
    if(!ip||LAN.test(ip)) return false;
    var geo=geoMap[ip]||{};
    if(geo.cs_banned||csDetail[ip]) return false;
    if(_autoBanned[ip]&&(now-_autoBanned[ip])<banCooldown) return false;
    return true;
  }).sort(function(a,b){
    var os=(stageOrder[a.stage]||9)-(stageOrder[b.stage]||9);
    return os!==0?os:((b.count||0)-(a.count||0));
  });
  var minHitsSpike = _autoThresh.banReqHourMinHits !== undefined ? _autoThresh.banReqHourMinHits : 5;
  candidates = candidates.filter(function(ipObj){ return (ipObj.count||0) >= minHitsSpike; });
  candidates.slice(0,3).forEach(function(ipObj){
    var ip=ipObj.ip;
    _autoBanned[ip]=now;
    var reason='auto-ban SOC — pic trafic '+curVal+' req/h — '+ipObj.stage+' — '+ipObj.count+' détections';
    // TTS global envoyé une seule fois après la boucle (évite rafale par IP)
    _socRetryFetch(JV_URL+'/api/soc/ban-ip',{
      method:'POST',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ip:ip,reason:reason,duration:'24h'})
    },function(res){
      var ok=res.ok;
      var spikeLabel=(ok?'✓ ':'\u2717 Échec ')+'Ban pic trafic — '+ip+' ['+ipObj.stage+']';
      updateJarvisTile('alerte', spikeLabel);
      fetchSocActions();
      if(!ok) speakText('Échec du ban pic trafic — '+ip+'. Vérifiez la connexion SSH.', true);
    });
  });

  // ── Alerte vocale globale ──
  var tileAlert = candidates.length>0
    ? 'Pic de trafic — '+curVal+' req/h — '+candidates.slice(0,3).length+' IP(s) bannies automatiquement.'
    : 'Pic de trafic — '+curVal+' req/h — seuil '+seuil+' dépassé. IPs déjà bannies.';
  updateJarvisTile('alerte', tileAlert);
  speakText(tileAlert, true);

  // ── Analyse LLM si pas d'analyse récente ──
  var sinceAnalysis = now - (_autoState.lastAnalysisAt||0);
  if(sinceAnalysis > 5*60*1000){
    _autoState.lastAnalysisAt = now;
    var prompt = 'Pic de trafic détecté : '+curVal+' req/h (seuil '+seuil+'). '
      +'Source probable, risque, action recommandée.';
    streamFromJarvis(prompt, function(text){
      if(!text) return;
      saveToHistory('⚡ Pic req/h', text);
      updateJarvisTile('analyse', text);
      // Pas de TTS LLM ici — speakText global déjà envoyé après la boucle de bans
    });
  }
}

// ── 5. Voix Threat Score — seuil configurable ──────────────────
var _lastThreatLevel = '';
function checkThreatLevel(data){
  if(!_online||!_enabled||!_autoThresh.threatVoice) return;
  var ts = computeThreatScore(data);
  var minScore = _autoThresh.voiceMinScore!==undefined ? _autoThresh.voiceMinScore : 50;
  if(ts.score < minScore){ _lastThreatLevel=''; return; }
  if(ts.level === _lastThreatLevel) return; // déjà annoncé ce niveau
  var cd = (_autoThresh.alertCooldownMin||10)*60*1000;
  var now = Date.now();
  if(_autoState.lastAlerts['threat'] && (now - _autoState.lastAlerts['threat']) < cd) return;
  _autoState.lastAlerts['threat'] = now;
  localStorage.setItem(_LS_KEYS.JV_LAST_ALERTS, JSON.stringify(_autoState.lastAlerts));
  _lastThreatLevel = ts.level;
  var tileMsg = ts.score >= 70
    ? 'Niveau de menace CRITIQUE — score '+ts.score+'/100. Revue immédiate recommandée.'
    : ts.score >= 50
      ? 'Niveau de menace ÉLEVÉ — score '+ts.score+'/100. Surveillance active.'
      : 'Activité anormale — score '+ts.score+'/100. Surveillance en cours.';
  updateJarvisTile('alerte', tileMsg);
  speakText(tileMsg, true);
}

// ── Infra health : TLS expiry + AppArmor nginx ─────────────────
function checkInfraHealth(data){
  if(!_online||!_enabled) return;
  var now=Date.now();
  var cd=(_autoThresh.alertCooldownMin||10)*60*1000;
  // TLS — expiry
  var tls=data.tls||{};
  var tlsMin=null,tlsDom='';
  Object.keys(tls).forEach(function(k){
    var e=tls[k];
    if(e&&e.days_left!=null&&(tlsMin===null||e.days_left<tlsMin)){tlsMin=e.days_left;tlsDom=e.domain||k;}
  });
  if(tlsMin!==null){
    if(tlsMin<7&&_jvCanAlert('tls_critical',now,cd))
      _jvDoAlert('tls_critical','🔴 URGENT — Certificat TLS '+tlsDom+' expire dans '+tlsMin+' jours. Lancer certbot renew --force-renewal --nginx immédiatement.',now);
    else if(tlsMin<30&&_jvCanAlert('tls_warning',now,cd))
      _jvDoAlert('tls_warning','Certificat TLS '+tlsDom+' expire dans '+tlsMin+' jours. Penser à renouveler avec certbot.',now);
  }
  // AppArmor nginx
  var aan=data.apparmor_nginx||{};
  if(aan.available===true&&aan.enforce===false&&_jvCanAlert('aa_nginx',now,cd))
    _jvDoAlert('aa_nginx','⚠ AppArmor nginx hors enforce — workers non confinés. Relancer : apparmor_parser -r /etc/apparmor.d/usr.sbin.nginx',now);
}

// ── Auto-restart service DOWN ──────────────────────────────────
// Déduction de l'état des services depuis les vraies sources de monitoring.json :
//   nginx     → monitoring.json est généré = nginx up ; sinon le dashboard ne charge plus
//               → indicateur fiable : data.system.cpu_pct accessible (script tourne)
//               → cas DOWN détectable via data.crons (nginx absent ou cron échoué)
//   crowdsec  → data.crowdsec.available === false
//   fail2ban  → data.fail2ban.total_banned === undefined (clé absente = démon KO)
var _RESTART_COOLDOWN=10*60*1000; // 10min entre deux restarts du même service
var _nginxZeroCycles=0;           // compteur cycles consécutifs total_requests=0
function checkAutoRestart(data){
  if(!_online||!_enabled||!_autoThresh.autoRestart) return;
  var now=Date.now();

  // Construire la liste des services DOWN avec leur état réel
  var toRestart=[];

  // crowdsec : data.crowdsec.available=false → down
  var cs=data.crowdsec||{};
  if(cs.available===false) toRestart.push({svc:'crowdsec',reason:'CrowdSec indisponible (available=false)'});

  // fail2ban : clé total_banned absente ou fail2ban.jails absent → down
  var f2b=data.fail2ban||{};
  if(f2b.total_banned===undefined||f2b.total_banned===null)
    toRestart.push({svc:'fail2ban',reason:'Fail2ban non détecté (total_banned absent)'});

  // nginx : 3 cycles consécutifs total_requests=0 + data.system accessible → down probable
  // (évite faux positifs : nuit creuse, redémarrage récent, stat reset)
  if(data.system && (!data.traffic || (data.traffic.total_requests||0) === 0)){
    _nginxZeroCycles++;
    if(_nginxZeroCycles >= 3){
      _nginxZeroCycles = 0;
      toRestart.push({svc:'nginx', reason:'Nginx non détecté — 3 cycles consécutifs total_requests=0'});
    }
  } else {
    _nginxZeroCycles = 0;
  }

  toRestart.forEach(function(item){
    var svc=item.svc;
    if(_autoSvcRestart[svc]&&(now-_autoSvcRestart[svc])<_RESTART_COOLDOWN) return;
    _autoSvcRestart[svc]=now;
    speakText('JARVIS alerte. Service '+svc+' est en panne. Tentative de redémarrage automatique.', true);
    _socRetryFetch(JV_URL+'/api/soc/restart-service',{
      method:'POST',mode:'cors',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({service:svc})
    },function(res){
      var ok=res.ok;
      var restartMsg=(ok?'✓ Restart — '+svc+'. Redémarrage effectué.':'✗ Échec restart — '+svc+'. Intervention manuelle requise.');
      updateJarvisTile('alerte', restartMsg);
      fetchSocActions();
      speakText(restartMsg, true);
    });
  });
}

// ── Whitelist Python — sync au démarrage puis toutes les 5min ──────────────
var _jvWhitelist = []; // entrées chargées depuis /api/soc/whitelist

function _isJvWhitelisted(ip){
  if(!ip) return false;
  return _jvWhitelist.some(function(entry){
    return ip===entry || ip.startsWith(entry);
  });
}

function _syncWhitelist(){
  if(!_online) return;
  fetch(JV_URL+'/api/soc/whitelist',{signal:AbortSignal.timeout(5000)})
    .then(function(r){ return r.json(); })
    .then(function(d){ _jvWhitelist = (d&&Array.isArray(d.whitelist))?d.whitelist:[]; })
    .catch(function(e){ console.warn('[JARVIS] _syncWhitelist failed:',e); });
}

// ── Sync bans Python → _autoBanned (anti double-TTS exploit-gap) ───────────
// Appel async — prend effet au cycle suivant (lag 60s acceptable)
function _syncPyBanned(){
  if(!_online) return;
  fetch(JV_URL+'/api/soc/recently-banned',{signal:AbortSignal.timeout(5000)})
    .then(function(r){ return r.json(); })
    .then(function(banned){
      if(!banned||typeof banned!=='object') return;
      Object.keys(banned).forEach(function(ip){
        var pyTs = (banned[ip]||0)*1000; // secondes → ms
        // Prend le timestamp le plus récent (Python peut avoir banni plus tard que JS)
        if(!_autoBanned[ip] || _autoBanned[ip] < pyTs) _autoBanned[ip] = pyTs;
      });
    }).catch(function(e){ console.warn('[JARVIS] _syncPyBanned failed:',e); });
}

// ── Hook principal appelé à chaque refresh (60s) ───────────────
var _jvCycleCount = 0;
window._jvAutoCheck = function(data){
  _jvCycleCount++;
  _startJvCountdown();  // reset countdown à chaque cycle
  _syncPyBanned();      // pré-marquer bans Python pour éviter double TTS (async)
  if(_jvCycleCount===1||_jvCycleCount%5===0) _syncWhitelist(); // sync whitelist toutes les 5 min
  runAutoAnalysis(data);
  checkThresholds(data);
  checkAutoBan(data);
  checkReqPerHour(data);
  checkThreatLevel(data);
  checkAutoRestart(data);
  checkInfraHealth(data);
  checkDailySummary();
  // Restaure la carte résumé si données existent
  if(_autoState.summaryResult){
    ensureDailyCard();
    var card = document.getElementById('jv-daily-card');
    if(card) card.classList.add('visible');
  }
};

