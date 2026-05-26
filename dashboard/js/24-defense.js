'use strict';
// 24-defense.js — v1.0.0 — Page récap actions défensives 24h
// Source données : /defense_24h.json (généré par defense_aggregator.py côté srv-nginx)
// Contrat data : { version, generated_at, window_hours, kpi{}, heatmap_24h[24],
//                  top_country[], top_as[], top_scenario[], top_layer[], timeline[] }

// ── Constantes ────────────────────────────────────────────────────────────
var DATA_URL          = '/defense_24h.json';
var REFRESH_S         = 60;
var KPI_ROTATE_MS     = 5000;
var KPI_CARDS         = 4;
var FETCH_TMO_MS      = 6000;
// Heatmap SVG — vivante (cf. CSS pour animations bar-grow / breath / pulse / scan)
// v1.2 — granularité 15 min : 96 buckets sur 24h glissantes
var HEATMAP_BUCKETS    = 96;           // 4 tranches/h × 24h
var HEATMAP_BUCKET_MIN = 15;           // minutes par bucket (info sémantique)
var HEATMAP_SVG_W      = 480;          // viewBox élargi pour 96 barres (3.6 px / barre)
var HEATMAP_SVG_H      = 140;
var HEATMAP_PAD_X      = 16;
var HEATMAP_PAD_TOP    = 14;
var HEATMAP_PAD_BOTTOM = 26;
var HEATMAP_BAR_GAP    = 0.6;          // gap réduit (barres très fines)
var HEATMAP_BAR_RADIUS = 0.6;
var HEATMAP_HOT_THR    = 0.55;         // > 55% du max → animation "breath"
var HEATMAP_LABEL_THR  = 0.35;         // > 35% du max → étiquette valeur (densité 96 = moins de labels)
var HEATMAP_AXIS_TICKS = [0, 24, 48, 72, 95]; // 5 labels d'axe (h-24, h-18, h-12, h-6, maint.)
var COL_HEAT_LOW       = '#0c3540';
var COL_HEAT_MID       = '#00d9ff';
var COL_HEAT_HIGH      = '#ff3b5c';
var TL_ROW_HARD_LIMIT = 200;
// Console trafic temps réel (SSE)
var CN_FEED_URL        = '/traffic-stream';
var CN_WINDOW_MS       = 15 * 60 * 1000;  // fenêtre glissante temporelle 15 min (sliding window)
var CN_RING_HARD_MAX   = 2000;            // garde-fou DOM max si burst trafic >120 req/s · évite freeze browser
var CN_PURGE_INTERVAL_MS = 5000;          // intervalle purge auto lignes > 15 min (toutes les 5s)
var CN_RATE_WINDOW_MS  = 5000;         // fenêtre glissante pour le « req/s »
var CN_RECONNECT_MS    = 3000;         // délai reconnexion EventSource après erreur
var CN_AUTO_SCROLL_THR_PX = 60;        // si scroll-top > seuil → fige auto-scroll
// v1.1 — UX cohérent : drill-down + delta + pause + flash
var FLASH_DURATION_MS = 3000;     // animation surlignage des nouveaux events
var TOAST_DURATION_MS = 1800;     // toast copy IP / info action
var BTN_PAUSE_LABEL   = 'PAUSE';
var BTN_RESUME_LABEL  = 'REPRISE';
var DELTA_UP_SYMBOL   = '↑';
var DELTA_DOWN_SYMBOL = '↓';
var DELTA_FLAT_SYMBOL = '→';
var DELTA_NONE_LABEL  = 'pas de référence';
// IDs DOM (zéro hardcode dispersé)
var DOM = {
  status:    'def-status',
  countdown: 'def-countdown',
  pauseBtn:  'def-pause-btn',
  refresh:   'def-refresh-fill',
  toast:     'def-toast',
  kpiRow:    'def-kpi-row',
  heatSvg:    'def-heatmap-svg',
  heatTip:    'def-heatmap-tooltip',
  heatStats:  'def-heatmap-stats',
  heatLeg:   'def-heatmap-legend',
  topCty:    'def-top-country',
  topAs:     'def-top-as',
  topScn:    'def-top-scenario',
  layers:    'def-layers',
  tlFilters: 'def-tl-filters',
  tlSearch:  'def-tl-search',
  tlClear:   'def-tl-clear',
  tl:        'def-tl',
  tlCount:   'def-tl-count',
  footMeta:  'footer-meta',
  clock:     'soc-clock',
  // As-strip badges (résumé permanent)
  asActions: 'def-as-actions',
  asBans:    'def-as-bans',
  asWaf:     'def-as-waf',
  asGeo:     'def-as-geo',
  asPeak:    'def-as-peak',
  asGen:     'def-as-generated',
  // Modal détail event (réutilise structure .modal-overlay du SOC)
  modal:      'def-modal',
  modalTitle: 'def-modal-title',
  modalBody:  'def-modal-body',
  modalClose: 'def-modal-close',
  // Console trafic temps réel
  cn:        'def-cn',
  cnRate:    'def-cn-rate',
  cnCBlocked:'def-cn-c-blocked',
  cnCSuspect:'def-cn-c-suspect',
  cnCOk:     'def-cn-c-ok',
  cnPause:   'def-cn-pause',
  cnClear:   'def-cn-clear',
  cnFilter:  'def-cn-filter',
  cnState:   'def-cn-state',
  cnTgBlock: 'def-cn-tg-blocked',
  cnTgSusp:  'def-cn-tg-suspect',
  cnTgCur:   'def-cn-tg-curious',
  cnTgOk:    'def-cn-tg-ok',
  cnTgNoise: 'def-cn-tg-noise',
};

// Catalogue des KPI affichables (label, suffix, source de la valeur, couleur)
var KPI_DEFS = [
  { key:'total_actions',  lbl:'ACTIONS TOTALES',     suffix:'',          color:'#00d9ff' },
  { key:'bans_24h',       lbl:'BANS CROWDSEC 24h',   suffix:'',          color:'#ff8800' },
  { key:'cs_alerts_24h',  lbl:'ALERTES CS 24h',      suffix:'',          color:'#ffaa00' },
  { key:'geo_24h',        lbl:'GEO BLOCKS',          suffix:'req',       color:'#00ff88' },
  { key:'waf_clt_24h',    lbl:'WAF CLT',             suffix:'blocks',    color:'#b464ff' },
  { key:'waf_pa85_24h',   lbl:'WAF PA85',            suffix:'blocks',    color:'#b464ff' },
  { key:'appsec_24h',     lbl:'WAF APPSEC',          suffix:'blocks',    color:'#9d62ff' },
  { key:'ids_sev1',       lbl:'SURICATA CRIT',       suffix:'sev1',      color:'#ff3030' },
  { key:'ids_sev2',       lbl:'SURICATA HIGH',       suffix:'sev2',      color:'#ff6030' },
  { key:'fail2ban_active',lbl:'FAIL2BAN ACTIFS',     suffix:'IPs',       color:'#ff8800' },
  { key:'ufw_24h',        lbl:'UFW DROP 24h',        suffix:'paquets',   color:'#00ffd0' },
  { key:'cs_active',      lbl:'D&Eacute;CISIONS CS', suffix:'actives',   color:'#00d9ff' }
];

