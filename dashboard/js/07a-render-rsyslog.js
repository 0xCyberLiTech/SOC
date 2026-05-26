'use strict';
// 07a-render-rsyslog.js — Rendu tuile + modal rsyslog (Sprint 2B 2026-05-16).
// Extrait de 07-render.js : helpers _rsy*, _rsyslog*, openRsyslogModal, _renderRsyslogTile.
// Chargé AVANT 07-render.js dans index.html. Globals hoisted, aucun module système.

// NDT-228 — helpers rsyslog promus module-level (étaient fermés dans openRsyslogModal)
function _rsyHCol(hosts,hk){var st=(hosts[hk]||{}).status||'absent';return st==='ok'?_COL_MATGREEN_HEX:st==='stale'?_COL_AMBER_HEX:'rgba(160,160,160,.4)';}
function _rsyLm(n){return n>=10000?Math.round(n/1000)+'k':n>=1000?(n/1000).toFixed(1)+'k':''+n;}
function _rsyFlow(pth,clr,dur){
  return '<path d="'+pth+'" stroke="'+clr+'" stroke-width="1.5" fill="none" opacity=".16"/>'
    +'<path d="'+pth+'" stroke="'+clr+'" stroke-width="1.5" fill="none" stroke-dasharray="7 5" opacity=".78">'
    +'<animate attributeName="stroke-dashoffset" from="24" to="0" dur="'+dur+'" repeatCount="indefinite"/>'
    +'</path>';
}
// NDT-178 — openRsyslogModal: schéma SVG animé flux rsyslog + audit couverture + table hôtes
// ── openRsyslogModal helpers ─────────────────────────────────────────────────
function _rsyslogSvgHtml(hosts, svcOk, colClt, colPa85, colPve, colDev1, xh, rs){
  // routeur retire 2026-05-17 (5 hotes)
  var jvAct2=0;try{jvAct2=((window._jvAutoState||{}).actionLog||[]).filter(function(a){return Date.now()-new Date(a.ts).getTime()<_MS_PER_DAY;}).length;}catch(e){}
  var colJv=jvAct2>0?'rgba(206,147,216,.9)':'rgba(156,39,176,.45)';
  return '<svg viewBox="0 0 580 260" style="width:100%;height:auto;display:block;margin-bottom:.7rem" xmlns="http://www.w3.org/2000/svg">'
    +'<rect width="580" height="260" fill="rgba(0,5,15,.45)" rx="6"/>'
    +'<text x="44" y="13" font-family="Courier New" font-size="7.5" fill="rgba(0,188,212,.35)" text-anchor="middle">SOURCES</text>'
    +'<text x="202" y="13" font-family="Courier New" font-size="7.5" fill="rgba(0,188,212,.35)" text-anchor="middle">COLLECTEUR</text>'
    +'<text x="348" y="13" font-family="Courier New" font-size="7.5" fill="rgba(156,39,176,.35)" text-anchor="middle">MOTEUR</text>'
    +'<text x="493" y="13" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.25)" text-anchor="middle">SORTIES</text>'
    +'<rect x="4" y="30" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colClt+'" stroke-width="1.2"/>'
    +'<text x="16" y="45" font-family="Courier New" font-size="9.5" fill="'+colClt+'" font-weight="700">● clt</text>'
    +'<text x="84" y="45" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_rsyLm((hosts.clt||{}).lines_min||0)+' L/m</text>'
    +'<rect x="4" y="74" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colPa85+'" stroke-width="1.2"/>'
    +'<text x="16" y="89" font-family="Courier New" font-size="9.5" fill="'+colPa85+'" font-weight="700">● pa85</text>'
    +'<text x="84" y="89" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_rsyLm((hosts.pa85||{}).lines_min||0)+' L/m</text>'
    +'<rect x="4" y="118" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colPve+'" stroke-width="1.2"/>'
    +'<text x="16" y="133" font-family="Courier New" font-size="9.5" fill="'+colPve+'" font-weight="700">● pve</text>'
    +'<text x="84" y="133" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_rsyLm((hosts.pve||{}).lines_min||0)+' L/m</text>'
    +'<rect x="4" y="162" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colDev1+'" stroke-width="1.2"/>'
    +'<text x="16" y="177" font-family="Courier New" font-size="8.5" fill="'+colDev1+'" font-weight="700">● srv-dev-1</text>'
    +'<text x="84" y="177" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_rsyLm((hosts['srv-dev-1']||{}).lines_min||0)+' L/m</text>'
    +((hosts.clt||{}).lines_min>0?'<circle cx="86" cy="42" r="2.5" fill="'+colClt+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="2.1s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="2.1s" repeatCount="indefinite"/></circle>':'')
    +((hosts.pa85||{}).lines_min>0?'<circle cx="86" cy="86" r="2.5" fill="'+colPa85+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="1.8s" repeatCount="indefinite"/></circle>':'')
    +((hosts.pve||{}).lines_min>0?'<circle cx="86" cy="130" r="2.5" fill="'+colPve+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="2.4s" repeatCount="indefinite"/></circle>':'')
    +((hosts['srv-dev-1']||{}).lines_min>0?'<circle cx="86" cy="174" r="2.5" fill="'+colDev1+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="2.2s" repeatCount="indefinite"/></circle>':'')
    +_rsyFlow('M 86 42 C 120 42 119 108 152 108',colClt,'1.4s')
    +_rsyFlow('M 86 86 C 120 86 119 113 152 113',colPa85,'1.7s')
    +_rsyFlow('M 86 130 C 120 130 119 118 152 118',colPve,'1.2s')
    +_rsyFlow('M 86 174 C 120 174 119 123 152 123',colDev1,'2.3s')
    +'<rect x="152" y="92" width="100" height="56" rx="4" fill="rgba(0,25,45,.8)" stroke="rgba(0,188,212,.65)" stroke-width="1.5"/>'
    +'<text x="202" y="110" font-family="Courier New" font-size="9" fill="var(--teal)" font-weight="700" text-anchor="middle">SRV-NGIX</text>'
    +'<text x="202" y="122" font-family="Courier New" font-size="8.5" fill="rgba(0,188,212,.75)" text-anchor="middle">rsyslog</text>'
    +'<text x="202" y="134" font-family="Courier New" font-size="7.5" fill="rgba(0,188,212,.5)" text-anchor="middle">:514 TCP/UDP</text>'
    +'<rect x="162" y="153" width="80" height="13" rx="2" fill="'+(svcOk?'rgba(0,230,118,.12)':'rgba(255,59,92,.12)')+'" stroke="'+(svcOk?'rgba(0,230,118,.35)':'rgba(255,59,92,.35)')+'" stroke-width=".8"/>'
    +'<text x="202" y="163" font-family="Courier New" font-size="7.5" fill="'+(svcOk?_COL_MATGREEN_HEX:_COL_RED_HEX)+'" text-anchor="middle" font-weight="700">'+(svcOk?'● ACTIVE':'● FAILED')+'</text>'
    +_rsyFlow('M 252 120 L 296 120','rgba(156,39,176,.9)','0.9s')
    +'<rect x="296" y="92" width="104" height="56" rx="4" fill="rgba(20,0,40,.8)" stroke="rgba(156,39,176,.65)" stroke-width="1.5"/>'
    +'<text x="348" y="109" font-family="Courier New" font-size="8" fill="'+_COL_JARVIS_HEX+'" font-weight="700" text-anchor="middle" dominant-baseline="central">monitoring_gen.py</text>'
    +'<text x="348" y="122" font-family="Courier New" font-size="7.5" fill="rgba(206,147,216,.55)" text-anchor="middle" dominant-baseline="central">'+(xh.corr_count||0)+' corrélations</text>'
    +'<text x="348" y="133" font-family="Courier New" font-size="7.5" fill="rgba(206,147,216,.4)" text-anchor="middle" dominant-baseline="central">'+(rs.log_files||0)+' fichiers</text>'
    +_rsyFlow('M 400 106 C 432 106 430 34 448 34',_COL_FLOW_KC_HEX,'1.1s')
    +_rsyFlow('M 400 115 C 432 115 430 85 448 85',_COL_TEAL_HEX,'0.8s')
    +_rsyFlow('M 400 125 C 432 125 430 136 448 136',_COL_C2_HEX,'1.3s')
    +_rsyFlow('M 400 134 C 432 134 430 193 448 193','rgba(156,39,176,.9)','1.6s')
    +'<rect x="448" y="22" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="rgba(255,87,34,.5)" stroke-width="1.2"/>'
    +'<text x="493" y="38" font-family="Courier New" font-size="9" fill="'+_COL_FLOW_KC_HEX+'" text-anchor="middle" font-weight="700">Kill Chain</text>'
    +'<rect x="448" y="73" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="rgba(0,188,212,.5)" stroke-width="1.2"/>'
    +'<text x="493" y="89" font-family="Courier New" font-size="9" fill="var(--teal)" text-anchor="middle" font-weight="700">Score menace</text>'
    +'<rect x="448" y="124" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="rgba(255,32,96,.5)" stroke-width="1.2"/>'
    +'<text x="493" y="140" font-family="Courier New" font-size="9" fill="'+_COL_C2_HEX+'" text-anchor="middle" font-weight="700">Alertes</text>'
    +'<rect x="448" y="181" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="'+colJv+'" stroke-width="1.2"/>'
    +'<text x="493" y="197" font-family="Courier New" font-size="9" fill="'+_COL_JARVIS_HEX+'" text-anchor="middle" font-weight="700">JARVIS IA</text>'
    +'</svg>';
}
function _rsyslogStatsHtml(rs, svcCol, svc, rotStr){
  var _rsBox='background:rgba(0,188,212,.07);border:1px solid rgba(0,188,212,.2);border-radius:4px;padding:.35rem .5rem';
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .8rem;margin-bottom:.6rem">'
    +'<div style="'+_rsBox+'">'
    +'<div style="font-size:var(--fs-xs);color:rgba(0,188,212,.6);margin-bottom:.15rem">SERVICE</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:'+svcCol+'">'+esc(svc.toUpperCase())+'</div></div>'
    +'<div style="'+_rsBox+'">'
    +'<div style="font-size:var(--fs-xs);color:rgba(0,188,212,.6);margin-bottom:.15rem">DISQUE /var/log</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:rgba(185,215,240,.8)">'+(rs.disk_mb||0)+' Mo · '+(rs.disk_free_mb>=1024?((rs.disk_free_mb/1024).toFixed(1)+' Go'):((rs.disk_free_mb||0)+' Mo'))+' libre</div>'
    +'<div style="height:2px;background:rgba(255,255,255,.07);border-radius:1px;margin-top:.2rem;overflow:hidden"><div id="rs-disk-bar" style="height:100%;width:0%;border-radius:1px;transition:width 1.2s ease"></div></div></div>'
    +'<div style="'+_rsBox+'">'
    +'<div style="font-size:var(--fs-xs);color:rgba(0,188,212,.6);margin-bottom:.15rem">RÉTENTION</div>'
    +'<div style="font-size:var(--fs-sm);color:rgba(185,215,240,.7)">'+(rs.retention_days||'?')+'j · maxsize '+(rs.retention_maxsize_mb||'?')+'Mo</div></div>'
    +'<div style="'+_rsBox+'">'
    +'<div style="font-size:var(--fs-xs);color:rgba(0,188,212,.6);margin-bottom:.15rem">DERNIÈRE ROTATION</div>'
    +'<div style="font-size:var(--fs-sm);color:rgba(185,215,240,.7)">'+rotStr+'</div></div>'
    +'</div>';
}
function _rsyslogHostsTableHtml(rs, hosts, hostKeys, hostLabels){
  return '<div style="font-size:var(--fs-xs);color:var(--teal);letter-spacing:.5px;margin:.3rem 0 .3rem;border-bottom:1px solid rgba(0,188,212,.2);padding-bottom:.2rem">▸ HÔTES — '+(rs.log_files||0)+' fichiers centralisés</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:var(--fs-xs);margin-bottom:.5rem">'
    +'<thead><tr>'
    +['Hôte','Fichiers','Taille','L/min','Délai','État'].map(function(lh,i){
      return '<th style="text-align:'+(i===0?'left':'right')+';color:rgba(0,188,212,.5);font-weight:500;padding:.15rem .3rem;border-bottom:1px solid rgba(255,255,255,.06)">'+lh+'</th>';
    }).join('')
    +'</tr></thead><tbody>'
    +hostKeys.map(function(hk){
      var hd=hosts[hk]||{}, lbl=hostLabels[hk]||hk;
      var st=hd.status||'absent';
      var col=st==='ok'?'var(--green)':st==='stale'?_COL_AMBER_HEX:'rgba(160,160,160,.4)';
      var dot=st==='ok'?'●':st==='stale'?'◉':'○';
      var barId=hk;
      return '<tr style="border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<td style="padding:.2rem .3rem;font-family:\'Courier New\',monospace;color:'+col+'">'+dot+' '+esc(lbl)+'</td>'
        +'<td style="padding:.2rem .3rem;text-align:right;color:rgba(185,215,240,.6)">'+(hd.files||0)+'</td>'
        +'<td style="padding:.2rem .3rem;text-align:right;color:rgba(185,215,240,.6)">'+_fmtSz(hd.size_kb||0)+'</td>'
        +'<td style="padding:.2rem .3rem;text-align:right">'
          +'<div style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:rgba(185,215,240,.6)">'+fmt(hd.lines_min||0)+'</div>'
          +'<div style="height:2px;background:rgba(255,255,255,.07);border-radius:1px;margin-top:.1rem;overflow:hidden">'
          +'<div id="rs-lm-'+barId+'" style="height:100%;background:rgba(0,188,212,.7);border-radius:1px;width:0%;transition:width 1s ease"></div>'
          +'</div>'
        +'</td>'
        +'<td style="padding:.2rem .3rem;text-align:right;color:rgba(185,215,240,.5)">'+_fmtAgo(hd.last_ago_s)+'</td>'
        +'<td style="padding:.2rem .3rem;text-align:right;color:'+col+'">'+esc(st)+'</td>'
        +'</tr>';
    }).join('')
    +'</tbody></table>';
}
function _rsyslogAuditHtml(hosts, hostKeys, hostLabels){
  return '<div style="font-size:var(--fs-xs);color:'+_COL_JARVIS_HEX+';letter-spacing:.5px;margin:.4rem 0 .3rem;border-bottom:1px solid rgba(156,39,176,.25);padding-bottom:.2rem">▸ COUVERTURE LOGS — sources exploitées vs disponibles</div>'
    +'<div style="display:flex;flex-direction:column;gap:.2rem;margin-bottom:.5rem">'
    +hostKeys.map(function(hk){
      var hd=hosts[hk]||{}, lbl=hostLabels[hk]||hk;
      var st=hd.status||'absent';
      var col=st==='ok'?'var(--green)':st==='stale'?_COL_AMBER_HEX:'rgba(160,160,160,.4)';
      var usedArr=hd.programs_used||[], unusedArr=hd.programs_unused||[];
      var total=usedArr.length+unusedArr.length;
      var pct=total>0?Math.round(usedArr.length/total*100):0;
      var barCol=pct>=80?_COL_MATGREEN_HEX:pct>=50?_COL_AMBER_HEX:_COL_RED_HEX;
      var usedBadges=usedArr.map(function(p){
        return '<span style="background:rgba(0,230,118,.1);border:1px solid rgba(0,230,118,.3);border-radius:2px;padding:.02rem .22rem;font-size:calc(var(--fs-xs) - 1px);color:rgba(0,230,118,.85);white-space:nowrap">'+esc(p)+'</span>';
      }).join('');
      var unusedBadges=unusedArr.map(function(p){
        return '<span style="background:rgba(255,179,0,.07);border:1px solid rgba(255,179,0,.25);border-radius:2px;padding:.02rem .22rem;font-size:calc(var(--fs-xs) - 1px);color:rgba(255,179,0,.65);white-space:nowrap">'+esc(p)+'</span>';
      }).join('');
      return '<div style="display:grid;grid-template-columns:5.5rem 1fr auto;gap:.2rem .4rem;padding:.28rem .3rem;border-bottom:1px solid rgba(255,255,255,.04);align-items:start">'
        +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:'+col+';padding-top:.08rem">● '+esc(lbl)+'</span>'
        +'<div>'
        +(usedBadges?'<div style="display:flex;flex-wrap:wrap;gap:.12rem .2rem;margin-bottom:'+(unusedBadges?'.12rem':'0')+'">'+usedBadges+'</div>':'')
        +(unusedBadges?'<div style="display:flex;flex-wrap:wrap;gap:.12rem .2rem;align-items:center"><span style="font-size:calc(var(--fs-xs)-1px);color:rgba(255,179,0,.4);margin-right:.05rem">⚠</span>'+unusedBadges+'</div>':'')
        +(!usedBadges&&!unusedBadges?'<span style="font-size:var(--fs-xs);color:rgba(185,215,240,.25);font-style:italic">aucun log disponible</span>':'')
        +'</div>'
        +'<span style="font-size:calc(var(--fs-xs)-1px);font-family:\'Courier New\',monospace;color:'+barCol+';white-space:nowrap;padding-top:.1rem">'+pct+'%</span>'
        +'</div>';
    }).join('')
    +'</div>';
}
function _rsyslogAlertsHtml(xh){
  // wanAlertHtml + topDstHtml retirés 2026-05-17 (architecture LAN unique Freebox)
  var cc=xh.corr_count||0;
  return cc>0
    ?'<div style="background:rgba(255,32,96,.08);border:1px solid rgba(255,32,96,.25);border-radius:4px;padding:.3rem .5rem;margin-bottom:.4rem">'
      +'<div style="font-size:var(--fs-xs);color:'+_COL_C2_HEX+';font-weight:700">⚠ CORRÉLATION ACTIVE — '+cc+' IP'+(cc>1?'s':'')+' kill chain dans plusieurs hôtes</div>'
      +'<div style="font-size:var(--fs-xs);color:rgba(185,215,240,.5);margin-top:.1rem">Présence multi-VM (clt + pa85 ou srv-nginx)</div>'
      +'</div>'
    :'';
}
function _rsyslogEventsHtml(d){
  var evts=(d.events||[]);
  // dhcp_lease / wan_restored / wan_down retirés 2026-05-17
  var _evtIcon={'f2b_ban':'🚫','f2b_unban':'✓','http_scan':'⚡','vm_event':'⚙','ssh_fail':'🔑','backup_fail':'💾','backup_ok':'✅','fw_drop':'🛡'};
  var _evtCol={'f2b_ban':_COL_RED_HEX,'f2b_unban':_COL_MATGREEN_HEX,'http_scan':_COL_MATORANGE_HEX,'vm_event':_COL_TEAL_HEX,'ssh_fail':_COL_RED_HEX,'backup_fail':_COL_MATORANGE_HEX,'backup_ok':_COL_MATGREEN_HEX,'fw_drop':_COL_JARVIS_HEX};
  var mc2=(d.xhosts||{}).multi_count||0;
  var multiWarnHtml=mc2>0
    ?'<div style="background:rgba(255,152,0,.08);border:1px solid rgba(255,152,0,.3);border-radius:3px;padding:.25rem .45rem;margin-bottom:.3rem;font-size:var(--fs-xs);color:var(--matorange)">⚠ '+mc2+' IP'+(mc2>1?'s':'')+' en recon multi-cibles (clt + pa85, sous seuil fail2ban)</div>'
    :'';
  return multiWarnHtml
    +'<div style="font-size:var(--fs-xs);color:rgba(185,215,240,.45);letter-spacing:.5px;margin:.4rem 0 .25rem;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:.2rem">▸ ÉVÉNEMENTS STRUCTURÉS — 24h</div>'
    +(evts.length
      ?'<div style="font-family:\'Courier New\',monospace;font-size:calc(var(--fs-xs) - 1px);line-height:1.7">'
        +evts.slice(0,12).map(function(e){
          var ic=_evtIcon[e.type]||'●', cl=_evtCol[e.type]||'rgba(185,215,240,.5)';
          return '<div style="display:flex;gap:.35rem;border-bottom:1px solid rgba(255,255,255,.03);padding:.08rem 0;align-items:center">'
            +'<span style="color:rgba(185,215,240,.32);flex-shrink:0;min-width:5.5rem">'+esc(e.ts)+'</span>'
            +'<span style="color:'+cl+';flex-shrink:0;width:1rem;text-align:center">'+ic+'</span>'
            +'<span style="color:rgba(185,215,240,.45);flex-shrink:0;min-width:3rem">'+esc(e.host)+'</span>'
            +(e.ip?'<span style="color:rgba(185,215,240,.75);flex-shrink:0;min-width:9rem">'+esc(e.ip)+'</span>':'<span style="min-width:9rem"></span>')
            +'<span style="color:rgba(185,215,240,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.detail||e.type)+'</span>'
            +'</div>';
        }).join('')
        +'</div>'
      :'<div style="font-size:var(--fs-xs);color:rgba(185,215,240,.28);font-style:italic;padding:.15rem 0">Aucun événement sécurité dans les dernières 24h — infrastructure calme</div>');
}
function _rsyslogAiPanelHtml(){
  return '<div style="border-top:1px solid rgba(156,39,176,.2);padding-top:.45rem;margin-top:.35rem">'
    +'<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">'
    +'<button id="rs-ai-btn" style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(156,39,176,.12);border:1px solid rgba(156,39,176,.45);color:'+_COL_JARVIS_HEX+';border-radius:3px;padding:.22rem .55rem;cursor:pointer;letter-spacing:.3px">⚙ SYNTHÈSE IA — RTX 5080</button>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(206,147,216,.38)">JARVIS · '+esc(typeof _jvActiveModel!=='undefined'&&_jvActiveModel?_jvActiveModel:'phi4-reasoning')+' · logs injectés</span>'
    +'</div>'
    +'<div id="rs-hist-pills" style="display:none;margin-bottom:.3rem"></div>'
    +'<div id="rs-ai-info-bar" style="display:none;background:rgba(156,39,176,.08);border:1px solid rgba(156,39,176,.2);border-radius:3px 3px 0 0;border-bottom:none;padding:.18rem .52rem">'
      +'<div style="display:flex;align-items:center;gap:.5rem">'
        +'<span id="rs-ai-info-label" style="flex:1;font-family:\'Courier New\',monospace;font-size:calc(var(--fs-xs) - 1px);color:rgba(206,147,216,.6)"></span>'
        +'<button id="rs-ai-info-close" style="background:transparent;border:none;color:rgba(156,39,176,.55);cursor:pointer;font-size:calc(var(--fs-xs) - 1px);padding:0 .15rem;line-height:1" title="Fermer">✕</button>'
      +'</div>'
    +'</div>'
    +'<div id="rs-ai-out" style="display:none;background:rgba(10,0,20,.65);border:1px solid rgba(156,39,176,.2);border-radius:4px;padding:.45rem .55rem;font-size:var(--fs-xs);line-height:1.55;min-height:1.8rem;white-space:pre-wrap"></div>'
    +'<div id="rs-action-panel" class="hidden"></div>'
    +'</div>';
}
function _rsyslogAfterRender(d, rs, xh, hosts, hostKeys, hostLabels, h){
  var mc=document.getElementById('modal-card');
  var mb=document.getElementById('modal-body'), mht=document.getElementById('modal-header-title');
  if(!mc||!mb||!mht)return;
  mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-kci','modal-fbx','modal-geomap','theme-red','theme-green','theme-cyan','theme-purple','theme-orange','theme-yellow');
  mht.textContent='// LOGS CENTRAUX — rsyslog';
  mb.innerHTML=h;
  setTimeout(function(){
    var _lmMax=Math.max.apply(null,hostKeys.map(function(k){return (hosts[k]||{}).lines_min||0;}).concat([1]));
    hostKeys.forEach(function(hk){
      var b=document.getElementById('rs-lm-'+hk);
      if(b)b.style.width=Math.min(100,Math.round(((hosts[hk]||{}).lines_min||0)/_lmMax*100))+'%';
    });
    var _db=document.getElementById('rs-disk-bar');
    if(_db){var _dm=rs.disk_mb||0,_df=rs.disk_free_mb||0;var _dp=_dm+_df>0?Math.min(100,Math.round(_dm/(_dm+_df)*100)):0;_db.style.width=_dp+'%';_db.style.background=_dp>80?_COL_RED_HEX:_dp>50?_COL_MATORANGE_HEX:_COL_TEAL_HEX;}
  },80);
  mb.querySelectorAll('.rs-ban-btn').forEach(function(btn){btn.addEventListener('click',function(){_kcBanIP(btn.dataset.ip,btn);});});
  var _jvAllBtn=document.getElementById('rs-jv-all');
  if(_jvAllBtn){
    // router_seen retiré 2026-05-17
    var _maAll=Object.keys((d.xhosts||{}).multi_apache||{});
    var _allIps=[],_seenAll={};
    _maAll.forEach(function(ip){if(!_seenAll[ip]){_seenAll[ip]=1;_allIps.push(ip);}});
    _jvAllBtn.addEventListener('click',function(){
      if(_jvAllBtn._busy)return;
      _jvAllBtn._busy=true;_jvAllBtn.disabled=true;_jvAllBtn.textContent='◈ JARVIS EN COURS...';
      var _done=0;
      _allIps.forEach(function(ip,idx){
        setTimeout(function(){
          _kcBanIP(ip,{dataset:{ip:ip},textContent:'',disabled:false,_busy:false,addEventListener:function(){}});
          _done++;
          if(_done>=_allIps.length){_jvAllBtn.textContent='✓ JARVIS — '+_done+' IP'+(_done>1?'s':'')+' bannies';_jvAllBtn.classList.add('jv-all-ban-ok');_jvAllBtn._busy=false;_jvAllBtn.disabled=false;}
        },idx*350);
      });
    });
  }
  _rsyslogRenderHistoryPills(_rsyslogGetHistory());
  var _aiBtn=document.getElementById('rs-ai-btn');
  if(_aiBtn) _aiBtn.addEventListener('click',function(){_rsyslogJarvisSynth(rs,xh,hosts,hostKeys,hostLabels,_aiBtn);});
  openModal();
}
function openRsyslogModal(){
  var d=window._lastData||{};
  var rs=d.rsyslog||{}, xh=d.xhosts||{};
  var svc=rs.service||'unknown', svcOk=svc==='active';
  var svcCol=svcOk?'var(--green)':'var(--red)';
  var hosts=rs.hosts||{};
  // retiré 2026-05-17 (5 hôtes)
  var _hkOrder=['clt','pa85','pve','srv-dev-1'];
  var hostKeys=Object.keys(hosts).sort(function(a,b){
    var ia=_hkOrder.indexOf(a),ib=_hkOrder.indexOf(b);
    if(ia>=0&&ib>=0)return ia-ib;
    if(ia>=0)return -1;
    if(ib>=0)return 1;
    return a.localeCompare(b);
  });
  var hostLabels={};
  var rotTs=rs.last_rotate_ts, rotStr='—';
  if(rotTs){var rd=new Date(rotTs);rotStr=rd.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' '+rd.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
  var colClt=_rsyHCol(hosts,'clt'), colPa85=_rsyHCol(hosts,'pa85'), colPve=_rsyHCol(hosts,'pve'), colDev1=_rsyHCol(hosts,'srv-dev-1');
  var svg=_rsyslogSvgHtml(hosts, svcOk, colClt, colPa85, colPve, colDev1, xh, rs);
  var statsHtml=_rsyslogStatsHtml(rs, svcCol, svc, rotStr);
  var hostsTableHtml=_rsyslogHostsTableHtml(rs, hosts, hostKeys, hostLabels);
  var auditHtml=_rsyslogAuditHtml(hosts, hostKeys, hostLabels);
  var alertsHtml=_rsyslogAlertsHtml(xh);
  var eventsHtml=_rsyslogEventsHtml(d);
  var aiHtml=_rsyslogAiPanelHtml();
  var defChainHtml=_rsyslogDefChainHtml(d,rs,xh);
  var jarvisProactiveHtml=_rsyslogJarvisProactiveHtml(d,xh);
  var h=svg+statsHtml+hostsTableHtml+auditHtml+defChainHtml+alertsHtml+eventsHtml+jarvisProactiveHtml+aiHtml;
  _rsyslogAfterRender(d, rs, xh, hosts, hostKeys, hostLabels, h);
}
// NDT-179 — _rsyslogJarvisSynth: synthèse IA via JARVIS SSE · logs injectés · think-filter phi4
function _rsyslogJarvisSynth(rs,xh,hosts,hostKeys,hostLabels,btn){
  var out=document.getElementById('rs-ai-out');
  if(!out||btn._busy)return;
  btn._busy=true; btn.disabled=true; btn.textContent='⏳ Analyse en cours...';
  out.style.display='block'; out.textContent='';
  _rsyslogSetInfoBar('loading');
  var lines=[
    'Tu es JARVIS, analyste SOC expert. Analyse la chaîne rsyslog de l\'infrastructure 0xCyberLiTech.',
    'Génère une synthèse professionnelle en français (8-12 phrases). Sois précis, factuel et actionnable.\n',
    '=== INFRASTRUCTURE RSYSLOG — '+new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})+' ===',
    'Service: '+(rs.service||'?')+' | Rétention: '+rs.retention_days+'j/'+rs.retention_maxsize_mb+'Mo | '+(rs.log_files||0)+' fichiers\n',
    _RSYSLOG_JARVIS_CTX
  ];
  hostKeys.forEach(function(hk){
    var hd=hosts[hk]||{}, lbl=hostLabels[hk]||hk;
    lines.push('● '+lbl+' ['+( hd.status||'absent')+'] '+( hd.files||0)+' fichiers · '+_fmtSz(hd.size_kb||0)+' · '+(hd.lines_min||0)+' L/min');
    lines.push('  Exploités SOC: '+((hd.programs_used||[]).join(', ')||'AUCUN'));
    lines.push('  Non exploités (disponibles): '+((hd.programs_unused||[]).join(', ')||'—'));
    lines.push('');
  });
  var cc=xh.corr_count||0, mc=xh.multi_count||0;
  lines.push('=== CORRÉLATIONS ET MENACES ===');
  lines.push(cc>0?'⚠ '+cc+' IP(s) en corrélation cross-hôtes (clt + pa85 / srv-nginx)':'Pas de corrélation cross-hôtes active.');
  lines.push(mc>0?'⚠ '+mc+' IP(s) recon multi-cibles (clt + pa85 sous seuil fail2ban)':'Pas de recon multi-cibles.');
  // wan_reconnects_24h / router_top_dst retirés 2026-05-17
  var evList=((window._lastData||{}).events||[]);
  if(evList.length){
    lines.push('\n=== ÉVÉNEMENTS STRUCTURÉS 24H ('+evList.length+') ===');
    evList.slice(0,20).forEach(function(e){
      lines.push('['+e.ts+'] '+e.type+' | hôte:'+( e.host||'?')+' | ip:'+(e.ip||'—')+' | '+( e.detail||''));
    });
  } else {
    lines.push('\n=== ÉVÉNEMENTS STRUCTURÉS 24H ===\nAucun événement sécurité — infrastructure calme au moment de la synthèse.');
  }
  lines.push('\n=== DEMANDE ===\nSynthèse SOC professionnelle (8-12 phrases) :\n(1) Santé de la collecte rsyslog — hôtes actifs, volumes, stabilité\n(2) Couverture : ne signaler comme lacune que les sources NON vides et réellement non exploitées\n(3) Menaces réelles uniquement — corrélations kill chain, scans détectés, bans fail2ban, SSH brute force\n(4) WAN : évaluer si instabilité FAI/matériel ou corrélée à une menace\n(5) Recommandations concrètes basées UNIQUEMENT sur les données présentes — ne pas recommander d\'activer des logs vides');
  fetch(JV_URL+'/api/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({history:[{role:'user',content:lines.join('\n')}],soc_ctx_injected:true,num_predict:700})
  })
  .then(function(resp){
    if(!resp.ok){out.textContent='Erreur JARVIS HTTP '+resp.status;_rsyslogSetInfoBar(null);_rsyslogAiReset(btn);return;}
    var reader=resp.body.getReader(),dec=new TextDecoder(),buf='',full='';
    function pump(){
      reader.read().then(function(chunk){
        if(chunk.done){var _fd=full.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/<think>[\s\S]*/,'').trim();_rsyslogSaveHistory(_fd);out.innerHTML=_rsyslogFmtSynth(_fd);out.style.whiteSpace='normal';out.style.fontFamily='inherit';_rsyslogAiReset(btn,true);_rsyslogSetInfoBar('fresh',new Date().toISOString());_rsyslogShowThreatActions(xh);return;}
        buf+=dec.decode(chunk.value,{stream:true});
        var idx;
        while((idx=buf.indexOf('\n\n'))!==-1){
          var evt=buf.slice(0,idx);buf=buf.slice(idx+2);
          evt.split('\n').forEach(function(ln){
            if(!ln.startsWith('data: '))return;
            try{var o=JSON.parse(ln.slice(6));
              if(o.type==='token'&&o.token){
                full+=o.token;
                // Filtre les blocs de raisonnement <think>...</think> de phi4-reasoning
                var display=full.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/<think>[\s\S]*/,'').trim();
                out.textContent=display||'...';
              }
            }catch(e){}
          });
        }
        pump();
      }).catch(function(e){out.textContent+=(out.textContent?'\n':'')+'[stream interrompu: '+e.message+']';_rsyslogSetInfoBar(null);_rsyslogAiReset(btn);});
    }
    pump();
  })
  .catch(function(e){out.textContent='JARVIS non disponible (localhost:5000) — '+e.message;_rsyslogSetInfoBar(null);_rsyslogAiReset(btn);});
}
function _rsyslogAiReset(btn,ok){var _m=typeof _jvActiveModel!=='undefined'&&_jvActiveModel?_jvActiveModel:'phi4-reasoning';btn._busy=false;btn.disabled=false;btn.textContent=ok?'↺ NOUVELLE SYNTHÈSE':'⚙ SYNTHÈSE IA — '+_m;}
// NDT-180 — Actions défensives proactives : IPs C2 + recon multi-cibles proposées au ban après synthèse JARVIS
function _rsyslogShowThreatActions(xh){
  var panel=document.getElementById('rs-action-panel');
  if(!panel)return;
  // C2 outbound retiré 2026-05-17
  // IPs recon multi-cibles : ont frappé clt ET pa85, pas encore bannies
  var maIps=Object.keys(xh.multi_apache||{});
  var seen={};
  var threats=[];
  maIps.forEach(function(ip){
    if(!seen[ip]){seen[ip]='ma';threats.push({ip:ip,cat:'RECON MULTI-CIBLES',col:_COL_MATORANGE_HEX,rgb:'255,152,0'});}
  });
  if(!threats.length)return;
  var html='<div style="border-top:1px solid rgba(255,32,96,.2);padding-top:.4rem;margin-top:.35rem">'
    +'<div style="font-size:var(--fs-xs);color:'+_COL_BAN_BTN_HEX+';font-weight:700;letter-spacing:.3px;margin-bottom:.28rem">⚠ '+threats.length+' IP'+(threats.length>1?'s MENACES — ACTIONS DÉFENSIVES DISPONIBLES':' MENACE — ACTION DÉFENSIVE DISPONIBLE')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:.2rem">'
    +threats.map(function(t){
      var bg='rgba('+t.rgb+',.07)',bd='rgba('+t.rgb+',.22)';
      return '<div style="display:flex;align-items:center;gap:.5rem;background:'+bg+';border:1px solid '+bd+';border-radius:3px;padding:.18rem .4rem">'
        +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:'+t.col+';min-width:10rem;font-weight:600">'+esc(t.ip)+'</span>'
        +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.45);flex:1">'+esc(t.cat)+'</span>'
        +'<button class="rs-ban-btn" data-ip="'+esc(t.ip)+'" style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(255,32,96,.15);border:1px solid rgba(255,32,96,.4);color:'+_COL_BAN_BTN_HEX+';border-radius:3px;padding:.15rem .45rem;cursor:pointer;letter-spacing:.2px">🚫 BANNIR 24h</button>'
        +'</div>';
    }).join('')
    +'</div>'
    +'</div>';
  panel.innerHTML=html;
  panel.style.display='block';
  panel.querySelectorAll('.rs-ban-btn').forEach(function(btn){
    btn.addEventListener('click',function(){_kcBanIP(btn.dataset.ip,btn);});
  });
}
// NDT-181b — Barre d'info résultat : état analyse courante vs historique
function _rsyslogSetInfoBar(type,ts){
  var bar=document.getElementById('rs-ai-info-bar');
  var lbl=document.getElementById('rs-ai-info-label');
  var out=document.getElementById('rs-ai-out');
  if(!bar||!lbl)return;
  if(!type){
    bar.style.display='none';
    if(out){out.style.borderRadius='4px';out.style.borderTop='';}
    return;
  }
  var d=ts?new Date(ts):new Date();
  var dateStr=d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  var text=type==='loading'?'⏳ JARVIS — Analyse en cours...'
          :type==='fresh'?'⊙ JARVIS — Analyse du '+dateStr
          :type==='history'?'◀ HISTORIQUE — Analyse du '+dateStr
          :type;
  lbl.textContent=text;
  bar.style.display='block';
  if(out){out.style.borderRadius='0 0 4px 4px';out.style.borderTop='none';}
  var closeBtn=document.getElementById('rs-ai-info-close');
  if(closeBtn) closeBtn.onclick=function(){
    _rsyslogSetInfoBar(null);
    if(out){out.style.display='none';out.textContent='';}
    _rsHistPillsReset();
  };
}
function _rsHistPillsReset(ctx){ (ctx||document).querySelectorAll('.rs-hist-pill').forEach(function(b){ b.classList.remove('rs-hist-pill--active'); }); }
// NDT-181 — Historique synthèses JARVIS · localStorage · 7 jours · purge auto
var _RS_HIST_KEY='soc_rsyslog_synth_hist';
function _rsyslogGetHistory(){
  try{
    var raw=localStorage.getItem(_RS_HIST_KEY);
    if(!raw)return[];
    var cutoff=Date.now()-7*_MS_PER_DAY;
    return JSON.parse(raw).filter(function(e){return new Date(e.ts).getTime()>cutoff;});
  }catch(e){return[];}
}
function _rsyslogSaveHistory(text){
  if(!text)return;
  try{
    var hist=_rsyslogGetHistory();
    hist.unshift({ts:new Date().toISOString(),text:text});
    localStorage.setItem(_RS_HIST_KEY,JSON.stringify(hist.slice(0,50)));
    _rsyslogRenderHistoryPills(hist);
  }catch(e){}
}
function _rsyslogFmtHistLabel(iso){
  try{
    var d=new Date(iso),now=new Date();
    var hm=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    if(d.toDateString()===now.toDateString())return hm;
    var diff=Math.floor((now-d)/_MS_PER_DAY);
    if(diff===1)return 'Hier '+hm;
    return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' '+hm;
  }catch(e){return iso;}
}
function _rsyslogRenderHistoryPills(hist){
  var c=document.getElementById('rs-hist-pills');
  if(!c)return;
  if(!hist||!hist.length){c.style.display='none';c.innerHTML='';return;}
  var n=Math.min(hist.length,14);
  c.style.display='block';
  c.innerHTML=
    '<div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.18rem">'
      +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(156,39,176,.7);font-family:\'Courier New\',monospace;letter-spacing:.3px">◈ HISTORIQUE</span>'
      +'<span style="font-size:calc(var(--fs-xs) - 2px);background:rgba(156,39,176,.12);border:1px solid rgba(156,39,176,.28);border-radius:8px;padding:.02rem .22rem;color:rgba(206,147,216,.55);font-family:\'Courier New\',monospace">'+n+'</span>'
      +'<button id="rs-hist-purge" title="Effacer tout l\'historique" style="margin-left:auto;font-family:\'Courier New\',monospace;font-size:calc(var(--fs-xs) - 1px);background:transparent;border:1px solid rgba(255,59,92,.2);color:rgba(255,100,120,.45);border-radius:2px;padding:.05rem .28rem;cursor:pointer">⊘ purger</button>'
    +'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:.15rem .22rem">'
      +hist.slice(0,14).map(function(e,i){
          return '<button class="rs-hist-pill" data-idx="'+i+'" title="'+esc(e.text.slice(0,120))+'...">'+esc(_rsyslogFmtHistLabel(e.ts))+'</button>';
        }).join('')
    +'</div>';
  c.querySelectorAll('.rs-hist-pill').forEach(function(btn){
    btn.addEventListener('click',function(){
      var entry=_rsyslogGetHistory()[parseInt(btn.dataset.idx,10)];
      if(!entry)return;
      var out=document.getElementById('rs-ai-out');
      if(out){out.innerHTML=_rsyslogFmtSynth(entry.text);out.style.whiteSpace='normal';out.style.fontFamily='inherit';out.style.display='block';}
      _rsHistPillsReset(c);
      btn.classList.add('rs-hist-pill--active');
      _rsyslogSetInfoBar('history',entry.ts);
    });
  });
  var purgeBtn=document.getElementById('rs-hist-purge');
  if(purgeBtn) purgeBtn.addEventListener('click',function(){
    try{localStorage.removeItem(_RS_HIST_KEY);}catch(e){}
    c.style.display='none'; c.innerHTML='';
    var out=document.getElementById('rs-ai-out');
    if(out){out.style.display='none';out.textContent='';}
    var panel=document.getElementById('rs-action-panel');
    if(panel){panel.style.display='none';panel.innerHTML='';}
    _rsyslogSetInfoBar(null);
  });
}
// NDT-182 — Post-formatteur synthèse JARVIS : niveau menace badge, sections numérotées, bullets
function _rsyslogFmtSynth(raw){
  if(!raw||!raw.trim())return'';
  var tlMatch=raw.match(/Niveau\s+de\s+menace\s+global\s*:\s*(\S+)/i);
  var tlWord=tlMatch?tlMatch[1].toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,''):'';
  var tlCols={FAIBLE:'0,230,118',MODERE:'255,179,0',ELEVE:'255,152,0',CRITIQUE:'255,59,92'};
  var tlRgb=tlCols[tlWord]||'0,188,212';
  var tlHex={'0,230,118':_COL_MATGREEN_HEX,'255,179,0':_COL_AMBER_HEX,'255,152,0':_COL_MATORANGE_HEX,'255,59,92':_COL_RED_HEX,'0,188,212':_COL_TEAL_HEX}[tlRgb]||_COL_TEAL_HEX;
  var html='';
  raw.split('\n').forEach(function(line){
    var t=line.trim();
    if(!t){html+='<div style="height:.25rem"></div>';return;}
    if(/Niveau\s+de\s+menace\s+global/i.test(t)){
      var sep=t.indexOf(':');
      html='<div style="display:flex;align-items:center;gap:.5rem;padding:.15rem 0 .35rem;border-bottom:1px solid rgba('+tlRgb+',.2);margin-bottom:.35rem">'
        +'<span style="font-size:var(--fs-xs);color:rgba(185,215,240,.45)">'+esc(sep>=0?t.slice(0,sep+1).trim():t)+'</span>'
        +(sep>=0?'<span style="background:rgba('+tlRgb+',.13);border:1px solid rgba('+tlRgb+',.45);border-radius:3px;padding:.08rem .45rem;font-size:var(--fs-xs);font-weight:700;color:'+tlHex+';letter-spacing:.6px;font-family:\'Courier New\',monospace">'+esc(t.slice(sep+1).trim())+'</span>':'')
        +'</div>'+html;
      return;
    }
    var numM=t.match(/^(\d+)\.\s+(.+)/);
    if(numM){
      html+='<div style="display:flex;gap:.45rem;margin-top:.35rem;align-items:baseline">'
        +'<span style="background:rgba(0,188,212,.1);border:1px solid rgba(0,188,212,.28);border-radius:2px;padding:.02rem .22rem;font-size:calc(var(--fs-xs) - 1px);color:var(--teal);font-weight:700;flex-shrink:0;font-family:\'Courier New\',monospace">'+esc(numM[1])+'</span>'
        +'<span style="color:rgba(185,215,240,.88);font-size:var(--fs-xs);line-height:1.55">'+esc(numM[2])+'</span>'
        +'</div>';
      return;
    }
    if(/^\s{1,6}[-–]\s+/.test(line)){
      html+='<div style="display:flex;gap:.3rem;padding-left:1.3rem;margin:.06rem 0">'
        +'<span style="color:rgba(0,188,212,.4);flex-shrink:0;font-size:var(--fs-xs)">▸</span>'
        +'<span style="color:rgba(185,215,240,.6);font-size:var(--fs-xs);line-height:1.5">'+esc(t.replace(/^[-–]\s+/,''))+'</span>'
        +'</div>';
      return;
    }
    if(/Ceci\s+constitue/i.test(t)){
      html+='<div style="margin-top:.35rem;padding-top:.28rem;border-top:1px solid rgba(185,215,240,.07);font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3);font-style:italic">'+esc(t)+'</div>';
      return;
    }
    if(/Synth[eè]se\s+SOC/i.test(t)&&t.length<70){
      html+='<div style="font-size:calc(var(--fs-xs) + 1px);color:rgba(206,147,216,.55);font-weight:600;margin-bottom:.15rem;letter-spacing:.3px">'+esc(t)+'</div>';
      return;
    }
    html+='<div style="color:rgba(185,215,240,.7);font-size:var(--fs-xs);line-height:1.55;padding:.04rem 0">'+esc(t)+'</div>';
  });
  return html;
}
// NDT-159 — _fmtAgo + _fmtSz partagées par openRsyslogModal + _renderRsyslogTile
function _fmtAgo(s){return s===null||s===undefined?'—':s<60?s+'s':s<3600?Math.floor(s/60)+'min':Math.floor(s/3600)+'h';}
function _fmtSz(kb){return kb>=1024?(kb/1024).toFixed(1)+' Mo':kb+'Ko';}
// NDT-177 — extracted from _renderRsyslogTile: host status row (closure hosts → explicit param)
function _hostRow(name,label,hostsMap){
  var lbl=label||name;
  var h=hostsMap[name]||{};
  var st=h.status||'absent';
  var col=st==='ok'?'var(--green)':st==='stale'?_COL_AMBER_HEX:'rgba(180,180,180,.45)';
  var dot=st==='ok'?'●':st==='stale'?'◉':'○';
  var agoStr=_fmtAgo(h.last_ago_s);
  var szStr=_fmtSz(h.size_kb||0);
  var lpm=h.lines_min||0;
  return '<div style="display:grid;grid-template-columns:1rem max-content 1fr auto auto auto;align-items:center;gap:.3rem .5rem;padding:.22rem 0;border-bottom:1px solid rgba(255,255,255,.05)">'
    +'<span style="color:'+col+';font-size:var(--fs-sm)">'+dot+'</span>'
    +'<span style="color:rgba(185,215,240,.85);font-family:\'Courier New\',monospace;font-size:var(--fs-xs);white-space:nowrap">'+lbl+'</span>'
    +'<span style="color:rgba(185,215,240,.35);font-size:var(--fs-xs)">'+(h.files||0)+' fichiers</span>'
    +'<span style="color:rgba(0,188,212,.7);font-size:var(--fs-xs)">'+szStr+'</span>'
    +'<span style="color:rgba(185,215,240,.45);font-size:var(--fs-xs)">'+lpm+' L/min</span>'
    +'<span style="color:'+col+';font-size:var(--fs-xs);font-weight:700;min-width:2.4rem;text-align:right">'+agoStr+'</span>'
    +'</div>';
}

