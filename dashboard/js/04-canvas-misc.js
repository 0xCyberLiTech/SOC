'use strict';
function _lcGetTs(p){return p.ts?new Date(p.ts).getTime()/1000:0;}
function _lcXOf(i,pts,PAD_L,tStart,tRange,cW){var ts=_lcGetTs(pts[i]);return ts?PAD_L+(ts-tStart)/tRange*cW:PAD_L+i/(pts.length-1)*cW;}
function _lcYOf(ms,PAD_T,cH,yMax){return PAD_T+cH-Math.min(Math.max(ms,0)/yMax,1)*cH;}
function _tcNiceMax(v){var u=[1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000,100000,200000,500000,1000000,2000000,5000000,10000000];for(var i=0;i<u.length;i++){if(u[i]*1.1>=v)return u[i];}return v;}
function _tcFmtBps(bps){return fmtBps(bps);}
function _tcSerieStats(vals){var nz=vals.filter(function(v){return v>0;});if(!nz.length)return{min:0,max:0,avg:0,cur:0};return{min:Math.min.apply(null,nz),max:Math.max.apply(null,nz),avg:nz.reduce(function(a,b){return a+b;},0)/nz.length,cur:vals[vals.length-1]||0};}
function _tcDetectSpikes(vals){var WIN=7,FACTOR=5.0,MIN_BPS=50000;return vals.map(function(v,i){var s=Math.max(0,i-3),e=Math.min(vals.length,i+4);var w=vals.slice(s,e).filter(function(x){return x>0;}).sort(function(a,b){return a-b;});var med=w[Math.floor(w.length/2)]||0;return med>MIN_BPS&&v>FACTOR*med;});}
function _tcCleanSpikes(vals,spikes){return vals.map(function(v,i){if(!spikes[i])return v;var nb=[];for(var k=1;k<=8;k++){if(i-k>=0&&!spikes[i-k]&&vals[i-k]>0)nb.push(vals[i-k]);if(i+k<vals.length&&!spikes[i+k]&&vals[i+k]>0)nb.push(vals[i+k]);if(nb.length>=4)break;}if(!nb.length)return 0;nb.sort(function(a,b){return a-b;});return nb[Math.floor(nb.length/2)];});}
function _tcSplitSegs(coords,gapIdx){if(!gapIdx.length)return[coords];var segs=[],s=0;gapIdx.forEach(function(idx){segs.push(coords.slice(s,idx));s=idx;});segs.push(coords.slice(s));return segs.filter(function(sg){return sg.length>=2;});}
function _tcPtCoords(vals,timestamps,tStart,tRange,cW,PAD_L,PAD_T,cH,yMax){return vals.map(function(v,i){return[PAD_L+(timestamps[i]-tStart)/tRange*cW,PAD_T+cH-Math.max(0,Math.min(v/yMax,1))*cH];});}
function _tcDrawSeries(ctx,coords,rgb,alpha,PAD_T,cH){if(coords.length<2)return;ctx.beginPath();ctx.moveTo(coords[0][0],PAD_T+cH);ctx.lineTo(coords[0][0],coords[0][1]);for(var i=1;i<coords.length;i++){var xc=(coords[i-1][0]+coords[i][0])/2,yc=(coords[i-1][1]+coords[i][1])/2;ctx.quadraticCurveTo(coords[i-1][0],coords[i-1][1],xc,yc);}ctx.lineTo(coords[coords.length-1][0],PAD_T+cH);ctx.closePath();var gf=ctx.createLinearGradient(0,PAD_T,0,PAD_T+cH);gf.addColorStop(0,'rgba('+rgb+','+alpha+')');gf.addColorStop(0.45,'rgba('+rgb+','+(alpha*0.55)+')');gf.addColorStop(1,'rgba('+rgb+',0.01)');ctx.fillStyle=gf;ctx.fill();ctx.beginPath();ctx.moveTo(coords[0][0],coords[0][1]);for(var j=1;j<coords.length;j++){var xc2=(coords[j-1][0]+coords[j][0])/2,yc2=(coords[j-1][1]+coords[j][1])/2;ctx.quadraticCurveTo(coords[j-1][0],coords[j-1][1],xc2,yc2);}ctx.lineTo(coords[coords.length-1][0],coords[coords.length-1][1]);ctx.strokeStyle='rgba('+rgb+',0.90)';ctx.lineWidth=1.6;ctx.shadowColor='rgba('+rgb+',0.55)';ctx.shadowBlur=5;ctx.stroke();ctx.shadowBlur=0;}
function drawNetSparkline(target, vals, rgb, maxVal){
  var canvas=typeof target==='string'?document.getElementById(target):target;
  if(!canvas||!vals.length)return;
  var W=canvas.offsetWidth, H=parseInt(canvas.getAttribute('height'))||45;
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  maxVal=maxVal||Math.max.apply(null,vals)||1;

  // Grid subtle — 2 lignes horizontales aux tiers (1/3 et 2/3 de hauteur)
  ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.5;
  [H/3,H*2/3].forEach(function(y){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();});

  var pts=vals.map(function(v,i){
    var x=vals.length>1?(i/(vals.length-1)*W):W/2;
    var y=H-Math.max(2,Math.round(v/maxVal*(H-5)))-1;
    return[x,y];
  });

  // Aire de remplissage
  ctx.beginPath();
  ctx.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length;i++){
    // Courbe Catmull-Rom légère
    var xc=(pts[i-1][0]+pts[i][0])/2, yc=(pts[i-1][1]+pts[i][1])/2;
    ctx.quadraticCurveTo(pts[i-1][0],pts[i-1][1],xc,yc);
  }
  ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba('+rgb+',0.42)'); g.addColorStop(1,'rgba('+rgb+',0.03)');
  ctx.fillStyle=g; ctx.fill();

  // Ligne
  ctx.beginPath();
  ctx.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length;i++){
    var xc=(pts[i-1][0]+pts[i][0])/2, yc=(pts[i-1][1]+pts[i][1])/2;
    ctx.quadraticCurveTo(pts[i-1][0],pts[i-1][1],xc,yc);
  }
  ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
  ctx.strokeStyle='rgba('+rgb+',0.9)'; ctx.lineWidth=1.5;
  ctx.shadowColor='rgba('+rgb+',0.4)'; ctx.shadowBlur=4;
  ctx.stroke(); ctx.shadowBlur=0;

  // Dernier point (dot lumineux)
  var lp=pts[pts.length-1];
  ctx.beginPath(); ctx.arc(lp[0],lp[1],2.5,0,Math.PI*2);
  ctx.fillStyle='rgba('+rgb+',1)';
  ctx.shadowColor='rgba('+rgb+',0.8)'; ctx.shadowBlur=6;
  ctx.fill(); ctx.shadowBlur=0;
}

