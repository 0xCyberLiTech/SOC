'use strict';
// ════════════════════════════════════════════════════════
// ROUTEUR GT-BE98 — SSH MONITOR
// ════════════════════════════════════════════════════════
// fmtKbps → 01-utils.js (NDT-146)
function fmtMB(b){if(!b)return'0 B';if(b>=1073741824)return(b/1073741824).toFixed(2)+' GB';if(b>=1048576)return(b/1048576).toFixed(1)+' MB';return(b/1024).toFixed(0)+' KB';}

function buildRouterTile(rd){
  var avail=rd&&rd.available;
  var _tileLbl=rd&&rd.model?esc(rd.model):'—';
  var stCol=avail?'var(--green)':'var(--c-muted-4)';
  var dot='<span style="color:'+stCol+';margin-left:.3rem">●</span>';

  if(!avail){
    return '<div class="card" id="router-tile" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
      +'<div class="ct c"><span class="ct-icon">⟁</span>'+_tileLbl+dot+'</div>'
      +'<div style="font-size:var(--fs-xs);color:var(--muted);text-align:center;padding:.9rem 0 .7rem">'
      +'<div style="font-size:var(--fs-3xl);opacity:.15;margin-bottom:.3rem">⟁</div>'
      +'En attente données SSH…<br><span style="opacity:.45;font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">router-report.py</span>'
      +'</div></div></div>';
  }

  var wan=rd.wan||{},mem=rd.memory||{},cpu=rd.cpu||{},sec=rd.security||{};
  var cpuLoad=cpu.load5||0,cpuPct=Math.min(100,Math.round(cpuLoad*20));
  var memPct=mem.used_pct||0;
  var cpuC=cpuLoad>3?'pb-r':cpuLoad>1.5?'pb-y':'pb-g';
  var memC=memPct>80?'pb-r':memPct>60?'pb-y':'pb-g';

  // Score réseau
  var _rs=computeRouterScore(rd,window._routerFlows||null);
  var _rsBar=Math.min(100,_rs.score);
  var _rsBg=_rs.score>=70?'rgba(255,59,92,.12)':_rs.score>=45?'rgba(255,107,53,.1)':_rs.score>=20?'rgba(255,215,0,.08)':'rgba(0,217,100,.08)';
  var _rsBorder=_rs.score>=70?'rgba(255,59,92,.35)':_rs.score>=45?'rgba(255,107,53,.3)':_rs.score>=20?'rgba(255,215,0,.25)':'rgba(0,217,100,.25)';

  // Badges status
  var _badges=[];
  if(sec.wifi_count!==undefined) _badges.push('<span style="color:rgba(0,217,255,.7)">⊛ '+sec.wifi_count+' cli</span>');
  if(sec.temp_c!==null&&sec.temp_c!==undefined){
    var _tCol=sec.temp_c>70?'var(--red)':sec.temp_c>55?'var(--amber)':'var(--green)';
    _badges.push('<span style="color:'+_tCol+'">'+sec.temp_c+'°C</span>');
  }
  var _mesh=rd.mesh||[],_meshBase=rd.mesh_baseline||0;
  if(_mesh.length||(_meshBase>0)){
    var _mCol2=_meshBase>0&&_mesh.length<_meshBase?'var(--amber)':'rgba(160,220,255,.4)';
    _badges.push('<span style="color:'+_mCol2+'">⬡ '+(_meshBase>0?(_mesh.length+'/'+_meshBase):_mesh.length)+'</span>');
  }
  var _aip=rd.aiprotection||{};
  if(_aip.enabled&&(_aip.drop_count||0)>0)
    _badges.push('<span style="color:rgba(255,59,92,.8)">'+_aip.drop_count+' BWDPI</span>');

  return '<div class="card" id="router-tile" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">⟁</span>'+_tileLbl+dot+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.22rem">'+esc(rd.timestamp||'')
    +'<span style="color:rgba(0,217,255,.5);margin-left:.5rem">⬆ '+esc(rd.uptime_str||'—')+'</span></div>'
    // WAN 2-column KPI boxes
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.28rem;margin-bottom:.28rem">'
    +'<div style="padding:.22rem .35rem;background:rgba(0,217,100,.07);border:1px solid rgba(0,217,100,.2);border-radius:4px;text-align:center">'
    +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,100,.5);letter-spacing:.5px;text-transform:uppercase">WAN ↓ RX</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:var(--green);font-family:\'Courier New\',monospace;line-height:1.3">'+fmtKbps(wan.rx_kbps)+'</div>'
    +'</div>'
    +'<div style="padding:.22rem .35rem;background:rgba(255,149,0,.07);border:1px solid rgba(255,149,0,.2);border-radius:4px;text-align:center">'
    +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(255,149,0,.5);letter-spacing:.5px;text-transform:uppercase">WAN ↑ TX</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:var(--amber);font-family:\'Courier New\',monospace;line-height:1.3">'+fmtKbps(wan.tx_kbps)+'</div>'
    +'</div>'
    +'</div>'
    // Sparkline
    +'<canvas id="router-tile-spark" height="30" style="width:100%;display:block;border-radius:2px;margin-bottom:.28rem"></canvas>'
    // CPU — per-core si disponible, sinon load5
    +(function(){
      var _crs=cpu.cores||[];
      var _validCores=_crs.filter(function(c){return c!==null&&c!==undefined;});
      if(_validCores.length>0){
        var _cHtml='<div style="display:grid;grid-template-columns:repeat('+_validCores.length+',1fr);gap:.2rem;margin-bottom:.28rem">';
        _validCores.forEach(function(pct,i){
          var _p=Math.min(100,Math.round(pct||0));
          var _cc=_p>80?'pb-r':_p>50?'pb-y':'pb-g';
          var _tCol=_p>80?'var(--red)':_p>50?'var(--amber)':'rgba(0,217,100,.7)';
          _cHtml+='<div style="text-align:center">'
            +'<div style="font-size:calc(var(--fs-xs) - 2px);color:var(--c-label);margin-bottom:.08rem">C'+i+'</div>'
            +'<div class="pb-track" style="height:5px;border-radius:2px"><div class="pb '+_cc+'" style="width:'+_p+'%;height:100%"></div></div>'
            +'<div style="font-size:calc(var(--fs-xs) - 2px);color:'+_tCol+';margin-top:.08rem">'+_p+'%</div>'
            +'</div>';
        });
        _cHtml+='</div>';
        return _cHtml;
      }
      return '<div class="pb-row"><div class="pb-hdr"><span>CPU load5</span><span>'+cpuLoad+'</span></div>'
        +'<div class="pb-track"><div class="pb '+cpuC+'" style="width:'+cpuPct+'%"></div></div></div>';
    })()
    // RAM
    +'<div class="pb-row"><div class="pb-hdr"><span>RAM</span><span>'+memPct+'%\xa0·\xa0'+Math.round((mem.used_kb||0)/1024)+'\xa0/\xa0'+Math.round((mem.total_kb||0)/1024)+'\xa0Mo</span></div>'
    +'<div class="pb-track"><div class="pb '+memC+'" style="width:'+memPct+'%"></div></div></div>'
    // Badges
    +(_badges.length?'<div style="display:flex;gap:.3rem;flex-wrap:wrap;font-size:var(--fs-xs);margin:.2rem 0 .22rem;align-items:center">'+_badges.join('<span style="color:rgba(255,255,255,.1)">·</span>')+'</div>':'')
    // Score réseau
    +'<div style="padding:.25rem .4rem;background:'+_rsBg+';border:1px solid '+_rsBorder+';border-radius:4px;margin-top:.15rem">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.12rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.45);text-transform:uppercase;letter-spacing:.8px">Score Réseau</span>'
    +'<span style="font-size:var(--fs-xs);font-weight:700;color:'+_rs.color+'">'+esc(_rs.level)+'\xa0'+_rs.score+'/100</span>'
    +'</div>'
    +'<div style="background:rgba(255,255,255,.07);border-radius:2px;height:3px">'
    +'<div style="width:'+_rsBar+'%;height:100%;background:'+_rs.color+';border-radius:2px;transition:width .4s"></div>'
    +'</div></div>'
    +'</div></div>';
}

function openRouterModal(){
  if(_isOpen)return;
  var rd=window._routerData||null,hist=window._routerHistory||[];
  var _ht=document.getElementById('modal-header-title');
  if(!_overlay)return;
  if(_ht)_ht.innerHTML='<span>⟁ '+(rd&&rd.model?esc(rd.model):'—')+' — SSH Monitor</span>';
  document.getElementById('modal-card').classList.add('modal-router');
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
  if(!rd||!rd.available){
    _modalBody.innerHTML=`<div style="text-align:center;padding:2rem;color:var(--muted)">
<div style="font-size:var(--fs-4xl);margin-bottom:.5rem">⟁</div>
<div style="font-size:var(--fs-xs)">Données SSH non disponibles<br>Lancer ROUTER-REPORT.bat</div></div>`;
    return;
  }
  _modalBody.innerHTML=_buildRouterModalHTML(rd,hist);
  _modalBody.querySelectorAll('.router-tab[data-tab]').forEach(function(btn){
    btn.addEventListener('click',function(){_routerModalShowTab(this.dataset.tab);});
  });
  _routerModalShowTab('reseau');
}

function _routerModalShowTab(name){
  document.querySelectorAll('.rtab-panel').forEach(function(p){p.style.display='none';});
  document.querySelectorAll('.router-tab').forEach(function(b){
    b.style.color='rgba(160,220,255,0.45)';
    b.style.borderBottom='2px solid transparent';
    b.style.background='transparent';
  });
  var panel=document.getElementById('rtab-'+name);
  if(panel)panel.style.display='';
  document.querySelectorAll('.router-tab').forEach(function(b){
    if(b.getAttribute('data-tab')===name){
      b.style.color='rgb(0,217,255)';
      b.style.borderBottom='2px solid rgb(0,217,255)';
    }
  });
  requestAnimationFrame(function(){requestAnimationFrame(function(){_routerDrawCharts(window._routerData,window._routerHistory||[]);});});
}

// ── NDT-13 : _buildRouterModalHTML helpers ───────────────────────────────────

