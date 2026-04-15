'use strict';
// ── 18-jarvis-ui.js — §1→§6 + helpers (DT-09 — 2026-04-13) ─────────
// ─────────────────────────────────────────────────────────────────────────────
// 18-jarvis.js — JARVIS SOC Extension                          (D10 — 2026-04-12)
// Fixes 2026-04-12 : _syncPyBanned anti-double-TTS, svcCooldown 15min, checkReqPerHour
//                    TTS consolidé, _TTS_MAX_Q=8, lastAlerts cleanup 24h
//
// TABLE DES MATIÈRES
// ──────────────────────────────────────────────────────────────────────────
//  §1  CONFIG & ÉTAT                                          l.  ~18
//      JV_CHECK, JV_URL, variables globales IIFE
//
//  §2  INJECT DOM                                             l.  ~19 – 196
//      Génère le HTML du panneau JARVIS + bouton FAB
//
//  §3  TUILE SÉCURITÉ                                        l. ~197 – 275
//      _SEC_DATA, fetchSecStat, updateSecTile, modal sécurité
//
//  §4  TUILE OPÉRATIONS PROACTIVES                           l. ~276 – 638
//      _PRO_DATA, pingJarvis, fetchSocActions, updateProTile
//      Modal détail JARVIS (openJvModal)
//
//  §5  SNAPSHOTS UFW                                         l. ~640 – 781
//      Historique diff pare-feu — localStorage (48 snaps max)
//
//  §6  TUILE JARVIS (grille)                                 l. ~782 – 832
//      buildJarvisTileInner, updateJarvisTile
//
//  §7  CHAT UI & LLM                                         l. ~833 – 1447
//      pingWan, clearChat, buildQuickPrompts, vocalSocStatus
//      buildContext, sendMessage, _execRecommendedBans
//      appendMsg, addSpeakBtn, updateMsg, LLM Settings
//
//  §8  TTS (Text-To-Speech)                                  l. ~1448 – 1582
//      File d'attente, AudioContext, _ttsFlush, speakText, toggleTts
//
//  §9  UI HELPERS & CYCLE DE VIE                             l. ~1583 – 1808
//      Overlay, Panel, toggleEnabled, setOnline, updateBadge
//      checkNow, updateGpuTile, Init (DOMContentLoaded)
//
//  §10 AUTO ENGINE (analyse, alertes, bans, redémarrages)    l. ~1809 – 2515
//      _autoThresh (localStorage), _autoState
//      runAutoAnalysis, checkThresholds, checkDailySummary
//      checkAutoBan, checkReqPerHour, checkThreatLevel
//      checkInfraHealth, checkAutoRestart
//      window._jvAutoCheck — hook appelé par 17-fetch.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers module-level (NDT-80→83) ─────────────────────────
function _jvQuickRoutine(txt,vocal,lbl){
  return function(){
    if(!_online||!_enabled||_thinking)return;
    clearChat();
    _ttsSingleShot=true;
    _currentRoutineLabel=lbl||txt.slice(0,40);
    if(vocal){vocalSocStatus();}else{sendMessage(txt);}
  };
}
function _jvSet(id,val,dispId){
  var el=document.getElementById(id);if(el)el.value=val;
  var sp=document.getElementById(dispId);if(sp)sp.textContent=typeof val==='number'&&val%1!==0?val.toFixed(2):val;
}
function _jvSv(id,val){var el=document.getElementById(id);if(el&&val!==undefined)el.value=val;}
function _jvSt(id,val){var el=document.getElementById(id);if(el&&val!==undefined)el.textContent=val;}
function _jvCanAlert(key,now,cd){return !_autoState.lastAlerts[key]||(now-_autoState.lastAlerts[key])>cd;}
function _jvDoAlert(key,txt,now){
  _autoState.lastAlerts[key]=now;
  localStorage.setItem(_LS_KEYS.JV_LAST_ALERTS,JSON.stringify(_autoState.lastAlerts));
  updateJarvisTile('alerte',txt);
  speakText(txt,true);
}

// ── §1 — Config & État ────────────────────────────────────────
// Regex LAN — RFC1918 + loopback — alignée sur _LAN_PREFIXES Python (soc.py)
var _LAN_RE = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/;

var JV_CHECK           = 10000; // poll toutes les 10s
var _UI_BTN_RESET_MS   = 1500;  // délai reset bouton après action (snapshot, etc.)
var _UI_STATUS_MS      = 2500;  // délai masquage message de statut (save/preset)
var _UI_TOAST_MS       = 7000;  // durée affichage toast
var _UI_ENGINE_IND_MS  = 8000;  // durée indicateur engine actif
var _online       = false;
var _enabled      = localStorage.getItem(_LS_KEYS.SOC_AI) !== 'off';
var _ttsEnabled   = localStorage.getItem(_LS_KEYS.SOC_AI_TTS) === 'on';
var _ttsSingleShot  = false; // TTS pour une seule réponse (prompt vocal)
var _thinking       = false;
var _pendingBanParse = false; // parse la prochaine réponse LLM pour ban recommandé
var _jvCnt        = {a:0, al:0, lastAt:null};
var _jvCdT0       = Date.now();   // timestamp dernier refresh 60s
var _jvCdInt      = null;         // setInterval countdown
var _msgs         = []; // historique conversation
var _abortCtrl    = null;