function _renderRsyslogTile(d,g){
  var rs=d.rsyslog||{};
  var svc=rs.service||'unknown';
  var svcOk=svc==='active';
  var svcCol=svcOk?'var(--green)':'var(--red)';
  var svcLbl=svcOk?'● ACTIF':'● INACTIF';
  var diskMb=rs.disk_mb||0;
  var diskFreeMb=rs.disk_free_mb||0;
  var diskStr=diskMb>=1024?(diskMb/1024).toFixed(1)+' Go':diskMb+' Mo';
  var freeStr=diskFreeMb>=1024?(diskFreeMb/1024).toFixed(1)+' Go libre':diskFreeMb+' Mo libre';
  var hosts=rs.hosts||{};
  var rotTs=rs.last_rotate_ts;
  var rotStr='—';
  if(rotTs){var rotD=new Date(rotTs);rotStr=rotD.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' '+rotD.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
  var h='<div class="card" id="rsyslog-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct" style="color:var(--teal)"><span class="ct-icon">⊙</span>LOGS CENTRAUX<span data-panel="RÔLE : point de collecte unique — clt · pa85 · pve · srv-dev-1 envoient leurs logs vers srv-nginx via rsyslog port 514 TCP/UDP. Logs couverts : système · Apache · fail2ban · kernel · syslog. MÉTRIQUES SURVEILLÉES : cadence L/min par hôte (0 L/min = source silencieuse = anomalie) · espace disque /var/log · rétention logrotate 7j · horodatage dernière rotation. COMPORTEMENT ATTENDU : tous les hôtes actifs en vert · L/min > 0 · rotation < 24h. JARVIS (si online) : détecte automatiquement toute source tombée à 0 L/min et émet une alerte vocale TTS. Analyse ensuite les IPs récurrentes via LLM phi4-reasoning. Si aucune action humaine dans les 5 min suivant une détection, JARVIS bannit proactivement via CrowdSec et inscrit chaque décision avec justification dans son journal (JARVIS localhost:5000 → onglet ◈ SOC). NB : routeur retiré le 2026-05-17." data-panel-title="LOGS CENTRAUX — RSYSLOG" class="soc-panel-i" style="--pi-dim:rgba(0,217,255,.65);--pi-bright:rgba(0,217,255,.9);--pi-glow:rgba(0,217,255,.5);margin-left:.45rem">ⓘ</span></div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">'
    +'<span style="font-size:var(--fs-xs);font-family:\'Courier New\',monospace;color:'+svcCol+';font-weight:700">'+svcLbl+'</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(185,215,240,.5)">'+(rs.log_files||0)+' logs · '+diskStr+' utilisé · '+freeStr+'</span>'
    +'</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem;padding-bottom:.3rem;border-bottom:1px solid rgba(0,188,212,.15)">'
    +'<span style="font-size:var(--fs-xs);color:rgba(0,188,212,.5);letter-spacing:.3px">/var/log/central/ · rétention '+(rs.retention_days||'?')+'j · maxsize '+(rs.retention_maxsize_mb||'?')+'Mo</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(185,215,240,.35)">rotation '+rotStr+'</span>'
    +'</div>'
    +(function(){var xh=d.xhosts||{},cc=xh.corr_count||0;
      var col=cc>0?_COL_C2_HEX:'rgba(185,215,240,.3)';
      return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem;padding:.18rem .1rem;background:rgba(0,188,212,.04);border-radius:3px">'
        +'<span style="font-size:var(--fs-xs);color:rgba(0,188,212,.6)">⊙ Corrélation cross-hôtes (clt+pa85+nginx)</span>'
        +'<span style="font-size:var(--fs-xs);color:'+col+';font-weight:700">'+(cc>0?cc+' IP'+( cc>1?'s':'')+' actives':'0 — RAS')+'</span>'
        +'</div>';
    })()
    +'<div style="display:grid;grid-template-columns:1rem max-content 1fr auto auto auto;gap:.1rem .5rem;padding:.1rem 0 .25rem;margin-bottom:.1rem">'
    +'<span></span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">hôte</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">fichiers</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">taille</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">activité</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3);text-align:right">délai</span>'
    +'</div>'
    +Object.keys(hosts).filter(function(k){return !/^router-legacy/i.test(k);}).map(function(k){return _hostRow(k,k,hosts);}).join('')
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}
