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
      + _ipRow('Scénario',`<span style="color:#00d9ff;font-size:var(--fs-xs)">${esc(_kcFmtScenario(csInfo.scenario||dot.cs_scenario||csMeta.scenario||'—'))}</span>`)
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
var _winModalOpen=false;
var _gpuModalOpen=false;
var _winCpuHistory=[];
var _winGpuHistory=[];
var _winVramHistory=[];
var _winHistMax=30;

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
function _bkAge(s){if(!s)return 999;return Math.floor((Date.now()-new Date(s.replace(' ','T')).getTime())/86400000);}
function _bkColor(a){return a>14?'var(--red)':a>6?'var(--yellow)':'var(--green)';}
function _bkAgeLbl(a){return a===999?'—':a===0?'aujourd\'hui':a+'j';}
function _bkpMatrixCell(zoneData,zoneLabel,vmn){
  var v=zoneData[vmn]||{};
  var age=_bkAge(v.last_date);
  var col=_bkColor(age);
  var cellCls=!v.last_date?'bkp-mc-none':age>14?'bkp-mc-crit':age>6?'bkp-mc-warn':'bkp-mc-ok';
  var ageTxt=!v.last_date?'N/A':age===0?'auj.':age+'j';
  var dateTxt=v.last_date?esc(v.last_date.substring(0,10)):'—';
  return `<div class="bkp-matrix-cell ${cellCls}">
<div class="bkp-cell-zone" style="color:${col}">${zoneLabel}</div>
<div class="bkp-cell-vm" style="color:var(--cyan)">${vmn}</div>
<div class="bkp-cell-age" style="color:${col}">${ageTxt}</div>
<div class="bkp-cell-date">${dateTxt}</div>
</div>`;
}
function _bkpZoneTableHtml(zoneData,zoneLabel){
  var rows=['srv-ngix','site01','site02'].map(function(vmn){
    var v=zoneData[vmn]||{};
    var hasB=v.last_date,age=_bkAge(v.last_date),col=_bkColor(age);
    return `<div class="bkp-vm-row">
<span style="color:${hasB?'var(--cyan)':'var(--muted)'}">${vmn}</span>
<span style="color:var(--text)">${hasB?esc(v.last_date):'<span style="color:var(--muted)">aucune</span>'}</span>
<span style="text-align:right;color:var(--muted)">${hasB?v.last_size_gb+' Go':'—'}</span>
<span style="text-align:right;color:var(--muted)">${hasB?v.count:'0'}</span>
<span style="text-align:right;color:${col}">${_bkAgeLbl(age)}</span>
</div>`;
  }).join('');
  return `<div class="bkp-zone-box">
<div class="bkp-zone-title">${zoneLabel}</div>
<div style="display:grid;grid-template-columns:75px 110px 55px 42px 36px;gap:.2rem .4rem;font-size:var(--fs-xs);color:var(--muted);padding-bottom:.2rem;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:.15rem">
<div>VM</div><div>Dernière</div><div style="text-align:right">Taille</div><div style="text-align:right">Fichiers</div><div style="text-align:right">Âge</div></div>
${rows}
</div>`;
}