// ═══════════════════════════════════════════════════════════════
// §2 — INJECT DOM
// ═══════════════════════════════════════════════════════════════
function injectDOM(){
  // Badge dans l'en-tête — slot #hdr-jarvis (symétrique du ONLINE pill)
  var hdrJarvis = document.getElementById('hdr-jarvis');
  if(hdrJarvis && !document.getElementById('jarvis-badge')){
    var badge = document.createElement('div');
    badge.id = 'jarvis-badge';
    badge.className = _enabled ? '' : 'disabled';
    badge.title = 'JARVIS AI — cliquer pour activer/désactiver';
    badge.innerHTML = '<span class="jarvis-dot"></span><span id="jv-lbl">⬡ JARVIS</span>';
    badge.addEventListener('click', toggleEnabled);
    hdrJarvis.appendChild(badge);
  }

  // FAB (bouton flottant)
  if(!document.getElementById('jarvis-fab')){
    var fab = document.createElement('div');
    fab.id = 'jarvis-fab';
    fab.innerHTML = '⬡';
    fab.title = 'Ouvrir JARVIS AI';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);
  }

  // Panel slide-in
  if(!document.getElementById('jarvis-panel')){
    var panel = document.createElement('div');
    panel.id = 'jarvis-panel';
    panel.innerHTML =
      '<div class="jv-hdr">'
      + '<div class="jv-title">⬡ JARVIS AI <span class="jv-ctx-badge" id="jv-ctx-lbl">SOC</span></div>'
      + '<div style="display:flex;gap:.4rem;align-items:center">'
      + '<span id="jv-status-lbl" style="font-size:var(--fs-xs);color:rgba(191,95,255,0.5);font-family:Courier New,monospace"></span>'
      + '<div class="jv-hist-btn" id="jv-hist-btn" title="Historique des analyses JARVIS">📜 Hist.</div>'
      + '<div class="jv-settings-btn" id="jv-settings-btn" title="Paramètres LLM">⚙ LLM</div>'
      + '<div class="jv-tts-btn'+(_ttsEnabled?' active':'')+'" id="jv-tts-toggle" title="Activer/désactiver la lecture vocale automatique">🔊</div>'
      + '<div class="jv-close" title="Fermer">✕</div>'
      + '</div>'
      + '</div>'
      + '<div class="jv-speaking-bar" id="jv-speaking-bar">'
      + '<div class="jv-wave"><span></span><span></span><span></span><span></span><span></span></div>'
      + '<span>JARVIS parle…</span>'
      + '<button id="jv-stop-speak">■ STOP</button>'
      + '</div>'
      + '<div id="jv-settings-panel">'
      +   '<div class="jv-set-row">'
      +     '<div class="jv-set-item"><div class="jv-set-lbl">Température <span id="sv-temp">0.7</span></div><input class="jv-set-range" id="sr-temp" type="range" min="0.1" max="2" step="0.05" value="0.7"></div>'
      +     '<div class="jv-set-item"><div class="jv-set-lbl">Top-P <span id="sv-topp">0.9</span></div><input class="jv-set-range" id="sr-topp" type="range" min="0.1" max="1" step="0.05" value="0.9"></div>'
      +     '<div class="jv-set-item"><div class="jv-set-lbl">Top-K <span id="sv-topk">40</span></div><input class="jv-set-range" id="sr-topk" type="range" min="1" max="100" step="1" value="40"></div>'
      +     '<div class="jv-set-item"><div class="jv-set-lbl">Repeat Penalty <span id="sv-rep">1.1</span></div><input class="jv-set-range" id="sr-rep" type="range" min="1" max="1.5" step="0.02" value="1.1"></div>'
      +     '<div class="jv-set-item"><div class="jv-set-lbl">Max Tokens <span id="sv-pred">1024</span></div><input class="jv-set-range" id="sr-pred" type="range" min="128" max="4096" step="64" value="1024"></div>'
      +     '<div class="jv-set-item"><div class="jv-set-lbl">Contexte (num_ctx) <span id="sv-ctx">4096</span></div><input class="jv-set-range" id="sr-ctx" type="range" min="512" max="8192" step="256" value="4096"></div>'
      +   '</div>'
      +   '<div style="display:flex;align-items:center;gap:1rem;justify-content:flex-end">'
      +     '<span class="jv-set-status" id="jv-set-status">✓ Sauvegardé</span>'
      +     '<button class="jv-set-save">💾 Appliquer</button>'
      +   '</div>'
      + '</div>'
      + '<div id="jv-hist-panel"><div id="jv-hist-list"></div></div>'
      + '<div class="jv-quick" id="jv-quick"></div>'
      + '<div id="jv-msgs"></div>'
      + '<div class="jv-input-row">'
      + '<textarea id="jv-input" rows="1" placeholder="Demander à JARVIS…" autocomplete="off"></textarea>'
      + '<button id="jv-cancel">■ Annuler</button>'
      + '<button id="jv-send">▶</button>'
      + '</div>';
    document.body.appendChild(panel);
    // ── Bindings CSP-safe — zéro onclick inline ──────────────────
    panel.querySelector('#jv-hist-btn').addEventListener('click', function(){ window._jvToggleHist && window._jvToggleHist(); });
    panel.querySelector('#jv-settings-btn').addEventListener('click', function(){ window._jvToggleSettings && window._jvToggleSettings(); });
    panel.querySelector('#jv-tts-toggle').addEventListener('click', function(){ window._jvToggleTts && window._jvToggleTts(); });
    panel.querySelector('.jv-close').addEventListener('click', function(){ window._jvClose && window._jvClose(); });
    panel.querySelector('#jv-stop-speak').addEventListener('click', function(){ window._jvStopSpeak && window._jvStopSpeak(); });
    panel.querySelector('.jv-set-save').addEventListener('click', function(){ window._jvSaveSettings && window._jvSaveSettings(); });
    panel.querySelector('#jv-cancel').addEventListener('click', function(){ window._jvCancel && window._jvCancel(); });
    panel.querySelector('#jv-send').addEventListener('click', function(){ window._jvSend && window._jvSend(); });
    // Sliders LLM
    panel.querySelector('#sr-temp').addEventListener('input', function(){ document.getElementById('sv-temp').textContent = parseFloat(this.value).toFixed(2); });
    panel.querySelector('#sr-topp').addEventListener('input', function(){ document.getElementById('sv-topp').textContent = parseFloat(this.value).toFixed(2); });
    panel.querySelector('#sr-topk').addEventListener('input', function(){ document.getElementById('sv-topk').textContent = this.value; });
    panel.querySelector('#sr-rep').addEventListener('input', function(){ document.getElementById('sv-rep').textContent = parseFloat(this.value).toFixed(2); });
    panel.querySelector('#sr-pred').addEventListener('input', function(){ document.getElementById('sv-pred').textContent = this.value; });
    panel.querySelector('#sr-ctx').addEventListener('input', function(){ document.getElementById('sv-ctx').textContent = this.value; });
    // Input enter / auto-resize
    var inp = panel.querySelector('#jv-input');
    if(inp){
      inp.addEventListener('keydown', function(e){
        if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(window._jvSend)window._jvSend(); }
      });
      inp.addEventListener('input', function(){
        this.style.height='auto';
        this.style.height=Math.min(this.scrollHeight, 144)+'px';
      });
    }
  }

  // ── Délégation globale — boutons tuile JARVIS (injectés après le premier render) ──
  document.body.addEventListener('click', function(e){
    var t = e.target;
    if(t.id === 'jv-tile-st'){ if(window.pingJarvis) window.pingJarvis(e); return; }
    if(t.id === 'jv-btn-detail'){ if(window.openJvModal) window.openJvModal(); e.stopPropagation(); return; }
  });

  // Tile sécurité — click
  var secTile = document.getElementById('sec-tile');
  if(secTile) secTile.addEventListener('click', function(){ window._secOpenModal && window._secOpenModal(); });

  // Modal sécurité
  if(!document.getElementById('sec-modal')){
    var sm = document.createElement('div');
    sm.id = 'sec-modal';
    sm.innerHTML =
      '<div class="sec-modal-box">'
      +'<div class="sec-modal-hdr">'
      +'<h3>⚡ BLOCKLIST LLM — JOURNAL DES TENTATIVES BLOQUÉES</h3>'
      +'<div style="display:flex;gap:.6rem;align-items:center">'
      +'<button id="sec-clear-btn" style="font-size:var(--fs-xs);padding:.2rem .6rem;background:rgba(255,59,92,.08);border:1px solid rgba(255,59,92,.3);color:var(--red);border-radius:3px;cursor:pointer;font-family:\'Courier New\',monospace">🗑 Vider</button>'
      +'<div id="sec-close-x" style="cursor:pointer;color:var(--muted);font-size:var(--fs-md);padding:.1rem .4rem">✕</div>'
      +'</div>'
      +'</div>'
      +'<div class="sec-modal-body" id="sec-modal-body"><div class="sec-no-evt">Aucun événement de sécurité</div></div>'
      +'</div>';
    document.body.appendChild(sm);
    sm.addEventListener('click', function(e){ if(e.target===sm) sm.classList.remove('show'); });
    sm.querySelector('#sec-clear-btn').addEventListener('click', function(){ window._secClear && window._secClear(); });
    sm.querySelector('#sec-close-x').addEventListener('click', function(){ sm.classList.remove('show'); });
  }

  // Tile proactif — click
  var proTile = document.getElementById('pro-tile');
  if(proTile) proTile.addEventListener('click', function(){ window._proOpenModal && window._proOpenModal(); });

  // Modal opérations proactives
  if(!document.getElementById('pro-modal')){
    var pm = document.createElement('div');
    pm.id = 'pro-modal';
    pm.innerHTML =
      '<div class="pro-modal-box">'
      +'<div class="pro-modal-hdr">'
      +'<h3>⬡ OPÉRATIONS PROACTIVES — JOURNAL DES ACTIONS JARVIS</h3>'
      +'<div style="display:flex;gap:.6rem;align-items:center">'
      +'<button id="pro-clear-btn" style="font-size:var(--fs-xs);padding:.2rem .6rem;background:rgba(255,59,92,.08);border:1px solid rgba(255,59,92,.3);color:var(--red);border-radius:3px;cursor:pointer;font-family:\'Courier New\',monospace">🗑 Vider</button>'
      +'<div id="pro-close-x" style="cursor:pointer;color:var(--muted);font-size:var(--fs-md);padding:.1rem .4rem">✕</div>'
      +'</div>'
      +'</div>'
      +'<div class="pro-modal-body" id="pro-modal-body"><div class="pro-no-act">Aucune opération proactive depuis le démarrage de JARVIS</div></div>'
      +'</div>';
    document.body.appendChild(pm);
    pm.addEventListener('click', function(e){ if(e.target===pm) pm.classList.remove('show'); });
    pm.querySelector('#pro-clear-btn').addEventListener('click', function(){ window._proClear && window._proClear(); });
    pm.querySelector('#pro-close-x').addEventListener('click', function(){ pm.classList.remove('show'); });
  }

  // Modal snapshots UFW
  if(!document.getElementById('snap-modal')){
    var spm = document.createElement('div');
    spm.id = 'snap-modal';
    spm.innerHTML =
      '<div class="snap-modal-box">'
      +'<div class="snap-modal-hdr">'
      +'<h3>📸 FIREWALL SNAPSHOTS — HISTORIQUE DES ÉTATS UFW</h3>'
      +'<div style="display:flex;gap:.6rem;align-items:center">'
      +'<button id="snap-clear-btn" style="font-size:var(--fs-xs);padding:.2rem .6rem;background:rgba(255,59,92,.08);border:1px solid rgba(255,59,92,.3);color:var(--red);border-radius:3px;cursor:pointer;font-family:\'Courier New\',monospace">🗑 Tout vider</button>'
      +'<div id="snap-close-x" style="cursor:pointer;color:var(--muted);font-size:var(--fs-md);padding:.1rem .4rem">✕</div>'
      +'</div>'
      +'</div>'
      +'<div class="snap-modal-body" id="snap-modal-body"><div class="snap-empty">Aucun snapshot — cliquer 📸 Snapshot dans la matrice firewall</div></div>'
      +'</div>';
    document.body.appendChild(spm);
    spm.addEventListener('click', function(e){ if(e.target===spm) spm.classList.remove('show'); });
    spm.querySelector('#snap-clear-btn').addEventListener('click', function(){ window._fwClearSnaps && window._fwClearSnaps(); });
    spm.querySelector('#snap-close-x').addEventListener('click', function(){ spm.classList.remove('show'); });
  }

  buildQuickPrompts();
  updateBadge();
  updateFab();
}

