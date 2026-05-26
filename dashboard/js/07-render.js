'use strict';
// ── Contexte statique JARVIS — synthèse rsyslog ──────────────────────────────
// Injecté dans le prompt LLM à chaque clic "SYNTHÈSE IA".
// Mettre à jour ici si l'infrastructure change (nouveaux hôtes, nouvelles plages CDN, etc.)
var _RSYSLOG_JARVIS_CTX=[
  'CONTEXTE INFRASTRUCTURE (rôle de chaque hôte) :',
  '  clt      = VM Apache + fail2ban (site cybersécurité, VM 106, <CLT-IP>)',
  '  pa85     = VM Apache + fail2ban (site associatif PA85, VM 107, <PA85-IP>)',
  '  pve      = Proxmox VE hyperviseur (hôte physique <PROXMOX-IP>, héberge clt/pa85/srv-nginx)',
  '  srv-dev-1 = VM dev JARVIS CODE mode (VM 101, <SRV-DEV1-IP>, isolée prod — UFW + fail2ban)\n',
  '  NB : routeur retiré le 2026-05-17.\n',
  'CONTEXTE programs_unused (sources présentes NON exploitées par le SOC) :',
  '  kernel sur clt/pa85 = fichiers VIDES (0 lignes actives) — aucun événement noyau en cours, pas urgent',
  '  pve-firewall = activé le 2026-04-24 (host.fw log_level_in:warning) — en remplissage, normal',
  '  RÈGLE : ne recommander d\'activer une source que si elle contient des données réelles\n',
  'CONTEXTE IPs OUTBOUND — plages légitimes (NE PAS qualifier de suspectes) :',
  '  35.x=AWS · 34.x=GCP · 216.239.x=Google · 142.250.x=Google · 150.171.x=Microsoft/M365',
  '  52.x=Azure · 157.240.x=Meta/Instagram · 185.60.x=Meta · 31.13.x=Meta · 57.144.x=Meta-CDN · 163.70.x=Meta-CDN\n'
].join('\n');
// ── Cache DOM — éléments persistants récupérés à chaque render (D11) ──
const _dc=Object.create(null);
function _dom(id){ if(!_dc[id]||!_dc[id].isConnected) _dc[id]=document.getElementById(id); return _dc[id]; }
// ── Double rAF — garantit un layout pass complet avant draw canvas (D7/N5) ──
function _raf2(fn){ requestAnimationFrame(function(){ requestAnimationFrame(fn); }); }
// NDT-246 — _THR_CPU_CRIT/WARN/_THR_GPU_CRIT/_THR_TEMP_*/ACPI_* déplacés dans 01-utils.js

// ── Helpers hoistés (D8 — sortis de render() pour éviter la redéfinition à chaque cycle) ──
function secBar(ic,lb,cl,sub){return '<div class="sec-bar" style="border-left-color:'+cl+';color:'+cl+';background:'+cl+'0d"><span>'+ic+'</span><span>'+lb+(sub?'<span class="sec-bar-sub"> · '+sub+'</span>':'')+'</span></div>';}

// ── Sections extraites de render() (D8 — session 2026-04-12) ──

