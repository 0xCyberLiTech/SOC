'use strict';
// ── CONFIG INFRA — source unique pour toutes les IPs du homelab ──
var SOC_INFRA={
  SRV_NGIX: '<SRV-NGIX-IP>',
  PROXMOX:  '<PROXMOX-IP>',
  CLT:      '<CLT-IP>',
  PA85:     '<PA85-IP>',
  FREEBOX:  '<BOX-IP>',
  ROUTER:   '<ROUTER-IP>',
  LAN_CIDR: '<LAN-CIDR>',
  SSH_PORT: '<SSH-PORT>',
  SSH_KEY:  'id_nginx'
};

// ── PALETTE KILL CHAIN — source unique (hex + rgb) pour 02/03/05/06 ─────────
var KC_PALETTE={
  RECON:   {color:'#bf5fff', rgb:'191,95,255'},
  SCAN:    {color:'#ff6b35', rgb:'255,107,53'},
  EXPLOIT: {color:'#ffd700', rgb:'255,215,0'},
  BRUTE:   {color:'#ff3b5c', rgb:'255,59,92'},
  BLOCKED: {color:'#00ff88', rgb:'0,255,136'}
};
var _CVE_RE=/CVE-\d{4}-\d+/i; // source unique — 02-canvas-kc (×2)

// ── CONFIG JARVIS — source unique pour l'URL JARVIS (DT-A) ──────────────────
// IPv4 forcé — Chrome résout localhost en ::1 (IPv6) mais JARVIS écoute sur 127.0.0.1 uniquement
var JV_URL = 'http://127.0.0.1:5000';

// ── INTERVALLES DE POLLING — DT-E ────────────────────────────────────────────
var _POLL_MONITOR_MS   = 60000; // rafraîchissement monitoring.json  (17-fetch)
var _POLL_ROUTER_MS    = 30000; // rafraîchissement router.json       (17-fetch)
var _POLL_FRESHNESS_MS = 30000; // vérification fraîcheur données    (16-soc-enhancements)
var _POLL_HEARTBEAT_MS  = 15000; // heartbeat JARVIS                   (17-fetch)
var _LAN_RE             = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/; // RFC1918 + loopback
var _XHR_TIMEOUT_MON_MS = 15000; // timeout XHR monitoring.json       (17-fetch)
var _POLL_PROTO_MS      = 15000; // polling proto live                 (17-fetch)

// ── CLÉS LOCALSTORAGE — DT-F ─────────────────────────────────────────────────
var _LS_KEYS = {
  SOC_AI:          'soc_ai',
  SOC_AI_TTS:      'soc_ai_tts',
  KC_FIRST_SEEN:   '_kcFirstSeen',
  CS_KEY:          '_soc_cs_key',
  PREV_BAN_TS:     '_soc_prevBanTs',
  JV_HISTORY:      'jv_history',
  JV_THRESH:       'jv_thresh',
  JV_LAST_ALERTS:  'jv_last_alerts',
  JV_LAST_SUMMARY: 'jv_last_summary',
  JV_SUMMARY_TEXT: 'jv_summary_text',
  JV_FW_SNAPS:     'jv_fw_snaps'
};

// ── GLOBALS PARTAGÉS ──
var _isOpen=false;         // état overlay modal — écrit par openModal/closeModal (09-modals-core)
var _snap={};             // snapshot cycle précédent pour deltas — écrit par render() (07-render)
var _lastModified='';     // header Last-Modified monitoring.json — écrit par load() (17-fetch)
var _lastModifiedProto='';// header Last-Modified proto-live.json — écrit par loadProtoLive() (17-fetch)
// NDT-148 — constante partagée (10-modals-win + 17-fetch + 18-jarvis-engine)
var _winHistMax=30;
// NDT-87/88/89 — DOM refs modal — partagées par 08/09/10/12/14/15/17
var _overlay=document.getElementById('overlay');
var _modalBody=document.getElementById('modal-body');
var _modalClose=document.getElementById('modal-close');
// NDT-92/93/94 — état GeoMap — partagé par 05/06/07/04/09
var _lfMapTip=null;
var _lfLastGeoips=[];
var _lfLastWanIp=null;
// NDT-99 — _lastThreatResult → shim _SOC.lastThreatResult (pas de var ici — conflit defineProperty)

