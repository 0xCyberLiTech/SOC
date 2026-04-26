'use strict';
// 10-modals-win.js — NDT-55/56/57 (2026-04-13)
// ── openIpModal helpers (module-level : NDT-55) ──────────────────────────
function _ipSec(icon,title,col){
  return `<div class="ih-sec"><span style="color:${col||'var(--cyan)'}">` + icon + `</span><span style="color:${col||'var(--muted)'}">` + title + `</span></div>`;
}
function _ipRow(lbl,val){
  return `<div class="ih-row"><span class="ih-lbl">${lbl}</span><span class="ih-val">${val}</span></div>`;
}
// ══════════════════════════════════════════════════════
var _ipHudOpen=false;
function closeIpHud(){
  var hud=document.getElementById('ip-hud');
  if(hud){hud.classList.remove('visible');}
  _ipHudOpen=false;
}
function openIpModal(dot,evt){
  var ip=dot.ip;
  var d=window._lastData||{};
  var csDetail=(d.crowdsec||{}).decisions_detail||{};
  var csTopIps=(d.crowdsec||{}).top_ips||[];
  var kcIps=(d.kill_chain||{}).active_ips||[];
  var surTopIps=(d.suricata||{}).top_ips||[];
  var surRcrit=(d.suricata||{}).recent_critical||[];
  var f2bJails=(d.fail2ban||{}).jails||[];
  var csInfo=csDetail[ip]||{};
  var csMeta=csTopIps.find(function(e){return e.ip===ip;})||{};
  var kcMeta=kcIps.find(function(e){return e.ip===ip;})||{};
  var surMeta=surTopIps.find(function(e){return e.ip===ip;})||null;
  var f2bBanned=false,f2bJailName='';
  f2bJails.forEach(function(j){
    (j.banned_ips||[]).forEach(function(b){
      var bip=typeof b==='object'?b.ip:b;
      if(bip===ip){f2bBanned=true;f2bJailName=j.jail;}
    });
  });
  var SCOL={EXPLOIT:'#ffd700',BRUTE:'#ff3b5c',SCAN:'#ff6b35',RECON:'#bf5fff'};
  var stageCol=SCOL[dot.stage]||'rgba(0,217,255,0.35)';
  var stage=dot.stage||'—';

  // ── CrowdSec block ──
  var csHtml=dot.cs_banned||csInfo.scenario
    ? _ipRow('Statut','<span style="color:var(--green)">✓ BANNI</span>')
      + _ipRow('Scénario',`<span style="color:#00d9ff;font-size:var(--fs-xs)">${esc(fmtScenario(csInfo.scenario||dot.cs_scenario||csMeta.scenario||'—'))}</span>`)
    : _ipRow('Statut','<span style="color:var(--amber);font-size:var(--fs-xs)">⚠ non banni</span>');

  // ── Fail2ban block ──
  var f2bHtml=f2bBanned
    ? _ipRow('Statut','<span style="color:var(--green)">✓ BANNI</span>')
      + _ipRow('Jail',`<span style="color:var(--purple)">${esc(f2bJailName)}</span>`)
    : _ipRow('Statut','<span style="color:var(--muted);font-size:var(--fs-xs)">— pas de ban</span>');

  // ── Suricata block ──
  var surHtml='';
  if(surMeta){
    var rcritIp=surRcrit.filter(function(a){return a.src_ip===ip;});
    var rcritRows=rcritIp.slice(0,2).map(function(a){
      return `<div style="font-size:var(--fs-xs);font-family:'Courier New',monospace;padding:.15rem 0;border-bottom:1px solid rgba(255,107,53,0.1);color:#f97316;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
<span style="color:var(--muted);margin-right:.35rem">${esc((a.ts||'').slice(11,16))}</span>${esc((a.signature||'?').slice(0,38))}${(a.signature||'').length>38?'…':''}</div>`;
    }).join('');
    surHtml = _ipRow('Alertes 24h',`<span style="color:#f97316">${surMeta.count}</span>`)
      + (rcritRows?`<div style="margin-top:.25rem">${rcritRows}</div>`:'');
  } else {
    surHtml = _ipRow('Statut','<span style="color:var(--muted);font-size:var(--fs-xs)">— aucune alerte</span>');
  }

  var h = _ipRow('Stage',`<span style="background:${stageCol}18;border:1px solid ${stageCol};color:${stageCol};padding:0 7px;border-radius:2px;font-size:var(--fs-xs);letter-spacing:.8px">${esc(stage)}</span>`)
    + _ipRow('Requêtes 15 min',`<span style="color:var(--yellow)">${dot.count||kcMeta.count||0} hits</span>`)
    + _ipSec('⊛','CROWDSEC','#22c55e') + csHtml
    + _ipSec('⊘','FAIL2BAN','var(--purple)') + f2bHtml
    + _ipSec('◈','SURICATA IDS','var(--orange)') + surHtml;

  // ── Injecter dans le HUD ──
  var hud=document.getElementById('ip-hud');
  document.getElementById('ih-ip-val').style.color=stageCol;
  document.getElementById('ih-ip-val').textContent=ip;
  document.getElementById('ih-cc-val').textContent='['+esc(dot.country||'—')+']';
  document.getElementById('ih-body').innerHTML=h;
  hud.style.setProperty('--ip-hud-col',stageCol);
  var mx=evt?evt.clientX:window.innerWidth/2;
  var my=evt?evt.clientY:window.innerHeight/2;
  var W=260,H=hud.offsetHeight||300;
  var x=mx+14,y=my-20;
  if(x+W>window.innerWidth-12) x=mx-W-14;
  if(y+H>window.innerHeight-12) y=window.innerHeight-H-12;
  if(y<8) y=8;
  hud.style.left=x+'px'; hud.style.top=y+'px';
  hud.classList.add('visible');
  _ipHudOpen=true;
}

// ══════════════════════════════════════════════════════
// WINDOWS MODALS
// ══════════════════════════════════════════════════════
// _winModalOpen/_gpuModalOpen → bus _SOC (01-utils) via shims (NDT-147)
// _winHistMax → 01-utils.js (NDT-148)
// _winCpuHistory/_winGpuHistory/_winVramHistory → bus _SOC (01-utils) via shims (P3)

function pbCol(pct){return pct>80?'r':pct>60?'y':'g';}
function tempCol(t){return t===null||t===undefined?'var(--muted)':t>85?'var(--red)':t>70?'var(--amber)':'var(--green)';}