// Couleurs par couche pour la timeline
var LAYER_COLORS = {
  crowdsec:        '#ff8800',
  fail2ban:        '#ff6600',
  suricata:        '#ff3030',
  ufw:             '#00ffd0',
  geoblock:        '#00ff88',
  modsec_clt:      '#b464ff',
  modsec_pa85:     '#9d62ff',
  appsec:          '#7d54ff',
  appsec_modsec_clt:  '#7d54ff',
  appsec_modsec_pa85: '#7d54ff'
};

// ── État runtime ──────────────────────────────────────────────────────────
var _data        = null;
var _kpiIdx      = 0;
var _kpiTimer    = null;
var _cdTimer     = null;
var _cdLeft      = REFRESH_S;
var _filterLayer = 'all';
var _filterText  = '';
var _paused      = false;
var _seenEventIds = {};  // dict id → true · pour flag flash sur nouveautés

// ── Fetch + auto-refresh ──────────────────────────────────────────────────
function fetchData(){
  if(_paused) return;
  var ctrl = new AbortController();
  var to   = setTimeout(function(){ ctrl.abort(); }, FETCH_TMO_MS);
  fetch(DATA_URL + '?t=' + Date.now(), { signal: ctrl.signal })
    .then(function(r){ clearTimeout(to); return r.ok ? r.json() : null; })
    .then(function(d){
      if(!d){ setStatus('Erreur fetch', true); return; }
      _data = d;
      setStatus('OK · g&eacute;n&eacute;r&eacute; ' + (d.generated_at || '').slice(11,19) + ' UTC');
      renderAll();
    })
    .catch(function(){ clearTimeout(to); setStatus('Timeout / hors-ligne', true); });
}

function setStatus(msg, err){
  var el = document.getElementById(DOM.status);
  if(!el) return;
  el.innerHTML = msg;
  el.className = err ? 'def-st-err' : 'def-st-ok';
}

// ── Pause / Reprise ───────────────────────────────────────────────────────
function togglePause(){
  _paused = !_paused;
  var btn = document.getElementById(DOM.pauseBtn);
  if(btn){
    btn.textContent = _paused ? BTN_RESUME_LABEL : BTN_PAUSE_LABEL;
    btn.classList.toggle('paused', _paused);
  }
  var cdEl = document.getElementById(DOM.countdown);
  if(cdEl && _paused) cdEl.textContent = '[ PAUSE ]';
  if(!_paused){ _cdLeft = REFRESH_S; }   // reset countdown au reprendre
  showToast(_paused ? 'Auto-refresh en pause' : 'Auto-refresh repris');
}

// ── Toast (notification éphémère) ─────────────────────────────────────────
function showToast(msg){
  var t = document.getElementById(DOM.toast);
  if(!t){
    t = document.createElement('div');
    t.id = DOM.toast;
    t.className = 'def-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('def-toast--visible');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(function(){ t.classList.remove('def-toast--visible'); }, TOAST_DURATION_MS);
}

// ── Drill-down helpers (filtre texte = pivot universel) ───────────────────
function applyFilterText(value){
  _filterText = String(value || '').toLowerCase();
  var s = document.getElementById(DOM.tlSearch);
  if(s) s.value = value || '';
  renderTimelineRows();
  showToast('Filtre : ' + (value || '(vide)'));
}

function copyToClipboard(text){
  if(!text) return;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){ showToast('Copi&eacute; : ' + text); });
  } else {
    showToast(text);  // fallback : juste un toast lisible
  }
}

function startCountdown(){
  if(_cdTimer) clearInterval(_cdTimer);
  _cdLeft = REFRESH_S;
  var el = document.getElementById(DOM.countdown);
  _cdTimer = setInterval(function(){
    if(_paused) return;     // figé tant qu'en pause
    _cdLeft--;
    if(el) el.textContent = 'refresh ' + _cdLeft + 's';
    if(_cdLeft <= 0){ fetchData(); _cdLeft = REFRESH_S; }
  }, 1000);
}

// ── Render principal ──────────────────────────────────────────────────────
function renderAll(){
  if(!_data) return;
  renderAsStrip();
  renderKpiCards();
  renderHeatmap();
  renderTopLists();
  renderLayers();
  renderTimeline();
  renderFooter();
}

// ── As-strip — résumé permanent sous le header ─────────────────────────
function renderAsStrip(){
  if(!_data || !_data.kpi) return;
  var k = _data.kpi;
  var set = function(id, val){ var el = document.getElementById(id); if(el) el.textContent = val; };
  set(DOM.asActions, k.total_actions || 0);
  set(DOM.asBans,    k.bans_24h || 0);
  set(DOM.asWaf,     (k.waf_clt_24h || 0) + (k.waf_pa85_24h || 0));
  set(DOM.asGeo,     k.geo_24h || 0);
  // Pic 15min (label heure courante "maint." / "il y a Xmin" / "h-X")
  var heat = _data.heatmap_24h || [];
  var peak_h = -1, peak_v = 0;
  for(var i=0;i<heat.length;i++){ if(heat[i] > peak_v){ peak_h = i; peak_v = heat[i]; } }
  var peakLbl = peak_h >= 0 ? 'pic ' + _bucketAgoLabel(peak_h) + ' (' + peak_v + ')' : 'pic n/a';
  set(DOM.asPeak, peakLbl);
  set(DOM.asGen, (_data.generated_at || '').slice(11,19) + ' UTC');
}

// ── Couches défensives — résumé visuel par layer ──────────────────────
function renderLayers(){
  var el = document.getElementById(DOM.layers);
  if(!el || !_data.top_layer) return;
  var max = (_data.top_layer[0] && _data.top_layer[0].count) || 1;
  el.innerHTML = _data.top_layer.slice(0, 8).map(function(l){
    var col = LAYER_COLORS[l.value] || '#888';
    var pct = Math.round((l.count / max) * 100);
    return '<div class="def-layer-row" style="--lcol:'+col+';--lpct:'+pct+'%">'
         + '<span class="def-layer-name">' + esc(l.value) + '</span>'
         + '<span class="def-layer-bar"></span>'
         + '<span class="def-layer-cnt">' + l.count + '</span>'
         + '</div>';
  }).join('');
}

// ── KPI rotatifs ──────────────────────────────────────────────────────────
function renderKpiCards(){
  var row = document.getElementById(DOM.kpiRow);
  if(!row) return;
  row.innerHTML = '';
  for(var i=0;i<KPI_CARDS;i++){
    var c = document.createElement('div');
    c.className = 'def-kpi-card';
    c.innerHTML = '<div class="def-kpi-val" id="kpi-v-'+i+'">&mdash;</div>'
                + '<div class="def-kpi-delta" id="kpi-d-'+i+'">&middot;</div>'
                + '<div class="def-kpi-lbl" id="kpi-l-'+i+'">&middot;</div>'
                + '<div class="def-kpi-sub" id="kpi-s-'+i+'">&middot;</div>';
    row.appendChild(c);
  }
  // Rotation
  if(_kpiTimer) clearInterval(_kpiTimer);
  refreshKpiCards();
  _kpiTimer = setInterval(refreshKpiCards, KPI_ROTATE_MS);
}

