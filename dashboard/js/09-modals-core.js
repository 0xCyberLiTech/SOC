'use strict';
// ── openProxmoxModal helpers (module-level : NDT-51) ─────────────────────
function _pb(pct,cls){return'<div class="pb-track"><div class="pb '+cls+'" style="width:'+pct+'%"></div></div>';}
function _prow(lbl,used,total,pct,cls){
  return'<div class="pb-row"><div class="pb-hdr"><span>'+lbl+'</span><span>'+used+' / '+total+' ('+pct+'%)</span></div>'+_pb(pct,cls)+'</div>';
}
function _prxModalCpuHistHtml(pts,cpuC){
  var dur=Math.round(pts.length*5/60*10)/10;
  window._pveModalCpuHistData={pts:pts,cpuC:cpuC};
  return '<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:.35rem 0 .1rem">Historique CPU/Temp — '+dur+'h</div>'
    +'<canvas id="pve-modal-cpu-hist" height="64" style="display:block;width:100%;border-radius:2px"></canvas>';
}
function _sysModalCpuHistHtml(pts,cpuC){
  var dur=Math.round(pts.length*5/60*10)/10;
  var hasTemp=pts.some(function(p){return p.temp!=null;});
  window._sysModalCpuHistData={pts:pts,cpuC:cpuC};
  return '<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:.35rem 0 .1rem">Historique CPU'+(hasTemp?'/Temp':'')+' — '+dur+'h</div>'
    +'<canvas id="sys-modal-cpu-hist" height="64" style="display:block;width:100%;border-radius:2px"></canvas>';
}
function _drawPveModalCpuHist(canvas,pts,cpuC){
  var W=canvas.offsetWidth||400,H=parseInt(canvas.getAttribute('height'))||64;
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  var PT=6,PB=14,PL=28,PR=6;
  var gW=W-PL-PR, gH=H-PT-PB;
  var cpuVals=pts.map(function(p){return p.cpu||0;});
  var tempVals=pts.map(function(p){return p.temp!=null?p.temp:null;});
  var hasTemp=tempVals.some(function(t){return t!=null;});
  var maxT=Math.max.apply(null,tempVals.filter(function(t){return t!=null;}).concat([60]));
  var minT=Math.min.apply(null,tempVals.filter(function(t){return t!=null;}).concat([20]));
  var rgb=cpuC==='var(--red)'?'255,77,77':cpuC==='var(--yellow)'?'245,158,11':cpuC==='var(--cyan)'?'0,217,255':'139,92,246';
  function xAt(i){return PL+(pts.length>1?i/(pts.length-1)*gW:gW/2);}
  function yCpu(v){return PT+gH-Math.max(0,Math.min(1,v/100))*gH;}
  function yTemp(t){return PT+gH*0.15+gH*0.85-((t-minT)/Math.max(maxT-minT,10))*gH*0.7;}
  // Fond zone graphique
  ctx.fillStyle='rgba(0,0,0,0.18)';
  ctx.fillRect(PL,PT,gW,gH);
  // Grille horizontale 25/50/75/100%
  ctx.setLineDash([2,4]); ctx.lineWidth=0.5;
  [[100,'rgba(255,255,255,0.08)'],[75,'rgba(255,255,255,0.04)'],[50,'rgba(255,255,255,0.06)'],[25,'rgba(255,255,255,0.04)']].forEach(function(row){
    var y=yCpu(row[0]); ctx.strokeStyle=row[1];
    ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(PL+gW,y); ctx.stroke();
  });
  ctx.setLineDash([]);
  // Labels axe Y
  ctx.font='8px Courier New,monospace'; ctx.fillStyle='rgba(122,154,184,0.3)'; ctx.textAlign='right';
  [[100,'100'],[50,'50'],[25,'25']].forEach(function(row){ctx.fillText(row[1],PL-3,yCpu(row[0])+3);});
  // Aire CPU
  var cpuPts=cpuVals.map(function(v,i){return[xAt(i),yCpu(v)];});
  ctx.beginPath();
  ctx.moveTo(cpuPts[0][0],cpuPts[0][1]);
  for(var i=1;i<cpuPts.length;i++){var xc=(cpuPts[i-1][0]+cpuPts[i][0])/2,yc=(cpuPts[i-1][1]+cpuPts[i][1])/2;ctx.quadraticCurveTo(cpuPts[i-1][0],cpuPts[i-1][1],xc,yc);}
  ctx.lineTo(cpuPts[cpuPts.length-1][0],cpuPts[cpuPts.length-1][1]);
  ctx.lineTo(PL+gW,PT+gH); ctx.lineTo(PL,PT+gH); ctx.closePath();
  var grad=ctx.createLinearGradient(0,PT,0,PT+gH);
  grad.addColorStop(0,'rgba('+rgb+',0.38)'); grad.addColorStop(1,'rgba('+rgb+',0.04)');
  ctx.fillStyle=grad; ctx.fill();
  // Ligne CPU
  ctx.beginPath();
  ctx.moveTo(cpuPts[0][0],cpuPts[0][1]);
  for(var i=1;i<cpuPts.length;i++){var xc=(cpuPts[i-1][0]+cpuPts[i][0])/2,yc=(cpuPts[i-1][1]+cpuPts[i][1])/2;ctx.quadraticCurveTo(cpuPts[i-1][0],cpuPts[i-1][1],xc,yc);}
  ctx.lineTo(cpuPts[cpuPts.length-1][0],cpuPts[cpuPts.length-1][1]);
  ctx.strokeStyle='rgba('+rgb+',0.9)'; ctx.lineWidth=1.5;
  ctx.shadowColor='rgba('+rgb+',0.5)'; ctx.shadowBlur=5; ctx.stroke(); ctx.shadowBlur=0;
  // Dernier point CPU
  var lp=cpuPts[cpuPts.length-1];
  ctx.beginPath(); ctx.arc(lp[0],lp[1],3,0,Math.PI*2);
  ctx.fillStyle='rgba('+rgb+',1)'; ctx.shadowColor='rgba('+rgb+',0.9)'; ctx.shadowBlur=8; ctx.fill(); ctx.shadowBlur=0;
  // Valeur CPU courante
  var lastCpu=cpuVals[cpuVals.length-1];
  ctx.font='bold 9px Courier New,monospace'; ctx.fillStyle='rgba('+rgb+',0.9)'; ctx.textAlign='center';
  ctx.fillText(lastCpu+'%',lp[0],Math.max(lp[1]-5,PT+10));
  // Ligne Temp (dashed orange)
  if(hasTemp){
    ctx.setLineDash([3,3]); ctx.lineWidth=1; ctx.strokeStyle='rgba(245,158,11,0.5)';
    var started=false;
    ctx.beginPath();
    pts.forEach(function(p,i){if(p.temp==null)return; var x=xAt(i),y=yTemp(p.temp); if(!started){ctx.moveTo(x,y);started=true;}else{ctx.lineTo(x,y);}});
    ctx.stroke(); ctx.setLineDash([]);
    // Dernier point Temp
    var lastTempIdx=pts.map(function(p,i){return p.temp!=null?i:-1;}).filter(function(i){return i>=0;}).pop();
    if(lastTempIdx!=null){
      var tx=xAt(lastTempIdx),ty=yTemp(pts[lastTempIdx].temp);
      ctx.font='9px Courier New,monospace'; ctx.fillStyle='rgba(245,158,11,0.7)'; ctx.textAlign='center';
      ctx.fillText(pts[lastTempIdx].temp+'°',tx,ty-5);
    }
  }
  // Axe temps
  var dur=Math.round(pts.length*5/60*10)/10;
  ctx.font='8px Courier New,monospace'; ctx.fillStyle='rgba(122,154,184,0.35)';
  ctx.textAlign='left'; ctx.fillText('-'+dur+'h',PL,H-2);
  ctx.textAlign='right'; ctx.fillText('maintenant',PL+gW,H-2);
  if(hasTemp){ctx.fillStyle='rgba(245,158,11,0.5)';ctx.textAlign='center';ctx.fillText('— Temp',PL+gW*0.65,H-2);}
  ctx.fillStyle='rgba('+rgb+',0.55)'; ctx.textAlign='center'; ctx.fillText('— CPU',PL+gW*0.4,H-2);
}
// ── openModal helpers — Suricata proto view (module-level : NDT-50) ──────
var _SUR_PROTO_ITEMS=[{k:'SUR_DNS',col:'#00ff88',l:'DNS'},{k:'SUR_HTTP',col:'#f59e0b',l:'HTTP'},{k:'SUR_TLS',col:'#00d9ff',l:'TLS/SSL'},{k:'SUR_SSH',col:'#8b5cf6',l:'SSH'},{k:'SUR_FLOW',col:'#64748b',l:'FLOW'}];
function _mBuildSurSummaryHtml(surData){
  var sd=buildSurProtoDict(surData);
  var chips=_SUR_PROTO_ITEMS.filter(function(i){return sd[i.k]>0;}).map(function(i){
    return '<div class="stat-box" style="text-align:center;flex:1;padding:.25rem .3rem"><div class="sval" style="color:'+i.col+';font-size:var(--fs-xs)">'+fmt(sd[i.k])+'</div><div class="slbl">'+i.l+'</div></div>';
  }).join('');
  var threats='';
  if(sd.SUR_SCAN>0) threats+='<span style="padding:.12rem .35rem;background:rgba(255,59,92,0.15);border:1px solid rgba(255,59,92,0.4);border-radius:2px;font-size:var(--fs-xs);color:#ff3b5c;font-weight:700">⚡ SCAN '+sd.SUR_SCAN+' hits</span> ';
  if(sd.SUR_C2>0)   threats+='<span style="padding:.12rem .35rem;background:rgba(220,38,38,0.18);border:1px solid rgba(220,38,38,0.45);border-radius:2px;font-size:var(--fs-xs);color:#dc2626;font-weight:700">☠ C2 ×'+sd.SUR_C2+'</span>';
  return '<div style="margin-top:.6rem;border-top:1px solid rgba(255,59,92,0.2);padding-top:.45rem">'
    +'<div style="font-size:var(--fs-xs);color:rgba(255,59,92,0.5);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.35rem">◈ Suricata IDS réseau</div>'
    +'<div style="display:flex;gap:.3rem;flex-wrap:wrap">'+chips+'</div>'
    +(threats?'<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.3rem">'+threats+'</div>':'')
    +'</div>';
}
function _surKpiGaugeHtml(sp){
  var scanHits=sp.SUR_SCAN||0,c2=sp.SUR_C2||0;
  var thr=scanHits||c2
    ?'<div style="display:flex;gap:.4rem;margin-top:.4rem;flex-wrap:wrap">'
      +(scanHits?'<span style="padding:.15rem .4rem;background:rgba(255,59,92,0.15);border:1px solid rgba(255,59,92,0.4);border-radius:3px;font-size:var(--fs-xs);color:#ff3b5c;font-weight:700">⚡ SCAN '+scanHits+' hits</span>':'')
      +(c2?'<span style="padding:.15rem .4rem;background:rgba(220,38,38,0.18);border:1px solid rgba(220,38,38,0.45);border-radius:3px;font-size:var(--fs-xs);color:#dc2626;font-weight:700">☠ C2/TROJAN ×'+c2+'</span>':'')
      +'</div>':'';
  return '<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.35rem">Détections réseau Suricata IDS</div>'
    +'<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
    +_SUR_PROTO_ITEMS
     .filter(function(i){return sp[i.k]>0;})
     .map(function(i){return '<div class="stat-box" style="text-align:center;flex:1"><div class="sval" style="color:'+i.col+';font-size:var(--fs-xs)">'+fmt(sp[i.k])+'</div><div class="slbl">'+i.l+'</div></div>';})
     .join('')
    +'</div>'+thr;
}
// ── openModal proto helpers (module-level : NDT-78) ──────────────────────
function _mcUpdateProtoPane(proto,rpm,_modalBody,surData){
  var s=_protoComputeState(proto);
  var af=_modalBody.querySelector('#pm-arc-fill');
  if(af){af.setAttribute('stroke-dasharray',Math.max(3,Math.round(s.hp/100*251.33))+' 999');af.setAttribute('stroke',s.ac);af.style.filter='drop-shadow(0 0 6px '+s.ac+')';}
  var ap=_modalBody.querySelector('#pm-arc-pct');
  if(ap){ap.textContent=s.hp+'%';ap.setAttribute('fill',s.ac);}
  var lr=_modalBody.querySelector('#pm-legit-rows');
  if(lr)lr.innerHTML=s.legit.length?s.legit.map(function(p){return _protoRowHtml(p,proto[p.k]||0,s.total);}).join(''):'<div style="color:var(--muted);font-size:var(--fs-xs)">—</div>';
  var tr=_modalBody.querySelector('#pm-threat-rows');
  if(tr)tr.innerHTML=s.threats.length?s.threats.map(function(p){return _protoRowHtml(p,proto[p.k]||0,s.total);}).join(''):'<div style="color:var(--green);font-size:var(--fs-xs)">✓ aucune</div>';
  var g=_modalBody.querySelector('#pm-gauge');if(g)g.innerHTML=buildProtoThreatGauge(proto);
  var l=_modalBody.querySelector('#pm-legend');if(l)l.innerHTML=buildProtoModalLegend(proto)+_mBuildSurSummaryHtml(surData);
  var rEl=_modalBody.querySelector('#pt-rpm');if(rEl)rEl.textContent=rpm;
}
function _mcSwitchProtoView(p,lbl,isLive,_modalBody,full5){
  var surData=(window._lastData&&window._lastData.suricata)||{};
  _mcUpdateProtoPane(p,isLive?(full5.rpm||'—')+' req/min':'données 24h',_modalBody,surData);
  var b5=_modalBody.querySelector('#ptBtn5'),b24=_modalBody.querySelector('#ptBtn24');
  if(b5)b5.classList.toggle('active',isLive);
  if(b24)b24.classList.toggle('active',!isLive);
}
function openModal(cardEl){
  if(_isOpen)return;
  _isOpen=true;
  if(!cardEl){
    // appel direct (openJvModal, etc.) — contenu déjà injecté dans modal-body
    _overlay.classList.add('open');
    document.body.style.overflow='hidden';
    return;
  }
  var inner=cardEl.querySelector('.card-inner');
  if(!inner)return;
  var isMap   = !!cardEl.querySelector('#geomap');
  var isHeat  = !!cardEl.querySelector('.heatmap-canvas');
  var isRt    = !!cardEl.querySelector('#rt-area');
  var isProto = !!cardEl.querySelector('#proto-health-arc');
  var isKc    = !!cardEl.querySelector('#ckc-canvas');
  var mc = document.getElementById('modal-card');
  if(isMap) mc.classList.add('modal-geomap');
  else if(isHeat||isRt||isKc) mc.classList.add('modal-wide');
  if(isProto) mc.classList.add('modal-proto');
  // Thème couleur — cherche le 1er enfant direct de card-inner qui a classe "ct"
  var _themeMap={'r':'theme-red','g':'theme-green','c':'theme-cyan','p':'theme-purple','o':'theme-orange','y':'theme-yellow'};
  var _ctEl=null;
  for(var _ci=0;_ci<inner.children.length;_ci++){
    if(inner.children[_ci].classList&&inner.children[_ci].classList.contains('ct')){_ctEl=inner.children[_ci];break;}
  }
  var _hdrTitle=document.getElementById('modal-header-title');
  if(_ctEl){
    var _keys=Object.keys(_themeMap);
    for(var _ki=0;_ki<_keys.length;_ki++){
      if(_ctEl.classList.contains(_keys[_ki])){ mc.classList.add(_themeMap[_keys[_ki]]); break; }
    }
    // Titre modal — icône + nom de la tuile (retire "● LIVE" et texte superflu)
    if(_hdrTitle){
      var _iconEl=_ctEl.querySelector('.ct-icon');
      var _iconTxt=_iconEl?_iconEl.textContent:'';
      var _ctClone2=_ctEl.cloneNode(true);
      var _iconSp=_ctClone2.querySelector('.ct-icon');if(_iconSp)_iconSp.remove();
      var _tileTitle=_ctClone2.textContent.replace(/●\s*LIVE\s*/gi,'').trim();
      _hdrTitle.innerHTML=(_iconTxt?'<span style="margin-right:.45rem;opacity:.6">'+esc(_iconTxt)+'</span>':'')+esc(_tileTitle);
    }
  }
  _modalBody.innerHTML=inner.innerHTML;
  // Supprimer l'en-tête .ct de la tuile copié dans le body (déjà affiché dans modal-header)
  if(!isProto){var _ctInBody=_modalBody.querySelector('.ct');if(_ctInBody)_ctInBody.remove();}
  _modalBody.style.fontSize='1.05em';
  _overlay.classList.add('open');
  document.body.style.overflow='hidden';
  _raf2(function(){
    if(isMap){
      var mc2=_modalBody.querySelector('canvas');
      if(mc2)drawGeoMap(_lfLastGeoips,mc2,_lfLastWanIp);
    }
    // Attack heatmap en modal
    var hmc=_modalBody.querySelector('.heatmap-canvas');
    if(hmc&&window._lastTraffic){
      var tt=window._lastTraffic;
      hmc.classList.add('heatmap-expanded');
      animateAttackHeatmap(hmc,tt.requests_per_hour||{},tt.blocks_per_hour||{},tt.errors_per_hour||{},260);
    }
    // ACTIVITÉ TEMPS RÉEL en modal
    if(isRt&&window._lastData){
      var rtD=window._lastData.traffic||{};
      var rtK=Object.keys(rtD.requests_per_hour||{}).sort();
      var rtR=rtK.map(function(k){return rtD.requests_per_hour[k]||0;});
      var rtB=rtK.map(function(k){return(rtD.blocks_per_hour||{})[k]||0;});
      var rtA=_modalBody.querySelector('#rt-area');
      if(rtA)drawReqCurve(rtA,rtR,rtB);
      var nh=window._lastData.net_history||[];
      if(nh.length){
        var rx=nh.map(function(p){return p.rx||0;}),tx=nh.map(function(p){return p.tx||0;});
        var mRx=Math.max.apply(null,rx)||1,mTx=Math.max.apply(null,tx)||1;
        var mSpRx=_modalBody.querySelector('#rt-sp-rx'),mSpTx=_modalBody.querySelector('#rt-sp-tx');
        if(mSpRx)drawNetSparkline(mSpRx,rx,'0,217,255',mRx);
        if(mSpTx)drawNetSparkline(mSpTx,tx,'0,255,136',mTx);
      }
    }
    // Kill Chain en modal
    if(isKc&&window._lastData){
      var kcCv=_modalBody.querySelector('#ckc-canvas');
      if(kcCv)animateKillChain(kcCv,window._lastData.kill_chain||{},window._lastData.fail2ban||{});
    }
    // Proto modal — arc gauge + analyse + légende groupée
    if(isProto){
      var proto5=window._liveProto||{};
      var proto24=(window._lastData&&window._lastData.traffic&&window._lastData.traffic.proto_breakdown)||{};
      var full5=window._liveProtoFull||{};
      var surData=(window._lastData&&window._lastData.suricata)||{};
      var surProto=buildSurProtoDict(surData);
      var hasLive=Object.keys(proto5).some(function(k){return (proto5[k]||0)>0;});
      var curProto=hasLive?proto5:proto24;
      var s0=_protoComputeState(curProto);
      var legitInit=s0.legit.length?s0.legit.map(function(p){return _protoRowHtml(p,curProto[p.k]||0,s0.total);}).join(''):'<div style="color:var(--muted);font-size:var(--fs-xs)">—</div>';
      var threatInit=s0.threats.length?s0.threats.map(function(p){return _protoRowHtml(p,curProto[p.k]||0,s0.total);}).join(''):'<div style="color:var(--green);font-size:var(--fs-xs)">✓ aucune</div>';

      _modalBody.innerHTML=
        '<div class="proto-toggle-row">'
        +'<button class="proto-toggle-btn active" id="ptBtn5">⬤ LIVE 5 MIN</button>'
        +'<button class="proto-toggle-btn" id="ptBtn24">◉ 24 HEURES</button>'
        +'<button class="proto-toggle-btn" id="ptBtnSur" style="border-color:rgba(255,59,92,0.4);color:var(--red)">◈ SURICATA</button>'
        +'<span style="margin-left:auto;font-size:var(--fs-xs);color:var(--muted)" id="pt-rpm">'+(hasLive?(full5.rpm||'—')+' req/min':'données 24h')+'</span>'
        +'</div>'
        // ── Pane nginx (LIVE / 24H) ──────────────────────────────────────────
        +'<div id="pm-main-pane">'
        +'<div style="display:flex;align-items:flex-start;gap:1.2rem;margin-top:1.6rem">'
        +'<div style="flex-shrink:0;width:180px;text-align:center;padding-right:1rem">'
        +'<svg viewBox="0 0 200 110" width="160" height="88" style="display:block;overflow:visible">'
        +'<path d="M 10,90 A 80,80 0 0,1 190,90" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="14" stroke-linecap="round"/>'
        +'<path id="pm-arc-fill" d="M 10,90 A 80,80 0 0,1 190,90" fill="none" stroke="'+s0.ac+'" stroke-width="14" stroke-linecap="round" stroke-dasharray="'+Math.max(3,Math.round(s0.hp/100*251.33))+' 999" style="filter:drop-shadow(0 0 6px '+s0.ac+')"/>'
        +'<text id="pm-arc-pct" x="100" y="80" text-anchor="middle" fill="'+s0.ac+'" font-size="26" font-weight="bold" font-family="Courier New,monospace">'+s0.hp+'%</text>'
        +'<text x="100" y="100" text-anchor="middle" fill="rgba(122,154,184,0.5)" font-size="10" font-family="Courier New,monospace">NON-MENACE</text>'
        +'</svg>'
        +'</div>'
        +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.5rem">'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">'
        +'<div><div style="font-size:var(--fs-xs);color:var(--cyan);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.3rem;font-weight:700">◆ TRAFIC</div>'
        +'<div id="pm-legit-rows">'+legitInit+'</div></div>'
        +'<div><div style="font-size:var(--fs-xs);color:var(--red);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.3rem;font-weight:700">⚡ MENACES</div>'
        +'<div id="pm-threat-rows">'+threatInit+'</div></div>'
        +'</div>'
        +'<div id="pm-gauge">'+buildProtoThreatGauge(curProto)+'</div>'
        +'<div id="pm-legend" style="margin-top:.2rem">'+buildProtoModalLegend(curProto)+_mBuildSurSummaryHtml(surData)+'</div>'
        +(full5.rpm_buckets&&Object.keys(full5.rpm_buckets).length
          ?'<div class="proto-spark-wrap"><div class="proto-spark-lbl"><span>REQ/MIN — 5 DERNIÈRES MIN</span><span id="pt-spark-max"></span></div>'
            +'<canvas class="proto-spark-canvas" id="pm-spark" height="44"></canvas></div>':'')
        +'</div>'
        +'</div>'
        +'</div>'
        // ── Pane Suricata ────────────────────────────────────────────────────
        +'<div id="pm-sur-pane" style="display:none">'+_surKpiGaugeHtml(surProto)+'</div>';

      var pmSp=_modalBody.querySelector('#pm-spark');
      if(pmSp&&full5.rpm_buckets){
        requestAnimationFrame(function(){requestAnimationFrame(function(){drawProtoSpark(pmSp,full5.rpm_buckets);});});
        var smx=Math.max.apply(null,Object.values(full5.rpm_buckets))||0;
        var sml=_modalBody.querySelector('#pt-spark-max');
        if(sml&&smx)sml.textContent='max '+smx+' req/min';
      }
      _raf2(function(){
        var b5=_modalBody.querySelector('#ptBtn5'),b24=_modalBody.querySelector('#ptBtn24'),bSur=_modalBody.querySelector('#ptBtnSur');
        var mainPane=_modalBody.querySelector('#pm-main-pane'),surPane=_modalBody.querySelector('#pm-sur-pane');
        function _setActive(btn){[b5,b24,bSur].forEach(function(b){if(b)b.classList.remove('active');});if(btn)btn.classList.add('active');}
        if(b5)b5.onclick=function(){
          _setActive(b5);mainPane.style.display='';surPane.style.display='none';
          _mcUpdateProtoPane(proto5,(full5.rpm||'—')+' req/min',_modalBody,surData);
        };
        if(b24)b24.onclick=function(){
          _setActive(b24);mainPane.style.display='';surPane.style.display='none';
          _mcUpdateProtoPane(proto24,'données 24h',_modalBody,surData);
        };
        if(bSur)bSur.onclick=function(){
          _setActive(bSur);mainPane.style.display='none';surPane.style.display='';
          var rEl=_modalBody.querySelector('#pt-rpm');if(rEl)rEl.textContent='Suricata IDS réseau';
        };
        if(!hasLive&&bSur){_setActive(bSur);mainPane.style.display='none';surPane.style.display='';}
      });
    }
  });
}