// ── Butterfly dual-channel sparkline — RX↑ cyan / TX↓ vert sur un seul canvas
function drawNetDualSparkline(target,rxVals,txVals,maxVal){
  var canvas=typeof target==='string'?document.getElementById(target):target;
  if(!canvas)return;
  var W=canvas.offsetWidth||400,H=parseInt(canvas.getAttribute('height'))||48;
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  var mid=H/2;
  maxVal=maxVal||1;
  ctx.clearRect(0,0,W,H);
  // Grille verticale — 3 ticks horaires sur 4h (48pts)
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=0.5;
  for(var t=1;t<4;t++){var tx=W*t/4;ctx.beginPath();ctx.moveTo(tx,0);ctx.lineTo(tx,H);ctx.stroke();}
  // Lignes horizontales au quart
  [mid*0.5,mid*1.5].forEach(function(y){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();});
  // Baseline centrale
  ctx.strokeStyle='rgba(255,255,255,0.12)';
  ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(W,mid);ctx.stroke();
  function buildPts(vals,upward){
    return vals.map(function(v,i){
      var x=vals.length>1?i/(vals.length-1)*W:W/2;
      var amp=Math.min(v/maxVal,1)*(mid-3);
      return[x,upward?mid-amp:mid+amp];
    });
  }
  function drawChannel(pts,rgb,upward){
    if(pts.length<2)return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0],mid);
    ctx.lineTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++){
      var xc=(pts[i-1][0]+pts[i][0])/2,yc=(pts[i-1][1]+pts[i][1])/2;
      ctx.quadraticCurveTo(pts[i-1][0],pts[i-1][1],xc,yc);
    }
    ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
    ctx.lineTo(pts[pts.length-1][0],mid);
    ctx.closePath();
    var g=ctx.createLinearGradient(0,upward?0:H,0,mid);
    g.addColorStop(0,'rgba('+rgb+',.30)'); g.addColorStop(1,'rgba('+rgb+',.02)');
    ctx.fillStyle=g; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++){
      var xc=(pts[i-1][0]+pts[i][0])/2,yc=(pts[i-1][1]+pts[i][1])/2;
      ctx.quadraticCurveTo(pts[i-1][0],pts[i-1][1],xc,yc);
    }
    ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
    ctx.strokeStyle='rgba('+rgb+',.88)'; ctx.lineWidth=1.5;
    ctx.shadowColor='rgba('+rgb+',.55)'; ctx.shadowBlur=5;
    ctx.stroke(); ctx.shadowBlur=0;
    var lp=pts[pts.length-1];
    ctx.beginPath(); ctx.arc(lp[0],lp[1],2.5,0,Math.PI*2);
    ctx.fillStyle='rgba('+rgb+',1)';
    ctx.shadowColor='rgba('+rgb+',.9)'; ctx.shadowBlur=8;
    ctx.fill(); ctx.shadowBlur=0;
  }
  drawChannel(buildPts(rxVals,true),'0,217,255',true);
  drawChannel(buildPts(txVals,false),'0,255,136',false);
}

