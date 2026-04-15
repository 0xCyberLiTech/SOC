// ── Cache DOM — éléments persistants récupérés à chaque render (D11) ──
var _dc={};
function _dom(id){ if(!_dc[id]||!_dc[id].isConnected) _dc[id]=document.getElementById(id); return _dc[id]; }
// ── Double rAF — garantit un layout pass complet avant draw canvas (D7/N5) ──
function _raf2(fn){ requestAnimationFrame(function(){ requestAnimationFrame(fn); }); }

// ── Helpers hoistés (D8 — sortis de render() pour éviter la redéfinition à chaque cycle) ──
function secBar(ic,lb,cl,sub){return '<div class="sec-bar" style="border-left-color:'+cl+';color:'+cl+';background:'+cl+'0d"><span>'+ic+'</span><span>'+lb+(sub?'<span class="sec-bar-sub"> · '+sub+'</span>':'')+'</span></div>';}
function _fmtScenario(s){
  return (s||'').replace(/^crowdsecurity\//i,'').replace(/^suricata-/i,'').replace(/_/g,'-')
    .replace(/\s+non\s+bloqu[eé]\s*(CS)?\s*$/i,'').slice(0,24).replace(/[-_ ]+$/,'');
}

// ── Sections extraites de render() (D8 — session 2026-04-12) ──

// NDT-25a — sum-items Proxmox nœud (CPU/RAM/SSD) — IIFE promue en helper module-level
function _hudPrxSumItems(prx){
  if(!prx.configured||!prx.nodes||!prx.nodes.length)return'';
  var node=prx.nodes[0];
  var out='';
  if(node.cpu_pct!==undefined){
    var cc=node.cpu_pct>85?'crit':node.cpu_pct>60?'warn':'ok';
    var cClr=node.cpu_pct>85?'var(--red)':node.cpu_pct>60?'var(--yellow)':'var(--purple)';
    out+='<div class="sum-item"><div class="sum-val '+cc+'">'+node.cpu_pct+'%</div>'
      +'<div class="sum-lbl">PVE CPU</div>'
      +'<div class="sum-gauge" style="width:'+node.cpu_pct+'%;background:'+cClr+'"></div></div>';
  }
  if(node.mem_pct!==undefined){
    var mc=node.mem_pct>85?'crit':node.mem_pct>60?'warn':'ok';
    var mClr=node.mem_pct>85?'var(--red)':node.mem_pct>60?'var(--yellow)':'var(--purple)';
    out+='<div class="sum-item"><div class="sum-val '+mc+'">'+node.mem_pct+'%</div>'
      +'<div class="sum-lbl">PVE RAM</div>'
      +(node.mem_used_mb&&node.mem_total_mb?'<div class="sum-sub">'+(node.mem_used_mb/1024).toFixed(1)+'/'+(node.mem_total_mb/1024).toFixed(1)+' Go</div>':'')
      +'<div class="sum-gauge" style="width:'+node.mem_pct+'%;background:'+mClr+'"></div></div>';
  }
  var ssd=null;
  (node.storages||[]).forEach(function(s){if(!ssd||s.total_gb>ssd.total_gb)ssd=s;});
  if(ssd){
    var sc2=ssd.pct>85?'crit':ssd.pct>60?'warn':'ok';
    var sClr=ssd.pct>85?'var(--red)':ssd.pct>60?'var(--yellow)':'var(--green)';
    out+='<div class="sum-item"><div class="sum-val '+sc2+'">'+ssd.pct.toFixed(0)+'%</div>'
      +'<div class="sum-lbl">PVE SSD 2To</div>'
      +'<div class="sum-sub">'+ssd.used_gb+'/'+(ssd.total_gb>999?(ssd.total_gb/1024).toFixed(1)+' To':ssd.total_gb+' Go')+'</div>'
      +'<div class="sum-gauge" style="width:'+ssd.pct+'%;background:'+sClr+'"></div></div>';
  }
  return out;
}
// NDT-25b — HTML complet de la barre summary (niveau menace + trafic + sécu + système + PVE)
function _hudSummaryHtml(d, t, sys, ts){
  var mem=sys.memory||{};
  var cpu=sys.cpu_pct;
  var prx=d.proxmox||{};
  var svcUp=Object.values(d.services).filter(function(s){return s.status==='UP';}).length;
  var svcTot=Object.keys(d.services).length;
  var minSsl=Math.min.apply(null,(d.ssl||[]).map(function(s){return s.days_left||999;}));
  var err=t.error_rate||0;
  return '<div class="sum-item" style="border-left:2px solid '+ts.color+';min-width:120px"><div class="sum-val" style="color:'+ts.color+';text-shadow:0 0 12px '+ts.color+';font-size:var(--fs-md);letter-spacing:2px">'+ts.level+'</div><div class="sum-lbl">Niveau menace</div></div>'
   +'<div class="sum-item"><div class="sum-val">'+fmt(t.total_requests)+'</div><div class="sum-lbl">Requêtes reçues · 24h</div></div>'
   +(t.unique_visitors!==undefined?'<div class="sum-item"><div class="sum-val" style="color:var(--cyan);text-shadow:0 0 10px var(--cyan)">'+fmt(t.unique_visitors)+'</div><div class="sum-lbl">Visiteurs uniques · 24h</div></div>':'')
   +'<div class="sum-item"><div class="sum-val '+errC(err)+'">'+err+'%'+_gmTrend(err,_snap.err,true)+'</div><div class="sum-lbl">Taux d\'erreur HTTP</div></div>'
   +'<div class="sum-item"><div class="sum-val '+(svcUp===svcTot?'ok':'crit')+'">'+svcUp+'/'+svcTot+'</div><div class="sum-lbl">Services actifs</div></div>'
   +'<div class="sum-item"><div class="sum-val '+(t.geo_blocks>100?'warn':t.geo_blocks>0?'warn':'ok')+'">'+fmt(t.geo_blocks)+_gmTrend(t.geo_blocks,_snap.geo,true)+'</div><div class="sum-lbl">GeoIP bloqués</div></div>'
   +((d.ufw||{}).blocked_total!==undefined?'<div class="sum-item"><div class="sum-val crit">'+fmt(d.ufw.blocked_total)+_gmTrend(d.ufw.blocked_total,_snap.ufw,true)+'</div><div class="sum-lbl">UFW bloqués</div></div>':'')
   +'<div class="sum-item"><div class="sum-val '+(minSsl<7?'crit':minSsl<30?'warn':'ok')+'">'+minSsl+'j</div><div class="sum-lbl">SSL · expiration</div></div>'
   +'<div class="sum-break" data-lbl="SYSTÈME · INFRASTRUCTURE"></div>'
   +(cpu!==undefined?'<div class="sum-item"><div class="sum-val '+(cpu>85?'crit':cpu>60?'warn':'ok')+'">'+cpu+'%</div><div class="sum-lbl">CPU srv-ngix</div></div>':'')
   +(mem.pct!==undefined?'<div class="sum-item"><div class="sum-val '+(mem.pct>85?'crit':mem.pct>60?'warn':'ok')+'">'+mem.pct+'%</div><div class="sum-lbl">RAM srv-ngix</div></div>':'')
   +'<div class="sum-item"><div class="sum-val" style="font-size:var(--fs-md)">'+fmtB(t.total_bytes)+'</div><div class="sum-lbl">Bande passante · 24h</div></div>'
   +(sys.uptime?'<div class="sum-item"><div class="sum-val" style="font-size:var(--fs-sm)">'+sys.uptime+'</div><div class="sum-lbl">Uptime srv-ngix</div></div>':'')
   +(prx.configured&&prx.vms_running!==undefined?'<div class="sum-item"><div class="sum-val ok">'+prx.vms_running+'/'+prx.vms_total+'</div><div class="sum-lbl">VMs Proxmox actives</div></div>':'')
   +_hudPrxSumItems(prx);
}
function _renderHUD(d){
  var t=d.traffic||{};
  var sys=d.system||{};
  var ts=computeThreatScore(d);
  _lastThreatResult=ts; // partagé avec _renderThreatScore + carte Leaflet

  // Timestamp + barre drain
  var _gaD=new Date(d.generated_at);
  var _gaStr=_gaD.getFullYear()+'-'+String(_gaD.getMonth()+1).padStart(2,'0')+'-'+String(_gaD.getDate()).padStart(2,'0')+' '+String(_gaD.getHours()).padStart(2,'0')+':'+String(_gaD.getMinutes()).padStart(2,'0')+':'+String(_gaD.getSeconds()).padStart(2,'0');
  _dom('gen-at').textContent=_gaStr;
  var fill=_dom('fill');fill.style.animation='none';fill.offsetHeight;fill.style.animation='drain 60s linear infinite';

  // Summary bar
  document.getElementById('summary').innerHTML=_hudSummaryHtml(d, t, sys, ts);

  // fw-btn state
  var fwBtn=document.getElementById('fw-btn');
  if(fwBtn){
    var fw=d.firewall_matrix||{};
    var fwHosts=fw.hosts||[];
    var fwAlert=fwHosts.some(function(h){return h.ufw_active===false||h.conformity<90;});
    fwBtn.className='fw-btn'+(fwAlert?' alert':'');
    var minFwScore=fwHosts.reduce(function(mn,h){return h.conformity!==undefined?Math.min(mn,h.conformity):mn;},100);
    fwBtn.textContent='\u25a0 FIREWALL '+(fwHosts.length?minFwScore+'%':'');
  }
}

// NDT-31a — barre stats auto-ban (total + 24h) → retourne '' si abl vide, sinon HTML
function _ablStatsBarHtml(abl){
  if(!abl.length)return '<div style="font-size:var(--fs-xs);color:var(--green);margin-top:.4rem">✓ Aucun auto-ban enregistré</div>';
  var recent24=0,now24=Date.now()-86400000;
  abl.forEach(function(e){if(new Date(e.ts).getTime()>now24)recent24++;});
  return '<div style="display:flex;gap:.6rem;align-items:baseline;margin-bottom:.5rem;flex-shrink:0">'
   +'<span style="font-size:var(--fs-xl);font-weight:700;color:var(--orange);font-family:\'Courier New\',monospace">'+abl.length+'</span>'
   +'<span style="font-size:var(--fs-xs);color:var(--muted)">bans total</span>'
   +'<span style="font-size:var(--fs-sm);font-weight:700;color:var(--red);font-family:\'Courier New\',monospace;margin-left:.5rem">'+recent24+'</span>'
   +'<span style="font-size:var(--fs-xs);color:var(--muted)">dernières 24h</span>'
   +'</div>';
}
// NDT-31b — liste scrollable des 50 derniers auto-bans → retourne '' si abl vide
var _ABL_STAGE_COL={'EXPLOIT':'var(--red)','BRUTE':'var(--purple)','SCAN':'var(--yellow)','RECON':'var(--cyan)'};
function _ablRowsHtml(abl){
  if(!abl.length)return '';
  var rowsHtml=abl.slice(0,50).map(function(e){
    var stCol=_ABL_STAGE_COL[e.stage||'RECON']||'var(--orange)';
    var ts=new Date(e.ts).toISOString().slice(11,16);
    var rule=e.rule||'ban 24h';
    var countryHtml=e.country&&e.country!=='-'?'['+esc(e.country)+']':'';
    return `<div class="abl-row" style="border-left:3px solid ${stCol}66">`
     +`<span style="color:var(--orange);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.ip)}</span>`
     +`<span style="color:var(--muted)">${countryHtml}</span>`
     +`<span style="background:${stCol}18;color:${stCol};border:1px solid ${stCol}44;border-radius:2px;padding:.04rem .1rem;font-weight:700;letter-spacing:.4px;text-align:center;white-space:nowrap">${esc(e.stage||'?')}</span>`
     +`<span style="color:rgba(0,255,136,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">⊛ ${esc(rule)}</span>`
     +`<span style="color:rgba(122,154,184,0.3);text-align:right;white-space:nowrap">${ts}</span>`
     +'</div>';
  }).join('');
  return `<div class="abl-scroll" style="flex:1;min-height:0;overflow-y:auto">${rowsHtml}</div>`;
}
function _renderAutoBan(d,g){
  var abl=d.autoban_log||[];
  var h='<div class="card abl-card" title="Cliquer pour voir tout l\'historique" style="display:flex;flex-direction:column">'
   +'<div class="corner tl"></div><div class="corner tr"></div><div class="card-inner" style="display:flex;flex-direction:column;flex:1;min-height:0">'
   +'<div class="ct c"><span class="ct-icon">⊛</span>ACTIONS PROACTIVES — AUTO-BAN'
   +'<span style="font-size:var(--fs-xs);color:var(--orange);margin-left:auto;opacity:.6;font-family:\'Courier New\',monospace">▸ voir tout</span>'
   +'</div>'+_ablStatsBarHtml(abl)+_ablRowsHtml(abl)+'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var _aCard=g.querySelector('.abl-card');
  if(_aCard)_aCard.addEventListener('click',function(){openAutoBanModal();});
  window._ablData=abl;
}

// NDT-29a — 4 stat-boxes + badges protocoles + bandeau tronqués
function _surStatBoxesHtml(s1, s2, tot, rules, evts, trunc){
  var criCol=s1>0?'var(--red)':s2>0?'var(--amber)':'var(--green)';
  var criGlow=s1>0?'text-shadow:0 0 8px var(--red)':s2>0?'text-shadow:0 0 8px var(--amber)':'text-shadow:0 0 6px var(--green)';
  var h='<div style="display:flex;gap:.5rem;margin-bottom:.4rem">'
   +'<div class="stat-box" style="flex:1;text-align:center"><div class="sval" style="color:'+criCol+';'+criGlow+'">'+s1+'</div><div class="slbl">CRITIQUE sév.1</div></div>'
   +'<div class="stat-box" style="flex:1;text-align:center"><div class="sval" style="color:var(--amber)">'+s2+'</div><div class="slbl">HIGH sév.2</div></div>'
   +'<div class="stat-box" style="flex:1;text-align:center"><div class="sval" style="color:var(--cyan)">'+tot+'</div><div class="slbl">Total alertes</div></div>'
   +'<div class="stat-box" style="flex:1;text-align:center"><div class="sval" style="color:var(--muted);font-size:var(--fs-xs)">'+Math.round(rules/1000)+'k</div><div class="slbl">Règles ET</div></div>'
   +'</div>'
   +'<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.4rem">'
   +['dns','http','tls','ssh','flow'].map(function(k){
     var v=evts[k]||0;
     return '<div style="padding:.12rem .35rem;background:rgba(0,217,255,0.06);border:1px solid rgba(0,217,255,0.15);border-radius:2px;font-size:var(--fs-xs);color:var(--cyan)">'
       +'<span style="opacity:.6;text-transform:uppercase">'+k+'</span> <span style="font-weight:700">'+v+'</span></div>';
   }).join('')
   +'</div>'
   +(trunc>0?'<div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.35rem;padding:.18rem .4rem;background:rgba('+(trunc>15000?'255,59,92':'255,165,0')+',0.07);border:1px solid rgba('+(trunc>15000?'255,59,92':'255,165,0')+',0.2);border-radius:3px">'
     +'<span style="font-size:var(--fs-xs);color:rgba('+(trunc>15000?'255,59,92':'255,165,0')+',0.9)">⚠ CAPTURE: '+fmt(trunc)+' paquets tronqués/24h</span>'
     +'<span style="font-size:var(--fs-xs);color:var(--muted);margin-left:auto">ring AF-PACKET</span>'
     +'</div>':'');
  return h;
}
// NDT-29b — top 5 IPs Suricata (barres horizontales) → retourne '' si vide
function _surTopIpsHtml(topIps){
  if(!topIps.length)return '';
  var maxIp=topIps[0].count||1;
  var rowsHtml=topIps.slice(0,5).map(function(e){
    var pct=Math.round(e.count*100/maxIp);
    return `<div style="display:flex;align-items:center;gap:.3rem">`
      +`<span style="font-size:var(--fs-xs);color:var(--red);font-family:Courier New,monospace;min-width:7rem">${esc(e.ip)}</span>`
      +`<div style="flex:1;height:4px;background:rgba(255,59,92,0.15);border-radius:2px">`
      +`<div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ff3b5c88,#ff3b5c);border-radius:2px"></div></div>`
      +`<span style="font-size:var(--fs-xs);color:var(--muted);min-width:1.5rem;text-align:right">${e.count}</span>`
      +'</div>';
  }).join('');
  return '<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.18rem">Top IPs — sév.1+2</div>'
   +`<div style="display:flex;flex-direction:column;gap:.1rem;margin-bottom:.35rem">${rowsHtml}</div>`;
}
// NDT-29c — bandeau alertes critiques sév.1 animé → retourne '' si s1=0
function _surCriticalAlertsHtml(s1, sur){
  if(!s1)return '';
  var rc=sur.recent_critical||[];
  var alertsHtml=rc.slice(0,2).map(function(a){
    return `<div style="font-size:var(--fs-xs);color:rgba(255,59,92,0.8);line-height:1.3">${esc(a.src_ip)} — ${esc(a.signature.substring(0,55))}</div>`;
  }).join('');
  return `<div style="padding:.2rem .4rem;background:rgba(255,59,92,0.1);border:1px solid rgba(255,59,92,0.35);border-radius:3px;animation:blink 1.5s ease-in-out infinite">`
   +`<div style="font-size:var(--fs-xs);color:var(--red);font-weight:700;margin-bottom:.12rem">⚠ ${s1} ALERTE${s1>1?'S':''} CRITIQUE${s1>1?'S':''} — sévérité 1</div>`
   +alertsHtml
   +'</div>';
}
function _renderSuricata(d,g){
  var sur=d.suricata||{};
  if(!sur.available){
    g.insertAdjacentHTML('beforeend','<div class="card wide"><div class="card-inner"><div class="ct r"><span class="ct-icon">◈</span>SURICATA IDS — NON DISPONIBLE</div><div style="font-size:var(--fs-xs);color:var(--muted);padding:.4rem 0">⚠ Suricata non démarré ou EVE JSON absent — <code>/var/log/suricata/eve.json</code></div></div></div>');
    return;
  }
  var s1=sur.sev1_critical||0, s2=sur.sev2_high||0;
  var lanPfx=['192.168.','10.','172.16.','172.17.','127.'];
  var topIps=(sur.top_ips||[]).filter(function(e){return e.ip&&!lanPfx.some(function(p){return e.ip.indexOf(p)===0;});});
  var h='<div class="card" id="suricata-card" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct '+(s1>0?'r':s2>0?'y':'c')+'"><span class="ct-icon">◈</span>SURICATA IDS — ALERTES RÉSEAU 24H</div>'
   +_surStatBoxesHtml(s1, s2, sur.total_alerts||0, sur.rules_loaded||0, sur.events||{}, sur.truncated_24h||0)
   +_surTopIpsHtml(topIps)
   +_surCriticalAlertsHtml(s1, sur)
   +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.25);margin-top:.4rem;text-align:center;letter-spacing:.8px;text-transform:uppercase">↑ cliquer pour détails</div>'
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  document.getElementById('suricata-card').addEventListener('click',function(){openSuricataModal(window._lastData&&window._lastData.suricata);});
}

function _renderHoneypot(d,g){
  var hp=d.honeypot||{};
  var hits=hp.total_hits||0, hpIps=hp.total_ips||0, paths=hp.top_paths||[];
  var pathsBodyHtml;
  if(!paths.length){
    pathsBodyHtml='<div class="hpt-empty">✓ Aucun chemin piège déclenché</div>';
  } else {
    var mx=paths[0].count||1;
    var pathRowsHtml=paths.slice(0,12).map(function(p){
      var pct=Math.round(p.count*100/mx);
      var intensity=pct>75?'#ef4444':pct>40?'#ff6b35':'#f59e0b';
      return `<div class="hpt-row">`
        +`<div class="hpt-path" style="color:${intensity}">${p.path}</div>`
        +`<div class="hpt-bar-wrap"><div class="hpt-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${intensity}88,${intensity})"></div></div>`
        +`<div class="hpt-count" style="color:${intensity}">${p.count}</div>`
        +`<div class="hpt-ips">${p.unique_ips}×IP</div>`
        +'</div>';
    }).join('');
    pathsBodyHtml=`<div class="hpt-list">${pathRowsHtml}</div>`;
  }
  var h=`<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">`
   +`<div class="ct ${hits>0?'r':''}"><span class="ct-icon">⚠</span>HONEYPOT · PIÈGES — 24H</div>`
   +`<div class="hpt-mini-bar">`
   +`<span class="hpt-mini-badge hpt-hits">${fmt(hits)} requêtes</span>`
   +`<span class="hpt-mini-badge hpt-ips">${hpIps} IP${hpIps>1?'s':''}</span>`
   +`<span class="hpt-mini-badge hpt-paths">${paths.length} chemin${paths.length>1?'s':''}</span>`
   +'</div>'
   +pathsBodyHtml
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}