// ── Barre ressource CPU/RAM/DSK réutilisée dans openSysModal + openProxmoxModal
function _rbar(label,pct,color){
  var w=Math.min(100,Math.max(0,pct));
  return '<div style="display:grid;grid-template-columns:28px 1fr 36px;align-items:center;gap:.3rem;margin:.18rem 0">'
    +'<span style="color:var(--muted);font-size:var(--fs-xs);font-family:\'Courier New\',monospace">'+label+'</span>'
    +'<div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">'
    +'<div style="height:100%;width:'+w+'%;background:linear-gradient(90deg,rgba(0,0,0,0),'+color+');border-radius:3px;transition:width .65s ease"></div>'
    +'</div>'
    +'<span style="font-size:var(--fs-xs);color:'+color+';text-align:right;font-weight:700;font-family:\'Courier New\',monospace">'+pct+'%</span>'
    +'</div>';
}
// ════════════════════════════════════════════════════════
// SYSTEME SRV-NGIX MODAL — RESSOURCES & NGINX MOTEUR
// ════════════════════════════════════════════════════════
function openSysModal(data){
  if(_isOpen)return;
  var sys=data.system||{};
  var nginxInfo=data.nginx_info||{};
  var traffic=data.traffic||{};
  var fw=((data.firewall_matrix&&data.firewall_matrix.hosts)||[]).find(function(h){return h.name==='srv-ngix';})||{};
  var f2b=data.fail2ban||{};
  var cs=data.crowdsec||{};
  var mem=sys.memory||{},disk=sys.disk||{},load=sys.load||{};
  var cpu=sys.cpu_pct||0,cores=sys.cpu_cores||0;
  var sysCpuHist=data.sys_cpu_history||[];
  var mc=document.getElementById('modal-card');
  mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-kci','modal-geomap','theme-red','theme-green','theme-cyan','theme-orange','theme-yellow','theme-purple');
  mc.classList.add('modal-win','theme-cyan');
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">◈</span>SRV-NGIX — SYSTÈME &amp; NGINX';
  var cpuC=cpu>85?'var(--red)':cpu>60?'var(--yellow)':'var(--cyan)';
  var lc=load['1m']?(parseFloat(load['1m'])>cores?'var(--red)':parseFloat(load['1m'])>cores*0.7?'var(--yellow)':'var(--cyan)'):'var(--muted)';
  // ── PROCESSEUR
  var memPct=mem.pct!=null?Math.round(mem.pct):null;
  var memC=memPct!=null?(memPct>85?'var(--red)':memPct>60?'var(--yellow)':'var(--purple)'):'var(--muted)';
  var ngxVer=nginxInfo.version?'nginx/'+nginxInfo.version:'nginx';
  var ngxWorkers=nginxInfo.workers!=null?nginxInfo.workers:cores;
  // ── PROCESSEUR
  var cpuSec='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> PROCESSEUR</div>'
    +'<div style="display:flex;align-items:center;gap:1rem;margin-bottom:.4rem">'
    +winGaugeSVG(cpu,cpuC,'CPU',sys.cpu_temp!=null?sys.cpu_temp+'°C':null)
    +'<div style="flex:1;font-size:var(--fs-xs)">'
    +'<div style="font-size:var(--fs-xs);color:var(--cyan);font-family:Courier New,monospace;font-weight:700;margin-bottom:.2rem">'+esc(ngxVer)+' · '+ngxWorkers+' workers</div>'
    +'<div style="color:var(--muted)">vCPU : <span style="color:var(--text)">'+cores+'</span></div>'
    +'<div style="margin-top:.3rem">'
    +_rbar('CPU',cpu,cpuC)
    +(memPct!=null?_rbar('RAM',memPct,memC):'')
    +'</div>'
    +(load['1m']?'<div style="color:var(--muted);margin-top:.2rem">Load : <span style="color:'+lc+'">'+load['1m']+' · '+load['5m']+' · '+load['15m']+'</span> <span style="font-size:var(--fs-xs);color:rgba(122,154,184,.3)">1m/5m/15m</span></div>':'')
    +(sys.uptime?'<div style="color:var(--muted);margin-top:.1rem">Uptime : <span style="color:var(--text)">'+esc(sys.uptime)+'</span></div>':'')
    +(sys.tcp_established!=null?'<div style="color:var(--muted)">TCP établies : <span style="color:var(--cyan)">'+sys.tcp_established+'</span></div>':'')
    +'</div></div>'
    +(sysCpuHist.length>1?_sysModalCpuHistHtml(sysCpuHist,cpuC):'')
    +'</div>';
  // ── MÉMOIRE & SYSTÈME
  var memSec='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--purple)">▸</span> MÉMOIRE &amp; SYSTÈME</div>'
    +(mem.pct!=null?_memBar('RAM',mem.pct,fmtMb(mem.used_mb||0),fmtMb(mem.total_mb||0)):'')
    +'</div>';
  // ── STOCKAGE (volumes Linux, même rendu que Proxmox)
  var sysVols=sys.volumes||[];
  var storageSec=sysVols.length?'<div class="win-section">'+_sysStorageHtml(sysVols)+'</div>':'';
  // ── NGINX MOTEUR
  var totalReq=traffic.total_requests||0;
  var errRate=((traffic.error_rate||0)).toFixed(1);
  var s2=traffic.status_2xx||0,s3=traffic.status_3xx||0,s4=traffic.status_4xx||0,s5=traffic.status_5xx||0;
  var totalSt=Math.max(s2+s3+s4+s5,1);
  var reqHist=traffic.requests_per_hour||{};
  var reqVals=Object.keys(reqHist).sort().map(function(k){return reqHist[k]||0;});
  var nginxSec='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> NGINX — MOTEUR</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.2rem .5rem;font-size:var(--fs-xs);margin-bottom:.35rem">'
    +'<div><div style="color:var(--muted)">Req 24h</div><div style="color:var(--cyan);font-weight:700;font-family:\'Courier New\',monospace">'+totalReq.toLocaleString('fr-FR')+'</div></div>'
    +'<div><div style="color:var(--muted)">Erreurs</div><div style="color:'+(parseFloat(errRate)>5?'var(--red)':parseFloat(errRate)>2?'var(--yellow)':'var(--green)')+';font-weight:700">'+errRate+'%</div></div>'
    +'<div><div style="color:var(--muted)">IPs uniq.</div><div style="color:var(--text)">'+( traffic.unique_ips||0)+'</div></div>'
    +'<div><div style="color:var(--muted)">Bots</div><div style="color:'+(( traffic.bots||0)>100?'var(--yellow)':'rgba(122,154,184,.6)')+'">'+( traffic.bots||0)+'</div></div>'
    +'</div>'
    // Status codes avec barres
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem;margin-bottom:.35rem">'
    +[['2xx',s2,'var(--green)'],['3xx',s3,'rgba(0,217,255,.6)'],['4xx',s4,(s4>500?'var(--yellow)':'rgba(122,154,184,.5)')],['5xx',s5,(s5>0?'var(--red)':'rgba(122,154,184,.3)')]].map(function(row){
      var pct=Math.round(row[1]/totalSt*100);
      return '<div style="display:flex;flex-direction:column;gap:.18rem">'
        +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs)">'
        +'<span style="color:rgba(122,154,184,.5)">'+row[0]+'</span>'
        +'<span style="color:'+row[2]+';font-family:\'Courier New\',monospace;font-weight:700">'+row[1].toLocaleString('fr-FR')+'</span>'
        +'</div>'
        +_stBar(pct,row[2])
        +'</div>';
    }).join('')
    +'</div>'
    // Sparkline req/h
    +(reqVals.length>1?'<div style="margin-bottom:.1rem"><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:.15rem"><span style="color:var(--c-muted-4)">Req/heure — 24H</span><span style="color:var(--cyan);font-family:\'Courier New\',monospace">'+(reqVals[reqVals.length-1]||0)+' req</span></div>'
    +'<div style="position:relative;border-radius:3px;overflow:hidden">'
    +'<canvas id="sys-req-spark" height="36" style="display:block;width:100%"></canvas>'
    +'<div class="pve-net-scan"></div>'
    +'</div></div>':'')
    +'</div>';
  // ── RÉSEAU — toutes interfaces (sauf lo)
  var _netDict=sys.net||{};
  var _netIfaces=Object.keys(_netDict).filter(function(k){return k!=='lo'&&_netDict[k].rx!=null;});
  var netSec=_netIfaces.length?'<div class="win-section"><div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> RÉSEAU <span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.3);font-weight:400;margin-left:.4rem;font-family:\'Courier New\',monospace">— cumul session</span></div>'
    +_netIfaces.map(function(ifc){
      var nd=_netDict[ifc];
      return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--fs-xs);margin:.1rem 0">'
        +'<span style="color:var(--cyan);font-family:\'Courier New\',monospace;font-weight:700">'+esc(ifc)+'</span>'
        +'<span style="color:rgba(0,217,255,.7)">↓ '+fmtBytes(nd.rx||0)+'</span>'
        +'<span style="color:rgba(0,255,136,.65)">↑ '+fmtBytes(nd.tx||0)+'</span>'
        +'</div>';
    }).join('')
    +'</div>':'';
  // ── CONTRE-MESURES
  var ufwOk=fw.ufw_active===true;
  var conf=fw.conformity;
  var confCol=conf===undefined?'var(--muted)':conf>=90?'var(--green)':conf>=70?'var(--yellow)':'var(--red)';
  var f2bBans=f2b.total_banned||0;
  var csDecisions=cs.active_decisions||0;
  var cmSec='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--green)">▸</span> CONTRE-MESURES</div>'
    +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.25rem .8rem;font-size:var(--fs-xs)">'
    +'<div><span style="color:var(--muted)">UFW </span><span style="color:'+(ufwOk?'var(--green)':'var(--red)')+';font-weight:700">■ '+(ufwOk?'ACTIVE':'INACTIVE')+'</span></div>'
    +'<div><span style="color:var(--muted)">Règles : </span><span style="color:var(--cyan)">'+(fw.ufw_rules||0)+'</span></div>'
    +'<div><span style="color:var(--muted)">Fail2ban : </span><span style="color:'+(f2bBans>0?'var(--red)':'var(--green)')+'">'+f2bBans+' bans</span></div>'
    +'<div><span style="color:var(--muted)">CrowdSec : </span><span style="color:'+(csDecisions>0?'var(--yellow)':'var(--green)')+'">'+csDecisions+' décisions</span></div>'
    +(conf!=null?'<div><span style="color:var(--muted)">Conformité : </span><span style="color:'+confCol+'">'+conf+'/100</span></div>':'')
    +'</div></div>';
  var h='<div class="win-refresh-bar"><div style="display:flex;align-items:center;gap:.8rem"><span class="ct-icon" style="color:var(--cyan);font-size:var(--fs-lg)">◈</span><span style="font-size:var(--fs-sm);font-weight:700;color:var(--cyan);letter-spacing:2px">SRV-NGIX — '+esc(SOC_INFRA.SRV_NGIX)+'</span></div><span class="win-modal-ts">uptime '+esc(sys.uptime||'?')+'</span></div>'
    +'<div>'+cpuSec+memSec+storageSec+nginxSec+netSec+cmSec+'</div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.3);text-align:center;margin-top:.4rem">Actualisé toutes les 5 min</div>';
  _modalBody.innerHTML=h;
  _modalBody.style.fontSize='1em';
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
  animateGauges();
  // CPU history canvas
  var _sCpuHistC=document.getElementById('sys-modal-cpu-hist');
  if(_sCpuHistC&&window._sysModalCpuHistData){
    var _schd=window._sysModalCpuHistData;
    _drawPveModalCpuHist(_sCpuHistC,_schd.pts,_schd.cpuC);
  }
  // Sparkline req/h
  if(reqVals.length>1){
    var rc=document.getElementById('sys-req-spark');
    if(rc){var maxR=Math.max.apply(null,reqVals)||1; drawNetSparkline(rc,reqVals,'0,217,255',maxR);}
  }
}