// NDT-25a — sum-items Proxmox nœud (CPU/RAM/SSD) — IIFE promue en helper module-level
function _hudPrxSumItems(prx){
  if(!prx.configured||!prx.nodes||!prx.nodes.length)return'';
  var node=prx.nodes[0];
  var out='';
  if(node.cpu_pct!==undefined){
    var cc=node.cpu_pct>_THR_CPU_CRIT?'crit':node.cpu_pct>_THR_CPU_WARN?'warn':'ok';
    var cClr=node.cpu_pct>_THR_CPU_CRIT?'var(--red)':node.cpu_pct>_THR_CPU_WARN?'var(--yellow)':'var(--purple)';
    out+='<div class="sum-item"><div class="sum-val '+cc+'">'+node.cpu_pct+'%</div>'
      +'<div class="sum-lbl">PVE CPU</div>'
      +'<div class="sum-gauge" style="width:'+node.cpu_pct+'%;background:'+cClr+'"></div></div>';
  }
  if(node.mem_pct!==undefined){
    var mc=node.mem_pct>_THR_CPU_CRIT?'crit':node.mem_pct>_THR_CPU_WARN?'warn':'ok';
    var mClr=node.mem_pct>_THR_CPU_CRIT?'var(--red)':node.mem_pct>_THR_CPU_WARN?'var(--yellow)':'var(--purple)';
    out+='<div class="sum-item"><div class="sum-val '+mc+'">'+node.mem_pct+'%</div>'
      +'<div class="sum-lbl">PVE RAM</div>'
      +(node.mem_used_mb&&node.mem_total_mb?'<div class="sum-sub">'+(node.mem_used_mb/1024).toFixed(1)+'/'+(node.mem_total_mb/1024).toFixed(1)+' Go</div>':'')
      +'<div class="sum-gauge" style="width:'+node.mem_pct+'%;background:'+mClr+'"></div></div>';
  }
  var ssd=null;
  (node.storages||[]).forEach(function(s){if(!ssd||s.total_gb>ssd.total_gb)ssd=s;});
  if(ssd){
    var sc2=ssd.pct>_THR_CPU_CRIT?'crit':ssd.pct>_THR_CPU_WARN?'warn':'ok';
    var sClr=ssd.pct>_THR_CPU_CRIT?'var(--red)':ssd.pct>_THR_CPU_WARN?'var(--yellow)':'var(--green)';
    out+='<div class="sum-item"><div class="sum-val '+sc2+'">'+(ssd.pct||0).toFixed(0)+'%</div>'
      +'<div class="sum-lbl">PVE SSD 2To</div>'
      +'<div class="sum-sub">'+(ssd.used_gb||0)+'/'+(ssd.total_gb>999?(ssd.total_gb/1024).toFixed(1)+' To':(ssd.total_gb||0)+' Go')+'</div>'
      +'<div class="sum-gauge" style="width:'+(ssd.pct||0)+'%;background:'+sClr+'"></div></div>';
  }
  return out;
}
// NDT-25b — HTML complet de la barre summary (niveau menace + trafic + sécu + système + PVE)
function _hudSummaryHtml(d, t, sys, ts){
  var mem=sys.memory||{};
  var cpu=sys.cpu_pct;
  var prx=d.proxmox||{};
  var svcUp=Object.values(d.services||{}).filter(function(s){return s.status==='UP';}).length;
  var svcTot=Object.keys(d.services||{}).length;
  var minSsl=Math.min.apply(null,(d.ssl||[]).map(function(s){return typeof s.days_left==='number'?s.days_left:999;}));
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
   +(cpu!==undefined?'<div class="sum-item"><div class="sum-val '+(cpu>_THR_CPU_CRIT?'crit':cpu>_THR_CPU_WARN?'warn':'ok')+'">'+cpu+'%</div><div class="sum-lbl">CPU srv-nginx</div></div>':'')
   +(mem.pct!==undefined?'<div class="sum-item"><div class="sum-val '+(mem.pct>_THR_CPU_CRIT?'crit':mem.pct>_THR_CPU_WARN?'warn':'ok')+'">'+mem.pct+'%</div><div class="sum-lbl">RAM srv-nginx</div></div>':'')
   +'<div class="sum-item"><div class="sum-val" style="font-size:var(--fs-md)">'+fmtB(t.total_bytes)+'</div><div class="sum-lbl">Bande passante · 24h</div></div>'
   +(sys.uptime?'<div class="sum-item"><div class="sum-val" style="font-size:var(--fs-sm)">'+esc(sys.uptime)+'</div><div class="sum-lbl">Uptime srv-nginx</div></div>':'')
   +(prx.configured&&prx.vms_running!==undefined?'<div class="sum-item"><div class="sum-val ok">'+prx.vms_running+'/'+prx.vms_total+'</div><div class="sum-lbl">VMs Proxmox actives</div></div>':'')
   +_hudPrxSumItems(prx);
}
function _renderHUD(d){
  var t=d.traffic||{};
  var sys=d.system||{};
  var ts=computeThreatScore(d);
  _lastThreatResult=ts; // partagé avec _renderThreatScore + carte Leaflet

  // Timestamp + barre drain
  var _gaStr=_fmtDateTs(new Date(d.generated_at)); // NDT-149
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
  var recent24=0,now24=Date.now()-_MS_PER_DAY;
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
  var rowsHtml=abl.slice(0,50).map(function(e,i){
    var stCol=_ABL_STAGE_COL[e.stage||'RECON']||'var(--orange)';
    var ts=new Date(e.ts).toISOString().slice(11,16);
    var rule=e.rule||'ban 24h';
    var countryHtml=e.country&&e.country!=='-'?'['+esc(e.country)+']':'';
    var isFresh=i<3;
    var rowCls=isFresh?' abl-row-new':'';
    var borderOpacity=isFresh?'cc':'66';
    var ipColor=isFresh?'var(--red)':'var(--orange)';
    var freshDot=isFresh?'<span style="color:rgba(255,59,92,.9);font-size:var(--fs-3xs);margin-right:.2rem;animation:blink-dot 1s ease-in-out infinite;vertical-align:middle">●</span>':'';
    return `<div class="abl-row${rowCls}" style="border-left:3px solid ${stCol}${borderOpacity}">`
     +`<span style="color:${ipColor};font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${freshDot}${esc(e.ip)}</span>`
     +`<span style="color:var(--muted)">${countryHtml}</span>`
     +`<span style="background:${stCol}18;color:${stCol};border:1px solid ${stCol}44;border-radius:2px;padding:.04rem .1rem;font-weight:700;letter-spacing:.4px;text-align:center;white-space:nowrap">${esc(e.stage||'?')}</span>`
     +`<span style="color:rgba(0,255,136,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.rule_icon||'◈'} ${esc(rule)}</span>`
     +`<span style="color:${isFresh?'rgba(255,107,53,.7)':'rgba(122,154,184,0.3)'};text-align:right;white-space:nowrap">${ts}</span>`
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
  if(_aCard&&!_aCard._boundAbl){_aCard._boundAbl=true;_aCard.addEventListener('click',function(){openAutoBanModal();});}
  window._ablData=abl;
}

// NDT-29a — 4 stat-boxes + badges protocoles + bandeau tronqués
function _surSatPct(evts,tot,trunc){
  var evtTotal=(evts.dns||0)+(evts.http||0)+(evts.tls||0)+(evts.ssh||0)+(evts.flow||0)+tot+trunc;
  return evtTotal>0?Math.min(100,Math.round(trunc*100/evtTotal)):0;
}
function _surStatBoxesHtml(s1, s2, tot, rules, evts, trunc, ts){
  var satPct=_surSatPct(evts,tot,trunc);
  var satCol=satPct>15?'var(--red)':satPct>5?'var(--amber)':'var(--green)';
  var satGlow=satPct>15?'text-shadow:0 0 8px var(--red)':satPct>5?'text-shadow:0 0 5px var(--amber)':'';
  var wCount=ts&&ts.worker_count?ts.worker_count:0;
  var gDrops=ts&&ts.global_drops?ts.global_drops:0;
  var dropCol=gDrops>0?'var(--red)':'var(--green)';

  // 3 gradient cards
  var s1rgb=s1>0?'239,68,68':s2>0?'255,215,0':'0,255,136';
  var _kc=[
    {val:s1,       lbl:'CRIT SÉV.1', rgb:s1rgb},
    {val:fmt(s2),  lbl:'HIGH SÉV.2', rgb:'255,107,53'},
    {val:fmt(tot), lbl:'TOTAL 24H',  rgb:'0,217,255'},
  ];
  var cardsHtml='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin-bottom:.35rem">'
    +_kc.map(function(c){
      return '<div style="background:linear-gradient(135deg,rgba('+c.rgb+',.09),rgba('+c.rgb+',.02));border:1px solid rgba('+c.rgb+',.22);border-radius:6px;padding:.4rem .3rem;text-align:center;position:relative;overflow:hidden">'
        +'<div style="position:absolute;bottom:.1rem;right:.3rem;font-size:var(--fs-lg);color:rgba('+c.rgb+',.06);font-weight:900;line-height:1">◈</div>'
        +'<div style="font-size:var(--fs-xl);font-weight:700;color:rgb('+c.rgb+');font-family:\'Courier New\',monospace;line-height:1">'+c.val+'</div>'
        +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+c.rgb+',.45);text-transform:uppercase;letter-spacing:.6px;margin-top:.18rem">'+c.lbl+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  // Protocol bars — sorted by volume desc
  var _pk=[{k:'flow',lbl:'FLOW'},{k:'ssh',lbl:'SSH'},{k:'tls',lbl:'TLS'},{k:'http',lbl:'HTTP'},{k:'dns',lbl:'DNS'}];
  _pk.sort(function(a,b){return (evts[b.k]||0)-(evts[a.k]||0);});
  var _maxPk=Math.max.apply(null,_pk.map(function(e){return evts[e.k]||0;}).concat([1]));
  var protoHtml=_prxSec('PROTOCOLES','var(--cyan)')
    +_pk.map(function(e){
      var v=evts[e.k]||0, pct=Math.round(v*100/_maxPk);
      return '<div style="display:flex;align-items:center;gap:.3rem;margin:.05rem 0;font-size:var(--fs-xs)">'
        +'<span style="width:3rem;color:var(--muted);flex-shrink:0;letter-spacing:.4px">'+e.lbl+'</span>'
        +'<div style="flex:1;height:4px;background:rgba(0,217,255,.06);border-radius:2px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:rgba(0,217,255,.55);border-radius:2px"></div></div>'
        +'<span style="width:3.5rem;text-align:right;color:var(--cyan);font-family:\'Courier New\',monospace;font-weight:700">'+fmt(v)+'</span>'
        +'</div>';
    }).join('');

  // Ring 40px compact + stats grid
  var _sr=15,_circ=2*Math.PI*_sr;
  var _rFill=satPct===0
    ?'<circle cx="20" cy="20" r="'+_sr+'" fill="none" stroke="var(--green)" stroke-width="4" stroke-opacity=".6"/>'
    :'<circle cx="20" cy="20" r="'+_sr+'" fill="none" stroke="'+satCol+'" stroke-width="4" stroke-linecap="butt"'
      +' stroke-dasharray="'+_circ.toFixed(1)+'" stroke-dashoffset="'+(_circ*(1-satPct/100)).toFixed(1)+'"/>';
  var _rSvg='<svg width="40" height="40" viewBox="0 0 40 40">'
    +'<circle cx="20" cy="20" r="'+_sr+'" fill="none" stroke="rgba(0,217,255,0.1)" stroke-width="4"/>'+_rFill+'</svg>';
  var ringHtml=_prxSec('RING STATUS','var(--cyan)')
    +'<div style="display:flex;align-items:center;gap:.6rem">'
    +'<div style="position:relative;width:40px;height:40px;flex-shrink:0">'
    +_rSvg
    +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
    +'<span style="font:700 8px \'Courier New\',monospace;'+satGlow+';color:'+satCol+'">'+satPct+'%</span>'
    +'</div></div>'
    +'<div style="display:grid;grid-template-columns:auto 1fr;gap:.08rem .45rem;font-size:var(--fs-xs);align-items:center">'
    +'<span style="color:var(--muted)">SAT.</span>'
    +'<span style="color:'+satCol+';font-family:\'Courier New\',monospace;font-weight:700">'+satPct+'% · '+(trunc>0?fmt(trunc)+' tronq.':'0 tronq.')+'</span>'
    +(wCount>0?'<span style="color:var(--muted)">WORKERS</span><span style="color:var(--cyan);font-family:\'Courier New\',monospace;font-weight:700">'+wCount+'</span>':'')
    +'<span style="color:var(--muted)">DROPS</span>'
    +'<span style="color:'+dropCol+';font-family:\'Courier New\',monospace;font-weight:700">'+gDrops+'</span>'
    +'</div></div>';

  return cardsHtml+protoHtml+ringHtml;
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
      +`<div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ff3b5c88,var(--red));border-radius:2px"></div></div>`
      +`<span style="font-size:var(--fs-xs);color:var(--muted);min-width:1.5rem;text-align:right">${e.count}</span>`
      +'</div>';
  }).join('');
  return '<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.18rem">Top IPs — sév.1+2</div>'
   +`<div style="display:flex;flex-direction:column;gap:.1rem;margin-bottom:.35rem">${rowsHtml}</div>`;
}
// NDT-29c — bandeau alertes critiques sév.1 : animé si <1h, grisé si historique
function _surCriticalAlertsHtml(s1, sur){
  if(!s1)return '';
  var rc=sur.recent_critical||[];
  var now=Date.now();
  var recentRc=rc.filter(function(a){return a.ts&&(now-new Date(a.ts).getTime())<3600000;});
  var isRecent=recentRc.length>0;
  var displayRc=(isRecent?recentRc:rc).slice(0,2);
  var alertsHtml=displayRc.map(function(a){
    var col=isRecent?'rgba(255,59,92,0.8)':'rgba(160,160,160,0.45)';
    return '<div style="font-size:var(--fs-xs);color:'+col+';line-height:1.3">'+esc(a.src_ip)+' — '+esc((a.signature||'').substring(0,55))+'</div>';
  }).join('');
  if(isRecent){
    return '<div style="padding:.2rem .4rem;background:rgba(255,59,92,0.1);border:1px solid rgba(255,59,92,0.35);border-radius:3px;animation:blink 1.5s ease-in-out infinite">'
     +'<div style="font-size:var(--fs-xs);color:var(--red);font-weight:700;margin-bottom:.12rem">⚠ '+s1+' ALERTE'+(s1>1?'S':'')+' CRITIQUE'+(s1>1?'S':'')+' — sévérité 1</div>'
     +alertsHtml+'</div>';
  }
  return '<div style="padding:.2rem .4rem;background:rgba(100,100,100,0.06);border:1px solid rgba(120,120,120,0.18);border-radius:3px">'
   +'<div style="font-size:var(--fs-xs);color:rgba(160,160,160,0.5);font-weight:700;margin-bottom:.12rem">◎ '+s1+' alerte'+(s1>1?'s':'')+' sév.1 — historique 24h (toutes IPs bannies)</div>'
   +alertsHtml+'</div>';
}
function _renderSuricata(d,g){
  var sur=d.suricata||{};
  if(!sur.available){
    g.insertAdjacentHTML('beforeend','<div class="card wide"><div class="card-inner"><div class="ct r"><span class="ct-icon">◈</span>SURICATA IDS — NON DISPONIBLE</div><div style="font-size:var(--fs-xs);color:var(--muted);padding:.4rem 0">⚠ Suricata non démarré ou EVE JSON absent — <code>/var/log/suricata/eve.json</code></div></div></div>');
    return;
  }
  var s1=sur.sev1_critical||0, s2=sur.sev2_high||0;
  var ts=sur.thread_stats||null;
  var topIps=(sur.top_ips||[]).filter(function(e){return e.ip&&!_LAN_RE.test(e.ip);});
  var h='<div class="card" id="suricata-card" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct '+(s1>0?'r':s2>0?'y':'c')+'"><span class="ct-icon">◈</span>SURICATA IDS — ALERTES RÉSEAU 24H'
   +'<span data-panel="RÔLE : IDS réseau (Intrusion Detection System) — analyse le trafic en temps réel par signatures. Opère au niveau L3/L4, indépendamment de CrowdSec et fail2ban. Lit chaque paquet sur l interface réseau et génère des alertes EVE JSON dès qu une signature connue est reconnue.\n\nMÉTRIQUES SURVEILLÉES : alertes sév.1 CRITIQUE · sév.2 HIGH · total alertes 24h · règles chargées · top IPs attaquantes · catégories d attaque (scan · exploit · C2 · bruteforce · anomalie protocole).\n\nCOMPORTEMENT ATTENDU : sév.1 = 0 (idéal) · sév.2 faible · règles > 0 · threads actifs. Un pic sév.1 = activité offensive sérieuse — investigation immédiate requise. Les IPs bannies disparaissent des alertes au cycle suivant.\n\nPIPELINE : trafic réseau → Suricata engine → eve.json → monitoring_gen.py parse EVE JSON → monitoring.json → dashboard SOC mis à jour toutes les 30s.\n\nJARVIS (si online) : si alertes sév.1 détectées → analyse LLM des patterns → corrélation Kill Chain → ban IP automatique si niveau CRITIQUE confirmé → alerte vocale TTS + entrée journal SOC.\n\nVALEUR AJOUTÉE : seule couche qui voit le trafic brut réseau. Détecte les scans Nmap, exploits CVE connus, callbacks C2, tunneling DNS, protocoles anormaux — invisible aux outils HTTP comme CrowdSec AppSec. Les règles couvrent des milliers de signatures malware et CVE récents." data-panel-title="SURICATA IDS — DÉTECTION RÉSEAU" class="soc-panel-i" style="--pi-dim:rgba(255,100,48,.45);--pi-bright:rgba(255,100,48,.9);--pi-glow:rgba(255,100,48,.5)">ⓘ</span>'
   +'</div>'
   +_surStatBoxesHtml(s1, s2, sur.total_alerts||0, sur.rules_loaded||0, sur.events||{}, sur.truncated_24h||0, ts)
   +_surTopIpsHtml(topIps)
   +_surCriticalAlertsHtml(s1, sur)
   +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.25);margin-top:.4rem;text-align:center;letter-spacing:.8px;text-transform:uppercase">↑ cliquer pour détails</div>'
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var _sCard=document.getElementById('suricata-card');if(_sCard&&!_sCard._boundSur){_sCard._boundSur=true;_sCard.addEventListener('click',function(){openSuricataModal(window._lastData&&window._lastData.suricata);});}
}

function _hptRisk(path){
  var p=(path||'').toLowerCase();
  var crit=['.env','wp-config','.git/config','passwd','shadow','.ssh','id_rsa','config.php','credentials','secret','token','database','db.php','.htpasswd'];
  var high=['cgi-bin','phpinfo','shell','cmd','exec','wp-login','wp-admin','.htaccess','phpmyadmin','adminer','console','manager','actuator'];
  if(crit.some(function(k){return p.indexOf(k)>=0;})) return {label:'CRITIQUE',col:PROTO_PALETTE.THREAT};
  if(high.some(function(k){return p.indexOf(k)>=0;})) return {label:'ÉLEVÉ',col:_COL_ORANGE_HEX};
  return {label:'INFO',col:PROTO_PALETTE.WATCH};
}
function _renderHoneypot(d,g){
  var hp=d.honeypot||{};
  var hits=hp.total_hits||0, hpIps=hp.total_ips||0, paths=hp.top_paths||[];

  // 3 stat gradient cards
  var _sc=[
    {val:fmt(hits),    lbl:'REQUÊTES', rgb:'255,107,53'},
    {val:hpIps,        lbl:'IPs',      rgb:'255,215,0'},
    {val:paths.length, lbl:'CHEMINS',  rgb:'122,154,184'}
  ];
  var statsHtml=_sc.map(function(s){
    return '<div style="background:linear-gradient(135deg,rgba('+s.rgb+',.1),rgba('+s.rgb+',.02));border:1px solid rgba('+s.rgb+',.25);border-radius:6px;padding:.42rem .3rem;text-align:center;position:relative;overflow:hidden">'
      +'<div style="position:absolute;bottom:.1rem;right:.3rem;font-size:var(--fs-lg);color:rgba('+s.rgb+',.06);font-weight:900;line-height:1">◈</div>'
      +'<div style="font-size:var(--fs-xl);font-weight:700;color:rgb('+s.rgb+');font-family:\'Courier New\',monospace;line-height:1">'+s.val+'</div>'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+s.rgb+',.45);text-transform:uppercase;letter-spacing:.6px;margin-top:.18rem">'+s.lbl+'</div>'
      +'</div>';
  }).join('');
  var statsBar='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin-bottom:.45rem">'+statsHtml+'</div>';

  // path rows
  var pathsBodyHtml;
  if(!paths.length){
    pathsBodyHtml='<div style="font-size:var(--fs-xs);color:var(--green);padding:.65rem 0;text-align:center">✓ Aucun chemin piège déclenché</div>';
  } else {
    var mx=paths[0].count||1;
    var pathRowsHtml=paths.slice(0,12).map(function(p,pi){
      var pct=Math.round(p.count*100/mx);
      var risk=_hptRisk(p.path);
      var c=risk.col;
      var lbl=risk.label;
      var rBg=lbl==='CRITIQUE'?'rgba(239,68,68,.1)':lbl==='ÉLEVÉ'?'rgba(255,107,53,.1)':'rgba(245,158,11,.08)';
      var rBdr=lbl==='CRITIQUE'?'rgba(239,68,68,.32)':lbl==='ÉLEVÉ'?'rgba(255,107,53,.28)':'rgba(245,158,11,.25)';
      var last=pi===Math.min(paths.length,12)-1;
      return '<div style="display:flex;align-items:center;gap:.38rem;padding:.22rem 0;'+(last?'':'border-bottom:1px solid rgba(255,255,255,.04);')+'font-size:var(--fs-xs);font-family:\'Courier New\',monospace">'
        +'<span style="flex:0 0 4rem;font-size:var(--fs-3xs);padding:.04rem 0;border-radius:2px;font-weight:700;letter-spacing:.5px;text-align:center;background:'+rBg+';border:1px solid '+rBdr+';color:'+c+'">'+lbl+'</span>'
        +'<span style="color:'+c+';flex:0 0 9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.path)+'</span>'
        +'<div style="flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,'+c+'77,'+c+');border-radius:3px;box-shadow:0 0 5px '+c+'44;transition:width .6s"></div>'
        +'</div>'
        +'<span style="flex:0 0 1.8rem;text-align:right;font-weight:700;color:'+c+'">'+p.count+'</span>'
        +'<span style="flex:0 0 2.6rem;text-align:right;color:rgba(0,217,255,.5)">'+p.unique_ips+'×IP</span>'
        +'</div>';
    }).join('');
    pathsBodyHtml='<div>'+pathRowsHtml+'</div>';
  }

  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct '+(hits>0?'r':'')+'"><span class="ct-icon">⚠</span>HONEYPOT · PIÈGES — 24H</div>'
   +statsBar+pathsBodyHtml
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
  var f2bHosts=[f2b2.jails||[],(f2b2.proxmox&&f2b2.proxmox.jails)||[],(f2b2.clt&&f2b2.clt.jails)||[],(f2b2.pa85&&f2b2.pa85.jails)||[]];
  var sshBansAll=f2bHosts.reduce(function(a,jls){return a+jls.filter(function(j){return j.jail==='sshd';}).reduce(function(x,j){return x+(j.cur_banned||0);},0);},0);
  var apacheJails=['apache-badbots','apache-noscript','apache-overflows'];
  var webBotScore=[(f2b2.clt&&f2b2.clt.jails)||[],(f2b2.pa85&&f2b2.pa85.jails)||[]].reduce(function(a,jls){
    return a+jls.filter(function(j){return apacheJails.indexOf(j.jail)>=0;}).reduce(function(x,j){return x+(j.cur_banned||0)+(j.tot_failed||0);},0);
  },0);
  var _f2bHosts=[{v:f2b2.total_banned,ok:true},{v:(f2b2.proxmox||{}).total_banned,ok:!!(f2b2.proxmox&&f2b2.proxmox.available)},{v:(f2b2.clt||{}).total_banned,ok:!!(f2b2.clt&&f2b2.clt.available)},{v:(f2b2.pa85||{}).total_banned,ok:!!(f2b2.pa85&&f2b2.pa85.available)}];
  var _f2bActive=_f2bHosts.filter(function(h){return h.ok;}).length;
  var totalBansAll=_f2bHosts.reduce(function(a,h){return a+(h.ok?h.v||0:0);},0);
  var exploitScore=(sc.EXPLOIT||0)+(cs2.appsec&&cs2.appsec.blocked||0)+surSev1;
  return [
    {id:'T1595',    name:'Active Scanning',       tac:'RECON',  score:sc.RECON||0,                         src:'CrowdSec·RECON',         col:_COL_PURPLE_HEX},
    {id:'T1595.002',name:'Vuln. Scanning',         tac:'RECON',  score:(sc.SCAN||0)+surSev2,                src:'CrowdSec·Suricata·SCAN', col:_COL_MITRE_RECON2_HEX},
    {id:'T1190',    name:'Exploit Public App',     tac:'ACCESS', score:exploitScore,                        src:'CrowdSec·WAF·Suricata',  col:_COL_RED_HEX},
    {id:'T1059',    name:'Command Exec / ShellInj',tac:'EXEC',   score:surSev1,                             src:'Suricata·IDS·sév1',      col:_COL_MITRE_EXEC_HEX},
    {id:'T1190.002',name:'Web Bots / Scraping',    tac:'ACCESS', score:webBotScore,                         src:'F2B·CLT·PA85',           col:_COL_ORANGE_HEX},
    {id:'T1110',    name:'Brute Force SSH',        tac:'CRED',   score:(sc.BRUTE||0)+sshFail+sshBansAll,    src:'CrowdSec·F2B·SSH',       col:_COL_YELLOW_HEX},
    {id:'T1071',    name:'C2 / Trafic suspect',    tac:'C&C',    score:Math.max(0,surTotal-surSev1-surSev2), src:'Suricata·réseau',        col:_COL_MITRE_C2_HEX},
    {id:'T1499',    name:'DoS / Bans — '+_f2bActive+' hôtes', tac:'IMPACT', score:totalBansAll,           src:'F2B·'+_f2bActive+' hôtes',col:_COL_CYAN_HEX},
  ];
}
// NDT-30b — HTML d'une ligne technique MITRE (barre + score + badge ACTIF/—)
function _mitreRowHtml(t, maxScore){
  var on=t.score>0;
  var pct=Math.min(100,Math.round(t.score*100/maxScore));
  return '<div class="att-hbar-row'+(on?' att-active':'')+'" style="border-left:3px solid '+(on?t.col+'88':'rgba(255,255,255,0.04)')+'">'
    +'<div class="att-hbar-tac" style="color:'+(on?t.col:'rgba(122,154,184,0.28)')+'">'+t.tac+'</div>'
    +'<div class="att-hbar-tid">'+t.id+'</div>'
    +'<div style="flex:0 0 130px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'
    +'<div class="att-hbar-name" style="color:'+(on?t.col:'rgba(122,154,184,0.3)')+'">'+t.name+'</div>'
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
  var activeBadge=totalActive>0
    ?'<span class="att-summary-active" style="margin-left:auto;flex-shrink:0">'+totalActive+' technique'+(totalActive>1?'s':'')+' active'+(totalActive>1?'s':'')+' détectée'+(totalActive>1?'s':'')+'</span>'
    :'<span class="att-summary-calm" style="margin-left:auto;flex-shrink:0">✓ Calme</span>';
  var h='<div class="card half"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⚔</span>MITRE ATT&amp;CK — MAPPING TEMPS RÉEL'+activeBadge+'</div>'
   +rowsHtml+'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}

// NDT-168a — extracted from _renderCve: proportional bar row (label+bar+value)
function _sevBar(label,val,maxVal,col){
  var pct=Math.round(val*100/maxVal);
  return '<div style="display:flex;align-items:center;gap:.3rem;margin:.1rem 0;font-size:var(--fs-xs)">'
    +'<span style="width:4.2rem;color:var(--muted);flex-shrink:0">'+label+'</span>'
    +'<div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">'
    +'<div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:2px"></div></div>'
    +'<span style="width:2.8rem;text-align:right;color:'+col+';font-family:\'Courier New\',monospace;font-weight:700">'+fmt(val)+'</span>'
    +'</div>';
}
function _renderCve(d,g){
  var cve=d.cve_sync||{};
  if(cve.error){
    g.insertAdjacentHTML('beforeend',
      '<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
      +'<div class="ct c"><span class="ct-icon">◉</span>CVE SYNC</div>'
      +'<span style="color:var(--red);font-size:var(--fs-xs)">ERR: '+esc(cve.error)+'</span>'
      +'</div></div>');
    return;
  }
  var total=cve.total||0;
  var crit=cve.critical||0, hi=cve.high||0, med=cve.medium||0, lo=cve.low||0;
  var net=cve.network_av||0;
  var maxSev=Math.max(crit,hi,med,lo,1);
  var maj=cve.last_update||'—';
  // format ISO → lisible
  var majFmt=maj.replace('T',' ').replace('Z','').substring(0,16);
  var body=_prxSec('BASE CVE — '+cve.months+' MOIS','var(--cyan)')
    +'<div style="font-size:var(--fs-3xl);color:var(--cyan);font-family:\'Courier New\',monospace;font-weight:700;letter-spacing:2px;margin:.1rem 0;text-shadow:0 0 14px rgba(0,217,255,.45)">'+fmt(total)+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.4rem;letter-spacing:.4px">vulnérabilités indexées</div>'
    +_sevBar('CRITIQUE', crit, maxSev,'var(--red)')
    +_sevBar('ÉLEVÉE',   hi,   maxSev,'var(--orange)')
    +_sevBar('MOYENNE',  med,  maxSev,'var(--yellow)')
    +_sevBar('FAIBLE',   lo,   maxSev,'var(--green)')
    +'<div style="margin-top:.35rem;padding-top:.28rem;border-top:1px solid rgba(255,255,255,.06);font-size:var(--fs-xs);color:var(--muted)">'
    +'Réseau (AV:N) : <span style="color:var(--cyan);font-family:\'Courier New\',monospace">'+fmt(net)+'</span>'
    +' <span style="opacity:.45">('+Math.round(net*100/(total||1))+'%)</span></div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.4);margin-top:.2rem">MAJ '+esc(majFmt)+'</div>';
  g.insertAdjacentHTML('beforeend',
    '<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◉</span>CVE SYNC</div>'
    +body
    +'</div></div>');
}


function _renderSecurite24h(d,g){
  var t=d.traffic||{};
  var scans=(t.top_scanners||[]).reduce(function(a,e){return a+e[1];},0);
  var geo=t.geo_blocks||0, srv5xx=t.status_5xx||0, bots=t.bots||0;

  // 4 gradient cards 2×2
  var _gc=[
    {val:fmt(scans),  lbl:'SCANS OFFENSIFS', rgb:scans>0?'239,68,68':'0,255,136'},
    {val:fmt(geo),    lbl:'GEOIP BLOQUÉS',   rgb:'255,107,53'},
    {val:fmt(bots),   lbl:'BOTS',            rgb:'0,217,255'},
    {val:fmt(srv5xx), lbl:'ERREURS 5XX',     rgb:srv5xx>10?'239,68,68':srv5xx>0?'255,215,0':'0,255,136'},
  ];
  var cardsHtml='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-bottom:.42rem">'
    +_gc.map(function(c){
      return '<div style="background:linear-gradient(135deg,rgba('+c.rgb+',.09),rgba('+c.rgb+',.02));border:1px solid rgba('+c.rgb+',.22);border-radius:6px;padding:.42rem .3rem;text-align:center;position:relative;overflow:hidden">'
        +'<div style="position:absolute;bottom:.1rem;right:.3rem;font-size:var(--fs-lg);color:rgba('+c.rgb+',.06);font-weight:900;line-height:1">◉</div>'
        +'<div style="font-size:var(--fs-xl);font-weight:700;color:rgb('+c.rgb+');font-family:\'Courier New\',monospace;line-height:1">'+c.val+'</div>'
        +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+c.rgb+',.45);text-transform:uppercase;letter-spacing:.6px;margin-top:.18rem">'+c.lbl+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  // Scanner rows with proportional bars
  var scannersHtml='';
  if(t.top_scanners&&t.top_scanners.length){
    var maxS=t.top_scanners[0][1]||1;
    scannersHtml=_prxSec('OUTILS DÉTECTÉS','var(--red)')
      +t.top_scanners.map(function(e,i){
        var pct=Math.round(e[1]*100/maxS);
        var last=i===t.top_scanners.length-1;
        return '<div style="display:flex;align-items:center;gap:.3rem;padding:.18rem 0;'+(last?'':'border-bottom:1px solid rgba(255,255,255,.04);')+'font-size:var(--fs-xs)">'
          +'<span style="flex:1;color:var(--red);font-family:\'Courier New\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e[0])+'</span>'
          +'<div style="width:5rem;height:4px;background:rgba(255,59,92,.08);border-radius:2px;overflow:hidden;flex-shrink:0">'
          +'<div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,rgba(255,59,92,.6),var(--red));border-radius:2px"></div></div>'
          +'<span style="width:2.5rem;text-align:right;color:rgba(255,59,92,.8);font-family:\'Courier New\',monospace;font-weight:700;flex-shrink:0">'+e[1]+'</span>'
          +'</div>';
      }).join('');
  }

  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◉</span>SECURITE 24H</div>'
    +cardsHtml+scannersHtml;
  g.insertAdjacentHTML('beforeend',h+'</div></div>');
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
    :'<span style="font-size:var(--fs-xs);padding:.06rem .38rem;background:rgba(107,114,128,.07);color:var(--c-muted-4);border:1px solid rgba(107,114,128,.14);border-radius:2px;letter-spacing:.5px">—</span>';
}

// NDT-26a — construit le tableau des 9 couches de défense à partir des données JSON
function _sdBuildLayers(d){
  var f2b=d.fail2ban||{}, ufw=d.ufw||{}, cs=d.crowdsec||{}, t=d.traffic||{};
  var pvf2b=f2b.proxmox||{};
  var f2bBansPvx=pvf2b.available?(pvf2b.total_banned||0):null;
  var _aa=d.clt_apparmor||{}, _ms=d.clt_modsec||{}, _aan=d.apparmor_nginx||{};
  var _aap=d.pa85_apparmor||{}, _msp=d.pa85_modsec||{};
  var cltf2b=f2b.clt||{}, pa85f2b=f2b.pa85||{};
  var f2bBansClt=cltf2b.available?(cltf2b.total_banned||0):null;
  var f2bBansPa85=pa85f2b.available?(pa85f2b.total_banned||0):null;
  return [
    {ico:'⊘', lbl:'UFW',              sub:'Pare-feu réseau',          val:ufw.blocked_total||0,          col:'rgba(255,59,92,.85)',   ok:ufw.active!==false},
    {ico:'◎', lbl:'GeoIP',            sub:'Filtrage géographique',    val:t.geo_blocks||0,               col:'rgba(255,107,53,.85)',  ok:true},
    {ico:'⊛', lbl:'CrowdSec IDS',     sub:'Détection comportementale',val:cs.alerts_24h||0,              col:'rgba(255,215,0,.85)',   ok:cs.available||false},
    {ico:'⊛', lbl:'CrowdSec IPS',     sub:'Blocage automatique',      val:cs.active_decisions||0,        col:'rgba(255,107,53,.9)',   ok:cs.available||false},
    {ico:'◈', lbl:'fail2ban — srv-nginx', sub:'Protection SSH · Nginx',       val:f2b.total_banned||0,                          col:'rgba(0,217,255,.85)',  ok:!!(f2b.jails&&f2b.jails.length)},
    {ico:'◈', lbl:'fail2ban — Proxmox',  sub:'Protection SSH · Hyperviseur', val:f2bBansPvx!==null?f2bBansPvx:0,               col:'rgba(0,180,220,.7)',   ok:pvf2b.available===true,  na:f2bBansPvx===null},
    {ico:'◈', lbl:'fail2ban — CLT',      sub:'Protection SSH · Apache2',     val:f2bBansClt!==null?f2bBansClt:0,               col:'rgba(0,160,200,.65)',  ok:cltf2b.available===true, na:f2bBansClt===null},
    {ico:'◈', lbl:'fail2ban — PA85',     sub:'Protection SSH · Apache2',     val:f2bBansPa85!==null?f2bBansPa85:0,             col:'rgba(0,140,180,.6)',   ok:pa85f2b.available===true,na:f2bBansPa85===null},
    {ico:'⬡', lbl:'AppArmor — CLT',   sub:'Confinement Apache2',      val:_aa.processes_confined||0,     col:'rgba(0,255,136,.75)',   ok:_aa.enforce===true,    na:_aa.available===false,  lbl2:_aa.available===true?(_aa.processes_confined||0)+' workers':null},
    {ico:'⬡', lbl:'ModSec — CLT',     sub:'WAF OWASP CRS Apache',     val:_ms.attack_count||0,           col:'rgba(0,217,255,.75)',   ok:_ms.engine_on===true,  na:_ms.available===false,  lbl2:_ms.available===true?(_ms.engine_on===true?(_ms.blocking===true?'BLOCAGE':'DÉTECT'):'OFF'):null},
    {ico:'⬡', lbl:'AppArmor — PA85',  sub:'Confinement Apache2',      val:_aap.processes_confined||0,    col:'rgba(0,255,136,.75)',   ok:_aap.enforce===true,   na:_aap.available===false, lbl2:_aap.available===true?(_aap.processes_confined||0)+' workers':null},
    {ico:'⬡', lbl:'ModSec — PA85',    sub:'WAF OWASP CRS Apache',     val:_msp.attack_count||0,          col:'rgba(0,217,255,.75)',   ok:_msp.engine_on===true, na:_msp.available===false, lbl2:_msp.available===true?(_msp.engine_on===true?(_msp.blocking===true?'BLOCAGE':'DÉTECT'):'OFF'):null},
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
  var _aCol=_aStage==='EXPLOIT'?'var(--orange)':'var(--red)';
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
  var csBouncers=cs.bouncers||[], csBV=cs.ban_velocity||{}, csAppsec=cs.appsec||{}, csTrend=cs.alerts_trend||{}, csBStats=cs.bouncer_stats||{};
  var csD=cs.active_decisions||0, csA=cs.alerts_24h||0;
  var _GEO_CTRS=['RU','CN','KP','IR'];
  var _geoCnts={RU:0,CN:0,KP:0,IR:0};
  (cs.decisions_list||[]).forEach(function(r){
    if((r.scenario||'').indexOf('geo-block')!==-1){var c=r.country||'';if(_geoCnts.hasOwnProperty(c))_geoCnts[c]++;}
  });
  var _geoTotal=_GEO_CTRS.reduce(function(s,c){return s+_geoCnts[c];},0);
  var geoLine='<div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.22rem;margin-top:.1rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.65);font-weight:700;letter-spacing:.6px;text-transform:uppercase;flex-shrink:0">GEO</span>'
    +_GEO_CTRS.map(function(c){
      var n=_geoCnts[c];
      var col=n>0?'rgba(255,107,53,.9)':'rgba(160,220,255,.55)';
      return '<span style="font-size:var(--fs-xs);color:'+col+';font-family:\'Courier New\',monospace">'+c+':'+n+'</span>';
    }).join('<span style="color:rgba(255,255,255,.2);margin:0 .12rem">·</span>')
    +(_geoTotal>0?'<span style="font-size:var(--fs-xs);color:rgba(255,107,53,.75);margin-left:auto">'+_geoTotal+' ban'+(_geoTotal>1?'s':'')+'</span>':'<span style="font-size:var(--fs-xs);color:rgba(0,255,136,.45);margin-left:auto">✓</span>')
    +'</div>';
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
    var bN=b.name||'';
    var isAppsec=bN.indexOf('appsec')!==-1, bOk=isAppsec?csAppsec.active:b.healthy;
    var bShort=bN.replace('crowdsec-firewall-bouncer-','').replace('crowdsec-','').replace('-bouncer','');
    return '<span style="font-size:var(--fs-xs);color:'+(bOk?'var(--green)':'var(--red)')+';margin-right:.3rem">● '+esc(bShort)+'</span>';
  }).join('');
  var apBl=csAppsec.blocked||0, apPr=csAppsec.processed||0;
  var appsecLine=apPr>0?'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.18rem">WAF : <b style="color:var(--amber)">'+fmt(apPr)+'</b> req · <b style="color:'+(apBl>0?'var(--orange)':'var(--green)')+'">'+fmt(apBl)+'</b> bloquées</div>':'';
  var dbBytes=csBStats.dropped_bytes||0, dbPkts=csBStats.dropped_packets||0;
  var blockedLine=dbBytes>0?'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.5);margin-bottom:.18rem">Bloqué : <b>'+fmtBytesCs(dbBytes)+'</b> · '+fmt(dbPkts)+' paquets</div>':'';
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
      +geoLine
      +appsecLine
      +blockedLine
      +'<div style="display:flex;gap:.2rem;margin-top:.28rem">'+stagesMini+'</div>';
  return '<div style="font-size:var(--fs-xs);color:var(--cyan);text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.35rem;display:flex;align-items:center;gap:.35rem">⊛ CrowdSec IPS/IDS'
    +'<span data-panel="RÔLE : moteur de détection comportementale et blocage réseau (IDS + IPS) — analyse les logs en temps réel pour identifier des patterns d attaque multi-sources. Deux composants distincts : IDS (détection, génère des alertes) et IPS (blocage automatique via bouncer nftables).\n\nMÉCANISMES : IDS → scénarios LAPI analysent les logs nginx/SSH/fail2ban → si score > seuil → décision de ban. IPS → bouncer firewall-iptables/nftables applique les décisions en L3 avant que le paquet atteigne nginx. WAF AppSec → ~150 vpatches CVE bloquent les exploits HTTP connus avant traitement applicatif.\n\nMÉTRIQUES SURVEILLÉES : décisions actives (IPs bannies) · alertes 24h · vélocité bans/h · scénarios actifs (RECON · SCAN · EXPLOIT · BRUTE) · bouncers healthy · bytes/paquets bloqués.\n\nCOMPORTEMENT ATTENDU : bouncers ONLINE · décisions stables ou en baisse · alertes 24h proportionnelles au trafic. Un pic vélocité bans/h = vague d attaque en cours. Scénario EXPLOIT actif = priorité maximale.\n\nPIPELINE : logs nginx/SSH → CrowdSec LAPI → scénarios comportementaux → décisions → bouncer nftables → blocage L3 → monitoring.json → dashboard SOC.\n\nJARVIS (si online) : corrèle les décisions CrowdSec avec la Kill Chain. Si scénario EXPLOIT + décisions > seuil → analyse LLM + ban complémentaire via API + alerte vocale.\n\nVALEUR AJOUTÉE : là où fail2ban réagit à des règles fixes, CrowdSec détecte des comportements distribués — un attaquant qui sonde depuis 10 IPs différentes sera détecté même si chaque IP reste sous le seuil fail2ban. Partage de renseignements communautaires CTI en temps réel." data-panel-title="CROWDSEC — ANALYSE COMPORTEMENTALE" class="soc-panel-i" style="--pi-dim:rgba(0,217,255,.45);--pi-bright:rgba(0,217,255,.9);--pi-glow:rgba(0,217,255,.5)">ⓘ</span>'
    +'</div>'+inner;
}
// NDT-21c — panneau Fail2ban 4 hôtes (titre inclus)
function _paF2bPanel(f2b){
  var pvf2b=f2b.proxmox||{}, cltf2b=f2b.clt||{}, pa85f2b=f2b.pa85||{};
  var _f2bHostCount=[true,pvf2b.available===true,cltf2b.available===true,pa85f2b.available===true].filter(Boolean).length;
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
      +'<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.28rem">'+_activeJails+' jails actives · '+_allJails+' total · '+_f2bHostCount+' hôtes</div>'
      +_paHostMini('SRV-NGIX',f2b.jails||[],true,false)
      +_paHostMini('PROXMOX',pvf2b.jails||[],pvf2b.available,pvf2b.stale)
      +_paHostMini('CLT',cltf2b.jails||[],cltf2b.available,false)
      +_paHostMini('PA85',pa85f2b.jails||[],pa85f2b.available,false);
  return '<div style="font-size:var(--fs-xs);color:var(--orange);text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.35rem;display:flex;align-items:center;gap:.35rem">⊘ Fail2ban — '+_f2bHostCount+' hôtes'
    +'<span data-panel="RÔLE : protection locale contre les attaques répétées — analyse les logs système en temps réel et bannit automatiquement les IPs qui dépassent les seuils configurés. Couvre 4 hôtes indépendants : srv-nginx · Proxmox · CLT · PA85.\n\nMÉCANISME : scrute les logs (nginx · SSH · Apache) → détecte les patterns répétés (X échecs en Y secondes) → ban IP via iptables/nftables pour une durée configurable. Chaque hôte a ses propres jails, seuils et bantimes. Réaction en secondes.\n\nMÉTRIQUES SURVEILLÉES : bans actifs par hôte · jails actives / total · bantimes configurés · IPs récidivistes. Un hôte avec 0 bans = calme ou jail inactive — vérifier que les jails sont bien enabled.\n\nCOMPORTEMENT ATTENDU : bans en hausse = attaque en cours mais maîtrisée. Jails actives > 0 sur chaque hôte = protection en place. Si bans = 0 sur un hôte exposé (srv-nginx · CLT), investiguer l état des jails.\n\nPIPELINE : logs nginx/SSH/Apache → fail2ban daemon → règles iptables/nftables → monitoring_gen.py collecte statuts 4 hôtes → monitoring.json → dashboard SOC.\n\nJARVIS (si online) : corrèle les bans fail2ban avec la Kill Chain. Les bans SSH contribuent au score BRUTE. JARVIS peut escalader un ban fail2ban (temporaire) en décision CrowdSec (communautaire · permanent) si l IP atteint le niveau CRITIQUE.\n\nVALEUR AJOUTÉE : réaction locale ultra-rapide (secondes) sur des règles simples et fiables. Complémentaire à CrowdSec : fail2ban réagit vite sur des patterns simples, CrowdSec détecte des comportements distribués sur plusieurs IPs et plusieurs jours. Ensemble ils couvrent 100% du spectre de bruteforce." data-panel-title="FAIL2BAN — ÉTAT DÉTAILLÉ · 4 HÔTES" class="soc-panel-i" style="--pi-dim:rgba(255,107,53,.45);--pi-bright:rgba(255,107,53,.9);--pi-glow:rgba(255,107,53,.5)">ⓘ</span>'
    +'</div>'+inner;
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
   +'<div class="im-cnt-row">'
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
   +'<div class="im-cnt-row">'
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
   +'<div style="font-size:var(--fs-xs);color:var(--orange);text-transform:uppercase;letter-spacing:.9px;font-weight:700;margin-bottom:.32rem">◉ Attaques ciblées</div>'
   +'<div class="im-cnt-row">'
   +'<span style="font-size:var(--fs-2xl);font-weight:700;color:'+col+'">'+exploitActive+'</span>'
   +'<span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">IPs actives</span>'
   +'</div>'
   +(exploitCs>0?'<div style="font-size:var(--fs-xs);color:var(--red);margin-bottom:.18rem">⚡ '+exploitCs+' scénario'+(exploitCs>1?'s':'')+' CS EXPLOIT/BRUTE</div>':'')
   +(surSev1>0?'<div style="font-size:var(--fs-xs);color:var(--red);margin-bottom:.12rem">Suricata sév.1 : <b>'+surSev1+'</b> alerte'+(surSev1>1?'s critiques':'critique')+'</div>':'')
   +(topExplSc?'<div style="font-size:var(--fs-xs);color:var(--orange);font-family:\'Courier New\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(scName.slice(0,28))+'</div>':'')
   +(!exploitActive&&!exploitCs&&!surSev1?'<div style="font-size:var(--fs-xs);color:var(--green)">✓ Aucune attaque ciblée</div>':'')
   +'</div>';
}
function _renderIntelMenaces(d,g){
  var f2b=d.fail2ban||{};
  var kc=d.kill_chain||{}, sc=kc.stage_counts||{};
  var cs=d.crowdsec||{}, csStages=cs.stage_counts||{}, csSc=cs.scenarios||[];
  var sur=d.suricata||{};
  var cltf2b=f2b.clt||{}, pa85f2b=f2b.pa85||{};
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
      return `<tr><td style="font-size:var(--fs-xs);color:var(--text)">${esc(l)}</td><td>${e[1]}</td></tr>`;
    }).join('');
    g.insertAdjacentHTML('beforeend',
      '<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
      +'<div class="ct"><span class="ct-icon">◇</span>TOP PAGES 24H</div>'
      +'<table><tr><th>URL</th><th>REQ</th></tr>'
      +rowsHtml
      +'</table></div></div>');
  }
}

// NDT-168b — extracted from _renderTrafic24h: status row with label+bar+count+rate%
function _stRow(lbl,val,maxSt,req,col){
  var pct=Math.round(val*100/maxSt);
  var rateTxt=req>0?' <span style="color:rgba(255,255,255,.22);font-weight:400">'+Math.round(val*100/req)+'%</span>':'';
  return '<div style="display:flex;align-items:center;gap:.3rem;margin:.08rem 0;font-size:var(--fs-xs)">'
    +'<span style="width:2.5rem;color:var(--muted);flex-shrink:0;letter-spacing:.4px">'+lbl+'</span>'
    +'<div style="flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden">'
    +'<div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:2px"></div></div>'
    +'<span style="width:2.8rem;text-align:right;color:'+col+';font-family:\'Courier New\',monospace;font-weight:700">'+fmt(val)+'</span>'
    +rateTxt
    +'</div>';
}
function _renderTrafic24h(d,g){
  var t=d.traffic||{};
  var req=t.total_requests||0;
  var ok=t.status_2xx||0, redir=t.status_3xx||0;
  var err=(t.status_4xx||0)+(t.status_5xx||0);
  var bots=t.bots||0, vis=t.unique_visitors||0;
  var errHigh=err>0&&req>0&&(err/req)>0.05;

  // 3 gradient cards
  var _gc=[
    {val:fmt(req),               lbl:'REQUÊTES',         rgb:'0,217,255'},
    {val:fmt(vis),               lbl:'VISITEURS UNIQUES', rgb:'0,255,136'},
    {val:fmtB(t.total_bytes||0), lbl:'VOLUME',            rgb:'122,154,184'},
  ];
  var cardsHtml='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin-bottom:.42rem">'
    +_gc.map(function(c){
      return '<div style="background:linear-gradient(135deg,rgba('+c.rgb+',.09),rgba('+c.rgb+',.02));border:1px solid rgba('+c.rgb+',.22);border-radius:6px;padding:.42rem .3rem;text-align:center;position:relative;overflow:hidden">'
        +'<div style="position:absolute;bottom:.1rem;right:.3rem;font-size:var(--fs-lg);color:rgba('+c.rgb+',.06);font-weight:900;line-height:1">◇</div>'
        +'<div style="font-size:var(--fs-xl);font-weight:700;color:rgb('+c.rgb+');font-family:\'Courier New\',monospace;line-height:1">'+c.val+'</div>'
        +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+c.rgb+',.45);text-transform:uppercase;letter-spacing:.6px;margin-top:.18rem">'+c.lbl+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  // Status rows with proportional bars
  var maxSt=Math.max(ok,redir,err,bots,1);
  var statusHtml=_prxSec('STATUTS HTTP','var(--cyan)')
    +_stRow('2XX', ok,   maxSt,req,'var(--green)')
    +_stRow('3XX', redir,maxSt,req,'var(--yellow)')
    +_stRow('ERR', err,  maxSt,req,errHigh?'var(--red)':'rgba(239,68,68,.5)')
    +_stRow('BOT', bots, maxSt,req,'rgba(122,154,184,.55)');

  // Bar chart
  var chartHtml='';
  var hours=Object.entries(t.requests_per_hour||{});
  if(hours.length){
    var mx=Math.max.apply(null,hours.map(function(hh){return hh[1]||0}))||1;
    var barsHtml=hours.map(function(hr){
      var ht=Math.round(hr[1]*46/mx)+2;
      return '<div class="bar-col"><div style="height:'+ht+'px" title="'+esc(hr[0])+': '+hr[1]+'"></div></div>';
    }).join('');
    chartHtml='<div class="chart-wrap"><div class="chart-lbl">// Requetes / heure</div><div class="chart">'+barsHtml+'</div></div>';
  }

  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct"><span class="ct-icon">◇</span>TRAFIC 24H</div>'
    +cardsHtml+statusHtml;
  g.insertAdjacentHTML('beforeend',h+chartHtml+'</div></div>');
}


// ── Chaîne de défense automatique ①②③④⑤ ──────────────────────────────────
function _rsyslogDefChainHtml(d,rs,xh){
  var kc=d.kill_chain||{},cs=d.crowdsec||{},evts=d.events||[];
  var activeIps=(kc.active_ips||[]).length,neutralized=kc.neutralized_count||0;
  var banCount=cs.active_decisions||0,banEvts=evts.filter(function(e){return e.type==='f2b_ban';}).length;
  var corrCount=xh.corr_count||0,svcOk=(rs.service||'')==='active';
  var hosts=rs.hosts||{},totalFiles=rs.log_files||0;
  var linesTotal=Object.keys(hosts).reduce(function(s,k){return s+((hosts[k]||{}).lines_min||0);},0);
  var jvAct=0;try{jvAct=((window._jvAutoState||{}).actionLog||[]).filter(function(a){return Date.now()-new Date(a.ts).getTime()<_MS_PER_DAY;}).length;}catch(e){}
  var jvModel=(typeof _jvActiveModel!=='undefined'&&_jvActiveModel)||'phi4-reasoning';
  var S=[
    {n:'①',lbl:'COLLECTE',col:svcOk?_COL_MATGREEN_HEX:_COL_RED_HEX,on:svcOk,
     desc:'rsyslog :514 TCP/UDP — srv-nginx centralise tous les logs LAN',
     stat:totalFiles+' fichiers · '+linesTotal+' L/min'},
    {n:'②',lbl:'CORRÉLATION',col:_COL_TEAL_HEX,on:true,
     desc:'monitoring_gen.py — cycle 60s — croise logs, kill chain et routeur',
     stat:corrCount+' corrélation'+(corrCount!==1?'s':'')+' kill chain↔routeur'},
    {n:'③',lbl:'DÉTECTION',col:activeIps>0?_COL_MATORANGE_HEX:'rgba(185,215,240,.4)',on:activeIps>0||neutralized>0,
     desc:'Kill Chain classe les IPs (RECON→SCAN→EXPLOIT→BRUTE→NEUTRALISÉ)',
     stat:activeIps+' IP'+(activeIps!==1?'s':'')+' active'+(activeIps!==1?'s':'')+' · '+neutralized+' neutralisée'+(neutralized!==1?'s':'')},
    {n:'④',lbl:'RÉPONSE AUTO',col:banCount>0?_COL_MATGREEN_HEX:'rgba(185,215,240,.4)',on:banEvts>0||banCount>0,
     desc:'fail2ban + CrowdSec bannissent — SOC auto-ban si niveau ÉLEVÉ/CRITIQUE',
     stat:banCount+' IP'+(banCount!==1?'s':'')+' bannies · '+banEvts+' ban'+(banEvts!==1?'s':'')+'/24h'},
    {n:'⑤',lbl:'JARVIS IA',col:jvAct>0?_COL_JARVIS_HEX:'rgba(206,147,216,.4)',on:jvAct>0,
     desc:jvModel+' · synthèse LLM · alerte vocale · intervient si rien fait',
     stat:jvAct>0?(jvAct+' intervention'+(jvAct!==1?'s':'')+'/24h'):'Veille — agit si menace non traitée'}
  ];
  var h='<div style="margin:.5rem 0;border:1px solid rgba(0,188,212,.16);border-radius:5px;overflow:hidden">'
    +'<div style="background:rgba(0,188,212,.06);padding:.24rem .5rem;font-size:var(--fs-xs);color:var(--teal);letter-spacing:.5px;border-bottom:1px solid rgba(0,188,212,.13)">⬡ CHAÎNE DE DÉFENSE — MÉCANISME AUTOMATIQUE</div>'
    +'<div style="padding:.28rem .38rem">';
  S.forEach(function(s,i){
    var bc=s.on?'rgba(0,188,212,.05)':'rgba(255,255,255,.01)';
    var bd=s.on?'rgba(0,188,212,.16)':'rgba(255,255,255,.04)';
    h+='<div style="display:grid;grid-template-columns:1.4rem 6rem 1fr auto;gap:0 .4rem;padding:.2rem .32rem;background:'+bc+';border:1px solid '+bd+';border-radius:3px;align-items:center;margin-bottom:.07rem">'
      +'<span style="font-size:var(--fs-sm);color:'+s.col+';font-weight:700;text-align:center">'+s.n+'</span>'
      +'<span style="font-size:var(--fs-xs);color:'+s.col+';font-weight:700;font-family:\'Courier New\',monospace">'+esc(s.lbl)+'</span>'
      +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.5)">'+esc(s.desc)+'</span>'
      +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.38);white-space:nowrap;text-align:right">'+esc(s.stat)+'</span>'
      +'</div>';
    if(i<S.length-1)h+='<div style="margin:.04rem 0 .04rem .45rem;width:1px;height:.38rem;background:rgba(0,188,212,.18)"></div>';
  });
  h+='</div></div>';
  return h;
}
// ── JARVIS surveillance & intervention proactive ───────────────────────────
// Helpers IoC POST-COMPROMISSION (Sprint 18b 2026-05-16) — consomment d.ioc
function _iocBarHtml(score,level){
  var pct=Math.max(0,Math.min(100,score|0));
  var col=level==='CRIT'?_COL_BAN_BTN_HEX:level==='WARN'?_COL_MATORANGE_HEX:_COL_MATGREEN_HEX;
  var rgb=level==='CRIT'?'255,32,96':level==='WARN'?'255,152,0':'76,175,80';
  return '<div style="display:flex;align-items:center;gap:.32rem;flex:1">'
    +'<div style="flex:1;height:.55rem;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.06);border-radius:2px;overflow:hidden;position:relative">'
    +'<div style="width:'+pct+'%;height:100%;background:'+col+';box-shadow:0 0 4px rgba('+rgb+',.55);transition:width .35s ease"></div></div>'
    +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:'+col+';font-weight:700;min-width:5.5rem;text-align:right">'+pct+'/100 '+esc(level)+'</span>'
    +'</div>';
}
function _iocSignalsCompactHtml(signals){
  var defs=[['aide_drift','AIDE'],['c2_alerts','C2'],['ssh_anomaly','SSH'],
            ['webshells','Webshells'],['apparmor_denials','AppArmor'],['sudo_events','Sudo']];
  return defs.map(function(p){
    var s=signals[p[0]]||{count:0,score:0},c=s.count|0,sc=s.score|0;
    var col=sc>0?(sc>=15?_COL_BAN_BTN_HEX:_COL_MATORANGE_HEX):'rgba(206,147,216,.5)';
    return '<span style="font-family:\'Courier New\',monospace;font-size:calc(var(--fs-xs) - 1px);color:'+col+';white-space:nowrap">'
      +esc(p[1])+' <strong>'+c+'</strong></span>';
  }).join('<span style="color:rgba(206,147,216,.22)"> · </span>');
}
function _rsyslogJarvisProactiveHtml(d,xh){
  // C2 OUTBOUND (router_seen) retiré 2026-05-17
  var ma=Object.keys(xh.multi_apache||{});
  var seen={},threats=[];
  ma.forEach(function(ip){if(!seen[ip]){seen[ip]=1;threats.push({ip:ip,cat:'RECON MULTI-CIBLES',col:_COL_MATORANGE_HEX,rgb:'255,152,0'});}});
  var m=(typeof _jvActiveModel!=='undefined'&&_jvActiveModel)||'phi4-reasoning';
  // IoC POST-COMPROMISSION (Sprint 18b) — bloc `ioc` pré-calculé par ioc_collect.py
  var ioc=d.ioc||{score:0,level:'OK',signals:{}};
  var iocCrit=ioc.level==='CRIT',iocWarn=ioc.level==='WARN';
  // Statut header : IoC CRIT prend priorité, sinon menace réseau
  var stLbl,stCol;
  if(iocCrit && threats.length>0){stLbl='⚠ IoC CRIT + MENACE — ALERTE';stCol=_COL_BAN_BTN_HEX;}
  else if(iocCrit)                {stLbl='⚠ IoC CRIT — ALERTE';        stCol=_COL_BAN_BTN_HEX;}
  else if(threats.length>0)       {stLbl='MENACE — PRÊT À INTERVENIR';  stCol=_COL_MATORANGE_HEX;}
  else if(iocWarn)                {stLbl='⚠ IoC WARN — surveillance';   stCol=_COL_MATORANGE_HEX;}
  else                            {stLbl='VEILLE ACTIVE';               stCol=_COL_MATGREEN_HEX;}
  var intervenes=threats.length>0||iocCrit;
  var fl=[
    {l:'① SURVEILLE', s:'rsyslog 24h/7j + IoC 6 signaux', on:true},
    {l:'② ANALYSE',   s:'LLM '+m+' + score IoC',          on:true},
    {l:'③ INTERVIENT',s:'Si menace OU IoC CRIT',          on:intervenes},
  ];
  var h='<div style="border:1px solid rgba(156,39,176,.22);border-radius:5px;margin:.4rem 0;overflow:hidden">'
    +'<div style="background:rgba(156,39,176,.07);padding:.24rem .5rem;display:flex;align-items:center;gap:.4rem;border-bottom:1px solid rgba(156,39,176,.16)">'
    +'<span style="font-size:var(--fs-xs);color:'+_COL_JARVIS_HEX+';letter-spacing:.5px;font-weight:700">◈ JARVIS — SURVEILLANCE &amp; INTERVENTION PROACTIVE</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:'+stCol+';margin-left:auto;font-family:\'Courier New\',monospace;font-weight:700">'+esc(stLbl)+'</span>'
    +'</div><div style="padding:.28rem .42rem">'
    +'<div style="display:flex;align-items:stretch;gap:.18rem;margin-bottom:.28rem">';
  fl.forEach(function(f,i){
    var fc=f.on?_COL_JARVIS_HEX:'rgba(206,147,216,.28)';
    h+='<div style="flex:1;background:'+(f.on?'rgba(156,39,176,.09)':'rgba(156,39,176,.02)')+';border:1px solid '+(f.on?'rgba(156,39,176,.28)':'rgba(156,39,176,.07)')+';border-radius:3px;padding:.14rem .22rem;text-align:center">'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:'+fc+';font-weight:700;font-family:\'Courier New\',monospace;line-height:1.3">'+esc(f.l)+'</div>'
      +'<div style="font-size:calc(var(--fs-xs) - 2px);color:rgba(206,147,216,.38);line-height:1.2">'+esc(f.s)+'</div>'
      +'</div>';
    if(i<fl.length-1)h+='<div style="display:flex;align-items:center;color:rgba(156,39,176,.35);font-size:var(--fs-xs);padding:0 .04rem">→</div>';
  });
  h+='</div>';
  // Bloc IoC POST-COMPRO (Sprint 18b) — barre score + 6 compteurs compacts
  h+='<div style="border-top:1px solid rgba(156,39,176,.14);padding:.22rem 0 .12rem 0;margin-bottom:.18rem">'
    +'<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.14rem">'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:'+_COL_JARVIS_HEX+';font-weight:700;font-family:\'Courier New\',monospace;white-space:nowrap">◈ IoC POST-COMPRO</span>'
    +_iocBarHtml(ioc.score||0,ioc.level||'OK')
    +'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:.18rem;align-items:center">'
    +_iocSignalsCompactHtml(ioc.signals||{})
    +'</div>'
    +'</div>';
  if(threats.length){
    h+='<div style="border-top:1px solid rgba(255,32,96,.14);padding-top:.22rem">'
      +'<div style="font-size:var(--fs-xs);color:'+_COL_BAN_BTN_HEX+';font-weight:700;margin-bottom:.16rem">⚠ '+threats.length+' IP'+(threats.length>1?'s':'')+' non traitée'+(threats.length>1?'s':'')+' — JARVIS peut intervenir</div>'
      +'<div style="display:flex;flex-direction:column;gap:.12rem">'
      +threats.map(function(t){
        return '<div style="display:flex;align-items:center;gap:.35rem;background:rgba('+t.rgb+',.07);border:1px solid rgba('+t.rgb+',.18);border-radius:3px;padding:.12rem .3rem">'
          +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:'+t.col+';min-width:9rem;font-weight:600">'+esc(t.ip)+'</span>'
          +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.38);flex:1">'+esc(t.cat)+'</span>'
          +'<button class="rs-ban-btn" data-ip="'+esc(t.ip)+'" style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(255,32,96,.14);border:1px solid rgba(255,32,96,.38);color:'+_COL_BAN_BTN_HEX+';border-radius:3px;padding:.11rem .35rem;cursor:pointer">🚫 BANNIR</button>'
          +'</div>';
      }).join('')
      +'</div>'
      +'<button id="rs-jv-all" style="margin-top:.25rem;width:100%;font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(156,39,176,.14);border:1px solid rgba(156,39,176,.4);color:'+_COL_JARVIS_HEX+';border-radius:3px;padding:.2rem;cursor:pointer;letter-spacing:.25px">◈ JARVIS INTERVIENT — bannir les '+threats.length+' IP'+(threats.length>1?'s':'')+' proactivement</button>'
      +'</div>';
  }else if(!iocCrit){
    h+='<span style="font-size:var(--fs-xs);color:rgba(206,147,216,.38);font-style:italic">Aucune menace non traitée — JARVIS surveille en veille active</span>';
  }
  h+='</div></div>';
  return h;
}
// ── Rsyslog tile + modal → fichier 07a-render-rsyslog.js (Sprint 2B 2026-05-16) ─
// (chargé avant 07-render.js dans index.html, fonctions globalement hoistées)


