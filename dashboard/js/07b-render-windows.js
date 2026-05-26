'use strict';
// 07b-render-windows.js — Rendu tuiles Windows (Sprint 2B 2026-05-16).
// Extrait de 07-render.js : _renderWinTile* (Resources/Bkp/Gpu/Crons) + helpers _bkp*/_gpu*/_tileGaugeSVG.
// Chargé AVANT 07-render.js dans index.html.

function _renderWinTileResources(wd,g){
  var wdCpu=wd.cpu||{},wdRam=wd.ram||{};
  var cpuPct=wdCpu.usage||0,ramPct2=wdRam.pct||0;
  var cpuC2=cpuPct>_THR_GPU_CRIT?'pb-r':cpuPct>_THR_CPU_WARN?'pb-y':'pb-g';
  var ramC2=ramPct2>_THR_GPU_CRIT?'pb-r':ramPct2>_THR_CPU_WARN?'pb-y':'pb-g';
  var wdNet=wd.net||{}, wdDIO=wd.disk_io||{};
  var drives=wd.drives||[];
  var netHtml=(wdNet.up_mbs!==undefined?'<span>NET <span style="color:var(--green)">↑'+(wdNet.up_mbs||0)+' MB/s</span> <span style="color:var(--cyan)">↓'+(wdNet.dn_mbs||0)+' MB/s</span></span>':'')
    +(wdDIO.read_mbs!==undefined?'<span style="margin-left:.4rem">I/O <span style="color:var(--cyan)">R:'+(wdDIO.read_mbs||0)+'</span> <span style="color:var(--amber)">W:'+(wdDIO.write_mbs||0)+' MB/s</span></span>':'');
  var drivesHtml=drives.slice(0,3).map(function(dv){
    var dc=dv.pct>_THR_CPU_CRIT?'pb-r':dv.pct>_THR_CPU_WARN?'pb-y':'pb-g';
    return '<div class="pb-row"><div class="pb-hdr"><span>'+esc(dv.letter)+':</span><span>'+dv.pct+'%</span></div>'
      +'<div class="pb-track"><div class="pb '+dc+'" style="width:'+dv.pct+'%"></div></div></div>';
  }).join('');
  var moreHtml=drives.length>3?'<div style="font-size:var(--fs-xs);color:var(--muted);text-align:right">+ '+(drives.length-3)+' disque(s)…</div>':'';
  var wdJ=wd.jarvis||null;
  var jarvisStatusHtml=wdJ?'<div style="display:flex;gap:.7rem;font-size:var(--fs-xs);font-family:Courier New,monospace;margin-top:.28rem;padding-top:.22rem;border-top:1px solid rgba(255,255,255,0.05)">'
    +'<span style="color:var(--muted)">Flask <span style="color:'+(wdJ.flask_up?'var(--green)':'var(--red)')+'">●</span></span>'
    +'<span style="color:var(--muted)">MCP <span style="color:'+(wdJ.mcp_up?'var(--green)':'var(--red)')+'">●</span></span>'
    +'</div>':'';
  var h='<div class="card" id="win-res-card" data-win-modal="res" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◫</span>RESSOURCES — WINDOWS</div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.35rem">'+esc(wd.updated||'')+(wd.uptime_win?'<span style="color:rgba(0,217,255,.45);margin-left:.6rem">⬆ '+esc(wd.uptime_win)+'</span>':'')+'</div>'
   +'<div class="pb-row"><div class="pb-hdr"><span>CPU '+(wdCpu.cores||'')+'t'+(wdCpu.freq_mhz?' · '+wdCpu.freq_mhz+' MHz':'')+'</span><span>'+cpuPct+'%'+(wdCpu.temp?' · '+wdCpu.temp+'°C':'')+'</span></div>'
   +'<div class="pb-track"><div class="pb '+cpuC2+'" style="width:'+cpuPct+'%"></div></div></div>'
   +'<div class="pb-row"><div class="pb-hdr"><span>RAM</span><span>'+ramPct2+'% · '+(wdRam.used_gb||0)+' / '+(wdRam.total_gb||0)+' Go</span></div>'
   +'<div class="pb-track"><div class="pb '+ramC2+'" style="width:'+ramPct2+'%"></div></div></div>'
   +'<div style="display:flex;gap:.4rem;flex-wrap:wrap;font-size:var(--fs-xs);color:var(--muted);margin:.28rem 0 .32rem;font-family:Courier New,monospace">'+netHtml+'</div>'
   +drivesHtml+moreHtml+jarvisStatusHtml
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}
// NDT-36b — ligne status cron Proxmox (état + dernier run + prochain) → retourne '' si aucun cron
function _winBkpCronRowHtml(crons){
  if(!crons.length)return '';
  var ct0=crons[0];
  var stCol=ct0.state==='Running'?'var(--cyan)':ct0.state==='Ready'?'var(--green)':'var(--red)';
  var lastRunTxt=ct0.last_run&&ct0.last_run!=='jamais'?esc(ct0.last_run.substring(0,16)):'jamais';
  var lastOkIcon=lastRunTxt==='jamais'?'':ct0.last_ok===false?'<span style="color:var(--red)"> ✗</span>':'<span style="color:var(--green)"> ✓</span>';
  var nextRunTxt=ct0.next_run?esc(ct0.next_run.substring(0,16)):'—';
  return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--fs-xs);margin-top:.25rem;padding-top:.28rem;border-top:1px solid rgba(255,255,255,0.05);white-space:nowrap;overflow:hidden;gap:.3rem">'
    +'<span style="flex:0 0 auto"><span style="color:var(--muted)">État : </span><span style="color:'+stCol+'">● '+esc(ct0.state)+'</span></span>'
    +'<span style="flex:0 0 auto"><span style="color:var(--muted)">Run : </span><span style="color:var(--text)">'+lastRunTxt+'</span>'+lastOkIcon+'</span>'
    +'<span style="flex:0 0 auto"><span style="color:var(--muted)">Prochain : </span><span style="color:var(--cyan)">'+nextRunTxt+'</span></span>'
    +'</div>';
}
// NDT-241 — constantes + helpers arc SVG promus module-level (étaient locaux dans _bkpArcGauge)
var _ARC_CX=54,_ARC_CY=50,_ARC_R=38,_ARC_START=225,_ARC_TOTAL=270;
function _arcPolar(a,radius){var rad=(a-90)*Math.PI/180;return{x:_ARC_CX+radius*Math.cos(rad),y:_ARC_CY+radius*Math.sin(rad)};}
function _arcPath(a1,a2,ri,ro){
  var s=_arcPolar(a1,ro),e=_arcPolar(a2,ro),si=_arcPolar(a2,ri),ei=_arcPolar(a1,ri),lg=(a2-a1>180)?1:0;
  return['M',s.x,s.y,'A',ro,ro,0,lg,1,e.x,e.y,'L',si.x,si.y,'A',ri,ri,0,lg,0,ei.x,ei.y,'Z'].join(' ');
}
// NDT-38 — jauge arc SVG pour la tuile backup
function _bkpArcGauge(id,pct,used,total,unit,label,color){
  var angle=_ARC_START+(pct/100)*_ARC_TOTAL;
  var clrFill=pct>_THR_CPU_CRIT?'var(--red)':pct>_THR_CPU_WARN?'var(--yellow)':color;
  var tickParts=[];
  for(var i=0;i<=20;i++){var ta=_ARC_START+(i/20)*_ARC_TOTAL,isMaj=(i%5===0),p1=_arcPolar(ta,_ARC_R+1),p2=_arcPolar(ta,_ARC_R+(isMaj?7:4));tickParts.push('<line x1="'+p1.x+'" y1="'+p1.y+'" x2="'+p2.x+'" y2="'+p2.y+'" stroke="rgba(255,255,255,'+(isMaj?'.3':'.1')+')" stroke-width="'+(isMaj?1.2:0.7)+'"/>');} var ticks=tickParts.join('');
  var trackD=_arcPath(_ARC_START,_ARC_START+_ARC_TOTAL,_ARC_R-8,_ARC_R);
  var fillD=pct>0?_arcPath(_ARC_START,angle,_ARC_R-8,_ARC_R):'';
  var pS=_arcPolar(_ARC_START,_ARC_R+13),pE=_arcPolar(_ARC_START+_ARC_TOTAL,_ARC_R+13);
  return '<svg id="'+id+'" viewBox="0 0 108 90" width="108" height="90" style="display:block">'
    +'<defs><filter id="glow-'+id+'"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    +'<path d="'+trackD+'" fill="rgba(255,255,255,.07)"/>'+ticks
    +(fillD?'<path d="'+fillD+'" fill="'+clrFill+'" filter="url(#glow-'+id+')" opacity=".92"/>':'')
    +'<text x="'+pS.x.toFixed(1)+'" y="'+(pS.y+3).toFixed(1)+'" text-anchor="middle" font-size="5.5" fill="rgba(255,255,255,.2)" style="font-family:\'Courier New\'">0</text>'
    +'<text x="'+pE.x.toFixed(1)+'" y="'+(pE.y+3).toFixed(1)+'" text-anchor="middle" font-size="5.5" fill="rgba(255,255,255,.2)" style="font-family:\'Courier New\'">MAX</text>'
    +'<text x="'+_ARC_CX+'" y="'+(_ARC_CY+5)+'" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="'+clrFill+'" filter="url(#glow-'+id+')" style="font-family:\'Courier New\',monospace">'+Math.round(pct)+'%</text>'
    +'<text x="'+_ARC_CX+'" y="'+(_ARC_CY+19)+'" text-anchor="middle" font-size="6.5" fill="rgba(122,154,184,.85)" style="font-family:\'Courier New\',monospace">'+used+'/'+total+' '+unit+'</text>'
    +'<text x="'+_ARC_CX+'" y="'+(_ARC_CY+30)+'" text-anchor="middle" font-size="6.5" font-weight="600" fill="rgba(255,255,255,.45)" letter-spacing="1.5" style="font-family:\'Courier New\',monospace">'+label+'</text>'
    +'</svg>';
}
// NDT-240 — helpers backup promus module-level (étaient des closures dans _renderWinTileBkp)
var _MOIS_FR=['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
function _bkpDateSh(s){
  if(!s)return'—';
  var d=new Date(s.replace(' ','T'));if(isNaN(d))return'—';
  var now=new Date();
  if(d.toDateString()===now.toDateString())return'auj.';
  return d.getDate()+'\xa0'+_MOIS_FR[d.getMonth()];
}
function _bkpVmRows(allVms,vmsObj){
  return allVms.map(function(vmn){
    var v=vmsObj[vmn]||{}, age=_winBkpAge(v.last_date), col=_winBkpCol(age);
    var szStr=v.size_gb>0?v.size_gb.toFixed(1)+'\xa0Go':'—';
    var cntStr=v.count>0?'['+v.count+']':'[0]';
    return '<div style="display:flex;align-items:center;gap:.2rem;font-size:var(--fs-xs);padding:.06rem 0">'
      +'<span style="color:'+col+';font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">●</span>'
      +'<span style="color:rgba(185,215,240,.75);flex:0 0 5rem">'+esc(vmn)+'</span>'
      +'<span style="color:'+col+';font-weight:700;flex:0 0 3.8rem">'+_bkpDateSh(v.last_date)+'</span>'
      +'<span style="color:rgba(122,154,184,.7);flex:1">'+szStr+'</span>'
      +'<span style="color:var(--c-muted-4);font-family:\'Courier New\',monospace">'+cntStr+'</span>'
      +'</div>';
  }).join('');
}
function _bkpZoneBox(label,col,border,bg,rows){
  return '<div style="padding:.25rem .35rem;border:1px solid '+border+';border-radius:3px;background:'+bg+';margin-bottom:.2rem">'
    +'<div style="display:flex;align-items:center;gap:.3rem;font-size:calc(var(--fs-xs) - 2px);color:'+col+';letter-spacing:1.2px;margin-bottom:.2rem;text-transform:uppercase;border-bottom:1px solid '+border+';padding-bottom:.15rem">'
    +'<span>⊙</span><span>'+label+'</span></div>'
    +rows+'</div>';
}
function _renderWinTileBkp(wd,g){
  var wdb=wd.backup||{};
  var zones=wdb.zones||{};
  var vmsManual=zones.manual||{};
  var vmsAuto=zones.auto||{};
  var crons=wd.cron||[];
  var usedGo=wdb.used_gb||0;
  var quota=wdb.quota_gb||300;
  var usedPct=wdb.pct||0;
  // Union triée des VMs connues
  var _allVms=(function(){var s={};[vmsManual,vmsAuto].forEach(function(z){Object.keys(z).forEach(function(k){s[k]=1;});});return Object.keys(s).sort();}());
  var bkpPath=wdb.path||'D:\\BACKUP-PROXMOX';
  var manualBox=_bkpZoneBox('À LA DEMANDE — '+bkpPath,'rgba(0,217,255,.6)','rgba(0,217,255,.14)','rgba(0,120,180,.05)',_bkpVmRows(_allVms,vmsManual));
  var autoBox=_bkpZoneBox('AUTO — '+bkpPath,'rgba(0,200,100,.55)','rgba(0,200,100,.12)','rgba(0,40,10,.05)',_bkpVmRows(_allVms,vmsAuto));
  // Ligne tâche planifiée — première tâche ProxmoxBackup-* trouvée
  var cronTask=(crons.filter(function(c){return c.name&&c.name.indexOf('ProxmoxBackup')===0;})||[])[0]||null;
  var cronRow=cronTask?_winBkpCronRowHtml([cronTask])
    :'<div style="display:flex;align-items:center;gap:.4rem;font-size:var(--fs-xs);margin-top:.2rem;padding-top:.2rem;border-top:1px solid rgba(255,255,255,.05)">'
      +'<span style="color:var(--red)">⚠</span>'
      +'<span style="color:var(--muted)">Tâche planifiée : </span>'
      +'<span style="color:var(--red);font-weight:700">ABSENTE</span>'
      +'<span style="color:rgba(122,154,184,.35);margin-left:auto;font-family:\'Courier New\'">ProxmoxBackup-*</span>'
      +'</div>';
  // Barre quota
  var qCol=usedPct>_THR_CPU_CRIT?'var(--red)':usedPct>_THR_CPU_WARN?'var(--yellow)':'var(--cyan)';
  var quotaRow='<div style="margin-top:.22rem">'
    +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.1rem">'
    +'<span style="color:rgba(122,154,184,.65);letter-spacing:.5px">QUOTA '+esc(bkpPath)+'</span>'
    +'<span style="color:'+qCol+'">'+usedGo.toFixed(1)+'\xa0Go\xa0/\xa0'+quota+'\xa0Go\xa0('+Math.round(usedPct)+'%)</span>'
    +'</div>'
    +'<div style="height:5px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">'
    +'<div style="height:100%;width:'+Math.min(usedPct,100)+'%;background:'+qCol+';border-radius:2px;opacity:.85"></div></div>'
    +'</div>';
  var h='<div class="card" id="win-bkp-card" data-win-modal="bkp" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◎</span>SAUVEGARDES</div>'
   +'<div style="margin:.2rem 0">'+manualBox+autoBox+'</div>'
   +cronRow
   +quotaRow
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}
// NDT-37 — arc gauge tuile GPU (r=32, 5 graduations, statique)
function _tileGaugeSVG(pct,stroke,label,sub,centerVal){
  var r=32,circ=2*Math.PI*r,arcLen=circ*0.75;
  var filled=(pct/100)*arcLen;
  var ticks='';
  [0,25,50,75,100].forEach(function(p){
    var a=(225+p*2.7)*Math.PI/180;
    var sa=Math.sin(a),ca=Math.cos(a);
    ticks+='<line x1="'+(40+26*sa).toFixed(1)+'" y1="'+(40-26*ca).toFixed(1)+'" x2="'+(40+37*sa).toFixed(1)+'" y2="'+(40-37*ca).toFixed(1)+'" stroke="rgba(122,154,184,0.3)" stroke-width="1.5"/>';
  });
  var disp=centerVal!=null?String(centerVal):(pct+'%');
  return '<svg viewBox="0 0 80 80" width="88" height="88">'
   +'<circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="7" stroke-dasharray="'+arcLen.toFixed(2)+' '+(circ-arcLen).toFixed(2)+'" transform="rotate(135,40,40)" stroke-linecap="round"/>'
   +ticks
   +'<circle cx="40" cy="40" r="32" fill="none" stroke="'+stroke+'" stroke-width="7" stroke-dasharray="'+filled.toFixed(2)+' '+(circ-filled).toFixed(2)+'" transform="rotate(135,40,40)" stroke-linecap="round"/>'
   +'<text x="40" y="36" text-anchor="middle" fill="rgba(240,240,255,0.95)" font-size="12" font-family="Courier New,monospace" font-weight="bold">'+esc(disp)+'</text>'
   +(label?'<text x="40" y="49" text-anchor="middle" fill="rgba(122,154,184,0.7)" font-size="8" font-family="Courier New,monospace">'+esc(label)+'</text>':'')
   +(sub?'<text x="40" y="61" text-anchor="middle" fill="rgba(122,154,184,0.5)" font-size="7" font-family="Courier New,monospace">'+esc(sub)+'</text>':'')
   +'</svg>';
}
// NDT-37 — tuile GPU : 2 arcs centrés + barres pleine largeur (TEMP dégradé + POWER jaune) + footer
function _gpuTileHtml(wdGpu){
  if(!wdGpu)return '';
  var gpuU=wdGpu.usage||0;
  var gpuVP=wdGpu.vram_pct||0;
  var gpuVU=((wdGpu.vram_used_mb||0)/1024).toFixed(1);
  var gpuVT=((wdGpu.vram_total_mb||0)/1024).toFixed(1);
  var tempRaw=wdGpu.temp!=null?wdGpu.temp:0;
  var tempPct=Math.min(Math.round(tempRaw/110*100),100);
  var pwrPct=wdGpu.power_pct!=null?wdGpu.power_pct:0;
  var ps=wdGpu.perf_state||'';
  var pci=wdGpu.pcie_gen&&wdGpu.pcie_width?wdGpu.pcie_gen+'\xd7'+wdGpu.pcie_width:'';
  var gpuStroke=gpuU>_THR_GPU_CRIT?'var(--red)':gpuU>_THR_CPU_WARN?'var(--amber)':'var(--purple)';
  var vramStroke=gpuVP>_THR_GPU_CRIT?'var(--red)':gpuVP>_THR_CPU_WARN?'var(--amber)':'var(--cyan)';
  // P-state badge coloré
  var psCol=ps==='P0'?'rgba(0,200,100,0.85)':ps&&/^P[1-3]$/.test(ps)?'rgba(0,217,255,0.75)':'rgba(122,154,184,0.6)';
  var psBorder=ps==='P0'?'rgba(0,200,100,0.3)':ps&&/^P[1-3]$/.test(ps)?'rgba(0,217,255,0.25)':'rgba(122,154,184,0.2)';
  var psBg=ps==='P0'?'rgba(0,200,100,0.06)':ps&&/^P[1-3]$/.test(ps)?'rgba(0,217,255,0.05)':'rgba(122,154,184,0.05)';
  var psBadge=ps?'<span style="font-size:var(--fs-2xs);padding:.04rem .28rem;background:'+psBg+';border:1px solid '+psBorder+';color:'+psCol+';border-radius:2px;font-family:Courier New,monospace">'+esc(ps)+'</span>':'';
  var pciBadge=pci?'<span style="font-size:var(--fs-2xs);padding:.04rem .28rem;background:rgba(0,217,255,0.05);border:1px solid rgba(0,217,255,0.2);color:rgba(0,217,255,0.6);border-radius:2px;font-family:Courier New,monospace">PCIe '+esc(pci)+'</span>':'';
  // 2 arcs centrés
  var gauges='<div style="display:flex;justify-content:space-around;margin:.2rem 0 .1rem">'
   +_tileGaugeSVG(gpuU,gpuStroke,'COMPUTE',(wdGpu.clock_gpu_mhz||'')+'MHz',null)
   +_tileGaugeSVG(gpuVP,vramStroke,'VRAM',gpuVU+'/'+gpuVT+'G',null)
   +'</div>';
  // Barre TEMP dégradée froid→chaud (pleine largeur)
  var tempTxtCol=tempRaw>_THR_TEMP_CRIT?'var(--red)':tempRaw>_THR_TEMP_WARN?'var(--amber)':'var(--green)';
  var barsHtml='<div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.2rem">'
   +'<div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.1rem">'
   +'<span style="color:rgba(122,154,184,0.65);letter-spacing:.5px">TEMP</span>'
   +'<span style="color:'+tempTxtCol+'">'+tempRaw+'\xb0C</span></div>'
   +'<div class="pb-track"><div style="height:100%;width:'+tempPct+'%;background:linear-gradient(90deg,rgba(0,200,255,.65),rgba(0,200,100,.75) 35%,rgba(245,158,11,.8) 62%,rgba(255,100,40,.85) 82%,rgba(255,50,50,.9));border-radius:1px"></div></div></div>';
  if(wdGpu.power_pct!=null){
    var pwrTxtCol2=pwrPct>_THR_CPU_CRIT?'var(--red)':pwrPct>_THR_CPU_WARN?'var(--amber)':'rgba(245,158,11,0.85)';
    var pwrW=Math.round(wdGpu.power_w||0);
    barsHtml+='<div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.1rem">'
     +'<span style="color:rgba(245,158,11,0.65);letter-spacing:.5px">POWER</span>'
     +'<span style="color:'+pwrTxtCol2+'">'+pwrW+'W\xa0('+pwrPct+'%)</span></div>'
     +'<div class="pb-track"><div style="height:100%;width:'+Math.min(pwrPct,100)+'%;background:linear-gradient(90deg,rgba(140,70,0,.7),rgba(245,158,11,.9));border-radius:1px"></div></div></div>';
  }
  barsHtml+='</div>';
  // Footer : ENC/DEC/SM/Fan
  var sec=[];
  if(wdGpu.enc_pct!=null)sec.push('<span style="color:rgba(191,95,255,.85)">ENC\xa0'+wdGpu.enc_pct+'%</span>');
  if(wdGpu.dec_pct!=null)sec.push('<span style="color:rgba(0,217,255,.85)">DEC\xa0'+wdGpu.dec_pct+'%</span>');
  if(wdGpu.clock_sm_mhz!=null)sec.push('<span style="color:rgba(191,95,255,.7)">SM\xa0'+wdGpu.clock_sm_mhz+'MHz</span>');
  if(wdGpu.fan_pct!=null)sec.push('<span style="color:var(--text)">Fan\xa0'+wdGpu.fan_pct+'%</span>');
  var secHtml=sec.length?'<div style="display:flex;gap:.45rem;font-size:var(--fs-xs);color:var(--muted);flex-wrap:wrap;padding-top:.2rem;border-top:1px solid rgba(255,255,255,0.05)">'
   +sec.join('<span style="color:rgba(122,154,184,0.3)">\xa0\xb7\xa0</span>')+'</div>':'';
  // Throttle
  var thrActive=wdGpu.thr_power||wdGpu.thr_hw||wdGpu.thr_thermal||wdGpu.thr_hw_therm;
  var thrHtml='';
  if(thrActive){
    var tl=[];
    if(wdGpu.thr_power)tl.push('PWR CAP');
    if(wdGpu.thr_thermal||wdGpu.thr_hw_therm)tl.push('THERMAL');
    if(wdGpu.thr_hw)tl.push('HW LIMIT');
    thrHtml='<div style="font-size:var(--fs-xs);color:rgba(255,180,0,0.8);background:rgba(255,160,0,0.06);border:1px solid rgba(255,160,0,0.25);border-radius:3px;padding:.1rem .4rem;margin-bottom:.15rem">⚡ THR: '+tl.join(' \xb7 ')+'</div>';
  }
  return '<div class="card" id="win-gpu-card" data-gpu-modal="1" style="cursor:pointer;border-color:rgba(191,95,255,0.2)">'
   +'<div class="corner tl" style="border-color:rgba(191,95,255,0.4)"></div>'
   +'<div class="corner tr" style="border-color:rgba(191,95,255,0.4)"></div>'
   +'<div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬡</span>GPU — INTELLIGENCE ARTIFICIELLE</div>'
   +'<div style="display:flex;align-items:center;margin-bottom:.1rem;gap:.3rem;flex-wrap:wrap;min-width:0">'
   +'<span style="font-size:var(--fs-xs);color:var(--muted);font-family:Courier New,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">'+esc((wdGpu.name||'').substring(0,32))+'</span>'
   +psBadge+(psBadge&&pciBadge?'<span style="color:rgba(122,154,184,0.3)">\xa0\xb7\xa0</span>':'')+pciBadge+'</div>'
   +gauges+barsHtml+secHtml+thrHtml
   +'</div></div>';
}
function _renderWinTileGpu(wd,g){
  var gt=_gpuTileHtml(wd.gpu||null); if(gt)g.insertAdjacentHTML('beforeend',gt);
  // ── FREEBOX — insertion ici pour alignement ──
  if(window._fbxPendingHtml){
    g.insertAdjacentHTML('beforeend',window._fbxPendingHtml);
    window._fbxPendingHtml=null;
    if(window._fbxSparkVals&&window._fbxSparkVals.length>1){
      _raf2(function(){
        var c=document.getElementById('wan-spark');
        if(c)drawNetSparkline(c,window._fbxSparkVals,'0,217,255',Math.max.apply(null,window._fbxSparkVals)||1);
      });
    }
  }
}
function _fmtCronAge(min){
  if(min===null||min===undefined) return '';
  if(min<2) return '<2min';
  if(min<60) return min+'min';
  if(min<1440) return Math.floor(min/60)+'h';
  return Math.floor(min/1440)+'j';
}
function _cronRowHtml(label,schedule,last_run,age_min,ok){
  var col=ok?'var(--green)':'var(--red)';
  var icon=ok?'✓':'✗';
  var runTxt=last_run?esc(last_run.substring(5,16)):'—';
  var ageTxt=_fmtCronAge(age_min);
  return '<div style="display:grid;grid-template-columns:1fr 4.5rem 6.5rem .9rem;gap:.1rem .35rem;font-size:var(--fs-xs);padding:.16rem .2rem;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center">'
    +'<span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(label)+'</span>'
    +'<span style="color:var(--c-muted-4);font-family:\'Courier New\',monospace;font-size:var(--fs-2xs);text-align:right;white-space:nowrap">'+esc(schedule||'')+'</span>'
    +'<span style="color:var(--muted);white-space:nowrap;text-align:right">'+runTxt
      +(ageTxt?'<span style="color:rgba(122,154,184,.3);margin-left:.2rem">'+ageTxt+'</span>':'')
    +'</span>'
    +'<span style="color:'+col+';font-weight:700;text-align:right">'+icon+'</span>'
    +'</div>';
}
function _renderWinTileCrons(d,wd,g){
  var crons=d.crons||{};
  var cronJobs=crons.jobs||[];
  var winCrons=wd.cron||[];
  if(!cronJobs.length&&!winCrons.length) return;
  var CAT_ORDER=['Monitoring','Rapports','Sécurité'];
  var CAT_META={
    'Monitoring':{col:'var(--cyan)',  lbl:'◎ MONITORING & COLLECTE'},
    'Rapports':  {col:'var(--yellow)',lbl:'◎ RAPPORTS & FEEDS'},
    'Sécurité':  {col:'var(--orange)',lbl:'⊛ SÉCURITÉ & INTÉGRITÉ'}
  };
  var cronJobsHtml='';
  if(cronJobs.length){
    cronJobsHtml='<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--cyan);margin:.3rem 0 .2rem">SRV-NGIX</div>';
    CAT_ORDER.forEach(function(cat){
      var jobs=cronJobs.filter(function(j){return j.cat===cat;});
      if(!jobs.length) return;
      var m=CAT_META[cat];
      cronJobsHtml+='<div style="font-size:var(--fs-2xs);color:'+m.col+';letter-spacing:.6px;margin:.25rem 0 .06rem;text-transform:uppercase;opacity:.7">'+m.lbl+'</div>';
      cronJobsHtml+=jobs.map(function(j){return _cronRowHtml(j.label,j.schedule,j.last_run,j.age_min,j.ok);}).join('');
    });
  }
  var winCronsHtml='';
  if(winCrons.length){
    winCronsHtml='<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--cyan);margin:.4rem 0 .2rem">WINDOWS</div>'
      +winCrons.map(function(ct){
        var stOk=ct.last_ok!==false;
        var col=ct.state==='Running'?'var(--cyan)':stOk?'var(--green)':'var(--red)';
        var icon=ct.state==='Running'?'↻':stOk?'✓':'✗';
        var runTxt=ct.last_run&&ct.last_run!=='jamais'?esc(ct.last_run.substring(5,16)):'—';
        var nextTxt=ct.next_run?esc(ct.next_run.substring(5,10)):'—';
        return '<div style="display:grid;grid-template-columns:1fr 4.5rem 6.5rem .9rem;gap:.1rem .35rem;font-size:var(--fs-xs);padding:.16rem .2rem;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center">'
          +'<span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(ct.name)+'</span>'
          +'<span style="color:var(--muted);white-space:nowrap;text-align:right;grid-column:2/4">'+runTxt+' → '+nextTxt+'</span>'
          +'<span style="color:'+col+';font-weight:700;text-align:right">'+icon+'</span>'
          +'</div>';
      }).join('');
  }
  var h='<div class="card half"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⊙</span>CRONS — INFRASTRUCTURE</div>'
   +cronJobsHtml+winCronsHtml
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}
function _renderWindowsTiles(d,g){
  var wd=d.windows_disk||{};
  if(wd.available){
    _renderWinTileResources(wd,g);
    _renderWinTileBkp(wd,g);
    _renderWinTileGpu(wd,g);
    _renderWinTileCrons(d,wd,g);
  }
}