// NDT-175 — extracted from openSysModal: simple pct bar (no label, no value)
function _stBar(pct,col){return '<div style="flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden"><div style="width:'+Math.min(100,pct)+'%;height:100%;background:'+col+';border-radius:2px"></div></div>';}
// ── openProxmoxModal VM helpers (module-level : NDT-170/171/172) ─────────────
function _fmtVmMem(b){return b>=1073741824?(b/1073741824).toFixed(0)+' Go':b>=1048576?Math.round(b/1048576)+' Mo':'?';}
function _vmBar(pct,color,isRun){
  return '<div style="height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;flex:1">'
    +'<div'+(isRun?' class="vm-bar-run"':'')+' style="height:100%;width:'+Math.min(100,Math.max(0,pct))+'%;background:linear-gradient(90deg,rgba(0,0,0,0),'+color+');border-radius:2px;transition:width .65s ease"></div>'
    +'</div>';
}
function _vmCardHtml(v,vi){
  var run=v.status==='running';
  var cc=v.cpu>50?'var(--red)':v.cpu>20?'var(--yellow)':'var(--green)';
  var mc=v.mem_pct>85?'var(--red)':v.mem_pct>60?'var(--yellow)':'var(--purple)';
  var border=run?'rgba(0,255,136,.12)':'rgba(255,255,255,.05)';
  var nameColor=run?'rgba(185,215,240,.9)':'rgba(122,154,184,.6)';
  var delay=(vi*0.06).toFixed(2)+'s';
  var isLxc=v.type==='lxc';
  var tOp=run?'.7':'.45'; var tBd=run?'.28':'.18';
  var tCol=isLxc?'6,182,212':'139,92,246';
  var typeTag='<span style="font-size:calc(var(--fs-xs) - 2px);color:rgba('+tCol+','+tOp+');font-family:\'Courier New\',monospace;border:1px solid rgba('+tCol+','+tBd+');border-radius:2px;padding:0 .2rem;flex-shrink:0;letter-spacing:.5px">'+(isLxc?'LXC':'VM')+'</span>';
  var cOp=run?'.75':'.5'; var cBd=run?'.3':'.2';
  var coresTag=v.cpus?'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(245,158,11,'+cOp+');font-family:\'Courier New\',monospace;border:1px solid rgba(245,158,11,'+cBd+');border-radius:2px;padding:0 .2rem;flex-shrink:0">'+v.cpus+'c</span>':'';
  var nets=(v.networks||[]).slice(0,2);
  var ao=run?'.8':'.5'; var ab=run?'.6':'.4'; var abo=run?'.25':'.18'; var sOp=run?'.55':'.38'; var sBd=run?'.22':'.15';
  var ipRow=(v.ip||nets.length)?'<div style="display:flex;align-items:center;gap:.25rem;flex-wrap:wrap;margin:.1rem 0 .04rem">'
    +(v.ip?'<span style="color:rgba(0,217,255,'+ao+');font-size:calc(var(--fs-xs) - 1px);font-weight:600;font-family:\'Courier New\',monospace">'+esc(v.ip)+'</span>':'')
    +nets.map(function(b){return'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,255,'+ab+');font-family:\'Courier New\',monospace;border:1px solid rgba(0,217,255,'+abo+');border-radius:2px;padding:0 .22rem">'+esc(b)+'</span>';}).join('')
    +'<span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,'+sOp+');font-family:\'Courier New\',monospace;border:1px solid rgba(122,154,184,'+sBd+');border-radius:2px;padding:0 .2rem">:'+SOC_INFRA.SSH_PORT+'</span>'
    +'</div>':'';
  var trafficLine=(v.netin||v.netout)?'<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(0,217,255,.45);font-family:\'Courier New\',monospace;margin-top:.08rem">↓ '+_prxFmtBytes(v.netin||0)+' &nbsp;↑ '+_prxFmtBytes(v.netout||0)+'</div>':'';
  var memUsed=v.mem>0?_fmtVmMem(v.mem)+' / '+_fmtVmMem(v.maxmem||0):_fmtVmMem(v.maxmem||0);
  var idTag='<span style="color:rgba(122,154,184,.32);font-family:\'Courier New\',monospace">#'+v.id+'</span>';
  var body=run
    ?ipRow
      +'<div style="display:flex;align-items:center;gap:.25rem;margin:.12rem 0">'
      +'<span style="color:var(--muted);font-size:var(--fs-xs);font-family:\'Courier New\',monospace;width:28px;flex-shrink:0">CPU</span>'
      +_vmBar(v.cpu||0,cc,true)
      +'<span style="font-size:var(--fs-xs);color:'+cc+';font-weight:700;width:30px;text-align:right;flex-shrink:0">'+(v.cpu||0).toFixed(1)+'%</span>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:.25rem;margin:.12rem 0">'
      +'<span style="color:var(--muted);font-size:var(--fs-xs);font-family:\'Courier New\',monospace;width:28px;flex-shrink:0">RAM</span>'
      +_vmBar(v.mem_pct||0,mc,true)
      +'<span style="font-size:var(--fs-xs);color:'+mc+';font-weight:700;width:30px;text-align:right;flex-shrink:0">'+(v.mem_pct||0).toFixed(0)+'%</span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.2rem;font-size:var(--fs-xs);font-family:\'Courier New\',monospace">'
      +'<span style="color:rgba(139,92,246,.65)">'+memUsed+'</span>'+idTag+'<span style="color:rgba(122,154,184,.55)">'+esc(v.uptime||'—')+'</span>'
      +'</div>'
      +trafficLine
    :'<div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--fs-xs);font-family:\'Courier New\',monospace;margin:.22rem 0 .05rem">'
      +'<span style="color:rgba(122,154,184,.45)">stopped · <span style="color:rgba(139,92,246,.5)">'+_fmtVmMem(v.maxmem||0)+'</span></span>'+idTag
      +'</div>';
  return '<div style="background:rgba(255,255,255,.02);border:1px solid '+border+';border-radius:4px;padding:.38rem .48rem;animation:winSecIn .22s ease '+delay+' both">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:.3rem;margin-bottom:.1rem">'
    +'<span style="color:'+nameColor+';font-size:var(--fs-xs);font-weight:700;font-family:\'Courier New\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1">'+esc(v.name)+'</span>'
    +typeTag+coresTag
    +'<span'+(run?' class="vm-dot-run"':'')+' style="color:'+(run?'var(--green)':'rgba(122,154,184,.18)')+';font-size:var(--fs-3xs);flex-shrink:0">●</span>'
    +'</div>'
    +body
    +'</div>';
}
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// PROXMOX MODAL — RESSOURCES & CONTRE-MESURES
// ════════════════════════════════════════════════════════
function openProxmoxModal(data){
  if(_isOpen)return;
  var prx=data.proxmox||{};
  var node=(prx.nodes&&prx.nodes[0])||{};
  var mc=document.getElementById('modal-card');
  mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-kci','modal-geomap','theme-red','theme-green','theme-cyan','theme-orange','theme-yellow');
  mc.classList.add('modal-win','theme-purple');
  var _ht=document.getElementById('modal-header-title');
  if(_ht) _ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">◈</span>PROXMOX VE — RESSOURCES &amp; SÉCURITÉ';
  var pveCpuHist=data.pve_cpu_history||[];
  var cpuPct=node.cpu_pct||0;
  var cpuC=cpuPct>85?'var(--red)':cpuPct>60?'var(--yellow)':'var(--purple)';
  var cpuTmpC=node.cpu_temp!=null?(node.cpu_temp>85?'var(--red)':node.cpu_temp>70?'var(--yellow)':'var(--cyan)'):'var(--muted)';
  var acpiTmpC=node.acpi_temp!=null?(node.acpi_temp>70?'var(--red)':node.acpi_temp>55?'var(--yellow)':'var(--cyan)'):'var(--muted)';
  var nvmeBadgesHtml=(function(){
    var nd=(node.nvme_disks||[]).filter(function(d){return d.temp_c!=null;});
    if(!nd.length) return node.nvme_temp!=null?'<span style="color:var(--muted)">NVMe <span style="color:var(--cyan)">'+node.nvme_temp+'°C</span></span>':'';
    return nd.map(function(d){
      var dc=d.temp_c>70?'var(--red)':d.temp_c>55?'var(--yellow)':'var(--cyan)';
      var lbl=d.device.replace(/nvme(\d+)n1/,'N$1');
      return '<span style="color:var(--muted)">'+lbl+' <span style="color:'+dc+';font-weight:700">'+d.temp_c+'°C</span></span>';
    }).join('');
  })();
  var fansBadgesHtml=(node.fans||[]).map(function(f){
    var fc=f.rpm>3500?'var(--yellow)':'var(--green)';
    return '<span style="color:var(--muted)">'+esc(f.name)+' <span style="color:'+fc+';font-weight:700">'+f.rpm+' RPM</span></span>';
  }).join('');
  var loadAvgHtml=(function(){
    var la=node.load_avg;
    if(!la||la.length<3) return '';
    var cores=node.cpu_cores||8;
    var lc=la[0]>cores?'var(--red)':la[0]>cores*0.7?'var(--yellow)':'var(--text)';
    return '<div style="color:var(--muted);margin-top:.1rem">Load : <span style="color:'+lc+'">'+la[0]+' · '+la[1]+' · '+la[2]+'</span> <span style="font-size:var(--fs-xs);color:rgba(122,154,184,.3)">1m/5m/15m</span></div>';
  })();
  var resourceBarsHtml=(function(){
    var memPct=node.mem_pct!=null?Math.round(node.mem_pct):null;
    var mc=memPct!=null?(memPct>85?'var(--red)':memPct>60?'var(--yellow)':'var(--purple)'):'var(--muted)';
    return '<div style="margin-top:.35rem">'
      +_rbar('CPU',cpuPct,cpuC)
      +(memPct!=null?_rbar('RAM',memPct,mc):'')
      +'</div>';
  })();
  var cpuSectionHtml=`<div class="win-section"><div class="win-section-hdr"><span style="color:var(--purple)">▸</span> PROCESSEUR</div><div style="display:flex;align-items:center;gap:1rem;margin-bottom:.4rem">${winGaugeSVG(cpuPct,cpuC,'CPU',node.cpu_temp!=null?node.cpu_temp+'°C':'')}<div style="flex:1;font-size:var(--fs-xs)">${node.cpu_model?`<div style="font-size:var(--fs-xs);color:var(--text);font-family:Courier New,monospace;margin-bottom:.2rem" title="${esc(node.cpu_model)}">${esc((node.cpu_model||'').replace(/\d+(th|rd|nd|st) Gen Intel\(R\) Core\(TM\) /i,'').replace(/\(R\)/g,'').trim().substring(0,28))}</div>`:''}<div style="color:var(--muted)">Threads : <span style="color:var(--text)">${node.cpu_cores||'?'}</span>${node.pve_version?`<span style="color:rgba(139,92,246,.5);font-family:'Courier New',monospace;margin-left:.6rem">PVE ${esc(node.pve_version)}</span>`:''}</div>${resourceBarsHtml}${loadAvgHtml}<div style="margin-top:.3rem;display:flex;gap:.6rem;flex-wrap:wrap">${node.cpu_temp!=null?`<span style="color:var(--muted)">CPU <span style="color:${cpuTmpC};font-weight:700">${node.cpu_temp}°C</span></span>`:''}${nvmeBadgesHtml}${node.acpi_temp!=null?`<span style="color:var(--muted)">ACPI <span style="color:${acpiTmpC};font-weight:700">${node.acpi_temp}°C</span></span>`:''}${fansBadgesHtml}</div></div></div>${pveCpuHist.length>1?_prxModalCpuHistHtml(pveCpuHist,cpuC):''}</div>`;
  // ── STOCKAGE : laisser _prxNvmeDisksHtml fournir son propre header ▶ STOCKAGE NVMe
  var _nvmeHtml=_prxNvmeDisksHtml(node.nvme_disks,node.storages,node.zfs_pools||[]);
  var storageSectionHtml=_nvmeHtml?'<div class="win-section">'+_nvmeHtml+'</div>':'';
  // ── RÉSEAU : sparklines RX/TX par interface (pve_net_history)
  var _SKIP_NET=['fwpr','fwbr','fwln','tap','veth','docker','lxc','virbr','wg'];
  var netIfaces=(node.network||[]).filter(function(ifc){var n=ifc.name||'';return !_SKIP_NET.some(function(p){return n.indexOf(p)===0;});});
  var pveNetHist=data.pve_net_history||[];
  var networkSectionHtml='';
  if(netIfaces.length){
    networkSectionHtml='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> RÉSEAU <span style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.3);font-weight:400;margin-left:.4rem;font-family:\'Courier New\',monospace">— 4H</span></div>'
      +netIfaces.map(function(ifc){
        var safeName=ifc.name.replace(/[^a-z0-9]/gi,'-');
        var rxTotal=_prxFmtBytes(ifc.rx_bytes||0);
        var txTotal=_prxFmtBytes(ifc.tx_bytes||0);
        var spd=_prxFmtSpeed(ifc.speed_mb||0);
        var lastPt=pveNetHist.length?pveNetHist[pveNetHist.length-1]:{};
        var lastIfc=(lastPt.ifaces||{})[ifc.name]||{};
        var rxBps=lastIfc.rx_bps||0,txBps=lastIfc.tx_bps||0;
        var rxLbl=pveNetHist.length>1?_prxFmtBytesPerSec(rxBps):rxTotal;
        var txLbl=pveNetHist.length>1?_prxFmtBytesPerSec(txBps):txTotal;
        return '<div style="margin-bottom:.55rem;padding-bottom:.55rem;border-bottom:1px solid rgba(255,255,255,.04)">'
          +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.22rem">'
          +'<span style="color:var(--cyan);font-family:\'Courier New\',monospace;font-weight:700;font-size:var(--fs-xs)">'+esc(ifc.name)+'</span>'
          +'<div style="display:flex;gap:.55rem;align-items:center;font-size:var(--fs-xs);font-family:\'Courier New\',monospace">'
          +'<span style="color:rgba(0,217,255,.75)">↓ '+rxLbl+'</span>'
          +'<span style="color:rgba(0,255,136,.65)">↑ '+txLbl+'</span>'
          +(spd?'<span style="color:rgba(122,154,184,.3);font-size:calc(var(--fs-xs) - 1px)">'+spd+'</span>':'')
          +'</div>'
          +'</div>'
          +'<div style="position:relative;border-radius:3px;overflow:hidden">'
          +'<canvas id="pve-net-dual-'+safeName+'" height="48" style="display:block;width:100%"></canvas>'
          +'<div class="pve-net-scan"></div>'
          +'</div>'
          +'</div>';
      }).join('')+'</div>';
  }
  // ── VMs : tuiles par VM (running=barres CPU/RAM, stopped=grisé)
  var vms=node.vms||[];
  var vmsSectionHtml='';
  if(vms.length){
    var runningVms=vms.filter(function(v){return v.status==='running';});
    var stoppedVms=vms.filter(function(v){return v.status!=='running';});
    var cols=Math.min(runningVms.length||1,3);
    var stoppedLabel=stoppedVms.length+' VM'+(stoppedVms.length>1?'s':'')+' stoppée'+(stoppedVms.length>1?'s':'');
    var stoppedCols=Math.min(stoppedVms.length,3);
    vmsSectionHtml='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--yellow)">▸</span> MACHINES VIRTUELLES</div>'
      +'<div style="display:grid;grid-template-columns:repeat('+cols+',1fr);gap:.4rem;margin-top:.25rem">'
      +runningVms.map(function(v,vi){return _vmCardHtml(v,vi);}).join('')
      +'</div>'
      +(stoppedVms.length
        ?'<details style="margin-top:.3rem"><summary style="cursor:pointer;font-size:var(--fs-xs);color:var(--c-muted-4);font-family:\'Courier New\',monospace;letter-spacing:.6px;list-style:none;outline:none;user-select:none;padding:.2rem 0">▸ '+stoppedLabel+'</summary>'
          +'<div style="display:grid;grid-template-columns:repeat('+stoppedCols+',1fr);gap:.35rem;margin-top:.25rem">'
          +stoppedVms.map(function(v,vi){return _vmCardHtml(v,vi+runningVms.length);}).join('')
          +'</div></details>'
        :'')
      +'</div>';
  }
  // ── PROCESSUS SYSTÈME : top processus par CPU%
  var topProcs=node.top_procs||[];
  var procsSectionHtml='';
  if(topProcs.length){
    var maxCpu=Math.max.apply(null,topProcs.map(function(p){return p.cpu;}).concat([0.1]));
    procsSectionHtml='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--green)">▸</span> PROCESSUS SYSTÈME</div>'
      +'<div style="display:grid;grid-template-columns:1fr 42px 42px;gap:.1rem .4rem;font-size:var(--fs-xs);font-family:\'Courier New\',monospace;margin-bottom:.28rem;color:rgba(122,154,184,.32);text-transform:uppercase;letter-spacing:.4px;padding-bottom:.2rem;border-bottom:1px solid rgba(255,255,255,.06)">'
      +'<span>Processus</span><span style="text-align:right">CPU%</span><span style="text-align:right">MEM%</span>'
      +'</div>'
      +topProcs.map(function(p){
        var cc=p.cpu>50?'var(--red)':p.cpu>15?'var(--yellow)':'var(--green)';
        var mc=p.mem>30?'var(--red)':p.mem>10?'var(--yellow)':'var(--cyan)';
        return '<div style="display:grid;grid-template-columns:1fr 42px 42px;gap:.08rem .4rem;align-items:center;padding:.2rem 0;border-bottom:1px solid rgba(255,255,255,.03)">'
          +'<span style="color:rgba(185,215,240,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(p.cmd)+'</span>'
          +'<span style="text-align:right;color:'+cc+';font-weight:700">'+(p.cpu||0).toFixed(1)+'</span>'
          +'<span style="text-align:right;color:'+mc+'">'+(p.mem||0).toFixed(1)+'</span>'
          +'</div>';
      }).join('')
      +'</div>';
  }
  var h=`<div class="win-refresh-bar"><div style="display:flex;align-items:center;gap:.8rem"><span class="ct-icon" style="color:var(--purple);font-size:var(--fs-lg)">◈</span><span style="font-size:var(--fs-sm);font-weight:700;color:var(--purple);letter-spacing:2px">SYSTEME — PROXMOX VE</span></div><span class="win-modal-ts">Nœud : ${esc(node.name||'pve')} · uptime ${esc(node.uptime||'?')}</span></div><div>${cpuSectionHtml}${storageSectionHtml}${vmsSectionHtml}${networkSectionHtml}${procsSectionHtml}</div><div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.3);text-align:center;margin-top:.4rem">Actualisé toutes les 5 min</div>`;
  _modalBody.innerHTML=h;
  _modalBody.style.fontSize='1em';
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
  animateGauges();
  // CPU history canvas
  var _cpuHistC=document.getElementById('pve-modal-cpu-hist');
  if(_cpuHistC&&window._pveModalCpuHistData){
    var _chd=window._pveModalCpuHistData;
    _drawPveModalCpuHist(_cpuHistC,_chd.pts,_chd.cpuC);
  }
  // Sparklines réseau — dessinées après innerHTML (canvas now in DOM)
  if(netIfaces.length){
    netIfaces.forEach(function(ifc){
      var safeName=ifc.name.replace(/[^a-z0-9]/gi,'-');
      var rxVals=pveNetHist.map(function(p){return (p.ifaces&&p.ifaces[ifc.name]||{}).rx_bps||0;});
      var txVals=pveNetHist.map(function(p){return (p.ifaces&&p.ifaces[ifc.name]||{}).tx_bps||0;});
      var spMax=Math.max.apply(null,rxVals.concat(txVals).concat([1]));
      var c=document.getElementById('pve-net-dual-'+safeName);
      if(c) drawNetDualSparkline(c,rxVals,txVals,spMax);
    });
  }
}