function _formatDelta(deltaObj){
  /* {abs, pct} → 'flat → 0' · 'up ↑ +15%' · 'down ↓ -42%' · 'none —' */
  if(!deltaObj || deltaObj.pct === null || deltaObj.pct === undefined){
    return { html: DELTA_FLAT_SYMBOL + ' ' + DELTA_NONE_LABEL, cls: 'def-d-none' };
  }
  var p = deltaObj.pct;
  if(p > 0)  return { html: DELTA_UP_SYMBOL  +' +'+ p + '%', cls: 'def-d-up' };
  if(p < 0)  return { html: DELTA_DOWN_SYMBOL+' ' + p + '%', cls: 'def-d-down' };
  return { html: DELTA_FLAT_SYMBOL + ' 0%', cls: 'def-d-flat' };
}

function refreshKpiCards(){
  if(!_data || !_data.kpi) return;
  var deltas = _data.kpi_delta || {};
  for(var i=0;i<KPI_CARDS;i++){
    var def = KPI_DEFS[(_kpiIdx + i) % KPI_DEFS.length];
    var v   = _data.kpi[def.key];
    var vEl = document.getElementById('kpi-v-'+i);
    var dEl = document.getElementById('kpi-d-'+i);
    var lEl = document.getElementById('kpi-l-'+i);
    var sEl = document.getElementById('kpi-s-'+i);
    if(vEl){ vEl.textContent = (v == null ? '0' : v); vEl.style.color = def.color; }
    if(dEl){
      var dd = _formatDelta(deltas[def.key]);
      dEl.innerHTML = dd.html;
      dEl.className = 'def-kpi-delta ' + dd.cls;
    }
    if(lEl) lEl.innerHTML = def.lbl;
    if(sEl) sEl.textContent = def.suffix;
  }
  _kpiIdx = (_kpiIdx + KPI_CARDS) % KPI_DEFS.length;
}

// ── Heatmap horaire — SVG vivant (gradient + courbe + axe + stats + hover) ──
// Remplace l'ancien Canvas. Toutes les animations vivent dans defense.css :
//   def-bar-grow · def-bar-breath · def-bar-pulse-red · def-curve-draw · def-heat-scan
function renderHeatmap(targetSvgId, viewW, viewH){
  // Paramètres optionnels : permet de rendre la même heatmap dans la tuile (default)
  // OU dans un modal XL au clic (targetSvgId='def-heatmap-svg-xl', viewW=1600, viewH=480).
  var svgId = targetSvgId || DOM.heatSvg;
  var W     = viewW || HEATMAP_SVG_W;
  var H     = viewH || HEATMAP_SVG_H;
  var svg = document.getElementById(svgId);
  if(!svg || !_data || !_data.heatmap_24h) return;
  // Sync viewBox si dimensions custom (modal XL)
  if(viewW && viewH) svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  var data = _data.heatmap_24h;
  var max  = Math.max(1, Math.max.apply(null, data));
  // Échelle cbrt (cube root) — 2026-05-16 : encore plus de relief que sqrt
  // (Marc demande max visibilité historique). Pic 521 reste à 100%, valeur 5
  // monte à 23% (vs 11% sqrt), valeur 1 monte à 16% (vs 6% sqrt). Compromis
  // optimal : historique très lisible sans écraser le pic.
  var cbrtMax = Math.cbrt(max + 1);
  // Géométrie
  var innerW = W - HEATMAP_PAD_X * 2;
  var innerH = H - HEATMAP_PAD_TOP - HEATMAP_PAD_BOTTOM;
  var bw     = (innerW - (HEATMAP_BUCKETS - 1) * HEATMAP_BAR_GAP) / HEATMAP_BUCKETS;
  var bottom = HEATMAP_PAD_TOP + innerH;
  var nodes  = [];   // points pour la courbe : {cx, cy, v, i}
  var svgParts = [];
  // Gradient global (definition)
  svgParts.push(
    '<defs>'
    + '<linearGradient id="def-heat-grad" x1="0" y1="1" x2="0" y2="0">'
    +   '<stop offset="0%" stop-color="' + COL_HEAT_LOW + '"/>'
    +   '<stop offset="55%" stop-color="' + COL_HEAT_MID + '"/>'
    +   '<stop offset="100%" stop-color="' + COL_HEAT_HIGH + '"/>'
    + '</linearGradient>'
    + '<linearGradient id="def-heat-grad-current" x1="0" y1="1" x2="0" y2="0">'
    +   '<stop offset="0%" stop-color="#5a1020"/>'
    +   '<stop offset="60%" stop-color="' + COL_HEAT_HIGH + '"/>'
    +   '<stop offset="100%" stop-color="#ff7090"/>'
    + '</linearGradient>'
    + '</defs>'
  );
  // Lignes guides horizontales (25%, 50%, 75%)
  [0.25, 0.5, 0.75].forEach(function(r){
    var y = bottom - innerH * r;
    svgParts.push('<line class="def-heat-axis-tick" x1="' + HEATMAP_PAD_X + '" y1="' + y
                  + '" x2="' + (W - HEATMAP_PAD_X) + '" y2="' + y
                  + '" stroke-dasharray="2 4" />');
  });
  // Barres
  for(var i=0;i<HEATMAP_BUCKETS;i++){
    var v     = data[i] || 0;
    var ratio = v > 0 ? Math.cbrt(v + 1) / cbrtMax : 0;   // cube root — voir commentaire
    var x     = HEATMAP_PAD_X + i * (bw + HEATMAP_BAR_GAP);
    // min height généreux pour très petites valeurs (1-3 events) : 4px vs 0 si vide
    var bh    = v > 0 ? Math.max(4, ratio * innerH) : 0;
    var y     = bottom - bh;
    var isCurrent = (i === HEATMAP_BUCKETS - 1);
    var isHot     = (ratio >= HEATMAP_HOT_THR);
    var cls = 'def-heat-bar'
            + (isCurrent ? ' def-heat-bar--current' : (isHot ? ' def-heat-bar--hot' : ''));
    var fill = isCurrent ? 'url(#def-heat-grad-current)' : 'url(#def-heat-grad)';
    // Bar visible
    svgParts.push('<rect class="' + cls + '" x="' + x + '" y="' + y
                  + '" width="' + bw + '" height="' + bh
                  + '" rx="' + HEATMAP_BAR_RADIUS + '" ry="' + HEATMAP_BAR_RADIUS
                  + '" fill="' + fill + '"/>');
    // Hit-area (toute la hauteur) pour hover plus facile
    svgParts.push('<rect class="def-heat-bar-hit" x="' + x + '" y="' + HEATMAP_PAD_TOP
                  + '" width="' + bw + '" height="' + innerH
                  + '" data-i="' + i + '" data-v="' + v + '"/>');
    // Étiquette valeur si suffisamment haute
    if(ratio >= HEATMAP_LABEL_THR){
      var lblCls = isCurrent ? 'def-heat-label def-heat-label--current' : 'def-heat-label';
      svgParts.push('<text class="' + lblCls + '" x="' + (x + bw/2)
                    + '" y="' + (y - 3) + '">' + v + '</text>');
    }
    nodes.push({ cx: x + bw/2, cy: y, v: v, i: i });
  }
  // Courbe lissée Catmull-Rom → cubic Bezier (relie les sommets des barres NON-VIDES uniquement)
  // 2026-05-16 : exclure buckets vides (v=0 → cy=bottom) qui faisaient plonger la
  // courbe à 0 entre 2 buckets non-nuls = effet "courbe cassée" visuel.
  var curveNodes = nodes.filter(function(n){ return n.v > 0; });
  if(curveNodes.length >= 2){
    svgParts.push('<path class="def-heat-curve" d="' + _heatCurvePath(curveNodes) + '"/>');
  }
  // Labels axe (ticks propres en heures)
  HEATMAP_AXIS_TICKS.forEach(function(idx){
    if(idx < 0 || idx >= HEATMAP_BUCKETS) return;
    var x  = HEATMAP_PAD_X + idx * (bw + HEATMAP_BAR_GAP) + bw/2;
    var ty = H - 6;
    var minutesAgo = (HEATMAP_BUCKETS - 1 - idx) * HEATMAP_BUCKET_MIN;
    var hoursAgo = Math.round(minutesAgo / 60);
    var lbl = (idx === HEATMAP_BUCKETS - 1) ? 'maint.' : ('h-' + hoursAgo);
    svgParts.push('<text class="def-heat-axis" x="' + x + '" y="' + ty
                  + '" text-anchor="middle">' + lbl + '</text>');
  });
  svg.innerHTML = svgParts.join('');
  // Wire tooltip hover
  _wireHeatmapTooltip(svg, data);
  // Stats
  _renderHeatmapStats(data, max);
  // Légende (compacte sous les stats)
  var lg = document.getElementById(DOM.heatLeg);
  if(lg){
    lg.innerHTML =
      '<span class="def-leg-it"><span class="def-leg-sw" style="background:' + COL_HEAT_LOW + '"></span>0</span>' +
      '<span class="def-leg-it"><span class="def-leg-sw" style="background:' + COL_HEAT_MID + '"></span>seuil chaud</span>' +
      '<span class="def-leg-it"><span class="def-leg-sw" style="background:' + COL_HEAT_HIGH + '"></span>' + max + ' max · h-1</span>';
  }
}