// ── INVENTAIRE GLOBALS window._ (communication inter-modules) ──
// window._lastData        → dernière réponse monitoring.json parsée       — 07-render (w) / tous (r)
// window._lastTraffic     → raccourci d.traffic                           — 07-render (w) / 16-enhancements (r)
// _lastThreatResult       → résultat computeThreatScore()                 — 07-render (w) / 05-leaflet (r) — déclaré ci-dessus
// window._routerData      → dernière réponse router SSH                   — 12-router (w) / 13-fw (r)
// window._routerHistory   → historique métriques routeur                  — 12-router (w) / 12-router (r)
// window._liveProto       → compteurs proto courants (proto-live.json)    — 17-fetch (w) / 04-misc/09-core (r)
// window._liveProtoFull   → réponse proto-live.json complète              — 17-fetch (w) / 09-core (r)
// window._winCpuHistory   → historique CPU Windows (derniers N cycles)    — 17-fetch (w) / 10-win (r)
// window._winGpuHistory   → historique GPU Windows                        — 17-fetch (w) / 10-win (r)
// window._winVramHistory  → historique VRAM Windows                       — 17-fetch (w) / 10-win (r)
// window._winPwrHistory   → historique puissance GPU Windows (power_pct)  — 17-fetch (w) / 10-win (r)
// window._jvLastStats     → dernières stats JARVIS (GPU, CPU, mémoire)    — 18-jarvis (w) / 17-fetch (r)
// window._jvAutoCheck     → hook auto-engine JARVIS(data)                 — 18-jarvis (w) / 17-fetch (r)
// window._jvActiveModel   → modèle LLM actif Ollama                      — 17-fetch (w) / 17-fetch (r)
// window._fwSnapshotNow   → déclenche snapshot firewall manuellement      — 18-jarvis (w) / 14-modal-fw (r)
// window._fwOpenSnapHist  → ouvre historique snapshots firewall           — 18-jarvis (w) / 14-modal-fw (r)
// window._fwClearSnaps    → vide tous les snapshots firewall localStorage — 18-jarvis (w) / 14-modal-fw (r)
// window._fbxAuthError    → flag erreur auth Freebox                      — 08-fbx (w)   / 11-bind (r)
// window._winModalType    → type modal Windows actif ('res'|'bkp')        — 17-fetch (w) / 17-fetch (r)
// window._lfMap           → instance carte Leaflet                        — 05-leaflet (w/r interne)
// window._lfMarkers       → marqueurs Leaflet actifs                      — 05-leaflet (w/r interne)
// window._mapZone         → zone active carte ('MONDE'|'EUROPE'|…)        — 06-geomap (w/r interne)
// window._mapFrFlash      → flag flash France sur carte                   — 06-geomap (w/r interne)
// window._routerFlows     → derniers flux firewall routeur                 — 12-router (w) / 13-fw (r)
// window._ablData         → log auto-ban courant                          — 07-render (w) / 09-core (r)
// window._sfpData         → données sparklines Freebox speed              — 08-fbx (w/r interne)
// window._fbxData         → dernière réponse Freebox API                  — 08-fbx (w/r interne)
// window._fbxPendingHtml  → HTML modal Freebox en attente auth            — 08-fbx (w/r interne)
// window._fbxSparkVals    → valeurs sparkline Freebox                     — 08-fbx (w/r interne)
// window._secOpenModal    → ouvre modal sécurité 24h                      — 09-core (w) / 11-bind (r)
// window._secRefreshModal → rafraîchit modal sécurité                     — 09-core (w) / 17-fetch (r)
// window._secClear        → vide données modal sécurité                   — 09-core (w) / interne (r)
// window._proOpenModal    → ouvre modal protocoles                        — 09-core (w) / 11-bind (r)
// window._proRefreshModal → rafraîchit modal protocoles                   — 09-core (w) / 17-fetch (r)
// window._proClear        → vide données modal protocoles                 — 09-core (w) / interne (r)
// window._fwRenderSnapHist→ rendu historique snapshot firewall            — 18-jarvis (w) / 14-modal-fw (r)
// window._kcAutoBanned    → set IPs auto-bannées Kill Chain               — 02-canvas-kc (w/r interne)
// window._kcFirstSeen     → map IP → timestamp première détection         — 02-canvas-kc (w/r interne)
// window._kcEscalated     → set IPs escaladées (flash ⚡)                 — 02-canvas-kc (w/r interne)
// window._kcPrevCounts    → compteurs KC cycle précédent (delta)          — 02-canvas-kc (w/r interne)
// window._kcPrevStages    → stages KC cycle précédent                     — 02-canvas-kc (w/r interne)
// window._kcStageEntered  → map IP → stage MITRE actuel                  — 02-canvas-kc (w/r interne)
// window._kcCritThresh    → seuil critique auto-ban Kill Chain            — 02-canvas-kc (w/r interne)
// window._kcDeltaDisplay  → flag affichage delta KC                       — 02-canvas-kc (w/r interne)
// window._jvClose         → ferme panel JARVIS                            — 18-jarvis (w) / 11-bind (r)
// window._jvSend          → envoie message JARVIS                         — 18-jarvis (w) / 11-bind (r)
// window._jvSpeak         → déclenche TTS JARVIS                         — 18-jarvis (w) / interne (r)
// window._jvStopSpeak     → arrête TTS JARVIS                            — 18-jarvis (w) / interne (r)
// window._jvCancel        → annule génération LLM en cours                — 18-jarvis (w) / interne (r)
// window._jvOnline        → état connectivité JARVIS (bool)               — 18-jarvis (w) / 17-fetch (r)
// window._jvToggleHist    → toggle historique chat                        — 18-jarvis (w) / interne (r)
// window._jvToggleTts     → toggle TTS on/off                            — 18-jarvis (w) / interne (r)
// window._jvToggleSettings→ toggle panneau settings                       — 18-jarvis (w) / interne (r)
// window._jvSaveSettings  → sauvegarde settings JARVIS                   — 18-jarvis (w) / interne (r)
// window._jvSaveThresh    → sauvegarde seuils auto-engine                 — 18-jarvis (w) / interne (r)
// window._jvApplyPreset   → applique preset LLM                          — 18-jarvis (w) / interne (r)
// window._jvOpenHistEntry → ouvre entrée historique chat                  — 18-jarvis (w) / interne (r)