function _renderJarvisTiles(d,g){
  var th='<div class="card half" id="jv-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◈</span>JARVIS — INTELLIGENCE PROACTIVE'
    +'<span data-panel="RÔLE : assistant IA local SOAR — surveille le SOC en continu, analyse les menaces en temps réel, déclenche des actions défensives autonomes. Tourne entièrement en local via Ollama — aucune donnée envoyée en cloud.\n\nMÉCANISME : auto-engine toutes les 5 min → lecture monitoring.json → LLM analyse le contexte (IPs actives, score menace, services, bans) → si niveau ÉLEVÉ ou CRITIQUE → ban IP automatique via CrowdSec + alerte vocale TTS + entrée dans le journal ◈ SOC. JARVIS peut aussi débannir, redémarrer un service, et escalader si la menace persiste.\n\nMÉTRIQUES SURVEILLÉES : score de menace global · IPs actives Kill Chain · nouveaux bans CrowdSec · services DOWN · état AID · pics de trafic rsyslog · récidivistes.\n\nCOMPORTEMENT ATTENDU : statut ONLINE · ⚡ ENGINE actif · dernière analyse visible dans la tuile · journal ◈ SOC peuplé. Cycle 5 min toléré si Ollama charge un modèle lourd.\n\nPIPELINE : monitoring.json → jarvis.py (Flask · localhost:5000) → Ollama (phi4-reasoning:plus) → décision LLM → CrowdSec ban/unban → SOC dashboard mis à jour au prochain cycle.\n\nVALEUR AJOUTÉE : transforme la détection passive en réponse active autonome. Sans JARVIS, chaque ban est une action manuelle. Avec JARVIS, les IP CRITIQUE sont bannies en moins de 5 min — même la nuit, sans intervention humaine. Modèle local RTX 5080 · 16 Go GDDR7 · inférence < 30s." data-panel-title="JARVIS — INTELLIGENCE PROACTIVE" class="soc-panel-i" style="--pi-dim:rgba(191,95,255,.45);--pi-bright:rgba(191,95,255,.9);--pi-glow:rgba(191,95,255,.5)">ⓘ</span>'
    +'</div>'
    +buildJarvisTileInner()
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',th);
  th='<div class="card" id="sec-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct" style="color:'+_COL_RTR_TX_HEX+'"><span class="ct-icon">⚡</span>BLOCKLIST LLM — GARDE-FOU</div>'
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
    +'<div style="font-size:var(--fs-xs);color:rgba(0,255,136,0.4);font-family:\'Courier New\',monospace;letter-spacing:.4px;margin-bottom:.45rem">Actions automatiques déclenchées par JARVIS sur srv-nginx</div>'
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
   +'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.7)">'+esc(errDesc)+'</div>'
   +'</div>'
   +'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.5);margin:.3rem 0">Le token Freebox doit être regénéré.</div>'
   +'<div style="font-size:var(--fs-xs);color:rgba(255,160,0,0.65);cursor:pointer">▶ Voir la procédure de revalidation →</div>'
   +'</div></div>';
}
// NDT-169 — extracted from _fbxMainTileHtml: speed card with gradient + bar (isDown explicit param)
function _spd(arrow,lbl,col,speed,bwMax,pct,isDown){
  return '<div style="background:linear-gradient(135deg,rgba('+col+',.09),rgba('+col+',.02));border:1px solid rgba('+col+',.2);border-radius:6px;padding:.32rem .42rem">'
    +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.18rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba('+col+',.5);text-transform:uppercase;letter-spacing:.5px">'+arrow+' '+lbl+'</span>'
    +(bwMax&&!isDown&&pct>=1?'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+col+',.3)">'+pct+'%</span>':'')
    +'</div>'
    +'<div style="font-size:var(--fs-md);font-weight:700;color:rgb('+col+');font-family:\'Courier New\',monospace;line-height:1">'+(isDown?'HORS LIGNE':_fbxFmtK(speed))+'</div>'
    +(bwMax&&!isDown
      ?'<div style="height:3px;background:rgba('+col+',.1);border-radius:2px;margin:.2rem 0">'
       +'<div style="height:100%;min-width:'+(pct<1&&speed>0?'3px':'0')+';width:'+pct+'%;background:linear-gradient(90deg,rgba('+col+',.45),rgb('+col+'));border-radius:2px"></div></div>'
       +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+col+',.3)">max '+_fbxFmtK(bwMax)+'</div>'
      :'')
    +'</div>';
}
// NDT-27e — tuile principale Freebox (débit WAN/LAN + SFP + répéteur) → retourne HTML string
// ── _fbxMainTileHtml helpers ─────────────────────────────────────────────────
function _fbxSd(lbl,rgb){
  rgb=rgb||'0,217,255';
  return '<div style="display:flex;align-items:center;gap:.4rem;margin:.42rem 0 .28rem">'
    +'<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba('+rgb+',.18),transparent)"></div>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+rgb+',.4);text-transform:uppercase;letter-spacing:.9px;white-space:nowrap">'+lbl+'</span>'
    +'<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba('+rgb+',.18))"></div>'
    +'</div>';
}
function _fbxRepSectionHtml(reps){
  if(!reps.length) return '';
  var repCards=reps.map(function(r){
    var online=r.connection==='connected'&&r.status==='running';
    var rRgb=online?'191,95,255':'255,59,92';
    var band=r.bh_band==='5g'?'5 GHz':r.bh_band==='2d4g'?'2.4 GHz':r.bh_band==='6g'?'6 GHz':(r.bh_band||'—');
    var sig=r.bh_signal,sRgb,sQ;
    if(sig!=null){
      if(sig>=-55){sRgb='0,217,100';sQ='EXCELLENT';}
      else if(sig>=-65){sRgb='0,217,255';sQ='BON';}
      else if(sig>=-75){sRgb='255,149,0';sQ='MOYEN';}
      else{sRgb='255,59,92';sQ='FAIBLE';}
    } else {sRgb='122,154,184';sQ='—';}
    var sigPct=sig!=null?Math.min(100,Math.max(0,Math.round((sig+90)/50*100))):0;
    var tput=r.bh_throughput?_fbxBps2s(r.bh_throughput):'—';
    var plac=r.bh_placement!=null?r.bh_placement+'/100':'—';
    return '<div style="background:linear-gradient(135deg,rgba('+rRgb+',.08),rgba('+rRgb+',.02));border:1px solid rgba('+rRgb+',.22);border-radius:6px;padding:.32rem .42rem">'
      +'<div style="display:flex;align-items:center;gap:.38rem;margin-bottom:.25rem">'
      +'<span style="font-size:var(--fs-xs);font-weight:700;color:rgb('+rRgb+')">⬡ '+esc(r.name||'Répéteur')+'</span>'
      +'<span style="font-size:calc(var(--fs-xs) - 1px);padding:.03rem .25rem;background:rgba('+(online?'0,217,100':'255,59,92')+',.08);border:1px solid rgba('+(online?'0,217,100':'255,59,92')+',.3);border-radius:2px;color:'+(online?'var(--green)':'var(--red)')+'">'+( online?'● CONNECTÉ':'● HORS LIGNE')+'</span>'
      +(r.ip?'<span style="margin-left:auto;font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.45);font-family:\'Courier New\',monospace">'+esc(r.ip)+'</span>':'')
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:.32rem;margin-bottom:.2rem">'
      +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.5);min-width:3rem">'+esc(band)+'</span>'
      +(sig!=null?'<span style="font-size:var(--fs-xs);font-weight:700;color:rgb('+sRgb+');font-family:\'Courier New\',monospace;min-width:3.8rem">'+sig+' dBm</span>':'')
      +'<div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">'
      +'<div style="height:100%;width:'+sigPct+'%;background:linear-gradient(90deg,rgba('+sRgb+',.4),rgb('+sRgb+'));border-radius:2px"></div>'
      +'</div>'
      +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgb('+sRgb+');font-weight:700;min-width:4.2rem;text-align:right">'+esc(sQ)+'</span>'
      +'</div>'
      +'<div style="display:flex;gap:.55rem;font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.45)">'
      +(tput!=='—'?'<span>⟁ '+esc(tput)+'</span>':'')
      +(r.bh_placement!=null?'<span>⊕ '+esc(plac)+'</span>':'')
      +(r.fh_count?'<span style="margin-left:auto">'+r.fh_count+' SSID'+(r.fh_count>1?'s':'')+'</span>':'')
      +'</div>'
      +'</div>';
  }).join('');
  return _fbxSd('RÉPÉTEUR WIFI','191,95,255')+repCards;
}
function _fbxInfraSectionHtml(fbx){
  var sfpQ=fbx.sfp_quality;
  var sfpRgb=sfpQ==='FAIBLE'?'255,59,92':sfpQ==='CORRECT'?'255,149,0':sfpQ==='BON'?'0,217,100':'0,217,255';
  var sl=fbx.sfp_lan||null;
  var slRgb=sl&&sl.link==='up'?'0,255,136':'255,59,92';
  var temps=fbx.temps||[];
  var tempMax=temps.length?Math.max.apply(null,temps.map(function(t){return t.value||0;})):null;
  var tRgb=tempMax===null?'122,154,184':tempMax>70?'255,59,92':tempMax>55?'255,149,0':'0,217,100';
  var tPct=tempMax!=null?Math.min(100,Math.max(0,Math.round((tempMax-30)/60*100))):0;
  var rxPct=fbx.sfp_pwr_rx!=null?Math.min(100,Math.max(0,Math.round((fbx.sfp_pwr_rx+32)/27*100))):0;
  var infraCards='';
  if(sl){
    infraCards+='<div style="flex:2;padding:.3rem .4rem;background:rgba(0,0,0,.18);border:1px solid rgba('+slRgb+',.2);border-radius:5px">'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.38);text-transform:uppercase;margin-bottom:.12rem">SFP LAN 10G</div>'
      +'<div style="display:flex;align-items:center;gap:.35rem">'
      +'<span style="font-size:var(--fs-xs);font-weight:700;color:rgb('+slRgb+')">'+(sl.link==='up'?'● UP':'● DOWN')+'</span>'
      +'<span style="font-size:var(--fs-xs);color:var(--cyan)">↑'+_fbxBps2s(sl.tx_bps)+'</span>'
      +'<span style="font-size:var(--fs-xs);color:var(--green)">↓'+_fbxBps2s(sl.rx_bps)+'</span>'
      +'<span style="margin-left:auto;font-size:calc(var(--fs-xs) - 1px);color:'+(sl.fcs_errors>0?'var(--red)':'rgba(255,255,255,.18)')+'">FCS:'+sl.fcs_errors+'</span>'
      +'</div></div>';
  }
  if(fbx.sfp_pwr_rx!=null){
    infraCards+='<div style="flex:1;padding:.3rem .4rem;background:rgba(0,0,0,.18);border:1px solid rgba('+sfpRgb+',.2);border-radius:5px">'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.38);text-transform:uppercase;margin-bottom:.12rem">GPON RX</div>'
      +'<div style="font-size:var(--fs-xs);font-weight:700;color:rgb('+sfpRgb+');font-family:\'Courier New\',monospace">'+fbx.sfp_pwr_rx+' dBm</div>'
      +'<div style="height:3px;background:rgba('+sfpRgb+',.1);border-radius:2px;margin:.14rem 0">'
      +'<div style="height:100%;width:'+rxPct+'%;background:rgb('+sfpRgb+');border-radius:2px"></div></div>'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+sfpRgb+',.7)">'+esc(sfpQ||'—')+'</div>'
      +'</div>';
  }
  if(tempMax!=null){
    infraCards+='<div style="flex:1;padding:.3rem .4rem;background:rgba(0,0,0,.18);border:1px solid rgba('+tRgb+',.2);border-radius:5px">'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.38);text-transform:uppercase;margin-bottom:.12rem">CPU MAX</div>'
      +'<div style="font-size:var(--fs-xs);font-weight:700;color:rgb('+tRgb+');font-family:\'Courier New\',monospace">'+tempMax+' °C</div>'
      +'<div style="height:3px;background:rgba('+tRgb+',.1);border-radius:2px;margin:.14rem 0">'
      +'<div style="height:100%;width:'+tPct+'%;background:rgb('+tRgb+');border-radius:2px"></div></div>'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+tRgb+',.7)">'+(tempMax>70?'CHAUD':tempMax>55?'TIÈDE':'NORMAL')+'</div>'
      +'</div>';
  }
  return infraCards?_fbxSd('INFRASTRUCTURE','122,154,184')+'<div style="display:flex;gap:.3rem">'+infraCards+'</div>':'';
}
function _fbxMainTileHtml(wm, fbx){
  var wmSt=wm.status||'UP';
  var isDown=wmSt==='DOWN_ISP'||wmSt==='DOWN_LOCAL';
  var tileStyle=isDown?'border-color:rgba(255,50,50,0.4)':'';
  var stBcls=wmSt==='UP'?'fbx-up':wmSt==='DEGRADED'?'fbx-deg':'fbx-down';
  var stLbl={'UP':'STABLE','DOWN_ISP':'PANNE FAI','DOWN_LOCAL':'PANNE LOCALE','DEGRADED':'DÉGRADÉ'};
  var boxMs=wm.box&&wm.box.ms!=null?wm.box.ms+' ms':'—';
  var wanMs=wm.wan&&wm.wan.ms!=null?wm.wan.ms+' ms':'—';
  var statusRow='<div style="display:flex;align-items:center;gap:.45rem;margin:.2rem 0 .3rem">'
    +'<span class="fbx-badge '+stBcls+'">'+esc(stLbl[wmSt]||wmSt)+'</span>'
    +(fbx.ipv4?'<span style="font-size:var(--fs-xs);color:var(--muted);font-family:\'Courier New\',monospace">'+esc(fbx.ipv4)+'</span>':'')
    +(fbx.uptime_s?'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,255,.28)">'+_fbxFmtDur(fbx.uptime_s)+'</span>':'')
    +'<span style="margin-left:auto;font-size:var(--fs-xs);color:rgba(0,217,255,.4)">▶ détails</span>'
    +'</div>';
  var dwPct=fbx.bandwidth_down>0?Math.min(100,Math.round(fbx.rate_down/fbx.bandwidth_down*100)):0;
  var upPct=fbx.bandwidth_up>0?Math.min(100,Math.round(fbx.rate_up/fbx.bandwidth_up*100)):0;
  var probeRow=_fbxSd('CONNECTIVITÉ')
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;margin-bottom:.05rem">'
    +_fbxProbeHtml('BOX',wm.box&&wm.box.ok,boxMs)
    +_fbxProbeHtml('WAN',wm.wan&&wm.wan.ok,wanMs)
    +_fbxProbeHtml('HTTP',wm.http_ok,'OK')
    +'</div>';
  var speedRow=_fbxSd('DÉBITS')
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem">'
    +_spd('↓','DOWNLOAD','0,217,255',fbx.rate_down,fbx.bandwidth_down,dwPct,isDown)
    +_spd('↑','UPLOAD','0,255,136',fbx.rate_up,fbx.bandwidth_up,upPct,isDown)
    +'</div>';
  return '<div class="card half" id="fbx-tile" style="'+tileStyle+'">'
    +'<div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">⬡</span>FREEBOX DELTA — BOX &amp; WAN</div>'
    +statusRow+probeRow+speedRow+_fbxRepSectionHtml(fbx.repeaters||[])+_fbxInfraSectionHtml(fbx)
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

// ── SYSTEME SRV-NGIX — même style que tuile Proxmox
// ── _sysCardHtml helpers ─────────────────────────────────────────────────────
function _sysCardNginxHtml(traffic){
  var totalReq=traffic.total_requests||0;
  var errRate=((traffic.error_rate||0)).toFixed(1);
  var s2=traffic.status_2xx||0,s3=traffic.status_3xx||0,s4=traffic.status_4xx||0,s5=traffic.status_5xx||0;
  var errCol=parseFloat(errRate)>5?'var(--red)':parseFloat(errRate)>2?'var(--yellow)':'var(--green)';
  var s4Col=s4>500?'var(--yellow)':'rgba(122,154,184,.6)';
  var s5Col=s5>0?'var(--red)':'var(--c-muted-4)';
  return _prxSec('NGINX — MOTEUR','var(--cyan)')
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.12rem .5rem;font-size:var(--fs-xs);margin-bottom:.18rem">'
    +'<span style="color:var(--muted)">Req 24h <span style="color:var(--cyan);font-weight:700;font-family:\'Courier New\',monospace">'+totalReq.toLocaleString('fr-FR')+'</span></span>'
    +'<span style="color:var(--muted)">Erreurs <span style="color:'+errCol+';font-weight:700">'+errRate+'%</span></span>'
    +'<span style="color:var(--muted)">IPs uniques <span style="color:var(--text)">'+( traffic.unique_ips||0)+'</span></span>'
    +'<span style="color:var(--muted)">Bots <span style="color:'+(( traffic.bots||0)>100?'var(--yellow)':'rgba(122,154,184,.5)')+'">'+( traffic.bots||0)+'</span></span>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;font-family:\'Courier New\',monospace">'
    +'<span style="font-size:var(--fs-xs);color:var(--c-muted-4)">2xx</span><span style="font-size:var(--fs-xs);color:var(--green)">'+s2.toLocaleString('fr-FR')+'</span>'
    +'<span style="color:rgba(255,255,255,.08)">·</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--c-muted-4)">3xx</span><span style="font-size:var(--fs-xs);color:rgba(0,217,255,.6)">'+s3.toLocaleString('fr-FR')+'</span>'
    +'<span style="color:rgba(255,255,255,.08)">·</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--c-muted-4)">4xx</span><span style="font-size:var(--fs-xs);color:'+s4Col+'">'+s4+'</span>'
    +'<span style="color:rgba(255,255,255,.08)">·</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--c-muted-4)">5xx</span><span style="font-size:var(--fs-xs);color:'+s5Col+'">'+s5+'</span>'
    +'</div>';
}
function _sysCardCmHtml(ufwOk, fw, f2bBans, conf){
  var f2bCol=f2bBans>0?'var(--red)':'var(--green)';
  var confCol=conf===undefined?'var(--muted)':conf>=90?'var(--green)':conf>=70?'var(--yellow)':'var(--red)';
  return '<div style="margin-top:.45rem;padding:.28rem .45rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:3px">'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.2rem">// Contre-mesures</div>'
    +'<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    +'<span style="font-size:var(--fs-xs);color:'+(ufwOk?'var(--green)':'var(--red)')+'">■ UFW '+(ufwOk?'ACTIVE':'INACTIVE')+'</span>'
    +'<span style="color:rgba(255,255,255,0.1)">│</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">Règles : <span style="color:var(--cyan)">'+(fw.ufw_rules||0)+'</span></span>'
    +'<span style="color:rgba(255,255,255,0.1)">│</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">Fail2ban : <span style="color:'+f2bCol+'">'+f2bBans+' bans</span></span>'
    +(conf!=null?'<span style="color:rgba(255,255,255,0.1)">│</span><span style="font-size:var(--fs-xs);color:var(--muted)">Conformité : <span style="color:'+confCol+'">'+conf+'/100</span></span>':'')
    +'</div></div>';
}
function _sysCardHtml(sys,d){
  var mem=sys.memory||{},load=sys.load||{};
  var cpu=sys.cpu_pct||0,cores=sys.cpu_cores||0;
  var sysSvcs=d.sys_services||{};
  var sysCpuHist=d.sys_cpu_history||[];
  var cpuCol=cpu>_THR_CPU_CRIT?'var(--red)':cpu>_THR_CPU_WARN?'var(--yellow)':'var(--cyan)';
  var lc=load['1m']?(parseFloat(load['1m'])>cores?'var(--red)':parseFloat(load['1m'])>cores*0.7?'var(--yellow)':'var(--cyan)'):'var(--muted)';
  var traffic=d.traffic||{};
  var nginxInfo=d.nginx_info||{};
  var fw=((d.firewall_matrix&&d.firewall_matrix.hosts)||[]).find(function(h){return h.name==='srv-nginx';})||{};
  var f2bBans=(d.fail2ban||{}).total_banned||0;
  var ufwOk=fw.ufw_active===true;
  var conf=fw.conformity;
  var ngxVer=nginxInfo.version?'nginx/'+nginxInfo.version:null;
  var ngxWorkers=nginxInfo.workers!=null?nginxInfo.workers:cores;
  return '<div class="card half" id="sys-nginx-card" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◈</span>SYSTEME — SRV-NGIX</div>'
    +_prxSec('PROCESSEUR','var(--cyan)')
    +'<div class="cpu-wrap">'
    +'<div class="cpu-ring" style="width:52px;height:52px">'+ring(cpu,cpuCol,52)
    +'<div class="ring-text"><span class="ring-pct" style="font-size:var(--fs-xs);color:'+cpuCol+'">'+cpu+'%</span><span class="ring-core">CPU</span></div></div>'
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.1rem">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:.3rem">'
    +'<div class="pve-node-name" style="color:var(--cyan);text-shadow:0 0 10px var(--cyan)">srv-nginx</div>'
    +'<span class="prx-vms-badge"><span style="color:var(--cyan)">'+cores+' vCPU</span></span>'
    +'</div>'
    +(ngxVer?'<div class="prx-model-line" style="color:rgba(0,217,255,.6)">'+esc(ngxVer)+' · '+ngxWorkers+' workers</div>':'')
    +(sys.kernel?'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,255,.35);font-family:\'Courier New\',monospace;margin-top:.05rem">'+esc(sys.kernel)+'</div>':'')
    +(sys.uptime?'<div class="prx-uptime-line">'+esc(sys.uptime)+'</div>':'')
    +(load['1m']?'<div class="prx-temps">'
      +'<span class="prx-tbadge">Load <b style="color:'+lc+'">'+load['1m']+' · '+load['5m']+' · '+load['15m']+'</b></span>'
      +(sys.tcp_established!=null?'<span class="prx-tbadge">TCP <b style="color:var(--cyan)">'+sys.tcp_established+'</b></span>':'')
      +'</div>':'')
    +'</div></div>'
    +_sysCpuSparkline(sysCpuHist)
    +_prxSec('MÉMOIRE &amp; SYSTÈME','var(--purple)')
    +(mem.pct!=null?_memBar('RAM',mem.pct,Math.round((mem.used_mb||0)/102.4)/10+' Go',Math.round((mem.total_mb||0)/102.4)/10+' Go'):'')
    +(mem.swap_total_mb>0?_memBar('Swap',mem.swap_pct||0,(mem.swap_used_mb||0)+' Mo',(mem.swap_total_mb||0)+' Mo'):'')
    +_sysStorageHtml(sys.volumes||[])
    +_sysCardNginxHtml(traffic)
    +_sysNetworkHtml(sys.net||{})
    +(Object.keys(sysSvcs).length
      ?_prxSec('SERVICES','var(--green)')+'<div class="svc-badges">'
        +Object.keys(sysSvcs).map(function(k){var up=sysSvcs[k];return '<span class="badge '+(up===true?'up':up===false?'dn':'')+'">'+esc(k)+'</span>';}).join('')
        +'</div>'
      :'')
    +_sysCardCmHtml(ufwOk, fw, f2bBans, conf)
    +'<div style="flex:1"></div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.25);margin-top:.3rem;text-align:center;letter-spacing:.6px">↑ cliquer pour détails</div>'
    +'</div></div>';
}
function _renderSistemeReseau(d,g){
  var sys=d.system||{};
  g.insertAdjacentHTML('beforeend',_sysCardHtml(sys,d));
  var ck=document.getElementById('sys-cpu-spark');
  if(ck&&window._sysCpuSparkData){
    var sd=window._sysCpuSparkData;
    drawNetSparkline(ck,sd.vals,sd.rgb,sd.maxC);
  }
  var card=document.getElementById('sys-nginx-card');
  if(card) card.addEventListener('click',function(){if(window._lastData)openSysModal(window._lastData);});
}

// NDT-105 — hover CSS one-shot (remplace onmouseenter/onmouseleave inline)
var _sshRowCssInjected=false;
function _injectSshRowCss(){
  if(_sshRowCssInjected)return;_sshRowCssInjected=true;
  var s=document.createElement('style');
  s.textContent='.soc-ssh-row:hover{background:rgba(255,255,255,.025)!important}';
  document.head.appendChild(s);
}
// NDT-23a — table infrastructure SSH (hôtes + port + rôle + statut + uptime)
function _sshInfraTableHtml(rows){
  _injectSshRowCss();
  var hdr='<div style="display:grid;grid-template-columns:110px 1fr 1fr 72px 80px;gap:0 .5rem;padding:.15rem .5rem .25rem .75rem;font-size:var(--fs-xs);color:rgba(0,255,136,.35);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid rgba(0,255,136,.1);margin-top:.35rem">'
    +'<span>Hôte</span><span>IP · Port</span><span>Rôle</span><span style="text-align:center">État</span><span style="text-align:right">Uptime</span></div>';
  var rowsHtml=rows.map(function(r){
    var up=r.status==='UP';
    var isApi=r.note==='API';
    var accentCol=up?'rgba(0,255,136,.55)':'rgba(255,59,92,.45)';
    var nameCol=up?'var(--text)':'rgba(122,154,184,.45)';
    var badge=up
      ?'<span style="display:inline-flex;align-items:center;gap:.18rem;background:rgba(0,200,80,.1);color:var(--green);border:1px solid rgba(0,200,80,.3);border-radius:2px;padding:.04rem .3rem;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px;white-space:nowrap;box-shadow:0 0 6px rgba(0,200,80,.15)">'
        +(isApi?'◈ API':'● SSH')+'</span>'
      :'<span style="display:inline-flex;align-items:center;background:rgba(255,59,92,.1);color:var(--red);border:1px solid rgba(255,59,92,.3);border-radius:2px;padding:.04rem .3rem;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px;white-space:nowrap">✗ DOWN</span>';
    var portStr=r.port?('<span style="color:rgba(0,255,136,.4)">:'+esc(String(r.port))+'</span>'):'';
    return '<div class="soc-ssh-row" style="display:grid;grid-template-columns:110px 1fr 1fr 72px 80px;gap:0 .5rem;align-items:center;padding:.3rem .5rem .3rem .75rem;border-top:1px solid rgba(255,255,255,.04);border-left:2px solid '+accentCol+';transition:background .15s">'
      +'<span style="color:'+nameCol+';font-family:\'Courier New\',monospace;font-weight:600;font-size:var(--fs-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(r.name)+'</span>'
      +'<span style="color:rgba(122,154,184,.7);font-family:\'Courier New\',monospace;font-size:var(--fs-xs);white-space:nowrap">'+esc(r.ip)+portStr+'</span>'
      +'<span style="color:rgba(122,154,184,.45);font-size:var(--fs-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(r.role||'—')+'</span>'
      +'<span style="text-align:center">'+badge+'</span>'
      +'<span style="text-align:right;color:var(--cyan);font-size:var(--fs-xs);font-family:\'Courier New\',monospace;white-space:nowrap">'+esc(r.uptime||'—')+'</span>'
      +'</div>';
  }).join('');
  return hdr+rowsHtml;
}
// NDT-23b — section surveillance SSH connexions 24h (accepted/failed/active_sessions/active_ips)
function _sshMonitorHtml(sshSt){
  if(!sshSt.length)return '';
  var rowsHtml=sshSt.map(function(m){
    if(m.accepted_24h===undefined)return '';
    var hasFail=m.failed_24h>0;
    var hasSess=m.active_sessions>0;
    var sessPlur=m.active_sessions!==1?'s':'';
    var allIps=(m.accepted_ips_24h&&m.accepted_ips_24h.length)?m.accepted_ips_24h
              :(m.active_ips&&m.active_ips.length)?m.active_ips:[];
    var ipsHtml=allIps.length
      ?'<span style="margin-left:.4rem">'+allIps.map(function(ip){return '<span style="background:rgba(0,217,255,.08);color:var(--cyan);border:1px solid rgba(0,217,255,.2);border-radius:2px;padding:.02rem .25rem;font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">'+esc(ip)+'</span>';}).join(' ')+'</span>'
      :'';
    var ROW='display:grid;grid-template-columns:110px 140px 120px 1fr;gap:0 .5rem;align-items:center;padding:.22rem .5rem .22rem .75rem;border-top:1px solid rgba(255,255,255,.03)';
    return '<div style="'+ROW+'">'
      +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:rgba(122,154,184,.6)">'+esc(m.name)+'</span>'
      +'<span style="font-size:var(--fs-xs)"><span style="color:var(--green)">✓ '+m.accepted_24h+'</span><span style="color:rgba(122,154,184,.35);margin-left:.25rem">conn/24h</span></span>'
      +'<span style="font-size:var(--fs-xs);color:'+(hasSess?'var(--cyan)':'rgba(122,154,184,.3)')+'">● '+m.active_sessions+' session'+sessPlur+'</span>'
      +'<span style="font-size:var(--fs-xs);display:flex;align-items:center;flex-wrap:wrap;gap:.2rem">'
        +(hasFail?'<span style="color:var(--red);margin-right:.3rem">✗ '+m.failed_24h+' échecs</span>':'')
        +ipsHtml
      +'</span>'
      +'</div>';
  }).join('');
  return '<div style="display:flex;align-items:center;gap:.5rem;margin:1rem 0 .3rem;padding:0 .5rem 0 .75rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.4);text-transform:uppercase;letter-spacing:1px;white-space:nowrap">Surveillance SSH · 24h</span>'
    +'<span style="flex:1;height:1px;background:rgba(0,217,255,.1)"></span>'
    +'</div>'
    +rowsHtml;
}
function _renderSSH(d,g){
  var sshSt=d.ssh||[];
  var pveNode=((d.proxmox||{}).nodes||[])[0]||null;
  // Roles par machine (routeur retire 2026-05-17)
  var ROLES={
    'srv-nginx': 'Reverse Proxy · SOC · WAF',
    'clt':      'Backend Web · CLT',
    'pa85':     'Backend Web · PA85',
    'proxmox':  'Hyperviseur · VMs'
  };
  var ORDER=['srv-nginx','clt','pa85'];
  var rows=ORDER.map(function(n){
    var h2=sshSt.find(function(x){return x.name===n;});
    if(!h2)return{name:n,ip:'?',port:parseInt(SOC_INFRA.SSH_PORT),role:ROLES[n]||'',status:'DOWN',uptime:'?'};
    return{name:h2.name,ip:h2.ip||'?',port:h2.port||parseInt(SOC_INFRA.SSH_PORT),role:ROLES[n]||'',status:h2.port_open?'UP':'DOWN',uptime:h2.uptime||'?'};
  });
  if(pveNode){
    rows.push({name:'proxmox',ip:SOC_INFRA.PROXMOX,port:parseInt(SOC_INFRA.SSH_PORT),role:ROLES['proxmox'],status:pveNode.status==='online'?'UP':'DOWN',uptime:pveNode.uptime||'?'});
  }
  var allUp=rows.filter(function(r){return r.status==='UP';}).length;
  var h='<div class="card wide" id="ssh-status-card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c" style="display:flex;justify-content:space-between;align-items:center">'
    +'<span><span class="ct-icon">⬡</span>SSH — INFRASTRUCTURE · SURVEILLANCE</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--green);font-weight:600;letter-spacing:.5px">'+allUp+'/'+rows.length+' <span style="color:rgba(0,255,136,.45);font-weight:400">ONLINE</span></span>'
    +'</div>'
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
  if(upd.generated_at){var _ua=new Date(upd.generated_at);uaStr=_fmtDateTs(_ua);} // NDT-149
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
    +'<div class="z5b-section-hdr">'
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
    +'<div class="z5b-section-hdr">'
    +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,0.4);text-transform:uppercase;letter-spacing:.6px">TLS — certs Let\'s Encrypt</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,0.25);font-style:italic">expire dans</span>'
    +'</div>'+tlsItemsHtml+'</div>';
}
var _UPD_ANIM_MS  = 400;
var _UPD_SHOW_MS  = 3000;
var _UPD_BUSY_MS  = 800;
function _renderZone5B(d,g){
  var upd=d.updates||{};
  var uTotal=upd.total_count||0, uSec=upd.total_security||0;
  var uMainC=uSec>0?'255,60,60':uTotal>0?'255,160,0':'0,255,136';
  var h='<div class="card" id="upd-tile" style="cursor:pointer'+(uTotal>0?';border-color:rgba('+uMainC+',0.35)':'')+'"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c sb"><span><span class="ct-icon">⬆</span>MISES À JOUR — INFRASTRUCTURE</span>'
   +'<button id="upd-refresh-btn" class="upd-refresh-btn" title="Forcer le monitoring">⟳</button></div>'
   +_z5bMachinesHtml(upd)
   +_z5bAutoUpdateHtml(d.autoupdate||{})
   +_z5bTlsHtml(d.tls||{})
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var _ut=document.getElementById('upd-tile');
  if(_ut)_ut.addEventListener('click',function(){openUpdModal();});
  var _rb=document.getElementById('upd-refresh-btn');
  if(_rb)_rb.addEventListener('click',function(e){
    e.stopPropagation();
    _rb.textContent='⟳';_rb.style.opacity='0.35';_rb.disabled=true;
    fetch('/api/trigger-monitoring',{method:'POST'})
      .then(function(r){return r.json();})
      .then(function(j){
        var ok=j.status==='triggered';
        setTimeout(function(){
          _rb.textContent=ok?'✓':'⟳';
          _rb.style.opacity='1';
          _rb.classList.toggle('upd-refresh-btn--ok',ok);
          setTimeout(function(){
            _rb.textContent='⟳';
            _rb.classList.remove('upd-refresh-btn--ok');
            _rb.disabled=false;
          },ok?_UPD_SHOW_MS:_UPD_BUSY_MS);
        },_UPD_ANIM_MS);
      })
      .catch(function(){
        _rb.textContent='✗';_rb.style.opacity='1';_rb.classList.add('upd-refresh-btn--err');
        setTimeout(function(){
          _rb.textContent='⟳';
          _rb.classList.remove('upd-refresh-btn--err');
          _rb.disabled=false;
        },_UPD_SHOW_MS);
      });
  });
}