// ════════════════════════════════════════════════════════
// FAIL2BAN JAILS MODAL
// ════════════════════════════════════════════════════════
var JAIL_DESC={
  'nginx-cve':'Exploits CVE détectés — Path Traversal, Log4Shell, RCE (maxretry=1, bantime=24h)',
  'nginx-site01-444':'Connexions fermées sans réponse — IP bloquée par nginx (444)',
  'nginx-site01-400':'Requêtes HTTP malformées ou malveillantes (400)',
  'nginx-limit-req':'Rate-limiting dépassé — trop de requêtes (429)',
  'nginx-http-auth':'Tentatives d\'authentification HTTP échouées (401)',
  'sshd':'Tentatives d\'authentification SSH échouées (port '+SOC_INFRA.SSH_PORT+')',
  'proxmox-ui':'Tentatives d\'authentification échouées sur l\'interface web Proxmox VE',
  'apache-badbots':'Bots malveillants connus — User-Agent blacklistés (maxretry=2)',
  'apache-noscript':'Requêtes vers scripts inexistants — scan de vulnérabilités (maxretry=6)',
  'apache-overflows':'Tentatives de buffer overflow sur requêtes HTTP (maxretry=2)'
};
function _f2bFlag(cc){
  if(!cc||cc==='-'||cc.length!==2)return '';
  try{return String.fromCodePoint.apply(null,cc.toUpperCase().split('').map(function(c){return 0x1F1E6-65+c.charCodeAt(0);}));}catch(e){return '';}
}
function _f2bFmtBantime(s){
  if(!s||s<0)return '?';
  if(s>=86400)return Math.round(s/86400)+'j';
  if(s>=3600)return Math.round(s/3600)+'h';
  return Math.round(s/60)+'min';
}
// ── openSuricataModal — NDT-52 refonte v4 (threads + circuit) ─────────────
// NDT-176 — extracted from openSuricataModal: circuit pill + arrow helpers
function _sPill(lbl,col){return '<span style="font-size:var(--fs-4xs);padding:.03rem .17rem;border:1px solid '+col+'44;border-radius:2px;color:'+col+'aa;font-family:\'Courier New\'">'+lbl+'</span>';}
function _sArr(){return '<span style="font-size:var(--fs-4xs);color:rgba(160,220,255,.25)">→</span>';}
function openSuricataModal(sur){
  if(!sur||!sur.available||_isOpen)return;
  var s1=sur.sev1_critical||0, s2=sur.sev2_high||0, s3=sur.sev3_medium||0;
  var tot=sur.total_alerts||0, rules=sur.rules_loaded||0, trunc=sur.truncated_24h||0;
  var topIps=sur.top_ips||[], topSigs=sur.top_signatures||[], rc=sur.recent_critical||[];
  var evts=sur.events||{}, ts=sur.thread_stats||null;

  // ── Bannière sév.1 ───────────────────────────────────────────────────────
  var alertBanner=s1>0
    ?'<div style="display:flex;align-items:center;gap:.6rem;padding:.35rem .9rem;border-left:3px solid var(--red);background:rgba(255,59,92,.07);border-radius:0 4px 4px 0;margin-bottom:1.2rem;animation:blink 1.5s ease-in-out infinite">'
      +'<span style="color:var(--red);font-size:var(--fs-md)">⚠</span>'
      +'<span style="font-size:var(--fs-2xs);color:var(--red);font-weight:700;letter-spacing:.9px;text-transform:uppercase">'+s1+' alerte'+(s1>1?'s':'')+' critique'+(s1>1?'s':'')+' sév.1 — CVE / Web Exploit détecté'+(s1>1?'s':'')+' en 24h</span>'
      +'</div>':'';

  // ── KPI row ─────────────────────────────────────────────────────────────
  var kpiHtml='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid rgba(255,255,255,.07);border-radius:6px;overflow:hidden;margin-bottom:1.2rem">'
    +[
      {v:s1,       l:'Sév. 1', sub:'Critique', c:'var(--red)'},
      {v:s2,       l:'Sév. 2', sub:'High',     c:'var(--amber)'},
      {v:s3,       l:'Sév. 3', sub:'Medium',   c:'var(--cyan)'},
      {v:fmt(tot), l:'Total',  sub:'24h'+(trunc>0?' +'+fmt(trunc)+'↓':''), c:'rgba(160,220,255,.6)'}
    ].map(function(k,i){
      var border=i>0?'border-left:1px solid rgba(255,255,255,.07);':'';
      return '<div style="padding:.7rem 1rem;'+border+'background:rgba(0,0,0,.25)">'
        +'<div style="font-size:var(--fs-3xl);font-weight:800;font-family:\'Courier New\',monospace;color:'+k.c+';line-height:1;text-shadow:0 0 10px '+k.c+'44">'+k.v+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:rgba(160,220,255,.55);text-transform:uppercase;letter-spacing:.6px;margin-top:.2rem">'+k.l+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:rgba(160,220,255,.3)">'+k.sub+'</div>'
        +'</div>';
    }).join('')+'</div>';

  // ── Protocoles ──────────────────────────────────────────────────────────
  var PCOLS={dns:'var(--cyan)',http:'var(--green)',tls:'var(--purple)',ssh:'var(--amber)',flow:'rgba(160,220,255,.45)'};
  var evtMax=Math.max.apply(null,['dns','http','tls','ssh','flow'].map(function(k){return evts[k]||0;}).concat([1]));
  var protoHtml='<div style="margin-bottom:1.2rem">'
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.55rem">Trafic réseau 24h · '+Math.round(rules/1000)+'k règles actives</div>'
    +'<div style="display:flex;gap:0;border:1px solid rgba(255,255,255,.07);border-radius:6px;overflow:hidden">'
    +['dns','http','tls','ssh','flow'].map(function(k,i){
      var val=evts[k]||0, pct=Math.round(val*100/evtMax), col=PCOLS[k];
      return '<div style="flex:1;padding:.5rem .6rem;background:rgba(0,0,0,.22);'+(i>0?'border-left:1px solid rgba(255,255,255,.06)':'')+'">'
        +'<div style="font-size:var(--fs-lg);font-weight:700;font-family:\'Courier New\',monospace;color:'+col+';line-height:1.1">'+fmt(val)+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.4px;margin:.1rem 0 .3rem">'+k+'</div>'
        +'<div style="height:2px;background:rgba(255,255,255,.05);border-radius:1px"><div style="width:'+pct+'%;height:2px;background:'+col+';border-radius:1px"></div></div>'
        +'</div>';
    }).join('')+'</div></div>';

  // ── Top IPs ──────────────────────────────────────────────────────────────
  var ipMax=topIps[0]?topIps[0].count||1:1;
  var topIpsPanel=topIps.length
    ?'<div><div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem">Top IPs attaquantes</div>'
      +topIps.map(function(e){
        var pct=Math.round(e.count*100/ipMax);
        return '<div style="display:grid;grid-template-columns:9.5rem 1fr 2.5rem;align-items:center;gap:.7rem;padding:.28rem 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          +'<span style="font-size:var(--fs-xs);color:rgba(255,107,107,.85);font-family:\'Courier New\',monospace">'+esc(e.ip)+'</span>'
          +'<div style="height:2px;background:rgba(255,59,92,.08);border-radius:1px"><div style="width:'+pct+'%;height:2px;background:rgba(255,59,92,.55);border-radius:1px"></div></div>'
          +'<span style="font-size:var(--fs-2xs);color:rgba(160,220,255,.5);text-align:right;font-family:\'Courier New\',monospace">'+e.count+'</span></div>';
      }).join('')+'</div>':'';

  // ── Alertes critiques ────────────────────────────────────────────────────
  var critPanel=rc.length
    ?rc.map(function(a){
        var tsStr=(a.ts||'').slice(11,19), dateStr=(a.ts||'').slice(0,10);
        return '<div style="padding:.55rem 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          +'<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.22rem">'
          +'<span style="font-size:var(--fs-xs);color:rgba(255,107,107,.9);font-family:\'Courier New\',monospace;font-weight:600">'+esc(a.src_ip)+'</span>'
          +(a.proto?'<span style="font-size:var(--fs-2xs);color:var(--cyan);border:1px solid rgba(0,217,255,.2);padding:.02rem .22rem;border-radius:3px">'+esc(a.proto)+'</span>':'')
          +(a.dest_port?'<span style="font-size:var(--fs-2xs);color:var(--c-label)">:'+esc(String(a.dest_port))+'</span>':'')
          +'<span style="margin-left:auto;font-size:var(--fs-2xs);color:rgba(160,220,255,.25);font-family:\'Courier New\',monospace">'+esc(dateStr)+' '+esc(tsStr)+'</span>'
          +'</div>'
          +'<div style="font-size:var(--fs-xs);color:rgba(220,180,180,.8);line-height:1.4">'+esc(a.signature)+'</div>'
          +(a.category?'<div style="font-size:var(--fs-2xs);color:rgba(160,220,255,.3);margin-top:.18rem">'+esc(a.category)+'</div>':'')
          +'</div>';
      }).join('')
    :'<div style="color:var(--green);font-size:var(--fs-xs);font-family:\'Courier New\',monospace;padding:1.5rem 0;text-align:center">✓ Aucune alerte critique en 24h</div>';

  // ── Signatures ───────────────────────────────────────────────────────────
  var sigMax=topSigs[0]?topSigs[0].count||1:1;
  var sigsPanel=topSigs.length
    ?topSigs.map(function(s){
        var pct=Math.round(s.count*100/sigMax);
        return '<div style="padding:.45rem 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          +'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:.5rem;margin-bottom:.2rem">'
          +'<span style="font-size:var(--fs-xs);color:rgba(180,210,240,.8);line-height:1.35;flex:1">'+esc(s.sig)+'</span>'
          +'<span style="font-size:var(--fs-2xs);color:rgba(160,220,255,.45);font-family:\'Courier New\',monospace;white-space:nowrap;margin-left:.5rem">'+s.count+'×</span>'
          +'</div>'
          +'<div style="height:2px;background:rgba(0,217,255,.06);border-radius:1px"><div style="width:'+pct+'%;height:2px;background:rgba(0,217,255,.4);border-radius:1px"></div></div>'
          +'</div>';
      }).join('')
    :'<div style="color:var(--muted);font-size:var(--fs-xs);text-align:center;padding:1.5rem 0">Aucune signature détectée</div>';

  // ── Moteur — circuit animé + threads ─────────────────────────────────────
  var evtTotal=(evts.dns||0)+(evts.http||0)+(evts.tls||0)+(evts.ssh||0)+(evts.flow||0)+tot+trunc;
  var satPct=evtTotal>0?Math.min(100,Math.round(trunc*100/evtTotal)):0;
  var satCol=satPct>15?'#ff3b5c':satPct>5?'#ff9900':'#00d9ff';
  var workers=ts&&ts.workers?ts.workers:[];
  var maxPkts=Math.max.apply(null,workers.map(function(w){return w.pkts;}).concat([1]));
  var gDrops=ts?ts.global_drops||0:0;
  var gPkts=ts?ts.global_pkts||0:0;
  var nic=ts&&ts.nic||{};

  // Circuit diagram — enriched
  var circuitCss='<style>'
    +'@keyframes sur-flow{from{background-position:0 0}to{background-position:24px 0}}'
    +'@keyframes sur-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}'
    +'@keyframes sur-pulse{0%,100%{opacity:.85}50%{opacity:1}}'
    +'@keyframes sur-glow-d{0%,100%{box-shadow:0 0 4px rgba(255,100,50,.15)}50%{box-shadow:0 0 12px rgba(255,100,50,.5)}}'
    +'@keyframes sur-glow-r{0%,100%{box-shadow:0 0 4px rgba(255,59,92,.15)}50%{box-shadow:0 0 12px rgba(255,59,92,.5)}}'
    +'@keyframes sur-glow-e{0%,100%{box-shadow:0 0 4px rgba(0,255,136,.1)}50%{box-shadow:0 0 12px rgba(0,255,136,.4)}}'
    +'.sur-dot-on{width:5px;height:5px;border-radius:50%;background:#00ff88;flex-shrink:0;animation:sur-pulse .8s ease-in-out infinite}'
    +'.sur-wire{height:3px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(255,100,50,0) 0,rgba(255,100,50,0) 5px,rgba(255,100,50,.7) 5px,rgba(255,100,50,.7) 9px,'
    +'rgba(255,100,50,0) 9px,rgba(255,100,50,0) 24px);background-size:24px 100%;'
    +'animation:sur-flow .5s linear infinite}'
    +'.sur-wire-fat{height:4px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(255,120,60,0) 0,rgba(255,120,60,0) 4px,rgba(255,120,60,.9) 4px,rgba(255,120,60,.9) 10px,'
    +'rgba(255,120,60,0) 10px,rgba(255,120,60,0) 24px);background-size:24px 100%;'
    +'animation:sur-flow .3s linear infinite}'
    +'.sur-wire-drop{height:3px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(255,59,92,0) 0,rgba(255,59,92,0) 5px,rgba(255,59,92,.9) 5px,rgba(255,59,92,.9) 9px,'
    +'rgba(255,59,92,0) 9px,rgba(255,59,92,0) 24px);background-size:24px 100%;'
    +'animation:sur-flow .22s linear infinite}'
    +'.sur-wire-crit{height:3px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(255,140,0,0) 0,rgba(255,140,0,0) 4px,rgba(255,140,0,.85) 4px,rgba(255,140,0,.85) 9px,'
    +'rgba(255,140,0,0) 9px,rgba(255,140,0,0) 24px);background-size:24px 100%;'
    +'animation:sur-flow .35s linear infinite}'
    +'.sur-node{border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;'
    +'font:700 9px "Courier New",monospace;letter-spacing:.06em;padding:.35rem .5rem;border:1px solid;text-align:center}'
    +'.sur-bar-high{background:linear-gradient(90deg,#ff3b5c44,#ff3b5c,#ff6b8844,#ff3b5c);background-size:200% 100%;animation:sur-shimmer .6s linear infinite}'
    +'.sur-bar-med{background:linear-gradient(90deg,#00d9ff44,#00d9ff,#40eeff44,#00d9ff);background-size:200% 100%;animation:sur-shimmer 1.2s linear infinite}'
    +'.sur-bar-low{background:linear-gradient(90deg,#00d9ff22,#00d9ff66,#00d9ff22);background-size:200% 100%;animation:sur-shimmer 2.4s linear infinite}'
    +'.sur-bar-drop{background:linear-gradient(90deg,#ff000044,#ff3b5c,#ff000044);background-size:200% 100%;animation:sur-shimmer .3s linear infinite}'
    +'</style>';

  var nicErrors=(nic.rx_errors||0)+(nic.tx_errors||0);
  var nicDrops=nic.rx_drop||0;
  var hasNicData=Object.keys(nic).length>0||gPkts>0;
  var nicHtml='<div class="sur-node" style="border-color:rgba(0,217,255,.4);background:rgba(0,217,255,.07);color:rgba(0,217,255,.9);min-width:82px">'
    +'<div style="display:flex;align-items:center;gap:.25rem;margin-bottom:.12rem">'
    +'<span style="font-size:var(--fs-xs)">⬡</span>'
    +(hasNicData?'<div class="sur-dot-on"></div>':'')
    +'</div>'
    +'<div style="font-size:var(--fs-2xs);font-weight:700">ens18</div>'
    +'<div style="font-size:var(--fs-3xs);opacity:.55;margin-bottom:.2rem">NIC</div>'
    +'<div style="display:flex;gap:.1rem;margin-bottom:.22rem;justify-content:center">'
    +_sPill('PROMIS','rgba(0,217,255,.7)')+_sArr()+_sPill('CAP','rgba(0,217,255,.7)')+_sArr()+_sPill('FILTER','rgba(0,217,255,.7)')
    +'</div>'
    +(Object.keys(nic).length?
      '<div style="text-align:left;width:100%">'
      +'<div style="font-size:var(--fs-3xs);color:rgba(0,217,255,.5)">RX '+fmtBytes(nic.rx_bytes||0)+'</div>'
      +'<div style="font-size:var(--fs-3xs);color:rgba(0,160,200,.45)">TX '+fmtBytes(nic.tx_bytes||0)+'</div>'
      +'<div style="font-size:var(--fs-3xs);color:'+(nicErrors>0?'#ff3b5c':'rgba(0,255,136,.7)')+';margin-top:.08rem">'+(nicErrors>0?'⚠ '+nicErrors+' err':'✓ 0 err')+'</div>'
      +(nicDrops>0?'<div style="font-size:var(--fs-3xs);color:rgba(255,59,92,.6)">'+nicDrops+'↓ drops</div>':'')
      +'</div>'
      :(gPkts>0?'<div style="font-size:var(--fs-3xs);color:rgba(0,217,255,.5);margin-top:.1rem">'+fmt(gPkts)+' pkts</div>':''))
    +'</div>';

  var ringFillTotal=Math.max(gPkts+(gDrops||0)+(trunc||0),1);
  var ringProcPct=Math.round(gPkts*100/ringFillTotal);
  var ringDropPct=Math.round((gDrops||0)*100/ringFillTotal);
  var ringTruncPct=Math.max(0,100-ringProcPct-ringDropPct);
  var ringBufHtml='<div class="sur-node" style="border-color:'+satCol+'88;background:rgba(20,10,0,.4);color:'+satCol+';min-width:92px;position:relative">'
    +'<div style="font-size:var(--fs-3xs);opacity:.55;margin-bottom:.15rem">AF-PACKET</div>'
    +'<div style="display:flex;gap:.1rem;margin-bottom:.18rem;justify-content:center">'
    +_sPill('AF_PKT',satCol)+_sArr()+_sPill('RING',satCol)+_sArr()+_sPill('KERN',satCol)
    +'</div>'
    +'<div style="position:relative;width:44px;height:44px;margin-bottom:.12rem">'
    +ring(satPct,satCol,44)
    +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
    +'<span style="font:700 9px \'Courier New\';color:'+satCol+'">'+satPct+'%</span>'
    +'</div></div>'
    +'<div style="font-size:var(--fs-3xs);margin-bottom:.12rem">RING BUFFER</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-4xs);color:rgba(160,220,255,.25);margin-bottom:.06rem"><span>CAPACITY</span><span>SAT '+satPct+'%</span></div>'
    +'<div style="display:flex;width:100%;height:9px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden;margin-bottom:.08rem">'
    +(ringProcPct>0?'<div style="flex:'+ringProcPct+';background:rgba(0,217,255,.55);min-width:2px"></div>':'')
    +(ringDropPct>0?'<div style="flex:'+ringDropPct+';background:rgba(255,59,92,.7);min-width:2px"></div>':'')
    +(ringTruncPct>0?'<div style="flex:'+ringTruncPct+';background:rgba(255,140,0,.65);min-width:2px"></div>':'')
    +(ringProcPct===0&&ringDropPct===0&&ringTruncPct===0?'<div style="flex:1;background:rgba(0,217,255,.3)"></div>':'')
    +'</div>'
    +(trunc>0?'<div style="font-size:var(--fs-3xs);color:'+satCol+';margin-top:.04rem">'+fmt(trunc)+'↓ tronq.</div>':'<div style="font-size:var(--fs-3xs);color:#00d9ff;margin-top:.04rem">✓ 0 tronq.</div>')
    +'<div style="font-size:var(--fs-3xs);opacity:.4;margin-top:.03rem">ring-size: 100k</div>'
    +'</div>';

  // Nœud compact dans le pipeline — workers
  var totalWorkerPkts=workers.reduce(function(a,w){return a+(w.pkts||0);},0);
  var totalWorkerDrops=workers.reduce(function(a,w){return a+(w.drops||0);},0);
  var workersHtml='<div style="display:flex;flex-direction:column;gap:.18rem;justify-content:center;padding:.35rem .45rem;border:1px solid rgba(0,217,255,.18);background:rgba(0,217,255,.04);border-radius:4px;min-width:190px">'
    +'<div style="display:flex;align-items:center;gap:.3rem;margin-bottom:.12rem">'
    +'<span style="font-size:var(--fs-3xs);color:rgba(0,217,255,.45);font-family:\'Courier New\';letter-spacing:.06em">WORKERS ('+workers.length+')</span>'
    +(totalWorkerDrops>0?'<span style="margin-left:auto;font-size:var(--fs-3xs);color:#ff3b5c;font-family:\'Courier New\'">'+totalWorkerDrops+'↓</span>':'<span style="margin-left:auto;font-size:var(--fs-3xs);color:rgba(0,255,136,.5)">✓ 0 drop</span>')
    +'</div>'
    +workers.map(function(w){
      var pct=Math.max(3,Math.round(w.pkts*100/maxPkts));
      var barCls=w.drops>0?'sur-bar-drop':pct>70?'sur-bar-high':pct>35?'sur-bar-med':'sur-bar-low';
      var wCol=w.drops>0?'#ff3b5c':pct>70?'#ff9900':'#00d9ff';
      return '<div style="display:flex;align-items:center;gap:.3rem">'
        +'<span style="font-size:var(--fs-3xs);color:'+wCol+';font-family:\'Courier New\';min-width:28px;flex-shrink:0">'+w.name.replace('-ens18','')+'</span>'
        +'<div style="flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">'
        +'<div class="'+barCls+'" style="width:'+pct+'%;height:100%;border-radius:2px"></div>'
        +'</div>'
        +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4);font-family:\'Courier New\';min-width:28px;text-align:right">'+fmt(w.pkts)+'</span>'
        +(w.drops>0?'<span style="font-size:var(--fs-3xs);color:#ff3b5c"> ↓</span>':'')
        +'</div>';
    }).join('')
    +(workers.length===0?'<div style="font-size:var(--fs-3xs);color:var(--muted)">Données non disponibles</div>':'')
    +(totalWorkerPkts>0?'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.25);text-align:right;margin-top:.08rem;font-family:\'Courier New\'">∑ '+fmt(totalWorkerPkts)+' pkts</div>':'')
    +'</div>';

  // Grille détaillée 6 workers (affichée SOUS le circuit, hors du flex pipeline)
  var workersDetailHtml=workers.length>0
    ?'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem;margin-top:.8rem">Workers — métriques par thread</div>'
    +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.45rem;margin-bottom:1rem">'
    +workers.map(function(w){
      var pct=Math.max(3,Math.round(w.pkts*100/maxPkts));
      var loadLabel=pct>70?'HIGH':pct>35?'MED':'LOW';
      var barCls=w.drops>0?'sur-bar-drop':pct>70?'sur-bar-high':pct>35?'sur-bar-med':'sur-bar-low';
      var wCol=w.drops>0?'#ff3b5c':pct>70?'#ff9900':'#00d9ff';
      var wBytes=fmtBytes(w.bytes||0);
      var avgPkt=Math.max(0,w.avg_pkt||0);
      var alrCol=w.alerts_detect>0?'rgba(255,100,80,.75)':'rgba(0,255,136,.5)';
      return '<div style="padding:.4rem .55rem;background:rgba(0,0,0,.25);border:1px solid '+wCol+'22;border-radius:4px">'
        +'<div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.25rem">'
        +'<span style="font:700 9px \'Courier New\';color:'+wCol+'">'+w.name.replace('-ens18','')+'</span>'
        +'<span style="margin-left:auto;font-size:var(--fs-3xs);color:'+wCol+';opacity:.7;font-family:\'Courier New\'">'+loadLabel+'</span>'
        +(w.drops>0?'<span style="font-size:var(--fs-3xs);color:#ff3b5c;font-family:\'Courier New\'">'+w.drops+'↓</span>':'')
        +'</div>'
        +'<div style="height:6px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;margin-bottom:.3rem">'
        +'<div class="'+barCls+'" style="width:'+pct+'%;height:100%;border-radius:3px"></div>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.1rem .3rem;font-size:var(--fs-3xs);color:rgba(160,220,255,.4);font-family:\'Courier New\'">'
        +'<span>'+fmt(w.pkts)+' pkts</span><span>'+wBytes+' déc.</span>'
        +'<span style="color:'+alrCol+'">'+(w.alerts_detect||0)+' alr</span><span>'+(w.flows_active||0)+' flows</span>'
        +'<span>avg '+avgPkt+'B</span><span>'+(w.trunc>0?'<span style="color:#ff9900">'+w.trunc+' tronq.</span>':'0 tronq.')+'</span>'
        +'</div>'
        +'</div>';
    }).join('')
    +'</div>'
    :'';

  var dec=ts&&ts.decoder||{}, det=ts&&ts.detect||{}, flows=ts&&ts.flows||{};
  var decTotal=Math.max((dec.ipv4||0)+(dec.tcp||0)+(dec.udp||0),1);
  var tcpPct=Math.round((dec.tcp||0)*100/decTotal);
  var udpPct=Math.round((dec.udp||0)*100/decTotal);
  var otherPct=Math.max(0,100-tcpPct-udpPct);
  function _miniBar(pct,col,lbl){
    return '<div style="display:flex;align-items:center;gap:.25rem;margin-bottom:.1rem">'
      +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4);min-width:22px;font-family:\'Courier New\'">'+lbl+'</span>'
      +'<div style="flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden">'
      +'<div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:3px"></div>'
      +'</div>'
      +'<span style="font-size:var(--fs-3xs);color:'+col+';min-width:20px;text-align:right;font-family:\'Courier New\'">'+pct+'%</span>'
      +'</div>';
  }
  var detTotal=Math.max((det.alerts||0)+(det.suppressed||0),1);
  var alertPct=Math.round((det.alerts||0)*100/detTotal);
  var suppPct=100-alertPct;
  var overflowBadge=det.overflow>0?'<span style="font-size:var(--fs-3xs);color:#ff3b5c;margin-left:.3rem">⚠ OVERFLOW '+det.overflow+'</span>':'<span style="font-size:var(--fs-3xs);color:#00ff88">✓ OK</span>';
  var s1Pct=tot>0?Math.round(s1*100/tot):0;
  var s2Pct=tot>0?Math.round(s2*100/tot):0;
  var s3Pct=Math.max(0,100-s1Pct-s2Pct);
  // EVE.JSON severity fill bar 9px segmented
  var eveFillBar='<div style="display:flex;justify-content:space-between;font-size:var(--fs-4xs);color:rgba(160,220,255,.25);margin-bottom:.06rem"><span>SEVERITY FILL</span><span>'+fmt(tot)+' events</span></div>'
    +'<div style="display:flex;width:100%;height:9px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden;margin-bottom:.07rem">'
    +(s1>0?'<div style="flex:'+(s1Pct||1)+';background:rgba(255,59,92,.75);min-width:2px"></div>':'')
    +(s2>0?'<div style="flex:'+(s2Pct||1)+';background:rgba(255,153,0,.65);min-width:2px"></div>':'')
    +(s3Pct>0?'<div style="flex:'+s3Pct+';background:rgba(0,217,255,.45);min-width:2px"></div>':'')
    +(tot===0?'<div style="flex:1;background:rgba(0,255,136,.3)"></div>':'')
    +'</div>'
    +'<div style="display:flex;gap:.3rem;font-size:var(--fs-4xs);font-family:\'Courier New\'">'
    +'<span style="color:rgba(255,59,92,.7)">S1:'+s1+'</span>'
    +'<span style="color:rgba(255,153,0,.6)">S2:'+s2+'</span>'
    +'<span style="color:rgba(0,217,255,.5)">S3:'+s3+'</span>'
    +'</div>';
  var engineHtml='<div style="display:flex;flex-direction:column;gap:.4rem;justify-content:center">'
    // DECODER
    +'<div style="border:1px solid rgba(255,100,50,.5);background:rgba(255,100,50,.07);border-radius:4px;padding:.35rem .5rem;min-width:165px;animation:sur-glow-d 3s ease-in-out infinite">'
    +'<div style="display:flex;align-items:center;gap:.3rem;margin-bottom:.2rem">'
    +'<span style="font-size:var(--fs-2xs);color:rgba(255,150,80,.9)">⚙</span>'
    +'<span style="font:700 9px \'Courier New\';color:rgba(255,150,80,.9);letter-spacing:.06em">DECODER</span>'
    +'<span style="margin-left:auto;font-size:var(--fs-3xs);color:var(--c-label)">avg '+Math.max(0,dec.avg_pkt||0)+'B</span>'
    +'</div>'
    +'<div style="display:flex;gap:.1rem;margin-bottom:.2rem;flex-wrap:nowrap">'
    +_sPill('AF_PKT','rgba(255,150,80,.8)')+_sArr()+_sPill('DECODE','rgba(255,150,80,.8)')+_sArr()+_sPill('PROTO','rgba(255,150,80,.8)')+_sArr()+_sPill('FRAG','rgba(255,150,80,.8)')
    +'</div>'
    +_miniBar(tcpPct,'#4af','TCP')
    +_miniBar(udpPct,'#ff9900','UDP')
    +_miniBar(otherPct,'rgba(160,220,255,.3)','OTH')
    +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3);margin-top:.12rem">'+fmt(dec.pkts||0)+' pkts · '+fmtBytes(dec.bytes||0)+' déc.</div>'
    +'</div>'
    // RULES ENGINE
    +'<div style="border:1px solid rgba(255,59,92,.45);background:rgba(255,59,92,.06);border-radius:4px;padding:.35rem .5rem;'+(det.overflow>0?'animation:sur-glow-r 1.5s ease-in-out infinite':'')+'">'
    +'<div style="display:flex;align-items:center;gap:.3rem;margin-bottom:.2rem">'
    +'<span style="font-size:var(--fs-2xs);color:rgba(255,120,120,.9)">◈</span>'
    +'<span style="font:700 9px \'Courier New\';color:rgba(255,120,120,.9);letter-spacing:.06em">RULES ENGINE</span>'
    +overflowBadge
    +'</div>'
    +'<div style="display:flex;gap:.1rem;margin-bottom:.2rem;flex-wrap:nowrap">'
    +_sPill('MATCH','rgba(255,100,100,.8)')+_sArr()+_sPill('SCORE','rgba(255,100,100,.8)')+_sArr()+_sPill('THRESH','rgba(255,100,100,.8)')+_sArr()+_sPill('ALERT','rgba(255,100,100,.8)')
    +'</div>'
    +_miniBar(alertPct,'#ff3b5c','ALR')
    +_miniBar(suppPct,'rgba(160,160,160,.4)','SUP')
    +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3);margin-top:.12rem">'+Math.round(rules/1000)+'k règles · '+(det.alerts||0)+' alr · '+(det.suppressed||0)+' sup</div>'
    +'</div>'
    // EVE.JSON
    +'<div style="border:1px solid rgba(0,255,136,.35);background:rgba(0,255,136,.04);border-radius:4px;padding:.35rem .5rem;'+(s1>0?'animation:sur-glow-e 2s ease-in-out infinite':'')+'">'
    +'<div style="display:flex;align-items:center;gap:.3rem;margin-bottom:.2rem">'
    +'<span style="font-size:var(--fs-2xs);color:rgba(0,255,136,.8)">▶</span>'
    +'<span style="font:700 9px \'Courier New\';color:rgba(0,255,136,.8);letter-spacing:.06em">EVE.JSON</span>'
    +'<div class="sur-dot-on" style="margin-left:auto"></div>'
    +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3)">24h</span>'
    +'</div>'
    +'<div style="display:flex;gap:.1rem;margin-bottom:.2rem;flex-wrap:wrap">'
    +_sPill('ALERT','rgba(0,255,136,.8)')+_sArr()+_sPill('FLOW','rgba(0,255,136,.8)')+_sArr()+_sPill('DNS','rgba(0,255,136,.8)')+_sArr()+_sPill('HTTP','rgba(0,255,136,.8)')+_sArr()+_sPill('TLS','rgba(0,255,136,.8)')
    +'</div>'
    +eveFillBar
    +'</div>'
    +'</div>';

  var wSz='width:40px;flex-shrink:0;align-self:center';
  var w1Cls=gPkts>100000?'sur-wire-fat':'sur-wire';
  var w2Cls=gDrops>0?'sur-wire-drop':(gPkts>100000?'sur-wire-fat':'sur-wire');
  var w3Cls=gDrops>0?'sur-wire-drop':(s1>0?'sur-wire-crit':(gPkts>100000?'sur-wire-fat':'sur-wire'));
  var moteurPanel=circuitCss
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.8rem">Pipeline de traitement AF-PACKET — '+(ts?ts.worker_count||workers.length:0)+' workers · Suricata 7</div>'
    +'<div style="display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem;background:rgba(0,0,0,.3);border:1px solid rgba(255,100,50,.1);border-radius:6px;overflow-x:auto;margin-bottom:1rem">'
    +nicHtml
    +'<div style="'+wSz+'"><div class="'+w1Cls+'"></div></div>'
    +ringBufHtml
    +(gDrops>0?'<div style="display:flex;flex-direction:column;align-items:center;gap:.15rem;flex-shrink:0">'
      +'<div style="'+wSz+'"><div class="sur-wire sur-wire-drop"></div></div>'
      +'<div style="font-size:var(--fs-3xs);color:#ff3b5c;white-space:nowrap">'+gDrops+' drops</div>'
      +'</div>':'<div style="'+wSz+'"><div class="'+w2Cls+'"></div></div>')
    +workersHtml
    +'<div style="'+wSz+'"><div class="'+w3Cls+'"></div></div>'
    +engineHtml
    +'</div>'
    +workersDetailHtml
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem">Stats kernel globales</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem">'
    +[
      {l:'Paquets capturés',v:fmt(gPkts),c:'rgba(0,217,255,.7)'},
      {l:'Drops kernel',v:gDrops>0?gDrops:'✓ 0',c:gDrops>0?'#ff3b5c':'#00ff88'},
      {l:'Saturation ring',v:satPct+'%',c:satCol}
    ].map(function(k){
      return '<div style="padding:.5rem .7rem;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06);border-radius:4px">'
        +'<div style="font-size:var(--fs-lg);font-weight:700;font-family:\'Courier New\',monospace;color:'+k.c+';line-height:1">'+k.v+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:var(--c-label);margin-top:.2rem;text-transform:uppercase;letter-spacing:.4px">'+k.l+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  // ── Tabs ─────────────────────────────────────────────────────────────────
  var _tbs='display:inline-flex;align-items:center;gap:.3rem;padding:.28rem .8rem;font-size:var(--fs-2xs);font-family:\'Courier New\',monospace;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:none;border-bottom:2px solid transparent;background:transparent;transition:all .15s;line-height:1;';
  var ALL_TABS=['resume','critical','signatures','moteur'];
  var h='<div id="sur-tabs" style="display:flex;align-items:flex-end;gap:0;border-bottom:1px solid rgba(255,59,92,.12);margin-bottom:1rem">'
    +'<button data-surtab="resume" style="'+_tbs+'color:var(--red);border-bottom:2px solid var(--red)">◈ Résumé</button>'
    +'<button data-surtab="critical" style="'+_tbs+'color:var(--c-label)">⚠ Critiques'+(s1>0?' <span style="color:var(--red)">'+s1+'</span>':'')+'</button>'
    +'<button data-surtab="signatures" style="'+_tbs+'color:var(--c-label)">▸ Signatures'+(topSigs.length>0?' <span style="color:rgba(160,220,255,.5)">'+topSigs.length+'</span>':'')+'</button>'
    +'<button data-surtab="moteur" style="'+_tbs+'color:var(--c-label)">⚙ Moteur</button>'
    +'</div>'
    +'<div id="sur-panel-resume">'+alertBanner+kpiHtml+protoHtml+topIpsPanel+'</div>'
    +'<div id="sur-panel-critical" style="display:none">'+critPanel+'</div>'
    +'<div id="sur-panel-signatures" style="display:none">'+sigsPanel+'</div>'
    +'<div id="sur-panel-moteur" style="display:none">'+moteurPanel+'</div>';

  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-wide','theme-red');
  mc.style.height='auto';mc.style.maxHeight='92vh';
  var mh=document.getElementById('modal-header-title');
  if(mh)mh.innerHTML='<span style="margin-right:.45rem;color:var(--red);opacity:.7">◈</span>SURICATA IDS — ANALYSE RÉSEAU 24H';
  var mb=document.getElementById('modal-body');
  mb.innerHTML=h;
  mb.style.overflowY='auto';
  mb.style.maxHeight='80vh';

  mb.querySelectorAll('[data-surtab]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var name=this.getAttribute('data-surtab');
      mb.querySelectorAll('[data-surtab]').forEach(function(b){
        var active=b.getAttribute('data-surtab')===name;
        b.style.color=active?'var(--red)':'var(--c-label)';
        b.style.borderBottom=active?'2px solid var(--red)':'2px solid transparent';
      });
      ALL_TABS.forEach(function(t){
        var p=document.getElementById('sur-panel-'+t);
        if(p)p.style.display=t===name?'':'none';
      });
    });
  });
  openModal();
}

