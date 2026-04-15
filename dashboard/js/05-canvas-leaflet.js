var _lfLoaded=false, _lfLoading=false, _lfActive=false;
var _LF_STAGE_COLOR={'EXPLOIT':'#ffd700','BRUTE':'#ff3b5c','SCAN':'#ff6b35','RECON':'#bf5fff'};
var _lfArcData=[], _lfParticleCanvas=null, _lfParticleFrame=null;
var _lfHeatData=[], _lfWanLatG=46.4978, _lfWanLonG=-1.7831;
var _lfHistBuf=[];
// _lastThreatResult déclaré dans 01-utils.js (NDT-99 — partagé 07-render/05-leaflet)
var _LF_COL_RGB={'#ffd700':'255,215,0','#ff3b5c':'255,59,92','#ff6b35':'255,107,53','#bf5fff':'191,95,255','#00ff88':'0,255,136','#00d9ff':'0,217,255'};
function _lfFmtN(n){return n>=10000?Math.round(n/1000)+'k':n>=1000?(n/1000).toFixed(1)+'k':String(n||0);}
function _lfP100(v,mx){return Math.max(3,Math.min(100,Math.round(v/Math.max(mx,1)*100)));}
function _lfTbScore(g){var s=g.kc_stage||g.cs_stage||'';var b={EXPLOIT:82,BRUTE:63,SCAN:35,RECON:12}[s]||5;return Math.min(99,Math.round(b+Math.log2((g.count||1)+1)*2.5));}
var _LF_BOT_JAILS=['apache-badbots','apache-noscript','apache-overflows','nginx-botsearch','nginx-badbots'];
function _lfNonBotBanned(jls){return (jls||[]).filter(function(j){return _LF_BOT_JAILS.indexOf(j.jail)<0;}).reduce(function(a,j){return a+(j.cur_banned||0);},0);}
function _rcPx(i,n,W){return n>1?i/(n-1)*W:W/2;}
function _rcPy(v,H,botPad,maxV,availH){return H-botPad-Math.max(0,Math.round(v/maxV*availH));}
function _rcPathCurve(ctx,pts){ctx.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++){var xc=(pts[i-1][0]+pts[i][0])/2,yc=(pts[i-1][1]+pts[i][1])/2;ctx.quadraticCurveTo(pts[i-1][0],pts[i-1][1],xc,yc);}ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);}
function _rcDrawArea(ctx,pts,rgb,a0,W,H,botPad,topPad){if(!pts.length)return;ctx.beginPath();_rcPathCurve(ctx,pts);ctx.lineTo(W,H-botPad);ctx.lineTo(0,H-botPad);ctx.closePath();var g=ctx.createLinearGradient(0,topPad,0,H-botPad);g.addColorStop(0,'rgba('+rgb+','+a0+')');g.addColorStop(0.35,'rgba('+rgb+','+(a0*0.35).toFixed(3)+')');g.addColorStop(1,'rgba('+rgb+',0.0)');ctx.fillStyle=g;ctx.fill();}
function _rcDrawLine(ctx,pts,rgb,lw,glow){if(!pts.length)return;ctx.beginPath();_rcPathCurve(ctx,pts);ctx.strokeStyle='rgba('+rgb+',0.35)';ctx.lineWidth=lw+4;ctx.shadowColor='rgba('+rgb+',0.6)';ctx.shadowBlur=glow;ctx.stroke();ctx.shadowBlur=0;ctx.beginPath();_rcPathCurve(ctx,pts);ctx.strokeStyle='rgba('+rgb+',0.95)';ctx.lineWidth=lw;ctx.shadowColor='rgba('+rgb+',0.8)';ctx.shadowBlur=glow/2;ctx.stroke();ctx.shadowBlur=0;}
function _rcFmtV(v){return v>=1000?(v/1000).toFixed(v>=10000?0:1)+'k':v+'';}

function _leafletStageColor(g){
  var s=g.kc_stage||g.cs_stage||null;
  if(s&&_LF_STAGE_COLOR[s])return _LF_STAGE_COLOR[s];
  if(g.blocked||g.cs_banned)return '#ff3b5c';
  if(g.country==='FR')return '#00ff88';
  return '#00d9ff';
}

function _leafletCircleOpts(g){
  var c=_leafletStageColor(g);
  var r=Math.max(4,Math.min(12,3+Math.log(g.count+1)*1.5));
  return{radius:r,fillColor:c,color:c,weight:1,opacity:.9,fillOpacity:.65};
}

function _lfDivIcon(g){
  var col=_leafletStageColor(g);
  var sz=Math.max(9,Math.min(18,4+Math.log(g.count+1)*2));
  var stage=g.kc_stage||g.cs_stage||'';
  var pulse=(stage==='EXPLOIT'||stage==='BRUTE'||g.cs_banned);
  var rs=sz+10;
  var ww=sz+20;
  var ipLbl=(g.ip||'').length>15?(g.ip||'').slice(0,14)+'\u2026':(g.ip||'');
  var html='<div style="position:relative;width:'+ww+'px;text-align:center">'
    +'<div class="lf-m-wrap" style="width:'+ww+'px;height:'+ww+'px">'
    +(pulse?'<div class="lf-m-ring" style="width:'+rs+'px;height:'+rs+'px;border-color:'+col+';top:'+((ww-rs)/2)+'px;left:'+((ww-rs)/2)+'px"></div>':'')
    +(pulse?'<div class="lf-m-ring2" style="width:'+rs+'px;height:'+rs+'px;border-color:'+col+';top:'+((ww-rs)/2)+'px;left:'+((ww-rs)/2)+'px"></div>':'')
    +'<div class="lf-m-dot" style="width:'+sz+'px;height:'+sz+'px;background:'+col+';box-shadow:0 0 '+(pulse?10:5)+'px '+col+'80"></div>'
    +'</div>'
    +'<div class="lf-m-lbl" data-stage="'+stage+'" style="color:'+col+'">'+ipLbl+'</div>'
    +'</div>';
  return window.L.divIcon({className:'',html:html,iconSize:[ww,ww+14],iconAnchor:[ww/2,ww/2]});
}

function _buildLeafletMarkers(geoips){
  if(!_lfMap)return;
  _lfMarkers.forEach(function(m){_lfMap.removeLayer(m);});
  _lfMarkers=[];
  var withCoords=0;
  geoips.forEach(function(g){
    if(g.lat==null||g.lon==null)return;
    withCoords++;
    var col=_leafletStageColor(g);
    var stage=g.kc_stage||g.cs_stage||'';
    var loc=g.city?(g.city+', '+g.country):g.country;
    var banned=g.cs_banned||g.blocked;
    var popup='<div class="lf-popup-inner">'
      +(stage?'<div class="lf-popup-stage" style="color:'+col+';background:'+col+'18;border:1px solid '+col+'40">'+stage+'</div>':'')
      +'<div class="lf-popup-ip">'+g.ip+'</div>'
      +'<div class="lf-popup-loc">&#9670; '+loc+'</div>'
      +(banned?'<div class="lf-popup-ban">&#9632; BANNI / BLOQUÉ</div>':'')
      +'<div class="lf-popup-meta">'+g.count+' req &nbsp;·&nbsp; '+g.last_seen+(g.cs_scenario?' &nbsp;·&nbsp; '+g.cs_scenario:'')+'</div>'
      +'</div>';
    var m=window.L.marker([g.lat,g.lon],{icon:_lfDivIcon(g)})
      .bindPopup(popup,{className:'lf-popup',maxWidth:220,minWidth:160});
    m.addTo(_lfMap);
    _lfMarkers.push(m);
  });
  var cnt=document.getElementById('lf-ip-count');
  if(cnt)cnt.textContent=withCoords+' IP'+(withCoords>1?'s':'')+' · 24h';
  setTimeout(_lfUpdateLabels,60);
  // Reconstruire arcs + home + stats au refresh
  var wan=_lfLastWanIp||{};
  _buildLeafletArcs(geoips,wan.lat||null,wan.lon||null);
  _buildLeafletHome(wan.lat||null,wan.lon||null,wan.city);
  _buildLeafletStatsPanel();
  _buildLeafletHUD(geoips);
}

var _lfInitBounds=null; // vue initiale mémorisée

function _lfResetView(){
  if(!_lfMap)return;
  if(_lfInitBounds){
    _lfMap.fitBounds(_lfInitBounds,{maxZoom:5,animate:true});
  } else {
    _lfMap.setView([20,10],2,{animate:true});
  }
}

// Horloge topbar Leaflet
var _lfClockInt=setInterval(function(){
  var el=document.getElementById('lf-time');
  if(el&&_lfActive){var n=new Date();el.textContent=n.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
},1000);

// Touche ESC pour fermer la carte live
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&_lfActive)_toggleLeaflet(null);});

function _lfClearArcs(){
  _lfArcs.forEach(function(a){if(_lfMap)_lfMap.removeLayer(a);});
  _lfArcs=[]; _lfArcData=[];
  if(_lfParticleFrame){cancelAnimationFrame(_lfParticleFrame);_lfParticleFrame=null;}
}

// Bezier géographique : 20 points le long d'une courbe quadratique
// Le point de contrôle est poussé vers le nord → arcs qui "montent" comme les great-circle routes
function _lfBezierPts(lat1,lon1,lat2,lon2,n){
  var cpLat=(lat1+lat2)/2;
  var cpLon=(lon1+lon2)/2;
  var dLon=Math.abs(lon2-lon1), dLat=Math.abs(lat2-lat1);
  var dist=Math.sqrt(dLon*dLon+dLat*dLat);
  var lift=Math.min(dist*0.28+5, 36);
  cpLat=Math.min(cpLat+lift, 82);
  var pts=[];
  for(var i=0;i<=n;i++){var t=i/n,m=1-t;pts.push([m*m*lat1+2*m*t*cpLat+t*t*lat2, m*m*lon1+2*m*t*cpLon+t*t*lon2]);}
  return pts;
}

function _lfUpdateLabels(){
  if(!_lfMap)return;
  var z=_lfMap.getZoom()||2;
  var els=document.querySelectorAll('.lf-m-lbl');
  for(var i=0;i<els.length;i++){
    // Masquer uniquement en dessous du zoom minimum réel (< 2 impossible avec minZoom:2)
    els[i].style.display=z>=2?'inline-block':'none';
  }
}

function _lfStartParticles(){
  if(_lfParticleFrame){cancelAnimationFrame(_lfParticleFrame);_lfParticleFrame=null;}
  // Canvas overlay sur lf-map-container
  if(!_lfParticleCanvas){
    _lfParticleCanvas=document.createElement('canvas');
    _lfParticleCanvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:405;';
    var _mc=document.getElementById('lf-map-container');
    if(_mc)_mc.appendChild(_lfParticleCanvas);
  }
  var _startT=performance.now(), _lastDraw=0;
  function _pframe(ts){
    if(!_lfMap||!_lfActive){_lfParticleFrame=null;return;}
    _lfParticleFrame=requestAnimationFrame(_pframe);
    if(ts-_lastDraw<30)return;
    _lastDraw=ts;
    var mc=document.getElementById('lf-map-container');
    if(!mc)return;
    var W=mc.offsetWidth, H=mc.offsetHeight;
    var dpr=Math.min(window.devicePixelRatio||1,2);
    if(_lfParticleCanvas.width!==Math.round(W*dpr)||_lfParticleCanvas.height!==Math.round(H*dpr)){
      _lfParticleCanvas.width=Math.round(W*dpr);_lfParticleCanvas.height=Math.round(H*dpr);
      _lfParticleCanvas.style.width=W+'px';_lfParticleCanvas.style.height=H+'px';
    }
    var ctx=_lfParticleCanvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    var elapsed=(ts-_startT)*0.001;

    // ── HEAT ZONES (glow attaquants) ──
    _lfHeatData.forEach(function(h){
      try{
        var hp=_lfMap.latLngToContainerPoint([h.lat,h.lon]);
        var hg=ctx.createRadialGradient(hp.x,hp.y,0,hp.x,hp.y,h.r);
        hg.addColorStop(0,'rgba('+h.rgb+','+h.op+')');
        hg.addColorStop(1,'rgba('+h.rgb+',0)');
        ctx.fillStyle=hg;ctx.beginPath();ctx.arc(hp.x,hp.y,h.r,0,Math.PI*2);ctx.fill();
      }catch(e){}
    });

    // ── RANGE RINGS (cercles de portée depuis HOME) ──
    var _wanPt; try{_wanPt=_lfMap.latLngToContainerPoint([_lfWanLatG,_lfWanLonG]);}catch(e){}
    if(_wanPt){
      [[1000,'rgba(0,217,255,.07)'],[3000,'rgba(0,217,255,.045)'],[6000,'rgba(0,217,255,.025)']].forEach(function(rr){
        var km=rr[0];
        var dlat=km/111;
        var dlon=km/(111*Math.cos(_lfWanLatG*Math.PI/180));
        var pts=[];
        for(var a=0;a<=360;a+=4){
          var rad=a*Math.PI/180;
          try{var rp=_lfMap.latLngToContainerPoint([_lfWanLatG+dlat*Math.cos(rad),_lfWanLonG+dlon*Math.sin(rad)]);pts.push(rp);}catch(e){}
        }
        if(pts.length>4){
          ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
          for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
          ctx.closePath();ctx.strokeStyle=rr[1];ctx.lineWidth=0.6;ctx.setLineDash([3,7]);ctx.stroke();ctx.setLineDash([]);
        }
      });
    }

    _lfArcData.forEach(function(p){
      try{
        var src=_lfMap.latLngToContainerPoint([p.lat1,p.lon1]);
        var dst=_lfMap.latLngToContainerPoint([p.lat2,p.lon2]);
        var cp =_lfMap.latLngToContainerPoint([p.cpLat,p.cpLon]);
      }catch(e){return;}
      var prog=((elapsed/p.period)+p.phase)%1;
      for(var k=0;k<p.nParts;k++){
        var t=((prog-k*0.045)+1)%1;
        var fade=t<0.07?t/0.07:(t>0.93?(1-t)/0.07:1);
        var px=(1-t)*(1-t)*src.x+2*(1-t)*t*cp.x+t*t*dst.x;
        var py=(1-t)*(1-t)*src.y+2*(1-t)*t*cp.y+t*t*dst.y;
        var pr=Math.max(0.5,p.pSize-k*0.45);
        ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);
        ctx.fillStyle='rgba('+p.rgb+','+((1-k*0.2)*0.95*fade).toFixed(2)+')';
        var _glow=p.stage==='EXPLOIT'||p.stage==='BRUTE';
        if(_glow){ctx.shadowColor=p.color;ctx.shadowBlur=k===0?8:2;}
        ctx.fill();
        if(_glow)ctx.shadowBlur=0;
      }
      // Flash impact sur HOME (EXPLOIT/BRUTE uniquement)
      if((p.stage==='EXPLOIT'||p.stage==='BRUTE')&&prog>0.91&&prog<0.99){
        try{
          var _dst=_lfMap.latLngToContainerPoint([p.lat2,p.lon2]);
          var fT=(prog-0.91)/0.08;
          ctx.beginPath();ctx.arc(_dst.x,_dst.y,4+fT*22,0,Math.PI*2);
          ctx.strokeStyle='rgba('+p.rgb+','+(0.7*(1-fT)).toFixed(2)+')';
          ctx.lineWidth=1.5;ctx.stroke();
          if(fT<0.3){
            ctx.beginPath();ctx.arc(_dst.x,_dst.y,3+fT*8,0,Math.PI*2);
            ctx.strokeStyle='rgba(255,255,255,'+(0.4*(1-fT/0.3)).toFixed(2)+')';
            ctx.lineWidth=0.8;ctx.stroke();
          }
        }catch(e){}
      }
    });
  }
  requestAnimationFrame(_pframe);
}