// ── PROTOCOLES ACTIFS — helpers (arc gauge SVG + live refresh) ───────────────
function _protoComputeState(proto){
  var total=PROTO_DEF.reduce(function(s,p){return s+(proto[p.k]||0);},0)||1;
  var thr=0;
  PROTO_DEF.forEach(function(p){if(p.grp==='threat')thr+=(proto[p.k]||0);});
  var hp=Math.round((total-thr)/total*100);
  var ac=hp>70?_COL_CYAN_HEX:hp>40?PROTO_PALETTE.WATCH:_COL_RED_HEX;
  return {
    total:total,hp:hp,ac:ac,
    af:Math.max(3,Math.round(hp/100*131.95)),
    legit:PROTO_DEF.filter(function(p){return p.grp!=='threat'&&p.grp!=='other'&&p.grp!=='sur'&&p.grp!=='sur_threat'&&(proto[p.k]||0)>0;}).sort(function(a,b){return (proto[b.k]||0)-(proto[a.k]||0);}).slice(0,4),
    threats:PROTO_DEF.filter(function(p){return p.grp==='threat'&&(proto[p.k]||0)>0;}).sort(function(a,b){return (proto[b.k]||0)-(proto[a.k]||0);}).slice(0,3)
  };
}
function _protoRowHtml(p,v,total){
  var pct=Math.round(v/total*100);
  return '<div style="display:flex;gap:.4rem;align-items:center;padding:.08rem 0">'
    +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:'+p.c+';min-width:4.5rem;font-weight:700">'+esc(p.l)+'</span>'
    +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:var(--text);min-width:2.2rem;text-align:right">'+fmt(v)+'</span>'
    +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:var(--muted);min-width:2rem;text-align:right">'+pct+'%</span>'
    +'</div>';
}
function _protoBadgeHtml(p,v,total){
  var pct=Math.round(v/total*100);
  return '<span style="padding:.08rem .3rem;background:rgba(255,59,92,.1);border:1px solid rgba(255,59,92,.3);border-radius:2px;font-size:var(--fs-xs);color:'+p.c+';font-weight:700;font-family:\'Courier New\',monospace">'+esc(p.l)+' ×'+v+' ('+pct+'%)</span>';
}
function _refreshProtoTile(proto){
  var s=_protoComputeState(proto);
  var af=document.getElementById('proto-arc-fill');
  if(af){af.setAttribute('stroke-dasharray',s.af+' 999');af.setAttribute('stroke',s.ac);af.style.filter='drop-shadow(0 0 4px '+s.ac+')';}
  var ap=document.getElementById('proto-arc-pct');
  if(ap){ap.textContent=s.hp+'%';ap.setAttribute('fill',s.ac);}
  var lr=document.getElementById('proto-legit-rows');
  if(lr)lr.innerHTML=s.legit.length?s.legit.map(function(p){return _protoRowHtml(p,proto[p.k]||0,s.total);}).join(''):'<div style="color:var(--muted);font-size:var(--fs-xs)">—</div>';
  var tr=document.getElementById('proto-threat-rows');
  if(tr)tr.innerHTML=s.threats.length?s.threats.map(function(p){return _protoRowHtml(p,proto[p.k]||0,s.total);}).join(''):'<div style="color:var(--green);font-size:var(--fs-xs)">✓ aucune</div>';
  var tb=document.getElementById('proto-threat-badges');
  if(tb)tb.innerHTML=s.threats.length?'<span style="font-size:var(--fs-xs);color:rgba(255,100,50,.6);margin-right:.4rem">⚡</span>'+s.threats.map(function(p){return _protoBadgeHtml(p,proto[p.k]||0,s.total);}).join(''):'<span style="font-size:var(--fs-xs);color:var(--green)">✓ Trafic sain</span>';
}
function _renderProtoActifs(d,g){
  var t=d.traffic||{};
  if(!t.proto_breakdown||!Object.keys(t.proto_breakdown).length)return;
  var proto=window._liveProto&&Object.keys(window._liveProto).length?window._liveProto:t.proto_breakdown;
  var s=_protoComputeState(proto);
  var legitHtml=s.legit.length?s.legit.map(function(p){return _protoRowHtml(p,proto[p.k]||0,s.total);}).join(''):'<div style="color:var(--muted);font-size:var(--fs-xs)">—</div>';
  var threatHtml=s.threats.length?s.threats.map(function(p){return _protoRowHtml(p,proto[p.k]||0,s.total);}).join(''):'<div style="color:var(--green);font-size:var(--fs-xs)">✓ aucune</div>';
  var badgesHtml=s.threats.length?'<span style="font-size:var(--fs-xs);color:rgba(255,100,50,.6);margin-right:.4rem">⚡</span>'+s.threats.map(function(p){return _protoBadgeHtml(p,proto[p.k]||0,s.total);}).join(''):'<span style="font-size:var(--fs-xs);color:var(--green)">✓ Trafic sain</span>';
  var h='<div class="card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct"><span class="ct-icon">◇</span>PROTOCOLES ACTIFS'
    +'<span class="live-badge">⬤ LIVE</span>'
    +'</div>'
    +'<div style="display:flex;align-items:flex-start;gap:.8rem;margin-bottom:.5rem">'
    +'<div style="flex-shrink:0;text-align:center">'
    +'<svg id="proto-health-arc" viewBox="0 0 100 60" width="88" height="54">'
    +'<path d="M 8,50 A 42,42 0 0,1 92,50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="9" stroke-linecap="round"/>'
    +'<path id="proto-arc-fill" d="M 8,50 A 42,42 0 0,1 92,50" fill="none" stroke="'+s.ac+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+s.af+' 999" style="filter:drop-shadow(0 0 4px '+s.ac+')"/>'
    +'<text id="proto-arc-pct" x="50" y="42" text-anchor="middle" fill="'+s.ac+'" font-size="14" font-weight="bold" font-family="Courier New,monospace">'+s.hp+'%</text>'
    +'<text x="50" y="55" text-anchor="middle" fill="rgba(122,154,184,0.45)" font-size="6.5" font-family="Courier New,monospace">SAIN</text>'
    +'</svg>'
    +'</div>'
    +'<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:.4rem">'
    +'<div>'
    +'<div style="font-size:var(--fs-xs);color:var(--cyan);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.2rem;font-weight:700">◆ TRAFIC</div>'
    +'<div id="proto-legit-rows">'+legitHtml+'</div>'
    +'</div>'
    +'<div>'
    +'<div style="font-size:var(--fs-xs);color:var(--red);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.2rem;font-weight:700">⚡ MENACES</div>'
    +'<div id="proto-threat-rows">'+threatHtml+'</div>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'<div id="proto-threat-badges" style="display:flex;flex-wrap:wrap;align-items:center;gap:.3rem;padding-top:.35rem;border-top:1px solid rgba(255,255,255,.04)">'
    +badgesHtml
    +'</div>'
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
}