// Modal XL heatmap — clic sur la tuile ouvre une vue agrandie 80% (2026-05-16)
function openHeatmapModal(){
  var ov = document.getElementById(DOM.modal);
  var ti = document.getElementById(DOM.modalTitle);
  var bd = document.getElementById(DOM.modalBody);
  if(!ov || !ti || !bd) return;
  ti.textContent = '// HEATMAP HORAIRE 24H · VUE DÉTAILLÉE (96 buckets × 15 min)';
  // SVG XL : 1600×480 viewBox (3.3× plus haut que tuile, 3.3× plus large)
  bd.innerHTML =
      '<div class="def-heatmap-modal-wrap">'
    +   '<div class="def-heatmap-svg-wrap def-heatmap-svg-wrap-xl">'
    +     '<svg id="def-heatmap-svg-xl" class="def-heatmap-svg def-heatmap-svg-xl" '
    +          'viewBox="0 0 1600 480" preserveAspectRatio="xMidYMid meet"></svg>'
    +     '<div id="def-heatmap-tooltip-xl" class="def-heatmap-tooltip"></div>'
    +   '</div>'
    +   '<div id="def-heatmap-stats-xl" class="def-heatmap-stats" style="margin-top:1rem;font-size:.95rem;text-align:center"></div>'
    +   '<div id="def-heatmap-legend-xl" class="def-heatmap-legend" style="margin-top:.5rem;font-size:.85rem;text-align:center"></div>'
    + '</div>';
  ov.classList.add('open');   // ⚠ 'open' (pas 'show') — cohérence avec openEventModal/closeEventModal
  // Rendre la heatmap dans le SVG XL (dimensions 1600×480)
  renderHeatmap('def-heatmap-svg-xl', 1600, 480);
  // Re-copier stats + légende depuis les conteneurs originaux (renderHeatmap les a remplis)
  var statsXl = document.getElementById('def-heatmap-stats-xl');
  var legXl = document.getElementById('def-heatmap-legend-xl');
  var statsOrig = document.getElementById(DOM.heatStats);
  var legOrig = document.getElementById(DOM.heatLeg);
  if(statsXl && statsOrig) statsXl.innerHTML = statsOrig.innerHTML;
  if(legXl && legOrig)     legXl.innerHTML   = legOrig.innerHTML;
  // Tooltip hover : re-wire sur le SVG XL avec le tooltip XL
  var svgXl = document.getElementById('def-heatmap-svg-xl');
  if(svgXl) _wireHeatmapTooltipCustom(svgXl, _data.heatmap_24h, 'def-heatmap-tooltip-xl');
}

// Variante de _wireHeatmapTooltip qui prend l'ID du tooltip en paramètre (XL)
function _wireHeatmapTooltipCustom(svg, data, tipId){
  var tip = document.getElementById(tipId);
  if(!tip) return;
  var wrap = svg.parentNode;
  Array.prototype.forEach.call(svg.querySelectorAll('.def-heat-bar-hit'), function(hit){
    hit.addEventListener('mouseenter', function(){
      var i = parseInt(hit.getAttribute('data-i'), 10);
      var v = parseInt(hit.getAttribute('data-v'), 10);
      var minutesAgo = (HEATMAP_BUCKETS - 1 - i) * HEATMAP_BUCKET_MIN;
      var lbl = i === HEATMAP_BUCKETS - 1
        ? 'maintenant'
        : (minutesAgo < 60 ? 'il y a ' + minutesAgo + 'min'
           : 'h-' + Math.floor(minutesAgo / 60) + ((minutesAgo % 60) ? ':' + (minutesAgo % 60).toString().padStart(2, '0') : ''));
      tip.innerHTML = '<strong style="color:#fff">' + v + '</strong> actions · <span style="opacity:.7">' + lbl + '</span>';
      tip.style.display = 'block';
    });
    hit.addEventListener('mousemove', function(ev){
      var rect = wrap.getBoundingClientRect();
      var px = ev.clientX - rect.left + 12;
      var py = ev.clientY - rect.top + 12;
      tip.style.left = px + 'px';
      tip.style.top  = py + 'px';
    });
    hit.addEventListener('mouseleave', function(){ tip.style.display = 'none'; });
  });
}

// Path SVG Catmull-Rom → cubic Bezier (interpolation lissée des sommets)
function _heatCurvePath(nodes){
  if(nodes.length < 2) return '';
  var d = 'M ' + nodes[0].cx + ' ' + nodes[0].cy;
  for(var i=0;i<nodes.length-1;i++){
    var p0 = nodes[i-1] || nodes[i];
    var p1 = nodes[i];
    var p2 = nodes[i+1];
    var p3 = nodes[i+2] || p2;
    var cp1x = p1.cx + (p2.cx - p0.cx) / 6;
    var cp1y = p1.cy + (p2.cy - p0.cy) / 6;
    var cp2x = p2.cx - (p3.cx - p1.cx) / 6;
    var cp2y = p2.cy - (p3.cy - p1.cy) / 6;
    d += ' C ' + cp1x + ' ' + cp1y + ', ' + cp2x + ' ' + cp2y + ', ' + p2.cx + ' ' + p2.cy;
  }
  return d;
}