function _rtPortState(ifSt,p){
  var ist=ifSt[(p||{}).iface]||{};
  // eslint-disable-next-line eqeqeq
  var carrierUp=ist.carrier==1||ist.carrier===true;
  return {up:carrierUp||ist.state==='up', down:!carrierUp&&ist.hasOwnProperty('state')&&ist.state==='down', ist:ist};
}
function _rtPortRgb(p,st){
  var is10G=p.spd==='10G'||p.spd==='10G SFP+', is1G=p.spd==='1G', isWan=p.port==='WAN/LAN-1';
  if(st.up) return isWan?'0,217,100':is10G?'255,200,0':is1G?'0,130,200':'0,160,255';
  return st.down?'255,59,92':'70,90,110';
}
function _rtPortTip(p,st){
  var spd=st.up&&st.ist.speed>0?(st.ist.speed>=1000?(st.ist.speed/1000)+'G':st.ist.speed+'M'):p.spd;
  // eslint-disable-next-line eqeqeq
  return `${esc(p.port)} (${esc(p.spd)}) — ${esc(p.iface)}\nÉtat : ${st.up?'UP ▲':st.down?'DOWN ▼':'N/A'}\nVitesse : ${spd}\nCarrier : ${st.ist.carrier==1?'oui':'non'}`;
}
function _rtPortCard(px,py,pw,ph,p,st,extra,gaming){
  var rgb=_rtPortRgb(p,st),col='rgb('+rgb+')',brd='rgba('+rgb+','+(st.up?'0.7':st.down?'0.45':'0.18')+')';
  var cx=px+Math.round(pw/2);
  var sx=px+Math.round(pw*0.13),sy=py+Math.round(ph*0.08),sw=pw-Math.round(pw*0.26),sh=Math.round(ph*0.36);
  var ly=Math.round(py+ph*0.56);
  var spdDisp=st.up&&st.ist.speed>0?(st.ist.speed>=1000?(st.ist.speed/1000)+'G':st.ist.speed+'M'):p.spd;
  var glowFilter=st.up?'url(#rtGlow)':'';
  var ledOpacity=st.up?'0.92':st.down?'0.5':'0.18';
  var gamingHtml='';
  if(gaming){
    var gby=py+ph+3;
    gamingHtml=`<rect x="${px+4}" y="${gby}" width="${pw-8}" height="9" rx="2" fill="rgba(255,200,0,0.10)" stroke="rgba(255,200,0,0.55)" stroke-width="0.8"/>
<text x="${cx}" y="${gby+6.5}" text-anchor="middle" font-size="4" fill="rgba(255,200,0,0.95)" font-family="Courier New,monospace" letter-spacing="0.5">GAMING</text>`;
  }
  return `<g><title>${_rtPortTip(p,st)}${extra||''}</title>
<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="7" fill="rgba(4,9,18,0.97)" stroke="${brd}" stroke-width="1.5"/>
${st.up?`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="7" fill="none" stroke="${col}" stroke-width="0.5" opacity="0.18"/>`:''}
<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="4" fill="rgba(8,18,32,0.95)" stroke="${brd}" stroke-width="0.9"/>
${st.up?`<rect x="${sx+3}" y="${sy+3}" width="${sw-6}" height="${sh-6}" rx="2" fill="${col}" opacity="0.12"/>`:''}
<circle cx="${cx}" cy="${ly}" r="4.5" fill="${col}" filter="${glowFilter}" opacity="${ledOpacity}"/>
${st.down?`<text x="${cx}" y="${ly+3}" text-anchor="middle" font-size="6.5" fill="rgba(255,59,92,0.8)" font-family="Courier New">✕</text>`:''}
<text x="${cx}" y="${py+Math.round(ph*0.79)}" text-anchor="middle" font-size="5" fill="rgba(${rgb},0.82)" font-family="Courier New,monospace">${esc(p.port)}</text>
<text x="${cx}" y="${py+Math.round(ph*0.93)}" text-anchor="middle" font-size="3.8" fill="rgba(${rgb},0.45)" font-family="Courier New,monospace">${spdDisp}</text>
${gamingHtml}</g>`;
}

function _buildRouterTabHeader(rd){
  var ts='display:inline-block;padding:.3rem .75rem;font-size:var(--fs-xs);font-family:\'Courier New\',monospace;'
    +'font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:none;'
    +'background:transparent;border-bottom:2px solid transparent;transition:color .15s,border-color .15s;';
  var ta='color:rgb(0,217,255);border-bottom:2px solid rgb(0,217,255);';
  var ti='color:rgba(160,220,255,0.45);';
  // KPI summary strip
  var _wan=rd.wan||{},_sec=rd.security||{};
  var _rs2=computeRouterScore(rd,window._routerFlows||null);
  var _kpis=[
    {lbl:'Score Réseau',val:_rs2.level+'\xa0'+_rs2.score+'/100',col:_rs2.color},
    {lbl:'WAN ↓ RX',    val:fmtKbps(_wan.rx_kbps),              col:'var(--green)'},
    {lbl:'WAN ↑ TX',    val:fmtKbps(_wan.tx_kbps),              col:'var(--amber)'}
  ];
  if(_sec.temp_c!==null&&_sec.temp_c!==undefined){
    var _tC2=_sec.temp_c>70?'var(--red)':_sec.temp_c>55?'var(--amber)':'var(--green)';
    _kpis.push({lbl:'Temp CPU',val:_sec.temp_c+'°C',col:_tC2});
  }
  if(_sec.wifi_count!==undefined) _kpis.push({lbl:'Clients WiFi',val:String(_sec.wifi_count),col:'var(--cyan)'});
  var _kpiStrip=_kpis.map(function(k){
    return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:5px;padding:.3rem .55rem;text-align:center;min-width:70px">'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.12rem">'+k.lbl+'</div>'
      +'<div style="font-size:var(--fs-xs);font-weight:700;color:'+k.col+';font-family:\'Courier New\',monospace">'+k.val+'</div></div>';
  }).join('');
  return `<div style="font-family:'Courier New',monospace;padding:.2rem">
<div style="display:flex;gap:1.2rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem;padding-bottom:.5rem;border-bottom:1px solid rgba(0,217,255,0.15)">
<span style="font-size:var(--fs-xl);color:var(--cyan)">⟁</span>
<span style="font-size:var(--fs-xs);color:var(--text);font-weight:600">${esc(rd.model||'—')}</span>
<span style="font-size:var(--fs-xs);color:var(--muted)">FW: <span style="color:var(--cyan)">${esc(rd.firmware||'—')}</span></span>
<span style="font-size:var(--fs-xs);color:var(--muted)">Uptime: <span style="color:var(--green)">${esc(rd.uptime_str||'—')}</span></span>
<span style="font-size:var(--fs-xs);color:var(--muted)">Màj: ${esc(rd.timestamp||'—')}</span>
</div>
<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.65rem">${_kpiStrip}</div>
<div style="display:flex;gap:.1rem;border-bottom:1px solid rgba(0,217,255,0.12);margin-bottom:.9rem">
<button class="router-tab" data-tab="reseau"     style="${ts+ta}">RÉSEAU</button>
<button class="router-tab" data-tab="wifi"       style="${ts+ti}">WIFI</button>
<button class="router-tab" data-tab="systeme"    style="${ts+ti}">SYSTÈME</button>
<button class="router-tab" data-tab="historique" style="${ts+ti}">HISTORIQUE 24H</button>
<button class="router-tab" data-tab="flux"       style="${ts+ti}">FLUX WAN</button>
<button class="router-tab" data-tab="securite"   style="${ts+ti}">SÉCURITÉ</button>
<button class="router-tab" data-tab="ports"      style="${ts+ti}">PORTS</button>
</div>`;
}

function _buildRouterTabReseau(rd){
  var wan=rd.wan||{},lan=rd.lan||{};

  // KPI cards — gradient background, total bytes, interface from data
  var _kd=[
    {lbl:'WAN ↓ RX',val:fmtKbps(wan.rx_kbps),col:'0,217,100',  icon:'↓',bytes:fmtMB(wan.rx_bytes)},
    {lbl:'WAN ↑ TX',val:fmtKbps(wan.tx_kbps),col:'255,149,0',  icon:'↑',bytes:fmtMB(wan.tx_bytes)},
    {lbl:'LAN ↓ RX',val:fmtKbps(lan.rx_kbps),col:'0,217,255',  icon:'↓',bytes:fmtMB(lan.rx_bytes)},
    {lbl:'LAN ↑ TX',val:fmtKbps(lan.tx_kbps),col:'180,100,255',icon:'↑',bytes:fmtMB(lan.tx_bytes)}
  ];
  var kpiCards=_kd.map(function(k){
    return `<div style="background:linear-gradient(135deg,rgba(${k.col},.1),rgba(${k.col},.03));border:1px solid rgba(${k.col},.28);border-radius:8px;padding:.55rem .65rem;position:relative;overflow:hidden">
<div style="position:absolute;top:.35rem;right:.45rem;font-size:var(--fs-xl);color:rgba(${k.col},.1);font-weight:900;line-height:1">${k.icon}</div>
<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.4);text-transform:uppercase;letter-spacing:.7px;margin-bottom:.18rem">${k.lbl}</div>
<div style="font-size:var(--fs-md);font-weight:700;color:rgb(${k.col});font-family:'Courier New',monospace;line-height:1.1">${k.val}</div>
<div style="font-size:calc(var(--fs-xs) - 2px);color:rgba(${k.col},.45);margin-top:.15rem">${k.bytes}</div>
</div>`;
  }).join('');

  // Interface cards — sub from data (no hardcode)
  var _id=[
    {label:'WAN',sub:wan.interface||'—',iface:wan,col:'0,217,100',  rx:wan.rx_kbps||0,tx:wan.tx_kbps||0},
    {label:'LAN',sub:lan.interface||'—',iface:lan,col:'0,217,255',  rx:lan.rx_kbps||0,tx:lan.tx_kbps||0}
  ];
  var ifaceCards=_id.map(function(g){
    var mx=Math.max(g.rx,g.tx,1);
    var rxP=Math.min(100,Math.round(g.rx/mx*100)),txP=Math.min(100,Math.round(g.tx/mx*100));
    var active=(g.rx+g.tx)>0;
    return `<div style="background:rgba(${g.col},.04);border:1px solid rgba(${g.col},${active?'.22':'.09'});border-radius:8px;padding:.65rem .8rem">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
<div style="display:flex;align-items:center;gap:.5rem">
<div style="width:7px;height:7px;border-radius:50%;background:rgb(${g.col});${active?'box-shadow:0 0 5px rgba('+g.col+',.55)':'opacity:.3'}"></div>
<span style="font-size:var(--fs-xs);font-weight:700;color:rgb(${g.col})">${g.label}</span>
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.32);font-family:'Courier New',monospace">${esc(g.sub)}</span>
</div>
<span style="font-size:calc(var(--fs-xs) - 1px);padding:.05rem .28rem;border-radius:3px;background:rgba(${g.col},${active?'.12':'.04'});color:rgba(${g.col},${active?'.8':'.3'})">${active?'ACTIF':'IDLE'}</span>
</div>
<div style="font-size:var(--fs-xs);display:flex;justify-content:space-between;color:rgba(160,220,255,.4);margin-bottom:.12rem"><span>↓ RX</span><span style="color:rgb(${g.col})">${fmtMB(g.iface.rx_bytes)}</span></div>
<div style="background:rgba(255,255,255,.05);border-radius:3px;height:4px;margin-bottom:.3rem"><div style="width:${rxP}%;height:100%;background:linear-gradient(90deg,rgb(${g.col}),rgba(${g.col},.5));border-radius:3px"></div></div>
<div style="font-size:var(--fs-xs);display:flex;justify-content:space-between;color:rgba(160,220,255,.4);margin-bottom:.12rem"><span>↑ TX</span><span style="color:rgba(255,180,0,.85)">${fmtMB(g.iface.tx_bytes)}</span></div>
<div style="background:rgba(255,255,255,.05);border-radius:3px;height:4px"><div style="width:${txP}%;height:100%;background:linear-gradient(90deg,rgba(255,180,0,.75),rgba(255,180,0,.35));border-radius:3px"></div></div>
</div>`;
  }).join('');

  return `<div id="rtab-reseau" class="rtab-panel">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.55rem;margin-bottom:.8rem">${kpiCards}</div>
<div style="background:rgba(0,0,0,.18);border:1px solid rgba(0,217,255,.08);border-radius:8px;padding:.55rem .7rem;margin-bottom:.75rem">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.4);text-transform:uppercase;letter-spacing:1px">Débit WAN 24h</span>
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.28);font-family:'Courier New',monospace"><span style="color:rgba(0,217,100,.6)">▬ RX</span>&nbsp;&nbsp;<span style="color:rgba(255,149,0,.6)">▬ TX</span></span>
</div>
<canvas id="router-wan-chart" height="75" style="width:100%;display:block"></canvas>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem">${ifaceCards}</div>
</div>`;
}