// ═══════════════════════════════════════════════════════════════
// §3 — TUILE SÉCURITÉ
// ═══════════════════════════════════════════════════════════════
var _SEC_DATA = {total:0, by_level:{hard:0,args:0,terminal:0}, last:[]};

function fetchSecStat(){
  if(!_online) return;
  fetch(JV_URL+'/api/security',{signal:AbortSignal.timeout(5000)})
    .then(function(r){ return r.json(); })
    .then(function(d){ _SEC_DATA=d; updateSecTile(d); })
    .catch(function(e){ console.warn('[JARVIS] fetchSecStat failed:',e); });
}

function updateSecTile(d){
  var h=document.getElementById('sec-cnt-h'),
      a=document.getElementById('sec-cnt-a'),
      t=document.getElementById('sec-cnt-t'),
      tot=document.getElementById('sec-total'),
      badge=document.getElementById('sec-badge'),
      last=document.getElementById('sec-last-evt');
  var bl=d.by_level||{};
  if(h) h.textContent=bl.hard||0;
  if(a) a.textContent=bl.args||0;
  if(t) t.textContent=bl.terminal||0;
  if(tot) tot.textContent='Total: '+(d.total||0);
  if(badge){
    badge.className='sec-badge sec-badge-online';
    badge.textContent='⬡ ACTIF';
    badge.style.background='';
    badge.style.borderColor='';
    badge.style.color='';
  }
  if(last){
    if(!d.last||!d.last.length){
      last.innerHTML='<div class="sec-idle-lbl">Aucun événement — protections actives</div>';
    } else {
      var ev=d.last[0];
      var lc={'hard':'sec-lvl-hard','args':'sec-lvl-args','terminal':'sec-lvl-terminal'}[ev.level]||'';
      last.innerHTML='<div class="sec-last-evt">'
        +'<span style="color:var(--muted)">'+esc(ev.ts)+'</span> '
        +'<span class="'+lc+'">['+esc(ev.level)+']</span> '
        +esc(ev.pattern)+'</div>';
    }
  }
}

window._secOpenModal = function(){
  var m=document.getElementById('sec-modal');
  if(m) m.classList.add('show');
  window._secRefreshModal();
};

window._secClear = function(){
  fetch(JV_URL+'/api/security/clear',{method:'POST',signal:AbortSignal.timeout(5000)})
    .then(function(){ _SEC_DATA={total:0,by_level:{hard:0,args:0,terminal:0},last:[]}; updateSecTile(_SEC_DATA); window._secRefreshModal(); })
    .catch(function(e){ console.warn('[JARVIS] security/clear failed:',e); });
};

window._secRefreshModal = function(){
  var body=document.getElementById('sec-modal-body');
  if(!body) return;
  var evts=(_SEC_DATA.last||[]);
  if(!evts.length){
    body.innerHTML='<div class="sec-no-evt">Aucun événement de sécurité depuis le démarrage de JARVIS</div>';
    return;
  }
  var html='<div style="display:grid;grid-template-columns:140px 80px 1fr;gap:.5rem;font-size:var(--fs-xs);color:var(--muted);font-family:\'Courier New\',monospace;margin-bottom:.5rem;padding-bottom:.4rem;border-bottom:1px solid rgba(255,255,255,0.06)">'
    +'<span>HORODATAGE</span><span>NIVEAU</span><span>PATTERN / EXTRAIT</span></div>';
  evts.forEach(function(ev){
    var lc={'hard':'sec-lvl-hard','args':'sec-lvl-args','terminal':'sec-lvl-terminal'}[ev.level]||'';
    html+='<div class="sec-evt-row">'
      +'<span style="color:var(--muted)">'+esc(ev.ts)+'</span>'
      +'<span class="'+lc+'">'+esc(ev.level.toUpperCase())+'</span>'
      +'<span>'+esc(ev.pattern)
        +(ev.snippet?'<br><span style="color:rgba(255,255,255,0.28);font-size:var(--fs-xs)">'+esc(ev.snippet)+'</span>':'')
      +'</span>'
      +'</div>';
  });
  body.innerHTML=html;
};

// ═══════════════════════════════════════════════════════════════
// §4 — TUILE OPÉRATIONS PROACTIVES + MODAL JARVIS
// ═══════════════════════════════════════════════════════════════
var _PRO_DATA = {total:0, by_type:{ban_ip:0, unban_ip:0, restart_service:0}, actions:[]};

function pingJarvis(e){
  if(e)e.stopPropagation();
  var btn=document.getElementById('pro-ping-btn');
  if(btn){btn.textContent='⟳ …';btn.disabled=true;btn.style.opacity='.5';}
  // Toast flottant — indépendant de toute tuile
  var toast=document.getElementById('_ping-toast');
  if(!toast){toast=document.createElement('div');toast.id='_ping-toast';document.body.appendChild(toast);}
  toast.style.cssText='position:fixed;bottom:1.8rem;right:1.8rem;z-index:99999;padding:.55rem .9rem;border-radius:3px;border:1px solid rgba(0,255,136,0.4);background:#0e1a12;font-size:var(--fs-xs);font-family:\'Courier New\',monospace;min-width:18rem;box-shadow:0 4px 24px rgba(0,0,0,.85);color:rgba(0,255,136,.7)';
  toast.textContent='⟳ Envoi message vocal à JARVIS…';
  var t0=Date.now();
  fetch(JV_URL+'/api/speak',{
    method:'POST',mode:'cors',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:'Alerte SOC. Test de communication JARVIS. Surveillance active.'}),
    signal:AbortSignal.timeout(30000)
  })
  .then(function(r){
    var ms=Date.now()-t0;
    if(r.ok){
      toast.style.borderColor='rgba(0,255,136,0.5)';
      toast.innerHTML='<span style="color:#00ff88">✓ JARVIS a reçu — voix TTS déclenchée</span><span style="color:rgba(0,255,136,.4);margin-left:.6rem">'+ms+'ms</span>';
      _online=true; fetchSecStat(); fetchSocActions(); updateBadge();
    }else{
      toast.style.borderColor='rgba(255,59,92,0.4)';toast.style.background='#130e0e';
      toast.innerHTML='<span style="color:#ff3b5c">✗ JARVIS HTTP '+r.status+'</span>';
    }
  })
  .catch(function(err){
    toast.style.borderColor='rgba(255,59,92,0.4)';toast.style.background='#130e0e';
    toast.innerHTML='<span style="color:#ff3b5c">✗ JARVIS injoignable</span><div style="color:rgba(255,59,92,.5);font-size:var(--fs-xs);margin-top:.2rem">'+esc(err.message)+'</div>';
  })
  .finally(function(){
    if(btn){btn.textContent='⬡ PING JARVIS';btn.disabled=false;btn.style.opacity='1';}
    setTimeout(function(){if(toast&&toast.parentNode)toast.parentNode.removeChild(toast);},_UI_TOAST_MS);
  });
}

