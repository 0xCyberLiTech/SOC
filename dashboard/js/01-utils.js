// ── CONFIG INFRA — source unique pour toutes les IPs du homelab ──
// Remplacer les valeurs ci-dessous par les adresses IP réelles de votre infrastructure.
var SOC_INFRA={
  SRV_NGIX: '192.168.x.x',   // IP du serveur nginx / dashboard SOC
  PROXMOX:  '192.168.x.x',   // IP de l'hyperviseur Proxmox
  SITE01:      '192.168.x.x',   // IP de la VM site-01 (Apache)
  SITE02:     '192.168.x.x',   // IP de la VM site-02 (Apache)
  FREEBOX:  '192.168.x.x',   // IP de la box Internet (LAN gateway)
  ROUTER:   '192.168.x.x',   // IP du routeur secondaire (optionnel)
  LAN_CIDR: '192.168.x.0/24',// Subnet LAN
  SSH_PORT: '22',             // Port SSH (adapter à votre config)
  SSH_KEY:  'id_rsa'          // Nom de la clé SSH privée dans ~/.ssh/
};

// ── CONFIG JARVIS — source unique pour l'URL JARVIS (DT-A) ──────────────────
// IPv4 forcé — Chrome résout localhost en ::1 (IPv6) mais JARVIS écoute sur 127.0.0.1 uniquement
var JV_URL = 'http://127.0.0.1:5000';

// ── INTERVALLES DE POLLING — DT-E ────────────────────────────────────────────
var _POLL_MONITOR_MS   = 60000; // rafraîchissement monitoring.json  (17-fetch)
var _POLL_ROUTER_MS    = 30000; // rafraîchissement router.json       (17-fetch)
var _POLL_FRESHNESS_MS = 30000; // vérification fraîcheur données    (16-soc-enhancements)
var _POLL_HEARTBEAT_MS = 15000; // heartbeat JARVIS                   (17-fetch)

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
// NDT-87/88/89 — DOM refs modal — partagées par 08/09/10/12/14/15/17
var _overlay=document.getElementById('overlay');
var _modalBody=document.getElementById('modal-body');
var _modalClose=document.getElementById('modal-close');
// NDT-92/93/94 — état GeoMap — partagé par 05/06/07/04/09
var _lfMapTip=null;
var _lfLastGeoips=[];
var _lfLastWanIp=null;
// NDT-99 — résultat computeThreatScore — partagé 07-render (w) / 05-leaflet (r)
var _lastThreatResult=null;

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
  winModalType:      null,
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
    'winCpuHistory','winGpuHistory','winVramHistory','winModalType',
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
if(typeof AbortSignal !== 'undefined' && !AbortSignal.timeout){
  AbortSignal.timeout = function(ms){
    var ctrl = new AbortController();
    setTimeout(function(){ ctrl.abort(new DOMException('TimeoutError','TimeoutError')); }, ms);
    return ctrl.signal;
  };
}

function esc(s){if(s==null)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function fmt(n){if(n===undefined||n===null)return'—';if(n>=1e9)return(n/1e9).toFixed(1)+'G';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return String(n)}
function fmtB(b){if(!b)return'0B';var u=['B','Ko','Mo','Go'];var i=0;while(b>=1024&&i<3){b/=1024;i++;}return b.toFixed(i?1:0)+u[i]}
function fmtMb(mb){if(!mb)return'0 Mo';if(mb>=1024)return(mb/1024).toFixed(1)+' Go';return mb+' Mo'}
function sslC(d){return d>30?'ssl-ok':d>7?'ssl-warn':'ssl-crit'}
function errC(r){return r>5?'crit':r>1?'warn':'ok'}

