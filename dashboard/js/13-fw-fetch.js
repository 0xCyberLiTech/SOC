'use strict';
function loadRouter(){
  var ts=Date.now();
  var _f=function(url){return fetch(url+'?t='+ts,{signal:AbortSignal.timeout(10000)}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});};
  // Promise.all : router.json + router-history.json + router-flows.json chargés simultanément
  // → computeRouterScore a toujours _routerFlows disponible au moment du render
  Promise.all([_f('/router.json'),_f('/router-history.json'),_f('/router-flows.json')]).then(function(res){
    var rd=res[0], hist=res[1], fl=res[2];
    if(hist) window._routerHistory=hist;
    if(fl)   window._routerFlows=fl;
    if(rd&&rd.available){
      window._routerData=rd;
      var tile=document.getElementById('router-tile');
      if(tile){
        tile.outerHTML=buildRouterTile(rd);
        var nt=document.getElementById('router-tile');
        if(nt){
          nt.onclick=function(){openRouterModal();};
          // Réinjecter card-close-hint détruit par outerHTML (race condition bindCards)
          if(!nt.querySelector('.card-close-hint')){
            var _ch=document.createElement('div');_ch.className='card-close-hint';_ch.textContent='↗';
            nt.insertBefore(_ch,nt.firstChild);
          }
        }
        // History déjà chargé — sparkline disponible immédiatement
        if(window._routerHistory&&window._routerHistory.length){
          var sk=document.getElementById('router-tile-spark');
          if(sk){var sv=window._routerHistory.slice(-30).map(function(e){return e.wan_rx_kbps||0;});drawNetSparkline(sk,sv,'0,217,255',Math.max.apply(null,sv)||1);}
        }
      }
      // Mettre à jour la ligne <ROUTER-HOSTNAME> dans le SSH status card
      var sshCard=document.getElementById('ssh-status-card');
      if(sshCard){
        sshCard.querySelectorAll('tbody tr').forEach(function(row){
          var nc=row.querySelector('td:first-child');
          if(nc&&nc.textContent.trim().indexOf('<ROUTER-HOSTNAME>')===0){
            var sc=row.querySelector('td:nth-child(3)'),uc=row.querySelector('td:last-child');
            if(sc)sc.innerHTML='<span style="background:rgba(0,200,80,.15);color:var(--green);border:1px solid rgba(0,200,80,.3);border-radius:3px;padding:.06rem .3rem;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px">UP</span>';
            if(uc){var _u=rd.uptime_s||0;uc.textContent=_u>0?(Math.floor(_u/86400)+'j '+String(Math.floor((_u%86400)/3600)).padStart(2,'0')+'h '+String(Math.floor((_u%3600)/60)).padStart(2,'0')+'m'):'—';}
          }
        });
      }
    }
  });
}

// ════════════════════════════════════════════════════════
// FIREWALL MATRIX MODAL — SOC
// ════════════════════════════════════════════════════════
var _fwAnimFrame=null;
var _fwFluxFrame=null;

function buildFwDefenseChain(d){
  var t=d.traffic||{},f2b=d.fail2ban||{},ufw=d.ufw||{};
  var total=Math.max(t.total_requests||1,1);
  var geoB=t.geo_blocks||0,geoPct=Math.round(geoB/total*100);
  var f2bBanned=f2b.total_banned||0,f2bFailed=f2b.total_failed||0;
  var ufwB=ufw.blocked_total||0;
  var sumB=Math.max(geoB+f2bBanned+ufwB,1);
  var gW=Math.round(geoB/sumB*100),fW=Math.round(f2bBanned/sumB*100),uW=100-gW-fW;

  var bcc=(t.top_countries||[]).filter(function(c){return c[0]!=='FR';}).slice(0,6);
  var mxC=bcc[0]?bcc[0][1]:1;
  var topCountriesHtml=(t.top_countries&&t.top_countries.length)
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.22rem">Top pays bloqués</div>'
      +bcc.map(function(c){
        var p=Math.round(c[1]/mxC*100);
        return `<div style="display:flex;align-items:center;gap:.3rem;margin-bottom:.15rem"><span style="color:var(--red);font-family:'Courier New',monospace;font-size:var(--fs-xs);min-width:22px">${esc(c[0])}</span><div style="flex:1;background:rgba(255,255,255,0.04);height:2px"><div style="width:${p}%;height:2px;background:rgba(255,59,92,0.7)"></div></div><span style="font-size:var(--fs-xs);color:var(--muted);min-width:26px;text-align:right">${c[1]}</span></div>`;
      }).join(''):'';
  var pxf2b=f2b.proxmox||{};
  var proxmoxJailsHtml=(pxf2b.available&&pxf2b.jails&&pxf2b.jails.length)
    ?'<div style="font-size:var(--fs-xs);color:var(--purple);text-transform:uppercase;letter-spacing:.5px;margin:.32rem 0 .18rem;display:flex;justify-content:space-between"><span>PROXMOX — jails</span><span style="color:var(--muted)">bans actifs · total</span></div>'
      +_fwRenderJails(pxf2b.jails):'';
  var mxP=(ufw.top_ports&&ufw.top_ports[0])?ufw.top_ports[0][1]||1:1;
  var topPortsHtml=(ufw.top_ports&&ufw.top_ports.length)
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:.22rem">Ports ciblés</div>'
      +ufw.top_ports.slice(0,5).map(function(e){
        var p=Math.round(e[1]/mxP*100);
        return `<div style="display:flex;align-items:center;gap:.3rem;margin-bottom:.15rem"><span style="color:var(--cyan);font-family:'Courier New',monospace;font-size:var(--fs-xs);min-width:36px">:${e[0]}</span><div style="flex:1;background:rgba(255,255,255,0.04);height:2px"><div style="width:${p}%;height:2px;background:rgba(0,217,255,0.6)"></div></div><span style="font-size:var(--fs-xs);color:var(--muted);min-width:26px;text-align:right">${e[1]}</span></div>`;
      }).join(''):'';
  var totalP=(ufw.protos&&Object.keys(ufw.protos).length)?Object.values(ufw.protos).reduce(function(a,b){return a+b;},0)||1:1;
  var protosHtml=(ufw.protos&&Object.keys(ufw.protos).length)
    ?'<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.4rem">'
      +Object.entries(ufw.protos).sort(function(a,b){return b[1]-a[1];}).slice(0,4).map(function(e){
        return `<span style="font-size:var(--fs-xs);color:var(--cyan);background:rgba(0,217,255,0.06);padding:.03rem .28rem;border:1px solid rgba(0,217,255,0.12);font-family:'Courier New',monospace">${esc(e[0])} ${Math.round(e[1]/totalP*100)}%</span>`;
      }).join('')+'</div>':'';
  var h=`<div style="border:1px solid rgba(0,217,255,0.1);border-radius:2px;overflow:hidden;margin-bottom:.9rem"><div style="background:rgba(0,0,0,0.45);padding:.32rem .65rem;font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1.5px;color:var(--cyan);border-bottom:1px solid rgba(0,217,255,0.1);display:flex;align-items:center;justify-content:space-between"><span>◈ COUCHES DE PROTECTION ACTIVES — srv-ngix</span><span style="color:var(--muted)">${fmt(geoB+ufwB)} blocages 24h · ${f2bBanned} IPs bannies</span></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr"><div style="padding:.6rem .75rem;border-right:1px solid rgba(0,217,255,0.07)"><div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.45rem"><span style="font-size:var(--fs-xs);padding:.03rem .25rem;background:rgba(255,59,92,0.1);color:var(--red);border:1px solid rgba(255,59,92,0.2);letter-spacing:.3px">①</span><span style="font-size:var(--fs-xs);color:var(--red);font-weight:700;letter-spacing:.8px">GEOIP2</span><span style="font-size:var(--fs-xs);color:var(--muted);margin-left:auto">nginx</span></div><div style="font-size:var(--fs-2xl);font-weight:700;font-family:'Courier New',monospace;color:var(--red);text-shadow:0 0 12px rgba(255,59,92,0.45);line-height:1">${fmt(geoB)}</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:.45rem">req bloquées 24h</div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.18rem"><span style="color:var(--muted)">% trafic filtré</span><span style="color:var(--red)">${geoPct}%</span></div><div style="background:rgba(255,255,255,0.04);height:4px;margin-bottom:.5rem"><div style="width:${Math.min(100,geoPct)}%;height:4px;background:linear-gradient(90deg,rgba(180,0,30,.6),var(--red))"></div></div>${topCountriesHtml}</div><div style="padding:.6rem .75rem;border-right:1px solid rgba(0,217,255,0.07)"><div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.45rem"><span style="font-size:var(--fs-xs);padding:.03rem .25rem;background:rgba(255,107,53,0.1);color:var(--orange);border:1px solid rgba(255,107,53,0.2);letter-spacing:.3px">②</span><span style="font-size:var(--fs-xs);color:var(--orange);font-weight:700;letter-spacing:.8px">FAIL2BAN</span><span style="font-size:var(--fs-xs);color:var(--muted);margin-left:auto">dynamique</span></div><div style="display:flex;align-items:flex-end;gap:.7rem;margin-bottom:.42rem"><div><div style="font-size:var(--fs-2xl);font-weight:700;font-family:'Courier New',monospace;color:var(--orange);text-shadow:0 0 12px rgba(255,107,53,0.45);line-height:1">${f2bBanned}</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.3px">IPs bannies</div></div><div><div style="font-size:var(--fs-md);font-weight:700;font-family:'Courier New',monospace;color:var(--yellow);line-height:1">${f2bFailed}</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.3px">échecs tot.</div></div></div><div style="font-size:var(--fs-xs);color:var(--cyan);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.18rem;display:flex;justify-content:space-between"><span>SRV-NGIX — jails</span><span style="color:var(--muted)">bans actifs · total</span></div>${_fwRenderJails(f2b.jails)}${proxmoxJailsHtml}</div><div style="padding:.6rem .75rem"><div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.45rem"><span style="font-size:var(--fs-xs);padding:.03rem .25rem;background:rgba(0,217,255,0.08);color:var(--cyan);border:1px solid rgba(0,217,255,0.2);letter-spacing:.3px">③</span><span style="font-size:var(--fs-xs);color:var(--cyan);font-weight:700;letter-spacing:.8px">UFW</span><span style="font-size:var(--fs-xs);color:var(--muted);margin-left:auto">statique</span></div><div style="font-size:var(--fs-2xl);font-weight:700;font-family:'Courier New',monospace;color:var(--cyan);text-shadow:0 0 12px rgba(0,217,255,0.45);line-height:1">${fmt(ufwB)}</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:.5rem">paquets bloqués 24h</div>${topPortsHtml}${protosHtml}</div></div><div style="padding:.38rem .65rem;background:rgba(0,0,0,0.3);border-top:1px solid rgba(0,217,255,0.07)"><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--muted);margin-bottom:.2rem"><span>DISTRIBUTION DES BLOCAGES</span><span style="color:var(--text)">GeoIP2 +  UFW = ${fmt(geoB+ufwB)} — F2B = ${f2bBanned} IPs</span></div><div style="display:flex;height:5px;border-radius:2px;overflow:hidden;gap:1px"><div style="width:${gW}%;background:linear-gradient(90deg,rgba(180,0,30,.6),#ff3b5c);transition:width .8s" title="GeoIP2"></div><div style="width:${fW}%;background:linear-gradient(90deg,rgba(180,60,0,.6),#ff6b35);transition:width .8s" title="Fail2ban"></div><div style="width:${uW}%;background:linear-gradient(90deg,rgba(0,100,150,.6),#00d9ff);transition:width .8s" title="UFW"></div></div><div style="display:flex;gap:.9rem;margin-top:.22rem;font-size:var(--fs-xs)"><span style="color:var(--red)">■ GeoIP2 ${gW}%</span><span style="color:var(--orange)">■ Fail2ban ${fW}%</span><span style="color:var(--cyan)">■ UFW ${uW}%</span></div></div></div>`;
  return h;
}