function _buildLeafletArcs(geoips, wanLat, wanLon){
  if(!_lfMap||wanLat==null||wanLon==null)return;
  _lfWanLatG=wanLat; _lfWanLonG=wanLon;
  _lfClearArcs();
  var sorted=geoips.filter(function(g){return g.lat!=null&&g.lon!=null;})
    .sort(function(a,b){return b.count-a.count;});
  sorted.forEach(function(g){
    var col=_leafletStageColor(g);
    var stage=g.kc_stage||g.cs_stage||'';
    var logC=Math.log((g.count||1)+1);
    var w,op;
    if(stage==='EXPLOIT'){
      w=Math.max(1.8,Math.min(3.5,1.0+logC/2.5));   // très épais
      op=Math.max(0.55,Math.min(0.88,0.4+logC/6));   // très visible
    } else if(stage==='BRUTE'||g.cs_banned){
      w=Math.max(1.2,Math.min(2.6,0.8+logC/3));
      op=Math.max(0.45,Math.min(0.78,0.3+logC/7));
    } else if(stage==='SCAN'){
      w=Math.max(0.7,Math.min(1.6,0.5+logC/5));
      op=Math.max(0.25,Math.min(0.52,0.18+logC/10));
    } else {
      w=Math.max(0.4,Math.min(1.1,0.35+logC/7));
      op=Math.max(0.12,Math.min(0.3,0.08+logC/14));
    }
    var pts=_lfBezierPts(g.lat,g.lon,wanLat,wanLon,20);
    var arc=window.L.polyline(pts,{color:col,weight:w,opacity:op*0.45,className:'',interactive:false});
    arc.addTo(_lfMap);
    _lfArcs.push(arc);
    // Stocker pour particles canvas
    var _cpLat=(g.lat+wanLat)/2, _cpLon=(g.lon+wanLon)/2;
    var _dLon=Math.abs(wanLon-g.lon), _dLat=Math.abs(wanLat-g.lat);
    var _lift=Math.min(Math.sqrt(_dLon*_dLon+_dLat*_dLat)*0.28+5,36);
    _cpLat=Math.min(_cpLat+_lift,82);
    var _per=stage==='EXPLOIT'?1.8:stage==='BRUTE'?2.3:stage==='SCAN'?3.2:5.0;
    var _psz=stage==='EXPLOIT'?2.8:stage==='BRUTE'?2.4:stage==='SCAN'?2.0:1.4;
    var _npt=stage==='EXPLOIT'?5:stage==='BRUTE'?4:3;
    _lfArcData.push({lat1:g.lat,lon1:g.lon,lat2:wanLat,lon2:wanLon,cpLat:_cpLat,cpLon:_cpLon,color:col,rgb:_LF_COL_RGB[col]||'0,217,255',stage:stage,period:_per,pSize:_psz,nParts:_npt,phase:_ipHash(g.ip||'')});
  });
  // Cap particules : tri par priorité de stage (EXPLOIT>BRUTE>SCAN>RECON), max 80 arcs animés
  var _sPri={'EXPLOIT':0,'BRUTE':1,'SCAN':2};
  _lfArcData.sort(function(a,b){
    var pa=_sPri[a.stage]!==undefined?_sPri[a.stage]:3;
    var pb=_sPri[b.stage]!==undefined?_sPri[b.stage]:3;
    return pa-pb;
  });
  if(_lfArcData.length>80)_lfArcData=_lfArcData.slice(0,80);
  // Précalcul heat zones
  _lfHeatData=_lfArcData.map(function(p){
    return {lat:p.lat1,lon:p.lon1,rgb:p.rgb,r:22+Math.min((p.nParts-3)*6,18),op:0.04+Math.min(p.nParts*0.015,0.10)};
  });
  _lfStartParticles();
}

function _buildLfLeftPanel(geoips,stages,total,lvl,lvlC,blkPct,totalReqs){
  var lp=document.getElementById('lf-left-panel');
  if(!lp)return;
  // Score = celui de computeThreatScore (identique au dashboard principal)
  var _gs=_lastThreatResult?_lastThreatResult.score:0;
  // ── Jauge circulaire ──
  var gc=document.getElementById('lf-gauge-cv');
  if(gc&&gc.getContext){
    var ctx=gc.getContext('2d');
    var W=gc.width,H=gc.height,cx=W/2,cy=H/2,R=31;
    ctx.clearRect(0,0,W,H);
    // Ticks (12 graduations, majeurs x3)
    for(var ti=0;ti<12;ti++){
      var ta=-Math.PI/2+(ti/12)*Math.PI*2;
      var tr1=R+4,tr2=R+(ti%3===0?9:6);
      ctx.beginPath();ctx.moveTo(cx+tr1*Math.cos(ta),cy+tr1*Math.sin(ta));
      ctx.lineTo(cx+tr2*Math.cos(ta),cy+tr2*Math.sin(ta));
      ctx.strokeStyle=ti%3===0?'rgba(0,217,255,.22)':'rgba(0,217,255,.1)';ctx.lineWidth=1;ctx.stroke();
    }
    // Arc fond
    ctx.beginPath();ctx.arc(cx,cy,R,-Math.PI/2,Math.PI*1.5);
    ctx.strokeStyle='rgba(0,217,255,.07)';ctx.lineWidth=6;ctx.lineCap='round';ctx.stroke();
    // Arc menace
    if(_gs>0){
      var endA=-Math.PI/2+(_gs/100)*Math.PI*2;
      ctx.beginPath();ctx.arc(cx,cy,R,-Math.PI/2,endA);
      ctx.strokeStyle=lvlC;ctx.lineWidth=6;ctx.lineCap='round';
      ctx.shadowColor=lvlC;ctx.shadowBlur=10;ctx.stroke();ctx.shadowBlur=0;
    }
    // Anneau intérieur subtil
    ctx.beginPath();ctx.arc(cx,cy,R-9,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,217,255,.04)';ctx.lineWidth=1;ctx.stroke();
    // Point central
    ctx.beginPath();ctx.arc(cx,cy,2.5,0,Math.PI*2);
    ctx.fillStyle=lvlC;ctx.shadowColor=lvlC;ctx.shadowBlur=6;ctx.fill();ctx.shadowBlur=0;
  }
  var gl=document.getElementById('lf-gauge-lbl');if(gl){gl.textContent=lvl;gl.style.color=lvlC;}
  var gs2=document.getElementById('lf-gauge-score');if(gs2){gs2.textContent=_gs;gs2.style.color=lvlC;}
  // ── Métriques OPS ──
  var ioc=stages.EXPLOIT+stages.BRUTE;
  var rateMin=totalReqs>0?_lfFmtN(Math.round(totalReqs/1440)):0;
  var nPays2=Object.keys(geoips.reduce(function(acc,g){if(g.country&&g.country!=='-')acc[g.country]=1;return acc;},{})).length;
  var sd=document.getElementById('lf-lp-stats');
  if(sd){
    sd.innerHTML=
      '<div class="lf-lp-stat"><span class="lf-lp-stat-l">HOSTILES ACTIFS</span><span class="lf-lp-stat-v" style="color:#ff3b5c">'+total+'</span></div>'
      +'<div class="lf-lp-stat"><span class="lf-lp-stat-l">IOC ACTIFS</span><span class="lf-lp-stat-v" style="color:#ffd700">'+ioc+'</span></div>'
      +'<div class="lf-lp-stat"><span class="lf-lp-stat-l">VECTEURS/MIN</span><span class="lf-lp-stat-v" style="color:#ff6b35">'+rateMin+'</span></div>'
      +'<div class="lf-lp-stat"><span class="lf-lp-stat-l">NEUTRALISATION</span><span class="lf-lp-stat-v" style="color:#00ff88">'+blkPct+'%</span></div>'
      +'<div class="lf-lp-stat"><span class="lf-lp-stat-l">PAYS SOURCES</span><span class="lf-lp-stat-v" style="color:rgba(0,217,255,.8)">'+nPays2+'</span></div>';
  }
  // ── Sparkline activité ──
  var spkR=document.getElementById('lf-spk-range');
  if(spkR)spkR.textContent=_lfHistBuf.length>1?'~'+(_lfHistBuf.length*5)+'min':'INIT…';
  var sc=document.getElementById('lf-spk-cv');
  if(sc&&sc.getContext){
    var sctx=sc.getContext('2d'),sW=sc.width,sH=sc.height;
    sctx.clearRect(0,0,sW,sH);
    if(_lfHistBuf.length>1){
      var vals=_lfHistBuf.map(function(e){return e.total;});
      var mn=Math.min.apply(null,vals),mxV=Math.max.apply(null,vals),rngV=Math.max(mxV-mn,1);
      var stpV=(sW-4)/(Math.max(vals.length-1,1));
      // Grille pointillée
      sctx.setLineDash([2,4]);sctx.strokeStyle='rgba(0,217,255,.06)';sctx.lineWidth=0.5;
      [0.3,0.6,0.9].forEach(function(f){var gy=Math.round(sH*f);sctx.beginPath();sctx.moveTo(0,gy);sctx.lineTo(sW,gy);sctx.stroke();});
      sctx.setLineDash([]);
      // Fill dégradé
      sctx.beginPath();
      vals.forEach(function(v,i){var x=2+i*stpV,y=sH-3-Math.round((v-mn)/rngV*(sH-7));i===0?sctx.moveTo(x,y):sctx.lineTo(x,y);});
      var lxV=2+(vals.length-1)*stpV,lyV=sH-3-Math.round((vals[vals.length-1]-mn)/rngV*(sH-7));
      sctx.lineTo(lxV,sH);sctx.lineTo(2,sH);sctx.closePath();
      var grd=sctx.createLinearGradient(0,0,0,sH);
      grd.addColorStop(0,'rgba(0,217,255,.16)');grd.addColorStop(1,'rgba(0,217,255,.01)');
      sctx.fillStyle=grd;sctx.fill();
      // Ligne
      sctx.beginPath();
      vals.forEach(function(v,i){var x=2+i*stpV,y=sH-3-Math.round((v-mn)/rngV*(sH-7));i===0?sctx.moveTo(x,y):sctx.lineTo(x,y);});
      sctx.strokeStyle='rgba(0,217,255,.75)';sctx.lineWidth=1.2;sctx.shadowColor='rgba(0,217,255,.45)';sctx.shadowBlur=3;sctx.stroke();sctx.shadowBlur=0;
      // Dot dernier point
      sctx.beginPath();sctx.arc(lxV,lyV,2,0,Math.PI*2);sctx.fillStyle='#00d9ff';sctx.shadowColor='#00d9ff';sctx.shadowBlur=4;sctx.fill();sctx.shadowBlur=0;
      // Label valeur max
      sctx.font='5px Courier New';sctx.fillStyle='rgba(0,217,255,.45)';sctx.textAlign='right';
      sctx.fillText(_lfFmtN(vals[vals.length-1]),sW-2,lyV>6?lyV-3:lyV+7);
    } else {
      sctx.font='5px Courier New';sctx.fillStyle='rgba(0,217,255,.22)';sctx.textAlign='center';
      sctx.fillText('accumulation en cours…',sW/2,sH/2+2);
    }
  }
}

function _buildLeafletTopBar(geoips){
  var tb=document.getElementById('lf-threat-bar');
  if(!tb)return;
  var stPri={EXPLOIT:0,BRUTE:1,SCAN:2,RECON:3};
  var sorted=geoips.filter(function(g){return g.ip;}).sort(function(a,b){
    var sa=a.kc_stage||a.cs_stage||'',sb=b.kc_stage||b.cs_stage||'';
    var pa=stPri[sa]!==undefined?stPri[sa]:4,pb=stPri[sb]!==undefined?stPri[sb]:4;
    if(pa!==pb)return pa-pb;
    return (b.count||0)-(a.count||0);
  }).slice(0,5);
  if(!sorted.length){tb.innerHTML='';return;}
  var maxC=Math.max.apply(null,sorted.map(function(g){return g.count||1;}));
  var stCol={EXPLOIT:'#ffd700',BRUTE:'#ff3b5c',SCAN:'#ff6b35',RECON:'#bf5fff'};
  var stBdr={EXPLOIT:'rgba(255,215,0,.25)',BRUTE:'rgba(255,59,92,.25)',SCAN:'rgba(255,107,53,.2)',RECON:'rgba(191,95,255,.18)'};
  var stBg={EXPLOIT:'rgba(255,215,0,.07)',BRUTE:'rgba(255,59,92,.07)',SCAN:'rgba(255,107,53,.05)',RECON:'rgba(191,95,255,.04)'};
  var stLbl={EXPLOIT:'⚡ EXP',BRUTE:'⚡ BRU',SCAN:'⊛ SCN',RECON:'⊙ RCN'};
  var html='';
  sorted.forEach(function(g){
    var s=g.kc_stage||g.cs_stage||'';
    var col=stCol[s]||'#00d9ff';
    var bdr=stBdr[s]||'rgba(0,217,255,.15)';
    var bg=stBg[s]||'rgba(0,217,255,.04)';
    var pct=Math.max(5,Math.round((g.count||1)/maxC*100));
    var cc=(g.country&&g.country!=='-')?g.country:'??';
    var sc=_lfTbScore(g);
    var anim=(s==='EXPLOIT'||s==='BRUTE')?';animation:lf-tbp 1.8s ease-in-out infinite':'';
    html+='<div class="lf-tb-item" style="border-color:'+bdr+';background:'+bg+'">'
      +'<span class="lf-tb-stage" style="color:'+col+'">'+(stLbl[s]||s||'?')+'</span>'
      +'<span class="lf-tb-ip">'+g.ip+'</span>'
      +'<span class="lf-tb-cc">['+cc+']</span>'
      +'<div class="lf-tb-spacer"></div>'
      +'<div class="lf-tb-bar-wrap"><div class="lf-tb-bar" style="width:'+pct+'%;background:'+col+anim+'"></div></div>'
      +'<span class="lf-tb-hits">'+_lfFmtN(g.count)+'</span>'
      +'<span class="lf-tb-score" style="color:'+col+'">'+sc+'</span>'
      +'</div>';
  });
  tb.innerHTML=html;
}

