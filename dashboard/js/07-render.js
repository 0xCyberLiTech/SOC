'use strict';
// ── Contexte statique JARVIS — synthèse rsyslog ──────────────────────────────
// Injecté dans le prompt LLM à chaque clic "SYNTHÈSE IA".
// Mettre à jour ici si l'infrastructure change (nouveaux hôtes, nouvelles plages CDN, etc.)
var _RSYSLOG_JARVIS_CTX=[
  'CONTEXTE INFRASTRUCTURE (rôle de chaque hôte) :',
  '  clt  = VM Apache + fail2ban (site cybersécurité, VM 106, <CLT-IP>)',
  '  pa85 = VM Apache + fail2ban (site associatif PA85, VM 107, <PA85-IP>)',
  '  pve  = Proxmox VE hyperviseur (hôte physique <PROXMOX-IP>, héberge clt/pa85/srv-ngix)',
  '  <ROUTER-HOSTNAME> = Routeur ASUS WAN/LAN (<ROUTER-IP>, firmware <ROUTER-FIRMWARE>)\n',
  'CONTEXTE programs_unused (sources présentes NON exploitées par le SOC) :',
  '  kernel sur clt/pa85 = fichiers VIDES (0 lignes actives) — aucun événement noyau en cours, pas urgent',
  '  pve-firewall = activé le 2026-04-24 (host.fw log_level_in:warning) — en remplissage, normal',
  '  RÈGLE : ne recommander d\'activer une source que si elle contient des données réelles\n',
  'CONTEXTE WAN <ROUTER-HOSTNAME> :',
  '  Reconnexions WAN = instabilité FAI ou matérielle probable (câble/modem/ligne)',
  '  N\'EST PAS une attaque sauf si corrélé avec IPs kill chain dans trafic sortant',
  '  Seuils : ≤2/24h stable · 3-5 attention · ≥6 instabilité critique\n',
  'CONTEXTE IPs OUTBOUND — plages légitimes (NE PAS qualifier de suspectes) :',
  '  35.x=AWS · 34.x=GCP · 216.239.x=Google · 142.250.x=Google · 150.171.x=Microsoft/M365',
  '  52.x=Azure · 157.240.x=Meta/Instagram · 185.60.x=Meta · 31.13.x=Meta · 57.144.x=Meta-CDN · 163.70.x=Meta-CDN\n'
].join('\n');
// ── Cache DOM — éléments persistants récupérés à chaque render (D11) ──
const _dc=Object.create(null);
function _dom(id){ if(!_dc[id]||!_dc[id].isConnected) _dc[id]=document.getElementById(id); return _dc[id]; }
// ── Double rAF — garantit un layout pass complet avant draw canvas (D7/N5) ──
function _raf2(fn){ requestAnimationFrame(function(){ requestAnimationFrame(fn); }); }

// ── Helpers hoistés (D8 — sortis de render() pour éviter la redéfinition à chaque cycle) ──
function secBar(ic,lb,cl,sub){return '<div class="sec-bar" style="border-left-color:'+cl+';color:'+cl+';background:'+cl+'0d"><span>'+ic+'</span><span>'+lb+(sub?'<span class="sec-bar-sub"> · '+sub+'</span>':'')+'</span></div>';}

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
   +(cpu!==undefined?'<div class="sum-item"><div class="sum-val '+(cpu>85?'crit':cpu>60?'warn':'ok')+'">'+cpu+'%</div><div class="sum-lbl">CPU srv-ngix</div></div>':'')
   +(mem.pct!==undefined?'<div class="sum-item"><div class="sum-val '+(mem.pct>85?'crit':mem.pct>60?'warn':'ok')+'">'+mem.pct+'%</div><div class="sum-lbl">RAM srv-ngix</div></div>':'')
   +'<div class="sum-item"><div class="sum-val" style="font-size:var(--fs-md)">'+fmtB(t.total_bytes)+'</div><div class="sum-lbl">Bande passante · 24h</div></div>'
   +(sys.uptime?'<div class="sum-item"><div class="sum-val" style="font-size:var(--fs-sm)">'+esc(sys.uptime)+'</div><div class="sum-lbl">Uptime srv-ngix</div></div>':'')
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
     +`<span style="color:rgba(0,255,136,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">⊛ ${esc(rule)}</span>`
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
  if(_aCard)_aCard.addEventListener('click',function(){openAutoBanModal();});
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
      +`<div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#ff3b5c88,#ff3b5c);border-radius:2px"></div></div>`
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
  document.getElementById('suricata-card').addEventListener('click',function(){openSuricataModal(window._lastData&&window._lastData.suricata);});
}