function fwTab(el,name){
  el.closest('.fw-tabs').querySelectorAll('.fw-tab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  ['topo','matrix','rules','flux'].forEach(function(n){
    var p=document.getElementById('fw-tab-'+n);
    if(p)p.classList.toggle('fw-panel-hidden',n!==name);
  });
  if(_fwAnimFrame){cancelAnimationFrame(_fwAnimFrame);_fwAnimFrame=null;}
  if(_fwFluxFrame){cancelAnimationFrame(_fwFluxFrame);_fwFluxFrame=null;}
  if(name==='topo')requestAnimationFrame(function(){requestAnimationFrame(function(){drawFwTopo(window._lastData);});});
  if(name==='flux')requestAnimationFrame(function(){requestAnimationFrame(function(){drawFwFlux(window._lastData);});});
}

function buildFwMatrix(hosts){
  var hm={};(hosts||[]).forEach(function(h){hm[h.name]=h;});
  var ROWS=[
    {p:'80',  s:'HTTP',       ng:'PUB',ct:'LAN',p85:'LAN',pve:'—'},
    {p:'443', s:'HTTPS',      ng:'PUB',ct:'—',  p85:'—',  pve:'—'},
    {p:'2272',s:'SSH-LAN',    ng:'LAN',ct:'LAN',p85:'LAN',pve:'LAN'},
    {p:'8080',s:'MONITORING', ng:'LAN',ct:'—',  p85:'—',  pve:'—'},
    {p:'8006',s:'PROXMOX',    ng:'—',  ct:'—',  p85:'—',  pve:'LAN'},
    {p:'587', s:'SMTP-OUT',   ng:'—',  ct:'—',  p85:'OUT',pve:'—'},
    {p:'25',  s:'SMTP-LOCAL', ng:'LO', ct:'—',  p85:'LAN',pve:'—'},
    {p:'22',  s:'SSH (WAN)',  ng:'—',  ct:'—',  p85:'—',  pve:'—'},
  ];
  var rowsHtml=ROWS.map(function(r){
    return `<tr><td>:${r.p}</td><td style="color:var(--muted);font-size:var(--fs-xs)">${r.s}</td><td>${_fwMatrixCell(r.ng,r.p,'srv-ngix',hm)}</td><td>${_fwMatrixCell(r.ct,r.p,'clt',hm)}</td><td>${_fwMatrixCell(r.p85,r.p,'pa85',hm)}</td><td>${_fwMatrixCell(r.pve,r.p,'proxmox',hm)}</td></tr>`;
  }).join('');
  var known=[80,443,2272,8080,8006,587,25,22];
  var extra={};
  (hosts||[]).forEach(function(hh){
    (hh.listening_ports||[]).forEach(function(p){
      if(known.indexOf(p)<0){if(!extra[p])extra[p]=[];extra[p].push(hh.name);}
    });
  });
  var ek=Object.keys(extra);
  var extraHtml=ek.length
    ?'<div style="margin-top:.5rem;font-size:var(--fs-xs);color:var(--muted)">Ports supplémentaires détectés: '
      +ek.map(function(p){return`<span style="color:var(--yellow);margin-right:.5rem">:${p} [${extra[p].map(function(n){return esc(n);}).join(',')}]</span>`;}).join('')+'</div>':'';
  return `<table class="fw-mt"><tr><th>PORT</th><th>SERVICE</th><th>ngix</th><th>clt</th><th>pa85</th><th>proxmox</th></tr>${rowsHtml}</table>${extraHtml}`;
}

function _fwMatrixCell(val,port,hn,hm){
  var hh=hm[hn];
  var p=parseInt(port,10);
  var live=hh&&hh.listening_ports&&hh.listening_ports.indexOf(p)>=0;
  if(val==='—'&&live)return '<span class="fw-ca">:'+p+' ⚠</span>';
  if(val==='PUB')return '<span class="fw-cp">●PUB</span>';
  if(val==='LAN')return '<span class="fw-cl">◉LAN</span>';
  if(val==='OUT')return '<span class="fw-co">►OUT</span>';
  if(val==='LO') return '<span class="fw-cl" style="opacity:0.55" title="loopback uniquement">◎LO</span>';
  return '<span class="fw-cn">—</span>';
}

var _FW_JAIL_COLOR={'nginx-clt-444':'var(--red)','nginx-clt-400':'var(--red)','nginx-limit-req':'var(--orange)','nginx-http-auth':'var(--yellow)','sshd':'var(--yellow)'};
function _fwRenderJails(jails){
  return (jails||[]).map(function(j){
    var hasBan=j.cur_banned>0;
    var jc=_FW_JAIL_COLOR[j.jail]||'var(--muted)';
    return '<div style="display:flex;align-items:center;gap:.3rem;padding:.12rem 0;border-bottom:1px solid rgba(255,255,255,0.025)">'
      +'<span style="font-size:var(--fs-xs);color:'+(hasBan?jc:'var(--muted)')+';flex:1;font-family:\'Courier New\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(j.jail.replace('nginx-',''))+'</span>'
      +'<span style="font-size:var(--fs-xs);color:'+(hasBan?'var(--orange)':'rgba(122,154,184,0.4)')+';min-width:14px;text-align:center">'+(hasBan?'▲'+j.cur_banned:'·')+'</span>'
      +'<span style="font-size:var(--fs-xs);color:var(--muted);min-width:26px;text-align:right">'+(j.tot_banned||0)+'</span>'
      +'</div>';
  }).join('');
}

var _PORT_SVC={'22':'SSH','80':'HTTP','443':'HTTPS','2272':'SSH custom','8080':'Monitoring',
  '587':'SMTP Exim4','53':'DNS','8006':'Proxmox UI','123':'NTP','3306':'MySQL','5432':'PostgreSQL'};
