'use strict';
function _gmToX(lon,zb,W){return (lon-zb.lon0)/(zb.lon1-zb.lon0)*W;}
function _gmToY(lat,zb,H){return (zb.lat1-lat)/(zb.lat1-zb.lat0)*H;}
function _gmHudHdr(ctx,hc,label,x,w){ctx.font='bold 6px "Courier New"';ctx.fillStyle='rgba(0,217,255,0.62)';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(label,x+8,hc+4);ctx.fillStyle='rgba(0,217,255,0.18)';ctx.fillRect(x+8,hc+13,Math.min((w||80)-16,64),0.7);}
function _gmHudSep(ctx,hc,H,x){ctx.save();ctx.shadowBlur=4;ctx.shadowColor='rgba(0,217,255,0.12)';ctx.strokeStyle='rgba(0,217,255,0.16)';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(x,hc+2);ctx.lineTo(x,H-4);ctx.stroke();ctx.restore();}
function drawGeoMap(geoips, targetCanvas, wanInfo){
  var canvas = targetCanvas || document.getElementById('geomap');
  if(!canvas) return;
  _lfMapTip = document.getElementById('map-tip');

  var animKey = targetCanvas ? 'modal' : 'main';
  if(_mapAnimFrames[animKey]){ cancelAnimationFrame(_mapAnimFrames[animKey]); delete _mapAnimFrames[animKey]; }

  var W = canvas.offsetWidth, H = canvas.offsetHeight;
  if(W===0||H===0) return;
  var dpr = Math.min(window.devicePixelRatio||1, 2);
  if(canvas.width!==W*dpr||canvas.height!==H*dpr){ canvas.width=W*dpr; canvas.height=H*dpr; }

  // Projection zone courante
  var _z=window._mapZone||'MONDE';
  var _zb=_MAP_ZONES[_z]||_MAP_ZONES['MONDE'];
  // === COUCHE STATIQUE (offscreen) — cache si W/H/polygones inchangés ===
  var sc, sctx;
  if(_mapStaticCanvas && _mapStaticW===W && _mapStaticH===H && _mapStaticPoly===_worldPolygons && _mapStaticZone===_z && _mapStaticDpr===dpr){
    sc=_mapStaticCanvas; sctx=sc.getContext('2d');
  } else {
  sc = document.createElement('canvas');
  sc.width = W*dpr; sc.height = H*dpr;
  sctx = sc.getContext('2d');
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var bg = sctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#030812'); bg.addColorStop(0.5,'#060d1a'); bg.addColorStop(1,'#04080f');
  sctx.fillStyle=bg; sctx.fillRect(0,0,W,H);

  // Graticule
  sctx.strokeStyle='rgba(0,150,200,0.07)'; sctx.lineWidth=0.5;
  for(var glon=-180;glon<=180;glon+=30){
    sctx.beginPath(); sctx.moveTo(_gmToX(glon,_zb,W),0); sctx.lineTo(_gmToX(glon,_zb,W),H); sctx.stroke();
  }
  for(var glat=-90;glat<=90;glat+=30){
    sctx.beginPath(); sctx.moveTo(0,_gmToY(glat,_zb,H)); sctx.lineTo(W,_gmToY(glat,_zb,H)); sctx.stroke();
  }
  sctx.strokeStyle='rgba(0,180,230,0.14)'; sctx.lineWidth=0.8;
  sctx.beginPath(); sctx.moveTo(0,_gmToY(0,_zb,H)); sctx.lineTo(W,_gmToY(0,_zb,H)); sctx.stroke();
  sctx.beginPath(); sctx.moveTo(_gmToX(0,_zb,W),0); sctx.lineTo(_gmToX(0,_zb,W),H); sctx.stroke();

  // Dot grid océan (dessiné avant les continents — recouvert par la terre)
  sctx.fillStyle='rgba(0,150,210,0.038)';
  for(var _dy=8;_dy<H;_dy+=18){
    for(var _dx=8;_dx<W;_dx+=18){
      sctx.beginPath();sctx.arc(_dx,_dy,0.9,0,Math.PI*2);sctx.fill();
    }
  }

  // Continents
  var landSrc = _worldPolygons && _worldPolygons.length ? _worldPolygons : [
    [[-168,71],[-140,72],[-120,74],[-90,75],[-75,74],[-60,63],[-52,47],[-66,44],[-70,42],[-75,35],[-80,25],[-82,29],[-90,29],[-97,26],[-97,20],[-88,16],[-85,11],[-83,10],[-78,8],[-80,9],[-86,13],[-90,15],[-104,19],[-117,32],[-122,37],[-124,47],[-130,54],[-140,60],[-152,58],[-162,61],[-168,55],[-168,71]],
    [[-80,12],[-77,8],[-76,1],[-73,-4],[-60,-5],[-50,2],[-35,-5],[-35,-10],[-38,-13],[-43,-22],[-44,-23],[-52,-34],[-57,-38],[-62,-51],[-68,-55],[-74,-51],[-76,-38],[-76,-34],[-70,-18],[-75,-8],[-80,0],[-80,12]],
    [[-9,37],[-5,36],[0,39],[3,42],[5,44],[8,44],[14,36],[22,37],[26,37],[28,41],[37,37],[38,44],[32,46],[22,46],[20,45],[19,49],[15,53],[14,54],[10,58],[5,58],[5,53],[2,51],[0,50],[-5,48],[-10,44],[-9,37]],
    [[5,58],[8,58],[12,57],[18,57],[22,57],[24,59],[28,60],[30,63],[28,68],[22,71],[17,70],[14,68],[8,63],[5,62],[5,58]],
    [[-6,36],[0,37],[10,37],[22,37],[33,30],[37,22],[43,14],[50,12],[44,11],[40,-5],[36,-18],[35,-26],[20,-35],[16,-34],[0,-34],[-5,-10],[-17,0],[-17,15],[-10,15],[-5,37],[-6,36]],
    [[26,44],[36,37],[37,36],[44,36],[50,24],[56,24],[60,22],[65,22],[72,22],[77,8],[80,8],[88,22],[96,22],[100,4],[105,1],[106,-4],[115,-8],[120,-2],[122,10],[122,24],[120,31],[122,37],[125,35],[132,40],[140,46],[143,55],[140,60],[130,55],[120,53],[100,55],[90,55],[80,60],[70,60],[60,50],[46,46],[42,40],[38,44],[26,44]],
    [[114,-22],[122,-18],[126,-15],[131,-11],[137,-12],[144,-14],[148,-18],[151,-22],[153,-28],[151,-34],[148,-38],[140,-38],[130,-33],[120,-33],[115,-30],[114,-22]],
    [[-73,82],[-20,83],[-15,75],[-15,60],[-46,60],[-60,66],[-73,82]]
  ];
  landSrc.forEach(function(p){
    sctx.beginPath();
    sctx.moveTo(_gmToX(p[0][0],_zb,W),_gmToY(p[0][1],_zb,H));
    for(var i=1;i<p.length;i++) sctx.lineTo(_gmToX(p[i][0],_zb,W),_gmToY(p[i][1],_zb,H));
    sctx.closePath();
    sctx.fillStyle='rgba(8,36,78,0.72)'; sctx.fill();
    sctx.strokeStyle='rgba(0,155,215,0.45)'; sctx.lineWidth=0.7; sctx.stroke();
  });
  // Lignes CRT (static, couche semi-transparente sur tout le canvas)
  sctx.fillStyle='rgba(0,0,0,0.055)';
  for(var _sl=0;_sl<H;_sl+=3){sctx.fillRect(0,_sl,W,1);}
  _mapStaticCanvas=sc; _mapStaticW=W; _mapStaticH=H; _mapStaticPoly=_worldPolygons; _mapStaticZone=_z; _mapStaticDpr=dpr;
  } // end cache miss

  // === DONNÉES DOTS ===
  var dots = [];
  geoips.forEach(function(ip){
    // Coordonnées précises (lat/lon GeoLite2-City) → fallback centroïde pays
    var lat = ip.lat != null ? ip.lat : (CENTROIDS[ip.country] ? CENTROIDS[ip.country][0] : null);
    var lon = ip.lon != null ? ip.lon : (CENTROIDS[ip.country] ? CENTROIDS[ip.country][1] : null);
    if(lat == null || lon == null) return;
    var x=_gmToX(lon,_zb,W), y=_gmToY(lat,_zb,H);
    var r = Math.max(3, Math.min(8, 2+Math.log(ip.count+1)));
    var csB=ip.cs_banned||false;
    var stage=ip.kc_stage||ip.cs_stage||null;
    // Couleur par stage Kill Chain (priorité sur blocked/CS/pays)
    var color,rgb;
    var _kcp=stage?KC_PALETTE[stage]:null;
    if(_kcp)                 {color=_kcp.color;rgb=_kcp.rgb;}
    else if(ip.blocked||csB) {color=KC_PALETTE.BRUTE.color;rgb=KC_PALETTE.BRUTE.rgb;}
    else if(ip.country==='FR'){color=KC_PALETTE.BLOCKED.color;rgb=KC_PALETTE.BLOCKED.rgb;}
    else                     {color='#00d9ff';rgb='0,217,255';}
    dots.push({x:x,y:y,r:r,color:color,rgb:rgb,ip:ip.ip,country:ip.country,blocked:ip.blocked,cs_banned:csB,cs_scenario:ip.cs_scenario||'',stage:stage||'',count:ip.count,phase:_ipHash(ip.ip)});
  });

  // === PRÉ-CALCUL TOP ATTAQUANTS (panel HUD) ===
  var _atkMap={};
  dots.filter(function(d){return d.blocked;}).forEach(function(d){
    _atkMap[d.country]=(_atkMap[d.country]||0)+d.count;
  });
  var _topAtk=Object.keys(_atkMap).map(function(k){return{cc:k,n:_atkMap[k]};})
    .sort(function(a,b){return b.n-a.n;}).slice(0,5);
  var _atkMax=_topAtk.length?_topAtk[0].n:1;

  // === BOUCLE D'ANIMATION ===
  var ctx = canvas.getContext('2d');
  var startT = performance.now();

  var _mapLastDraw=0;
  function frame(ts){
    _mapAnimFrames[animKey]=requestAnimationFrame(frame);
    if(ts-_mapLastDraw<33)return; // ~30fps
    _mapLastDraw=ts;
    var elapsed = ts - startT;

    // 1. Fond statique
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(sc, 0, 0, W, H);

    // === SWEEP SCANLINE (cyber) ===
    var _swY=((elapsed*0.03)%H);
    ctx.fillStyle='rgba(0,217,255,0.04)';ctx.fillRect(0,_swY,W,2);
    ctx.fillStyle='rgba(0,217,255,0.015)';ctx.fillRect(0,_swY+2,W,4);

    // === GLOW PAYS ATTAQUANTS ===
    dots.filter(function(d){return d.blocked;}).slice(0,12).forEach(function(d){
      var _gi=Math.min(1,d.count/60);
      var _gr=32+_gi*22;
      var _gg=ctx.createRadialGradient(d.x,d.y,0,d.x,d.y,_gr);
      _gg.addColorStop(0,'rgba('+d.rgb+','+(0.18+_gi*0.14).toFixed(2)+')');
      _gg.addColorStop(1,'rgba('+d.rgb+',0)');
      ctx.fillStyle=_gg;ctx.beginPath();ctx.arc(d.x,d.y,_gr,0,Math.PI*2);ctx.fill();
    });

    // === CIBLE (point défendu) ===
    var frX=_gmToX(SOC_INFRA.WAN_LON,_zb,W), frY=_gmToY(SOC_INFRA.WAN_LAT,_zb,H);
    var frPulse=(Math.sin(elapsed*0.002)+1)*0.5;
    var _frFlash=window._mapFrFlash||0;
    // 3 anneaux pulsants concentriques
    [[14,0.65,1],[22,0.45,1],[34,0.22,0.7]].forEach(function(o,i){
      ctx.beginPath();ctx.arc(frX,frY,o[0]+frPulse*(3-i),0,Math.PI*2);
      ctx.strokeStyle='rgba(0,255,136,'+o[1].toFixed(2)+')';
      ctx.lineWidth=o[2];ctx.stroke();
    });
    // Ripple flash impact (arrivée des particules)
    if(_frFlash>0){
      var _ff=Math.min(1,_frFlash/200);
      ctx.beginPath();ctx.arc(frX,frY,16+_ff*30,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,255,200,'+(_ff*0.85).toFixed(2)+')';ctx.lineWidth=1.5;ctx.stroke();
      window._mapFrFlash=Math.max(0,_frFlash-33);
    }
    var ch=10;
    ctx.strokeStyle='rgba(0,255,136,0.7)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(frX-ch,frY);ctx.lineTo(frX-4,frY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(frX+4,frY);ctx.lineTo(frX+ch,frY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(frX,frY-ch);ctx.lineTo(frX,frY-4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(frX,frY+4);ctx.lineTo(frX,frY+ch);ctx.stroke();
    // Tirets radar rotatifs autour de la cible
    var _frA=elapsed*0.0008;
    ctx.save();ctx.translate(frX,frY);ctx.rotate(_frA);
    ctx.strokeStyle='rgba(0,255,136,0.28)';ctx.lineWidth=0.7;
    for(var _fri=0;_fri<4;_fri++){ctx.save();ctx.rotate(_fri*Math.PI/2);ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(0,-26);ctx.stroke();ctx.restore();}
    ctx.restore();
    ctx.beginPath();ctx.arc(frX,frY,3,0,Math.PI*2);
    ctx.fillStyle='#00ff88';ctx.shadowColor='#00ff88';ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;
    ctx.font='bold 8px Courier New';ctx.fillStyle='rgba(0,255,136,0.65)';
    ctx.fillText('PROTECTED',frX+13,frY+3);

    // === ARCS D'ATTAQUE (blocked → France) ===
    var blocked=dots.filter(function(d){return d.blocked;});
    blocked.sort(function(a,b){return b.count-a.count;});
    blocked.slice(0,25).forEach(function(d,idx){
      var cpx=(d.x+frX)/2;
      var rawCpy=Math.min(d.y,frY)-(Math.abs(frX-d.x)*0.22+20);
      var cpy=Math.max(rawCpy, 4);
      var arcOpacity=Math.min(0.5, 0.28+d.count*0.012);
      ctx.beginPath();ctx.moveTo(d.x,d.y);
      ctx.quadraticCurveTo(cpx,cpy,frX,frY);
      ctx.strokeStyle='rgba(255,59,92,'+arcOpacity.toFixed(2)+')';ctx.lineWidth=1.0;ctx.stroke();
      var period=2.8+(idx%5)*0.4;
      var prog=((elapsed*0.001/period)+idx*0.23)%1;
      if(prog>0.95){window._mapFrFlash=Math.max(window._mapFrFlash||0,200);}
      for(var _pk=0;_pk<4;_pk++){
        var _pt=((prog-_pk*0.045)+1)%1;
        var _pfade=_pt<0.1?_pt*10:(_pt>0.9?(1-_pt)*10:1);
        var _ppx=(1-_pt)*(1-_pt)*d.x+2*(1-_pt)*_pt*cpx+_pt*_pt*frX;
        var _ppy=(1-_pt)*(1-_pt)*d.y+2*(1-_pt)*_pt*cpy+_pt*_pt*frY;
        ctx.beginPath();ctx.arc(_ppx,_ppy,Math.max(0.6,2-_pk*0.3),0,Math.PI*2);
        ctx.fillStyle='rgba(255,59,92,'+((1-_pk*0.22)*0.9*_pfade).toFixed(2)+')';
        ctx.shadowColor='#ff3b5c';ctx.shadowBlur=_pk===0?8:2;ctx.fill();ctx.shadowBlur=0;
      }
    });

    // === ARCS CROWDSEC (cs_banned → France) — orange ===
    var csBanned=dots.filter(function(d){return d.cs_banned;});
    csBanned.sort(function(a,b){return b.count-a.count;});
    csBanned.slice(0,15).forEach(function(d,idx){
      var cpx=(d.x+frX)/2;
      var rawCpy=Math.min(d.y,frY)-(Math.abs(frX-d.x)*0.22+20);
      var cpy=Math.max(rawCpy,4);
      var arcOpacity=Math.min(0.65,0.35+d.count*0.015);
      ctx.beginPath();ctx.moveTo(d.x,d.y);
      ctx.quadraticCurveTo(cpx,cpy,frX,frY);
      ctx.strokeStyle='rgba(255,107,53,'+arcOpacity.toFixed(2)+')';ctx.lineWidth=1.3;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);
      var period=2.2+(idx%5)*0.35;
      var prog=((elapsed*0.001/period)+idx*0.31)%1;
      if(prog>0.95){window._mapFrFlash=Math.max(window._mapFrFlash||0,160);}
      for(var _pk=0;_pk<3;_pk++){
        var _pt=((prog-_pk*0.05)+1)%1;
        var _pfade=_pt<0.1?_pt*10:(_pt>0.9?(1-_pt)*10:1);
        var _ppx=(1-_pt)*(1-_pt)*d.x+2*(1-_pt)*_pt*cpx+_pt*_pt*frX;
        var _ppy=(1-_pt)*(1-_pt)*d.y+2*(1-_pt)*_pt*cpy+_pt*_pt*frY;
        ctx.beginPath();ctx.arc(_ppx,_ppy,Math.max(0.8,2.5-_pk*0.4),0,Math.PI*2);
        ctx.fillStyle='rgba(255,107,53,'+((1-_pk*0.28)*0.95*_pfade).toFixed(2)+')';
        ctx.shadowColor='#ff6b35';ctx.shadowBlur=_pk===0?10:2;ctx.fill();ctx.shadowBlur=0;
      }
    });

    // === ARCS STAGE / HONEYPOT (dots avec kc_stage → France) — couleur par stage ===
    var STAGE_ARC_COLOR={'BRUTE':'255,59,92','EXPLOIT':'255,215,0','SCAN':'255,107,53','RECON':'191,95,255'};
    var stageDots=dots.filter(function(d){return d.stage&&!d.cs_banned&&!d.blocked;});
    stageDots.sort(function(a,b){
      var so=['RECON','SCAN','EXPLOIT','BRUTE'];
      return so.indexOf(b.stage)-so.indexOf(a.stage);
    });
    stageDots.slice(0,12).forEach(function(d,idx){
      var rgb=STAGE_ARC_COLOR[d.stage]||'191,95,255';
      var cpx=(d.x+frX)/2;
      var rawCpy=Math.min(d.y,frY)-(Math.abs(frX-d.x)*0.18+14);
      var cpy=Math.max(rawCpy,4);
      var arcOpacity=Math.min(0.5,0.25+d.count*0.01);
      ctx.beginPath();ctx.moveTo(d.x,d.y);
      ctx.quadraticCurveTo(cpx,cpy,frX,frY);
      ctx.strokeStyle='rgba('+rgb+','+arcOpacity.toFixed(2)+')';ctx.lineWidth=1;ctx.setLineDash([2,4]);ctx.stroke();ctx.setLineDash([]);
      // Trail de particules sur l'arc
      var period=3.2+(idx%5)*0.4;
      var prog=((elapsed*0.001/period)+idx*0.19)%1;
      if(prog>0.95){window._mapFrFlash=Math.max(window._mapFrFlash||0,100);}
      for(var _pk=0;_pk<3;_pk++){
        var _pt=((prog-_pk*0.04)+1)%1;
        var _pfade=_pt<0.1?_pt*10:(_pt>0.9?(1-_pt)*10:1);
        var _ppx=(1-_pt)*(1-_pt)*d.x+2*(1-_pt)*_pt*cpx+_pt*_pt*frX;
        var _ppy=(1-_pt)*(1-_pt)*d.y+2*(1-_pt)*_pt*cpy+_pt*_pt*frY;
        ctx.beginPath();ctx.arc(_ppx,_ppy,Math.max(0.5,1.8-_pk*0.35),0,Math.PI*2);
        ctx.fillStyle='rgba('+rgb+','+((1-_pk*0.3)*0.85*_pfade).toFixed(2)+')';
        ctx.shadowColor='rgba('+rgb+',0.8)';ctx.shadowBlur=_pk===0?6:2;ctx.fill();ctx.shadowBlur=0;
      }
    });

    // 3. Anneaux pulsants + dots
    // Pré-calcul : label visible seulement si aucun voisin dans 42px
    var _lblOk=dots.map(function(d,i){
      for(var j=0;j<dots.length;j++){
        if(i===j)continue;
        var dx=d.x-dots[j].x,dy=d.y-dots[j].y;
        if(dx*dx+dy*dy<1764)return false; // 42² = 1764
      }
      return true;
    });
    dots.forEach(function(d,_di){
      var t = (elapsed*0.001 + d.phase) % 2.5;
      // Anneau statique permanent (toujours visible)
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r+4,0,Math.PI*2);
      ctx.strokeStyle='rgba('+d.rgb+',0.45)';
      ctx.lineWidth=0.8; ctx.stroke();
      // Deux ondes expansives décalées
      for(var w=0;w<2;w++){
        var wt=(t+w*1.25)%2.5;
        if(wt<2){
          var rr=d.r+wt*10;
          var al2=(1-wt/2)*0.65;
          ctx.beginPath(); ctx.arc(d.x,d.y,rr,0,Math.PI*2);
          ctx.strokeStyle='rgba('+d.rgb+','+al2.toFixed(3)+')';
          ctx.lineWidth=0.8; ctx.stroke();
        }
      }
      // Point
      ctx.fillStyle=d.color; ctx.shadowColor=d.color; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      // Label pays + count + stage (dots avec stage ou bloqués, si pas trop proche d'un voisin)
      if((d.blocked||d.cs_banned||d.stage)&&_lblOk[_di]){
        ctx.save();
        ctx.font='bold 10px "Courier New"'; /* ≈--fs-xs */
        ctx.textAlign='left'; ctx.textBaseline='middle';
        ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=3;
        ctx.fillStyle='rgba('+d.rgb+',0.95)';
        var lbl=d.country+(d.count>1?' ×'+d.count:'');
        if(d.stage){lbl+=' ['+d.stage+']';}
        if(d.cs_banned&&d.cs_scenario){lbl+=' ⊛'+_csLabel(d.cs_scenario,14);}
        ctx.fillText(lbl, d.x+d.r+4, d.y);
        ctx.restore();
      }
    });

    // === COMPTEUR LIVE STAGES (coin haut-droit) ===
    var _kc=(window._lastData&&window._lastData.kill_chain)||{};
    var _sc=_kc.stage_counts||{};
    var _stages=[
      {k:'BRUTE',  sym:'⊗', rgb:'255,59,92'},
      {k:'EXPLOIT',sym:'✕', rgb:'255,215,0'},
      {k:'SCAN',   sym:'◆', rgb:'255,107,53'},
      {k:'RECON',  sym:'⬡', rgb:'191,95,255'},
    ];
    ctx.save();
    ctx.font='bold 9px "Courier New"'; /* ≈--fs-xs */
    var _stgW=84, _stgH=8+_stages.length*13+6, _stgX=W-_stgW-8, _stgY=8;
    ctx.fillStyle='rgba(2,8,20,0.68)';
    ctx.strokeStyle='rgba(0,217,255,0.12)';ctx.lineWidth=0.7;
    ctx.beginPath();ctx.rect(_stgX,_stgY,_stgW,_stgH);ctx.fill();ctx.stroke();
    ctx.font='bold 8px "Courier New"';ctx.fillStyle='rgba(0,217,255,0.45)';
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('KILL CHAIN',_stgX+6,_stgY+4);
    _stages.forEach(function(s,i){
      var cnt=_sc[s.k]||0;
      var pulse=cnt>0?(Math.sin(elapsed*0.003+i)+1)*0.5:0;
      var alpha=cnt>0?(0.7+pulse*0.3):0.2;
      ctx.font='bold 9px "Courier New"';
      ctx.fillStyle='rgba('+s.rgb+','+alpha.toFixed(2)+')';
      ctx.textAlign='left';ctx.textBaseline='middle';
      var _ly=_stgY+15+i*13;
      ctx.fillText(s.sym+' '+s.k,_stgX+6,_ly);
      ctx.textAlign='right';
      ctx.fillText(cnt,_stgX+_stgW-6,_ly);
    });
    ctx.restore();

    // === BADGE WAN IP + TOP ATTAQUANTS (tile uniquement — remplacés par HUD en modal) ===
    if(animKey!=='modal'){
    // === BADGE WAN IP — bas centre (style TOP ATTAQUANTS) ===
    if(wanInfo&&wanInfo.ip){
      var wPulse=(Math.sin(elapsed*0.0025)+1)*0.5;
      var _wip=wanInfo.ip+(wanInfo.city?' · '+wanInfo.city:'');
      ctx.save();
      ctx.font='bold 7px "Courier New"';
      var _whdrW=ctx.measureText('▶ WAN').width;
      ctx.font='bold 8px "Courier New"';
      var _wipW=ctx.measureText(_wip).width;
      var _wbw=Math.max(_whdrW,_wipW)+18;
      var _wbh=28, _wby=H-34, _wbx=Math.round(W/2-_wbw/2);
      ctx.fillStyle='rgba(2,8,20,0.72)';
      ctx.strokeStyle='rgba(255,59,92,'+(0.28+wPulse*0.18)+')';ctx.lineWidth=0.8;
      ctx.beginPath();ctx.rect(_wbx,_wby,_wbw,_wbh);ctx.fill();ctx.stroke();
      // Header "▶ WAN"
      ctx.font='bold 6.5px "Courier New"';ctx.textAlign='left';ctx.textBaseline='top';
      ctx.fillStyle='rgba(255,80,100,0.75)';
      ctx.fillText('▶ WAN',_wbx+6,_wby+4);
      // IP + ville
      ctx.font='bold 8px "Courier New"';ctx.textBaseline='bottom';
      ctx.fillStyle='rgba(255,160,170,0.95)';
      ctx.fillText(_wip,_wbx+6,_wby+_wbh-4);
      ctx.restore();
    } else {
      // === ALERTE WAN NON DÉTECTÉ ===
      var _waPulse=(Math.sin(elapsed*0.004)+1)*0.5;
      var _waLbl='⚠ WAN NON DÉTECTÉ';
      ctx.save();
      ctx.font='bold 8px "Courier New"';
      var _waW=ctx.measureText(_waLbl).width+20;
      var _waH=22, _waY=H-32, _waX=Math.round(W/2-_waW/2);
      ctx.fillStyle='rgba(2,8,20,0.80)';
      ctx.strokeStyle='rgba(255,165,0,'+(0.4+_waPulse*0.5)+')';ctx.lineWidth=1;
      ctx.beginPath();ctx.rect(_waX,_waY,_waW,_waH);ctx.fill();ctx.stroke();
      ctx.font='bold 8px "Courier New"';ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,165,0,'+(0.7+_waPulse*0.3)+')';
      ctx.fillText(_waLbl,_waX+10,_waY+_waH/2);
      ctx.restore();
    }

    // === PANEL TOP ATTAQUANTS (coin bas-gauche) ===
    if(_topAtk.length){
      var _pw=138,_rh=12,_ph=16+_topAtk.length*_rh+6;
      var _px=10,_py=H-10;
      ctx.save();
      ctx.fillStyle='rgba(2,8,20,0.72)';
      ctx.strokeStyle='rgba(255,59,92,0.28)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.rect(_px,_py-_ph,_pw,_ph); ctx.fill(); ctx.stroke();
      ctx.fillStyle='rgba(255,80,100,0.75)'; ctx.font='bold 6.5px "Courier New"';
      ctx.textAlign='left'; ctx.textBaseline='top'; ctx.shadowBlur=0;
      ctx.fillText('▶ TOP ATTAQUANTS', _px+5, _py-_ph+4);
      _topAtk.forEach(function(a,i){
        var _ry=_py-_ph+16+i*_rh;
        var _bw=Math.round((a.n/_atkMax)*(_pw-52));
        ctx.fillStyle='rgba(255,59,92,0.12)';
        ctx.fillRect(_px+28,_ry,_bw,_rh-3);
        ctx.fillStyle='rgba(255,59,92,0.55)';
        ctx.fillRect(_px+28+_bw-1.5,_ry,1.5,_rh-3);
        ctx.fillStyle='rgba(255,160,170,0.95)'; ctx.font='bold 7px "Courier New"';
        ctx.fillText(a.cc, _px+5, _ry);
        ctx.fillStyle='rgba(185,215,240,0.65)'; ctx.font='6.5px "Courier New"';
        ctx.fillText('×'+a.n, _px+28+_bw+4, _ry);
      });
      ctx.restore();
    }
    } // end if(animKey!=='modal')

    // === HUD PLEINE LARGEUR (modal uniquement) ===
    if(animKey==='modal'){
      var _hh=110, _hy=H-_hh, _hc=_hy;

      // Fond HUD — gradient vertical subtil
      var _hudGrad=ctx.createLinearGradient(0,_hy,0,H);
      _hudGrad.addColorStop(0,'rgba(4,14,30,0.94)');_hudGrad.addColorStop(1,'rgba(1,5,14,0.97)');
      ctx.fillStyle=_hudGrad;ctx.fillRect(0,_hy,W,_hh);

      // Liseret supérieur avec glow subtil
      ctx.save();ctx.shadowBlur=10;ctx.shadowColor='rgba(0,217,255,0.2)';
      ctx.strokeStyle='rgba(0,217,255,0.38)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,_hy);ctx.lineTo(W,_hy);ctx.stroke();ctx.restore();

      // Fondu cyan sous la bordure (inner glow)
      var _igGrad=ctx.createLinearGradient(0,_hy,0,_hy+10);
      _igGrad.addColorStop(0,'rgba(0,217,255,0.05)');_igGrad.addColorStop(1,'rgba(0,217,255,0)');
      ctx.fillStyle=_igGrad;ctx.fillRect(0,_hy,W,10);


      // Données HUD
      var _kcd=(window._lastData&&window._lastData.kill_chain)||{};
      var _scc=_kcd.stage_counts||{};
      var _hudStages=[{k:'BRUTE',rgb:'255,59,92'},{k:'EXPLOIT',rgb:'255,215,0'},{k:'SCAN',rgb:'255,107,53'},{k:'RECON',rgb:'191,95,255'}];
      var _maxStg=Math.max(1,_hudStages.reduce(function(m,s){return Math.max(m,_scc[s.k]||0);},0));
      var _scenMap={};
      dots.filter(function(d){return d.cs_scenario;}).forEach(function(d){_scenMap[d.cs_scenario]=(_scenMap[d.cs_scenario]||0)+d.count;});
      var _topScen=Object.keys(_scenMap).map(function(k){return{s:k,n:_scenMap[k]};}).sort(function(a,b){return b.n-a.n;}).slice(0,5);
      var _scenMax=_topScen.length?_topScen[0].n:1;
      var _blkTot=dots.filter(function(d){return d.blocked||d.cs_banned;}).length;
      var _f2bOnly=dots.filter(function(d){return d.blocked&&!d.cs_banned;}).length;
      var _csOnly=dots.filter(function(d){return d.cs_banned;}).length;
      var _blkRate=dots.length?Math.round(_blkTot/dots.length*100):0;
      var _kr=dots.length?Math.round(_blkTot/dots.length*100)+'%':'—';

      // Colonnes (base = _hc)
      var _col1w=Math.floor(W*0.20),_col2w=Math.floor(W*0.26),_col3w=Math.floor(W*0.25);
      var _cx=[0,_col1w,_col1w+_col2w,_col1w+_col2w+_col3w];
      // — COL 1 : KILL CHAIN —
      _gmHudHdr(ctx,_hc,'◈ KILL CHAIN',_cx[0],_col1w);
      _hudStages.forEach(function(s,i){
        var cnt=_scc[s.k]||0;
        var bw=cnt>0?Math.max(4,Math.round((cnt/_maxStg)*(_col1w-72))):0;
        var _by=_hc+18+i*17;
        ctx.font='bold 6.5px "Courier New"';ctx.fillStyle='rgba('+s.rgb+',0.85)';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText(s.k,_cx[0]+8,_by+6);
        if(bw>0){ctx.fillStyle='rgba('+s.rgb+',0.18)';ctx.fillRect(_cx[0]+56,_by+1,bw,10);}
        ctx.fillStyle='rgba('+s.rgb+',0.7)';ctx.fillRect(_cx[0]+56,_by+1,2,10);
        if(bw>2)ctx.fillRect(_cx[0]+56+bw-2,_by+1,2,10);
        ctx.font='bold 7px "Courier New"';ctx.fillStyle='rgba('+s.rgb+',0.95)';ctx.textAlign='right';
        ctx.fillText(cnt||'0',_cx[1]-8,_by+6);
      });
      _gmHudSep(ctx,_hc,H,_cx[1]);

      // — COL 2 : TOP PAYS —
      _gmHudHdr(ctx,_hc,'◈ TOP PAYS ATTAQUANTS',_cx[1],_col2w);
      _topAtk.slice(0,5).forEach(function(a,i){
        var bw=Math.round((a.n/_atkMax)*(_col2w-68));
        var _by=_hc+18+i*14;
        ctx.font='bold 7px "Courier New"';ctx.fillStyle='rgba(255,160,170,0.9)';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText(a.cc,_cx[1]+8,_by+6);
        if(bw>0){ctx.fillStyle='rgba(255,59,92,0.2)';ctx.fillRect(_cx[1]+34,_by+1,bw,10);}
        ctx.fillStyle='rgba(255,59,92,0.65)';if(bw>0)ctx.fillRect(_cx[1]+34+bw-2,_by+1,2,10);
        ctx.font='6.5px "Courier New"';ctx.fillStyle='rgba(255,160,170,0.7)';ctx.textAlign='right';
        ctx.fillText('×'+a.n,_cx[2]-8,_by+6);
      });
      _gmHudSep(ctx,_hc,H,_cx[2]);

      // — COL 3 : SCÉNARIOS CROWDSEC —
      _gmHudHdr(ctx,_hc,'◈ SCÉNARIOS CROWDSEC',_cx[2],_col3w);
      if(_topScen.length){
        _topScen.forEach(function(sc,i){
          var bw=Math.round((sc.n/_scenMax)*(_col3w-80));
          var _by=_hc+18+i*14;
          var lbl=sc.s.replace(/^crowdsec\//i,'').replace(/^http-ban-/i,'ban ').replace(/^http-/i,'').replace(/^fail2ban-/i,'f2b ').replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();
          if(lbl.length>24)lbl=lbl.substring(0,23)+'…';
          if(bw>0){ctx.fillStyle='rgba(255,107,53,0.12)';ctx.fillRect(_cx[2]+8,_by+1,bw,10);}
          ctx.fillStyle='rgba(255,107,53,0.6)';if(bw>0)ctx.fillRect(_cx[2]+8+bw-1.5,_by+1,1.5,10);
          ctx.font='6.5px "Courier New"';ctx.fillStyle='rgba(255,140,70,0.9)';ctx.textAlign='left';ctx.textBaseline='middle';
          ctx.fillText(lbl,_cx[2]+8,_by+6);
          ctx.font='bold 6.5px "Courier New"';ctx.fillStyle='rgba(255,150,80,0.85)';ctx.textAlign='right';
          ctx.fillText('×'+sc.n,_cx[3]-8,_by+6);
        });
      } else {
        ctx.font='6px "Courier New"';ctx.fillStyle='rgba(0,217,255,0.3)';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText('Aucun scénario actif',_cx[2]+8,_hc+40);
      }
      _gmHudSep(ctx,_hc,H,_cx[3]);

      // — COL 4 : PROTECTION & RÉSEAU —
      _gmHudHdr(ctx,_hc,'◈ PROTECTION & RÉSEAU',_cx[3],W-_cx[3]);
      var _wanRaw=wanInfo&&wanInfo.ip?wanInfo.ip+(wanInfo.city?' · '+wanInfo.city:''):'—';
      var _col4w=W-_cx[3]; var _maxVal=Math.floor(_col4w/4.2);
      var _wan=_wanRaw.length>_maxVal?_wanRaw.slice(0,_maxVal-1)+'…':_wanRaw;
      var _z4hud=window._mapZone||'MONDE';
      var _outZone=_z4hud!=='MONDE'?dots.filter(function(d){return d.x<0||d.x>W||d.y<0||d.y>H;}).length:0;
      var _surveilRaw=dots.length+' IPs · '+Object.keys(_atkMap).length+' pays'+(_outZone?' ('+_outZone+' hors zone)':'');
      var _surveil=_surveilRaw.length>_maxVal?_surveilRaw.slice(0,_maxVal-1)+'…':_surveilRaw;
      var _hudStats=[
        {l:'Surveillance',v:_surveil,c:'185,215,240'},
        {l:'Neutralisées',v:_blkTot+' / '+dots.length+' ('+_blkRate+'%)',c:'255,59,92'},
        {l:'fail2ban',v:'×'+_f2bOnly,c:'255,107,53'},
        {l:'CrowdSec',v:'×'+_csOnly,c:'255,165,0'},
        {l:'Kill Rate',v:_kr,c:'0,255,136'},
        {l:'WAN',v:_wan,c:'255,160,170'}
      ];
      _hudStats.forEach(function(st,i){
        var _by=_hc+14+i*13;
        ctx.font='6px "Courier New"';ctx.fillStyle='rgba('+st.c+',0.5)';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText(st.l,_cx[3]+8,_by+5);
        ctx.save();
        if(st.l==='Kill Rate'||st.l==='Neutralisées'){ctx.shadowBlur=6;ctx.shadowColor='rgba('+st.c+',0.45)';}
        ctx.font='bold 6.5px "Courier New"';ctx.fillStyle='rgba('+st.c+',0.95)';ctx.textAlign='right';
        ctx.fillText(st.v,W-8,_by+5);ctx.restore();
      });
    } // end HUD modal

  }
  _mapAnimFrames[animKey] = requestAnimationFrame(frame);

  // Interaction souris
  canvas.onmousemove = function(e){
    var rect=canvas.getBoundingClientRect();
    var mx=e.clientX-rect.left, my=e.clientY-rect.top;
    var hit=null;
    for(var i=dots.length-1;i>=0;i--){
      var d=dots[i];
      if(Math.sqrt((mx-d.x)*(mx-d.x)+(my-d.y)*(my-d.y))<d.r+10){hit=d;break;}
    }
    if(hit&&_lfMapTip){
      var stageHtml=hit.stage?'<div class="mt-stage" style="color:'+hit.color+'">● '+esc(hit.stage)+'</div>':'';
      var statusHtml=(hit.blocked||hit.cs_banned)?'<span style="color:#ff3b5c">■ BLOQUÉ</span>':'<span style="color:#00ff88">● AUTORISÉ</span>';
      var scenHtml=hit.cs_scenario?'<div class="mt-scen">'+esc(fmtScenario(hit.cs_scenario))+'</div>':'';
      _lfMapTip.innerHTML=stageHtml
        +'<div class="mt-ip">'+esc(hit.ip)+'</div>'
        +'<div class="mt-cc">['+esc(hit.country)+']</div>'
        +'<div class="mt-cnt">'+hit.count+' req &nbsp;'+statusHtml+'</div>'
        +scenHtml;
      var tw=_lfMapTip.offsetWidth||140;
      var lx=e.clientX+14;
      if(lx+tw>window.innerWidth-8)lx=e.clientX-tw-14;
      _lfMapTip.style.left=lx+'px';
      _lfMapTip.style.top=(e.clientY-_lfMapTip.offsetHeight/2)+'px';
      _lfMapTip.classList.add('map-tooltip-visible');
    } else if(_lfMapTip){ _lfMapTip.classList.remove('map-tooltip-visible'); }
  };
  canvas.onmouseleave=function(){if(_lfMapTip)_lfMapTip.classList.remove('map-tooltip-visible');};
  canvas.onclick=function(e){
    e.stopPropagation();
    var rect=canvas.getBoundingClientRect();
    var mx=e.clientX-rect.left, my=e.clientY-rect.top;
    for(var i=dots.length-1;i>=0;i--){
      var d=dots[i];
      if(Math.sqrt((mx-d.x)*(mx-d.x)+(my-d.y)*(my-d.y))<d.r+8){
        if(_lfMapTip)_lfMapTip.classList.remove('map-tooltip-visible');
        openIpModal(d,e);
        break;
      }
    }
  };
}