function fetchSocActions(){
  if(!_online) return;
  fetch(JV_URL+'/api/soc/actions',{signal:AbortSignal.timeout(5000)})
    .then(function(r){ return r.json(); })
    .then(function(d){ _PRO_DATA=d; updateProTile(d); })
    .catch(function(e){ console.warn('[JARVIS] fetchSocActions failed:',e); });
}

function updateProTile(d){
  var cBan=document.getElementById('pro-cnt-ban'),
      cUnban=document.getElementById('pro-cnt-unban'),
      cSvc=document.getElementById('pro-cnt-svc'),
      tot=document.getElementById('pro-total'),
      badge=document.getElementById('pro-badge'),
      last=document.getElementById('pro-last-act');
  var bt=d.by_type||{};
  if(cBan)   cBan.textContent   = bt.ban_ip||0;
  if(cUnban) cUnban.textContent = bt.unban_ip||0;
  if(cSvc)   cSvc.textContent   = bt.restart_service||0;
  if(tot)    tot.textContent    = 'Total: '+(d.total||0);
  if(badge){
    badge.className='pro-badge pro-badge-online';
    badge.textContent='⬡ ACTIF';
  }
  if(last){
    var acts=d.actions||[];
    if(!acts.length){
      last.innerHTML='<div class="pro-idle-lbl">Aucune opération — surveillance active</div>';
    } else {
      var a=acts[0];
      var tc={'ban_ip':'pro-type-ban','unban_ip':'pro-type-unban','restart_service':'pro-type-svc'}[a.type]||'';
      var ok=a.success?'<span class="pro-ok">✓ OK</span>':'<span class="pro-fail">✗ ERR</span>';
      last.innerHTML='<div class="pro-last-act">'
        +'<span style="color:var(--muted)">'+esc(a.ts)+'</span> '
        +'<span class="'+tc+'">['+esc(a.type||'?')+']</span> '
        +esc(a.detail||'')+'  '+ok+'</div>';
    }
  }
  // ── Capacités actives ──
  var caps=document.getElementById('pro-caps');
  if(caps){
    var on='color:#00ff88;font-size:var(--fs-xs)';
    var off='color:rgba(122,154,184,0.3);font-size:var(--fs-xs)';
    var lbl='font-size:var(--fs-xs);color:var(--muted);font-family:"Courier New",monospace;letter-spacing:.3px';
    var row=function(ico,txt,active){
      return '<div style="display:flex;align-items:center;gap:.35rem">'
        +'<span style="'+(active?on:off)+'">'+ico+'</span>'
        +'<span style="'+lbl+';'+(active?'':'opacity:.4')+'">'+(active?'<span style="color:rgba(0,255,136,.55)">●</span> ':'<span style="color:rgba(122,154,184,.25)">○</span> ')+txt+'</span>'
        +'</div>';
    };
    var jvOn=_online&&_enabled;
    var t=_autoThresh;
    caps.innerHTML=
      '<div style="font-size:var(--fs-xs);color:rgba(0,255,136,.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:.2rem;font-family:\'Courier New\',monospace">// Autonomie active</div>'
      +row('⚡','Ban auto — EXPLOIT CVE (1 tentative)', jvOn)
      +row('⚡','Ban auto — Honeypot ('+( t.banNhMin||1)+' hit)', jvOn)
      +row('⚡','Ban auto — BRUTE/SCAN (>'+(t.banMinCount||30)+' req/15min)', jvOn)
      +row('⚡','Alerte trafic (>'+(t.reqPerHour||500)+' req/h)', jvOn)
      +row('🔁','Restart auto — CrowdSec / Fail2ban DOWN', jvOn&&(t.autoRestart!==false))
      +row('🔊','Voix Threat ÉLEVÉ/CRITIQUE', jvOn&&(t.threatVoice!==false))
      +row('🔊','Voix alertes seuils (CPU/IPs/5xx)', jvOn)
      +row('📋','Résumé vocal quotidien ('+( t.summaryHr||8)+'h)', jvOn);
  }
  // ── Sync tuile JARVIS — compteurs + dernière action + sparkline ──
  var jvBan=document.getElementById('jv-cnt-ban-t'); if(jvBan) jvBan.textContent=bt.ban_ip||0;
  var jvRst=document.getElementById('jv-cnt-rst-t'); if(jvRst) jvRst.textContent=bt.restart_service||0;
  _updateJvLastAct(d.actions||[]);
  _drawBanSpark(d.actions||[]);
}

// ── Dernière action dans tuile JARVIS ─────────────────────────
function _updateJvLastAct(acts){
  var el=document.getElementById('jv-tile-last-act');
  if(!el) return;
  var bans=acts.filter(function(a){return a.type==='ban_ip';});
  if(!bans.length){
    el.innerHTML='<span style="color:rgba(122,154,184,0.35);font-size:var(--fs-xs)">Aucune action — surveillance active</span>';
    return;
  }
  var a=bans[0];
  var badgeCls={'ban_ip':'jv-act-ban','unban_ip':'jv-act-unban','restart_service':'jv-act-rst'}[a.type]||'jv-act-ban';
  var typeLabel={'ban_ip':'BAN-IP','unban_ip':'UNBAN','restart_service':'RESTART'}[a.type]||a.type;
  var okIco=a.success?'<span class="jv-act-ok">✓</span>':'<span class="jv-act-err">✗</span>';
  var tsShort=(a.ts||'').replace(/^\d{4}-\d{2}-\d{2} /,'');
  el.innerHTML='<span class="jv-act-badge '+badgeCls+'">'+typeLabel+'</span>'
    +'<span style="color:var(--muted);font-size:var(--fs-xs);flex-shrink:0">'+esc(tsShort)+'</span>'
    +'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">'+esc(a.detail||'')+'</span>'
    +okIco;
}