function winGaugeSVG(pct,stroke,label,sub){
  var r=34,circ=2*Math.PI*r,arcLen=circ*0.75;
  var filled=(pct/100)*arcLen;
  var gc=stroke.indexOf('green')>-1?'win-gauge-g':stroke.indexOf('red')>-1?'win-gauge-r':stroke.indexOf('yellow')>-1||stroke.indexOf('gold')>-1?'win-gauge-y':'win-gauge-p';
  return `<span class="${gc}" style="display:inline-block">
<svg viewBox="0 0 80 80" width="90" height="90">
<circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="7" stroke-dasharray="${arcLen} ${circ-arcLen}" transform="rotate(135,40,40)" stroke-linecap="round"/>
<circle class="win-gauge-arc" data-full="${filled.toFixed(2)} ${(circ-filled).toFixed(2)}" cx="40" cy="40" r="34" fill="none" stroke="${stroke}" stroke-width="7" stroke-dasharray="0 999" transform="rotate(135,40,40)" stroke-linecap="round" style="transition:stroke-dasharray .85s cubic-bezier(.15,.85,.3,1)"/>
<text class="win-gauge-val" data-val="${pct}" x="40" y="37" text-anchor="middle" fill="white" font-size="13" font-family="Courier New,monospace" font-weight="bold">0%</text>
${label?`<text x="40" y="49" text-anchor="middle" fill="rgba(122,154,184,0.8)" font-size="7" font-family="Courier New,monospace">${label}</text>`:''}
${sub?`<text x="40" y="59" text-anchor="middle" fill="rgba(122,154,184,0.5)" font-size="6" font-family="Courier New,monospace">${sub}</text>`:''}
</svg></span>`;
}

// ── buildWindowsModal helpers (module-level : NDT-57) ────────────────────
function _winDriveRowHtml(dv){
  var dPct=dv.pct||0;
  var dc=dPct>85?'r':dPct>60?'y':'g';
  var mountBadge=dv.mounted
    ?'<span style="background:rgba(0,255,136,0.12);color:var(--green);font-size:var(--fs-xs);padding:.05rem .25rem;border-radius:2px;letter-spacing:.5px">OK</span>'
    :'<span style="background:rgba(255,50,50,0.15);color:var(--red);font-size:var(--fs-xs);padding:.05rem .25rem;border-radius:2px">HORS LIGNE</span>';
  return `<div class="win-drive-row">
<div class="win-drive-letter">${esc(dv.letter)}:</div>
<div class="win-drive-label" title="${esc(dv.label)}">${esc((dv.label||'').substring(0,14))}  ${mountBadge}</div>
<div class="win-pb-track"><div class="win-pb-fill ${dc}" data-w="${dPct}" style="width:0%"></div></div>
<div class="win-pct">${dPct}%</div>
<div class="win-drive-sz">${dv.used_gb} / ${dv.total_gb} Go</div>
</div>`;
}

// ── MODAL RESSOURCES ──────────────────────────────────
function buildWindowsModal(wd){
  var cpu=wd.cpu||{},ram=wd.ram||{},gpu=wd.gpu||null,drives=wd.drives||[];
  var wdNet=wd.net||{},wdDIO=wd.disk_io||{};
  var cpuPct=cpu.usage||0;
  var cpuStroke=cpuPct>80?'var(--red)':cpuPct>60?'var(--yellow)':'var(--green)';
  var cpuTempColor=tempCol(cpu.temp);

  var cpuFreqHtml=cpu.freq_mhz?`<div style="font-size:var(--fs-xs);margin-top:.1rem;color:var(--muted)">Fréquence : <span style="color:var(--cyan)">${cpu.freq_mhz} MHz</span></div>`:'';
  var uptimeHtml=wd.uptime_win?`<div style="font-size:var(--fs-xs);margin-top:.1rem;color:var(--muted)">Uptime : <span style="color:rgba(0,217,255,.7)">${esc(wd.uptime_win)}</span></div>`:'';

  var gpuHtml='';
  if(gpu&&gpu.name){
    var gpuPct=gpu.usage||0;
    var gpuStroke=gpuPct>80?'var(--red)':gpuPct>60?'var(--yellow)':'#bf5fff';
    var gpuTempColor=tempCol(gpu.temp);
    var vramPct=gpu.vram_pct||0;
    gpuHtml=`<div class="win-section">
<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> GPU</div>
<div style="display:flex;align-items:center;gap:1rem;margin-bottom:.4rem">
${winGaugeSVG(gpuPct,gpuStroke,'GPU',gpu.temp+'°C')}
<div style="flex:1">
<div style="font-size:var(--fs-xs);color:var(--text);font-family:Courier New,monospace;margin-bottom:.2rem" title="${esc(gpu.name||'')}">${esc((gpu.name||'').substring(0,36))}</div>
<div style="font-size:var(--fs-xs);color:var(--muted)">Température : <span style="color:${gpuTempColor}">${gpu.temp}°C</span></div>
<div style="font-size:var(--fs-xs);margin-top:.3rem;color:var(--muted)">VRAM ${Math.round(gpu.vram_used_mb/1024*10)/10} / ${Math.round(gpu.vram_total_mb/1024*10)/10} Go</div>
<div class="win-pb-track" style="margin-top:.2rem"><div class="win-pb-fill ${pbCol(vramPct)}" data-w="${vramPct}" style="width:0%"></div></div>
</div></div>
<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:.2rem">Charge GPU — ${_winHistMax} dernières lectures</div>
<canvas id="win-gpu-chart" height="44" style="width:100%;display:block;border-radius:2px;background:rgba(0,0,0,0.2)"></canvas>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.35);margin-top:.15rem"><span>-${Math.round(_winHistMax/2)}min</span><span>maintenant</span></div>
</div>`;
  }

  var netIoHtml='';
  if(wdNet.up_mbs!==undefined||wdDIO.read_mbs!==undefined){
    var netRows=wdNet.up_mbs!==undefined
      ?`<div style="color:var(--muted)">NET ↑ Envoi</div><div style="color:var(--green);font-family:Courier New,monospace">${wdNet.up_mbs||0} MB/s</div>
<div style="color:var(--muted)">NET ↓ Réception</div><div style="color:var(--cyan);font-family:Courier New,monospace">${wdNet.dn_mbs||0} MB/s</div>`
      :'';
    var ioRows=wdDIO.read_mbs!==undefined
      ?`<div style="color:var(--muted)">I/O Lecture</div><div style="color:var(--cyan);font-family:Courier New,monospace">${wdDIO.read_mbs||0} MB/s</div>
<div style="color:var(--muted)">I/O Écriture</div><div style="color:var(--amber);font-family:Courier New,monospace">${wdDIO.write_mbs||0} MB/s</div>`
      :'';
    netIoHtml=`<div class="win-section">
<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> RÉSEAU &amp; I/O DISQUE</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem .6rem;font-size:var(--fs-xs);margin-top:.2rem">${netRows}${ioRows}</div>
</div>`;
  }

  var driveRows=drives.length
    ? drives.map(function(dv){return _winDriveRowHtml(dv);}).join('')
    : '<div style="font-size:var(--fs-xs);color:var(--muted)">Données non disponibles</div>';

  var ramPct=ram.pct||0;
  var ramStroke=ramPct>80?'var(--red)':ramPct>60?'var(--yellow)':'var(--green)';

  return `<div class="win-refresh-bar">
<div style="display:flex;align-items:center;gap:.8rem">
<span class="ct-icon" style="color:var(--cyan);font-size:var(--fs-lg)">◫</span>
<span style="font-size:var(--fs-sm);font-weight:700;color:var(--cyan);letter-spacing:2px">RESSOURCES — 0xCyberLiTech</span>
</div>
<span class="win-modal-ts">Mis à jour : ${esc(wd.updated||'--')}</span>
</div>
<div class="win-modal-grid">
<div>
<div class="win-section">
<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> PROCESSEUR</div>
<div style="display:flex;align-items:center;gap:1rem;margin-bottom:.4rem">
${winGaugeSVG(cpuPct,cpuStroke,'CPU',cpu.cores?cpu.cores+'c':'')}
<div style="flex:1">
<div style="font-size:var(--fs-xs);color:var(--text);font-family:Courier New,monospace;margin-bottom:.2rem" title="${esc(cpu.name||'')}">${esc((cpu.name||'--').substring(0,36))}</div>
<div style="font-size:var(--fs-xs);color:var(--muted)">Threads : <span style="color:var(--text)">${cpu.cores||'?'}</span></div>
${cpuFreqHtml}
<div style="font-size:var(--fs-xs);margin-top:.1rem">Température : <span style="color:${cpuTempColor}">${cpu.temp!=null?cpu.temp+'°C':'N/A'}</span></div>
${uptimeHtml}
</div></div>
<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:.2rem">Charge CPU — ${_winHistMax} dernières lectures</div>
<canvas id="win-cpu-chart" height="44" style="width:100%;display:block;border-radius:2px;background:rgba(0,0,0,0.2)"></canvas>
</div>
${gpuHtml}
</div>
<div>
<div class="win-section">
<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> MÉMOIRE RAM</div>
<div style="display:flex;align-items:center;gap:1rem;margin-bottom:.5rem">
${winGaugeSVG(ramPct,ramStroke,'RAM',(ram.total_gb||0)+' Go')}
<div style="flex:1">
<div style="font-size:var(--fs-xs);color:var(--muted)">Total : <span style="color:var(--text)">${ram.total_gb||0} Go</span></div>
<div style="font-size:var(--fs-xs);color:var(--muted)">Utilisée : <span style="color:var(--text)">${ram.used_gb||0} Go</span></div>
<div style="font-size:var(--fs-xs);color:var(--muted)">Libre : <span style="color:var(--green)">${ram.free_gb||0} Go</span></div>
</div></div>
</div>
${netIoHtml}
<div class="win-section">
<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> STOCKAGE — ${drives.length} DISQUE(S)</div>
${drives.length?`<div style="display:grid;grid-template-columns:28px 110px 1fr 42px 100px;gap:.4rem;font-size:var(--fs-xs);color:var(--muted);padding-bottom:.2rem;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:.25rem"><div></div><div>Label</div><div></div><div style="text-align:right">%</div><div style="text-align:right">Utilisé / Total</div></div>`:''}
${driveRows}
</div>
</div>
</div>
<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.35);text-align:center;margin-top:.4rem">Actualisation 60s · windows-disk-report.ps1</div>`;
}