function _buildRouterTabWifi(rd){
  var wifi=rd.wifi||[],mesh=rd.mesh||[];
  var _wifiCols=['180,80,255','0,217,255','255,149,0','0,217,100'];

  var wifiCards=wifi.map(function(w,wi){
    var wc=_wifiCols[wi%_wifiCols.length];
    var active=(w.rx_kbps+w.tx_kbps)>0||w.clients>0;
    var mxW=Math.max(w.rx_kbps,w.tx_kbps,1);
    var rxP=Math.min(100,Math.round(w.rx_kbps/mxW*100)),txP=Math.min(100,Math.round(w.tx_kbps/mxW*100));
    return `<div style="background:linear-gradient(135deg,rgba(${wc},.1),rgba(${wc},.03));border:1px solid rgba(${wc},${active?'.3':'.13'});border-radius:8px;padding:.65rem .75rem;position:relative;overflow:hidden">
<div style="position:absolute;top:.4rem;right:.5rem;font-size:var(--fs-2xl);color:rgba(${wc},.07);line-height:1;font-weight:900">▲</div>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem">
<div style="display:flex;align-items:center;gap:.4rem">
<div style="width:7px;height:7px;border-radius:50%;background:rgb(${wc});${active?'box-shadow:0 0 6px rgba('+wc+',.6)':'opacity:.3'}"></div>
<span style="font-size:var(--fs-xs);font-weight:700;color:rgb(${wc})">${esc(w.label||w.name)}</span>
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.3);font-family:'Courier New',monospace">${esc(w.name)}</span>
</div>
<div style="display:flex;align-items:center;gap:.3rem">
<span style="background:rgba(${wc},${active?'.12':'.04'});border:1px solid rgba(${wc},${active?'.28':'.1'});border-radius:10px;padding:.03rem .32rem;font-size:calc(var(--fs-xs) - 1px);color:rgba(${wc},${active?'.9':'.35'})">${(w.clients||0)} cli</span>
<span style="font-size:calc(var(--fs-xs) - 1px);padding:.03rem .22rem;border-radius:3px;background:rgba(${wc},${active?'.12':'.04'});color:rgba(${wc},${active?'.8':'.3'})">${active?'ACTIF':'IDLE'}</span>
</div>
</div>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(160,220,255,.38);margin-bottom:.1rem"><span>↓ RX</span><span style="color:rgb(0,217,100)">${fmtKbps(w.rx_kbps)}</span></div>
<div style="background:rgba(255,255,255,.05);border-radius:3px;height:4px;margin-bottom:.28rem"><div style="width:${rxP}%;height:100%;background:linear-gradient(90deg,rgb(0,217,100),rgba(0,217,100,.5));border-radius:3px"></div></div>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(160,220,255,.38);margin-bottom:.1rem"><span>↑ TX</span><span style="color:rgba(255,180,0,.9)">${fmtKbps(w.tx_kbps)}</span></div>
<div style="background:rgba(255,255,255,.05);border-radius:3px;height:4px;margin-bottom:.28rem"><div style="width:${txP}%;height:100%;background:linear-gradient(90deg,rgba(255,180,0,.8),rgba(255,180,0,.4));border-radius:3px"></div></div>
<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.28)">↓ ${fmtMB(w.rx_bytes)} · ↑ ${fmtMB(w.tx_bytes)}</div>
</div>`;
  }).join('');

  var meshHtml='';
  var meshBase2=rd.mesh_baseline||0;
  var meshTotal=Math.max(mesh.length,meshBase2);
  if(meshTotal>0){
    var _mLbl2=meshBase2>0?(mesh.length+'/'+meshBase2):String(mesh.length);
    var _mHCol=meshBase2>0&&mesh.length<meshBase2?'var(--amber)':'var(--green)';
    var activeNodes=mesh.map(function(m,i){
      return `<div style="background:linear-gradient(135deg,rgba(255,149,0,.08),rgba(255,149,0,.03));border:1px solid rgba(255,149,0,.25);border-radius:8px;padding:.55rem;text-align:center">
<div style="font-size:var(--fs-lg);color:var(--amber);margin-bottom:.2rem">⬡</div>
<div style="font-size:var(--fs-xs);font-weight:700;color:var(--text);margin-bottom:.08rem">Node ${i+1}</div>
<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.4);font-family:'Courier New',monospace">${esc(m.iface||m.name||'wds'+(i+1))}</div>
<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(255,149,0,.55);margin-top:.2rem">↓${fmtMB(m.rx_bytes)} ↑${fmtMB(m.tx_bytes)}</div>
</div>`;
    }).join('');
    var offlineParts=[];
    for(var _mi=mesh.length;_mi<meshBase2;_mi++){
      offlineParts.push(`<div style="background:rgba(255,59,92,.04);border:1px solid rgba(255,59,92,.2);border-radius:8px;padding:.55rem;text-align:center;opacity:.55">
<div style="font-size:var(--fs-lg);color:rgba(255,59,92,.6);margin-bottom:.2rem">⬡</div>
<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.08rem">Node ${_mi+1}</div>
<div style="font-size:var(--fs-xs);color:rgba(255,59,92,.7)">HORS LIGNE</div>
</div>`);
    }
    var offlineNodes=offlineParts.join('');
    meshHtml=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;margin-top:.25rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(255,149,0,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:${_mHCol};text-transform:uppercase;letter-spacing:1px">NŒUDS AIMESH — ${_mLbl2}</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(255,149,0,.15))"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(${Math.min(3,Math.max(1,meshTotal))},1fr);gap:.5rem">${activeNodes}${offlineNodes}</div>`;
  }

  return `<div id="rtab-wifi" class="rtab-panel" style="display:none">
<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(180,80,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(180,80,255,.6);text-transform:uppercase;letter-spacing:1px">INTERFACES WIFI</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(180,80,255,.15))"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.55rem;margin-bottom:.8rem">${wifiCards}</div>
<div style="background:rgba(0,0,0,.18);border:1px solid rgba(0,217,255,.08);border-radius:8px;padding:.55rem .7rem;margin-bottom:.75rem">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.4);text-transform:uppercase;letter-spacing:1px">WiFi 5/6GHz 24h</span>
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.28);font-family:'Courier New',monospace"><span style="color:rgba(0,217,100,.6)">▬ RX</span>&nbsp;&nbsp;<span style="color:rgba(180,80,255,.6)">▬ TX</span></span>
</div>
<canvas id="router-wifi-chart" height="55" style="width:100%;display:block"></canvas>
</div>
${meshHtml}
</div>`;
}

function _buildRouterTabSysteme(rd){
  var cpu=rd.cpu||{},mem=rd.memory||{};
  var _fwModeS=rd.fw_mode||'stock';
  var _fwCol=_fwModeS==='merlin'?'255,149,0':'160,220,255';

  var infoCards=[
    {lbl:'Uptime',  val:esc(rd.uptime_str||'—'),col:'0,217,100'},
    {lbl:'Modèle',  val:esc(rd.model||'—'),     col:'0,217,255'},
    {lbl:'Firmware',val:esc(rd.firmware||'—'),  col:'160,220,255'},
    {lbl:'Mode FW', val:esc(_fwModeS),           col:_fwCol}
  ].map(function(k){
    return `<div style="background:linear-gradient(135deg,rgba(${k.col},.08),rgba(${k.col},.02));border:1px solid rgba(${k.col},.22);border-radius:8px;padding:.55rem;text-align:center">
<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.38);margin-bottom:.22rem;text-transform:uppercase;letter-spacing:.5px">${k.lbl}</div>
<div style="font-size:var(--fs-xs);font-weight:700;color:rgb(${k.col})">${k.val}</div></div>`;
  }).join('');

  // CPU per-core si disponible
  var _coresPct=cpu.cores||[];
  var _validCores=_coresPct.filter(function(c){return c!==null&&c!==undefined;});
  var cpuCoreSection='';
  if(_validCores.length>0){
    var _cHtml='<div style="display:grid;grid-template-columns:repeat('+_validCores.length+',1fr);gap:.4rem;margin-bottom:.6rem">';
    _validCores.forEach(function(pct,i){
      var _p=Math.min(100,Math.round(pct||0));
      var _cBg=_p>80?'255,59,92':_p>50?'255,149,0':'0,217,100';
      _cHtml+=`<div style="background:rgba(${_cBg},.06);border:1px solid rgba(${_cBg},.18);border-radius:6px;padding:.42rem .3rem;text-align:center">
<div style="font-size:calc(var(--fs-xs) - 2px);color:var(--c-label);margin-bottom:.16rem;text-transform:uppercase;letter-spacing:.4px">C${i}</div>
<div style="font-size:var(--fs-sm);font-weight:700;color:rgb(${_cBg});line-height:1;margin-bottom:.16rem">${_p}<span style="font-size:calc(var(--fs-xs) - 2px);opacity:.7">%</span></div>
<div style="background:rgba(255,255,255,.06);border-radius:2px;height:3px"><div style="width:${_p}%;height:100%;background:linear-gradient(90deg,rgb(${_cBg}),rgba(${_cBg},.4));border-radius:2px"></div></div>
</div>`;
    });
    _cHtml+='</div>';
    cpuCoreSection=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(0,217,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.45);text-transform:uppercase;letter-spacing:1px">CŒURS CPU — TEMPS RÉEL</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(0,217,255,.15))"></div>
</div>`+_cHtml;
  }

  // Load average 3 valeurs
  var loadCards=[
    {lbl:'1 min', val:cpu.load1||0, col:'0,217,255'},
    {lbl:'5 min', val:cpu.load5||0, col:'0,217,100'},
    {lbl:'15 min',val:cpu.load15||0,col:'180,100,255'}
  ].map(function(l){
    var pct=Math.min(100,Math.round(l.val*20));
    var lRgb=l.val>3?'255,59,92':l.val>1.5?'255,149,0':l.col;
    return `<div style="background:rgba(${l.col},.04);border:1px solid rgba(${l.col},.15);border-radius:8px;padding:.52rem;text-align:center">
<div style="font-size:calc(var(--fs-xs) - 1px);color:var(--c-label);margin-bottom:.18rem;text-transform:uppercase">${l.lbl}</div>
<div style="font-size:var(--fs-lg);font-weight:700;color:rgb(${lRgb});line-height:1;margin-bottom:.18rem">${l.val}</div>
<div style="background:rgba(255,255,255,.06);border-radius:2px;height:3px"><div style="width:${pct}%;height:100%;background:rgb(${lRgb});border-radius:2px"></div></div>
</div>`;
  }).join('');

  // RAM
  var memPct2=mem.used_pct||0;
  var _mRgb=memPct2>80?'255,59,92':memPct2>60?'255,149,0':'0,217,100';
  var memCards=[
    {lbl:'Total',   val:Math.round((mem.total_kb||0)/1024)+' Mo',col:'160,220,255'},
    {lbl:'Utilisée',val:Math.round((mem.used_kb||0)/1024)+' Mo', col:_mRgb},
    {lbl:'Libre',   val:Math.round((mem.free_kb||0)/1024)+' Mo', col:'0,217,100'}
  ].map(function(m2){
    return `<div style="background:rgba(${m2.col},.04);border:1px solid rgba(${m2.col},.18);border-radius:8px;padding:.5rem;text-align:center">
<div style="font-size:calc(var(--fs-xs) - 1px);color:var(--c-label);margin-bottom:.18rem;text-transform:uppercase">${m2.lbl}</div>
<div style="font-size:var(--fs-xs);font-weight:700;color:rgb(${m2.col})">${m2.val}</div></div>`;
  }).join('');

  // Température
  var _tempSect='';
  var _secS=rd.security||{};
  if(_secS.temp_c!==null&&_secS.temp_c!==undefined){
    _tempSect=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;margin-top:.55rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(255,149,0,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(255,149,0,.5);text-transform:uppercase;letter-spacing:1px">TEMPÉRATURE CPU</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(255,149,0,.15))"></div>
</div>
<div style="display:flex;justify-content:center"><canvas id="router-temp-gauge" width="150" height="95" style="display:block"></canvas></div>`;
  }

  return `<div id="rtab-systeme" class="rtab-panel" style="display:none">
<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(0,217,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.45);text-transform:uppercase;letter-spacing:1px">INFOS SYSTÈME</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(0,217,255,.15))"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin-bottom:.75rem">${infoCards}</div>
${cpuCoreSection}
<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(0,217,100,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(0,217,100,.45);text-transform:uppercase;letter-spacing:1px">CHARGE CPU — LOAD AVERAGE</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(0,217,100,.15))"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-bottom:.7rem">${loadCards}</div>
<div style="background:rgba(0,0,0,.18);border:1px solid rgba(0,217,255,.08);border-radius:8px;padding:.55rem .7rem;margin-bottom:.75rem">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.4);text-transform:uppercase;letter-spacing:1px">Historique CPU load5 — 24h</span>
</div>
<canvas id="router-cpu-chart" height="55" style="width:100%;display:block"></canvas>
</div>
<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(180,100,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(180,100,255,.45);text-transform:uppercase;letter-spacing:1px">MÉMOIRE RAM</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(180,100,255,.15))"></div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-bottom:.5rem">${memCards}</div>
<div style="background:rgba(255,255,255,.04);border-radius:3px;height:5px;margin-bottom:.35rem"><div style="width:${memPct2}%;height:100%;background:linear-gradient(90deg,rgb(${_mRgb}),rgba(${_mRgb},.45));border-radius:3px"></div></div>
<div style="font-size:var(--fs-xs);text-align:center;color:rgba(${_mRgb},.55);margin-bottom:.1rem">${memPct2}% utilisé</div>
${_tempSect}
</div>`;
}

function _buildRouterTabHistorique(hist){
  var tableHtml='';
  if(hist.length){
    var rows=hist.slice(-15).reverse().map(function(e,ri){
      var t=new Date(e.ts*1000),ts2=t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
      var _bg=ri%2===0?'rgba(255,255,255,.018)':'transparent';
      return `<tr style="background:${_bg}">
<td style="padding:.22rem .4rem;color:rgba(160,220,255,.38)">${ts2}</td>
<td style="padding:.22rem .4rem;text-align:right;color:rgb(0,217,100)">${fmtKbps(e.wan_rx_kbps)}</td>
<td style="padding:.22rem .4rem;text-align:right;color:rgb(255,149,0)">${fmtKbps(e.wan_tx_kbps)}</td>
<td style="padding:.22rem .4rem;text-align:right;color:rgb(0,217,255)">${e.cpu_load5||0}</td>
<td style="padding:.22rem .4rem;text-align:right;color:rgb(180,100,255)">${e.mem_used_pct||0}%</td>
</tr>`;
    }).join('');
    tableHtml=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(0,217,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.45);text-transform:uppercase;letter-spacing:1px">DERNIÈRES MESURES</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(0,217,255,.15))"></div>
</div>
<div style="background:rgba(0,0,0,.18);border:1px solid rgba(0,217,255,.08);border-radius:8px;overflow:hidden">
<div style="overflow-x:auto"><table style="width:100%;font-size:var(--fs-xs);border-collapse:collapse;font-family:'Courier New',monospace">
<thead><tr style="background:rgba(0,217,255,.04);border-bottom:1px solid rgba(0,217,255,.1)">
<th style="padding:.28rem .4rem;text-align:left;font-weight:500;color:rgba(160,220,255,.5)">HEURE</th>
<th style="padding:.28rem .4rem;text-align:right;font-weight:500;color:rgb(0,217,100)">WAN ↓</th>
<th style="padding:.28rem .4rem;text-align:right;font-weight:500;color:rgb(255,149,0)">WAN ↑</th>
<th style="padding:.28rem .4rem;text-align:right;font-weight:500;color:rgb(0,217,255)">CPU</th>
<th style="padding:.28rem .4rem;text-align:right;font-weight:500;color:rgb(180,100,255)">RAM</th>
</tr></thead><tbody>${rows}</tbody></table></div>
</div>`;
  }

  return `<div id="rtab-historique" class="rtab-panel" style="display:none">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem">
<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1.5px">HISTORIQUE</div>
<div style="font-size:var(--fs-xs);color:rgba(0,217,255,.4);font-family:'Courier New',monospace">${hist.length} pts · ${Math.round(hist.length*5/60*10)/10}h</div>
</div>
<div style="margin-bottom:.9rem">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
<div style="font-size:var(--fs-xs);font-family:'Courier New',monospace">
<span style="color:var(--green)">▲ RX</span>
<span style="color:rgba(160,220,255,.2);margin:0 .4rem">·</span>
<span style="color:var(--amber)">▼ TX</span>
<span style="color:rgba(160,220,255,.3);font-size:var(--fs-xs);margin-left:.4rem">— Kbps</span>
</div>
<div id="router-hist-wan-peak" style="font-size:var(--fs-xs);color:rgba(160,220,255,.38);font-family:'Courier New',monospace"></div>
</div>
<canvas id="router-hist-wan" height="90" style="width:100%;display:block;border-radius:3px"></canvas>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.9rem">
<div>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
<div style="font-size:var(--fs-xs);font-family:'Courier New',monospace;color:var(--cyan)">▸ CPU load5</div>
<div id="router-hist-cpu-cur" style="font-size:var(--fs-xs);color:rgba(0,217,255,.55);font-family:'Courier New',monospace"></div>
</div>
<canvas id="router-hist-cpu" height="60" style="width:100%;display:block;border-radius:3px"></canvas>
</div>
<div>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
<div style="font-size:var(--fs-xs);font-family:'Courier New',monospace;color:var(--purple)">▸ RAM %</div>
<div id="router-hist-ram-cur" style="font-size:var(--fs-xs);color:rgba(180,100,255,.6);font-family:'Courier New',monospace"></div>
</div>
<canvas id="router-hist-ram" height="60" style="width:100%;display:block;border-radius:3px"></canvas>
</div>
</div>
${tableHtml}
</div>`;
}

function _buildRouterTabFlux(){
  var fl=window._routerFlows||null;
  if(!fl){
    return `<div id="rtab-flux" class="rtab-panel" style="display:none">
<div style="text-align:center;padding:2.5rem 1rem;color:rgba(160,220,255,0.4)">
<div style="font-size:var(--fs-3xl);margin-bottom:.6rem">⟁</div>
<div style="font-size:var(--fs-xs);font-weight:600;letter-spacing:1px">FLUX WAN NON DISPONIBLE</div>
<div style="font-size:var(--fs-xs);margin-top:.4rem">SSH routeur non configuré ou en attente de collecte</div>
</div></div>`;
  }

  var tc=fl.proto||{};
  var kpisHtml=[
    {lbl:'FLUX TOTAUX',val:fl.total||0,     col:'0,217,255', icon:'⟁'},
    {lbl:'VERS WAN',   val:fl.wan_flows||0, col:'0,217,100', icon:'↑'},
    {lbl:'TCP',        val:tc.tcp||0,       col:'160,100,255',icon:'⇄'},
    {lbl:'UDP',        val:tc.udp||0,       col:'255,149,0', icon:'⇢'}
  ].map(function(k){
    return `<div style="background:linear-gradient(135deg,rgba(${k.col},.08) 0%,rgba(${k.col},.03) 100%);border:1px solid rgba(${k.col},.25);border-radius:12px;padding:.6rem .5rem .5rem;text-align:center;position:relative;overflow:hidden">
<div style="position:absolute;top:.4rem;right:.5rem;font-size:var(--fs-xs);opacity:.12">${k.icon}</div>
<div style="font-size:var(--fs-xs);color:rgba(160,220,255,.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:.25rem">${k.lbl}</div>
<div style="font-size:var(--fs-lg);font-weight:700;color:rgb(${k.col});line-height:1">${k.val}</div>
<div style="height:2px;background:linear-gradient(90deg,transparent,rgba(${k.col},.5),transparent);margin-top:.35rem;border-radius:2px"></div>
</div>`;
  }).join('');

  var matrixHtml='';
  var mdsts=fl.matrix_dsts||[],mrows=fl.matrix||[];
  if(mdsts.length&&mrows.length){
    var mmax=1;
    mrows.forEach(function(r){r.cells.forEach(function(c){if(c>mmax)mmax=c;});});

    var headerCols=mdsts.map(function(dst){
      var dstS=dst||'';var parts=dstS.split('.');
      var short=parts.length===4?parts[0]+'.'+parts[1]+'.'+parts[2].slice(0,2)+'…':dstS;
      return `<th style="padding:.3rem .25rem;color:rgba(0,217,100,.6);text-align:center;font-size:var(--fs-xs);font-weight:500;white-space:nowrap" title="${esc(dst)}">${esc(short)}</th>`;
    }).join('');

    var bodyRows=mrows.map(function(row,ri){
      var rowSrc=row.src||'';var srcParts=rowSrc.split('.');
      var srcShort=srcParts.length===4?'…'+srcParts[2]+'.'+srcParts[3]:rowSrc;
      var rowBg=ri%2===0?'rgba(255,255,255,.015)':'transparent';
      var cells=row.cells.map(function(cnt){
        if(cnt===0) return '<td style="padding:.28rem .25rem;text-align:center"><span style="color:rgba(255,255,255,.1);font-size:var(--fs-xs)">·</span></td>';
        var ratio=cnt/mmax,alpha=0.12+ratio*0.7;
        var rgb=ratio>0.65?'255,59,92':ratio>0.3?'255,149,0':'0,200,255';
        return `<td style="padding:.2rem .25rem;text-align:center"><div style="display:inline-flex;align-items:center;justify-content:center;min-width:1.4rem;height:1.4rem;background:rgba(${rgb},${alpha.toFixed(2)});border:1px solid rgba(${rgb},.35);border-radius:6px;color:rgb(${rgb});font-weight:700;font-size:var(--fs-xs);box-shadow:0 0 6px rgba(${rgb},${(ratio*.4).toFixed(2)})">${cnt}</div></td>`;
      }).join('');
      return `<tr style="background:${rowBg}"><td style="padding:.28rem .5rem;color:rgba(160,100,255,.9);white-space:nowrap;font-weight:600" title="${esc(rowSrc)}">${esc(srcShort)}</td>${cells}</tr>`;
    }).join('');

    matrixHtml=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(0,217,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.45);text-transform:uppercase;letter-spacing:1.2px">Matrice de flux — LAN × WAN</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(0,217,255,.15))"></div>
</div>
<div style="overflow-x:auto;margin-bottom:.9rem;padding:.5rem;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.05);border-radius:10px">
<table style="width:100%;border-collapse:separate;border-spacing:.25rem;font-size:var(--fs-xs);font-family:'Courier New',monospace">
<thead><tr><th style="padding:.3rem .5rem;color:rgba(160,220,255,.3);text-align:left;font-size:var(--fs-xs);font-weight:400;min-width:80px">SRC / DST</th>${headerCols}</tr></thead>
<tbody>${bodyRows}</tbody></table></div>`;
  }

  var topDstHtml='';
  var tdst=fl.top_dst||[];
  if(tdst.length){
    var tdmax=tdst[0].count||1;
    var dstRows=tdst.map(function(d,i){
      var pct=Math.min(100,Math.round(d.count/tdmax*100));
      var protos=d.protos||[];
      var hasTcp=protos.indexOf('tcp')>=0,hasUdp=protos.indexOf('udp')>=0;
      var pCol=hasTcp&&hasUdp?'160,100,255':hasTcp?'0,200,255':'255,149,0';
      var pLbl=hasTcp&&hasUdp?'MIX':hasTcp?'TCP':'UDP';
      var ports=(d.ports||[]).filter(function(p){return p>0;}).slice(0,3).join(' · ');
      return `<div style="display:grid;grid-template-columns:1.2rem 8.5rem auto 1fr 2.8rem;align-items:center;gap:.5rem;padding:.28rem .4rem;border-radius:7px;background:rgba(255,255,255,${i%2===0?.025:.015})">
<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.3);text-align:right">#${i+1}</span>
<span style="font-size:var(--fs-xs);color:rgb(${pCol});font-family:'Courier New',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.ip)}">${esc(d.ip)}</span>
<span style="font-size:var(--fs-xs);padding:.05rem .28rem;border-radius:4px;background:rgba(${pCol},.12);border:1px solid rgba(${pCol},.3);color:rgb(${pCol});font-weight:700;letter-spacing:.3px;white-space:nowrap">${pLbl}${ports?' :'+ports:''}</span>
<div style="background:rgba(255,255,255,.06);border-radius:4px;height:5px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,rgba(${pCol},.7),rgba(${pCol},.4));border-radius:4px"></div></div>
<span style="font-size:var(--fs-xs);font-weight:700;color:rgba(${pCol},.9);text-align:right">${d.count}</span>
</div>`;
    }).join('');
    topDstHtml=`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(0,217,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.45);text-transform:uppercase;letter-spacing:1.2px">Top destinations WAN</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(0,217,255,.15))"></div>
</div>
<div style="display:flex;flex-direction:column;gap:.3rem;padding:.5rem;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.05);border-radius:10px">${dstRows}</div>`;
  }

  return `<div id="rtab-flux" class="rtab-panel" style="display:none">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:1rem">${kpisHtml}</div>
${matrixHtml}${topDstHtml}
</div>`;
}

function _buildRouterTabSecurite(rd){
  var sec=rd.security||{};
  var _fwModeM=rd.fw_mode||'stock',_fwIsMerlin=_fwModeM==='merlin';
  var _aipM=rd.aiprotection||{};
  var _fwSectionLbl=_fwIsMerlin?'FIREWALL MERLIN':(_aipM.enabled?'AIPROTECTION (Trend Micro)':'FIREWALL SPI');
  var _fwLbl1=_aipM.enabled?'BWDPI DROP':'FORWARD DROP';
  var _fwLbl2=_aipM.enabled?'BWDPI règles':'INPUT DROP';
  var _fwVal1=_aipM.enabled?(_aipM.drop_count||0):(sec.fw_forward_drop||0);
  var _fwVal2=_aipM.enabled?(_aipM.rule_count||0):(sec.fw_input_drop||0);
  var skC=_aipM.enabled?'0,217,100':_fwIsMerlin?'0,217,100':'255,165,0';
  var _fwStatusLbl=_fwIsMerlin
    ?'ACTIF — Firmware Merlin'
    :(_aipM.enabled?'ACTIF — '+(_aipM.drop_count||0)+' blocages Trend Micro':'SPI ACTIF — AiProtection désactivé');
  var _fwBadge=_fwIsMerlin?'FW MERLIN ':(_aipM.enabled?'AIPROTECTION ':'FW SPI ');

  var wifiMacs=sec.wifi_clients||[],dhcpLeases=sec.dhcp_leases||[];
  var nonWifi=dhcpLeases.filter(function(l){return!wifiMacs.some(function(m){return m.toLowerCase()===(l.mac||'').toLowerCase();});});

  var wifiClientRows=wifiMacs.length
    ? wifiMacs.map(function(mac){
        var lease=dhcpLeases.filter(function(l){return l.mac&&l.mac.toLowerCase()===mac.toLowerCase();})[0];
        return `<div style="display:flex;align-items:center;gap:.4rem;padding:.25rem .45rem;background:rgba(0,217,255,.04);border:1px solid rgba(0,217,255,.1);border-radius:5px">
<span style="width:5px;height:5px;border-radius:50%;flex-shrink:0;background:rgba(0,217,100,.8);box-shadow:0 0 4px rgba(0,217,100,.45)"></span>
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,255,.7);font-family:'Courier New',monospace;flex:1">${esc(mac)}</span>
${lease?`<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,100,.85);font-family:'Courier New',monospace">${esc(lease.ip)}</span>`:''}
${lease&&lease.name&&lease.name!=='*'?`<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.4)">${esc(lease.name)}</span>`:''}
</div>`;
      }).join('')
    : '<div style="font-size:var(--fs-xs);color:rgba(160,220,255,.3);padding:.3rem 0">Aucun client WiFi</div>';

  var nonWifiRows=nonWifi.length
    ? nonWifi.map(function(l){
        return `<div style="display:flex;align-items:center;gap:.4rem;padding:.25rem .45rem;background:rgba(180,100,255,.04);border:1px solid rgba(180,100,255,.1);border-radius:5px">
<span style="width:5px;height:5px;border-radius:50%;flex-shrink:0;background:rgba(180,100,255,.8)"></span>
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,100,.85);font-family:'Courier New',monospace">${esc(l.ip)}</span>
${(l.name&&l.name!=='*')?`<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.5)">${esc(l.name)}</span>`:''}
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.28);margin-left:auto;font-family:'Courier New',monospace">${esc(l.mac)}</span>
</div>`;
      }).join('')
    : '<div style="font-size:var(--fs-xs);color:rgba(160,220,255,.3);padding:.3rem 0">Aucun client filaire</div>';

  return `<div id="rtab-securite" class="rtab-panel" style="display:none">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
<div>
<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(255,59,92,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(255,59,92,.5);text-transform:uppercase;letter-spacing:1px">${_fwSectionLbl}</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(255,59,92,.15))"></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.5rem">
<div style="background:rgba(255,59,92,.06);border:1px solid rgba(255,59,92,.22);border-radius:8px;padding:.52rem;text-align:center">
<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.42);margin-bottom:.2rem;text-transform:uppercase">${_fwLbl1}</div>
<div style="font-size:var(--fs-sm);font-weight:700;color:var(--red)">${_fwVal1}</div>
</div>
<div style="background:rgba(255,149,0,.06);border:1px solid rgba(255,149,0,.22);border-radius:8px;padding:.52rem;text-align:center">
<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(160,220,255,.42);margin-bottom:.2rem;text-transform:uppercase">${_fwLbl2}</div>
<div style="font-size:var(--fs-sm);font-weight:700;color:var(--amber)">${_fwVal2}</div>
</div>
</div>
<div style="background:linear-gradient(135deg,rgba(${skC},.08),rgba(${skC},.03));border:1px solid rgba(${skC},.25);border-radius:8px;padding:.45rem .7rem;display:flex;align-items:center;gap:.5rem">
<div style="width:8px;height:8px;border-radius:50%;background:rgb(${skC});box-shadow:0 0 7px rgba(${skC},.7);flex-shrink:0"></div>
<span style="font-size:var(--fs-xs);font-weight:700;color:rgb(${skC})">${_fwBadge}</span>
<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(${skC},.65)">${_fwStatusLbl}</span>
</div>
</div>
<div>
<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(0,217,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.45);text-transform:uppercase;letter-spacing:1px">CLIENTS WIFI — ${sec.wifi_count||0}</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(0,217,255,.15))"></div>
</div>
<div style="display:flex;flex-direction:column;gap:.2rem;margin-bottom:.65rem">${wifiClientRows}</div>
<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba(180,100,255,.15),transparent)"></div>
<span style="font-size:var(--fs-xs);color:rgba(180,100,255,.45);text-transform:uppercase;letter-spacing:1px">FILAIRES / DHCP — ${nonWifi.length}</span>
<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba(180,100,255,.15))"></div>
</div>
<div style="display:flex;flex-direction:column;gap:.18rem">${nonWifiRows}</div>
</div>
</div>
</div>`;
}

function _buildRouterTabPorts(rd){
  var secP=rd.security||{},dhcp2=secP.dhcp_leases||[],arp2=secP.arp_table||[],wifi2=secP.wifi_clients||[];
  var wanActive=rd.available!==false,wCount=secP.wifi_count||0;
  var _fwModeP=rd.fw_mode||'stock';
  var _ifSt=rd.iface_status||{};
  var _lpm=rd.lan_port_map||[];

  // Separate WAN from LAN ports (no hardcoded fallback)
  var _wanLpm=_lpm.filter(function(p){return p.port.toUpperCase().indexOf('WAN')>=0;});
  var _lanLpm=_lpm.filter(function(p){return p.port.toUpperCase().indexOf('WAN')<0;});
  var _wanP=_wanLpm[0]||null;

  // First 4 LAN ports → 2×2 grid; remaining → single column
  var _physPorts=_lanLpm.slice(0,4);
  var _singPorts=_lanLpm.slice(4);
  var _pw=62,_ph=55,_gapX=10,_gapY=8;
  var _phys=_physPorts.map(function(p,i){
    var col=i%2,row=Math.floor(i/2);
    return {p:p,x:222+col*(_pw+_gapX),y:32+row*(_ph+_gapY),w:_pw,h:_ph};
  });
  var _ph2=80;
  var _singles=_singPorts.map(function(p,i){
    var isGaming=!!(p.gaming)||(p.port.toUpperCase().indexOf('GAMING')>=0);
    return {p:p,x:396+i*(_pw+_gapX),y:35,w:_pw,h:_ph2,gaming:isGaming};
  });

  // ── WiFi radios SVG ──────────────────────────────────────────────────────────
  var _wifiList=rd.wifi||[];
  var _wRadCfg=_wifiList.map(function(w,i){var _c=['180,100,255','0,200,255','0,180,255','255,180,0'];return{lbl:w.label||w.name,col:_c[i%4],iface:w.name,clients:w.clients||0};});
  var _wStep=_wRadCfg.length>0?Math.floor(185/_wRadCfg.length):185;

  var radiosHtml=_wRadCfg.map(function(wr,_ri){
    var _wx=12+_ri*_wStep;
    var _wSt=_ifSt[wr.iface]||_ifSt[wr.iface+'.1']||{};
    var rDown=_wSt.state==='down';
    var _wInList=(rd.wifi||[]).some(function(w){return w.name===wr.iface;});
    var rActive=rDown?false:(_wInList||wCount>0||(_wSt.hasOwnProperty('state')&&_wSt.state!=='down'));
    var rClients=wr.clients||0;
    var _wRgb=rDown?'255,59,92':(rActive?'0,217,100':wr.col);
    var rCol='rgb('+_wRgb+')';
    var rBorder=rActive?`rgba(${_wRgb},0.6)`:rDown?`rgba(255,59,92,0.4)`:'rgba(70,90,110,0.3)';
    var rFill=rActive?rCol:rDown?'rgba(255,59,92,0.5)':'rgba(70,90,110,0.7)';
    var wTip=`${esc(wr.lbl)} (${esc(wr.iface)})\nÉtat : ${rDown?'DOWN ▼':rActive?'UP ▲':'N/A'}\nClients : ${rClients}`;
    return `<g><title>${wTip}</title>