// ── Sparkline bans — canvas timeline 60min ────────────────────
function _drawBanSpark(acts){
  var cv=document.getElementById('jv-ban-spark');
  if(!cv) return;
  var W=cv.offsetWidth||cv.parentElement&&cv.parentElement.offsetWidth||300;
  cv.width=W; cv.height=32;
  var ctx=cv.getContext('2d');
  ctx.clearRect(0,0,W,32);
  // Axe de base
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,28); ctx.lineTo(W,28); ctx.stroke();
  // Fenêtre 60 min
  var now=Date.now(), win=3600000;
  var bans=acts.filter(function(a){return a.type==='ban_ip';});
  if(!bans.length){
    ctx.fillStyle='rgba(122,154,184,0.18)'; ctx.font='9px Courier New'; ctx.textAlign='center';
    ctx.fillText('Aucun ban cette session',W/2,17); return;
  }
  // Essaie de parser les timestamps "YYYY-MM-DD HH:MM:SS"
  var STAGE_COL={'EXPLOIT':'rgba(255,107,53,0.85)','BRUTE':'rgba(255,59,92,0.85)','SCAN':'rgba(245,158,11,0.85)','HONEYPOT':'rgba(191,95,255,0.85)'};
  bans.forEach(function(a){
    // Récupère stage depuis le detail "… [STAGE] …"
    var sm=a.detail&&a.detail.match(/\[([A-Z]+)\]/);
    var stage=sm?sm[1]:'BAN';
    var col=STAGE_COL[stage]||'rgba(0,217,255,0.75)';
    // Timestamp : parse "2026-03-22 00:15:43"
    var ts=0;
    if(a.ts){ try{ ts=new Date(a.ts.replace(' ','T')).getTime(); }catch(e){console.error('[SOC]',e);} }
    if(!ts) ts=now; // fallback: maintenant
    var age=now-ts;
    var x=Math.round((1-Math.min(age,win)/win)*(W-2))+1;
    ctx.fillStyle=col;
    ctx.fillRect(x-1,4,3,22);
    // Glow
    ctx.fillStyle=col.replace('0.85','0.25');
    ctx.fillRect(x-3,2,7,26);
  });
  // Label nb bans
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='8px Courier New'; ctx.textAlign='left';
  ctx.fillText(bans.length+' ban'+(bans.length>1?'s':'')+' — 1h',3,11);
  ctx.textAlign='right';
  ctx.fillText('maintenant',W-3,11);
}

// ── Barre système compacte tuile JARVIS ───────────────────────
function _updateJvSysBar(s){
  var el=document.getElementById('jv-sys-bar');
  if(!el||!s) return;
  var temp=typeof s.temp==='number'?s.temp:null;
  var tempCol=temp===null?'var(--muted)':temp>80?'var(--red)':temp>65?'var(--amber)':'var(--green)';
  var vramPct=s.mem_total>0?Math.round(s.mem_used*100/s.mem_total):0;
  var vramCol=vramPct>85?'var(--red)':vramPct>60?'var(--amber)':'var(--cyan)';
  var gpuCol=(s.gpu_util||0)>80?'var(--red)':(s.gpu_util||0)>50?'var(--amber)':'var(--purple)';
  var sshOk=(_PRO_DATA&&(_PRO_DATA.total===0||(_PRO_DATA.by_type&&_PRO_DATA.by_type.ban_ip>0&&_PRO_DATA.failed===0)));
  var ttsIco=_ttsEnabled?'<span style="color:var(--green)">TTS ✓</span>':'<span style="color:var(--muted)">TTS ✗</span>';
  var parts=[];
  if(temp!==null) parts.push('<span>GPU <span style="color:'+tempCol+'">'+temp+'°C</span></span>');
  if(s.gpu_util!==undefined) parts.push('<span>Compute <span style="color:'+gpuCol+'">'+s.gpu_util+'%</span></span>');
  parts.push('<span>VRAM <span style="color:'+vramCol+'">'+(Math.round(s.mem_used*10)/10)+'/'+(Math.round(s.mem_total*10)/10)+' Go</span></span>');
  if(s.uptime) parts.push('<span>⬆ <span style="color:rgba(191,95,255,.7)">'+esc(s.uptime)+'</span></span>');
  parts.push('<span>SSH <span style="color:'+(sshOk?'var(--green)':'var(--amber)')+'">'+( sshOk?'✓':'?')+'</span></span>');
  parts.push(ttsIco);
  el.innerHTML=parts.join('<span style="opacity:.25">·</span>');
}

// ── Countdown auto-engine 60s ──────────────────────────────────
function _startJvCountdown(){
  _jvCdT0=Date.now();
  if(_jvCdInt) clearInterval(_jvCdInt);
  _jvCdInt=setInterval(function(){
    var fill=document.getElementById('jv-cd-fill');
    var lbl=document.getElementById('jv-cd-s');
    if(!fill||!lbl) return;
    var elapsed=Date.now()-_jvCdT0;
    var CYCLE=60000;
    var pct=Math.min(elapsed/CYCLE*100,100);
    var rem=Math.max(0,Math.ceil((CYCLE-elapsed)/1000));
    fill.style.width=pct+'%';
    lbl.textContent=rem>0?rem+'s':'⚡';
    if(rem===0){ fill.style.width='0%'; _jvCdT0=Date.now(); }
  },1000);
}