// ── buildBackupModal helpers (module-level : NDT-56) ─────────────────────
function _bkAgeLbl(a){return a===999?'—':a===0?'aujourd\'hui':a+'j';}
function _bkpMatrixCell(zoneData,zoneLabel,vmn,nextRun){
  var v=zoneData[vmn]||{};
  var age=_winBkpAge(v.last_date);
  var col,cellCls,ageTxt,dateTxt;
  if(!v.last_date&&nextRun){
    col='var(--amber)';cellCls='bkp-mc-pending';ageTxt='⏳';dateTxt=esc(nextRun.substring(0,10));
  } else {
    col=_winBkpCol(age);
    cellCls=!v.last_date?'bkp-mc-none':age>14?'bkp-mc-crit':age>6?'bkp-mc-warn':'bkp-mc-ok';
    ageTxt=!v.last_date?'N/A':age===0?'auj.':age+'j';
    dateTxt=v.last_date?esc(v.last_date.substring(0,10)):'—';
  }
  return `<div class="bkp-matrix-cell ${cellCls}">
<div class="bkp-cell-zone" style="color:${col}">${zoneLabel}</div>
<div class="bkp-cell-vm" style="color:var(--cyan)">${vmn}</div>
<div class="bkp-cell-age" style="color:${col}">${ageTxt}</div>
<div class="bkp-cell-date">${dateTxt}</div>
</div>`;
}
function _bkpZoneTableHtml(zoneData,zoneLabel,vmList){
  var rows=vmList.map(function(vmn){
    var v=zoneData[vmn]||{};
    var hasB=!!v.last_date,age=_winBkpAge(v.last_date),col=_winBkpCol(age);
    var ageLbl=!hasB?'<span style="color:var(--muted)">—</span>':age===0?'<span style="color:var(--green);font-weight:700">auj.</span>':'<span style="color:'+col+';font-weight:700">'+age+'j</span>';
    return '<div class="bkp-vm-row">'
      +'<span style="color:'+(hasB?'var(--cyan)':'var(--muted)')+'">'+esc(vmn)+'</span>'
      +'<span style="color:var(--text);font-family:\'Courier New\',monospace;font-size:var(--fs-md)">'+(hasB?esc(v.last_date):'<span style="color:var(--muted)">aucune</span>')+'</span>'
      +'<span style="text-align:right;color:var(--muted)">'+(hasB&&v.last_size_gb?v.last_size_gb+' Go':'—')+'</span>'
      +'<span style="text-align:right;color:rgba(122,154,184,.55)">'+(v.size_gb>0?v.size_gb.toFixed(1)+' Go':'—')+'</span>'
      +'<span style="text-align:right;color:var(--muted)">'+(v.count||0)+'</span>'
      +'<span style="text-align:right">'+ageLbl+'</span>'
      +'</div>';
  }).join('');
  return '<div class="bkp-zone-box">'
    +'<div class="bkp-zone-title">'+esc(zoneLabel)+'</div>'
    +'<div style="display:grid;grid-template-columns:72px 145px 52px 52px 32px 36px;gap:.2rem .35rem;font-size:var(--fs-xs);color:var(--muted);padding-bottom:.2rem;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:.15rem">'
    +'<div>VM</div><div>Dernière</div><div style="text-align:right">Dernier</div><div style="text-align:right">Total</div><div style="text-align:right">Nb</div><div style="text-align:right">Âge</div></div>'
    +rows+'</div>';
}