<ellipse cx="${_wx+20}" cy="88" rx="18" ry="18" fill="rgba(5,12,22,0.9)" stroke="${rBorder}" stroke-width="1.2"/>
<text x="${_wx+20}" y="84" text-anchor="middle" font-size="11" fill="${rFill}" font-family="Courier New,monospace">▲</text>
<text x="${_wx+20}" y="96" text-anchor="middle" font-size="5.5" fill="${rActive?rCol:rDown?'rgba(255,59,92,0.6)':'rgba(70,90,110,0.5)'}" font-family="Courier New,monospace">${esc(wr.lbl)}</text>
${rActive?`<circle cx="${_wx+31}" cy="70" r="3" fill="${rCol}" filter="url(#rtGlowSm)" opacity="0.85"/>`:''}
<text x="${_wx+20}" y="116" text-anchor="middle" font-size="5" fill="rgba(160,220,255,0.4)" font-family="Courier New,monospace">${rActive?rClients+' cli':'—'}</text>
</g>`;
  }).join('');

  // ── Port cards ───────────────────────────────────────────────────────────────
  var physCards=_phys.map(function(e){return _rtPortCard(e.x,e.y,e.w,e.h,e.p,_rtPortState(_ifSt,e.p));}).join('');
  var singleCards=_singles.map(function(e){return _rtPortCard(e.x,e.y,e.w,e.h,e.p,_rtPortState(_ifSt,e.p),e.gaming?'\n⚔ GAMING PORT':'',e.gaming);}).join('');

  // ── WAN indicator ─────────────────────────────────────────────────────────────
  var wanCol=wanActive?'#00d964':'#ff3b5c',wanBorder=wanActive?'rgba(0,217,100,0.7)':'rgba(255,59,92,0.6)';
  var wanRxKbps=rd.wan&&rd.wan.rx_kbps||0,wanTxKbps=rd.wan&&rd.wan.tx_kbps||0;
  var wanHasFlow=(wanRxKbps+wanTxKbps)>0;
  var _wanSpd=_wanP?esc(_wanP.spd||'—'):'—';
  var wanFlowHtml=(wanActive&&(wanRxKbps>0||wanTxKbps>0))
    ?`<text x="595" y="130" text-anchor="middle" font-size="4.5" fill="rgba(0,217,100,0.5)" font-family="Courier New,monospace">↓${fmtKbps(wanRxKbps)}</text>