// NDT-30a — construit le tableau des 8 techniques MITRE avec leurs scores en temps réel
function _mitreBuildTechniques(d){
  var kc2=d.kill_chain||{}, sc=kc2.stage_counts||{}, f2b2=d.fail2ban||{}, cs2=d.crowdsec||{};
  var sur2=d.suricata||{};
  var surSev1=sur2.available?(sur2.sev1_critical||0):0;
  var surSev2=sur2.available?(sur2.sev2_high||0):0;
  var surTotal=sur2.available?(sur2.total_alerts||0):0;
  var sshFail=(d.ssh||[]).reduce(function(a,m){return a+(m.failed_24h||0);},0);
  var f2bHosts=[f2b2.jails||[],(f2b2.proxmox&&f2b2.proxmox.jails)||[],(f2b2.site01&&f2b2.site01.jails)||[],(f2b2.site02&&f2b2.site02.jails)||[]];
  var sshBansAll=f2bHosts.reduce(function(a,jls){return a+jls.filter(function(j){return j.jail==='sshd';}).reduce(function(x,j){return x+(j.cur_banned||0);},0);},0);
  var apacheJails=['apache-badbots','apache-noscript','apache-overflows'];
  var webBotScore=[(f2b2.site01&&f2b2.site01.jails)||[],(f2b2.site02&&f2b2.site02.jails)||[]].reduce(function(a,jls){
    return a+jls.filter(function(j){return apacheJails.indexOf(j.jail)>=0;}).reduce(function(x,j){return x+(j.cur_banned||0)+(j.tot_failed||0);},0);
  },0);
  var totalBansAll=(f2b2.total_banned||0)+(f2b2.proxmox&&f2b2.proxmox.available?f2b2.proxmox.total_banned||0:0)+(f2b2.site01&&f2b2.site01.available?f2b2.site01.total_banned||0:0)+(f2b2.site02&&f2b2.site02.available?f2b2.site02.total_banned||0:0);
  var exploitScore=(sc.EXPLOIT||0)+(cs2.appsec&&cs2.appsec.blocked||0)+surSev1;
  return [
    {id:'T1595',    name:'Active Scanning',       tac:'RECON',  score:sc.RECON||0,                         src:'CrowdSec·RECON',         col:'#bf5fff'},
    {id:'T1595.002',name:'Vuln. Scanning',         tac:'RECON',  score:(sc.SCAN||0)+surSev2,                src:'CrowdSec·Suricata·SCAN', col:'#a855f7'},
    {id:'T1190',    name:'Exploit Public App',     tac:'ACCESS', score:exploitScore,                        src:'CrowdSec·WAF·Suricata',  col:'#ff3b5c'},
    {id:'T1059',    name:'Command Exec / ShellInj',tac:'EXEC',   score:surSev1,                             src:'Suricata·IDS·sév1',      col:'#ff4500'},
    {id:'T1190.002',name:'Web Bots / Scraping',    tac:'ACCESS', score:webBotScore,                         src:'F2B·CLT·SITE02',           col:'#ff6b35'},
    {id:'T1110',    name:'Brute Force SSH',        tac:'CRED',   score:(sc.BRUTE||0)+sshFail+sshBansAll,    src:'CrowdSec·F2B·SSH',       col:'#ffd700'},
    {id:'T1071',    name:'C2 / Trafic suspect',    tac:'C&C',    score:Math.max(0,surTotal-surSev1-surSev2), src:'Suricata·réseau',        col:'#20b2aa'},
    {id:'T1499',    name:'DoS / Bans — 4 hôtes',  tac:'IMPACT', score:totalBansAll,                        src:'F2B·4 hôtes',            col:'#00d9ff'},
  ];
}
// NDT-30b — HTML d'une ligne technique MITRE (barre + score + badge ACTIF/—)
function _mitreRowHtml(t, maxScore){
  var on=t.score>0;
  var pct=Math.min(100,Math.round(t.score*100/maxScore));
  return '<div class="att-hbar-row'+(on?' att-active':'')+'" style="border-left:3px solid '+(on?t.col+'88':'rgba(255,255,255,0.04)')+'">'
    +'<div class="att-hbar-tac" style="color:'+(on?t.col:'rgba(122,154,184,0.28)')+'">'+t.tac+'</div>'
    +'<div class="att-hbar-tid">'+t.id+'</div>'
    +'<div style="display:flex;flex-direction:column;justify-content:center;flex:0 0 145px;overflow:hidden">'
    +'<div class="att-hbar-name" style="color:'+(on?t.col:'rgba(122,154,184,0.3)')+'">'+t.name+'</div>'
    +'<div class="att-hbar-src">'+t.src+'</div>'
    +'</div>'
    +'<div class="att-hbar-track">'
    +(on?'<div class="att-hbar-fill" style="width:'+pct+'%;background:linear-gradient(90deg,'+t.col+'55,'+t.col+')"></div>':'')
    +'</div>'
    +'<div class="att-hbar-score" style="color:'+(on?t.col:'rgba(122,154,184,0.2)')+'">'+t.score+'</div>'
    +(on
      ?'<div class="att-hbar-badge" style="background:'+t.col+'1a;color:'+t.col+';border:1px solid '+t.col+'55">ACTIF</div>'
      :'<div class="att-hbar-badge off">—</div>')
    +'</div>';
}
function _renderMitre(d,g){
  var T=_mitreBuildTechniques(d);
  var totalActive=T.filter(function(t){return t.score>0;}).length;
  var maxScore=Math.max.apply(null,T.map(function(t){return t.score;}).concat([1]));
  var rowsHtml=''; T.forEach(function(t){rowsHtml+=_mitreRowHtml(t,maxScore);});
  var h='<div class="card wide"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="att-summary">'
   +'<div class="ct c" style="margin:0;border:none;background:none;padding:0"><span class="ct-icon">⚔</span>MITRE ATT&amp;CK — MAPPING TEMPS RÉEL</div>'
   +(totalActive>0
     ?'<div class="att-summary-active">'+totalActive+' technique'+(totalActive>1?'s':'')+' active'+(totalActive>1?'s':'')+' détectée'+(totalActive>1?'s':'')+'</div>'
     :'<div class="att-summary-calm">✓ Calme — aucune technique active</div>')
   +'</div>'+rowsHtml+'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}

function _renderCve(d,g){
  var cve=d.cve_sync||{};
  var cveBodyHtml=cve.error
    ?`<span style="color:var(--red)">ERROR: ${cve.error}</span>`
    :`<div class="row"><span class="row-label">Derniere MAJ</span><span class="row-val hi" style="font-size:var(--fs-xs)">${cve.last_update||'—'}</span></div>`
      +`<div class="row"><span class="row-label">Mois indexes</span><span class="row-val" style="color:var(--orange)">${cve.months}</span></div>`;
  g.insertAdjacentHTML('beforeend',
    '<div class="card wide"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◉</span>CVE SYNC</div>'
    +cveBodyHtml
    +'</div></div>');
}

function _renderSSL(d,g){
  var sslItems=(d.ssl||[]).map(function(s){
    var days=s.days_left||0;
    var cls=sslC(days);
    var statusLbl=days>30?'VALIDE':days>7?'EXPIRE BIENTÔT':'CRITIQUE';
    var statusColor=days>30?'var(--green)':days>7?'var(--yellow)':'var(--red)';
    var expiryHtml=s.expiry?`<div class="ssl-date">expire le ${s.expiry}</div>`:'';
    return `<div class="ssl-item" style="flex-direction:column;align-items:flex-start;gap:.3rem;padding:.4rem .5rem;background:rgba(0,0,0,0.18);border-radius:3px">`
      +`<div style="text-align:center;width:100%">`
      +`<div class="ssl-days ${cls}">${days>=0?days:'ERR'}</div>`
      +`<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px">JOURS</div>`
      +'</div>'
      +`<div style="width:100%"><div class="ssl-dom">${s.domain}</div>`
      +expiryHtml
      +`<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.6px;margin-top:.15rem;color:${statusColor}">${statusLbl}</div>`
      +'</div></div>';
  }).join('');
  g.insertAdjacentHTML('beforeend',
    `<div class="card half" style="max-width:600px"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">`
    +`<div class="ct c"><span class="ct-icon">◉</span>CERTIFICATS SSL</div>`
    +`<div style="display:grid;grid-template-columns:repeat(${Math.min((d.ssl||[]).length,2)},1fr);gap:.5rem">`
    +sslItems
    +'</div></div></div>');
}

function _renderSecurite24h(d,g){
  var t=d.traffic||{};
  var scans=(t.top_scanners||[]).reduce(function(a,e){return a+e[1];},0);
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◉</span>SECURITE 24H</div>'
   +'<div class="sec-grid">'
   +'<div class="sec-box '+(t.geo_blocks>50?'warn':t.geo_blocks>0?'warn':'safe')+'">'
   +'<div class="sec-big">'+fmt(t.geo_blocks)+'</div><div class="sec-lbl">GeoIP bloques</div></div>'
   +'<div class="sec-box '+((t.status_5xx||0)>10?'danger':(t.status_5xx||0)>0?'warn':'safe')+'">'
   +'<div class="sec-big">'+fmt(t.status_5xx||0)+'</div><div class="sec-lbl">Erreurs 5xx</div></div>'
   +'<div class="sec-box info"><div class="sec-big">'+fmt(t.bots)+'</div><div class="sec-lbl">Bots</div></div>'
   +'<div class="sec-box '+(scans>0?'danger':'safe')+'"><div class="sec-big">'+fmt(scans)+'</div><div class="sec-lbl">Scans offensifs</div></div>'
   +'</div>';
  var scannersHtml=t.top_scanners&&t.top_scanners.length
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Outils detectes</div>'
      +t.top_scanners.map(function(e){return `<span class="stag">${esc(e[0])} (${e[1]})</span>`;}).join('')
    :'';
  g.insertAdjacentHTML('beforeend',h+scannersHtml+'</div></div>');
}

function _renderThreatIntel(d,g){
  var th=d.threat_sync||{};
  var bodyHtml;
  if(th.error){
    bodyHtml=`<span style="color:var(--red)">ERROR: ${esc(th.error)}</span>`;
  } else {
    var samplesHtml=th.total_samples!==undefined
      ?`<div class="row"><span class="row-label">Total IOCs actifs</span><span class="row-val crit">${fmt(th.total_samples)}</span></div>`
      :'';
    var sourcesHtml=th.sources
      ?Object.entries(th.sources).map(function(e){
          return `<div class="src-row"><span class="src-name">${esc(e[0])}</span><span class="src-val">${fmt(e[1])}</span></div>`;
        }).join('')
      :'';
    bodyHtml=`<div class="row"><span class="row-label">Derniere MAJ</span><span class="row-val hi" style="font-size:var(--fs-xs)">${th.last_update||'—'}</span></div>`
      +samplesHtml+sourcesHtml;
  }
  g.insertAdjacentHTML('beforeend',
    '<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◉</span>THREAT INTEL SYNC</div>'
    +bodyHtml
    +'</div></div>');
}

// ── NDT-15 : fonctions imbriquées promues module-level ──────────────────────────
function _sdBar(val,col,maxV){
  var w=Math.round(val*100/maxV);
  return '<div style="flex:1;height:7px;background:rgba(255,255,255,0.04);border-radius:3px;overflow:hidden;margin:0 .45rem">'
    +'<div style="width:'+w+'%;height:100%;background:'+col+';border-radius:3px;transition:width .5s ease;opacity:.85;filter:brightness(1.1)"></div></div>';
}
function _sdBadge(ok){
  return ok
    ?'<span style="font-size:var(--fs-xs);padding:.06rem .38rem;background:rgba(0,255,136,.1);color:var(--green);border:1px solid rgba(0,255,136,.28);border-radius:2px;letter-spacing:.5px;text-shadow:0 0 6px rgba(0,255,136,.4)">ACTIF</span>'
    :'<span style="font-size:var(--fs-xs);padding:.06rem .38rem;background:rgba(107,114,128,.07);color:rgba(122,154,184,.4);border:1px solid rgba(107,114,128,.14);border-radius:2px;letter-spacing:.5px">—</span>';
}

// NDT-26a — construit le tableau des 9 couches de défense à partir des données JSON
function _sdBuildLayers(d){
  var f2b=d.fail2ban||{}, ufw=d.ufw||{}, cs=d.crowdsec||{}, t=d.traffic||{};
  var pvf2b=f2b.proxmox||{};
  var f2bBansPvx=pvf2b.available?(pvf2b.total_banned||0):null;
  var _aa=d.clt_apparmor||{}, _ms=d.clt_modsec||{}, _aan=d.apparmor_nginx||{};
  var _aap=d.pa85_apparmor||{}, _msp=d.pa85_modsec||{};
  var cltf2b=f2b.site01||{}, pa85f2b=f2b.site02||{};
  var f2bBansClt=cltf2b.available?(cltf2b.total_banned||0):null;
  var f2bBansPa85=pa85f2b.available?(pa85f2b.total_banned||0):null;
  return [
    {ico:'⊘', lbl:'UFW',              sub:'Pare-feu réseau',          val:ufw.blocked_total||0,          col:'rgba(255,59,92,.85)',   ok:ufw.active!==false},
    {ico:'◎', lbl:'GeoIP',            sub:'Filtrage géographique',    val:t.geo_blocks||0,               col:'rgba(255,107,53,.85)',  ok:true},
    {ico:'⊛', lbl:'CrowdSec IDS',     sub:'Détection comportementale',val:cs.alerts_24h||0,              col:'rgba(255,215,0,.85)',   ok:cs.available||false},
    {ico:'⊛', lbl:'CrowdSec IPS',     sub:'Blocage automatique',      val:cs.active_decisions||0,        col:'rgba(255,107,53,.9)',   ok:cs.available||false},
    {ico:'◈', lbl:'fail2ban — srv-ngix', sub:'Protection SSH · Nginx',       val:f2b.total_banned||0,                          col:'rgba(0,217,255,.85)',  ok:!!(f2b.jails&&f2b.jails.length)},
    {ico:'◈', lbl:'fail2ban — Proxmox',  sub:'Protection SSH · Hyperviseur', val:f2bBansPvx!==null?f2bBansPvx:0,               col:'rgba(0,180,220,.7)',   ok:pvf2b.available===true,  na:f2bBansPvx===null},
    {ico:'◈', lbl:'fail2ban — SITE01',      sub:'Protection SSH · Apache2',     val:f2bBansClt!==null?f2bBansClt:0,               col:'rgba(0,160,200,.65)',  ok:cltf2b.available===true, na:f2bBansClt===null},
    {ico:'◈', lbl:'fail2ban — SITE02',     sub:'Protection SSH · Apache2',     val:f2bBansPa85!==null?f2bBansPa85:0,             col:'rgba(0,140,180,.6)',   ok:pa85f2b.available===true,na:f2bBansPa85===null},
    {ico:'⬡', lbl:'AppArmor — SITE01',   sub:'Confinement Apache2',      val:_aa.processes_confined||0,     col:'rgba(0,255,136,.75)',   ok:_aa.enforce===true,    na:_aa.available===false,  lbl2:_aa.available===true?(_aa.processes_confined||0)+' workers':null},
    {ico:'⬡', lbl:'ModSec — SITE01',     sub:'WAF OWASP CRS Apache',     val:_ms.attack_count||0,           col:'rgba(0,217,255,.75)',   ok:_ms.engine_on===true,  na:_ms.available===false,  lbl2:_ms.available===true?(_ms.engine_on===true?(_ms.blocking===true?'BLOCAGE':'DÉTECT'):'OFF'):null},
    {ico:'⬡', lbl:'AppArmor — SITE02',  sub:'Confinement Apache2',      val:_aap.processes_confined||0,    col:'rgba(0,255,136,.75)',   ok:_aap.enforce===true,   na:_aap.available===false, lbl2:_aap.available===true?(_aap.processes_confined||0)+' workers':null},
    {ico:'⬡', lbl:'ModSec — SITE02',    sub:'WAF OWASP CRS Apache',     val:_msp.attack_count||0,          col:'rgba(0,217,255,.75)',   ok:_msp.engine_on===true, na:_msp.available===false, lbl2:_msp.available===true?(_msp.engine_on===true?(_msp.blocking===true?'BLOCAGE':'DÉTECT'):'OFF'):null},
    {ico:'⬡', lbl:'AppArmor — nginx', sub:'Confinement workers nginx', val:_aan.processes_confined||0,   col:'rgba(0,255,136,.75)',   ok:_aan.enforce===true,   na:_aan.available===false, lbl2:_aan.available===true?(_aan.processes_confined||0)+' workers':null},
  ];
}
// NDT-26b — HTML d'une ligne couche de défense (barre + badge ACTIF/—)
function _sdRowHtml(l, maxVal){
  var valStr=l.na?'N/A':l.lbl2?l.lbl2:l.val>0?fmt(l.val):'0';
  var valCol=l.na?'rgba(122,154,184,0.3)':l.lbl2?l.col:l.val>0?l.col:'rgba(122,154,184,0.35)';
  return '<div style="display:flex;align-items:center;gap:.45rem;padding:.35rem .5rem;background:rgba(0,0,0,0.22);border:1px solid rgba(0,217,255,0.08);border-left:3px solid '+l.col+';border-radius:2px">'
   +'<span style="font-size:var(--fs-sm);color:'+l.col+';width:1rem;text-align:center;flex-shrink:0;text-shadow:0 0 7px '+l.col+'">'+l.ico+'</span>'
   +'<div style="flex:0 0 8.5rem;overflow:hidden">'
   +'<div style="font-size:var(--fs-xs);font-weight:700;color:var(--text);letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+l.lbl+'</div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+l.sub+'</div>'
   +'</div>'
   +_sdBar(l.val,l.col,maxVal)
   +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);font-weight:700;color:'+valCol+';min-width:3rem;text-align:right;flex-shrink:0">'+valStr+'</span>'
   +'<div style="min-width:3.2rem;text-align:right;flex-shrink:0">'+_sdBadge(l.ok)+'</div>'
   +'</div>';
}
function _renderStackDefense(d,g){
  var t=d.traffic||{}, ufw=d.ufw||{};
  var totalReq=t.total_requests||0;
  var legit=Math.max(0,totalReq-(ufw.blocked_total||0)-(t.geo_blocks||0));
  var layers=_sdBuildLayers(d);
  var maxVal=Math.max(totalReq,1);
  layers.forEach(function(l){if(l.val>maxVal)maxVal=l.val;});
  var rowsHtml='';
  layers.forEach(function(l){rowsHtml+=_sdRowHtml(l,maxVal);});
  var h='<div class="card wide"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◈</span>STACK DE DÉFENSE — IPS/IDS</div>'
   +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;padding:.38rem .6rem;background:rgba(0,217,255,.04);border:1px solid rgba(0,217,255,.18);border-left:3px solid rgba(0,217,255,.6);border-radius:2px">'
   +'<span style="font-size:var(--fs-xs);color:var(--cyan);text-transform:uppercase;letter-spacing:1.2px;font-weight:700">▸ INTERNET — Trafic entrant 24h</span>'
   +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-md);font-weight:700;color:var(--cyan);text-shadow:0 0 10px rgba(0,217,255,.5)">'+fmt(totalReq)+'<span style="font-size:var(--fs-xs);color:var(--muted);font-weight:400"> req</span></span>'
   +'</div>'
   +'<div style="display:flex;flex-direction:column;gap:.22rem">'+rowsHtml+'</div>'
   +'<div style="display:flex;align-items:center;justify-content:space-between;margin-top:.5rem;padding:.38rem .6rem;background:rgba(0,255,136,.04);border:1px solid rgba(0,255,136,.18);border-left:3px solid rgba(0,255,136,.6);border-radius:2px">'
   +'<span style="font-size:var(--fs-xs);color:var(--green);text-transform:uppercase;letter-spacing:1.2px;font-weight:700">✓ Trafic légitime admis</span>'
   +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-md);font-weight:700;color:var(--green);text-shadow:0 0 10px rgba(0,255,136,.45)">'+fmt(legit)+'<span style="font-size:var(--fs-xs);color:var(--muted);font-weight:400"> req</span></span>'
   +'</div>'
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}

function _paHostMini(label,jails,avail,stale){
  var hBan=avail?jails.reduce(function(a,j){return a+(j.cur_banned||0);},0):0;
  var lCol=!avail?'var(--muted)':hBan>0?'var(--red)':'var(--green)';
  var badge=!avail?'<span style="font-size:var(--fs-xs);color:var(--muted)">offline</span>'
    :stale?'<span style="font-size:var(--fs-xs);color:var(--amber)">⚠ stale</span>'
    :hBan>0?'<span style="font-size:var(--fs-xs);color:var(--red);font-weight:700">▸'+hBan+'</span>'
    :'<span style="font-size:var(--fs-xs);color:var(--green)">✓</span>';
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.14rem .3rem;border-bottom:1px solid rgba(255,255,255,.04)">'
    +'<span style="font-size:var(--fs-xs);color:'+lCol+';font-family:\'Courier New\',monospace;letter-spacing:.5px">'+label+'</span>'
    +badge+'</div>';
}