function _parseUfwLine(line){
  var parts=line.split(/\s{2,}/);
  if(parts.length<2)return{a:line,d:''};
  var to=parts[0].trim(), action=parts[1].trim(), from=parts.length>2?parts[2].trim():'Anywhere';
  var pm=to.match(/^(\d+)/);
  var svc=pm?(_PORT_SVC[pm[1]]||''):'';
  var desc=to+(svc?' — '+svc:'')+(from&&from!=='Anywhere'?' ← '+from:'');
  return{a:action,d:desc};
}
function buildFwRules(hosts){
  var hcol={'srv-ngix':'var(--cyan)','clt':'var(--green)','pa85':'var(--green)','proxmox':'var(--purple)'};
  return (hosts||[]).map(function(hh){
    var n=hh.name||'?';
    var col=hcol[n]||'var(--muted)';
    var rules=hh.ufw_rule_lines&&hh.ufw_rule_lines.length?hh.ufw_rule_lines.map(_parseUfwLine):[];
    var ua=hh.ufw_active;
    var badge=ua===true
      ?'<span class="badge up" style="font-size:var(--fs-xs);padding:.04rem .3rem;margin-left:.4rem">● ACTIVE</span>'
      :ua===false
      ?'<span class="badge dn" style="font-size:var(--fs-xs);padding:.04rem .3rem;margin-left:.4rem">○ INACTIVE</span>'
      :hh.fw_type==='proxmox-fw'
      ?'<span style="font-size:var(--fs-xs);color:var(--purple);margin-left:.4rem">PVE-FW</span>'
      :'<span style="font-size:var(--fs-xs);color:var(--muted);margin-left:.4rem">N/A</span>';
    var sc=hh.conformity!==undefined?hh.conformity:'—';
    var scc=typeof hh.conformity==='number'?hh.conformity>=90?'var(--green)':hh.conformity>=70?'var(--yellow)':'var(--red)':'var(--muted)';
    var emptyMsgHtml=rules.length===0
      ?'<div style="padding:.3rem .6rem;font-size:var(--fs-xs);color:var(--muted);font-style:italic">'+(ua===true?'UFW actif · données en cours de collecte…':hh.fw_type==='proxmox-fw'?'Pare-feu Proxmox intégré (PVE Firewall) — règles gérées via interface Proxmox':'En attente des données serveur…')+'</div>':'';
    var rulesHtml=rules.map(function(r,i){
      var ac=r.a.includes('ALLOW')||r.a==='ACCEPT IN'?'fw-ra':r.a.includes('DROP')||r.a.includes('DENY')?'fw-rd':'fw-rn';
      return `<div class="fw-rr"><span class="fw-ri">${i+1}</span><span class="fw-rac ${ac}">${esc(r.a)}</span><span class="fw-rd2">${esc(r.d)}</span></div>`;
    }).join('');
    var portsHtml=(hh.listening_ports&&hh.listening_ports.length)
      ?'<div class="fw-ports">Ports en écoute: '+hh.listening_ports.map(function(p){return'<span class="fw-port-tag">:'+p+'</span>';}).join('')+'</div>':'';
    var issuesHtml=(hh.issues||[]).map(function(iss){return`<div class="fw-issue2">⚠ ${esc(iss)}</div>`;}).join('');
    return `<div class="fw-rm"><div class="fw-rh" style="border-left-color:${col};color:${col}"><span>${esc(n)}</span><span style="color:var(--muted);font-size:var(--fs-xs)">${esc(hh.ip||'')}</span>${badge}<span style="font-size:var(--fs-xs);color:${scc};margin-left:auto">${sc}/100</span></div>${emptyMsgHtml}${rulesHtml}${portsHtml}${issuesHtml}</div>`;
  }).join('');
}

function _fwBpt(p0,p1,p2,p3,t){var u=1-t;return u*u*u*p0+3*u*u*t*p1+3*u*t*t*p2+t*t*t*p3;}
function _fwShield(ctx,cx,cy,sz,col){
  ctx.save();ctx.strokeStyle=col;ctx.lineWidth=1.2;ctx.globalAlpha=0.8;
  ctx.beginPath();
  ctx.moveTo(cx,cy-sz);
  ctx.lineTo(cx+sz*0.62,cy-sz*0.35);
  ctx.lineTo(cx+sz*0.62,cy+sz*0.18);
  ctx.bezierCurveTo(cx+sz*0.62,cy+sz*0.72,cx,cy+sz,cx,cy+sz);
  ctx.bezierCurveTo(cx-sz*0.62,cy+sz,cx-sz*0.62,cy+sz*0.72,cx-sz*0.62,cy+sz*0.18);
  ctx.lineTo(cx-sz*0.62,cy-sz*0.35);
  ctx.closePath();ctx.stroke();
  ctx.globalAlpha=0.45;ctx.beginPath();ctx.moveTo(cx-sz*0.2,cy+sz*0.05);ctx.lineTo(cx-sz*0.05,cy+sz*0.35);ctx.lineTo(cx+sz*0.25,cy-sz*0.25);ctx.stroke();
  ctx.restore();
}

// NDT-84 : helpers drawFwFlux promus module-level
var _FW_FLUX_ZS=[
  {id:'ext',lbl:'EXTERNAL — WAN',       y:0,    h:0.10, rc:'255,59,92', lc:'#ff3b5c'},
  {id:'dmz',lbl:'DMZ / PROXY',          y:0.10, h:0.13, rc:'0,217,255', lc:'#00d9ff'},
  {id:'int',lbl:'INTERNAL — LAN',       y:0.23, h:0.15, rc:'0,255,136', lc:'#00ff88'},
  {id:'mgt',lbl:'MGMT / HYPERVISEUR',   y:0.38, h:0.10, rc:'191,95,255',lc:'#bf5fff'},
  {id:'pve',lbl:'PVE VMs — vmbr0 · vmbr1',y:0.48,h:0.52,rc:'255,159,64',lc:'#ff9f40'},
];
var _FW_VM_ID_MAP={106:'clt',107:'pa85',108:'srv-ngix'};
function _fwFluxGetH(n,hm){return hm[n]||hm['srv-'+n]||{};}
function _fwUfwRules(n,hm){return((_fwFluxGetH(n,hm).ufw_rule_lines)||[]).length;}
function _fwUfwActive(n,hm){return _fwFluxGetH(n,hm).ufw_active;}
function _fwZCenter(id,H){var z=_FW_FLUX_ZS.find(function(z){return z.id===id;});return z?(z.y+z.h/2)*H:H/2;}
function _fwZBound(id){var z=_FW_FLUX_ZS.find(function(z){return z.id===id;});return z?z.y+z.h:1;}
function _fwSvcUp(n,hm,svcs,pvmStatus,nodes){
  if(n==='internet') return null;
  if(n==='srv-ngix') return true;
  if(n==='clt'){var s=svcs['clt (<DOMAIN-COM>)'];return s?(s.status==='UP'):null;}
  if(n==='pa85'){var s=svcs['pa85 (<DOMAIN-FR>)'];return s?(s.status==='UP'):null;}
  if(n==='proxmox'){return _fwUfwActive('proxmox',hm)!==false?true:null;}
  // VMs Proxmox — statut depuis API PVE via _FW_VM_ID_MAP (106/107/108)
  for(var vid in _FW_VM_ID_MAP){if(_FW_VM_ID_MAP[vid]===n)return pvmStatus[vid]==='running';}
  // VMs par vmid direct (nagios/opnsense/labo*/console)
  for(var ni=0;ni<nodes.length;ni++){if(nodes[ni].id===n&&nodes[ni].vmid!==undefined)return pvmStatus[nodes[ni].vmid]==='running';}
  return null;
}
function _fwSvcColor(n,fallback,hm,svcs,pvmStatus,nodes){var u=_fwSvcUp(n,hm,svcs,pvmStatus,nodes);return u===true?'#00ff88':u===false?'#ff3b5c':(fallback||'rgba(180,200,255,0.5)');}