// ── openF2bModal helpers (module-level : NDT-53) ─────────────────────────
function _f2bKpiHtml(val,lbl,col,pulse){
  return '<div style="flex:1;text-align:center;padding:.55rem .4rem;border-right:1px solid rgba(255,255,255,0.05)">'
    +'<div style="font-size:var(--fs-3xl);font-weight:700;font-family:\'Courier New\',monospace;color:'+col+';line-height:1'+(pulse?';animation:pulse 1.4s infinite':'')+';text-shadow:0 0 10px '+col+'44">'+val+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:.2rem">'+lbl+'</div>'
    +'</div>';
}
function openF2bModal(f2b){
  if(!f2b||_isOpen)return;
  var pvf2b=f2b.proxmox||{};
  var cltf2b=f2b.site01||{};
  var pa85f2b=f2b.site02||{};
  var allHosts=[
    {label:'SRV-NGIX', jails:f2b.jails||[], avail:true, note:'nginx · ignoreip '+SOC_INFRA.LAN_CIDR+''},
    {label:'PROXMOX',  jails:pvf2b.jails||[], avail:pvf2b.available, stale:pvf2b.stale,
     note:pvf2b.available&&pvf2b.generated_at?'sync '+pvf2b.generated_at.replace('T',' ').slice(0,16)+' UTC':'push cron 5 min'},
    {label:'SITE-01',  jails:cltf2b.jails||[], avail:cltf2b.available, note:'apache · ignoreip '+SOC_INFRA.LAN_CIDR+''},
    {label:'SITE-02',  jails:pa85f2b.jails||[], avail:pa85f2b.available, note:'apache · ignoreip '+SOC_INFRA.LAN_CIDR+''}
  ];
  var totalBanned=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.reduce(function(x,j){return x+(j.cur_banned||0);},0):0);},0);
  var totalFailed=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.reduce(function(x,j){return x+(j.tot_failed||0);},0):0);},0);
  var activeJails=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.filter(function(j){return j.cur_banned>0;}).length:0);},0);
  var prebanJails=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.filter(function(j){return j.cur_failed>0&&j.cur_banned===0;}).length:0);},0);
  var totalJails=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.length:0);},0);
  var banCol=totalBanned>0?'var(--red)':'var(--green)';


  // ── KPI bar + cartes hôtes compactes (vue opérationnelle — détail dans ⚙ Moteur) ──
  var hostsGridHtml=allHosts.map(function(host){
    var hostBan=host.avail?host.jails.reduce(function(a,j){return a+(j.cur_banned||0);},0):0;
    var hostJailCount=host.avail?host.jails.length:0;
    var hostActiveJails=host.avail?host.jails.filter(function(j){return j.cur_banned>0;}).length:0;
    var hostPreban=host.avail?host.jails.filter(function(j){return j.cur_failed>0&&j.cur_banned===0;}).length:0;
    var hasBan=hostBan>0;
    var accentCol=!host.avail?'rgba(122,154,184,.2)':hasBan?'rgba(255,60,60,.75)':'rgba(0,255,136,.45)';
    var borderOther=!host.avail?'rgba(122,154,184,.07)':hasBan?'rgba(255,60,60,.12)':'rgba(0,217,255,.07)';
    var hdrCol=!host.avail?'var(--muted)':hasBan?'var(--red)':'var(--cyan)';
    var statusBadge=!host.avail
      ?'<span style="font-size:var(--fs-xs);padding:.03rem .28rem;background:rgba(122,154,184,.07);border:1px solid rgba(122,154,184,.15);border-radius:2px;color:var(--muted)">HORS LIGNE</span>'
      :host.stale
        ?'<span style="font-size:var(--fs-xs);padding:.03rem .28rem;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.22);border-radius:2px;color:var(--amber)">⚠ STALE</span>'
        :hasBan
          ?'<span style="font-size:var(--fs-xs);padding:.03rem .32rem;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.32);border-radius:2px;color:var(--red);font-weight:700">▸ '+hostBan+' BAN</span>'
          :'<span style="font-size:var(--fs-xs);padding:.03rem .28rem;background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.16);border-radius:2px;color:var(--green)">✓ CLEAN</span>';
    var statsHtml=!host.avail
      ?'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);padding:.2rem 0">Données non disponibles</div>'
      :'<div style="display:flex;gap:.7rem;align-items:center;margin-top:.28rem">'
        +'<div style="text-align:center"><div style="font-size:var(--fs-sm);font-weight:700;font-family:\'Courier New\',monospace;color:'+(hasBan?'var(--red)':'var(--c-muted-4)')+'">'+hostBan+'</div><div style="font-size:var(--fs-3xs);color:rgba(122,154,184,.3);text-transform:uppercase;letter-spacing:.3px">ban</div></div>'
        +'<div style="width:1px;height:1.6rem;background:rgba(255,255,255,.06)"></div>'
        +'<div style="text-align:center"><div style="font-size:var(--fs-sm);font-weight:700;font-family:\'Courier New\',monospace;color:'+(hostActiveJails>0?'var(--red)':'var(--c-muted-4)')+'">'+hostActiveJails+' / '+hostJailCount+'</div><div style="font-size:var(--fs-3xs);color:rgba(122,154,184,.3);text-transform:uppercase;letter-spacing:.3px">jails actives</div></div>'
        +(hostPreban>0?'<div style="width:1px;height:1.6rem;background:rgba(255,255,255,.06)"></div>'
        +'<div style="text-align:center"><div style="font-size:var(--fs-sm);font-weight:700;font-family:\'Courier New\',monospace;color:var(--amber)">'+hostPreban+'</div><div style="font-size:var(--fs-3xs);color:rgba(122,154,184,.3);text-transform:uppercase;letter-spacing:.3px">pré-ban</div></div>':'')
        +'</div>';
    return '<div style="background:rgba(0,0,0,0.2);border:1px solid '+borderOther+';border-left:3px solid '+accentCol+';border-radius:2px;padding:.55rem .65rem">'
      +'<div style="display:flex;align-items:center;gap:.45rem">'
      +'<span style="font-size:var(--fs-sm);font-weight:700;color:'+hdrCol+';letter-spacing:1.5px">'+host.label+'</span>'
      +statusBadge
      +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.18);margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:10rem">'+esc(host.note)+'</span>'
      +'</div>'
      +statsHtml
      +'</div>';
  }).join('');
  var f2bJailsPanel='<div style="display:flex;align-items:center;gap:0;margin-bottom:.85rem;background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">'
    +_f2bKpiHtml(totalBanned,'IPs bannies',banCol,false)
    +_f2bKpiHtml(activeJails,'Jails actives',activeJails>0?'var(--red)':'var(--c-muted-4)',false)
    +(prebanJails>0?_f2bKpiHtml(prebanJails,'Pré-ban ⚠','var(--amber)',true):'')
    +_f2bKpiHtml(totalFailed,'Échecs cumul',totalFailed>0?'var(--yellow)':'var(--c-muted-4)',false)
    +'<div style="padding:.55rem .8rem;text-align:right;flex-shrink:0"><div style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);line-height:1.6">'+totalJails+' jails · 4 hôtes</div><div style="font-size:var(--fs-xs);color:rgba(122,154,184,.2)">refresh 5 min</div></div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.8rem">'+hostsGridHtml+'</div>'
    +'<div style="display:flex;align-items:center;gap:.45rem;padding:.35rem .7rem;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.04);border-radius:3px">'
    +'<span style="font-size:var(--fs-2xs);color:rgba(160,220,255,.3)">⚙</span>'
    +'<span style="font-size:var(--fs-2xs);color:rgba(160,220,255,.28);letter-spacing:.3px">Détail par jail · IPs bannies · pipeline de traitement → onglet <b style="color:rgba(160,220,255,.5)">⚙ Moteur</b></span>'
    +'</div>';

  // ── Moteur — pipeline Fail2ban animé ─────────────────────────────────────
  var f2bCircuitCss='<style>'
    +'@keyframes f2b-flow{from{background-position:0 0}to{background-position:24px 0}}'
    +'@keyframes f2b-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}'
    +'@keyframes f2b-pulse{0%,100%{opacity:.8}50%{opacity:1}}'
    +'.f2b-wire{height:3px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(255,107,53,0) 0,rgba(255,107,53,0) 5px,rgba(255,107,53,.6) 5px,rgba(255,107,53,.6) 9px,'
    +'rgba(255,107,53,0) 9px,rgba(255,107,53,0) 24px);background-size:24px 100%;'
    +'animation:f2b-flow .7s linear infinite}'
    +'.f2b-wire-ban{background:repeating-linear-gradient(90deg,'
    +'rgba(255,59,92,0) 0,rgba(255,59,92,0) 5px,rgba(255,59,92,.9) 5px,rgba(255,59,92,.9) 9px,'
    +'rgba(255,59,92,0) 9px,rgba(255,59,92,0) 24px);background-size:24px 100%;'
    +'animation:f2b-flow .28s linear infinite}'
    +'.f2b-bar-ban{background:linear-gradient(90deg,#ff3b5c44,#ff3b5c,#ff6b8844,#ff3b5c);background-size:200% 100%;animation:f2b-shimmer .7s linear infinite}'
    +'.f2b-bar-pre{background:linear-gradient(90deg,#f59e0b44,#f59e0b,#fcd34d44,#f59e0b);background-size:200% 100%;animation:f2b-shimmer 1.4s linear infinite}'
    +'.f2b-node{border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;'
    +'font:700 9px "Courier New",monospace;letter-spacing:.06em;padding:.38rem .55rem;border:1px solid;text-align:center}'
    +'@keyframes f2b-glow-b{0%,100%{box-shadow:none}50%{box-shadow:0 0 11px rgba(255,59,92,.5)}}'
    +'@keyframes f2b-glow-w{0%,100%{box-shadow:none}50%{box-shadow:0 0 9px rgba(245,158,11,.45)}}'
    +'.f2b-dot-on{animation:f2b-pulse 1s ease-in-out infinite}'
    +'.f2b-wire-fat{height:4px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(255,107,53,0) 0,rgba(255,107,53,0) 4px,rgba(255,107,53,.75) 4px,rgba(255,107,53,.75) 8px,'
    +'rgba(255,107,53,0) 8px,rgba(255,107,53,0) 20px);background-size:20px 100%;animation:f2b-flow .42s linear infinite}'
    +'.f2b-wire-enforce{height:3px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(255,59,92,0) 0,rgba(255,59,92,0) 4px,rgba(255,59,92,.9) 4px,rgba(255,59,92,.9) 8px,'
    +'rgba(255,59,92,0) 8px,rgba(255,59,92,0) 20px);background-size:20px 100%;animation:f2b-flow .22s linear infinite}'
    +'</style>';

  // ── LOG FILES — chemins + sources actives + LIVE badges ──────────────────
  var F2B_LOG_MAP={'nginx':'/nginx/access.log','sshd':'auth.log · journald','proxmox':'/pve/access.log','apache':'/apache2/access.log'};
  var F2B_LOG_KEYS=Object.keys(F2B_LOG_MAP);
  var f2bLogSrcs=F2B_LOG_KEYS.filter(function(k){
    return allHosts.some(function(h){return h.jails.some(function(j){return (j.jail||'').indexOf(k)!==-1;});});
  });
  var f2bLogsHtml='<div class="f2b-node" style="border-color:rgba(255,107,53,.3);background:rgba(255,107,53,.05);color:rgba(255,170,100,.9);min-width:115px'+(f2bLogSrcs.length>0?';animation:f2b-glow-w 2.5s ease-in-out infinite':'')+'\">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">▶</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">LOG FILES</div>'
    +'<div style="height:1px;background:rgba(255,107,53,.15);width:100%;margin-bottom:.2rem"></div>'
    +F2B_LOG_KEYS.map(function(k){
      var active=allHosts.some(function(h){return h.jails.some(function(j){return (j.jail||'').indexOf(k)!==-1;});});
      var jailCount=allHosts.reduce(function(a,h){return a+h.jails.filter(function(j){return (j.jail||'').indexOf(k)!==-1;}).length;},0);
      return '<div style="display:flex;align-items:flex-start;gap:.2rem;margin-bottom:.18rem;width:100%;text-align:left">'
        +'<span class="'+(active?'f2b-dot-on':'')+'" style="font-size:var(--fs-3xs);color:'+(active?'rgba(255,107,53,.9)':'rgba(160,220,255,.15)')+';margin-top:.05rem;flex-shrink:0">●</span>'
        +'<div style="flex:1">'
        +'<div style="font-size:var(--fs-3xs);color:'+(active?'rgba(255,170,100,.95)':'rgba(160,220,255,.2)')+';font-weight:'+(active?'700':'400')+'">'+k+'</div>'
        +'<div style="font-size:var(--fs-4xs);color:rgba(160,220,255,.18);font-family:\'Courier New\';margin-top:.02rem">'+F2B_LOG_MAP[k]+'</div>'
        +'</div>'
        +(active?'<span style="font-size:var(--fs-4xs);padding:.02rem .1rem;background:rgba(255,107,53,.1);border:1px solid rgba(255,107,53,.28);border-radius:2px;color:rgba(255,107,53,.65);flex-shrink:0;align-self:center">'+jailCount+'j</span>':'')
        +'</div>';
    }).join('')
    +'<div style="height:1px;background:rgba(255,107,53,.1);width:100%;margin:.1rem 0 .12rem"></div>'
    +'<div style="display:flex;justify-content:space-between;width:100%;align-items:center">'
    +'<span style="font-size:var(--fs-3xs);color:rgba(255,107,53,.65);font-weight:700">'+f2bLogSrcs.length+'/'+F2B_LOG_KEYS.length+' actifs</span>'
    +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.28)">'+totalJails+' jails</span>'
    +'</div>'
    +'</div>';

  // ── FILTERS — sous-pipeline REGEX→PARSE→SCORE + breakdown par hôte ───────
  var f2bFailedMax=Math.max.apply(null,allHosts.map(function(h){return h.avail?h.jails.reduce(function(a,j){return a+(j.tot_failed||0);},0):0;}).concat([1]));
  var f2bFiltersHtml='<div class="f2b-node" style="border-color:rgba(255,215,0,.3);background:rgba(255,215,0,.04);color:rgba(255,215,0,.9);min-width:118px'+(prebanJails>0?';animation:f2b-glow-w 1.8s ease-in-out infinite':'')+'\">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">◈</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">FILTERS</div>'
    +'<div style="height:1px;background:rgba(255,215,0,.12);width:100%;margin-bottom:.18rem"></div>'
    +'<div style="font-size:var(--fs-2xl);font-weight:800;font-family:\'Courier New\';color:rgba(255,215,0,.95);line-height:1">'+fmt(totalFailed)+'</div>'
    +'<div style="font-size:var(--fs-3xs);color:var(--c-label);margin-top:.04rem;margin-bottom:.18rem">tentatives</div>'
    +'<div style="display:flex;align-items:center;gap:.1rem;justify-content:center;margin-bottom:.18rem">'
    +'<div style="font-size:var(--fs-4xs);padding:.03rem .15rem;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:2px;color:rgba(255,215,0,.55)">REGEX</div>'
    +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.2)">→</span>'
    +'<div style="font-size:var(--fs-4xs);padding:.03rem .15rem;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:2px;color:rgba(255,215,0,.55)">PARSE</div>'
    +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.2)">→</span>'
    +'<div style="font-size:var(--fs-4xs);padding:.03rem .15rem;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:2px;color:rgba(255,215,0,.55)">SCORE</div>'
    +'</div>'
    +allHosts.filter(function(h){return h.avail;}).map(function(h){
      var hFail=h.jails.reduce(function(a,j){return a+(j.tot_failed||0);},0);
      var pct=Math.round(hFail*100/f2bFailedMax);
      return '<div style="display:flex;align-items:center;gap:.2rem;margin-bottom:.1rem">'
        +'<span style="font-size:var(--fs-3xs);color:rgba(255,215,0,.45);min-width:44px;font-family:\'Courier New\'">'+h.label+'</span>'
        +'<div style="flex:1;height:4px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;background:rgba(255,215,0,.5);border-radius:2px'+(hFail>0?';animation:f2b-shimmer 1.1s linear infinite':'')+'"></div>'
        +'</div>'
        +'<span style="font-size:var(--fs-3xs);color:'+(hFail>0?'rgba(255,215,0,.65)':'rgba(160,220,255,.2)')+';min-width:22px;text-align:right;font-family:\'Courier New\'">'+hFail+'</span>'
        +'</div>';
    }).join('')
    +'<div style="height:1px;background:rgba(255,255,255,.06);margin:.1rem 0 .08rem"></div>'
    +(prebanJails>0?'<div style="font-size:var(--fs-3xs);color:rgba(245,158,11,.8);font-weight:700">⚠ '+prebanJails+' pré-ban</div>':'')
    +'<div style="font-size:var(--fs-4xs);color:rgba(160,220,255,.2);margin-top:.06rem">algo: maxretry · findtime</div>'
    +'</div>';

  // ── JAILS — fill level segmenté par hôte + détail actif/total ────────────
  var f2bMaxBan=Math.max.apply(null,allHosts.map(function(h){return h.avail?h.jails.reduce(function(a,j){return a+(j.cur_banned||0);},0):0;}).concat([1]));
  var f2bTotalForFill=Math.max(totalBanned,1);
  var F2B_HOST_COL={'SRV-NGIX':'rgba(0,217,255,.7)','PROXMOX':'rgba(255,215,0,.65)','CLT':'rgba(160,220,255,.6)','PA85':'rgba(200,180,255,.6)'};
  var f2bJailsEngHtml='<div class="f2b-node" style="border-color:rgba(255,59,92,.3);background:rgba(255,59,92,.05);color:rgba(255,100,100,.9);min-width:148px'+(totalBanned>0?';animation:f2b-glow-b 1.6s ease-in-out infinite':'')+'\">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">⊘</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">JAILS</div>'
    +'<div style="height:1px;background:rgba(255,59,92,.12);width:100%;margin-bottom:.18rem"></div>'
    +allHosts.map(function(h){
      var hBan=h.avail?h.jails.reduce(function(a,j){return a+(j.cur_banned||0);},0):0;
      var hPre=h.avail?h.jails.filter(function(j){return j.cur_failed>0&&j.cur_banned===0;}).length:0;
      var hAct=h.avail?h.jails.filter(function(j){return j.cur_banned>0;}).length:0;
      var pct=Math.round(hBan*100/f2bMaxBan);
      var hCol=!h.avail?'rgba(160,220,255,.2)':hBan>0?'#ff3b5c':'#00ff88';
      return '<div style="margin-bottom:.18rem;width:100%">'
        +'<div style="display:flex;align-items:center;gap:.2rem;margin-bottom:.07rem">'
        +'<span style="font-size:var(--fs-3xs);color:'+(F2B_HOST_COL[h.label]||hCol)+';min-width:50px;font-family:\'Courier New\';font-weight:700">'+h.label+'</span>'
        +(h.avail
          ?'<span style="font-size:var(--fs-3xs);color:'+hCol+';font-weight:'+(hBan>0?'700':'400')+'">'+hBan+' ban</span>'
          +'<span style="font-size:var(--fs-4xs);color:rgba(160,220,255,.25);margin-left:.15rem">·</span>'
          +'<span style="font-size:var(--fs-3xs);color:var(--c-label)">'+h.jails.length+'j</span>'
          +(hPre>0?'<span style="font-size:var(--fs-3xs);color:rgba(245,158,11,.65);margin-left:.15rem">⚠'+hPre+'</span>':'')
          :'<span style="font-size:var(--fs-4xs);color:rgba(160,220,255,.25)">HORS LIGNE</span>')
        +'</div>'
        +'<div style="width:100%;height:'+(hBan>0?'6':'4')+'px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden">'
        +'<div style="width:'+(h.avail?pct:0)+'%;height:100%;background:'+hCol+';border-radius:2px'+(hBan>0?';animation:f2b-shimmer .75s linear infinite':'')+'"></div>'
        +'</div>'
        +'</div>';
    }).join('')
    +'<div style="height:1px;background:rgba(255,255,255,.06);margin:.08rem 0 .12rem"></div>'
    // Fill level segmenté par hôte
    +'<div style="display:flex;width:100%;height:9px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden;margin-bottom:.05rem">'
    +allHosts.filter(function(h){return h.avail&&h.jails.reduce(function(a,j){return a+(j.cur_banned||0);},0)>0;}).map(function(h){
      var hBan=h.jails.reduce(function(a,j){return a+(j.cur_banned||0);},0);
      var pct=Math.round(hBan*100/f2bTotalForFill);
      var hCol=F2B_HOST_COL[h.label]||'rgba(255,59,92,.6)';
      return '<div style="width:'+pct+'%;height:100%;background:'+hCol+';animation:f2b-shimmer .7s linear infinite"></div>';
    }).join('')
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-4xs);color:rgba(160,220,255,.25);margin-bottom:.06rem"><span>FILL LEVEL</span><span>'+totalBanned+' bans</span></div>'
    +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3)">'+activeJails+' active'+(activeJails>1?'s':'')+' · '+totalJails+' total</div>'
    +'</div>';

  // ── ACTIONS — ban count + bantimes + chaîne d'enforcement ────────────────
  var f2bBanCol=totalBanned>0?'#ff3b5c':'#00ff88';
  var f2bActBtimes=(function(){
    var btimes=[];
    allHosts.forEach(function(h){if(!h.avail)return;h.jails.forEach(function(j){if(j.bantime&&btimes.indexOf(j.bantime)===-1)btimes.push(j.bantime);});});
    return btimes;
  })();
  var f2bActionsHtml='<div class="f2b-node" style="border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.04);color:rgba(0,255,136,.9);min-width:122px'+(totalBanned>0?';animation:f2b-glow-b 2s ease-in-out infinite':'')+'\">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">⊛</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">ACTIONS</div>'
    +'<div style="height:1px;background:rgba(0,255,136,.12);width:100%;margin-bottom:.15rem"></div>'
    +'<div style="font-size:var(--fs-3xl);font-weight:800;font-family:\'Courier New\';color:'+f2bBanCol+';line-height:1;text-shadow:0 0 12px '+f2bBanCol+'55">'+totalBanned+'</div>'
    +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4);margin-top:.06rem;margin-bottom:.15rem">IPs bannies</div>'
    // Type pills
    +'<div style="display:flex;gap:.12rem;justify-content:center;flex-wrap:wrap;margin-bottom:.15rem">'
    +['iptables','ufw','nftables'].map(function(t){return '<div style="font-size:var(--fs-4xs);padding:.03rem .14rem;background:rgba(0,255,136,.07);border:1px solid rgba(0,255,136,.2);border-radius:2px;color:rgba(0,255,136,.55)">'+t+'</div>';}).join('')
    +'</div>'
    // Per-host ban bars
    +allHosts.filter(function(h){return h.avail;}).map(function(h){
      var hBan=h.jails.reduce(function(a,j){return a+(j.cur_banned||0);},0);
      var pct=Math.round(hBan*100/f2bMaxBan);
      var hCol=F2B_HOST_COL[h.label]||'rgba(0,255,136,.5)';
      return '<div style="display:flex;align-items:center;gap:.2rem;margin-bottom:.1rem">'
        +'<span style="font-size:var(--fs-3xs);color:'+hCol+';min-width:44px;font-family:\'Courier New\'">'+h.label+'</span>'
        +'<div style="flex:1;height:4px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;background:'+(hBan>0?'#ff3b5c':'rgba(0,255,136,.3)')+';border-radius:2px'+(hBan>0?';animation:f2b-shimmer .65s linear infinite':'')+'"></div>'
        +'</div>'
        +'<span style="font-size:var(--fs-3xs);color:'+(hBan>0?'#ff3b5c':'rgba(160,220,255,.25)')+';min-width:14px;text-align:right;font-family:\'Courier New\';font-weight:'+(hBan>0?'700':'400')+'">'+hBan+'</span>'
        +'</div>';
    }).join('')
    +'<div style="height:1px;background:rgba(255,255,255,.06);margin:.1rem 0 .1rem"></div>'
    +f2bActBtimes.slice(0,2).map(function(bt){
      return '<div style="display:flex;align-items:center;gap:.18rem;font-size:var(--fs-3xs);color:var(--c-label);padding:.03rem 0;text-align:left;width:100%">'
        +'<span style="color:rgba(0,255,136,.4)">⊘</span> '+_f2bFmtBantime(bt)+'</div>';
    }).join('')
    +'<div style="font-size:var(--fs-4xs);color:rgba(160,220,255,.2);margin-top:.08rem">enforcement chain active</div>'
    +'</div>';

  var f2bWireSz='width:38px;flex-shrink:0;align-self:center';
  var f2bMoteurPanel=f2bCircuitCss
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.8rem">Pipeline de protection par regex — Fail2ban · '+allHosts.filter(function(h){return h.avail;}).length+' hôtes actifs · '+totalJails+' jails</div>'
    +'<div style="display:flex;align-items:center;justify-content:center;gap:.3rem;padding:.8rem;background:rgba(0,0,0,.3);border:1px solid rgba(255,107,53,.07);border-radius:6px;overflow-x:auto;margin-bottom:1rem">'
    +f2bLogsHtml
    +'<div style="'+f2bWireSz+'"><div class="f2b-wire"></div></div>'
    +f2bFiltersHtml
    +'<div style="'+f2bWireSz+'"><div class="'+(totalFailed>100?'f2b-wire f2b-wire-fat':'f2b-wire')+'"></div></div>'
    +f2bJailsEngHtml
    +'<div style="'+f2bWireSz+'"><div class="'+(totalBanned>0?'f2b-wire f2b-wire-enforce':'f2b-wire')+'"></div></div>'
    +f2bActionsHtml
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;margin-bottom:.9rem">'
    +[
      {l:'IPs bannies',v:totalBanned,c:totalBanned>0?'#ff3b5c':'#00ff88'},
      {l:'Jails actives',v:activeJails+' / '+totalJails,c:activeJails>0?'var(--red)':'var(--c-muted-4)'},
      {l:'Pré-ban',v:prebanJails||0,c:prebanJails>0?'var(--amber)':'var(--c-muted-4)'},
      {l:'Échecs cumulés',v:fmt(totalFailed),c:totalFailed>0?'var(--yellow)':'var(--c-muted-4)'},
      {l:'Hôtes actifs',v:allHosts.filter(function(h){return h.avail;}).length+' / '+allHosts.length,c:'rgba(160,220,255,.6)'}
    ].map(function(k){
      return '<div style="padding:.45rem .6rem;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06);border-radius:4px">'
        +'<div style="font-size:var(--fs-md);font-weight:700;font-family:\'Courier New\',monospace;color:'+k.c+';line-height:1">'+k.v+'</div>'
        +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3);margin-top:.2rem;text-transform:uppercase;letter-spacing:.35px">'+k.l+'</div>'
        +'</div>';
    }).join('')
    +'</div>'
    +(function(){
      var flat=[];
      allHosts.forEach(function(h){
        if(!h.avail)return;
        h.jails.forEach(function(j){flat.push({host:h.label,j:j});});
      });
      flat.sort(function(a,b){
        var as=a.j.cur_banned>0?2:a.j.cur_failed>0?1:0;
        var bs=b.j.cur_banned>0?2:b.j.cur_failed>0?1:0;
        return bs!==as?bs-as:(b.j.cur_banned||0)-(a.j.cur_banned||0);
      });
      if(!flat.length)return '';
      var maxBan=Math.max.apply(null,flat.map(function(e){return e.j.cur_banned||0;}).concat([1]));
      var HOST_COL={'SRV-NGIX':'rgba(0,217,255,.55)','PROXMOX':'rgba(255,215,0,.5)','CLT':'rgba(160,220,255,.45)','PA85':'rgba(200,180,255,.45)'};
      return '<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem">Jails — statut live · '+flat.length+' jails · '+allHosts.filter(function(h){return h.avail;}).length+' hôtes</div>'
        +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.4rem">'
        +flat.map(function(e){
          var j=e.j;
          var isBan=j.cur_banned>0, isPre=j.cur_failed>0&&!isBan;
          var jCol=isBan?'#ff3b5c':isPre?'#f59e0b':'rgba(0,255,136,.6)';
          var bg=isBan?'rgba(255,59,92,.06)':isPre?'rgba(245,158,11,.05)':'rgba(0,0,0,.18)';
          var bleft=isBan?'3px solid rgba(255,59,92,.55)':isPre?'3px solid rgba(245,158,11,.45)':'3px solid rgba(0,255,136,.2)';
          var pct=Math.round((j.cur_banned||0)*100/maxBan);
          var jShort=(j.jail||'').replace(/^apache-/,'ap-').replace(/^nginx-/,'ng-');
          var statusLbl=isBan?'BANNI':isPre?'PRÉ-BAN':'CLEAN';
          var ipsHtml=(j.banned_ips&&j.banned_ips.length)
            ?'<div style="display:flex;flex-wrap:wrap;gap:.15rem;margin-top:.2rem">'
            +j.banned_ips.slice(0,3).map(function(o){
              var ip=typeof o==='object'?o.ip:o;
              var fl=_f2bFlag(typeof o==='object'?o.country:'-');
              return '<span style="font-size:var(--fs-3xs);padding:.03rem .2rem;background:rgba(255,59,92,.1);border:1px solid rgba(255,59,92,.2);border-radius:2px;color:rgba(255,130,130,.85);font-family:monospace">'+(fl?fl+' ':'')+esc(ip)+'</span>';
            }).join('')+(j.banned_ips.length>3?'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3);padding:.03rem .1rem">+'+( j.banned_ips.length-3)+'</span>':'')
            +'</div>':'';
          return '<div style="padding:.35rem .5rem;background:'+bg+';border:1px solid rgba(255,255,255,.05);border-left:'+bleft+';border-radius:2px">'
            +'<div style="display:flex;align-items:center;gap:.3rem;margin-bottom:.15rem">'
            +'<span style="font-size:var(--fs-3xs);color:'+(HOST_COL[e.host]||'var(--c-label)')+';font-family:\'Courier New\';font-weight:700;flex-shrink:0">'+e.host+'</span>'
            +'<span style="font-size:var(--fs-xs);color:rgba(180,210,240,.75);font-family:\'Courier New\';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+esc(jShort)+'</span>'
            +'<span style="font-size:var(--fs-3xs);color:'+jCol+';font-family:\'Courier New\';font-weight:700;flex-shrink:0'+(isBan?';animation:f2b-pulse 1.2s infinite':'')+'">'+statusLbl+'</span>'
            +'</div>'
            +((isBan||isPre)?'<div style="height:4px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden;margin-bottom:.15rem">'
            +'<div class="'+(isBan?'f2b-bar-ban':isPre?'f2b-bar-pre':'')+'" style="width:'+pct+'%;height:100%;border-radius:2px"></div>'
            +'</div>':'')
            +'<div style="display:flex;gap:.4rem;font-size:var(--fs-3xs);font-family:\'Courier New\';align-items:center">'
            +'<span style="color:'+jCol+';font-weight:'+(isBan?'700':'400')+'">'+(j.cur_banned||0)+' ban</span>'
            +'<span style="color:rgba(122,154,184,.28)">Σ'+(j.tot_banned||0)+'</span>'
            +(isPre?'<span style="color:#f59e0b">'+j.cur_failed+' fail</span>':'')
            +(j.bantime?'<span style="color:rgba(122,154,184,.25);margin-left:auto">'+_f2bFmtBantime(j.bantime)+'</span>':'')
            +'</div>'
            +ipsHtml
            +'</div>';
        }).join('')
        +'</div>';
    })();

  // ── Assembly avec tabs ────────────────────────────────────────────────────
  var _f2bTbs='display:inline-flex;align-items:center;gap:.3rem;padding:.28rem .8rem;font-size:var(--fs-2xs);font-family:\'Courier New\',monospace;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:none;border-bottom:2px solid transparent;background:transparent;transition:all .15s;line-height:1;';
  var h='<div id="f2b-tabs" style="display:flex;align-items:flex-end;gap:0;border-bottom:1px solid rgba(255,107,53,.12);margin-bottom:1rem">'
    +'<button data-f2btab="jails" style="'+_f2bTbs+'color:var(--orange);border-bottom:2px solid var(--orange)">⊘ Jails'+(totalBanned>0?' <span style="color:var(--red)">'+totalBanned+'</span>':'')+'</button>'
    +'<button data-f2btab="moteur" style="'+_f2bTbs+'color:var(--c-label)">⚙ Moteur</button>'
    +'</div>'
    +'<div id="f2b-panel-jails">'+f2bJailsPanel+'</div>'
    +'<div id="f2b-panel-moteur" style="display:none">'+f2bMoteurPanel+'</div>';

  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-wide');
  mc.style.height='auto';
  mc.style.maxHeight='90vh';
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">⊘</span>FAIL2BAN — ÉTAT DÉTAILLÉ · 4 HÔTES';
  var mb=document.getElementById('modal-body');
  mb.innerHTML=h;

  mb.querySelectorAll('[data-f2btab]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var name=this.getAttribute('data-f2btab');
      mb.querySelectorAll('[data-f2btab]').forEach(function(b){
        var active=b.getAttribute('data-f2btab')===name;
        b.style.color=active?'var(--orange)':'var(--c-label)';
        b.style.borderBottom=active?'2px solid var(--orange)':'2px solid transparent';
      });
      ['jails','moteur'].forEach(function(t){
        var p=document.getElementById('f2b-panel-'+t);
        if(p)p.style.display=t===name?'':'none';
      });
    });
  });

  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
}

