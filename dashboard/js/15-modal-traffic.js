// ════════════════════════════════════════════════════════
// TRAFFIC ANALYSIS MODAL — SOC
// ════════════════════════════════════════════════════════
function drawDonutOrbital(canvas,segs,total,centerLabel,subLabel){
  if(!canvas)return;
  var sz=220;
  canvas.width=sz;canvas.height=sz;
  canvas.style.width=sz+'px';canvas.style.height=sz+'px';
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,sz,sz);
  var cx=sz/2,cy=sz/2,R=sz*0.28,ri=R*0.58;
  if(!total){
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.07)';ctx.lineWidth=R-ri;ctx.stroke();
    ctx.fillStyle='rgba(122,154,184,0.5)';ctx.font='bold 11px "Courier New"';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('N/A',cx,cy);return;
  }
  var angle=-Math.PI/2;
  segs.forEach(function(s){
    if(!s.val)return;
    var sw=s.val/total*Math.PI*2;
    ctx.save();
    ctx.beginPath();ctx.arc(cx,cy,R,angle,angle+sw);ctx.arc(cx,cy,ri,angle+sw,angle,true);ctx.closePath();
    ctx.fillStyle=s.c;ctx.shadowColor=s.c;ctx.shadowBlur=14;ctx.fill();
    ctx.restore();
    var pct=Math.round(s.val/total*100);
    if(pct>=4&&s.lbl){
      var mid=angle+sw/2;
      var rLn=R+sz*0.07,rTx=R+sz*0.13;
      var lx1=cx+(R+1)*Math.cos(mid),ly1=cy+(R+1)*Math.sin(mid);
      var lx2=cx+rLn*Math.cos(mid),ly2=cy+rLn*Math.sin(mid);
      var tx=cx+rTx*Math.cos(mid),ty=cy+rTx*Math.sin(mid);
      ctx.beginPath();ctx.moveTo(lx1,ly1);ctx.lineTo(lx2,ly2);
      ctx.strokeStyle=s.c;ctx.lineWidth=1;ctx.globalAlpha=0.6;ctx.stroke();
      ctx.globalAlpha=1;
      ctx.beginPath();ctx.arc(lx2,ly2,1.5,0,Math.PI*2);ctx.fillStyle=s.c;ctx.fill();
      ctx.textAlign=Math.cos(mid)>0.1?'left':Math.cos(mid)<-0.1?'right':'center';
      ctx.textBaseline='middle';
      ctx.fillStyle=s.c;ctx.font='bold 8px "Courier New"';ctx.fillText(s.lbl,tx,ty-5);
      ctx.fillStyle='rgba(221,232,245,0.65)';ctx.font='8px "Courier New"';ctx.fillText(pct+'%',tx,ty+5);
    }
    angle+=sw;
  });
  ctx.beginPath();ctx.arc(cx,cy,ri-1,0,Math.PI*2);ctx.fillStyle='rgba(13,21,37,0.85)';ctx.fill();
  ctx.fillStyle='rgba(221,232,245,0.95)';
  ctx.font='bold '+Math.round(sz*0.07)+'px "Courier New"';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(centerLabel,cx,cy-sz*0.035);
  if(subLabel){
    ctx.fillStyle='rgba(122,154,184,0.5)';
    ctx.font=Math.round(sz*0.042)+'px "Courier New"';
    ctx.fillText(subLabel,cx,cy+sz*0.055);
  }
}