function drawFwFlux(d){
  var canvas=document.getElementById('fw-flux-c');
  if(!canvas)return;
  var W=canvas.parentElement?canvas.parentElement.offsetWidth-4:canvas.offsetWidth;
  if(!W||W<300)return;
  var H=1300;canvas.width=W;canvas.height=H;
  if(_fwFluxFrame){cancelAnimationFrame(_fwFluxFrame);_fwFluxFrame=null;}

  var hm={};
  ((d.firewall_matrix||{}).hosts||[]).forEach(function(h){var hn=h.name||'';hm[hn]=h;if(hn.match(/^srv-/))hm[hn.replace(/^srv-/,'')]=h;});
  var _svcs=d.services||{};
  var _pvms=(d.proxmox&&d.proxmox.nodes&&d.proxmox.nodes[0]&&d.proxmox.nodes[0].vms)||[];
  var _pvmStatus={};_pvms.forEach(function(v){_pvmStatus[v.id]=v.status;});

  var NW=118,NH=76,NWvm=104,NHvm=58;
  var NODES=[
    {id:'internet',lbl:'INTERNET', sub:'WAN / Public',     c:'#ff3b5c',zc:'255,59,92', role:'WAN',       xf:0.50,yf:0.04,zone:'ext', ports:[{t:'→ :443',c:'#ff3b5c'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':80',c:'#f97316'}]},
    {id:'srv-ngix',lbl:'srv-ngix', sub:SOC_INFRA.SRV_NGIX,     c:'#00d9ff',zc:'0,217,255', role:'PROXY+FW',  xf:0.50,zone:'dmz',          ports:[{t:':80→clt',c:'#00ff88'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':80→pa85',c:'#00d9ff'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':8006',c:'#bf5fff'}]},
    {id:'clt',     lbl:'clt',      sub:SOC_INFRA.CLT,     c:'#00ff88',zc:'0,255,136', role:'WEB',       xf:0.28,zone:'int',          ports:[{t:':80 ← ngix',c:'#00ff88'}]},
    {id:'pa85',    lbl:'pa85',     sub:SOC_INFRA.PA85,     c:'#00d9ff',zc:'0,217,255', role:'WEB+SMTP',  xf:0.72,zone:'int',          ports:[{t:':80 ← ngix',c:'#00d9ff'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':587→smtp',c:'#f97316'}]},
    {id:'proxmox', lbl:'proxmox',  sub:SOC_INFRA.PROXMOX,     c:'#bf5fff',zc:'191,95,255',role:'HYPERVISOR',xf:0.50,zone:'mgt',          ports:[{t:':8006',c:'#bf5fff'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':2272',c:'#ffd700'}]},
    // VMs Proxmox — nagios vmbr0 gauche · opnsense centre · labo VMs symétrie ±0.15 autour de 0.50
    // Row 1 PVE (yf=0.60) : nagios(vmbr0 gauche) · opnsense(centre gateway)
    {id:'nagios',  lbl:'nagios',   sub:'VM 104 · vmbr0',      c:'#00d9ff',zc:'0,217,255', role:'MON/LAN', xf:0.35,yf:0.66,zone:'pve',vm:true,vmid:104},
    {id:'opnsense',lbl:'opnsense', sub:'VM 100 · vmbr0+1+2+3',c:'#ff9f40',zc:'255,159,64',role:'FW/GW',  xf:0.50,yf:0.66,zone:'pve',vm:true,vmid:100},
    // Row 2 PVE (yf=0.79) : labo-01 (gauche) · labo-02 (droite) — symétriques autour de 0.50
    {id:'labo-01', lbl:'labo-01',  sub:'VM 101 · vmbr1',      c:'#ffd700',zc:'255,215,0', role:'LAB',     xf:0.35,yf:0.79,zone:'pve',vm:true,vmid:101},
    {id:'labo-02', lbl:'labo-02',  sub:'VM 102 · vmbr1',      c:'#ffd700',zc:'255,215,0', role:'LAB',     xf:0.65,yf:0.79,zone:'pve',vm:true,vmid:102},
    // Row 3 PVE (yf=0.92) : labo-03 (gauche) · console (droite) — symétriques autour de 0.50
    {id:'labo-03', lbl:'labo-03',  sub:'VM 103 · vmbr1',      c:'#ffd700',zc:'255,215,0', role:'LAB',     xf:0.35,yf:0.92,zone:'pve',vm:true,vmid:103},
    {id:'console', lbl:'console',  sub:'VM 105 · vmbr1',      c:'#ffd700',zc:'255,215,0', role:'CONSOLE', xf:0.65,yf:0.92,zone:'pve',vm:true,vmid:105},
  ];
  var nm={};
  NODES.forEach(function(n){
    var nw=n.vm?NWvm:NW,nh=n.vm?NHvm:NH;
    n.px=Math.round(W*n.xf);
    n.py=n.yf?Math.round(H*n.yf):Math.round(_fwZCenter(n.zone,H));
    n.nw=nw;n.nh=nh;
    nm[n.id]=n;
  });

  // Murs firewall aux frontières de zones
  var WALLS=[
    {y:_fwZBound('ext'),wide:true,host:'srv-ngix',c:'#00d9ff',
     lbl:'UFW srv-ngix',
     inTxt:'IN: :443/:80 (PUB) · :2272/:8080 (LAN)',
     outTxt:'OUT: clt:80 · pa85:80 · :8006 · :2272 SSH · DNS'},
    {y:_fwZBound('dmz'),split:true,
     left: {x:W*0.28,host:'clt', c:'#00ff88',lbl:'UFW clt', inTxt:'IN: :80 ← ngix',outTxt:'OUT: :443 :80 DNS'},
     right:{x:W*0.72,host:'pa85',c:'#00ff88',lbl:'UFW pa85',inTxt:'IN: :80 ← ngix',outTxt:'OUT: :443 :80 :587 DNS'}},
    {y:_fwZBound('int'),partial:true,c:'#bf5fff',
     lbl:'PVE Firewall',
     inTxt:':8006 ← '+SOC_INFRA.LAN_CIDR+' (LAN only)',
     outTxt:'DROP external access'},
  ];

  // Connexions — HTTPS, HTTP, SSH visibles, symétrie clt/pa85
  var CONNS=[
    // Internet → srv-ngix : :443 HTTPS + :80 HTTP (symétrie ±13)
    {f:'internet',t:'srv-ngix',port:':443',  type:'HTTPS',   c:'#ff3b5c',w:2.0,           xOff:-13},
    {f:'internet',t:'srv-ngix',port:':80',   type:'HTTP',    c:'#f97316',w:1.3,           xOff:13},
    // srv-ngix → clt : HTTP + SSH (deux parallèles, côté gauche)
    {f:'srv-ngix',t:'clt',     port:':80',   type:'HTTP',    c:'#00ff88',w:1.5,           xOff:-14},
    {f:'srv-ngix',t:'clt',     port:':2272', type:'SSH',     c:'#ffd700',w:1.1,dash:true, xOff:2},
    // srv-ngix → pa85 : HTTP + SSH (miroir — symétrie)
    {f:'srv-ngix',t:'pa85',    port:':80',   type:'HTTP',    c:'#00d9ff',w:1.5,           xOff:14},
    {f:'srv-ngix',t:'pa85',    port:':2272', type:'SSH',     c:'#ffd700',w:1.1,dash:true, xOff:-2},
    // srv-ngix → proxmox : :8006 MGMT + SSH (symétrie ±11)
    {f:'srv-ngix',t:'proxmox', port:':8006', type:'MGMT',    c:'#bf5fff',w:1.2,dash:true, xOff:-11},
    {f:'srv-ngix',t:'proxmox', port:':2272', type:'SSH',     c:'#ffd700',w:1.0,dash:true, xOff:11},
    // pa85 → internet : SMTP sortant (rev, côté droit)
    {f:'pa85',    t:'internet',port:':587',  type:'SMTP OUT',c:'#f97316',w:1.5,dash:true, rev:true,xOff:42,label_t:0.22},
    // proxmox → nagios (vmbr0 direct) + opnsense (gateway vmbr0↔vmbr1)
    {f:'proxmox',t:'nagios',  port:'VM104',type:'PVE',c:'#00d9ff',w:1.0,dash:true,noLbl:true},
    {f:'proxmox',t:'opnsense',port:'VM100',type:'PVE',c:'#ff9f40',w:1.2,dash:true,noLbl:true},
    // opnsense → labo VMs (vmbr1 — réseau lab isolé, opnsense est le gateway)
    {f:'opnsense',t:'labo-01',port:'vmbr1',type:'LAN',c:'#ffd700',w:1.0,dash:true,noLbl:true,xOff:-8},
    {f:'opnsense',t:'labo-02',port:'vmbr1',type:'LAN',c:'#ffd700',w:1.0,dash:true,noLbl:true,xOff:8},
    {f:'opnsense',t:'labo-03',port:'vmbr1',type:'LAN',c:'#ffd700',w:1.0,dash:true,noLbl:true,xOff:-8},
    {f:'opnsense',t:'console',port:'vmbr1',type:'LAN',c:'#ffd700',w:1.0,dash:true,noLbl:true,xOff:8},
  ];
  var SPDS=[0.0040,0.0032,0.0036,0.0026,0.0036,0.0026,0.0030,0.0022,0.0038,
            0.0028,0.0030,
            0.0022,0.0022,0.0022,0.0022];
  if(!canvas._fp||canvas._fp.length!==CONNS.length)
    canvas._fp=CONNS.map(function(){return Math.random();});


  // ── NDT-14 : drawFwFlux drawing passes ───────────────────────────────────────
  function _fFluxBg(ctx){
    var bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#030812');bg.addColorStop(1,'#060d1a');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(0,217,255,0.022)';ctx.lineWidth=0.4;
    for(var gx=0;gx<W;gx+=50){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
    for(var gy=0;gy<H;gy+=50){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
    _FW_FLUX_ZS.forEach(function(z){
      var zy=z.y*H,zh=z.h*H;
      ctx.fillStyle='rgba('+z.rc+',0.038)';ctx.fillRect(0,zy,W,zh);
      ctx.fillStyle='rgba('+z.rc+',0.45)';ctx.fillRect(0,zy,3,zh);
      ctx.fillStyle='rgba('+z.rc+',0.5)';ctx.font='bold 8px "Courier New"';ctx.textAlign='left';
      ctx.fillText('[ '+z.lbl+' ]',10,zy+14);
    });
    var pveZ=_FW_FLUX_ZS.find(function(z){return z.id==='pve';});
    if(pveZ){
      var pvey=pveZ.y*H,pveh=pveZ.h*H,pvex=W*0.60;
      ctx.strokeStyle='rgba(255,159,64,0.14)';ctx.lineWidth=1;ctx.setLineDash([4,8]);
      ctx.beginPath();ctx.moveTo(pvex,pvey+32);ctx.lineTo(pvex,pvey+pveh-8);ctx.stroke();ctx.setLineDash([]);
    }
  }
  function _fFluxConns(ctx){
    CONNS.forEach(function(cn,ci){
      var fa=nm[cn.f],ta=nm[cn.t];if(!fa||!ta)return;
      var xo=cn.xOff||0;
      var sx=fa.px+xo, ex=ta.px+xo;
      var sy=fa.py+(cn.rev?-(fa.nh/2):(fa.nh/2));
      var ey=ta.py+(cn.rev?(ta.nh/2):-(ta.nh/2));
      var cp1x=sx,cp1y=sy+(ey-sy)*0.42;
      var cp2x=ex,cp2y=ey-(ey-sy)*0.42;
      var _su=_fwSvcUp(cn.f,hm,_svcs,_pvmStatus,NODES),_tu=_fwSvcUp(cn.t,hm,_svcs,_pvmStatus,NODES);
      var _connDown=(_su===false||_tu===false);
      ctx.strokeStyle=_connDown?'rgba(255,59,92,0.5)':cn.c;ctx.lineWidth=cn.w||1.5;ctx.globalAlpha=_connDown?0.18:cn.dim?0.22:0.65;
      if(cn.dash)ctx.setLineDash([5,4]);else ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,ex,ey);
      ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
      var dir=cn.rev?1:-1;
      ctx.fillStyle=cn.c;ctx.globalAlpha=0.9;ctx.beginPath();
      ctx.moveTo(ex,ey);ctx.lineTo(ex-5,ey+dir*9);ctx.lineTo(ex+5,ey+dir*9);
      ctx.closePath();ctx.fill();ctx.globalAlpha=1;
      if(!_connDown){
        canvas._fp[ci]=(canvas._fp[ci]+(SPDS[ci]||0.004))%1;
        var pt=canvas._fp[ci];
        var bx=_fwBpt(sx,cp1x,cp2x,ex,pt),by=_fwBpt(sy,cp1y,cp2y,ey,pt);
        ctx.beginPath();ctx.arc(bx,by,2.5,0,Math.PI*2);
        ctx.fillStyle='#fff';ctx.shadowColor=cn.c;ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
      }
    });
  }
  function _fFluxWalls(ctx){
    WALLS.forEach(function(wall){
      var wy=wall.y*H;
      if(wall.wide){
        var nr=_fwUfwRules(wall.host,hm),na=_fwUfwActive(wall.host,hm),ww=Math.min(W*0.58,560),wh=48,wx2=W/2;
        var _wc=_fwSvcColor(wall.host,wall.c,hm,_svcs,_pvmStatus,NODES);
        ctx.fillStyle='rgba(6,12,24,0.95)';ctx.fillRect(wx2-ww/2,wy-wh/2,ww,wh);
        ctx.strokeStyle=_wc;ctx.lineWidth=1.2;ctx.setLineDash([3,4]);
        ctx.strokeRect(wx2-ww/2,wy-wh/2,ww,wh);ctx.setLineDash([]);
        _fwShield(ctx,wx2-ww/2+18,wy,10,wall.c);
        ctx.globalAlpha=1;ctx.textBaseline='alphabetic';ctx.textAlign='center';
        ctx.fillStyle=wall.c;ctx.font='bold 10px "Courier New"';
        ctx.fillText(wall.lbl+(nr?' — '+nr+' règles':''),wx2,wy-12);
        ctx.fillStyle='rgba(200,230,255,0.90)';ctx.font='8px "Courier New"';
        ctx.fillText(wall.inTxt,wx2,wy+2);
        ctx.fillStyle='rgba(160,200,240,0.72)';ctx.font='7.5px "Courier New"';
        ctx.fillText(wall.outTxt,wx2,wy+15);
        var dc=na===true?'#00ff88':na===false?'#ff3b5c':'rgba(180,200,255,0.5)';
        ctx.beginPath();ctx.arc(wx2+ww/2-10,wy-wh/2+9,3.5,0,Math.PI*2);
        ctx.fillStyle=dc;ctx.shadowColor=dc;ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
      } else if(wall.split){
        [wall.left,wall.right].forEach(function(w){
          var nr=_fwUfwRules(w.host,hm),na=_fwUfwActive(w.host,hm),ww=Math.min(W*0.23,240),wh=44;
          var _wc=_fwSvcColor(w.host,w.c,hm,_svcs,_pvmStatus,NODES);
          ctx.fillStyle='rgba(6,12,24,0.95)';ctx.fillRect(w.x-ww/2,wy-wh/2,ww,wh);
          ctx.strokeStyle=_wc;ctx.lineWidth=1.2;ctx.setLineDash([2,3]);
          ctx.strokeRect(w.x-ww/2,wy-wh/2,ww,wh);ctx.setLineDash([]);
          _fwShield(ctx,w.x-ww/2+10,wy,7,w.c);
          ctx.save();ctx.beginPath();ctx.rect(w.x-ww/2+2,wy-wh/2+2,ww-4,wh-4);ctx.clip();
          ctx.fillStyle=w.c;ctx.font='bold 9px "Courier New"';ctx.textAlign='center';
          ctx.fillText(w.lbl+(nr?' — '+nr+'R':''),w.x,wy-12);
          ctx.fillStyle='rgba(200,230,255,0.90)';ctx.font='7.5px "Courier New"';
          ctx.fillText(w.inTxt,w.x,wy+1);
          ctx.fillStyle='rgba(160,200,240,0.65)';ctx.font='7px "Courier New"';
          ctx.fillText(w.outTxt,w.x,wy+14);
          ctx.restore();
          var dc=na===true?'#00ff88':na===false?'#ff3b5c':'rgba(180,200,255,0.5)';
          ctx.beginPath();ctx.arc(w.x+ww/2-9,wy-wh/2+8,3.5,0,Math.PI*2);
          ctx.fillStyle=dc;ctx.shadowColor=dc;ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;
        });
      } else if(wall.partial){
        var ww=Math.min(W*0.30,300),wh=44,wx2=W/2;
        ctx.fillStyle='rgba(6,12,24,0.95)';ctx.fillRect(wx2-ww/2,wy-wh/2,ww,wh);
        ctx.strokeStyle=wall.c;ctx.lineWidth=1.2;ctx.setLineDash([3,4]);
        ctx.strokeRect(wx2-ww/2,wy-wh/2,ww,wh);ctx.setLineDash([]);
        _fwShield(ctx,wx2-ww/2+12,wy,8,wall.c);
        ctx.save();ctx.beginPath();ctx.rect(wx2-ww/2+2,wy-wh/2+2,ww-4,wh-4);ctx.clip();
        ctx.fillStyle=wall.c;ctx.font='bold 9px "Courier New"';ctx.textAlign='center';
        ctx.fillText(wall.lbl,wx2,wy-12);
        ctx.fillStyle='rgba(200,230,255,0.90)';ctx.font='7.5px "Courier New"';
        ctx.fillText(wall.inTxt,wx2,wy+1);
        ctx.fillStyle='rgba(160,200,240,0.65)';ctx.font='7px "Courier New"';
        ctx.fillText(wall.outTxt,wx2,wy+14);
        ctx.restore();
      }
    });
  }
  function _fFluxNodes(ctx){
    NODES.forEach(function(n){
      var hh=_fwFluxGetH(n.id,hm);
      var nw=n.nw,nh=n.nh;
      var nx=n.px-nw/2,ny=n.py-nh/2;
      var _nc=_fwSvcColor(n.id,n.c,hm,_svcs,_pvmStatus,NODES);
      var gr=ctx.createRadialGradient(n.px,n.py,0,n.px,n.py,nw*0.85);
      gr.addColorStop(0,'rgba('+n.zc+',0.09)');gr.addColorStop(1,'transparent');
      ctx.fillStyle=gr;ctx.fillRect(nx-12,ny-12,nw+24,nh+24);
      ctx.fillStyle='rgba(5,11,22,0.97)';ctx.fillRect(nx,ny,nw,nh);
      var sg=ctx.createLinearGradient(nx,0,nx+nw,0);
      sg.addColorStop(0,'transparent');sg.addColorStop(0.25,n.c);sg.addColorStop(0.75,n.c);sg.addColorStop(1,'transparent');
      ctx.fillStyle=sg;ctx.globalAlpha=0.6;ctx.fillRect(nx,ny,nw,4);ctx.globalAlpha=1;
      ctx.strokeStyle=_nc;ctx.lineWidth=1.5;ctx.globalAlpha=0.85;ctx.strokeRect(nx,ny,nw,nh);ctx.globalAlpha=1;
      [[nx,ny,1,1],[nx+nw,ny,-1,1],[nx,ny+nh,1,-1],[nx+nw,ny+nh,-1,-1]].forEach(function(c){
        ctx.strokeStyle=_nc;ctx.lineWidth=1.5;ctx.beginPath();
        ctx.moveTo(c[0],c[1]+c[3]*6);ctx.lineTo(c[0],c[1]);ctx.lineTo(c[0]+c[2]*6,c[1]);ctx.stroke();
      });
      if(n.id!=='internet') _fwShield(ctx,nx+12,ny+nh/2-4,7,n.c);
      var lblFont=n.vm?'bold 11px "Courier New"':'bold 12px "Courier New"';
      ctx.fillStyle=n.c;ctx.font=lblFont;ctx.textAlign='center';
      ctx.shadowColor=n.c;ctx.shadowBlur=6;ctx.fillText(n.lbl,n.px,ny+22);ctx.shadowBlur=0;
      ctx.fillStyle='rgba(160,195,225,0.7)';ctx.font='7.5px "Courier New"';ctx.fillText(n.sub,n.px,ny+33);
      var ua=hh.ufw_active;var nr2=_fwUfwRules(n.id,hm);
      var ut,uc;
      if(n.id==='internet'){ut='⚡ PUBLIC NETWORK';uc='rgba(255,59,92,0.85)';}
      else if(n.id==='proxmox'){ut='PVE-FW :8006 LAN';uc='rgba(191,95,255,0.85)';}
      else if(n.vm){var vs=_pvmStatus[n.vmid];ut=vs==='running'?'● RUNNING':'○ STOPPED';uc=vs==='running'?'#00ff88':'#ff3b5c';}
      else{ut=ua===true?'UFW \u25cf '+(nr2||'?')+' r\u00e8gles':ua===false?'UFW \u25cb OFF':'UFW ?';
           uc=ua===true?'#00ff88':ua===false?'#ff3b5c':'rgba(180,200,255,0.6)';}
      ctx.fillStyle=uc;ctx.font='7px "Courier New"';ctx.fillText(ut,n.px,ny+44);
      if(n.ports&&!n.vm){
        ctx.font='6.5px "Courier New"';
        var _ptw=n.ports.reduce(function(s,p){return s+ctx.measureText(p.t).width;},0);
        var _pcx=n.px-_ptw/2;
        n.ports.forEach(function(p){ctx.fillStyle=p.c;ctx.textAlign='left';ctx.fillText(p.t,_pcx,ny+55);_pcx+=ctx.measureText(p.t).width;});
        ctx.textAlign='center';
      }
      if(!n.vm){
        var conf=hh.conformity;
        if(conf!==undefined){
          var bw=nw-10;var bc=conf>=90?'#00ff88':conf>=70?'#ffd700':'#ff3b5c';
          ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(nx+5,ny+nh-7,bw,4);
          ctx.fillStyle=bc;ctx.globalAlpha=0.8;ctx.fillRect(nx+5,ny+nh-7,bw*conf/100,4);ctx.globalAlpha=1;
        }
      } else {
        var vs2=_pvmStatus[n.vmid];
        var bwv=nw-10;var bcv=vs2==='running'?'#00ff88':'rgba(255,59,92,0.4)';
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(nx+5,ny+nh-7,bwv,4);
        ctx.fillStyle=bcv;ctx.globalAlpha=0.8;ctx.fillRect(nx+5,ny+nh-7,vs2==='running'?bwv:bwv*0.15,4);ctx.globalAlpha=1;
      }
      var dc=_fwSvcColor(n.id,_nc,hm,_svcs,_pvmStatus,NODES);
      ctx.beginPath();ctx.arc(nx+nw-7,ny+8,3,0,Math.PI*2);
      ctx.fillStyle=dc;ctx.shadowColor=dc;ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;
    });
  }
  function _fFluxLegend(ctx){
    for(var sl=0;sl<H;sl+=3){ctx.fillStyle='rgba(0,0,0,0.025)';ctx.fillRect(0,sl,W,1);}
    ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,H-22,W,22);
    ctx.textAlign='left';ctx.font='7px "Courier New"';
    [{c:'#ff3b5c',t:':443 HTTPS'},{c:'#f97316',t:':80 HTTP'},{c:'#00ff88',t:'LAN\u2192clt'},{c:'#00d9ff',t:'LAN\u2192pa85'},{c:'#ffd700',t:':2272 SSH'},{c:'#bf5fff',t:':8006 MGMT'},{c:'#f97316',t:':587 SMTP'}]
    .forEach(function(l,i){ctx.fillStyle=l.c;ctx.fillText('\u25a0 '+l.t,8+i*Math.floor((W-16)/7),H-7);});
  }

  function drawFrame(){
    var ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    _fFluxBg(ctx);
    _fFluxConns(ctx);
    _fFluxWalls(ctx);
    _fFluxNodes(ctx);
    _fFluxLegend(ctx);
    _fwFluxFrame=requestAnimationFrame(drawFrame);
  }
  _fwFluxFrame=requestAnimationFrame(drawFrame);
}