// Tooltip flottant au survol d'une barre
function _wireHeatmapTooltip(svg, data){
  var tip = document.getElementById(DOM.heatTip);
  if(!tip) return;
  var wrap = svg.parentNode;
  Array.prototype.forEach.call(svg.querySelectorAll('.def-heat-bar-hit'), function(hit){
    hit.addEventListener('mouseenter', function(ev){
      var i = parseInt(hit.getAttribute('data-i'), 10);
      var v = parseInt(hit.getAttribute('data-v'), 10) || 0;
      var minutesAgo = (HEATMAP_BUCKETS - 1 - i) * HEATMAP_BUCKET_MIN;
      var hAgo = Math.floor(minutesAgo / 60);
      var mAgo = minutesAgo % 60;
      var lblWhen;
      if(i === HEATMAP_BUCKETS - 1){
        lblWhen = 'tranche courante';
      } else if(hAgo === 0){
        lblWhen = 'il y a ' + mAgo + ' min';
      } else if(mAgo === 0){
        lblWhen = 'il y a ' + hAgo + ' h';
      } else {
        lblWhen = 'il y a ' + hAgo + 'h' + mAgo;
      }
      // Heure absolue locale du début de la tranche
      var d = new Date(Date.now() - minutesAgo * 60000);
      var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
      var hAbs = pad(d.getHours()) + ':' + pad(d.getMinutes());
      tip.innerHTML = '<strong>' + v + '</strong> action' + (v > 1 ? 's' : '')
                    + ' / ' + HEATMAP_BUCKET_MIN + ' min<br>'
                    + lblWhen + ' &middot; ' + hAbs;
      tip.classList.add('visible');
      _positionHeatmapTip(tip, wrap, ev);
    });
    hit.addEventListener('mousemove', function(ev){ _positionHeatmapTip(tip, wrap, ev); });
    hit.addEventListener('mouseleave', function(){ tip.classList.remove('visible'); });
  });
}

function _positionHeatmapTip(tip, wrap, ev){
  var rect = wrap.getBoundingClientRect();
  tip.style.left = (ev.clientX - rect.left) + 'px';
  tip.style.top  = (ev.clientY - rect.top) + 'px';
}

// Mini-stats : moyenne · pic · médiane
function _renderHeatmapStats(data, max){
  var el = document.getElementById(DOM.heatStats);
  if(!el) return;
  var sum = data.reduce(function(a,b){ return a + (b || 0); }, 0);
  // Moyenne /heure pour rester lisible (buckets = 15 min)
  var hoursInWindow = (data.length * HEATMAP_BUCKET_MIN) / 60;
  var avgPerHour = hoursInWindow > 0 ? Math.round(sum / hoursInWindow) : 0;
  var sorted = data.slice().sort(function(a,b){ return a - b; });
  var med = sorted[Math.floor(sorted.length / 2)] || 0;
  var peakIdx = data.indexOf(max);
  var peakWhen = _bucketAgoLabel(peakIdx);
  el.innerHTML =
      '<span>Moy/h <strong>' + avgPerHour + '</strong></span>'
    + '<span>Pic ' + HEATMAP_BUCKET_MIN + 'min <strong>' + max + '</strong> (' + peakWhen + ')</span>'
    + '<span>M&eacute;diane <strong>' + med + '</strong></span>';
}

// Helper : convertit un index de bucket en label "maint." / "il y a Xmin" / "h-X"
function _bucketAgoLabel(idx){
  if(idx < 0) return 'n/a';
  if(idx === HEATMAP_BUCKETS - 1) return 'maint.';
  var minutesAgo = (HEATMAP_BUCKETS - 1 - idx) * HEATMAP_BUCKET_MIN;
  if(minutesAgo < 60) return 'il y a ' + minutesAgo + 'min';
  var hAgo = Math.floor(minutesAgo / 60);
  var mAgo = minutesAgo % 60;
  return mAgo === 0 ? ('h-' + hAgo) : ('h-' + hAgo + ' ' + mAgo + 'min');
}


// ── Top listes (cliquables → drill-down filtre) ──────────────────────────
function renderTopLists(){
  renderTopList(DOM.topCty, _data.top_country, 8);
  renderTopList(DOM.topAs,  _data.top_as,      8);
  renderTopList(DOM.topScn, _data.top_scenario,8);
}

function renderTopList(elId, list, n){
  var el = document.getElementById(elId);
  if(!el) return;
  var items = (list || []).slice(0, n);
  if(!items.length){ el.innerHTML = '<div class="def-top-empty">aucun</div>'; return; }
  var max = items[0].count || 1;
  el.innerHTML = items.map(function(x){
    var pct = Math.round((x.count / max) * 100);
    return '<div class="def-top-row def-clickable" data-fval="' + esc(x.value) + '" '
         + 'title="Filtrer la timeline sur cette valeur">'
         + '<div class="def-top-bar" style="width:'+pct+'%"></div>'
         + '<span class="def-top-name">' + esc(x.value) + '</span>'
         + '<span class="def-top-cnt">' + x.count + '</span>'
         + '</div>';
  }).join('');
  // Wire clic → drill-down filtre texte
  Array.prototype.forEach.call(el.querySelectorAll('.def-top-row'), function(r){
    r.addEventListener('click', function(){
      applyFilterText(r.getAttribute('data-fval') || '');
    });
  });
}

// ── Timeline ──────────────────────────────────────────────────────────────
function renderTimeline(){
  // Filtres couche : reconstruire les boutons depuis top_layer
  var fil = document.getElementById(DOM.tlFilters);
  if(fil && _data.top_layer){
    var html = '<span class="def-flt-lbl">Couche :</span>'
             + '<button class="def-flt-btn '+(_filterLayer==='all'?'active':'')+'" data-layer="all">tous</button>';
    _data.top_layer.forEach(function(l){
      var col = LAYER_COLORS[l.value] || '#888';
      html += '<button class="def-flt-btn '+(_filterLayer===l.value?'active':'')
            + '" data-layer="'+esc(l.value)+'" style="--lcol:'+col+'">'
            + esc(l.value) + ' <span class="def-flt-cnt">'+l.count+'</span></button>';
    });
    fil.innerHTML = html;
    Array.prototype.forEach.call(fil.querySelectorAll('.def-flt-btn'), function(b){
      b.addEventListener('click', function(){
        _filterLayer = b.getAttribute('data-layer') || 'all';
        renderTimeline();
      });
    });
  }
  // Filtre texte
  var sEl = document.getElementById(DOM.tlSearch);
  var cEl = document.getElementById(DOM.tlClear);
  if(sEl && !sEl._bound){
    sEl.addEventListener('input', function(){ _filterText = sEl.value.toLowerCase(); renderTimelineRows(); });
    sEl._bound = true;
  }
  if(cEl && !cEl._bound){
    cEl.addEventListener('click', function(){
      _filterText = ''; if(sEl) sEl.value = '';
      _filterLayer = 'all'; renderTimeline();
    });
    cEl._bound = true;
  }
  renderTimelineRows();
}