// ── openCsModal — NDT-54 refonte v3 épurée ───────────────────────────────

function openCsModal(cs){
  if(!cs||_isOpen)return;
  var csD=cs.active_decisions||0, csA=cs.alerts_24h||0;
  var csStages=cs.stage_counts||{}, csSc=cs.scenarios||[], csIps=cs.top_ips||[];
  var csPsr=cs.parser_stats||{};
  var csBouncers=cs.bouncers||[], csBV=cs.ban_velocity||{}, csBStats=cs.bouncer_stats||{}, csAppsec=cs.appsec||{};
  var csTrend=cs.alerts_trend||{};
  var decList=cs.decisions_list||[];
  var STAGE_COL={'RECON':'var(--cyan)','SCAN':'var(--yellow)','EXPLOIT':'var(--orange)','BRUTE':'var(--red)'};
  var ORIG_COL={'cscli':'var(--amber)','crowdsec':'var(--cyan)','console':'var(--purple)'};
  var tDir=csTrend.dir||'stable', tPct=csTrend.pct||0;
  var tCol=tDir==='up'?'var(--red)':tDir==='down'?'var(--green)':'rgba(122,154,184,.5)';
  var tArrow=tDir==='up'?'↑':tDir==='down'?'↓':'→';
  var totalStages=(csStages.RECON||0)+(csStages.SCAN||0)+(csStages.EXPLOIT||0)+(csStages.BRUTE||0);
  var hasExploit=(csStages.EXPLOIT||0)>0, hasBrute=(csStages.BRUTE||0)>0;

  // ── Bannière alerte ──────────────────────────────────────────────────────
  var alertBannerHtml='';
  if(hasExploit||hasBrute){
    var _aS=hasExploit?'EXPLOIT':'BRUTE', _aC=csStages[_aS];
    var _aCl=hasExploit?'var(--orange)':'var(--red)';
    alertBannerHtml='<div style="display:flex;align-items:center;gap:.6rem;padding:.35rem .9rem;border-left:3px solid '+_aCl+';background:rgba(255,107,53,.07);border-radius:0 4px 4px 0;margin-bottom:1.2rem;animation:blink 1.5s ease-in-out infinite">'
      +'<span style="color:'+_aCl+';font-size:var(--fs-md)">⚠</span>'
      +'<span style="font-size:var(--fs-2xs);color:'+_aCl+';font-weight:700;letter-spacing:.9px;text-transform:uppercase">'+_aS+' ACTIF — '+_aC+' scénario'+((_aC>1)?'s':'')+' détecté'+((_aC>1)?'s':'')+' par CrowdSec</span>'
      +'</div>';
  }

  // ── KPI grid ─────────────────────────────────────────────────────────────
  var csCol=csD>0?'var(--red)':'var(--green)';
  var trendSub=csTrend.prev_24h!==undefined?(tArrow+(tPct>0?'+':'')+tPct+'% vs J-1'):'';
  var kpiCells=[
    {v:csD,   l:'Décisions',  sub:'actives',          c:csCol},
    {v:csA,   l:'Alertes',    sub:'24h'+(trendSub?' · <span style="color:'+tCol+'">'+trendSub+'</span>':''), c:'var(--amber)'},
    {v:csBV.last_1h!==undefined?csBV.last_1h:'—', l:'Bans', sub:'par heure'+(csBV.spike?' ⚠ pic':''), c:csBV.spike?'var(--red)':'var(--green)'},
    {v:csBStats.dropped_bytes?fmtBytesCs(csBStats.dropped_bytes):'—', l:'Bloqué', sub:csBStats.dropped_packets?fmt(csBStats.dropped_packets)+' paquets':'trafic', c:'var(--cyan)'},
    {v:csPsr.lines_read!==undefined?fmt(csPsr.lines_read):'—', l:'Lignes', sub:'analysées', c:'rgba(122,154,184,.55)'}
  ];
  var kpiHtml='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0;border:1px solid rgba(255,255,255,.07);border-radius:6px;overflow:hidden;margin-bottom:1.2rem">'
    +kpiCells.map(function(k,i){
      var bl=i>0?'border-left:1px solid rgba(255,255,255,.07);':'';
      return '<div style="padding:.65rem .8rem;background:rgba(0,0,0,.25);'+bl+'">'
        +'<div style="font-size:var(--fs-3xl);font-weight:800;font-family:\'Courier New\',monospace;color:'+k.c+';line-height:1;text-shadow:0 0 10px '+k.c+'44">'+k.v+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:rgba(160,220,255,.5);text-transform:uppercase;letter-spacing:.6px;margin-top:.2rem">'+k.l+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:rgba(160,220,255,.3)">'+k.sub+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  // ── Kill Chain — 4 colonnes + Bouncers inline ────────────────────────────
  var STAGE_DEF=[
    {ico:'◎',k:'RECON', c:'var(--cyan)'},
    {ico:'◈',k:'SCAN',  c:'var(--yellow)'},
    {ico:'◉',k:'EXPLOIT',c:'var(--orange)'},
    {ico:'⊗',k:'BRUTE', c:'var(--red)'}
  ];
  var kcHtml='<div style="margin-bottom:1.2rem">'
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.55rem">Kill Chain — scénarios 24h</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid rgba(255,255,255,.07);border-radius:6px;overflow:hidden">'
    +STAGE_DEF.map(function(s,i){
      var cnt=csStages[s.k]||0, active=cnt>0;
      var pct=totalStages>0?Math.round(cnt*100/totalStages):0;
      var bl=i>0?'border-left:1px solid rgba(255,255,255,.07);':'';
      return '<div style="padding:.55rem .5rem;background:'+(active?'rgba(0,0,0,.3)':'rgba(0,0,0,.18)')+';'+bl+'text-align:center;position:relative;overflow:hidden">'
        +(active?'<div style="position:absolute;bottom:0;left:0;height:2px;width:'+pct+'%;background:'+s.c+'"></div>':'')
        +'<div style="font-size:var(--fs-md);color:'+(active?s.c:'rgba(160,220,255,.2)')+'">'+s.ico+'</div>'
        +'<div style="font-size:var(--fs-2xl);font-weight:800;font-family:\'Courier New\',monospace;color:'+(active?s.c:'rgba(160,220,255,.15)')+'">'+cnt+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.5px;margin-top:.1rem">'+s.k+'</div>'
        +'</div>';
    }).join('')
    +'</div></div>';

  // ── Bouncers ─────────────────────────────────────────────────────────────
  var bouncersHtml=csBouncers.length?'<div style="margin-bottom:1.2rem">'
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem">Bouncers</div>'
    +csBouncers.map(function(b){
      var bN=b.name||'';
      var isAppsec=bN.indexOf('appsec')!==-1;
      var bOk=isAppsec?csAppsec.active:b.healthy;
      var bCol=bOk?'var(--green)':'var(--red)';
      var bShort=bN.replace('crowdsec-firewall-bouncer-','').replace('crowdsec-','').replace('-bouncer','');
      var bSub=isAppsec?(bOk?'WAF actif · '+(csAppsec.processed||0)+' req':'WAF inactif'):(b.age_sec!=null?(b.age_sec<60?b.age_sec+'s ago':Math.floor(b.age_sec/60)+'m ago'):'—');
      return '<div style="display:flex;align-items:center;gap:.6rem;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<span style="color:'+bCol+';font-size:var(--fs-xs)">●</span>'
        +'<span style="flex:1;font-size:var(--fs-xs);color:var(--text);font-family:\'Courier New\',monospace">'+esc(bShort)+'</span>'
        +'<span style="font-size:var(--fs-2xs);color:var(--c-label)">'+esc(bSub)+'</span>'
        +'</div>';
    }).join('')
    +'</div>':'';

  // ── Top scénarios ────────────────────────────────────────────────────────
  var scMax=csSc[0]?csSc[0].count||1:1;
  var scenariosHtml=csSc.length?'<div style="margin-bottom:1.2rem">'
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem">Top scénarios détectés</div>'
    +csSc.slice(0,8).map(function(sc){
      var sc_col=STAGE_COL[sc.stage]||'var(--cyan)', pct=Math.round(sc.count*100/scMax);
      return '<div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:.5rem;padding:.28rem 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<div style="min-width:0">'
        +'<div style="font-size:var(--fs-xs);color:rgba(180,210,240,.8);font-family:\'Courier New\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:.12rem">'+esc(sc.name)+'</div>'
        +'<div style="height:2px;background:rgba(255,255,255,.05);border-radius:1px"><div style="width:'+pct+'%;height:2px;background:'+sc_col+';border-radius:1px"></div></div>'
        +'</div>'
        +'<span style="font-size:var(--fs-2xs);color:'+sc_col+';letter-spacing:.5px;text-transform:uppercase;font-family:\'Courier New\',monospace">'+esc(sc.stage)+'</span>'
        +'<span style="font-size:var(--fs-2xs);color:rgba(160,220,255,.45);text-align:right;min-width:1.5rem">'+sc.count+'</span>'
        +'</div>';
    }).join('')+'</div>':'';

  // ── IPs bannies ──────────────────────────────────────────────────────────
  var ipsBanniesHtml=csIps.length?'<div>'
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem">IPs bannies (top '+csIps.length+')</div>'
    +csIps.map(function(e){
      var st_col=STAGE_COL[e.stage]||'var(--orange)';
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.28rem 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        +'<span style="font-size:var(--fs-xs);color:rgba(255,107,107,.85);font-family:\'Courier New\',monospace;min-width:9rem">'+esc(e.ip)+'</span>'
        +(e.country&&e.country!=='-'?'<span style="font-size:var(--fs-2xs);color:var(--c-label);min-width:2rem">'+esc(e.country)+'</span>':'<span style="min-width:2rem"></span>')
        +'<span style="font-size:var(--fs-2xs);color:'+st_col+';letter-spacing:.5px;text-transform:uppercase;font-family:\'Courier New\',monospace">'+esc(e.stage)+'</span>'
        +(e.as_name?'<span style="font-size:var(--fs-2xs);color:rgba(160,220,255,.3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:.4rem">'+esc(e.as_name.slice(0,30))+'</span>':'<span style="flex:1"></span>')
        +(e.duration?'<span style="font-size:var(--fs-2xs);color:var(--green);font-family:\'Courier New\',monospace;white-space:nowrap">'+esc(e.duration)+'</span>':'')
        +'</div>';
    }).join('')+'</div>':'';

  var emptyHtml=(!csSc.length&&!csIps.length)?'<div style="color:var(--green);font-size:var(--fs-xs);font-family:\'Courier New\',monospace;padding:.5rem 0">✓ Surveillance active — aucune menace en cours</div>':'';

  // ── GEO PÉRIMÈTRE — scénario geo-block-aggressive ─────────────────────────
  var _GEO_M=['RU','CN','KP','IR'], _GEO_NAMES={RU:'Russie',CN:'Chine',KP:'Corée du Nord',IR:'Iran'};
  var _geoCntsM={RU:0,CN:0,KP:0,IR:0}, _geoLastIp={};
  decList.forEach(function(r){
    if((r.scenario||'').indexOf('geo-block')!==-1){
      var c=r.country||'';
      if(_geoCntsM.hasOwnProperty(c)){_geoCntsM[c]++;if(!_geoLastIp[c])_geoLastIp[c]=r.ip||'';}
    }
  });
  var _geoTotalM=_GEO_M.reduce(function(s,c){return s+_geoCntsM[c];},0);
  var geoPerimetreHtml='<div style="margin-bottom:1.2rem">'
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.55rem">Blocage périmétrique GeoIP · '+_geoTotalM+' ban'+(_geoTotalM!==1?'s':'')+' actif'+(_geoTotalM!==1?'s':'')+' — RU · CN · KP · IR</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid rgba(255,255,255,.07);border-radius:6px;overflow:hidden">'
    +_GEO_M.map(function(c,i){
      var n=_geoCntsM[c]||0, active=n>0;
      var col=active?'rgba(255,107,53,.85)':'rgba(160,220,255,.2)';
      var bg=active?'rgba(255,107,53,.05)':'rgba(0,0,0,.18)';
      var bl=i>0?'border-left:1px solid rgba(255,255,255,.07);':'';
      return '<div style="padding:.55rem .5rem;background:'+bg+';'+bl+'text-align:center">'
        +'<div style="font-size:var(--fs-2xl);font-weight:800;font-family:\'Courier New\',monospace;color:'+col+';line-height:1">'+n+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:'+col+';font-weight:700;letter-spacing:.6px;margin-top:.12rem">'+c+'</div>'
        +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.25);margin-top:.1rem">'+_GEO_NAMES[c]+'</div>'
        +(_geoLastIp[c]?'<div style="font-size:var(--fs-3xs);color:rgba(255,107,107,.45);font-family:\'Courier New\',monospace;margin-top:.08rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(_geoLastIp[c])+'">'+esc(_geoLastIp[c])+'</div>':'')
        +'</div>';
    }).join('')
    +'</div>'
    +(_geoTotalM===0?'<div style="font-size:var(--fs-3xs);color:rgba(0,255,136,.4);margin-top:.35rem;font-family:\'Courier New\',monospace;text-align:center">✓ Périmètre actif · scénario <GITHUB-USER>/geo-block-aggressive · aucun ban en cours</div>':'')
    +'</div>';

  // ── Tableau décisions ────────────────────────────────────────────────────
  var thS='padding:.3rem .55rem;font-size:var(--fs-2xs);color:rgba(122,154,184,.45);text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid rgba(255,255,255,.07);white-space:nowrap;font-weight:500;text-align:left;background:rgba(0,0,0,.25);';
  var tdS='padding:.24rem .55rem;font-size:var(--fs-xs);border-bottom:1px solid rgba(255,255,255,.035);vertical-align:middle;';
  var tableHtml=decList.length
    ?'<div style="overflow-x:auto;overflow-y:auto;max-height:60vh;border:1px solid rgba(255,255,255,.07);border-radius:6px">'
      +'<table style="width:100%;border-collapse:collapse;font-family:\'Courier New\',monospace">'
      +'<thead><tr><th style="'+thS+'">ID</th><th style="'+thS+'">Source</th><th style="'+thS+'">IP</th>'
      +'<th style="'+thS+'">Scénario</th><th style="'+thS+'">Stage</th><th style="'+thS+'">Pays</th>'
      +'<th style="'+thS+'">AS</th><th style="'+thS+'text-align:right">Events</th>'
      +'<th style="'+thS+'">Expiration</th><th style="'+thS+'">Alert</th></tr></thead><tbody>'
      +decList.map(function(r,i){
        var sc=STAGE_COL[r.stage]||'rgba(160,220,255,.5)';
        var oc=ORIG_COL[r.origin]||'rgba(122,154,184,.5)';
        var bg=i%2===0?'rgba(255,255,255,.01)':'transparent';
        return '<tr style="background:'+bg+'">'
          +'<td style="'+tdS+'color:rgba(122,154,184,.35)">'+esc(String(r.id||''))+'</td>'
          +'<td style="'+tdS+'"><span style="color:'+oc+';font-size:var(--fs-2xs)">'+esc(r.origin||'')+'</span></td>'
          +'<td style="'+tdS+'color:rgba(255,107,107,.85);font-weight:600;white-space:nowrap">'+esc(r.ip||'')+'</td>'
          +'<td style="'+tdS+'color:rgba(180,210,240,.8);max-width:13rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.scenario||'')+'">'+esc(r.scenario||'')+'</td>'
          +'<td style="'+tdS+'"><span style="color:'+sc+';font-size:var(--fs-2xs);letter-spacing:.5px;text-transform:uppercase">'+esc(r.stage||'')+'</span></td>'
          +'<td style="'+tdS+'color:rgba(160,220,255,.4)">'+esc(r.country||'—')+'</td>'
          +'<td style="'+tdS+'color:var(--c-muted-4);max-width:9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.as_name||'')+'">'+esc(r.as_name||'')+'</td>'
          +'<td style="'+tdS+'color:rgba(160,220,255,.4);text-align:right">'+esc(String(r.events||1))+'</td>'
          +'<td style="'+tdS+'color:var(--green);white-space:nowrap">'+esc(r.duration||'')+'</td>'
          +'<td style="'+tdS+'color:rgba(122,154,184,.3)">'+esc(String(r.alert_id||''))+'</td>'
          +'</tr>';
      }).join('')+'</tbody></table></div>'
      +'<div style="font-size:var(--fs-2xs);color:rgba(160,220,255,.25);margin-top:.4rem;text-align:right">'+decList.length+' décisions actives · actualisé toutes les 5 min</div>'
    :'<div style="color:var(--green);font-size:var(--fs-xs);font-family:\'Courier New\',monospace;padding:1.5rem;text-align:center">✓ Aucune décision active</div>';

  // ── Moteur — pipeline CrowdSec animé (enrichi) ──────────────────────────
  var csCircuitCss='<style>'
    +'@keyframes cs-flow{from{background-position:0 0}to{background-position:24px 0}}'
    +'@keyframes cs-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}'
    +'@keyframes cs-pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.45)}}'
    +'@keyframes cs-glow-c{0%,100%{box-shadow:none}50%{box-shadow:0 0 9px rgba(0,217,255,.45)}}'
    +'@keyframes cs-glow-t{0%,100%{box-shadow:none}50%{box-shadow:0 0 11px rgba(255,107,53,.55)}}'
    +'.cs-wire{height:3px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(0,217,255,0) 0,rgba(0,217,255,0) 5px,rgba(0,217,255,.65) 5px,rgba(0,217,255,.65) 9px,'
    +'rgba(0,217,255,0) 9px,rgba(0,217,255,0) 24px);background-size:24px 100%;'
    +'animation:cs-flow .6s linear infinite}'
    +'.cs-wire-threat{background:repeating-linear-gradient(90deg,'
    +'rgba(255,107,53,0) 0,rgba(255,107,53,0) 5px,rgba(255,107,53,.85) 5px,rgba(255,107,53,.85) 9px,'
    +'rgba(255,107,53,0) 9px,rgba(255,107,53,0) 24px);background-size:24px 100%;'
    +'animation:cs-flow .28s linear infinite}'
    +'.cs-node{border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;'
    +'font:700 9px "Courier New",monospace;letter-spacing:.06em;padding:.38rem .55rem;border:1px solid;text-align:center}'
    +'.cs-dot-on{animation:cs-pulse .9s ease-in-out infinite}'
    +'.cs-wire-fat{height:4px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(0,217,255,0) 0,rgba(0,217,255,0) 4px,rgba(0,217,255,.75) 4px,rgba(0,217,255,.75) 8px,'
    +'rgba(0,217,255,0) 8px,rgba(0,217,255,0) 20px);background-size:20px 100%;animation:cs-flow .45s linear infinite}'
    +'.cs-wire-enforce{height:3px;border-radius:2px;background:repeating-linear-gradient(90deg,'
    +'rgba(0,255,136,0) 0,rgba(0,255,136,0) 4px,rgba(0,255,136,.85) 4px,rgba(0,255,136,.85) 8px,'
    +'rgba(0,255,136,0) 8px,rgba(0,255,136,0) 20px);background-size:20px 100%;animation:cs-flow .35s linear infinite}'
    +'</style>';

  // ── LOG SOURCES — sources actives + chemins ──────────────────────────────
  var CS_LOG_PATHS={'nginx':'/nginx/access.log','sshd':'auth · journald','auth':'auth.log','apache':'/apache2/access'};
  var CS_LOG_SRCS=['nginx','sshd','auth','apache'];
  var csActiveSrcCount=CS_LOG_SRCS.filter(function(s){
    return csSc.some(function(sc){return (sc.name||'').indexOf(s)!==-1;});
  }).length;
  var csSourceHtml='<div class="cs-node" style="border-color:rgba(0,217,255,.3);background:rgba(0,217,255,.05);color:rgba(0,217,255,.85);min-width:108px'+(csActiveSrcCount>0?';animation:cs-glow-c 2.2s ease-in-out infinite':'')+'\">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">◎</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">LOG SOURCES</div>'
    +'<div style="height:1px;background:rgba(0,217,255,.12);width:100%;margin-bottom:.2rem"></div>'
    +CS_LOG_SRCS.map(function(s){
      var active=csSc.some(function(sc){return (sc.name||'').indexOf(s)!==-1;});
      return '<div style="display:flex;align-items:flex-start;gap:.2rem;margin-bottom:.18rem;width:100%;text-align:left">'
        +'<span class="'+(active?'cs-dot-on':'')+'" style="font-size:var(--fs-3xs);color:'+(active?'rgba(0,255,136,.85)':'rgba(160,220,255,.15)')+';margin-top:.05rem;flex-shrink:0">●</span>'
        +'<div>'
        +'<div style="font-size:var(--fs-3xs);color:'+(active?'rgba(0,217,255,.95)':'rgba(160,220,255,.2)')+';font-weight:'+(active?'700':'400')+'">'+s+'</div>'
        +'<div style="font-size:var(--fs-4xs);color:rgba(160,220,255,.18);font-family:\'Courier New\';margin-top:.02rem">'+CS_LOG_PATHS[s]+'</div>'
        +'</div>'
        +(active?'<span style="margin-left:auto;font-size:var(--fs-4xs);padding:.02rem .1rem;background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:2px;color:rgba(0,255,136,.55);flex-shrink:0;align-self:center">LIVE</span>':'')
        +'</div>';
    }).join('')
    +'<div style="height:1px;background:rgba(0,217,255,.1);width:100%;margin:.1rem 0 .15rem"></div>'
    +'<div style="display:flex;justify-content:space-between;width:100%;align-items:center">'
    +'<span style="font-size:var(--fs-3xs);color:rgba(0,255,136,.6);font-weight:700">'+csActiveSrcCount+'/'+CS_LOG_SRCS.length+' actifs</span>'
    +((csPsr.lines_read||0)>0?'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3)">'+fmt(csPsr.lines_read||0)+' lignes</span>':'')
    +'</div>'
    +'</div>';

  // ── PARSERS — sous-pipeline GROK→GEOIP→ENRICH + efficacité ──────────────
  var csRead=csPsr.lines_read||0, csParsed=csPsr.lines_parsed||0, csInvalid=csPsr.lines_invalid||0;
  var csUnparsed=csPsr.lines_unparsed||0;
  var csParseEff=csRead>0&&csParsed>0?Math.round(csParsed*100/csRead):0;
  var csParserHtml='<div class="cs-node" style="border-color:rgba(0,217,255,.35);background:rgba(0,217,255,.06);color:rgba(0,217,255,.9);min-width:108px">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">⊛</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">PARSERS</div>'
    +'<div style="height:1px;background:rgba(0,217,255,.12);width:100%;margin-bottom:.18rem"></div>'
    +(csRead>0
      ?'<div style="font-size:var(--fs-2xl);font-weight:800;font-family:\'Courier New\';color:rgba(0,217,255,.95);line-height:1">'+fmt(csRead)+'</div>'
      +'<div style="font-size:var(--fs-3xs);color:var(--c-label);margin-top:.04rem;margin-bottom:.18rem">lignes lues</div>'
      +'<div style="display:flex;align-items:center;gap:.1rem;justify-content:center;margin-bottom:.15rem">'
      +'<div style="font-size:var(--fs-4xs);padding:.03rem .15rem;background:rgba(0,217,255,.1);border:1px solid rgba(0,217,255,.22);border-radius:2px;color:rgba(0,217,255,.6)">GROK</div>'
      +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.2)">→</span>'
      +'<div style="font-size:var(--fs-4xs);padding:.03rem .15rem;background:rgba(0,217,255,.1);border:1px solid rgba(0,217,255,.22);border-radius:2px;color:rgba(0,217,255,.6)">GEOIP</div>'
      +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.2)">→</span>'
      +'<div style="font-size:var(--fs-4xs);padding:.03rem .15rem;background:rgba(0,217,255,.1);border:1px solid rgba(0,217,255,.22);border-radius:2px;color:rgba(0,217,255,.6)">ENRICH</div>'
      +'</div>'
      +(csParseEff>0
        ?'<div style="width:100%;height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-bottom:.06rem">'
        +'<div style="width:'+csParseEff+'%;height:100%;background:linear-gradient(90deg,rgba(0,217,255,.55),rgba(0,255,136,.75));border-radius:3px;animation:cs-shimmer 1.2s linear infinite;background-size:200% 100%"></div>'
        +'</div>'
        +'<div style="display:flex;justify-content:space-between;width:100%;margin-bottom:.08rem">'
        +'<span style="font-size:var(--fs-3xs);color:rgba(0,255,136,.6);font-weight:700">'+csParseEff+'% parsées</span>'
        +(csUnparsed>0?'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3)">'+fmt(csUnparsed)+' skip</span>':'')
        +'</div>'
        :'')
      +(csInvalid>0?'<div style="font-size:var(--fs-3xs);color:rgba(245,158,11,.7);margin-top:.04rem">⚠ '+fmt(csInvalid)+' invalides</div>':'')
      :'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3);margin-top:.2rem">—</div>')
    +'</div>';

  // ── LEAKY BUCKET — fill level segmenté + leak rate + algo label ──────────
  var csTopSc=csSc.slice().sort(function(a,b){return (b.count||b.nb||0)-(a.count||a.nb||0);})[0];
  var csTopScName=csTopSc?(csTopSc.name||'').split('/').pop().replace(/-/g,' ').toUpperCase().slice(0,18):'';
  var csStageMax=Math.max(csStages.RECON||0,csStages.SCAN||0,csStages.EXPLOIT||0,csStages.BRUTE||0,1);
  var CS_SCOL2={'RECON':'#00d9ff','SCAN':'#ffd700','EXPLOIT':'#ff6b35','BRUTE':'#ff3b5c'};
  var csBucketThreat=(csStages.EXPLOIT||0)+(csStages.BRUTE||0)>0;
  var csTotalForFill=Math.max(totalStages,1);
  var csBucketFillBar='<div style="display:flex;width:100%;height:9px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden;margin-bottom:.04rem">'
    +['RECON','SCAN','EXPLOIT','BRUTE'].map(function(s){
      var cnt=csStages[s]||0, pct=Math.round(cnt*100/csTotalForFill), col=CS_SCOL2[s];
      var isThreat=s==='EXPLOIT'||s==='BRUTE';
      return cnt>0?'<div style="width:'+pct+'%;height:100%;background:'+col+';animation:cs-shimmer '+(isThreat?'.5':'1')+'s linear infinite;background-size:200% 100%"></div>':'';
    }).join('')
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-4xs);color:rgba(160,220,255,.25);margin-bottom:.12rem">'
    +'<span>FILL LEVEL</span><span>'+totalStages+' EVENTS</span></div>';
  var csLeakyHtml='<div class="cs-node" style="border-color:rgba(255,215,0,.3);background:rgba(255,215,0,.04);color:rgba(255,215,0,.9);min-width:148px'+(csBucketThreat?';animation:cs-glow-t 1.4s ease-in-out infinite':'')+'\">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">⊗</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">LEAKY BUCKET</div>'
    +'<div style="height:1px;background:rgba(255,215,0,.12);width:100%;margin-bottom:.18rem"></div>'
    +['RECON','SCAN','EXPLOIT','BRUTE'].map(function(s){
      var cnt=csStages[s]||0, pct=Math.round(cnt*100/csStageMax), col=CS_SCOL2[s];
      var isThreat=s==='EXPLOIT'||s==='BRUTE';
      return '<div style="display:flex;align-items:center;gap:.22rem;margin-bottom:.15rem">'
        +'<span style="font-size:var(--fs-3xs);color:'+col+';min-width:40px;font-family:\'Courier New\';text-align:left">'+(cnt>0&&isThreat?'▶ ':'')+s+'</span>'
        +'<div style="flex:1;height:'+(isThreat?'7':'5')+'px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden">'
        +'<div style="width:'+pct+'%;height:100%;background:'+col+';border-radius:2px'+(cnt>0?';animation:cs-shimmer '+(isThreat?'.5':'.85')+'s linear infinite':'')+'"></div>'
        +'</div>'
        +'<span style="font-size:'+(isThreat&&cnt>0?'var(--fs-2xs)':'var(--fs-3xs)')+';color:'+(cnt>0?col:'rgba(160,220,255,.18)')+';min-width:18px;text-align:right;font-family:\'Courier New\';font-weight:'+(cnt>0?'700':'400')+'">'+cnt+'</span>'
        +'</div>';
    }).join('')
    +'<div style="height:1px;background:rgba(255,255,255,.06);margin:.08rem 0 .15rem"></div>'
    +csBucketFillBar
    +'<div style="display:flex;justify-content:space-between;width:100%;align-items:center;margin-top:.05rem">'
    +'<span style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3)">'+totalStages+' scénario'+(totalStages!==1?'s':'')+' actifs</span>'
    +(csBV.last_1h!==undefined?'<span style="font-size:var(--fs-3xs);color:rgba(255,215,0,.55);font-weight:700">⮕ '+csBV.last_1h+'/h</span>':'')
    +'</div>'
    +(csTopScName?'<div style="font-size:var(--fs-3xs);color:rgba(255,215,0,.45);margin-top:.08rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;width:100%" title="'+esc(csTopSc?csTopSc.name||'':'')+'">↑ '+esc(csTopScName)+'</div>':'')
    +'<div style="font-size:var(--fs-4xs);color:rgba(160,220,255,.18);margin-top:.1rem;text-align:left;width:100%">algo: threshold-based · leaky-bucket</div>'
    +'</div>';

  // ── DECISIONS — types + origin bars + vélocité + expiry distribution ──────
  var csOrigCounts={};
  decList.forEach(function(d){var o=d.origin||'other';csOrigCounts[o]=(csOrigCounts[o]||0)+1;});
  var csDecTypes={};
  decList.forEach(function(d){
    var t=(d.type||'ban').indexOf('captcha')!==-1?'captcha':(d.type||'ban').indexOf('mfa')!==-1?'mfa':'ban';
    csDecTypes[t]=(csDecTypes[t]||0)+1;
  });
  var csOrigKeys=Object.keys(csOrigCounts);
  var csOrigMax=Math.max.apply(null,csOrigKeys.map(function(k){return csOrigCounts[k];}).concat([1]));
  var csDecCol2=csD>0?'#ff3b5c':'#00ff88';
  var csDecHtml='<div class="cs-node" style="border-color:'+csDecCol2+'44;background:rgba(0,0,0,.3);color:'+csDecCol2+';min-width:118px'+(csD>0?';animation:cs-glow-t 2s ease-in-out infinite':'')+'\">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">◈</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">DECISIONS</div>'
    +'<div style="height:1px;background:'+csDecCol2+'22;width:100%;margin-bottom:.15rem"></div>'
    +'<div style="font-size:var(--fs-3xl);font-weight:800;font-family:\'Courier New\';color:'+csDecCol2+';line-height:1;text-shadow:0 0 12px '+csDecCol2+'55">'+csD+'</div>'
    +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4);margin-top:.06rem">actives</div>'
    // Type breakdown — uniquement si captcha ou mfa présents
    +(Object.keys(csDecTypes).some(function(t){return t!=='ban';})?'<div style="display:flex;gap:.15rem;justify-content:center;margin:.12rem 0">'
      +Object.keys(csDecTypes).filter(function(t){return t!=='ban';}).map(function(t){
        var tCol=t==='captcha'?'rgba(245,158,11,.7)':'rgba(160,120,255,.7)';
        return '<div style="font-size:var(--fs-4xs);padding:.03rem .14rem;background:'+tCol.replace('.7','0.1')+';border:1px solid '+tCol.replace('.7','0.3')+';border-radius:2px;color:'+tCol+';font-weight:700">'+t+' '+csDecTypes[t]+'</div>';
      }).join('')
      +'</div>':'')
    +'<div style="height:1px;background:rgba(255,255,255,.06);margin:.1rem 0;width:100%"></div>'
    +'<div style="font-size:var(--fs-3xs);color:rgba(255,215,0,.75);margin-bottom:.05rem">'+csA+' alertes/24h</div>'
    // Vélocité ban avec mini-barre
    +(csBV.last_1h!==undefined?'<div style="width:100%;margin-bottom:.08rem">'
      +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-3xs);margin-bottom:.05rem">'
      +'<span style="color:var(--c-label)">ban/h</span>'
      +'<span style="color:'+(csBV.spike?'#ff3b5c':'rgba(160,220,255,.6)')+';font-weight:700">'+csBV.last_1h+(csBV.spike?' ⚠':'')+'</span>'
      +'</div>'
      +(csBV.last_1h>0?'<div style="width:100%;height:3px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden">'
        +'<div style="width:'+Math.min(csBV.last_1h*10,100)+'%;height:100%;background:'+(csBV.spike?'#ff3b5c':'rgba(255,107,53,.6)')+';border-radius:2px;animation:cs-shimmer .7s linear infinite;background-size:200% 100%"></div>'
        +'</div>':'')
      +'</div>':'')
    +(tPct>0?'<div style="font-size:var(--fs-3xs);color:'+tCol+';font-weight:700;margin-bottom:.06rem">'+tArrow+' '+tPct+'% vs J-1</div>':'')
    // Origin avec mini-barres
    +(csOrigKeys.length?'<div style="height:1px;background:rgba(255,255,255,.06);margin:.1rem 0;width:100%"></div>'
      +csOrigKeys.map(function(o){
        var oCol={'crowdsec':'rgba(0,217,255,.7)','cscli':'rgba(245,158,11,.75)','console':'rgba(160,120,255,.7)'}[o]||'rgba(160,220,255,.4)';
        var oPct=Math.round(csOrigCounts[o]*100/csOrigMax);
        return '<div style="margin-bottom:.1rem;width:100%">'
          +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-3xs);margin-bottom:.05rem">'
          +'<span style="color:'+oCol+'">'+o+'</span><span style="color:'+oCol+';font-weight:700">'+csOrigCounts[o]+'</span>'
          +'</div>'
          +'<div style="width:100%;height:3px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden">'
          +'<div style="width:'+oPct+'%;height:100%;background:'+oCol+';border-radius:2px"></div>'
          +'</div></div>';
      }).join(''):'')
    +'</div>';

  // ── BOUNCERS — métriques étendues par type + protection summary ───────────
  var csBouncerEngHtml='<div class="cs-node" style="border-color:rgba(0,255,136,.3);background:rgba(0,255,136,.04);color:rgba(0,255,136,.9);min-width:152px">'
    +'<div style="font-size:var(--fs-xs);margin-bottom:.12rem">⊘</div>'
    +'<div style="margin-bottom:.14rem;letter-spacing:1px">BOUNCERS</div>'
    +'<div style="height:1px;background:rgba(0,255,136,.12);width:100%;margin-bottom:.18rem"></div>'
    +(csBouncers.length?csBouncers.map(function(b){
      var bN=b.name||'', isAppsec=bN.indexOf('appsec')!==-1;
      var bOk=isAppsec?csAppsec.active:b.healthy;
      var bCol=bOk?'#00ff88':'#ff3b5c';
      var bShort=bN.replace('crowdsec-firewall-bouncer-','').replace('crowdsec-','').replace('-bouncer','');
      var apBl=csAppsec.blocked||0, apPr=csAppsec.processed||0;
      var wafEff=apPr>0?Math.round(apBl*100/apPr):0;
      var bAge=b.age_sec!=null?(b.age_sec<60?b.age_sec+'s ago':Math.floor(b.age_sec/60)+'m ago'):'';
      var bMetrics=isAppsec
        ?'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.06rem .3rem;margin-top:.1rem">'
          +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4)">mode</div><div style="font-size:var(--fs-3xs);color:rgba(255,107,53,.65);text-align:right">BLOCK</div>'
          +(apPr>0?'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4)">req</div><div style="font-size:var(--fs-3xs);color:rgba(0,217,255,.55);text-align:right">'+fmt(apPr)+'</div>':'')
          +(apBl>0?'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4)">bloquées</div><div style="font-size:var(--fs-3xs);color:rgba(255,59,92,.75);font-weight:700;text-align:right">'+fmt(apBl)+'</div>':'')
          +'</div>'
          +(apBl>0?'<div style="width:100%;height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;margin-top:.1rem">'
            +'<div style="width:'+wafEff+'%;height:100%;background:linear-gradient(90deg,rgba(255,107,53,.55),rgba(255,59,92,.85));border-radius:2px;animation:cs-shimmer .6s linear infinite;background-size:200% 100%"></div></div>'
            +'<div style="font-size:var(--fs-3xs);color:rgba(255,107,53,.55);text-align:right;margin-top:.05rem">WAF '+wafEff+'% bloqué</div>':'')
        :'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.06rem .3rem;margin-top:.1rem">'
          +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4)">mode</div><div style="font-size:var(--fs-3xs);color:rgba(0,255,136,.55);text-align:right">nftables</div>'
          +(csBStats.dropped_bytes>0?'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4)">bloqué</div><div style="font-size:var(--fs-3xs);color:rgba(0,217,255,.65);font-weight:700;text-align:right">'+fmtBytesCs(csBStats.dropped_bytes)+'</div>':'')
          +(csBStats.dropped_packets>0?'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.4)">paquets</div><div style="font-size:var(--fs-3xs);color:rgba(0,217,255,.5);text-align:right">'+fmt(csBStats.dropped_packets)+'</div>':'')
          +'</div>'
          +(csBStats.dropped_packets>0?'<div style="width:100%;height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;margin-top:.1rem">'
            +'<div style="width:'+Math.min(Math.round(csBStats.dropped_packets/100),100)+'%;height:100%;background:linear-gradient(90deg,rgba(0,217,255,.4),rgba(0,255,136,.6));border-radius:2px;animation:cs-shimmer .8s linear infinite;background-size:200% 100%"></div></div>':'');
      return '<div style="margin-bottom:.22rem;padding:.28rem .35rem;border-radius:3px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.05);border-left:2px solid '+bCol+'44;width:100%;text-align:left">'
        +'<div style="display:flex;align-items:center;gap:.25rem;margin-bottom:.05rem">'
        +'<span style="color:'+bCol+';font-size:var(--fs-2xs)'+(bOk?';animation:cs-pulse 1.6s ease-in-out infinite':'')+'">●</span>'
        +'<span style="font-size:var(--fs-3xs);color:rgba(180,220,255,.85);font-family:\'Courier New\';flex:1">'+esc(bShort)+'</span>'
        +'<span style="font-size:var(--fs-3xs);color:'+bCol+';font-family:\'Courier New\';font-weight:700">'+(bOk?'✓ ON':'✗ OFF')+'</span>'
        +'</div>'
        +(bAge?'<div style="font-size:var(--fs-4xs);color:rgba(160,220,255,.22);margin-bottom:.06rem">heartbeat '+bAge+'</div>':'')
        +bMetrics
        +'</div>';
    }).join('')
    // Protection summary footer
    +'<div style="height:1px;background:rgba(0,255,136,.1);width:100%;margin:.08rem 0 .12rem"></div>'
    +'<div style="font-size:var(--fs-3xs);color:rgba(0,255,136,.5);text-align:center;width:100%">'+(csBouncers.filter(function(b){return b.healthy||csAppsec.active;}).length)+'/'+csBouncers.length+' bouncer'+(csBouncers.length>1?'s':'')+' actifs</div>'
    :'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3)">Aucun bouncer</div>')
    +'</div>';

  var csWireSz='width:38px;flex-shrink:0;align-self:center';
  var csThreatWire=(csStages.EXPLOIT||0)+(csStages.BRUTE||0)>0;
  var csEnforceWire=csD>0;

  // ── KPI strip enrichi (5 colonnes) ───────────────────────────────────────
  var csKpiStrip='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;margin-bottom:.9rem">'
    +[
      {l:'Décisions actives',v:csD,c:csDecCol2},
      {l:'Alertes 24h',v:csA,c:'rgba(255,215,0,.8)'},
      {l:'Ban / heure',v:csBV.last_1h!==undefined?csBV.last_1h+(csBV.spike?' ⚠':''):'—',c:csBV.spike?'var(--red)':'rgba(160,220,255,.6)'},
      {l:'Trafic bloqué',v:csBStats.dropped_bytes?fmtBytesCs(csBStats.dropped_bytes):'✓ 0',c:csBStats.dropped_bytes?'var(--cyan)':'var(--green)'},
      {l:'WAF req / blq',v:csAppsec.processed>0?fmt(csAppsec.processed)+' / '+fmt(csAppsec.blocked||0):'—',c:'rgba(255,107,53,.8)'}
    ].map(function(k){
      return '<div style="padding:.45rem .6rem;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06);border-radius:4px">'
        +'<div style="font-size:var(--fs-md);font-weight:700;font-family:\'Courier New\',monospace;color:'+k.c+';line-height:1">'+k.v+'</div>'
        +'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.3);margin-top:.2rem;text-transform:uppercase;letter-spacing:.35px">'+k.l+'</div>'
        +'</div>';
    }).join('')
    +'</div>';

  // ── Top scénarios actifs ──────────────────────────────────────────────────
  var csTopScenariosHtml='';
  if(csSc.length>0){
    var csScSorted=csSc.slice().sort(function(a,b){return (b.count||b.nb||0)-(a.count||a.nb||0);});
    var csScMax=Math.max.apply(null,csScSorted.map(function(s){return s.count||s.nb||0;}).concat([1]));
    var CS_STCOL={'recon':'#00d9ff','scan':'#ffd700','exploit':'#ff6b35','brute':'#ff3b5c'};
    csTopScenariosHtml='<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.5rem">Scénarios actifs · '+csSc.length+' détectés</div>'
      +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.35rem">'
      +csScSorted.slice(0,8).map(function(sc){
        var cnt=sc.count||sc.nb||0;
        var stage=((sc.stage||sc.type||'').toLowerCase());
        var sCol=CS_STCOL[stage]||'rgba(160,220,255,.5)';
        var pct=Math.round(cnt*100/csScMax);
        var scShort=(sc.name||'').split('/').pop();
        var isThreat=stage==='exploit'||stage==='brute';
        return '<div style="padding:.3rem .45rem;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.04);border-left:2px solid '+sCol+'44;border-radius:2px'+(isThreat?';animation:cs-glow-t 2s ease-in-out infinite':'')+'\">'
          +'<div style="display:flex;align-items:center;gap:.28rem;margin-bottom:.12rem">'
          +'<span style="font-size:var(--fs-3xs);padding:.02rem .16rem;background:'+sCol+'1a;border:1px solid '+sCol+'30;border-radius:2px;color:'+sCol+';font-weight:700;flex-shrink:0;text-transform:uppercase;letter-spacing:.3px">'+stage+'</span>'
          +'<span style="font-size:var(--fs-3xs);color:rgba(180,210,240,.65);font-family:\'Courier New\';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1" title="'+esc(sc.name||'')+'">'+esc(scShort)+'</span>'
          +'<span style="font-size:var(--fs-3xs);color:'+sCol+';font-weight:700;font-family:\'Courier New\';flex-shrink:0">'+cnt+'</span>'
          +'</div>'
          +'<div style="height:3px;background:rgba(255,255,255,.04);border-radius:2px;overflow:hidden">'
          +'<div style="width:'+pct+'%;height:100%;background:'+sCol+';border-radius:2px;animation:cs-shimmer '+(isThreat?'.55':'1.1')+'s linear infinite;background-size:200% 100%"></div>'
          +'</div>'
          +'</div>';
      }).join('')
      +(csSc.length>8?'<div style="font-size:var(--fs-3xs);color:rgba(160,220,255,.25);padding:.2rem;text-align:center;grid-column:span 2">+ '+(csSc.length-8)+' scénario'+(csSc.length-8>1?'s':'')+'</div>':'')
      +'</div>';
  }

  var csMoteurPanel=csCircuitCss
    +'<div style="font-size:var(--fs-2xs);color:var(--c-label);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.8rem">Pipeline de détection comportementale — CrowdSec LAPI · '+csBouncers.length+' bouncer'+(csBouncers.length!==1?'s':'')+' actifs</div>'
    +'<div style="display:flex;align-items:center;justify-content:center;gap:.3rem;padding:.8rem;background:rgba(0,0,0,.3);border:1px solid rgba(0,217,255,.07);border-radius:6px;overflow-x:auto;margin-bottom:1rem">'
    +csSourceHtml
    +'<div style="'+csWireSz+'"><div class="cs-wire"></div></div>'
    +csParserHtml
    +'<div style="'+csWireSz+'"><div class="'+(csRead>50000?'cs-wire cs-wire-fat':'cs-wire')+'"></div></div>'
    +csLeakyHtml
    +'<div style="'+csWireSz+'"><div class="'+(csThreatWire?'cs-wire cs-wire-threat':'cs-wire')+'"></div></div>'
    +csDecHtml
    +'<div style="'+csWireSz+'"><div class="'+(csEnforceWire?'cs-wire cs-wire-enforce':'cs-wire')+'"></div></div>'
    +csBouncerEngHtml
    +'</div>'
    +csTopScenariosHtml;

  // ── Assembly ─────────────────────────────────────────────────────────────
  var _tbs='display:inline-flex;align-items:center;gap:.3rem;padding:.28rem .8rem;font-size:var(--fs-2xs);font-family:\'Courier New\',monospace;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:none;border-bottom:2px solid transparent;background:transparent;transition:all .15s;line-height:1;';
  var h='<div id="cs-tabs" style="display:flex;align-items:flex-end;gap:0;border-bottom:1px solid rgba(0,217,255,.12);margin-bottom:1rem">'
    +'<button data-cstab="resume" style="'+_tbs+'color:var(--cyan);border-bottom:2px solid var(--cyan)">⊛ Résumé</button>'
    +'<button data-cstab="decisions" style="'+_tbs+'color:var(--c-label)">▦ Décisions'+(csD>0?' <span style="color:var(--red)">'+csD+'</span>':'')+'</button>'
    +'<button data-cstab="moteur" style="'+_tbs+'color:var(--c-label)">⚙ Moteur</button>'
    +'</div>'
    +'<div id="cs-panel-resume">'+alertBannerHtml+kpiHtml+kcHtml+geoPerimetreHtml+ipsBanniesHtml+emptyHtml+'</div>'
    +'<div id="cs-panel-decisions" style="display:none">'+tableHtml+'</div>'
    +'<div id="cs-panel-moteur" style="display:none">'+csMoteurPanel+'</div>';

  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-wide');
  mc.style.height='auto'; mc.style.maxHeight='92vh';
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='<span style="margin-right:.45rem;color:var(--cyan);opacity:.7">⊛</span>CROWDSEC — ANALYSE COMPORTEMENTALE';
  var mb=document.getElementById('modal-body');
  mb.innerHTML=h;
  mb.style.overflowY='auto'; mb.style.maxHeight='80vh';

  mb.querySelectorAll('[data-cstab]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var name=this.getAttribute('data-cstab');
      mb.querySelectorAll('[data-cstab]').forEach(function(b){
        var active=b.getAttribute('data-cstab')===name;
        b.style.color=active?'var(--cyan)':'var(--c-label)';
        b.style.borderBottom=active?'2px solid var(--cyan)':'2px solid transparent';
      });
      ['resume','decisions','moteur'].forEach(function(t){
        var p=document.getElementById('cs-panel-'+t);
        if(p)p.style.display=t===name?'':'none';
      });
    });
  });

  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
}

