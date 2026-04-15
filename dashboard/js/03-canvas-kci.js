function _kciAnimMiniChain(canvas, ipObj, csInfo, surInfo){
  if(_kciAnimFrame){cancelAnimationFrame(_kciAnimFrame);_kciAnimFrame=null;}
  var _stIds =['RECON','SCAN','EXPLOIT','BRUTE','BLOCKED'];
  var _stCols={RECON:'#bf5fff',SCAN:'#ff6b35',EXPLOIT:'#ffd700',BRUTE:'#ff3b5c',BLOCKED:'#00ff88'};
  var _stRgbs={RECON:'191,95,255',SCAN:'255,107,53',EXPLOIT:'255,215,0',BRUTE:'255,59,92',BLOCKED:'0,255,136'};
  var _stIcons=['◎','⌖','◈','⊗','⬡'];
  var curStage=(ipObj.stage||'RECON').toUpperCase();
  var attackIdx=_stIds.indexOf(curStage);if(attackIdx<0)attackIdx=0;
  // Si l'IP est neutralisée (CS decision ou fail2ban), déplacer le curseur sur BLOCKED
  // sans traverser BRUTE — travMax = limite de traversal des tubes/flèches
  var isNeutralized=!!(ipObj.cs_decision||ipObj.banned);
  var curIdx=isNeutralized?(_stIds.length-1):attackIdx;
  var travMax=attackIdx;
  // annIdx : index cible pour les annotations d'attaque (stade d'attaque, pas BLOCKED)
  var annIdx=isNeutralized?attackIdx:curIdx;
  // Annotations par étape inférées depuis les sources disponibles
  var ann=['','','','',''];
  if(ipObj.count>0) ann[0]='×'+ipObj.count+' req/15min';
  if(csInfo.scenario){
    var sc=_kcFmtScenario(csInfo.scenario);
    if(/exploit|cve|inject|rce|lfi|rfi|xss|sql|traversal|webshell/i.test(csInfo.scenario)) ann[2]=sc;
    else if(/brute|password|login|ssh|ftp|smtp|wp-login/i.test(csInfo.scenario)) ann[3]=sc;
    else if(/scan|probe|crawl|enum/i.test(csInfo.scenario)) ann[1]=sc;
    else ann[annIdx]=sc;
  }
  if(surInfo.cves&&surInfo.cves.length) ann[2]=ann[2]?ann[2]:surInfo.cves[0];
  if(surInfo.cat&&!ann[annIdx]) ann[annIdx]=_kcFmtCat(surInfo.cat).slice(0,20);
  if(ipObj.banned) ann[4]='fail2ban ✓';
  else if(ipObj.cs_decision) ann[4]='⊛ CS actif';
  // Particle state
  var pt=0, pSpeed=attackIdx>0?0.018:0, phase=0;
  function _draw(){
    var W=canvas.offsetWidth||canvas.width, H=canvas.height||118;
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
    var ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    // BG
    var bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'rgba(4,8,18,0.98)');bg.addColorStop(1,'rgba(6,12,26,0.98)');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // Grid
    ctx.strokeStyle='rgba(0,217,255,0.025)';ctx.lineWidth=1;
    for(var gx=0;gx<W;gx+=26){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();}
    for(var gy=0;gy<H;gy+=26){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
    var n=_stIds.length;
    var nodeR=Math.min(26,Math.max(18,Math.round(W/18)));
    var padLX=nodeR+22, padRX=nodeR+44; // asymétrique : +22px à droite pour dégager le beacon DÉFENSE
    var nSp=(W-padLX-padRX)/(n-1);
    var cY=Math.round(H*0.38);
    var nodes=_stIds.map(function(id,i){return{x:Math.round(padLX+i*nSp),y:cY,id:id,i:i};});
    // ── Beacons INTERNET (gauche) / DÉFENSE (droite) — mini chain ──
    {
      var bcPulse=0.45+0.55*Math.sin(phase*Math.PI*4);
      var bcDPulse=0.5+0.5*Math.sin(phase*Math.PI*4+0.8);
      var bcLX=5, bcRX=W-5;
      var reconX=nodes[0].x-nodeR-2;
      var blockedX=nodes[nodes.length-1].x+nodeR+2;
      // ── Gauche — INTERNET ──
      ctx.save();
      ctx.strokeStyle='rgba(255,59,92,'+(0.72*bcPulse)+')';
      ctx.lineWidth=2; ctx.lineCap='round';
      ctx.shadowColor='rgba(255,59,92,0.7)'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.moveTo(bcLX,cY-Math.round(nodeR*0.9)); ctx.lineTo(bcLX,cY+Math.round(nodeR*0.9)); ctx.stroke(); ctx.restore();
      // Tube beacon → RECON
      if(reconX>bcLX+6){
        var tgL=ctx.createLinearGradient(bcLX,0,reconX,0);
        tgL.addColorStop(0,'rgba(255,59,92,0.45)'); tgL.addColorStop(1,'rgba(191,95,255,0.15)');
        ctx.strokeStyle=tgL; ctx.lineWidth=2; ctx.lineCap='butt';
        ctx.beginPath(); ctx.moveTo(bcLX+3,cY); ctx.lineTo(reconX,cY); ctx.stroke();
        // Chevron ► animé
        var ft=((phase*3)%1);
        var fx=bcLX+4+ft*(reconX-bcLX-8);
        var fa=Math.sin(ft*Math.PI)*0.85;
        if(fa>0.05){
          ctx.save(); ctx.fillStyle='rgba(255,59,92,'+fa+')';
          ctx.shadowColor='rgba(255,59,92,'+fa+')'; ctx.shadowBlur=4;
          ctx.beginPath(); ctx.moveTo(fx-4,cY-3); ctx.lineTo(fx,cY); ctx.lineTo(fx-4,cY+3); ctx.lineTo(fx-2,cY);
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
      // Label INTERNET — ancré en haut du canvas (jamais en collision avec les nœuds)
      ctx.save(); ctx.fillStyle='rgba(255,59,92,0.62)';
      ctx.font='bold 7px "Courier New",monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText('INTERNET',bcLX,8); ctx.restore();
      // ── Droite — DÉFENSE ──
      ctx.save();
      ctx.strokeStyle='rgba(0,255,136,'+(0.72*bcDPulse)+')';
      ctx.lineWidth=2; ctx.lineCap='round';
      ctx.shadowColor='rgba(0,255,136,0.7)'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.moveTo(bcRX,cY-Math.round(nodeR*0.9)); ctx.lineTo(bcRX,cY+Math.round(nodeR*0.9)); ctx.stroke(); ctx.restore();
      // Tube BLOCKED → beacon droite
      if(bcRX>blockedX+6){
        var tgR=ctx.createLinearGradient(blockedX,0,bcRX,0);
        tgR.addColorStop(0,'rgba(0,255,136,0.15)'); tgR.addColorStop(1,'rgba(0,255,136,0.45)');
        ctx.strokeStyle=tgR; ctx.lineWidth=2; ctx.lineCap='butt';
        ctx.beginPath(); ctx.moveTo(blockedX,cY); ctx.lineTo(bcRX-3,cY); ctx.stroke();
        // Chevron ◄ animé (droite→gauche)
        var ft2=((phase*3+0.5)%1);
        var fx2=bcRX-4-ft2*(bcRX-blockedX-8);
        var fa2=Math.sin(ft2*Math.PI)*0.85;
        if(fa2>0.05){
          ctx.save(); ctx.fillStyle='rgba(0,255,136,'+fa2+')';
          ctx.shadowColor='rgba(0,255,136,'+fa2+')'; ctx.shadowBlur=4;
          ctx.beginPath(); ctx.moveTo(fx2+4,cY-3); ctx.lineTo(fx2,cY); ctx.lineTo(fx2+4,cY+3); ctx.lineTo(fx2+2,cY);
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
      // Label DÉFENSE — ancré en haut du canvas (jamais en collision avec les nœuds)
      ctx.save(); ctx.fillStyle='rgba(0,255,136,0.62)';
      ctx.font='bold 7px "Courier New",monospace'; ctx.textAlign='right'; ctx.textBaseline='top';
      ctx.fillText('D\u00c9FENSE',bcRX,8); ctx.restore();
    }
    // Tubes
    for(var i=0;i<nodes.length-1;i++){
      var n1=nodes[i],n2=nodes[i+1];
      var trav=i<travMax, nxt=i===curIdx;
      var rgb1=_stRgbs[n1.id],rgb2=_stRgbs[n2.id];
      var alpha=trav?0.48:nxt?0.22:0.05;
      var tW=Math.max(2,Math.round(7*(1-i*0.1)));
      var tg=ctx.createLinearGradient(n1.x,0,n2.x,0);
      tg.addColorStop(0,'rgba('+rgb1+','+alpha+')');
      tg.addColorStop(1,'rgba('+rgb2+','+alpha+')');
      ctx.strokeStyle=tg;ctx.lineWidth=tW;ctx.lineCap='butt';
      ctx.beginPath();ctx.moveTo(n1.x+nodeR,n1.y);ctx.lineTo(n2.x-nodeR,n2.y);ctx.stroke();
      if(trav){
        ctx.save();ctx.shadowColor='rgba('+rgb2+',0.38)';ctx.shadowBlur=4;
        ctx.strokeStyle='rgba('+rgb2+',0.38)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(n1.x+nodeR,n1.y-tW/2-1);ctx.lineTo(n2.x-nodeR,n2.y-tW/2-1);ctx.stroke();ctx.restore();
      }
    }
    // Particle
    if(curIdx>0&&pt>=0){
      var pSeg=Math.floor(pt),pFrac=pt-pSeg;
      if(pSeg<nodes.length-1&&pFrac>0.06&&pFrac<0.94){
        var pn1=nodes[pSeg],pn2=nodes[pSeg+1];
        var px=pn1.x+nodeR+(pn2.x-nodeR-pn1.x-nodeR)*pFrac,py=pn1.y;
        var pRgb=pFrac<0.5?_stRgbs[pn1.id]:_stRgbs[pn2.id];
        var pA=Math.sin(pFrac*Math.PI)*0.95;
        ctx.save();ctx.beginPath();ctx.arc(px,py,2.8,0,Math.PI*2);
        ctx.fillStyle='rgba('+pRgb+','+pA+')';
        ctx.shadowColor='rgba('+pRgb+',0.85)';ctx.shadowBlur=9;
        ctx.fill();ctx.restore();
      }
    }
    // Arrows
    for(var i=0;i<nodes.length-1;i++){
      var n1=nodes[i],n2=nodes[i+1];
      var trav=i<travMax,ax=Math.round((n1.x+nodeR+n2.x-nodeR)/2),ay=n1.y;
      ctx.save();
      ctx.fillStyle=trav?'rgba('+_stRgbs[n1.id]+',0.5)':'rgba(122,154,184,0.07)';
      ctx.beginPath();ctx.moveTo(ax,ay-3);ctx.lineTo(ax+5,ay);ctx.lineTo(ax,ay+3);
      ctx.closePath();ctx.fill();ctx.restore();
    }
    // Counts globaux + seuils critiques (source unique : window._kcCritThresh)
    var _mcCounts=(window._lastData&&window._lastData.kill_chain&&window._lastData.kill_chain.stage_counts)||{};
    // Nodes
    nodes.forEach(function(node,i){
      var rgb=_stRgbs[node.id],color=_stCols[node.id];
      var isCur=(i===curIdx),isTrav=(i<=travMax&&i!==curIdx),isFut=!(isCur||isTrav);
      var pulse=isCur?(0.58+0.42*Math.sin(phase*Math.PI*2)):1;
      // ── Ring critique : nœud courant OU nœud d'attaque si IP neutralisée ──
      if(isCur||(isTrav&&i===attackIdx)){
        var _mcCnt=_mcCounts[node.id]||0;
        var _mcThresh=(window._kcCritThresh||{})[node.id];
        if(_mcThresh&&_mcCnt>=_mcThresh){
          var critP=0.5+0.5*Math.sin(phase*Math.PI*6);
          ctx.save();
          _kcHex(ctx,node.x,node.y,nodeR+14+critP*7);
          ctx.strokeStyle='rgba('+rgb+','+(0.50*critP)+')';
          ctx.lineWidth=1.5;
          ctx.shadowColor='rgba('+rgb+',0.85)'; ctx.shadowBlur=18;
          ctx.stroke(); ctx.restore();
          ctx.save();
          ctx.fillStyle='rgba('+rgb+','+(0.72+0.28*critP)+')';
          ctx.font='bold '+Math.max(8,Math.round(nodeR*0.42))+'px "Courier New",monospace';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.shadowColor='rgba('+rgb+',0.9)'; ctx.shadowBlur=8;
          ctx.fillText('\u26a0',node.x+Math.round(nodeR*0.82),node.y-Math.round(nodeR*0.82));
          ctx.restore();
        }
      }
      // Halo pulsant sur nœud courant
      if(isCur){
        ctx.save();
        _kcHex(ctx,node.x,node.y,nodeR+7+pulse*6);
        ctx.fillStyle='rgba('+rgb+','+(0.07+0.1*pulse)+')';ctx.fill();
        ctx.strokeStyle='rgba('+rgb+',0.28)';ctx.lineWidth=1;ctx.stroke();
        ctx.restore();
      }
      // Corps
      ctx.save();_kcHex(ctx,node.x,node.y,nodeR);
      var bgA=isCur?0.2+0.15*pulse:isTrav?0.11:0.03;
      ctx.fillStyle='rgba('+rgb+','+bgA+')';ctx.fill();
      ctx.strokeStyle='rgba('+rgb+','+(isCur?(0.68+0.28*pulse):isTrav?0.5:0.1)+')';
      ctx.lineWidth=isCur?1.8:isTrav?1.4:0.7;
      if(isCur){ctx.shadowColor='rgba('+rgb+',0.5)';ctx.shadowBlur=12+pulse*8;}
      ctx.stroke();ctx.restore();
      // Icône / checkmark
      ctx.save();
      ctx.fillStyle='rgba('+rgb+','+(isCur?0.95:isTrav?0.68:0.2)+')';
      ctx.font='bold '+Math.round(nodeR*0.58)+'px "Courier New",monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      if(isCur){ctx.shadowColor='rgba('+rgb+',0.55)';ctx.shadowBlur=8;}
      ctx.fillText(isTrav?'✓':_stIcons[i],node.x,node.y-Math.round(nodeR*0.28));
      ctx.restore();
      // Label + annotation — démarre après le ring critique max (nodeR+21) + marge
      var lblFontSz=Math.max(10,Math.round(nodeR*0.44));
      var annFontSz=Math.max(9,Math.round(nodeR*0.34));
      var lblY=node.y+nodeR+30;
      // Label (ID stage)
      ctx.save();
      ctx.fillStyle=isCur?color:isTrav?'rgba('+rgb+',0.68)':'rgba(122,154,184,0.22)';
      ctx.font='bold '+lblFontSz+'px "Courier New",monospace';
      ctx.textAlign='center';ctx.textBaseline='top';
      if(isCur){ctx.shadowColor='rgba('+rgb+',0.5)';ctx.shadowBlur=7;}
      ctx.fillText(node.id,node.x,lblY);
      ctx.restore();
      // Annotation (fond semi-transparent pour lisibilité)
      if(ann[i]){
        var annText=ann[i].slice(0,22);
        var annY=lblY+lblFontSz+8;
        // Fond pill
        if(isCur||isTrav){
          ctx.save();
          var annW=ctx.measureText(annText).width+10;
          var annH=annFontSz+6;
          ctx.fillStyle='rgba('+rgb+','+(isCur?0.13:0.07)+')';
          if(ctx.roundRect){ctx.beginPath();ctx.roundRect(node.x-annW/2,annY-2,annW,annH,2);ctx.fill();}
          else{ctx.fillRect(node.x-annW/2,annY-2,annW,annH);}
          ctx.restore();
        }
        ctx.save();
        ctx.font=annFontSz+'px "Courier New",monospace';
        ctx.fillStyle=isCur?'rgba('+rgb+',0.85)':isTrav?'rgba('+rgb+',0.52)':'rgba(122,154,184,0.18)';
        ctx.textAlign='center';ctx.textBaseline='top';
        if(isCur){ctx.shadowColor='rgba('+rgb+',0.4)';ctx.shadowBlur=4;}
        ctx.fillText(annText,node.x,annY);
        ctx.restore();
      }
      // Durée dans ce stage — isTrav (étapes traversées)
      if(isTrav){
        var _se=window._kcStageEntered&&window._kcStageEntered[ipObj.ip];
        if(_se&&_se[node.id]){
          var _exitTs=null;
          for(var _j=i+1;_j<_stIds.length;_j++){if(_se[_stIds[_j]]){_exitTs=_se[_stIds[_j]];break;}}
          if(_exitTs){
            var _stageDur=_kcFmtDelta(_exitTs-_se[node.id]);
            if(_stageDur){
              ctx.save();
              ctx.fillStyle='rgba('+rgb+',0.45)';
              ctx.font=Math.max(7,Math.round(nodeR*0.28))+'px "Courier New",monospace';
              ctx.textAlign='center'; ctx.textBaseline='top';
              ctx.fillText('\u23f1\u00a0'+_stageDur,node.x,lblY+lblFontSz+(ann[i]?annFontSz+14:8));
              ctx.restore();
            }
          }
        }
      }
      // Marqueur "▼ ICI" au-dessus du nœud courant
      if(isCur){
        ctx.save();
        ctx.fillStyle='rgba('+rgb+','+(0.55+0.38*pulse)+')';
        ctx.font='bold '+Math.max(8,Math.round(nodeR*0.35))+'px "Courier New",monospace';
        ctx.textAlign='center';ctx.textBaseline='bottom';
        ctx.shadowColor='rgba('+rgb+',0.5)';ctx.shadowBlur=8;
        ctx.fillText('\u25bc\u00a0ICI',node.x,node.y-nodeR-9);
        ctx.restore();
        // Durée sur ce stage spécifiquement (depuis _kcStageEntered, pas total KC)
        var _seCur=window._kcStageEntered&&window._kcStageEntered[ipObj.ip];
        var _curStageTs=_seCur&&_seCur[curStage];
        var _stageAge=_curStageTs?_kcFmtDelta(Date.now()-_curStageTs):_kcFmtAge(ipObj.ip);
        if(_stageAge){
          ctx.save();
          ctx.fillStyle='rgba(180,200,255,'+(0.42+0.20*pulse)+')';
          ctx.font=Math.max(7,Math.round(nodeR*0.30))+'px "Courier New",monospace';
          ctx.textAlign='center'; ctx.textBaseline='top';
          ctx.fillText('\u23f1\u00a0'+_stageAge, node.x, lblY+lblFontSz+(ann[i]?annFontSz+14:8));
          ctx.restore();
        }
      }
    });
  }
  function _frame(){
    if(!canvas.isConnected){_kciAnimFrame=null;return;}
    phase=(phase+0.004)%1;
    if(attackIdx>0){
      pt+=pSpeed;
      if(pt>=travMax) pt=0;
    }
    _draw();
    _kciAnimFrame=requestAnimationFrame(_frame);
  }
  requestAnimationFrame(_frame);
}
// ══════════════════════════════════════════════════════