// _snap et _lastModified déclarés dans 01-utils.js
var _prevAutoBanTs=(function(){try{return localStorage.getItem(_LS_KEYS.PREV_BAN_TS)||'';}catch(e){return'';}})();  // persisté localStorage — survit aux rechargements

function _kcFmtAge(ip){
  var ts=window._kcFirstSeen&&window._kcFirstSeen[ip];
  if(!ts) return '';
  var s=Math.floor((Date.now()-ts)/1000);
  if(s<60) return s+'s';
  if(s<3600) return Math.floor(s/60)+'min';
  return Math.floor(s/3600)+'h'+String(Math.floor((s%3600)/60)).padStart(2,'0')+'m';
}
function _kcFmtDelta(ms){
  var s=Math.floor(ms/1000); if(s<1) return '';
  if(s<60) return s+'s';
  if(s<3600) return Math.floor(s/60)+'min';
  return Math.floor(s/3600)+'h'+String(Math.floor((s%3600)/60)).padStart(2,'0')+'m';
}

function _jarvisSpeak(text){
  // Passe par la queue commune pour éviter les appels parallèles
  if(!text) return;
  var clean = _cleanForTts ? _cleanForTts(text) : text;
  if(_ttsQueue && _ttsQueue.length < _TTS_MAX_Q) _ttsQueue.push(clean);
  if(typeof _ttsFlush === 'function') _ttsFlush();
}