// NDT-21a — bannière alerte EXPLOIT/BRUTE (retourne '' si calme)
function _paAlertBanner(csStages){
  if(!((csStages.EXPLOIT||0)>0||(csStages.BRUTE||0)>0)) return '';
  var _aStage=(csStages.EXPLOIT||0)>0?'EXPLOIT':'BRUTE';
  var _aCnt=csStages[_aStage];
  var _aCol=_aStage==='EXPLOIT'?'#ff6b35':'var(--red)';
  var _aBg=_aStage==='EXPLOIT'?'rgba(255,107,53,.12)':'rgba(255,59,92,.12)';
  var _aBd=_aStage==='EXPLOIT'?'rgba(255,107,53,.4)':'rgba(255,59,92,.4)';
  return '<div style="display:flex;align-items:center;gap:.4rem;padding:.22rem .5rem;background:'+_aBg+';border:1px solid '+_aBd+';border-radius:3px;margin-bottom:.5rem;animation:blink 1.5s ease-in-out infinite">'
    +'<span style="color:'+_aCol+';font-size:var(--fs-xs);font-weight:900">⚠</span>'
    +'<span style="font-size:var(--fs-xs);color:'+_aCol+';font-weight:700;letter-spacing:.6px;text-transform:uppercase">'+_aStage+' ACTIF — '+_aCnt+' scénario'+(_aCnt>1?'s':'')+' détecté'+(_aCnt>1?'s':'')+'</span>'
    +'</div>';
}
// NDT-21b — panneau CrowdSec (titre inclus)
function _paCsPanel(cs, csStages){
  var STAGE_COL={'RECON':'var(--cyan)','SCAN':'var(--yellow)','EXPLOIT':'var(--orange)','BRUTE':'var(--red)'};
  var csBouncers=cs.bouncers||[], csBV=cs.ban_velocity||{}, csAppsec=cs.appsec||{}, csTrend=cs.alerts_trend||{};
  var csD=cs.active_decisions||0, csA=cs.alerts_24h||0;
  var csCol=csD>0?'var(--red)':'var(--green)';
  var csGlow=csD>0?'0 0 8px rgba(255,77,77,.6)':'0 0 6px rgba(0,255,136,.4)';
  var tDir=csTrend.dir||'stable', tPct=csTrend.pct||0;
  var tArrow=tDir==='up'?'↑':tDir==='down'?'↓':'→';
  var tCol=tDir==='up'?'var(--red)':tDir==='down'?'var(--green)':'rgba(122,154,184,.5)';
  var stagesMini=['RECON','SCAN','EXPLOIT','BRUTE'].map(function(s){
    var cnt=csStages[s]||0, col=cnt>0?STAGE_COL[s]:'rgba(122,154,184,.25)';
    return '<div style="text-align:center;flex:1"><div style="font-size:var(--fs-xs);color:'+col+';font-weight:700">'+cnt+'</div>'
      +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.4px">'+s+'</div></div>';
  }).join('');
  var bouncersMini=csBouncers.map(function(b){
    var isAppsec=b.name.indexOf('appsec')!==-1, bOk=isAppsec?csAppsec.active:b.healthy;
    var bShort=b.name.replace('crowdsec-firewall-bouncer-','').replace('crowdsec-','').replace('-bouncer','');
    return '<span style="font-size:var(--fs-xs);color:'+(bOk?'var(--green)':'var(--red)')+';margin-right:.3rem">● '+esc(bShort)+'</span>';
  }).join('');
  var inner=!cs.available
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);padding:.6rem 0;text-align:center">CrowdSec non disponible</div>'
    :'<div style="display:flex;align-items:baseline;gap:.3rem;flex-wrap:wrap;margin-bottom:.28rem">'
      +'<span style="font-size:var(--fs-3xl);font-weight:700;color:'+csCol+';text-shadow:'+csGlow+'">'+csD+'</span>'
      +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">décisions</span>'
      +'<span style="color:rgba(255,255,255,.1);margin:0 .2rem">·</span>'
      +'<span style="font-size:var(--fs-md);font-weight:700;color:var(--amber)">'+csA+'</span>'
      +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">alertes 24h</span>'
      +(csTrend.prev_24h!==undefined?'<span style="font-size:var(--fs-xs);color:'+tCol+';margin-left:.3rem">'+tArrow+' '+(tPct>0?'+':'')+tPct+'%</span>':'')
      +'</div>'
      +(csBV.last_1h!==undefined?'<div style="font-size:var(--fs-xs);color:'+(csBV.spike?'var(--red)':'rgba(122,154,184,.5)')+';margin-bottom:.28rem">Bans/h : <b>'+csBV.last_1h+'</b> · moy '+csBV.avg_per_h+'/h</div>':'')
      +(bouncersMini?'<div style="margin-bottom:.28rem">'+bouncersMini+'</div>':'')
      +'<div style="display:flex;gap:.2rem;margin-top:.28rem">'+stagesMini+'</div>';
  return '<div style="font-size:var(--fs-xs);color:var(--cyan);text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.35rem">⊛ CrowdSec IPS/IDS</div>'+inner;
}
// NDT-21c — panneau Fail2ban 4 hôtes (titre inclus)
function _paF2bPanel(f2b){
  var pvf2b=f2b.proxmox||{}, cltf2b=f2b.site01||{}, pa85f2b=f2b.site02||{};
  var _totBan=(f2b.total_banned||0)+(pvf2b.available?(pvf2b.total_banned||0):0)+(cltf2b.available?(cltf2b.total_banned||0):0)+(pa85f2b.available?(pa85f2b.total_banned||0):0);
  var _allJails=(f2b.jails||[]).length+(pvf2b.available?(pvf2b.jails||[]).length:0)+(cltf2b.available?(cltf2b.jails||[]).length:0)+(pa85f2b.available?(pa85f2b.jails||[]).length:0);
  var _activeJails=[f2b.jails||[],pvf2b.jails||[],cltf2b.jails||[],pa85f2b.jails||[]].reduce(function(a,arr){return a+arr.filter(function(j){return j.cur_banned>0;}).length;},0);
  var f2bCol=_totBan>0?'var(--red)':'var(--green)';
  var f2bGlow=_totBan>0?'0 0 8px rgba(255,77,77,.6)':'0 0 6px rgba(0,255,136,.4)';
  var inner=!(f2b.jails&&f2b.jails.length)
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);padding:.6rem 0;text-align:center">fail2ban non disponible</div>'
    :'<div style="display:flex;align-items:baseline;gap:.3rem;margin-bottom:.28rem">'
      +'<span style="font-size:var(--fs-3xl);font-weight:700;color:'+f2bCol+';text-shadow:'+f2bGlow+'">'+_totBan+'</span>'
      +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">IPs bannies</span>'
      +'</div>'
      +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.28rem">'+_activeJails+' jails actives · '+_allJails+' total · 4 hôtes</div>'
      +_paHostMini('SRV-NGIX',f2b.jails||[],true,false)
      +_paHostMini('PROXMOX',pvf2b.jails||[],pvf2b.available,pvf2b.stale)
      +_paHostMini('SITE01',cltf2b.jails||[],cltf2b.available,false)
      +_paHostMini('SITE02',pa85f2b.jails||[],pa85f2b.available,false);
  return '<div style="font-size:var(--fs-xs);color:var(--orange);text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.35rem">⊘ Fail2ban — 4 hôtes</div>'+inner;
}
function _renderProtectionActive(d,g){
  var cs=d.crowdsec||{}, csStages=cs.stage_counts||{};
  var h='<div class="card wide" id="prot-active-card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⊛</span>PROTECTION ACTIVE</div>'
   +_paAlertBanner(csStages)
   +'<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.6rem">'
   +'<div id="prot-cs-panel" style="padding:.5rem .6rem;background:rgba(0,0,0,.22);border:1px solid rgba(0,217,255,.1);border-left:3px solid rgba(0,217,255,.7);border-radius:2px;cursor:pointer">'+_paCsPanel(cs,csStages)+'</div>'
   +'<div id="prot-f2b-panel" style="padding:.5rem .6rem;background:rgba(0,0,0,.22);border:1px solid rgba(255,107,53,.1);border-left:3px solid rgba(255,107,53,.7);border-radius:2px;cursor:pointer">'+_paF2bPanel(d.fail2ban||{})+'</div>'
   +'</div></div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var _csP=document.getElementById('prot-cs-panel');
  if(_csP) _csP.addEventListener('click',function(){openCsModal(window._lastData&&window._lastData.crowdsec);});
  var _f2bP=document.getElementById('prot-f2b-panel');
  if(_f2bP) _f2bP.addEventListener('click',function(){openF2bModal(window._lastData&&window._lastData.fail2ban);});
}