function _trRenderLive(){
  var lp=window._liveProtoFull||{};
  var lproto=window._liveProto||{};
  var rpm=lp.rpm||0,total=lp.total||0,win=lp.window_min||5;
  var cs=(window._lastData&&window._lastData.crowdsec)||{};
  var csBans=cs.active_decisions||0;
  var rpmCol=rpm>30?'var(--red)':rpm>10?'var(--amber)':'var(--cyan)';
  var rpmGlowRgb=rpm>30?'255,59,92':rpm>10?'245,158,11':'0,217,255';
  var rpmPct=Math.min(100,Math.round(rpm*3));
  var tab=document.getElementById('tr-tab-live');if(!tab)return;
  var protos=Object.entries(lproto).sort(function(a,b){return b[1]-a[1];});
  var maxP=protos.length?protos[0][1]||1:1;
  var now=new Date();
  var ts=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0')+':'+now.getSeconds().toString().padStart(2,'0');
  var protoMap={};PROTO_DEF.forEach(function(p){protoMap[p.k]={c:p.c,l:p.l};});
  var csJails=cs.jails||[];
  var csJailsHtml=csJails.length
    ?'<div style="margin-top:.35rem">'
      +csJails.slice(0,3).map(function(j){
        return `<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.15rem"><span style="color:var(--muted)">${j.name}</span><span style="color:var(--red);font-family:'Courier New',monospace">${fmt(j.active||j.current||0)} IPs</span></div>`;
      }).join('')+'</div>':'';
  var protosHtml=protos.length
    ?protos.slice(0,8).map(function(e){
        var k=e[0],v=e[1],pm=protoMap[k]||{c:'rgba(122,154,184,0.6)',l:k};
        var pct=Math.round(v/maxP*100),vpct=total?Math.round(v/total*100):0;
        return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem"><span style="min-width:3.8rem;font-size:var(--fs-xs);color:${pm.c};font-family:'Courier New',monospace">${pm.l}</span><div style="flex:1;height:5px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${pm.c};box-shadow:0 0 5px ${pm.c};border-radius:2px;transition:width .5s ease"></div></div><span style="min-width:2.5rem;font-size:var(--fs-xs);color:var(--text);font-family:'Courier New',monospace;text-align:right">${fmt(v)}</span><span style="min-width:2rem;font-size:var(--fs-xs);color:var(--muted);text-align:right">${vpct}%</span></div>`;
      }).join('')
    :'<div style="color:var(--muted);font-size:var(--fs-xs);padding:.4rem">Aucune donnée live — actualisation dans quelques secondes…</div>';
  var h=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem"><div style="background:rgba(0,0,0,0.3);border:1px solid rgba(${rpmGlowRgb},0.25);border-radius:3px;padding:.7rem .85rem"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.4rem">⬤ CADENCE — LIVE</div><div style="font-family:'Courier New',monospace;font-size:var(--fs-4xl);font-weight:700;color:${rpmCol};text-shadow:0 0 18px rgba(${rpmGlowRgb},0.6);line-height:1">${rpm.toFixed(1)}</div><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.45rem">req/min · fenêtre ${win} min · ${fmt(total)} req total</div><div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden"><div style="width:${rpmPct}%;height:100%;background:linear-gradient(90deg,rgba(0,217,255,.8),${rpmCol});border-radius:4px;transition:width .7s ease"></div></div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.5);margin-top:.18rem"><span>0</span><span>10</span><span>20</span><span style="color:var(--amber)">30+</span></div></div><div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,59,92,0.2);border-radius:3px;padding:.7rem .85rem"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.4rem">⊛ CROWDSEC — DÉCISIONS ACTIVES</div><div style="font-family:'Courier New',monospace;font-size:var(--fs-4xl);font-weight:700;color:var(--red);text-shadow:0 0 18px rgba(255,59,92,0.5);line-height:1">${fmt(csBans)}</div><div style="font-size:var(--fs-xs);color:var(--muted)">IPs bloquées nftables · couche L3 · avant nginx</div>${csJailsHtml}</div></div><div style="background:rgba(0,0,0,0.2);border:1px solid rgba(0,217,255,0.1);border-radius:3px;padding:.6rem .75rem"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.45rem">⬡ PROTOCOLES — RÉPARTITION 5 MIN · màj ${ts}</div>${protosHtml}</div>`;
  tab.innerHTML=h;
}

function trTab(el,name){
  document.querySelectorAll('#tr-tabs .fw-tab').forEach(function(t){t.classList.toggle('active',t===el);});
  ['status','sources','live'].forEach(function(n){
    var p=document.getElementById('tr-tab-'+n);if(p)p.classList.toggle('fw-panel-hidden',n!==name);
  });
  if(name==='live'){_raf2(function(){_trRenderLive();});}
}

function openTrafficModal(d){
  if(!d||_isOpen)return;
  var t=d.traffic||{},f2b=d.fail2ban||{},cs=d.crowdsec||{};
  var s2=t.status_2xx||0,s3=t.status_3xx||0,s4=t.status_4xx||0,s5=t.status_5xx||0;
  var sTot=s2+s3+s4+s5||t.total_requests||0;
  var geo=t.geo_blocks||0,banned=f2b.total_banned||0,csBans=cs.active_decisions||0;
  var legit=Math.max(0,(t.total_requests||0)-geo-banned-csBans);
  var srcTot=legit+geo+banned+csBans||1;
  var pL=Math.round(legit/srcTot*100),pG=Math.round(geo/srcTot*100),pB=Math.round(banned/srcTot*100),pC=100-pL-pG-pB;
  var tc=t.top_countries||[],tp=t.top_pages||[];
  var maxC=tc.length?tc[0][1]||1:1,maxP=tp.length?tp[0][1]||1:1;
  var pb=t.proto_breakdown||{};
  var pbItems=[
    ['HTTP',    'HTTP',   pb.HTTP||0,          'rgba(255,165,0,.9)'],
    ['HTTPS',   'HTTPS',  pb.HTTPS||0,         'rgba(0,217,255,.85)'],
    ['ASSETS',  'ASSETS', pb.ASSETS||0,        'rgba(0,255,136,.85)'],
    ['GEO-BLQ', 'GEO',   pb.GEO_BLOCK||0,     'rgba(255,107,53,.9)'],
    ['CLOSED',  'CLOSE',  pb.CLOSED||0,        'rgba(255,59,92,.85)'],
    ['404',     '404',    pb.NOT_FOUND||0,     'rgba(168,85,247,.85)'],
    ['REDIRECT','REDIR',  pb.HTTP_REDIRECT||0, 'rgba(96,165,250,.85)'],
    ['SCAN/BOT','BOT',    (pb.SCANNER||0)+(pb.BOT||0)+(pb.LEGIT_BOT||0)+(pb.OTHER||0), 'rgba(107,114,128,.7)'],
  ];
  var pbTot=pbItems.reduce(function(s,x){return s+x[2];},0)||1;
  var errRate=t.error_rate||0;
  var threatVol=(pb.CLOSED||0)+(pb.GEO_BLOCK||0)+(pb.NOT_FOUND||0)+(pb.SCANNER||0)+(pb.BOT||0);
  var okVol=(pb.HTTP||0)+(pb.HTTPS||0)+(pb.ASSETS||0)+(pb.HTTP_REDIRECT||0);
  var threatPct=pbTot?Math.round(threatVol/pbTot*100):0,okPct=pbTot?Math.round(okVol/pbTot*100):0;

  var errCol=errRate>5?'var(--red)':errRate>1?'var(--yellow)':'var(--green)';
  var kpiChipsHtml=[['REQ 24H',fmt(t.total_requests||0),'var(--cyan)'],
    ['BANDE PASS.',fmtB(t.total_bytes||0),'var(--cyan)'],
    ['ERR RATE',errRate+'%',errCol],
    ['GÉO BLQ.',fmt(geo),'var(--orange)'],
    ['CS BANS',fmt(csBans),'var(--red)'],
    ['F2B BANS',fmt(banned),'var(--red)']
  ].map(function(kv){return`<div class="tr-kpi"><div class="tr-kpi-lbl">${kv[0]}</div><div class="tr-kpi-val" style="color:${kv[2]}">${kv[1]}</div></div>`;}).join('');
  var _mkStats=function(rows){return rows.map(function(x){return`<div class="tr-stat-item"><div class="tr-stat-val" style="color:${x[2]}">${x[0]}</div><div class="tr-stat-lbl">${x[1]}</div></div>`;}).join('');};
  var topCountriesHtml=tc.length
    ?tc.slice(0,10).map(function(c){
        var cn=c[0]||'?',cv=c[1]||0,pct=Math.round(cv/maxC*100);
        return `<div style="margin-bottom:.25rem"><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.12rem"><span style="font-family:'Courier New',monospace;color:var(--text)">${cn}</span><span style="color:var(--muted);font-family:'Courier New',monospace">${fmt(cv)}</span></div><div class="pb-track"><div class="pb pb-c" style="width:${pct}%"></div></div></div>`;
      }).join('')
    :'<div style="color:var(--muted);font-size:var(--fs-xs);padding:.4rem">Aucune donnée disponible</div>';
  var topPagesHtml=tp.length
    ?'<table><thead><tr><th>URI</th><th style="text-align:right">Hits</th></tr></thead><tbody>'
      +tp.slice(0,12).map(function(p){
          var uri=p[0]||'/',hits=p[1]||0,pct=Math.round(hits/maxP*100);
          return `<tr><td style="color:var(--cyan);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${uri}</td><td><div class="td-bar"><div class="td-bar-inner"><div class="td-bar-fill pb-c" style="width:${pct}%;height:3px"></div></div><span class="td-bar-num">${fmt(hits)}</span></div></td></tr>`;
        }).join('')+'</tbody></table>'
    :'<div style="color:var(--muted);font-size:var(--fs-xs);padding:.4rem">Aucune donnée disponible</div>';
  var h=`<div style="margin-bottom:.75rem"><div style="font-size:var(--fs-xs);color:var(--muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:.12rem">◈ ANALYSE TRAFIC — SOC</div><div style="font-size:var(--fs-xl);font-weight:700;color:var(--cyan);text-shadow:0 0 18px var(--cyan);letter-spacing:1px">TRAFFIC ANALYSIS</div><div style="display:flex;gap:5px;margin-top:.65rem;flex-wrap:wrap">${kpiChipsHtml}</div></div><div class="fw-tabs" id="tr-tabs"><div class="fw-tab active" data-tab="status">⬡ Statuts HTTP</div><div class="fw-tab" data-tab="sources">⊞ Sources &amp; Pages</div><div class="fw-tab" data-tab="live">⚡ Analyse Live</div></div><div id="tr-tab-status"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:.75rem"><div class="tr-donut-col"><div class="tr-donut-title">CODES DE RÉPONSE HTTP</div><canvas id="tr-dn-http" class="tr-donut-orbital"></canvas><div class="tr-stat-grid">${_mkStats([[fmt(s2),'2xx Succès','var(--green)'],[fmt(s4),'4xx Clients','var(--yellow)'],[fmt(s5),'5xx Serveur','var(--red)'],[errRate+'%','Taux erreur',errCol]])}</div></div><div class="tr-donut-col"><div class="tr-donut-title">SOURCES DU TRAFIC</div><canvas id="tr-dn-src" class="tr-donut-orbital"></canvas><div class="tr-stat-grid">${_mkStats([[pL+'%','Légitimes','var(--green)'],[pG+'%','GeoIP blqués','var(--orange)'],[fmt(csBans),'CS Bannis','var(--red)'],[fmt(banned),'F2B Bannis','var(--red)']])}</div></div><div class="tr-donut-col"><div class="tr-donut-title">TYPES DE TRAFIC</div><canvas id="tr-dn-proto" class="tr-donut-orbital"></canvas><div class="tr-stat-grid">${_mkStats([[okPct+'%','Légitimes','var(--green)'],[threatPct+'%','Menaces','var(--red)'],[fmt(pb.HTTPS||0),'HTTPS','var(--cyan)'],[fmt(pb.ASSETS||0),'Assets','var(--cyan)']])}</div></div></div><div style="margin:.2rem 0 .5rem"><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.28rem;text-transform:uppercase;letter-spacing:.5px">Distribution sources — barre proportionnelle</div><div style="height:10px;background:rgba(0,0,0,0.35);border-radius:2px;overflow:hidden;display:flex;border:1px solid rgba(255,255,255,0.04)"><div style="width:${pL}%;background:linear-gradient(90deg,rgba(0,160,60,.7),rgba(0,255,136,.9))" title="Légitimes ${pL}%"></div><div style="width:${pG}%;background:linear-gradient(90deg,rgba(200,80,0,.7),rgba(255,107,53,.9))" title="GeoIP ${pG}%"></div><div style="width:${pC}%;background:linear-gradient(90deg,rgba(120,0,180,.7),rgba(191,95,255,.9))" title="CS ${pC}%"></div><div style="width:${pB}%;background:linear-gradient(90deg,rgba(180,0,30,.7),rgba(255,59,92,.9))" title="F2B ${pB}%"></div></div><div style="display:flex;gap:1rem;margin-top:.22rem;font-size:var(--fs-xs);flex-wrap:wrap"><span style="color:var(--green)">■ Légitimes ${pL}%</span><span style="color:var(--orange)">■ GeoIP ${pG}%</span><span style="color:var(--purple)">■ CS ${pC}%</span><span style="color:var(--red)">■ F2B ${pB}%</span></div></div></div><div id="tr-tab-sources" class="fw-panel-hidden"><div style="margin-bottom:.75rem"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.4rem">Top Pays Sources</div>${topCountriesHtml}</div><div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.4rem">Top Pages / URI</div>${topPagesHtml}</div></div><div id="tr-tab-live" class="fw-panel-hidden"></div>`;

  // Open modal
  document.getElementById('modal-card').classList.add('modal-xl','theme-cyan');
  var _trHt=document.getElementById('modal-header-title');
  if(_trHt)_trHt.innerHTML='<span style="margin-right:.45rem;opacity:.6">◈</span>ANALYSE TRAFIC — 24H';
  var _trMb=document.getElementById('modal-body');
  _trMb.innerHTML=h;
  _trMb.querySelectorAll('#tr-tabs .fw-tab').forEach(function(el){
    el.addEventListener('click',function(){trTab(this,this.getAttribute('data-tab'));});
  });
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
  _raf2(function(){
    drawDonutOrbital(document.getElementById('tr-dn-http'),
      [{val:s2,c:'rgba(0,255,136,.85)',lbl:'2xx'},{val:s3,c:'rgba(0,217,255,.85)',lbl:'3xx'},
       {val:s4,c:'rgba(255,215,0,.85)',lbl:'4xx'},{val:s5,c:'rgba(255,59,92,.85)',lbl:'5xx'}],
      sTot,fmt(t.total_requests||0),'HTTP');
    drawDonutOrbital(document.getElementById('tr-dn-src'),
      [{val:legit,c:'rgba(0,255,136,.85)',lbl:'OK'},{val:geo,c:'rgba(255,107,53,.85)',lbl:'GEO'},
       {val:csBans,c:'rgba(191,95,255,.85)',lbl:'CS'},{val:banned,c:'rgba(255,59,92,.85)',lbl:'F2B'}],
      srcTot,fmt(t.total_requests||0),'SOURCES');
    drawDonutOrbital(document.getElementById('tr-dn-proto'),
      pbItems.filter(function(x){return x[2]>0;}).map(function(x){return{val:x[2],c:x[3],lbl:x[1]};}),
      pbTot,fmt(pbTot),'PROTOS');
  });
}