// ── NAMESPACE _SOC — DT-06 (bus d'état centralisé inter-modules) ──
// window._xxx est un alias automatique de window._SOC.xxx via shims defineProperty.
// Les modules peuvent écrire window._xxx ou window._SOC.xxx — les deux sont synonymes.
window._SOC = Object.assign(window._SOC || {}, {
  // ── données monitoring (07-render → tous) ──
  lastData:          null,
  lastTraffic:       null,
  lastThreatResult:  null,
  // ── routeur (12-router ↔ 13-fw) ──
  routerData:        null,
  routerHistory:     [],
  routerFlows:       null,
  // ── proto-live (17-fetch → 04/09-core) ──
  liveProto:         null,
  liveProtoFull:     null,
  // ── Windows stats (17-fetch → 10-win) ──
  winCpuHistory:     [],
  winGpuHistory:     [],
  winVramHistory:    [],
  winPwrHistory:     [],
  winModalType:      null,
  // NDT-147 — état modal Windows/GPU — partagé 10-modals-win (w) / 09-core (reset) / 17-fetch (r)
  winModalOpen:      false,
  gpuModalOpen:      false,
  // ── JARVIS état (18-jarvis ↔ 17-fetch) ──
  jvLastStats:       null,
  jvAutoCheck:       null,
  jvActiveModel:     null,
  jvOnline:          false,
  // ── JARVIS contrôles (18-jarvis → 11-bind) ──
  jvClose:           null,
  jvSend:            null,
  jvSpeak:           null,
  jvStopSpeak:       null,
  jvCancel:          null,
  jvToggleHist:      null,
  jvToggleTts:       null,
  jvToggleSettings:  null,
  jvSaveSettings:    null,
  jvSaveThresh:      null,
  jvApplyPreset:     null,
  jvOpenHistEntry:   null,
  // ── firewall (18-jarvis → 14-modal-fw) ──
  fwSnapshotNow:     null,
  fwOpenSnapHist:    null,
  fwClearSnaps:      null,
  fwRenderSnapHist:  null,
  // ── Freebox (08-fbx interne) ──
  fbxAuthError:      false,
  wanData:           null,
  sfpData:           null,
  fbxData:           null,
  fbxPendingHtml:    null,
  fbxSparkVals:      null,
  // ── modals fonctions (09-core → 11-bind/17-fetch) ──
  secOpenModal:      null,
  secRefreshModal:   null,
  secClear:          null,
  proOpenModal:      null,
  proRefreshModal:   null,
  proClear:          null,
  // ── Leaflet (05-leaflet interne) ──
  lfMap:             null,
  lfMarkers:         null,
  // ── geomap (06-geomap interne) ──
  mapZone:           'MONDE',
  mapFrFlash:        false,
  // ── kill chain (02-canvas-kc interne) ──
  kcAutoBanned:      null,
  kcFirstSeen:       null,
  kcEscalated:       null,
  kcPrevCounts:      null,
  kcPrevStages:      null,
  kcStageEntered:    null,
  kcCritThresh:      0,
  kcDeltaDisplay:    false,
  // ── autoban log (07-render → 09-core) ──
  ablData:           null,
  // ── JARVIS état interne — partagé entre 18-jarvis-ui/chat/engine ──
  jvEnabled:         false,   // _enabled  : JARVIS activé (localStorage 'soc_ai')
  jvTtsEnabled:      false,   // _ttsEnabled: TTS activé (localStorage 'soc_ai_tts')
  jvThinking:        false,   // _thinking  : génération LLM en cours
  jvTtsSingleShot:   false,   // _ttsSingleShot : TTS pour une seule réponse
  jvPendingBanParse: false,   // _pendingBanParse : prochaine réponse LLM → parse ban
  jvMsgs:            [],      // _msgs : historique conversation chat
  jvProData:         null,    // _PRO_DATA : données actions SOC (ban/unban/restart)
});

// ── SHIMS DT-06 — window._xxx ↔ window._SOC.xxx (bidirectionnel, automatique) ──
// Toute écriture sur window._xxx met à jour window._SOC.xxx et vice-versa.
// Permet la migration progressive sans modifier les modules existants.
(function(){
  var _keys = [
    'lastData','lastTraffic','lastThreatResult',
    'routerData','routerHistory','routerFlows',
    'liveProto','liveProtoFull',
    'winCpuHistory','winGpuHistory','winVramHistory','winPwrHistory','winModalType','winModalOpen','gpuModalOpen',
    'jvLastStats','jvAutoCheck','jvActiveModel','jvOnline',
    'jvClose','jvSend','jvSpeak','jvStopSpeak','jvCancel',
    'jvToggleHist','jvToggleTts','jvToggleSettings',
    'jvSaveSettings','jvSaveThresh','jvApplyPreset','jvOpenHistEntry',
    'fwSnapshotNow','fwOpenSnapHist','fwClearSnaps','fwRenderSnapHist',
    'fbxAuthError','wanData','sfpData','fbxData','fbxPendingHtml','fbxSparkVals',
    'secOpenModal','secRefreshModal','secClear',
    'proOpenModal','proRefreshModal','proClear',
    'lfMap','lfMarkers',
    'mapZone','mapFrFlash',
    'kcAutoBanned','kcFirstSeen','kcEscalated','kcPrevCounts',
    'kcPrevStages','kcStageEntered','kcCritThresh','kcDeltaDisplay',
    'ablData'
  ];
  _keys.forEach(function(k){
    Object.defineProperty(window, '_'+k, {
      get: function(){ return window._SOC[k]; },
      set: function(v){ window._SOC[k] = v; },
      configurable: true, enumerable: true
    });
  });
}());

// ── Polyfill AbortSignal.timeout — NDT-01 (compat universelle) ──────────────
// Chrome 103+, Firefox 100+, Safari 16.4+ supportent nativement.
// Ce polyfill couvre les navigateurs plus anciens sans modifier les 20+ appels existants.
if(typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function'){
  AbortSignal.timeout = function(ms){
    var ctrl = new AbortController();
    setTimeout(function(){ ctrl.abort(new DOMException('TimeoutError','TimeoutError')); }, ms);
    return ctrl.signal;
  };
}