// NDT-22 — constantes module-level (évitent re-déclaration à chaque render)
var _FL_PROTO_META={
  'HTTP':         {col:PROTO_PALETTE.GEO,lbl:'HTTP'},
  'HTTPS':        {col:_COL_CYAN_HEX,lbl:'HTTPS'},
  'ASSETS':       {col:_COL_GREEN_HEX,lbl:'ASSETS'},
  'GEO_BLOCK':    {col:PROTO_PALETTE.GEO,lbl:'GEO-BLOCK'},
  'CLOSED':       {col:_COL_RED_HEX,lbl:'CLOSED'},
  'HTTP_REDIRECT':{col:PROTO_PALETTE.NEUTRAL,lbl:'REDIRECT'},
  'NOT_FOUND':    {col:_COL_PURPLE_HEX,lbl:'404'},
  'SCANNER':      {col:PROTO_PALETTE.THREAT,lbl:'SCANNER'},
  'BOT':          {col:_COL_YELLOW_HEX,lbl:'BOT'},
  'LEGIT_BOT':    {col:PROTO_PALETTE.BOT_LEGIT,lbl:'LEGIT BOT'},
  'OTHER':        {col:PROTO_PALETTE.FLOW,lbl:'AUTRE'},
};
var _FL_CS_META={col:_COL_RED_HEX,lbl:'⊛ CS BANS'};
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
    var meta=_FL_PROTO_META[e[0]]||{col:PROTO_PALETTE.FLOW,lbl:esc(e[0])};
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
function _kcAutoBanCheck(kc){
  var now=Date.now(), cd=_BAN_COOLDOWN_MS;
  var banned=window._kcAutoBanned=window._kcAutoBanned||{};
  kc.active_ips.forEach(function(ipObj){
    var ip=ipObj.ip||'';
    if(!ip||_LAN_RE.test(ip)||ipObj.cs_decision||ipObj.banned) return;
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
  try{localStorage.setItem(_LS_KEYS.KC_FIRST_SEEN,JSON.stringify(window._kcFirstSeen));}catch(e){/* QuotaExceededError — storage full, skip */}
  Object.keys(window._kcPrevStages).forEach(function(ip){if(!activeIpSet[ip])delete window._kcPrevStages[ip];});
  Object.keys(window._kcStageEntered).forEach(function(ip){if(!activeIpSet[ip])delete window._kcStageEntered[ip];});
}
// NDT-41d — groupe IPs par stage + enrichit BLOCKED depuis F2B/CS non encore présents
function _kcBuildGrouped(kc, csDetail, f2bJails){
  // KC 7 maillons (2026-05-16) : aligné sur KCK_STAGES — colonnes IP étendues
  // pour matcher les hexagones (PROBE et WAF en plus de RECON/SCAN/EXPLOIT/BRUTE)
  var kcStages=[
    {id:'PROBE',   label:'PROBE',     color:KC_PALETTE.PROBE.color,    step:'①'},
    {id:'RECON',   label:'RECON',     color:KC_PALETTE.RECON.color,    step:'②'},
    {id:'SCAN',    label:'SCAN',      color:KC_PALETTE.SCAN.color,     step:'③'},
    {id:'EXPLOIT', label:'EXPLOIT',   color:KC_PALETTE.EXPLOIT.color,  step:'④'},
    {id:'WAF',     label:'WAF',       color:KC_PALETTE.WAF.color,      step:'⑤'},
    {id:'BRUTE',   label:'BRUTE',     color:KC_PALETTE.BRUTE.color,    step:'⑥'},
    {id:'BLOCKED', label:'NEUTRALISÉ',color:KC_PALETTE.BLOCKED.color,  step:'⑦'}
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
  // KC 7 maillons (MAJ 2026-05-16) : remplir PROBE/WAF depuis listes backend
  // pré-agrégées (kc.probe_ips_15min + kc.waf_ips_15min). Source de vérité unique
  // côté Python = compteur ET liste cohérents (CrowdSec alerts + UFW + f2b Ban).
  var _probeAgg={}, _wafAgg={};
  (kc.probe_ips_15min||[]).forEach(function(e){
    if(!e||!e.ip)return;
    if(!_probeAgg[e.ip]){
      _probeAgg[e.ip]={ip:e.ip,stage:'PROBE',count:1,country:e.country||'-',_scenario:e.detail||e.src||'',cs_decision:e.src==='crowdsec'||!!csDetail[e.ip],sur_count:0};
    }else{_probeAgg[e.ip].count++;}
  });
  (kc.waf_ips_15min||[]).forEach(function(e){
    if(!e||!e.ip)return;
    if(!_wafAgg[e.ip]){
      _wafAgg[e.ip]={ip:e.ip,stage:'WAF',count:1,country:e.country||'-',_scenario:e.detail||e.src||'',cs_decision:!!csDetail[e.ip],sur_count:0};
    }else{_wafAgg[e.ip].count++;}
  });
  Object.values(_probeAgg).forEach(function(e){grouped['PROBE'].push(e);});
  Object.values(_wafAgg).forEach(function(e){grouped['WAF'].push(e);});
  var subnets={};
  kc.active_ips.forEach(function(ip){var p=ip.ip.split('.').slice(0,3).join('.');subnets[p]=(subnets[p]||0)+1;});
  return {stages:kcStages, grouped:grouped, subnets:subnets};
}
function _kcPrepareData(kc,d){
  var csDetail=(d.crowdsec||{}).decisions_detail||{};
  var f2bJails=(d.fail2ban||{}).jails||[];
  // Pass xdr_events through kc for _kcBuildGrouped (PROBE+WAF columns)
  kc._xdrEvents=d.xdr_events||[];
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
  var attackType=csInfo.scenario?fmtScenario(csInfo.scenario,24):(surInfo.cat?_kcFmtCat(surInfo.cat).slice(0,22):'');
  var cve=surInfo.cve||'';
  var csBadge=ip.cs_decision?'<span style="font-size:var(--fs-xs);background:rgba(255,107,53,0.25);color:var(--orange);padding:.03rem .22rem;border-radius:2px;font-weight:700">⊛CS</span>':'';
  var surBadge=ip.sur_count?'<span style="font-size:var(--fs-xs);background:rgba(255,69,0,0.22);color:'+_COL_SUR_IDS_HEX+';padding:.03rem .22rem;border-radius:2px;font-weight:700">◈IDS</span>':'';
  var cveBadge=cve?'<span style="font-size:var(--fs-xs);background:rgba(255,70,40,0.2);color:rgba(255,110,70,0.95);padding:.03rem .22rem;border-radius:2px;font-weight:700;border:1px solid rgba(255,70,40,0.3)">'+esc(cve)+'</span>':'';
  // routerBadge / c2Badge retirés 2026-05-17
  var vmBadge=(ip.f2b_vms&&ip.f2b_vms.length)?'<span style="font-size:var(--fs-xs);background:rgba(255,160,0,0.2);color:'+_COL_AMBER_HEX+';padding:.03rem .22rem;border-radius:2px;font-weight:700" title="Banni par fail2ban sur '+esc((ip.f2b_vms||[]).join('+'))+'">⊛VM</span>':'';
  var spoofBadge=ip.spoofed_bot?'<span style="font-size:var(--fs-xs);background:rgba(255,0,80,0.22);color:'+_COL_C2_HEX+';padding:.03rem .22rem;border-radius:2px;font-weight:700" title="User-Agent usurpé : prétend être '+esc(ip.spoofed_bot)+' mais FCrDNS échoue — signal hostile">⚠FAUX '+esc(ip.spoofed_bot)+'</span>':'';
  var typeLine=attackType?'<div style="font-size:var(--fs-xs);color:rgba(170,210,255,0.55);letter-spacing:.2px;margin-top:.07rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">▸ '+esc(attackType)+'</div>':'';
  var conf=1+(ip.cs_decision?1:0)+(ip.sur_count?1:0)+(ip.banned?1:0)+((ip.f2b_vms&&ip.f2b_vms.length)?1:0);
  var confCol=conf>=4?'var(--green)':conf>=3?'rgba(255,215,0,.88)':'rgba(255,140,50,.8)';
  var confBar='<div class="ckc-conf">';
  // 5 pips depuis retrait ROUTEUR 2026-05-17 ()
  for(var ci=0;ci<5;ci++)confBar+='<div class="ckc-conf-pip" style="background:'+(ci<conf?confCol:'rgba(255,255,255,0.1)')+'"></div>';
  confBar+='</div>';
  var pfx=ip.ip.split('.').slice(0,3).join('.');
  var clusterBadge=(subnets[pfx]||0)>=2?'<span class="ckc-cluster">⚡/24</span>':'';
  return '<div class="ckc-ip ckc-ip-click '+sc+'" style="flex-direction:column;align-items:flex-start" title="'+esc(ip.ip)+' — '+esc(ip.stage)+' \u00d7'+ip.count+(attackType?' — '+esc(attackType):'')+' [cliquer pour investigation]" data-kc-ip="'+esc(ip.ip)+'">'
    +'<div style="display:flex;align-items:center;gap:.2rem;flex-wrap:wrap">'
    +(ip.country&&ip.country!=='-'?'<span style="opacity:.6;font-size:var(--fs-xs)">'+esc(ip.country)+'</span>':'')
    +'<span style="font-size:var(--fs-xs)">'+esc(ip.ip)+'</span>'
    +'<span style="opacity:.55;font-size:var(--fs-xs)">\u00d7'+ip.count+'</span>'
    +(_kcFmtAge(ip.ip)?'<span style="font-size:var(--fs-xs);color:rgba(180,200,255,.38);letter-spacing:.2px">\u23f1'+_kcFmtAge(ip.ip)+'</span>':'')
    +csBadge+surBadge+cveBadge+vmBadge+spoofBadge+clusterBadge
    +'<button class="kc-deep-btn" data-deep-ip="'+esc(ip.ip)+'" title="Analyse approfondie 30j">⊙</button>'
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
   +'<div class="ct c"><span class="ct-icon">⛓</span>CYBER KILL CHAIN — ATTAQUES EN COURS'
   +'<span data-panel="RÔLE : visualisation en temps réel de toutes les tentatives d attaque classifiées par phase Cyber Kill Chain — RECON → SCAN → EXPLOIT → BRUTE. Chaque IP attaquante est tracée, scorée, et positionnée dans le cycle d attaque.\n\nMÉCANISME : les logs nginx (15 min glissantes) et les décisions CrowdSec (24h) sont agrégés par IP. Chaque IP reçoit un score menace (0-100) calculé depuis : fréquence de requêtes · erreurs 4xx/5xx · scénarios CrowdSec actifs · alertes Suricata · présence sur blocklist CTI. Le canvas anime le flux en temps réel.\n\nSTAGES KILL CHAIN :\n— RECON : reconnaissance · scan ports · fingerprinting\n— SCAN : énumération · découverte de paths · fuzz\n— EXPLOIT : tentatives d exploitation CVE · injections · webshells\n— BRUTE : force brute SSH · credentials stuffing · dictionnaire\n\nMÉTRIQUES SURVEILLÉES : IPs actives · score par IP · stage dominant · neutralisations (ban CrowdSec + fail2ban) · IPs récidivistes · vélocité attaque.\n\nCOMPORTEMENT ATTENDU : IPs en rouge = menace active à traiter. IPs en vert = neutralisées. Stage EXPLOIT actif = priorité maximale — investiguer immédiatement via ⊙ ANALYSE APPROFONDIE.\n\nJARVIS (si online) : surveille le score global Kill Chain. Si niveau ÉLEVÉ ou CRITIQUE → analyse LLM du pattern d attaque → ban automatique des IPs EXPLOIT/BRUTE → alerte vocale TTS + journal ◈ SOC.\n\nVALEUR AJOUTÉE : transforme des milliers de lignes de logs en une vue tactique unique. En un coup d œil : combien d IPs attaquent, à quelle phase, depuis combien de temps, et si la défense a répondu." data-panel-title="CYBER KILL CHAIN — ATTAQUES EN COURS" class="soc-panel-i" style="--pi-dim:rgba(255,59,92,.45);--pi-bright:rgba(255,59,92,.9);--pi-glow:rgba(255,59,92,.5)">ⓘ</span>'
   +'<span class="live-badge">● LIVE</span></div>'
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
  var kcF2b=_f2bTotalBanned(d.fail2ban);
  var kcCs=(d.crowdsec&&(d.crowdsec.active_decisions||d.crowdsec.decisions))||0;
  var kcNeutralized=kcF2b+kcCs;
  var kcKrTotal=kcActive+kcNeutralized;
  var kcKillRate=kcKrTotal>0?Math.round(kcNeutralized/kcKrTotal*100):0;
  var kcBots=kc.verified_bots_count||0;
  var kcBotsHtml=kcBots>0
    ?' · <span style="color:var(--cyan)" title="Crawlers légitimes (Googlebot, Bingbot…) confirmés par FCrDNS — exclus de la Kill Chain">🤖 '+kcBots+' crawler'+(1!==kcBots?'s':'')+' vérifié'+(1!==kcBots?'s':'')+' filtré'+(1!==kcBots?'s':'')+'</span>'
    :'';
  var kcStatusHtml=(kcActive>0
    ?'<b>'+kcActive+' IP(s)</b> en cours d\'analyse — fenêtre 15 min'
      +(kcNeutralized>0?' · <span style="color:var(--green);font-weight:700">'+kcNeutralized+' neutralisée'+(1!==kcNeutralized?'s':'')+'</span>':'')
    :'✓ Aucune activité hostile — calme radar')+kcBotsHtml;
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
        if(!ipsEl._boundKc){ipsEl._boundKc=true;ipsEl.addEventListener('click',function(e){
          var deepEl=e.target.closest('[data-deep-ip]');
          if(deepEl){e.stopPropagation();if(window.openIpDeepModal)openIpDeepModal(deepEl.getAttribute('data-deep-ip'));return;}
          var el=e.target.closest('[data-kc-ip]');
          if(el)_kcInvestigateIP(el.getAttribute('data-kc-ip'));
        });}
      } else {
        ipsEl.innerHTML='<div style="width:100%;text-align:center;padding:.4rem 0;font-size:var(--fs-xs);color:var(--green);font-family:\'Courier New\',monospace">✓ Aucune IP hostile active dans les 15 dernières minutes</div>';
      }
    }
    // Option B (2026-05-16) : injecter compteur bans 24h par stage depuis autoban_log
    // → affiché sous chaque hexagone pour montrer la défense effective sur 24h
    // (corrige l'illusion "tout est calme" quand RECON 15min=0 mais 20 IPs bannies 24h)
    var _stBan24={RECON:0,SCAN:0,EXPLOIT:0,BRUTE:0};
    var _now24=Date.now()-86400000;
    (d.autoban_log||[]).forEach(function(e){
      if(!e||!e.ts)return;
      var t=new Date(e.ts).getTime();
      if(isNaN(t)||t<_now24)return;
      var st=(e.stage||'RECON').toUpperCase();
      if(_stBan24[st]!==undefined)_stBan24[st]++;
    });
    kc.stage_bans_24h=_stBan24;
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
  return '<div class="card wide" id="geo-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◉</span>GEOIP — CARTOGRAPHIE DES MENACES 24H</div>'
    +'<div class="map-wrap"><canvas class="map-canvas" id="geomap"></canvas>'
    +'<div class="threat-feed" id="threat-feed"><div class="threat-feed-hdr">&#9658; LIVE THREATS</div><ul class="threat-feed-list" id="threat-feed-list"></ul></div></div>'
    +'<div class="map-legend">'
    +'<button class="map-toggle-btn" id="map-lf-btn" title="Carte interactive zoomable (OSM)">&#127758; CARTE LIVE</button>'
    +'<span><span class="map-leg-dot" style="background:'+KC_PALETTE.BRUTE.color+';box-shadow:0 0 4px '+KC_PALETTE.BRUTE.color+'"></span>BRUTE</span>'
    +'<span><span class="map-leg-dot" style="background:'+KC_PALETTE.EXPLOIT.color+';box-shadow:0 0 4px '+KC_PALETTE.EXPLOIT.color+'"></span>EXPLOIT</span>'
    +'<span><span class="map-leg-dot" style="background:'+KC_PALETTE.SCAN.color+';box-shadow:0 0 4px '+KC_PALETTE.SCAN.color+'"></span>SCAN</span>'
    +'<span><span class="map-leg-dot" style="background:'+KC_PALETTE.RECON.color+';box-shadow:0 0 4px '+KC_PALETTE.RECON.color+'"></span>RECON</span>'
    +'<span><span class="map-leg-dot" style="background:var(--green);box-shadow:0 0 4px var(--green)"></span>FR</span>'
    +'<span><span class="map-leg-dot" style="background:var(--cyan);box-shadow:0 0 4px var(--cyan)"></span>Autre</span>'
    +'<span style="border-left:1px solid rgba(255,255,255,0.08);padding-left:.8rem;color:var(--red)">&#9658; '+blocked.length+' arcs · '+rate+'% bloqués</span>'
    +(topStr?'<span style="color:rgba(255,130,145,0.8)">⚡ '+topStr+'</span>':'')
    +'<span style="color:rgba(122,154,184,0.5);white-space:nowrap">'+lbl+'</span>'
    +'</div></div></div>';
}
function _renderGeoMap(d,g){
  var geoips=(d.traffic||{}).recent_geoips||[];
  var _fbxIp=(d.freebox&&d.freebox.available&&d.freebox.ipv4)?{ip:d.freebox.ipv4}:null;
  var _wanInfo=d.wan_ip||_fbxIp||null;
  _lfLastGeoips=geoips; _lfLastWanIp=_wanInfo;
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
    drawGeoMap(_lfLastGeoips,null,_wanInfo);
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
// NDT-33b retiré 2026-05-17 — bloc routeur supprimé ()
// NDT-33c — bloc historique ThreatScore 30j — avg7d/trend7d/avg30d + sparkline 72h
function _tsTrendSparkSvg(pts){
  if(!pts||pts.length<3)return '';
  var W=200,H=32,PAD=2;
  var n=pts.length;
  var coords=pts.map(function(v,i){
    return [(PAD+i*(W-2*PAD)/(n-1)).toFixed(1),(H-PAD-Math.min(100,Math.max(0,v))/100*(H-2*PAD)).toFixed(1)];
  });
  var last=pts[pts.length-1];
  var lc=last>75?'rgba(255,59,92,.9)':last>50?'rgba(255,107,35,.85)':last>30?'rgba(255,215,0,.8)':'rgba(0,255,136,.8)';
  var lf=last>75?'rgba(255,59,92,.1)':last>50?'rgba(255,107,35,.08)':last>30?'rgba(255,215,0,.07)':'rgba(0,255,136,.08)';
  var botY=(H-PAD).toFixed(1);
  var area='M '+coords[0][0]+','+botY+' L '+coords.map(function(c){return c[0]+','+c[1];}).join(' L ')+' L '+coords[n-1][0]+','+botY+' Z';
  var line=coords.map(function(c){return c[0]+','+c[1];}).join(' ');
  return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="28px" preserveAspectRatio="none" style="display:block;margin:.2rem 0 .15rem;border-radius:2px">'
    +'<path d="'+area+'" fill="'+lf+'"/>'
    +'<polyline points="'+line+'" fill="none" stroke="'+lc+'" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
    +'<circle cx="'+coords[n-1][0]+'" cy="'+coords[n-1][1]+'" r="2.5" fill="'+lc+'"/>'
    +'</svg>';
}
function _tsTrendBlockHtml(d){
  var avg7 =d.threat_avg7d  ||0;
  var trend=d.threat_trend7d||0;
  var avg30=d.threat_avg30d ||0;
  var count=d.threat_history_count||0;
  var pts  =d.threat_history_72h||[];
  if(count<4)return '';
  var days =Math.max(1,Math.round(count/24));
  var tArrow=trend>5?'↗':trend<-5?'↘':'→';
  var tColor=trend>5?'rgba(255,59,92,.9)':trend<-5?'rgba(0,217,100,.9)':'rgba(255,215,0,.85)';
  var tSign =trend>=0?'+':'';
  return '<div style="margin-top:.4rem;padding:.38rem .65rem .3rem;background:rgba(0,120,220,.05);border:1px solid rgba(0,170,255,.18);border-radius:5px">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.1rem">'
    +'<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.45);text-transform:uppercase;letter-spacing:1px">◈ Historique 30j</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.35)">'+days+'j · '+count+' pts</span>'
    +'</div>'
    +_tsTrendSparkSvg(pts)
    +'<div style="display:flex;gap:1.2rem;align-items:flex-end;margin-top:.2rem">'
    +'<div><div style="font-size:var(--fs-xs);color:rgba(160,220,255,.4)">Moy. 7j</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:rgba(0,200,255,.85)">'+avg7
    +' <span style="font-size:var(--fs-xs);color:'+tColor+'">'+tArrow+' '+tSign+trend+'</span></div></div>'
    +'<div><div style="font-size:var(--fs-xs);color:rgba(160,220,255,.4)">Moy. 30j</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:rgba(0,180,255,.65)">'+avg30+'</div></div>'
    +'<div style="margin-left:auto">'
    +'<button id="ts-hist-btn" style="font:700 var(--fs-xs) \'Courier New\',monospace;letter-spacing:.05em;'
    +'border:1px solid rgba(0,170,255,.25);border-radius:3px;background:rgba(0,170,255,.06);'
    +'color:rgba(0,170,255,.7);padding:.12rem .5rem;cursor:pointer;white-space:nowrap">'
    +'▶ graphe 30j</button>'
    +'</div>'
    +'</div></div>';
}
function _tsCampaignsBlockHtml(d){
  var camps=d.slow_campaigns||[];
  if(!camps.length)return '';
  var rows=camps.slice(0,5).map(function(c){
    var since='';
    try{
      var diff=Math.round((Date.now()-new Date(c.last_seen).getTime())/86400000);
      since=diff<=0?'auj.':diff+'j';
    }catch(e){}
    var flags=(c.countries||[]).slice(0,3).map(function(cc){
      return '<span class="sc-cc">'+esc(cc)+'</span>';
    }).join('');
    return '<div class="sc-row">'
      +'<span class="sc-sub">'+esc(c.subnet)+'</span>'
      +'<span class="sc-ips">'+c.count+' IP</span>'
      +'<span class="sc-age">'+since+'</span>'
      +'<span class="sc-ccs">'+flags+'</span>'
      +'</div>';
  }).join('');
  var extra=camps.length>5?'<span class="sc-more">+'+(camps.length-5)+'</span>':'';
  return '<div class="sc-block">'
    +'<div class="sc-hdr">⟳ CAMPAGNES LENTES /24 <span class="sc-hdr-cnt">'+camps.length+'</span>'+extra+'</div>'
    +rows
    +'</div>';
}
function _renderThreatScore(d,g){
  var ts=_lastThreatResult||computeThreatScore(d);
  var sys=computeSystemStatus(d,ts);
  var h='<div class="card" id="ts-card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◉</span>NIVEAU DE MENACE GLOBAL</div>'
   +_tsMenaceBlockHtml(ts,sys)
   +_tsTrendBlockHtml(d)
   +_tsCampaignsBlockHtml(d)
   +'<div style="padding:.5rem .75rem .35rem;border-top:1px solid rgba(0,170,255,.08);margin-top:.4rem">'
   +'<button id="ts-xdr-btn" style="font:700 11px Courier New,monospace;letter-spacing:.08em;'
   +'border:1px solid rgba(0,217,255,.3);border-radius:3px;background:rgba(0,217,255,.06);'
   +'color:rgba(0,217,255,.75);padding:.2rem .75rem;cursor:pointer;transition:all .15s;white-space:nowrap;width:100%;">'
   +'◈ XDR CORRELATION ENGINE — détail</button>'
   +'<div style="text-align:right;margin-top:.18rem"><span data-panel="RÔLE : moteur de corrélation multi-sources — transforme des événements isolés en menace qualifiée. PIPELINE : COLLECT (fail2ban · ModSec · Suricata · UFW · AppArmor · GeoIP · IOC/CTI feeds) → NORMALISE (parsing logs · enrichissement GeoIP · MITRE ATT&CK mapping) → CORRELATE (regroupement par IP · Kill Chain RECON→SCAN→EXPLOIT→BRUTE · score CRIT/HIGH/WARN/INFO) → RESPOND (CrowdSec ban · fail2ban · JARVIS SOAR). VALEUR AJOUTÉE : un attaquant qui sonde en RECON puis passe en BRUTE génère des événements séparés dans des outils différents — le XDR les relie en une séquence cohérente sur la même IP. COMPORTEMENT ATTENDU : score stable · IPs CRIT bannies · Kill Chain sans stagnation sur EXPLOIT. JARVIS (si online) : notifié dès qu\'une IP atteint CRIT ou HIGH. Soumet la séquence d\'événements à phi4-reasoning pour analyse contextuelle. Si aucune action humaine sous 5 min, bannit via CrowdSec avec justification LLM enregistrée. Alerte vocale TTS immédiate. Journal complet dans JARVIS localhost:5000 → onglet ◈ SOC." data-panel-title="XDR CORRELATION ENGINE" class="soc-panel-i" style="--pi-dim:rgba(0,217,255,.65);--pi-bright:rgba(0,217,255,.9);--pi-glow:rgba(0,217,255,.5)">ⓘ rôle XDR</span></div>'
   +'</div>'
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var histBtn=document.getElementById('ts-hist-btn');
  if(histBtn) histBtn.addEventListener('click',function(e){ e.stopPropagation(); _openTsHistoryModal(); });
  var btn=document.getElementById('ts-xdr-btn');
  if(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(typeof window._xdrOpenModal!=='function'){
        this.textContent='XDR NON CHARGÉ — F5';
        this.classList.add('xdr-btn-error');
        return;
      }
      window._xdrOpenModal(window._xdrLastData||window._lastData||{});
    });
  }
}