<text x="595" y="139" text-anchor="middle" font-size="4.5" fill="rgba(255,200,0,0.5)" font-family="Courier New,monospace">↑${fmtKbps(wanTxKbps)}</text>`
    :'';

  var wanSvgHtml=`<g><title>WAN — ${wanActive?'↓'+fmtKbps(wanRxKbps)+' ↑'+fmtKbps(wanTxKbps):'DOWN'}</title>
<rect x="565" y="36" width="60" height="82" rx="5" fill="rgba(5,12,22,0.95)" stroke="${wanBorder}" stroke-width="1.5"/>
<rect x="575" y="48" width="40" height="28" rx="2" fill="rgba(15,25,40,0.9)" stroke="${wanBorder}" stroke-width="1"/>
${wanActive?`<rect x="579" y="52" width="32" height="20" rx="1" fill="${wanCol}" opacity="${wanHasFlow?'0.22':'0.07'}"/>`:''}
<circle cx="595" cy="96" r="5" fill="${wanCol}" filter="url(#rtGlow)" opacity="${wanActive?'0.95':'0.8'}"/>
<text x="595" y="110" text-anchor="middle" font-size="7" fill="${wanActive?'rgba(0,217,100,0.8)':'rgba(255,59,92,0.8)'}" font-family="Courier New,monospace" font-weight="bold">WAN</text>
<text x="595" y="120" text-anchor="middle" font-size="5.5" fill="${wanActive?'rgba(0,217,100,0.55)':'rgba(255,59,92,0.6)'}" font-family="Courier New,monospace">${wanActive?_wanSpd:'DOWN'}</text>
${wanFlowHtml}</g>`;

  // ── Légende ──────────────────────────────────────────────────────────────────
  var _aipLeg=rd.aiprotection||{};
  var _fwLegLbl=_fwModeP==='merlin'?'FW Merlin':(_aipLeg.enabled?'AiProtection':'FW SPI');
  var _hasGaming=_singles.some(function(e){return e.gaming;});
  var _legItems=[
    {c:'#00d964',             l:'WAN actif'},
    {c:'#00a0ff',             l:'LAN occupé'},
    {c:'rgba(70,90,110,0.8)', l:'Port vide'},
    {c:'#00d964',             l:'WiFi (clients actifs)'},
    {c:'rgb(180,100,255)',    l:'WiFi 2.4G'},
    {c:'rgb(0,200,255)',      l:'WiFi 5/6G'}
  ];
  if(_hasGaming) _legItems.push({c:'rgba(255,200,0,0.85)',l:'Port GAMING'});
  _legItems.push({c:'rgba(255,59,92,0.85)',l:'USB '+_fwLegLbl});
  var legendItems=_legItems.map(function(l){
    return `<span style="display:flex;align-items:center;gap:.3rem"><span style="width:8px;height:8px;border-radius:50%;background:${l.c};display:inline-block;flex-shrink:0"></span>${esc(l.l)}</span>`;
  }).join('');

  // ── Table périphériques ───────────────────────────────────────────────────────
  var seenIp2={},allDevs=[];
  dhcp2.forEach(function(l){if(!seenIp2[l.ip]){seenIp2[l.ip]=1;allDevs.push({ip:l.ip,mac:l.mac,name:l.name,type:wifi2.some(function(m){return m.toLowerCase()===(l.mac||'').toLowerCase();})?'WiFi':'Filaire'});}});
  arp2.forEach(function(a){if(!seenIp2[a.ip]){seenIp2[a.ip]=1;allDevs.push({ip:a.ip,mac:a.mac,name:'',type:'ARP'});}});

  var devTableHtml='';
  if(allDevs.length){
    var devRows=allDevs.map(function(d){
      var tCol=d.type==='WiFi'?'var(--cyan)':d.type==='Filaire'?'rgba(180,100,255,.85)':'rgba(160,220,255,.4)';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
<td style="padding:.18rem .35rem;color:var(--green);font-family:'Courier New',monospace">${esc(d.ip)}</td>
<td style="padding:.18rem .35rem;color:rgba(160,220,255,.45);font-family:'Courier New',monospace;font-size:var(--fs-xs)">${esc(d.mac)}</td>
<td style="padding:.18rem .35rem;color:var(--text)">${esc(d.name&&d.name!=='*'?d.name:'—')}</td>
<td style="padding:.18rem .35rem;color:${tCol};font-weight:600">${d.type}</td>
</tr>`;
    }).join('');
    devTableHtml=`<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.35rem">PÉRIPHÉRIQUES — ${allDevs.length}</div>
<div style="overflow-x:auto"><table style="width:100%;font-size:var(--fs-xs);border-collapse:collapse">
<thead><tr style="color:var(--muted)">
<th style="padding:.2rem .35rem;text-align:left">IP</th>
<th style="padding:.2rem .35rem;text-align:left">MAC</th>
<th style="padding:.2rem .35rem;text-align:left">Nom</th>
<th style="padding:.2rem .35rem;text-align:left">Type</th>
</tr></thead><tbody>${devRows}</tbody></table></div>`;
  }

  var _modelSvg=esc(rd.model||'—');
  return `<div id="rtab-ports" class="rtab-panel" style="display:none">
<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.6rem">PANNEAU ARRIÈRE — ${_modelSvg}</div>
<div style="overflow-x:auto;margin-bottom:.9rem">
<svg viewBox="0 0 720 168" width="100%" style="display:block">
<defs>
<filter id="rtGlow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="rtGlowSm"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="rtBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0d1a2a"/><stop offset="100%" stop-color="#07111c"/></linearGradient>
</defs>
<rect x="2" y="16" width="716" height="146" rx="8" fill="url(#rtBody)" stroke="rgba(0,217,255,0.22)" stroke-width="1.5"/>
<text x="12" y="12" font-size="7.5" fill="rgba(0,217,255,0.45)" font-family="Courier New,monospace" letter-spacing="1">${_modelSvg}</text>
<circle cx="705" cy="23" r="4" fill="${rd.available?'#00d964':'#555'}" filter="url(#rtGlowSm)" opacity="0.85"/>
<line x1="205" y1="24" x2="205" y2="154" stroke="rgba(0,217,255,0.12)" stroke-width="1" stroke-dasharray="3,3"/>
<line x1="375" y1="24" x2="375" y2="154" stroke="rgba(0,217,255,0.12)" stroke-width="1" stroke-dasharray="3,3"/>
<line x1="555" y1="24" x2="555" y2="154" stroke="rgba(0,217,255,0.12)" stroke-width="1" stroke-dasharray="3,3"/>
<text x="103" y="29" text-anchor="middle" font-size="6.5" fill="rgba(160,100,255,0.5)" font-family="Courier New,monospace" letter-spacing="1">WIFI  RADIOS</text>
<text x="290" y="29" text-anchor="middle" font-size="6.5" fill="rgba(0,160,255,0.5)" font-family="Courier New,monospace" letter-spacing="1">LAN</text>
<text x="465" y="29" text-anchor="middle" font-size="6.5" fill="rgba(0,160,255,0.5)" font-family="Courier New,monospace" letter-spacing="1">LAN</text>
<text x="635" y="29" text-anchor="middle" font-size="6.5" fill="rgba(0,217,100,0.5)" font-family="Courier New,monospace" letter-spacing="1">WAN</text>
${radiosHtml}
<line x1="210" y1="91" x2="368" y2="91" stroke="rgba(0,217,255,0.08)" stroke-width="1"/>
${physCards}${singleCards}${wanSvgHtml}
</svg>
</div>
<div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:.8rem;font-size:var(--fs-xs);color:rgba(160,220,255,.5)">${legendItems}</div>
${devTableHtml}
</div>`;
}