function closeModal(){
  if(!_isOpen)return;
  if(_mapAnimFrames['modal']){cancelAnimationFrame(_mapAnimFrames['modal']);delete _mapAnimFrames['modal'];}
  if(_fwAnimFrame){cancelAnimationFrame(_fwAnimFrame);_fwAnimFrame=null;}
  if(_fwFluxFrame){cancelAnimationFrame(_fwFluxFrame);_fwFluxFrame=null;}
  if(_kcAnimFrame){cancelAnimationFrame(_kcAnimFrame);_kcAnimFrame=null;}
  if(_kciAnimFrame){cancelAnimationFrame(_kciAnimFrame);_kciAnimFrame=null;}
  if(_protoAnim){cancelAnimationFrame(_protoAnim);_protoAnim=null;}
  _overlay.classList.add('closing');
  setTimeout(function(){
    _overlay.classList.remove('open','closing');
    var _mc=document.getElementById('modal-card');
    _mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-router','modal-kci','modal-geomap','theme-red','theme-green','theme-cyan','theme-purple','theme-orange','theme-yellow');
    _mc.style.height='';_mc.style.maxHeight='';
    var _hdrReset=document.getElementById('modal-header-title');if(_hdrReset)_hdrReset.textContent='// DÉTAIL';
    _winModalOpen=false;
    _gpuModalOpen=false;
    _modalBody.innerHTML='';
    _modalBody.removeAttribute('style');
    _isOpen=false;
    document.body.style.overflow='';
    // Relancer Kill Chain sur canvas principal si présent
    var kcMain=document.getElementById('ckc-canvas');
    if(kcMain&&window._lastData)animateKillChain(kcMain,window._lastData.kill_chain||{},window._lastData.fail2ban||{});
  },200);
}

_modalClose.addEventListener('click',function(e){e.stopPropagation();closeModal();});
_overlay.addEventListener('click',function(e){if(e.target===_overlay)closeModal();});

// ══════════════════════════════════════════════════════
// MODAL IP ENRICHI — GeoMap click