// ── ThreatScore — modal graphe 30j ──────────────────────────────────────────
function _openTsHistoryModal(){
  if(_isOpen)return;
  var mc=document.getElementById('modal-card');
  if(mc)mc.classList.add('modal-wide','theme-cyan');
  var ht=document.getElementById('modal-header-title');
  if(ht)ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">◉</span>MENACE — HISTORIQUE 30 JOURS';
  _modalBody.innerHTML='<div style="text-align:center;padding:2rem;color:rgba(0,215,255,.5);font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">⟳ Chargement...</div>';
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
  fetch('/threat_history.json',{cache:'no-store'})
    .then(function(r){return r.json();})
    .then(function(h){_renderTsHistoryModal(h);})
    .catch(function(){_modalBody.innerHTML='<div style="color:rgba(255,59,92,.8);padding:1rem;font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">Historique non disponible</div>';});
}
function _tsHistStatHtml(lbl,val,col){
  return '<div><div style="font-size:var(--fs-xs);color:rgba(160,220,255,.4)">'+esc(lbl)+'</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:'+col+'">'+val+'</div></div>';
}
function _tsHistLevelHtml(lbl,count,total,col){
  var pct=total>0?Math.round(count*100/total):0;
  return '<div style="flex:1;min-width:90px;padding:.3rem .5rem;background:rgba(0,0,0,.2);border:1px solid rgba(0,170,255,.1);border-radius:3px">'
    +'<div style="font-size:var(--fs-xs);color:'+col+';text-transform:uppercase;letter-spacing:.05em">'+esc(lbl)+'</div>'
    +'<div style="font-size:var(--fs-sm);font-weight:700;color:'+col+'">'+count
    +'<span style="font-size:var(--fs-xs);font-weight:400;color:rgba(160,220,255,.4)"> pts · '+pct+'%</span></div>'
    +'</div>';
}
function _renderTsHistoryModal(history){
  if(!Array.isArray(history)||history.length<2){
    _modalBody.innerHTML='<div style="color:rgba(160,220,255,.5);padding:1rem;font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">Données insuffisantes ('+history.length+' points)</div>';
    return;
  }
  var scores=history.map(function(e){return e.score||0;});
  var avg=Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length);
  var maxS=Math.max.apply(null,scores);
  var minS=Math.min.apply(null,scores);
  var last=scores[scores.length-1];
  var lCol=last>75?'rgba(255,59,92,.9)':last>50?'rgba(255,107,35,.85)':last>30?'rgba(255,215,0,.8)':'rgba(0,255,136,.8)';
  var h='<div style="display:flex;flex-direction:column;gap:.55rem">'
    +'<div style="display:flex;gap:1.2rem;flex-wrap:wrap;padding:.4rem .6rem;background:rgba(0,0,0,.2);border:1px solid rgba(0,170,255,.1);border-radius:3px">'
    +_tsHistStatHtml('Score actuel',last,lCol)
    +_tsHistStatHtml('Moyenne 30j',avg,'rgba(0,200,255,.8)')
    +_tsHistStatHtml('Max 30j',maxS,'rgba(255,59,92,.7)')
    +_tsHistStatHtml('Min 30j',minS,'rgba(0,255,136,.7)')
    +_tsHistStatHtml('Points',history.length,'rgba(160,220,255,.5)')
    +'</div>'
    +'<div style="background:rgba(0,0,0,.25);border:1px solid rgba(0,170,255,.12);border-radius:3px;padding:.5rem">'
    +'<canvas id="ts-hist-canvas" height="160" style="width:100%;display:block"></canvas>'
    +'</div>'
    +'<div style="display:flex;gap:.45rem;flex-wrap:wrap">'
    +_tsHistLevelHtml('CRITIQUE',scores.filter(function(s){return s>=75;}).length,history.length,'rgba(255,59,92,.8)')
    +_tsHistLevelHtml('ÉLEVÉ',scores.filter(function(s){return s>=50&&s<75;}).length,history.length,'rgba(255,107,35,.75)')
    +_tsHistLevelHtml('MOYEN',scores.filter(function(s){return s>=30&&s<50;}).length,history.length,'rgba(255,215,0,.75)')
    +_tsHistLevelHtml('FAIBLE',scores.filter(function(s){return s<30;}).length,history.length,'rgba(0,255,136,.75)')
    +'</div>'
    +'</div>';
  _modalBody.innerHTML=h;
  setTimeout(function(){_drawTsHistChart(history);},30);
}
function _drawTsHistChart(history){
  var canvas=document.getElementById('ts-hist-canvas');
  if(!canvas)return;
  var W=canvas.offsetWidth||600;
  canvas.width=W;
  var H=160,PL=36,PR=8,PT=8,PB=26;
  var cW=W-PL-PR,cH=H-PT-PB;
  var ctx=canvas.getContext('2d');
  if(!ctx)return;
  ctx.clearRect(0,0,W,H);
  // Bands CRITIQUE/ÉLEVÉ/MOYEN/FAIBLE
  [[75,100,'rgba(255,59,92,.07)'],[50,75,'rgba(255,107,35,.06)'],[30,50,'rgba(255,215,0,.05)'],[0,30,'rgba(0,255,136,.05)']].forEach(function(b){
    ctx.fillStyle=b[2];
    var y1=PT+(1-b[1]/100)*cH,y2=PT+(1-b[0]/100)*cH;
    ctx.fillRect(PL,y1,cW,y2-y1);
  });
  // Gridlines + labels Y
  [0,25,50,75,100].forEach(function(v){
    var y=PT+(1-v/100)*cH;
    ctx.strokeStyle=v===50?'rgba(255,215,0,.15)':'rgba(0,170,255,.08)';
    ctx.lineWidth=v===50?1:.5;
    ctx.beginPath();ctx.moveTo(PL,y);ctx.lineTo(PL+cW,y);ctx.stroke();
    ctx.fillStyle='rgba(160,220,255,.35)';
    ctx.font='9px Courier New,monospace';
    ctx.textAlign='right';
    ctx.fillText(v,PL-3,y+3);
  });
  // Downsample >200pts
  var pts=history;
  if(pts.length>200){var step=Math.floor(pts.length/200);pts=pts.filter(function(_,i){return i%step===0;});pts.push(history[history.length-1]);}
  var n=pts.length;
  var cx=function(i){return PL+i*cW/(n-1);};
  var cy=function(s){return PT+(1-Math.min(100,Math.max(0,s))/100)*cH;};
  // Fill area
  ctx.beginPath();ctx.moveTo(cx(0),PT+cH);
  pts.forEach(function(e,i){ctx.lineTo(cx(i),cy(e.score||0));});
  ctx.lineTo(cx(n-1),PT+cH);ctx.closePath();
  ctx.fillStyle='rgba(0,170,255,.05)';ctx.fill();
  // Colored line segments
  for(var i=1;i<n;i++){
    var s=pts[i].score||0;
    ctx.strokeStyle=s>75?'rgba(255,59,92,.9)':s>50?'rgba(255,107,35,.85)':s>30?'rgba(255,215,0,.8)':'rgba(0,255,136,.8)';
    ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(cx(i-1),cy(pts[i-1].score||0));ctx.lineTo(cx(i),cy(s));ctx.stroke();
  }
  // Last point dot
  var lS=pts[n-1].score||0;
  ctx.beginPath();ctx.arc(cx(n-1),cy(lS),3.5,0,Math.PI*2);
  ctx.fillStyle=lS>75?'rgba(255,59,92,.9)':lS>50?'rgba(255,107,35,.85)':lS>30?'rgba(255,215,0,.8)':'rgba(0,255,136,.8)';
  ctx.fill();
  // X labels — one per day (max 10 visible)
  var days=[],lastD='';
  pts.forEach(function(e,i){var d=(e.ts||'').substring(0,10);if(d&&d!==lastD){days.push({i:i,d:d});lastD=d;}});
  var showEvery=Math.ceil(days.length/10);
  ctx.fillStyle='rgba(160,220,255,.35)';ctx.font='9px Courier New,monospace';ctx.textAlign='center';
  days.forEach(function(dp,idx){
    if(idx%showEvery!==0)return;
    var x=cx(dp.i);var parts=dp.d.split('-');
    ctx.fillText(parts[2]+'/'+parts[1],x,H-5);
    ctx.strokeStyle='rgba(0,170,255,.06)';ctx.lineWidth=.5;
    ctx.beginPath();ctx.moveTo(x,PT);ctx.lineTo(x,PT+cH);ctx.stroke();
  });
}