// ── MODAL SAUVEGARDES ─────────────────────────────────
function buildBackupModal(wd){
  var bk=wd.backup||{},zones=bk.zones||{},manual=zones.manual||{},auto=zones.auto||{};
  var vms=bk.vms||{},crons=wd.cron||[];
  var bkPct=bk.pct||0;
  var bkStroke=bkPct>85?'var(--red)':bkPct>60?'var(--yellow)':'var(--green)';

  var vmSynth=['srv-ngix','site01','site02'].map(function(vmn){
    var v=vms[vmn]||{},age=_bkAge(v.last_date),col=_bkColor(age);
    return `<div style="display:grid;grid-template-columns:75px 110px 55px;gap:.2rem .4rem;font-size:var(--fs-xs);padding:.18rem 0;border-top:1px solid rgba(255,255,255,0.04)">
<span style="color:var(--cyan)">${vmn}</span>
<span style="color:${col}">${v.last_date?esc(v.last_date):'<span style="color:var(--muted)">aucune</span>'}</span>
<span style="text-align:right;color:var(--muted)">${v.count||0} fich.</span>
</div>`;
  }).join('');

  var cronRows=crons.length
    ? crons.map(function(ct){
        var stOk=ct.state==='Ready'||ct.state==='Running';
        var stCol=ct.state==='Running'?'var(--cyan)':stOk?'var(--green)':'var(--red)';
        var lastOkCol=ct.last_ok?'var(--green)':'var(--red)';
        var lastRunVal=ct.last_run==='jamais'
          ?'<span style="color:var(--muted)">jamais</span>'
          :`<span style="color:${lastOkCol}">${esc(ct.last_run)}</span><span style="color:${lastOkCol};margin-left:.3rem">${ct.last_ok?'✓':'✗'}</span>`;
        return `<div class="bkp-cron-row">
<div style="font-size:var(--fs-xs);color:var(--cyan);font-family:Courier New,monospace;margin-bottom:.4rem;letter-spacing:.5px">◎ ${esc(ct.name)}</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem">
<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(0,217,255,0.08);border-radius:3px;padding:.3rem .45rem">
<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:.2rem">État</div>
<div style="font-size:var(--fs-xs);font-weight:700;color:${stCol}">● ${esc(ct.state)}</div>
</div>
<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(0,217,255,0.08);border-radius:3px;padding:.3rem .45rem">
<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:.2rem">Dernier run</div>
<div style="font-size:var(--fs-xs);font-weight:700;white-space:nowrap">${lastRunVal}</div>
</div>
<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(0,217,255,0.08);border-radius:3px;padding:.3rem .45rem">
<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:.2rem">Prochain</div>
<div style="font-size:var(--fs-xs);font-weight:700;color:var(--cyan);white-space:nowrap">${esc(ct.next_run||'—')}</div>
</div>
</div></div>`;
      }).join('')
    : '<div style="font-size:var(--fs-xs);color:var(--muted)">Aucune tâche configurée</div>';

  return `<div class="win-refresh-bar">
<div style="display:flex;align-items:center;gap:.8rem">
<span class="ct-icon" style="color:var(--cyan);font-size:var(--fs-lg)">◎</span>
<span style="font-size:var(--fs-sm);font-weight:700;color:var(--cyan);letter-spacing:2px">SAUVEGARDES — PROXMOX</span>
</div>
<span class="win-modal-ts">Mis à jour : ${esc(wd.updated||'--')}</span>
</div>
<div class="bkp-modal-grid">
<div>
<div class="bkp-status-section">
<div class="win-section-hdr" style="margin-bottom:.3rem"><span style="color:var(--cyan)">▸</span> ÉTAT DES SAUVEGARDES</div>
<div class="bkp-matrix-zone-lbl">MANUEL</div>
<div class="bkp-matrix">${['srv-ngix','site01','site02'].map(function(vmn){return _bkpMatrixCell(manual,'MAN',vmn);}).join('')}</div>
<div class="bkp-matrix-zone-lbl">AUTO — samedi 23h</div>
<div class="bkp-matrix">${['srv-ngix','site01','site02'].map(function(vmn){return _bkpMatrixCell(auto,'AUTO',vmn);}).join('')}</div>
<div style="display:flex;gap:1rem;font-size:var(--fs-xs);color:var(--muted);margin-top:.3rem">
<span><span class="bkp-legend-dot" style="background:var(--green)"></span>&lt; 7 j</span>
<span><span class="bkp-legend-dot" style="background:var(--yellow)"></span>7–14 j</span>
<span><span class="bkp-legend-dot" style="background:var(--red)"></span>&gt; 14 j</span>
</div>
</div>
${_bkpZoneTableHtml(manual,'ZONE MANUEL')}
${_bkpZoneTableHtml(auto,'ZONE AUTO — samedi 23h')}
</div>
<div>
<div class="win-section">
<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> QUOTA D:\\BACKUP-PROXMOX</div>
<div style="display:flex;align-items:center;gap:1rem;margin-bottom:.4rem">
${winGaugeSVG(bkPct,bkStroke,'Quota','300 Go')}
<div style="flex:1">
<div style="font-size:var(--fs-xs);color:var(--muted)">Utilisé : <span style="color:var(--text)">${bk.used_gb||0} Go</span></div>
<div style="font-size:var(--fs-xs);color:var(--muted)">Quota : <span style="color:var(--text)">${bk.quota_gb||300} Go</span></div>
<div style="font-size:var(--fs-xs);color:var(--muted)">Libre : <span style="color:var(--green)">${Math.round(((bk.quota_gb||300)-(bk.used_gb||0))*10)/10} Go</span></div>
</div></div>
<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.2rem;text-transform:uppercase;letter-spacing:.8px">Synthèse toutes zones</div>
<div style="display:grid;grid-template-columns:75px 110px 55px;gap:.2rem .4rem;font-size:var(--fs-xs);color:var(--muted);padding-bottom:.15rem;margin-bottom:.1rem">
<div>VM</div><div>Dernière</div><div style="text-align:right">Total</div></div>
${vmSynth}
</div>
<div class="win-section">
<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> TÂCHES PLANIFIÉES</div>
${cronRows}
</div>
</div>
</div>
<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.35);text-align:center;margin-top:.4rem">Actualisation 60s · windows-disk-report.ps1</div>`;
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
  if(!gpu.name)return '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:var(--fs-xs)">GPU non détecté ou données indisponibles.</div>';
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

  var pwrGaugeHtml=gpu.power_pct!=null
    ?`<div class="gpu-gauge-item">${winGaugeSVG(pwrPct,pwrStroke,'POWER',(gpu.power_w||0)+' W')}<div class="gpu-gauge-lbl" style="color:rgba(245,158,11,0.6)">Puissance</div></div>`
    :'';

  var statsCards=[
    {lbl:'GPU Clock',   val:gpu.clock_gpu_mhz!=null?gpu.clock_gpu_mhz+' MHz':'N/A', c:'var(--purple)'},
    {lbl:'MEM Clock',   val:gpu.clock_mem_mhz!=null?gpu.clock_mem_mhz+' MHz':'N/A', c:'var(--cyan)'},
    {lbl:'MEM Controller',val:gpu.mem_ctrl_pct!=null?gpu.mem_ctrl_pct+'%':'N/A',    c:'var(--text)'},
    {lbl:'Power Draw',  val:gpu.power_w!=null?gpu.power_w+' W':'N/A',               c:'var(--amber)'},
    {lbl:'TDP Limit',   val:gpu.power_limit_w!=null?gpu.power_limit_w+' W':'N/A',   c:'var(--text)'},
    {lbl:'Ventilateur', val:gpu.fan_pct!=null?gpu.fan_pct+'%':'N/A',                c:gpu.fan_pct>70?'var(--red)':gpu.fan_pct>40?'var(--yellow)':'var(--green)'}
  ].map(function(s){
    return `<div class="gpu-stat-card"><div class="gpu-stat-lbl">${s.lbl}</div><div class="gpu-stat-val" style="color:${s.c}">${esc(s.val)}</div></div>`;
  }).join('');

  var pwrBarHtml=gpu.power_pct!=null
    ?`<div style="margin-top:.5rem">
<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:rgba(245,158,11,0.5);margin-bottom:.2rem">Puissance — ${gpu.power_w||0}W / ${gpu.power_limit_w||0}W (${pwrPct}%)</div>
<div class="gpu-power-bar-wrap"><div class="gpu-power-bar-fill" data-w="${Math.min(pwrPct,100)}" style="width:0%"></div></div>
</div>`
    :'';

  return `<div class="gpu-modal-hdr">
<div style="display:flex;align-items:center;gap:.8rem">
<span style="color:var(--purple);font-size:var(--fs-xl)">⬡</span>
<span style="font-size:var(--fs-sm);font-weight:700;color:var(--purple);letter-spacing:2px">GPU — INTELLIGENCE ARTIFICIELLE</span>
<span class="gpu-hdr-badge">NVIDIA CUDA</span>
</div>
<span class="win-modal-ts">Mis à jour : ${esc(wd.updated||'--')}</span>
</div>
<div class="gpu-name-bar">
<span>${esc(gpu.name||'—')}</span>
<span style="font-size:var(--fs-xs);color:rgba(191,95,255,0.5)">NVIDIA GPU · CUDA COMPUTE</span>
</div>
<div class="gpu-gauges-row">
<div class="gpu-gauge-item">${winGaugeSVG(gpuPct,gpuStroke,'COMPUTE','GPU %')}<div class="gpu-gauge-lbl" style="color:rgba(191,95,255,0.6)">Charge GPU</div></div>
<div class="gpu-gauge-item">${winGaugeSVG(vramPct,vramStroke,'VRAM',vramUsedGo+'/'+vramTotalGo+' Go')}<div class="gpu-gauge-lbl" style="color:rgba(0,217,255,0.6)">Mémoire GPU</div></div>
<div class="gpu-gauge-item">${winGaugeSVG(tempPct,tempStroke,'TEMP',tempRaw+'°C')}<div class="gpu-gauge-lbl" style="color:rgba(122,154,184,0.6)">Température</div></div>
${pwrGaugeHtml}
</div>
<div class="gpu-charts-grid">
<div class="gpu-chart-box">
<div class="gpu-chart-lbl" style="color:rgba(191,95,255,0.5)">Charge GPU — ${_winHistMax} dernières lectures</div>
<canvas id="gpu-compute-chart" height="52" style="width:100%;display:block;border-radius:2px;background:rgba(0,0,0,0.2)"></canvas>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.3);margin-top:.1rem"><span>-${Math.round(_winHistMax/2)}min</span><span>maintenant</span></div>
</div>
<div class="gpu-chart-box">
<div class="gpu-chart-lbl" style="color:rgba(0,217,255,0.5)">VRAM — ${_winHistMax} dernières lectures</div>
<canvas id="gpu-vram-chart" height="52" style="width:100%;display:block;border-radius:2px;background:rgba(0,0,0,0.2)"></canvas>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.3);margin-top:.1rem"><span>-${Math.round(_winHistMax/2)}min</span><span>maintenant</span></div>
</div>
</div>
<div class="gpu-stats-section">
<div class="win-section-hdr" style="color:var(--purple)"><span style="color:var(--purple)">▸</span> SPÉCIFICATIONS TECHNIQUES</div>
<div class="gpu-stats-grid">${statsCards}</div>
</div>
<div class="gpu-vram-section">
<div class="win-section-hdr" style="color:var(--cyan)"><span style="color:var(--cyan)">▸</span> VRAM — Répartition mémoire</div>
<div class="gpu-vram-bar-wrap"><div class="gpu-vram-bar-fill" data-w="${vramPct}" style="width:0%"></div></div>
<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-top:.2rem">
<span style="color:var(--cyan)">${vramUsedGo} Go utilisés (${vramPct}%)</span>
<span style="color:rgba(122,154,184,0.5)">${vramFreeGo} Go libres</span>
<span style="color:var(--muted)">Total ${vramTotalGo} Go</span>
</div>
${pwrBarHtml}
</div>
<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.3);text-align:center;margin-top:.3rem">Actualisation 60s · nvidia-smi · windows-disk-report.ps1</div>`;
}