function _eventId(e){
  return (e.ts || '') + '|' + (e.ip || '') + '|' + (e.layer || '') + '|' + (e.scenario || '');
}

function renderTimelineRows(){
  var tl = document.getElementById(DOM.tl);
  var cnt = document.getElementById(DOM.tlCount);
  if(!tl || !_data.timeline) return;
  var rows = _data.timeline.filter(function(e){
    if(_filterLayer !== 'all' && e.layer !== _filterLayer) return false;
    if(_filterText){
      var hay = (e.ip + ' ' + (e.country||'') + ' ' + (e.as||'') + ' ' + (e.scenario||'')).toLowerCase();
      if(hay.indexOf(_filterText) < 0) return false;
    }
    return true;
  }).slice(0, TL_ROW_HARD_LIMIT);
  if(cnt) cnt.textContent = rows.length;
  if(!rows.length){
    tl.innerHTML = '<div class="def-tl-empty">Aucun &eacute;v&eacute;nement correspondant.</div>';
    return;
  }
  // Détection des nouveaux events (jamais vus dans cette session de page)
  var newIds = {};
  rows.forEach(function(e){
    var id = _eventId(e);
    if(!_seenEventIds[id]) newIds[id] = true;
  });
  tl.innerHTML = rows.map(function(e){
    var col = LAYER_COLORS[e.layer] || '#888';
    var sev = e.severity || 1;
    var sevCls = sev >= 3 ? 'def-sev-h' : (sev >= 2 ? 'def-sev-m' : 'def-sev-l');
    var id = _eventId(e);
    var flashCls = newIds[id] ? ' def-tl-row--new' : '';
    return '<div class="def-tl-row '+sevCls+flashCls+'" data-eid="'+esc(id)+'">'
         + '<span class="def-tl-ts">' + esc(e.ts).replace('T',' ') + '</span>'
         + '<span class="def-tl-layer def-clickable" data-fval="'+esc(e.layer)+'" style="--lcol:'+col+'" '
         + 'title="Filtrer sur cette couche">' + esc(e.layer) + '</span>'
         + '<span class="def-tl-ip def-clickable" data-copy="'+esc(e.ip || '')+'" '
         + 'title="Copier l&apos;IP">' + esc(e.ip || '') + '</span>'
         + '<span class="def-tl-cn def-clickable" data-fval="'+esc(e.country || '')+'" '
         + 'title="Filtrer sur ce pays">' + esc(e.country || '') + '</span>'
         + '<span class="def-tl-as def-clickable" data-fval="'+esc(e.as || '')+'" '
         + 'title="Filtrer sur cet AS">' + esc((e.as || '').slice(0,40)) + '</span>'
         + '<span class="def-tl-sc">' + esc(e.scenario || '') + '</span>'
         + '<span class="def-tl-act">' + esc(e.action || '') + '</span>'
         + '</div>';
  }).join('');
  // Wire clic sur les enfants .def-clickable (priorité : drill-down ciblé)
  Array.prototype.forEach.call(tl.querySelectorAll('.def-clickable'), function(el){
    el.addEventListener('click', function(ev){
      ev.stopPropagation();
      var v = el.getAttribute('data-fval');
      var c = el.getAttribute('data-copy');
      if(c) return copyToClipboard(c);
      if(v) return applyFilterText(v);
    });
  });
  // Wire clic sur la row entière → ouvre modal détail (sauf si on a cliqué un enfant ciblé)
  Array.prototype.forEach.call(tl.querySelectorAll('.def-tl-row'), function(row){
    row.addEventListener('click', function(){
      var eid = row.getAttribute('data-eid');
      var ev = (_data.timeline || []).find(function(e){ return _eventId(e) === eid; });
      if(ev) openEventModal(ev);
    });
  });
  // Marquer comme vus (extinction du flash CSS animée par 'def-tl-row--new')
  Object.keys(newIds).forEach(function(id){ _seenEventIds[id] = true; });
  // Retire la class flash après animation pour éviter qu'elle traîne sur le DOM
  if(Object.keys(newIds).length){
    setTimeout(function(){
      Array.prototype.forEach.call(tl.querySelectorAll('.def-tl-row--new'), function(r){
        r.classList.remove('def-tl-row--new');
      });
    }, FLASH_DURATION_MS);
  }
}