// ── Modal détail JARVIS ────────────────────────────────────────
window.openJvModal = function openJvModal(){
  if(_isOpen)return;
  var d=_PRO_DATA||{};
  var bt=d.by_type||{};
  var acts=d.actions||[];
  var secD=_SEC_DATA||{};
  // Stats
  var gs=window._jvLastStats||{};
  var temp=typeof gs.temp==='number'?gs.temp:null;
  var tempCol=temp===null?'var(--muted)':temp>80?'var(--red)':temp>65?'var(--amber)':'var(--green)';
  var vramPct=gs.mem_total>0?Math.round(gs.mem_used*100/gs.mem_total):0;
  var vramCol=vramPct>85?'var(--red)':vramPct>60?'var(--amber)':'var(--cyan)';
  var gpuCol=(gs.gpu_util||0)>80?'var(--red)':(gs.gpu_util||0)>50?'var(--amber)':'var(--purple)';
  var cpuCol=(gs.cpu||0)>85?'var(--red)':(gs.cpu||0)>60?'var(--amber)':'var(--green)';
  var sshOk=(_PRO_DATA&&(_PRO_DATA.total===0||_PRO_DATA.failed===0));
  // Pré-vars journal + historique
  var TYPE_BADGE={'ban_ip':'jv-act-ban','unban_ip':'jv-act-unban','restart_service':'jv-act-rst'};
  var TYPE_LBL={'ban_ip':'BAN-IP','unban_ip':'UNBAN','restart_service':'RESTART'};
  var journalBodyHtml2=!acts.length
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);font-family:\'Courier New\',monospace;padding:.4rem 0">Aucune action depuis le démarrage de JARVIS</div>'
    :acts.map(function(a){
      var bc=TYPE_BADGE[a.type]||'jv-act-ban';
      var bl=TYPE_LBL[a.type]||a.type;
      var ok=a.success?'<span class="jv-act-ok">✓ OK</span>':'<span class="jv-act-err">✗ ERR</span>';
      return '<div class="jvm-act-row">'
        +'<span class="jvm-act-ts">'+esc(a.ts||'')+'</span>'
        +'<span class="jv-act-badge '+bc+'">'+bl+'</span>'
        +'<span class="jvm-act-detail">'+esc(a.detail||'')+'</span>'
        +ok+'</div>';
    }).join('');
  var historyHtml2=_jvHistory&&_jvHistory.length
    ?'<div class="jvm-section">'
      +'<div class="jvm-section-title">⚡ DERNIÈRES ANALYSES AUTO-ENGINE</div>'
      +_jvHistory.slice(0,5).map(function(e){
        var d2=new Date(e.ts);
        var tsFmt=d2.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' · '+d2.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
        return '<div style="margin-bottom:.5rem;padding:.35rem .5rem;background:rgba(191,95,255,0.04);border:1px solid rgba(191,95,255,0.12);border-radius:3px">'
          +'<div style="font-size:var(--fs-xs);color:rgba(191,95,255,.5);font-family:\'Courier New\',monospace;margin-bottom:.2rem">'+esc(e.label)+'  ·  '+tsFmt+'</div>'
          +'<div style="font-size:var(--fs-xs);color:var(--text);font-family:\'Courier New\',monospace;line-height:1.45">'+esc(e.text)+'</div>'
          +'</div>';
      }).join('')
      +'</div>'
    :'';
  var h='<div class="jvm-section">'
    +'<div class="jvm-section-title">◈ JARVIS — STATUT SYSTÈME</div>'
    // Ligne état
    +'<div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin-bottom:.55rem;font-size:var(--fs-xs);font-family:\'Courier New\',monospace">'
    +'<span style="color:'+(_online?'var(--green)':'var(--red)')+';font-weight:700">'+(_online?'● ONLINE':'○ OFFLINE')+'</span>'
    +'<span style="color:var(--muted)">Modèle</span><span style="color:rgba(191,95,255,.85)">'+esc(gs.model||(document.getElementById('jv-tile-model')||{}).textContent||'—')+'</span>'
    +'<span style="color:var(--muted)">Uptime</span><span style="color:rgba(191,95,255,.7)">'+esc(gs.uptime||'—')+'</span>'
    +'<span style="color:var(--muted)">Auto-engine</span><span style="color:'+(_enabled?'var(--green)':'var(--muted)')+'">'+(_enabled?'ACTIF':'DÉSACTIVÉ')+'</span>'
    +'</div>'
    // GPU / CPU stats
    +'<div class="jvm-thresh-grid" style="margin-bottom:.55rem">'
    +(temp!==null?'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">GPU Température</span><span class="jvm-thresh-val" style="color:'+tempCol+'">'+temp+' °C</span></div>':'')
    +(gs.gpu_util!==undefined?'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">GPU Compute</span><span class="jvm-thresh-val" style="color:'+gpuCol+'">'+gs.gpu_util+' %</span></div>':'')
    +(gs.mem_total?'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">VRAM utilisée</span><span class="jvm-thresh-val" style="color:'+vramCol+'">'+(Math.round(gs.mem_used*10)/10)+' / '+(Math.round(gs.mem_total*10)/10)+' Go ('+vramPct+'%)</span></div>':'')
    +(gs.power_draw?'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">GPU Power</span><span class="jvm-thresh-val" style="color:var(--amber)">'+Math.round(gs.power_draw)+' W / '+(gs.power_limit||360)+' W</span></div>':'')
    +(gs.cpu!==undefined?'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">CPU Windows</span><span class="jvm-thresh-val" style="color:'+cpuCol+'">'+gs.cpu+' %  ·  '+(gs.cpu_count||'?')+' cœurs  ·  '+(gs.cpu_freq||'?')+' MHz</span></div>':'')
    +(gs.ram_total?'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">RAM Windows</span><span class="jvm-thresh-val" style="color:var(--cyan)">'+(Math.round(gs.ram_used))+' / '+(Math.round(gs.ram_total))+' Go</span></div>':'')
    +'</div>'
    // Routes SOC
    +'<div class="jvm-section-title" style="margin-top:.3rem">◈ CONNECTIVITÉ ROUTES SOC</div>'
    +'<div class="jvm-thresh-grid">'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">/api/stats (GPU · CPU · RAM)</span><span class="jvm-thresh-val" style="color:'+(_online?'var(--green)':'var(--red)')+'">'+(_online?'✓ OK':'✗ HORS LIGNE')+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">/api/soc/ban-ip (SSH id_nginx)</span><span class="jvm-thresh-val" style="color:'+(sshOk?'var(--green)':'var(--amber)')+'">'+( sshOk?'✓ OK':'⚠ vérifier')+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">/api/soc/actions (journal)</span><span class="jvm-thresh-val" style="color:'+(_PRO_DATA&&_PRO_DATA.by_type?'var(--green)':'var(--muted)')+'">'+(_PRO_DATA&&_PRO_DATA.by_type?'✓ OK':'—')+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">/api/security (garde-fou LLM)</span><span class="jvm-thresh-val" style="color:'+(_SEC_DATA&&_SEC_DATA.by_level?'var(--green)':'var(--muted)')+'">'+(_SEC_DATA&&_SEC_DATA.by_level?'✓ OK':'—')+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">TTS /api/speak (séquentiel)</span><span class="jvm-thresh-val" style="color:'+(_ttsEnabled?'var(--green)':'var(--muted)')+'">'+(_ttsEnabled?'✓ ACTIVÉ · lock OK':'DÉSACTIVÉ')+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Auto-ban EXPLOIT CVE (seuil)</span><span class="jvm-thresh-val" style="color:var(--orange)">✓ min '+(_autoThresh.banExploitMin||1)+' hit → ban immédiat</span></div>'
    +'</div>'
    +'</div>'
  // 4 stats
  +'<div class="jvm-section">'
    +'<div class="jvm-section-title">◈ STATISTIQUES SESSION</div>'
    +'<div class="jvm-stat-grid">'
    +'<div class="jvm-stat-box"><div class="jvm-stat-val jv-sv-a">'+_jvCnt.a+'</div><div class="jvm-stat-lbl">Analyses</div></div>'
    +'<div class="jvm-stat-box"><div class="jvm-stat-val jv-sv-al">'+_jvCnt.al+'</div><div class="jvm-stat-lbl">Alertes</div></div>'
    +'<div class="jvm-stat-box"><div class="jvm-stat-val jv-sv-ban">'+(bt.ban_ip||0)+'</div><div class="jvm-stat-lbl">Bans auto</div></div>'
    +'<div class="jvm-stat-box"><div class="jvm-stat-val jv-sv-rst">'+(bt.restart_service||0)+'</div><div class="jvm-stat-lbl">Restarts</div></div>'
    +'</div>'
    +'<div style="display:flex;gap:.5rem;font-size:var(--fs-xs);font-family:\'Courier New\',monospace;color:var(--muted)">'
    +'<span>Succès : <span style="color:var(--green)">'+(d.success||0)+'</span></span>'
    +'<span>Échecs : <span style="color:var(--red)">'+(d.failed||0)+'</span></span>'
    +'<span>Déblocages : <span style="color:var(--cyan)">'+(bt.unban_ip||0)+'</span></span>'
    +'<span>Garde-fou LLM bloqués : <span style="color:var(--orange)">'+(secD.total||0)+'</span></span>'
    +'</div>'
    +'</div>'
  // Journal + Seuils + Historique
  +'<div class="jvm-section">'
    +'<div class="jvm-section-title">⬡ JOURNAL ACTIONS PROACTIVES</div>'
    +journalBodyHtml2
    +'</div>'
  // Seuils configurés
  +'<div class="jvm-section">'
    +'<div class="jvm-section-title">◈ SEUILS AUTO-ENGINE</div>'
    +'<div class="jvm-thresh-grid">'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Ban logs nginx (req/15min)</span><span class="jvm-thresh-val">'+_autoThresh.banMinCount+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Ban honeypot (hits min)</span><span class="jvm-thresh-val">'+_autoThresh.banNhMin+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl" style="color:var(--orange)">Ban EXPLOIT CVE (hits min)</span><span class="jvm-thresh-val" style="color:var(--orange)">'+(_autoThresh.banExploitMin||1)+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Alerte CPU Windows (%)</span><span class="jvm-thresh-val">'+_autoThresh.cpu+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Alerte IPs bannies</span><span class="jvm-thresh-val">'+_autoThresh.banned+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Alerte erreurs 5xx (%)</span><span class="jvm-thresh-val">'+_autoThresh.errorRate+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Δ événements → analyse</span><span class="jvm-thresh-val">+'+_autoThresh.attackDelta+'</span></div>'
    +'<div class="jvm-thresh-row"><span class="jvm-thresh-lbl">Auto-restart service DOWN</span><span class="jvm-thresh-val" style="color:'+(_autoThresh.autoRestart?'var(--green)':'var(--muted)')+'">'+(_autoThresh.autoRestart?'OUI':'NON')+'</span></div>'
    +'</div>'
    +'</div>'
  +historyHtml2;
  document.getElementById('modal-card').classList.add('modal-wide','theme-purple');
  var mb=document.getElementById('modal-body');
  mb.innerHTML=h;
  var ht=document.getElementById('modal-header-title');
  if(ht) ht.textContent='// JARVIS — INTELLIGENCE PROACTIVE';
  openModal();
};

window._proOpenModal = function(){
  var m=document.getElementById('pro-modal');
  if(m) m.classList.add('show');
  window._proRefreshModal();
};