// ── MODAL SAUVEGARDES ─────────────────────────────────
function buildBackupModal(wd,d){
  var bk=wd.backup||{},zones=bk.zones||{},manual=zones.manual||{},auto=zones.auto||{},vms=bk.vms||{};
  var crons=wd.cron||[];
  var bkPct=bk.pct||0, bkStroke=bkPct>85?'var(--red)':bkPct>60?'var(--yellow)':'var(--green)';
  var _allVms=(function(){var s={};[manual,auto,vms].forEach(function(z){Object.keys(z).forEach(function(k){s[k]=1;});});return Object.keys(s).sort();}());

  // Tâches planifiées — toutes les tâches ProxmoxBackup-* présentes
  var bkpTasks=crons.filter(function(c){return c.name&&c.name.indexOf('ProxmoxBackup')===0;});
  var cronHtml;
  if(bkpTasks.length){
    var taskRows=bkpTasks.map(function(ct){
      var stCol=ct.state==='Running'?'var(--cyan)':ct.state==='Ready'?'var(--green)':'var(--red)';
      var lastTxt=ct.last_run&&ct.last_run!=='jamais'?esc(ct.last_run.substring(0,16)):'jamais';
      var okIcon=lastTxt==='jamais'?'':ct.last_ok===false?'<span style="color:var(--red)"> ✗</span>':'<span style="color:var(--green)"> ✓</span>';
      var nextTxt=ct.next_run?esc(ct.next_run.substring(0,16)):'—';
      return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:.3rem .6rem;align-items:center;font-size:var(--fs-xs);padding:.28rem .35rem;border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<div style="font-family:\'Courier New\',monospace;color:rgba(185,215,240,.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(ct.name)+'</div>'
        +'<div style="color:'+stCol+';font-weight:700;white-space:nowrap">● '+esc(ct.state)+'</div>'
        +'<div style="color:var(--text);font-family:\'Courier New\',monospace;white-space:nowrap">'+lastTxt+okIcon+'</div>'
        +'<div style="color:var(--cyan);font-family:\'Courier New\',monospace;white-space:nowrap">→ '+nextTxt+'</div>'
        +'</div>';
    }).join('');
    cronHtml='<div class="win-section" style="margin-bottom:.65rem">'
      +'<div class="win-section-hdr"><span style="color:var(--green)">▸</span> TÂCHES PLANIFIÉES — SAUVEGARDE PROXMOX</div>'
      +'<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:.3rem .6rem;font-size:var(--fs-xs);color:var(--muted);padding:.15rem .35rem;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:.1rem">'
      +'<div>Tâche</div><div>État</div><div>Dernier run</div><div>Prochain</div></div>'
      +taskRows+'</div>';
  } else {
    cronHtml='<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;font-size:var(--fs-xs);border:1px solid rgba(255,50,50,.2);background:rgba(255,0,0,.04);border-radius:3px;margin-bottom:.65rem">'
      +'<span style="color:var(--red)">⚠</span>'
      +'<span style="color:var(--muted)">Aucune tâche ProxmoxBackup-* détectée</span>'
      +'<span style="color:var(--c-muted-4);margin-left:auto">Lancer CREER-TACHE-BACKUP-AUTO.bat en admin</span>'
      +'</div>';
  }

  // Deux zones côte à côte
  var zonesHtml='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.65rem">'
    +_bkpZoneTableHtml(manual,'À LA DEMANDE — manual\\',_allVms)
    +_bkpZoneTableHtml(auto,'AUTO — auto\\',_allVms)
    +'</div>';

  // Vue globale (toutes zones — backup le plus récent par VM)
  var globalRows=_allVms.map(function(vmn){
    var v=vms[vmn]||{};
    var hasB=!!v.last_date,age=_winBkpAge(v.last_date),col=_winBkpCol(age);
    return '<div class="bkp-vm-row">'
      +'<span style="color:'+(hasB?'var(--cyan)':'var(--muted)')+'">'+esc(vmn)+'</span>'
      +'<span style="color:var(--text);font-family:\'Courier New\',monospace;font-size:var(--fs-md)">'+(hasB?esc(v.last_date):'<span style="color:var(--muted)">aucune</span>')+'</span>'
      +'<span style="text-align:right;color:var(--muted)">'+(hasB&&v.last_size_gb?v.last_size_gb+' Go':'—')+'</span>'
      +'<span style="text-align:right;color:var(--muted)">'+(v.count||0)+'</span>'
      +'<span style="text-align:right;color:'+col+';font-weight:700">'+_bkAgeLbl(age)+'</span>'
      +'</div>';
  }).join('');
  var globalHtml='<div class="bkp-zone-box" style="margin-bottom:.65rem">'
    +'<div class="bkp-zone-title">VUE GLOBALE — BACKUP LE PLUS RÉCENT PAR VM (toutes zones)</div>'
    +'<div style="display:grid;grid-template-columns:72px 145px 55px 40px 45px;gap:.2rem .35rem;font-size:var(--fs-xs);color:var(--muted);padding-bottom:.2rem;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:.15rem">'
    +'<div>VM</div><div>Dernier backup</div><div style="text-align:right">Taille</div><div style="text-align:right">Total</div><div style="text-align:right">Âge</div></div>'
    +globalRows+'</div>';

  // Quota
  var libre=Math.round(((bk.quota_gb||300)-(bk.used_gb||0))*10)/10;
  var usedDisp=(bk.used_gb||0).toFixed?Number(bk.used_gb||0).toFixed(1):bk.used_gb||0;
  var quotaHtml='<div class="win-section">'
    +'<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> QUOTA D:\\BACKUP-PROXMOX</div>'
    +'<div style="display:flex;align-items:center;gap:1rem">'
    +winGaugeSVG(bkPct,bkStroke,'Quota',(bk.quota_gb||300)+' Go')
    +'<div style="flex:1;display:flex;flex-direction:column;gap:.18rem">'
    +'<div style="font-size:var(--fs-xs);color:var(--muted)">Utilisé : <span style="color:'+bkStroke+'">'+usedDisp+' Go</span></div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted)">Quota : <span style="color:var(--text)">'+(bk.quota_gb||300)+' Go</span></div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted)">Libre : <span style="color:var(--green)">'+libre+' Go</span></div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted)">Alerte : <span style="color:var(--yellow)">seuil 80%</span></div>'
    +'<div class="pb-track" style="margin-top:.2rem"><div style="height:100%;width:'+Math.min(bkPct,100)+'%;background:'+bkStroke+';border-radius:1px"></div></div>'
    +'</div></div></div>';

  return '<div class="win-refresh-bar">'
    +'<div style="display:flex;align-items:center;gap:.8rem">'
    +'<span class="ct-icon" style="color:var(--green);font-size:var(--fs-lg)">◎</span>'
    +'<span style="font-size:var(--fs-sm);font-weight:700;color:var(--text);letter-spacing:2px">SAUVEGARDES — PROXMOX</span>'
    +'</div>'
    +'<span class="win-modal-ts">Mis à jour : '+esc(wd.updated||'--')+'</span>'
    +'</div>'
    +'<div>'+cronHtml+zonesHtml+globalHtml+quotaHtml+'</div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.3);text-align:center;margin-top:.5rem">Actualisation 60s · windows-disk-report.ps1</div>';
}