// ── Footer ────────────────────────────────────────────────────────────────
function renderFooter(){
  var f = document.getElementById(DOM.footMeta);
  if(!f || !_data) return;
  f.innerHTML = 'defense_24h v' + esc(_data.version)
              + ' &middot; fen&ecirc;tre ' + (_data.window_hours||24) + 'h'
              + ' &middot; g&eacute;n&eacute;r&eacute; ' + esc(_data.generated_at)
              + ' &middot; auto-refresh ' + REFRESH_S + 's';
}

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(s){
  if(s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Modal détail event (réutilise structure .modal-overlay du SOC) ───────
function openEventModal(ev){
  var ov = document.getElementById(DOM.modal);
  var ti = document.getElementById(DOM.modalTitle);
  var bd = document.getElementById(DOM.modalBody);
  if(!ov || !bd) return;
  var col = LAYER_COLORS[ev.layer] || '#888';
  // Cherche les autres events de la même IP dans la timeline 24h
  var sameIp = (_data.timeline || []).filter(function(e){
    return e.ip && e.ip === ev.ip && _eventId(e) !== _eventId(ev);
  });
  var otherHtml = sameIp.length
    ? sameIp.slice(0,10).map(function(e){
        return '<div class="def-mb-other-row">'
             + '<span>' + esc(e.ts).replace('T',' ') + '</span>'
             + '<span style="color:'+(LAYER_COLORS[e.layer]||'#888')+'">' + esc(e.layer) + '</span>'
             + '<span style="color:var(--cyan);flex:1;overflow:hidden;text-overflow:ellipsis">' + esc(e.scenario) + '</span>'
             + '</div>';
      }).join('')
    : '<div style="color:var(--muted);font-style:italic;padding:.3rem 0">aucun autre dans la fen&ecirc;tre 24h</div>';
  var ipDeepLink = ev.ip
    ? '<a class="def-mb-btn" href="index.html#ip-deep=' + esc(ev.ip) + '" target="_blank" rel="noopener">'
        + '&#10753; Investigation IP profonde &rarr;</a>'
    : '';
  var copyBtn = ev.ip
    ? '<button class="def-mb-btn" type="button" data-copy-ip="' + esc(ev.ip) + '">'
        + '&#128203; Copier l&apos;IP</button>'
    : '';
  if(ti) ti.innerHTML = '// D&Eacute;TAIL &Eacute;V&Eacute;NEMENT';
  bd.innerHTML =
      '<div class="def-mb-table">'
    +   '<div class="def-mb-lbl">Quand</div>'
    +   '<div class="def-mb-val">' + esc(ev.ts).replace('T',' ') + ' UTC</div>'
    +   '<div class="def-mb-lbl">Couche</div>'
    +   '<div class="def-mb-val"><span class="def-tl-layer" style="--lcol:'+col+';color:'+col+'">'+esc(ev.layer)+'</span></div>'
    +   '<div class="def-mb-lbl">IP</div>'
    +   '<div class="def-mb-val">' + esc(ev.ip || '(aucune)') + '</div>'
    +   '<div class="def-mb-lbl">Pays</div>'
    +   '<div class="def-mb-val">' + esc(ev.country || '—') + '</div>'
    +   '<div class="def-mb-lbl">AS</div>'
    +   '<div class="def-mb-val">' + esc(ev.as || '—') + '</div>'
    +   '<div class="def-mb-lbl">Sc&eacute;nario</div>'
    +   '<div class="def-mb-val" style="color:var(--cyan)">' + esc(ev.scenario || '—') + '</div>'
    +   '<div class="def-mb-lbl">Action</div>'
    +   '<div class="def-mb-val" style="text-transform:uppercase">' + esc(ev.action || '—') + '</div>'
    +   '<div class="def-mb-lbl">S&eacute;v&eacute;rit&eacute;</div>'
    +   '<div class="def-mb-val">' + (ev.severity || 1) + ' / 3</div>'
    + '</div>'
    + '<div class="def-mb-sep">Autres &eacute;v&eacute;nements de cette IP &middot; 24h</div>'
    + '<div class="def-mb-other-list">' + otherHtml + '</div>'
    + '<div class="def-mb-actions">' + copyBtn + ipDeepLink + '</div>';
  // Wire copy button
  var cb = bd.querySelector('[data-copy-ip]');
  if(cb){
    cb.addEventListener('click', function(){ copyToClipboard(cb.getAttribute('data-copy-ip')); });
  }
  ov.classList.add('open');
}

function closeEventModal(){
  var ov = document.getElementById(DOM.modal);
  if(ov) ov.classList.remove('open');
}

// ── Horloge SOC (cohérence avec dashboard principal) ─────────────────────
function startClock(){
  var el = document.getElementById(DOM.clock);
  if(!el) return;
  setInterval(function(){
    var d = new Date();
    var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
    el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }, 1000);
}

// ── Wire bouton pause (déjà présent dans le HTML, pas d'injection) ───────
function wirePauseButton(){
  var btn = document.getElementById(DOM.pauseBtn);
  if(btn) btn.addEventListener('click', togglePause);
}

// ── Wire modal close (bouton × + Esc + clic sur overlay) ─────────────────
function wireModal(){
  var ov = document.getElementById(DOM.modal);
  var cl = document.getElementById(DOM.modalClose);
  if(cl) cl.addEventListener('click', closeEventModal);
  if(ov){
    ov.addEventListener('click', function(ev){
      if(ev.target === ov) closeEventModal();   // clic sur fond → ferme
    });
  }
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape') closeEventModal();
  });
  // Clic sur la heatmap tuile → ouvre modal XL (2026-05-16)
  var heatWrap = document.getElementById(DOM.heatSvg);
  if(heatWrap){
    heatWrap.style.cursor = 'zoom-in';
    heatWrap.addEventListener('click', openHeatmapModal);
  }
}

// ════ Console trafic temps réel — SSE /traffic-stream ══════════════════
// État runtime (isolé sous _cn pour ne polluer ni le namespace ni le rate-limit
// du reste de la page).
var _cn = {
  es:        null,         // EventSource
  paused:    false,
  filter:    '',
  toggles:   { blocked:true, suspect:true, curious:true, ok:true, noise:false },
  stampsRecv:    [],       // timestamps des events REÇUS du backend (débit brut)
  stampsShown:   [],       // timestamps des events AFFICHÉS (après filtre)
  counters:  { blocked:0, suspect:0, ok:0 },
  reconnectTimer: null,
  pausedQueueLen: 0,
};

function _cnStartFeed(){
  if(_cn.es){ try{_cn.es.close();}catch(e){} }
  _cn.es = new EventSource(CN_FEED_URL);
  _cnSetState('connecté');
  _cn.es.addEventListener('trafic', function(msg){
    if(_cn.paused){ _cn.pausedQueueLen++; _cnSetState('PAUSE — ' + _cn.pausedQueueLen + ' messages en attente'); return; }
    try{ _cnPushEvent(JSON.parse(msg.data)); }catch(e){}
  });
  _cn.es.onerror = function(){
    _cnSetState('déconnecté · reconnexion ' + Math.round(CN_RECONNECT_MS/1000) + 's…');
    try{_cn.es.close();}catch(e){}
    clearTimeout(_cn.reconnectTimer);
    _cn.reconnectTimer = setTimeout(_cnStartFeed, CN_RECONNECT_MS);
  };
}

function _cnPushEvent(ev){
  // Débit brut : compté AVANT tout filtre (reflète le vrai trafic SSE reçu)
  _cn.stampsRecv.push(Date.now());
  if(_cn.stampsRecv.length > 1000) _cn.stampsRecv = _cn.stampsRecv.slice(-1000);
  _cnRefreshCounters();
  // Toggle catégorie : si le niveau est OFF, on ignore
  if(!_cn.toggles[ev.level]) return;
  // Filtre texte
  if(_cn.filter){
    var hay = ((ev.ip||'') + ' ' + (ev.uri||'') + ' ' + (ev.ua||'')).toLowerCase();
    if(hay.indexOf(_cn.filter) < 0) return;
  }
  var cn = document.getElementById(DOM.cn);
  if(!cn) return;
  // Auto-scroll : seulement si l'utilisateur est proche du bas
  var nearBottom = (cn.scrollHeight - cn.scrollTop - cn.clientHeight) < CN_AUTO_SCROLL_THR_PX;
  var row = document.createElement('div');
  row.className = 'def-cn-line def-cn-lv-' + ev.level;
  row.dataset.ts    = Date.now();        // ⏱ timestamp pour purge sliding window 15 min
  row.dataset.level = ev.level;          // 🎯 niveau pour ré-application filtre live
  var stClass = 'def-cn-st def-cn-st-' + (Math.floor(ev.status/100)) + 'x';
  var reasonsHtml = (ev.reasons || []).map(function(r){
    return '<span class="def-cn-tag">' + esc(r) + '</span>';
  }).join('');
  // ts : on garde seulement HH:MM:SS depuis la chaîne nginx « 16/May/2026:10:11:26 +0200 »
  var ts = (ev.ts || '').split(':').slice(1,4).join(':');
  row.innerHTML =
      '<span class="def-cn-ts">' + esc(ts) + '</span>'
    + '<span class="def-cn-cn">' + esc(ev.country || '?') + '</span>'
    + '<span class="def-cn-mth">' + esc(ev.method) + '</span>'
    + '<span class="def-cn-uri" title="' + esc(ev.uri) + '">' + esc(ev.uri) + '</span>'
    + '<span class="' + stClass + '">' + ev.status + '</span>'
    + '<span class="def-cn-sz">' + (ev.size || 0) + '</span>'
    + '<span class="def-cn-ip" data-copy="' + esc(ev.ip) + '" title="Cliquer pour copier">' + esc(ev.ip) + '</span>'
    + '<span class="def-cn-ua">' + esc(ev.ua) + reasonsHtml + '</span>';
  cn.appendChild(row);
  // Garde-fou DOM : si burst >2000 lignes, on coupe les plus anciennes
  // (purge temporelle 15 min gérée séparément par _cnPurgeOldLines toutes les 5s)
  while(cn.childElementCount > CN_RING_HARD_MAX) cn.removeChild(cn.firstChild);
  // Compteurs + req/s
  if(ev.level === 'blocked') _cn.counters.blocked++;
  if(ev.level === 'suspect') _cn.counters.suspect++;
  if(ev.level === 'ok' || ev.level === 'noise' || ev.level === 'curious') _cn.counters.ok++;
  _cn.stampsShown.push(Date.now());
  if(_cn.stampsShown.length > 1000) _cn.stampsShown = _cn.stampsShown.slice(-1000);
  _cnRefreshCounters();
  if(nearBottom) cn.scrollTop = cn.scrollHeight;
  // Wire clic IP copy (lazy : ajouté sur la nouvelle row uniquement)
  var ipEl = row.querySelector('.def-cn-ip');
  if(ipEl){
    ipEl.addEventListener('click', function(){
      copyToClipboard(ipEl.getAttribute('data-copy') || '');
    });
  }
}