// NDT-18a — colonne droite : jauges CPU/RAM/DSK + sparklines réseau
function _rtRingHtml(cpu,mem,disk,hasNet,rtLRx,rtLTx){
  var rtCpuCol=cpu>_THR_CPU_CRIT?'var(--red)':cpu>_THR_CPU_WARN?'var(--yellow)':'var(--cyan)';
  var rtMemCol=(mem.pct||0)>_THR_CPU_CRIT?'var(--red)':(mem.pct||0)>_THR_CPU_WARN?'var(--yellow)':'var(--green)';
  var rtDskCol=(disk.pct||0)>_THR_CPU_CRIT?'var(--red)':(disk.pct||0)>_THR_CPU_WARN?'var(--yellow)':'var(--green)';
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
    return{k:k,h:parseInt(k,10)||0,blk:(_hmBph[k]||0)+(_hmEph[k]||0),req:_hmRph[k]||0};
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
// NDT-35 — carte Activité RT : courbe requêtes/blocages + rings → retourne HTML string
// ── Config heatmap tuiles — source unique (no-hardcode) ─────────────────
var _HM_TILE_DEFS={
  traffic:{
    title:'HEATMAP TRAFIC — 24H',
    canvasId:'heatmap-canvas',
    color:'0,217,255',
    label:'Requêtes',
    sublabel:'2xx·3xx·4xx — échelle linéaire',
    kpis:function(t){return [
      {col:'0,217,255,0.7',  val:fmt(t.total_requests),     suffix:'req'},
      {col:'122,154,184,0.6',val:(t.bots||0),               suffix:'bots'},
      {col:'255,100,100,0.7',val:(t.status_5xx||0),         suffix:'5xx'},
    ];},
    footer:''   // pas de _rtTopAttackHtml en mode trafic
  },
  attacks:{
    title:'HEATMAP ATTAQUES — 24H',
    canvasId:'heatmap-canvas-atk',
    color:'255,59,92',
    label:'Bloqués+Erreurs',
    sublabel:'GeoIP·F2B·5xx — échelle dédiée',
    kpis:function(t){var pct=t.total_requests?Math.round((t.geo_blocks||0)*100/t.total_requests*10)/10:0;return [
      {col:'255,59,92,0.8',  val:(t.geo_blocks||0),         suffix:'bloqués'},
      {col:'255,59,92,0.6',  val:pct+'%',                   suffix:'bloquage'},
      {col:'255,100,100,0.7',val:(t.status_5xx||0),         suffix:'5xx'},
    ];},
    footer:'top'   // ajoute _rtTopAttackHtml en mode attaques
  }
};
function _heatmapCardHtml(t,kind){
  // Render commun aux 2 tuiles heatmap — paramètres dans `_HM_TILE_DEFS[kind]`.
  // Factorisation 2026-05-17 : élimine duplication HTML entre tuile TRAFIC et
  // tuile ATTAQUES (mêmes structure card/legend/KPI, seuls les contenus varient).
  var c=_HM_TILE_DEFS[kind];
  var kpiHtml=c.kpis(t).map(function(k){
    return '<span style="color:rgba('+k.col+')">◈ <strong>'+k.val+'</strong> '+k.suffix+'</span>';
  }).join('');
  return '<div class="card half"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬡</span>'+c.title+'</div>'
   +'<canvas class="heatmap-canvas" id="'+c.canvasId+'" height="180"></canvas>'
   +'<div class="heatmap-legend" style="flex-direction:column;gap:.3rem;margin-top:.45rem">'
   +'<div style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap">'
   +'<span><span class="heatmap-leg-c" style="background:rgba('+c.color+',0.55)"></span>'
   +'<strong style="color:rgba('+c.color+',0.9)">'+c.label+'</strong>'
   +' <span style="color:var(--muted)">'+c.sublabel+'</span></span>'
   +'<span style="margin-left:auto;font-size:var(--fs-xs);color:var(--muted);white-space:nowrap">fenêtre 24h</span>'
   +'</div>'
   +'<div style="display:flex;gap:.6rem;flex-wrap:wrap;padding-top:.25rem;border-top:1px solid rgba(255,255,255,0.05);font-size:var(--fs-xs)">'
   +kpiHtml
   +'</div>'
   +(c.footer==='top'?_rtTopAttackHtml(t):'')
   +'</div></div></div>';
}
// Alias backward-compat (un seul call site historique côté 09-modals-core)
function _heatmapTileCardHtml(t){return _heatmapCardHtml(t,'traffic');}
function _heatmapAttacksTileCardHtml(t){return _heatmapCardHtml(t,'attacks');}
function _renderHeatmapTile(d,g){
  var t=d.traffic||{};
  if(!(t.requests_per_hour&&Object.keys(t.requests_per_hour).length)) return;
  g.insertAdjacentHTML('beforeend',_heatmapTileCardHtml(t));
  _raf2(function(){
    var hc=document.getElementById('heatmap-canvas');
    if(hc)animateAttackHeatmap(hc,t.requests_per_hour||{},t.blocks_per_hour||{},t.errors_per_hour||{},undefined,'traffic');
  });
}
function _renderHeatmapAttacksTile(d,g){
  // Tuile dédiée ATTAQUES (rouge) — échelle propre 0→maxAtk, séparée du trafic.
  var t=d.traffic||{};
  if(!(t.requests_per_hour&&Object.keys(t.requests_per_hour).length)) return;
  g.insertAdjacentHTML('beforeend',_heatmapAttacksTileCardHtml(t));
  _raf2(function(){
    var hc=document.getElementById('heatmap-canvas-atk');
    if(hc)animateAttackHeatmap(hc,t.requests_per_hour||{},t.blocks_per_hour||{},t.errors_per_hour||{},undefined,'attacks');
  });
}


// ── Tuiles Windows → fichier 07b-render-windows.js (Sprint 2B 2026-05-16) ─

// ── Tuile Proxmox → fichier 07c-render-proxmox.js (Sprint 2B 2026-05-16) ─

// ── render zone helpers ──────────────────────────────────────────────────────
function _renderZoneHero(d,g){
  _renderKillChain(d,g);
  _renderGeoMap(d,g);
  g.insertAdjacentHTML('beforeend',secBar('◉','MENACES EN COURS',_COL_RED_HEX,'Kill Chain · analyse temps réel'));
  _renderThreatScore(d,g);
  _renderAutoBan(d,g);
  _renderSecurite24h(d,g);
  _renderThreatIntel(d,g);
}
function _renderZoneDefenses(d,g){
  g.insertAdjacentHTML('beforeend',secBar('⊛','BOUCLIER ACTIF',_COL_SHIELD_HEX,'CrowdSec · fail2ban · UFW'));
  _renderStackDefense(d,g);
  if(window._renderDefenseChain) window._renderDefenseChain(d,g);
  window._xdrLastData = d;
  _renderProtectionActive(d,g);
  _renderIntelMenaces(d,g);
}
function _renderZoneDetection(d,g){
  var _surRules=(d.suricata&&d.suricata.rules_loaded)?Math.round(d.suricata.rules_loaded/1000)+'k':'—';
  g.insertAdjacentHTML('beforeend',secBar('◈','DÉTECTION RÉSEAU',_COL_MITRE_EXEC_HEX,'Suricata IDS · '+_surRules+' règles actives'));
  _renderSuricata(d,g);
  g.insertAdjacentHTML('beforeend',secBar('◈','RENSEIGNEMENT ATTAQUANTS',_COL_ORANGE_HEX,'Honeypot · CVE'));
  _renderHoneypot(d,g);
  _renderMitre(d,g);
  _renderCve(d,g);
}
function _renderZoneTrafic(d,g){
  g.insertAdjacentHTML('beforeend',secBar('◇','FLUX & ACTIVITÉ RÉSEAU',_COL_CYAN_HEX,'Trafic nginx · LAN'));
  _renderHeatmapTile(d,g);
  _renderHeatmapAttacksTile(d,g);
  _renderProtoActifs(d,g);
  _renderTopPages(d,g);
  _renderTrafic24h(d,g);
  _renderFluxLive(d,g);
  _renderFreeboxPrepare(d);
}
function _renderZoneInfra(d,g){
  g.insertAdjacentHTML('beforeend',secBar('◈','INFRASTRUCTURE & RÉSEAU',_COL_YELLOW_HEX,'Proxmox VE · VMs · LAN'));
  _renderProxmox(d,g);
  _renderSistemeReseau(d,g);
  _renderSSH(d,g);
}
function _renderZoneSystem(d,g){
  g.insertAdjacentHTML('beforeend',secBar('⬆','SANTÉ SYSTÈME',_COL_HEALTH_HEX,'Mises à jour · services · ressources'));
  _renderZone5B(d,g);
  _renderRsyslogTile(d,g);
  if(window._renderAide) window._renderAide(d,g);
  _renderWindowsTiles(d,g);
}
function _renderZoneIA(d,g){
  g.insertAdjacentHTML('beforeend',secBar('⬡','IA — JARVIS PROACTIVE',_COL_PURPLE_HEX,'LLM local · analyse SOC · auto-engine'));
  _renderJarvisTiles(d,g);
  if(window._jvAfterRender) window._jvAfterRender();
}
function _renderPostProcess(d,g){
  updateAlertStrip(d);
  var t=d.traffic||{};
  _snap={geo:t.geo_blocks||0,err:t.error_rate||0,ufw:(d.ufw||{}).blocked_total||0,f2b:(d.fail2ban||{}).total_banned||0};
  _checkAutoBanAlerts(d.autoban_log||[]);
  requestAnimationFrame(function(){
    g.style.transition='opacity .18s ease';g.style.opacity='1';
    if(window._socPanelRestoreActive) window._socPanelRestoreActive();
  });
}
// eslint-disable-next-line no-unused-vars -- entry point global appelé par 17-fetch.js:18 (pas de modules ES)
function render(d){
  window._lastData=d;
  window._lastTraffic=d.traffic||{};
  _renderHUD(d);
  if(_kcAnimFrame){cancelAnimationFrame(_kcAnimFrame);_kcAnimFrame=null;}
  var g=_dom('grid');g.style.transition='none';g.style.opacity='0';g.innerHTML='';
  _renderZoneHero(d,g);
  _renderZoneDefenses(d,g);
  _renderZoneDetection(d,g);
  _renderZoneTrafic(d,g);
  _renderZoneInfra(d,g);
  _renderZoneSystem(d,g);
  _renderZoneIA(d,g);
  _renderPostProcess(d,g);
}