function _checkAutoBanAlerts(abl){
  if(!abl||!abl.length)return;
  var latestTs=abl[0].ts||'';
  if(!latestTs||latestTs===_prevAutoBanTs)return;
  // Nouveaux bans depuis le dernier cycle
  var newBans=_prevAutoBanTs
    ? abl.filter(function(e){return e.ts>_prevAutoBanTs;})
    : abl.slice(0,1);  // 1er cycle : annoncer seulement le plus récent
  _prevAutoBanTs=latestTs;
  try{localStorage.setItem(_LS_KEYS.PREV_BAN_TS,latestTs);}catch(e){}
  if(!newBans.length)return;
  var n=newBans.length;
  var details=newBans.slice(0,3).map(function(e){
    return e.ip+(e.country&&e.country!=='-'?' '+e.country:'');
  }).join(', ');
  var more=n>3?' et '+(n-3)+' autre'+(n>4?'s':''):'';
  var msg='Alerte SOC. '
    +(n===1?'Une IP a été éjectée automatiquement':''+n+' IPs ont été éjectées automatiquement')
    +' par le système proactif. '
    +details+more+'. Durée du ban : vingt-quatre heures.';
  _jarvisSpeak(msg);
}
function _gmTrend(cur,prv,higherIsBad){
  if(prv===undefined||prv===null||prv===0)return'';
  var delta=cur-prv,pct=Math.abs(Math.round(delta/Math.max(Math.abs(prv),1)*100));
  if(pct<8)return'';
  var up=delta>0,bad=(up&&higherIsBad)||(!up&&!higherIsBad);
  return '<span class="tv '+(bad?'tv-ub':'tv-ok')+'">'+(up?'↑':'↓')+(pct<100?pct+'%':'')+'</span>';
}