function _fwNormId(name){return name.replace(/^srv-/,'');}
function _fwGetFwh(vmName,hm){return hm[vmName]||hm[_fwNormId(vmName)]||null;}
function _fwDrawHatch(ctx,nx,ny,nw,nh,col){
  ctx.save();
  ctx.beginPath();ctx.rect(nx,ny,nw,nh);ctx.clip();
  ctx.strokeStyle=col;ctx.lineWidth=0.7;ctx.globalAlpha=0.15;
  for(var i=-(nw+nh);i<nw+nh;i+=9){
    ctx.beginPath();ctx.moveTo(nx+i,ny);ctx.lineTo(nx+i+nh,ny+nh);ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.restore();
}

function _fwTopoNm(id,N){return N.filter(function(n){return n.id===id;})[0];}

function drawFwTopo(d){
  var canvas=document.getElementById('fw-topo-c');
  if(!canvas)return;
  var W=canvas.offsetWidth;
  if(!W)return;

  // ── Sources de données ──────────────────────────────────────────
  var fw=d.firewall_matrix||{};
  var fwHosts=fw.hosts||[];
  var hm={};fwHosts.forEach(function(h){hm[h.name]=h;});
  var pveVmsRaw=((d.proxmox&&d.proxmox.nodes&&d.proxmox.nodes[0])?d.proxmox.nodes[0].vms:null)||[];

  // Normalisation : strip "srv-" pour matcher firewall_matrix (srv-clt→clt)
  // Exclure les VMs dont le nom correspond à un nœud fixe
  var FIXED_IDS={'internet':1,'srv-ngix':1,'proxmox':1};
  var pveVms=pveVmsRaw.filter(function(v){
    return !FIXED_IDS[v.name]&&!FIXED_IDS[_fwNormId(v.name)];
  });
  if(!pveVms.length){
    pveVms=[
      {id:106,name:'srv-clt', status:'running',type:'vm',cpu:null,mem_pct:null},
      {id:107,name:'srv-pa85',status:'running',type:'vm',cpu:null,mem_pct:null},
    ];
  }

  // IPs attaquantes actives (kill_chain, 15 min) — max 5
  var kcIps=((d.kill_chain&&d.kill_chain.active_ips)||[]).slice(0,5);

  // Classer VMs : web backends vs extras
  var webVms=pveVms.filter(function(v){var f=_fwGetFwh(v.name,hm);return !!(f&&f.role);});
  var extraVms=pveVms.filter(function(v){var f=_fwGetFwh(v.name,hm);return !(f&&f.role);});

  // ── Hauteur canvas dynamique ────────────────────────────────────
  var wc=webVms.length, ec=extraVms.length, ac=kcIps.length;
  var rowH=70;
  var H=Math.max(320, Math.max(wc,2)*rowH+80, ec*92+90, ac*rowH+60);
  canvas.width=W;canvas.height=H;

  // ── Construction des nœuds ─────────────────────────────────────
  // IPs attaquantes (colonne gauche)
  var N=[];
  kcIps.forEach(function(ip,i){
    var y=ac===1?0.5:(0.12+i*(0.76/(ac-1)));
    N.push({id:'atk_'+i,lbl:ip.ip,sub:(ip.country||'??')+' · '+(ip.stage||'?'),
      x:0.07,y:y,c:'#ff3b5c',w:112,h:40,atk:ip});
  });

  // ── Stats API pour nœuds fixes ─────────────────────────────────
  var sys=d.system||{};
  var pveNode=(d.proxmox&&d.proxmox.nodes&&d.proxmox.nodes[0])||{};
  var ngixStats={cpu:sys.cpu_pct,ram:(sys.memory||{}).pct,tcp:sys.tcp_established,up:sys.uptime};
  var pveStats={cpu:pveNode.cpu_pct,ram:pveNode.mem_pct,disk:pveNode.rootfs_pct,vms:pveNode.vms?pveNode.vms.length:0};

  // Hauteur commune pour les nœuds principaux (symétrie visuelle)
  var mainH=84, webH=84, extraH=48;

  // Nœuds fixes
  N.push({id:'internet',lbl:'INTERNET',sub:'WAN / ATTAQUANTS',ports:[{t:':443',c:'#ff3b5c'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':80',c:'#f97316'}],x:0.5,y:0.5,c:'#ff3b5c',w:108,h:66});
  N.push({id:'srv-ngix',lbl:'srv-ngix',sub:(hm['srv-ngix']||{}).ip||SOC_INFRA.SRV_NGIX,ports:[{t:':80→web',c:'#00d9ff'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':8006→pve',c:'#bf5fff'}],
    x:0.5,y:0.5,c:'#00d9ff',w:122,h:mainH,ngixStats:ngixStats,fwh:hm['srv-ngix']||{}});

  // Web backends — distribution symétrique autour de y=0.5
  webVms.forEach(function(vm,i){
    var fwh=_fwGetFwh(vm.name,hm)||{};
    var y=wc===1?0.5:(0.5-(wc-1)/2*0.32+i*0.32);
    y=Math.max(0.10,Math.min(0.90,y));
    N.push({id:vm.name,lbl:vm.name,sub:fwh.ip||('VMID:'+vm.id),ports:[{t:':80 ← ngix',c:'#00d9ff'}],
      x:0.5,y:y,c:vm.status==='running'?'#00ff88':'#4b5563',
      w:108,h:webH,vm:vm,fwh:fwh,running:vm.status==='running',vmType:vm.type});
  });

  // Proxmox — centré à y=0.5
  N.push({id:'proxmox',lbl:'proxmox',sub:(hm['proxmox']||{}).ip||SOC_INFRA.PROXMOX,ports:[{t:':8006',c:'#bf5fff'},{t:' · ',c:'rgba(180,200,230,0.3)'},{t:':2272',c:'#ffd700'}],
    x:0.5,y:0.5,c:'#bf5fff',w:116,h:mainH,pveStats:pveStats,fwh:hm['proxmox']||{}});

  // Extras — distribution symétrique autour de y=0.5
  extraVms.forEach(function(vm,i){
    var fwh=_fwGetFwh(vm.name,hm)||{};
    var y=ec===1?0.5:(0.5-(ec-1)/2*0.16+i*0.16);
    y=Math.max(0.06,Math.min(0.94,y));
    N.push({id:vm.name,lbl:vm.name,sub:fwh.ip||('VMID:'+vm.id),
      x:0.5,y:y,c:vm.status==='running'?'#00ff88':'#4b5563',
      w:96,h:extraH,vm:vm,fwh:fwh,running:vm.status==='running',vmType:vm.type,extra:true});
  });

  // ── Layout colonnes auto-distribué (pas de chevauchement) ────────
  // Construire l'ordre des colonnes et leur largeur max
  var colDefs=[];
  if(ac>0) colDefs.push({key:'atk',   w:116});
  colDefs.push(        {key:'inet',  w:112});
  colDefs.push(        {key:'ngix',  w:112});
  if(wc>0) colDefs.push({key:'web',   w:108});
  colDefs.push(        {key:'pve',   w:100});
  if(ec>0) colDefs.push({key:'extra', w:98});

  var edgePad=Math.max(52, W*0.04);
  var usableW=W-edgePad*2;
  var colXMap={};
  colDefs.forEach(function(c,i){
    colXMap[c.key]=Math.round(edgePad + (colDefs.length>1 ? i*usableW/(colDefs.length-1) : W/2));
  });

  // Attribuer px selon la colonne du nœud
  N.forEach(function(n){
    var colKey=n.atk?'atk':n.id==='internet'?'inet':n.id==='srv-ngix'?'ngix':n.id==='proxmox'?'pve':n.extra?'extra':'web';
    n.px=colXMap[colKey]!==undefined?colXMap[colKey]:Math.round(n.x*W);
    n.py=Math.round(n.y*H);
    // Clamp vertical seulement
    n.py=Math.max(n.h/2+6, Math.min(H-n.h/2-22, n.py));
  });

  // ── Connexions ─────────────────────────────────────────────────
  var CONNS=[];
  // Attaquants → INTERNET
  kcIps.forEach(function(ip,i){
    CONNS.push({f:'atk_'+i,t:'internet',lbl:ip.count>1?'×'+ip.count:'',c:'#ff3b5c',dash:false,atk:true});
  });
  CONNS.push({f:'internet',t:'srv-ngix',lbl:'443/80',c:'#ff3b5c',dash:false});
  webVms.forEach(function(vm){
    CONNS.push({f:'srv-ngix',t:vm.name,lbl:':80',c:'#00d9ff',dash:false});
  });
  CONNS.push({f:'srv-ngix',t:'proxmox',lbl:':8006',c:'#bf5fff',dash:true});
  extraVms.forEach(function(vm){
    CONNS.push({f:'proxmox',t:vm.name,lbl:'',c:'#bf5fff',dash:true,rev:true});
  });

  if(!canvas._pkts||canvas._pkts.length!==CONNS.length){
    canvas._pkts=CONNS.map(function(){return{t:Math.random(),spd:0.003+Math.random()*0.002};});
  }

  // ── NDT-14 : drawFwTopo drawing passes ────────────────────────────────────────
  function _fTopoBg(ctx){
    var bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#030812');bg.addColorStop(1,'#060d1a');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(0,217,255,0.04)';ctx.lineWidth=0.5;
    for(var gx=0;gx<W;gx+=40){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
    for(var gy=0;gy<H;gy+=40){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
    CONNS.forEach(function(cn,ci){
      var fn=_fwTopoNm(cn.f,N),tn=_fwTopoNm(cn.t,N);if(!fn||!tn)return;
      var stopped=tn.vm&&!tn.running;
      var sx,sy,ex,ey;
      if(cn.rev){sx=fn.px-fn.w/2;sy=fn.py;ex=tn.px+tn.w/2;ey=tn.py;}
      else{sx=fn.px+fn.w/2;sy=fn.py;ex=tn.px-tn.w/2;ey=tn.py;}
      var cpx=(sx+ex)/2;
      ctx.strokeStyle=cn.c;ctx.lineWidth=1.3;
      ctx.globalAlpha=stopped?0.15:0.45;
      if(cn.dash||stopped)ctx.setLineDash([5,5]);else ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(cpx,sy,cpx,ey,ex,ey);
      ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
      if(!stopped){
        ctx.fillStyle=cn.c;ctx.globalAlpha=0.8;
        if(cn.rev){ctx.beginPath();ctx.moveTo(ex+9,ey);ctx.lineTo(ex,ey-4);ctx.lineTo(ex,ey+4);}
        else{ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-9,ey-4);ctx.lineTo(ex-9,ey+4);}
        ctx.closePath();ctx.fill();ctx.globalAlpha=1;
      }
      if(!stopped){
        var pkt=canvas._pkts[ci];pkt.t=(pkt.t+pkt.spd)%1;
        var t=pkt.t,mt=1-t;
        var bx=mt*mt*mt*sx+3*mt*mt*t*cpx+3*mt*t*t*cpx+t*t*t*ex;
        var by=mt*mt*mt*sy+3*mt*mt*t*sy+3*mt*t*t*ey+t*t*t*ey;
        ctx.beginPath();ctx.arc(bx,by,3,0,Math.PI*2);
        ctx.fillStyle='#fff';ctx.shadowColor=cn.c;ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
      }
    });
    var inet=_fwTopoNm('internet',N);
    if(inet){
      ctx.fillStyle='rgba(255,59,92,0.55)';ctx.font='7.5px "Courier New"';ctx.textAlign='center';
      ctx.fillText('↓ 444 DROP',inet.px,inet.py+inet.h/2+12);
      ctx.fillText('↓ GeoIP-BLK',inet.px,inet.py+inet.h/2+22);
    }
  }
  function _fTopoNodes(ctx){
    N.forEach(function(n){
      var hh=n.fwh||hm[n.id]||{};
      var nx=n.px-n.w/2,ny=n.py-n.h/2;
      var stopped=n.vm&&!n.running;
      var alpha=stopped?0.45:1.0;

      // ── Nœud attaquant (IP active) ──────────────────────────────
      if(n.atk){
        var stageCol={'RECON':'#bf5fff','SCAN':'#ff6b35','EXPLOIT':'#ffd700','BRUTE':'#ff3b5c'}[n.atk.stage]||'#ff3b5c';
        // Aura rouge
        var agr=ctx.createRadialGradient(n.px,n.py,0,n.px,n.py,n.w*0.7);
        agr.addColorStop(0,'rgba(255,59,92,0.08)');agr.addColorStop(1,'transparent');
        ctx.fillStyle=agr;ctx.fillRect(nx-16,ny-16,n.w+32,n.h+32);
        // Boîte
        ctx.fillStyle='rgba(20,5,10,0.92)';ctx.fillRect(nx,ny,n.w,n.h);
        ctx.strokeStyle='rgba(255,59,92,0.55)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
        ctx.strokeRect(nx,ny,n.w,n.h);ctx.setLineDash([]);
        ctx.save();ctx.beginPath();ctx.rect(nx+3,ny+3,n.w-6,n.h-6);ctx.clip();
        // IP
        ctx.fillStyle='#ff7090';ctx.font='bold 8.5px "Courier New"';ctx.textAlign='center';
        ctx.fillText(n.atk.ip,n.px,n.py-4);
        // Pays + stage
        ctx.fillStyle=stageCol;ctx.font='7px "Courier New"';
        ctx.fillText((n.atk.country||'??')+' · '+n.atk.stage+(n.atk.count>1?' ×'+n.atk.count:''),n.px,n.py+7);
        ctx.restore();
        // Point rouge clignotant
        ctx.beginPath();ctx.arc(nx+n.w-6,ny+6,3,0,Math.PI*2);
        ctx.fillStyle='#ff3b5c';ctx.shadowColor='#ff3b5c';ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
        return; // skip rendu standard
      }
      // ────────────────────────────────────────────────────────────

      // Aura glow (uniquement si actif)
      if(!stopped){
        var glC={internet:'255,59,92','srv-ngix':'0,217,255',proxmox:'191,95,255'}[n.id]||'0,255,136';
        var gr=ctx.createRadialGradient(n.px,n.py,0,n.px,n.py,n.w*0.9);
        gr.addColorStop(0,'rgba('+glC+',0.10)');gr.addColorStop(1,'transparent');
        ctx.fillStyle=gr;ctx.fillRect(nx-24,ny-24,n.w+48,n.h+48);
      }

      // Boîte fond
      ctx.fillStyle=stopped?'rgba(10,14,22,0.92)':'rgba(7,14,28,0.96)';
      ctx.fillRect(nx,ny,n.w,n.h);
      if(stopped)_fwDrawHatch(ctx,nx,ny,n.w,n.h,'#94a3b8');

      // Bandeau de rôle en haut du nœud (3px)
      if(!stopped){
        var roleGrad=ctx.createLinearGradient(nx,0,nx+n.w,0);
        roleGrad.addColorStop(0,'transparent');
        roleGrad.addColorStop(0.3,n.c);
        roleGrad.addColorStop(0.7,n.c);
        roleGrad.addColorStop(1,'transparent');
        ctx.fillStyle=roleGrad;ctx.globalAlpha=0.55;
        ctx.fillRect(nx,ny,n.w,3);ctx.globalAlpha=1;
      }

      ctx.strokeStyle=n.c;ctx.lineWidth=stopped?0.6:1.5;
      ctx.globalAlpha=stopped?0.3:0.85;
      if(stopped)ctx.setLineDash([4,4]);
      ctx.strokeRect(nx,ny,n.w,n.h);
      ctx.setLineDash([]);ctx.globalAlpha=1;

      // Crochets (coins) uniquement si actif
      if(!stopped){
        ctx.strokeStyle=n.c;ctx.lineWidth=1.5;ctx.globalAlpha=0.85;
        [[nx,ny,1,1],[nx+n.w,ny,-1,1],[nx,ny+n.h,1,-1],[nx+n.w,ny+n.h,-1,-1]].forEach(function(c){
          ctx.beginPath();ctx.moveTo(c[0],c[1]+c[3]*6);ctx.lineTo(c[0],c[1]);ctx.lineTo(c[0]+c[2]*6,c[1]);ctx.stroke();
        });
        ctx.globalAlpha=1;
      }

      ctx.save();
      ctx.beginPath();ctx.rect(nx+3,ny+3,n.w-6,n.h-6);ctx.clip();
      ctx.globalAlpha=alpha;

      // Nom
      var hasStats=!!(n.vm||n.ngixStats||n.pveStats);
      ctx.fillStyle=n.c;ctx.font='bold 10px "Courier New"';ctx.textAlign='center';
      if(!stopped){ctx.shadowColor=n.c;ctx.shadowBlur=5;}
      ctx.fillText(n.lbl,n.px,n.py+(hasStats?-14:-5));ctx.shadowBlur=0;

      // IP / rôle
      ctx.fillStyle='rgba(122,154,184,0.7)';ctx.font='7px "Courier New"';
      ctx.fillText(n.sub,n.px,n.py+(hasStats?-4:7));

      // ── Stats VM web backend ──
      if(n.vm){
        if(stopped){
          ctx.fillStyle='rgba(248,113,113,0.85)';ctx.font='bold 7.5px "Courier New"';
          ctx.fillText('■ STOPPED',n.px,n.py+10);
        } else {
          ctx.font='6.5px "Courier New"';
          var parts=[];
          if(n.vm.cpu!==null&&n.vm.cpu!==undefined)parts.push({t:'CPU '+n.vm.cpu+'%',c:'rgba(0,217,255,0.7)'});
          if(n.vm.mem_pct)parts.push({t:'RAM '+n.vm.mem_pct+'%',c:'rgba(0,255,136,0.65)'});
          if(parts.length===2){
            ctx.fillStyle=parts[0].c;ctx.fillText(parts[0].t,n.px-22,n.py+8);
            ctx.fillStyle=parts[1].c;ctx.fillText(parts[1].t,n.px+22,n.py+8);
          } else if(parts.length===1){ctx.fillStyle=parts[0].c;ctx.fillText(parts[0].t,n.px,n.py+8);}
        }
      }

      // ── Stats srv-ngix (system) ──
      if(n.ngixStats){
        var ns=n.ngixStats;
        ctx.font='6.5px "Courier New"';
        ctx.fillStyle='rgba(0,217,255,0.7)';
        ctx.fillText('CPU '+(ns.cpu!==undefined?ns.cpu+'%':'—'),n.px-26,n.py+8);
        ctx.fillStyle='rgba(0,255,136,0.65)';
        ctx.fillText('RAM '+(ns.ram!==undefined?ns.ram+'%':'—'),n.px+22,n.py+8);
        ctx.fillStyle='rgba(122,154,184,0.55)';
        ctx.fillText((ns.tcp!==undefined?ns.tcp+' TCP':'')+(ns.up?' · '+ns.up:''),n.px,n.py+19);
      }

      // ── Stats proxmox (hyperviseur) ──
      if(n.pveStats){
        var ps=n.pveStats;
        ctx.font='6.5px "Courier New"';
        ctx.fillStyle='rgba(191,95,255,0.75)';
        ctx.fillText('CPU '+(ps.cpu!==undefined?ps.cpu+'%':'—'),n.px-26,n.py+8);
        ctx.fillStyle='rgba(0,217,255,0.65)';
        ctx.fillText('RAM '+(ps.ram!==undefined?ps.ram+'%':'—'),n.px+22,n.py+8);
        ctx.fillStyle='rgba(122,154,184,0.55)';
        ctx.fillText('Disk '+(ps.disk!==undefined?ps.disk+'%':'—')+(ps.vms?' · '+ps.vms+' VMs':''),n.px,n.py+19);
      }
      // ── Ports colorés ──
      if(n.ports){
        var portY;
        if(!hasStats){portY=n.py+19;}
        else if(n.vm){portY=n.py+(stopped?23:20);}
        else{portY=n.py+29;}
        ctx.font='6.5px "Courier New"';
        var _ptw=n.ports.reduce(function(s,p){return s+ctx.measureText(p.t).width;},0);
        var _pcx=n.px-_ptw/2;
        n.ports.forEach(function(p){ctx.fillStyle=p.c;ctx.textAlign='left';ctx.fillText(p.t,_pcx,portY);_pcx+=ctx.measureText(p.t).width;});
        ctx.textAlign='center';
      }

      ctx.globalAlpha=1;
      ctx.restore();

      // Point statut (haut-droite)
      if(n.id!=='internet'){
        var dc;
        if(n.vm){dc=n.running?'#00ff88':'#ff3b5c';}
        else{var ua=hh.ufw_active;dc=ua===true?'#00ff88':ua===false?'#ff3b5c':'#bf5fff';}
        ctx.beginPath();ctx.arc(nx+n.w-7,ny+7,3.5,0,Math.PI*2);
        ctx.fillStyle=dc;ctx.shadowColor=dc;ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;
      }

      // Badge VM / LXC + rôle (haut-gauche)
      ctx.font='6px "Courier New"';ctx.textAlign='left';
      if(n.vmType){
        ctx.fillStyle=n.vmType==='lxc'?'rgba(191,95,255,0.7)':'rgba(0,217,255,0.6)';
        ctx.fillText(n.vmType.toUpperCase(),nx+5,ny+11);
      } else if(n.id==='srv-ngix'){
        ctx.fillStyle='rgba(0,217,255,0.55)';ctx.fillText('PROXY',nx+5,ny+11);
      } else if(n.id==='proxmox'){
        ctx.fillStyle='rgba(191,95,255,0.55)';ctx.fillText('HYPERVISOR',nx+5,ny+11);
      } else if(n.id==='internet'){
        ctx.fillStyle='rgba(255,59,92,0.55)';ctx.fillText('WAN',nx+5,ny+11);
      }

      // Barre de conformité (bas) — nœuds principaux non-extras
      if(hh.conformity!==undefined&&!n.extra){
        var sc=hh.conformity>=90?'#00ff88':hh.conformity>=70?'#ffd700':'#ff3b5c';
        var barW=n.w-10, barH=4, barX=nx+5, barY=ny+n.h-8;
        // Fond
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(barX,barY,barW,barH);
        // Fill
        ctx.fillStyle=sc;ctx.globalAlpha=0.75;
        ctx.fillRect(barX,barY,barW*hh.conformity/100,barH);
        ctx.globalAlpha=1;
        // Label
        ctx.fillStyle=sc;ctx.font='6px "Courier New"';ctx.textAlign='right';
        ctx.fillText(hh.conformity+'%',nx+n.w-5,barY-1);
      }
    });
  }
  function _fTopoFooter(ctx){
    // Scanlines subtiles
    for(var sl=0;sl<H;sl+=3){
      ctx.fillStyle='rgba(0,0,0,0.04)';
      ctx.fillRect(0,sl,W,1);
    }
    // Footer : statut global
    var threatActive=kcIps.length>0;
    var footerC=threatActive?'rgba(255,59,92,0.7)':'rgba(0,255,136,0.6)';
    var footerTxt=threatActive?('⚠ THREAT DETECTED — '+kcIps.length+' IP(S) ACTIVE · 15 MIN WINDOW'):'✓ NO ACTIVE THREAT — SYSTEM SECURE';
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,H-20,W,20);
    ctx.fillStyle=footerC;ctx.font='7px "Courier New"';ctx.textAlign='center';
    ctx.fillText(footerTxt,W/2,H-7);
    // Légende (bas-gauche dans le footer)
    ctx.textAlign='left';ctx.font='7px Courier New';
    [{c:'#00ff88',t:'● RUNNING'},{c:'rgba(255,59,92,0.7)',t:'○ STOPPED'},{c:'rgba(191,95,255,0.7)',t:'◎ PVE-FW'},{c:'rgba(0,217,255,0.55)',t:'VM'},{c:'rgba(191,95,255,0.55)',t:'LXC'}]
    .forEach(function(e,i){ctx.fillStyle=e.c;ctx.fillText(e.t,8+i*88,H-7);});
  }

  function drawFrame(){
    var ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    _fTopoBg(ctx);
    _fTopoNodes(ctx);
    _fTopoFooter(ctx);
    _fwAnimFrame=requestAnimationFrame(drawFrame);
  }
  _fwAnimFrame=requestAnimationFrame(drawFrame);
}

