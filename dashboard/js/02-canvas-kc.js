// ══════════════════════════════════════════════════════
// CYBER KILL CHAIN — animation canvas
// ══════════════════════════════════════════════════════
var _kcAnimFrame = null;
var _kciAnimFrame = null;
var _KC_COPY_RESET_MS = 1600; // délai reset bouton copie IP
function _kcSetBtnOk(btn,via){if(!btn)return;btn.textContent='\u2714 BANNI 24h \u2014 '+via;btn.style.background='rgba(0,217,100,0.18)';btn.style.borderColor='rgba(0,217,100,0.45)';btn.style.color='var(--green)';}
function _kcSetBtnErr(btn,msg){if(!btn)return;btn.textContent='\u26a0 '+msg.slice(0,30);btn.style.background='rgba(255,215,0,0.10)';btn.style.borderColor='rgba(255,215,0,0.35)';btn.style.color='var(--yellow)';btn.disabled=false;}
function _kcBanViaCrowdSec(btn,ipStr){
  if(btn) btn.textContent='\u29d7 BAN\u2026 (CrowdSec direct)';
  var csKey=localStorage.getItem(_LS_KEYS.CS_KEY)||'';
  if(!csKey){
    if(!btn){console.warn('[SOC auto-ban] '+ipStr+' — CrowdSec LAPI key absente. Définir localStorage._soc_cs_key');return;}
    csKey=prompt('JARVIS indisponible.\nClé API CrowdSec LAPI (cscli bouncers add soc-dashboard) :\n\nStockée dans localStorage — ne sera plus demandée.');
    if(!csKey){_kcSetBtnErr(btn,'Annulé — clé requise');return;}
    localStorage.setItem(_LS_KEYS.CS_KEY,csKey);
  }
  var payload=[{duration:'24h',ip:ipStr,reason:'soc-dashboard-ban',scenario:'soc/kill-chain-autoban',scope:'Ip',type:'ban',value:ipStr}];
  fetch('http://'+SOC_INFRA.SRV_NGIX+':8080/v1/decisions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Key '+csKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)})
  .then(function(r){if(r.ok){_kcSetBtnOk(btn,'CS direct');}else{localStorage.removeItem(_LS_KEYS.CS_KEY);_kcSetBtnErr(btn,'Clé CS invalide ('+r.status+')');}})
  .catch(function(){_kcSetBtnErr(btn,'CS injoignable ('+SOC_INFRA.SRV_NGIX+')');});
}
var _kcParticles = [];
var _kcNodes = [];       // positions hexagones — mis à jour par _drawKillChain
var _kcGroupedData = {}; // IPs par étape enrichies (inclut BLOCKED injectés) — mis à jour par rendu tuile

var KCK_STAGES = [
  {id:'RECON',   label:'RECON',     desc:'Sondage',       color:'#bf5fff', rgb:'191,95,255', mitre:'T1595'},
  {id:'SCAN',    label:'SCAN',      desc:'Énumération',   color:'#ff6b35', rgb:'255,107,53', mitre:'T1046'},
  {id:'EXPLOIT', label:'EXPLOIT',   desc:'Exploitation',  color:'#ffd700', rgb:'255,215,0',  mitre:'T1190'},
  {id:'BRUTE',   label:'BRUTE',     desc:'Intrusion',     color:'#ff3b5c', rgb:'255,59,92',  mitre:'T1110'},
  {id:'BLOCKED', label:'NEUTRALISÉ',desc:'Défense active', color:'#00ff88', rgb:'0,255,136', mitre:'DEF'},
];