function _cnRefreshCounters(){
  var setN = function(id, n){ var e = document.getElementById(id); if(e) e.textContent = n; };
  setN(DOM.cnCBlocked, _cn.counters.blocked);
  setN(DOM.cnCSuspect, _cn.counters.suspect);
  setN(DOM.cnCOk,      _cn.counters.ok);
  // 2 débits sur fenêtre glissante 5s : reçus du backend / affichés après filtre
  var cutoff = Date.now() - CN_RATE_WINDOW_MS;
  _cn.stampsRecv  = _cn.stampsRecv.filter(function(t){ return t >= cutoff; });
  _cn.stampsShown = _cn.stampsShown.filter(function(t){ return t >= cutoff; });
  var rateRecv  = (_cn.stampsRecv.length  / (CN_RATE_WINDOW_MS/1000)).toFixed(1);
  var rateShown = (_cn.stampsShown.length / (CN_RATE_WINDOW_MS/1000)).toFixed(1);
  var r = document.getElementById(DOM.cnRate);
  if(r){
    r.innerHTML = '<strong>' + rateRecv + '</strong> req/s re&ccedil;ues &middot; '
                + '<strong>' + rateShown + '</strong> affich&eacute;es (5s)';
  }
}

function _cnSetState(msg){
  var e = document.getElementById(DOM.cnState);
  if(e) e.textContent = msg;
}

function _cnTogglePause(){
  _cn.paused = !_cn.paused;
  var b = document.getElementById(DOM.cnPause);
  if(b){
    b.textContent = _cn.paused ? 'REPRISE' : 'PAUSE';
    b.classList.toggle('paused', _cn.paused);
  }
  if(!_cn.paused){
    _cn.pausedQueueLen = 0;
    _cnSetState('repris (file vidée — événements rattrapés au prochain push)');
  } else {
    _cnSetState('PAUSE — 0 message en attente');
  }
}

function _cnClear(){
  var cn = document.getElementById(DOM.cn);
  if(cn) cn.innerHTML = '';
  _cn.counters    = { blocked:0, suspect:0, ok:0 };
  _cn.stampsRecv  = [];
  _cn.stampsShown = [];
  _cnRefreshCounters();
}

// Sliding window 15 min — purge auto + animation fade-out (Wireshark like)
function _cnPurgeOldLines(){
  var cn = document.getElementById(DOM.cn);
  if(!cn) return;
  var cutoff = Date.now() - CN_WINDOW_MS;
  var rows = cn.children;
  // Itère depuis le début (lignes les plus anciennes) jusqu'à trouver une ligne récente
  while(rows.length && (parseInt(rows[0].dataset.ts || '0', 10) < cutoff)){
    var oldRow = rows[0];
    if(!oldRow.classList.contains('def-cn-fading')){
      oldRow.classList.add('def-cn-fading');
      setTimeout(function(r){ return function(){
        if(r && r.parentNode) r.parentNode.removeChild(r);
      };}(oldRow), 400);
    }
    // Important : on sort de la boucle après avoir lancé le fade — les autres
    // anciens seront purgés au prochain tick (évite cascade synchrone DOM)
    break;
  }
  // Purge sans fade pour les vieilles lignes oubliées par fade (race condition burst)
  while(rows.length && (parseInt(rows[0].dataset.ts || '0', 10) < cutoff - 60000)){
    cn.removeChild(rows[0]);
  }
}

// Re-applique tous les filtres (toggles + texte) sur le DOM existant
// Appelé quand l'utilisateur change un toggle/filtre texte — fix bug "filtres ne marchent que sur nouvelles lignes"
function _cnReapplyFilters(){
  var cn = document.getElementById(DOM.cn);
  if(!cn) return;
  var rows = cn.children;
  var filter = _cn.filter || '';
  for(var i = 0; i < rows.length; i++){
    var r = rows[i];
    var lvl = r.dataset.level || '';
    var showByLevel = _cn.toggles[lvl] !== false;
    var showByText = true;
    if(filter){
      var hay = (r.textContent || '').toLowerCase();
      showByText = hay.indexOf(filter) >= 0;
    }
    r.style.display = (showByLevel && showByText) ? '' : 'none';
  }
}

function _cnWireControls(){
  var p = document.getElementById(DOM.cnPause);
  if(p) p.addEventListener('click', _cnTogglePause);
  var c = document.getElementById(DOM.cnClear);
  if(c) c.addEventListener('click', _cnClear);
  var f = document.getElementById(DOM.cnFilter);
  if(f){
    // Debounce 80 ms : evite reflow O(n) par caractere lors d'une frappe rapide.
    // _cn.filter reste maj synchronement → les NOUVELLES lignes ajoutees pendant
    // le debounce sont deja filtrees a l'add. Seul le reapply DOM est differe.
    var _filterT = null;
    f.addEventListener('input', function(){
      _cn.filter = f.value.toLowerCase();
      if(_filterT) clearTimeout(_filterT);
      _filterT = setTimeout(_cnReapplyFilters, 80);
    });
  }
  // Toggles catégories
  [
    [DOM.cnTgBlock, 'blocked'],
    [DOM.cnTgSusp,  'suspect'],
    [DOM.cnTgCur,   'curious'],
    [DOM.cnTgOk,    'ok'],
    [DOM.cnTgNoise, 'noise'],
  ].forEach(function(t){
    var el = document.getElementById(t[0]);
    if(el) el.addEventListener('change', function(){
      _cn.toggles[t[1]] = el.checked;
      _cnReapplyFilters();   // ← re-applique sur DOM existant
    });
  });
  // Démarre la purge temporelle sliding window 15 min
  setInterval(_cnPurgeOldLines, CN_PURGE_INTERVAL_MS);
}

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  startClock();
  wirePauseButton();
  wireModal();
  _cnWireControls();
  _cnStartFeed();
  fetchData();
  startCountdown();
});