window._proClear = function(){
  fetch(JV_URL+'/api/soc/actions/clear',{method:'POST',signal:AbortSignal.timeout(5000)})
    .then(function(){ _PRO_DATA={total:0,by_type:{ban_ip:0,unban_ip:0,restart_service:0},actions:[]}; updateProTile(_PRO_DATA); window._proRefreshModal(); })
    .catch(function(e){ console.warn('[JARVIS] soc/actions/clear failed:',e); });
};

window._proRefreshModal = function(){
  var body=document.getElementById('pro-modal-body');
  if(!body) return;
  var acts=(_PRO_DATA.actions||[]);
  if(!acts.length){
    body.innerHTML='<div class="pro-no-act">Aucune opération proactive depuis le démarrage de JARVIS</div>';
    return;
  }
  var html='<div style="display:grid;grid-template-columns:140px 120px 70px 1fr;gap:.5rem;font-size:var(--fs-xs);color:var(--muted);font-family:\'Courier New\',monospace;margin-bottom:.5rem;padding-bottom:.4rem;border-bottom:1px solid rgba(255,255,255,0.06)">'
    +'<span>HORODATAGE</span><span>TYPE</span><span>STATUT</span><span>DÉTAIL</span></div>';
  acts.forEach(function(a){
    var tc={'ban_ip':'pro-type-ban','unban_ip':'pro-type-unban','restart_service':'pro-type-svc'}[a.type]||'';
    var ok=a.success?'<span class="pro-ok">✓ OK</span>':'<span class="pro-fail">✗ ÉCHEC</span>';
    html+='<div class="pro-act-row">'
      +'<span style="color:var(--muted)">'+esc(a.ts)+'</span>'
      +'<span class="'+tc+'">'+esc((a.type||'?').replace('_',' ').toUpperCase())+'</span>'
      +ok
      +'<span>'+esc(a.detail||'')+(a.result?'<br><span style="color:rgba(255,255,255,0.28);font-size:var(--fs-xs)">'+esc(a.result.slice?a.result.slice(0,120):String(a.result).slice(0,120))+'</span>':'')+'</span>'
      +'</div>';
  });
  body.innerHTML=html;
};

// ═══════════════════════════════════════════════════════════════
// §5 — SNAPSHOTS UFW (historique pare-feu — localStorage)
// ═══════════════════════════════════════════════════════════════
var _FW_SNAP_KEY  = 'jv_fw_snaps';
var _FW_SNAP_MAX  = 48; // 48 snapshots max en localStorage (~2 jours)

function _loadSnaps(){
  try{ return JSON.parse(localStorage.getItem(_FW_SNAP_KEY)||'[]'); }catch(e){ return []; }
}
function _saveSnaps(arr){
  try{ localStorage.setItem(_FW_SNAP_KEY,JSON.stringify(arr)); }catch(e){console.error('[SOC]',e);}
}

window._fwSnapshotNow = function(){
  var d = window._lastData;
  if(!d){ alert('Aucune donnée disponible — attendre le prochain refresh'); return; }
  var fw = d.firewall_matrix || {};
  var snap = {
    ts:    new Date().toISOString(),
    label: new Date().toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),
    fw:    fw,
    ufw:   d.ufw || {},
    conformity_min: (function(){
      var scores=(fw.hosts||[]).filter(function(h){return h.conformity!==undefined;}).map(function(h){return h.conformity;});
      return scores.length?Math.min.apply(null,scores):null;
    })()
  };
  var snaps = _loadSnaps();
  snaps.unshift(snap);
  if(snaps.length > _FW_SNAP_MAX) snaps = snaps.slice(0, _FW_SNAP_MAX);
  _saveSnaps(snaps);
  var btn = document.querySelector('.fw-snap-btn');
  if(btn){ btn.textContent='✓ Sauvé'; setTimeout(function(){ btn.textContent='📸 Snapshot'; },_UI_BTN_RESET_MS); }
};

window._fwOpenSnapHist = function(){
  var m = document.getElementById('snap-modal');
  if(m){ m.classList.add('show'); _fwRenderSnapHist(null); }
};

window._fwClearSnaps = function(){
  if(!confirm('Supprimer tous les snapshots UFW ?')) return;
  _saveSnaps([]);
  _fwRenderSnapHist(null);
};

function _fwDiffHosts(a, b){
  // Compare deux tableaux hosts, retourne les différences par host
  var aMap={}, bMap={}, diffs=[];
  (a||[]).forEach(function(h){ aMap[h.name]=h; });
  (b||[]).forEach(function(h){ bMap[h.name]=h; });
  var names = Object.keys(Object.assign({},aMap,bMap));
  names.forEach(function(n){
    var ha=aMap[n], hb=bMap[n];
    var changes=[];
    if(!ha){ changes.push({type:'added',msg:'Hôte apparu'}); }
    else if(!hb){ changes.push({type:'removed',msg:'Hôte disparu'}); }
    else {
      if(ha.conformity!==hb.conformity) changes.push({type:'changed',msg:'Conformité : '+ha.conformity+' → '+hb.conformity});
      if(ha.ufw_active!==null&&hb.ufw_active!==null&&ha.ufw_active!==hb.ufw_active) changes.push({type:'changed',msg:'UFW actif : '+ha.ufw_active+' → '+hb.ufw_active});
      if(ha.ufw_rules!==hb.ufw_rules) changes.push({type:'changed',msg:'Nb règles : '+(ha.ufw_rules||'?')+' → '+(hb.ufw_rules||'?')});
      var ap=(ha.listening_ports||[]).slice().sort().join(',');
      var bp=(hb.listening_ports||[]).slice().sort().join(',');
      if(ap!==bp){
        var apArr=(ha.listening_ports||[]), bpArr=(hb.listening_ports||[]);
        var added=bpArr.filter(function(p){return apArr.indexOf(p)<0;});
        var removed=apArr.filter(function(p){return bpArr.indexOf(p)<0;});
        if(added.length) changes.push({type:'added',msg:'Ports ouverts : +'+added.join(', ')});
        if(removed.length) changes.push({type:'removed',msg:'Ports fermés : -'+removed.join(', ')});
      }
      var ai=(ha.issues||[]).join('|'), bi=(hb.issues||[]).join('|');
      if(ai!==bi) changes.push({type:'changed',msg:'Issues: ['+esc(bi)+']'});
    }
    if(changes.length) diffs.push({name:n,changes:changes});
  });
  return diffs;
}

