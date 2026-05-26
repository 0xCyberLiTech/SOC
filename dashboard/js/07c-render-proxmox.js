'use strict';
// 07c-render-proxmox.js — Rendu tuile Proxmox (Sprint 2B 2026-05-16).
// Extrait de 07-render.js : helpers _prx*/_pve*/_mem*/_sys{Storage,Network}* + _renderProxmoxNode + _renderProxmox.
// Chargé AVANT 07-render.js dans index.html.

// ── Proxmox tile helpers v3.97.88 ────────────────────────────────────────────
function _prxFmtBytes(b){
  if(b>=1e12) return (b/1e12).toFixed(1)+' To';
  if(b>=1e9)  return (b/1e9).toFixed(1)+' Go';
  if(b>=1e6)  return Math.round(b/1e6)+' Mo';
  return Math.round(b/1e3)+' Ko';
}
function _prxFmtSpeed(mb){
  if(mb<=0)    return '—';
  if(mb>=10000)return '10G';
  if(mb>=1000) return '1G';
  if(mb>=100)  return '100M';
  return mb+'M';
}
// NDT-157 — bytes/s → MB/s (distinct de fmtBps global qui convertit bits/s → Mbps)
function _prxFmtBytesPerSec(b){return b>=1e6?(b/1e6).toFixed(1)+' MB/s':b>=1e3?Math.round(b/1e3)+' KB/s':b+' B/s';}
// NDT-158 — memBar identique dans openSysModal + _sysCardHtml + _prxMemHtml → module-level
function _memBar(label,pct,usedStr,totalStr){
  var col=pct>_THR_CPU_CRIT?'var(--red)':pct>_THR_CPU_WARN?'var(--yellow)':'var(--purple)';
  var grad=pct>_THR_CPU_CRIT?'linear-gradient(90deg,rgba(160,20,20,.8),var(--red))':pct>_THR_CPU_WARN?'linear-gradient(90deg,rgba(160,90,0,.8),var(--yellow))':'linear-gradient(90deg,rgba(80,20,180,.7),var(--purple))';
  return '<div class="prx-mem-row">'
    +'<span class="prx-mem-label">'+label+'</span>'
    +'<div class="prx-mem-bar-wrap"><div class="prx-mem-bar" style="width:'+pct+'%;background:'+grad+'"></div></div>'
    +'<span class="prx-mem-vals">'+usedStr+'/'+totalStr+' <span style="color:'+col+'">'+pct+'%</span></span>'
    +'</div>';
}
function _prxTempColor(t,warn,crit){
  if(t==null) return 'var(--muted)';
  return t>=crit?'var(--red)':t>=warn?'var(--yellow)':'var(--cyan)';
}
function _prxSec(label,color){
  return '<div class="prx-sec-hdr" style="color:'+color+'">▶ '+label+'</div>';
}
function _pveCpuSparkline(pveCpuHist){
  if(pveCpuHist.length<=1) return '';
  var pts=pveCpuHist.slice(-24);
  var lastCpu=pts[pts.length-1].cpu||0;
  var lastTemp=pts[pts.length-1].temp;
  var sc=lastCpu>_THR_CPU_CRIT?_COL_CPU_CRIT_HEX:lastCpu>_THR_CPU_WARN?PROTO_PALETTE.WATCH:_COL_PURPLE_HEX;
  var rgb=lastCpu>_THR_CPU_CRIT?'255,77,77':lastCpu>_THR_CPU_WARN?'245,158,11':'191,95,255';
  var vals=pts.map(function(p){return p.cpu||0;});
  var maxC=Math.max.apply(null,vals)||0.5;
  window._pveCpuSparkData={vals:vals,rgb:rgb,maxC:maxC};
  return '<div class="prx-spark-wrap">'
    +'<div class="prx-spark-hdr">'
    +'<span>HISTORIQUE CPU — 4H</span>'
    +'<span style="color:'+sc+';font-weight:700">'+lastCpu+'%'+(lastTemp!=null?' · '+lastTemp+'°C':'')+'</span>'
    +'</div>'
    +'<canvas id="pve-cpu-spark" height="32"></canvas>'
    +'</div>';
}
function _sysCpuSparkline(hist){
  if(!hist||hist.length<=1) return '';
  var pts=hist.slice(-24);
  var lastCpu=pts[pts.length-1].cpu||0;
  var sc=lastCpu>_THR_CPU_CRIT?_COL_CPU_CRIT_HEX:lastCpu>_THR_CPU_WARN?PROTO_PALETTE.WATCH:_COL_CYAN_HEX;
  var rgb=lastCpu>_THR_CPU_CRIT?'255,77,77':lastCpu>_THR_CPU_WARN?'245,158,11':_COL_CYAN_RGB;
  var vals=pts.map(function(p){return p.cpu||0;});
  var maxC=Math.max.apply(null,vals)||0.5;
  window._sysCpuSparkData={vals:vals,rgb:rgb,maxC:maxC};
  return '<div class="prx-spark-wrap">'
    +'<div class="prx-spark-hdr">'
    +'<span>HISTORIQUE CPU — 4H</span>'
    +'<span style="color:'+sc+';font-weight:700">'+lastCpu+'%</span>'
    +'</div>'
    +'<canvas id="sys-cpu-spark" height="32"></canvas>'
    +'</div>';
}
function _pveNodeCountermeasures(prxFw, prxF2bBan){
  var ufwOk=prxFw.ufw_active===true;
  var ufwCol=ufwOk?'var(--green)':'var(--red)';
  var conf=prxFw.conformity;
  var confCol=conf===undefined?'var(--muted)':conf>=90?'var(--green)':conf>=70?'var(--yellow)':'var(--red)';
  var f2bCol=prxF2bBan===null?'var(--muted)':prxF2bBan>0?'var(--red)':'var(--green)';
  return '<div style="margin-top:.45rem;padding:.28rem .45rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:3px">'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.2rem">// Contre-mesures</div>'
    +'<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    +'<span style="font-size:var(--fs-xs);color:'+ufwCol+'">■ UFW '+(ufwOk?'ACTIVE':'INACTIVE')+'</span>'
    +'<span style="color:rgba(255,255,255,0.1)">│</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">Règles : <span style="color:var(--cyan)">'+(prxFw.ufw_rules||0)+'</span></span>'
    +'<span style="color:rgba(255,255,255,0.1)">│</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">Fail2ban : <span style="color:'+f2bCol+'">'+(prxF2bBan===null?'—':prxF2bBan+' ban'+((prxF2bBan!==1)?'s':''))+'</span></span>'
    +'<span style="color:rgba(255,255,255,0.1)">│</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">Conformité : <span style="color:'+confCol+'">'+(conf!==undefined?conf+'/100':'—')+'</span></span>'
    +'</div>'
    +'</div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.25);margin-top:.3rem;text-align:center;letter-spacing:.6px">↑ cliquer pour détails</div>';
}
// ── Section ▶ PROCESSEUR : ring CPU + meta + températures + sparkline
function _prxNodeHeaderHtml(node, pveCpuHist){
  var cpu=node.cpu_pct||0;
  var nc=cpu>_THR_CPU_CRIT?'var(--red)':cpu>_THR_CPU_WARN?'var(--yellow)':'var(--purple)';
  var running=(node.vms||[]).filter(function(v){return v.status==='running';}).length;
  var total=(node.vms||[]).length;
  var model=(node.cpu_model||'').replace(/\d+(th|rd|nd|st) Gen Intel\(R\) Core\(TM\) /i,'').replace(/\(R\)/g,'').trim().substring(0,24);
  var tempsHtml='';
  if(node.cpu_temp!=null){var tc=_prxTempColor(node.cpu_temp,70,85);tempsHtml+='<span class="prx-tbadge">CPU <b style="color:'+tc+'">'+node.cpu_temp+'°</b></span>';}
  (node.nvme_disks||[]).forEach(function(d){
    if(d.temp_c==null) return;
    var tc=_prxTempColor(d.temp_c,55,70);
    tempsHtml+='<span class="prx-tbadge">'+esc(d.device.replace(/nvme(\d+)n1/,'N$1'))+' <b style="color:'+tc+'">'+d.temp_c+'°</b></span>';
  });
  (node.fans||[]).forEach(function(f){
    var fc=f.rpm>3500?'var(--yellow)':'var(--green)';
    tempsHtml+='<span class="prx-tbadge">'+esc(f.name)+' <b style="color:'+fc+'">'+f.rpm+' RPM</b></span>';
  });
  return _prxSec('PROCESSEUR','var(--purple)')
    +'<div class="cpu-wrap">'
    +'<div class="cpu-ring" style="width:52px;height:52px">'+ring(cpu,nc,52)
    +'<div class="ring-text"><span class="ring-pct" style="font-size:var(--fs-xs);color:'+nc+'">'+cpu+'%</span><span class="ring-core">CPU</span></div></div>'
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.1rem">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:.3rem">'
    +'<div class="pve-node-name">'+esc(node.name)+'</div>'
    +'<span class="prx-vms-badge"><span style="color:var(--green)">'+running+' run</span><span style="color:rgba(122,154,184,.35)"> · '+(total-running)+' stop</span></span>'
    +'</div>'
    +(model?'<div class="prx-model-line" title="'+esc(node.cpu_model||'')+'">'+esc(model)+(node.cpu_cores?' · '+node.cpu_cores+'T':'')+'</div>':'')
    +(node.pve_version?'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(139,92,246,.5);font-family:\'Courier New\',monospace;margin-top:.05rem">PVE '+esc(node.pve_version)+'</div>':'')
    +(node.uptime&&node.uptime!=='?'?'<div class="prx-uptime-line">'+esc(node.uptime)+'</div>':'')
    +(tempsHtml?'<div class="prx-temps">'+tempsHtml+'</div>':'')
    +'</div>'
    +'</div>'
    +_pveCpuSparkline(pveCpuHist);
}
// ── Section ▶ MÉMOIRE & SYSTÈME : barres RAM / Swap / rootfs
function _prxMemHtml(node){
  var swapPct=node.swap_total_mb>0?Math.round((node.swap_used_mb||0)/node.swap_total_mb*100):0;
  // Unité cohérente pour Swap : si total >= 1024 Mo, forcer Go même pour 0
  var swapUsedStr=node.swap_total_mb>=1024?((node.swap_used_mb||0)/1024).toFixed(1)+' Go':fmtMb(node.swap_used_mb||0);
  return _prxSec('MÉMOIRE &amp; SYSTÈME','var(--purple)')
    +_memBar('RAM',node.mem_pct||0,fmtMb(node.mem_used_mb),fmtMb(node.mem_total_mb))
    +(node.swap_total_mb>0?_memBar('Swap',swapPct,swapUsedStr,fmtMb(node.swap_total_mb)):'')
    +(node.rootfs_total_gb>0?_memBar('rootfs',node.rootfs_pct||0,(node.rootfs_used_gb||'?')+' Go',(node.rootfs_total_gb||'?')+' Go'):'');
}
// ── Section ▶ STOCKAGE NVMe : barre température + storages associés
function _prxNvmeDisksHtml(nvmeDisks, storages, zfsPools){
  var SKIP=['truenas-backups','backup-local'];
  var zp=zfsPools||[];
  var sts=(storages||[]).filter(function(st){return SKIP.indexOf(st.name)===-1;});
  if(!nvmeDisks||!nvmeDisks.length){
    if(!sts.length) return '';
    return _prxSec('STOCKAGE','var(--cyan)')
      +sts.map(function(st){
        var sc=st.pct>_THR_CPU_CRIT?'pb-r':st.pct>_THR_CPU_WARN?'pb-y':'pb-g';
        return '<div class="pb-row"><div class="pb-hdr"><span>'+esc(st.name)+' <span style="color:var(--muted);font-size:var(--fs-xs)">('+esc(st.type)+')</span></span>'
          +'<span>'+st.used_gb+' / '+st.total_gb+' Go ('+st.pct+'%)</span></div>'
          +'<div class="pb-track"><div class="pb '+sc+'" style="width:'+st.pct+'%"></div></div></div>';
      }).join('');
  }
  // Pré-calcul : quels devices sont utilisés par ZFS (pour affecter les autres storages)
  var zfsDevs=zp.filter(function(p){return p.nvme_device;}).map(function(p){return p.nvme_device;});
  var firstNonZfsDisk=null;
  for(var _di=0;_di<(nvmeDisks||[]).length;_di++){if(zfsDevs.indexOf(nvmeDisks[_di].device)===-1){firstNonZfsDisk=nvmeDisks[_di];break;}}
  var h=_prxSec('STOCKAGE NVMe','var(--cyan)');
  nvmeDisks.forEach(function(disk){
    var tc=_prxTempColor(disk.temp_c,55,70);
    var cap=disk.total_gb>=1000?(disk.total_gb/1000).toFixed(1)+' To':disk.total_gb+' Go';
    var mdl=(disk.model||'?').replace(/Samsung SSD /i,'Samsung ').replace(/SAMSUNG /i,'Samsung ').substring(0,20);
    var tPct=disk.temp_c!=null?Math.min(100,Math.max(0,Math.round((disk.temp_c-25)/60*100))):0;
    var tGrad=disk.temp_c!=null?(disk.temp_c>70?'linear-gradient(90deg,rgba(200,60,0,.9),var(--red))':disk.temp_c>55?'linear-gradient(90deg,rgba(150,80,0,.9),var(--yellow))':'linear-gradient(90deg,rgba(0,80,150,.9),var(--cyan))'):'rgba(255,255,255,.08)';
    var smartBadge=disk.smart_ok===true
      ?'<span style="color:var(--green);font-size:var(--fs-xs);font-weight:700;font-family:\'Courier New\',monospace;margin-left:.35rem;opacity:.75">✓ SMART</span>'
      :disk.smart_ok===false
        ?'<span style="color:var(--red);font-size:var(--fs-xs);font-weight:700;font-family:\'Courier New\',monospace;margin-left:.35rem">✗ SMART</span>'
        :'';
    h+='<div class="nvme-disk-hdr">'
      +'<span class="nvme-dev">'+esc(disk.device)+'</span>'
      +'<span class="nvme-mdl">'+esc(mdl)+'</span>'
      +smartBadge
      +'<span class="nvme-cap">'+cap+'</span>'
      +(disk.temp_c!=null
        ?'<span class="nvme-temp-wrap">'
          +'<div class="prx-temp-bar-wrap"><div class="prx-temp-bar" style="width:'+tPct+'%;background:'+tGrad+'"></div></div>'
          +'<b style="color:'+tc+'">'+disk.temp_c+'°</b>'
          +'</span>'
        :'')
      +'</div>';
    var dsts=sts.filter(function(st){
      if(st.type==='zfspool'){
        var pool=zp.find(function(p){return p.nvme_device===disk.device;});
        if(!pool) pool=zp.find(function(p){return st.name.indexOf(p.name)!==-1||p.name.indexOf(st.name)!==-1;});
        return pool?pool.nvme_device===disk.device:false;
      }
      return firstNonZfsDisk?disk.device===firstNonZfsDisk.device:false;
    });
    dsts.forEach(function(st){
      var sc=st.pct>_THR_CPU_CRIT?'pb-r':st.pct>_THR_CPU_WARN?'pb-y':'pb-g';
      var zfsBadge='';
      if(st.type==='zfspool'&&zp.length){
        var pool=zp.find(function(p){return st.name.indexOf(p.name)!==-1||p.name.indexOf(st.name)!==-1;});
        if(pool){
          var hc=pool.health==='ONLINE'?'var(--green)':pool.health==='DEGRADED'?'var(--yellow)':'var(--red)';
          zfsBadge='<span style="color:'+hc+';font-size:var(--fs-xs);font-weight:700;font-family:\'Courier New\',monospace;margin-left:.3rem">'+esc(pool.health)+'</span>';
        }
      }
      h+='<div class="pb-row prx-st-row"><div class="pb-hdr">'
        +'<span>'+esc(st.name)+zfsBadge+' <span style="color:var(--muted);font-size:var(--fs-xs)">('+esc(st.type)+')</span></span>'
        +'<span>'+st.used_gb+'/'+st.total_gb+' Go <span style="color:var(--muted)">('+st.pct+'%)</span></span>'
        +'</div><div class="pb-track"><div class="pb '+sc+'" style="width:'+st.pct+'%"></div></div></div>';
    });
  });
  return h;
}
// ── Section ▶ STOCKAGE SYSTEME : même pb-row que Proxmox storages
function _sysStorageHtml(volumes){
  if(!volumes||!volumes.length) return '';
  return _prxSec('STOCKAGE','var(--cyan)')
    +volumes.map(function(v){
      var sc=v.pct>_THR_CPU_CRIT?'pb-r':v.pct>_THR_CPU_WARN?'pb-y':'pb-g';
      return '<div class="pb-row">'
        +'<div class="pb-hdr">'
        +'<span><span style="color:var(--cyan);font-weight:700;font-family:\'Courier New\',monospace">'+esc(v.mount)+'</span>'
        +' <span style="color:var(--muted);font-size:var(--fs-xs)">('+esc(v.fstype)+')</span></span>'
        +'<span>'+v.used_gb+' / '+v.total_gb+' Go ('+v.pct+'%)</span>'
        +'</div>'
        +'<div class="pb-track"><div class="pb '+sc+'" style="width:'+v.pct+'%"></div></div>'
        +'</div>';
    }).join('');
}
// ── Section ▶ RÉSEAU SYSTEME : même grid que Proxmox, source sys.net dict
function _sysNetworkHtml(netDict){
  var SKIP=['lo'];
  var ifaces=Object.keys(netDict||{}).filter(function(k){return SKIP.indexOf(k)===-1;});
  if(!ifaces.length) return '';
  return _prxSec('RÉSEAU','var(--cyan)')
    +ifaces.map(function(name){
      var i=netDict[name];
      return '<div class="prx-net-row">'
        +'<span class="prx-net-name">'+esc(name)+'</span>'
        +'<span class="prx-net-rx">↓ '+_prxFmtBytes(i.rx||0)+'</span>'
        +'<span class="prx-net-tx">↑ '+_prxFmtBytes(i.tx||0)+'</span>'
        +'<span class="prx-net-spd">'+(i.speed_mb?_prxFmtSpeed(i.speed_mb):'—')+'</span>'
        +'</div>';
    }).join('');
}
// ── Section ▶ RÉSEAU : interfaces filtrées (fwpr*/tap*/veth* exclus)
function _prxNetworkHtml(network){
  var SKIP_PFX=['fwpr','fwbr','fwln','tap','veth','docker','lxc','virbr','wg'];
  var filtered=(network||[]).filter(function(iface){
    var n=iface.name||''; return !SKIP_PFX.some(function(p){return n.indexOf(p)===0;});
  });
  if(!filtered.length) return '';
  return _prxSec('RÉSEAU','var(--cyan)')
    +filtered.map(function(iface){
      return '<div class="prx-net-row">'
        +'<span class="prx-net-name">'+esc(iface.name)+'</span>'
        +'<span class="prx-net-rx">↓ '+_prxFmtBytes(iface.rx_bytes||0)+'</span>'
        +'<span class="prx-net-tx">↑ '+_prxFmtBytes(iface.tx_bytes||0)+'</span>'
        +'<span class="prx-net-spd">'+_prxFmtSpeed(iface.speed_mb||0)+'</span>'
        +'</div>';
    }).join('');
}
// ── Assemblage des 5 sections ressources
function _prxProgressBarsHtml(node){
  var svcsHtml=node.services&&node.services.length
    ?_prxSec('SERVICES','var(--green)')+'<div class="svc-badges">'
      +node.services.map(function(svc){return '<span class="badge '+(svc.state==='running'?'up':'dn')+'">'+esc(svc.name)+'</span>';}).join('')
      +'</div>'
    :'';
  return _prxMemHtml(node)+_prxNvmeDisksHtml(node.nvme_disks,node.storages,node.zfs_pools||[])+_prxNetworkHtml(node.network)+svcsHtml;
}
function _prxNodeResourceBarsHtml(node){
  return _prxProgressBarsHtml(node);
}
function _renderProxmoxNode(prx,d,g){
  var f2b=d.fail2ban||{};
  var prxFw=(d.firewall_matrix&&d.firewall_matrix.hosts||[]).find(function(h){return h.name==='proxmox';})||{};
  var prxF2b=f2b.proxmox||{};
  var prxF2bBan=prxF2b.available?(prxF2b.total_banned||0):null;
  var pveCpuHist=d.pve_cpu_history||[];
  var bodyHtml;
  if(prx.error){
    bodyHtml='<div style="color:var(--red);font-size:var(--fs-sm)">&#9888; '+esc(prx.error)+'</div>';
  } else if(!prx.configured){
    bodyHtml='<div class="prx-nc">Token API non configuré<code>PROXMOX_TOKEN dans monitoring_gen.py</code></div>';
  } else if(prx.nodes){
    bodyHtml=prx.nodes.map(function(node){
      return _prxNodeHeaderHtml(node, pveCpuHist)+_prxNodeResourceBarsHtml(node);
    }).join('');
  } else {
    bodyHtml='';
  }
  var h='<div class="card half" id="prx-node-card" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◈</span>SYSTEME — PROXMOX VE</div>'
   +bodyHtml
   +_pveNodeCountermeasures(prxFw,prxF2bBan)
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var ck=document.getElementById('pve-cpu-spark');
  if(ck&&window._pveCpuSparkData){
    var sd=window._pveCpuSparkData;
    drawNetSparkline(ck,sd.vals,sd.rgb,sd.maxC);
  }
  var _prxCard=document.getElementById('prx-node-card');if(_prxCard&&!_prxCard._boundPrx){_prxCard._boundPrx=true;_prxCard.addEventListener('click',function(){if(window._lastData)openProxmoxModal(window._lastData);});}
}
// NDT-40a — barre résumé VMs (Running / Stopped / Total) → retourne HTML string
function _renderProxmox(d,g){
  var prx=d.proxmox||{};
  if(prx.configured!==false){
    _renderProxmoxNode(prx,d,g);
  }
}