function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function fmt(n){if(n===undefined||n===null)return'—';if(n>=1e9)return(n/1e9).toFixed(1)+'G';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return String(n)}
// NDT-133 — helper unifié (était _fmtScenario slice:24 dans 07-render + _kcFmtScenario slice:40 dans 02-canvas-kc)
function fmtScenario(s,maxLen){return (s||'').replace(/^crowdsecurity\//i,'').replace(/^suricata-/i,'').replace(/_/g,'-').replace(/\s+non\s+bloqu[eé]\s*(CS)?\s*$/i,'').slice(0,maxLen||40).replace(/[-_ ]+$/,'');}
// NDT-134 — total bans F2B srv-ngix + proxmox (pattern dupliqué 02-canvas-kc + 07-render)
function _f2bTotalBanned(f2b){return ((f2b&&f2b.total_banned)||0)+((f2b&&f2b.proxmox&&f2b.proxmox.total_banned)||0);}
// NDT-138 — conversion bps→Gbps/Mbps/Kbps (était _tcFmtBps dans 04-canvas-misc + _fbxFmtBpsLeg dans 08-modals-fbx)
function fmtBps(bps){var k=(bps||0)*8/1000;if(k>=1e6)return(k/1e6).toFixed(2)+' Gbps';if(k>=1000)return(k/1000).toFixed(k>=10000?0:1)+' Mbps';return Math.round(k)+' Kbps';}
// NDT-146 — fmtKbps partagée (05-canvas-leaflet + 12-router) — définie ici pour order-safe
function fmtKbps(k){if(!k||k<=0)return'0 Kbps';if(k>=1024)return(k/1024).toFixed(1)+' Mbps';return Math.round(k)+' Kbps';}
function fmtB(b){if(!b)return'0B';var u=['B','Ko','Mo','Go'];var i=0;while(b>=1024&&i<3){b/=1024;i++;}return b.toFixed(i?1:0)+u[i]}
function fmtMb(mb){if(!mb)return'0 Mo';if(mb>=1024)return(mb/1024).toFixed(1)+' Go';return mb+' Mo'}
// NDT-156 — fmtBytes partagée (openSysModal + _sysCardHtml dans 07-render)
function fmtBytes(b){if(!b)return'0 o';return b>=1e9?(b/1e9).toFixed(1)+' Go':b>=1e6?Math.round(b/1e6)+' Mo':b>=1e3?Math.round(b/1e3)+' Ko':b+' o';}
// NDT-161 — unifie _csFmtBytes (09-modals-core) + _fmtBytesCs (07-render) — bytes→human B/Ko/Mo/Go
function fmtBytesCs(b){if(!b)return'0 B';var u=['B','Ko','Mo','Go'];var i=0;while(b>=1024&&i<3){b/=1024;i++;}return Math.round(b*10)/10+' '+u[i];}
// NDT-163 — unifie _winBkpAge (07-render) + _bkAge (10-modals-win) — jours depuis date backup
function _winBkpAge(s){if(!s)return 999;return Math.floor((Date.now()-new Date(s.replace(' ','T')).getTime())/86400000);}
// NDT-164 — unifie _winBkpCol (07-render) + _bkColor (10-modals-win) — couleur selon âge backup
function _winBkpCol(a){return a>14?'var(--red)':a>6?'var(--yellow)':'var(--green)';}
// NDT-149 — formatage date ISO locale (était dupliqué 07-render:78 + 07-render:1156 + 14-modal-firewall:15)
function _fmtDateTs(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');}
function errC(r){return r>5?'crit':r>1?'warn':'ok'}

// ── Fail2ban helpers — partagés computeThreatScore + modules ────────────────
var _BOT_JAILS=['apache-badbots','apache-noscript','apache-overflows','nginx-botsearch','nginx-badbots'];
function _f2bNonBotBanned(jls){return (jls||[]).filter(function(j){return _BOT_JAILS.indexOf(j.jail)<0;}).reduce(function(a,j){return a+(j.cur_banned||0);},0);}

// ── computeThreatScore sub-functions (_ts*) ──────────────────────────────────
function _tsTraffic(d){
  var t=d.traffic||{};
  var s=0,f=[];
  var total=Math.max(t.total_requests||0,1);
  // GeoIP (max 8pts) — 403 légitimes attendus pour un site géo-restreint
  var geoRate=(t.geo_blocks||0)/total;
  if(geoRate>0.6){s+=8;f.push({t:'GeoIP massif ('+Math.round(geoRate*100)+'%)',c:'r'});}
  else if(geoRate>0.3){s+=4;f.push({t:'GeoIP élevé',c:'y'});}
  else if(geoRate>0.1){s+=1;}
  // Erreurs (max 8pts)
  var err=t.error_rate||0;
  if(err>35){s+=8;f.push({t:'Erreurs '+err+'%',c:'r'});}
  else if(err>15){s+=4;f.push({t:'Erreurs '+err+'%',c:'y'});}
  else if(err>5){s+=2;}
  // Scanners (max 20pts) — < 200 reqs = bruit normal internet
  var scans=(t.top_scanners||[]).reduce(function(a,e){return a+e[1];},0);
  if(scans>1000){s+=20;f.push({t:'Scanners ('+fmt(scans)+')',c:'r'});}
  else if(scans>200){s+=10;f.push({t:'Scanners détectés',c:'y'});}
  else if(scans>50){s+=4;}
  return {s:s,f:f};
}
function _tsSshUfw(d){
  var s=0,f=[];
  // SSH brute force (max 15pts) — port non-standard 2272 = peu exposé
  var sshFail=0;(d.ssh||[]).forEach(function(m){sshFail+=m.failed_24h||0;});
  if(sshFail>100){s+=15;f.push({t:'Brute force SSH',c:'r'});}
  else if(sshFail>20){s+=7;f.push({t:'SSH attaques',c:'y'});}
  else if(sshFail>5){s+=2;}
  // UFW (max 10pts) — 500/jour = bruit normal, critique > 5000
  var ufwB=(d.ufw||{}).blocked_total||0;
  if(ufwB>5000){s+=10;f.push({t:'UFW '+fmt(ufwB)+' bloqs',c:'r'});}
  else if(ufwB>2000){s+=5;f.push({t:'UFW élevé',c:'y'});}
  else if(ufwB>500){s+=2;}
  return {s:s,f:f};
}
function _tsKillChain(d){
  var s=0,f=[];
  var kc=d.kill_chain||{},sc=kc.stage_counts||{};
  var exploitCount=sc.EXPLOIT||0;
  var activeIps=kc.active_ips||[];
  var kcActive=kc.total_active||0;
  var exploitUnblocked=activeIps.filter(function(ip){return ip.stage==='EXPLOIT'&&!ip.cs_decision;}).length;
  var bruteCount=sc.BRUTE||0;
  var bruteUnblocked=activeIps.filter(function(ip){return ip.stage==='BRUTE'&&!ip.cs_decision;}).length;
  if(exploitCount>0){
    if(exploitUnblocked>=3){s+=30;f.push({t:'EXPLOIT non bloqué ('+exploitUnblocked+' IP)',c:'r'});}
    else if(exploitUnblocked>=1){s+=20;f.push({t:'EXPLOIT actif ('+exploitUnblocked+' IP non bloquée)',c:'r'});}
    else{f.push({t:'EXPLOIT neutralisé CS ('+exploitCount+' IP)',c:'g'});}
    // BRUTE coexistant avec EXPLOIT — menace secondaire si non bloquée
    if(bruteUnblocked>0){s+=10;f.push({t:'BRUTE: '+bruteUnblocked+' IP non bloquée',c:'r'});}
  }else if(bruteCount>0){
    s+=20;f.push({t:'BRUTE FORCE actif',c:'r'});
  }else if((sc.SCAN||0)>0){s+=10;f.push({t:'SCAN actif ('+(sc.SCAN)+' IP)',c:'y'});}
  else if((sc.RECON||0)>0){s+=4;f.push({t:'RECON détecté',c:'y'});}
  return {s:s,f:f,exploitUnblocked:exploitUnblocked,kcActive:kcActive,exploitCount:exploitCount};
}
function _tsCrowdSec(d,exploitUnblocked,exploitCount){
  var s=0,f=[];
  var cs=d.crowdsec||{};
  var csD=cs.active_decisions||cs.decisions||0;
  var csS=((d.kill_chain||{}).cs_stage_counts)||{};
  if(csD>10){s+=20;f.push({t:'CrowdSec: '+csD+' IPs bannies',c:'r'});}
  else if(csD>3){s+=12;f.push({t:'CrowdSec: '+csD+' décisions',c:'y'});}
  else if(csD>0){s+=6;f.push({t:'CrowdSec: '+csD+' décision'+(csD>1?'s':''),c:'y'});}
  // CS EXPLOIT : compter uniquement si des IPs EXPLOIT restent non bloquées (évite double-comptage)
  if((csS.EXPLOIT||0)>0&&exploitUnblocked>0){s+=10;f.push({t:'CS EXPLOIT: '+(csS.EXPLOIT)+' scénario'+(csS.EXPLOIT>1?'s':''),c:'r'});}
  else if((csS.BRUTE||0)>0){s+=5;f.push({t:'CS BRUTE: '+(csS.BRUTE)+' scénario'+(csS.BRUTE>1?'s':''),c:'r'});}
  // CS neutralisation EXPLOIT — signal positif (menace gérée) → pas de points supplémentaires
  else if(exploitCount>0&&exploitUnblocked===0&&csD>0){f.push({t:'EXPLOIT neutralisé CS ('+csD+' décisions actives)',c:'g'});}
  // CS SCAN / RECON scénarios actifs — signal modéré
  if((csS.SCAN||0)>1){s+=3;f.push({t:'CS SCAN: '+(csS.SCAN)+' scénario'+(csS.SCAN>1?'s':''),c:'y'});}
  else if((csS.SCAN||0)===1){s+=1;}
  if((csS.RECON||0)>2){s+=2;f.push({t:'CS RECON: '+(csS.RECON)+' scénario'+(csS.RECON>1?'s':''),c:'y'});}
  return {s:s,f:f,csD:csD};
}
function _tsKillRate(d,kcActive,csD){
  // Kill Rate — proportion menaces non neutralisées (max 10pts)
  // _kcNeutralized = CrowdSec decisions (inclut F2B srv-ngix via crowdsec-sync)
  //                + F2B satellites (proxmox/clt/pa85 — nftables propres, hors CrowdSec)
  // IMPORTANT: srv-ngix F2B total_banned exclu — tous transitent via crowdsec-sync → déjà dans csD
  var s=0,f=[];
  var f2b=d.fail2ban||{};
  var pvf2b=f2b.proxmox||{},cltf2b=f2b.clt||{},pa85f2b=f2b.pa85||{};
  var _kcNeutralized=csD
    +(pvf2b.available?pvf2b.total_banned||0:0)
    +(cltf2b.available?cltf2b.total_banned||0:0)
    +(pa85f2b.available?pa85f2b.total_banned||0:0);
  var _kcKrTotal=kcActive+_kcNeutralized;
  var _kcKillRate=_kcKrTotal>0?Math.round(_kcNeutralized/_kcKrTotal*100):100;
  if(kcActive>0){
    if(_kcKillRate<20){s+=10;f.push({t:'Kill Rate critique ('+_kcKillRate+'%) — neutralisation insuffisante',c:'r'});}
    else if(_kcKillRate<40){s+=6;f.push({t:'Kill Rate faible ('+_kcKillRate+'%)',c:'r'});}
    else if(_kcKillRate<60){s+=3;f.push({t:'Kill Rate moyen ('+_kcKillRate+'%)',c:'y'});}
    // ≥60% : neutralisation correcte → pas de pénalité
  }
  return {s:s,f:f};
}
function _tsF2bSatellites(d){
  // F2B bans actifs — satellites uniquement (clt/pa85/proxmox) — max 10pts
  // srv-ngix F2B exclu : tous les bans transitent via crowdsec-sync → déjà comptés dans csD
  var s=0,f=[];
  var f2b=d.fail2ban||{};
  var pvf2b=f2b.proxmox||{},cltf2b=f2b.clt||{},pa85f2b=f2b.pa85||{};
  var totalBansAll=(pvf2b.available?_f2bNonBotBanned(pvf2b.jails||[]):0)
    +(cltf2b.available?_f2bNonBotBanned(cltf2b.jails||[]):0)
    +(pa85f2b.available?_f2bNonBotBanned(pa85f2b.jails||[]):0);
  if(totalBansAll>200){s+=10;f.push({t:'F2B satellites: '+totalBansAll+' bans (3 hôtes)',c:'r'});}
  else if(totalBansAll>80){s+=5;f.push({t:'F2B satellites: '+totalBansAll+' bans actifs',c:'y'});}
  else if(totalBansAll>20){s+=2;}
  // F2B satellites DOWN — gap couverture (+4pts chacun)
  if(pvf2b.available===false){s+=4;f.push({t:'⚠ F2B Proxmox DOWN',c:'r'});}
  if(cltf2b.available===false){s+=4;f.push({t:'⚠ F2B CLT DOWN',c:'r'});}
  if(pa85f2b.available===false){s+=4;f.push({t:'⚠ F2B PA85 DOWN',c:'r'});}
  return {s:s,f:f};
}
function _tsWebBots(d){
  // Web bots — srv-ngix (nginx-botsearch) + clt + pa85 (apache) (max 8pts)
  // nginx-botsearch : tot_failed uniquement — cur_banned désormais dans csD via crowdsec-sync
  var s=0,f=[];
  var f2b=d.fail2ban||{};
  var cltf2b=f2b.clt||{},pa85f2b=f2b.pa85||{};
  var webBotScore=[(cltf2b.jails||[]),(pa85f2b.jails||[])].reduce(function(a,jls){
    return a+jls.filter(function(j){return ['apache-badbots','apache-noscript','apache-overflows'].indexOf(j.jail)>=0;})
      .reduce(function(x,j){return x+(j.cur_banned||0)+(j.tot_failed||0);},0);
  },0);
  webBotScore+=(f2b.jails||[]).filter(function(j){return ['nginx-botsearch','nginx-badbots'].indexOf(j.jail)>=0;})
    .reduce(function(x,j){return x+(j.tot_failed||0);},0); // cur_banned exclu — déjà dans csD
  if(webBotScore>50){s+=8;f.push({t:'Web bots (nginx+apache): '+webBotScore,c:'r'});}
  else if(webBotScore>10){s+=4;f.push({t:'Web bots détectés',c:'y'});}
  return {s:s,f:f};
}
function _tsAppSec(d){
  // CrowdSec AppSec WAF (max 8pts) — vpatches CVE déclenchés
  var s=0,f=[];
  var cs=d.crowdsec||{};
  var appsecBlk=(cs.appsec&&cs.appsec.blocked)||0;
  if(appsecBlk>50){s+=8;f.push({t:'AppSec WAF: '+appsecBlk+' bloqués',c:'r'});}
  else if(appsecBlk>10){s+=4;f.push({t:'AppSec WAF: '+appsecBlk+' bloqués',c:'y'});}
  else if(appsecBlk>0){s+=2;}
  // AppSec module DOWN — CrowdSec actif mais AppSec absent : 150 vpatches CVE inactifs
  if(cs.available===true&&(!cs.appsec||cs.appsec.available===false)){s+=5;f.push({t:'⚠ AppSec WAF DOWN — vpatches CVE inactifs',c:'r'});}
  return {s:s,f:f};
}
function _tsSuricata(d,exploitUnblocked){
  // Suricata IDS — alertes réseau (max 20pts) — couche L3/L4 indépendante de CrowdSec
  // Anti-doublon : sév.1 réduit si EXPLOIT déjà compté dans Kill Chain (mêmes IPs probables)
  var s=0,f=[];
  var sur=d.suricata||{};
  var cs=d.crowdsec||{};
  var surSev1=0,surCovered=false;
  if(sur.available){
    surSev1=sur.sev1_critical||0;
    var surSev2=sur.sev2_high||0;
    var surScore=0;
    // Depuis 2026-04-07 : suricata-sev1-critical auto-banne via CrowdSec → score réduit si couvert
    var csSev1Cover=cs.available&&surSev1>0; // CrowdSec actif + scénario sev1 en place
    if(surSev1>=3){
      if(csSev1Cover&&exploitUnblocked===0){
        surScore+=8;f.push({t:'Suricata: '+surSev1+' CRITIQUES (auto-ban CS actif)',c:'y'});
      } else {
        surScore+=15;f.push({t:'Suricata: '+surSev1+' alertes CRITIQUES',c:'r'});
      }
    } else if(surSev1>=1){
      if(exploitUnblocked===0){
        if(csSev1Cover){
          // Auto-ban CrowdSec suricata-sev1-critical couvre → menace maîtrisée
          surScore+=3;f.push({t:'Suricata: '+surSev1+' sév.1 — couvert CS auto-ban',c:'g'});
        } else {
          surScore+=12;f.push({t:'Suricata: '+surSev1+' sév.1 — vecteur réseau',c:'r'});
        }
      } else {
        // Kill Chain EXPLOIT déjà compté → confirmation, évite doublon plein
        surScore+=5;f.push({t:'Suricata: '+surSev1+' sév.1 (confirmé EXPLOIT)',c:'r'});
      }
    }
    // Sév.2 HIGH — recalibré : suricata-sev2-high scenario actif (5 hits ban 48h) 2026-04-07
    if(surSev2>8000){surScore+=10;f.push({t:'Suricata: '+surSev2+' HIGH — surge C2',c:'y'});}
    else if(surSev2>4000){surScore+=7;f.push({t:'Suricata: '+surSev2+' alertes HIGH',c:'y'});}
    else if(surSev2>1200){surScore+=4;f.push({t:'Suricata: trafic suspect ('+surSev2+')',c:'y'});}
    else if(surSev2>400){surScore+=2;}
    // Sév.3 MEDIUM — volume élevé = signal faible
    var surSev3=sur.sev3_medium||0;
    if(surSev3>500){surScore+=3;f.push({t:'Suricata: '+surSev3+' alertes MEDIUM',c:'y'});}
    else if(surSev3>100){surScore+=1;}
    s+=Math.min(surScore,20); // cap Suricata à 20pts
    surCovered=cs.available&&surSev1>0&&exploitUnblocked===0;
  } else if(sur.available===false){s+=10;f.push({t:'⚠ Suricata DOWN',c:'r'});}
  return {s:s,f:f,surSev1:surSev1,surCovered:surCovered};
}
function _tsRouter(){
  // Routeur GT-BE98 (max 12pts) — WAN flood + conntrack anormal + FW drops
  // Baseline WAN : 130–5000 Kbps | conntrack normal : <300 flux | fw_drops : 0 attendu
  var s=0,f=[];
  var _rt=window._routerData||null,_fl=window._routerFlows||null;
  if(_rt&&_rt.available){
    var rtScore=0;
    var wanRx=(_rt.wan&&_rt.wan.rx_kbps)||0;
    if(wanRx>80000){rtScore+=8;f.push({t:'WAN flood: '+Math.round(wanRx/1000)+'Mbps',c:'r'});}
    else if(wanRx>40000){rtScore+=5;f.push({t:'WAN élevé: '+Math.round(wanRx/1000)+'Mbps',c:'y'});}
    else if(wanRx>20000){rtScore+=2;}
    var ctTotal=(_fl&&_fl.total)||0;
    if(ctTotal>5000){rtScore+=6;f.push({t:'Conntrack: '+ctTotal+' flux',c:'r'});}
    else if(ctTotal>2000){rtScore+=4;f.push({t:'Conntrack élevé: '+ctTotal,c:'y'});}
    else if(ctTotal>1000){rtScore+=2;}
    var _sec=_rt.security||{};
    var fwDrop=(_sec.fw_forward_drop||0)+(_sec.fw_input_drop||0);
    if(fwDrop>1000){rtScore+=4;f.push({t:'FW routeur: '+fwDrop+' drops',c:'r'});}
    else if(fwDrop>100){rtScore+=2;f.push({t:'FW routeur actif ('+fwDrop+')',c:'y'});}
    else if(fwDrop>0){rtScore+=1;}
    s+=Math.min(rtScore,12);
  }
  return {s:s,f:f};
}
function _tsConfinement(d){
  // Mises à jour sécu + AppArmor + TLS + ModSec (CLT + nginx + PA85)
  var s=0,f=[];
  var _upd=d.updates||{},_updSec=_upd.total_security||0;
  if(_updSec>5){s+=8;f.push({t:'⚠ '+_updSec+' màj sécu. en attente (infra)',c:'r'});}
  else if(_updSec>0){s+=4;f.push({t:'⚠ '+_updSec+' màj sécu. en attente',c:'y'});}
  var _aa=d.clt_apparmor||{};
  if(_aa.available===true&&_aa.enforce===false){s+=6;f.push({t:'⚠ AppArmor CLT hors enforce — Apache non confiné',c:'r'});}
  else if(_aa.available===false){s+=2;f.push({t:'⚠ AppArmor CLT inaccessible',c:'y'});}
  var _aan=d.apparmor_nginx||{};
  if(_aan.available===true&&_aan.enforce===false){s+=6;f.push({t:'⚠ AppArmor nginx hors enforce — workers non confinés',c:'r'});}
  else if(_aan.available===false){s+=2;f.push({t:'⚠ AppArmor nginx inaccessible',c:'y'});}
  var _tls=d.tls||{};
  var _tlsMin=null;
  Object.keys(_tls).forEach(function(k){var e=_tls[k];if(e&&e.days_left!=null&&(_tlsMin===null||e.days_left<_tlsMin))_tlsMin=e.days_left;});
  if(_tlsMin!==null){
    if(_tlsMin<7){s+=10;f.push({t:'🔴 TLS expire dans '+_tlsMin+'j — URGENT certbot',c:'r'});}
    else if(_tlsMin<30){s+=5;f.push({t:'⚠ TLS expire dans '+_tlsMin+'j — renouvellement requis',c:'y'});}
  }
  var _ms=d.clt_modsec||{};
  if(_ms.available===true&&_ms.engine_on===false){s+=6;f.push({t:'⚠ ModSec CLT désactivé — WAF Apache inactif',c:'r'});}
  else if(_ms.available===false){s+=2;f.push({t:'⚠ ModSec CLT inaccessible',c:'y'});}
  var _aap=d.pa85_apparmor||{};
  if(_aap.available===true&&_aap.enforce===false){s+=6;f.push({t:'⚠ AppArmor PA85 hors enforce — Apache non confiné',c:'r'});}
  else if(_aap.available===false){s+=2;f.push({t:'⚠ AppArmor PA85 inaccessible',c:'y'});}
  var _msp=d.pa85_modsec||{};
  if(_msp.available===true&&_msp.engine_on===false){s+=6;f.push({t:'⚠ ModSec PA85 désactivé — WAF Apache inactif',c:'r'});}
  else if(_msp.available===false){s+=2;f.push({t:'⚠ ModSec PA85 inaccessible',c:'y'});}
  return {s:s,f:f};
}
function _tsSignatures(d){
  // Auto-update freshness (max 4pts) + Suricata truncated packets (max 10pts)
  var s=0,f=[];
  var sur=d.suricata||{};
  var _au=d.autoupdate||{};
  if(_au.crowdsec_hub&&_au.crowdsec_hub.stale===true){s+=2;f.push({t:'⚠ CrowdSec hub: màj >8j',c:'y'});}
  if(_au.suricata_rules&&_au.suricata_rules.stale===true){s+=2;f.push({t:'⚠ Suricata rules: màj >2j',c:'y'});}
  var _trunc=sur.truncated_24h||0;
  if(_trunc>15000){s+=10;f.push({t:'Suricata: '+fmt(_trunc)+' paquets tronqués/j — ring saturé',c:'r'});}
  else if(_trunc>5000){s+=5;f.push({t:'Suricata: '+fmt(_trunc)+' tronqués (ring buffer)',c:'y'});}
  return {s:s,f:f};
}
function _tsServicesDown(d){
  // Services sécurité DOWN — protection gap (max 20+15pts)
  var s=0,f=[];
  var cs=d.crowdsec||{};
  var f2b=d.fail2ban||{};
  if(cs.available===false){s+=20;f.push({t:'⚠ CrowdSec DOWN',c:'r'});}
  if(f2b.total_banned===undefined||f2b.total_banned===null){s+=15;f.push({t:'⚠ Fail2ban DOWN',c:'r'});}
  return {s:s,f:f};
}
function _tsPersistence(d){
  // Récidivistes + AIDE + rsyslog cross-host
  var s=0,f=[];
  var _abl=d.autoban_log||[];
  var _recid=_abl.filter(function(e){return e.rule&&e.rule.indexOf('RECIDIVISTE')>=0;}).length;
  if(_recid>=2){s+=10;f.push({t:'Récidivistes: '+_recid+' IP persistantes',c:'r'});}
  else if(_recid>=1){s+=5;f.push({t:'Récidiviste: 1 IP persistante',c:'y'});}
  var _aide=d.aide||{};
  if(_aide.status==='ALERT'){
    var _aideChg=(_aide.changed||0)+(_aide.added||0)+(_aide.removed||0);
    s+=15;f.push({t:'⚠ AIDE ALERTE: '+_aideChg+' fichier(s) modifié(s)',c:'r'});
  } else if(_aide.available===false){s+=3;f.push({t:'⚠ AIDE inaccessible',c:'y'});}
  var _xh=d.xhosts||{};
  var _xhKcIps=_xh.kill_chain_ips||{};
  var _c2Ips=Object.keys(_xhKcIps).filter(function(ip){return (_xhKcIps[ip].router_out||0)>0;});
  if(_c2Ips.length>=3){s+=15;f.push({t:'C2 SORTANT: '+_c2Ips.length+' IPs — exfiltration possible',c:'r'});}
  else if(_c2Ips.length>=1){s+=10;f.push({t:'C2 sortant: '+_c2Ips.length+' IP(s) suspecte(s) routeur',c:'r'});}
  var _vmBansClt=((_xh.f2b_bans||{}).clt||[]).length;
  var _vmBansPa85=((_xh.f2b_bans||{}).pa85||[]).length;
  var _vmBansTotal=_vmBansClt+_vmBansPa85;
  if(_vmBansTotal>20){s+=5;f.push({t:'F2B VMs: '+_vmBansTotal+' bans clt+pa85',c:'y'});}
  else if(_vmBansTotal>5){s+=2;}
  var _rsl=d.rsyslog||{};
  if(_rsl.available===false){s+=5;f.push({t:'⚠ rsyslog centralisé DOWN — visibilité cross-host réduite',c:'y'});}
  return {s:s,f:f};
}

// ── computeThreatScore — score global menace (déplacé depuis 05-canvas-leaflet) ──
function computeThreatScore(d){
  var score=0,factors=[];
  function _add(r){score=Math.min(score+r.s,100);r.f.forEach(function(x){factors.push(x);});}
  _add(_tsTraffic(d));
  _add(_tsSshUfw(d));
  var kcR=_tsKillChain(d);
  _add(kcR);
  var csR=_tsCrowdSec(d,kcR.exploitUnblocked,kcR.exploitCount);
  _add(csR);
  _add(_tsKillRate(d,kcR.kcActive,csR.csD));
  _add(_tsF2bSatellites(d));
  _add(_tsWebBots(d));
  _add(_tsAppSec(d));
  var surR=_tsSuricata(d,kcR.exploitUnblocked);
  _add(surR);
  _add(_tsRouter());
  _add(_tsConfinement(d));
  _add(_tsSignatures(d));
  _add(_tsServicesDown(d));
  _add(_tsPersistence(d));
  score=Math.min(score,100);
  // Niveau — escalade Suricata sév.1 uniquement si NON couverte par CS auto-ban
  // Si CrowdSec actif + EXPLOIT neutralisé → sév.1 gérées, pas d'escalade CRITIQUE injustifiée
  var level,col;
  if(score>=70||(surR.surSev1>=5&&score>=50&&!surR.surCovered)){level='CRITIQUE';col='#ff3b5c';}
  else if(score>=50){level='ÉLEVÉ';col='#ff6b35';}
  else if(score>=30){level='MOYEN';col='#ffd700';}
  else{level='FAIBLE';col='#00ff88';}
  return{score:score,level:level,color:col,factors:factors,exploitUnblocked:kcR.exploitUnblocked};
}