function drawGpuCharts(){
  _raf2(function(){
    var cC=_modalBody.querySelector('#gpu-compute-chart');
    var vC=_modalBody.querySelector('#gpu-vram-chart');
    if(cC&&_winGpuHistory.length>1){
      drawNetSparkline(cC,_winGpuHistory,'191,95,255',100);
      var ctx=cC.getContext('2d');ctx.fillStyle='rgba(191,95,255,0.9)';ctx.font='bold 10px Courier New';ctx.textAlign='right';
      ctx.fillText(_winGpuHistory[_winGpuHistory.length-1]+'%',cC.width-4,12);
    } else if(cC){
      cC.width=cC.offsetWidth;cC.height=56;
      var c2=cC.getContext('2d');c2.fillStyle='rgba(122,154,184,0.3)';c2.font='10px Courier New';c2.textAlign='center';
      c2.fillText('Accumulation en cours... (30s/point)',cC.width/2,30);
    }
    if(vC&&_winVramHistory.length>1){
      drawNetSparkline(vC,_winVramHistory,'0,217,255',100);
      var ctx3=vC.getContext('2d');ctx3.fillStyle='rgba(0,217,255,0.9)';ctx3.font='bold 10px Courier New';ctx3.textAlign='right';
      ctx3.fillText(_winVramHistory[_winVramHistory.length-1]+'%',vC.width-4,12);
    } else if(vC){
      vC.width=vC.offsetWidth;vC.height=56;
      var c4=vC.getContext('2d');c4.fillStyle='rgba(122,154,184,0.3)';c4.font='10px Courier New';c4.textAlign='center';
      c4.fillText('Accumulation en cours... (30s/point)',vC.width/2,30);
    }
    _modalBody.querySelectorAll('.gpu-vram-bar-fill[data-w],.gpu-power-bar-fill[data-w]').forEach(function(b){
      b.style.width=b.dataset.w+'%';
    });
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
  _modalBody.innerHTML=(type==='bkp')?buildBackupModal(wd):buildWindowsModal(wd);
  _modalBody.style.fontSize='1em';
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