function _buildLeafletHUD(geoips){
  var bar=document.getElementById('lf-bottombar');
  if(!bar)return;


  // ── Calculs ────────────────────────────────────────────────────────────────
  var total=geoips.length;
  var totalReqs=geoips.reduce(function(s,g){return s+(g.count||0);},0);
  var csBanned=geoips.filter(function(g){return g.cs_banned;}).length;
  var f2bOnly=geoips.filter(function(g){return g.blocked&&!g.cs_banned;}).length;
  var blocked=csBanned+f2bOnly;
  var blkPct=total>0?Math.round(blocked/total*100):0;
  var gCol=blkPct>70?'#00ff88':blkPct>40?'#ffd700':'#ff3b5c';
  var stages={EXPLOIT:0,BRUTE:0,SCAN:0,RECON:0};
  geoips.forEach(function(g){var s=g.kc_stage||g.cs_stage||'';if(stages[s]!==undefined)stages[s]++;});
  var maxSt=Math.max(stages.EXPLOIT,stages.BRUTE,stages.SCAN,stages.RECON,1);
  var SCOL={EXPLOIT:'#ffd700',BRUTE:'#ff3b5c',SCAN:'#ff6b35',RECON:'#bf5fff'};
  var ctry={};
  geoips.forEach(function(g){if(g.country&&g.country!=='-')ctry[g.country]=(ctry[g.country]||0)+(g.count||0);});
  var topC=Object.keys(ctry).sort(function(a,b){return ctry[b]-ctry[a];}).slice(0,6);
  var maxC=topC.length?ctry[topC[0]]:1;
  var cColors=['#ff3b5c','#ff6b35','#ffd700','rgba(0,217,255,.7)','rgba(0,217,255,.5)','rgba(0,217,255,.35)'];
  var scen={};
  geoips.forEach(function(g){if(g.cs_scenario){var s=g.cs_scenario.replace('crowdsecurity/','').replace('http-','');scen[s]=(scen[s]||0)+(g.count||0);}});
  var topSc=Object.keys(scen).sort(function(a,b){return scen[b]-scen[a];}).slice(0,5);
  var maxSc=topSc.length?scen[topSc[0]]:1;
  var topAtk=geoips.slice().sort(function(a,b){return (b.count||0)-(a.count||0);}).slice(0,5);
  var maxA=topAtk.length?(topAtk[0].count||1):1;
  var nPays=Object.keys(ctry).length;
  // Niveau menace — synchronisé avec computeThreatScore du dashboard principal
  var _ltr=_lastThreatResult;
  var lvl=_ltr?_ltr.level:'FAIBLE';
  var lvlC=_ltr?_ltr.color:'#00ff88';
  var _lvlBgMap={CRITIQUE:'rgba(255,59,92,.14)',ÉLEVÉ:'rgba(255,107,0,.12)',MOYEN:'rgba(255,215,0,.11)',FAIBLE:'rgba(0,255,136,.09)'};
  var lvlBg=_lvlBgMap[lvl]||'rgba(0,255,136,.09)';
  var ts=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  // ── Pre-vars forEach → map/join ──────────────────────────────────────────────
  var ckHtml=['EXPLOIT','BRUTE','SCAN','RECON'].map(function(st){
    var n=stages[st],pw=_lfP100(n,maxSt);
    return '<div class="lf-ck-item">'
      +'<span class="lf-ck-lbl" style="color:'+SCOL[st]+'">'+st+'</span>'
      +'<div class="lf-ck-bar"><div class="lf-ck-fill" style="width:'+pw+'%;background:'+SCOL[st]+'"></div></div>'
      +'<span class="lf-ck-n" style="color:'+SCOL[st]+'">'+n+'</span>'
      +'</div>';
  }).join('');
  var cpHtml=topC.slice(0,6).map(function(c,i){
    var pw=_lfP100(ctry[c],maxC);
    return '<div class="lf-cp-item">'
      +'<span class="lf-cp-lbl">'+c+'</span>'
      +'<div class="lf-cp-bar"><div class="lf-cp-fill" style="width:'+pw+'%;background:'+cColors[i]+'"></div></div>'
      +'<span class="lf-cp-n">'+_lfFmtN(ctry[c])+'</span>'
      +'</div>';
  }).join('');
  var scList=topSc.length?topSc:topAtk.slice(0,5).map(function(g){return g.ip;});
  var scMax=topSc.length?maxSc:maxA;
  var csHtml=scList.map(function(sc,i){
    var val=topSc.length?scen[sc]:(topAtk[i]?topAtk[i].count||0:0);
    var pw=_lfP100(val,scMax);
    var lbl=sc.length>26?sc.slice(0,25)+'…':sc;
    return '<div class="lf-cs-item">'
      +'<span class="lf-cs-lbl">'+lbl+'</span>'
      +'<div class="lf-cs-bar"><div class="lf-cs-fill" style="width:'+pw+'%"></div></div>'
      +'<span class="lf-cs-n">+'+_lfFmtN(val)+'</span>'
      +'</div>';
  }).join('');

  // ── Cartouche HTML — une seule ligne, sections séparées par .lf-cv ─────────
  var h='<div class="lf-ct">'
    +'<span class="lf-ct-t">&#9670; INTREP</span>'
    +'<span class="lf-ct-badge" style="color:'+lvlC+';background:'+lvlBg+';border:1px solid '+lvlC+'45">'+lvl+'</span>'
    +'</div>'
   +'<div class="lf-cv"></div>'
   +'<div class="lf-cm">'
    +'<div class="lf-cm-item"><span class="lf-cm-v" style="color:#ff3b5c">'+total+'</span><span class="lf-cm-l">HOSTILES</span></div>'
    +'<div class="lf-cm-item"><span class="lf-cm-v" style="color:#ff6b35">'+_lfFmtN(totalReqs)+'</span><span class="lf-cm-l">VECTEURS</span></div>'
    +'<div class="lf-cm-item"><span class="lf-cm-v" style="color:#00ff88">'+blocked+'</span><span class="lf-cm-l">NEUTRALISÉS</span></div>'
    +'<div class="lf-cm-item"><span class="lf-cm-v" style="color:'+gCol+'">'+blkPct+'%</span><span class="lf-cm-l">EFFICACITÉ</span></div>'
    +'</div>'
   +'<div class="lf-cv"></div>'
   +'<div class="lf-ck">'+ckHtml+'</div>'
   +'<div class="lf-cv"></div>'
   +'<div class="lf-cp">'+cpHtml+'</div>'
   +'<div class="lf-cv"></div>'
   +'<div class="lf-cs">'+csHtml+'</div>'
   +'<div class="lf-cv"></div>'
   +'<div class="lf-cd">'
    +'<div class="lf-cd-row"><span style="color:#00ff88">&#9632;</span><span style="color:rgba(0,255,136,.55)">CS</span><span style="color:rgba(0,255,136,.9);margin-left:3px">'+csBanned+'&nbsp;BAN</span></div>'
    +'<div class="lf-cd-row"><span style="color:#00d9ff">&#9632;</span><span style="color:rgba(0,217,255,.55)">F2B</span><span style="color:rgba(0,217,255,.9);margin-left:3px">'+f2bOnly+'&nbsp;BLK</span></div>'
    +'</div>'
   +'<div class="lf-cv"></div>'
   +'<div class="lf-cts">'
    +'<span class="lf-cts-clock">'+ts+'</span>'
    +'<span class="lf-cts-date">SIGINT · GEO · '+nPays+'&nbsp;PAYS</span>'
    +'</div>';

  bar.innerHTML=h;

  // ── Top 3 menaces overlay ──
  var t3=document.getElementById('lf-top3');
  if(t3){
    var _top=geoips.filter(function(g){var s=g.kc_stage||g.cs_stage||'';return s==='EXPLOIT'||s==='BRUTE';})
      .sort(function(a,b){return b.count-a.count;}).slice(0,3);
    if(!_top.length)_top=geoips.filter(function(g){var s=g.kc_stage||g.cs_stage||'';return s==='SCAN';})
      .sort(function(a,b){return b.count-a.count;}).slice(0,3);
    var _SCOL={'EXPLOIT':'#ffd700','BRUTE':'#ff3b5c','SCAN':'#ff6b35','RECON':'#bf5fff'};
    var t3emptyHtml=!_top.length?'<div style="font-size:var(--fs-xs);font-family:\'Courier New\',monospace;color:rgba(0,217,255,.3)">Surveillance active…</div>':'';
    var t3rowsHtml=_top.map(function(g){
      var _s=g.kc_stage||g.cs_stage||'';var _c=_SCOL[_s]||'#00d9ff';
      var _loc=(g.city?g.city+' · ':'')+g.country;
      return '<div class="lf-t3-row">'
        +'<span class="lf-t3-dot" style="background:'+_c+';box-shadow:0 0 4px '+_c+'40"></span>'
        +'<span class="lf-t3-ip">'+g.ip+'</span>'
        +'<span class="lf-t3-cnt">'+g.count+'&nbsp;req</span>'
        +'</div>'
        +'<div class="lf-t3-sub">'+_loc.slice(0,26)+' · '+_s+'</div>';
    }).join('');
    var t3h='<div class="lf-t3-hdr">TOP MENACES</div>'+t3emptyHtml+t3rowsHtml;
    t3.innerHTML=t3h;
  }

  // ── Panneau gauche SOC (jauge + métriques + sparkline) ──
  _lfHistBuf.push({total:total,exploit:stages.EXPLOIT,brute:stages.BRUTE,scan:stages.SCAN});
  if(_lfHistBuf.length>12)_lfHistBuf.shift();
  _buildLfLeftPanel(geoips,stages,total,lvl,lvlC,blkPct,totalReqs);
  // ── IP leaderboard dans topbar ──
  _buildLeafletTopBar(geoips);
}

function _buildLeafletHome(wanLat, wanLon, wanCity){
  if(!_lfMap||wanLat==null)return;
  if(_lfHomeMarker){_lfMap.removeLayer(_lfHomeMarker);_lfHomeMarker=null;}
  var sz=480;
  var html='<div class="lf-radar-bg">'
    +'<div class="lf-radar-sweep"></div>'
    +'<div class="lf-radar-beam"></div>'
    +'<div class="lf-radar-ring" style="width:90px;height:90px;animation-delay:0s"></div>'
    +'<div class="lf-radar-ring" style="width:190px;height:190px;animation-delay:.06s"></div>'
    +'<div class="lf-radar-ring" style="width:320px;height:320px;animation-delay:.13s"></div>'
    +'<div class="lf-radar-ring" style="width:478px;height:478px;animation-delay:.21s"></div>'
    +'<div class="lf-radar-cross-h"></div>'
    +'<div class="lf-radar-cross-v"></div>'
    +'<div class="lf-home-wrap" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">'
    +'<div class="lf-home-r1" style="width:38px;height:38px;top:3px;left:3px"></div>'
    +'<div class="lf-home-r2" style="width:38px;height:38px;top:3px;left:3px"></div>'
    +'<div class="lf-home-r3" style="width:38px;height:38px;top:3px;left:3px"></div>'
    +'<div class="lf-home-core"></div>'
    +'</div>'
    +'</div>';
  _lfHomeMarker=window.L.marker([wanLat,wanLon],{
    icon:window.L.divIcon({className:'',html:html,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]}),
    zIndexOffset:1000
  }).bindPopup('<div class="lf-popup-inner"><div class="lf-popup-stage" style="color:#00ff88;background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.3)">HOME</div><div class="lf-popup-ip">'+(wanCity||'Les Sables-d\'Olonne')+'</div><div class="lf-popup-loc">&#9670; Vendée · FR · Cible des attaques</div></div>',{className:'lf-popup',maxWidth:200});
  _lfHomeMarker.addTo(_lfMap);
}

function _buildLeafletStatsPanel(){
  // Panel déplacé dans le HUD bottom bar — désactivé ici
  if(_lfStatsCtrl&&_lfMap){_lfMap.removeControl(_lfStatsCtrl);_lfStatsCtrl=null;}
}