function drawWinCharts(){
  _raf2(function(){
    var cpuC=_modalBody.querySelector('#win-cpu-chart');
    var gpuC=_modalBody.querySelector('#win-gpu-chart');
    if(cpuC&&_winCpuHistory.length>1){
      drawNetSparkline(cpuC,_winCpuHistory,'0,217,255',100);
      var ctx=cpuC.getContext('2d');
      ctx.fillStyle='rgba(0,217,255,0.9)';ctx.font='bold 10px Courier New';ctx.textAlign='right';
      ctx.fillText(_winCpuHistory[_winCpuHistory.length-1]+'%',cpuC.width-4,12);
    } else if(cpuC){
      var ctx2=cpuC.getContext('2d');
      cpuC.width=cpuC.offsetWidth; cpuC.height=48;
      ctx2.fillStyle='rgba(122,154,184,0.3)';ctx2.font='10px Courier New';ctx2.textAlign='center';
      ctx2.fillText('Accumulation en cours... (30s/point)',cpuC.width/2,28);
    }
    if(gpuC&&_winGpuHistory.length>1){
      drawNetSparkline(gpuC,_winGpuHistory,'191,95,255',100);
      var ctx3=gpuC.getContext('2d');
      ctx3.fillStyle='rgba(191,95,255,0.9)';ctx3.font='bold 10px Courier New';ctx3.textAlign='right';
      ctx3.fillText(_winGpuHistory[_winGpuHistory.length-1]+'%',gpuC.width-4,12);
    } else if(gpuC){
      var ctx4=gpuC.getContext('2d');
      gpuC.width=gpuC.offsetWidth; gpuC.height=48;
      ctx4.fillStyle='rgba(122,154,184,0.3)';ctx4.font='10px Courier New';ctx4.textAlign='center';
      ctx4.fillText('Accumulation en cours... (30s/point)',gpuC.width/2,28);
    }
  });
}