function _buildRouterModalHTML(rd,hist){
  return _buildRouterTabHeader(rd)
    + _buildRouterTabReseau(rd)
    + _buildRouterTabWifi(rd)
    + _buildRouterTabSysteme(rd)
    + _buildRouterTabHistorique(hist)
    + _buildRouterTabFlux()
    + _buildRouterTabSecurite(rd)
    + _buildRouterTabPorts(rd)
    + '</div>';
}

function _drawTempGauge(canvasId, tempC){
  var canvas=document.getElementById(canvasId);
  if(!canvas||tempC===null||tempC===undefined)return;
  var W=canvas.width,H=canvas.height,ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  var cx=W/2,cy=H*0.72,R=Math.min(W,H)*0.44;
  var startA=Math.PI*0.85,endA=Math.PI*2.15;
  var pct=Math.min(1,Math.max(0,(tempC-20)/(100-20)));
  var valueA=startA+(endA-startA)*pct;
  ctx.beginPath();ctx.arc(cx,cy,R,startA,endA);
  ctx.strokeStyle='rgba(255,255,255,0.07)';ctx.lineWidth=10;ctx.lineCap='round';ctx.stroke();
  var grad=ctx.createLinearGradient(cx-R,cy,cx+R,cy);
  grad.addColorStop(0,'rgba(0,217,100,0.9)');
  grad.addColorStop(0.55,'rgba(255,149,0,0.9)');
  grad.addColorStop(1,'rgba(255,59,92,0.9)');
  ctx.beginPath();ctx.arc(cx,cy,R,startA,valueA);
  ctx.strokeStyle=grad;ctx.lineWidth=10;ctx.lineCap='round';ctx.stroke();
  var tipX=cx+Math.cos(valueA)*R,tipY=cy+Math.sin(valueA)*R;
  var tCol=tempC>70?'#ff3b5c':tempC>55?'#ff9500':'#00d964';
  ctx.beginPath();ctx.arc(tipX,tipY,5,0,Math.PI*2);
  ctx.fillStyle=tCol;ctx.shadowColor=tCol;ctx.shadowBlur=10;ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle=tCol;ctx.font='bold '+(R*0.55)+'px Courier New';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(tempC+'°', cx, cy-R*0.08);
  ctx.fillStyle='rgba(160,220,255,0.4)';ctx.font=(R*0.22)+'px Courier New';
  ctx.fillText('CPU TEMP', cx, cy+R*0.3);
  [20,40,60,80,100].forEach(function(v){
    var a=startA+(endA-startA)*(v-20)/80;
    var ix=cx+Math.cos(a)*(R+2),iy=cy+Math.sin(a)*(R+2);
    var ox=cx+Math.cos(a)*(R-13),oy=cy+Math.sin(a)*(R-13);
    ctx.beginPath();ctx.moveTo(ix,iy);ctx.lineTo(ox,oy);
    ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=1.5;ctx.stroke();
    var lx=cx+Math.cos(a)*(R+14),ly=cy+Math.sin(a)*(R+14);
    ctx.fillStyle='rgba(160,220,255,0.35)';ctx.font=(R*0.17)+'px Courier New';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(v,lx,ly);
  });
}