// ── GEO MODAL ────────────────────────────────────────────────────────────────
function _geoStatBox(lbl,val,col){
  return '<div class="geo-stat-box" style="border-left:2px solid '+col+';box-shadow:inset 0 0 14px '+col+'1a,0 0 10px '+col+'18">'
    +'<div class="geo-stat-lbl"><span style="color:'+col+';text-shadow:0 0 6px '+col+'99;margin-right:.3rem">⊛</span>'+lbl+'</div>'
    +'<div class="geo-stat-val" style="color:'+col+';text-shadow:0 0 10px '+col+'66">'+val+'</div>'
    +'</div>';
}
function openGeoModal(){
  var d=window._lastData;
  if(!d)return;
  var geoips=(d.traffic||{}).recent_geoips||[];
  var kc=d.kill_chain||{};
  var wanIp=d.wan_ip||null;
  var total=geoips.length;
  var blocked=geoips.filter(function(g){return g.blocked;}).length;
  var csBanned=geoips.filter(function(g){return g.cs_banned;}).length;
  var rate=total?Math.round(blocked*100/total):0;
  var ctry={};geoips.forEach(function(g){if(g.country)ctry[g.country]=(ctry[g.country]||0)+(g.count||1);});
  var topCtry=Object.keys(ctry).map(function(k){return{cc:k,n:ctry[k]};}).sort(function(a,b){return b.n-a.n;});
  var scen={};geoips.forEach(function(g){if(g.cs_scenario){var s=g.cs_scenario.replace('crowdsecurity/','');scen[s]=(scen[s]||0)+(g.count||1);}});
  var topScen=Object.keys(scen).map(function(k){return{s:k,n:scen[k]};}).sort(function(a,b){return b.n-a.n;}).slice(0,8);
  var stCs=kc.cs_stage_counts||{};
  var activeIps=kc.active_ips||[];
  var SC={BRUTE:'#ff3b5c',EXPLOIT:'#ffd700',SCAN:'#ff6b35',RECON:'#bf5fff'};
  var stMax=Math.max(stCs.BRUTE||0,stCs.EXPLOIT||0,stCs.SCAN||0,stCs.RECON||0,1);
  // Stats bar
  var statsH='<div class="geo-stats-bar">'
    +_geoStatBox('IPs 24H',''+total,'var(--cyan)')
    +_geoStatBox('BLOQUÉES',blocked+'<span class="geo-stat-sub">('+rate+'%)</span>','#ff3b5c')
    +_geoStatBox('CROWDSEC BAN',''+csBanned,'#ff6b35')
    +_geoStatBox('PAYS DISTINCTS',''+topCtry.length,'var(--cyan)')
    +_geoStatBox('ACTIFS 15MIN',''+(kc.total_active||0),(kc.total_active||0)>5?'#ff3b5c':'#ffd700')
    +_geoStatBox('DÉCISIONS CS',''+(kc.cs_decisions||0),'#bf5fff')
    +'</div>';
  // Kill chain bars
  var kcH='<div class="geo-panel-hdr"><span class="geo-panel-ico">⊙</span>KILL CHAIN — ACTIF 15 MIN</div><div class="geo-kc-bars">'
    +['BRUTE','EXPLOIT','SCAN','RECON'].map(function(s){
        var n=stCs[s]||0,pct=Math.round(n/stMax*100),col=SC[s];
        return '<div class="geo-kc-row"><span class="geo-kc-lbl" style="color:'+col+'">'+s+'</span>'
          +'<div class="geo-kc-track"><div class="geo-kc-fill" style="width:'+Math.min(pct,100)+'%;background:'+col+';box-shadow:0 0 8px '+col+'66"></div></div>'
          +'<span class="geo-kc-val">'+n+'</span></div>';
      }).join('')+'</div>';
  // Top countries
  var cMax=topCtry[0]?topCtry[0].n:1;
  var ctryH='<div class="geo-panel-hdr"><span class="geo-panel-ico">⊙</span>TOP PAYS</div><div class="geo-ctry-list">'
    +topCtry.slice(0,10).map(function(e){
        var pct=Math.round(e.n/cMax*100);
        var blkOf=geoips.filter(function(g){return g.country===e.cc&&g.blocked;}).length;
        var totOf=geoips.filter(function(g){return g.country===e.cc;}).length;
        var bPct=totOf?Math.round(blkOf/totOf*100):0;
        return '<div class="geo-ctry-row"><span class="geo-ctry-cc">'+esc(e.cc)+'</span>'
          +'<div class="geo-ctry-track"><div class="geo-ctry-fill" style="width:'+pct+'%"></div></div>'
          +'<span class="geo-ctry-n">'+e.n+'</span>'
          +'<span class="geo-ctry-bpct" style="color:'+(bPct>70?'#ff3b5c':bPct>40?'#ff6b35':'var(--c-muted-4)')+'">'+bPct+'%</span>'
          +'</div>';
      }).join('')+'</div>';
  // Scenarios
  var sMax=topScen[0]?topScen[0].n:1;
  var scenH='<div class="geo-panel-hdr"><span class="geo-panel-ico">⊙</span>SCÉNARIOS CROWDSEC</div><div class="geo-scen-list">'
    +topScen.map(function(e){
        var pct=Math.round(e.n/sMax*100);
        return '<div class="geo-scen-row"><span class="geo-scen-lbl">'+esc(e.s)+'</span>'
          +'<div class="geo-scen-track"><div class="geo-scen-fill" style="width:'+pct+'%"></div></div>'
          +'<span class="geo-scen-n">'+e.n+'</span></div>';
      }).join('')+'</div>';
  // Active IPs
  var actH='<div class="geo-panel-hdr"><span class="geo-panel-ico">⊙</span>ACTIFS — FENÊTRE '+(kc.window_minutes||15)+'MIN</div>'
    +(activeIps.length
      ?'<div class="geo-active-list">'+activeIps.map(function(ip){
          var col=SC[ip.stage]||'var(--cyan)';
          return '<div class="geo-active-row"><span class="geo-active-ip">'+esc(ip.ip)+'</span>'
            +'<span class="geo-active-cc">'+esc(ip.country||'?')+'</span>'
            +'<span class="geo-active-stage" style="color:'+col+'">'+esc(ip.stage)+'</span>'
            +(ip.cs_decision?'<span class="geo-active-cs">▣CS</span>':'<span></span>')
            +'</div>';
        }).join('')+'</div>'
      :'<div class="geo-empty">Aucune IP active dans la fenêtre.</div>');
  // IP table (top 60)
  var sorted=geoips.slice().sort(function(a,b){return(b.count||0)-(a.count||0);}).slice(0,60);
  var ipH='<div class="geo-panel-hdr"><span class="geo-panel-ico">⊙</span>TOP 60 IPs — 24H</div>'
    +'<div class="geo-ip-hdr"><span>IP</span><span>CC</span><span>Ville</span><span>Req</span><span>Stade</span><span>Scénario</span><span>Vu</span><span>Statut</span></div>'
    +'<div class="geo-ip-table">'+sorted.map(function(g){
        var stage=g.kc_stage||g.cs_stage||'';
        var col=stage?(SC[stage]||'var(--cyan)'):'rgba(122,154,184,.3)';
        var sl=g.cs_scenario?g.cs_scenario.replace('crowdsecurity/','').replace('http-',''):'—';
        var st=g.cs_banned
          ?'<span class="geo-st-cs">▣CS</span>'
          :g.blocked?'<span class="geo-st-blk">✗BLK</span>'
          :'<span class="geo-st-ok">○</span>';
        return '<div class="geo-ip-row'+(g.blocked?' geo-blk':'')+'">'
          +'<span class="geo-ip-addr">'+esc(g.ip)+'</span>'
          +'<span class="geo-ip-cc">'+esc(g.country||'?')+'</span>'
          +'<span class="geo-ip-city">'+esc(g.city||'—')+'</span>'
          +'<span class="geo-ip-cnt">'+(g.count||0)+'</span>'
          +'<span class="geo-ip-stg" style="color:'+col+'">'+esc(stage||'—')+'</span>'
          +'<span class="geo-ip-scen">'+esc(sl)+'</span>'
          +'<span class="geo-ip-seen">'+esc(g.last_seen||'—')+'</span>'
          +'<span class="geo-ip-stat">'+st+'</span></div>';
      }).join('')+'</div>';
  // Assemble
  var bodyH=statsH
    +'<div class="geo-modal-mapwrap"><canvas id="geo-modal-cvs"></canvas></div>'
    +'<div class="geo-modal-grid">'
    +'<div class="geo-modal-left"><div>'+kcH+'</div><div>'+ctryH+'</div><div>'+scenH+'</div><div>'+actH+'</div></div>'
    +'<div class="geo-modal-right"><div class="geo-ip-wrap">'+ipH+'</div></div>'
    +'</div>';
  // Open
  var mc=document.getElementById('modal-card');
  if(mc){mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-kci','modal-fbx','modal-geomap','theme-red','theme-green','theme-cyan','theme-purple','theme-orange','theme-yellow');mc.classList.add('modal-geomap');}
  var ht=document.getElementById('modal-header-title');
  if(ht)ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">◉</span>GEOIP — CARTOGRAPHIE DES MENACES 24H';
  document.getElementById('modal-body').innerHTML=bodyH;
  openModal();
  requestAnimationFrame(function(){
    var cv=document.getElementById('geo-modal-cvs');
    if(cv&&typeof drawGeoMap==='function'){cv.width=cv.offsetWidth||900;cv.height=cv.offsetHeight||400;drawGeoMap(geoips,cv,wanIp);}
  });
}