// ══════════════════════════════════════════════════════
// GPU / INTELLIGENCE ARTIFICIELLE MODAL
// ══════════════════════════════════════════════════════
function buildGpuModal(wd){
  var gpu=wd.gpu||{};
  if(!gpu.name)return '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:var(--fs-xs)">GPU non d\xe9tect\xe9 ou donn\xe9es indisponibles.</div>';
  var gpuPct=gpu.usage||0;
  var gpuStroke=gpuPct>80?'var(--red)':gpuPct>60?'var(--yellow)':'var(--purple)';
  var vramPct=gpu.vram_pct||0;
  var vramStroke=vramPct>80?'var(--red)':vramPct>60?'var(--yellow)':'var(--cyan)';
  var tempRaw=gpu.temp||0;
  var tempPct=Math.min(Math.round(tempRaw/110*100),100);
  var tempStroke=tempCol(tempRaw);
  var pwrPct=gpu.power_pct||0;
  var pwrStroke=pwrPct>85?'var(--red)':pwrPct>60?'var(--amber)':'var(--green)';
  var vramUsedGo=Math.round(gpu.vram_used_mb/1024*10)/10;
  var vramTotalGo=Math.round(gpu.vram_total_mb/1024*10)/10;
  var vramFreeGo=Math.round((gpu.vram_total_mb-gpu.vram_used_mb)/1024*10)/10;
  var ps=gpu.perf_state&&gpu.perf_state!=='N/A'?gpu.perf_state:null;
  var psCol=ps==='P0'?'rgba(0,200,100,0.85)':ps&&/^P[1-3]$/.test(ps)?'rgba(0,217,255,0.75)':'rgba(122,154,184,0.6)';
  var psBorder=ps==='P0'?'rgba(0,200,100,0.3)':ps&&/^P[1-3]$/.test(ps)?'rgba(0,217,255,0.25)':'rgba(122,154,184,0.2)';
  var psBg=ps==='P0'?'rgba(0,200,100,0.06)':ps&&/^P[1-3]$/.test(ps)?'rgba(0,217,255,0.05)':'rgba(122,154,184,0.05)';
  var pci=gpu.pcie_gen&&gpu.pcie_width?'Gen\xa0'+gpu.pcie_gen+'\xa0\xd7\xa0'+gpu.pcie_width+'\xa0lanes':'';

  // 4 main gauges
  var pwrGaugeHtml=gpu.power_pct!=null
    ?`<div class="gpu-gauge-item">${winGaugeSVG(pwrPct,pwrStroke,'POWER',(gpu.power_w||0)+' W')}<div class="gpu-gauge-lbl" style="color:rgba(245,158,11,0.6)">Puissance</div></div>`
    :'';

  // ENC / DEC / MEM CTRL mini-bars
  var encDecHtml='';
  if(gpu.enc_pct!=null||gpu.dec_pct!=null||gpu.mem_ctrl_pct!=null){
    var encItems='';
    if(gpu.enc_pct!=null){
      var eC=gpu.enc_pct>80?'pb-r':gpu.enc_pct>40?'pb-y':'pb-g';
      encItems+=`<div class="gpu-enc-item"><div class="gpu-enc-lbl">ENC&nbsp;<span style="color:rgba(191,95,255,0.9)">${gpu.enc_pct}%</span></div><div class="gpu-enc-track"><div class="gpu-enc-fill ${eC}" style="width:${gpu.enc_pct}%;background:linear-gradient(90deg,rgba(100,0,200,.7),var(--purple))"></div></div></div>`;
    }
    if(gpu.dec_pct!=null){
      var dC=gpu.dec_pct>80?'pb-r':gpu.dec_pct>40?'pb-y':'pb-g';
      encItems+=`<div class="gpu-enc-item"><div class="gpu-enc-lbl">DEC&nbsp;<span style="color:rgba(0,217,255,0.9)">${gpu.dec_pct}%</span></div><div class="gpu-enc-track"><div class="gpu-enc-fill ${dC}" style="width:${gpu.dec_pct}%;background:linear-gradient(90deg,rgba(0,80,180,.7),var(--cyan))"></div></div></div>`;
    }
    if(gpu.mem_ctrl_pct!=null){
      var mC=gpu.mem_ctrl_pct>80?'pb-r':gpu.mem_ctrl_pct>60?'pb-y':'pb-g';
      encItems+=`<div class="gpu-enc-item"><div class="gpu-enc-lbl">MEM CTRL&nbsp;<span style="color:rgba(122,200,220,0.9)">${gpu.mem_ctrl_pct}%</span></div><div class="gpu-enc-track"><div class="gpu-enc-fill ${mC}" style="width:${gpu.mem_ctrl_pct}%"></div></div></div>`;
    }
    encDecHtml=`<div class="gpu-enc-row">${encItems}</div>`;
  }

  // Specs cards — 10 cards, 4 colonnes (nouvelles : Boost, SM, Mem Boost, PCIe, Driver)
  var fanCol=gpu.fan_pct>70?'var(--red)':gpu.fan_pct>40?'var(--yellow)':'var(--green)';
  var statsCards=[
    {lbl:'GPU Clock',    val:gpu.clock_gpu_mhz!=null?gpu.clock_gpu_mhz+' MHz':'N/A',           c:'var(--purple)'},
    {lbl:'Boost Clock',  val:gpu.clock_boost_mhz!=null?gpu.clock_boost_mhz+' MHz':'N/A',        c:'rgba(191,95,255,0.7)'},
    {lbl:'SM Clock',     val:gpu.clock_sm_mhz!=null?gpu.clock_sm_mhz+' MHz':'N/A',              c:'rgba(160,80,255,0.85)'},
    {lbl:'MEM Clock',    val:gpu.clock_mem_mhz!=null?gpu.clock_mem_mhz+' MHz':'N/A',            c:'var(--cyan)'},
    {lbl:'MEM Boost',    val:gpu.clock_mem_boost_mhz!=null?gpu.clock_mem_boost_mhz+' MHz':'N/A',c:'rgba(0,180,255,0.7)'},
    {lbl:'MEM Ctrl',     val:gpu.mem_ctrl_pct!=null?gpu.mem_ctrl_pct+'%':'N/A',                  c:'rgba(122,200,220,0.8)'},
    {lbl:'PCIe Link',    val:pci||'N/A',                                                         c:'rgba(0,217,255,0.65)'},
    {lbl:'Power Draw',   val:gpu.power_w!=null?gpu.power_w+' W':'N/A',                          c:'var(--amber)'},
    {lbl:'TDP Limit',    val:gpu.power_limit_w!=null?gpu.power_limit_w+' W':'N/A',               c:'rgba(200,130,0,0.7)'},
    {lbl:'Ventilateur',  val:gpu.fan_pct!=null?gpu.fan_pct+'%':'N/A',                            c:fanCol},
    {lbl:'Driver',       val:gpu.driver_ver&&gpu.driver_ver!=='N/A'?gpu.driver_ver:'N/A',        c:'rgba(122,154,184,0.8)'},
  ].map(function(s){
    return `<div class="gpu-stat-card"><div class="gpu-stat-lbl">${s.lbl}</div><div class="gpu-stat-val" style="color:${s.c}">${esc(s.val)}</div></div>`;
  }).join('');

  // Power bar
  var pwrBarHtml=gpu.power_pct!=null
    ?`<div style="margin-top:.5rem">
<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:rgba(245,158,11,0.5);margin-bottom:.2rem">Puissance &mdash; ${gpu.power_w||0} W / ${gpu.power_limit_w||0} W (${pwrPct}%)</div>
<div class="gpu-power-bar-wrap"><div class="gpu-power-bar-fill" data-w="${Math.min(pwrPct,100)}" style="width:0%"></div></div>
</div>`
    :'';

  // Throttle + P-state section
  var thrHtml='';
  if(ps||gpu.thr_power!==undefined){
    var pStateBox=ps?`<div class="gpu-thr-item ${ps==='P0'?'gpu-thr-ok':ps==='P8'||ps==='P12'?'gpu-thr-idle':'gpu-thr-mid'}"><div class="gpu-thr-lbl">P-STATE</div><div class="gpu-thr-val">${esc(ps)}</div><div class="gpu-thr-sub">${ps==='P0'?'MAX PERF':ps==='P8'||ps==='P12'?'IDLE':ps==='P5'||ps==='P4'?'\xc9CONOMIE':'NORMAL'}</div></div>`:'';
    var thrPower=gpu.thr_power!==undefined?`<div class="gpu-thr-item ${gpu.thr_power?'gpu-thr-warn':'gpu-thr-ok'}"><div class="gpu-thr-lbl">POWER CAP</div><div class="gpu-thr-val">${gpu.thr_power?'⚡ ACTIF':'✓ OFF'}</div><div class="gpu-thr-sub">TDP atteint</div></div>`:'';
    var thrHw=gpu.thr_hw!==undefined?`<div class="gpu-thr-item ${gpu.thr_hw?'gpu-thr-warn':'gpu-thr-ok'}"><div class="gpu-thr-lbl">HW LIMIT</div><div class="gpu-thr-val">${gpu.thr_hw?'⚡ ACTIF':'✓ OFF'}</div><div class="gpu-thr-sub">Fr\xe9quence r\xe9duite</div></div>`:'';
    var thrTh=gpu.thr_thermal!==undefined?`<div class="gpu-thr-item ${gpu.thr_thermal?'gpu-thr-warn':'gpu-thr-ok'}"><div class="gpu-thr-lbl">SW THERMAL</div><div class="gpu-thr-val">${gpu.thr_thermal?'⚡ ACTIF':'✓ OFF'}</div><div class="gpu-thr-sub">Protection T\xb0</div></div>`:'';
    var thrHwT=gpu.thr_hw_therm!==undefined?`<div class="gpu-thr-item ${gpu.thr_hw_therm?'gpu-thr-warn':'gpu-thr-ok'}"><div class="gpu-thr-lbl">HW THERMAL</div><div class="gpu-thr-val">${gpu.thr_hw_therm?'⚡ ACTIF':'✓ OFF'}</div><div class="gpu-thr-sub">Temp critique</div></div>`:'';
    thrHtml=`<div class="gpu-throttle-section"><div class="win-section-hdr" style="color:rgba(191,95,255,0.7)"><span style="color:var(--purple)">&#9658;</span> P-STATE &amp; THROTTLE</div><div class="gpu-thr-grid">${pStateBox}${thrPower}${thrHw}${thrTh}${thrHwT}</div></div>`;
  }

  return `<div class="gpu-modal-hdr">
<div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap">
<span style="color:var(--purple);font-size:var(--fs-xl)">⬡</span>
<span style="font-size:var(--fs-sm);font-weight:700;color:var(--purple);letter-spacing:2px">GPU &mdash; INTELLIGENCE ARTIFICIELLE</span>
<span class="gpu-hdr-badge">NVIDIA CUDA</span>
${pci?`<span class="gpu-hdr-badge" style="color:rgba(0,217,255,0.7);border-color:rgba(0,217,255,0.3);background:rgba(0,217,255,0.07)">PCIe ${pci.replace('Gen\xa0','').replace('\xa0lanes','')}</span>`:''}
${ps?`<span class="gpu-hdr-badge" style="color:${psCol};border-color:${psBorder};background:${psBg}">${esc(ps)}&nbsp;${ps==='P0'?'MAX':ps==='P8'||ps==='P12'?'IDLE':'NORMAL'}</span>`:''}
</div>
<span class="win-modal-ts">Mis \xe0 jour\xa0: ${esc(wd.updated||'--')}</span>
</div>
<div class="gpu-name-bar">
<span>${esc(gpu.name||'—')}</span>
<span style="font-size:var(--fs-xs);color:rgba(191,95,255,0.5)">${gpu.driver_ver&&gpu.driver_ver!=='N/A'?'Driver '+esc(gpu.driver_ver)+' \xb7 ':''}NVIDIA GPU \xb7 CUDA COMPUTE</span>
</div>
<div class="gpu-gauges-row">
<div class="gpu-gauge-item">${winGaugeSVG(gpuPct,gpuStroke,'COMPUTE','GPU %')}<div class="gpu-gauge-lbl" style="color:rgba(191,95,255,0.6)">Charge GPU</div></div>
<div class="gpu-gauge-item">${winGaugeSVG(vramPct,vramStroke,'VRAM',vramUsedGo+'/'+vramTotalGo+' Go')}<div class="gpu-gauge-lbl" style="color:rgba(0,217,255,0.6)">M\xe9moire</div></div>
<div class="gpu-gauge-item">${winGaugeSVG(tempPct,tempStroke,'TEMP',tempRaw+'\xb0C')}<div class="gpu-gauge-lbl" style="color:rgba(122,154,184,0.6)">Temp\xe9rature</div></div>
${pwrGaugeHtml}
</div>
${encDecHtml}
<div class="gpu-charts-grid">
<div class="gpu-chart-box">
<div class="gpu-chart-lbl" style="color:rgba(191,95,255,0.5)">Charge GPU &mdash; ${_winHistMax} lectures</div>
<canvas id="gpu-compute-chart" height="52" style="width:100%;display:block;border-radius:2px;background:rgba(0,0,0,0.2)"></canvas>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.3);margin-top:.1rem"><span>-${Math.round(_winHistMax/2)}min</span><span>now</span></div>
</div>
<div class="gpu-chart-box">
<div class="gpu-chart-lbl" style="color:rgba(0,217,255,0.5)">VRAM &mdash; ${_winHistMax} lectures</div>
<canvas id="gpu-vram-chart" height="52" style="width:100%;display:block;border-radius:2px;background:rgba(0,0,0,0.2)"></canvas>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.3);margin-top:.1rem"><span>-${Math.round(_winHistMax/2)}min</span><span>now</span></div>
</div>
</div>
<div class="gpu-stats-section">
<div class="win-section-hdr" style="color:var(--purple)"><span style="color:var(--purple)">&#9658;</span> SP\xc9CIFICATIONS TECHNIQUES</div>
<div class="gpu-stats-grid">${statsCards}</div>
</div>
<div class="gpu-vram-section">
<div class="win-section-hdr" style="color:var(--cyan)"><span style="color:var(--cyan)">&#9658;</span> VRAM &mdash; R\xe9partition m\xe9moire</div>
<div class="gpu-vram-bar-wrap"><div class="gpu-vram-bar-fill" data-w="${vramPct}" style="width:0%"></div></div>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-top:.2rem">
<span style="color:var(--cyan)">${vramUsedGo} Go utilis\xe9s (${vramPct}%)</span>
<span style="color:rgba(122,154,184,0.5)">${vramFreeGo} Go libres</span>
<span style="color:var(--muted)">Total ${vramTotalGo} Go</span>
</div>
<div style="margin-top:.55rem">
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;margin-bottom:.2rem"><span style="color:rgba(122,154,184,0.5)">Température</span><span style="color:${tempStroke}">${tempRaw}°C</span></div>
<div class="gpu-power-bar-wrap"><div style="height:100%;width:${tempPct}%;background:linear-gradient(90deg,rgba(0,200,255,.65),rgba(0,200,100,.75) 35%,rgba(245,158,11,.8) 62%,rgba(255,100,40,.85) 82%,rgba(255,50,50,.9));border-radius:1px;transition:width .6s"></div></div>
</div>
${gpu.power_pct!=null?`<div style="margin-top:.45rem"><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;margin-bottom:.2rem"><span style="color:rgba(245,158,11,0.5)">Puissance</span><span style="color:rgba(245,158,11,0.85)">${gpu.power_w||0} W / ${gpu.power_limit_w||0} W (${pwrPct}%)</span></div><div class="gpu-power-bar-wrap"><div class="gpu-power-bar-fill" data-w="${Math.min(pwrPct,100)}" style="width:0%"></div></div></div>`:''}
</div>
${thrHtml}
<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.3);text-align:center;margin-top:.3rem">Actualisation 60s \xb7 nvidia-smi \xb7 windows-disk-report.ps1</div>`;
}