function _initLeafletMap(geoips){
  var el=document.getElementById('lf-map-container');
  if(!el)return;
  var wan=_lfLastWanIp||{};
  var wLat=wan.lat||null, wLon=wan.lon||null;
  if(_lfMap){
    _lfMap.invalidateSize();
    _buildLeafletArcs(geoips,wLat,wLon);
    _buildLeafletMarkers(geoips);
    _buildLeafletHome(wLat,wLon,wan.city);
    _buildLeafletStatsPanel();
    _buildLeafletHUD(geoips);
    return;
  }
  // Créer le panel top3 si absent
  if(!document.getElementById('lf-top3')){
    var _t3=document.createElement('div');_t3.id='lf-top3';
    el.appendChild(_t3);
  }
  // Créer le panneau gauche SOC si absent
  if(!document.getElementById('lf-left-panel')){
    var _lp=document.createElement('div');_lp.id='lf-left-panel';
    _lp.innerHTML='<div class="lf-lp-hdr">&#9670; THREATCON</div>'
      +'<div id="lf-gauge-wrap"><canvas id="lf-gauge-cv" width="90" height="90"></canvas>'
      +'<div id="lf-gauge-lbl">&#8212;</div>'
      +'<div id="lf-gauge-score">&#8212;</div>'
      +'<div id="lf-gauge-sub">SCORE&nbsp;/&nbsp;99</div></div>'
      +'<div class="lf-lp-div"></div>'
      +'<div class="lf-lp-hdr">&#9670; M&Eacute;TRIQUES OPS</div>'
      +'<div id="lf-lp-stats"></div>'
      +'<div class="lf-lp-div"></div>'
      +'<div class="lf-lp-spk-hdr"><span class="lf-lp-spk-ttl">&#9670; ACTIVIT&Eacute;</span>'
      +'<span class="lf-lp-spk-rng" id="lf-spk-range"></span></div>'
      +'<canvas id="lf-spk-cv" width="134" height="38"></canvas>';
    el.appendChild(_lp);
  }
  _lfMap=window.L.map(el,{
    zoomControl:false,scrollWheelZoom:true,attributionControl:false,
    worldCopyJump:false,maxBounds:[[-85,-180],[85,180]],
    maxBoundsViscosity:1.0,minZoom:2
  });
  // Tuiles dark sans labels (base)
  window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',{
    maxZoom:18,subdomains:'abcd',noWrap:true
  }).addTo(_lfMap);
  // Labels villes/pays uniquement à partir du zoom 5 (évite les noms d'océans en multi-langues)
  window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',{
    maxZoom:18,subdomains:'abcd',noWrap:true,minZoom:5
  }).addTo(_lfMap);
  // Cyber tint sur tout le tilePane (base + labels)
  setTimeout(function(){
    var tp=_lfMap.getPane('tilePane');
    if(tp)tp.style.filter='hue-rotate(155deg) saturate(0.4) brightness(0.68)';
  },80);
  _lfMap.on('zoomend',_lfUpdateLabels);
  window.L.control.zoom({position:'topleft'}).addTo(_lfMap);
  var RstCtrl=window.L.Control.extend({options:{position:'topleft'},onAdd:function(){
    var b=window.L.DomUtil.create('button','lf-reset-btn');
    b.innerHTML='&#8635;';b.title='Vue initiale';
    window.L.DomEvent.on(b,'click',window.L.DomEvent.stopPropagation);
    window.L.DomEvent.on(b,'click',_lfResetView);
    return b;
  }});
  new RstCtrl().addTo(_lfMap);
  window.L.control.attribution({position:'bottomright',prefix:'<span style="font-size:var(--fs-xs);font-family:\'Courier New\',monospace;opacity:.3">CartoDB · GeoLite2-City</span>'}).addTo(_lfMap);
  // Arcs d'abord (sous les markers)
  _buildLeafletArcs(geoips,wLat,wLon);
  _buildLeafletMarkers(geoips);
  _buildLeafletHome(wLat,wLon,wan.city);
  _buildLeafletStatsPanel();
  _buildLeafletHUD(geoips);
  setTimeout(function(){
    if(!_lfMap)return;
    _lfMap.invalidateSize();
    // Vue initiale centrée sur la France (depuis Les Sables-d'Olonne)
    _lfInitBounds=window.L.latLngBounds([[41.2,-5.2],[51.3,9.8]]);
    _lfMap.fitBounds(_lfInitBounds,{maxZoom:6,animate:false});
  },200);
}

function _loadLeaflet(cb){
  if(_lfLoaded){cb();return;}
  if(_lfLoading){var t=setInterval(function(){if(_lfLoaded){clearInterval(t);cb();}},100);return;}
  _lfLoading=true;
  var css=document.getElementById('leaflet-css');
  if(css){css.setAttribute('href',css.getAttribute('data-src'));css.removeAttribute('disabled');}
  var s=document.createElement('script');
  s.src='/libs/leaflet/leaflet.js';
  s.onload=function(){_lfLoaded=true;_lfLoading=false;cb();};
  s.onerror=function(){_lfLoading=false;alert('Leaflet CDN inaccessible — vérifiez votre connexion internet.');};
  document.head.appendChild(s);
}

function _toggleLeaflet(btn){
  var fs=document.getElementById('lf-fullscreen');
  if(!fs)return;
  if(_lfActive){
    // Fermer
    _lfActive=false;
    fs.classList.remove('open');
    if(btn)btn.classList.remove('active');
    if(_lfParticleFrame){cancelAnimationFrame(_lfParticleFrame);_lfParticleFrame=null;}
    // Remettre le bouton de la tuile à jour
    var lb=document.getElementById('map-lf-btn');
    if(lb)lb.classList.remove('active');
  } else {
    // Ouvrir pleine page
    _lfActive=true;
    fs.classList.add('open');
    if(btn)btn.classList.add('active');
    var lb2=document.getElementById('map-lf-btn');
    if(lb2)lb2.classList.add('active');
    _loadLeaflet(function(){
      setTimeout(function(){_initLeafletMap(_lfLastGeoips||[]);},80);
    });
  }
}
function _ipHash(ip){ var h=0,s=ip||''; for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))&0xffff;} return (h%628)/100; }
function _csLabel(s,max){ s=(s||'').replace('http-','').replace('crowdsecurity/',''); if(s.length<=max)return s; var cut=s.lastIndexOf('-',max); return cut>2?s.slice(0,cut):s.slice(0,max); }
var _lfNetRx=[], _lfNetTx=[], _lfMaxRx=1, _lfMaxTx=1;

