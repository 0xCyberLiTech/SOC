'use strict';
// ── CONFIG INFRA — source unique pour toutes les IPs du homelab ──
var SOC_INFRA={
  SRV_NGIX:  '<SRV-NGIX-IP>',
  PROXMOX:   '<PROXMOX-IP>',
  CLT:       '<CLT-IP>',
  PA85:      '<PA85-IP>',
  SRV_DEV1:  '<SRV-DEV1-IP>',
  FREEBOX:   '<BOX-IP>',
  // ROUTER retiré 2026-05-17
  LAN_CIDR:  '<LAN-CIDR>',
  SSH_PORT:  '<SSH-PORT>',
  SSH_KEY:   'id_nginx'
};

// ── PALETTE KILL CHAIN — source unique (hex + rgb) pour 02/03/05/06 ─────────
var KC_PALETTE={
  PROBE:   {color:'#8aa6c8', rgb:'138,166,200'},  // gris-bleu — paquets bruts UFW (avant nginx)
  RECON:   {color:'#bf5fff', rgb:'191,95,255'},
  SCAN:    {color:'#ff6b35', rgb:'255,107,53'},
  EXPLOIT: {color:'#ffd700', rgb:'255,215,0'},
  WAF:     {color:'#00bcd4', rgb:'0,188,212'},    // teal — ModSec inline block
  BRUTE:   {color:'#ff3b5c', rgb:'255,59,92'},
  BLOCKED: {color:'#00ff88', rgb:'0,255,136'}
};
var _COL_CYAN_RGB='0,217,255'; // NDT — source unique cyan canvas (02/03/04/06)
var _COL_CYAN_HEX='#00d9ff';  // NDT — source unique cyan hex (05-leaflet)
// NDT P3 — couleurs sémantiques canvas (alias KC_PALETTE — contextes hors stage)
var _COL_RED_HEX    =KC_PALETTE.BRUTE.color;    // '#ff3b5c' — menace/erreur
var _COL_ORANGE_HEX =KC_PALETTE.SCAN.color;     // '#ff6b35' — avertissement
var _COL_YELLOW_HEX =KC_PALETTE.EXPLOIT.color;  // '#ffd700' — surveillance
var _COL_GREEN_HEX  =KC_PALETTE.BLOCKED.color;  // '#00ff88' — ok/autorisé
var _COL_PURPLE_HEX =KC_PALETTE.RECON.color;    // '#bf5fff' — infra/admin
// NDT P4 — palette secondaire (rsyslog / événements / routeur)
var _COL_TEAL_HEX     ='#00bcd4'; // teal rsyslog/LOGS CENTRAUX/SRV-NGIX — distinct de cyan KC
var _COL_MATGREEN_HEX ='#00e676'; // vert ok/success/unban — distinct de _COL_GREEN_HEX KC
var _COL_MATORANGE_HEX='#ff9800'; // orange moyen/scan — distinct de _COL_ORANGE_HEX KC
var _COL_AMBER_HEX    ='#ffb300'; // ambre stale/avertissement doux
// NDT P5 — palette routeur (12-router.js retiré 2026-05-17, _RX/_TX réutilisés ailleurs)
var _COL_RTR_RX_HEX   ='#00d964'; // vert ok/SAIN (réutilisé 05-canvas-leaflet)
var _COL_RTR_TX_HEX   ='#ff9500'; // orange actions (réutilisé 07-render, 18-jarvis-ui)
// _COL_RTR_LAN_HEX / _COL_RTR_RAM_HEX / _COL_RTR_WIFI5_HEX retirés 2026-05-17 (orphans)
// NDT P6 — statut global + Suricata IDS
var _COL_COMPROMIS_HEX='#ff0040'; // statut COMPROMIS (intrusion active confirmée)
var _COL_SUR_IDS_HEX  ='#ff6030'; // Suricata IDS indicator — KC modal (02-canvas-kc)
// NDT P6 — palette protocoles (05-canvas-leaflet PROTO_DEF)
var PROTO_PALETTE={
  WATCH    :'#f59e0b', // HTTP / SUR_HTTP / en-tête groupe watch
  NEUTRAL  :'#94a3b8', // REDIRECT (neutre)
  RECON    :'#8b5cf6', // NOT_FOUND / SUR_SSH (exploration paths)
  ERR      :'#dc2626', // ERROR_5XX / SUR_C2 (erreur critique / C2)
  BOT_LEGIT:'#22d3ee', // LEGIT_BOT (robot identifié)
  GEO      :'#f97316', // GEO_BLOCK (géobloqué)
  THREAT   :'#ef4444', // CLOSED / en-tête groupe threat
  RATE     :'#ff6b6b', // RATE_LIMIT (429)
  BOT      :'#3b82f6', // BOT inconnu/suspect
  FLOW     :'#64748b'  // SUR_FLOW (flux réseau total)
};
// NDT P7 — couleurs récurrentes cross-fichiers
var _COL_C2_HEX           ='#ff2060'; // C2 OUTBOUND / WAN instabilité critique (07-render ×5)
var _COL_JARVIS_HEX       ='#ce93d8'; // JARVIS IA indicator / fw_drop (07-render ×4)
var _COL_CPU_CRIT_HEX     ='#ff4d4d'; // CPU seuil critique sparkline (07-render ×2)
var _COL_SUR_WARN_HEX     ='#ff9900'; // Suricata worker drop/rate/sat warn (09-modal ×4)
var _COL_APACHE_HEX       ='#80deea'; // APACHE VMs XDR source (19-xdr ×3)
var _COL_MITRE_RECON2_HEX ='#a855f7'; // MITRE T1595.002 Vuln Scanning (≠ _COL_PURPLE_HEX KC)
var _COL_MITRE_EXEC_HEX   ='#ff4500'; // MITRE T1059 Exec / Suricata bar (07-render ×2)
var _COL_MITRE_C2_HEX     ='#20b2aa'; // MITRE T1071 C2 trafic suspect
var _COL_SHIELD_HEX       ='#c0392b'; // Bouclier actif secBar (07-render)
var _COL_HEALTH_HEX       ='#ff9f1c'; // Santé système secBar (07-render)
var _COL_FLOW_KC_HEX      ='#ff5722'; // Flux Kill Chain SVG animation (07-render ×2)
// _COL_DHCP_HEX retiré 2026-05-17 (events dhcp_lease/wan_* retirés)
var _COL_CS_HEX           ='#22c55e'; // CrowdSec status indicator (10-modals-win)
var _COL_VM_OFF_HEX       ='#4b5563'; // VM stopped/offline (13-fw-fetch ×2)
var _COL_ATK_TEXT_HEX     ='#ff7090'; // Attaquant IP text canvas fw (13-fw-fetch)
var _COL_VERDICT_HIGH_HEX ='#ff6b2b'; // IP verdict ÉLEVÉ (22-ip-deep ×2)
var _COL_VERDICT_MED_HEX  ='#ffc800'; // IP verdict MODÉRÉ (22-ip-deep)
var _COL_RSYSLOG_ACT_HEX  ='#a78bfa'; // rsyslog activity indicator (22-ip-deep)
// NDT P7 — palette sources XDR (19-xdr.js _FAM_C + _ss)
var XDR_PALETTE={
  fail2ban  :'#ff9900', ufw       :'#44aaff',
  apparmor  :'#cc77ff', modsec    :'#ff7777',
  autoban   :_COL_GREEN_HEX,      // '#00ff88' KC — auto-ban
  suricata  :'#ffff44', nginx_drop:'#ff00aa',
  aid       :'#00ccff',
  // router retiré 2026-05-17
  vmf2b     :'#ffbb00', apache    :_COL_APACHE_HEX // '#80deea'
};
// NDT P8
var _COL_TCP_HEX     = XDR_PALETTE.ufw;   // TCP protocol mini-bar (09-modals-core) — même bleu que ufw
var _COL_WHITE_HEX   = '#ffffff';          // canvas white text (13-fw-fetch)
// _COL_OFFLINE_HEX retiré 2026-05-17 (12-router supprimé)
var _COL_CANVAS_BG1_HEX= '#030812'; // canvas/SVG dark bg gradient start (06-geomap + 13-fw-fetch)
var _COL_CANVAS_BG2_HEX= '#060d1a'; // canvas dark bg gradient mid/end
var _COL_CANVAS_BG3_HEX= '#04080f'; // canvas dark bg gradient end (06-geomap)
// _COL_RTR_BG1_HEX / _COL_RTR_BG2_HEX retirés 2026-05-17 — gradients SVG router supprimés
// NDT P11
var _COL_BAN_BTN_HEX    = '#ff6090'; // ban button / IP menace non traitée (07-render ×4)
var _COL_C2_BADGE_HEX   = '#dc2626'; // badge ☠ C2/TROJAN (09-modals-core ×2)
var _COL_F2B_PRE_HEX    = '#f59e0b'; // fail2ban pré-ban / cur_failed (09-modals-core ×2)
var _COL_WIN_SUR_HEX    = '#f97316'; // Suricata alertes Windows modal (10-modals-win ×2)
var _COL_DC_NA_HEX      = '#4a5568'; // defense chain nœud non disponible (16b-defense-chain)
var _COL_DC_NA_TXT_HEX  = '#64748b'; // defense chain badge NA texte (16b-defense-chain)
var _COL_AIDE_ALERT_HEX = '#ff4444'; // AIDE alerte critique (20-aide ×3)
var _COL_AIDE_WARN_HEX  = '#ffa000'; // AIDE avertissement (20-aide ×2)
var _COL_XDR_CLR_HEX    = '#ff5555'; // bouton XDR clear survol (19-xdr)
var _CVE_RE=/CVE-\d{4}-\d+/i; // source unique — 02-canvas-kc (×2)