function _routerDrawCharts(rd,hist){
  if(rd&&rd.security&&rd.security.temp_c!==null&&rd.security.temp_c!==undefined){
    requestAnimationFrame(function(){requestAnimationFrame(function(){_drawTempGauge('router-temp-gauge',rd.security.temp_c);});});
  }
  if(!hist||!hist.length)return;
  var rxV=hist.map(function(e){return e.wan_rx_kbps||0;});
  var txV=hist.map(function(e){return e.wan_tx_kbps||0;});
  var cpuV=hist.map(function(e){return e.cpu_load5||0;});
  var w1rV=hist.map(function(e){return e.wifi1_rx_kbps||0;});
  var w1tV=hist.map(function(e){return e.wifi1_tx_kbps||0;});
  var mxWan=Math.max(Math.max.apply(null,rxV),Math.max.apply(null,txV),1);
  var mxCpu=Math.max.apply(null,cpuV)||1;
  var mxWifi=Math.max(Math.max.apply(null,w1rV),Math.max.apply(null,w1tV),1);
  var wanC=document.getElementById('router-wan-chart');
  if(wanC){drawNetSparkline(wanC,rxV,'0,217,100',mxWan);_rtOverlay(wanC,txV,mxWan,'255,149,0');}
  var wifC=document.getElementById('router-wifi-chart');
  if(wifC){drawNetSparkline(wifC,w1rV,'0,217,255',mxWifi);_rtOverlay(wifC,w1tV,mxWifi,'180,100,255');}
  var cpuC=document.getElementById('router-cpu-chart');
  if(cpuC)drawNetSparkline(cpuC,cpuV,'0,217,255',mxCpu);
  var ramV=hist.map(function(e){return e.mem_used_pct||0;});
  _rtMirrorChart('router-hist-wan',rxV,txV,hist);
  _rtAreaChart('router-hist-cpu',cpuV,'0,217,255',mxCpu,hist,'');
  _rtAreaChart('router-hist-ram',ramV,'180,100,255',100,hist,'%');
  var sk=document.getElementById('router-tile-spark');
  if(sk)drawNetSparkline(sk,rxV.slice(-30),'0,217,255',mxWan);
}