function computeThreatScore(d){
  var t=d.traffic||{};
  var score=0; var factors=[];
  var total=Math.max(t.total_requests||0,1);
  // GeoIP (max 8pts) — 403 légitimes attendus pour un site géo-restreint (réduit : source de bruit)
  var geoRate=(t.geo_blocks||0)/total;
  if(geoRate>0.6){score+=8;factors.push({t:'GeoIP massif ('+Math.round(geoRate*100)+'%)',c:'r'});}
  else if(geoRate>0.3){score+=4;factors.push({t:'GeoIP élevé',c:'y'});}
  else if(geoRate>0.1){score+=1;}
  // Erreurs (max 8pts) — corrélées au GeoIP 403 : seuils relevés
  var err=t.error_rate||0;
  if(err>35){score+=8;factors.push({t:'Erreurs '+err+'%',c:'r'});}
  else if(err>15){score+=4;factors.push({t:'Erreurs '+err+'%',c:'y'});}
  else if(err>5){score+=2;}
  // Scanners (max 20pts) — < 200 reqs = bruit normal internet
  var scans=(t.top_scanners||[]).reduce(function(a,e){return a+e[1];},0);
  if(scans>1000){score+=20;factors.push({t:'Scanners ('+fmt(scans)+')',c:'r'});}
  else if(scans>200){score+=10;factors.push({t:'Scanners détectés',c:'y'});}
  else if(scans>50){score+=4;}
  // SSH brute force (max 15pts) — port non-standard 2272 = peu exposé
  var sshFail=0;(d.ssh||[]).forEach(function(m){sshFail+=m.failed_24h||0;});
  if(sshFail>100){score+=15;factors.push({t:'Brute force SSH',c:'r'});}
  else if(sshFail>20){score+=7;factors.push({t:'SSH attaques',c:'y'});}
  else if(sshFail>5){score+=2;}
  // UFW (max 10pts) — 500/jour = bruit normal, critique à > 5000
  var ufwB=(d.ufw||{}).blocked_total||0;
  if(ufwB>5000){score+=10;factors.push({t:'UFW '+fmt(ufwB)+' bloqs',c:'r'});}
  else if(ufwB>2000){score+=5;factors.push({t:'UFW élevé',c:'y'});}
  else if(ufwB>500){score+=2;}
  // Kill Chain nginx (max 30pts) — priorité maximale : EXPLOIT immédiatement visible
  var kc=d.kill_chain||{},sc=kc.stage_counts||{};
  var exploitCount=sc.EXPLOIT||0;
  var activeIps=kc.active_ips||[];
  var kcActive=kc.total_active||0;
  var exploitUnblocked=activeIps.filter(function(ip){return ip.stage==='EXPLOIT'&&!ip.cs_decision;}).length;
  var bruteCount=sc.BRUTE||0;
  var bruteUnblocked=activeIps.filter(function(ip){return ip.stage==='BRUTE'&&!ip.cs_decision;}).length;
  if(exploitCount>0){
    if(exploitUnblocked>=3){score+=30;factors.push({t:'EXPLOIT non bloqué ('+exploitUnblocked+' IP)',c:'r'});}
    else if(exploitUnblocked>=1){score+=20;factors.push({t:'EXPLOIT actif ('+exploitUnblocked+' IP non bloquée)',c:'r'});}
    else{factors.push({t:'EXPLOIT neutralisé CS ('+exploitCount+' IP)',c:'g'});}
    // BRUTE coexistant avec EXPLOIT — menace secondaire si non bloquée
    if(bruteUnblocked>0){score=Math.min(score+10,100);factors.push({t:'BRUTE: '+bruteUnblocked+' IP non bloquée',c:'r'});}
  }else if(bruteCount>0){
    score+=20;factors.push({t:'BRUTE FORCE actif',c:'r'});
  }else if((sc.SCAN||0)>0){score+=10;factors.push({t:'SCAN actif ('+(sc.SCAN)+' IP)',c:'y'});}
  else if((sc.RECON||0)>0){score+=4;factors.push({t:'RECON détecté',c:'y'});}
  // CrowdSec (max 20pts) — attaques confirmées par scénarios comportementaux
  // Source : cs.active_decisions (tuile CS)
  var cs=d.crowdsec||{};
  var csD=cs.active_decisions||cs.decisions||0;
  var csS=kc.cs_stage_counts||{};
  if(csD>10){score+=20;factors.push({t:'CrowdSec: '+csD+' IPs bannies',c:'r'});}
  else if(csD>3){score+=12;factors.push({t:'CrowdSec: '+csD+' décisions',c:'y'});}
  else if(csD>0){score+=6;factors.push({t:'CrowdSec: '+csD+' décision'+(csD>1?'s':''),c:'y'});}
  // CS EXPLOIT : compter uniquement si des IPs EXPLOIT restent non bloquées (évite double-comptage)
  if((csS.EXPLOIT||0)>0&&exploitUnblocked>0){score=Math.min(score+10,100);factors.push({t:'CS EXPLOIT: '+(csS.EXPLOIT)+' scénario'+(csS.EXPLOIT>1?'s':''),c:'r'});}
  else if((csS.BRUTE||0)>0){score=Math.min(score+5,100);factors.push({t:'CS BRUTE: '+(csS.BRUTE)+' scénario'+(csS.BRUTE>1?'s':''),c:'r'});}
  // CS neutralisation EXPLOIT — signal positif (menace gérée) → pas de points supplémentaires
  else if(exploitCount>0&&exploitUnblocked===0&&csD>0){factors.push({t:'EXPLOIT neutralisé CS ('+csD+' décisions actives)',c:'g'});}
  // CS SCAN / RECON scénarios actifs — signal modéré (manquait)
  if((csS.SCAN||0)>1){score=Math.min(score+3,100);factors.push({t:'CS SCAN: '+(csS.SCAN)+' scénario'+(csS.SCAN>1?'s':''),c:'y'});}
  else if((csS.SCAN||0)===1){score=Math.min(score+1,100);}
  if((csS.RECON||0)>2){score=Math.min(score+2,100);factors.push({t:'CS RECON: '+(csS.RECON)+' scénario'+(csS.RECON>1?'s':''),c:'y'});}
  // Kill Rate — proportion menaces non neutralisées (max 10pts) — calculé après CS+F2B connus
  // _kcNeutralized = CrowdSec decisions (inclut bans Fail2ban srv-ngix via crowdsec-sync)
  //                + F2B satellites (proxmox/site01/site02 — nftables propres, hors CrowdSec)
  // IMPORTANT: srv-ngix F2B total_banned exclu — tous transitent via crowdsec-sync → déjà dans csD
  var _pvf2b0=d.fail2ban&&d.fail2ban.proxmox||{},_cltf2b0=d.fail2ban&&d.fail2ban.site01||{},_pa85f2b0=d.fail2ban&&d.fail2ban.site02||{};
  var _kcNeutralized=csD+(_pvf2b0.available?_pvf2b0.total_banned||0:0)+(_cltf2b0.available?_cltf2b0.total_banned||0:0)+(_pa85f2b0.available?_pa85f2b0.total_banned||0:0);
  var _kcKrTotal=kcActive+_kcNeutralized;
  var _kcKillRate=_kcKrTotal>0?Math.round(_kcNeutralized/_kcKrTotal*100):100;
  if(kcActive>0){
    if(_kcKillRate<20){score=Math.min(score+10,100);factors.push({t:'Kill Rate critique ('+_kcKillRate+'%) — neutralisation insuffisante',c:'r'});}
    else if(_kcKillRate<40){score=Math.min(score+6,100);factors.push({t:'Kill Rate faible ('+_kcKillRate+'%)',c:'r'});}
    else if(_kcKillRate<60){score=Math.min(score+3,100);factors.push({t:'Kill Rate moyen ('+_kcKillRate+'%)',c:'y'});}
    // ≥60% : neutralisation correcte → pas de pénalité
  }
  // F2B bans actifs — satellites uniquement (site01/site02/proxmox) — max 10pts
  // srv-ngix F2B exclu : tous les bans transitent via crowdsec-sync → déjà comptés dans csD (CrowdSec section)
  // compter srv-ngix F2B ici créerait un doublon sur chaque ban Fail2ban srv-ngix
  var f2b=d.fail2ban||{};
  var pvf2b=f2b.proxmox||{},cltf2b=f2b.site01||{},pa85f2b=f2b.site02||{};
  var totalBansAll=(pvf2b.available?_lfNonBotBanned(pvf2b.jails||[]):0)
    +(cltf2b.available?_lfNonBotBanned(cltf2b.jails||[]):0)
    +(pa85f2b.available?_lfNonBotBanned(pa85f2b.jails||[]):0);
  if(totalBansAll>200){score+=10;factors.push({t:'F2B satellites: '+totalBansAll+' bans (3 hôtes)',c:'r'});}
  else if(totalBansAll>80){score+=5;factors.push({t:'F2B satellites: '+totalBansAll+' bans actifs',c:'y'});}
  else if(totalBansAll>20){score+=2;}
  // F2B satellites DOWN — gap couverture sur hôtes secondaires (+4pts chacun)
  if(pvf2b.available===false){score=Math.min(score+4,100);factors.push({t:'⚠ F2B Proxmox DOWN',c:'r'});}
  if(cltf2b.available===false){score=Math.min(score+4,100);factors.push({t:'⚠ F2B SITE01 DOWN',c:'r'});}
  if(pa85f2b.available===false){score=Math.min(score+4,100);factors.push({t:'⚠ F2B SITE02 DOWN',c:'r'});}
  // Web bots — srv-ngix (nginx-botsearch) + site01 + site02 (apache) (max 8pts)
  // nginx-botsearch : utilise tot_failed uniquement (pas cur_banned) — cur_banned désormais dans csD via crowdsec-sync
  var webBotScore=[(cltf2b.jails||[]),(pa85f2b.jails||[])].reduce(function(a,jls){
    return a+jls.filter(function(j){return ['apache-badbots','apache-noscript','apache-overflows'].indexOf(j.jail)>=0;})
      .reduce(function(x,j){return x+(j.cur_banned||0)+(j.tot_failed||0);},0);
  },0);
  webBotScore+=(f2b.jails||[]).filter(function(j){return ['nginx-botsearch','nginx-badbots'].indexOf(j.jail)>=0;})
    .reduce(function(x,j){return x+(j.tot_failed||0);},0); // cur_banned exclu — déjà dans CrowdSec decisions
  if(webBotScore>50){score+=8;factors.push({t:'Web bots (nginx+apache): '+webBotScore,c:'r'});}
  else if(webBotScore>10){score+=4;factors.push({t:'Web bots détectés',c:'y'});}
  // CrowdSec AppSec WAF (max 8pts) — vpatches CVE déclenchés
  var appsecBlk=(cs.appsec&&cs.appsec.blocked)||0;
  if(appsecBlk>50){score+=8;factors.push({t:'AppSec WAF: '+appsecBlk+' bloqués',c:'r'});}
  else if(appsecBlk>10){score+=4;factors.push({t:'AppSec WAF: '+appsecBlk+' bloqués',c:'y'});}
  else if(appsecBlk>0){score+=2;}
  // AppSec module DOWN — CrowdSec actif mais module AppSec absent : 150 vpatches CVE inactifs
  if(cs.available===true&&(!cs.appsec||cs.appsec.available===false)){score=Math.min(score+5,100);factors.push({t:'⚠ AppSec WAF DOWN — vpatches CVE inactifs',c:'r'});}
  // Suricata IDS — alertes réseau (max 20pts) — couche réseau L3/L4 indépendante de CrowdSec
  // Anti-doublon : sév.1 réduit si EXPLOIT déjà compté dans Kill Chain (mêmes IPs probables)
  var sur=d.suricata||{};
  if(sur.available){
    var surSev1=sur.sev1_critical||0, surSev2=sur.sev2_high||0;
    var surScore=0;
    // Sév.1 CRITIQUE — attaque réseau confirmée
    // Depuis 2026-04-07 : suricata-sev1-critical auto-banne via CrowdSec → score réduit si couvert
    var csSev1Cover=cs.available&&surSev1>0; // CrowdSec actif + scénario sev1 en place
    if(surSev1>=3){
      if(csSev1Cover&&exploitUnblocked===0){
        surScore+=8;factors.push({t:'Suricata: '+surSev1+' CRITIQUES (auto-ban CS actif)',c:'y'});
      } else {
        surScore+=15;factors.push({t:'Suricata: '+surSev1+' alertes CRITIQUES',c:'r'});
      }
    } else if(surSev1>=1){
      if(exploitUnblocked===0){
        if(csSev1Cover){
          // Auto-ban CrowdSec suricata-sev1-critical couvre → menace maîtrisée
          surScore+=3;factors.push({t:'Suricata: '+surSev1+' sév.1 — couvert CS auto-ban',c:'g'});
        } else {
          surScore+=12;factors.push({t:'Suricata: '+surSev1+' sév.1 — vecteur réseau',c:'r'});
        }
      } else {
        // Kill Chain EXPLOIT déjà compté → confirmation, évite doublon plein
        surScore+=5;factors.push({t:'Suricata: '+surSev1+' sév.1 (confirmé EXPLOIT)',c:'r'});
      }
    }
    // Sév.2 HIGH — recalibré : suricata-sev2-high scenario actif (5 hits ban 48h) 2026-04-07
    if(surSev2>8000){surScore+=10;factors.push({t:'Suricata: '+surSev2+' HIGH — surge C2',c:'y'});}
    else if(surSev2>4000){surScore+=7;factors.push({t:'Suricata: '+surSev2+' alertes HIGH',c:'y'});}
    else if(surSev2>1200){surScore+=4;factors.push({t:'Suricata: trafic suspect ('+surSev2+')',c:'y'});}
    else if(surSev2>400){surScore+=2;}
    // Sév.3 MEDIUM — volume élevé = signal faible (manquait)
    var surSev3=sur.sev3_medium||0;
    if(surSev3>500){surScore+=3;factors.push({t:'Suricata: '+surSev3+' alertes MEDIUM',c:'y'});}
    else if(surSev3>100){surScore+=1;}
    score+=Math.min(surScore,20); // cap Suricata à 20pts total
  } else if(sur.available===false){score=Math.min(score+10,100);factors.push({t:'⚠ Suricata DOWN',c:'r'});}
  // Routeur GT-BE98 (max 12pts) — WAN flood + conntrack anormal + FW drops
  // Baseline WAN : 130–5000 Kbps | conntrack normal : <300 flux | fw_drops : 0 attendu
  var _rt=window._routerData||null,_fl=window._routerFlows||null;
  if(_rt&&_rt.available){
    var rtScore=0;
    var wanRx=(_rt.wan&&_rt.wan.rx_kbps)||0;
    if(wanRx>80000){rtScore+=8;factors.push({t:'WAN flood: '+Math.round(wanRx/1000)+'Mbps',c:'r'});}
    else if(wanRx>40000){rtScore+=5;factors.push({t:'WAN élevé: '+Math.round(wanRx/1000)+'Mbps',c:'y'});}
    else if(wanRx>20000){rtScore+=2;}
    var ctTotal=(_fl&&_fl.total)||0;
    if(ctTotal>5000){rtScore+=6;factors.push({t:'Conntrack: '+ctTotal+' flux',c:'r'});}
    else if(ctTotal>2000){rtScore+=4;factors.push({t:'Conntrack élevé: '+ctTotal,c:'y'});}
    else if(ctTotal>1000){rtScore+=2;}
    var _sec=_rt.security||{};
    var fwDrop=(_sec.fw_forward_drop||0)+(_sec.fw_input_drop||0);
    if(fwDrop>1000){rtScore+=4;factors.push({t:'FW routeur: '+fwDrop+' drops',c:'r'});}
    else if(fwDrop>100){rtScore+=2;factors.push({t:'FW routeur actif ('+fwDrop+')',c:'y'});}
    else if(fwDrop>0){rtScore+=1;}
    score+=Math.min(rtScore,12);
  }
  // Mises à jour sécurité en attente — vulnérabilités connues non patchées (manquait)
  var _upd=d.updates||{},_updSec=_upd.total_security||0;
  if(_updSec>5){score=Math.min(score+8,100);factors.push({t:'⚠ '+_updSec+' màj sécu. en attente (infra)',c:'r'});}
  else if(_updSec>0){score=Math.min(score+4,100);factors.push({t:'⚠ '+_updSec+' màj sécu. en attente',c:'y'});}
  // AppArmor SITE01 — confinement Apache2 (enforce)
  var _aa=d.clt_apparmor||{};
  if(_aa.available===true&&_aa.enforce===false){score=Math.min(score+6,100);factors.push({t:'⚠ AppArmor SITE01 hors enforce — Apache non confiné',c:'r'});}
  else if(_aa.available===false){score=Math.min(score+2,100);factors.push({t:'⚠ AppArmor SITE01 inaccessible',c:'y'});}
  // AppArmor nginx srv-ngix — confinement workers (max 6pts)
  var _aan=d.apparmor_nginx||{};
  if(_aan.available===true&&_aan.enforce===false){score=Math.min(score+6,100);factors.push({t:'⚠ AppArmor nginx hors enforce — workers non confinés',c:'r'});}
  else if(_aan.available===false){score=Math.min(score+2,100);factors.push({t:'⚠ AppArmor nginx inaccessible',c:'y'});}
  // TLS expiry — certificats Let's Encrypt (max 10pts)
  var _tls=d.tls||{};
  var _tlsMin=null;
  Object.keys(_tls).forEach(function(k){var e=_tls[k];if(e&&e.days_left!=null&&(_tlsMin===null||e.days_left<_tlsMin))_tlsMin=e.days_left;});
  if(_tlsMin!==null){
    if(_tlsMin<7){score=Math.min(score+10,100);factors.push({t:'🔴 TLS expire dans '+_tlsMin+'j — URGENT certbot',c:'r'});}
    else if(_tlsMin<30){score=Math.min(score+5,100);factors.push({t:'⚠ TLS expire dans '+_tlsMin+'j — renouvellement requis',c:'y'});}
  }
  // ModSec SITE01 — moteur WAF Apache (max 6pts)
  var _ms=d.clt_modsec||{};
  if(_ms.available===true&&_ms.engine_on===false){score=Math.min(score+6,100);factors.push({t:'⚠ ModSec SITE01 désactivé — WAF Apache inactif',c:'r'});}
  else if(_ms.available===false){score=Math.min(score+2,100);factors.push({t:'⚠ ModSec SITE01 inaccessible',c:'y'});}
  // AppArmor SITE02 — confinement Apache2 (enforce)
  var _aap=d.pa85_apparmor||{};
  if(_aap.available===true&&_aap.enforce===false){score=Math.min(score+6,100);factors.push({t:'⚠ AppArmor SITE02 hors enforce — Apache non confiné',c:'r'});}
  else if(_aap.available===false){score=Math.min(score+2,100);factors.push({t:'⚠ AppArmor SITE02 inaccessible',c:'y'});}
  // ModSec SITE02 — moteur WAF Apache (max 6pts)
  var _msp=d.pa85_modsec||{};
  if(_msp.available===true&&_msp.engine_on===false){score=Math.min(score+6,100);factors.push({t:'⚠ ModSec SITE02 désactivé — WAF Apache inactif',c:'r'});}
  else if(_msp.available===false){score=Math.min(score+2,100);factors.push({t:'⚠ ModSec SITE02 inaccessible',c:'y'});}
  // Auto-update freshness (max 4pts) — fraîcheur signatures sécu
  var _au=d.autoupdate||{};
  var _auScore=0;
  if(_au.crowdsec_hub&&_au.crowdsec_hub.stale===true){_auScore+=2;factors.push({t:'⚠ CrowdSec hub: màj >8j',c:'y'});}
  if(_au.suricata_rules&&_au.suricata_rules.stale===true){_auScore+=2;factors.push({t:'⚠ Suricata rules: màj >2j',c:'y'});}
  score=Math.min(score+_auScore,100);
  // Suricata truncated packets — saturation ring buffer AF-PACKET (max 10pts)
  var _trunc=(sur.truncated_24h)||0;
  if(_trunc>15000){score=Math.min(score+10,100);factors.push({t:'Suricata: '+fmt(_trunc)+' paquets tronqués/j — ring saturé',c:'r'});}
  else if(_trunc>5000){score=Math.min(score+5,100);factors.push({t:'Suricata: '+fmt(_trunc)+' tronqués (ring buffer)',c:'y'});}
  // Services sécurité DOWN — protection gap (max 20+15pts)
  if(cs.available===false){score=Math.min(score+20,100);factors.push({t:'⚠ CrowdSec DOWN',c:'r'});}
  if(f2b.total_banned===undefined||f2b.total_banned===null){score=Math.min(score+15,100);factors.push({t:'⚠ Fail2ban DOWN',c:'r'});}
  // Récidivistes — IPs bannies ≥3 fois (persistance attaque) (max 10pts)
  var _abl=d.autoban_log||[];
  var _recid=_abl.filter(function(e){return e.rule&&e.rule.indexOf('RECIDIVISTE')>=0;}).length;
  if(_recid>=2){score=Math.min(score+10,100);factors.push({t:'Récidivistes: '+_recid+' IP persistantes',c:'r'});}
  else if(_recid>=1){score=Math.min(score+5,100);factors.push({t:'Récidiviste: 1 IP persistante',c:'y'});}
  score=Math.min(score,100);
  // Niveau — escalade Suricata sév.1 uniquement si NON couverte par CS auto-ban
  // Si CrowdSec actif + EXPLOIT neutralisé → sév.1 gérées, pas d'escalade CRITIQUE injustifiée
  var _sur=d.suricata||{};
  var _surSev1=_sur.available?(_sur.sev1_critical||0):0;
  var _surCovered=cs.available&&_surSev1>0&&exploitUnblocked===0;
  var level,col;
  if(score>=70||(_surSev1>=5&&score>=50&&!_surCovered)){level='CRITIQUE';col='#ff3b5c';}
  else if(score>=50){level='ÉLEVÉ';col='#ff6b35';}
  else if(score>=30){level='MOYEN';col='#ffd700';}
  else{level='FAIBLE';col='#00ff88';}
  return{score:score,level:level,color:col,factors:factors,exploitUnblocked:exploitUnblocked};
}

function computeSystemStatus(d, ts){
  var cs=d.crowdsec||{},f2b=d.fail2ban||{};
  var exploitUnblocked=(ts&&ts.exploitUnblocked!=null)?ts.exploitUnblocked
    :(d.kill_chain&&d.kill_chain.active_ips||[]).filter(function(ip){return ip.stage==='EXPLOIT'&&!ip.cs_decision;}).length;
  var defDown=(cs.available===false)||(f2b.total_banned===undefined||f2b.total_banned===null);
  if(exploitUnblocked>=3||(exploitUnblocked>=1&&defDown)){
    return{label:'COMPROMIS',color:'#ff0040',icon:'✖',sub:'Intrusion active non neutralisée — intervention immédiate requise'};
  }
  if(exploitUnblocked>=1){
    return{label:'SOUS PRESSION',color:'#ff6b35',icon:'⚠',sub:'IP(s) EXPLOIT non bloquée(s) — surveillance rapprochée requise'};
  }
  if(defDown){
    return{label:'DÉGRADÉ',color:'#ffd700',icon:'▲',sub:'Protection partielle — service(s) de défense indisponible(s)'};
  }
  return{label:'SAIN',color:'#00d964',icon:'✓',sub:'Attaques en cours — défenses actives — aucune intrusion confirmée'};
}