function _hptRisk(path){
  var p=path.toLowerCase();
  var crit=['.env','wp-config','.git/config','passwd','shadow','.ssh','id_rsa','config.php','credentials','secret','token','database','db.php','.htpasswd'];
  var high=['cgi-bin','phpinfo','shell','cmd','exec','wp-login','wp-admin','.htaccess','phpmyadmin','adminer','console','manager','actuator'];
  if(crit.some(function(k){return p.indexOf(k)>=0;})) return {label:'CRITIQUE',col:'#ef4444'};
  if(high.some(function(k){return p.indexOf(k)>=0;})) return {label:'ÉLEVÉ',col:'#ff6b35'};
  return {label:'INFO',col:'#f59e0b'};
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
    {id:'T1595',    name:'Active Scanning',       tac:'RECON',  score:sc.RECON||0,                         src:'CrowdSec·RECON',         col:'#bf5fff'},
    {id:'T1595.002',name:'Vuln. Scanning',         tac:'RECON',  score:(sc.SCAN||0)+surSev2,                src:'CrowdSec·Suricata·SCAN', col:'#a855f7'},
    {id:'T1190',    name:'Exploit Public App',     tac:'ACCESS', score:exploitScore,                        src:'CrowdSec·WAF·Suricata',  col:'#ff3b5c'},
    {id:'T1059',    name:'Command Exec / ShellInj',tac:'EXEC',   score:surSev1,                             src:'Suricata·IDS·sév1',      col:'#ff4500'},
    {id:'T1190.002',name:'Web Bots / Scraping',    tac:'ACCESS', score:webBotScore,                         src:'F2B·CLT·PA85',           col:'#ff6b35'},
    {id:'T1110',    name:'Brute Force SSH',        tac:'CRED',   score:(sc.BRUTE||0)+sshFail+sshBansAll,    src:'CrowdSec·F2B·SSH',       col:'#ffd700'},
    {id:'T1071',    name:'C2 / Trafic suspect',    tac:'C&C',    score:Math.max(0,surTotal-surSev1-surSev2), src:'Suricata·réseau',        col:'#20b2aa'},
    {id:'T1499',    name:'DoS / Bans — '+_f2bActive+' hôtes', tac:'IMPACT', score:totalBansAll,           src:'F2B·'+_f2bActive+' hôtes',col:'#00d9ff'},
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
    {ico:'◈', lbl:'fail2ban — srv-ngix', sub:'Protection SSH · Nginx',       val:f2b.total_banned||0,                          col:'rgba(0,217,255,.85)',  ok:!!(f2b.jails&&f2b.jails.length)},
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
    +'<span data-panel="RÔLE : protection locale contre les attaques répétées — analyse les logs système en temps réel et bannit automatiquement les IPs qui dépassent les seuils configurés. Couvre 4 hôtes indépendants : srv-ngix · Proxmox · CLT · PA85.\n\nMÉCANISME : scrute les logs (nginx · SSH · Apache) → détecte les patterns répétés (X échecs en Y secondes) → ban IP via iptables/nftables pour une durée configurable. Chaque hôte a ses propres jails, seuils et bantimes. Réaction en secondes.\n\nMÉTRIQUES SURVEILLÉES : bans actifs par hôte · jails actives / total · bantimes configurés · IPs récidivistes. Un hôte avec 0 bans = calme ou jail inactive — vérifier que les jails sont bien enabled.\n\nCOMPORTEMENT ATTENDU : bans en hausse = attaque en cours mais maîtrisée. Jails actives > 0 sur chaque hôte = protection en place. Si bans = 0 sur un hôte exposé (srv-ngix · CLT), investiguer l état des jails.\n\nPIPELINE : logs nginx/SSH/Apache → fail2ban daemon → règles iptables/nftables → monitoring_gen.py collecte statuts 4 hôtes → monitoring.json → dashboard SOC.\n\nJARVIS (si online) : corrèle les bans fail2ban avec la Kill Chain. Les bans SSH contribuent au score BRUTE. JARVIS peut escalader un ban fail2ban (temporaire) en décision CrowdSec (communautaire · permanent) si l IP atteint le niveau CRITIQUE.\n\nVALEUR AJOUTÉE : réaction locale ultra-rapide (secondes) sur des règles simples et fiables. Complémentaire à CrowdSec : fail2ban réagit vite sur des patterns simples, CrowdSec détecte des comportements distribués sur plusieurs IPs et plusieurs jours. Ensemble ils couvrent 100% du spectre de bruteforce." data-panel-title="FAIL2BAN — ÉTAT DÉTAILLÉ · 4 HÔTES" class="soc-panel-i" style="--pi-dim:rgba(255,107,53,.45);--pi-bright:rgba(255,107,53,.9);--pi-glow:rgba(255,107,53,.5)">ⓘ</span>'
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
    var mx=Math.max.apply(null,hours.map(function(hh){return hh[1]}))||1;
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
  var jvAct=0;try{jvAct=((window._jvAutoState||{}).actionLog||[]).filter(function(a){return Date.now()-new Date(a.ts).getTime()<86400000;}).length;}catch(e){}
  var jvModel=(typeof _jvActiveModel!=='undefined'&&_jvActiveModel)||'phi4-reasoning';
  var S=[
    {n:'①',lbl:'COLLECTE',col:svcOk?'#00e676':'#ff3b5c',on:svcOk,
     desc:'rsyslog :514 TCP/UDP — srv-ngix centralise tous les logs LAN',
     stat:totalFiles+' fichiers · '+linesTotal+' L/min'},
    {n:'②',lbl:'CORRÉLATION',col:'#00bcd4',on:true,
     desc:'monitoring_gen.py — cycle 60s — croise logs, kill chain et routeur',
     stat:corrCount+' corrélation'+(corrCount!==1?'s':'')+' kill chain↔routeur'},
    {n:'③',lbl:'DÉTECTION',col:activeIps>0?'#ff9800':'rgba(185,215,240,.4)',on:activeIps>0||neutralized>0,
     desc:'Kill Chain classe les IPs (RECON→SCAN→EXPLOIT→BRUTE→NEUTRALISÉ)',
     stat:activeIps+' IP'+(activeIps!==1?'s':'')+' active'+(activeIps!==1?'s':'')+' · '+neutralized+' neutralisée'+(neutralized!==1?'s':'')},
    {n:'④',lbl:'RÉPONSE AUTO',col:banCount>0?'#00e676':'rgba(185,215,240,.4)',on:banEvts>0||banCount>0,
     desc:'fail2ban + CrowdSec bannissent — SOC auto-ban si niveau ÉLEVÉ/CRITIQUE',
     stat:banCount+' IP'+(banCount!==1?'s':'')+' bannies · '+banEvts+' ban'+(banEvts!==1?'s':'')+'/24h'},
    {n:'⑤',lbl:'JARVIS IA',col:jvAct>0?'#ce93d8':'rgba(206,147,216,.4)',on:jvAct>0,
     desc:jvModel+' · synthèse LLM · alerte vocale · intervient si rien fait',
     stat:jvAct>0?(jvAct+' intervention'+(jvAct!==1?'s':'')+'/24h'):'Veille — agit si menace non traitée'}
  ];
  var h='<div style="margin:.5rem 0;border:1px solid rgba(0,188,212,.16);border-radius:5px;overflow:hidden">'
    +'<div style="background:rgba(0,188,212,.06);padding:.24rem .5rem;font-size:var(--fs-xs);color:#00bcd4;letter-spacing:.5px;border-bottom:1px solid rgba(0,188,212,.13)">⬡ CHAÎNE DE DÉFENSE — MÉCANISME AUTOMATIQUE</div>'
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
function _rsyslogJarvisProactiveHtml(d,xh){
  var kc=d.kill_chain||{};
  var c2=(kc.active_ips||[]).filter(function(e){return e.router_seen;});
  var ma=Object.keys(xh.multi_apache||{});
  var seen={},threats=[];
  c2.forEach(function(e){if(!seen[e.ip]){seen[e.ip]=1;threats.push({ip:e.ip,cat:'C2 OUTBOUND',col:'#ff2060',rgb:'255,32,96'});}});
  ma.forEach(function(ip){if(!seen[ip]){seen[ip]=1;threats.push({ip:ip,cat:'RECON MULTI-CIBLES',col:'#ff9800',rgb:'255,152,0'});}});
  var m=(typeof _jvActiveModel!=='undefined'&&_jvActiveModel)||'phi4-reasoning';
  var stLbl=threats.length>0?'MENACE — PRÊT À INTERVENIR':'VEILLE ACTIVE',stCol=threats.length>0?'#ff9800':'#00e676';
  var fl=[{l:'① SURVEILLE',s:'Logs rsyslog 24h/7j',on:true},{l:'② ANALYSE',s:'LLM '+m,on:true},{l:'③ INTERVIENT',s:'Si menace non traitée',on:threats.length>0}];
  var h='<div style="border:1px solid rgba(156,39,176,.22);border-radius:5px;margin:.4rem 0;overflow:hidden">'
    +'<div style="background:rgba(156,39,176,.07);padding:.24rem .5rem;display:flex;align-items:center;gap:.4rem;border-bottom:1px solid rgba(156,39,176,.16)">'
    +'<span style="font-size:var(--fs-xs);color:#ce93d8;letter-spacing:.5px;font-weight:700">◈ JARVIS — SURVEILLANCE &amp; INTERVENTION PROACTIVE</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:'+stCol+';margin-left:auto;font-family:\'Courier New\',monospace;font-weight:700">'+esc(stLbl)+'</span>'
    +'</div><div style="padding:.28rem .42rem">'
    +'<div style="display:flex;align-items:stretch;gap:.18rem;margin-bottom:.28rem">';
  fl.forEach(function(f,i){
    var fc=f.on?'#ce93d8':'rgba(206,147,216,.28)';
    h+='<div style="flex:1;background:'+(f.on?'rgba(156,39,176,.09)':'rgba(156,39,176,.02)')+';border:1px solid '+(f.on?'rgba(156,39,176,.28)':'rgba(156,39,176,.07)')+';border-radius:3px;padding:.14rem .22rem;text-align:center">'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:'+fc+';font-weight:700;font-family:\'Courier New\',monospace;line-height:1.3">'+esc(f.l)+'</div>'
      +'<div style="font-size:calc(var(--fs-xs) - 2px);color:rgba(206,147,216,.38);line-height:1.2">'+esc(f.s)+'</div>'
      +'</div>';
    if(i<fl.length-1)h+='<div style="display:flex;align-items:center;color:rgba(156,39,176,.35);font-size:var(--fs-xs);padding:0 .04rem">→</div>';
  });
  h+='</div>';
  if(threats.length){
    h+='<div style="border-top:1px solid rgba(255,32,96,.14);padding-top:.22rem">'
      +'<div style="font-size:var(--fs-xs);color:#ff6090;font-weight:700;margin-bottom:.16rem">⚠ '+threats.length+' IP'+(threats.length>1?'s':'')+' non traitée'+(threats.length>1?'s':'')+' — JARVIS peut intervenir</div>'
      +'<div style="display:flex;flex-direction:column;gap:.12rem">'
      +threats.map(function(t){
        return '<div style="display:flex;align-items:center;gap:.35rem;background:rgba('+t.rgb+',.07);border:1px solid rgba('+t.rgb+',.18);border-radius:3px;padding:.12rem .3rem">'
          +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:'+t.col+';min-width:9rem;font-weight:600">'+esc(t.ip)+'</span>'
          +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.38);flex:1">'+esc(t.cat)+'</span>'
          +'<button class="rs-ban-btn" data-ip="'+esc(t.ip)+'" style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(255,32,96,.14);border:1px solid rgba(255,32,96,.38);color:#ff6090;border-radius:3px;padding:.11rem .35rem;cursor:pointer">🚫 BANNIR</button>'
          +'</div>';
      }).join('')
      +'</div>'
      +'<button id="rs-jv-all" style="margin-top:.25rem;width:100%;font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(156,39,176,.14);border:1px solid rgba(156,39,176,.4);color:#ce93d8;border-radius:3px;padding:.2rem;cursor:pointer;letter-spacing:.25px">◈ JARVIS INTERVIENT — bannir les '+threats.length+' IP'+(threats.length>1?'s':'')+' proactivement</button>'
      +'</div>';
  }else{
    h+='<span style="font-size:var(--fs-xs);color:rgba(206,147,216,.38);font-style:italic">Aucune menace non traitée — JARVIS surveille en veille active</span>';
  }
  h+='</div></div>';
  return h;
}
// NDT-178 — openRsyslogModal: schéma SVG animé flux rsyslog + audit couverture + table hôtes
function openRsyslogModal(){
  var d=window._lastData||{};
  var rs=d.rsyslog||{}, xh=d.xhosts||{};
  var svc=rs.service||'unknown', svcOk=svc==='active';
  var svcCol=svcOk?'var(--green)':'#ff3b5c';
  var hosts=rs.hosts||{};
  var hostKeys=['clt','pa85','pve','GT-BE98-87B0-011D764-C'];
  var hostLabels={'GT-BE98-87B0-011D764-C':'<ROUTER-HOSTNAME>'};
  var rotTs=rs.last_rotate_ts, rotStr='—';
  if(rotTs){var rd=new Date(rotTs);rotStr=rd.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' '+rd.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
  var _rsBox='background:rgba(0,188,212,.07);border:1px solid rgba(0,188,212,.2);border-radius:4px;padding:.35rem .5rem';

  function _hCol(hk){var st=(hosts[hk]||{}).status||'absent';return st==='ok'?'#00e676':st==='stale'?'#ffb300':'rgba(160,160,160,.4)';}
  function _lm(n){return n>=10000?Math.round(n/1000)+'k':n>=1000?(n/1000).toFixed(1)+'k':''+n;}
  function _flow(pth,clr,dur){
    return '<path d="'+pth+'" stroke="'+clr+'" stroke-width="1.5" fill="none" opacity=".16"/>'
      +'<path d="'+pth+'" stroke="'+clr+'" stroke-width="1.5" fill="none" stroke-dasharray="7 5" opacity=".78">'
      +'<animate attributeName="stroke-dashoffset" from="24" to="0" dur="'+dur+'" repeatCount="indefinite"/>'
      +'</path>';
  }
  var colClt=_hCol('clt'), colPa85=_hCol('pa85'), colPve=_hCol('pve'), colGt=_hCol('GT-BE98-87B0-011D764-C');

  // ── SVG animated schema ──────────────────────────────────────────────
  var jvAct2=0;try{jvAct2=((window._jvAutoState||{}).actionLog||[]).filter(function(a){return Date.now()-new Date(a.ts).getTime()<86400000;}).length;}catch(e){}
  var colJv=jvAct2>0?'rgba(206,147,216,.9)':'rgba(156,39,176,.45)';
  var svg='<svg viewBox="0 0 580 240" style="width:100%;height:auto;display:block;margin-bottom:.7rem" xmlns="http://www.w3.org/2000/svg">'
    +'<rect width="580" height="240" fill="rgba(0,5,15,.45)" rx="6"/>'
    // Column labels
    +'<text x="44" y="13" font-family="Courier New" font-size="7.5" fill="rgba(0,188,212,.35)" text-anchor="middle">SOURCES</text>'
    +'<text x="202" y="13" font-family="Courier New" font-size="7.5" fill="rgba(0,188,212,.35)" text-anchor="middle">COLLECTEUR</text>'
    +'<text x="348" y="13" font-family="Courier New" font-size="7.5" fill="rgba(156,39,176,.35)" text-anchor="middle">MOTEUR</text>'
    +'<text x="493" y="13" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.25)" text-anchor="middle">SORTIES</text>'
    // Source: clt (center-y=34)
    +'<rect x="4" y="22" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colClt+'" stroke-width="1.2"/>'
    +'<text x="16" y="37" font-family="Courier New" font-size="9.5" fill="'+colClt+'" font-weight="700">● clt</text>'
    +'<text x="84" y="37" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_lm((hosts.clt||{}).lines_min||0)+' L/m</text>'
    // Source: pa85 (center-y=82)
    +'<rect x="4" y="70" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colPa85+'" stroke-width="1.2"/>'
    +'<text x="16" y="85" font-family="Courier New" font-size="9.5" fill="'+colPa85+'" font-weight="700">● pa85</text>'
    +'<text x="84" y="85" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_lm((hosts.pa85||{}).lines_min||0)+' L/m</text>'
    // Source: pve (center-y=130)
    +'<rect x="4" y="118" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colPve+'" stroke-width="1.2"/>'
    +'<text x="16" y="133" font-family="Courier New" font-size="9.5" fill="'+colPve+'" font-weight="700">● pve</text>'
    +'<text x="84" y="133" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_lm((hosts.pve||{}).lines_min||0)+' L/m</text>'
    // Source: <ROUTER-HOSTNAME> (center-y=188)
    +'<rect x="4" y="176" width="82" height="24" rx="3" fill="rgba(0,0,0,.45)" stroke="'+colGt+'" stroke-width="1.2"/>'
    +'<text x="16" y="191" font-family="Courier New" font-size="9" fill="'+colGt+'" font-weight="700">● <ROUTER-HOSTNAME></text>'
    +'<text x="84" y="191" font-family="Courier New" font-size="7.5" fill="rgba(185,215,240,.38)" text-anchor="end">'+_lm((hosts['GT-BE98-87B0-011D764-C']||{}).lines_min||0)+' L/m</text>'
    // Animated pulses on active sources
    +((hosts.clt||{}).lines_min>0?'<circle cx="86" cy="34" r="2.5" fill="'+colClt+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="2.1s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="2.1s" repeatCount="indefinite"/></circle>':'')
    +((hosts.pa85||{}).lines_min>0?'<circle cx="86" cy="82" r="2.5" fill="'+colPa85+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="1.8s" repeatCount="indefinite"/></circle>':'')
    +((hosts.pve||{}).lines_min>0?'<circle cx="86" cy="130" r="2.5" fill="'+colPve+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="2.4s" repeatCount="indefinite"/></circle>':'')
    +((hosts['GT-BE98-87B0-011D764-C']||{}).lines_min>0?'<circle cx="86" cy="188" r="2.5" fill="'+colGt+'" opacity="0"><animate attributeName="r" values="2;5;2" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values=".55;0;.55" dur="1.5s" repeatCount="indefinite"/></circle>':'')
    // Animated flow: sources → collector
    +_flow('M 86 34 C 120 34 119 104 152 104',colClt,'1.4s')
    +_flow('M 86 82 C 120 82 119 108 152 108',colPa85,'1.7s')
    +_flow('M 86 130 C 120 130 119 112 152 112',colPve,'1.2s')
    +_flow('M 86 188 C 120 188 119 116 152 116',colGt,'1.9s')
    // Collector box (x=152 w=100 y=82 h=56)
    +'<rect x="152" y="82" width="100" height="56" rx="4" fill="rgba(0,25,45,.8)" stroke="rgba(0,188,212,.65)" stroke-width="1.5"/>'
    +'<text x="202" y="100" font-family="Courier New" font-size="9" fill="#00bcd4" font-weight="700" text-anchor="middle">SRV-NGIX</text>'
    +'<text x="202" y="112" font-family="Courier New" font-size="8.5" fill="rgba(0,188,212,.75)" text-anchor="middle">rsyslog</text>'
    +'<text x="202" y="124" font-family="Courier New" font-size="7.5" fill="rgba(0,188,212,.5)" text-anchor="middle">:514 TCP/UDP</text>'
    +'<rect x="162" y="142" width="80" height="13" rx="2" fill="'+(svcOk?'rgba(0,230,118,.12)':'rgba(255,59,92,.12)')+'" stroke="'+(svcOk?'rgba(0,230,118,.35)':'rgba(255,59,92,.35)')+'" stroke-width=".8"/>'
    +'<text x="202" y="152" font-family="Courier New" font-size="7.5" fill="'+(svcOk?'#00e676':'#ff3b5c')+'" text-anchor="middle" font-weight="700">'+(svcOk?'● ACTIVE':'● FAILED')+'</text>'
    // Collector → Engine
    +_flow('M 252 110 L 296 110','rgba(156,39,176,.9)','0.9s')
    // Engine box (x=296 w=104 y=82 h=56)
    +'<rect x="296" y="82" width="104" height="56" rx="4" fill="rgba(20,0,40,.8)" stroke="rgba(156,39,176,.65)" stroke-width="1.5"/>'
    +'<text x="348" y="99" font-family="Courier New" font-size="8" fill="#ce93d8" font-weight="700" text-anchor="middle" dominant-baseline="central">monitoring_gen.py</text>'
    +'<text x="348" y="112" font-family="Courier New" font-size="7.5" fill="rgba(206,147,216,.55)" text-anchor="middle" dominant-baseline="central">'+(xh.corr_count||0)+' corrélations</text>'
    +'<text x="348" y="123" font-family="Courier New" font-size="7.5" fill="rgba(206,147,216,.4)" text-anchor="middle" dominant-baseline="central">'+(rs.log_files||0)+' fichiers</text>'
    // Engine → 4 outputs
    +_flow('M 400 96 C 432 96 430 34 448 34','#ff5722','1.1s')
    +_flow('M 400 105 C 432 105 430 85 448 85','#00bcd4','0.8s')
    +_flow('M 400 115 C 432 115 430 136 448 136','#ff2060','1.3s')
    +_flow('M 400 124 C 432 124 430 193 448 193','rgba(156,39,176,.9)','1.6s')
    // Output: Kill Chain (center-y=34)
    +'<rect x="448" y="22" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="rgba(255,87,34,.5)" stroke-width="1.2"/>'
    +'<text x="493" y="38" font-family="Courier New" font-size="9" fill="#ff5722" text-anchor="middle" font-weight="700">Kill Chain</text>'
    // Output: Score menace (center-y=85)
    +'<rect x="448" y="73" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="rgba(0,188,212,.5)" stroke-width="1.2"/>'
    +'<text x="493" y="89" font-family="Courier New" font-size="9" fill="#00bcd4" text-anchor="middle" font-weight="700">Score menace</text>'
    // Output: Alertes (center-y=136)
    +'<rect x="448" y="124" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="rgba(255,32,96,.5)" stroke-width="1.2"/>'
    +'<text x="493" y="140" font-family="Courier New" font-size="9" fill="#ff2060" text-anchor="middle" font-weight="700">Alertes</text>'
    // Output: JARVIS IA (center-y=193)
    +'<rect x="448" y="181" width="90" height="24" rx="3" fill="rgba(0,0,0,.4)" stroke="'+colJv+'" stroke-width="1.2"/>'
    +'<text x="493" y="197" font-family="Courier New" font-size="9" fill="#ce93d8" text-anchor="middle" font-weight="700">JARVIS IA</text>'
    +'</svg>';

  // ── Stats grid 2×2 ───────────────────────────────────────────────────
  var statsHtml='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .8rem;margin-bottom:.6rem">'
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

  // ── Per-host compact table ────────────────────────────────────────────
  var hostsTableHtml='<div style="font-size:var(--fs-xs);color:#00bcd4;letter-spacing:.5px;margin:.3rem 0 .3rem;border-bottom:1px solid rgba(0,188,212,.2);padding-bottom:.2rem">▸ HÔTES — '+(rs.log_files||0)+' fichiers centralisés</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:var(--fs-xs);margin-bottom:.5rem">'
    +'<thead><tr>'
    +['Hôte','Fichiers','Taille','L/min','Délai','État'].map(function(lh,i){
      return '<th style="text-align:'+(i===0?'left':'right')+';color:rgba(0,188,212,.5);font-weight:500;padding:.15rem .3rem;border-bottom:1px solid rgba(255,255,255,.06)">'+lh+'</th>';
    }).join('')
    +'</tr></thead><tbody>'
    +hostKeys.map(function(hk){
      var hd=hosts[hk]||{}, lbl=hostLabels[hk]||hk;
      var st=hd.status||'absent';
      var col=st==='ok'?'var(--green)':st==='stale'?'#ffb300':'rgba(160,160,160,.4)';
      var dot=st==='ok'?'●':st==='stale'?'◉':'○';
      var barId=hk==='GT-BE98-87B0-011D764-C'?'gtbe98':hk;
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

  // ── Audit couverture logs (dynamique — depuis monitoring.json) ────────
  var auditHtml='<div style="font-size:var(--fs-xs);color:#ce93d8;letter-spacing:.5px;margin:.4rem 0 .3rem;border-bottom:1px solid rgba(156,39,176,.25);padding-bottom:.2rem">▸ COUVERTURE LOGS — sources exploitées vs disponibles</div>'
    +'<div style="display:flex;flex-direction:column;gap:.2rem;margin-bottom:.5rem">'
    +hostKeys.map(function(hk){
      var hd=hosts[hk]||{}, lbl=hostLabels[hk]||hk;
      var st=hd.status||'absent';
      var col=st==='ok'?'var(--green)':st==='stale'?'#ffb300':'rgba(160,160,160,.4)';
      var usedArr=hd.programs_used||[], unusedArr=hd.programs_unused||[];
      var total=usedArr.length+unusedArr.length;
      var pct=total>0?Math.round(usedArr.length/total*100):0;
      var barCol=pct>=80?'#00e676':pct>=50?'#ffb300':'#ff3b5c';
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

  // ── Correlation alert ─────────────────────────────────────────────────
  var cc=xh.corr_count||0;
  var corrHtml=cc>0
    ?'<div style="background:rgba(255,32,96,.08);border:1px solid rgba(255,32,96,.25);border-radius:4px;padding:.3rem .5rem;margin-bottom:.4rem">'
      +'<div style="font-size:var(--fs-xs);color:#ff2060;font-weight:700">⚠ CORRÉLATION ACTIVE — '+cc+' IP'+(cc>1?'s':'')+' kill chain dans connexions outbound</div>'
      +'<div style="font-size:var(--fs-xs);color:rgba(185,215,240,.5);margin-top:.1rem">IPs blacklistées présentes dans trafic sortant <ROUTER-HOSTNAME> — risque C2</div>'
      +'</div>'
    :'';

  // ── WAN instabilité — compteur 24h ───────────────────────────────────
  var wanCnt=rs.wan_reconnects_24h||0;
  var wanAlertHtml=wanCnt>0
    ?'<div style="background:'+(wanCnt>=6?'rgba(255,32,96,.09)':wanCnt>=3?'rgba(255,152,0,.08)':'rgba(0,230,118,.06)')+';border:1px solid '+(wanCnt>=6?'rgba(255,32,96,.35)':wanCnt>=3?'rgba(255,152,0,.3)':'rgba(0,230,118,.2)')+';border-radius:4px;padding:.28rem .5rem;margin-bottom:.4rem">'
      +'<div style="font-size:var(--fs-xs);color:'+(wanCnt>=6?'#ff2060':wanCnt>=3?'#ff9800':'#00e676')+';font-weight:700">⟁ WAN — '+wanCnt+' reconnexion'+(wanCnt>1?'s':'')+' / 24h'+(wanCnt>=6?' — INSTABILITÉ CRITIQUE':wanCnt>=3?' — INSTABILITÉ MODÉRÉE':' — normal')+'</div>'
      +'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.45);margin-top:.1rem">Seuils : ≤2 normal · 3-5 attention · ≥6 alerte</div>'
      +'</div>'
    :'';

  // ── Top outbound IPs (GT-BE98 router) ────────────────────────────────
  var topDst=rs.router_top_dst||[], topDstHtml='';
  if(topDst.length){
    var kc_ips=new Set((((window._lastData||{}).kill_chain||{}).active_ips||[]).map(function(e){return e.ip;}));
    topDstHtml='<div style="font-size:var(--fs-xs);color:#00bcd4;letter-spacing:.5px;margin:.4rem 0 .3rem;border-bottom:1px solid rgba(0,188,212,.2);padding-bottom:.2rem">▸ TOP IPs OUTBOUND — GT-BE98 (LAN → internet)</div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.2rem .4rem">'
      +topDst.map(function(e){
        var inKc=kc_ips.has(e.ip);
        return '<div style="background:'+(inKc?'rgba(255,32,96,.12)':'rgba(0,188,212,.06)')+';border:'+(inKc?'1px solid rgba(255,32,96,.35)':'1px solid rgba(0,188,212,.12)')+';border-radius:3px;padding:.15rem .3rem;display:flex;justify-content:space-between">'
          +'<span style="font-family:\'Courier New\',monospace;font-size:calc(var(--fs-xs) - 1px);color:'+(inKc?'#ff2060':'rgba(185,215,240,.7)')+'">'+esc(e.ip)+(inKc?' ⚠':'')+'</span>'
          +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.4)">'+e.hits+'</span>'
          +'</div>';
      }).join('')
      +'</div>';
  }

  // ── Fil d'événements structurés (24h) ────────────────────────────────
  var evts=(d.events||[]);
  var _evtIcon={'f2b_ban':'🚫','f2b_unban':'✓','http_scan':'⚡','vm_event':'⚙','ssh_fail':'🔑','backup_fail':'💾','backup_ok':'✅','fw_drop':'🛡','dhcp_lease':'📡','wan_restored':'⟁','wan_down':'⚠'};
  var _evtCol={'f2b_ban':'#ff3b5c','f2b_unban':'#00e676','http_scan':'#ff9800','vm_event':'#00bcd4','ssh_fail':'#ff3b5c','backup_fail':'#ff9800','backup_ok':'#00e676','fw_drop':'#ce93d8','dhcp_lease':'#4dd0e1','wan_restored':'#00e676','wan_down':'#ff9800'};
  var mc2=xh.multi_count||0;
  var multiWarnHtml=mc2>0
    ?'<div style="background:rgba(255,152,0,.08);border:1px solid rgba(255,152,0,.3);border-radius:3px;padding:.25rem .45rem;margin-bottom:.3rem;font-size:var(--fs-xs);color:#ff9800">⚠ '+mc2+' IP'+(mc2>1?'s':'')+' en recon multi-cibles (clt + pa85, sous seuil fail2ban)</div>'
    :'';
  var eventsHtml=multiWarnHtml
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

  // ── Synthèse IA — bouton JARVIS / RTX 5080 ───────────────────────────
  var aiHtml='<div style="border-top:1px solid rgba(156,39,176,.2);padding-top:.45rem;margin-top:.35rem">'
    +'<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">'
    +'<button id="rs-ai-btn" style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(156,39,176,.12);border:1px solid rgba(156,39,176,.45);color:#ce93d8;border-radius:3px;padding:.22rem .55rem;cursor:pointer;letter-spacing:.3px">⚙ SYNTHÈSE IA — RTX 5080</button>'
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
    +'<div id="rs-action-panel" style="display:none"></div>'
    +'</div>';

  var defChainHtml=_rsyslogDefChainHtml(d,rs,xh);
  var jarvisProactiveHtml=_rsyslogJarvisProactiveHtml(d,xh);
  var h=svg+statsHtml+hostsTableHtml+auditHtml+defChainHtml+corrHtml+wanAlertHtml+topDstHtml+eventsHtml+jarvisProactiveHtml+aiHtml;
  var mc=document.getElementById('modal-card');
  var mb=document.getElementById('modal-body'), mht=document.getElementById('modal-header-title');
  if(!mc||!mb||!mht)return;
  mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-kci','modal-fbx','modal-geomap','theme-red','theme-green','theme-cyan','theme-purple','theme-orange','theme-yellow');
  mht.textContent='// LOGS CENTRAUX — rsyslog';
  mb.innerHTML=h;
  // Animate L/min bars and disk gauge
  setTimeout(function(){
    var _lmMax=Math.max.apply(null,hostKeys.map(function(k){return (hosts[k]||{}).lines_min||0;}).concat([1]));
    [['clt','rs-lm-clt'],['pa85','rs-lm-pa85'],['pve','rs-lm-pve'],['GT-BE98-87B0-011D764-C','rs-lm-gtbe98']].forEach(function(p){
      var b=document.getElementById(p[1]);
      if(b)b.style.width=Math.min(100,Math.round(((hosts[p[0]]||{}).lines_min||0)/_lmMax*100))+'%';
    });
    var _db=document.getElementById('rs-disk-bar');
    if(_db){var _dm=rs.disk_mb||0,_df=rs.disk_free_mb||0;var _dp=_dm+_df>0?Math.min(100,Math.round(_dm/(_dm+_df)*100)):0;_db.style.width=_dp+'%';_db.style.background=_dp>80?'#ff3b5c':_dp>50?'#ff9800':'#00bcd4';}
  },80);
  // Bind ban buttons in proactive panel
  mb.querySelectorAll('.rs-ban-btn').forEach(function(btn){btn.addEventListener('click',function(){_kcBanIP(btn.dataset.ip,btn);});});
  // Bind JARVIS intervene-all
  var _jvAllBtn=document.getElementById('rs-jv-all');
  if(_jvAllBtn){
    var _c2All=((d.kill_chain||{}).active_ips||[]).filter(function(e){return e.router_seen;}).map(function(e){return e.ip;});
    var _maAll=Object.keys((d.xhosts||{}).multi_apache||{});
    var _allIps=[],_seenAll={};
    _c2All.concat(_maAll).forEach(function(ip){if(!_seenAll[ip]){_seenAll[ip]=1;_allIps.push(ip);}});
    _jvAllBtn.addEventListener('click',function(){
      if(_jvAllBtn._busy)return;
      _jvAllBtn._busy=true;_jvAllBtn.disabled=true;_jvAllBtn.textContent='◈ JARVIS EN COURS...';
      var _done=0;
      _allIps.forEach(function(ip,idx){
        setTimeout(function(){
          _kcBanIP(ip,{dataset:{ip:ip},textContent:'',disabled:false,_busy:false,addEventListener:function(){}});
          _done++;
          if(_done>=_allIps.length){_jvAllBtn.textContent='✓ JARVIS — '+_done+' IP'+(_done>1?'s':'')+' bannies';_jvAllBtn.style.color='#00e676';_jvAllBtn._busy=false;_jvAllBtn.disabled=false;}
        },idx*350);
      });
    });
  }
  _rsyslogRenderHistoryPills(_rsyslogGetHistory());
  var _aiBtn=document.getElementById('rs-ai-btn');
  if(_aiBtn) _aiBtn.addEventListener('click',function(){_rsyslogJarvisSynth(rs,xh,hosts,hostKeys,hostLabels,_aiBtn);});
  openModal();
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
  lines.push(cc>0?'⚠ '+cc+' IP(s) kill chain dans trafic sortant GT-BE98 — risque C2':'Pas de corrélation kill chain / trafic sortant.');
  lines.push(mc>0?'⚠ '+mc+' IP(s) recon multi-cibles (clt + pa85 sous seuil fail2ban)':'Pas de recon multi-cibles.');
  var wanC=rs.wan_reconnects_24h||0;
  lines.push('WAN reconnexions 24h: '+wanC+(wanC>=6?' — INSTABILITÉ CRITIQUE':wanC>=3?' — instabilité modérée':' — stable'));
  var td=rs.router_top_dst||[];
  if(td.length) lines.push('Top IPs outbound: '+td.slice(0,6).map(function(e){return e.ip+':'+e.hits;}).join(' | '));
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
  fetch('http://localhost:5000/api/chat',{
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
  var d=window._lastData||{};
  // IPs C2 : présentes dans kill chain ET dans trafic outbound router GT-BE98
  var c2Ips=(((d.kill_chain||{}).active_ips)||[]).filter(function(e){return e.router_seen;}).map(function(e){return e.ip;});
  // IPs recon multi-cibles : ont frappé clt ET pa85, pas encore bannies
  var maIps=Object.keys(xh.multi_apache||{});
  var seen={};
  var threats=[];
  c2Ips.forEach(function(ip){if(!seen[ip]){seen[ip]='c2';threats.push({ip:ip,cat:'C2 OUTBOUND',col:'#ff2060',rgb:'255,32,96'});}});
  maIps.forEach(function(ip){
    if(!seen[ip]){seen[ip]='ma';threats.push({ip:ip,cat:'RECON MULTI-CIBLES',col:'#ff9800',rgb:'255,152,0'});}
    else{var t=threats.filter(function(x){return x.ip===ip;})[0];if(t)t.cat+=' + RECON';}
  });
  if(!threats.length)return;
  var html='<div style="border-top:1px solid rgba(255,32,96,.2);padding-top:.4rem;margin-top:.35rem">'
    +'<div style="font-size:var(--fs-xs);color:#ff6090;font-weight:700;letter-spacing:.3px;margin-bottom:.28rem">⚠ '+threats.length+' IP'+(threats.length>1?'s MENACES — ACTIONS DÉFENSIVES DISPONIBLES':' MENACE — ACTION DÉFENSIVE DISPONIBLE')+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:.2rem">'
    +threats.map(function(t){
      var bg='rgba('+t.rgb+',.07)',bd='rgba('+t.rgb+',.22)';
      return '<div style="display:flex;align-items:center;gap:.5rem;background:'+bg+';border:1px solid '+bd+';border-radius:3px;padding:.18rem .4rem">'
        +'<span style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);color:'+t.col+';min-width:10rem;font-weight:600">'+esc(t.ip)+'</span>'
        +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.45);flex:1">'+esc(t.cat)+'</span>'
        +'<button class="rs-ban-btn" data-ip="'+esc(t.ip)+'" style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);background:rgba(255,32,96,.15);border:1px solid rgba(255,32,96,.4);color:#ff6090;border-radius:3px;padding:.15rem .45rem;cursor:pointer;letter-spacing:.2px">🚫 BANNIR 24h</button>'
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
    document.querySelectorAll('.rs-hist-pill').forEach(function(b){b.style.background='rgba(156,39,176,.08)';b.style.borderColor='rgba(156,39,176,.28)';b.style.color='rgba(206,147,216,.65)';});
  };
}
// NDT-181 — Historique synthèses JARVIS · localStorage · 7 jours · purge auto
var _RS_HIST_KEY='soc_rsyslog_synth_hist';
function _rsyslogGetHistory(){
  try{
    var raw=localStorage.getItem(_RS_HIST_KEY);
    if(!raw)return[];
    var cutoff=Date.now()-7*86400000;
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
    var diff=Math.floor((now-d)/86400000);
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
          return '<button class="rs-hist-pill" data-idx="'+i+'" title="'+esc(e.text.slice(0,120))+'..."'
            +' style="font-family:\'Courier New\',monospace;font-size:calc(var(--fs-xs) - 1px);background:rgba(156,39,176,.08);border:1px solid rgba(156,39,176,.28);color:rgba(206,147,216,.65);border-radius:2px;padding:.1rem .32rem;cursor:pointer;white-space:nowrap">'
            +esc(_rsyslogFmtHistLabel(e.ts))+'</button>';
        }).join('')
    +'</div>';
  c.querySelectorAll('.rs-hist-pill').forEach(function(btn){
    btn.addEventListener('click',function(){
      var entry=_rsyslogGetHistory()[parseInt(btn.dataset.idx,10)];
      if(!entry)return;
      var out=document.getElementById('rs-ai-out');
      if(out){out.innerHTML=_rsyslogFmtSynth(entry.text);out.style.whiteSpace='normal';out.style.fontFamily='inherit';out.style.display='block';}
      c.querySelectorAll('.rs-hist-pill').forEach(function(b){b.style.background='rgba(156,39,176,.08)';b.style.borderColor='rgba(156,39,176,.28)';b.style.color='rgba(206,147,216,.65)';});
      btn.style.background='rgba(156,39,176,.18)';btn.style.borderColor='rgba(156,39,176,.75)';btn.style.color='#ce93d8';
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
  var tlHex={'0,230,118':'#00e676','255,179,0':'#ffb300','255,152,0':'#ff9800','255,59,92':'#ff3b5c','0,188,212':'#00bcd4'}[tlRgb]||'#00bcd4';
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
        +'<span style="background:rgba(0,188,212,.1);border:1px solid rgba(0,188,212,.28);border-radius:2px;padding:.02rem .22rem;font-size:calc(var(--fs-xs) - 1px);color:#00bcd4;font-weight:700;flex-shrink:0;font-family:\'Courier New\',monospace">'+esc(numM[1])+'</span>'
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
  var col=st==='ok'?'var(--green)':st==='stale'?'#ffb300':'rgba(180,180,180,.45)';
  var dot=st==='ok'?'●':st==='stale'?'◉':'○';
  var agoStr=_fmtAgo(h.last_ago_s);
  var szStr=_fmtSz(h.size_kb||0);
  var lpm=h.lines_min||0;
  return '<div style="display:grid;grid-template-columns:1rem 3.5rem 1fr auto auto auto;align-items:center;gap:.3rem .5rem;padding:.22rem 0;border-bottom:1px solid rgba(255,255,255,.05)">'
    +'<span style="color:'+col+';font-size:var(--fs-sm)">'+dot+'</span>'
    +'<span style="color:rgba(185,215,240,.85);font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">'+lbl+'</span>'
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
  var svcCol=svcOk?'var(--green)':'#ff3b5c';
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
    +'<div class="ct" style="color:#00bcd4"><span class="ct-icon">⊙</span>LOGS CENTRAUX<span data-panel="RÔLE : point de collecte unique — clt · pa85 · pve · GT-BE98 envoient leurs logs vers srv-ngix via rsyslog port 514 TCP/UDP. Logs couverts : système · Apache · fail2ban · kernel · syslog. MÉTRIQUES SURVEILLÉES : cadence L/min par hôte (0 L/min = source silencieuse = anomalie) · espace disque /var/log · rétention logrotate 7j · horodatage dernière rotation. COMPORTEMENT ATTENDU : tous les hôtes actifs en vert · L/min > 0 · rotation < 24h. JARVIS (si online) : détecte automatiquement toute source tombée à 0 L/min et émet une alerte vocale TTS. Analyse ensuite les IPs récurrentes via LLM phi4-reasoning. Si aucune action humaine dans les 5 min suivant une détection, JARVIS bannit proactivement via CrowdSec et inscrit chaque décision avec justification dans son journal (JARVIS localhost:5000 → onglet ◈ SOC)." data-panel-title="LOGS CENTRAUX — RSYSLOG" class="soc-panel-i" style="--pi-dim:rgba(0,217,255,.65);--pi-bright:rgba(0,217,255,.9);--pi-glow:rgba(0,217,255,.5);margin-left:.45rem">ⓘ</span></div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">'
    +'<span style="font-size:var(--fs-xs);font-family:\'Courier New\',monospace;color:'+svcCol+';font-weight:700">'+svcLbl+'</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(185,215,240,.5)">'+(rs.log_files||0)+' logs · '+diskStr+' utilisé · '+freeStr+'</span>'
    +'</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem;padding-bottom:.3rem;border-bottom:1px solid rgba(0,188,212,.15)">'
    +'<span style="font-size:var(--fs-xs);color:rgba(0,188,212,.5);letter-spacing:.3px">/var/log/central/ · rétention '+(rs.retention_days||'?')+'j · maxsize '+(rs.retention_maxsize_mb||'?')+'Mo</span>'
    +'<span style="font-size:var(--fs-xs);color:rgba(185,215,240,.35)">rotation '+rotStr+'</span>'
    +'</div>'
    +(function(){var xh=d.xhosts||{},cc=xh.corr_count||0,tdst=xh.total_dst||0;
      var col=cc>0?'#ff2060':'rgba(185,215,240,.3)';
      return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem;padding:.18rem .1rem;background:rgba(0,188,212,.04);border-radius:3px">'
        +'<span style="font-size:var(--fs-xs);color:rgba(0,188,212,.6)">⊙ Corrélation kill chain ↔ routeur</span>'
        +'<span style="font-size:var(--fs-xs);color:'+col+';font-weight:700">'+(cc>0?cc+' IP'+( cc>1?'s':'')+' ⚠C2':'0 — RAS')+' · '+tdst+' DST ext</span>'
        +'</div>';
    })()
    +'<div style="display:grid;grid-template-columns:1rem 3.5rem 1fr auto auto auto;gap:.1rem .5rem;padding:.1rem 0 .25rem;margin-bottom:.1rem">'
    +'<span></span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">hôte</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">fichiers</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">taille</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3)">activité</span>'
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(185,215,240,.3);text-align:right">délai</span>'
    +'</div>'
    +Object.keys(hosts).map(function(k){var lbl=k.match(/^GT-BE98/i)?'<ROUTER-HOSTNAME>':k;return _hostRow(k,lbl,hosts);}).join('')
    +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
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
  var th='<div class="card half" id="jv-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◈</span>JARVIS — INTELLIGENCE PROACTIVE'
    +'<span data-panel="RÔLE : assistant IA local SOAR — surveille le SOC en continu, analyse les menaces en temps réel, déclenche des actions défensives autonomes. Tourne entièrement en local via Ollama — aucune donnée envoyée en cloud.\n\nMÉCANISME : auto-engine toutes les 5 min → lecture monitoring.json → LLM analyse le contexte (IPs actives, score menace, services, bans) → si niveau ÉLEVÉ ou CRITIQUE → ban IP automatique via CrowdSec + alerte vocale TTS + entrée dans le journal ◈ SOC. JARVIS peut aussi débannir, redémarrer un service, et escalader si la menace persiste.\n\nMÉTRIQUES SURVEILLÉES : score de menace global · IPs actives Kill Chain · nouveaux bans CrowdSec · services DOWN · état AID · pics de trafic rsyslog · récidivistes.\n\nCOMPORTEMENT ATTENDU : statut ONLINE · ⚡ ENGINE actif · dernière analyse visible dans la tuile · journal ◈ SOC peuplé. Cycle 5 min toléré si Ollama charge un modèle lourd.\n\nPIPELINE : monitoring.json → jarvis.py (Flask · localhost:5000) → Ollama (phi4-reasoning:plus) → décision LLM → CrowdSec ban/unban → SOC dashboard mis à jour au prochain cycle.\n\nVALEUR AJOUTÉE : transforme la détection passive en réponse active autonome. Sans JARVIS, chaque ban est une action manuelle. Avec JARVIS, les IP CRITIQUE sont bannies en moins de 5 min — même la nuit, sans intervention humaine. Modèle local RTX 5080 · 16 Go GDDR7 · inférence < 30s." data-panel-title="JARVIS — INTELLIGENCE PROACTIVE" class="soc-panel-i" style="--pi-dim:rgba(191,95,255,.45);--pi-bright:rgba(191,95,255,.9);--pi-glow:rgba(191,95,255,.5)">ⓘ</span>'
    +'</div>'
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
function _fbxMainTileHtml(wm, fbx){
  var wmSt=wm.status||'UP';
  var isDown=wmSt==='DOWN_ISP'||wmSt==='DOWN_LOCAL';
  var tileStyle=isDown?'border-color:rgba(255,50,50,0.4)':'';
  var stBcls=wmSt==='UP'?'fbx-up':wmSt==='DEGRADED'?'fbx-deg':'fbx-down';
  var stLbl={'UP':'STABLE','DOWN_ISP':'PANNE FAI','DOWN_LOCAL':'PANNE LOCALE','DEGRADED':'DÉGRADÉ'};
  var boxMs=wm.box&&wm.box.ms!=null?wm.box.ms+' ms':'—';
  var wanMs=wm.wan&&wm.wan.ms!=null?wm.wan.ms+' ms':'—';

  // section divider helper
  var _sd=function(lbl,rgb){
    rgb=rgb||'0,217,255';
    return '<div style="display:flex;align-items:center;gap:.4rem;margin:.42rem 0 .28rem">'
      +'<div style="height:1px;flex:1;background:linear-gradient(90deg,rgba('+rgb+',.18),transparent)"></div>'
      +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba('+rgb+',.4);text-transform:uppercase;letter-spacing:.9px;white-space:nowrap">'+lbl+'</span>'
      +'<div style="height:1px;flex:1;background:linear-gradient(90deg,transparent,rgba('+rgb+',.18))"></div>'
      +'</div>';
  };

  // ── STATUT + IP ──
  var statusRow='<div style="display:flex;align-items:center;gap:.45rem;margin:.2rem 0 .3rem">'
    +'<span class="fbx-badge '+stBcls+'">'+esc(stLbl[wmSt]||wmSt)+'</span>'
    +(fbx.ipv4?'<span style="font-size:var(--fs-xs);color:var(--muted);font-family:\'Courier New\',monospace">'+esc(fbx.ipv4)+'</span>':'')
    +(fbx.uptime_s?'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,255,.28)">'+_fbxFmtDur(fbx.uptime_s)+'</span>':'')
    +'<span style="margin-left:auto;font-size:var(--fs-xs);color:rgba(0,217,255,.4)">▶ détails</span>'
    +'</div>';

  // ── CONNECTIVITÉ — 3 sondes ──
  var probeRow=_sd('CONNECTIVITÉ')
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;margin-bottom:.05rem">'
    +_fbxProbeHtml('BOX',wm.box&&wm.box.ok,boxMs)
    +_fbxProbeHtml('WAN',wm.wan&&wm.wan.ok,wanMs)
    +_fbxProbeHtml('HTTP',wm.http_ok,'OK')
    +'</div>';

  // ── DÉBITS avec barres de progression ──
  var dwPct=fbx.bandwidth_down>0?Math.min(100,Math.round(fbx.rate_down/fbx.bandwidth_down*100)):0;
  var upPct=fbx.bandwidth_up>0?Math.min(100,Math.round(fbx.rate_up/fbx.bandwidth_up*100)):0;
  var speedRow=_sd('DÉBITS')
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem">'
    +_spd('↓','DOWNLOAD','0,217,255',fbx.rate_down,fbx.bandwidth_down,dwPct,isDown)
    +_spd('↑','UPLOAD','0,255,136',fbx.rate_up,fbx.bandwidth_up,upPct,isDown)
    +'</div>';

  // ── RÉPÉTEUR WIFI ──
  var reps=fbx.repeaters||[];
  var repSection='';
  if(reps.length){
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
        // nom + badge online + IP
        +'<div style="display:flex;align-items:center;gap:.38rem;margin-bottom:.25rem">'
        +'<span style="font-size:var(--fs-xs);font-weight:700;color:rgb('+rRgb+')">⬡ '+esc(r.name||'Répéteur')+'</span>'
        +'<span style="font-size:calc(var(--fs-xs) - 1px);padding:.03rem .25rem;background:rgba('+(online?'0,217,100':'255,59,92')+',.08);border:1px solid rgba('+(online?'0,217,100':'255,59,92')+',.3);border-radius:2px;color:'+(online?'var(--green)':'var(--red)')+'">'+( online?'● CONNECTÉ':'● HORS LIGNE')+'</span>'
        +(r.ip?'<span style="margin-left:auto;font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.45);font-family:\'Courier New\',monospace">'+esc(r.ip)+'</span>':'')
        +'</div>'
        // backhaul signal bar
        +'<div style="display:flex;align-items:center;gap:.32rem;margin-bottom:.2rem">'
        +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.5);min-width:3rem">'+esc(band)+'</span>'
        +(sig!=null?'<span style="font-size:var(--fs-xs);font-weight:700;color:rgb('+sRgb+');font-family:\'Courier New\',monospace;min-width:3.8rem">'+sig+' dBm</span>':'')
        +'<div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">'
        +'<div style="height:100%;width:'+sigPct+'%;background:linear-gradient(90deg,rgba('+sRgb+',.4),rgb('+sRgb+'));border-radius:2px"></div>'
        +'</div>'
        +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgb('+sRgb+');font-weight:700;min-width:4.2rem;text-align:right">'+esc(sQ)+'</span>'
        +'</div>'
        // throughput + placement + SSIDs
        +'<div style="display:flex;gap:.55rem;font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.45)">'
        +(tput!=='—'?'<span>⟁ '+esc(tput)+'</span>':'')
        +(r.bh_placement!=null?'<span>⊕ '+esc(plac)+'</span>':'')
        +(r.fh_count?'<span style="margin-left:auto">'+r.fh_count+' SSID'+(r.fh_count>1?'s':'')+'</span>':'')
        +'</div>'
        +'</div>';
    }).join('');
    repSection=_sd('RÉPÉTEUR WIFI','191,95,255')+repCards;
  }

  // ── INFRASTRUCTURE: SFP LAN + GPON + CPU ──
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
  var infraRow=infraCards?_sd('INFRASTRUCTURE','122,154,184')+'<div style="display:flex;gap:.3rem">'+infraCards+'</div>':'';

  return '<div class="card half" id="fbx-tile" style="'+tileStyle+'">'
    +'<div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">⬡</span>FREEBOX DELTA — BOX &amp; WAN</div>'
    +statusRow+probeRow+speedRow+repSection+infraRow
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
function _sysCardHtml(sys,d){
  var mem=sys.memory||{},disk=sys.disk||{},load=sys.load||{};
  var cpu=sys.cpu_pct||0,cores=sys.cpu_cores||0;
  var sysSvcs=d.sys_services||{};
  var sysCpuHist=d.sys_cpu_history||[];
  var cpuCol=cpu>85?'var(--red)':cpu>60?'var(--yellow)':'var(--cyan)';
  var lc=load['1m']?(parseFloat(load['1m'])>cores?'var(--red)':parseFloat(load['1m'])>cores*0.7?'var(--yellow)':'var(--cyan)'):'var(--muted)';
  var traffic=d.traffic||{};
  var nginxInfo=d.nginx_info||{};
  var fw=((d.firewall_matrix&&d.firewall_matrix.hosts)||[]).find(function(h){return h.name==='srv-ngix';})||{};
  var f2bBans=(d.fail2ban||{}).total_banned||0;
  var totalReq=traffic.total_requests||0;
  var errRate=((traffic.error_rate||0)).toFixed(1);
  var s2=traffic.status_2xx||0,s3=traffic.status_3xx||0,s4=traffic.status_4xx||0,s5=traffic.status_5xx||0;
  var errCol=parseFloat(errRate)>5?'var(--red)':parseFloat(errRate)>2?'var(--yellow)':'var(--green)';
  var s4Col=s4>500?'var(--yellow)':'rgba(122,154,184,.6)';
  var s5Col=s5>0?'var(--red)':'var(--c-muted-4)';
  var ufwOk=fw.ufw_active===true;
  var conf=fw.conformity;
  var confCol=conf===undefined?'var(--muted)':conf>=90?'var(--green)':conf>=70?'var(--yellow)':'var(--red)';
  var f2bCol=f2bBans>0?'var(--red)':'var(--green)';
  var ngxVer=nginxInfo.version?'nginx/'+nginxInfo.version:null;
  var ngxWorkers=nginxInfo.workers!=null?nginxInfo.workers:cores;
  return '<div class="card half" id="sys-ngix-card" style="cursor:pointer"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
    +'<div class="ct c"><span class="ct-icon">◈</span>SYSTEME — SRV-NGIX</div>'
    // ▶ PROCESSEUR
    +_prxSec('PROCESSEUR','var(--cyan)')
    +'<div class="cpu-wrap">'
    +'<div class="cpu-ring" style="width:52px;height:52px">'+ring(cpu,cpuCol,52)
    +'<div class="ring-text"><span class="ring-pct" style="font-size:var(--fs-xs);color:'+cpuCol+'">'+cpu+'%</span><span class="ring-core">CPU</span></div></div>'
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.1rem">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:.3rem">'
    +'<div class="pve-node-name" style="color:var(--cyan);text-shadow:0 0 10px var(--cyan)">srv-ngix</div>'
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
    // ▶ MÉMOIRE & SYSTÈME
    +_prxSec('MÉMOIRE &amp; SYSTÈME','var(--purple)')
    +(mem.pct!=null?_memBar('RAM',mem.pct,Math.round((mem.used_mb||0)/102.4)/10+' Go',Math.round((mem.total_mb||0)/102.4)/10+' Go'):'')
    +(mem.swap_total_mb>0?_memBar('Swap',mem.swap_pct||0,(mem.swap_used_mb||0)+' Mo',(mem.swap_total_mb||0)+' Mo'):'')
    // ▶ STOCKAGE
    +_sysStorageHtml(sys.volumes||[])
    // ▶ NGINX — MOTEUR
    +_prxSec('NGINX — MOTEUR','var(--cyan)')
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
    +'</div>'
    // ▶ RÉSEAU
    +_sysNetworkHtml(sys.net||{})
    // ▶ SERVICES
    +(Object.keys(sysSvcs).length
      ?_prxSec('SERVICES','var(--green)')+'<div class="svc-badges">'
        +Object.keys(sysSvcs).map(function(k){var up=sysSvcs[k];return '<span class="badge '+(up===true?'up':up===false?'dn':'')+'">'+esc(k)+'</span>';}).join('')
        +'</div>'
      :'')
    // Contre-mesures
    +'<div style="margin-top:.45rem;padding:.28rem .45rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:3px">'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.2rem">// Contre-mesures</div>'
    +'<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
    +'<span style="font-size:var(--fs-xs);color:'+(ufwOk?'var(--green)':'var(--red)')+'">■ UFW '+(ufwOk?'ACTIVE':'INACTIVE')+'</span>'
    +'<span style="color:rgba(255,255,255,0.1)">│</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">Règles : <span style="color:var(--cyan)">'+(fw.ufw_rules||0)+'</span></span>'
    +'<span style="color:rgba(255,255,255,0.1)">│</span>'
    +'<span style="font-size:var(--fs-xs);color:var(--muted)">Fail2ban : <span style="color:'+f2bCol+'">'+f2bBans+' bans</span></span>'
    +(conf!=null?'<span style="color:rgba(255,255,255,0.1)">│</span><span style="font-size:var(--fs-xs);color:var(--muted)">Conformité : <span style="color:'+confCol+'">'+conf+'/100</span></span>':'')
    +'</div></div>'
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
  var card=document.getElementById('sys-ngix-card');
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
  var _rdSsh=window._routerData||null;
  // Rôles par machine
  var ROLES={
    'srv-ngix': 'Reverse Proxy · SOC · WAF',
    'clt':      'Backend Web · CLT',
    'pa85':     'Backend Web · PA85',
    'proxmox':  'Hyperviseur · VMs',
    '<ROUTER-HOSTNAME>':  'Routeur LAN'
  };
  var ORDER=['srv-ngix','clt','pa85'];
  var rows=ORDER.map(function(n){
    var h2=sshSt.find(function(x){return x.name===n;});
    if(!h2)return{name:n,ip:'?',port:parseInt(SOC_INFRA.SSH_PORT),role:ROLES[n]||'',status:'DOWN',uptime:'?'};
    return{name:h2.name,ip:h2.ip||'?',port:h2.port||parseInt(SOC_INFRA.SSH_PORT),role:ROLES[n]||'',status:h2.port_open?'UP':'DOWN',uptime:h2.uptime||'?'};
  });
  if(pveNode){
    rows.push({name:'proxmox',ip:SOC_INFRA.PROXMOX,port:parseInt(SOC_INFRA.SSH_PORT),role:ROLES['proxmox'],status:pveNode.status==='online'?'UP':'DOWN',uptime:pveNode.uptime||'?'});
  }
  var _rtUp=(_rdSsh&&_rdSsh.uptime_s)||0;
  var _rtUpStr=_rtUp>0?(Math.floor(_rtUp/86400)+'j '+String(Math.floor((_rtUp%86400)/3600)).padStart(2,'0')+'h '+String(Math.floor((_rtUp%3600)/60)).padStart(2,'0')+'m'):'—';
  rows.push({name:'<ROUTER-HOSTNAME>',ip:SOC_INFRA.ROUTER,port:null,role:ROLES['<ROUTER-HOSTNAME>'],status:(_rdSsh&&_rdSsh.available)?'UP':'DOWN',uptime:_rtUpStr,note:'SSH'});
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

// ── PROTOCOLES ACTIFS — helpers (arc gauge SVG + live refresh) ───────────────
function _protoComputeState(proto){
  var total=PROTO_DEF.reduce(function(s,p){return s+(proto[p.k]||0);},0)||1;
  var thr=0;
  PROTO_DEF.forEach(function(p){if(p.grp==='threat')thr+=(proto[p.k]||0);});
  var hp=Math.round((total-thr)/total*100);
  var ac=hp>70?'#00d9ff':hp>40?'#f59e0b':'#ff3b5c';
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
    var meta=_FL_PROTO_META[e[0]]||{col:'#64748b',lbl:esc(e[0])};
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
  var attackType=csInfo.scenario?fmtScenario(csInfo.scenario,24):(surInfo.cat?_kcFmtCat(surInfo.cat).slice(0,22):'');
  var cve=surInfo.cve||'';
  var csBadge=ip.cs_decision?'<span style="font-size:var(--fs-xs);background:rgba(255,107,53,0.25);color:var(--orange);padding:.03rem .22rem;border-radius:2px;font-weight:700">⊛CS</span>':'';
  var surBadge=ip.sur_count?'<span style="font-size:var(--fs-xs);background:rgba(255,69,0,0.22);color:#ff6030;padding:.03rem .22rem;border-radius:2px;font-weight:700">◈IDS</span>':'';
  var cveBadge=cve?'<span style="font-size:var(--fs-xs);background:rgba(255,70,40,0.2);color:rgba(255,110,70,0.95);padding:.03rem .22rem;border-radius:2px;font-weight:700;border:1px solid rgba(255,70,40,0.3)">'+esc(cve)+'</span>':'';
  var routerBadge=ip.router_seen?'<span style="font-size:var(--fs-xs);background:rgba(0,188,212,0.18);color:#00bcd4;padding:.03rem .22rem;border-radius:2px;font-weight:700" title="Vu dans logs routeur GT-BE98">⊙RTR</span>':'';
  var c2Badge=(ip.router_out>0)?'<span style="font-size:var(--fs-xs);background:rgba(255,0,80,0.22);color:#ff2060;padding:.03rem .22rem;border-radius:2px;font-weight:700" title="Connexion LAN sortante vers cet attaquant — possible C2">⚠C2</span>':'';
  var vmBadge=(ip.f2b_vms&&ip.f2b_vms.length)?'<span style="font-size:var(--fs-xs);background:rgba(255,160,0,0.2);color:#ffb300;padding:.03rem .22rem;border-radius:2px;font-weight:700" title="Banni par fail2ban sur '+esc((ip.f2b_vms||[]).join('+'))+'">⊛VM</span>':'';
  var typeLine=attackType?'<div style="font-size:var(--fs-xs);color:rgba(170,210,255,0.55);letter-spacing:.2px;margin-top:.07rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">▸ '+esc(attackType)+'</div>':'';
  var conf=1+(ip.cs_decision?1:0)+(ip.sur_count?1:0)+(ip.banned?1:0)+(ip.router_seen?1:0)+((ip.f2b_vms&&ip.f2b_vms.length)?1:0);
  var confCol=conf>=4?'var(--green)':conf>=3?'rgba(255,215,0,.88)':'rgba(255,140,50,.8)';
  var confBar='<div class="ckc-conf">';
  for(var ci=0;ci<6;ci++)confBar+='<div class="ckc-conf-pip" style="background:'+(ci<conf?confCol:'rgba(255,255,255,0.1)')+'"></div>';
  confBar+='</div>';
  var pfx=ip.ip.split('.').slice(0,3).join('.');
  var clusterBadge=(subnets[pfx]||0)>=2?'<span class="ckc-cluster">⚡/24</span>':'';
  return '<div class="ckc-ip ckc-ip-click '+sc+'" style="flex-direction:column;align-items:flex-start" title="'+esc(ip.ip)+' — '+esc(ip.stage)+' \u00d7'+ip.count+(attackType?' — '+esc(attackType):'')+' [cliquer pour investigation]" data-kc-ip="'+esc(ip.ip)+'">'
    +'<div style="display:flex;align-items:center;gap:.2rem;flex-wrap:wrap">'
    +(ip.country&&ip.country!=='-'?'<span style="opacity:.6;font-size:var(--fs-xs)">'+esc(ip.country)+'</span>':'')
    +'<span style="font-size:var(--fs-xs)">'+esc(ip.ip)+'</span>'
    +'<span style="opacity:.55;font-size:var(--fs-xs)">\u00d7'+ip.count+'</span>'
    +(_kcFmtAge(ip.ip)?'<span style="font-size:var(--fs-xs);color:rgba(180,200,255,.38);letter-spacing:.2px">\u23f1'+_kcFmtAge(ip.ip)+'</span>':'')
    +csBadge+surBadge+cveBadge+routerBadge+c2Badge+vmBadge+clusterBadge
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
          var deepEl=e.target.closest('[data-deep-ip]');
          if(deepEl){e.stopPropagation();if(window.openIpDeepModal)openIpDeepModal(deepEl.getAttribute('data-deep-ip'));return;}
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
  return '<div class="card wide" id="geo-tile"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
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
  var h='<div class="card" id="ts-card"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◉</span>NIVEAU DE MENACE GLOBAL</div>'
   +_tsMenaceBlockHtml(ts,sys)
   +_tsRouterBlockHtml(window._routerData||null,window._routerFlows||null)
   +'<div style="padding:.5rem .75rem .35rem;border-top:1px solid rgba(0,170,255,.08);margin-top:.4rem">'
   +'<button id="ts-xdr-btn" style="font:700 11px Courier New,monospace;letter-spacing:.08em;'
   +'border:1px solid rgba(0,217,255,.3);border-radius:3px;background:rgba(0,217,255,.06);'
   +'color:rgba(0,217,255,.75);padding:.2rem .75rem;cursor:pointer;transition:all .15s;white-space:nowrap;width:100%;">'
   +'◈ XDR CORRELATION ENGINE — détail</button>'
   +'<div style="text-align:right;margin-top:.18rem"><span data-panel="RÔLE : moteur de corrélation multi-sources — transforme des événements isolés en menace qualifiée. PIPELINE : COLLECT (fail2ban · ModSec · Suricata · UFW · AppArmor · GeoIP · IOC/CTI feeds) → NORMALISE (parsing logs · enrichissement GeoIP · MITRE ATT&CK mapping) → CORRELATE (regroupement par IP · Kill Chain RECON→SCAN→EXPLOIT→BRUTE · score CRIT/HIGH/WARN/INFO) → RESPOND (CrowdSec ban · fail2ban · JARVIS SOAR). VALEUR AJOUTÉE : un attaquant qui sonde en RECON puis passe en BRUTE génère des événements séparés dans des outils différents — le XDR les relie en une séquence cohérente sur la même IP. COMPORTEMENT ATTENDU : score stable · IPs CRIT bannies · Kill Chain sans stagnation sur EXPLOIT. JARVIS (si online) : notifié dès qu\'une IP atteint CRIT ou HIGH. Soumet la séquence d\'événements à phi4-reasoning pour analyse contextuelle. Si aucune action humaine sous 5 min, bannit via CrowdSec avec justification LLM enregistrée. Alerte vocale TTS immédiate. Journal complet dans JARVIS localhost:5000 → onglet ◈ SOC." data-panel-title="XDR CORRELATION ENGINE" class="soc-panel-i" style="--pi-dim:rgba(0,217,255,.65);--pi-bright:rgba(0,217,255,.9);--pi-glow:rgba(0,217,255,.5)">ⓘ rôle XDR</span></div>'
   +'</div>'
   +'</div></div>';
  g.insertAdjacentHTML('beforeend',h);
  var btn=document.getElementById('ts-xdr-btn');
  if(btn){
    btn.addEventListener('mouseover',function(){this.style.background='rgba(0,217,255,.14)';this.style.borderColor='rgba(0,217,255,.55)';});
    btn.addEventListener('mouseout', function(){this.style.background='rgba(0,217,255,.06)';this.style.borderColor='rgba(0,217,255,.3)';});
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(typeof window._xdrOpenModal!=='function'){
        this.textContent='XDR NON CHARGÉ — F5';
        this.style.background='rgba(255,100,0,.2)';
        return;
      }
      window._xdrOpenModal(window._xdrLastData||window._lastData||{});
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
function _rtAreaCardHtml(t, rtMaxR){
  return '<div class="card half"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">◈</span>ACTIVITÉ TEMPS RÉEL — COURBES 24H</div>'
   +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.3rem">Requêtes & Blocages — historique horaire</div>'
   +'<canvas class="rt-area-canvas" id="rt-area" height="180"></canvas>'
   +'<div style="display:flex;gap:1.2rem;margin-top:.35rem;font-size:var(--fs-xs);color:var(--muted);flex-wrap:wrap">'
   +'<span><span style="display:inline-block;width:18px;height:2px;background:rgba(0,217,255,0.9);vertical-align:middle;margin-right:.3rem;box-shadow:0 0 4px rgba(0,217,255,0.4)"></span>Requêtes légitimes</span>'
   +'<span><span style="display:inline-block;width:18px;height:2px;background:rgba(255,107,53,0.9);vertical-align:middle;margin-right:.3rem"></span>Blocages GeoIP+F2B</span>'
   +'<span style="margin-left:auto">pic '+fmt(rtMaxR)+' req/h</span>'
   +'</div></div></div>';
}
function _heatmapTileCardHtml(t){
  return '<div class="card half"><div class="corner tl"></div><div class="corner tr"></div><div class="card-inner">'
   +'<div class="ct c"><span class="ct-icon">⬡</span>HEATMAP ATTAQUES — 24H</div>'
   +'<canvas class="heatmap-canvas" id="heatmap-canvas" height="180"></canvas>'
   +'<div class="heatmap-legend" style="flex-direction:column;gap:.3rem;margin-top:.45rem">'
   +'<div style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap">'
   +'<span><span class="heatmap-leg-c" style="background:rgba(0,217,255,0.55)"></span>'
   +'<strong style="color:rgba(0,217,255,0.9)">Requêtes</strong>'
   +' <span style="color:var(--muted)">2xx·3xx·4xx</span></span>'
   +'<span><span class="heatmap-leg-c" style="background:rgba(255,59,92,0.7)"></span>'
   +'<strong style="color:rgba(255,59,92,0.9)">Bloqués+Erreurs</strong>'
   +' <span style="color:var(--muted)">GeoIP·F2B·5xx</span></span>'
   +'<span style="margin-left:auto;font-size:var(--fs-xs);color:var(--muted);white-space:nowrap">fenêtre 24h</span>'
   +'</div>'
   +'<div style="display:flex;gap:.6rem;flex-wrap:wrap;padding-top:.25rem;border-top:1px solid rgba(255,255,255,0.05);font-size:var(--fs-xs)">'
   +'<span style="color:rgba(0,217,255,0.7)">◈ <strong>'+fmt(t.total_requests)+'</strong> req</span>'
   +'<span style="color:rgba(255,59,92,0.8)">◈ <strong>'+(t.geo_blocks||0)+'</strong> bloqués</span>'
   +'<span style="color:rgba(255,59,92,0.6)">◈ <strong>'+(t.total_requests?Math.round((t.geo_blocks||0)*100/t.total_requests*10)/10:0)+'%</strong> bloquage</span>'
   +'<span style="color:rgba(255,100,100,0.7)">◈ <strong>'+(t.status_5xx||0)+'</strong> 5xx</span>'
   +'<span style="color:rgba(122,154,184,0.6)">◈ <strong>'+(t.bots||0)+'</strong> bots</span>'
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
  g.insertAdjacentHTML('beforeend',_rtAreaCardHtml(t,Math.max.apply(null,rtRph)||1));
  _raf2(function(){
    var rtA=document.getElementById('rt-area');
    if(rtA)drawReqCurve(rtA,rtRph,rtBph);
  });
}
function _renderHeatmapTile(d,g){
  var t=d.traffic||{};
  if(!(t.requests_per_hour&&Object.keys(t.requests_per_hour).length)) return;
  g.insertAdjacentHTML('beforeend',_heatmapTileCardHtml(t));
  _raf2(function(){
    var hc=document.getElementById('heatmap-canvas');
    if(hc)animateAttackHeatmap(hc,t.requests_per_hour||{},t.blocks_per_hour||{},t.errors_per_hour||{});
  });
}


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
// NDT-38 — jauge arc SVG pour la tuile backup
function _bkpArcGauge(id,pct,used,total,unit,label,color){
  var r=38,cx=54,cy=50,startAngle=225,totalAngle=270;
  var angle=startAngle+(pct/100)*totalAngle;
  function polar(a,radius){var rad=(a-90)*Math.PI/180;return{x:cx+radius*Math.cos(rad),y:cy+radius*Math.sin(rad)};}
  function arcPath(a1,a2,ri,ro){
    var s=polar(a1,ro),e=polar(a2,ro),si=polar(a2,ri),ei=polar(a1,ri),lg=(a2-a1>180)?1:0;
    return['M',s.x,s.y,'A',ro,ro,0,lg,1,e.x,e.y,'L',si.x,si.y,'A',ri,ri,0,lg,0,ei.x,ei.y,'Z'].join(' ');
  }
  var clrFill=pct>85?'var(--red)':pct>60?'var(--yellow)':color;
  var tickParts=[];
  for(var i=0;i<=20;i++){var ta=startAngle+(i/20)*totalAngle,isMaj=(i%5===0),p1=polar(ta,r+1),p2=polar(ta,r+(isMaj?7:4));tickParts.push('<line x1="'+p1.x+'" y1="'+p1.y+'" x2="'+p2.x+'" y2="'+p2.y+'" stroke="rgba(255,255,255,'+(isMaj?'.3':'.1')+')" stroke-width="'+(isMaj?1.2:0.7)+'"/>');} var ticks=tickParts.join('');
  var trackD=arcPath(startAngle,startAngle+totalAngle,r-8,r);
  var fillD=pct>0?arcPath(startAngle,angle,r-8,r):'';
  var pS=polar(startAngle,r+13),pE=polar(startAngle+totalAngle,r+13);
  return '<svg id="'+id+'" viewBox="0 0 108 90" width="108" height="90" style="display:block">'
    +'<defs><filter id="glow-'+id+'"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    +'<path d="'+trackD+'" fill="rgba(255,255,255,.07)"/>'+ticks
    +(fillD?'<path d="'+fillD+'" fill="'+clrFill+'" filter="url(#glow-'+id+')" opacity=".92"/>':'')
    +'<text x="'+pS.x.toFixed(1)+'" y="'+(pS.y+3).toFixed(1)+'" text-anchor="middle" font-size="5.5" fill="rgba(255,255,255,.2)" style="font-family:\'Courier New\'">0</text>'
    +'<text x="'+pE.x.toFixed(1)+'" y="'+(pE.y+3).toFixed(1)+'" text-anchor="middle" font-size="5.5" fill="rgba(255,255,255,.2)" style="font-family:\'Courier New\'">MAX</text>'
    +'<text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="'+clrFill+'" filter="url(#glow-'+id+')" style="font-family:\'Courier New\',monospace">'+Math.round(pct)+'%</text>'
    +'<text x="'+cx+'" y="'+(cy+19)+'" text-anchor="middle" font-size="6.5" fill="rgba(122,154,184,.85)" style="font-family:\'Courier New\',monospace">'+used+'/'+total+' '+unit+'</text>'
    +'<text x="'+cx+'" y="'+(cy+30)+'" text-anchor="middle" font-size="6.5" font-weight="600" fill="rgba(255,255,255,.45)" letter-spacing="1.5" style="font-family:\'Courier New\',monospace">'+label+'</text>'
    +'</svg>';
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
  // Formatage date courte : "2026-04-23 08:39" → "23 avr." ou "auj."
  var _MOIS=['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  var _dateSh=function(s){
    if(!s)return'—';
    var d=new Date(s.replace(' ','T'));if(isNaN(d))return'—';
    var now=new Date();
    if(d.toDateString()===now.toDateString())return'auj.';
    return d.getDate()+'\xa0'+_MOIS[d.getMonth()];
  };
  // Lignes VM pour une zone : ● vm  date  xGo  [n]
  var _vmRows=function(vmsObj){
    return _allVms.map(function(vmn){
      var v=vmsObj[vmn]||{}, age=_winBkpAge(v.last_date), col=_winBkpCol(age);
      var szStr=v.size_gb>0?v.size_gb.toFixed(1)+'\xa0Go':'—';
      var cntStr=v.count>0?'['+v.count+']':'[0]';
      return '<div style="display:flex;align-items:center;gap:.2rem;font-size:var(--fs-xs);padding:.06rem 0">'
        +'<span style="color:'+col+';font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">●</span>'
        +'<span style="color:rgba(185,215,240,.75);flex:0 0 5rem">'+esc(vmn)+'</span>'
        +'<span style="color:'+col+';font-weight:700;flex:0 0 3.8rem">'+_dateSh(v.last_date)+'</span>'
        +'<span style="color:rgba(122,154,184,.7);flex:1">'+szStr+'</span>'
        +'<span style="color:var(--c-muted-4);font-family:\'Courier New\',monospace">'+cntStr+'</span>'
        +'</div>';
    }).join('');
  };
  var _zoneBox=function(label,col,border,bg,rows){
    return '<div style="padding:.25rem .35rem;border:1px solid '+border+';border-radius:3px;background:'+bg+';margin-bottom:.2rem">'
      +'<div style="display:flex;align-items:center;gap:.3rem;font-size:calc(var(--fs-xs) - 2px);color:'+col+';letter-spacing:1.2px;margin-bottom:.2rem;text-transform:uppercase;border-bottom:1px solid '+border+';padding-bottom:.15rem">'
      +'<span>⊙</span><span>'+label+'</span></div>'
      +rows+'</div>';
  };
  var manualBox=_zoneBox('À LA DEMANDE — D:\\','rgba(0,217,255,.6)','rgba(0,217,255,.14)','rgba(0,120,180,.05)',_vmRows(vmsManual));
  var autoBox=_zoneBox('AUTO — D:\\','rgba(0,200,100,.55)','rgba(0,200,100,.12)','rgba(0,40,10,.05)',_vmRows(vmsAuto));
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
  var qCol=usedPct>85?'var(--red)':usedPct>60?'var(--yellow)':'var(--cyan)';
  var quotaRow='<div style="margin-top:.22rem">'
    +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.1rem">'
    +'<span style="color:rgba(122,154,184,.65);letter-spacing:.5px">QUOTA D:\\</span>'
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
  var gpuStroke=gpuU>80?'var(--red)':gpuU>60?'var(--amber)':'var(--purple)';
  var vramStroke=gpuVP>80?'var(--red)':gpuVP>60?'var(--amber)':'var(--cyan)';
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
  var tempTxtCol=tempRaw>85?'var(--red)':tempRaw>70?'var(--amber)':'var(--green)';
  var barsHtml='<div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.2rem">'
   +'<div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.1rem">'
   +'<span style="color:rgba(122,154,184,0.65);letter-spacing:.5px">TEMP</span>'
   +'<span style="color:'+tempTxtCol+'">'+tempRaw+'\xb0C</span></div>'
   +'<div class="pb-track"><div style="height:100%;width:'+tempPct+'%;background:linear-gradient(90deg,rgba(0,200,255,.65),rgba(0,200,100,.75) 35%,rgba(245,158,11,.8) 62%,rgba(255,100,40,.85) 82%,rgba(255,50,50,.9));border-radius:1px"></div></div></div>';
  if(wdGpu.power_pct!=null){
    var pwrTxtCol2=pwrPct>85?'var(--red)':pwrPct>60?'var(--amber)':'rgba(245,158,11,0.85)';
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
          +'<span style="color:var(--text)">'+esc(ct.name)+'</span>'
          +'<span></span>'
          +'<span style="color:var(--muted);white-space:nowrap;text-align:right">'+runTxt+' → '+nextTxt+'</span>'
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
  var col=pct>85?'var(--red)':pct>60?'var(--yellow)':'var(--purple)';
  var grad=pct>85?'linear-gradient(90deg,rgba(160,20,20,.8),var(--red))':pct>60?'linear-gradient(90deg,rgba(160,90,0,.8),var(--yellow))':'linear-gradient(90deg,rgba(80,20,180,.7),var(--purple))';
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
  var sc=lastCpu>85?'#ff4d4d':lastCpu>60?'#f59e0b':'#bf5fff';
  var rgb=lastCpu>85?'255,77,77':lastCpu>60?'245,158,11':'191,95,255';
  var vals=pts.map(function(p){return p.cpu||0;});
  var maxC=Math.max.apply(null,vals)||0.5;
  window._pveCpuSparkData={vals:vals,rgb:rgb,maxC:maxC};
  return '<div class="prx-spark-wrap">'
    +'<div class="prx-spark-hdr">'
    +'<span>HISTORIQUE CPU — 4H</span>'
    +'<span style="color:'+sc+';font-weight:700">'+lastCpu+'%'+(lastTemp!=null?' · '+lastTemp+'°C':'')+'</span>'
    +'</div>'
    +'<canvas id="pve-cpu-spark" height="32" style="display:block;width:100%"></canvas>'
    +'</div>';
}
function _sysCpuSparkline(hist){
  if(!hist||hist.length<=1) return '';
  var pts=hist.slice(-24);
  var lastCpu=pts[pts.length-1].cpu||0;
  var sc=lastCpu>85?'#ff4d4d':lastCpu>60?'#f59e0b':'#00d9ff';
  var rgb=lastCpu>85?'255,77,77':lastCpu>60?'245,158,11':'0,217,255';
  var vals=pts.map(function(p){return p.cpu||0;});
  var maxC=Math.max.apply(null,vals)||0.5;
  window._sysCpuSparkData={vals:vals,rgb:rgb,maxC:maxC};
  return '<div class="prx-spark-wrap">'
    +'<div class="prx-spark-hdr">'
    +'<span>HISTORIQUE CPU — 4H</span>'
    +'<span style="color:'+sc+';font-weight:700">'+lastCpu+'%</span>'
    +'</div>'
    +'<canvas id="sys-cpu-spark" height="32" style="display:block;width:100%"></canvas>'
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
  var nc=cpu>85?'var(--red)':cpu>60?'var(--yellow)':'var(--purple)';
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
        var sc=st.pct>85?'pb-r':st.pct>60?'pb-y':'pb-g';
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
      var sc=st.pct>85?'pb-r':st.pct>60?'pb-y':'pb-g';
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
      var sc=v.pct>85?'pb-r':v.pct>60?'pb-y':'pb-g';
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
  document.getElementById('prx-node-card').addEventListener('click',function(){
    if(window._lastData)openProxmoxModal(window._lastData);
  });
}
// NDT-40a — barre résumé VMs (Running / Stopped / Total) → retourne HTML string
function _renderProxmox(d,g){
  var prx=d.proxmox||{};
  if(prx.configured!==false){
    _renderProxmoxNode(prx,d,g);
  }
}

function render(d){
  window._lastData=d;
  var t=d.traffic||{};
  window._lastTraffic=t;

  _renderHUD(d);

  if(_kcAnimFrame){cancelAnimationFrame(_kcAnimFrame);_kcAnimFrame=null;}
  var g=_dom('grid');g.style.transition='none';g.style.opacity='0';g.innerHTML='';

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
  var _surRules=(d.suricata&&d.suricata.rules_loaded)?Math.round(d.suricata.rules_loaded/1000)+'k':'—';
  g.insertAdjacentHTML('beforeend',secBar('◈','DÉTECTION RÉSEAU','#ff4500','Suricata IDS · '+_surRules+' règles actives'));
  // ── SURICATA IDS ──
  _renderSuricata(d,g);

  // ══ ZONE 2 — ANALYSE DES ATTAQUES ══
  g.insertAdjacentHTML('beforeend',secBar('◈','RENSEIGNEMENT ATTAQUANTS','#ff6b35','Honeypot · CVE'));

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
  // ── HEATMAP ATTAQUES 24H ──
  _renderHeatmapTile(d,g);
  // ── PROTOCOLES ACTIFS ──
  _renderProtoActifs(d,g);

  // ── TOP PAGES ──
  _renderTopPages(d,g);

  // ── TRAFIC 24H ──
  _renderTrafic24h(d,g);

  // ── FLUX LIVE — 5 MIN ──
  _renderFluxLive(d,g);

  // ── FREEBOX DELTA — tuile unifiée WAN + BOX ──
  _renderFreeboxPrepare(d);

  // ══ SECTION INFRASTRUCTURE ══
  g.insertAdjacentHTML('beforeend',secBar('◈','INFRASTRUCTURE & RÉSEAU','#ffd700','Proxmox VE · VMs · LAN'));

  // ── PROXMOX ──
  _renderProxmox(d,g);
  // ── SYSTEME & RÉSEAU — SRV-NGIX ──
  _renderSistemeReseau(d,g);

  // ── SSH INFRASTRUCTURE + SURVEILLANCE (fusionnés) ──
  _renderSSH(d,g);

  // ══ ZONE 5B — SYSTÈME & RESSOURCES ══
  g.insertAdjacentHTML('beforeend',secBar('⬆','SANTÉ SYSTÈME','#ff9f1c','Mises à jour · services · ressources'));
  _renderZone5B(d,g);
  // ── LOGS CENTRAUX — RSYSLOG ──
  _renderRsyslogTile(d,g);
  // ── AIDE — INTÉGRITÉ FICHIERS ──
  if(window._renderAide) window._renderAide(d,g);
  // ── WINDOWS TILES ──
  _renderWindowsTiles(d,g);
  // ── TUILE ROUTEUR GT-BE98 ──
  _renderRouteur(d,g);

  // ══ ZONE 7 — INTELLIGENCE ARTIFICIELLE ══
  g.insertAdjacentHTML('beforeend',secBar('⬡','IA — JARVIS PROACTIVE','#bf5fff','LLM local · analyse SOC · auto-engine'));
  _renderJarvisTiles(d,g);
  if(window._jvAfterRender) window._jvAfterRender();

  // SOC enhancements
  updateAlertStrip(d);
  _snap={geo:t.geo_blocks||0,err:t.error_rate||0,ufw:(d.ufw||{}).blocked_total||0,f2b:(d.fail2ban||{}).total_banned||0};

  // Alerte vocale JARVIS si nouveaux auto-bans
  _checkAutoBanAlerts(d.autoban_log||[]);

  requestAnimationFrame(function(){
    g.style.transition='opacity .18s ease';g.style.opacity='1';
    if(window._socPanelRestoreActive) window._socPanelRestoreActive();
  });
}