function _fwRenderSnapHist(activeIdx){
  var body = document.getElementById('snap-modal-body');
  if(!body) return;
  var snaps = _loadSnaps();
  if(!snaps.length){
    body.innerHTML='<div class="snap-empty">Aucun snapshot enregistré</div>';
    return;
  }
  var idx = activeIdx !== null && activeIdx !== undefined ? activeIdx : 0;
  // Liste des snapshots
  var listHtml = '<div class="snap-list">';
  snaps.forEach(function(s,i){
    var hasDiff = i < snaps.length-1 && _fwDiffHosts((snaps[i+1]||{fw:{}}).fw.hosts, s.fw.hosts).length>0;
    listHtml += '<div class="snap-item'+(i===idx?' active':'')+(hasDiff?' snap-diff':'')+'" data-snap-idx="'+i+'" title="'+(hasDiff?'Différences détectées vs snapshot précédent':'Identique au snapshot précédent')+'">'+esc(s.label)+(hasDiff?' ⚠':'')+'</div>';
  });
  listHtml += '</div>';
  // Snapshot sélectionné
  var snap = snaps[idx];
  var prev = snaps[idx+1];
  var fw = snap.fw||{};
  var hosts = fw.hosts||[];
  var detailHtml = '<div class="snap-diff-title">📋 Snapshot du '+esc(snap.label)+'</div>';
  // Score global
  var c = snap.conformity_min;
  var cc = c===null?'var(--muted)':c>=90?'var(--green)':c>=70?'var(--yellow)':'var(--red)';
  detailHtml += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.5rem">Conformité min : <span style="color:'+cc+';font-weight:700">'+(c!==null?c:'—')+'</span>/100 · Hosts : '+hosts.length+'</div>';
  // Diff avec snapshot précédent
  if(prev){
    var diffs = _fwDiffHosts(prev.fw.hosts, snap.fw.hosts);
    if(diffs.length){
      detailHtml += '<div class="snap-diff-title" style="color:#ff9500;margin-top:.5rem">⚠ Différences vs snapshot précédent ('+esc(prev.label)+')</div>';
      diffs.forEach(function(d){
        detailHtml += '<div class="snap-host-block">';
        detailHtml += '<div class="snap-host-name">'+esc(d.name)+'</div>';
        d.changes.forEach(function(c){
          var cls = {added:'snap-rule-added',removed:'snap-rule-removed',changed:'snap-rule-changed'}[c.type]||'';
          detailHtml += '<div class="snap-rule-row '+cls+'">'+({added:'+ ',removed:'- ',changed:'⟳ '}[c.type]||'')+esc(c.msg)+'</div>';
        });
        detailHtml += '</div>';
      });
    } else {
      detailHtml += '<div class="snap-no-diff">✓ Aucune différence détectée vs snapshot précédent</div>';
    }
  }
  // État des hosts
  detailHtml += '<div class="snap-diff-title" style="margin-top:.6rem">État des hôtes</div>';
  hosts.forEach(function(h){
    detailHtml += '<div class="snap-host-block">';
    detailHtml += '<div class="snap-host-name">'+esc(h.name)+(h.ip?' <span style="color:var(--muted);font-weight:400">'+esc(h.ip)+'</span>':'')+'</div>';
    if(h.conformity!==undefined) detailHtml += '<div class="snap-rule-row">Conformité : <b style="color:'+(h.conformity>=90?'var(--green)':h.conformity>=70?'var(--yellow)':'var(--red)')+'">'+h.conformity+'</b>/100</div>';
    var _isPveFw = h.fw_type==='proxmox-fw';
    if(h.ufw_rules!==undefined)  detailHtml += '<div class="snap-rule-row">Règles '+(_isPveFw?'PVE-FW':'UFW')+' : '+h.ufw_rules+'</div>';
    if(_isPveFw){
      detailHtml += '<div class="snap-rule-row">PVE-FW : <span class="snap-rule-added">ACTIF</span></div>';
    } else if(h.ufw_active!==undefined&&h.ufw_active!==null){
      detailHtml += '<div class="snap-rule-row">UFW actif : '+(h.ufw_active?'<span class="snap-rule-added">OUI</span>':'<span class="snap-rule-removed">NON</span>')+'</div>';
    }
    (h.listening_ports||[]).length && (detailHtml += '<div class="snap-rule-row">Ports ouverts : '+esc((h.listening_ports||[]).join(', '))+'</div>');
    (h.issues||[]).forEach(function(iss){ detailHtml += '<div class="snap-rule-row snap-rule-changed">▸ '+esc(iss)+'</div>'; });
    detailHtml += '</div>';
  });
  body.innerHTML = listHtml + detailHtml;
  body.querySelectorAll('.snap-item[data-snap-idx]').forEach(function(el){
    el.addEventListener('click',function(){
      if(window._fwRenderSnapHist)window._fwRenderSnapHist(parseInt(this.dataset.snapIdx));
    });
  });
}
// Expose pour appel externe
window._fwRenderSnapHist = _fwRenderSnapHist;

// ═══════════════════════════════════════════════════════════════
// §6 — TUILE JARVIS (grille principale)
// ═══════════════════════════════════════════════════════════════
window.buildJarvisTileInner = function(){
  return '<div class="jv-tile-hdr">'
    +'<button class="jv-tile-st offline" id="jv-tile-st" title="Tester la connexion JARVIS">⬡ OFFLINE</button>'
    +'<span class="jv-engine-ind" id="jv-engine-ind">○ ENGINE</span>'
    +'<span class="jv-tile-model" id="jv-tile-model">—</span>'
    +'</div>'
    +'<div class="jv-stat-grid">'
    +'<div class="jv-stat-box"><div class="jv-stat-val jv-sv-a" id="jv-cnt-a">0</div><div class="jv-stat-lbl">Analyses</div></div>'
    +'<div class="jv-stat-box"><div class="jv-stat-val jv-sv-al" id="jv-cnt-al">0</div><div class="jv-stat-lbl">Alertes</div></div>'
    +'<div class="jv-stat-box"><div class="jv-stat-val jv-sv-ban" id="jv-cnt-ban-t">0</div><div class="jv-stat-lbl">Bans auto</div></div>'
    +'<div class="jv-stat-box"><div class="jv-stat-val jv-sv-rst" id="jv-cnt-rst-t">0</div><div class="jv-stat-lbl">Restarts</div></div>'
    +'</div>'
    +'<div id="jv-sys-bar" style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;font-size:var(--fs-xs);font-family:\'Courier New\',monospace;color:var(--muted);padding:.2rem 0 .35rem;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:.35rem"><span style="opacity:.4">—</span></div>'
    +'<div class="jv-countdown-wrap">'
    +'<span class="jv-countdown-lbl">Prochain cycle</span>'
    +'<div class="jv-countdown-bar"><div class="jv-countdown-fill" id="jv-cd-fill"></div></div>'
    +'<span class="jv-countdown-s" id="jv-cd-s">—</span>'
    +'</div>'
    +'<div class="jv-last-act-row" id="jv-tile-last-act"><span style="color:rgba(122,154,184,0.35);font-size:var(--fs-xs)">Aucune action — surveillance active</span></div>'
    +'<canvas id="jv-ban-spark" height="32" style="width:100%;display:block;margin:.1rem 0 .35rem;border-radius:2px;background:rgba(0,0,0,.15)"></canvas>'
    +'<div id="jv-tile-body"><div class="jv-tile-idle">Aucune analyse récente — surveillance active</div></div>'
    +'<div style="display:flex;gap:.45rem;align-items:center;margin-top:.55rem">'
    +'<span class="jv-tile-ts" id="jv-tile-last">—</span>'
    +'<button id="jv-btn-detail" class="jv-tile-open" style="flex:1;display:none">◈ DÉTAIL COMPLET</button>'
    +'</div>';
};

function updateJarvisTile(type, text){
  var body = document.getElementById('jv-tile-body');
  if(!body) return;
  var labels = {analyse:'⚡ Analyse auto', alerte:'⚠ Alerte critique', resume:'📋 Résumé du jour'};
  var lbl = labels[type] || type;
  var ts = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  // Compteurs
  if(type==='alerte') _jvCnt.al++;
  else if(type==='analyse') _jvCnt.a++;
  _jvCnt.lastAt = ts;
  var ca=document.getElementById('jv-cnt-a'); if(ca) ca.textContent=_jvCnt.a;
  var cal=document.getElementById('jv-cnt-al'); if(cal) cal.textContent=_jvCnt.al;
  var site01=document.getElementById('jv-tile-last'); if(site01) site01.textContent='dernière : '+ts;
  // Engine indicator actif pendant 8s
  var eind=document.getElementById('jv-engine-ind');
  if(eind){ eind.className='jv-engine-ind active'; eind.textContent='⚡ ANALYSE'; setTimeout(function(){ var ei=document.getElementById('jv-engine-ind'); if(ei){ ei.className='jv-engine-ind'; ei.textContent='◈ ENGINE'; } },_UI_ENGINE_IND_MS); }
  // Contenu
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem">'
    +'<span class="jv-tile-kind '+type+'">'+lbl+'</span>'
    +'<span class="jv-tile-ts">'+ts+'</span>'
    +'</div>'
    +'<div class="jv-tile-txt">'+esc(text)+'</div>';
}

// ── _autoThresh stub — valeurs réelles injectées par engine.js ───────
// Déclaré ici pour éviter undefined si updateProTile/openJvModal appelés
// avant DOMContentLoaded. engine.js réassigne depuis localStorage.
var _autoThresh = {};