function computeRouterScore(rd, flows){
  if(!rd||!rd.available) return{score:80,level:'ÉLEVÉ',color:'#ff6b35',factors:[{t:'Routeur inaccessible',c:'r'}]};
  var score=0,factors=[];
  var sec=rd.security||{},cpu=rd.cpu||{},wan=rd.wan||{};
  var _fwDrop=(sec.fw_forward_drop||0)+(sec.fw_input_drop||0);
  // Firewall — détection dynamique fw_mode (merlin=/jffs/scripts, stock=défaut)
  var _fwMode=rd.fw_mode||'stock';
  var _aip=rd.aiprotection||{};
  if(_fwMode==='merlin'){
    // Merlin : pas de pénalité, firmware avancé
    factors.push({t:'Firmware Merlin — contrôle firewall avancé',c:'g'});
  } else {
    // Stock firmware : SPI toujours actif + AiProtection si activé
    if(_aip.enabled){
      score+=0;  // AiProtection = protection active, pas de pénalité
      factors.push({t:'AiProtection ACTIF — '+(_aip.drop_count||0)+' DROP / '+(_aip.rule_count||0)+' règles',c:'g'});
    } else {
      score+=15;  // SPI seul sans AiProtection = protection réduite
      factors.push({t:'AiProtection INACTIF — SPI seul (activer dans ASUS UI)',c:'y'});
    }
    if(_fwDrop>0) factors.push({t:'iptables DROP : '+_fwDrop+' entrées supplémentaires',c:'g'});
  }
  // CPU
  var load5=cpu.load5||0;
  if(load5>3.0){score+=20;factors.push({t:'CPU critique: load='+load5,c:'r'});}
  else if(load5>1.5){score+=10;factors.push({t:'CPU élevé: load='+load5,c:'y'});}
  // Température
  var temp=sec.temp_c;
  if(temp!==null&&temp!==undefined){
    if(temp>75){score+=15;factors.push({t:'Temp critique: '+temp+'°C',c:'r'});}
    else if(temp>65){score+=8;factors.push({t:'Temp élevée: '+temp+'°C',c:'y'});}
    else factors.push({t:'Temp normale: '+temp+'°C',c:'g'});
  }
  // Conntrack (flood/scan détection)
  var total=(flows&&flows.total)||0;
  if(total>3000){score+=20;factors.push({t:'Flood possible: '+total+' connexions',c:'r'});}
  else if(total>1000){score+=10;factors.push({t:'Trafic anormal: '+total+' connexions',c:'y'});}
  else if(total>500){score+=5;}
  // WAN upload spike (exfiltration potentielle)
  var wanTx=wan.tx_kbps||0;
  if(wanTx>10000){score+=15;factors.push({t:'Upload WAN élevé: '+fmtKbps(wanTx),c:'r'});}
  else if(wanTx>5000){score+=8;factors.push({t:'Upload WAN suspect: '+fmtKbps(wanTx),c:'y'});}
  score=Math.min(score,100);
  var level,col;
  if(score>=70){level='CRITIQUE';col='#ff3b5c';}
  else if(score>=45){level='ÉLEVÉ';col='#ff6b35';}
  else if(score>=20){level='MODÉRÉ';col='#ffd700';}
  else{level='NOMINAL';col='#00d964';}
  return{score:score,level:level,color:col,factors:factors};
}

function drawAttackHeatmap(canvas, reqH, blkH, errH, customH, progress, livePhase){
  if(!canvas)return;
  var ep=progress===undefined?1:(1-Math.pow(1-Math.min(1,progress),4));
  var W=canvas.offsetWidth, H=customH||82;
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  var nowH=new Date().getHours();
  var hours=[];
  for(var hi=0;hi<24;hi++){
    var k=(hi<10?'0':'')+hi+':00';
    hours.push({h:hi,req:reqH[k]||0,atk:(blkH[k]||0)+(errH[k]||0)});
  }
  var maxReq=Math.max.apply(null,hours.map(function(d){return d.req;}))||1;
  var peakIdx=hours.reduce(function(pi,d,i){return d.req>hours[pi].req?i:pi;},0);
  var pH=H-16;
  // Marge gauche pour axe Y
  var xOff=28; var plotW=W-xOff; var cW=plotW/24;
  // Axe Y — lignes de référence + labels
  var yTicks=[{y:0,v:maxReq},{y:pH/4,v:Math.round(maxReq*0.75)},{y:pH/2,v:Math.round(maxReq*0.5)},{y:pH*3/4,v:Math.round(maxReq*0.25)},{y:pH,v:0}];
  ctx.font='7px "Courier New"';ctx.textAlign='right';
  yTicks.forEach(function(t){
    // Ligne grille
    ctx.strokeStyle= t.y===0||t.y===pH ?'rgba(0,217,255,0.08)':'rgba(255,255,255,0.04)';
    ctx.lineWidth=0.5;
    ctx.beginPath();ctx.moveTo(xOff,t.y);ctx.lineTo(W,t.y);ctx.stroke();
    // Tick
    ctx.strokeStyle='rgba(122,154,184,0.3)';
    ctx.beginPath();ctx.moveTo(xOff-3,t.y);ctx.lineTo(xOff,t.y);ctx.stroke();
    // Label
    if(t.y===0||t.y===pH){ctx.fillStyle='rgba(0,217,255,0.7)';}
    else{ctx.fillStyle='rgba(122,154,184,0.55)';}
    var ly=t.y===0?7:t.y===pH?pH-1:t.y+3;
    ctx.fillText(_rcFmtV(t.v),xOff-5,ly);
  });
  // Axe Y — trait vertical
  ctx.strokeStyle='rgba(122,154,184,0.15)';ctx.lineWidth=0.5;
  ctx.beginPath();ctx.moveTo(xOff,0);ctx.lineTo(xOff,pH);ctx.stroke();
  // Colonne heure courante — highlight fond
  var curX=xOff+nowH*cW;
  ctx.fillStyle='rgba(0,217,255,0.04)';
  ctx.fillRect(curX,0,cW,pH);
  ctx.strokeStyle='rgba(0,217,255,0.12)';ctx.lineWidth=0.5;
  ctx.strokeRect(curX,0,cW,pH);
  // Grid verticale heure par heure
  ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=0.5;
  for(var gi=1;gi<24;gi++){var gx=xOff+gi*cW;ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,pH);ctx.stroke();}
  var labelStep=cW>=18?1:cW>=9?2:cW>=6?3:6;
  hours.forEach(function(d,i){
    var x=xOff+i*cW;
    var isCur=(i===nowH);
    var isPeak=(i===peakIdx&&d.req>0);
    var rh=Math.round(d.req/maxReq*pH*ep);
    if(rh>0){
      var g=ctx.createLinearGradient(0,pH-rh,0,pH);
      if(isPeak){g.addColorStop(0,'rgba(0,217,255,0.9)');g.addColorStop(1,'rgba(0,217,255,0.18)');}
      else if(isCur){g.addColorStop(0,'rgba(0,217,255,0.65)');g.addColorStop(1,'rgba(0,217,255,0.10)');}
      else{g.addColorStop(0,'rgba(0,217,255,0.42)');g.addColorStop(1,'rgba(0,217,255,0.06)');}
      ctx.fillStyle=g;ctx.fillRect(x+0.5,pH-rh,cW-1,rh);
      if(isPeak){
        ctx.shadowColor='rgba(0,217,255,0.6)';ctx.shadowBlur=8;
        ctx.fillStyle='rgba(0,217,255,0.85)';ctx.fillRect(x+0.5,pH-rh,cW-1,rh);
        ctx.shadowBlur=0;
        if(ep>=0.98){
          ctx.fillStyle='rgba(0,217,255,1)';ctx.font='bold 8px "Courier New"';
          ctx.textAlign='center';
          var lbl=d.req>999?(d.req/1000).toFixed(1)+'k':d.req+'';
          var lx=x+cW/2,ly=pH-rh-4;if(ly<9)ly=pH-rh+9;
          ctx.fillText(lbl,lx,ly);
        }
      }
    }
    var ah=Math.round(d.atk/maxReq*pH*ep);
    if(ah>1){
      ctx.fillStyle='rgba(255,59,92,0.52)';ctx.fillRect(x+0.5,pH-ah,cW-1,ah);
      ctx.fillStyle='rgba(255,59,92,0.9)';ctx.fillRect(x+0.5,pH-ah,cW-1,1);
    }
    // Animation live — heure en cours de collecte
    if(isCur && livePhase!==undefined){
      var pulse=0.5+0.5*Math.sin(livePhase*Math.PI*2);
      var colTop=rh>0?pH-rh:pH-6;
      // Scan line blanche descendante (contraste sur fond cyan)
      var scanY=colTop+(livePhase%1)*(pH-colTop-1);
      ctx.save();
      ctx.shadowColor='rgba(255,255,255,0.9)';ctx.shadowBlur=2+pulse*6;
      ctx.fillStyle='rgba(255,255,255,'+(0.35+pulse*0.40)+')';
      ctx.fillRect(x+1,scanY,cW-2,2);
      ctx.restore();
      // Bord supérieur pulsant (blanc avec glow)
      if(rh>0){
        ctx.save();
        ctx.shadowColor='rgba(255,255,255,0.8)';ctx.shadowBlur=2+pulse*10;
        ctx.strokeStyle='rgba(255,255,255,'+(0.55+pulse*0.45)+')';
        ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(x+1,pH-rh);ctx.lineTo(x+cW-1,pH-rh);ctx.stroke();
        ctx.restore();
      }
    }
    if(d.h%labelStep===0){
      var lc=isCur?'rgba(0,217,255,1)':'rgba(122,154,184,0.65)';
      ctx.fillStyle=lc;ctx.font=(isCur?'bold ':'')+'8px "Courier New"';
      ctx.textAlign='center';ctx.fillText(d.h+'h',x+cW/2,H-3);
      ctx.strokeStyle=isCur?'rgba(0,217,255,0.4)':'rgba(122,154,184,0.25)';ctx.lineWidth=0.5;
      ctx.beginPath();ctx.moveTo(x+cW/2,pH);ctx.lineTo(x+cW/2,pH+3);ctx.stroke();
    }
  });
  ctx.textAlign='left';
  ctx.fillStyle='rgba(0,217,255,0.12)';ctx.fillRect(xOff,pH,plotW,1);
  // Zone J-1 — overlay après les barres (données fenêtre glissante J-1)
  if(nowH<23){
    var j1X=xOff+(nowH+1)*cW;
    var j1W=W-j1X;
    ctx.fillStyle='rgba(0,0,0,0.58)';
    ctx.fillRect(j1X,0,j1W,pH);
    // Label J-1
    ctx.fillStyle='rgba(122,154,184,0.45)';
    ctx.font='bold 7px "Courier New"';
    ctx.textAlign='center';
    ctx.fillText('J-1',j1X+j1W/2,pH/2);
    ctx.textAlign='left';
  }
  // Ligne NOW
  var nx=xOff+(nowH+1)*cW;
  ctx.strokeStyle='rgba(0,217,255,0.55)';ctx.lineWidth=1;
  ctx.setLineDash([3,3]);
  ctx.beginPath();ctx.moveTo(nx,0);ctx.lineTo(nx,pH);ctx.stroke();
  ctx.setLineDash([]);
  // Point "live" en bas de la ligne NOW
  ctx.shadowColor='rgba(0,217,255,0.9)';ctx.shadowBlur=6;
  ctx.fillStyle='rgba(0,217,255,1)';
  ctx.beginPath();ctx.arc(nx,pH-2,2.5,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  // Label NOW
  ctx.fillStyle='rgba(0,217,255,0.85)';ctx.font='bold 7px "Courier New"';
  ctx.textAlign='center';ctx.fillText('NOW',nx,8);
  ctx.textAlign='left';
}
function animateAttackHeatmap(canvas, reqH, blkH, errH, customH){
  var dur=700, start=null, liveStart=null;
  function frame(ts){
    if(!start)start=ts;
    var p=(ts-start)/dur;
    drawAttackHeatmap(canvas,reqH,blkH,errH,customH,Math.min(1,p));
    if(p<1){requestAnimationFrame(frame);}
    else{requestAnimationFrame(live);}
  }
  function live(ts){
    if(!canvas.isConnected)return;
    if(!liveStart)liveStart=ts;
    drawAttackHeatmap(canvas,reqH,blkH,errH,customH,1,((ts-liveStart)%1500)/1500);
    requestAnimationFrame(live);
  }
  requestAnimationFrame(frame);
}
function drawReqCurve(canvas,rphArr,bphArr){
  if(!canvas||!rphArr||!rphArr.length)return;
  var W=canvas.offsetWidth||canvas.clientWidth||300;
  var H=parseInt(canvas.getAttribute('height'))||170;
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');
  var n=rphArr.length;
  var maxV=0;
  for(var i=0;i<n;i++){maxV=Math.max(maxV,(rphArr[i]||0)+(bphArr&&bphArr[i]?bphArr[i]:0));}
  if(!maxV)maxV=1;
  var botPad=20,topPad=10,availH=H-botPad-topPad;

  // Horizontal grid lines (fines)
  ctx.lineWidth=0.5;
  [0.25,0.5,0.75,1].forEach(function(f){
    var y=H-botPad-availH*f;
    ctx.strokeStyle='rgba(0,217,255,0.06)';
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
    ctx.fillStyle='rgba(122,154,184,0.28)';ctx.font='7px "Courier New"';ctx.textAlign='left';
    ctx.fillText(fmt(Math.round(maxV*f)),3,y-2);
  });
  // Vertical grid ticks every 6h
  for(var vi=0;vi<n;vi+=6){
    ctx.strokeStyle='rgba(0,217,255,0.04)';ctx.lineWidth=0.5;
    ctx.beginPath();ctx.moveTo(_rcPx(vi,n,W),topPad);ctx.lineTo(_rcPx(vi,n,W),H-botPad);ctx.stroke();
  }
  // Baseline
  ctx.strokeStyle='rgba(0,217,255,0.18)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,H-botPad);ctx.lineTo(W,H-botPad);ctx.stroke();

  // Build point arrays
  var rPts=rphArr.map(function(v,i){return[_rcPx(i,n,W),_rcPy(v,H,botPad,maxV,availH)];});
  var bPts=(bphArr||[]).map(function(v,i){return[_rcPx(i,n,W),_rcPy(v,H,botPad,maxV,availH)];});

  // Draw: blocks behind, requests in front
  if(bPts.length)_rcDrawArea(ctx,bPts,'255,107,53',0.38,W,H,botPad,topPad);
  _rcDrawArea(ctx,rPts,'0,217,255',0.32,W,H,botPad,topPad);
  if(bPts.length)_rcDrawLine(ctx,bPts,'255,107,53',1.6,14);
  _rcDrawLine(ctx,rPts,'0,217,255',2.2,18);

  // Glowing live dots on latest point
  [[rPts,'0,217,255'],[bPts,'255,107,53']].forEach(function(pair){
    var pts=pair[0],rgb=pair[1];
    if(!pts||!pts.length)return;
    var lp=pts[pts.length-1];
    // Outer halo
    ctx.beginPath();ctx.arc(lp[0],lp[1],7,0,Math.PI*2);
    ctx.fillStyle='rgba('+rgb+',0.12)';ctx.fill();
    // Inner dot
    ctx.beginPath();ctx.arc(lp[0],lp[1],3,0,Math.PI*2);
    ctx.fillStyle='rgba('+rgb+',1)';
    ctx.shadowColor='rgba('+rgb+',1)';ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;
  });

  // X-axis hour labels
  ctx.fillStyle='rgba(122,154,184,0.5)';ctx.font='8px "Courier New"';ctx.textAlign='center';
  for(var i=0;i<n;i+=6){ctx.fillText(i+'h',_rcPx(i,n,W),H-5);}
  if(n>1)ctx.fillText((n-1)+'h',W-2,H-5);
}

