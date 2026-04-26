// 20-aide.js — Tuile AIDE (intégrité fichiers) + modal détaillé — v3.93.18 — 2026-04-18
// Consomme : d.aide — données collectées par get_aide_status() dans monitoring_gen.py
// Exporté : window._renderAide(d, gridEl)

(function(){
'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════════════════════ */
let _cssInjected = false;
function _injectCss(){
  if(_cssInjected) return;
  _cssInjected = true;
  const s = document.createElement('style');
  s.textContent = [
    /* ── Tuile AIDE ── */
    '.aide-tile{cursor:pointer;display:flex;flex-direction:column}',
    '.aide-tile .card-inner{flex:1;display:flex;flex-direction:column}',
    '.aide-tile .aide-counts{margin-top:auto}',
    '.aide-status-row{display:flex;align-items:center;gap:.5rem;margin:.25rem 0 .5rem}',
    '.aide-badge{padding:.15rem .55rem;border-radius:2px;font-size:var(--fs-xs);',
    '  font-family:"Courier New",monospace;font-weight:700;letter-spacing:.05em}',
    '.aide-badge.ok{background:rgba(0,255,136,.12);color:var(--green);',
    '  border:1px solid rgba(0,255,136,.35)}',
    '.aide-badge.alert{background:rgba(255,60,60,.12);color:#ff4444;',
    '  border:1px solid rgba(255,60,60,.45);animation:aide-pulse 1.2s ease-in-out infinite}',
    '.aide-badge.pending{background:rgba(122,154,184,.1);color:rgba(122,154,184,.7);',
    '  border:1px solid rgba(122,154,184,.25)}',
    '@keyframes aide-pulse{0%,100%{opacity:1}50%{opacity:.55}}',
    '.aide-meta{font-size:var(--fs-xs);color:rgba(122,154,184,.7);',
    '  font-family:"Courier New",monospace;line-height:1.7}',
    '.aide-meta span{color:rgba(0,215,255,.75)}',
    '.aide-counts{display:flex;gap:.6rem;margin:.45rem 0 0;flex-wrap:wrap}',
    '.aide-count-item{font-size:var(--fs-xs);font-family:"Courier New",monospace;',
    '  padding:.1rem .4rem;border-radius:2px}',
    '.aide-count-item.chg{background:rgba(255,160,0,.1);color:#ffa000;border:1px solid rgba(255,160,0,.3)}',
    '.aide-count-item.add{background:rgba(0,255,136,.08);color:var(--green);border:1px solid rgba(0,255,136,.25)}',
    '.aide-count-item.rem{background:rgba(255,60,60,.1);color:#ff4444;border:1px solid rgba(255,60,60,.3)}',
    '.aide-count-item.tot{background:rgba(0,215,255,.07);color:rgba(0,215,255,.7);border:1px solid rgba(0,215,255,.2)}',
    /* ── Modal AIDE ── */
    '.aide-modal{display:flex;flex-direction:column;gap:.6rem;overflow-y:auto}',
    '.aide-m-section{background:rgba(0,0,0,.3);border:1px solid rgba(0,215,255,.12);',
    '  border-radius:3px;padding:.65rem .8rem}',
    '.aide-m-title{font-size:var(--fs-xs);color:rgba(0,215,255,.55);',
    '  text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem}',
    '.aide-m-row{display:flex;justify-content:space-between;font-size:var(--fs-xs);',
    '  font-family:"Courier New",monospace;padding:.1rem 0;',
    '  border-bottom:1px solid rgba(0,215,255,.06)}',
    '.aide-m-row:last-child{border-bottom:none}',
    '.aide-m-row .lbl{color:rgba(122,154,184,.6)}',
    '.aide-m-row .val{color:rgba(0,215,255,.85)}',
    '.aide-m-row .val.ok{color:var(--green)}',
    '.aide-m-row .val.alert{color:#ff4444}',
    '.aide-m-row .val.warn{color:#ffa000}',
    '.aide-files-list{margin-top:.35rem;font-size:calc(var(--fs-xs) - 1px);',
    '  font-family:"Courier New",monospace;color:rgba(255,160,0,.85);',
    '  max-height:180px;overflow-y:auto;',
    '  background:rgba(0,0,0,.2);padding:.4rem .5rem;border-radius:2px}',
    '.aide-files-list div{padding:.1rem 0;border-bottom:1px solid rgba(255,160,0,.08);word-break:break-all}',
    '.aide-files-list div:last-child{border-bottom:none}',
    '.aide-info-box{background:rgba(0,215,255,.04);border:1px solid rgba(0,215,255,.15);',
    '  border-radius:3px;padding:.5rem .7rem;font-size:var(--fs-xs);',
    '  font-family:"Courier New",monospace;color:rgba(0,215,255,.6);margin-top:.3rem;line-height:1.6}',
  ].join('');
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════════ */
function _fmtTs(ts){
  if(!ts) return '—';
  try{
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})
      + ' ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ return ts; }
}

function _statusLabel(s){
  if(s === 'OK')     return {cls:'ok',    txt:'✓ INTÈGRE'};
  if(s === 'ALERT')  return {cls:'alert', txt:'⚠ ALERTE INTÉGRITÉ'};
  return                    {cls:'pending',txt:'… EN ATTENTE'};
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════════════════════════ */
function _openModal(a){
  const lbl    = _statusLabel(a.status);
  const lastChk = a.last_check_ts
    ? _fmtTs(a.last_check_ts) + (a.age_hours !== undefined ? ' (il y a ' + a.age_hours + 'h)' : '')
    : 'Aucune (cron 03h00)';
  const dbInit  = _fmtTs(a.db_init_ts);
  const entriesStr = a.entries_total ? a.entries_total.toLocaleString('fr-FR') : '49 945';

  // ── Pre-vars sections conditionnelles ──
  let diffHtml = '';
  if(a.status === 'ALERT'){
    const filesHtml = (a.changed_files && a.changed_files.length)
      ? '<div class="aide-m-title" style="margin-top:.5rem">Fichiers concernés (' + a.changed_files.length + ')</div>'
        + '<div class="aide-files-list">'
        + a.changed_files.map(function(f){ return '<div>' + esc(f) + '</div>'; }).join('')
        + '</div>'
      : '';
    diffHtml = '<div class="aide-m-section">'
      + '<div class="aide-m-title">⚠ Différences détectées</div>'
      + '<div class="aide-m-row"><span class="lbl">Fichiers modifiés</span><span class="val warn">' + (a.changed||0) + '</span></div>'
      + '<div class="aide-m-row"><span class="lbl">Fichiers ajoutés</span><span class="val ok">' + (a.added||0) + '</span></div>'
      + '<div class="aide-m-row"><span class="lbl">Fichiers supprimés</span><span class="val alert">' + (a.removed||0) + '</span></div>'
      + filesHtml
      + '</div>';
  }
  const errHtml = a.error
    ? '<div class="aide-m-section" style="border-color:rgba(255,160,0,.25)">'
      + '<div class="aide-m-title" style="color:rgba(255,160,0,.7)">ℹ Information</div>'
      + '<div style="font-size:var(--fs-xs);font-family:\'Courier New\',monospace;color:rgba(255,160,0,.7)">'
      + esc(a.error) + '</div>'
      + '</div>'
    : '';

  const h = '<div class="aide-modal">'
    + '<div class="aide-m-section">'
    + '<div class="aide-m-title">◉ Statut AIDE — srv-ngix (' + SOC_INFRA.SRV_NGIX + ')</div>'
    + '<div class="aide-m-row"><span class="lbl">Statut</span><span class="val ' + lbl.cls + '">' + lbl.txt + '</span></div>'
    + '<div class="aide-m-row"><span class="lbl">Base initialisée</span><span class="val">' + esc(dbInit) + '</span></div>'
    + '<div class="aide-m-row"><span class="lbl">Dernière vérification</span><span class="val">' + esc(lastChk) + '</span></div>'
    + '<div class="aide-m-row"><span class="lbl">Entrées indexées</span><span class="val">' + entriesStr + '</span></div>'
    + '</div>'
    + diffHtml
    + '<div class="aide-m-section">'
    + '<div class="aide-m-title">◎ Périmètre surveillé</div>'
    + '<div class="aide-m-row"><span class="lbl">Scripts SOC</span><span class="val"><SCRIPTS-DIR>/</span></div>'
    + '<div class="aide-m-row"><span class="lbl">Dashboard web</span><span class="val">/var/www/monitoring/</span></div>'
    + '<div class="aide-m-row"><span class="lbl">CrowdSec config</span><span class="val">/etc/crowdsec/</span></div>'
    + '<div class="aide-m-row"><span class="lbl">Firewall nftables</span><span class="val">/etc/nftables.conf</span></div>'
    + '<div class="aide-m-row"><span class="lbl">nginx, SSH, fail2ban, UFW, cron</span><span class="val">via conf.d Debian</span></div>'
    + '</div>'
    + '<div class="aide-info-box">'
    + '▸ Vérification automatique : chaque nuit à 03h00 (cron /etc/cron.d/aide-soc)<br>'
    + '▸ Rapport : /var/log/aide/aide.log — rotation hebdomadaire, 4 semaines conservées<br>'
    + '▸ Alerte mail root si différences détectées<br>'
    + '▸ Base de référence : ' + entriesStr + ' entrées — /var/lib/aide/aide.db'
    + '</div>'
    + errHtml
    + '</div>'; // aide-modal

  if(_isOpen) return;
  const _mc = document.getElementById('modal-card');
  if(_mc) _mc.classList.add('modal-wide','theme-cyan');
  const _ht = document.getElementById('modal-header-title');
  if(_ht) _ht.innerHTML = '<span style="margin-right:.45rem;opacity:.6">⬡</span>AIDE — INTÉGRITÉ FICHIERS · srv-ngix';
  _modalBody.innerHTML = h;
  _modalBody.style.fontSize = '1em';
  _overlay.classList.add('open');
  _isOpen = true;
  document.body.style.overflow = 'hidden';
}

/* ══════════════════════════════════════════════════════════════════════════
   TUILE
══════════════════════════════════════════════════════════════════════════ */
function _renderAide(d, g){
  _injectCss();
  const a = d.aide || {};
  const lbl = _statusLabel(a.status);

  const borderCol = a.status === 'OK'
    ? 'rgba(0,255,136,.25)'
    : a.status === 'ALERT'
      ? 'rgba(255,60,60,.4)'
      : 'rgba(122,154,184,.2)';

  const lastChkLine = a.last_check_ts
    ? '<span>Vér.</span> ' + esc(_fmtTs(a.last_check_ts))
      + (a.age_hours !== undefined ? ' <span>(il y a ' + esc(String(a.age_hours)) + 'h)</span>' : '')
    : '<span>Prochaine vér.</span> 03h00 (cron)';

  let countsHtml = '';
  if(a.status === 'ALERT'){
    countsHtml = '<div class="aide-counts">'
      + (a.changed ? '<span class="aide-count-item chg">~' + a.changed + ' modif</span>' : '')
      + (a.added   ? '<span class="aide-count-item add">+' + a.added   + ' ajout</span>' : '')
      + (a.removed ? '<span class="aide-count-item rem">-' + a.removed + ' supp</span>'  : '')
      + '</div>';
  } else if(a.entries_total){
    countsHtml = '<div class="aide-counts">'
      + '<span class="aide-count-item tot">'
      + a.entries_total.toLocaleString('fr-FR') + ' entrées indexées</span>'
      + '</div>';
  } else {
    countsHtml = '';
  }

  const initLine = a.db_init_ts
    ? '<span>Init.</span> ' + esc(_fmtTs(a.db_init_ts))
    : '<span>Base</span> non initialisée';

  const h = '<div class="card aide-tile" id="aide-tile" style="border-color:' + borderCol + '">'
    + '<div class="corner tl"></div><div class="corner tr"></div>'
    + '<div class="card-inner">'
    + '<div class="ct"><span class="ct-icon">⬡</span>INTÉGRITÉ FICHIERS — AID · srv-ngix'
    + '<span data-panel="RÔLE : AID (Advanced Intrusion Detection Environment) — HIDS qui surveille l intégrité des fichiers critiques sur srv-ngix. Détecte toute modification, ajout ou suppression non autorisée : une backdoor déposée, une config altérée, un binaire remplacé.\n\nMÉTRIQUES SURVEILLÉES : ~49 945 entrées dans la base de référence (baseline). Scope : configs nginx · CrowdSec · fail2ban · SSH · scripts SOC · binaires système critiques. Compteurs : fichiers modifiés · ajoutés · supprimés.\n\nCOMPORTEMENT ATTENDU : statut INTÈGRE — zéro différence entre la baseline et l état actuel. Vérification automatique chaque nuit à 03h00 via cron. Toute modification légitime (mise à jour, déploiement) doit être suivie d un re-baseline manuel.\n\nPIPELINE : cron 03h00 → aid --check → diff vs baseline → écriture résultat dans monitoring.json → dashboard SOC mis à jour au prochain cycle.\n\nJARVIS (si online) : si statut ALERTE → alerte vocale immédiate + liste des fichiers modifiés/ajoutés/supprimés intégrée au rapport. AID contribue jusqu à +15 pts au score de menace global si des changements non autorisés sont détectés.\n\nVALEUR AJOUTÉE : seul outil qui surveille le système lui-même plutôt que le trafic réseau. Détecte les compromissions post-exploit invisibles aux IDS/IPS : webshell déposé, config détournée, clé SSH ajoutée. Dernière ligne de défense contre la persistance." data-panel-title="INTÉGRITÉ FICHIERS — AID" class="soc-panel-i" style="--pi-dim:rgba(0,217,255,.45);--pi-bright:rgba(0,217,255,.9);--pi-glow:rgba(0,217,255,.5)">ⓘ</span>'
    + '</div>'
    + '<div class="aide-status-row">'
    + '<span class="aide-badge ' + lbl.cls + '">' + lbl.txt + '</span>'
    + '</div>'
    + '<div class="aide-meta">' + lastChkLine + '</div>'
    + '<div class="aide-meta">' + initLine + '</div>'
    + countsHtml
    + (a.error && a.status !== 'PENDING'
        ? '<div class="aide-meta" style="color:rgba(255,160,0,.6);margin-top:.3rem">'
          + esc(a.error) + '</div>' : '')
    + '</div></div>';

  g.insertAdjacentHTML('beforeend', h);
  const tile = document.getElementById('aide-tile');
  if(tile) tile.addEventListener('click', function(){ _openModal(a); });
}

window._renderAide = _renderAide;

})();