// NDT-24a — panel "Bots automatisés" (nginx-botsearch/badbots + apache + WAF AppSec)
function _imBotsPanelHtml(botBan, botFail, appsecBlk){
  var col=botBan>10?'var(--red)':botBan>0?'var(--amber)':'var(--green)';
  return '<div style="padding:.45rem .55rem;background:rgba(0,0,0,.22);border:1px solid rgba(255,215,0,.1);border-left:3px solid rgba(255,215,0,.6);border-radius:2px">'
   +'<div style="font-size:var(--fs-xs);color:var(--amber);text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.32rem">⊙ Bots automatisés</div>'
   +'<div style="display:flex;align-items:baseline;gap:.25rem;margin-bottom:.22rem">'
   +'<span style="font-size:var(--fs-2xl);font-weight:700;color:'+col+'">'+botBan+'</span>'
   +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">bans actifs</span>'
   +'</div>'
   +(botFail>0?'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.18rem">'+fmt(botFail)+' tentatives bloquées</div>':'')
   +(appsecBlk>0?'<div style="font-size:var(--fs-xs);color:var(--amber);margin-bottom:.12rem">WAF AppSec : <b>'+appsecBlk+'</b> req filtrées</div>':'')
   +(!botBan&&!appsecBlk?'<div style="font-size:var(--fs-xs);color:var(--green)">✓ Aucun bot actif</div>':'')
   +'</div>';
}
// NDT-24b — panel "Scanners réseau" (RECON/SCAN KC + CS scénarios)
function _imScannersPanelHtml(scanActive, scanCs, topScanSc){
  var col=scanActive>5?'var(--orange)':scanActive>0?'var(--yellow)':'var(--green)';
  var scName=topScanSc?(topScanSc.name||'').replace(/^crowdsecurity\//i,'').replace(/^suricata-/i,'').replace(/_/g,'-'):'';
  return '<div style="padding:.45rem .55rem;background:rgba(0,0,0,.22);border:1px solid rgba(0,217,255,.08);border-left:3px solid rgba(0,217,255,.55);border-radius:2px">'
   +'<div style="font-size:var(--fs-xs);color:var(--cyan);text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.32rem">◎ Scanners réseau</div>'
   +'<div style="display:flex;align-items:baseline;gap:.25rem;margin-bottom:.22rem">'
   +'<span style="font-size:var(--fs-2xl);font-weight:700;color:'+col+'">'+scanActive+'</span>'
   +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">IPs actives</span>'
   +'</div>'
   +(scanCs>0?'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.18rem">'+scanCs+' scénario'+(scanCs>1?'s':'')+' CS RECON/SCAN</div>':'')
   +(topScanSc?'<div style="font-size:var(--fs-xs);color:var(--cyan);font-family:\'Courier New\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(scName.slice(0,28))+'</div>':'')
   +(!scanActive&&!scanCs?'<div style="font-size:var(--fs-xs);color:var(--green)">✓ Aucun scan actif</div>':'')
   +'</div>';
}
// NDT-24c — panel "Attaques ciblées" (EXPLOIT/BRUTE KC + CS + Suricata sév.1)
function _imExploitPanelHtml(exploitActive, exploitCs, surSev1, topExplSc){
  var col=exploitActive>0?'var(--red)':exploitCs>0?'var(--orange)':'var(--green)';
  var scName=topExplSc?(topExplSc.name||'').replace(/^crowdsecurity\//i,'').replace(/^suricata-/i,'').replace(/_/g,'-'):'';
  return '<div style="padding:.45rem .55rem;background:rgba(0,0,0,.22);border:1px solid rgba(255,107,53,.1);border-left:3px solid rgba(255,107,53,.7);border-radius:2px">'
   +'<div style="font-size:var(--fs-xs);color:#ff6b35;text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.32rem">◉ Attaques ciblées</div>'
   +'<div style="display:flex;align-items:baseline;gap:.25rem;margin-bottom:.22rem">'
   +'<span style="font-size:var(--fs-2xl);font-weight:700;color:'+col+'">'+exploitActive+'</span>'
   +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">IPs actives</span>'
   +'</div>'
   +(exploitCs>0?'<div style="font-size:var(--fs-xs);color:var(--red);margin-bottom:.18rem">⚡ '+exploitCs+' scénario'+(exploitCs>1?'s':'')+' CS EXPLOIT/BRUTE</div>':'')
   +(surSev1>0?'<div style="font-size:var(--fs-xs);color:var(--red);margin-bottom:.12rem">Suricata sév.1 : <b>'+surSev1+'</b> alerte'+(surSev1>1?'s critiques':'critique')+'</div>':'')
   +(topExplSc?'<div style="font-size:var(--fs-xs);color:#ff6b35;font-family:\'Courier New\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(scName.slice(0,28))+'</div>':'')
   +(!exploitActive&&!exploitCs&&!surSev1?'<div style="font-size:var(--fs-xs);color:var(--green)">✓ Aucune attaque ciblée</div>':'')
   +'</div>';
}
function _renderIntelMenaces(d,g){
  var f2b=d.fail2ban||{};
  var kc=d.kill_chain||{}, sc=kc.stage_counts||{};
  var cs=d.crowdsec||{}, csStages=cs.stage_counts||{}, csSc=cs.scenarios||[];
  var sur=d.suricata||{};
  var cltf2b=f2b.site01||{}, pa85f2b=f2b.site02||{};
  var BOT_NGINX=['nginx-botsearch','nginx-badbots'];
  var BOT_APACHE=['apache-badbots','apache-noscript'];
  var botBan=0, botFail=0;
  (f2b.jails||[]).forEach(function(j){
    if(BOT_NGINX.indexOf(j.jail)>=0){botBan+=(j.cur_banned||0);botFail+=(j.tot_failed||0);}
  });
  [cltf2b.jails||[], pa85f2b.jails||[]].forEach(function(jls){
    jls.forEach(function(j){
      if(BOT_APACHE.indexOf(j.jail)>=0){botBan+=(j.cur_banned||0);botFail+=(j.tot_failed||0);}
    });
  });
  var appsecBlk=(cs.appsec&&cs.appsec.blocked)||0;
  var scanActive=(sc.RECON||0)+(sc.SCAN||0);
  var scanCs=(csStages.RECON||0)+(csStages.SCAN||0);
  var topScanSc=csSc.filter(function(s){return s.stage==='RECON'||s.stage==='SCAN';})[0]||null;
  var exploitActive=(sc.EXPLOIT||0)+(sc.BRUTE||0);
  var exploitCs=(csStages.EXPLOIT||0)+(csStages.BRUTE||0);
  var surSev1=sur.sev1_critical||0;
  var topExplSc=csSc.filter(function(s){return s.stage==='EXPLOIT'||s.stage==='BRUTE';})[0]||null;
  var h='<div class="card wide"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◎</span>INTELLIGENCE MENACES</div>'
   +'<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:.6rem">'
   +_imBotsPanelHtml(botBan, botFail, appsecBlk)
   +_imScannersPanelHtml(scanActive, scanCs, topScanSc)
   +_imExploitPanelHtml(exploitActive, exploitCs, surSev1, topExplSc)
   +'</div></div></div>';
  g.insertAdjacentHTML('beforeend',h);
}

function _renderTopPages(d,g){
  var t=d.traffic||{};
  if(t.top_pages&&t.top_pages.length){
    var rowsHtml=t.top_pages.slice(0,8).map(function(e){
      var l=e[0].length>44?e[0].slice(0,41)+'...':e[0];
      return `<tr><td style="font-size:var(--fs-xs);color:var(--text)">${l}</td><td>${e[1]}</td></tr>`;
    }).join('');
    g.insertAdjacentHTML('beforeend',
      '<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
      +'<div class="ct"><span class="ct-icon">◇</span>TOP PAGES 24H</div>'
      +'<table><tr><th>URL</th><th>REQ</th></tr>'
      +rowsHtml
      +'</table></div></div>');
  }
}

function _renderTrafic24h(d,g){
  var t=d.traffic||{};
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct"><span class="ct-icon">◇</span>TRAFIC 24H</div>'
   +'<div class="stat-grid">'
   +'<div class="stat-box"><div class="sval">'+fmt(t.total_requests)+'</div><div class="slbl">Requetes</div></div>'
   +(t.unique_visitors!==undefined?'<div class="stat-box"><div class="sval" style="color:var(--cyan);text-shadow:0 0 10px var(--cyan)">'+fmt(t.unique_visitors)+'</div><div class="slbl">Visiteurs uniques</div></div>':'')
   +'<div class="stat-box"><div class="sval" style="color:var(--green);text-shadow:0 0 10px var(--green)">'+fmt(t.status_2xx)+'</div><div class="slbl">2xx OK</div></div>'
   +'<div class="stat-box"><div class="sval" style="color:var(--red);text-shadow:0 0 10px var(--red)">'+fmt(t.status_4xx+t.status_5xx)+'</div><div class="slbl">Erreurs</div></div>'
   +'<div class="stat-box"><div class="sval" style="color:var(--yellow)">'+fmt(t.status_3xx)+'</div><div class="slbl">3xx</div></div>'
   +'<div class="stat-box"><div class="sval" style="font-size:var(--fs-sm);color:var(--muted)">'+fmtB(t.total_bytes)+'</div><div class="slbl">Volume</div></div>'
   +'<div class="stat-box"><div class="sval" style="color:var(--muted)">'+fmt(t.bots)+'</div><div class="slbl">Bots</div></div>'
   +'</div>';
  var hours=Object.entries(t.requests_per_hour||{});
  var chartHtml='';
  if(hours.length){
    var mx=Math.max.apply(null,hours.map(function(hh){return hh[1]}))||1;
    var barsHtml=hours.map(function(hr){
      var ht=Math.round(hr[1]*46/mx)+2;
      return `<div class="bar-col"><div style="height:${ht}px" title="${hr[0]}: ${hr[1]}"></div></div>`;
    }).join('');
    chartHtml=`<div class="chart-wrap"><div class="chart-lbl">// Requetes / heure</div><div class="chart">${barsHtml}</div></div>`;
  }
  g.insertAdjacentHTML('beforeend',h+chartHtml+'</div></div>');
}

function _renderServices(d,g){
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◈</span>SERVICES</div>';
  var svcsHtml=Object.entries(d.services).map(function(e){
    var n=e[0],s=e[1],up=s.status==='UP';
    var msHtml=s.ms?`<span class="svc-ms">${s.ms}ms</span>`:'';
    return `<div class="svc"><span>${esc(n)}</span>`
      +`<span class="svc-r">${msHtml}`
      +`<span class="badge ${up?'up':'dn'}">${s.status}</span>`
      +`<span class="pulse ${up?'up':'dn'}"></span></span></div>`;
  }).join('');
  g.insertAdjacentHTML('beforeend',h+svcsHtml+'</div></div>');
}

function _renderRouteur(d,g){
  var th=buildRouterTile(window._routerData||null);
  g.insertAdjacentHTML('beforeend',th);
  _raf2(function(){
    var rtCard=document.getElementById('router-tile');
    if(rtCard) rtCard.onclick=function(){openRouterModal();};
    if(window._routerHistory&&window._routerHistory.length){
      var sk=document.getElementById('router-tile-spark');
      if(sk){
        var sv=window._routerHistory.slice(-30).map(function(e){return e.wan_rx_kbps||0;});
        drawNetSparkline(sk,sv,'0,217,255',Math.max.apply(null,sv)||1);
      }
    }
  });
}

function _renderJarvisTiles(d,g){
  var th='<div class="card wide" id="jv-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◈</span>JARVIS — INTELLIGENCE PROACTIVE</div>'
    +buildJarvisTileInner()
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',th);
  th='<div class="card" id="sec-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct" style="color:#ff9500"><span class="ct-icon">⚡</span>BLOCKLIST LLM — GARDE-FOU</div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(255,149,0,0.45);font-family:\'Courier New\',monospace;letter-spacing:.4px;margin-bottom:.45rem">Actions destructives bloquées générées par le LLM</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">'
    +'<span class="sec-badge" id="sec-badge">⬡ JARVIS OFFLINE</span>'
    +'</div>'
    +'<div class="sec-counters">'
    +'<span class="sec-cnt-h">Hard <b id="sec-cnt-h">—</b></span>'
    +'<span class="sec-cnt-a">Args <b id="sec-cnt-a">—</b></span>'
    +'<span class="sec-cnt-t">Terminal <b id="sec-cnt-t">—</b></span>'
    +'<span class="sec-total" id="sec-total">—</span>'
    +'</div>'
    +'<div id="sec-last-evt"><div class="sec-idle-lbl">En attente de JARVIS…</div></div>'
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',th);
  var tp='<div class="card" id="pro-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct" style="color:var(--green)"><span class="ct-icon">⬡</span>OPÉRATIONS PROACTIVES</div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(0,255,136,0.4);font-family:\'Courier New\',monospace;letter-spacing:.4px;margin-bottom:.45rem">Actions automatiques déclenchées par JARVIS sur srv-ngix</div>'
    +'<div style="margin-bottom:.5rem">'
    +'<span class="pro-badge pro-badge-offline" id="pro-badge">⬡ JARVIS OFFLINE</span>'
    +'</div>'
    +'<div class="pro-counters">'
    +'<span class="pro-cnt-ban">Ban-IP <b id="pro-cnt-ban">—</b></span>'
    +'<span class="pro-cnt-unban">Unban <b id="pro-cnt-unban">—</b></span>'
    +'<span class="pro-cnt-svc">Services <b id="pro-cnt-svc">—</b></span>'
    +'<span class="pro-total" id="pro-total">—</span>'
    +'</div>'
    +'<div id="pro-last-act"><div class="pro-idle-lbl">En attente de JARVIS…</div></div>'
    +'<div id="pro-caps" style="margin-top:.5rem;display:flex;flex-direction:column;gap:.18rem"></div>'
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',tp);
}

// NDT-27a — formatage débit Kbps → Mbps/Gbps (Freebox)
function _fbxFmtK(k){if(!k&&k!==0)return'—';var m=k/1000;return m>=1000?(m/1000).toFixed(1)+' Gbps':m>=1?m.toFixed(1)+' Mbps':k+' Kbps';}
// NDT-27b — formatage bps → Mbps/Kbps (SFP LAN)
function _fbxBps2s(b){if(!b)return'—';var m=b*8/1000;return m>=1000?(m/1000).toFixed(1)+' Mbps':Math.round(m)+' Kbps';}
// NDT-27c — mini-cellule probe (BOX/WAN/HTTP) → retourne HTML string
function _fbxProbeHtml(lbl,ok,ms){
  var c=ok?'var(--green)':'var(--red)';
  return '<div style="flex:1;padding:.25rem .35rem;background:rgba(0,0,0,0.2);border:1px solid '+c+'22;border-radius:3px;text-align:center">'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.1rem">'+lbl+'</div>'
   +'<div style="font-size:var(--fs-xs);font-weight:700;color:'+c+';font-family:\'Courier New\',monospace">'+(ms||'—')+'</div>'
   +'</div>';
}
// NDT-27d — carte erreur auth API Freebox → retourne HTML string
function _fbxAuthErrorHtml(authError){
  var errLbl={'no_token':'Token absent','invalid_token':'Token invalide — box réinitialisée ?','unreachable':'Freebox inaccessible','session_failed':'Échec session API'};
  var errDesc=errLbl[authError]||authError;
  return '<div class="card half fbx-auth-alert" id="fbx-tile" style="cursor:pointer">'
   +'<div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬡</span>FREEBOX DELTA — BOX &amp; WAN</div>'
   +'<div style="margin:.4rem 0;padding:.5rem .7rem;background:rgba(255,160,0,0.08);border:1px solid rgba(255,160,0,0.3);border-radius:4px">'
   +'<div style="font-size:var(--fs-xs);font-weight:700;color:rgba(255,160,0,0.9);margin-bottom:.25rem">⚠ AUTORISATION API REQUISE</div>'
   +'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.7)">'+errDesc+'</div>'
   +'</div>'
   +'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.5);margin:.3rem 0">Le token Freebox doit être regénéré.</div>'
   +'<div style="font-size:var(--fs-xs);color:rgba(255,160,0,0.65);cursor:pointer">▶ Voir la procédure de revalidation →</div>'
   +'</div></div>';
}
// NDT-27e — tuile principale Freebox (débit WAN/LAN + SFP + températures) → retourne HTML string
function _fbxMainTileHtml(wm, fbx){
  var wmSt=wm.status||'UP';
  var isDown=wmSt==='DOWN_ISP'||wmSt==='DOWN_LOCAL';
  var tileStyle=isDown?'border-color:rgba(255,50,50,0.4)':'';
  var stBcls=wmSt==='UP'?'fbx-up':wmSt==='DEGRADED'?'fbx-deg':'fbx-down';
  var stLbl={'UP':'STABLE','DOWN_ISP':'PANNE FAI','DOWN_LOCAL':'PANNE LOCALE','DEGRADED':'DÉGRADÉ'};
  var sfpQ=fbx.sfp_quality;
  var sfpCol=sfpQ==='FAIBLE'?'var(--red)':sfpQ==='CORRECT'?'var(--yellow)':sfpQ==='BON'?'var(--green)':'var(--cyan)';
  var sl=fbx.sfp_lan||null;
  var slCol=sl&&sl.link==='up'?'var(--green)':'var(--red)';
  var temps=fbx.temps||[];
  var tempMax=temps.length?Math.max.apply(null,temps.map(function(t){return t.value||0;})):null;
  var tempCol=tempMax===null?'var(--muted)':tempMax>70?'var(--red)':tempMax>55?'var(--yellow)':'var(--green)';
  var boxMs=wm.box&&wm.box.ms!=null?wm.box.ms+' ms':'—';
  var wanMs=wm.wan&&wm.wan.ms!=null?wm.wan.ms+' ms':'—';
  return '<div class="card half" id="fbx-tile" style="'+tileStyle+'">'
   +'<div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬡</span>FREEBOX DELTA — BOX &amp; WAN</div>'
   +'<div style="display:flex;align-items:center;gap:.5rem;margin:.25rem 0">'
   +'<span class="fbx-badge '+stBcls+'">'+(stLbl[wmSt]||wmSt)+'</span>'
   +(fbx.ipv4?'<span style="font-size:var(--fs-xs);color:var(--muted)">'+esc(fbx.ipv4)+'</span>':'')
   +'<span style="margin-left:auto;font-size:var(--fs-xs);color:rgba(0,217,255,0.45)">▶ détails</span>'
   +'</div>'
   +'<div style="display:flex;gap:.4rem;margin:.2rem 0">'
   +_fbxProbeHtml('BOX',wm.box&&wm.box.ok,boxMs)
   +_fbxProbeHtml('WAN',wm.wan&&wm.wan.ok,wanMs)
   +_fbxProbeHtml('HTTP',wm.http_ok,'OK')
   +'</div>'
   +'<div style="display:flex;gap:.4rem;margin:.2rem 0">'
   +'<div style="flex:2;padding:.28rem .4rem;background:'+(isDown?'rgba(255,50,50,0.06)':'rgba(0,217,255,0.05)')+';border:1px solid '+(isDown?'rgba(255,50,50,0.25)':'rgba(0,217,255,0.12)')+';border-radius:4px">'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.1rem">&#8595; DOWN</div>'
   +'<div style="font-size:var(--fs-sm);font-weight:700;color:'+(isDown?'var(--red)':'var(--cyan)')+';font-family:\'Courier New\',monospace">'+(isDown?'HORS LIGNE':_fbxFmtK(fbx.rate_down))+'</div>'
   +(!isDown&&fbx.bandwidth_down?'<div style="font-size:var(--fs-xs);color:rgba(0,217,255,0.3)">max '+_fbxFmtK(fbx.bandwidth_down)+'</div>':'')
   +'</div>'
   +'<div style="flex:1;padding:.28rem .4rem;background:'+(isDown?'rgba(255,50,50,0.06)':'rgba(0,255,136,0.05)')+';border:1px solid '+(isDown?'rgba(255,50,50,0.25)':'rgba(0,255,136,0.12)')+';border-radius:4px">'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.1rem">&#8593; UP</div>'
   +'<div style="font-size:var(--fs-sm);font-weight:700;color:'+(isDown?'var(--red)':'var(--green)')+';font-family:\'Courier New\',monospace">'+(isDown?'HORS LIGNE':_fbxFmtK(fbx.rate_up))+'</div>'
   +(!isDown&&fbx.bandwidth_up?'<div style="font-size:var(--fs-xs);color:rgba(0,255,136,0.3)">max '+_fbxFmtK(fbx.bandwidth_up)+'</div>':'')
   +'</div>'
   +'</div>'
   +'<div style="display:flex;gap:.4rem;margin:.2rem 0">'
   +(sl?'<div style="flex:2;padding:.25rem .4rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:3px">'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.1rem">⬡ SFP LAN DAC — Proxmox 10G</div>'
    +'<div style="display:flex;gap:.5rem;align-items:center">'
    +'<span style="font-size:var(--fs-xs);font-weight:700;color:'+slCol+'">'+(sl.link==='up'?'● UP':'● DOWN')+'</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--cyan)">&#8593;TX '+_fbxBps2s(sl.tx_bps)+'</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--green)">&#8595;RX '+_fbxBps2s(sl.rx_bps)+'</span>'
    +'<span style="font-size:var(--fs-xs);color:'+(sl.fcs_errors>0?'var(--red)':'rgba(255,255,255,0.2)')+';margin-left:auto">FCS:'+sl.fcs_errors+'</span>'
    +'</div></div>':'')
   +(fbx.sfp_pwr_rx!=null?'<div style="flex:1;padding:.25rem .4rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:3px">'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.1rem">Signal GPON RX</div>'
    +'<div style="font-size:var(--fs-xs);font-weight:700;color:'+sfpCol+';font-family:\'Courier New\',monospace">'+fbx.sfp_pwr_rx+' dBm</div>'
    +'<div style="font-size:var(--fs-xs);color:'+sfpCol+'">'+(sfpQ||'?')+'</div>'
    +'</div>':'')
   +(tempMax!=null?'<div style="flex:1;padding:.25rem .4rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:3px">'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.1rem">CPU max</div>'
    +'<div style="font-size:var(--fs-xs);font-weight:700;color:'+tempCol+';font-family:\'Courier New\',monospace">'+tempMax+' °C</div>'
    +'<div style="font-size:var(--fs-xs);color:'+tempCol+'">'+(tempMax>70?'CHAUD':tempMax>55?'TIÈDE':'NORMAL')+'</div>'
    +'</div>':'')
   +'</div>'
   +'</div></div>';
}
function _renderFreeboxPrepare(d){
  var wm=d.wan_monitor||{}, fbx=d.freebox||{};
  if(fbx.auth_error){
    window._fbxAuthError=fbx.auth_error;
    window._fbxPendingHtml=_fbxAuthErrorHtml(fbx.auth_error);
  } else if(fbx.available||Object.keys(wm).length){
    window._wanData=wm; window._fbxData=fbx;
    window._fbxPendingHtml=_fbxMainTileHtml(wm, fbx);
    window._fbxSparkVals=(wm.history||[]).map(function(e){return e.wan_ms!=null?e.wan_ms:0;});
  }
}

// NDT-32a — carte Système srv-ngix (CPU ring + load + uptime + TCP + RAM + disque) → retourne HTML string
function _sysCardHtml(sys){
  var mem=sys.memory||{}, disk=sys.disk||{}, load=sys.load||{};
  var cpu=sys.cpu_pct, cores=sys.cpu_cores;
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◈</span>SYSTEME — SRV-NGIX</div>';
  var cpuHtml='';
  if(cpu!==undefined){
    var cpuCol=cpu>85?'var(--red)':cpu>60?'var(--yellow)':'var(--cyan)';
    var loadHtml=load['1m']?`<div class="row"><span class="row-label">Load avg</span><span class="row-val hi">${load['1m']} / ${load['5m']} / ${load['15m']}</span></div>`:'';
    var uptimeHtml=sys.uptime?`<div class="row"><span class="row-label">Uptime</span><span class="row-val">${sys.uptime}</span></div>`:'';
    var tcpHtml=sys.tcp_established!==undefined?`<div class="row"><span class="row-label">TCP estab.</span><span class="row-val hi">${sys.tcp_established}</span></div>`:'';
    cpuHtml=`<div class="cpu-wrap"><div class="cpu-ring">${ring(cpu,cpuCol,60)}`
      +`<div class="ring-text"><span class="ring-pct" style="color:${cpuCol};text-shadow:0 0 10px ${cpuCol}">${cpu}%</span>`
      +`<span class="ring-core">${cores||'?'} CORE${cores>1?'S':''}</span></div></div>`
      +`<div style="flex:1">${loadHtml}${uptimeHtml}${tcpHtml}</div></div>`;
  }
  var ramHtml='';
  if(mem.pct!==undefined){
    var mc=mem.pct>85?'pb-r':mem.pct>60?'pb-y':'pb-c';
    ramHtml=`<div class="pb-row"><div class="pb-hdr"><span>RAM</span><span>${mem.used_mb} / ${mem.total_mb} Mo (${mem.pct}%)</span></div>`
      +`<div class="pb-track"><div class="pb ${mc}" style="width:${mem.pct}%"></div></div></div>`;
  }
  var diskHtml='';
  if(disk.pct!==undefined){
    var dc=disk.pct>85?'pb-r':disk.pct>60?'pb-y':'pb-g';
    diskHtml=`<div class="pb-row"><div class="pb-hdr"><span>Disque /var/www</span><span>${disk.used_gb} / ${disk.total_gb} Go (${disk.pct}%)</span></div>`
      +`<div class="pb-track"><div class="pb ${dc}" style="width:${disk.pct}%"></div></div></div>`;
  }
  return h+cpuHtml+ramHtml+diskHtml+'</div></div>';
}
// NDT-32b — carte Réseau srv-ngix (interfaces RX/TX) → retourne '' si aucune interface
function _netCardHtml(net){
  if(!net||!Object.keys(net).length)return '';
  var ifsHtml=Object.entries(net).map(function(e){
    return `<div class="net-if"><span class="net-name">${e[0]}</span>`
      +`<div class="net-vals"><div class="net-rx">&#8595; RX: ${fmtB(e[1].rx)}</div>`
      +`<div class="net-tx">&#8593; TX: ${fmtB(e[1].tx)}</div></div></div>`;
  }).join('');
  return '<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◇</span>RESEAU — SRV-NGIX</div>'
   +ifsHtml+'</div></div>';
}
function _renderSistemeReseau(d,g){
  var sys=d.system||{};
  g.insertAdjacentHTML('beforeend',_sysCardHtml(sys));
  var nc=_netCardHtml(sys.net); if(nc)g.insertAdjacentHTML('beforeend',nc);
}

// NDT-23a — table infrastructure SSH (hôtes + statut UP/DOWN + uptime)
function _sshInfraTableHtml(rows){
  var h='<table style="width:100%;border-collapse:collapse;font-size:var(--fs-xs);margin-top:.4rem">'
    +'<thead><tr>'
    +'<th style="text-align:left;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-size:var(--fs-xs);padding:.12rem .3rem .22rem 0">Hôte</th>'
    +'<th style="text-align:left;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-size:var(--fs-xs);padding:.12rem .3rem .22rem">IP</th>'
    +'<th style="text-align:center;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-size:var(--fs-xs);padding:.12rem .3rem .22rem">Statut</th>'
    +'<th style="text-align:right;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-size:var(--fs-xs);padding:.12rem 0 .22rem .3rem">Uptime</th>'
    +'</tr></thead><tbody>';
  var rowsHtml=rows.map(function(r){
    var up=r.status==='UP';
    var badge=up
      ?'<span style="background:rgba(0,200,80,.15);color:var(--green);border:1px solid rgba(0,200,80,.3);border-radius:3px;padding:.06rem .3rem;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px">UP</span>'
      :'<span style="background:rgba(220,50,50,.15);color:var(--red);border:1px solid rgba(220,50,50,.3);border-radius:3px;padding:.06rem .3rem;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px">DOWN</span>';
    var noteHtml=r.note?`<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.3);margin-left:.35rem;font-weight:400">${esc(r.note)}</span>`:'';
    return `<tr style="border-top:1px solid rgba(255,255,255,0.05)">`
      +`<td style="padding:.22rem .3rem .22rem 0;color:var(--text);font-weight:600;white-space:nowrap">${esc(r.name)}${noteHtml}</td>`
      +`<td style="padding:.22rem .3rem;color:var(--muted);font-size:var(--fs-xs);font-family:monospace">${esc(r.ip)}</td>`
      +`<td style="padding:.22rem .3rem;text-align:center">${badge}</td>`
      +`<td style="padding:.22rem 0 .22rem .3rem;text-align:right;color:var(--cyan);font-size:var(--fs-xs)">${esc(r.uptime||'—')}</td>`
      +'</tr>';
  }).join('');
  return h+rowsHtml+'</tbody></table>';
}
// NDT-23b — section surveillance SSH connexions 24h (accepted/failed/active_sessions/active_ips)
function _sshMonitorHtml(sshSt){
  if(!sshSt.length)return '';
  var machinesHtml=sshSt.map(function(m){
    var portOk=m.port_open;
    var bodyHtml;
    if(m.accepted_24h!==undefined){
      var failedHtml=m.failed_24h
        ?`<span class="ssh-stat"><span class="ssh-stat-icon" style="color:var(--red)">✗</span>`
          +`<span style="color:var(--red)">${m.failed_24h}</span>`
          +`<span style="color:var(--muted)">échouées</span></span>`
        :'';
      var sessPlur=m.active_sessions!==1?'s':'';
      var activeIpsHtml=m.active_ips&&m.active_ips.length
        ?`<div class="ssh-sessions">${m.active_ips.map(function(ip){return `<span class="ssh-ip-tag">${esc(ip)}</span>`;}).join('')}</div>`
        :'';
      bodyHtml=`<div class="ssh-stats">`
        +`<span class="ssh-stat"><span class="ssh-stat-icon" style="color:var(--green)">✓</span>`
        +`<span style="color:var(--green)">${m.accepted_24h}</span>`
        +`<span style="color:var(--muted)">connectés 24h</span></span>`
        +failedHtml
        +`<span class="ssh-stat"><span class="ssh-stat-icon" style="color:var(--cyan)">●</span>`
        +`<span style="color:var(--cyan)">${m.active_sessions}</span>`
        +`<span style="color:var(--muted)">session${sessPlur} active${sessPlur}</span></span>`
        +'</div>'
        +activeIpsHtml;
    } else {
      bodyHtml='<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:.2rem">clé SSH non configurée</div>';
    }
    return `<div class="ssh-machine">`
      +`<div class="ssh-top">`
      +`<div class="ssh-id"><div><div class="ssh-name">${esc(m.name)}</div><div class="ssh-ip">${esc(m.ip)}:${esc(m.port)}</div></div></div>`
      +`<span class="badge ${portOk?'up':'dn'}">${portOk?'OPEN':'CLOSED'}</span>`
      +'</div>'
      +bodyHtml
      +'</div>';
  }).join('');
  return '<div style="border-top:1px solid rgba(255,255,255,.07);margin:.65rem 0 .45rem;opacity:.4"></div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem">SURVEILLANCE SSH · CONNEXIONS 24H</div>'
    +machinesHtml;
}
function _renderSSH(d,g){
  var sshSt=d.ssh||[];
  var pveNode=((d.proxmox||{}).nodes||[])[0]||null;
  var ORDER=['site01','site02','srv-ngix'];
  var rows=ORDER.map(function(n){
    var h2=sshSt.find(function(x){return x.name===n;});
    if(!h2)return{name:n,ip:'?',status:'DOWN',uptime:'?'};
    return{name:h2.name,ip:h2.ip||'?',status:h2.port_open?'UP':'DOWN',uptime:h2.uptime||'?'};
  });
  if(pveNode){rows.push({name:'proxmox (pve)',ip:SOC_INFRA.PROXMOX,status:pveNode.status==='online'?'UP':'DOWN',uptime:pveNode.uptime||'?'});}
  var _rdSsh=window._routerData||null;
  var _rtUp=(_rdSsh&&_rdSsh.uptime_s)||0;
  var _rtUpStr=_rtUp>0?(Math.floor(_rtUp/86400)+'j '+String(Math.floor((_rtUp%86400)/3600)).padStart(2,'0')+'h '+String(Math.floor((_rtUp%3600)/60)).padStart(2,'0')+'m'):'—';
  rows.push({name:'gt-be98',ip:SOC_INFRA.ROUTER,status:(_rdSsh&&_rdSsh.available)?'UP':'DOWN',uptime:_rtUpStr,note:'SSH'});
  var h='<div class="card wide" id="ssh-status-card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">⬡</span>SSH — INFRASTRUCTURE · SURVEILLANCE</div>'
    +_sshInfraTableHtml(rows)
    +_sshMonitorHtml(sshSt)
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}

// NDT-20a — grid machines + badge MAJ
function _z5bMachinesHtml(upd){
  var uMachines=upd.machines||[];
  var uTotal=upd.total_count||0, uSec=upd.total_security||0;
  var uMainC=uSec>0?'255,60,60':uTotal>0?'255,160,0':'0,255,136';
  var uaStr='';
  if(upd.generated_at){var _ua=new Date(upd.generated_at);uaStr=_ua.getFullYear()+'-'+('0'+(_ua.getMonth()+1)).slice(-2)+'-'+('0'+_ua.getDate()).slice(-2)+' '+('0'+_ua.getHours()).slice(-2)+':'+('0'+_ua.getMinutes()).slice(-2);}
  var h='<div style="display:flex;align-items:center;gap:.5rem;font-size:var(--fs-xs);color:var(--muted);margin-bottom:.5rem;flex-wrap:wrap">'+uaStr
   +(uTotal===0
     ?'<span style="color:var(--green);margin-left:.4rem">✓ Tout est à jour</span>'
     :'<span style="color:rgba('+uMainC+',1);font-weight:700;margin-left:.4rem">⬆ '+uTotal+' paquet'+(uTotal>1?'s':'')+' en attente</span>'
      +(uSec>0?'<span style="background:rgba(255,60,60,0.15);color:var(--red);border:1px solid rgba(255,60,60,0.4);border-radius:1px;padding:.04rem .25rem;font-size:var(--fs-xs);letter-spacing:.4px">⚠ '+uSec+' SÉCU</span>':'')
    )
   +'</div>'
   +'<div style="display:grid;grid-template-columns:80px 1fr 48px 32px;gap:.1rem .4rem;font-size:var(--fs-xs);color:rgba(122,154,184,0.4);letter-spacing:.6px;padding:.0rem .4rem .18rem .65rem">'
   +'<span>MACHINE</span><span>RÔLE</span><span style="text-align:center">TYPE</span><span style="text-align:right">MÀJ</span></div>';
  var machinesHtml=uMachines.map(function(m){
    var mRgb=m.security_count>0?'255,60,60':m.count>0?'255,160,0':'0,255,136';
    var mV=m.security_count>0?'var(--red)':m.count>0?'var(--yellow)':'var(--green)';
    var borderCol=!m.reachable?'rgba(255,255,255,0.06)':`rgba(${mRgb},.65)`;
    var rowBg=m.security_count>0?';background:rgba(255,60,60,0.035)':m.count>0?';background:rgba(255,160,0,0.025)':'';
    var icon=!m.reachable?'?':m.security_count>0?'⚠':m.count>0?'↑':'✓';
    var nameCol=m.reachable?mV:'var(--muted)';
    var secBadge=m.security_count>0
      ?'<span style="text-align:center;font-size:var(--fs-xs);background:rgba(255,60,60,0.15);color:var(--red);border:1px solid rgba(255,60,60,0.4);border-radius:1px;padding:.03rem .08rem;letter-spacing:.3px">SEC</span>'
      :'<span></span>';
    return `<div style="display:grid;grid-template-columns:80px 1fr 48px 32px;gap:.1rem .4rem;padding:.3rem .4rem .3rem .65rem;border-top:1px solid rgba(255,255,255,0.04);border-left:3px solid ${borderCol};align-items:center${rowBg}">`
     +`<span style="color:${nameCol};font-family:'Courier New',monospace;font-size:var(--fs-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${icon} ${esc(m.name)}</span>`
     +`<span style="font-size:var(--fs-xs);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.role)}</span>`
     +secBadge
     +`<span style="text-align:right;font-size:var(--fs-sm);font-family:'Courier New',monospace;font-weight:700;color:${nameCol}">${m.reachable?m.count:'—'}</span>`
     +'</div>';
  }).join('');
  return h+machinesHtml;
}
// NDT-20b — panneau signatures sécu (CrowdSec hub, Suricata rules, GeoIP)
function _z5bAutoUpdateHtml(au){
  var items=[
    {k:'crowdsec_hub',   lbl:'CrowdSec hub'},
    {k:'suricata_rules', lbl:'Suricata rules'},
    {k:'geoip_country',  lbl:'GeoIP Country'},
    {k:'geoip_city',     lbl:'GeoIP City'},
  ];
  var itemsHtml=items.map(function(it){
    var itd=au[it.k]; if(!itd)return '';
    var stale=itd.stale===true;
    var age=itd.age_days!=null?Math.round(itd.age_days*10)/10:null;
    var col=stale?'var(--red)':'var(--green)';
    var ageHtml=age!=null
      ?`<span style="font-size:var(--fs-xs);font-family:'Courier New',monospace;color:${stale?'var(--red)':'rgba(122,154,184,0.5)'}">${age}j</span>`
      :'';
    return `<div style="display:flex;align-items:center;gap:.3rem;padding:.15rem 0;border-top:1px solid rgba(255,255,255,0.04)">`
      +`<span style="font-size:var(--fs-xs);color:${col};width:.8rem">${stale?'⚠':'✓'}</span>`
      +`<span style="font-size:var(--fs-xs);color:var(--muted);flex:1">${it.lbl}</span>`
      +ageHtml
      +'</div>';
  }).join('');
  if(!itemsHtml)return '';
  return '<div style="margin-top:.4rem;padding:.3rem .5rem;background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:2px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.12rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,0.4);text-transform:uppercase;letter-spacing:.6px">Signatures sécu</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,0.25);font-style:italic">dernière màj</span>'
    +'</div>'+itemsHtml+'</div>';
}
// NDT-20c — panneau TLS certs Let's Encrypt
function _z5bTlsHtml(tls){
  var items=Object.keys(tls).map(function(k){return tls[k];}).filter(function(e){return e&&e.days_left!=null;});
  if(!items.length)return '';
  var tlsItemsHtml=items.map(function(e){
    var col=e.critical?'var(--red)':e.warning?'var(--yellow)':'var(--green)';
    return `<div style="display:flex;align-items:center;gap:.3rem;padding:.15rem 0;border-top:1px solid rgba(255,255,255,0.04)">`
      +`<span style="font-size:var(--fs-xs);color:${col};width:.8rem">${e.critical?'🔴':e.warning?'⚠':'✓'}</span>`
      +`<span style="font-size:var(--fs-xs);color:var(--muted);flex:1">${esc(e.domain)}</span>`
      +`<span style="font-size:var(--fs-xs);font-family:'Courier New',monospace;color:${col}">${e.days_left}j</span>`
      +'</div>';
  }).join('');
  return '<div style="margin-top:.4rem;padding:.3rem .5rem;background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.06);border-radius:2px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.12rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,0.4);text-transform:uppercase;letter-spacing:.6px">TLS — certs Let\'s Encrypt</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,0.25);font-style:italic">expire dans</span>'
    +'</div>'+tlsItemsHtml+'</div>';
}
function _renderZone5B(d,g){
  var upd=d.updates||{};
  var uTotal=upd.total_count||0, uSec=upd.total_security||0;
  var uMainC=uSec>0?'255,60,60':uTotal>0?'255,160,0':'0,255,136';
  var h='<div class="card" id="upd-tile" style="cursor:pointer'+(uTotal>0?';border-color:rgba('+uMainC+',0.35)':'')+'"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬆</span>MISES À JOUR — INFRASTRUCTURE</div>'
   +_z5bMachinesHtml(upd)
   +_z5bAutoUpdateHtml(d.autoupdate||{})
   +_z5bTlsHtml(d.tls||{})
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var _ut=document.getElementById('upd-tile');
  if(_ut)_ut.addEventListener('click',function(){openUpdModal();});
}

function _renderProtoActifs(d,g){
  var t=d.traffic||{};
  if(!t.proto_breakdown||!Object.keys(t.proto_breakdown).length)return;
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct"><span class="ct-icon">◇</span>PROTOCOLES ACTIFS'
   +'<span class="live-badge">⬤ LIVE</span>'
   +'<span id="proto-rpm" style="margin-left:.6rem;font-size:var(--fs-xs);color:rgba(122,154,184,0.55);font-family:\'Courier New\',monospace">— req/min</span>'
   +'</div>'
   +'<div class="proto-donut-wrap">'
   +'<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(0,217,255,0.2);border-radius:3px;padding:.5rem;flex-shrink:0;display:inline-block"><canvas id="proto-donut" width="160" height="160" style="display:block"></canvas></div>'
   +buildProtoLegend(window._liveProto&&Object.keys(window._liveProto).length?window._liveProto:t.proto_breakdown)
   +'</div>'
   +buildProtoThreatGauge(window._liveProto&&Object.keys(window._liveProto).length?window._liveProto:t.proto_breakdown)
   +buildProtoTopThreats(window._liveProto&&Object.keys(window._liveProto).length?window._liveProto:t.proto_breakdown)
   +buildSuricataProtoBar((window._lastData&&window._lastData.suricata)||{})
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  _raf2(function(){
    var c=document.getElementById('proto-donut');
    if(!c)return;
    if(window._liveProto&&Object.keys(window._liveProto).length){
      drawProtocolDonut(c,window._liveProto,'REQ/5MIN');
    }else{
      drawProtocolDonut(c,t.proto_breakdown,'REQ/24H');
    }
  });
}

// NDT-22 — constantes module-level (évitent re-déclaration à chaque render)
var _FL_PROTO_META={
  'HTTP':         {col:'#f97316',lbl:'HTTP'},
  'HTTPS':        {col:'#00d9ff',lbl:'HTTPS'},
  'ASSETS':       {col:'#00ff88',lbl:'ASSETS'},
  'GEO_BLOCK':    {col:'#f97316',lbl:'GEO-BLOCK'},
  'CLOSED':       {col:'#ff3b5c',lbl:'CLOSED'},
  'HTTP_REDIRECT':{col:'#94a3b8',lbl:'REDIRECT'},
  'NOT_FOUND':    {col:'#bf5fff',lbl:'404'},
  'SCANNER':      {col:'#ef4444',lbl:'SCANNER'},
  'BOT':          {col:'#ffd700',lbl:'BOT'},
  'LEGIT_BOT':    {col:'#6ee7b7',lbl:'LEGIT BOT'},
  'OTHER':        {col:'#64748b',lbl:'AUTRE'},
};
var _FL_CS_META={col:'#ff3b5c',lbl:'⊛ CS BANS'};
// NDT-22a — barre horizontale animée (était une fonction imbriquée)
function _flLiveBar(val,col,maxV){
  var w=Math.max(1,Math.round(val*100/maxV));
  return '<div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;margin:0 .5rem">'
    +'<div id="lb-'+col.replace(/[^a-z0-9]/gi,'_')+'" style="width:0%;height:100%;background:'+col+';border-radius:3px;transition:width .7s cubic-bezier(.4,0,.2,1)" data-w="'+w+'"></div></div>';
}
// NDT-22b — lignes protocoles + ligne CS bans
function _flProtoRows(lproto,csBans){
  var protos=Object.entries(lproto).sort(function(a,b){return b[1]-a[1];});
  var maxVal=Math.max.apply(null,protos.map(function(e){return e[1];}).concat([csBans,1]));
  var protoRowsHtml=protos.map(function(e){
    var meta=_FL_PROTO_META[e[0]]||{col:'#64748b',lbl:e[0]};
    return `<div style="display:flex;align-items:center;gap:.3rem">`
      +`<span style="font-family:'Courier New',monospace;font-size:var(--fs-xs);color:${meta.col};min-width:5rem;font-weight:700">${meta.lbl}</span>`
      +_flLiveBar(e[1],meta.col,maxVal)
      +`<span style="font-family:'Courier New',monospace;font-size:var(--fs-xs);color:${meta.col};min-width:1.8rem;text-align:right;font-weight:700">${e[1]}</span>`
      +'</div>';
  }).join('');
  var csBanRowHtml=`<div style="display:flex;align-items:center;gap:.3rem;margin-top:.15rem;border-top:1px solid rgba(255,59,92,0.1);padding-top:.25rem">`
    +`<span style="font-family:'Courier New',monospace;font-size:var(--fs-xs);color:${_FL_CS_META.col};min-width:5rem;font-weight:700">${_FL_CS_META.lbl}</span>`
    +_flLiveBar(csBans,_FL_CS_META.col,maxVal)
    +`<span style="font-family:'Courier New',monospace;font-size:var(--fs-xs);color:${_FL_CS_META.col};min-width:1.8rem;text-align:right;font-weight:700">${csBans}</span>`
    +'</div>';
  return protoRowsHtml+csBanRowHtml;
}
// NDT-39 — compteur RPM animé (jauge + barre + total) → retourne HTML string
function _flRpmBlockHtml(rpm, total, win, rpmCol, rpmGlow){
  return '<div style="display:flex;align-items:center;gap:.8rem;padding:.4rem .5rem;background:rgba(0,0,0,0.3);border:1px solid rgba('+rpmGlow+',0.2);border-radius:3px;margin-bottom:.55rem">'
    +'<div style="text-align:center;min-width:3.5rem">'
    +'<div style="font-family:\'Courier New\',monospace;font-size:var(--fs-2xl);font-weight:700;color:'+rpmCol+';text-shadow:0 0 12px rgba('+rpmGlow+',0.6);line-height:1">'+rpm.toFixed(1)+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px">req / min</div>'
    +'</div>'
    +'<div style="flex:1">'
    +'<div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden">'
    +'<div id="rpm-bar" style="width:0%;height:100%;background:linear-gradient(90deg,rgba(0,217,255,.8),'+rpmCol+');border-radius:4px;transition:width .7s ease" data-w="'+Math.min(100,Math.round(rpm*3))+'"></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;margin-top:.2rem">'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">0</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">10</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">20</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--amber)">30+</span>'
    +'</div></div>'
    +'<div style="text-align:right;min-width:2.5rem">'
    +'<div style="font-family:\'Courier New\',monospace;font-size:var(--fs-sm);font-weight:700;color:var(--muted)">'+total+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);letter-spacing:.5px">req</div>'
    +'</div></div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.4);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.35rem;padding-right:2.2rem">◈ Flux entrant en cours — fenêtre glissante '+win+' min</div>';
}
function _renderFluxLive(d,g){
  var lp=window._liveProtoFull||{};
  var rpm=lp.rpm||0, total=lp.total||0, win=lp.window_min||5;
  var csBans=(d.crowdsec||{}).active_decisions||0;
  var rpmCol=rpm>30?'var(--red)':rpm>10?'var(--amber)':'var(--cyan)';
  var rpmGlow=rpm>30?'255,59,92':rpm>10?'245,158,11':'0,217,255';
  var h='<div class="card" id="flux-live-card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct" style="justify-content:space-between">'
    +'<span><span class="ct-icon">◈</span>FLUX LIVE</span>'
    +'<span style="display:flex;align-items:center;gap:.4rem;padding-right:1.8rem">'
    +'<span class="live-badge">● LIVE</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">fenêtre '+win+' min</span>'
    +'</span></div>'
    +_flRpmBlockHtml(rpm,total,win,rpmCol,rpmGlow)
    +'<div style="display:flex;flex-direction:column;gap:.25rem">'
    +_flProtoRows(window._liveProto||{},csBans)
    +'</div>'
    +'<div style="margin-top:.4rem;font-size:var(--fs-xs);color:rgba(122,154,184,0.3);text-align:right">⊛ CS BANS — nftables layer (hors nginx) · mis à jour toutes les 30s</div>'
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  requestAnimationFrame(function(){
    document.querySelectorAll('#flux-live-card [data-w]').forEach(function(el){
      el.style.width=el.getAttribute('data-w')+'%';
    });
  });
}

function _renderBandePassante(d,g){
  if(!d.net_history||d.net_history.length<1)return;
  var nh=d.net_history;
  var rxVals=nh.map(function(p){return p.rx||0});
  var txVals=nh.map(function(p){return p.tx||0});
  var maxRx=Math.max.apply(null,rxVals)||1;
  var maxTx=Math.max.apply(null,txVals)||1;
  var lastRx=rxVals[rxVals.length-1]||0;
  var lastTx=txVals[txVals.length-1]||0;
  _lfNetRx=rxVals; _lfNetTx=txVals; _lfMaxRx=maxRx; _lfMaxTx=maxTx;
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◇</span>BANDE PASSANTE nginx — 24H</div>'
   +'<div class="net-rates">'
   +'<div class="net-rate-item"><div class="net-rate-icon" style="color:var(--cyan)">&#8595;</div>'
   +'<div><div class="net-rate-val" style="color:var(--cyan)">'+fmtB(lastRx)+'/s</div><div class="net-rate-lbl">RX download</div></div></div>'
   +'<div class="net-rate-sep"></div>'
   +'<div class="net-rate-item" style="border-color:rgba(0,255,136,0.2)"><div class="net-rate-icon" style="color:var(--green)">&#8593;</div>'
   +'<div><div class="net-rate-val" style="color:var(--green)">'+fmtB(lastTx)+'/s</div><div class="net-rate-lbl">TX upload</div></div></div>'
   +'</div>'
   +'<div class="spark-wrap"><div class="spark-lbl"><span>&#8595; RX</span><span class="spark-max" style="color:var(--cyan)">'+fmtB(maxRx)+'/s max</span></div>'
   +'<canvas class="spark-canvas" data-key="rx" height="45"></canvas></div>'
   +'<div class="spark-wrap" style="margin-top:.5rem"><div class="spark-lbl"><span>&#8593; TX</span><span class="spark-max" style="color:var(--green)">'+fmtB(maxTx)+'/s max</span></div>'
   +'<canvas class="spark-canvas" data-key="tx" height="45"></canvas></div>'
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  _raf2(function(){
    var cRx=document.querySelector('.card [data-key="rx"]');
    var cTx=document.querySelector('.card [data-key="tx"]');
    if(cRx)drawNetSparkline(cRx,rxVals,'0,217,255',maxRx);
    if(cTx)drawNetSparkline(cTx,txVals,'0,255,136',maxTx);
  });
}

// ── NDT-17 : _renderKillChain data prep + stage grid HTML ────────────────────
// NDT-41a — enrichit kc.active_ips avec flags banned/sur_count + construit surMap depuis Suricata
function _kcEnrichIps(kc, d){
  var surCrit=((d.suricata||{}).recent_critical)||[];
  var surMap={};
  surCrit.forEach(function(a){
    if(!surMap[a.src_ip])surMap[a.src_ip]={cat:'',cve:''};
    if(!surMap[a.src_ip].cat&&a.category)surMap[a.src_ip].cat=a.category;
    if(!surMap[a.src_ip].cve){var m=(a.signature||'').match(/CVE-\d{4}-\d+/i);if(m)surMap[a.src_ip].cve=m[0].toUpperCase();}
  });
  var f2bBannedSet={};
  ((d.fail2ban||{}).jails||[]).forEach(function(j){
    (j.banned_ips||[]).forEach(function(e){if(e.ip)f2bBannedSet[e.ip]=true;});
  });
  var surIpSet={};
  var sur0=d.suricata||{};
  if(sur0.available){(sur0.top_ips||[]).forEach(function(e){surIpSet[e.ip]=e.count;});}
  kc.active_ips.forEach(function(ip){
    ip.banned=!!f2bBannedSet[ip.ip];
    if(surIpSet[ip.ip])ip.sur_count=surIpSet[ip.ip];
  });
  return surMap;
}
// NDT-41b — déclenche auto-ban sur IPs KC non bloquées avec conf≥2 (LAN exclu, cooldown 15min)
var _KC_LAN=/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/;
function _kcAutoBanCheck(kc){
  var now=Date.now(), cd=15*60*1000;
  var banned=window._kcAutoBanned=window._kcAutoBanned||{};
  kc.active_ips.forEach(function(ipObj){
    var ip=ipObj.ip||'';
    if(!ip||_KC_LAN.test(ip)||ipObj.cs_decision||ipObj.banned) return;
    if((1+(ipObj.sur_count?1:0))<2) return;
    if(banned[ip]&&(now-banned[ip])<cd) return;
    banned[ip]=now; _kcBanIP(ip,null);
  });
}
// NDT-41c — track firstSeen/escalades/stageEntered pour chaque IP active + purge inactives + localStorage
function _kcTrackStages(kc){
  if(!window._kcFirstSeen){
    try{window._kcFirstSeen=JSON.parse(localStorage.getItem(_LS_KEYS.KC_FIRST_SEEN)||'{}');}
    catch(e){window._kcFirstSeen={};}
  }
  window._kcPrevStages=window._kcPrevStages||{};
  window._kcEscalated=window._kcEscalated||{};
  window._kcStageEntered=window._kcStageEntered||{};
  var stOrd={RECON:0,SCAN:1,EXPLOIT:2,BRUTE:3,BLOCKED:4};
  var now=Date.now(), activeIpSet={};
  kc.active_ips.forEach(function(ipObj){
    var ip=ipObj.ip||''; if(!ip) return;
    activeIpSet[ip]=true;
    if(!window._kcFirstSeen[ip])window._kcFirstSeen[ip]=now;
    var cur=(ipObj.stage||'RECON').toUpperCase();
    var prev=window._kcPrevStages[ip];
    if(prev&&(stOrd[cur]||0)>(stOrd[prev]||0))
      window._kcEscalated[stOrd[prev]||0]={ts:now,from:prev,to:cur};
    window._kcPrevStages[ip]=cur;
    if(!window._kcStageEntered[ip])window._kcStageEntered[ip]={};
    if(!window._kcStageEntered[ip][cur])window._kcStageEntered[ip][cur]=now;
  });
  Object.keys(window._kcFirstSeen).forEach(function(ip){if(!activeIpSet[ip])delete window._kcFirstSeen[ip];});
  try{localStorage.setItem(_LS_KEYS.KC_FIRST_SEEN,JSON.stringify(window._kcFirstSeen));}catch(e){}
  Object.keys(window._kcPrevStages).forEach(function(ip){if(!activeIpSet[ip])delete window._kcPrevStages[ip];});
  Object.keys(window._kcStageEntered).forEach(function(ip){if(!activeIpSet[ip])delete window._kcStageEntered[ip];});
}
// NDT-41d — groupe IPs par stage + enrichit BLOCKED depuis F2B/CS non encore présents
function _kcBuildGrouped(kc, csDetail, f2bJails){
  var kcStages=[
    {id:'RECON',   label:'RECON',     color:'#bf5fff', step:'①'},
    {id:'SCAN',    label:'SCAN',      color:'#ff6b35', step:'②'},
    {id:'EXPLOIT', label:'EXPLOIT',   color:'#ffd700', step:'③'},
    {id:'BRUTE',   label:'BRUTE',     color:'#ff3b5c', step:'④'},
    {id:'BLOCKED', label:'NEUTRALISÉ',color:'#00ff88', step:'⑤'}
  ];
  var grouped={};
  kcStages.forEach(function(s){grouped[s.id]=[];});
  kc.active_ips.forEach(function(ip){
    var sid=(ip.stage||'RECON').toUpperCase();
    if(!grouped[sid])grouped[sid]=[];
    grouped[sid].push(ip);
  });
  var activeSet={}, blockedSet={};
  kc.active_ips.forEach(function(x){activeSet[x.ip]=true;});
  grouped['BLOCKED'].forEach(function(x){blockedSet[x.ip]=true;});
  var f2bMap={};
  f2bJails.forEach(function(j){
    (j.banned_ips||[]).forEach(function(e){if(e.ip)f2bMap[e.ip]={country:e.country||'-',jail:j.jail};});
  });
  Object.keys(f2bMap).forEach(function(ip){
    if(activeSet[ip]||blockedSet[ip])return;
    blockedSet[ip]=true;
    var e=f2bMap[ip];
    grouped['BLOCKED'].push({ip:ip,stage:'BLOCKED',count:1,country:e.country,cs_decision:!!csDetail[ip],sur_count:0,banned:true,_scenario:(csDetail[ip]||{}).scenario||''});
  });
  Object.keys(csDetail).forEach(function(ip){
    if(activeSet[ip]||blockedSet[ip])return;
    blockedSet[ip]=true;
    var info=csDetail[ip]||{};
    grouped['BLOCKED'].push({ip:ip,stage:'BLOCKED',count:1,country:info.country||'-',cs_decision:true,sur_count:0,banned:!!f2bMap[ip],_scenario:info.scenario||''});
  });
  var subnets={};
  kc.active_ips.forEach(function(ip){var p=ip.ip.split('.').slice(0,3).join('.');subnets[p]=(subnets[p]||0)+1;});
  return {stages:kcStages, grouped:grouped, subnets:subnets};
}
function _kcPrepareData(kc,d){
  var csDetail=(d.crowdsec||{}).decisions_detail||{};
  var f2bJails=(d.fail2ban||{}).jails||[];
  var surMap=_kcEnrichIps(kc,d);
  _kcAutoBanCheck(kc);
  _kcTrackStages(kc);
  var gb=_kcBuildGrouped(kc,csDetail,f2bJails);
  return {csDetail:csDetail, surMap:surMap, grouped:gb.grouped, stages:gb.stages, subnets:gb.subnets};
}
// NDT-42 — rendu d'une IP dans la grille KC (badges CS/IDS/CVE + confiance + cluster + typeLine) → retourne HTML string
function _kcIpCardHtml(ip, sc, csDetail, surMap, subnets){
  var csInfo=csDetail[ip.ip]||{};
  if(ip._scenario&&!csInfo.scenario)csInfo={scenario:ip._scenario};
  var surInfo=surMap[ip.ip]||{};
  var attackType=csInfo.scenario?_fmtScenario(csInfo.scenario):(surInfo.cat?_kcFmtCat(surInfo.cat).slice(0,22):'');
  var cve=surInfo.cve||'';
  var csBadge=ip.cs_decision?'<span style="font-size:var(--fs-xs);background:rgba(255,107,53,0.25);color:var(--orange);padding:.03rem .22rem;border-radius:2px;font-weight:700">⊛CS</span>':'';
  var surBadge=ip.sur_count?'<span style="font-size:var(--fs-xs);background:rgba(255,69,0,0.22);color:#ff6030;padding:.03rem .22rem;border-radius:2px;font-weight:700">◈IDS</span>':'';
  var cveBadge=cve?'<span style="font-size:var(--fs-xs);background:rgba(255,70,40,0.2);color:rgba(255,110,70,0.95);padding:.03rem .22rem;border-radius:2px;font-weight:700;border:1px solid rgba(255,70,40,0.3)">'+esc(cve)+'</span>':'';
  var typeLine=attackType?'<div style="font-size:var(--fs-xs);color:rgba(170,210,255,0.55);letter-spacing:.2px;margin-top:.07rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">▸ '+esc(attackType)+'</div>':'';
  var conf=1+(ip.cs_decision?1:0)+(ip.sur_count?1:0)+(ip.banned?1:0);
  var confCol=conf>=3?'var(--green)':conf>=2?'rgba(255,215,0,.88)':'rgba(255,140,50,.8)';
  var confBar='<div class="ckc-conf">';
  for(var ci=0;ci<4;ci++)confBar+='<div class="ckc-conf-pip" style="background:'+(ci<conf?confCol:'rgba(255,255,255,0.1)')+'"></div>';
  confBar+='</div>';
  var pfx=ip.ip.split('.').slice(0,3).join('.');
  var clusterBadge=(subnets[pfx]||0)>=2?'<span class="ckc-cluster">⚡/24</span>':'';
  return '<div class="ckc-ip ckc-ip-click '+sc+'" style="flex-direction:column;align-items:flex-start" title="'+esc(ip.ip)+' — '+esc(ip.stage)+' \u00d7'+ip.count+(attackType?' — '+esc(attackType):'')+' [cliquer pour investigation]" data-kc-ip="'+esc(ip.ip)+'">'
    +'<div style="display:flex;align-items:center;gap:.2rem;flex-wrap:wrap">'
    +(ip.country&&ip.country!=='-'?'<span style="opacity:.6;font-size:var(--fs-xs)">'+esc(ip.country)+'</span>':'')
    +'<span style="font-size:var(--fs-xs)">'+esc(ip.ip)+'</span>'
    +'<span style="opacity:.55;font-size:var(--fs-xs)">\u00d7'+ip.count+'</span>'
    +(_kcFmtAge(ip.ip)?'<span style="font-size:var(--fs-xs);color:rgba(180,200,255,.38);letter-spacing:.2px">\u23f1'+_kcFmtAge(ip.ip)+'</span>':'')
    +csBadge+surBadge+cveBadge+clusterBadge
    +'</div>'
    +typeLine+confBar
    +'</div>';
}
function _kcStageGridHtml(stages,grouped,subnets,surMap,csDetail){
  var pH='';
  stages.forEach(function(st){
    var ips=grouped[st.id]||[], sc=st.id.toLowerCase();
    pH+='<div class="ckc-stage-col">'
      +'<div class="ckc-stage-hdr" style="color:'+st.color+'"><span style="opacity:.55;margin-right:.25rem">'+st.step+'</span>'+st.label+'</div>'
      +'<div class="ckc-stage-ips">';
    if(!ips.length){
      pH+='<span class="ckc-stage-empty">—</span>';
    } else {
      ips.slice(0,8).forEach(function(ip){pH+=_kcIpCardHtml(ip,sc,csDetail,surMap,subnets);});
      if(ips.length>8)pH+='<span class="ckc-stage-more">+'+(ips.length-8)+' …</span>';
    }
    pH+='</div></div>';
  });
  return pH;
}
// NDT-38 — card statique Kill Chain (status dot + canvas + flow bar + grid placeholder) → retourne HTML string
function _kcCardHtml(kcActive, kcStatusHtml, kcKrHtml){
  var kcStatusCls=kcActive>0?'hot':'ok';
  return '<div class="card wide"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⛓</span>CYBER KILL CHAIN — ATTAQUES EN COURS<span class="live-badge">● LIVE</span></div>'
   +'<div class="ckc-status"><div class="ckc-dot '+kcStatusCls+'"></div>'
   +'<div class="ckc-stat">'+kcStatusHtml+'</div>'
   +'<span class="ckc-win">'+kcKrHtml+'nginx 15min + <span style="color:var(--orange)">⊛ CS 24h</span></span>'
   +'</div>'
   +'<div class="ckc-wrap"><canvas class="ckc-canvas" id="ckc-canvas" height="310"></canvas></div>'
   +'<div class="ckc-flow-bar"><span class="ckc-flow-label">PROGRESSION DE L\'ATTAQUE</span><div class="ckc-flow-arrow"></div><span class="ckc-flow-label" style="color:var(--green)">DÉFENSE</span></div>'
   +'<div class="ckc-stage-grid" id="ckc-ip-row"></div>'
   +'</div></div>';
}
function _renderKillChain(d,g){
  var kc=d.kill_chain||{};
  var kcActive=kc.total_active||0;
  var kcF2b=((d.fail2ban&&d.fail2ban.total_banned)||0)+((d.fail2ban&&d.fail2ban.proxmox&&d.fail2ban.proxmox.total_banned)||0);
  var kcCs=(d.crowdsec&&(d.crowdsec.active_decisions||d.crowdsec.decisions))||0;
  var kcNeutralized=kcF2b+kcCs;
  var kcKrTotal=kcActive+kcNeutralized;
  var kcKillRate=kcKrTotal>0?Math.round(kcNeutralized/kcKrTotal*100):0;
  var kcStatusHtml=kcActive>0
    ?'<b>'+kcActive+' IP(s)</b> en cours d\'analyse — fenêtre 15 min'
      +(kcNeutralized>0?' · <span style="color:var(--green);font-weight:700">'+kcNeutralized+' neutralisée'+(1!==kcNeutralized?'s':'')+'</span>':'')
    :'✓ Aucune activité hostile — calme radar';
  var kcKrHtml=kcKillRate>0
    ?'<span style="color:'+(kcKillRate>70?'var(--green)':kcKillRate>40?'var(--amber)':'var(--red)')+'">KILL RATE '+kcKillRate+'%</span> · '
    :'';
  g.insertAdjacentHTML('beforeend',_kcCardHtml(kcActive,kcStatusHtml,kcKrHtml));
  _raf2(function(){
    var kcCanvas=_dom('ckc-canvas'), ipsEl=_dom('ckc-ip-row');
    if(ipsEl){
      if(kc.active_ips&&kc.active_ips.length){
        var pd=_kcPrepareData(kc,d);
        _kcGroupedData=pd.grouped;
        ipsEl.innerHTML=_kcStageGridHtml(pd.stages,pd.grouped,pd.subnets,pd.surMap,pd.csDetail);
        ipsEl.addEventListener('click',function(e){
          var el=e.target.closest('[data-kc-ip]');
          if(el)_kcInvestigateIP(el.getAttribute('data-kc-ip'));
        });
      } else {
        ipsEl.innerHTML='<div style="width:100%;text-align:center;padding:.4rem 0;font-size:var(--fs-xs);color:var(--green);font-family:\'Courier New\',monospace">✓ Aucune IP hostile active dans les 15 dernières minutes</div>';
      }
    }
    if(kcCanvas)animateKillChain(kcCanvas,kc,d.fail2ban||{},d.crowdsec||{});
  });
}

// NDT-34 — carte GeoIP : stats + légende + widget carte (canvas + live feed + zone buttons) → retourne HTML string
function _geoCardHtml(geoips){
  var blocked=geoips.filter(function(g){return g.blocked;});
  var ctry={};
  blocked.forEach(function(g){ctry[g.country]=(ctry[g.country]||0)+g.count;});
  var topC=Object.keys(ctry).map(function(k){return{cc:k,n:ctry[k]};}).sort(function(a,b){return b.n-a.n;}).slice(0,3);
  var distinct=Object.keys(ctry).length;
  var rate=geoips.length?Math.round(blocked.length*100/geoips.length):0;
  var topStr=topC.map(function(e){return e.cc+' ('+e.n+')';}).join(' · ');
  var lbl=geoips.length?geoips.length+' IPs — '+distinct+' pays':'Aucune menace — surveillance active';
  return '<div class="card wide"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◉</span>GEOIP — CARTOGRAPHIE DES MENACES 24H</div>'
    +'<div class="map-wrap"><canvas class="map-canvas" id="geomap"></canvas>'
    +'<div class="threat-feed" id="threat-feed"><div class="threat-feed-hdr">&#9658; LIVE THREATS</div><ul class="threat-feed-list" id="threat-feed-list"></ul></div></div>'
    +'<div class="map-legend">'
    +'<button class="map-toggle-btn" id="map-lf-btn" title="Carte interactive zoomable (OSM)">&#127758; CARTE LIVE</button>'
    +'<span><span class="map-leg-dot" style="background:#ff3b5c;box-shadow:0 0 4px #ff3b5c"></span>BRUTE</span>'
    +'<span><span class="map-leg-dot" style="background:#ffd700;box-shadow:0 0 4px #ffd700"></span>EXPLOIT</span>'
    +'<span><span class="map-leg-dot" style="background:#ff6b35;box-shadow:0 0 4px #ff6b35"></span>SCAN</span>'
    +'<span><span class="map-leg-dot" style="background:#bf5fff;box-shadow:0 0 4px #bf5fff"></span>RECON</span>'
    +'<span><span class="map-leg-dot" style="background:var(--green);box-shadow:0 0 4px var(--green)"></span>FR</span>'
    +'<span><span class="map-leg-dot" style="background:var(--cyan);box-shadow:0 0 4px var(--cyan)"></span>Autre</span>'
    +'<span style="border-left:1px solid rgba(255,255,255,0.08);padding-left:.8rem;color:var(--red)">&#9658; '+blocked.length+' arcs · '+rate+'% bloqués</span>'
    +(topStr?'<span style="color:rgba(255,130,145,0.8)">⚡ '+topStr+'</span>':'')
    +'<span style="color:rgba(122,154,184,0.5);white-space:nowrap">'+lbl+'</span>'
    +'</div></div></div>';
}
function _renderGeoMap(d,g){
  var geoips=(d.traffic||{}).recent_geoips||[];
  _lfLastGeoips=geoips; _lfLastWanIp=d.wan_ip||null;
  if(_lfActive&&_lfMap)setTimeout(function(){
    if(!_lfActive||!_lfMap)return;
    _initLeafletMap(geoips);
    var rat=document.getElementById('lf-refresh-at');
    if(rat){var n=new Date();rat.textContent='↺ '+n.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  },200);
  g.insertAdjacentHTML('beforeend',_geoCardHtml(geoips));
  var _lfBtn=document.getElementById('map-lf-btn');
  if(_lfBtn)_lfBtn.addEventListener('click',function(){_toggleLeaflet(this);});
  _raf2(function(){
    drawGeoMap(_lfLastGeoips,null,d.wan_ip||null);
    updateThreatFeed(_lfLastGeoips);
    if(_lfActive&&_lfLoaded&&_lfMap)_buildLeafletMarkers(_lfLastGeoips||[]);
  });
}

// NDT-33a — bloc score menace + statut système + facteurs → retourne HTML string (sans wrapper card)
function _tsMenaceBlockHtml(ts, sys){
  var sysRgb=sys.label==='SAIN'?'0,217,100':sys.label==='SOUS PRESSION'?'255,107,53':sys.label==='DÉGRADÉ'?'255,215,0':'255,0,64';
  var h='<div class="threat-level-wrap">'
   +'<div class="threat-badge" style="color:'+ts.color+';border-color:'+ts.color+'55;text-shadow:0 0 18px '+ts.color+'">'+ts.level+'</div>'
   +'<div class="threat-bar-wrap">'
   +'<div style="font-size:var(--fs-xs);color:rgba(160,220,255,.45);margin-bottom:.2rem;letter-spacing:.5px">Intensité des attaques reçues</div>'
   +'<div class="threat-bar"><div class="threat-bar-fill" style="width:'+ts.score+'%;background:'+ts.color+';box-shadow:0 0 8px '+ts.color+'60"></div></div>'
   +'<div class="threat-score-pct">'+ts.score+' / 100</div>'
   +'</div></div>'
   +'<div style="display:flex;align-items:center;gap:.55rem;margin:.45rem 0 .35rem;padding:.38rem .65rem;background:rgba('+sysRgb+',.07);border:1px solid rgba('+sysRgb+',.3);border-radius:5px">'
   +'<span style="font-size:var(--fs-md);color:'+sys.color+'">'+sys.icon+'</span>'
   +'<div><div style="font-size:var(--fs-xs);font-weight:700;color:'+sys.color+';letter-spacing:1px">SYSTÈME : '+sys.label+'</div>'
   +'<div style="font-size:var(--fs-xs);color:rgba(160,220,255,.55);margin-top:.08rem">'+sys.sub+'</div>'
   +'</div></div>';
  var factorsHtml=ts.factors.length
    ?'<div class="threat-factors">'+ts.factors.map(function(f){return `<span class="threat-factor ${f.c}">▸ ${f.t}</span>`;}).join('')+'</div>'
    :'<div style="font-size:var(--fs-xs);color:var(--green);margin-top:.3rem">✓ Aucune menace active détectée</div>';
  return h+factorsHtml;
}
// NDT-33b — bloc routeur GT-BE98 (optionnel) → retourne '' si routerData absent
function _tsRouterBlockHtml(rd, fl){
  if(!rd||!rd.available)return '';
  var rs=computeRouterScore(rd,fl);
  var rsBg=rs.score>=70?'rgba(255,59,92,.07)':rs.score>=45?'rgba(255,107,53,.07)':rs.score>=20?'rgba(255,215,0,.06)':'rgba(0,217,100,.06)';
  var rsBorder=rs.score>=70?'rgba(255,59,92,.3)':rs.score>=45?'rgba(255,107,53,.25)':rs.score>=20?'rgba(255,215,0,.2)':'rgba(0,217,100,.2)';
  var h='<div style="margin-top:.55rem;padding:.45rem .6rem;background:'+rsBg+';border:1px solid '+rsBorder+';border-radius:5px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.5);text-transform:uppercase;letter-spacing:1px">◈ Réseau routeur GT-BE98</span>'
    +'<span style="font-size:var(--fs-xs);font-weight:700;color:'+rs.color+'">'+rs.level+'&nbsp;&nbsp;'+rs.score+' / 100</span>'
    +'</div>'
    +'<div style="background:rgba(255,255,255,.07);border-radius:2px;height:3px;margin-bottom:.3rem">'
    +'<div style="width:'+Math.min(100,rs.score)+'%;height:100%;background:'+rs.color+';border-radius:2px"></div>'
    +'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:.25rem">';
  var rFactorsHtml=rs.factors.map(function(f){
    var fC=f.c==='r'?'rgba(255,59,92,.85)':f.c==='y'?'rgba(255,215,0,.85)':'rgba(0,217,100,.7)';
    return `<span style="font-size:var(--fs-xs);color:${fC}">▸ ${f.t}</span>`;
  }).join('');
  return h+rFactorsHtml+'</div></div>';
}
function _renderThreatScore(d,g){
  var ts=_lastThreatResult||computeThreatScore(d);
  var sys=computeSystemStatus(d,ts);
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◉</span>NIVEAU DE MENACE GLOBAL</div>'
   +_tsMenaceBlockHtml(ts,sys)
   +_tsRouterBlockHtml(window._routerData||null,window._routerFlows||null)
   +'<div style="padding:.5rem .75rem .35rem;border-top:1px solid rgba(0,170,255,.08);margin-top:.4rem">'
   +'<button id="ts-xdr-btn" style="font:700 11px Courier New,monospace;letter-spacing:.08em;'
   +'border:1px solid rgba(0,217,255,.3);border-radius:3px;background:rgba(0,217,255,.06);'
   +'color:rgba(0,217,255,.75);padding:.2rem .75rem;cursor:pointer;transition:all .15s;white-space:nowrap;width:100%;">'
   +'◈ XDR CORRELATION ENGINE — détail</button>'
   +'</div>'
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var btn=document.getElementById('ts-xdr-btn');
  if(btn){
    btn.addEventListener('mouseover',function(){this.style.background='rgba(0,217,255,.14)';this.style.borderColor='rgba(0,217,255,.55)';});
    btn.addEventListener('mouseout', function(){this.style.background='rgba(0,217,255,.06)';this.style.borderColor='rgba(0,217,255,.3)';});
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(typeof window._xdrOpenModal==='function') window._xdrOpenModal(window._xdrLastData||window._lastData||{});
    });
  }
}

// NDT-18a — colonne droite : jauges CPU/RAM/DSK + sparklines réseau
function _rtRingHtml(cpu,mem,disk,hasNet,rtLRx,rtLTx){
  var rtCpuCol=cpu>85?'var(--red)':cpu>60?'var(--yellow)':'var(--cyan)';
  var rtMemCol=(mem.pct||0)>85?'var(--red)':(mem.pct||0)>60?'var(--yellow)':'var(--green)';
  var rtDskCol=(disk.pct||0)>85?'var(--red)':(disk.pct||0)>60?'var(--yellow)':'var(--green)';
  var ringPh='<div style="width:52px;height:52px;border:1px solid rgba(255,255,255,0.06);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:var(--fs-xs)">—</div>';
  var cpuRingHtml=cpu!==undefined
    ?'<div class="cpu-ring" style="width:52px;height:52px">'+ring(cpu,rtCpuCol,52)+'<div class="ring-text"><span class="ring-pct" style="font-size:var(--fs-xs);color:'+rtCpuCol+'">'+cpu+'%</span></div></div>'
    :ringPh;
  var memRingHtml=mem.pct!==undefined
    ?'<div class="cpu-ring" style="width:52px;height:52px">'+ring(mem.pct,rtMemCol,52)+'<div class="ring-text"><span class="ring-pct" style="font-size:var(--fs-xs);color:'+rtMemCol+'">'+mem.pct+'%</span></div></div>'
    :ringPh;
  var dskRingHtml=disk.pct!==undefined
    ?'<div class="cpu-ring" style="width:52px;height:52px">'+ring(disk.pct,rtDskCol,52)+'<div class="ring-text"><span class="ring-pct" style="font-size:var(--fs-xs);color:'+rtDskCol+'">'+disk.pct+'%</span></div></div>'
    :ringPh;
  var netSparkHtml=hasNet
    ?'<div class="rt-sp-mini">'
      +'<div class="spark-lbl"><span style="color:var(--cyan);font-size:var(--fs-xs)">↓ RX</span>'
      +' <span class="spark-max" style="color:var(--cyan)">'+fmtB(rtLRx)+'/s</span></div>'
      +'<canvas class="spark-canvas" id="rt-sp-rx" height="30"></canvas>'
      +'<div class="spark-lbl" style="margin-top:.3rem"><span style="color:var(--green);font-size:var(--fs-xs)">↑ TX</span>'
      +' <span class="spark-max" style="color:var(--green)">'+fmtB(rtLTx)+'/s</span></div>'
      +'<canvas class="spark-canvas" id="rt-sp-tx" height="30"></canvas>'
      +'</div>'
    :'';
  return '<div><div class="rt-rings">'
    +'<div class="rt-ring-item">'+cpuRingHtml+'<div class="rt-ring-lbl">CPU</div></div>'
    +'<div class="rt-ring-item">'+memRingHtml+'<div class="rt-ring-lbl">RAM</div></div>'
    +'<div class="rt-ring-item">'+dskRingHtml+'<div class="rt-ring-lbl">DSK</div></div>'
    +'</div>'+netSparkHtml+'</div>';
}
// NDT-18b — badges "pics d'attaque" horaires
function _rtTopAttackHtml(t){
  var _hmRph=t.requests_per_hour||{},_hmBph=t.blocks_per_hour||{},_hmEph=t.errors_per_hour||{};
  var _topHours=Object.keys(_hmRph).map(function(k){
    return{k:k,h:parseInt(k),blk:(_hmBph[k]||0)+(_hmEph[k]||0),req:_hmRph[k]||0};
  }).filter(function(x){return x.blk>0;}).sort(function(a,b){return b.blk-a.blk;}).slice(0,3);
  var badgesHtml=!_topHours.length
    ?'<span class="hm-top-badge none">✓ Aucune heure critique</span>'
    :_topHours.map(function(x){
      var rate=x.req?Math.round(x.blk*100/x.req):0;
      return '<span class="hm-top-badge">'
        +'<span style="color:var(--red);font-weight:700">'+x.h+'h</span>'
        +' <span style="color:var(--muted)">'+x.blk+' bloqués</span>'
        +(x.req?' <span style="color:rgba(255,59,92,0.55);font-size:var(--fs-xs)">('+rate+'%)</span>':'')
        +'</span>';
    }).join('');
  return '<div class="hm-top"><span class="hm-top-lbl">⚡ Pics attaque :</span>'+badgesHtml+'</div>';
}
// NDT-35 — carte Activité RT : courbe requêtes/blocages + rings + heatmap + légende → retourne HTML string
function _rtAreaCardHtml(t, cpu, mem, disk, rtMaxR, hasNet, rtLRx, rtLTx){
  return '<div class="card wide"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◈</span>ACTIVITÉ TEMPS RÉEL — COURBES 24H</div>'
   +'<div class="rt-layout"><div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Requêtes & Blocages — historique horaire</div>'
   +'<canvas class="rt-area-canvas" id="rt-area" height="170"></canvas>'
   +'<div style="display:flex;gap:1.2rem;margin-top:.35rem;font-size:var(--fs-xs);color:var(--muted);flex-wrap:wrap">'
   +'<span><span style="display:inline-block;width:18px;height:2px;background:rgba(0,217,255,0.9);vertical-align:middle;margin-right:.3rem;box-shadow:0 0 4px rgba(0,217,255,0.4)"></span>Requêtes légitimes</span>'
   +'<span><span style="display:inline-block;width:18px;height:2px;background:rgba(255,107,53,0.9);vertical-align:middle;margin-right:.3rem"></span>Blocages GeoIP+F2B</span>'
   +'<span style="margin-left:auto">pic '+fmt(rtMaxR)+' req/h</span>'
   +'</div></div>'
   +_rtRingHtml(cpu,mem,disk,hasNet,rtLRx,rtLTx)
   +'</div>'
   +'<div style="border-top:1px solid rgba(255,255,255,.07);margin:.7rem 0 .45rem;opacity:.5"></div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem">HEATMAP ATTAQUES · 24H</div>'
   +'<canvas class="heatmap-canvas" id="heatmap-canvas" height="82"></canvas>'
   +'<div class="heatmap-legend" style="flex-direction:column;gap:.4rem;margin-top:.5rem">'
   +'<div style="display:flex;gap:1.2rem;align-items:center">'
   +'<span><span class="heatmap-leg-c" style="background:rgba(0,217,255,0.55)"></span>'
   +'<strong style="color:rgba(0,217,255,0.9)">Requêtes</strong>'
   +' <span style="color:var(--muted)">— hits HTTP reçus (2xx · 3xx · 4xx)</span></span>'
   +'<span style="margin-left:auto;font-size:var(--fs-xs);color:var(--muted);white-space:nowrap">fenêtre glissante 24h</span>'
   +'</div>'
   +'<div style="display:flex;gap:1.2rem;align-items:center">'
   +'<span><span class="heatmap-leg-c" style="background:rgba(255,59,92,0.7)"></span>'
   +'<strong style="color:rgba(255,59,92,0.9)">Bloqués + Erreurs</strong>'
   +' <span style="color:var(--muted)">— GeoIP 403 · Fail2ban 444 · Rate-limit 429 · Serveur 5xx</span></span>'
   +'</div>'
   +'<div style="display:flex;gap:1rem;flex-wrap:wrap;padding-top:.3rem;border-top:1px solid rgba(255,255,255,0.05);font-size:var(--fs-xs)">'
   +'<span style="color:rgba(0,217,255,0.7)">⬡ Total : <strong>'+fmt(t.total_requests)+'</strong> req</span>'
   +'<span style="color:rgba(255,59,92,0.8)">⬡ Bloqués : <strong>'+(t.geo_blocks||0)+'</strong></span>'
   +'<span style="color:rgba(255,59,92,0.6)">⬡ Taux blocage : <strong>'+(t.total_requests?Math.round((t.geo_blocks||0)*100/t.total_requests*10)/10:0)+'%</strong></span>'
   +'<span style="color:rgba(255,100,100,0.7)">⬡ Erreurs 5xx : <strong>'+(t.status_5xx||0)+'</strong></span>'
   +'<span style="color:rgba(122,154,184,0.6)">⬡ Bots : <strong>'+(t.bots||0)+'</strong></span>'
   +'</div>'
   +_rtTopAttackHtml(t)
   +'</div></div></div>';
}
function _renderActiviteRT(d,g){
  var t=d.traffic||{}, sys=d.system||{};
  if(!(t.requests_per_hour&&Object.keys(t.requests_per_hour).length)) return;
  var rtKeys=Object.keys(t.requests_per_hour).sort();
  var rtRph=rtKeys.map(function(k){return t.requests_per_hour[k]||0;});
  var rtBph=rtKeys.map(function(k){return(t.blocks_per_hour||{})[k]||0;});
  var rtNh=d.net_history||[];
  var rtRxArr=rtNh.map(function(p){return p.rx||0;});
  var rtTxArr=rtNh.map(function(p){return p.tx||0;});
  var rtLRx=rtRxArr.length?rtRxArr[rtRxArr.length-1]:0;
  var rtLTx=rtTxArr.length?rtTxArr[rtTxArr.length-1]:0;
  var rtMRx=rtRxArr.length?Math.max.apply(null,rtRxArr)||1:1;
  var rtMTx=rtTxArr.length?Math.max.apply(null,rtTxArr)||1:1;
  g.insertAdjacentHTML('beforeend',_rtAreaCardHtml(t,sys.cpu_pct,sys.memory||{},sys.disk||{},Math.max.apply(null,rtRph)||1,rtRxArr.length>0,rtLRx,rtLTx));
  _raf2(function(){
    var rtA=document.getElementById('rt-area');
    if(rtA)drawReqCurve(rtA,rtRph,rtBph);
    if(rtRxArr.length){
      var spRx=document.getElementById('rt-sp-rx'),spTx=document.getElementById('rt-sp-tx');
      if(spRx)drawNetSparkline(spRx,rtRxArr,'0,217,255',rtMRx);
      if(spTx)drawNetSparkline(spTx,rtTxArr,'0,255,136',rtMTx);
    }
    var hc=document.getElementById('heatmap-canvas');
    if(hc)animateAttackHeatmap(hc,t.requests_per_hour||{},t.blocks_per_hour||{},t.errors_per_hour||{});
  });
}

function _winBkpAge(s){if(!s)return 999;return Math.floor((Date.now()-new Date(s.replace(' ','T')).getTime())/86400000);}
function _winBkpCol(a){return a>14?'var(--red)':a>6?'var(--yellow)':'var(--green)';}

function _renderWinTileResources(wd,g){
  var wdCpu=wd.cpu||{},wdRam=wd.ram||{};
  var cpuPct=wdCpu.usage||0,ramPct2=wdRam.pct||0;
  var cpuC2=cpuPct>80?'pb-r':cpuPct>60?'pb-y':'pb-g';
  var ramC2=ramPct2>80?'pb-r':ramPct2>60?'pb-y':'pb-g';
  var wdNet=wd.net||{}, wdDIO=wd.disk_io||{};
  var drives=wd.drives||[];
  var netHtml=(wdNet.up_mbs!==undefined?'<span>NET <span style="color:var(--green)">↑'+(wdNet.up_mbs||0)+' MB/s</span> <span style="color:var(--cyan)">↓'+(wdNet.dn_mbs||0)+' MB/s</span></span>':'')
    +(wdDIO.read_mbs!==undefined?'<span style="margin-left:.4rem">I/O <span style="color:var(--cyan)">R:'+(wdDIO.read_mbs||0)+'</span> <span style="color:var(--amber)">W:'+(wdDIO.write_mbs||0)+' MB/s</span></span>':'');
  var drivesHtml=drives.slice(0,3).map(function(dv){
    var dc=dv.pct>85?'pb-r':dv.pct>60?'pb-y':'pb-g';
    return '<div class="pb-row"><div class="pb-hdr"><span>'+esc(dv.letter)+':</span><span>'+dv.pct+'%</span></div>'
      +'<div class="pb-track"><div class="pb '+dc+'" style="width:'+dv.pct+'%"></div></div></div>';
  }).join('');
  var moreHtml=drives.length>3?'<div style="font-size:var(--fs-xs);color:var(--muted);text-align:right">+ '+(drives.length-3)+' disque(s)…</div>':'';
  var h='<div class="card" id="win-res-card" data-win-modal="res" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◫</span>RESSOURCES — WINDOWS</div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.35rem">'+esc(wd.updated||'')+(wd.uptime_win?'<span style="color:rgba(0,217,255,.45);margin-left:.6rem">⬆ '+esc(wd.uptime_win)+'</span>':'')+'</div>'
   +'<div class="pb-row"><div class="pb-hdr"><span>CPU '+(wdCpu.cores||'')+'t'+(wdCpu.freq_mhz?' · '+wdCpu.freq_mhz+' MHz':'')+'</span><span>'+cpuPct+'%'+(wdCpu.temp?' · '+wdCpu.temp+'°C':'')+'</span></div>'
   +'<div class="pb-track"><div class="pb '+cpuC2+'" style="width:'+cpuPct+'%"></div></div></div>'
   +'<div class="pb-row"><div class="pb-hdr"><span>RAM</span><span>'+ramPct2+'% · '+(wdRam.used_gb||0)+' / '+(wdRam.total_gb||0)+' Go</span></div>'
   +'<div class="pb-track"><div class="pb '+ramC2+'" style="width:'+ramPct2+'%"></div></div></div>'
   +'<div style="display:flex;gap:.4rem;flex-wrap:wrap;font-size:var(--fs-xs);color:var(--muted);margin:.28rem 0 .32rem;font-family:Courier New,monospace">'+netHtml+'</div>'
   +drivesHtml+moreHtml
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}
// NDT-36a — grille VMs backup (quota bar + tableau srv-ngix/site01/site02) → retourne HTML string
function _winBkpVmsGridHtml(wdb, wdAuto, wdManual, wd){
  var bkPct=wdb.pct||0, bkC2=bkPct>85?'pb-r':bkPct>60?'pb-y':'pb-g';
  var h='<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.45rem">'+esc(wd.updated||'')+'</div>'
   +'<div class="pb-row"><div class="pb-hdr"><span>Quota backup</span><span>'+(wdb.used_gb||0)+' / '+(wdb.quota_gb||300)+' Go ('+bkPct+'%)</span></div>'
   +'<div class="pb-track"><div class="pb '+bkC2+'" style="width:'+Math.min(bkPct,100)+'%"></div></div></div>'
   +'<div style="margin:.4rem 0">'
   +'<div style="display:grid;grid-template-columns:62px 1fr 32px 48px;gap:.15rem .3rem;font-size:var(--fs-xs);color:var(--muted);letter-spacing:.7px;margin-bottom:.18rem">'
   +'<span>VM</span><span>DERNIÈRE AUTO</span><span style="text-align:right">ÂGE</span><span style="text-align:right">TAILLE</span></div>';
  var vmsHtml=['srv-ngix','site01','site02'].map(function(vmn){
    var vauto=wdAuto[vmn]||{}, vman=wdManual[vmn]||{};
    var ageA=_winBkpAge(vauto.last_date), ageM=_winBkpAge(vman.last_date);
    var colA=_winBkpCol(ageA);
    var dateTxt=vauto.last_date?esc(vauto.last_date.substring(0,16)):'<span style="color:var(--red)">Aucune</span>';
    var ageTxt=vauto.last_date?(ageA===0?'auj.':ageA+'j'):'—';
    var sizeTxt=vauto.last_size_gb?(vauto.last_size_gb+' Go'):'—';
    var manDot=vman.last_date?('<span style="color:'+_winBkpCol(ageM)+'" title="Manuel '+esc(vman.last_date)+'">▪</span>'):'<span style="color:rgba(122,154,184,0.25)" title="Aucune sauvegarde manuelle">▪</span>';
    return '<div style="display:grid;grid-template-columns:62px 1fr 32px 48px;gap:.15rem .3rem;font-size:var(--fs-xs);padding:.22rem 0;border-top:1px solid rgba(255,255,255,0.05);align-items:center">'
      +'<span style="color:'+colA+';font-family:Courier New,monospace">● '+vmn+'</span>'
      +'<span style="color:var(--text)">'+dateTxt+' '+manDot+'</span>'
      +'<span style="text-align:right;color:'+colA+';font-weight:700">'+ageTxt+'</span>'
      +'<span style="text-align:right;color:var(--muted)">'+sizeTxt+'</span>'
      +'</div>';
  }).join('');
  return h+vmsHtml+'</div>';
}
// NDT-36b — ligne status cron Proxmox (état + dernier run + prochain) → retourne '' si aucun cron
function _winBkpCronRowHtml(crons){
  if(!crons.length)return '';
  var ct0=crons[0];
  var stCol=ct0.state==='Running'?'var(--cyan)':ct0.state==='Ready'?'var(--green)':'var(--red)';
  var lastRunTxt=ct0.last_run&&ct0.last_run!=='jamais'?esc(ct0.last_run.substring(0,16)):'jamais';
  var lastOkIcon=ct0.last_ok===false?'<span style="color:var(--red)"> ✗</span>':'<span style="color:var(--green)"> ✓</span>';
  var nextRunTxt=ct0.next_run?esc(ct0.next_run.substring(0,16)):'—';
  return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--fs-xs);margin-top:.25rem;padding-top:.28rem;border-top:1px solid rgba(255,255,255,0.05);white-space:nowrap;overflow:hidden;gap:.3rem">'
    +'<span style="flex:0 0 auto"><span style="color:var(--muted)">État : </span><span style="color:'+stCol+'">● '+esc(ct0.state)+'</span></span>'
    +'<span style="flex:0 0 auto"><span style="color:var(--muted)">Run : </span><span style="color:var(--text)">'+lastRunTxt+'</span>'+lastOkIcon+'</span>'
    +'<span style="flex:0 0 auto"><span style="color:var(--muted)">Prochain : </span><span style="color:var(--cyan)">'+nextRunTxt+'</span></span>'
    +'</div>';
}
function _renderWinTileBkp(wd,g){
  var wdb=wd.backup||{}, wdzones=wdb.zones||{};
  var h='<div class="card" id="win-bkp-card" data-win-modal="bkp" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◎</span>SAUVEGARDES — PROXMOX</div>'
   +_winBkpVmsGridHtml(wdb,wdzones.auto||{},wdzones.manual||{},wd)
   +_winBkpCronRowHtml(wd.cron||{})
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}
// NDT-37 — tuile GPU Windows (COMPUTE + VRAM + POWER + Fan/Clk) → retourne '' si wdGpu absent
function _gpuTileHtml(wdGpu){
  if(!wdGpu)return '';
  var gpuU=wdGpu.usage||0, gpuVP=wdGpu.vram_pct||0;
  var gpuVU=Math.round(wdGpu.vram_used_mb/1024*10)/10, gpuVT=Math.round(wdGpu.vram_total_mb/1024*10)/10;
  var gpuUC=gpuU>80?'pb-r':gpuU>60?'pb-y':'pb-g';
  var gpuVC=gpuVP>80?'pb-r':gpuVP>60?'pb-y':'pb-g';
  var h='<div class="card" id="win-gpu-card" data-gpu-modal="1" style="cursor:pointer;border-color:rgba(191,95,255,0.2)">'
   +'<div class="corner tl" style="border-color:rgba(191,95,255,0.4)"></div>'
   +'<div class="corner tr" style="border-color:rgba(191,95,255,0.4)"></div>'
   +'<div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬡</span>GPU — INTELLIGENCE ARTIFICIELLE</div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.35rem;font-family:Courier New,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc((wdGpu.name||'').substring(0,36))+'</div>'
   +'<div class="pb-row"><div class="pb-hdr"><span style="color:var(--purple)">COMPUTE</span><span>'+gpuU+'%'+(wdGpu.temp!=null?' · '+wdGpu.temp+'°C':'')+'</span></div>'
   +'<div class="pb-track"><div class="pb '+gpuUC+'" style="width:'+gpuU+'%;background:linear-gradient(90deg,rgba(100,0,200,.8),var(--purple))"></div></div></div>'
   +'<div class="pb-row"><div class="pb-hdr"><span style="color:var(--cyan)">VRAM</span><span>'+gpuVP+'% · '+gpuVU+'/'+gpuVT+' Go</span></div>'
   +'<div class="pb-track"><div class="pb '+gpuVC+'" style="width:'+gpuVP+'%"></div></div></div>';
  var gpuPC=wdGpu.power_pct!=null?(wdGpu.power_pct>85?'pb-r':wdGpu.power_pct>60?'pb-y':'pb-g'):'';
  var gpuPowerHtml=wdGpu.power_pct!=null
    ?'<div class="pb-row"><div class="pb-hdr"><span style="color:var(--amber)">POWER</span><span>'+(wdGpu.power_w||0)+'W / '+(wdGpu.power_limit_w||0)+'W ('+wdGpu.power_pct+'%)</span></div>'
      +'<div class="pb-track"><div class="pb '+gpuPC+'" style="width:'+Math.min(wdGpu.power_pct,100)+'%;background:linear-gradient(90deg,rgba(120,60,0,.8),var(--amber))"></div></div></div>'
    :'';
  var gpuFanClk='';
  if(wdGpu.fan_pct!=null)gpuFanClk+='<span style="color:var(--muted)">Fan <span style="color:var(--text)">'+wdGpu.fan_pct+'%</span></span>';
  if(wdGpu.clock_gpu_mhz!=null)gpuFanClk+='<span style="color:var(--muted)">Clk <span style="color:var(--purple)">'+wdGpu.clock_gpu_mhz+' MHz</span></span>';
  var fanClkHtml=gpuFanClk?'<div style="display:flex;gap:1rem;font-size:var(--fs-xs);margin-top:.2rem;padding-top:.25rem;border-top:1px solid rgba(255,255,255,0.05)">'+gpuFanClk+'</div>':'';
  return h+gpuPowerHtml+fanClkHtml+'</div></div>';
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
function _renderWinTileCrons(d,wd,g){
  var crons=d.crons||{};
  var cronJobs=crons.jobs||[];
  var winCrons=wd.cron||[];
  if(cronJobs.length||winCrons.length){
    var cronJobsHtml=cronJobs.length
      ?'<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--cyan);margin:.3rem 0 .2rem">SRV-NGIX</div>'
        +cronJobs.map(function(j){
          var col=j.ok?'var(--green)':'var(--red)';
          var icon=j.ok?'✓':'✗';
          var runTxt=j.last_run?esc(j.last_run.substring(5,16)):' —';
          return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:.2rem .5rem;font-size:var(--fs-xs);padding:.18rem 0;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center">'
            +'<span style="color:var(--text)">'+esc(j.label)+'</span>'
            +'<span style="color:var(--muted);font-size:var(--fs-xs);white-space:nowrap">'+runTxt+'</span>'
            +'<span style="color:'+col+';font-weight:700;text-align:right">'+icon+'</span>'
            +'</div>';
        }).join('')
      :'';
    var winCronsHtml=winCrons.length
      ?'<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--cyan);margin:.4rem 0 .2rem">WINDOWS</div>'
        +winCrons.map(function(ct){
          var stOk=ct.last_ok!==false;
          var col=ct.state==='Running'?'var(--cyan)':stOk?'var(--green)':'var(--red)';
          var icon=ct.state==='Running'?'↻':stOk?'✓':'✗';
          var runTxt=ct.last_run&&ct.last_run!=='jamais'?esc(ct.last_run.substring(5,16)):'—';
          var nextTxt=ct.next_run?esc(ct.next_run.substring(5,10)):'—';
          return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:.2rem .5rem;font-size:var(--fs-xs);padding:.18rem 0;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center">'
            +'<span style="color:var(--text)">'+esc(ct.name)+'</span>'
            +'<span style="color:var(--muted);font-size:var(--fs-xs);white-space:nowrap">'+runTxt+' → '+nextTxt+'</span>'
            +'<span style="color:'+col+';font-weight:700;text-align:right">'+icon+'</span>'
            +'</div>';
        }).join('')
      :'';
    var h='<div class="card half"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
     +'<div class="ct c"><span class="ct-icon">⊙</span>CRONS — INFRASTRUCTURE</div>'
     +cronJobsHtml+winCronsHtml
     +'</div></div>';
    g.insertAdjacentHTML('beforeend',h);
  }
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

// ── NDT-16 : _renderProxmox helpers ─────────────────────────────────────────
function _pveCpuSparkline(pveCpuHist){
  if(pveCpuHist.length<=1) return '';
  var pts=pveCpuHist.slice(-24);
  var maxC=Math.max.apply(null,pts.map(function(p){return p.cpu||0;}))||1;
  var W=100,H=18;
  var step=W/(pts.length-1);
  var poly=pts.map(function(p,i){return(i*step)+','+(H-Math.round((p.cpu||0)*H/Math.max(maxC,5)));}).join(' ');
  var lastCpu=pts[pts.length-1].cpu||0;
  var lastTemp=pts[pts.length-1].temp;
  var sc=lastCpu>85?'#ff4d4d':lastCpu>60?'#f59e0b':'#bf5fff';
  return '<div style="margin:.2rem 0 .35rem;padding:.2rem .3rem;background:rgba(0,0,0,0.2);border-radius:3px">'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:.1rem">'
    +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px">CPU 4h</span>'
    +'<span style="font-size:var(--fs-xs);color:'+sc+';font-weight:700">'+lastCpu+'%'+(lastTemp!=null?' · '+lastTemp+'°C':'')+'</span>'
    +'</div>'
    +'<svg width="100%" height="'+H+'px" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="display:block">'
    +'<polyline points="'+poly+'" fill="none" stroke="'+sc+'" stroke-width="1.2" stroke-linejoin="round"/>'
    +'</svg></div>';
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
// NDT-28a — en-tête nœud PVE : CPU ring + modèle + uptime + températures + compteur VMs + sparkline
function _prxNodeHeaderHtml(node, pveCpuHist){
  var nc=node.cpu_pct>85?'var(--red)':node.cpu_pct>60?'var(--yellow)':'var(--purple)';
  var running=node.vms.filter(function(v){return v.status==='running';}).length;
  var cpuTempC=node.cpu_temp!=null?(node.cpu_temp>85?'var(--red)':node.cpu_temp>70?'var(--yellow)':'var(--green)'):'var(--muted)';
  var nvmeTempC=node.nvme_temp!=null?(node.nvme_temp>70?'var(--red)':node.nvme_temp>55?'var(--yellow)':'var(--cyan)'):'var(--muted)';
  return '<div class="pve-node">'
    +'<div class="cpu-ring" style="width:52px;height:52px">'+ring(node.cpu_pct||0,nc,52)
    +'<div class="ring-text"><span class="ring-pct" style="font-size:var(--fs-xs);color:'+nc+';">'+(node.cpu_pct||0)+'%</span>'
    +'<span class="ring-core">CPU</span></div></div>'
    +'<div style="flex:1">'
    +'<div class="pve-node-name">'+esc(node.name)+'</div>'
    +(node.cpu_model?'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.55);margin:.05rem 0" title="'+esc(node.cpu_model)+'">'+esc(node.cpu_model.replace('12th Gen Intel(R) Core(TM) ','').substring(0,22))+'</div>':'')
    +(node.uptime&&node.uptime!=='?'?'<div style="font-size:var(--fs-xs);color:var(--muted)">uptime '+node.uptime+'</div>':'')
    +'<div style="display:flex;gap:.4rem;margin-top:.1rem">'
    +(node.cpu_cores?'<span style="font-size:var(--fs-xs);color:var(--muted)">'+node.cpu_cores+' threads</span>':'')
    +(node.cpu_temp!=null?'<span style="font-size:var(--fs-xs);color:var(--muted)">CPU <span style="color:'+cpuTempC+';font-weight:700">'+node.cpu_temp+'°C</span></span>':'')
    +(node.nvme_temp!=null?'<span style="font-size:var(--fs-xs);color:var(--muted)">NVMe <span style="color:'+nvmeTempC+'">'+node.nvme_temp+'°C</span></span>':'')
    +(node.acpi_temp!=null?'<span style="font-size:var(--fs-xs);color:var(--muted)">ACPI <span style="color:var(--muted)">'+node.acpi_temp+'°C</span></span>':'')
    +'</div>'
    +'</div>'
    +'<div class="pve-counters">'+running+'/'+node.vms.length+' actifs</div>'
    +'</div>'
    +_pveCpuSparkline(pveCpuHist);
}
// NDT-28b — barres ressources PVE : mini-sboxes + progress bars RAM/Swap/rootfs/stockages + services
// NDT-43a — mini-sboxes PVE : RAM + Swap (optionnel) + rootfs (optionnel) → retourne HTML string
function _prxSboxesHtml(node){
  var mC=node.mem_pct>85?'var(--red)':node.mem_pct>60?'var(--yellow)':'var(--purple)';
  var sC=node.swap_pct>85?'var(--red)':node.swap_pct>60?'var(--yellow)':'var(--cyan)';
  var rC=node.rootfs_pct>85?'var(--red)':node.rootfs_pct>60?'var(--yellow)':'var(--yellow)';
  var memSboxHtml=node.mem_pct!==undefined
    ?'<div class="pve-sbox"><div class="pve-sbox-val" style="color:'+mC+'">'+node.mem_pct+'%</div>'
      +'<div class="pve-sbox-lbl">RAM · '+fmtMb(node.mem_used_mb)+'/'+fmtMb(node.mem_total_mb)+'</div>'
      +'<div class="pve-sbox-bar" style="width:'+node.mem_pct+'%;background:'+mC+'"></div></div>'
    :'';
  var swapSboxHtml=node.swap_total_mb>0
    ?'<div class="pve-sbox"><div class="pve-sbox-val" style="color:'+sC+'">'+node.swap_pct+'%</div>'
      +'<div class="pve-sbox-lbl">Swap · '+fmtMb(node.swap_used_mb)+'/'+fmtMb(node.swap_total_mb)+'</div>'
      +'<div class="pve-sbox-bar" style="width:'+node.swap_pct+'%;background:'+sC+'"></div></div>'
    :'';
  var rootfsSboxHtml=node.rootfs_total_gb>0
    ?'<div class="pve-sbox"><div class="pve-sbox-val" style="color:'+rC+'">'+node.rootfs_pct+'%</div>'
      +'<div class="pve-sbox-lbl">rootfs · '+node.rootfs_used_gb+'/'+node.rootfs_total_gb+'Go</div>'
      +'<div class="pve-sbox-bar" style="width:'+node.rootfs_pct+'%;background:'+rC+'"></div></div>'
    :'';
  return '<div class="pve-srow">'+memSboxHtml+swapSboxHtml+rootfsSboxHtml+'</div>';
}
// NDT-43b — barres progress PVE (RAM/Swap/rootfs) + stockages + badges services → retourne HTML string
function _prxProgressBarsHtml(node){
  var mpc=node.mem_pct>85?'pb-r':node.mem_pct>60?'pb-y':'pb-p';
  var memHtml=node.mem_pct!==undefined
    ?'<div class="pb-row"><div class="pb-hdr"><span>RAM</span><span>'+fmtMb(node.mem_used_mb)+' / '+fmtMb(node.mem_total_mb)+' ('+node.mem_pct+'%)</span></div>'
      +'<div class="pb-track"><div class="pb '+mpc+'" style="width:'+node.mem_pct+'%"></div></div></div>'
    :'';
  var spc=node.swap_pct>85?'pb-r':node.swap_pct>60?'pb-y':'pb-c';
  var swapHtml=node.swap_total_mb>0
    ?'<div class="pb-row"><div class="pb-hdr"><span>Swap</span><span>'+fmtMb(node.swap_used_mb)+' / '+fmtMb(node.swap_total_mb)+' ('+node.swap_pct+'%)</span></div>'
      +'<div class="pb-track"><div class="pb '+spc+'" style="width:'+node.swap_pct+'%"></div></div></div>'
    :'';
  var rootfsHtml=node.rootfs_total_gb>0
    ?'<div class="pb-row"><div class="pb-hdr"><span>rootfs</span><span>'+node.rootfs_used_gb+' / '+node.rootfs_total_gb+' Go ('+node.rootfs_pct+'%)</span></div>'
      +'<div class="pb-track"><div class="pb pb-y" style="width:'+node.rootfs_pct+'%"></div></div></div>'
    :'';
  var storagesHtml=node.storages&&node.storages.length
    ?'<div class="prx-section-title">// Stockage</div>'
      +node.storages.map(function(st){
        var sc=st.pct>85?'pb-r':st.pct>60?'pb-y':'pb-g';
        return '<div class="pb-row"><div class="pb-hdr"><span>'+esc(st.name)+' <span style="color:var(--muted);font-size:var(--fs-xs)">('+esc(st.type)+')</span></span>'
          +'<span>'+st.used_gb+' / '+st.total_gb+' Go ('+st.pct+'%)</span></div>'
          +'<div class="pb-track"><div class="pb '+sc+'" style="width:'+st.pct+'%"></div></div></div>';
      }).join('')
    :'';
  var svcsHtml=node.services&&node.services.length
    ?'<div class="prx-section-title">// Services</div><div class="svc-badges">'
      +node.services.map(function(svc){return '<span class="badge '+(svc.state==='running'?'up':'dn')+'">'+esc(svc.name)+'</span>';}).join('')
      +'</div>'
    :'';
  return memHtml+swapHtml+rootfsHtml+storagesHtml+svcsHtml;
}
function _prxNodeResourceBarsHtml(node){
  return _prxSboxesHtml(node)+_prxProgressBarsHtml(node);
}
function _renderProxmoxNode(prx,d,g){
  var f2b=d.fail2ban||{};
  var prxFw=(d.firewall_matrix&&d.firewall_matrix.hosts||[]).find(function(h){return h.name==='proxmox';})||{};
  var prxF2b=f2b.proxmox||{};
  var prxF2bBan=prxF2b.available?(prxF2b.total_banned||0):null;
  var pveCpuHist=d.pve_cpu_history||[];
  var bodyHtml;
  if(prx.error){
    bodyHtml='<div style="color:var(--red);font-size:var(--fs-sm)">&#9888; '+prx.error+'</div>';
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
   +'<div class="ct c"><span class="ct-icon">◈</span>PROXMOX VE — '+SOC_INFRA.PROXMOX+'</div>'
   +bodyHtml
   +_pveNodeCountermeasures(prxFw,prxF2bBan)
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  document.getElementById('prx-node-card').addEventListener('click',function(){
    if(window._lastData)openProxmoxModal(window._lastData);
  });
}
// NDT-40a — barre résumé VMs (Running / Stopped / Total) → retourne HTML string
function _pvmSummaryHtml(allVms){
  var vmRun=allVms.filter(function(v){return v.status==='running';}).length;
  return '<div class="pve-vm-summary">'
    +'<div class="pve-vm-s"><div class="pve-vm-s-val" style="color:var(--green)">'+vmRun+'</div><div class="pve-vm-s-lbl">Running</div></div>'
    +'<div class="pve-vm-s"><div class="pve-vm-s-val" style="color:var(--red)">'+(allVms.length-vmRun)+'</div><div class="pve-vm-s-lbl">Stopped</div></div>'
    +'<div class="pve-vm-s"><div class="pve-vm-s-val" style="color:var(--purple)">'+allVms.length+'</div><div class="pve-vm-s-lbl">Total</div></div>'
    +'</div>';
}
// NDT-40b — carte d'une VM (header type+nom+id+badge + barres CPU/RAM si running) → retourne HTML string
function _pvmVmRowHtml(vm){
  var run=vm.status==='running';
  var cpuPct=vm.cpu!==null&&vm.cpu!==undefined?vm.cpu:0;
  var memPct=vm.mem_pct!==undefined?vm.mem_pct:(vm.maxmem>0?Math.round(vm.mem*100/vm.maxmem):0);
  var cpuColor=cpuPct>85?'var(--red)':cpuPct>60?'var(--yellow)':'var(--cyan)';
  var ramColor=memPct>85?'var(--red)':memPct>60?'var(--yellow)':'var(--green)';
  var vm2BarsHtml=run
    ?'<div class="vm2-bars">'
      +'<div class="vm2-bar"><div class="vm2-bar-lbl"><span style="color:var(--muted)">CPU</span><span style="color:'+cpuColor+'">'+cpuPct.toFixed(1)+'%</span></div>'
      +'<div class="vm2-bar-track"><div class="vm2-bar-fill" style="width:'+Math.min(cpuPct,100)+'%;background:'+cpuColor+'"></div></div></div>'
      +'<div class="vm2-bar"><div class="vm2-bar-lbl"><span style="color:var(--muted)">RAM</span><span style="color:'+ramColor+'">'+memPct.toFixed(1)+'%</span></div>'
      +'<div class="vm2-bar-track"><div class="vm2-bar-fill" style="width:'+Math.min(memPct,100)+'%;background:'+ramColor+'"></div></div></div>'
      +'</div>'
    :'';
  return '<div class="vm2-card '+(run?'running':'stopped')+'">'
    +'<div class="vm2-hdr">'
    +'<span class="vm-type '+vm.type+'">'+vm.type+'</span>'
    +'<span class="vm2-name">'+esc(vm.name)+'</span>'
    +'<span class="vm2-id">#'+vm.id+'</span>'
    +'<span class="badge '+(run?'run':'stop')+'">'+(run?'RUN':'STOP')+'</span>'
    +'</div>'
    +vm2BarsHtml+'</div>';
}
function _renderProxmoxVms(prx,g){
  var vmsBodyHtml='';
  if(prx.nodes){
    var allVms=[];
    prx.nodes.forEach(function(n){(n.vms||[]).forEach(function(v){allVms.push(v);});});
    vmsBodyHtml=_pvmSummaryHtml(allVms)+allVms.map(_pvmVmRowHtml).join('');
  }
  var h='<div class="card half"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⊞</span>MACHINES VIRTUELLES</div>'
   +vmsBodyHtml+'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}
function _renderProxmox(d,g){
  var prx=d.proxmox||{};
  if(prx.configured!==false){
    _renderProxmoxNode(prx,d,g);
    _renderProxmoxVms(prx,g);
  }
}

function render(d){
  window._lastData=d;
  var t=d.traffic||{};
  window._lastTraffic=t;

  _renderHUD(d);

  if(_kcAnimFrame){cancelAnimationFrame(_kcAnimFrame);_kcAnimFrame=null;}
  var g=_dom('grid');g.innerHTML='';

  // ══ HERO — MENACES EN COURS (toujours en tête) ══

  // ── KILL CHAIN ──
  _renderKillChain(d,g);
  // ── GEOIP MAP ──
  _renderGeoMap(d,g);
  // ══ ZONE 1 — MENACES ACTIVES ══
  g.insertAdjacentHTML('beforeend',secBar('◉','MENACES EN COURS','#ff3b5c','Kill Chain · analyse temps réel'));

  // ── THREAT SCORE ──
  _renderThreatScore(d,g);
  // ── ACTIONS PROACTIVES — AUTO-BAN ──
  _renderAutoBan(d,g);

  // ── SECURITE 24H ──
  _renderSecurite24h(d,g);

  // ── THREAT INTEL ──
  _renderThreatIntel(d,g);

  // ══ ZONE 3 — DÉFENSES ACTIVES ══
  g.insertAdjacentHTML('beforeend',secBar('⊛','BOUCLIER ACTIF','#c0392b','CrowdSec · fail2ban · UFW'));

  // ── STACK DE DÉFENSE — IPS/IDS ──
  _renderStackDefense(d,g);

  // ── CHAÎNE DE DÉFENSE — ÉTAT LOGIQUE TEMPS RÉEL ──
  if(window._renderDefenseChain) window._renderDefenseChain(d,g);

  // ── XDR — données disponibles ──
  window._xdrLastData = d;

  // ── PROTECTION ACTIVE — CrowdSec + Fail2ban ──
  _renderProtectionActive(d,g);

  // ── INTELLIGENCE MENACES ──
  _renderIntelMenaces(d,g);

  // ══ ZONE 4 — IDS RÉSEAU — SURICATA ══
  g.insertAdjacentHTML('beforeend',secBar('◈','DÉTECTION RÉSEAU','#ff4500','Suricata IDS · 90k règles actives'));
  // ── SURICATA IDS ──
  _renderSuricata(d,g);

  // ══ ZONE 2 — ANALYSE DES ATTAQUES ══
  g.insertAdjacentHTML('beforeend',secBar('◈','RENSEIGNEMENT ATTAQUANTS','#ff6b35','Honeypot · CVE · AbuseIPDB'));

  // ── A. HONEYPOT DETECTOR ──
  _renderHoneypot(d,g);

  // ── B. MITRE ATT&CK NAVIGATOR ──
  _renderMitre(d,g);


  // ── CVE SYNC ──
  _renderCve(d,g);

  // ══ SECTION TRAFIC & ACTIVITÉ ══
  g.insertAdjacentHTML('beforeend',secBar('◇','FLUX & ACTIVITÉ RÉSEAU','#00d9ff','Trafic nginx · routeur GT-BE98'));

  // ── ACTIVITÉ TEMPS RÉEL ──
  _renderActiviteRT(d,g);
  // ── PROTOCOLES ACTIFS ──
  _renderProtoActifs(d,g);

  // ── TOP PAGES ──
  _renderTopPages(d,g);

  // ── TRAFIC 24H ──
  _renderTrafic24h(d,g);

  // ── FLUX LIVE — 5 MIN ──
  _renderFluxLive(d,g);

  // ── BANDE PASSANTE ──
  _renderBandePassante(d,g);

  // ── FREEBOX DELTA — tuile unifiée WAN + BOX ──
  _renderFreeboxPrepare(d);

  // ══ SECTION INFRASTRUCTURE ══
  g.insertAdjacentHTML('beforeend',secBar('◈','INFRASTRUCTURE & RÉSEAU','#ffd700','Proxmox VE · VMs · LAN'));

  // ── PROXMOX ──
  _renderProxmox(d,g);
  // ── SYSTEME & RÉSEAU — SRV-NGIX ──
  _renderSistemeReseau(d,g);

  // ── SERVICES ──
  _renderServices(d,g);

  // ── SSH INFRASTRUCTURE + SURVEILLANCE (fusionnés) ──
  _renderSSH(d,g);

  // ══ ZONE 5B — SYSTÈME & RESSOURCES ══
  g.insertAdjacentHTML('beforeend',secBar('⬆','SANTÉ SYSTÈME','#ff9f1c','Mises à jour · services · ressources'));
  _renderZone5B(d,g);
  // ── WINDOWS TILES ──
  _renderWindowsTiles(d,g);
  // ── TUILE ROUTEUR GT-BE98 ──
  _renderRouteur(d,g);

  // ══ ZONE 7 — INTELLIGENCE ARTIFICIELLE ══
  g.insertAdjacentHTML('beforeend',secBar('⬡','IA — JARVIS PROACTIVE','#bf5fff','LLM local · analyse SOC · auto-engine'));
  _renderJarvisTiles(d,g);
  if(window._jvAfterRender) window._jvAfterRender();

  // ── SSL ──
  _renderSSL(d,g);

  // SOC enhancements
  updateAlertStrip(d);
  _snap={geo:t.geo_blocks||0,err:t.error_rate||0,ufw:(d.ufw||{}).blocked_total||0,f2b:(d.fail2ban||{}).total_banned||0};

  // Alerte vocale JARVIS si nouveaux auto-bans
  _checkAutoBanAlerts(d.autoban_log||[]);
}