// ── PROTOCOLES DONUT ────────────────────────────────────────────────────────
var _protoAnim=null;
var PROTO_DEF=[
  {k:'HTTPS',     l:'HTTPS',      desc:'Trafic chiffré TLS légitime',      c:'#00d9ff',  grp:'ok'},
  {k:'ASSETS',    l:'ASSETS',     desc:'Ressources statiques CSS/JS/img',  c:'#00ff88',  grp:'ok'},
  {k:'HTTP',      l:'HTTP',       desc:'Trafic HTTP brut non redirigé (bots/scans port 80)',c:'#f59e0b', grp:'watch'},
  {k:'HTTP_REDIRECT',l:'REDIRECT',desc:'Redirection HTTP → HTTPS (301/302 légitimes)',      c:'#94a3b8', grp:'ok'},
  {k:'NOT_FOUND', l:'404',        desc:'Ressource introuvable — scan de paths probable',c:'#8b5cf6',grp:'watch'},
  {k:'ERROR_5XX', l:'5XX',        desc:'Erreur interne serveur (5xx)',      c:'#dc2626',  grp:'watch'},
  {k:'LEGIT_BOT', l:'LEGIT-BOT',  desc:'Robot identifié (Googlebot, Bing)',  c:'#22d3ee', grp:'watch'},
  {k:'GEO_BLOCK', l:'GEO-BLOCK',  desc:'IP bloquée par règle GeoIP2',      c:'#f97316',  grp:'threat'},
  {k:'CLOSED',    l:'CLOSED',     desc:'Connexion fermée sans réponse (444)',c:'#ef4444', grp:'threat'},
  {k:'RATE_LIMIT',l:'RATE-LIMIT', desc:'Limite de taux dépassée (429)',     c:'#ff6b6b',  grp:'threat'},
  {k:'BOT',       l:'BOT',        desc:'Robot non identifié / suspect',     c:'#3b82f6',  grp:'threat'},
  {k:'SCANNER',   l:'SCANNER',    desc:'Outil de scan ou exploit détecté',  c:'#ff3b5c',  grp:'threat'},
  {k:'OTHER',     l:'AUTRE',      desc:'Requête non classifiée',            c:'rgba(100,130,155,0.7)',grp:'other'},
  // ── Suricata IDS réseau (SUR_*) ──────────────────────────────────────────
  {k:'SUR_DNS',  l:'DNS',        desc:'Suricata — requêtes DNS observées',   c:'#00ff88',  grp:'sur'},
  {k:'SUR_HTTP', l:'S-HTTP',     desc:'Suricata — trafic HTTP analysé',      c:'#f59e0b',  grp:'sur'},
  {k:'SUR_TLS',  l:'TLS/SSL',    desc:'Suricata — flux TLS/SSL (JA3 inclus)',c:'#00d9ff',  grp:'sur'},
  {k:'SUR_SSH',  l:'SSH-NET',    desc:'Suricata — sessions SSH réseau',      c:'#8b5cf6',  grp:'sur'},
  {k:'SUR_FLOW', l:'FLOW',       desc:'Suricata — flux réseau total',        c:'#64748b',  grp:'sur'},
  {k:'SUR_SCAN', l:'SCAN-NET',   desc:'Suricata — port scan NMAP détecté',   c:'#ff3b5c',  grp:'sur_threat'},
  {k:'SUR_C2',   l:'C2/TROJAN',  desc:'Suricata — C2 Feodo/Trojan sév.1',   c:'#dc2626',  grp:'sur_threat'},
];
// NDT-85 : draw(t) RAF loops promus module-level
function _clDrawProtoDonut(canvas,W,H,active,total,centerLbl,speed,t){
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  var cx=W/2,cy=H/2,R=Math.min(W,H)/2-Math.round(W*0.09),r=R*0.54;
  var off=t*speed;
  active.forEach(function(p){
    var a0=p._start+off,a1=a0+p._sweep;
    ctx.save();
    ctx.shadowBlur=12;ctx.shadowColor=p.c;
    ctx.globalAlpha=0.9;
    ctx.fillStyle=p.c;
    ctx.beginPath();
    ctx.arc(cx,cy,R,a0,a1);
    ctx.arc(cx,cy,r,a1,a0,true);
    ctx.closePath();ctx.fill();
    ctx.restore();
  });
  var g=ctx.createRadialGradient(cx,cy,r-6,cx,cy,r+5);
  g.addColorStop(0,'rgba(0,217,255,0.07)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r+5,0,Math.PI*2);ctx.fill();
  var fs=Math.round(W*0.09);
  ctx.fillStyle='rgba(0,217,255,0.85)';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold '+fs+'px "Courier New"';ctx.fillText(fmt(total),cx,cy-Math.round(W*0.055));
  ctx.fillStyle='rgba(122,154,184,0.45)';ctx.font=Math.round(W*0.043)+'px "Courier New"';ctx.fillText(centerLbl,cx,cy+Math.round(W*0.05));
  _protoAnim=requestAnimationFrame(function(ts){_clDrawProtoDonut(canvas,W,H,active,total,centerLbl,speed,ts);});
}
function _clDrawProtoModalDonut(canvas,W,H,cx,cy,R,r,active,proto,total,lbl,RLINE,RLBL,TICK,fsBig,fsSml,t){
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  var phase=t*0.0007;
  active.forEach(function(p){
    var pulse=(Math.sin(phase+p._mid*2)*0.5+0.5)*0.05;
    ctx.save();
    ctx.shadowBlur=16+pulse*12;ctx.shadowColor=p.c;
    ctx.globalAlpha=0.87+pulse*0.07;
    ctx.fillStyle=p.c;
    ctx.beginPath();
    ctx.arc(cx,cy,R,p._start,p._start+p._sweep);
    ctx.arc(cx,cy,r,p._start+p._sweep,p._start,true);
    ctx.closePath();ctx.fill();
    ctx.restore();
  });
  var g=ctx.createRadialGradient(cx,cy,r-8,cx,cy,r+10);
  g.addColorStop(0,'rgba(0,217,255,0.08)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r+10,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.globalAlpha=0.04;ctx.strokeStyle='rgba(0,217,255,1)';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(cx,cy,R+W*0.055,0,Math.PI*2);ctx.stroke();ctx.restore();
  var fsT=Math.min(Math.round(W*0.058),40),fsL=Math.min(Math.round(W*0.036),26);
  ctx.fillStyle='rgba(0,217,255,0.92)';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold '+fsT+'px "Courier New"';ctx.fillText(fmt(total),cx,cy-Math.round(W*0.03));
  ctx.fillStyle='rgba(122,154,184,0.5)';ctx.font=fsL+'px "Courier New"';
  ctx.fillText(lbl||'REQ',cx,cy+Math.round(W*0.03));
  active.forEach(function(p){
    var pct=(proto[p.k]||0)*100/total;
    if(pct<1.0)return;
    var cosA=Math.cos(p._mid),sinA=Math.sin(p._mid);
    var x0=cx+RLINE*cosA,y0=cy+RLINE*sinA;
    var x1=cx+RLBL*cosA, y1=cy+RLBL*sinA;
    var isR=cosA>=-0.10;
    var td=isR?TICK:-TICK;
    ctx.save();
    ctx.strokeStyle=p.c;ctx.globalAlpha=0.38;ctx.lineWidth=0.9;
    ctx.setLineDash([2,3]);
    ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha=0.8;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x1+td,y1);ctx.stroke();
    ctx.restore();
    ctx.save();ctx.fillStyle=p.c;ctx.globalAlpha=0.9;
    ctx.beginPath();ctx.arc(x1+td+(isR?1:-1),y1,2.5,0,Math.PI*2);ctx.fill();ctx.restore();
    var tx=x1+td+(isR?5:-5);
    ctx.save();
    ctx.globalAlpha=0.93;
    ctx.textAlign=isR?'left':'right';ctx.textBaseline='middle';
    ctx.fillStyle=p.c;
    ctx.font='bold '+fsBig+'px "Courier New"';
    ctx.fillText(p.l,tx,y1-fsBig*0.78);
    ctx.fillStyle='rgba(185,215,240,0.62)';
    ctx.font=fsSml+'px "Courier New"';
    ctx.fillText(fmt(proto[p.k]||0)+'  '+Math.round(pct)+'%',tx,y1+fsSml*0.62);
    ctx.restore();
  });
  _protoAnim=requestAnimationFrame(function(ts){_clDrawProtoModalDonut(canvas,W,H,cx,cy,R,r,active,proto,total,lbl,RLINE,RLBL,TICK,fsBig,fsSml,ts);});
}

function drawProtocolDonut(canvas,proto,lbl,filterFn){
  if(!canvas)return;
  if(_protoAnim){cancelAnimationFrame(_protoAnim);_protoAnim=null;}
  var sz=parseInt(canvas.getAttribute('width'))||160;
  var W=sz;var H=sz;
  canvas.width=W;canvas.height=H;
  var defs=filterFn?PROTO_DEF.filter(filterFn):PROTO_DEF;
  var active=defs.filter(function(p){return (proto[p.k]||0)>0;});
  var total=active.reduce(function(s,p){return s+(proto[p.k]||0);},0);
  var centerLbl=lbl||'REQ';
  if(!total){
    var ctx=canvas.getContext('2d');
    ctx.strokeStyle='rgba(0,217,255,0.06)';ctx.lineWidth=Math.round(W*0.13);
    ctx.beginPath();ctx.arc(W/2,H/2,Math.min(W,H)/2-Math.round(W*0.14),0,Math.PI*2);ctx.stroke();
    return;
  }
  var rot=[-Math.PI/2];
  var GAP=0.025;
  var avail=Math.PI*2-GAP*active.length;
  active.forEach(function(p){
    var sweep=((proto[p.k]||0)/total)*avail;
    rot.push(rot[rot.length-1]+sweep+GAP);
    p._start=rot[rot.length-2]+GAP/2;
    p._sweep=Math.max(sweep-GAP,0.001);
  });
  var speed=0.0012;
  requestAnimationFrame(function(ts){_clDrawProtoDonut(canvas,W,H,active,total,centerLbl,speed,ts);});
}
// ── Suricata → proto dict (clés SUR_*) ──────────────────────────────────────
function buildSurProtoDict(sur){
  if(!sur||!sur.available)return {};
  var ev=sur.events||{};
  var scanHits=(sur.recent_scans||[]).reduce(function(a,s){return a+(s.count||0);},0);
  return {
    SUR_DNS:  ev.dns  ||0,
    SUR_HTTP: ev.http ||0,
    SUR_TLS:  ev.tls  ||0,
    SUR_SSH:  ev.ssh  ||0,
    SUR_FLOW: ev.flow ||0,
    SUR_SCAN: scanHits,
    SUR_C2:   (sur.sev1_critical||0),
  };
}
// ── Barre Suricata réseau dans la tuile protocoles ───────────────────────────
function buildSuricataProtoBar(sur){
  if(!sur||!sur.available)return '';
  var sd=buildSurProtoDict(sur);
  var items=[
    {k:'SUR_DNS', col:'#00ff88'},{k:'SUR_HTTP',col:'#f59e0b'},
    {k:'SUR_TLS', col:'#00d9ff'},{k:'SUR_SSH', col:'#8b5cf6'},
    {k:'SUR_FLOW',col:'#64748b'},
  ];
  var threats=[];
  if(sd.SUR_SCAN>0) threats.push('<span style="padding:.1rem .35rem;background:rgba(255,59,92,0.15);border:1px solid rgba(255,59,92,0.45);border-radius:2px;font-size:var(--fs-sm);color:#ff3b5c;font-weight:700">SCAN '+sd.SUR_SCAN+'hits</span>');
  if(sd.SUR_C2>0)   threats.push('<span style="padding:.1rem .35rem;background:rgba(220,38,38,0.2);border:1px solid rgba(220,38,38,0.55);border-radius:2px;font-size:var(--fs-sm);color:#dc2626;font-weight:700">C2/TROJAN ×'+sd.SUR_C2+'</span>');
  var chips=items.filter(function(i){return sd[i.k]>0;}).map(function(i){
    var def=PROTO_DEF.find(function(p){return p.k===i.k;})||{l:i.k};
    return '<span style="padding:.1rem .3rem;background:rgba(0,0,0,0.25);border:1px solid '+i.col+'44;border-radius:2px;font-size:var(--fs-sm);color:'+i.col+'">'
      +def.l+' <b>'+fmt(sd[i.k])+'</b></span>';
  }).join('');
  return '<div style="margin-top:.5rem;border-top:1px solid rgba(0,217,255,0.1);padding-top:.45rem">'
    +'<div style="font-size:var(--fs-sm);color:rgba(0,217,255,0.4);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.3rem">◈ Suricata réseau</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:.25rem;align-items:center">'
    +chips
    +(threats.length?'<span style="margin-left:.2rem;display:flex;gap:.2rem">'+threats.join('')+'</span>':'')
    +'</div></div>';
}
function buildProtoLegend(proto){
  var active=PROTO_DEF.filter(function(p){return (proto[p.k]||0)>0;});
  var total=active.reduce(function(s,p){return s+(proto[p.k]||0);},0);
  if(!total)return '';
  var sorted=active.slice().sort(function(a,b){return (proto[b.k]||0)-(proto[a.k]||0);});
  return '<div class="proto-legend">'+sorted.map(function(p){
    var v=proto[p.k]||0;
    var pct=Math.round(v*100/total);
    var bw=Math.max(3,pct)+'%';
    return '<div class="proto-row">'
      +'<span class="proto-dot" style="background:'+p.c+';box-shadow:0 0 5px '+p.c+'"></span>'
      +'<span class="proto-lbl">'+p.l+'</span>'
      +'<div class="proto-bar-wrap"><div class="proto-bar" style="width:'+bw+';background:'+p.c+'22;border-right:2px solid '+p.c+'"></div></div>'
      +'<span class="proto-val" style="color:'+p.c+'">'+fmt(v)+'</span>'
      +'<span class="proto-pct">'+pct+'%</span>'
      +'<span class="proto-desc">'+p.desc+'</span>'
      +'</div>';
  }).join('')+'</div>';
}

function buildProtoThreatGauge(proto){
  var total=PROTO_DEF.reduce(function(s,p){return s+(proto[p.k]||0);},0);
  if(!total)return '';
  var threat=0,ok=0,watch=0;
  PROTO_DEF.forEach(function(p){
    var v=proto[p.k]||0;
    if(p.grp==='threat')threat+=v;
    else if(p.grp==='ok')ok+=v;
    else if(p.grp==='watch')watch+=v;
  });
  var pTh=Math.round(threat*100/total),pOk=Math.round(ok*100/total),pW=Math.round(watch*100/total);
  return '<div class="proto-threat-gauge">'
    +'<div class="proto-tg-title">ANALYSE DU TRAFIC</div>'
    +'<div class="proto-tg-row"><span class="proto-tg-lbl">LÉGITIMES</span>'
    +'<div class="proto-tg-bar-wrap"><div class="proto-tg-bar" style="width:'+pOk+'%;background:var(--cyan)"></div></div>'
    +'<span class="proto-tg-val" style="color:var(--cyan)">'+pOk+'%</span></div>'
    +'<div class="proto-tg-row"><span class="proto-tg-lbl">SURVEILLANCE</span>'
    +'<div class="proto-tg-bar-wrap"><div class="proto-tg-bar" style="width:'+pW+'%;background:var(--amber)"></div></div>'
    +'<span class="proto-tg-val" style="color:var(--amber)">'+pW+'%</span></div>'
    +'<div class="proto-tg-row"><span class="proto-tg-lbl">MENACES</span>'
    +'<div class="proto-tg-bar-wrap"><div class="proto-tg-bar" style="width:'+pTh+'%;background:var(--sev-critical)"></div></div>'
    +'<span class="proto-tg-val" style="color:var(--sev-critical)">'+pTh+'%</span></div>'
    +'<div class="proto-tg-legend">'
    +'<div class="proto-tg-leg-item"><span class="proto-tg-leg-dot" style="background:var(--cyan)"></span><span>LÉGITIMES — Visites réelles navigateurs (2xx / 3xx)</span></div>'
    +'<div class="proto-tg-leg-item"><span class="proto-tg-leg-dot" style="background:var(--amber)"></span><span>SURVEILLANCE — Monitoring interne, APIs, crawlers connus</span></div>'
    +'<div class="proto-tg-leg-item"><span class="proto-tg-leg-dot" style="background:var(--sev-critical)"></span><span>MENACES — Connexions bloquées (444 · GeoIP 403 · Rate-limit 429)</span></div>'
    +'</div>'
    +'</div>';
}

function buildProtoTopThreats(proto){
  var active=PROTO_DEF.filter(function(p){return (proto[p.k]||0)>0;});
  var total=active.reduce(function(s,p){return s+(proto[p.k]||0);},0);
  if(!total)return '';
  var threats=active.filter(function(p){return p.grp==='threat';})
    .sort(function(a,b){return (proto[b.k]||0)-(proto[a.k]||0);}).slice(0,3);
  var innerHtml=!threats.length
    ?'<span class="proto-top-badge safe">✓ Aucune menace</span>'
    :threats.map(function(p){
      var v=proto[p.k]||0,pct=Math.round(v*100/total);
      return '<span class="proto-top-badge threat">'
        +'<span style="color:'+p.c+';font-weight:700">'+p.l+'</span>'
        +' <span style="color:rgba(122,154,184,0.6)">'+v+' ('+pct+'%)</span>'
        +'</span>';
    }).join('');
  return '<div class="proto-top" id="proto-top-row"><span class="proto-top-lbl">⚡ Menaces :</span>'+innerHtml+'</div>';
}
function buildProtoModalLegend(proto){
  var total=PROTO_DEF.reduce(function(s,p){return s+(proto[p.k]||0);},0);
  if(!total)return '';
  var groups=[
    {id:'ok',     lbl:'LÉGITIMES',    col:'#00d9ff'},
    {id:'watch',  lbl:'SURVEILLANCE', col:'#f59e0b'},
    {id:'threat', lbl:'MENACES',      col:'#ef4444'},
    {id:'other',  lbl:'AUTRES',       col:'rgba(100,130,155,0.6)'},
  ];
  return groups.map(function(grp){
    var items=PROTO_DEF.filter(function(p){return p.grp===grp.id&&(proto[p.k]||0)>0;});
    if(!items.length)return '';
    items.sort(function(a,b){return (proto[b.k]||0)-(proto[a.k]||0);});
    var itemsHtml=items.map(function(p){
      var v=proto[p.k]||0;
      var pct=Math.round(v*100/total);
      var bw=Math.max(3,pct)+'%';
      return '<div class="proto-row-modal">'
        +'<span class="proto-dot" style="background:'+p.c+';box-shadow:0 0 5px '+p.c+'"></span>'
        +'<span class="proto-lbl">'+p.l+'</span>'
        +'<div class="proto-bar-wrap"><div class="proto-bar" style="width:'+bw+';background:'+p.c+'22;border-right:2px solid '+p.c+'"></div></div>'
        +'<span class="proto-val" style="color:'+p.c+'">'+fmt(v)+'</span>'
        +'<span class="proto-pct">'+pct+'%</span>'
        +'</div>'
        +'<div class="proto-desc" style="grid-column:2/6">'+p.desc+'</div>';
    }).join('');
    return '<div class="proto-group-hdr" style="color:'+grp.col+'">'+grp.lbl+'</div>'+itemsHtml;
  }).join('');
}

function drawProtoSpark(canvas,buckets){
  if(!canvas||!buckets)return;
  var keys=Object.keys(buckets).sort();
  var vals=keys.map(function(k){return buckets[k]||0;});
  if(!vals.length)return;
  var W=canvas.offsetWidth||300,H=40;
  canvas.width=W;canvas.height=H;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  var mx=Math.max.apply(null,vals)||1;
  var step=W/(vals.length-1||1);
  ctx.beginPath();
  vals.forEach(function(v,i){
    var x=i*step,y=H-2-(v/mx)*(H-6);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.strokeStyle='rgba(0,217,255,0.55)';ctx.lineWidth=1.5;ctx.stroke();
  // fill
  ctx.lineTo((vals.length-1)*step,H);ctx.lineTo(0,H);ctx.closePath();
  ctx.fillStyle='rgba(0,217,255,0.06)';ctx.fill();
  // labels first/last
  ctx.fillStyle='rgba(122,154,184,0.4)';ctx.font='8px "Courier New"';ctx.textAlign='left';
  if(keys[0])ctx.fillText(keys[0],2,H-2);
  ctx.textAlign='right';
  if(keys[keys.length-1])ctx.fillText(keys[keys.length-1],W-2,H-2);
}

function drawProtoModalDonut(canvas,proto,lbl){
  if(!canvas)return;
  if(_protoAnim){cancelAnimationFrame(_protoAnim);_protoAnim=null;}
  var sz=parseInt(canvas.getAttribute('data-sz'))||460;
  var W=sz,H=sz;
  canvas.width=W;canvas.height=H;
  var active=PROTO_DEF.filter(function(p){return (proto[p.k]||0)>0;});
  var total=active.reduce(function(s,p){return s+(proto[p.k]||0);},0);
  if(!total){
    var ctx=canvas.getContext('2d');
    ctx.strokeStyle='rgba(0,217,255,0.06)';ctx.lineWidth=Math.round(W*0.055);
    ctx.beginPath();ctx.arc(W/2,H/2,W*0.29,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(0,217,255,0.22)';ctx.font='bold '+Math.round(W*0.055)+'px "Courier New",monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('0',W/2,H/2-Math.round(W*0.04));
    ctx.font=Math.round(W*0.033)+'px "Courier New",monospace';
    ctx.fillStyle='rgba(122,154,184,0.35)';
    ctx.fillText(lbl||'REQ',W/2,H/2+Math.round(W*0.055));
    return;
  }
  var cx=W/2,cy=H/2;
  // R réduit à 0.255 pour laisser room aux étiquettes (évite le clipping)
  var R=W*0.255,r=R*0.54;
  var GAP=0.020;
  var avail=Math.PI*2-GAP*active.length;
  var angle=-Math.PI/2;
  active.forEach(function(p){
    var sweep=((proto[p.k]||0)/total)*avail;
    p._start=angle+GAP/2;
    p._sweep=Math.max(sweep-GAP,0.001);
    p._mid=angle+GAP/2+p._sweep/2;
    angle+=sweep+GAP;
  });
  // Tailles de police plafonnées
  var fsBig=Math.min(Math.round(W*0.022),15);
  var fsSml=Math.min(Math.round(W*0.019),13);
  // Zone orbite : RLINE→RLBL→tick→texte doit tenir dans W/2
  var RLINE=R+W*0.018;
  var RLBL=R+W*0.058;   // W*0.255+W*0.058 = W*0.313
  var TICK=Math.min(W*0.025,16); // tick fixe max 16px
  // Marge max texte (longueur "GEO-BLOCK" = 9 chars * ~0.62*fsBig)
  // W*0.313 + TICK + 5 + 9*0.62*fsBig ≤ W/2
  // → OK si fsBig≤15 et W≥400
  requestAnimationFrame(function(ts){_clDrawProtoModalDonut(canvas,W,H,cx,cy,R,r,active,proto,total,lbl,RLINE,RLBL,TICK,fsBig,fsSml,ts);});
}

function decodeTopoJSON(topo){
  var t=topo.transform,sx=t.scale[0],sy=t.scale[1],tx=t.translate[0],ty=t.translate[1];
  var arcs=topo.arcs.map(function(arc){
    var x=0,y=0;
    return arc.map(function(pt){x+=pt[0];y+=pt[1];return[x*sx+tx,y*sy+ty];});
  });
  var polys=[],geoms=topo.objects.land.geometries;
  geoms.forEach(function(g){
    var ms=g.type==='Polygon'?[g.arcs]:g.arcs;
    ms.forEach(function(rings){
      rings.forEach(function(ring){
        var pts=[];
        ring.forEach(function(ai){
          var a=ai>=0?arcs[ai]:arcs[~ai].slice().reverse();
          for(var i=0;i<a.length-1;i++)pts.push(a[i]);
        });
        if(pts.length>2)polys.push(pts);
      });
    });
  });
  return polys;
}
(function(){
  var xhr=new XMLHttpRequest();
  xhr.open('GET','/world.json');
  xhr.timeout=8000;
  xhr.ontimeout=function(){if(location.hostname==='localhost')console.warn('world.json timeout');};
  xhr.onerror=function(){if(location.hostname==='localhost')console.warn('world.json error');};
  xhr.onload=function(){
    if(xhr.status!==200)return;
    var raw=xhr.responseText;
    // Décoder hors du rendu courant pour ne pas bloquer l'UI
    setTimeout(function(){
      try{
        _worldPolygons=decodeTopoJSON(JSON.parse(raw));
        _mapStaticCanvas=null;
        if(_lfLastGeoips&&_lfLastGeoips.length)drawGeoMap(_lfLastGeoips,null,_lfLastWanIp);
      }catch(e){if(location.hostname==='localhost')console.error('world.json',e);}
    },0);
  };
  xhr.send();
})();

// NDT-92/93/94 — déclarés dans 01-utils.js : _lfMapTip / _lfLastGeoips / _lfLastWanIp
function updateThreatFeed(geoips){
  var list=document.getElementById('threat-feed-list');
  if(!list)return;
  var blocked=geoips.filter(function(g){return g.blocked||g.cs_banned;});
  blocked.sort(function(a,b){
    var wa=(a.cs_banned?2:0)+(a.blocked?1:0);
    var wb=(b.cs_banned?2:0)+(b.blocked?1:0);
    return wb!==wa?wb-wa:b.count-a.count;
  });
  list.innerHTML=blocked.slice(0,7).map(function(g,i){
    var dotCol=g.cs_banned?'#ff6b35':'#ff3b5c';
    var sc=g.cs_banned&&g.cs_scenario
      ?'<span style="font-size:var(--fs-sm);color:#ff6b35;background:rgba(255,107,53,0.15);padding:.05rem .3rem;border-radius:2px;margin-left:.2rem">⊛'+esc(_csLabel(g.cs_scenario,12))+'</span>'
      :'';
    return '<li class="threat-feed-item" style="animation-delay:'+(i*0.07)+'s">'
      +'<span class="tf-dot" style="background:'+dotCol+';box-shadow:0 0 4px '+dotCol+'"></span>'
      +'<span class="tf-ip">'+esc(g.ip)+'</span>'
      +'<span class="tf-cc">['+esc(g.country)+']</span>'
      +'<span class="tf-cnt">×'+g.count+'</span>'
      +sc
      +'</li>';
  }).join('');
}