function _kcHex(ctx, cx, cy, r){
  ctx.beginPath();
  for(var i=0;i<6;i++){
    var a=(i*Math.PI/3)-Math.PI/6;
    var x=cx+r*Math.cos(a), y=cy+r*Math.sin(a);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.closePath();
}

// Seuils critiques KC — source de vérité unique (KC tile + mini chain)
window._kcCritThresh={RECON:10,SCAN:5,EXPLOIT:3,BRUTE:1};

// ── Sous-fonctions de rendu — extraites de _drawKillChain (DT-07) ──────────

function _kcDrawBackground(ctx, W, H){
  var bgGrad=ctx.createLinearGradient(0,0,W,H);
  bgGrad.addColorStop(0,'rgba(5,9,20,0.97)');
  bgGrad.addColorStop(1,'rgba(8,14,28,0.97)');
  ctx.fillStyle=bgGrad; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(0,217,255,0.035)'; ctx.lineWidth=1;
  for(var gx=0;gx<W;gx+=36){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
  for(var gy=0;gy<H;gy+=36){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
}

function _kcDrawEntryBeacon(ctx, entNode, nodeR, phase){
  var eX=7, eX1=entNode.x-nodeR-3, eY=entNode.y;
  var eCnt=entNode.cnt, eRgb='255,59,92';
  var ePulse=0.45+0.55*Math.sin(phase*Math.PI*4);
  var ePulse2=0.5+0.5*Math.sin(phase*Math.PI*4+1.2);
  var eA=eCnt>0?0.92:0.35, eMidX=Math.round((eX+eX1)/2);
  ctx.save(); ctx.fillStyle='rgba('+eRgb+','+(eA*ePulse*0.08)+')';
  ctx.beginPath(); ctx.arc(eX,eY,Math.round(nodeR*1.1),0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle='rgba('+eRgb+','+(eA*ePulse)+')'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.shadowColor='rgba('+eRgb+','+eA+')'; ctx.shadowBlur=eCnt>0?20:7;
  ctx.beginPath(); ctx.moveTo(eX,eY-Math.round(nodeR*1.15)); ctx.lineTo(eX,eY+Math.round(nodeR*1.15)); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.strokeStyle='rgba('+eRgb+','+(eA*ePulse2*0.35)+')'; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(eX,eY-Math.round(nodeR*1.1)); ctx.lineTo(eX,eY+Math.round(nodeR*1.1)); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.fillStyle='rgba('+eRgb+','+(eCnt>0?eA*0.80:0.28)+')';
  ctx.font='bold 8px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  if(eCnt>0){ctx.shadowColor='rgba('+eRgb+',0.5)';ctx.shadowBlur=6;}
  ctx.fillText('\u25c0 MENACES',eMidX,eY-nodeR-4); ctx.restore();
  if(eX1>eX+8){
    var tgE=ctx.createLinearGradient(eX,0,eX1,0);
    tgE.addColorStop(0,'rgba('+eRgb+','+(eCnt>0?0.60:0.12)+')');
    tgE.addColorStop(1,'rgba('+entNode.s.rgb+','+(eCnt>0?0.22:0.04)+')');
    ctx.strokeStyle=tgE; ctx.lineWidth=eCnt>0?5:2; ctx.lineCap='butt';
    ctx.beginPath(); ctx.moveTo(eX+4,eY); ctx.lineTo(eX1,eY); ctx.stroke();
    if(eCnt>0){
      ctx.save(); ctx.strokeStyle='rgba('+eRgb+',0.40)'; ctx.lineWidth=1;
      ctx.shadowColor='rgba('+eRgb+',0.4)'; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.moveTo(eX+4,eY-3); ctx.lineTo(eX1,eY-3); ctx.stroke(); ctx.restore();
    }
    for(var fi=0;fi<3;fi++){
      var ft=((phase*3.5+fi/3)%1), fx=eX+6+ft*(eX1-eX-14);
      var fa=Math.sin(ft*Math.PI)*(eCnt>0?eA*0.98:0.22);
      if(fa<0.03) continue;
      ctx.save(); ctx.fillStyle='rgba('+eRgb+','+fa+')';
      if(eCnt>0){ctx.shadowColor='rgba('+eRgb+','+fa+')';ctx.shadowBlur=6;}
      ctx.beginPath(); ctx.moveTo(fx-6,eY-4.5); ctx.lineTo(fx,eY); ctx.lineTo(fx-6,eY+4.5); ctx.lineTo(fx-3,eY);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  ctx.save(); ctx.fillStyle='rgba('+eRgb+','+(eCnt>0?eA*0.72:0.25)+')';
  ctx.font='bold 8px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
  if(eCnt>0){ctx.shadowColor='rgba('+eRgb+',0.4)';ctx.shadowBlur=5;}
  ctx.fillText('INTERNET',eMidX,eY+nodeR+10); ctx.restore();
}

function _kcDrawDefenseBeacon(ctx, defNode, nodeR, W, phase){
  var dX0=defNode.x+nodeR+3, dX=W-7, dY=defNode.y;
  var dCnt=defNode.cnt, dRgb='0,255,136';
  var dPulse=0.45+0.55*Math.sin(phase*Math.PI*4+0.8);
  var dPulse2=0.5+0.5*Math.sin(phase*Math.PI*4+2.0);
  var dA=dCnt>0?0.92:0.35, dMidX=Math.round((dX0+dX)/2);
  ctx.save(); ctx.fillStyle='rgba('+dRgb+','+(dA*dPulse*0.08)+')';
  ctx.beginPath(); ctx.arc(dX,dY,Math.round(nodeR*1.1),0,Math.PI*2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle='rgba('+dRgb+','+(dA*dPulse)+')'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.shadowColor='rgba('+dRgb+','+dA+')'; ctx.shadowBlur=dCnt>0?20:7;
  ctx.beginPath(); ctx.moveTo(dX,dY-Math.round(nodeR*1.15)); ctx.lineTo(dX,dY+Math.round(nodeR*1.15)); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.strokeStyle='rgba('+dRgb+','+(dA*dPulse2*0.35)+')'; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(dX,dY-Math.round(nodeR*1.1)); ctx.lineTo(dX,dY+Math.round(nodeR*1.1)); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.fillStyle='rgba('+dRgb+','+(dCnt>0?dA*0.80:0.28)+')';
  ctx.font='bold 8px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='bottom';
  if(dCnt>0){ctx.shadowColor='rgba('+dRgb+',0.5)';ctx.shadowBlur=6;}
  ctx.fillText('D\u00c9FENSE \u25ba',dMidX,dY-nodeR-4); ctx.restore();
  if(dX>dX0+8){
    var tgD=ctx.createLinearGradient(dX0,0,dX,0);
    tgD.addColorStop(0,'rgba('+dRgb+','+(dCnt>0?0.22:0.04)+')');
    tgD.addColorStop(1,'rgba('+dRgb+','+(dCnt>0?0.60:0.12)+')');
    ctx.strokeStyle=tgD; ctx.lineWidth=dCnt>0?5:2; ctx.lineCap='butt';
    ctx.beginPath(); ctx.moveTo(dX0,dY); ctx.lineTo(dX-4,dY); ctx.stroke();
    if(dCnt>0){
      ctx.save(); ctx.strokeStyle='rgba('+dRgb+',0.40)'; ctx.lineWidth=1;
      ctx.shadowColor='rgba('+dRgb+',0.4)'; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.moveTo(dX0,dY-3); ctx.lineTo(dX-4,dY-3); ctx.stroke(); ctx.restore();
    }
    for(var fi=0;fi<3;fi++){
      var ft=((phase*3.5+fi/3)%1), fx=dX-6-ft*(dX-dX0-14);
      var fa=Math.sin(ft*Math.PI)*(dCnt>0?dA*0.98:0.22);
      if(fa<0.03) continue;
      ctx.save(); ctx.fillStyle='rgba('+dRgb+','+fa+')';
      if(dCnt>0){ctx.shadowColor='rgba('+dRgb+','+fa+')';ctx.shadowBlur=6;}
      ctx.beginPath(); ctx.moveTo(fx+6,dY-4.5); ctx.lineTo(fx,dY); ctx.lineTo(fx+6,dY+4.5); ctx.lineTo(fx+3,dY);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  ctx.save(); ctx.fillStyle='rgba('+dRgb+','+(dCnt>0?dA*0.72:0.25)+')';
  ctx.font='bold 8px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
  if(dCnt>0){ctx.shadowColor='rgba('+dRgb+',0.4)';ctx.shadowBlur=5;}
  ctx.fillText('BOUCLIER',dMidX,dY+nodeR+10); ctx.restore();
}

function _kcDrawTubes(ctx, nodes, nodeR, maxC){
  for(var i=0;i<nodes.length-1;i++){
    var n1=nodes[i], n2=nodes[i+1];
    var cntMax=Math.max(n1.cnt,n2.cnt);
    var act=Math.min(1,cntMax/maxC);
    var tubeW=Math.max(3,Math.round(12*(1-i*0.14)));
    var alpha=cntMax>0?0.22+act*0.48:0.08;
    var c1rgb=n1.cnt>0?n1.s.rgb:n2.s.rgb;
    var tg=ctx.createLinearGradient(n1.x,0,n2.x,0);
    tg.addColorStop(0,'rgba('+c1rgb+','+(alpha*0.7)+')');
    tg.addColorStop(1,'rgba('+n2.s.rgb+','+alpha+')');
    ctx.strokeStyle=tg; ctx.lineWidth=tubeW; ctx.lineCap='butt';
    ctx.beginPath(); ctx.moveTo(n1.x+nodeR,n1.y); ctx.lineTo(n2.x-nodeR,n2.y); ctx.stroke();
    if(cntMax>0){
      ctx.save();
      ctx.shadowColor='rgba('+n2.s.rgb+',0.45)'; ctx.shadowBlur=6;
      ctx.strokeStyle='rgba('+n2.s.rgb+',0.55)'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(n1.x+nodeR,n1.y-tubeW/2-1); ctx.lineTo(n2.x-nodeR,n2.y-tubeW/2-1);
      ctx.stroke(); ctx.restore();
    }
  }
}

function _kcDrawEscalation(ctx, nodes, nodeR, phase){
  var _flDur=12000, _flNow=Date.now();
  Object.keys(window._kcEscalated||{}).forEach(function(si){
    var ev=window._kcEscalated[si], age=_flNow-ev.ts;
    if(age>_flDur){delete window._kcEscalated[si];return;}
    var decay=1-age/_flDur;
    var flA=Math.abs(Math.sin(phase*Math.PI*14))*decay*0.78;
    if(flA<0.02) return;
    var fn1=nodes[parseInt(si)], fn2=nodes[parseInt(si)+1];
    if(!fn1||!fn2) return;
    ctx.save(); ctx.strokeStyle='rgba(255,59,92,'+flA+')'; ctx.lineWidth=9; ctx.lineCap='butt';
    ctx.shadowColor='rgba(255,59,92,0.95)'; ctx.shadowBlur=18;
    ctx.beginPath(); ctx.moveTo(fn1.x+nodeR,fn1.y); ctx.lineTo(fn2.x-nodeR,fn2.y); ctx.stroke(); ctx.restore();
    if(decay>0.4){
      var mx=Math.round((fn1.x+nodeR+fn2.x-nodeR)/2), my=fn1.y-18;
      ctx.save(); ctx.fillStyle='rgba(255,59,92,'+(decay*0.85)+')';
      ctx.font='bold 8px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='rgba(255,59,92,0.7)'; ctx.shadowBlur=6;
      ctx.fillText('\u26a1 '+ev.from+'\u2192'+ev.to,mx,my); ctx.restore();
    }
  });
}

function _kcDrawParticles(ctx, nodes, nodeR){
  _kcParticles.forEach(function(p){
    var n1=nodes[p.seg], n2=nodes[p.seg+1];
    if(!n1||!n2||p.t<0.07||p.t>0.93) return;
    var px=n1.x+nodeR+(n2.x-nodeR-(n1.x+nodeR))*p.t, py=n1.y;
    var rgb=p.t<0.5?n1.s.rgb:n2.s.rgb;
    var baseAlpha=Math.sin(p.t*Math.PI)*(p.ghost?0.22:0.92);
    ctx.save(); ctx.beginPath(); ctx.arc(px,py,p.r,0,Math.PI*2);
    ctx.fillStyle='rgba('+rgb+','+baseAlpha+')';
    if(!p.ghost){ctx.shadowColor='rgba('+rgb+','+baseAlpha+')'; ctx.shadowBlur=p.r*3;}
    ctx.fill(); ctx.restore();
    if(!p.ghost&&p.cc&&p.t>0.2&&p.t<0.8){
      ctx.save(); ctx.fillStyle='rgba('+rgb+','+(baseAlpha*0.65)+')';
      ctx.font='bold 6px "Courier New",monospace'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(p.cc,px+p.r+3,py-4); ctx.restore();
    }
  });
}

function _kcDrawNodes(ctx, nodes, nodeR, maxC, counts, phase, topCC){
  nodes.forEach(function(node,i){
    var cnt=node.cnt, inten=cnt>0?Math.min(1,cnt/(maxC*0.6)):0;
    var isLast=(i===nodes.length-1), rgb=node.s.rgb, color=node.s.color;
    // Ring critique
    var critThresh=(window._kcCritThresh||{})[node.s.id], isCrit=!!(critThresh&&cnt>=critThresh);
    if(isCrit){
      var critPulse=0.5+0.5*Math.sin(phase*Math.PI*6+i*0.7);
      ctx.save(); _kcHex(ctx,node.x,node.y,nodeR+20+critPulse*10);
      ctx.strokeStyle='rgba('+rgb+','+(0.50*critPulse)+')'; ctx.lineWidth=2;
      ctx.shadowColor='rgba('+rgb+',0.85)'; ctx.shadowBlur=24; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.fillStyle='rgba('+rgb+','+(0.72+0.28*critPulse)+')';
      ctx.font='bold '+Math.max(9,Math.round(nodeR*0.38))+'px "Courier New",monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='rgba('+rgb+',0.9)'; ctx.shadowBlur=10;
      ctx.fillText('\u26a0',node.x+Math.round(nodeR*0.78),node.y-Math.round(nodeR*0.78)); ctx.restore();
    }
    // Halo pulsant
    var prevCnt=i>0?(counts[KCK_STAGES[i-1].id]||0):0;
    var nextCnt=i<nodes.length-1?(counts[KCK_STAGES[i+1].id]||0):0;
    var isTransit=(cnt===0&&(prevCnt>0||nextCnt>0));
    if(cnt>0||isLast||isTransit){
      var pulse=isLast?1:(0.55+0.45*Math.sin(phase*Math.PI*2+i*1.1));
      var ha=isLast?0.08+0.06*pulse:isTransit?0.04+0.02*pulse:inten*(0.1+0.12*pulse);
      ctx.save(); _kcHex(ctx,node.x,node.y,nodeR+(isTransit?4:10+pulse*5));
      ctx.fillStyle='rgba('+rgb+','+ha+')'; ctx.fill(); ctx.restore();
      if(!isTransit){
        ctx.save(); _kcHex(ctx,node.x,node.y,nodeR+5+pulse*2);
        ctx.strokeStyle='rgba('+rgb+','+(ha*0.6)+')'; ctx.lineWidth=1; ctx.stroke(); ctx.restore();
      }
    }
    // Corps hexagone
    ctx.save(); _kcHex(ctx,node.x,node.y,nodeR);
    var bgA=cnt>0?0.16+inten*0.28:(i===0?0.12:0.05);
    ctx.fillStyle='rgba('+rgb+','+bgA+')'; ctx.fill();
    ctx.strokeStyle='rgba('+rgb+','+(cnt>0?0.75:(i===0?0.28:0.18))+')'; ctx.lineWidth=cnt>0?1.8:1;
    if(cnt>0){ctx.shadowColor='rgba('+rgb+',0.5)'; ctx.shadowBlur=10+inten*14;}
    ctx.stroke(); ctx.restore();
    // Icône + compteur
    var icons=['◎','⌖','◈','⊗','⬡'];
    ctx.save(); ctx.fillStyle='rgba('+rgb+','+(cnt>0?0.92:(i===0?0.45:0.32))+')';
    ctx.font='bold '+Math.round(nodeR*0.58)+'px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    if(cnt>0){ctx.shadowColor='rgba('+rgb+',0.6)'; ctx.shadowBlur=8;}
    ctx.fillText(icons[i],node.x,node.y-Math.round(nodeR*0.30)); ctx.restore();
    ctx.save(); ctx.fillStyle=cnt>0?color:'rgba(122,154,184,0.3)';
    ctx.font='bold '+Math.round(nodeR*0.44)+'px "Courier New",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    if(cnt>0){ctx.shadowColor='rgba('+rgb+',0.5)'; ctx.shadowBlur=6;}
    ctx.fillText(String(cnt),node.x,node.y+Math.round(nodeR*0.32)); ctx.restore();
    // Delta tendance (fade 8s)
    var _dd=window._kcDeltaDisplay||{}, _dAge=Date.now()-(_dd.ts||0), _dDur=8000;
    if(_dAge<_dDur&&_dd.deltas&&_dd.deltas[node.s.id]!==undefined){
      var dv=_dd.deltas[node.s.id], dDecay=1-_dAge/_dDur;
      var dStr=dv>0?'\u2191+'+dv:'\u2193'+dv, dRgb=dv>0?'255,80,80':'57,255,20';
      ctx.save(); ctx.fillStyle='rgba('+dRgb+','+(dDecay*0.90)+')';
      ctx.font='bold '+Math.max(7,Math.round(nodeR*0.28))+'px "Courier New",monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='rgba('+dRgb+',0.6)'; ctx.shadowBlur=dv>0?7:5;
      ctx.fillText(dStr,node.x,node.y+Math.round(nodeR*0.70)); ctx.restore();
    }
    // Labels + barre proportion + pays
    var lblY=node.y+nodeR+38;
    ctx.save(); ctx.fillStyle=cnt>0?'rgba('+rgb+',0.92)':'rgba(122,154,184,0.38)';
    ctx.font='bold '+Math.max(10,Math.round(nodeR*0.36))+'px "Courier New",monospace';
    ctx.textAlign='center'; ctx.textBaseline='top';
    if(cnt>0){ctx.shadowColor='rgba('+rgb+',0.4)'; ctx.shadowBlur=5;}
    ctx.fillText(node.s.label,node.x,lblY); ctx.restore();
    var descY=lblY+Math.max(14,Math.round(nodeR*0.48));
    ctx.save(); ctx.fillStyle='rgba(122,154,184,0.50)';
    ctx.font=Math.max(9,Math.round(nodeR*0.28))+'px "Courier New",monospace';
    ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(node.s.desc,node.x,descY); ctx.restore();
    if(node.s.mitre){
      ctx.save(); ctx.fillStyle=cnt>0?'rgba('+rgb+',0.48)':'rgba(122,154,184,0.20)';
      ctx.font='bold '+Math.max(8,Math.round(nodeR*0.26))+'px "Courier New",monospace';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(node.s.mitre,node.x,descY+Math.max(13,Math.round(nodeR*0.38))); ctx.restore();
    }
    var totalAll=KCK_STAGES.reduce(function(s,st){return s+(counts[st.id]||0);},0)||1;
    var prop=cnt/totalAll, bW=Math.round(nodeR*1.3), bH=3;
    var bx=node.x-bW/2, by=descY+Math.max(26,Math.round(nodeR*0.76));
    ctx.fillStyle='rgba('+rgb+',0.1)'; ctx.fillRect(bx,by,bW,bH);
    if(cnt>0){ctx.fillStyle='rgba('+rgb+',0.72)'; ctx.fillRect(bx,by,Math.round(bW*prop),bH);}
    var ctries=(topCC[node.s.id])||[];
    if(cnt>0&&ctries.length){
      ctx.save(); ctx.fillStyle='rgba('+rgb+',0.52)';
      ctx.font='bold '+Math.max(8,Math.round(nodeR*0.24))+'px "Courier New",monospace';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.shadowColor='rgba('+rgb+',0.25)'; ctx.shadowBlur=3;
      ctx.fillText(ctries.join(' \u00b7 '),node.x,by+bH+5); ctx.restore();
    }
  });
}

function _kcDrawFlows(ctx, nodes, nodeR){
  for(var i=0;i<nodes.length-1;i++){
    var n1=nodes[i], n2=nodes[i+1];
    var act=n1.cnt>0, ax=Math.round((n1.x+nodeR+n2.x-nodeR)/2), ay=n1.y;
    ctx.save(); ctx.fillStyle=act?'rgba('+n1.s.rgb+',0.6)':'rgba(122,154,184,0.1)';
    ctx.beginPath(); ctx.moveTo(ax,ay-2.5); ctx.lineTo(ax+6,ay); ctx.lineTo(ax,ay+2.5); ctx.closePath(); ctx.fill(); ctx.restore();
    if(n1.cnt>0){
      var fcTxt=n1.cnt>99?'99+':String(n1.cnt), fcW=fcTxt.length*5+10, fcX=ax, fcY=ay-18;
      ctx.save(); ctx.fillStyle='rgba('+n1.s.rgb+',0.16)'; ctx.strokeStyle='rgba('+n1.s.rgb+',0.42)'; ctx.lineWidth=0.7;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(fcX-fcW/2,fcY-5,fcW,11,2);ctx.fill();ctx.stroke();}
      else{ctx.fillRect(fcX-fcW/2,fcY-5,fcW,11);ctx.strokeRect(fcX-fcW/2,fcY-5,fcW,11);}
      ctx.fillStyle='rgba('+n1.s.rgb+',0.88)'; ctx.font='bold 7px "Courier New",monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(fcTxt,fcX,fcY); ctx.restore();
    }
  }
}

function _kcDrawMetrics(ctx, W, kcData, counts){
  var _kcActive=kcData.total_active||0, _kcBlocked=counts.BLOCKED||0;
  var _kcTotal=_kcActive+_kcBlocked, _kcKillRate=_kcTotal>0?Math.round(_kcBlocked/_kcTotal*100):0;
  var _kcCs=kcData._cs_decisions||0;
  ctx.save(); ctx.textAlign='right'; ctx.textBaseline='top'; ctx.font='bold 8px "Courier New",monospace';
  ctx.fillStyle='rgba(122,154,184,0.22)'; ctx.fillText('FEN\u00catre 15MIN',W-10,8);
  if(_kcKillRate>0){
    var krRgb=_kcKillRate>70?'0,255,136':_kcKillRate>40?'255,215,0':'255,59,92';
    ctx.fillStyle='rgba('+krRgb+',0.6)'; ctx.fillText('KILL RATE '+_kcKillRate+'%',W-10,20);
  }
  if(_kcActive>0){ctx.fillStyle='rgba(255,59,92,0.5)'; ctx.fillText(_kcActive+' actif'+(1!==_kcActive?'s':''),W-10,32);}
  if(_kcCs>0){ctx.fillStyle='rgba(255,107,53,0.48)'; ctx.fillText('\u229b CS '+_kcCs,W-10,44);}
  ctx.restore();
}

// ── Orchestrateur principal ──────────────────────────────────────────────────
function _drawKillChain(canvas, kcData, f2bBanned, phase){
  if(!canvas) return;
  var W=canvas.offsetWidth||canvas.width, H=canvas.height||220;
  if(canvas.width!==W||canvas.height!==H){ canvas.width=W; canvas.height=H; }
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  _kcDrawBackground(ctx, W, H);

  // Données partagées
  var counts=Object.assign({},kcData.stage_counts||{});
  counts.BLOCKED=f2bBanned||0;
  var maxC=Math.max(1, KCK_STAGES.reduce(function(m,s){return Math.max(m,counts[s.id]||0);},0));

  // Tendances ↑↓
  window._kcPrevCounts=window._kcPrevCounts||{};
  window._kcDeltaDisplay=window._kcDeltaDisplay||{ts:0,deltas:{}};
  var _anyChange=false, _newDeltas={};
  KCK_STAGES.forEach(function(s){
    var cur=counts[s.id]||0, prev=window._kcPrevCounts[s.id];
    if(prev!==undefined&&prev!==cur){_newDeltas[s.id]=cur-prev;_anyChange=true;}
    window._kcPrevCounts[s.id]=cur;
  });
  if(_anyChange) window._kcDeltaDisplay={ts:Date.now(),deltas:_newDeltas};

  // Geometry
  var n=KCK_STAGES.length;
  var nodeR=Math.min(40,Math.max(24,Math.round(W/17)));
  var padLX=Math.max(nodeR+20,Math.round(W*0.156)); // gauche — aligné sur centre col 1 (CSS 7% padding → 15.6%)
  var padRX=Math.max(nodeR+20,Math.round(W*0.156)); // droite — symétrique
  var centerY=Math.round(H*0.38);
  var nodes=KCK_STAGES.map(function(s,i){
    return {x:Math.round(padLX+i*(W-padLX-padRX)/(n-1)), y:centerY, s:s, cnt:counts[s.id]||0};
  });
  _kcNodes=nodes.map(function(nd){return{x:nd.x,y:nd.y,r:nodeR,id:nd.s.id,cnt:nd.cnt};});

  // Top countries par stage
  var _kcCC={};
  (kcData.active_ips||[]).forEach(function(ip){
    var sid=(ip.stage||'').toUpperCase(); if(!_kcCC[sid]) _kcCC[sid]={};
    var cc=ip.country||'-'; if(cc!=='-') _kcCC[sid][cc]=(_kcCC[sid][cc]||0)+1;
  });
  var topCC={};
  KCK_STAGES.forEach(function(s){
    var byC=_kcCC[s.id]||{};
    topCC[s.id]=Object.keys(byC).map(function(c){return{c:c,n:byC[c]};})
      .sort(function(a,b){return b.n-a.n;}).slice(0,2).map(function(e){return e.c;});
  });

  _kcDrawEntryBeacon(ctx, nodes[0], nodeR, phase);
  _kcDrawDefenseBeacon(ctx, nodes[nodes.length-1], nodeR, W, phase);
  _kcDrawTubes(ctx, nodes, nodeR, maxC);
  _kcDrawEscalation(ctx, nodes, nodeR, phase);
  _kcDrawParticles(ctx, nodes, nodeR);
  _kcDrawNodes(ctx, nodes, nodeR, maxC, counts, phase, topCC);
  _kcDrawFlows(ctx, nodes, nodeR);
  _kcDrawMetrics(ctx, W, kcData, counts);
}

function _kcInitParticles(kcData, f2bBanned){
  _kcParticles=[];
  // Copie locale — ne pas muter l'objet partagé
  var counts=Object.assign({},kcData.stage_counts||{});
  counts.BLOCKED=f2bBanned||0;
  // Build country arrays per stage for named particles
  var _kcIpsForCC={};
  (kcData.active_ips||[]).forEach(function(ip){
    var sid=(ip.stage||'').toUpperCase();
    if(!_kcIpsForCC[sid]) _kcIpsForCC[sid]=[];
    if(ip.country&&ip.country!=='-') _kcIpsForCC[sid].push(ip.country);
  });
  KCK_STAGES.forEach(function(s,i){
    if(i>=KCK_STAGES.length-1) return;
    var cnt=counts[s.id]||0;
    var cntNext=counts[KCK_STAGES[i+1].id]||0;
    var active=cnt>0||cntNext>0;
    // Particules fantômes toujours présentes (flux de base)
    var nGhost=active?1:2;
    for(var g=0;g<nGhost;g++){
      _kcParticles.push({seg:i, t:g/nGhost, speed:0.0015+Math.random()*0.001, r:1.0, ghost:true});
    }
    // Particules actives proportionnelles au count
    var np=Math.min(10,Math.ceil(Math.max(cnt,cntNext)/2));
    var stageCC=_kcIpsForCC[s.id]||[];
    for(var p=0;p<np;p++){
      _kcParticles.push({
        seg:i, t:Math.random(),
        speed:0.003+Math.random()*0.004,
        r:1.6+Math.random()*1.6,
        ghost:false,
        cc:stageCC.length?stageCC[p%stageCC.length]:'',
      });
    }
  });
}

function animateKillChain(canvas, kcData, f2bData, csData){
  if(_kcAnimFrame){cancelAnimationFrame(_kcAnimFrame);_kcAnimFrame=null;}
  var f2bBanned=((f2bData&&f2bData.total_banned)||0)+((f2bData&&f2bData.proxmox&&f2bData.proxmox.total_banned)||0);
  var csDecisions=(csData&&(csData.active_decisions||csData.decisions))||0;
  var totalBlocked=f2bBanned+csDecisions;
  kcData._cs_decisions=csDecisions;
  _kcInitParticles(kcData, totalBlocked);
  var phase=0;
  function frame(){
    if(!canvas.isConnected){_kcAnimFrame=null;return;}
    phase=(phase+0.004)%1;
    _kcParticles.forEach(function(p){p.t+=p.speed; if(p.t>1)p.t=0;});
    _drawKillChain(canvas,kcData,totalBlocked,phase);
    _kcAnimFrame=requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Clic hexagone → modal liste IPs du stage
  if(!canvas._kcClickBound){
    canvas._kcClickBound=true;
    canvas.style.cursor='default';
    canvas.addEventListener('mousemove',function(e){
      var rect=canvas.getBoundingClientRect();
      var mx=e.clientX-rect.left, my=e.clientY-rect.top;
      var hit=_kcNodes.some(function(n){return Math.sqrt((mx-n.x)*(mx-n.x)+(my-n.y)*(my-n.y))<=n.r+4;});
      canvas.style.cursor=hit?'pointer':'default';
    });
    canvas.addEventListener('click',function(e){
      var rect=canvas.getBoundingClientRect();
      var mx=e.clientX-rect.left, my=e.clientY-rect.top;
      var hit=null;
      _kcNodes.forEach(function(n){
        if(!hit&&Math.sqrt((mx-n.x)*(mx-n.x)+(my-n.y)*(my-n.y))<=n.r+4) hit=n;
      });
      if(hit) _kcOpenStageModal(hit.id, kcData);
    });
  }
}

// Modal stage — liste toutes les IPs du stage cliqué
function _kcOpenStageModal(stageId, kcData){
  var d=window._lastData||{};
  var surCrit=((d.suricata||{}).recent_critical)||[];
  var surMap={};
  surCrit.forEach(function(a){
    if(!surMap[a.src_ip])surMap[a.src_ip]={cat:'',cves:[]};
    if(!surMap[a.src_ip].cat&&a.category)surMap[a.src_ip].cat=a.category;
    var m=(a.signature||'').match(/CVE-\d{4}-\d+/i);
    if(m){var cv=m[0].toUpperCase();if(surMap[a.src_ip].cves.indexOf(cv)<0)surMap[a.src_ip].cves.push(cv);}
  });
  // Utiliser _kcGroupedData (enrichi : BLOCKED injectés) — fallback sur kcData.active_ips filtré
  var stageIps=(_kcGroupedData[stageId]&&_kcGroupedData[stageId].length)
    ? _kcGroupedData[stageId]
    : (kcData.active_ips||[]).filter(function(ip){return(ip.stage||'').toUpperCase()===stageId;});
  var stageCol=_kcStageCol(stageId), rgb=_kcStageRgb(stageId);
  var stepNum={RECON:'①',SCAN:'②',EXPLOIT:'③',BRUTE:'④',BLOCKED:'⑤'}[stageId]||'';
  var sub24={};
  stageIps.forEach(function(ip){var p=ip.ip.split('.').slice(0,3).join('.');sub24[p]=(sub24[p]||0)+1;});
  var stageEmptyHtml=!stageIps.length?'<div style="color:var(--green);font-size:var(--fs-xs)">\u2714 Aucune IP active à cette étape</div>':'';
  var stageRowsHtml=stageIps.map(function(ip){
    var surInfo=surMap[ip.ip]||{cat:'',cves:[]};
    var _nginxActive=stageId!=='BLOCKED'||(ip.count>1);
    var conf=(_nginxActive?1:0)+(ip.cs_decision?1:0)+(ip.sur_count?1:0)+(ip.banned?1:0);
    var confCol=conf>=3?'var(--green)':conf>=2?'rgba(255,215,0,.88)':'rgba(255,140,50,.8)';
    var pfx=ip.ip.split('.').slice(0,3).join('.');
    var pipsHtml=[0,1,2,3].map(function(_ci){
      return '<span style="display:inline-block;width:7px;height:3px;border-radius:1px;background:'+(_ci<conf?confCol:'rgba(255,255,255,.09)')+'"></span>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;padding:.28rem .42rem;margin-bottom:.22rem;background:rgba('+rgb+',0.05);border:1px solid rgba('+rgb+',0.14);border-radius:4px;cursor:pointer" data-kc-ip="'+esc(ip.ip)+'">'
      +(ip.country&&ip.country!=='-'?'<span style="font-size:var(--fs-xs);color:rgba(200,230,255,.5)">'+esc(ip.country)+'</span>':'')
      +'<span style="color:'+stageCol+';font-size:var(--fs-xs);font-weight:700">'+esc(ip.ip)+'</span>'
      +'<span style="color:rgba(200,230,255,.38);font-size:var(--fs-xs)">\u00d7'+ip.count+'</span>'
      +(ip.cs_decision?'<span style="font-size:var(--fs-xs);background:rgba(255,107,53,0.2);color:var(--orange);padding:.02rem .2rem;border-radius:2px">\u229bCS</span>':'')
      +(ip.sur_count?'<span style="font-size:var(--fs-xs);background:rgba(255,96,48,0.2);color:#ff6030;padding:.02rem .2rem;border-radius:2px">\u25c8IDS</span>':'')
      +(surInfo.cves.length?'<span style="font-size:var(--fs-xs);background:rgba(255,70,40,0.18);color:rgba(255,110,70,.9);padding:.02rem .2rem;border-radius:2px;border:1px solid rgba(255,70,40,.25)">'+esc(surInfo.cves[0])+'</span>':'')
      +((sub24[pfx]||0)>=2?'<span style="font-size:var(--fs-xs);background:rgba(255,215,0,.12);color:#ffd700;border:1px solid rgba(255,215,0,.3);padding:.02rem .2rem;border-radius:2px">\u26a1/24</span>':'')
      +'<span style="margin-left:auto;display:flex;gap:2px">'+pipsHtml+'</span>'
      +'<span style="font-size:var(--fs-xs);color:rgba(0,217,255,.35)">\u25b8 Investigation</span>'
      +'</div>';
  }).join('');
  var mh='<div style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">'
   +'<div style="font-size:var(--fs-xs);color:rgba(160,220,255,.35);letter-spacing:.8px;margin-bottom:.5rem">'
    +stepNum+' '+stageId+' \u2014 '+stageIps.length+' IP'+(stageIps.length>1?'s':'')+' actives dans cette étape</div>'
   +stageEmptyHtml+stageRowsHtml
   +'</div>';
  document.getElementById('modal-header-title').innerHTML
    ='<span style="opacity:.55;margin-right:.3rem">'+esc(String(stepNum))+'</span>ÉTAPE : '+esc(stageId);
  document.getElementById('modal-body').innerHTML=mh;
  // Bindings CSP-safe — data-kc-ip (remplace onclick inline)
  (function(){ var b=document.getElementById('modal-body'); if(!b) return;
    b.addEventListener('click',function(e){
      var el=e.target.closest('[data-kc-ip]');
      if(el) _kcInvestigateIP(el.getAttribute('data-kc-ip'));
    });
  })();
  openModal(null);
}

// ── Kill Chain — Helpers globaux investigation ─────────────
function _kcFmtScenario(s){
  return (s||'').replace(/^crowdsecurity\//i,'').replace(/^suricata-/i,'').replace(/_/g,'-')
    .replace(/\s+non\s+bloqu[eé]\s*(CS)?\s*$/i,'').slice(0,40).replace(/[-_ ]+$/,'');
}
function _kcFmtCat(c){
  var m={'Attempted Administrator Privilege Gain':'Priv.Escalation','Attempted User Privilege Gain':'Priv.Escalation',
    'A Network Trojan was Detected':'Trojan','Web Application Attack':'WebApp Attack',
    'Denial of Service':'DoS','Attempted Denial of Service':'DoS','Executable Code was Detected':'Exec Code',
    'Misc Attack':'Attack','Information Leak':'Info Leak','Potentially Bad Traffic':'Bad Traffic'};
  return m[c]||(c?c.slice(0,32):'');
}
function _kcStageRgb(stage){
  var m={RECON:'191,95,255',SCAN:'255,107,53',EXPLOIT:'255,215,0',BRUTE:'255,59,92',BLOCKED:'0,255,136'};
  return m[(stage||'').toUpperCase()]||'0,217,255';
}
function _kcStageCol(stage){
  var m={RECON:'#bf5fff',SCAN:'#ff6b35',EXPLOIT:'#ffd700',BRUTE:'#ff3b5c',BLOCKED:'#00ff88'};
  return m[(stage||'').toUpperCase()]||'#00d9ff';
}
// Ban cascade : 1) JARVIS  2) CrowdSec LAPI direct (si JARVIS arrêté)
function _kcBanIP(ipStr, btn){
  if(!ipStr) return;
  if(btn){btn.disabled=true;btn.textContent='\u29d7 BAN\u2026 (JARVIS)';}
  // — Tentative primaire : JARVIS —
  fetch(JV_URL+'/api/soc/ban-ip',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ip:ipStr,duration:'24h'}),
    signal:AbortSignal.timeout(5000)})
  .then(function(r){return r.json();})
  .then(function(r){
    if(r.status==='ok'){_kcSetBtnOk(btn,'JARVIS');}
    else{_kcSetBtnErr(btn,r.message||'Erreur JARVIS');}
  })
  .catch(function(){
    // JARVIS arrêté ou timeout → bascule automatique sur CS direct
    _kcBanViaCrowdSec(btn,ipStr);
  });
}
function _kcCopyIP(ipStr,btn){
  navigator.clipboard.writeText(ipStr).then(function(){
    var t=btn.textContent;btn.textContent='✔ COPIÉ';setTimeout(function(){btn.textContent=t;},_KC_COPY_RESET_MS);
  });
}
function _kcInvestigateIP(ipStr){
  var d=window._lastData||{};
  var kc=d.kill_chain||{};
  var csDetail=(d.crowdsec||{}).decisions_detail||{};
  var surCrit=((d.suricata||{}).recent_critical)||[];
  // Collect all CVEs + cat from Suricata for this IP
  var surInfo={cat:'',cves:[]};
  surCrit.forEach(function(a){
    if(a.src_ip!==ipStr) return;
    if(!surInfo.cat&&a.category) surInfo.cat=a.category;
    var m=(a.signature||'').match(/CVE-\d{4}-\d+/i);
    if(m){var cv=m[0].toUpperCase();if(surInfo.cves.indexOf(cv)<0)surInfo.cves.push(cv);}
  });
  // Construire le set des IPs bannies fail2ban depuis jails[].banned_ips
  var _f2bBannedSet={};
  ((d.fail2ban||{}).jails||[]).forEach(function(j){
    (j.banned_ips||[]).forEach(function(e){if(e.ip)_f2bBannedSet[e.ip]=true;});
  });
  // Find IP object — priorité : active_ips > csDetail > fail2ban > inconnu
  var _activeIpObj=(kc.active_ips||[]).filter(function(x){return x.ip===ipStr;})[0]||null;
  var ipObj=_activeIpObj||
    (csDetail[ipStr]?{ip:ipStr,stage:'BLOCKED',count:0,country:csDetail[ipStr].country||'-',cs_decision:true,sur_count:0}:null)||
    (_f2bBannedSet[ipStr]?{ip:ipStr,stage:'BLOCKED',count:0,country:'-',cs_decision:false,sur_count:0}:null)||
    {ip:ipStr,stage:'INCONNU',count:0,country:'-',cs_decision:false,sur_count:0};
  // Enrichir : banned depuis jails réels
  ipObj.banned=!!_f2bBannedSet[ipStr];
  var csInfo=csDetail[ipStr]||{};
  var stageCol=_kcStageCol(ipObj.stage);
  var rgb=_kcStageRgb(ipObj.stage);
  // Confidence score (0-4)
  // NGINX : actif seulement si l'IP est dans active_ips (trafic réel observé)
  var conf=0,confSrcs=[];
  if(_activeIpObj){
    conf++;confSrcs.push({n:'NGINX',v:'\u00d7'+ipObj.count+' req/15min',on:true,col:'var(--cyan)'});
  } else {
    confSrcs.push({n:'NGINX',v:'Trafic actuel nul (neutralis\u00e9)',on:false,col:'var(--cyan)'});
  }
  if(ipObj.cs_decision){
    conf++;confSrcs.push({n:'CROWDSEC \u229b',v:'D\u00e9cision active',on:true,col:'var(--orange)'});
  } else {
    confSrcs.push({n:'CROWDSEC \u229b',v:'Aucune d\u00e9cision active',on:false,col:'var(--orange)'});
  }
  if(ipObj.sur_count){
    conf++;confSrcs.push({n:'SURICATA IDS \u25c8',v:surInfo.cat?_kcFmtCat(surInfo.cat):'\u00d7'+ipObj.sur_count+' alertes IDS',on:true,col:'#ff6030'});
  } else {
    confSrcs.push({n:'SURICATA IDS \u25c8',v:'Aucune alerte IDS',on:false,col:'#ff6030'});
  }
  if(ipObj.banned){
    conf++;confSrcs.push({n:'FAIL2BAN \u26d4',v:'Banni — jail actif',on:true,col:'var(--red)'});
  } else {
    confSrcs.push({n:'FAIL2BAN \u26d4',v:'Non banni (encore)',on:false,col:'var(--red)'});
  }
  var confCol=conf>=3?'var(--green)':conf>=2?'rgba(255,215,0,0.9)':'var(--orange)';
  var confLbl=conf>=4?'CONFIRM\u00c9':conf>=3?'\u00c9LEV\u00c9':conf>=2?'MOD\u00c9R\u00c9':'FAIBLE';
  // /24 subnet peers
  var subPfx=ipStr.split('.').slice(0,3).join('.');
  var subPeers=(kc.active_ips||[]).filter(function(x){return x.ip!==ipStr&&x.ip.indexOf(subPfx+'.')===0;});
  // Recommended action — logique cohérente avec les 4 sources de neutralisation
  var isBlocked=(ipObj.stage==='BLOCKED')||ipObj.cs_decision||ipObj.banned;
  var recTxt,recCol;
  if(isBlocked){
    if(ipObj.cs_decision&&ipObj.banned){
      recTxt='\u2714 Double protection\u00a0: CrowdSec \u229b + fail2ban \u26d4 — menace neutralis\u00e9e';recCol='var(--green)';
    } else if(ipObj.cs_decision){
      recTxt='\u2714 Neutralis\u00e9 — d\u00e9cision CrowdSec active (ban 24h\u20137j selon sc\u00e9nario)';recCol='var(--green)';
    } else {
      recTxt='\u2714 Banni par fail2ban \u26d4 — d\u00e9fense active en place';recCol='var(--green)';
    }
  } else if(conf>=2){
    recTxt='\u26a1 Ban automatique d\u00e9clench\u00e9 \u2014 '+conf+'/4 sources (NGINX + Suricata IDS)';recCol='rgba(255,140,50,0.95)';
  } else {
    recTxt='\u25ce Confiance faible (1/4 source)\u00a0— surveiller \u00e9volution';recCol='var(--cyan)';
  }
  // Build modal HTML — pre-vars
  var pipsHtml2=[0,1,2,3].map(function(_pi){
    return '<div class="kci-conf-pip" style="background:'+(_pi<conf?confCol:'rgba(255,255,255,0.08)')+'"></div>';
  }).join('');
  var srcsHtml=confSrcs.map(function(src){
    return '<div class="kci-src '+(src.on?'kci-src-on':'kci-src-off')+'">'
      +'<div class="kci-lbl" style="color:'+(src.on?src.col:'rgba(122,154,184,0.32)')+'">'+(src.on?'\u2714 ':'\u2717 ')+esc(src.n)+'</div>'
      +'<div class="kci-val">'+esc(src.v)+'</div>'
      +'</div>';
  }).join('');
  var cvesHtml=surInfo.cves.length
    ?'<div style="margin:.28rem 0 .12rem"><span style="font-size:var(--fs-xs);letter-spacing:.8px;color:rgba(160,220,255,.38)">CVE D\u00c9TECT\u00c9ES</span></div>'
      +'<div class="kci-cve-list">'+surInfo.cves.slice(0,10).map(function(cv){return '<span class="kci-cve">'+esc(cv)+'</span>';}).join('')+'</div>'
    :'';
  var scenarioHtml=csInfo.scenario
    ?'<div style="margin:.28rem 0;padding:.23rem .4rem;background:rgba(255,107,53,0.07);border-left:2px solid rgba(255,107,53,0.38);border-radius:0 3px 3px 0">'
      +'<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.38);letter-spacing:.5px">SC\u00c9NARIO CROWDSEC \u25b8 </span>'
      +'<span style="font-size:var(--fs-xs);color:var(--orange)">'+esc(_kcFmtScenario(csInfo.scenario))+'</span>'
      +'</div>'
    :'';
  var surCatHtml=surInfo.cat
    ?'<div style="margin:.22rem 0;padding:.23rem .4rem;background:rgba(255,96,48,0.07);border-left:2px solid rgba(255,96,48,0.32);border-radius:0 3px 3px 0">'
      +'<span style="font-size:var(--fs-xs);color:rgba(160,220,255,.38);letter-spacing:.5px">CAT\u00c9GORIE SURICATA \u25b8 </span>'
      +'<span style="font-size:var(--fs-xs);color:#ff6030">'+esc(surInfo.cat)+'</span>'
      +'</div>'
    :'';
  var clusterHtml=subPeers.length
    ?'<div class="kci-cluster-alert">'
      +'\u26a1 CAMPAGNE COORDONN\u00c9E \u2014 r\u00e9seau /24 \u2192 '+esc(subPfx)+'.x \u2014 '
      +subPeers.length+' autre'+(subPeers.length>1?'s':'')+' IP'+(subPeers.length>1?'s':'')+' actives\u00a0: '
      +subPeers.slice(0,5).map(function(x){return esc(x.ip);}).join(' \u00b7 ')
      +(subPeers.length>5?'  +'+(subPeers.length-5)+'\u00a0\u2026':'')
      +'</div>'
    :'';
  var _jvUp=!!(window._jvOnline||(window._lastData&&(window._lastData.jarvis||{}).available));
  var _banMode=_jvUp
    ?'<span style="color:rgba(0,217,255,.45)">\u25b8 Ban automatique actif — JARVIS + CrowdSec cascade</span>'
    :'<span style="color:rgba(255,215,0,.55)">\u25b8 Ban automatique actif — CrowdSec LAPI direct (JARVIS inactif)</span>';
  var mh='<div style="font-family:\'Courier New\',monospace;font-size:var(--fs-xs);line-height:1.55">'
   +'<div style="margin-bottom:.5rem;border-radius:4px;overflow:hidden;border:1px solid rgba('+rgb+',0.14)">'
    +'<div style="font-size:var(--fs-xs);color:rgba(160,220,255,.3);letter-spacing:.9px;padding:.18rem .5rem .05rem;text-transform:uppercase">Mode opératoire — chemin d\'attaque</div>'
    +'<canvas id="kci-chain-canvas" height="230" style="width:100%;display:block"></canvas>'
    +'</div>'
   +'<div style="display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;padding:.4rem .58rem;background:rgba('+rgb+',0.08);border:1px solid rgba('+rgb+',0.3);border-radius:5px;margin-bottom:.5rem">'
    +'<span style="font-size:var(--fs-md);font-weight:700;color:'+stageCol+';letter-spacing:.5px">'+esc(ipStr)+'</span>'
    +(ipObj.country&&ipObj.country!=='-'?'<span style="background:rgba(255,255,255,0.06);padding:.07rem .26rem;border-radius:3px;font-size:var(--fs-xs);color:rgba(200,230,255,0.68)">'+esc(ipObj.country)+'</span>':'')
    +'<span style="margin-left:auto;font-size:var(--fs-xs);font-weight:700;color:'+stageCol+';border:1px solid '+stageCol+';padding:.09rem .3rem;border-radius:3px;letter-spacing:.5px">'+esc(ipObj.stage)+'</span>'
    +'</div>'
   +'<div style="margin-bottom:.48rem">'
    +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.2rem">'
    +'<span style="font-size:var(--fs-xs);letter-spacing:.8px;color:rgba(160,220,255,.42)">INDICE DE CONFIANCE</span>'
    +'<span style="font-size:var(--fs-xs);font-weight:700;color:'+confCol+'">'+confLbl+' — '+conf+'/4 sources</span>'
    +'</div>'
    +'<div class="kci-conf-bar">'+pipsHtml2+'</div></div>'
   +'<div class="kci-grid">'+srcsHtml+'</div>'
   +cvesHtml+scenarioHtml+surCatHtml+clusterHtml
   +'<div style="font-size:var(--fs-xs);color:'+recCol+';padding:.26rem .4rem;background:rgba(255,255,255,0.022);border-radius:3px;margin:.36rem 0;border:1px solid rgba(255,255,255,0.05)">'+recTxt+'</div>'
   +'<div style="font-size:var(--fs-xs);font-family:\'Courier New\',monospace;margin:.22rem 0 .32rem;padding:.16rem .38rem;background:rgba(0,0,0,0.18);border-radius:3px">'+_banMode+'</div>'
   +'<div class="kci-actions">'
    +'<button class="kci-btn kci-btn-copy" data-kci-copy="1">\u2398 COPIER IP</button>'
    +'<a class="kci-btn kci-btn-abuse" href="https://www.abuseipdb.com/check/'+encodeURIComponent(ipStr)+'" target="_blank" rel="noopener">\u2197 ABUSEIPDB</a>'
    +'</div>'
   +'</div>';
  // Inject and open
  document.getElementById('modal-header-title').innerHTML='<span style="opacity:.55;margin-right:.3rem">\u26d3</span>INVESTIGATION \u2014 '+esc(ipStr);
  document.getElementById('modal-body').innerHTML=mh;
  // Binding CSP-safe — data-kci-copy (remplace onclick inline)
  (function(ipS){ var b=document.getElementById('modal-body'); if(!b) return;
    var btn=b.querySelector('[data-kci-copy]');
    if(btn) btn.addEventListener('click',function(){ _kcCopyIP(ipS,this); });
  })(ipStr);
  document.getElementById('modal-card').classList.add('modal-kci');
  openModal(null);
  // Lancer le schéma dynamique du mode opératoire
  _raf2(function(){
    var _kciCv=document.getElementById('kci-chain-canvas');
    if(_kciCv) _kciAnimMiniChain(_kciCv, ipObj, csInfo, surInfo);
  });
}
// ── Kill Chain investigation — mini schéma dynamique ─────────
