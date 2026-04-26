// 19-xdr.js — XDR Modal : logigramme animé + timeline — v3.93.5 — 2026-04-25 — NDT-227
// Ouvert depuis la tuile CHAÎNE DE DÉFENSE
// Exporté : window._xdrOpenModal(d)

(function(){
'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════════════════════ */
var _ok=false;
function _css(){
  if(_ok)return;_ok=true;
  var s=document.createElement('style');
  s.textContent=[
    /* ── Modal body wrapper ── */
    '.xdr-modal{display:flex;flex-direction:column;gap:0;height:100%;overflow:hidden}',

    /* ══ LOGIGRAMME v3 — 4-stage XDR pipeline ═══════════════════════════════ */
    '.xdr-lg{display:flex;align-items:stretch;justify-content:flex-start;gap:6px;',
    'padding:14px 18px 12px;flex-shrink:0;',
    'border-bottom:1px solid rgba(0,150,255,.1);',
    'background:linear-gradient(160deg,rgba(0,5,25,.85) 0%,rgba(0,8,32,.7) 100%);',
    'position:relative;overflow-x:auto;overflow-y:visible}',
    /* dot-grid background */
    '.xdr-lg::before{content:"";position:absolute;inset:0;pointer-events:none;',
    'background-image:radial-gradient(circle,rgba(0,150,255,.05) 1px,transparent 1px);',
    'background-size:20px 20px}',

    /* ── Source nodes ── */
    '.xdr-lg-srcs{display:flex;flex-direction:column;justify-content:space-around;gap:3px;flex-shrink:0;width:180px;position:relative;z-index:1}',
    '.xdr-lg-src{display:flex;flex-direction:column;gap:1px;padding:3px 8px 3px;border-radius:4px;',
    'border:1px solid;border-left:3px solid;cursor:default;transition:box-shadow .25s,transform .15s}',
    '.xdr-lg-src:hover{transform:translateX(3px)}',
    '.xdr-lg-src-h{display:flex;align-items:center;gap:5px;margin-bottom:1px}',
    '.xdr-lg-src-ico{font-size:var(--fs-xs);flex-shrink:0;opacity:.85}',
    '.xdr-lg-src-name{font:700 9px "Courier New";letter-spacing:.07em;white-space:nowrap;flex:1}',
    '.xdr-lg-src-cnt{font:700 10px "Courier New";white-space:nowrap;padding:0 5px;border-radius:2px}',
    '.xdr-lg-src-proc{font:600 8px "Courier New";opacity:.6;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xdr-lg-src-tags{font:600 7.5px "Courier New";opacity:.38;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',

    /* ── Wires zone ── */
    '.xdr-lg-wires{width:80px;flex-shrink:0;position:relative;display:flex;flex-direction:column;justify-content:space-around;z-index:1}',
    '.xdr-lg-wire{position:relative;height:3px;border-radius:2px;overflow:hidden;',
    'background:rgba(0,150,255,.04)}',
    /* Moving dashes animation */
    '@keyframes xdr-dash{from{background-position:0 0}to{background-position:22px 0}}',
    '.xdr-lg-wire.active{height:3px}',
    '.xdr-lg-wire.f2b.active{background:repeating-linear-gradient(90deg,rgba(255,153,0,0) 0,rgba(255,153,0,0) 5px,rgba(255,153,0,.75) 5px,rgba(255,153,0,.75) 9px,rgba(255,153,0,0) 9px,rgba(255,153,0,0) 22px);background-size:22px 100%;animation:xdr-dash 0.55s linear infinite}',
    '.xdr-lg-wire.ufw.active{background:repeating-linear-gradient(90deg,rgba(64,170,255,0) 0,rgba(64,170,255,0) 5px,rgba(64,170,255,.75) 5px,rgba(64,170,255,.75) 9px,rgba(64,170,255,0) 9px,rgba(64,170,255,0) 22px);background-size:22px 100%;animation:xdr-dash 0.7s linear infinite}',
    '.xdr-lg-wire.aar.active{background:repeating-linear-gradient(90deg,rgba(200,120,255,0) 0,rgba(200,120,255,0) 5px,rgba(200,120,255,.75) 5px,rgba(200,120,255,.75) 9px,rgba(200,120,255,0) 9px,rgba(200,120,255,0) 22px);background-size:22px 100%;animation:xdr-dash 0.9s linear infinite}',
    '.xdr-lg-wire.msc.active{background:repeating-linear-gradient(90deg,rgba(255,100,100,0) 0,rgba(255,100,100,0) 5px,rgba(255,100,100,.75) 5px,rgba(255,100,100,.75) 9px,rgba(255,100,100,0) 9px,rgba(255,100,100,0) 22px);background-size:22px 100%;animation:xdr-dash 0.48s linear infinite}',
    '.xdr-lg-wire.msp.active{background:repeating-linear-gradient(90deg,rgba(255,100,100,0) 0,rgba(255,100,100,0) 5px,rgba(255,100,100,.65) 5px,rgba(255,100,100,.65) 9px,rgba(255,100,100,0) 9px,rgba(255,100,100,0) 22px);background-size:22px 100%;animation:xdr-dash 0.65s linear infinite;animation-delay:.3s}',
    '.xdr-lg-wire.sur.active{background:repeating-linear-gradient(90deg,rgba(255,240,0,0) 0,rgba(255,240,0,0) 5px,rgba(255,240,0,.8) 5px,rgba(255,240,0,.8) 9px,rgba(255,240,0,0) 9px,rgba(255,240,0,0) 22px);background-size:22px 100%;animation:xdr-dash 0.4s linear infinite}',
    '.xdr-lg-wire.abn.active{background:repeating-linear-gradient(90deg,rgba(0,255,136,0) 0,rgba(0,255,136,0) 5px,rgba(0,255,136,.8) 5px,rgba(0,255,136,.8) 9px,rgba(0,255,136,0) 9px,rgba(0,255,136,0) 22px);background-size:22px 100%;animation:xdr-dash 0.52s linear infinite}',
    '.xdr-lg-wire.ngx.active{background:repeating-linear-gradient(90deg,rgba(255,0,170,0) 0,rgba(255,0,170,0) 5px,rgba(255,0,170,.8) 5px,rgba(255,0,170,.8) 9px,rgba(255,0,170,0) 9px,rgba(255,0,170,0) 22px);background-size:22px 100%;animation:xdr-dash 0.38s linear infinite}',
    '.xdr-lg-wire.aid.active{background:repeating-linear-gradient(90deg,rgba(0,200,255,0) 0,rgba(0,200,255,0) 5px,rgba(0,200,255,.8) 5px,rgba(0,200,255,.8) 9px,rgba(0,200,255,0) 9px,rgba(0,200,255,0) 22px);background-size:22px 100%;animation:xdr-dash 0.6s linear infinite}',
    '.xdr-lg-wire.rtr.active{background:repeating-linear-gradient(90deg,rgba(0,188,212,0) 0,rgba(0,188,212,0) 5px,rgba(0,188,212,.78) 5px,rgba(0,188,212,.78) 9px,rgba(0,188,212,0) 9px,rgba(0,188,212,0) 22px);background-size:22px 100%;animation:xdr-dash 0.72s linear infinite}',
    '.xdr-lg-wire.vlm.active{background:repeating-linear-gradient(90deg,rgba(255,179,0,0) 0,rgba(255,179,0,0) 5px,rgba(255,179,0,.78) 5px,rgba(255,179,0,.78) 9px,rgba(255,179,0,0) 9px,rgba(255,179,0,0) 22px);background-size:22px 100%;animation:xdr-dash 0.58s linear infinite}',
    /* arrowhead on right of wire */
    '.xdr-lg-wire::after{content:"▶";position:absolute;right:-1px;top:-4px;font-size:calc(var(--fs-xs) - 2px);opacity:.3;pointer-events:none}',
    '.xdr-lg-wire.active::after{opacity:.8}',
    '.xdr-lg-wire.f2b.active::after{color:#f90}',
    '.xdr-lg-wire.ufw.active::after{color:#4af}',
    '.xdr-lg-wire.aar.active::after{color:#c7f}',
    '.xdr-lg-wire.msc.active::after,.xdr-lg-wire.msp.active::after{color:#f77}',
    '.xdr-lg-wire.sur.active::after{color:#ff4}',
    '.xdr-lg-wire.abn.active::after{color:#0f8}',
    '.xdr-lg-wire.ngx.active::after{color:#f0a}',
    '.xdr-lg-wire.aid.active::after{color:#0cf}',
    '.xdr-lg-wire.rtr.active::after{color:#0bd}',
    '.xdr-lg-wire.vlm.active::after{color:#fb0}',

    /* ── Engine ── */
    '.xdr-lg-eng{flex-shrink:0;width:164px;display:flex;flex-direction:column;align-items:center;',
    'justify-content:center;gap:3px;padding:12px 14px;border-radius:6px;',
    'border:1px solid rgba(0,170,255,.45);background:linear-gradient(160deg,rgba(0,12,45,.95),rgba(0,20,60,.85));',
    'position:relative;align-self:center;z-index:1;',
    'box-shadow:0 0 24px rgba(0,150,255,.15),inset 0 0 30px rgba(0,150,255,.04)}',
    /* circuit lines decoration */
    '.xdr-lg-eng::before{content:"";position:absolute;inset:-5px;border-radius:9px;',
    'border:1px solid rgba(0,170,255,.12);animation:xdr-ring 3s ease-in-out infinite;pointer-events:none}',
    '.xdr-lg-eng::after{content:"";position:absolute;inset:0;border-radius:6px;',
    'background-image:linear-gradient(rgba(0,150,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,150,255,.03) 1px,transparent 1px);',
    'background-size:12px 12px;pointer-events:none}',
    '@keyframes xdr-ring{0%,100%{box-shadow:0 0 0 0 rgba(0,170,255,0),0 0 14px rgba(0,170,255,.12)}',
    '50%{box-shadow:0 0 0 5px rgba(0,170,255,.06),0 0 32px rgba(0,170,255,.28)}}',
    /* radar */
    '.xdr-lg-eng-radar{width:52px;height:52px;border-radius:50%;flex-shrink:0;position:relative;margin-bottom:4px;',
    'border:1px solid rgba(0,200,255,.2);background:radial-gradient(circle,rgba(0,150,255,.08),transparent 70%)}',
    '.xdr-lg-eng-radar::before{content:"";position:absolute;inset:5px;border-radius:50%;',
    'border:1px solid rgba(0,200,255,.1)}',
    '.xdr-lg-eng-radar::after{content:"";position:absolute;top:50%;left:50%;width:48%;height:1.5px;',
    'background:linear-gradient(90deg,rgba(0,220,255,.95),rgba(0,220,255,0));',
    'transform-origin:0 50%;animation:xdr-sweep 1.8s linear infinite;filter:blur(.3px)}',
    '@keyframes xdr-sweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
    '.xdr-lg-eng-cross{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);',
    'font:700 11px "Courier New";color:rgba(0,220,255,.6);z-index:1}',
    '.xdr-lg-eng-badge{font:700 7px "Courier New";color:rgba(0,200,255,.5);letter-spacing:.18em;',
    'background:rgba(0,150,255,.08);border:1px solid rgba(0,150,255,.2);border-radius:2px;padding:1px 6px}',
    '.xdr-lg-eng-title{font:700 11px "Courier New";color:rgba(0,220,255,.95);letter-spacing:.08em}',
    '.xdr-lg-eng-tot{font:700 26px "Courier New";color:#0cf;line-height:1.1;',
    'text-shadow:0 0 16px rgba(0,200,255,.6),0 0 30px rgba(0,200,255,.25)}',
    '.xdr-lg-eng-sub{font:600 7.5px "Courier New";color:rgba(0,200,255,.35);letter-spacing:.07em}',
    '.xdr-lg-eng-divider{width:80%;height:1px;background:rgba(0,170,255,.15);margin:3px 0}',
    '.xdr-lg-eng-row{display:flex;gap:8px;align-items:center}',
    '.xdr-lg-eng-stat{font:600 8px "Courier New";color:rgba(0,200,255,.45);white-space:nowrap}',
    '.xdr-lg-eng-stat b{color:rgba(0,220,255,.8);font-weight:700}',
    '.xdr-lg-eng-corr{font:700 8px "Courier New";color:rgba(255,80,80,.9);margin-top:3px;',
    'background:rgba(255,40,40,.1);border:1px solid rgba(255,60,60,.3);border-radius:3px;padding:2px 9px;',
    'box-shadow:0 0 8px rgba(255,60,60,.15)}',
    '.xdr-lg-eng-ok{font:700 8px "Courier New";color:rgba(0,255,136,.7);margin-top:3px;',
    'background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.22);border-radius:3px;padding:2px 9px}',

    /* ── Output wires ── */
    '.xdr-lg-out-wires{flex-shrink:0;width:28px;display:flex;flex-direction:column;',
    'justify-content:space-around;align-self:center;gap:0;z-index:1}',
    '.xdr-lg-ow{height:1px;background:linear-gradient(90deg,rgba(0,170,255,.3),rgba(0,170,255,.1));position:relative}',
    '.xdr-lg-ow::after{content:"▶";position:absolute;right:-7px;top:-5px;font-size:calc(var(--fs-xs) - 3px);color:rgba(0,170,255,.5)}',

    /* ── Outputs ── */
    '.xdr-lg-outs{display:flex;flex-direction:column;justify-content:space-around;gap:3px;flex-shrink:0;width:130px;align-self:center;z-index:1}',
    '.xdr-lg-out{padding:5px 10px;border-radius:4px;border:1px solid rgba(0,170,255,.15);',
    'background:linear-gradient(135deg,rgba(0,15,50,.7),rgba(0,20,60,.5));transition:all .2s;',
    'border-left:3px solid rgba(0,170,255,.35)}',
    '.xdr-lg-out:hover{box-shadow:0 0 12px rgba(0,170,255,.18);border-left-color:rgba(0,200,255,.65)}',
    '.xdr-lg-out-head{display:flex;align-items:center;gap:5px;margin-bottom:2px}',
    '.xdr-lg-out-ico{font-size:calc(var(--fs-xs) - 1px);opacity:.75}',
    '.xdr-lg-out-lbl{font:700 8px "Courier New";color:rgba(0,200,255,.6);letter-spacing:.07em}',
    '.xdr-lg-out-val{font:700 13px "Courier New";color:rgba(0,220,255,.95);',
    'text-shadow:0 0 8px rgba(0,200,255,.3)}',
    '.xdr-lg-out-sub{font:600 7px "Courier New";color:rgba(0,200,255,.28);margin-top:1px}',
    /* JARVIS output special styling */
    '.xdr-lg-out-jarvis-on{border-left-color:rgba(0,255,136,.5)!important;',
    'background:linear-gradient(135deg,rgba(0,20,15,.8),rgba(0,255,136,.04))!important}',
    '.xdr-lg-out-jarvis-on .xdr-lg-out-lbl{color:rgba(0,255,136,.75)!important}',
    '.xdr-lg-out-jarvis-on .xdr-lg-out-val{color:rgba(0,255,136,.95)!important;text-shadow:0 0 8px rgba(0,255,136,.3)!important}',
    '.xdr-lg-out-jarvis-off{opacity:.4;border-left-color:rgba(100,120,140,.3)!important}',
    /* source activity bar */
    '.xdr-lg-src-bar{height:2px;border-radius:1px;margin-top:3px;transition:width .6s ease}',
    /* source top-type chip */
    '.xdr-lg-src-top{font:700 7.5px "Courier New";opacity:.55;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    /* engine threat level */
    '.xdr-lg-eng-threat{font:700 8px "Courier New";padding:1px 8px;border-radius:2px;margin-top:2px;letter-spacing:.1em}',
    /* output IP list */
    '.xdr-lg-out-ip{font:600 7.5px "Courier New";color:rgba(0,200,255,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}',
    '.xdr-lg-out-ip b{color:rgba(0,220,255,.75)}',
    '.xdr-lg-out-ip.ms{color:rgba(255,100,50,.55)}',
    '.xdr-lg-out-ip.ms b{color:rgba(255,130,60,.85)}',

    /* ── Pipeline stage columns ── */
    '.xdr-pipe-col{display:flex;flex-direction:column;gap:3px;position:relative;z-index:1;flex-shrink:0;align-self:stretch}',
    '.xdr-pipe-col.collect{display:grid;grid-template-columns:repeat(2,1fr);gap:3px;width:300px;flex:0 0 300px;align-content:start;overflow:hidden;min-width:0}',
    '.xdr-pipe-col.collect .xdr-lg-src{min-width:0;overflow:hidden}',
    '.xdr-pipe-col.collect .xdr-pipe-lbl{grid-column:1/-1}',
    '.xdr-pipe-col.normalize{width:185px;justify-content:space-evenly}',
    '.xdr-pipe-col.correlate{width:158px;align-items:center;justify-content:center}',
    '.xdr-pipe-col.respond{width:185px;justify-content:space-evenly}',
    '.xdr-pipe-lbl{font:700 7px "Courier New";letter-spacing:.22em;text-align:center;',
    'padding:0 0 5px;text-transform:uppercase;border-bottom:1px solid;margin-bottom:4px;opacity:.7}',
    /* arrow connectors */
    '.xdr-pipe-arr{display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'width:20px;flex-shrink:0;align-self:stretch;position:relative}',
    '.xdr-pipe-arr::before{content:"";position:absolute;top:0;bottom:0;left:50%;width:1px;transform:translateX(-50%);',
    'background:linear-gradient(180deg,transparent 0%,rgba(0,170,255,.15) 20%,rgba(0,170,255,.15) 80%,transparent 100%)}',
    '.xdr-pipe-arr span{font:700 11px monospace;color:rgba(0,170,255,.45);',
    'animation:xdr-arr-p 2s ease-in-out infinite;display:block;position:relative;z-index:1;',
    'background:rgba(0,5,20,.8);padding:2px 0}',
    '@keyframes xdr-arr-p{0%,100%{opacity:.2;transform:translateX(-2px)}50%{opacity:.8;transform:translateX(2px)}}',
    /* normalize nodes */
    '.xdr-norm{padding:5px 9px 6px;border-radius:4px;border:1px solid rgba(0,170,255,.12);',
    'background:rgba(0,8,35,.7);transition:box-shadow .2s}',
    '.xdr-norm-h{display:flex;align-items:center;gap:4px;margin-bottom:2px}',
    '.xdr-norm-ico{font-size:calc(var(--fs-xs) - 1px);flex-shrink:0}',
    '.xdr-norm-lbl{font:700 8px "Courier New";flex:1;white-space:nowrap;letter-spacing:.04em}',
    '.xdr-norm-bdg{font:700 7px "Courier New";padding:1px 4px;border-radius:2px;white-space:nowrap;flex-shrink:0}',
    '.xdr-norm-sub{font:600 7px "Courier New";color:rgba(180,200,220,.28);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xdr-norm-val{font:700 8.5px "Courier New";margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    /* respond nodes */
    '.xdr-resp{padding:5px 9px 6px;border-radius:4px;border:1px solid rgba(0,170,255,.1);',
    'background:rgba(0,6,32,.7);border-left:3px solid rgba(0,150,255,.2);transition:all .2s}',
    '.xdr-resp.on{border-left-color:rgba(0,255,136,.5);background:rgba(0,16,10,.78);',
    'box-shadow:0 0 8px rgba(0,255,136,.06)}',
    '.xdr-resp.warn{border-left-color:rgba(255,130,60,.55);background:rgba(25,6,0,.72);',
    'box-shadow:0 0 8px rgba(255,100,30,.07)}',
    '.xdr-resp.off{opacity:.32;border-left-color:rgba(100,120,140,.2)}',
    '.xdr-resp-h{display:flex;align-items:center;gap:4px;margin-bottom:2px}',
    '.xdr-resp-ico{font-size:calc(var(--fs-xs) - 1px);flex-shrink:0}',
    '.xdr-resp-lbl{font:700 8px "Courier New";color:rgba(0,200,255,.65);flex:1;white-space:nowrap;letter-spacing:.04em}',
    '.xdr-resp-bdg{font:700 7px "Courier New";padding:1px 4px;border-radius:2px;white-space:nowrap;flex-shrink:0}',
    '.xdr-resp-bdg.on{color:rgba(0,255,136,.95);background:rgba(0,255,136,.12);border:1px solid rgba(0,255,136,.28)}',
    '.xdr-resp-bdg.off{color:rgba(150,160,180,.4);background:transparent;border:1px solid rgba(150,160,180,.1)}',
    '.xdr-resp-bdg.warn{color:rgba(255,140,60,.95);background:rgba(255,80,30,.09);border:1px solid rgba(255,90,30,.3)}',
    '.xdr-resp-sub{font:600 7px "Courier New";color:rgba(0,150,200,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xdr-resp-val{font:700 8.5px "Courier New";color:rgba(0,200,255,.6);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    /* JARVIS SOAR node within respond */
    '.xdr-resp.jarvis-on{border-left-color:rgba(0,255,136,.65)!important;background:rgba(0,22,14,.85)!important;',
    'box-shadow:0 0 10px rgba(0,255,136,.08)!important}',
    '.xdr-resp.jarvis-on .xdr-resp-lbl{color:rgba(0,255,136,.85)!important}',
    '.xdr-resp.jarvis-on .xdr-resp-val{color:rgba(0,255,136,.65)!important}',

    /* ══ CONTROLS — barre unifiée 2 lignes ════════════════════════════════ */
    /* conteneur global */
    '.xdr-bar{padding:7px 14px 6px;flex-shrink:0;',
    'border-bottom:1px solid rgba(0,255,136,.06);background:rgba(0,3,12,.55)}',
    /* ligne 1 : sources | séparateur | sévérité | spacer | EVT counter */
    '.xdr-bar-r1{display:flex;align-items:center;gap:5px;margin-bottom:5px;flex-wrap:wrap}',
    /* ligne 2 : search + clear */
    '.xdr-bar-r2{display:flex;align-items:center;gap:6px}',
    /* petite étiquette de section */
    '.xdr-bar-lbl{font:700 7px "Courier New";letter-spacing:.18em;color:rgba(0,200,255,.28);',
    'white-space:nowrap;flex-shrink:0;padding-right:2px;text-transform:uppercase}',
    /* séparateur vertical entre SOURCES et SÉVÉRITÉ */
    '.xdr-bar-sep{width:1px;align-self:stretch;background:rgba(0,170,255,.14);flex-shrink:0;margin:0 5px}',
    /* push EVT pill to the right */
    '.xdr-bar-spc{flex:1;min-width:6px}',
    /* EVT counter pill */
    '.xdr-ev-pill{font:700 8px "Courier New";padding:2px 9px;border-radius:3px;',
    'border:1px solid rgba(0,255,136,.18);background:rgba(0,255,136,.04);',
    'color:rgba(0,255,136,.45);white-space:nowrap;flex-shrink:0}',
    '.xdr-ev-pill b{color:rgba(0,255,136,.8);font-weight:700}',
    /* chips sources */
    '.xdr-chips{display:flex;gap:4px;flex-wrap:wrap}',
    '.xdr-chip{font:700 8px "Courier New";padding:2px 7px;border-radius:3px;border:1px solid;cursor:pointer;',
    'transition:all .12s;letter-spacing:.05em;line-height:1.5}',
    '.xdr-chip.off{opacity:.22;background:transparent!important}',
    '.xdr-chip[data-f="fail2ban"]{color:#f90;border-color:rgba(255,153,0,.3);background:rgba(255,153,0,.07)}',
    '.xdr-chip[data-f="ufw"]{color:#4af;border-color:rgba(64,170,255,.3);background:rgba(64,170,255,.07)}',
    '.xdr-chip[data-f="apparmor"]{color:#c7f;border-color:rgba(200,120,255,.3);background:rgba(200,120,255,.07)}',
    '.xdr-chip[data-f="modsec"]{color:#f77;border-color:rgba(255,100,100,.3);background:rgba(255,100,100,.07)}',
    '.xdr-chip[data-f="autoban"]{color:#0f8;border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.07)}',
    '.xdr-chip[data-f="suricata"]{color:#ff4;border-color:rgba(255,240,0,.3);background:rgba(255,240,0,.07)}',
    '.xdr-chip[data-f="nginx_drop"]{color:#f0a;border-color:rgba(255,0,170,.3);background:rgba(255,0,170,.07)}',
    '.xdr-chip[data-f="aid"]{color:#0cf;border-color:rgba(0,200,255,.3);background:rgba(0,200,255,.07)}',
    /* sev pills — même hauteur que chips */
    '.xdr-sevs{display:flex;gap:4px}',
    '.xdr-sev{font:700 8px "Courier New";padding:2px 8px;border-radius:3px;border:1px solid;',
    'cursor:pointer;transition:all .15s;line-height:1.5}',
    '.xdr-sev.off{opacity:.22}',
    '.xdr-sev[data-s="1"]{color:rgba(0,200,255,.8);border-color:rgba(0,200,255,.25);background:rgba(0,200,255,.06)}',
    '.xdr-sev[data-s="2"]{color:rgba(255,200,0,.85);border-color:rgba(255,200,0,.28);background:rgba(255,200,0,.06)}',
    '.xdr-sev[data-s="3"]{color:rgba(255,100,50,.9);border-color:rgba(255,100,50,.32);background:rgba(255,100,50,.07)}',
    '.xdr-sev[data-s="4"]{color:rgba(255,40,100,1);border-color:rgba(255,40,100,.42);background:rgba(255,40,100,.09)}',
    /* search input */
    '.xdr-inp{flex:1;background:rgba(0,0,0,.4);border:1px solid rgba(0,255,136,.15);border-radius:4px;',
    'color:rgba(0,255,136,.85);font:11px "Courier New";padding:5px 10px;outline:none;transition:border-color .2s}',
    '.xdr-inp:focus{border-color:rgba(0,255,136,.45)}',
    '.xdr-inp::placeholder{color:rgba(0,255,136,.18)}',
    /* clear button */
    '.xdr-clr{background:transparent;border:1px solid rgba(255,80,80,.18);border-radius:4px;',
    'color:rgba(255,80,80,.45);font:700 9px "Courier New";padding:5px 11px;cursor:pointer;',
    'transition:all .15s;white-space:nowrap;letter-spacing:.08em;flex-shrink:0}',
    '.xdr-clr:hover{border-color:rgba(255,80,80,.5);color:#f55;background:rgba(255,40,40,.05)}',

    /* ══ BODY : IPs + TIMELINE ════════════════════════════════════════════ */
    '.xdr-body{display:flex;flex:1;overflow:hidden;min-height:0}',
    /* IPs panel */
    '.xdr-ips{width:144px;flex-shrink:0;border-right:1px solid rgba(0,255,136,.07);',
    'overflow-y:auto;padding:4px 0}',
    '.xdr-ips::-webkit-scrollbar{width:3px}',
    '.xdr-ips::-webkit-scrollbar-thumb{background:rgba(0,255,136,.15);border-radius:2px}',
    '.xdr-ip-hdr{font:700 8px "Courier New";color:rgba(0,255,136,.3);padding:3px 10px 5px;letter-spacing:.08em}',
    '.xdr-ipr{display:flex;flex-direction:column;gap:1px;padding:4px 10px;cursor:pointer;',
    'border-left:2px solid transparent;transition:all .12s}',
    '.xdr-ipr:hover,.xdr-ipr.sel{background:rgba(0,255,136,.04);border-left-color:rgba(0,255,136,.4)}',
    '.xdr-ipr-ip{font:600 10px "Courier New";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xdr-ipr-meta{display:flex;gap:4px;align-items:center}',
    '.xdr-ipr-cnt{font:600 9px "Courier New";color:rgba(0,255,136,.45)}',
    '.xdr-ipr-ms{font:700 8px "Courier New";padding:0 4px;border-radius:2px;',
    'border:1px solid rgba(255,60,60,.35);background:rgba(255,60,60,.07);color:rgba(255,100,80,.9)}',
    '.xdr-ipr-dots{display:flex;gap:3px;margin-top:2px;flex-wrap:wrap}',
    '.xdr-ipr-dot{width:5px;height:5px;border-radius:50%}',
    /* Timeline */
    '.xdr-tl{flex:1;overflow-y:auto;min-width:0}',
    '.xdr-tl::-webkit-scrollbar{width:4px}',
    '.xdr-tl::-webkit-scrollbar-thumb{background:rgba(0,255,136,.18);border-radius:2px}',
    '.xdr-row{display:grid;grid-template-columns:66px 118px 62px 1fr auto;gap:0 6px;',
    'align-items:center;padding:4px 10px 4px 6px;border-left:3px solid transparent;transition:background .1s}',
    '.xdr-row:hover{background:rgba(0,255,136,.03)}',
    '.xdr-row.hl{background:rgba(0,255,136,.055)!important}',
    '.xdr-ts{font:10px "Courier New";color:rgba(0,255,136,.3);white-space:nowrap}',
    '.xdr-rip{font:600 10px "Courier New";white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xdr-rip.ni{color:rgba(255,255,255,.2);font-weight:400}',
    '.xdr-tag{font:700 8px "Courier New";padding:1px 4px;border-radius:2px;border:1px solid;text-align:center;white-space:nowrap}',
    '.xdr-det{font:10px "Courier New";color:rgba(255,255,255,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.xdr-corr{font:700 8px "Courier New";padding:1px 5px;border-radius:2px;',
    'background:rgba(255,40,40,.1);border:1px solid rgba(255,60,60,.3);color:rgba(255,100,80,.9);white-space:nowrap;flex-shrink:0}',
    '.xdr-s1{border-left-color:rgba(0,200,255,.35)}',
    '.xdr-s2{border-left-color:rgba(255,200,0,.4)}',
    '.xdr-s3{border-left-color:rgba(255,100,50,.55)}',
    '.xdr-s4{border-left-color:rgba(255,40,100,.75)}',
    '.xdr-tsep{font:700 8px "Courier New";color:rgba(0,255,136,.2);letter-spacing:.08em;',
    'padding:5px 10px 2px;background:rgba(0,255,136,.015);border-top:1px solid rgba(0,255,136,.05);',
    'border-bottom:1px solid rgba(0,255,136,.04)}',
    '.xdr-empty{font:11px "Courier New";color:rgba(0,255,136,.18);text-align:center;padding:24px 0}',

    /* ── JARVIS offline popup ── */
    '.xdr-joff-wrap{position:relative;cursor:pointer}',
    '.xdr-joff-wrap:hover .xdr-lg-out{border-left-color:rgba(0,200,255,.35)!important;opacity:.65!important}',
    '.xdr-joff-badge{position:absolute;top:4px;right:5px;width:13px;height:13px;border-radius:50%;',
    'background:rgba(0,200,255,.12);border:1px solid rgba(0,200,255,.35);',
    'font:700 8px "Courier New";color:rgba(0,200,255,.8);display:flex;align-items:center;',
    'justify-content:center;line-height:1;z-index:2}',
    '.xdr-jpop{display:none;position:absolute;left:0;top:calc(100% + 5px);z-index:999;',
    'width:230px;padding:11px 13px 12px;border-radius:6px;',
    'background:linear-gradient(160deg,rgba(0,8,30,.97) 0%,rgba(0,12,45,.97) 100%);',
    'border:1px solid rgba(0,200,255,.3);',
    'box-shadow:0 8px 32px rgba(0,0,0,.55),0 0 0 1px rgba(0,200,255,.06);pointer-events:none}',
    '.xdr-jpop.open{display:block;animation:xdr-jpop-in .15s ease-out both}',
    '@keyframes xdr-jpop-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}',
    '.xdr-jpop-ttl{font:700 8px "Courier New";color:rgba(0,200,255,.9);letter-spacing:.12em;margin-bottom:7px;',
    'padding-bottom:5px;border-bottom:1px solid rgba(0,200,255,.12)}',
    '.xdr-jpop-row{display:flex;gap:6px;align-items:flex-start;margin-bottom:5px}',
    '.xdr-jpop-ico{font-size:calc(var(--fs-xs) - 2px);opacity:.6;flex-shrink:0;margin-top:1px}',
    '.xdr-jpop-txt{font:10px "Courier New";color:rgba(200,220,255,.6);line-height:1.45}',
    '.xdr-jpop-link{display:block;margin-top:8px;text-align:center;padding:4px 0;',
    'border-radius:3px;border:1px solid rgba(0,255,136,.25);background:rgba(0,255,136,.06);',
    'font:700 9px "Courier New";color:rgba(0,255,136,.8);letter-spacing:.07em;pointer-events:auto;',
    'text-decoration:none;transition:all .15s}',
    '.xdr-jpop-link:hover{background:rgba(0,255,136,.12);border-color:rgba(0,255,136,.5);color:rgba(0,255,136,1)}',
  ].join('');
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════════════════
   SOURCE DEFINITIONS
══════════════════════════════════════════════════════════════════════════ */
var _SRCS = [
  /* paire 1 — fail2ban */
  {id:'f2b', fam:'fail2ban', lbl:'FAIL2BAN',   ico:'🔒', col:'#f90', bc:'rgba(255,153,0,.25)', bg:'rgba(255,153,0,.06)', wc:'f2b',
   proc:'Bans actifs · jail multi-services', tags:'ssh · http-auth · botsearch · nginx-cve'},
  {id:'vlm', fam:'vmf2b',     lbl:'F2B VMs',    ico:'⊛', col:'#ffb300', bc:'rgba(255,179,0,.25)', bg:'rgba(255,179,0,.06)', wc:'vlm',
   proc:'Fail2ban clt · fail2ban pa85', tags:'bans · ssh · apache · bruteforce'},
  /* paire 2 — WAF */
  {id:'msc', fam:'modsec',   lbl:'MODSEC/CLT',  ico:'⚔', col:'#f77', bc:'rgba(255,100,100,.25)',bg:'rgba(255,100,100,.06)',wc:'msc',
   proc:'WAF Layer-7 · OWASP CRS', tags:'SQLi · XSS · LFI · RCE · CVE patch'},
  {id:'msp', fam:'modsec',   lbl:'MODSEC/PA85', ico:'⚔', col:'#f77', bc:'rgba(255,100,100,.25)',bg:'rgba(255,100,100,.06)',wc:'msp',
   proc:'WAF Layer-7 · OWASP CRS', tags:'SQLi · XSS · LFI · RCE · CVE patch'},
  /* paire 3 — réseau\/système */
  {id:'ufw', fam:'ufw',      lbl:'UFW',         ico:'🛡', col:'#4af', bc:'rgba(64,170,255,.25)',bg:'rgba(64,170,255,.06)',wc:'ufw',
   proc:'Firewall L4 · drop stateless', tags:'TCP · UDP · port scan · flood'},
  {id:'aar', fam:'apparmor', lbl:'APPARMOR',    ico:'⬡', col:'#c7f', bc:'rgba(200,120,255,.25)',bg:'rgba(200,120,255,.06)',wc:'aar',
   proc:'MAC confinement · DENIED ops', tags:'file · network · exec · capability'},
  /* paire 4 — détection */
  {id:'sur', fam:'suricata', lbl:'SURICATA IDS', ico:'◈', col:'#ff4', bc:'rgba(255,240,0,.25)', bg:'rgba(255,240,0,.06)', wc:'sur',
   proc:'IDS réseau · 90k signatures', tags:'Sev1-CRIT · Sev2-HIGH · C2 · exploit'},
  {id:'ngx', fam:'nginx_drop', lbl:'NGX DROP',  ico:'⛔', col:'#f0a', bc:'rgba(255,0,170,.25)', bg:'rgba(255,0,170,.06)', wc:'ngx',
   proc:'nginx return 444 · TCP drop silent', tags:'CVE-2024-4577 · PHP-RCE · RFI · path-traversal'},
  /* paire 5 — réponse autonome */
  {id:'abn', fam:'autoban',  lbl:'AUTOBAN',      ico:'⬢', col:'#0f8', bc:'rgba(0,255,136,.25)', bg:'rgba(0,255,136,.06)', wc:'abn',
   proc:'Réponse auto cron/5 min', tags:'R1-EXPLOIT · R2-FREQ · R3-HONEY · R4-BRUTE'},
  {id:'aid', fam:'aid',        lbl:'AID HIDS',   ico:'◉', col:'#0cf', bc:'rgba(0,200,255,.25)', bg:'rgba(0,200,255,.06)', wc:'aid',
   proc:'Intégrité fichiers · diff HIDS', tags:'modified · added · removed · baseline'},
  /* paire 6 — cross-host rsyslog */
  {id:'rtr', fam:'router',    lbl:'ROUTEUR GT-BE98', ico:'⊙', col:'#00bcd4', bc:'rgba(0,188,212,.25)', bg:'rgba(0,188,212,.06)', wc:'rtr',
   proc:'Logs syslog routeur · DST sortants', tags:'kernel · firewall · C2 · conntrack'},
  {id:'ap', fam:'apache', lbl:'APACHE VMs', ico:'⊚', col:'#80deea', bc:'rgba(128,222,234,.25)', bg:'rgba(128,222,234,.06)', wc:'ap',
   proc:'Apache clt · Apache pa85 · rsyslog', tags:'errors ≥5 · 4xx · SCAN · bruteforce'},
];
var _FAM_SRC = {'fail2ban':'f2b','ufw':'ufw','apparmor':'aar','modsec_clt':'msc','modsec_pa85':'msp','suricata':'sur','autoban':'abn','nginx_drop':'ngx','aide':'aid','router':'rtr','vmf2b':'vlm','apache':'ap'};
var _FAM_C   = {fail2ban:'#f90',ufw:'#4af',apparmor:'#c7f',modsec:'#f77',autoban:'#0f8',suricata:'#ff4',nginx_drop:'#f0a',aid:'#0cf',router:'#0bd',vmf2b:'#fb0',apache:'#80deea'};

function _ss(src){
  var m={
    fail2ban:   {c:'#f90',  bc:'rgba(255,153,0,.3)', bg:'rgba(255,153,0,.08)',  lbl:'F2B'},
    ufw:        {c:'#4af',  bc:'rgba(64,170,255,.3)',bg:'rgba(64,170,255,.08)', lbl:'UFW'},
    apparmor:   {c:'#c7f',  bc:'rgba(200,120,255,.3)',bg:'rgba(200,120,255,.08)',lbl:'AAR'},
    modsec_clt: {c:'#f77',  bc:'rgba(255,100,100,.3)',bg:'rgba(255,100,100,.08)',lbl:'MODSEC'},
    modsec_pa85:{c:'#f77',  bc:'rgba(255,100,100,.3)',bg:'rgba(255,100,100,.08)',lbl:'MODSEC'},
    autoban:    {c:'#0f8',  bc:'rgba(0,255,136,.3)', bg:'rgba(0,255,136,.08)', lbl:'AUTOBAN'},
    suricata:   {c:'#ff4',  bc:'rgba(255,240,0,.3)', bg:'rgba(255,240,0,.08)', lbl:'SURICATA'},
    nginx_drop: {c:'#f0a',  bc:'rgba(255,0,170,.3)', bg:'rgba(255,0,170,.08)', lbl:'NGX DROP'},
    aid:        {c:'#0cf',  bc:'rgba(0,200,255,.3)', bg:'rgba(0,200,255,.08)', lbl:'AID'},
    router:     {c:'#0bd',  bc:'rgba(0,188,212,.3)', bg:'rgba(0,188,212,.08)', lbl:'RTR'},
    vmf2b:      {c:'#fb0',  bc:'rgba(255,179,0,.3)', bg:'rgba(255,179,0,.08)', lbl:'F2B-VM'},
    apache:     {c:'#80deea',bc:'rgba(128,222,234,.3)',bg:'rgba(128,222,234,.08)',lbl:'APACHE'},
  };
  return m[src]||{c:'rgba(200,200,200,.7)',bc:'rgba(200,200,200,.2)',bg:'rgba(200,200,200,.05)',lbl:(src||'').slice(0,5).toUpperCase()};
}
function _fam(src){
  if(src==='fail2ban')  return 'fail2ban';
  if(src==='ufw')       return 'ufw';
  if(src==='apparmor')  return 'apparmor';
  if(src==='modsec_clt'||src==='modsec_pa85') return 'modsec';
  if(src==='autoban')   return 'autoban';
  if(src==='suricata')  return 'suricata';
  if(src==='nginx_drop') return 'nginx_drop';
  if(src==='aide')       return 'aid';
  if(src==='router')     return 'router';
  if(src==='vmf2b')      return 'vmf2b';
  if(src==='apache')     return 'apache';
  return 'other';
}
function _tsH(ts){var m=ts&&ts.match(/T(\d{2}:\d{2}:\d{2})/);return m?m[1]:ts?esc(ts.slice(0,10)):'—';}
function _tsHour(ts){var m=ts&&ts.match(/T(\d{2}):/);return m?m[1]+'h':'?';}

/* ══════════════════════════════════════════════════════════════════════════
   BUILD EVENTS
══════════════════════════════════════════════════════════════════════════ */
function _build(d){
  var ev=[];
  var raw=(d.xdr_events&&Array.isArray(d.xdr_events))?d.xdr_events:[];
  for(var i=0;i<raw.length;i++){
    var e=raw[i];ev.push({ts:e.ts||'',ip:e.ip||'',src:e.src||'',type:e.type||'',detail:e.detail||'',sev:e.sev||1});
  }
  var abl=(d.autoban_log&&Array.isArray(d.autoban_log))?d.autoban_log:[];
  for(var j=0;j<abl.length;j++){
    var ab=abl[j];if(!ab||!ab.ip)continue;
    var det='AUTOBAN';if(ab.rule)det+=' R'+ab.rule;if(ab.recid)det+=' · RÉCIDIVE';
    ev.push({ts:ab.ts||'',ip:ab.ip,src:'autoban',type:ab.recid?'AUTOBAN_RECIDIVE':'AUTOBAN',detail:det,sev:ab.recid?4:3});
  }
  var sur=(d.suricata&&Array.isArray(d.suricata.recent_critical))?d.suricata.recent_critical:[];
  for(var k=0;k<sur.length;k++){
    var sc=sur[k];if(!sc)continue;
    ev.push({ts:sc.ts||sc.timestamp||'',ip:sc.src_ip||sc.ip||'',src:'suricata',type:'ALERT',
      detail:(sc.signature||sc.sig||'IDS ALERT')+(sc.category?' ['+sc.category+']':''),sev:sc.severity===1?4:3});
  }
  // AIDE integrity alerts
  var aid=d.aide||{};
  if(aid.status==='ALERT'){
    var aFiles=(aid.changed_files||[]).slice(0,5);
    if(aFiles.length){
      aFiles.forEach(function(f){
        ev.push({ts:aid.last_check_ts||'',ip:'',src:'aide',type:'FILE_MODIFIED',
          detail:'AIDE: '+f,sev:3});
      });
    } else {
      ev.push({ts:aid.last_check_ts||'',ip:'',src:'aide',type:'INTEGRITY_ALERT',
        detail:'AIDE: '+(aid.changed||0)+' mod · '+(aid.added||0)+' add · '+(aid.removed||0)+' del',sev:4});
    }
  }
  // Router GT-BE98 — DST sortants vers IPs de la kill chain (signal C2)
  var _xh=d.xhosts||{};
  var _kcIpSet={};(d.kill_chain&&d.kill_chain.active_ips||[]).forEach(function(x){_kcIpSet[x.ip]=true;});
  Object.keys(_xh.router_dst||{}).forEach(function(ip){
    var cnt=(_xh.router_dst||{})[ip];
    var inKc=!!_kcIpSet[ip];
    ev.push({ts:'',ip:ip,src:'router',type:inKc?'C2_OUTBOUND':'OUTBOUND',
      detail:'RTR DST ×'+(cnt||1)+(inKc?' — ⚠ C2 sortant':''),sev:inKc?4:2});
  });
  // VM Fail2ban (clt + pa85) via rsyslog syslog
  ['clt','pa85'].forEach(function(host){
    ((_xh.f2b_bans||{})[host]||[]).forEach(function(ban){
      if(!ban.ip) return;
      ev.push({ts:ban.ts||'',ip:ban.ip,src:'vmf2b',type:'BAN',
        detail:'F2B '+host.toUpperCase()+' \u00b7 '+(ban.jail||'jail'),sev:3});
    });
  });
  Object.keys(_xh.apache_hits||{}).forEach(function(ip){
    var meta=(_xh.apache_hits||{})[ip];
    if(!meta||meta.errors<5) return;
    ev.push({ts:'',ip:ip,src:'apache',type:'APACHE_ATTACK',
      detail:'APACHE '+(meta.hosts||[]).join('+').toUpperCase()+' ×'+meta.errors+' errors',
      sev:meta.errors>=20?3:2});
  });
  ev.sort(function(a,b){return b.ts<a.ts?-1:b.ts>a.ts?1:0;});
  return ev.slice(0,200);
}

function _buildIpMap(ev){
  var m={};
  for(var i=0;i<ev.length;i++){
    var e=ev[i];if(!e.ip)continue;
    if(!m[e.ip])m[e.ip]={count:0,srcs:[],maxSev:0};
    m[e.ip].count++;
    var f=_fam(e.src);
    if(m[e.ip].srcs.indexOf(f)===-1)m[e.ip].srcs.push(f);
    if(e.sev>m[e.ip].maxSev)m[e.ip].maxSev=e.sev;
  }
  return m;
}

/* ══════════════════════════════════════════════════════════════════════════
   JARVIS OFFLINE POPUP
══════════════════════════════════════════════════════════════════════════ */
window._xdrToggleJarvisPop=function(evt){
  evt.stopPropagation();
  var pop=document.getElementById('xdr-jpop');
  if(!pop)return;
  var isOpen=pop.classList.contains('open');
  // Fermer au prochain click document
  if(!isOpen){
    pop.classList.add('open');
    // Close on next click anywhere
    setTimeout(function(){
      function _close(e){
        if(!pop.contains(e.target)){
          pop.classList.remove('open');
          document.removeEventListener('click',_close);
        }
      }
      document.addEventListener('click',_close);
    },10);
  } else {
    pop.classList.remove('open');
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   JARVIS STATUS (lit le cache JARVIS du dashboard)
══════════════════════════════════════════════════════════════════════════ */
function _jarvisOk(d){
  // Vérifie si JARVIS répond : champ jarvis dans monitoring.json OU localStorage soc_ai=on
  var jd=d.jarvis||d.jarvis_status||null;
  if(jd&&jd.available!==undefined) return !!jd.available;
  // Fallback : localStorage toggle
  try{return localStorage.getItem(_LS_KEYS.SOC_AI)==='on';}catch(e2){return false;}
}
function _jarvisStats(d){
  var jd=d.jarvis||d.jarvis_status||{};
  return {
    bans:   jd.bans_24h   || jd.total_bans   || 0,
    alerts: jd.alerts_24h || jd.total_alerts || 0,
    model:  jd.model      || jd.llm_model     || '',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   LOGIGRAMME v3 — 4-stage XDR SOC pipeline
   COLLECT → NORMALIZE → CORRELATE → RESPOND
══════════════════════════════════════════════════════════════════════════ */
// NDT-174 — extracted from _lgHtml: pure rendering helpers (no closure over _lgHtml scope)
function _normNode(ico,lbl,sub,val,badge,col,bcol){
  var c=col||'rgba(0,200,255,.7)';
  var bc=bcol||'rgba(0,255,136,.8)';
  var bbg=bcol?'rgba('+bcol.replace(/rgba?\(|\)/g,'').split(',').slice(0,3).join(',')+', .1)':'rgba(0,255,136,.1)';
  var cTop =c.replace(/[\d.]+\)$/,'.38)');
  var cLeft=c.replace(/[\d.]+\)$/,'.2)');
  var cGlow=c.replace(/[\d.]+\)$/,'.08)');
  return '<div class="xdr-norm" style="border-top:2px solid '+cTop+';border-left:2px solid '+cLeft+';box-shadow:0 0 8px '+cGlow+'">'
    +'<div class="xdr-norm-h"><span class="xdr-norm-ico">'+ico+'</span>'
    +'<span class="xdr-norm-lbl" style="color:'+c+'">'+lbl+'</span>'
    +(badge?'<span class="xdr-norm-bdg" style="color:'+bc+';background:'+bc.replace(/[\d.]+\)$/,'.1)')+';border:1px solid '+bc.replace(/[\d.]+\)$/,'.25)')+'">'+esc(badge)+'</span>':'')+'</div>'
    +'<div class="xdr-norm-sub">'+sub+'</div>'
    +(val?'<div class="xdr-norm-val" style="color:'+c+'">'+val+'</div>':'')
    +'</div>';
}
function _respNode(ico,lbl,sub,val,state){
  var bdgTxt=state==='on'?'ACTIF':(state==='warn'?'WARN':'OFF');
  return '<div class="xdr-resp '+state+'">'
    +'<div class="xdr-resp-h"><span class="xdr-resp-ico">'+ico+'</span>'
    +'<span class="xdr-resp-lbl">'+lbl+'</span>'
    +'<span class="xdr-resp-bdg '+state+'">'+bdgTxt+'</span></div>'
    +'<div class="xdr-resp-sub">'+sub+'</div>'
    +(val?'<div class="xdr-resp-val">'+val+'</div>':'')
    +'</div>';
}
function _arr(col){
  return '<div class="xdr-pipe-arr"><span style="color:'+col+'">▶</span></div>';
}
function _lgHtml(ev, ipMap, d){
  var cnt={f2b:0,ufw:0,aar:0,msc:0,msp:0,sur:0,abn:0,ngx:0,aid:0,rtr:0,vlm:0,ap:0};
  for(var i=0;i<ev.length;i++){var sid=_FAM_SRC[ev[i].src];if(sid)cnt[sid]++;}
  var total   = ev.length;
  var msCount = Object.keys(ipMap).filter(function(ip){return ipMap[ip].srcs.length>1;}).length;
  var ipCount = Object.keys(ipMap).length;
  var jOk     = false;
  var jStats  = {model:'',bans_24h:0,soc_engine_active:false};

  // ── Sévérité breakdown
  var sevC=[0,0,0,0,0];
  for(var i=0;i<ev.length;i++) sevC[Math.min(4,Math.max(1,ev[i].sev||1))]++;

  // ── Top event type par source
  var srcTypes={};
  for(var i=0;i<ev.length;i++){
    var sid=_FAM_SRC[ev[i].src]; if(!sid) continue;
    if(!srcTypes[sid]) srcTypes[sid]={};
    var t=(ev[i].type||'EVT').replace(/_/g,' ').slice(0,16);
    srcTypes[sid][t]=(srcTypes[sid][t]||0)+1;
  }

  // ── Top IPs par nombre d'événements
  var ipList=Object.keys(ipMap).map(function(ip){
    return {ip:ip,count:ipMap[ip].count,srcs:ipMap[ip].srcs,maxSev:ipMap[ip].maxSev||1};
  }).sort(function(a,b){return b.count-a.count||b.maxSev-a.maxSev;});

  // ── IPs multi-source triées par nb sources desc
  var msIps=ipList.filter(function(x){return x.srcs.length>1;})
    .sort(function(a,b){return b.srcs.length-a.srcs.length||b.count-a.count;});

  // ── Plage temporelle
  var tsMin='',tsMax='';
  for(var i=0;i<ev.length;i++){
    if(!ev[i].ts) continue;
    if(!tsMin||ev[i].ts<tsMin) tsMin=ev[i].ts;
    if(!tsMax||ev[i].ts>tsMax) tsMax=ev[i].ts;
  }
  var tRange=tsMin&&tsMax?(_tsH(tsMin)+' → '+_tsH(tsMax)):'—';

  // ── Threat level
  var threatLvl=sevC[4]>0?'CRITIQUE':(sevC[3]>0?'HIGH':(sevC[2]>0?'WARN':'NOMINAL'));
  var threatCol=sevC[4]>0?'rgba(255,40,100,1)':(sevC[3]>0?'rgba(255,100,50,.9)':(sevC[2]>0?'rgba(255,200,0,.85)':'rgba(0,255,136,.7)'));
  var threatBg =sevC[4]>0?'rgba(255,40,100,.1)':(sevC[3]>0?'rgba(255,100,50,.08)':(sevC[2]>0?'rgba(255,200,0,.07)':'rgba(0,255,136,.06)'));
  var threatBc =sevC[4]>0?'rgba(255,40,100,.35)':(sevC[3]>0?'rgba(255,100,50,.3)':(sevC[2]>0?'rgba(255,200,0,.28)':'rgba(0,255,136,.22)'));

  // ── Top source active
  var activeSrcs=_SRCS.filter(function(s){return (cnt[s.id]||0)>0;});
  var topSrc=activeSrcs.length?activeSrcs.reduce(function(a,b){return (cnt[a.id]||0)>=(cnt[b.id]||0)?a:b;}):null;

  // Max count for activity bars
  var maxCnt=Math.max(1,Math.max.apply(null,_SRCS.map(function(s){return cnt[s.id]||0;})));

  /* ════════════════════════════════════════════════════
     STAGE 1 — COLLECT
  ════════════════════════════════════════════════════ */
  var collectHtml=_SRCS.map(function(s){
    var c=cnt[s.id]||0;var active=c>0;
    var glowC=s.bc.replace('.25','.3');
    var glow=active?';box-shadow:0 0 10px '+glowC+',0 0 22px '+s.bc.replace('.25','.1'):'';
    var cntStyle='color:'+s.col+(active?';background:'+s.bg.replace('.06','.16')+';padding:0 4px;border-radius:2px':'');
    var barW=Math.max(4,Math.round(c/maxCnt*100));
    var topTypeHtml='';
    if(active&&srcTypes[s.id]){
      var types=Object.keys(srcTypes[s.id]).sort(function(a,b){return srcTypes[s.id][b]-srcTypes[s.id][a];});
      topTypeHtml='<div class="xdr-lg-src-top" style="color:'+s.col+'">▸ '+esc(types[0])+' ×'+srcTypes[s.id][types[0]]+(types.length>1?' +':'')+'</div>';
    }
    return '<div class="xdr-lg-src" style="border-color:'+s.bc+';background:'+s.bg+(active?glow:'')+'">'
      +'<div class="xdr-lg-src-h"><span class="xdr-lg-src-ico">'+s.ico+'</span>'
      +'<span class="xdr-lg-src-name" style="color:'+s.col+'">'+s.lbl+'</span>'
      +'<span class="xdr-lg-src-cnt" style="'+cntStyle+'">'+c+'</span></div>'
      +'<div class="xdr-lg-src-proc" style="color:'+s.col+'">'+s.proc+'</div>'
      +topTypeHtml
      +(active?'<div class="xdr-lg-src-bar" style="width:'+barW+'%;background:'+s.col+';opacity:.5"></div>':'')
      +'</div>';
  }).join('');

  /* ════════════════════════════════════════════════════
     STAGE 2 — NORMALIZE
  ════════════════════════════════════════════════════ */
  var geoBlocks=(d.traffic||{}).geo_blocks||0;
  var topCtries=(d.traffic||{}).top_countries||[];
  var topCtry=topCtries.length?(topCtries[0].country||topCtries[0]):'';
  var csDecis=(d.crowdsec||{}).active_decisions||0;
  var csScen=(d.crowdsec||{}).active_scenarios||(d.crowdsec||{}).scenarios_count||0;
  var _mitreM={'SQLI':'T1190','SQL':'T1190','XSS':'T1059','LFI':'T1083','RCE':'T1190',
    'PHP':'T1190','DROP':'T1190','BRUTE':'T1110','BAN':'T1110','SCAN':'T1046',
    'C2':'T1071','EXPLOIT':'T1190','AUTOBAN':'T1595','ALERT':'T1595','WAF':'T1190'};
  var mitreH={};
  for(var mi=0;mi<ev.length;mi++){
    var et=(ev[mi].type||'').toUpperCase();
    for(var mk in _mitreM){if(et.indexOf(mk)>=0){mitreH[_mitreM[mk]]=(mitreH[_mitreM[mk]]||0)+1;}}
  }
  var mitreKeys=Object.keys(mitreH).sort(function(a,b){return mitreH[b]-mitreH[a];});
  var mitreTop=mitreKeys.slice(0,2).join(' · ')||'T1190 · T1595';

  var normHtml=
    _normNode('📥','LOG PARSER','nginx · auth · syslog → JSON',total+' evt','OK','rgba(0,200,255,.75)','rgba(0,255,136,.85)')
    +_normNode('🌍','GEO / IP','country · ASN · risque',geoBlocks+' geo-bloqués',(topCtry||'GEO'),'rgba(100,200,255,.7)','rgba(0,200,255,.8)')
    +_normNode('🔍','IOC / CTI','CrowdSec CTI · threat feeds',csDecis+' actifs',(csScen?csScen+' scén':'CTI'),'rgba(180,120,255,.75)','rgba(180,120,255,.85)')
    +_normNode('🎯','MITRE ATT&CK','kill-chain · technique map',mitreTop,mitreKeys.length?mitreKeys.length+' tech':'MAP','rgba(255,200,60,.7)','rgba(255,200,60,.85)');

  /* ════════════════════════════════════════════════════
     STAGE 3 — CORRELATE
  ════════════════════════════════════════════════════ */
  var topCorrHtml=msIps.slice(0,2).map(function(x){
    return '<div style="font:600 7px \'Courier New\';color:rgba(255,130,60,.55);margin-top:1px;white-space:nowrap">▸ '+esc(x.ip.slice(-11))+' ×'+x.srcs.length+' src</div>';
  }).join('');
  var corrHtml=msCount>0
    ?'<div class="xdr-lg-eng-corr">⚡ ×'+msCount+' IP MULTI-SOURCE</div>'
    :'<div class="xdr-lg-eng-ok">✓ PAS DE CORRÉLATION</div>';
  var engHtml='<div class="xdr-lg-eng">'
    +'<div class="xdr-lg-eng-radar"><span class="xdr-lg-eng-cross">◈</span></div>'
    +'<div class="xdr-lg-eng-badge">X · D · R</div>'
    +'<div class="xdr-lg-eng-title">CORRELATION</div>'
    +'<div class="xdr-lg-eng-tot">'+total+'</div>'
    +'<div class="xdr-lg-eng-sub">'+ipCount+' IPs · '+activeSrcs.length+' SRCS · '+tRange+'</div>'
    +'<div class="xdr-lg-eng-divider"></div>'
    +'<div class="xdr-lg-eng-row">'
    +'<span class="xdr-lg-eng-stat" style="color:rgba(255,40,100,.75)">CRIT <b style="color:rgba(255,60,110,.95)">'+sevC[4]+'</b></span>'
    +'<span class="xdr-lg-eng-stat" style="color:rgba(255,100,50,.7)">HIGH <b style="color:rgba(255,130,60,.9)">'+sevC[3]+'</b></span>'
    +'<span class="xdr-lg-eng-stat" style="color:rgba(255,200,0,.6)">WARN <b>'+sevC[2]+'</b></span>'
    +'</div>'
    +(topSrc?'<div class="xdr-lg-eng-row"><span class="xdr-lg-eng-stat" style="color:'+topSrc.col+';opacity:.8">▲ '+esc(topSrc.lbl)+' <b>'+cnt[topSrc.id]+'</b></span></div>':'')
    +'<div class="xdr-lg-eng-threat" style="color:'+threatCol+';background:'+threatBg+';border:1px solid '+threatBc+'">'+threatLvl+'</div>'
    +corrHtml+topCorrHtml
    +'</div>';

  /* ════════════════════════════════════════════════════
     STAGE 4 — RESPOND
  ════════════════════════════════════════════════════ */
  var jWin=(typeof window._dcJarvisState!=='undefined')?window._dcJarvisState:null;
  if(jWin!==null){jOk=!!jWin.available;if(jWin.model)jStats.model=jWin.model;jStats.bans_24h=jWin.bans_24h||0;}
  if(!jOk&&window._jvOnline){
    jOk=true;
    var st=window._jvLastStats||{};
    if(st.model||st.llm_model)jStats.model=st.model||st.llm_model||'';
    var pd=window._PRO_DATA||{};
    jStats.bans_24h=(pd.by_type&&pd.by_type.ban_ip)||pd.total||0;
  }
  var jModel=jStats.model?(jStats.model.split(':')[0].slice(0,14)):'—';

  var csBanState=(d.crowdsec||{}).available?'on':'warn';
  var f2bBans=((d.fail2ban||{}).jails||[]).reduce(function(s,j){return s+(j.banned||0);},0);
  var ttsState=jOk&&(jStats.soc_engine_active||window._jvOnline)?'on':'off';

  var jarvisRespHtml;
  if(jOk){
    jarvisRespHtml='<div class="xdr-resp on jarvis-on">'
      +'<div class="xdr-resp-h"><span class="xdr-resp-ico">⬡</span>'
      +'<span class="xdr-resp-lbl">JARVIS SOAR</span>'
      +'<span class="xdr-resp-bdg on">ONLINE</span></div>'
      +'<div class="xdr-resp-sub">LLM · auto-ban · restart · TTS</div>'
      +'<div class="xdr-resp-val">'+esc(jModel)+' · '+jStats.bans_24h+' bans</div>'
      +'</div>';
  } else {
    jarvisRespHtml='<div class="xdr-joff-wrap" id="xdr-joff-wrap" data-xdr-joff-wrap>'
      +'<div class="xdr-joff-badge" title="Pourquoi OFFLINE ?">?</div>'
      +'<div class="xdr-resp off">'
      +'<div class="xdr-resp-h"><span class="xdr-resp-ico">⬡</span>'
      +'<span class="xdr-resp-lbl">JARVIS SOAR</span>'
      +'<span class="xdr-resp-bdg off">OFFLINE</span></div>'
      +'<div class="xdr-resp-sub">cliquer pour infos</div>'
      +'</div>'
      +'<div class="xdr-jpop" id="xdr-jpop">'
      +'<div class="xdr-jpop-ttl">⬡ JARVIS — POURQUOI OFFLINE ?</div>'
      +'<div class="xdr-jpop-row"><span class="xdr-jpop-ico">🖥</span>'
      +'<span class="xdr-jpop-txt">JARVIS tourne sur <b style="color:rgba(0,220,255,.8)">'+JV_URL+'</b> (machine Windows).</span></div>'
      +'<div class="xdr-jpop-row"><span class="xdr-jpop-ico">🌐</span>'
      +'<span class="xdr-jpop-txt">Consulté depuis <b style="color:rgba(0,220,255,.8)">'+SOC_INFRA.SRV_NGIX+'</b> — navigateur ne peut pas atteindre localhost Windows.</span></div>'
      +'<div class="xdr-jpop-row"><span class="xdr-jpop-ico">✅</span>'
      +'<span class="xdr-jpop-txt">Ouvrir le dashboard depuis la machine Windows pour activer JARVIS.</span></div>'
      +'<a class="xdr-jpop-link" href="'+JV_URL+'" target="_blank" rel="noopener noreferrer" data-xdr-jplink>→ Ouvrir JARVIS '+JV_URL+'</a>'
      +'</div></div>';
  }

  var respondHtml=
    _respNode('🛡','CROWDSEC BAN','auto-décisions · bouncer nginx',csDecis+' IPs bannies',csBanState)
    +_respNode('🔒','FAIL2BAN','jail · iptables/nftables',f2bBans+' IPs · multi-hôtes',f2bBans>0?'warn':'on')
    +jarvisRespHtml
    +_respNode('🔊','TTS / ALERT','vocal · seuil CRIT/HIGH · SOC engine',ttsState==='on'?'SOC engine actif':'inactif',ttsState);

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return '<div class="xdr-lg">'
    +'<div class="xdr-pipe-col collect"><div class="xdr-pipe-lbl" style="color:rgba(0,200,255,.6);border-color:rgba(0,200,255,.2);text-shadow:0 0 10px rgba(0,200,255,.35)">◉ COLLECT</div>'+collectHtml+'</div>'
    +_arr('rgba(0,170,255,.45)')
    +'<div class="xdr-pipe-col normalize"><div class="xdr-pipe-lbl" style="color:rgba(180,120,255,.65);border-color:rgba(180,120,255,.2);text-shadow:0 0 10px rgba(180,120,255,.35)">◈ NORMALIZE</div>'+normHtml+'</div>'
    +_arr('rgba(150,100,255,.45)')
    +'<div class="xdr-pipe-col correlate"><div class="xdr-pipe-lbl" style="color:rgba(0,170,255,.6);border-color:rgba(0,170,255,.2);text-shadow:0 0 10px rgba(0,170,255,.35)">◈ CORRELATE</div>'+engHtml+'</div>'
    +_arr('rgba(0,200,255,.45)')
    +'<div class="xdr-pipe-col respond"><div class="xdr-pipe-lbl" style="color:rgba(0,255,136,.6);border-color:rgba(0,255,136,.2);text-shadow:0 0 10px rgba(0,255,136,.35)">⚡ RESPOND</div>'+respondHtml+'</div>'
    +'</div>';
}

/* ══════════════════════════════════════════════════════════════════════════
   TIMELINE HELPERS
══════════════════════════════════════════════════════════════════════════ */
function _tagHtml(src){
  var s=_ss(src);
  return '<span class="xdr-tag" style="color:'+s.c+';border-color:'+s.bc+';background:'+s.bg+'">'+s.lbl+'</span>';
}
function _rowHtml(e,ipMap,hlIp){
  var sev=Math.min(4,Math.max(1,e.sev||1));
  var hl=(hlIp&&e.ip===hlIp)?' hl':'';
  var info=e.ip&&ipMap[e.ip];
  var corrH=info&&info.srcs.length>1?'<span class="xdr-corr" title="'+info.srcs.join('+')+'">×'+info.srcs.length+'</span>':'';
  var ipC=e.ip&&_ss(e.src)?_ss(e.src).c:'';
  var ipStyle=ipC&&e.ip?'style="color:'+ipC+'"':'';
  return '<div class="xdr-row xdr-s'+sev+hl+'" title="'+esc(e.detail)+'">'
    +'<span class="xdr-ts">'+_tsH(e.ts)+'</span>'
    +'<span class="xdr-rip'+(e.ip?'':' ni')+'" '+ipStyle+'>'+esc(e.ip||'—')+'</span>'
    +_tagHtml(e.src)
    +'<span class="xdr-det">'+esc(e.detail)+'</span>'
    +corrH
    +'</div>';
}
function _ipListHtml(ipMap,hlIp){
  var ips=Object.keys(ipMap).sort(function(a,b){
    var ia=ipMap[a],ib=ipMap[b];
    if(ib.srcs.length!==ia.srcs.length)return ib.srcs.length-ia.srcs.length;
    return ib.count-ia.count;
  }).slice(0,25);
  if(!ips.length)return '<div class="xdr-ip-hdr">TOP IPs</div>';
  return '<div class="xdr-ip-hdr">TOP IPs</div>'
    +ips.map(function(ip){
      var info=ipMap[ip];
      var sc=['','rgba(0,200,255,.8)','rgba(255,200,0,.8)','rgba(255,100,50,.9)','rgba(255,40,100,1)'][Math.min(4,info.maxSev)];
      var ms=info.srcs.length>1?'<span class="xdr-ipr-ms">×'+info.srcs.length+'</span>':'';
      var dots=info.srcs.map(function(f){
        var c=_FAM_C[f]||'rgba(200,200,200,.5)';
        return '<span class="xdr-ipr-dot" style="background:'+c+'" title="'+f+'"></span>';
      }).join('');
      var selCls=(hlIp===ip)?' sel':'';
      return '<div class="xdr-ipr'+selCls+'" data-xdr-ip="'+esc(ip)+'">'
        +'<span class="xdr-ipr-ip" style="color:'+sc+'">'+esc(ip)+'</span>'
        +'<div class="xdr-ipr-meta"><span class="xdr-ipr-cnt">'+info.count+'</span>'+ms+'</div>'
        +'<div class="xdr-ipr-dots">'+dots+'</div>'
        +'</div>';
    }).join('');
}

/* ══════════════════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════════════════ */
var _xq='',_xSrcOff={},_xSevOff={},_xHl=null;
var _xEv=[],_xIpMap={};

function _filter(){
  var tl=document.getElementById('xdr-tl');
  if(!tl)return;
  var q=_xq.trim().toLowerCase();
  var vis=_xEv.filter(function(e){
    if(_xSrcOff[_fam(e.src)])return false;
    if(_xSevOff[e.sev])return false;
    if(q&&(e.ip.indexOf(q)===-1)&&((e.detail||'').toLowerCase().indexOf(q)===-1)&&(e.src.indexOf(q)===-1))return false; // NDT-145
    return true;
  });
  if(!vis.length){tl.innerHTML='<div class="xdr-empty">// Aucun événement</div>';return;}
  var parts=[],lastHr='';
  for(var i=0;i<vis.length;i++){
    var hr=_tsHour(vis[i].ts);
    if(hr&&hr!==lastHr){lastHr=hr;parts.push('<div class="xdr-tsep">── '+hr+' ──────────────────────────</div>');}
    parts.push(_rowHtml(vis[i],_xIpMap,_xHl));
  }
  tl.innerHTML=parts.join('');
  var bd=document.getElementById('xdr-ev-count');
  if(bd)bd.textContent=vis.length+'/'+_xEv.length;
  _bindIpRows();
}
function _bindIpRows(){
  var p=document.getElementById('xdr-ips');
  if(!p)return;
  p.querySelectorAll('[data-xdr-ip]').forEach(function(el){
    el.addEventListener('click',function(){
      var ip=this.getAttribute('data-xdr-ip');
      _xHl=(_xHl===ip)?null:ip;
      _xq=_xHl?ip:'';
      var inp=document.getElementById('xdr-inp');if(inp)inp.value=_xq;
      _filter();
      _rebuildIps();
    });
  });
}
function _rebuildIps(){
  var p=document.getElementById('xdr-ips');
  if(p){p.innerHTML=_ipListHtml(_xIpMap,_xHl);_bindIpRows();}
}

/* ══════════════════════════════════════════════════════════════════════════
   OPEN MODAL
══════════════════════════════════════════════════════════════════════════ */
function _xdrOpenModal(d){
  _css();
  _xEv    = _build(d);
  _xIpMap = _buildIpMap(_xEv);

  var ipCount  = Object.keys(_xIpMap).length;
  var msCount  = Object.keys(_xIpMap).filter(function(ip){return _xIpMap[ip].srcs.length>1;}).length;

  // Counts per family/sev
  var famC={},sevC=[0,0,0,0,0];
  var FAMS=['fail2ban','ufw','apparmor','modsec','autoban','suricata','nginx_drop','aid'];
  for(var i=0;i<_xEv.length;i++){
    var f=_fam(_xEv[i].src);famC[f]=(famC[f]||0)+1;
    sevC[Math.min(4,Math.max(1,_xEv[i].sev||1))]++;
  }

  // Chips
  var chipsHtml=FAMS.map(function(f){
    var offCls=_xSrcOff[f]?' off':'';
    return '<span class="xdr-chip'+offCls+'" data-f="'+f+'" data-xdr-chip>'+f.toUpperCase().replace('_',' ')+'</span>';
  }).join('');

  // Sev pills
  var sevL=['','INFO','WARN','HIGH','CRIT'];
  var sevHtml=[1,2,3,4].map(function(s){
    return '<span class="xdr-sev'+((_xSevOff[s])?' off':'')+'" data-s="'+s+'" data-xdr-sev>'+sevL[s]+' <b>'+sevC[s]+'</b></span>';
  }).join('');

  // Modal header
  var hdr=document.getElementById('modal-header-title');
  if(hdr)hdr.innerHTML='◈ XDR CORRELATION ENGINE';

  // Modal wide
  var mc=document.getElementById('modal-card');
  if(mc)mc.classList.add('modal-wide');

  // Modal body
  var body=document.getElementById('modal-body');
  if(!body)return;

  body.style.padding='0';
  body.style.fontSize='1em';
  body.style.height='100%';
  body.style.display='flex';
  body.style.flexDirection='column';
  body.style.overflow='hidden';

  body.innerHTML='<div class="xdr-modal">'
    +_lgHtml(_xEv,_xIpMap,d)
    +'<div class="xdr-bar">'
    +'<div class="xdr-bar-r1">'
    +'<span class="xdr-bar-lbl">Sources</span>'
    +'<div class="xdr-chips">'+chipsHtml+'</div>'
    +'<div class="xdr-bar-sep"></div>'
    +'<span class="xdr-bar-lbl">Sévérité</span>'
    +'<div class="xdr-sevs">'+sevHtml+'</div>'
    +'<div class="xdr-bar-spc"></div>'
    +'<span class="xdr-ev-pill">EVT <b id="xdr-ev-count">'+_xEv.length+'</b>/'+_xEv.length+'</span>'
    +'</div>'
    +'<div class="xdr-bar-r2">'
    +'<input id="xdr-inp" class="xdr-inp" type="text" placeholder="🔍  IP · source · type..." value="'+esc(_xq)+'" autocomplete="off" spellcheck="false">'
    +'<button id="xdr-clr" class="xdr-clr">✕ RESET</button>'
    +'</div>'
    +'</div>'
    +'<div class="xdr-body">'
    +'<div id="xdr-ips" class="xdr-ips">'+_ipListHtml(_xIpMap,_xHl)+'</div>'
    +'<div id="xdr-tl" class="xdr-tl"></div>'
    +'</div>'
    +'</div>';

  // Bindings
  var inp=body.querySelector('#xdr-inp');
  if(inp)inp.addEventListener('input',function(){_xq=this.value;_xHl=null;_filter();});
  var clr=body.querySelector('#xdr-clr');
  if(clr)clr.addEventListener('click',function(){
    _xq='';_xHl=null;
    var i=document.getElementById('xdr-inp');if(i)i.value='';
    _filter();_rebuildIps();
  });
  body.querySelectorAll('[data-xdr-chip]').forEach(function(el){
    el.addEventListener('click',function(){
      var f=this.getAttribute('data-f');
      _xSrcOff[f]=!_xSrcOff[f];
      this.classList.toggle('off',!!_xSrcOff[f]);
      _filter();
    });
  });
  body.querySelectorAll('[data-xdr-sev]').forEach(function(el){
    el.addEventListener('click',function(){
      var s=+this.getAttribute('data-s');
      _xSevOff[s]=!_xSevOff[s];
      this.classList.toggle('off',!!_xSevOff[s]);
      _filter();
    });
  });
  _bindIpRows();
  _filter();

  // N4 — data-* bindings (onclick= retiré)
  var joffWrap=body.querySelector('[data-xdr-joff-wrap]');
  if(joffWrap)joffWrap.addEventListener('click',function(e){window._xdrToggleJarvisPop(e);});
  var jpLink=body.querySelector('[data-xdr-jplink]');
  if(jpLink)jpLink.addEventListener('click',function(e){e.stopPropagation();});

  // Fermer toute modal ouverte proprement avant d'ouvrir XDR
  if(typeof closeModal==='function'&&window._isOpen)closeModal();
  var _ov=document.getElementById('overlay');
  var _mc2=document.getElementById('modal-card');
  if(_ov&&_mc2){
    // Purger les classes stale laissées par une ouverture précédente (standard ou XDR)
    ['modal-wide','theme-cyan','theme-green','theme-red','theme-amber'].forEach(function(c){_mc2.classList.remove(c);});
    _mc2.classList.add('modal-wide');
    _ov.classList.add('open');
    document.body.style.overflow='hidden';
    window._isOpen=true;
  }

  // ── Check JARVIS au moment de l'ouverture (résout le cas "JARVIS démarré mais OFFLINE") ──
  (function(){
    var ctrl=new AbortController();
    var tid=setTimeout(function(){ctrl.abort();},2500);
    fetch(JV_URL+'/api/status',{signal:ctrl.signal})
      .then(function(r){clearTimeout(tid);return r.ok?r.json():Promise.reject(r.status);})
      .then(function(data){
        // Mise à jour état global
        if(typeof window._dcJarvisState!=='undefined'){
          window._dcJarvisState={available:true,
            model:data.model||data.llm_model||data.active_model||'',
            bans_24h:+(data.bans_24h||data.total_bans||0),
            soc_engine_active:!!(data.soc_engine_active||data.soc_engine)};
        }
        // Swap DOM : remplacer le nœud OFFLINE par ONLINE sans re-render complet
        var wrap=document.getElementById('xdr-joff-wrap');
        if(!wrap)return; // déjà en mode ONLINE → rien à faire
        var model=(data.model||data.llm_model||data.active_model||'').split(':')[0].slice(0,12)||'ONLINE';
        var newNode=document.createElement('div');
        newNode.className='xdr-lg-out xdr-lg-out-jarvis-on';
        newNode.innerHTML='<div class="xdr-lg-out-head"><span class="xdr-lg-out-ico">⬡</span>'
          +'<span class="xdr-lg-out-lbl">JARVIS AI</span></div>'
          +'<div class="xdr-lg-out-val">'+esc(model)+'</div>'
          +'<div class="xdr-lg-out-sub">ban · analyse · TTS</div>';
        wrap.parentNode.replaceChild(newNode,wrap);
      })
      .catch(function(){clearTimeout(tid);/* JARVIS vraiment inaccessible */});
  })();
}

/* ══════════════════════════════════════════════════════════════════════════
   EXPORT
══════════════════════════════════════════════════════════════════════════ */
window._xdrOpenModal = _xdrOpenModal;

})();