// ── Graphe latence WAN — histPts : [{ts (ISO), wan_ms, box_ms, status}] ──
function drawLatencyChart(canvas, histPts){
  if(!canvas||!histPts||histPts.length<2)return;
  var W=canvas.offsetWidth||canvas.width||700;
  var H=parseInt(canvas.getAttribute('height'))||110;
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  var PAD_L=42,PAD_B=20,PAD_T=14,PAD_R=14;
  var cW=W-PAD_L-PAD_R, cH=H-PAD_T-PAD_B;
  var pts=histPts.filter(function(p){return p.wan_ms!=null&&p.wan_ms>=0;});
  if(pts.length<2)return;
  var vals=pts.map(function(p){return p.wan_ms;});
  var raw_max=Math.max.apply(null,vals)*1.15;
  var niceM=[50,100,150,200,300,500,1000,2000];
  var yMax=niceM[0];for(var ni=0;ni<niceM.length;ni++){if(niceM[ni]>=raw_max){yMax=niceM[ni];break;}}
  var tStart=_lcGetTs(pts[0]),tEnd=_lcGetTs(pts[pts.length-1]);
  var tRange=tEnd-tStart||pts.length*60;
  // Fond verre
  var bg=ctx.createLinearGradient(0,PAD_T,0,PAD_T+cH);
  bg.addColorStop(0,'rgba(0,15,38,0.62)');
  bg.addColorStop(1,'rgba(0,5,14,0.28)');
  ctx.fillStyle=bg; ctx.fillRect(PAD_L,PAD_T,cW,cH);
  // Grille Y + labels
  [0,30,80,yMax].forEach(function(ms){
    if(ms>yMax)return;
    var yg=_lcYOf(ms,PAD_T,cH,yMax);
    ctx.strokeStyle='rgba(0,217,255,0.07)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(PAD_L,yg); ctx.lineTo(PAD_L+cW,yg); ctx.stroke();
    ctx.fillStyle='rgba(150,190,220,0.42)'; ctx.font='8px monospace'; ctx.textAlign='right';
    ctx.fillText(ms+'ms',PAD_L-3,yg+3);
  });
  // Lignes seuil (30ms vert, 80ms orange)
  [[30,'0,255,136'],[80,'255,160,0']].forEach(function(th){
    if(th[0]>=yMax)return;
    var ty=_lcYOf(th[0],PAD_T,cH,yMax);
    ctx.strokeStyle='rgba('+th[1]+',0.28)'; ctx.lineWidth=0.8; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(PAD_L,ty); ctx.lineTo(PAD_L+cW,ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba('+th[1]+',0.52)'; ctx.font='bold 7px monospace'; ctx.textAlign='left';
    ctx.fillText(th[0]+'ms',PAD_L+3,ty-2);
  });
  // Zones DOWN (statut != UP)
  pts.forEach(function(p,i){
    if(p.status&&p.status!=='UP'&&i<pts.length-1){
      ctx.fillStyle='rgba(255,50,50,0.12)';
      ctx.fillRect(_lcXOf(i,pts,PAD_L,tStart,tRange,cW),PAD_T,_lcXOf(i+1,pts,PAD_L,tStart,tRange,cW)-_lcXOf(i,pts,PAD_L,tStart,tRange,cW),cH);
    }
  });
  // Coordonnées
  var coords=pts.map(function(p,i){return[_lcXOf(i,pts,PAD_L,tStart,tRange,cW),_lcYOf(p.wan_ms,PAD_T,cH,yMax)];});
  // Aire dégradé
  ctx.beginPath();
  ctx.moveTo(coords[0][0],PAD_T+cH);
  ctx.lineTo(coords[0][0],coords[0][1]);
  for(var i=1;i<coords.length;i++){
    var xc=(coords[i-1][0]+coords[i][0])/2,yc=(coords[i-1][1]+coords[i][1])/2;
    ctx.quadraticCurveTo(coords[i-1][0],coords[i-1][1],xc,yc);
  }
  ctx.lineTo(coords[coords.length-1][0],PAD_T+cH); ctx.closePath();
  var aG=ctx.createLinearGradient(0,PAD_T,0,PAD_T+cH);
  aG.addColorStop(0,'rgba(0,217,255,0.30)');
  aG.addColorStop(0.55,'rgba(0,217,255,0.10)');
  aG.addColorStop(1,'rgba(0,217,255,0.01)');
  ctx.fillStyle=aG; ctx.fill();
  // Ligne glow
  ctx.beginPath();
  ctx.moveTo(coords[0][0],coords[0][1]);
  for(var j=1;j<coords.length;j++){
    var xc2=(coords[j-1][0]+coords[j][0])/2,yc2=(coords[j-1][1]+coords[j][1])/2;
    ctx.quadraticCurveTo(coords[j-1][0],coords[j-1][1],xc2,yc2);
  }
  ctx.lineTo(coords[coords.length-1][0],coords[coords.length-1][1]);
  ctx.strokeStyle='rgba(0,217,255,0.90)'; ctx.lineWidth=1.5;
  ctx.shadowColor='rgba(0,217,255,0.45)'; ctx.shadowBlur=5;
  ctx.stroke(); ctx.shadowBlur=0;
  // Marqueurs spikes >80ms
  var hasSpikes=false;
  pts.forEach(function(p,i){
    if(p.wan_ms>80){
      hasSpikes=true;
      ctx.fillStyle='rgba(255,140,0,0.90)';
      ctx.shadowColor='rgba(255,140,0,0.55)'; ctx.shadowBlur=5;
      ctx.beginPath(); ctx.arc(coords[i][0],coords[i][1],2.8,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }
  });
  if(hasSpikes){
    ctx.save(); ctx.fillStyle='rgba(255,160,0,0.65)'; ctx.font='bold 8px monospace'; ctx.textAlign='right';
    ctx.shadowColor='rgba(255,140,0,0.45)'; ctx.shadowBlur=4;
    ctx.fillText('⚡ latence élevée',PAD_L+cW-4,PAD_T+10); ctx.shadowBlur=0; ctx.restore();
  }
  // Labels X + grille verticale
  var step=Math.max(1,Math.floor(pts.length/6));
  for(var i=0;i<pts.length;i+=step){
    if(!pts[i].ts)continue;
    var d=new Date(pts[i].ts);
    var lbl=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
    ctx.strokeStyle='rgba(0,217,255,0.06)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(coords[i][0],PAD_T); ctx.lineTo(coords[i][0],PAD_T+cH); ctx.stroke();
    ctx.fillStyle='rgba(150,190,220,0.45)'; ctx.font='8px monospace'; ctx.textAlign='center';
    ctx.fillText(lbl,coords[i][0],H-PAD_B+12);
  }
  // Ligne NOW
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(PAD_L+cW,PAD_T); ctx.lineTo(PAD_L+cW,PAD_T+cH); ctx.stroke();
  ctx.setLineDash([]);
  // Label axe Y
  ctx.save(); ctx.translate(10,PAD_T+cH/2); ctx.rotate(-Math.PI/2);
  ctx.fillStyle='rgba(150,190,220,0.28)'; ctx.font='8px monospace'; ctx.textAlign='center';
  ctx.fillText('ms',0,0); ctx.restore();
  // Bordure verre
  ctx.strokeStyle='rgba(0,217,255,0.12)'; ctx.lineWidth=1;
  ctx.shadowColor='rgba(0,217,255,0.06)'; ctx.shadowBlur=3;
  ctx.strokeRect(PAD_L,PAD_T,cW,cH); ctx.shadowBlur=0;
  // Dernier point lumineux
  var lp=coords[coords.length-1];
  ctx.beginPath(); ctx.arc(lp[0],lp[1],3,0,Math.PI*2);
  ctx.fillStyle='rgba(0,217,255,1)';
  ctx.shadowColor='rgba(0,217,255,0.85)'; ctx.shadowBlur=8;
  ctx.fill(); ctx.shadowBlur=0;
  // Stats
  var nzV=vals.filter(function(v){return v>0;});
  var avg2=nzV.length?Math.round(nzV.reduce(function(a,b){return a+b;},0)/nzV.length):0;
  canvas._latStats={min:Math.round(Math.min.apply(null,nzV)||0),max:Math.round(Math.max.apply(null,nzV)||0),avg:avg2,cur:Math.round(vals[vals.length-1]||0)};
}

// ── Graphe trafic Smokeping-style ──
// data : [{ts (epoch s), tx (B/s), rx (B/s)}]
// period : '24h' | '7d'
function drawTrafficChart(canvas, data, period, opts){
  opts=opts||{};
  if(!canvas||!data||data.length<2)return;
  var PAD_L=64, PAD_B=28, PAD_T=16, PAD_R=16;
  var W=canvas.offsetWidth||canvas.width||700;
  var H=parseInt(canvas.getAttribute('height'))||220;
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  var cW=W-PAD_L-PAD_R, cH=H-PAD_T-PAD_B;

  // Filtrer les points nuls en tête de série
  var firstNonNull=0;
  for(var i=0;i<data.length;i++){if(data[i].tx>0||data[i].rx>0){firstNonNull=i;break;}}
  var pts=data.slice(firstNonNull);
  if(pts.length<2)pts=data;

  var txVals=pts.map(function(p){return p.tx||0;});
  var rxVals=pts.map(function(p){return p.rx||0;});
  var timestamps=pts.map(function(p){return p.ts||0;});
  // Hard cap physique — Freebox Delta max ~8 Gbps = 1e9 B/s ; cap à 2.5× bande passante configurée
  var MAX_BPS_CAP=opts.txSat?opts.txSat*2.5:1250000000;
  txVals=txVals.map(function(v){return v>MAX_BPS_CAP?MAX_BPS_CAP:v;});
  rxVals=rxVals.map(function(v){return v>MAX_BPS_CAP?MAX_BPS_CAP:v;});
  var maxVal=Math.max(Math.max.apply(null,txVals),Math.max.apply(null,rxVals))||1;

  var yMax=_tcNiceMax(maxVal*1.15);
  var N_YTICKS=5;

  var tStart=timestamps[0], tEnd=timestamps[timestamps.length-1];
  var tRange=tEnd-tStart||1;

  // Détection gaps
  var expectedStep=pts.length>1?tRange/(pts.length-1):0;
  var gapIdx=[], gapBands=[];
  if(expectedStep>0){
    for(var gi=1;gi<pts.length;gi++){
      if(timestamps[gi]-timestamps[gi-1]>2.5*expectedStep){
        gapIdx.push(gi);
        gapBands.push({x1:PAD_L+(timestamps[gi-1]-tStart)/tRange*cW, x2:PAD_L+(timestamps[gi]-tStart)/tRange*cW});
      }
    }
  }
  // Détection spikes (bruit suspect) — médiane glissante 7 points
  var txSpikes=_tcDetectSpikes(txVals), rxSpikes=_tcDetectSpikes(rxVals);
  var hasSpikes=txSpikes.some(Boolean)||rxSpikes.some(Boolean);
  var txClean=_tcCleanSpikes(txVals,txSpikes), rxClean=_tcCleanSpikes(rxVals,rxSpikes);
  // yMax recalculé sur données nettoyées — axe Y non écrasé par les spikes
  var maxClean=Math.max(Math.max.apply(null,txClean),Math.max.apply(null,rxClean))||1;
  yMax=_tcNiceMax(maxClean*1.15);

  // Seuil saturation (bytes/s) — 80% de la bande passante max
  var txSat=opts.txSat||0, rxSat=opts.rxSat||0;
  var satThresh=Math.max(txSat,rxSat)*0.80;

  // ── FOND VERRE ──
  var bgG=ctx.createLinearGradient(0,PAD_T,0,PAD_T+cH);
  bgG.addColorStop(0,'rgba(0,18,40,0.50)');
  bgG.addColorStop(1,'rgba(0,5,14,0.25)');
  ctx.fillStyle=bgG; ctx.fillRect(PAD_L,PAD_T,cW,cH);

  // Zone saturation (rouge dégradé au-dessus du seuil)
  if(satThresh>0&&satThresh<yMax){
    var satY=PAD_T+cH-satThresh/yMax*cH;
    var satG=ctx.createLinearGradient(0,PAD_T,0,satY);
    satG.addColorStop(0,'rgba(255,45,45,0.10)');
    satG.addColorStop(1,'rgba(255,45,45,0.01)');
    ctx.fillStyle=satG; ctx.fillRect(PAD_L,PAD_T,cW,satY-PAD_T);
    ctx.save();
    ctx.strokeStyle='rgba(255,80,80,0.40)'; ctx.lineWidth=1;
    ctx.shadowColor='rgba(255,70,70,0.35)'; ctx.shadowBlur=4;
    ctx.setLineDash([5,5]);
    ctx.beginPath(); ctx.moveTo(PAD_L,satY); ctx.lineTo(PAD_L+cW,satY); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,100,100,0.60)'; ctx.font='bold 8px monospace'; ctx.textAlign='left';
    ctx.fillText('SAT. 80%',PAD_L+4,satY-3); ctx.restore();
  }

  // Grille horizontale (teinte cyan subtile)
  for(var t=0;t<=N_YTICKS;t++){
    var y=PAD_T+cH-Math.round(t/N_YTICKS*cH);
    ctx.strokeStyle='rgba(0,217,255,0.07)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(PAD_L,y); ctx.lineTo(PAD_L+cW,y); ctx.stroke();
    ctx.fillStyle='rgba(150,190,220,0.55)'; ctx.font='9px monospace'; ctx.textAlign='right';
    ctx.fillText(_tcFmtBps(yMax*t/N_YTICKS),PAD_L-4,y+3);
  }

  // Grille verticale + labels X
  var xTickInterval=period==='7d'?86400:period==='24h'?14400:3600;
  var tFirst=Math.ceil(tStart/xTickInterval)*xTickInterval;
  for(var ts=tFirst;ts<=tEnd;ts+=xTickInterval){
    var xPx=PAD_L+Math.round((ts-tStart)/tRange*cW);
    if(xPx<PAD_L||xPx>PAD_L+cW)continue;
    ctx.strokeStyle='rgba(0,217,255,0.08)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(xPx,PAD_T); ctx.lineTo(xPx,PAD_T+cH); ctx.stroke();
    var d2=new Date(ts*1000);
    var lbl=period==='7d'?
      d2.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):
      (d2.getHours().toString().padStart(2,'0')+':'+d2.getMinutes().toString().padStart(2,'0'));
    ctx.fillStyle='rgba(150,190,220,0.50)'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText(lbl,xPx,H-PAD_B+12);
  }

  // Séries segmentées (coupures exclues)
  _tcSplitSegs(_tcPtCoords(rxClean,timestamps,tStart,tRange,cW,PAD_L,PAD_T,cH,yMax),gapIdx).forEach(function(sg){_tcDrawSeries(ctx,sg,'0,255,136',0.24,PAD_T,cH);});
  _tcSplitSegs(_tcPtCoords(txClean,timestamps,tStart,tRange,cW,PAD_L,PAD_T,cH,yMax),gapIdx).forEach(function(sg){_tcDrawSeries(ctx,sg,'0,217,255',0.30,PAD_T,cH);});

  // Zones de coupure
  gapBands.forEach(function(g){
    var gw=Math.max(g.x2-g.x1,2);
    ctx.fillStyle='rgba(255,50,50,0.13)'; ctx.fillRect(g.x1,PAD_T,gw,cH);
    ctx.save(); ctx.strokeStyle='rgba(255,50,50,0.18)'; ctx.lineWidth=0.8;
    for(var hx=g.x1-cH;hx<g.x2+cH;hx+=7){
      var lx1=Math.max(g.x1,hx), ly1=PAD_T+(lx1-hx);
      var lx2=Math.min(g.x2,hx+cH), ly2=PAD_T+(lx2-hx);
      if(lx2<=g.x1||lx1>=g.x2)continue;
      ctx.beginPath(); ctx.moveTo(lx1,ly1); ctx.lineTo(lx2,ly2); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.strokeStyle='rgba(255,60,60,0.75)'; ctx.lineWidth=1.5;
    ctx.shadowColor='rgba(255,60,60,0.9)'; ctx.shadowBlur=6; ctx.setLineDash([3,4]);
    ctx.beginPath(); ctx.moveTo(g.x1,PAD_T); ctx.lineTo(g.x1,PAD_T+cH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.x2,PAD_T); ctx.lineTo(g.x2,PAD_T+cH); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur=0; ctx.restore();
    if(gw>18){
      ctx.save(); ctx.fillStyle='rgba(255,80,80,0.85)'; ctx.font='bold 8px monospace';
      ctx.textAlign='center'; ctx.shadowColor='rgba(255,50,50,0.7)'; ctx.shadowBlur=5;
      ctx.fillText('CUT',(g.x1+g.x2)/2,PAD_T+cH/2+3); ctx.shadowBlur=0; ctx.restore();
    }
  });

  // Marqueurs spikes (bruit suspect)
  var txC=_tcPtCoords(txClean,timestamps,tStart,tRange,cW,PAD_L,PAD_T,cH,yMax), rxC=_tcPtCoords(rxClean,timestamps,tStart,tRange,cW,PAD_L,PAD_T,cH,yMax);
  [['tx',txSpikes,txC,'255,160,0'],['rx',rxSpikes,rxC,'255,200,50']].forEach(function(s){
    s[1].forEach(function(isSpike,i){
      if(!isSpike)return;
      var pt=s[2][i];
      ctx.save();
      ctx.strokeStyle='rgba('+s[3]+',0.55)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(pt[0],PAD_T); ctx.lineTo(pt[0],PAD_T+cH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='rgba('+s[3]+',0.90)';
      ctx.shadowColor='rgba('+s[3]+',0.75)'; ctx.shadowBlur=6;
      ctx.beginPath(); ctx.arc(pt[0],pt[1],3.5,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.restore();
    });
  });
  if(hasSpikes){
    ctx.save(); ctx.fillStyle='rgba(255,160,0,0.65)'; ctx.font='bold 8px monospace'; ctx.textAlign='right';
    ctx.shadowColor='rgba(255,140,0,0.5)'; ctx.shadowBlur=4;
    ctx.fillText('⚡ bruit suspect',PAD_L+cW-5,PAD_T+11); ctx.shadowBlur=0; ctx.restore();
  }

  // Bordure verre
  ctx.strokeStyle='rgba(0,217,255,0.12)'; ctx.lineWidth=1;
  ctx.shadowColor='rgba(0,217,255,0.08)'; ctx.shadowBlur=3;
  ctx.strokeRect(PAD_L,PAD_T,cW,cH); ctx.shadowBlur=0;

  // Label axe Y
  ctx.save(); ctx.translate(11,PAD_T+cH/2); ctx.rotate(-Math.PI/2);
  ctx.fillStyle='rgba(150,190,220,0.35)'; ctx.font='9px monospace'; ctx.textAlign='center';
  ctx.fillText('bits/s',0,0); ctx.restore();

  // Ligne NOW (dernier point)
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(PAD_L+cW,PAD_T); ctx.lineTo(PAD_L+cW,PAD_T+cH); ctx.stroke();
  ctx.setLineDash([]);

  canvas._txStats=_tcSerieStats(txClean); canvas._rxStats=_tcSerieStats(rxClean); canvas._hasSpikes=hasSpikes;
}

function ring(pct,color,sz){
  sz=sz||60;var r=(sz-10)/2,c=2*Math.PI*r,off=c*(1-Math.min(pct,100)/100);
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 '+sz+' '+sz+'">'
    +'<circle class="ring-bg" cx="'+(sz/2)+'" cy="'+(sz/2)+'" r="'+r+'"/>'
    +'<circle class="ring-fill" cx="'+(sz/2)+'" cy="'+(sz/2)+'" r="'+r+'"'
    +' stroke="'+color+'" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/></svg>';
}

var CENTROIDS = {
  'AF':[33,65],'AL':[41,20],'AM':[40,45],'AO':[-12,18],'AR':[-34,-64],'AT':[47.7,13.3],
  'AU':[-27,133],'AZ':[40.5,47.5],'BA':[44,17.5],'BD':[24,90],'BE':[50.8,4],'BF':[13,-2],
  'BG':[43,25],'BO':[-17,-65],'BR':[-10,-55],'BY':[53,28],'CA':[60,-96],'CD':[-4,24],
  'CF':[7,21],'CH':[47,8],'CL':[-33,-71],'CM':[6,12],'CN':[35,105],'CO':[4,-74],
  'CU':[21.5,-80],'CZ':[49.8,15.5],'DE':[51,9],'DK':[56,10],'DZ':[28,3],'EC':[-2,-77.5],
  'EE':[59,25],'EG':[27,30],'ES':[40,-4],'ET':[8,38],'FI':[64,26],'FR':[46,2],
  'GB':[54,-2],'GE':[42,43.5],'GH':[8,-2],'GR':[39,22],'GT':[15.5,-90],'HN':[15,-86.5],
  'HR':[45.2,15.5],'HU':[47,20],'ID':[-5,120],'IE':[53,-8],'IL':[31.5,34.8],'IN':[20,77],
  'IQ':[33,44],'IR':[32,53],'IS':[65,-18],'IT':[42.8,12.8],'JO':[31,36],'JP':[36,138],
  'KE':[1,38],'KR':[37,127.5],'KW':[29.5,45.8],'KZ':[48,68],'LA':[18,103],'LB':[33.8,35.5],
  'LT':[56,24],'LV':[57,25],'LY':[25,17],'MA':[32,-6],'MD':[47,29],'MK':[41.6,21.7],
  'ML':[17,-4],'MM':[22,98],'MN':[46,105],'MR':[20,-12],'MX':[23,-102],'MY':[2.5,112],
  'MZ':[-18,35],'NA':[-22,17],'NG':[10,8],'NI':[13,-85],'NL':[52.3,5.3],'NO':[64,10],
  'NP':[28,84],'NZ':[-41,174],'OM':[21,57],'PA':[9,-80],'PE':[-10,-76],'PH':[13,122],
  'PK':[30,70],'PL':[52,20],'PT':[39.5,-8],'PY':[-23,-58],'QA':[25.3,51.2],'RO':[46,25],
  'RS':[44,21],'RU':[60,100],'SA':[24,45],'SD':[15,30],'SE':[62,15],'SG':[1.3,103.8],
  'SI':[46.1,14.8],'SK':[48.7,19.5],'SN':[14,-14],'SY':[35,38],'TD':[15,19],'TH':[15,101],
  'TJ':[39,71],'TM':[40,60],'TN':[34,9],'TR':[39,35],'TZ':[-6,35],'UA':[49,32],
  'UG':[1,32],'US':[38,-97],'UY':[-33,-56],'UZ':[41,64],'VE':[8,-66],'VN':[16,108],
  'YE':[15.5,48],'ZA':[-29,25],'ZM':[-14,28],'ZW':[-20,30]
};

var _worldPolygons = null;
var _mapAnimFrames = {};
var _mapStaticCanvas=null, _mapStaticW=0, _mapStaticH=0, _mapStaticPoly=null, _mapStaticZone='MONDE', _mapStaticDpr=1; // cache couche statique
var _MAP_ZONES={
  'MONDE':  {lon0:-180,lon1:180, lat0:-63,lat1:82},
  'EUROPE': {lon0:-12, lon1:42,  lat0:35, lat1:72},
  'ASIE':   {lon0:20,  lon1:150, lat0:-8, lat1:65},
  'AMER':   {lon0:-170,lon1:-30, lat0:-58,lat1:78},
  'AFRIQUE':{lon0:-20, lon1:52,  lat0:-36,lat1:38}
};
// ── LEAFLET INTERACTIVE MAP ──
// _lfMap/_lfMarkers → bus _SOC via shims (01-utils) — N1
var _lfArcs=[], _lfHomeMarker=null, _lfStatsCtrl=null;