function _rtXp(i,n,pL,cW){return pL+(n>1?i/(n-1)*cW:cW/2);}
function _rtYp(v,maxVal,pT,cH){return pT+cH-Math.min(1,v/maxVal)*cH;}

function _rtOverlay(canvas,vals,maxVal,rgb){
  if(!canvas||!vals.length)return;
  var W=canvas.width,H=canvas.height,ctx=canvas.getContext('2d');
  var pts=vals.map(function(v,i){return[vals.length>1?(i/(vals.length-1)*W):W/2,H-Math.max(2,Math.round(v/maxVal*(H-5)))-1];});
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length;i++){var xc=(pts[i-1][0]+pts[i][0])/2,yc=(pts[i-1][1]+pts[i][1])/2;ctx.quadraticCurveTo(pts[i-1][0],pts[i-1][1],xc,yc);}
  ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
  ctx.strokeStyle='rgba('+rgb+',0.8)';ctx.lineWidth=1.5;ctx.stroke();
}

function _rtSmooth(ctx,pts){
  if(!pts.length)return;
  ctx.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length-1;i++){var xc=(pts[i][0]+pts[i+1][0])/2,yc=(pts[i][1]+pts[i+1][1])/2;ctx.quadraticCurveTo(pts[i][0],pts[i][1],xc,yc);}
  ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
}

function _rtDrawHalf(ctx,vals,rgb,up,maxVal,n,pL,cW,midY,halfH,H,pB,pT){
  if(!vals.length)return;
  var pts=vals.map(function(v,i){var r=Math.min(1,v/maxVal);return[_rtXp(i,n,pL,cW),up?midY-r*(halfH-2):midY+r*(halfH-2)];});
  var grad=ctx.createLinearGradient(0,up?midY:H-pB,0,up?pT:midY);
  grad.addColorStop(0,'rgba('+rgb+',0.0)');grad.addColorStop(1,'rgba('+rgb+',0.18)');
  ctx.beginPath();_rtSmooth(ctx,pts);
  ctx.lineTo(pts[pts.length-1][0],midY);ctx.lineTo(pts[0][0],midY);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  ctx.save();ctx.shadowBlur=5;ctx.shadowColor='rgba('+rgb+',0.55)';
  ctx.strokeStyle='rgba('+rgb+',0.9)';ctx.lineWidth=1.5;
  ctx.beginPath();_rtSmooth(ctx,pts);ctx.stroke();ctx.restore();
  var lp=pts[pts.length-1];
  ctx.beginPath();ctx.arc(lp[0],lp[1],2.5,0,Math.PI*2);ctx.fillStyle='rgba('+rgb+',0.95)';ctx.fill();
}

function _rtMirrorChart(id,rxVals,txVals,hist){
  var canvas=document.getElementById(id);
  if(!canvas)return;
  var W=canvas.offsetWidth||560,H=parseInt(canvas.getAttribute('height'))||90;
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');
  var maxVal=Math.max(Math.max.apply(null,rxVals),Math.max.apply(null,txVals),1);
  var pL=38,pR=8,pT=6,pB=14,midY=Math.floor((H-pB)/2)+pT;
  var cW=W-pL-pR,halfH=midY-pT,n=rxVals.length;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(0,8,18,0.5)';ctx.fillRect(0,0,W,H);
  for(var g=0;g<3;g++){
    var yU=pT+g*(halfH/2),yD=midY+g*(halfH/2);
    ctx.save();ctx.strokeStyle='rgba(0,217,255,0.08)';ctx.lineWidth=1;ctx.setLineDash([3,6]);
    ctx.beginPath();ctx.moveTo(pL,yU);ctx.lineTo(W-pR,yU);ctx.stroke();
    if(g>0){ctx.beginPath();ctx.moveTo(pL,yD);ctx.lineTo(W-pR,yD);ctx.stroke();}
    ctx.restore();
    if(g>0){
      var kv=Math.round((1-g/2)*maxVal);
      var kl=kv>999999?Math.round(kv/1000000)+'G':kv>999?Math.round(kv/100)/10+'M':kv+'K';
      ctx.fillStyle='rgba(0,217,255,0.32)';ctx.font='8px Courier New';ctx.textAlign='right';
      ctx.fillText(kl,pL-3,yU+3);ctx.fillText(kl,pL-3,yD+3);
    }
  }
  ctx.strokeStyle='rgba(0,217,255,0.22)';ctx.lineWidth=1;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(pL,midY);ctx.lineTo(W-pR,midY);ctx.stroke();
  ctx.strokeStyle='rgba(0,217,255,0.15)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pL,pT);ctx.lineTo(pL,H-pB);ctx.stroke();
  _rtDrawHalf(ctx,rxVals,'0,217,100',true,maxVal,n,pL,cW,midY,halfH,H,pB,pT);
  _rtDrawHalf(ctx,txVals,'255,149,0',false,maxVal,n,pL,cW,midY,halfH,H,pB,pT);
  if(hist&&hist.length){
    var step=Math.max(1,Math.ceil(hist.length/7));
    ctx.fillStyle='rgba(0,217,255,0.28)';ctx.font='8px Courier New';ctx.textAlign='center';
    for(var i=0;i<hist.length;i+=step){
      var t=new Date(hist[i].ts*1000);
      ctx.fillText(t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0'),_rtXp(i,n,pL,cW),H-2);
    }
    var tl=new Date(hist[hist.length-1].ts*1000);
    ctx.fillText(tl.getHours().toString().padStart(2,'0')+':'+tl.getMinutes().toString().padStart(2,'0'),_rtXp(hist.length-1,n,pL,cW),H-2);
  }
  var pk=document.getElementById('router-hist-wan-peak');
  if(pk){var rx=Math.max.apply(null,rxVals),tx=Math.max.apply(null,txVals);pk.textContent='MAX ↓ '+fmtKbps(rx)+' · MAX ↑ '+fmtKbps(tx);}
}

function _rtAreaChart(id,vals,rgb,maxVal,hist,unit){
  var canvas=document.getElementById(id);
  if(!canvas||!vals.length)return;
  var W=canvas.offsetWidth||280,H=parseInt(canvas.getAttribute('height'))||60;
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');
  maxVal=maxVal||Math.max.apply(null,vals)||1;
  var pL=28,pR=6,pT=5,pB=14,cW=W-pL-pR,cH=H-pT-pB,n=vals.length;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(0,8,18,0.5)';ctx.fillRect(0,0,W,H);
  for(var g=0;g<3;g++){
    var gy=pT+g*(cH/2);
    ctx.save();ctx.strokeStyle='rgba(0,217,255,0.08)';ctx.lineWidth=1;ctx.setLineDash([2,5]);
    ctx.beginPath();ctx.moveTo(pL,gy);ctx.lineTo(W-pR,gy);ctx.stroke();ctx.restore();
    var lv=(1-g/2)*maxVal;
    var ls=unit==='%'?Math.round(lv)+'%':(lv>0.1?Math.round(lv*100)/100:'0');
    ctx.fillStyle='rgba(0,217,255,0.3)';ctx.font='8px Courier New';ctx.textAlign='right';
    ctx.fillText(ls,pL-3,gy+3);
  }
  ctx.strokeStyle='rgba(0,217,255,0.12)';ctx.lineWidth=1;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(pL,pT);ctx.lineTo(pL,pT+cH);ctx.stroke();
  var pts=vals.map(function(v,i){return[_rtXp(i,n,pL,cW),_rtYp(v,maxVal,pT,cH)];});
  var grad=ctx.createLinearGradient(0,pT,0,pT+cH);
  grad.addColorStop(0,'rgba('+rgb+',0.2)');grad.addColorStop(1,'rgba('+rgb+',0.02)');
  ctx.beginPath();_rtSmooth(ctx,pts);
  ctx.lineTo(pts[pts.length-1][0],pT+cH);ctx.lineTo(pts[0][0],pT+cH);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  ctx.save();ctx.shadowBlur=4;ctx.shadowColor='rgba('+rgb+',0.5)';
  ctx.strokeStyle='rgba('+rgb+',0.9)';ctx.lineWidth=1.5;
  ctx.beginPath();_rtSmooth(ctx,pts);ctx.stroke();ctx.restore();
  var lp=pts[pts.length-1];
  ctx.beginPath();ctx.arc(lp[0],lp[1],2.5,0,Math.PI*2);ctx.fillStyle='rgba('+rgb+',0.95)';ctx.fill();
  if(hist&&hist.length){
    var step=Math.max(1,Math.ceil(hist.length/4));
    ctx.fillStyle='rgba(0,217,255,0.22)';ctx.font='7px Courier New';ctx.textAlign='center';
    for(var i=0;i<hist.length;i+=step){
      var t=new Date(hist[i].ts*1000);
      ctx.fillText(t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0'),_rtXp(i,n,pL,cW),H-2);
    }
    var tl=new Date(hist[hist.length-1].ts*1000);
    ctx.fillText(tl.getHours().toString().padStart(2,'0')+':'+tl.getMinutes().toString().padStart(2,'0'),_rtXp(hist.length-1,n,pL,cW),H-2);
  }
  var ce=document.getElementById(id+'-cur');
  if(ce){var lv2=vals[vals.length-1];ce.textContent=unit==='%'?lv2.toFixed(1)+'%':lv2.toFixed(2);}
}