// ── CONFIG JARVIS — source unique pour l'URL JARVIS (DT-A) ──────────────────
// IPv4 forcé — Chrome résout localhost en ::1 (IPv6) mais JARVIS écoute sur 127.0.0.1 uniquement
var JV_URL = 'http://127.0.0.1:5000';

// ── INTERVALLES DE POLLING — DT-E ────────────────────────────────────────────
var _POLL_MONITOR_MS   = 60000; // rafraîchissement monitoring.json  (17-fetch)
// _POLL_ROUTER_MS retiré 2026-05-17
var _POLL_FRESHNESS_MS = 30000; // vérification fraîcheur données    (16-soc-enhancements)
var _POLL_HEARTBEAT_MS  = 15000; // heartbeat JARVIS                   (17-fetch)
var _LAN_RE             = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/; // RFC1918 + loopback
var _XHR_TIMEOUT_MON_MS = 15000; // timeout XHR monitoring.json       (17-fetch)
var _POLL_PROTO_MS      = 15000; // polling proto live                 (17-fetch)
var _CLOCK_TICK_MS      =  1000; // tick horloge SOC                   (16-soc-enhancements)
var _PING_TMO_MS        =  5000; // timeout fetch JARVIS API (ping)    (17/18-jarvis-*)
var _CS_TIMEOUT_MS      =  8000; // timeout fetch CrowdSec LAPI        (02-canvas-kc)
var _ESCALATION_FADE_MS = 12000; // durée fondu escalade Kill Chain    (02-canvas-kc)

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
// window._routerData / _routerHistory / _routerFlows retirés 2026-05-17 ()
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
// NDT-134 — total bans F2B srv-nginx + proxmox (pattern dupliqué 02-canvas-kc + 07-render)
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
var _MS_PER_DAY=86400000; // NDT-231 — constante partagée 07-render + 01-utils
var _THR_CPU_CRIT=85,_THR_CPU_WARN=60;  // NDT-246 — seuils CPU serveur (déplacés depuis 07-render)
var _THR_GPU_CRIT=80;                    // NDT-247 — seuil critique GPU/Windows (crit intentionnellement 80)
var _THR_TEMP_CRIT=85,_THR_TEMP_WARN=70;// NDT-248 — seuils température CPU
var _THR_ACPI_CRIT=70,_THR_ACPI_WARN=55;// NDT-248 — seuils température ACPI
// NDT-163 — unifie _winBkpAge (07-render) + _bkAge (10-modals-win) — jours depuis date backup
function _winBkpAge(s){if(!s)return 999;return Math.floor((Date.now()-new Date(s.replace(' ','T')).getTime())/_MS_PER_DAY);}
// NDT-164 — unifie _winBkpCol (07-render) + _bkColor (10-modals-win) — couleur selon âge backup
function _winBkpCol(a){return a>14?'var(--red)':a>6?'var(--yellow)':'var(--green)';}
// NDT-149 — formatage date ISO locale (était dupliqué 07-render:78 + 07-render:1156 + 14-modal-firewall:15)
function _fmtDateTs(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');}
function errC(r){return r>5?'crit':r>1?'warn':'ok'}

// ── computeThreatScore — lecteur pur ─────────────────────────────────────────
// Score, niveau et factors calculés par monitoring_gen.py (srv-nginx) et stockés
// dans monitoring.json. Aucun recalcul côté JS — source de vérité unique.
function computeThreatScore(d){
  var score=d.threat_score||0;
  var level=d.threat_level||'FAIBLE';
  var factors=d.threat_factors||[];
  var exploitUnblocked=d.threat_exploit_unblocked||0;
  var _cmap={CRITIQUE:_COL_RED_HEX,'ÉLEVÉ':_COL_ORANGE_HEX,MOYEN:_COL_YELLOW_HEX,FAIBLE:_COL_GREEN_HEX};
  return{score:score,level:level,color:_cmap[level]||_COL_GREEN_HEX,factors:factors,exploitUnblocked:exploitUnblocked};
}