// NDT-165
function _sparkLabel(canvas,rgb,val){
  var ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba('+rgb+',0.9)';ctx.font='bold 10px Courier New';ctx.textAlign='right';
  ctx.fillText(val+'%',canvas.width-4,12);
}
function _sparkEmpty(canvas,msg){
  canvas.width=canvas.offsetWidth;canvas.height=56;
  var ctx=canvas.getContext('2d');ctx.fillStyle='rgba(122,154,184,0.3)';ctx.font='10px Courier New';ctx.textAlign='center';
  ctx.fillText(msg||'Accumulation en cours...',canvas.width/2,30);
}
function drawGpuCharts(){
  _raf2(function(){
    var cC=_modalBody.querySelector('#gpu-compute-chart');
    var vC=_modalBody.querySelector('#gpu-vram-chart');
    if(cC&&_winGpuHistory.length>1){drawNetSparkline(cC,_winGpuHistory,'191,95,255',100);_sparkLabel(cC,'191,95,255',_winGpuHistory[_winGpuHistory.length-1]);}
    else if(cC)_sparkEmpty(cC);
    if(vC&&_winVramHistory.length>1){drawNetSparkline(vC,_winVramHistory,'0,217,255',100);_sparkLabel(vC,'0,217,255',_winVramHistory[_winVramHistory.length-1]);}
    else if(vC)_sparkEmpty(vC);
    _modalBody.querySelectorAll('.gpu-vram-bar-fill[data-w],.gpu-power-bar-fill[data-w],.win-pb-fill[data-w]').forEach(function(b){b.style.width=b.dataset.w+'%';});
  });
}

function openGpuModal(wd){
  if(_isOpen)return;
  _isOpen=true;
  _gpuModalOpen=true;
  window._winModalType='gpu';
  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-gpu','theme-purple');
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">⬡</span>GPU — INTELLIGENCE ARTIFICIELLE';
  _modalBody.innerHTML=buildGpuModal(wd);
  _modalBody.style.fontSize='1em';
  _overlay.classList.add('open');
  document.body.style.overflow='hidden';
  animateGauges();
  drawGpuCharts();
}

function animateGauges(){
  _raf2(function(){
    _modalBody.querySelectorAll('.win-gauge-arc').forEach(function(arc){
      arc.style.strokeDasharray=arc.dataset.full;
    });
    _modalBody.querySelectorAll('.win-gauge-val').forEach(function(el){
      var target=parseInt(el.dataset.val)||0;
      if(target===0){el.textContent='0%';return;}
      var steps=22,step=0;
      var t=setInterval(function(){
        step++;
        el.textContent=(step>=steps?target:Math.round(target*step/steps))+'%';
        if(step>=steps)clearInterval(t);
      },38);
    });
    _modalBody.querySelectorAll('.win-pb-fill[data-w]').forEach(function(bar){
      bar.style.width=bar.dataset.w+'%';
    });
  });
}

function openWindowsModal(wd,type){
  if(_isOpen)return;
  _isOpen=true;
  _winModalOpen=true;
  window._winModalType=type||'res';
  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-win','theme-purple');
  var _ht=document.getElementById('modal-header-title');
  if(_ht){
    if(type==='bkp') _ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">◫</span>SAUVEGARDES — PROXMOX';
    else             _ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">◫</span>RESSOURCES — WINDOWS';
  }
  _modalBody.innerHTML=(type==='bkp')?buildBackupModal(wd,window._lastData||{}):buildWindowsModal(wd);
  _modalBody.style.fontSize='1em';
  if(type==='bkp'){
    _modalBody.addEventListener('click',function(e){
      var btn=e.target.closest('[data-bkp-tab]');
      if(!btn)return;
      var tab=btn.dataset.bkpTab;
      _modalBody.querySelectorAll('[data-bkp-tab]').forEach(function(b){
        var active=b===btn;
        b.style.color=active?(tab==='proxmox'?'var(--green)':'var(--cyan)'):'rgba(122,154,184,.45)';
        b.style.borderBottomColor=active?(tab==='proxmox'?'var(--green)':'var(--cyan)'):'transparent';
      });
      _modalBody.querySelectorAll('[data-bkp-pane]').forEach(function(p){
        p.style.display=p.dataset.bkpPane===tab?'':'none';
      });
    });
  }
  _overlay.classList.add('open');
  document.body.style.overflow='hidden';
  animateGauges();
  if(type!=='bkp')drawWinCharts();
}
document.getElementById('fw-btn').addEventListener('click',function(){if(window._lastData)openFirewallModal(window._lastData);});
document.getElementById('tr-btn').addEventListener('click',function(){if(window._lastData)openTrafficModal(window._lastData);});
document.getElementById('fs-btn').addEventListener('click',function(){toggleProj();});

/* ── Bouton rapport SOC manuel ── */
(function(){
  var rptBtn=document.getElementById('rpt-btn');
  var _rptRunning=false;
  function triggerReport(){
    if(_rptRunning)return;
    _rptRunning=true;
    rptBtn.disabled=true;
    rptBtn.classList.add('sending');
    rptBtn.textContent='\u2709 ENVOI\u2026';
    fetch('/api/trigger-report',{method:'POST',signal:AbortSignal.timeout(35000)})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,status:r.status,data:d};});})
      .then(function(res){
        rptBtn.classList.remove('sending');
        var d=res.data;
        if(d.status==='triggered'){
          rptBtn.textContent='\u2709 ENVOY\u00c9 \u2713';
          rptBtn.style.color='var(--green)';
          rptBtn.style.borderColor='rgba(0,255,136,0.4)';
        } else if(d.status==='cooldown'){
          rptBtn.textContent='\u23f1 COOLDOWN';
          rptBtn.style.color='var(--amber)';
          rptBtn.title=d.message||'Cooldown actif';
        } else if(d.status==='already_running'){
          rptBtn.textContent='\u23f3 EN COURS';
          rptBtn.style.color='var(--amber)';
        } else {
          rptBtn.textContent='\u2709 ERREUR';
          rptBtn.style.color='var(--red)';
        }
        setTimeout(function(){
          rptBtn.textContent='\u2709 RAPPORT';
          rptBtn.style.color='';rptBtn.style.borderColor='';
          rptBtn.title='Envoyer le rapport SOC maintenant [E]';
          rptBtn.disabled=false;_rptRunning=false;
        },4000);
      })
      .catch(function(){
        rptBtn.classList.remove('sending');
        rptBtn.textContent='\u2709 ERREUR';
        rptBtn.style.color='var(--red)';
        setTimeout(function(){
          rptBtn.textContent='\u2709 RAPPORT';
          rptBtn.style.color='';rptBtn.style.borderColor='';
          rptBtn.disabled=false;_rptRunning=false;
        },4000);
      });
  }
  rptBtn.addEventListener('click',triggerReport);
  document.addEventListener('keydown',function(e){
    if(!_isOpen&&(e.key==='e'||e.key==='E'))triggerReport();
  });
})();
