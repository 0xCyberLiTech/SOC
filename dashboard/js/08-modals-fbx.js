'use strict';
// ── HELPERS FREEBOX — niveau module (NDT-44/76) ──
function _fbxP2(lbl,sub,ok,val){var c=ok?'var(--green)':'var(--red)';return'<div style="padding:.55rem;background:rgba(0,0,0,0.2);border:1px solid '+c+'22;border-radius:4px;text-align:center"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.2rem">'+lbl+'</div><div style="font-size:var(--fs-lg);font-weight:700;color:'+c+';font-family:\'Courier New\',monospace">'+val+'</div><div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.4);margin-top:.1rem">'+sub+'</div></div>';}
function _fbxFp(lbl,ok,ms){var c=ok?'var(--green)':'var(--red)';return'<div style="padding:.4rem .5rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.07);border-radius:4px"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.15rem">'+lbl+'</div><div style="font-size:var(--fs-sm);font-weight:700;color:'+(ok===undefined?'var(--muted)':c)+'">'+(ok===undefined?'—':ok?'✓ '+(ms?ms+' ms':'OK'):'✗ HORS LIGNE')+'</div></div>';}
var _FBX_RULE_ICO={'EXPLOIT non bloqué CS':'⊛','honeypot 1-hit':'⬡','haute frequence':'⚡','BRUTE non bloque':'⊗'};
function _fbxRuleIco(r){for(var k in _FBX_RULE_ICO)if(r&&r.indexOf(k)>-1)return _FBX_RULE_ICO[k];return'◈';}
function _fbxSBlk(lbl,rgb,s,hasSpikes){return'<div style="padding:.4rem .5rem;background:rgba(0,0,0,0.2);border:1px solid rgba('+rgb+',0.15);border-radius:4px"><div style="font-size:var(--fs-xs);color:rgba('+rgb+',0.7);text-transform:uppercase;letter-spacing:.7px;margin-bottom:.3rem">'+lbl+(hasSpikes?' <span style="color:rgba(255,160,0,0.8)">⚡</span>':'')+'</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.3rem">'+['MIN','MAX','MOY','ACT'].map(function(k,i){var v=[s.min,s.max,s.avg,s.cur][i];return'<div><div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.4)">'+k+'</div><div style="font-size:var(--fs-xs);font-weight:700;color:rgba('+rgb+','+(k==='MAX'||k==='ACT'?1:.8)+');font-family:\'Courier New\',monospace">'+fmtBps(v)+'</div></div>';}).join('')+'</div></div>';}
function _fbxFmtKbps(k){if(!k&&k!==0)return'—';var m=k/1000;return m>=1000?(m/1000).toFixed(1)+' Gbps':m>=1?m.toFixed(1)+' Mbps':k+' Kbps';}
function _fbxFmtBytes(b){if(!b)return'—';var g=b/1e9,m=b/1e6;return g>=1?g.toFixed(2)+' Go':m>=1?Math.round(m)+' Mo':Math.round(b/1e3)+' Ko';}
function _fbxBps(b){if(!b)return'—';var m=b*8/1000;return m>=1000?(m/1000).toFixed(1)+' Mbps':Math.round(m)+' Kbps';}
function _fbxFmtTs(ts){var d=new Date(ts*1000);return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})+' '+d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}
function _fbxFmtDur(s){if(!s||s<0)return'—';if(s<60)return s+'s';if(s<3600)return Math.round(s/60)+'min';return Math.floor(s/3600)+'h'+Math.round((s%3600)/60).toString().padStart(2,'0')+'min';}
function _fbxSfpGapsFrom(pts){
  var cuts=[];
  if(!pts||pts.length<2)return cuts;
  var step=(pts[pts.length-1].ts-pts[0].ts)/(pts.length-1)||0;
  if(step<=0)return cuts;
  for(var i=1;i<pts.length;i++){
    if(pts[i].ts-pts[i-1].ts>2.5*step)
      cuts.push({start:pts[i-1].ts,end:pts[i].ts,dur:pts[i].ts-pts[i-1].ts,src:'sfp',lbl:'FIBRE — SFP coupé',ongoing:false});
  }
  return cuts;
}
function _fbxBuildCuts(incidents,windowSec,sfpGaps){
  var now=Math.floor(Date.now()/1000);
  var cuts=[];
  incidents.forEach(function(i){
    if(i.end>=(now-windowSec)||i.status==='ONGOING'){
      var lbl=i.type==='DOWN_ISP'?'INTERNET — FAI':i.type==='DOWN_LOCAL'?'LOCAL / FIBRE':i.type==='DEGRADED'?'DÉGRADÉ':'?';
      cuts.push({start:i.start,end:i.end,dur:i.dur||i.end-i.start,lbl:lbl,ongoing:i.status==='ONGOING',src:'wan'});
    }
  });
  sfpGaps.forEach(function(g){
    var covered=cuts.some(function(c){return c.src==='wan'&&c.start<=g.start+60&&c.end>=g.end-60;});
    if(!covered)cuts.push(g);
  });
  cuts.sort(function(a,b){return b.start-a.start;});
  return cuts;
}
function _fbxCutsTableHtml(cuts){
  if(!cuts.length)return '<div style="margin-top:.6rem;padding:.4rem .6rem;background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.12);border-radius:4px;font-size:var(--fs-xs);color:var(--green)">✓ Aucune coupure détectée</div>';
  var rowsHtml=cuts.map(function(c){
    var rc=c.ongoing?'var(--red)':c.src==='sfp'?'var(--amber)':'var(--yellow)';
    return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)"><td style="padding:.16rem .35rem;color:rgba(180,200,220,0.8)">${_fbxFmtTs(c.start)}</td><td style="padding:.16rem .35rem;color:rgba(180,200,220,0.6)">${c.ongoing?'<span style="color:var(--red)">EN COURS</span>':_fbxFmtTs(c.end)}</td><td style="padding:.16rem .35rem;text-align:right;font-weight:700;color:${rc}">${_fbxFmtDur(c.dur)}</td><td style="padding:.16rem .35rem;color:rgba(180,200,220,0.7)">${c.lbl}</td><td style="padding:.16rem .35rem;text-align:center">${c.ongoing?'<span style="color:var(--red);font-weight:700">● ACTIF</span>':'<span style="color:var(--green)">✓ RÉSOLU</span>'}</td></tr>`;
  }).join('');
  return `<div style="margin-top:.7rem"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:.3rem">⚡ Coupures détectées</div><table style="width:100%;border-collapse:collapse;font-size:var(--fs-xs);font-family:'Courier New',monospace"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)"><th style="text-align:left;padding:.18rem .35rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">Début</th><th style="text-align:left;padding:.18rem .35rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">Fin</th><th style="text-align:right;padding:.18rem .35rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">Durée</th><th style="text-align:left;padding:.18rem .35rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">Type</th><th style="text-align:center;padding:.18rem .35rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">État</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}
function _fbxLatStatHtml(lbl,ms){
  var c=ms>80?'255,80,80':ms>30?'255,160,0':'0,217,255';
  return `<div style="padding:.35rem .4rem;background:rgba(0,0,0,0.2);border:1px solid rgba(${c},0.18);border-radius:4px;text-align:center"><div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.40);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.1rem">${lbl}</div><div style="font-size:var(--fs-xs);font-weight:700;color:rgba(${c},1);font-family:'Courier New',monospace">${ms} ms</div></div>`;
}
// NDT-45 : section WAN du modal Freebox
function _fbxSecWanHtml(wm,wmSt2,stC2,stLbl2,fbx,hist,incidents){
  var probeGridHtml=_fbxP2('BOX',SOC_INFRA.FREEBOX,wm.box&&wm.box.ok,wm.box&&wm.box.ms!=null?wm.box.ms+' ms':'KO')
    +_fbxP2('WAN INTERNET','82.65.147.2',wm.wan&&wm.wan.ok,wm.wan&&wm.wan.ms!=null?wm.wan.ms+' ms':'KO')
    +_fbxP2('HTTP CHECK','free.fr · assistance',wm.http_ok,wm.http_ok?'OK':'FAIL');
  var latencyHtml=hist.length>1
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:.3rem">◇ Latence WAN — 4 dernières heures</div><canvas id="wan-modal-spark" height="110" style="width:100%;display:block;margin-bottom:.4rem"></canvas><div id="fbx-lat-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.8rem"></div>'
    :'';
  var sondesHtml=_fbxFp('Portail Free (www.free.fr)',wm.free_dns_ok,wm.free_dns_ms)
    +_fbxFp('Assistance Free (assistance.free.fr)',wm.free_backbone_ok,wm.free_backbone_ms);
  var incidentsListHtml=!incidents.length
    ?'<div style="color:var(--green);font-size:var(--fs-xs);padding:.3rem 0">✓ Aucun incident sur la période</div>'
    :incidents.slice().reverse().map(function(inc){
      var ic=inc.status==='ONGOING'?'var(--red)':'var(--amber)';
      var dur='';try{var ms3=new Date(inc.end).getTime()-new Date(inc.start).getTime();var mn=Math.round(ms3/60000);dur=mn>0?mn+' min':'<1 min';}catch(ee){if(location.hostname==='localhost')console.error('[SOC]',ee);}
      var incStart=inc.start||'';
      return `<div style="display:flex;gap:.6rem;align-items:center;padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:var(--fs-xs)"><span style="color:${ic};font-weight:700">${inc.status==='ONGOING'?'🔴 EN COURS':'⚠ RÉSOLU'}</span><span style="color:rgba(180,200,220,0.5)">${incStart.replace('T',' ').slice(0,16)} UTC</span>${dur?`<span style="color:var(--cyan);margin-left:auto">${dur}</span>`:''}</div>`;
    }).join('');
  return `<div id="fbx-sec-wan"><div style="display:flex;gap:1rem;align-items:center;padding:.6rem .8rem;background:rgba(0,0,0,0.25);border:1px solid ${stC2}22;border-radius:4px;margin-bottom:.8rem"><span style="font-size:var(--fs-2xl);font-weight:700;color:${stC2}">${esc(stLbl2[wmSt2]||wmSt2)}</span><span style="font-size:var(--fs-md);color:var(--cyan);font-family:'Courier New',monospace">${fbx.ipv4||'—'}</span>${wm.uptime_24h!=null?`<span style="margin-left:auto;font-size:var(--fs-xs);font-weight:700;color:var(--green)">uptime 24h : ${wm.uptime_24h}%</span>`:''}</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.6rem;margin-bottom:.8rem">${probeGridHtml}</div>${latencyHtml}<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.8rem">${sondesHtml}</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:.35rem">⚠ Incidents (${incidents.length})</div>${incidentsListHtml}<div style="margin-top:.7rem;padding:.5rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:4px;font-size:var(--fs-xs);color:var(--muted)">💡 Fibre Free Delta — Les Sables d'Olonne · Panne : <span style="color:var(--cyan)">downdetector.fr/statut/free</span> · Assistance : <span style="color:var(--cyan)">3244</span></div></div>`;
}

// NDT-46 : section BOX & FIBRE — sous-helpers + orchestrateur
function _fbxDebitHtml(fbx,mDown){
  var dwPct=fbx.bandwidth_down>0?Math.min(100,Math.round(fbx.rate_down/fbx.bandwidth_down*100)):0;
  var upPct=fbx.bandwidth_up>0?Math.min(100,Math.round(fbx.rate_up/fbx.bandwidth_up*100)):0;
  var downCardHtml=`<div style="padding:.55rem .6rem;background:${mDown?'rgba(255,50,50,0.07)':'rgba(0,217,255,0.05)'};border:1px solid ${mDown?'rgba(255,50,50,0.3)':'rgba(0,217,255,0.2)'};border-radius:5px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.3rem"><span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.7px">&#8595; Download</span>${!mDown&&fbx.bandwidth_down?`<span style="font-size:var(--fs-xs);color:rgba(0,217,255,0.4)">${dwPct}% du max</span>`:''}</div><div style="font-size:var(--fs-2xl);font-weight:700;color:${mDown?'var(--red)':'var(--cyan)'};letter-spacing:-1px;line-height:1">${mDown?'HORS LIGNE':_fbxFmtKbps(fbx.rate_down)}</div>${!mDown?`<div style="height:3px;background:rgba(0,217,255,0.12);border-radius:2px;margin:.3rem 0"><div style="height:100%;width:${dwPct}%;background:linear-gradient(90deg,rgba(0,217,255,0.6),var(--cyan));border-radius:2px;transition:width .6s"></div></div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(0,217,255,0.4)"><span>Max : ${_fbxFmtKbps(fbx.bandwidth_down)}</span><span>Session : ${_fbxFmtBytes(fbx.bytes_down)}</span></div>`:''}</div>`;
  var upCardHtml=`<div style="padding:.55rem .6rem;background:${mDown?'rgba(255,50,50,0.07)':'rgba(0,255,136,0.05)'};border:1px solid ${mDown?'rgba(255,50,50,0.3)':'rgba(0,255,136,0.2)'};border-radius:5px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.3rem"><span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.7px">&#8593; Upload</span>${!mDown&&fbx.bandwidth_up?`<span style="font-size:var(--fs-xs);color:rgba(0,255,136,0.4)">${upPct}% du max</span>`:''}</div><div style="font-size:var(--fs-2xl);font-weight:700;color:${mDown?'var(--red)':'var(--green)'};letter-spacing:-1px;line-height:1">${mDown?'HORS LIGNE':_fbxFmtKbps(fbx.rate_up)}</div>${!mDown?`<div style="height:3px;background:rgba(0,255,136,0.12);border-radius:2px;margin:.3rem 0"><div style="height:100%;width:${upPct}%;background:linear-gradient(90deg,rgba(0,255,136,0.6),var(--green));border-radius:2px;transition:width .6s"></div></div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(0,255,136,0.4)"><span>Max : ${_fbxFmtKbps(fbx.bandwidth_up)}</span><span>Session : ${_fbxFmtBytes(fbx.bytes_up)}</span></div>`:''}</div>`;
  return `<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.35rem">◇ DÉBITS TEMPS RÉEL</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin-bottom:.7rem">${downCardHtml}${upCardHtml}</div>`;
}
function _fbxSfpGponHtml(fbx,sfpQ,sfpCol){
  var sfpBarHtml='';
  if(fbx.sfp_pwr_rx!=null){
    var rxN=Math.max(0,Math.min(100,Math.round((fbx.sfp_pwr_rx+32)/27*100)));
    sfpBarHtml=`<div style="margin-bottom:.5rem"><div style="position:relative;height:8px;border-radius:4px;overflow:hidden;background:linear-gradient(90deg,var(--red) 0%,var(--red) 18.5%,var(--yellow) 18.5%,var(--yellow) 44.4%,var(--green) 44.4%,var(--green) 81.5%,var(--cyan) 81.5%,var(--cyan) 100%);opacity:.35"></div><div style="position:relative;margin-top:-8px;height:8px"><div style="position:absolute;left:${rxN}%;top:50%;transform:translate(-50%,-50%);width:3px;height:14px;background:white;border-radius:2px;box-shadow:0 0 6px white"></div></div><div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.4);margin-top:.25rem"><span style="color:var(--red)">-32 FAIBLE</span><span style="color:var(--yellow)">-27</span><span style="color:var(--green)">-20 BON</span><span style="color:var(--cyan)">-8 FORT</span><span>-5</span></div></div>`;
  }
  return `<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.35rem">◈ SIGNAL FIBRE GPON — SFP OPTIQUE</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.45rem"><div style="padding:.5rem;background:rgba(0,0,0,0.3);border:1px solid ${sfpCol}33;border-radius:5px"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.2rem">Puissance RX (reçu)</div><div style="font-size:var(--fs-xl);font-weight:700;color:${sfpCol};letter-spacing:-0.5px">${fbx.sfp_pwr_rx!=null?fbx.sfp_pwr_rx+' dBm':'—'}</div><div style="display:inline-block;margin-top:.2rem;padding:.07rem .3rem;background:${sfpCol}22;border:1px solid ${sfpCol}55;border-radius:2px;font-size:var(--fs-xs);font-weight:700;color:${sfpCol}">${esc(sfpQ||'?')}</div></div><div style="padding:.5rem;background:rgba(0,0,0,0.3);border:1px solid rgba(0,217,255,0.18);border-radius:5px"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.2rem">Puissance TX (émis)</div><div style="font-size:var(--fs-xl);font-weight:700;color:var(--cyan);letter-spacing:-0.5px">${fbx.sfp_pwr_tx!=null?fbx.sfp_pwr_tx+' dBm':'—'}</div></div><div style="padding:.5rem;background:rgba(0,0,0,0.3);border:1px solid ${fbx.sfp_link?'rgba(0,255,136,0.25)':'rgba(255,50,50,0.25)'};border-radius:5px"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.2rem">Lien fibre</div><div style="font-size:var(--fs-md);font-weight:700;color:${fbx.sfp_link?'var(--green)':'var(--red)'}">${!fbx.sfp_link?'✗ ABSENT':fbx.sfp_present?'✓ ACTIF':'✗ KO'}</div></div></div>${sfpBarHtml}`;
}
function _fbxTempsHtml(temps,fans){
  if(!temps.length&&!fans.length) return '';
  var tempSectionHtml='';
  if(temps.length){
    var tMax=Math.max.apply(null,temps.map(function(t){return t.value;}));
    var tMaxC=tMax>70?'var(--red)':tMax>55?'var(--yellow)':'var(--green)';
    var tempCardsHtml=temps.map(function(t){
      var tc=t.value>70?'var(--red)':t.value>55?'var(--yellow)':'var(--green)';
      var pct=Math.min(100,Math.round((t.value-30)/60*100));
      return `<div style="padding:.35rem .4rem;background:rgba(0,0,0,0.3);border:1px solid ${tc}22;border-radius:4px"><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.15rem;line-height:1.3;word-break:break-word">${esc(t.name||'?')}</div><div style="font-size:var(--fs-sm);font-weight:700;color:${tc};line-height:1">${t.value} <span style="font-size:var(--fs-xs)">°C</span></div><div style="height:2px;background:rgba(255,255,255,0.06);border-radius:1px;margin-top:.2rem"><div style="height:100%;width:${pct}%;background:${tc};border-radius:1px;opacity:.7"></div></div></div>`;
    }).join('');
    tempSectionHtml=`<div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.3rem">◉ TEMPÉRATURES <span style="color:${tMaxC};font-size:var(--fs-xs)">max ${tMax} °C</span></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:.3rem">${tempCardsHtml}</div></div>`;
  }
  var fanSectionHtml='';
  if(fans.length){
    var fanCardsHtml=fans.map(function(f){
      var rpm=f.value||0;
      var fc=rpm===0?'var(--red)':rpm<600?'var(--yellow)':'var(--green)';
      var bars=Math.min(5,Math.round(rpm/800));
      var barsHtml='';
      for(var bi=0;bi<5;bi++)barsHtml+='<span style="display:inline-block;width:4px;height:'+(5+bi*2)+'px;background:'+(bi<bars?fc:'rgba(255,255,255,0.08)')+';border-radius:1px;vertical-align:bottom;margin-right:1px"></span>';
      return `<div style="padding:.35rem .45rem;background:rgba(0,0,0,0.3);border:1px solid ${fc}22;border-radius:4px"><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.12rem">${esc(f.name||'?')}</div><div style="display:flex;align-items:center;gap:.5rem"><span style="font-size:var(--fs-sm);font-weight:700;color:${fc};line-height:1">${rpm}<span style="font-size:var(--fs-xs)"> RPM</span></span><span style="margin-left:auto">${barsHtml}</span></div>${rpm===0?'<div style="font-size:var(--fs-xs);color:var(--red);margin-top:.1rem">▲ ARRÊTÉ</div>':''}</div>`;
    }).join('');
    fanSectionHtml=`<div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.3rem">◎ VENTILATEURS</div><div style="display:flex;flex-direction:column;gap:.3rem">${fanCardsHtml}</div></div>`;
  }
  return `<div style="display:grid;grid-template-columns:${fans.length?'1fr auto':'1fr'};gap:.6rem;margin-bottom:.7rem;align-items:start">${tempSectionHtml}${fanSectionHtml}</div>`;
}
function _fbxSfpLanHtml(sl){
  if(!sl) return '';
  var slC2=sl.link==='up'?'var(--green)':'var(--red)';
  var slBg=sl.link==='up'?'rgba(0,255,136,0.04)':'rgba(255,50,50,0.06)';
  var slBdr=sl.link==='up'?'rgba(0,255,136,0.25)':'rgba(255,50,50,0.3)';
  var macSectionHtml='';
  if(sl.mac_list&&sl.mac_list.length){
    var macCardsHtml=sl.mac_list.map(function(mac){
      var nm=mac.hostname||mac.mac||'';
      var isProx=nm.toLowerCase().indexOf('proxmox')>-1||nm.toLowerCase().indexOf('bc:24:11')>-1;
      var c3=isProx?'var(--purple)':'var(--cyan)';
      return `<div style="padding:.3rem .5rem;background:rgba(0,0,0,0.3);border:1px solid ${c3}33;border-radius:4px"><div style="font-size:var(--fs-xs);font-weight:700;color:${c3}">${esc(nm)}</div><div style="font-size:var(--fs-xs);color:var(--muted);font-family:'Courier New',monospace;margin-top:.1rem">${esc(mac.mac)}</div></div>`;
    }).join('');
    macSectionHtml=`<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:.3rem">Appareils vus sur le port SFP LAN</div><div style="display:flex;flex-wrap:wrap;gap:.3rem">${macCardsHtml}</div>`;
  }
  return `<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.35rem">⬡ SFP LAN — JARRETIÈRE DAC 10G → PROXMOX</div><div style="padding:.45rem .6rem;background:${slBg};border:1px solid ${slBdr};border-radius:5px;margin-bottom:.5rem;display:flex;align-items:center;gap:1rem">${sl.link==='up'?'<span style="width:8px;height:8px;background:var(--green);border-radius:50%;box-shadow:0 0 8px var(--green);flex-shrink:0;animation:blink .7s ease-in-out infinite"></span>':'<span style="width:8px;height:8px;background:var(--red);border-radius:50%;flex-shrink:0"></span>'}<span style="font-size:var(--fs-md);font-weight:700;color:${slC2}">${sl.link==='up'?'LIEN ACTIF':'LIEN KO'}</span><span style="font-size:var(--fs-xs);color:var(--cyan);background:rgba(0,217,255,0.1);padding:.05rem .3rem;border-radius:2px">${sl.speed} Mbps</span><span style="font-size:var(--fs-xs);color:var(--muted)">${esc(sl.mode||'')}</span><span style="margin-left:auto;font-size:var(--fs-xs);color:${sl.fcs_errors>0?'var(--red)':'rgba(0,255,136,0.6)'}">FCS : ${sl.fcs_errors>0?'⚠ '+sl.fcs_errors+' erreur(s)':'✓ 0'}</span></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.45rem;margin-bottom:.5rem"><div style="padding:.4rem;background:rgba(0,217,255,0.06);border:1px solid rgba(0,217,255,0.18);border-radius:4px;text-align:center"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.15rem">&#8593; TX courant</div><div style="font-size:var(--fs-sm);font-weight:700;color:var(--cyan)">${_fbxBps(sl.tx_bps)}</div></div><div style="padding:.4rem;background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.18);border-radius:4px;text-align:center"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.15rem">&#8595; RX courant</div><div style="font-size:var(--fs-sm);font-weight:700;color:var(--green)">${_fbxBps(sl.rx_bps)}</div></div><div style="padding:.4rem;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:4px;text-align:center"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.15rem">TX session</div><div style="font-size:var(--fs-sm);font-weight:700;color:var(--cyan)">${_fbxFmtBytes(sl.tx_bytes)}</div></div><div style="padding:.4rem;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:4px;text-align:center"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;margin-bottom:.15rem">RX session</div><div style="font-size:var(--fs-sm);font-weight:700;color:var(--green)">${_fbxFmtBytes(sl.rx_bytes)}</div></div></div>${macSectionHtml}`;
}
// NDT-49 : corps du modal d'erreur auth Freebox
function _fbxAuthBodyHtml(errDesc,isInvalid){
  return '<div style="font-family:\'Courier New\',monospace">'
   +'<div style="padding:.6rem .8rem;background:rgba(255,160,0,0.08);border:1px solid rgba(255,160,0,0.35);border-radius:4px;margin-bottom:1rem;display:flex;align-items:center;gap:.7rem">'
   +'<span style="font-size:var(--fs-2xl)">⚠</span>'
   +'<div><div style="font-size:var(--fs-xs);font-weight:700;color:rgba(255,160,0,0.95);margin-bottom:.15rem">AUTORISATION API REQUISE</div>'
   +'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.7)">'+errDesc+'</div></div>'
   +'</div>'
   +(isInvalid
     ?'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.6);margin-bottom:.9rem;line-height:1.6">La Freebox a perdu la référence de l\'application SOC Dashboard (réinitialisation, mise à jour firmware, ou expiration). Il faut re-générer le token d\'accès en lançant le script de pairing depuis srv-ngix.</div>'
     :'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.6);margin-bottom:.9rem;line-height:1.6">La Freebox Delta n\'est pas joignable sur '+SOC_INFRA.FREEBOX+'. Vérifier le LAN et le statut de la box.</div>'
   )
   +(isInvalid?''
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:.5rem">Procédure de revalidation</div>'
    +'<div style="display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.6rem">'
    +'<span style="font-size:var(--fs-md);font-weight:700;color:rgba(0,217,255,0.6);min-width:1.2rem">①</span>'
    +'<div><div style="font-size:var(--fs-xs);font-weight:700;color:rgba(180,200,220,0.85);margin-bottom:.25rem">Connexion SSH sur srv-ngix</div>'
    +'<div style="padding:.35rem .5rem;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:3px;font-size:var(--fs-xs);color:var(--cyan)">ssh root@'+SOC_INFRA.SRV_NGIX+' -p '+SOC_INFRA.SSH_PORT+' -i ~/.ssh/'+SOC_INFRA.SSH_KEY+'</div></div>'
    +'</div>'
    +'<div style="display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.6rem">'
    +'<span style="font-size:var(--fs-md);font-weight:700;color:rgba(0,217,255,0.6);min-width:1.2rem">②</span>'
    +'<div><div style="font-size:var(--fs-xs);font-weight:700;color:rgba(180,200,220,0.85);margin-bottom:.25rem">Lancer le script de pairing</div>'
    +'<div style="padding:.35rem .5rem;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:3px;font-size:var(--fs-xs);color:var(--cyan)">bash /opt/clt/setup-freebox-token.sh</div></div>'
    +'</div>'
    +'<div style="display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.6rem">'
    +'<span style="font-size:var(--fs-md);font-weight:700;color:rgba(255,160,0,0.8);min-width:1.2rem">③</span>'
    +'<div><div style="font-size:var(--fs-xs);font-weight:700;color:rgba(255,160,0,0.9);margin-bottom:.25rem">Valider sur l\'écran de la Freebox Delta</div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.65);line-height:1.6">L\'écran de la box affiche une demande d\'autorisation.<br>→ Appuyer sur la <strong style="color:rgba(255,160,0,0.9)">flèche droite</strong> de la Freebox Delta.<br>→ Tu as <strong style="color:var(--red)">2 minutes</strong> pour valider.</div>'
    +'</div></div>'
    +'<div style="display:flex;gap:.7rem;align-items:flex-start;margin-bottom:.9rem">'
    +'<span style="font-size:var(--fs-md);font-weight:700;color:rgba(0,255,136,0.7);min-width:1.2rem">④</span>'
    +'<div><div style="font-size:var(--fs-xs);font-weight:700;color:rgba(0,255,136,0.85);margin-bottom:.1rem">Rafraîchir le dashboard</div>'
    +'<div style="font-size:var(--fs-xs);color:rgba(180,200,220,0.5)">La tuile Freebox redevient normale à la prochaine collecte (~1 min).</div>'
    +'</div></div>'
   :'')
   +'<div style="display:flex;gap:.6rem;justify-content:flex-end;margin-top:.5rem">'
   +(isInvalid?'<button data-fbx-action="copy-cmd" style="font-size:var(--fs-xs);padding:.3rem .7rem;background:rgba(0,217,255,0.08);border:1px solid rgba(0,217,255,0.25);color:var(--cyan);border-radius:3px;cursor:pointer;font-family:\'Courier New\',monospace">⎘ Copier la commande</button>':'')
   +'<button data-fbx-action="reload" style="font-size:var(--fs-xs);padding:.3rem .7rem;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);color:var(--green);border-radius:3px;cursor:pointer;font-family:\'Courier New\',monospace">↺ Rafraîchir</button>'
   +'</div>'
   +'</div>';
}
// NDT-48 : carte machine pour openUpdModal
function _updMachineCardHtml(m){
  var mc=m.security_count>0?'var(--red)':m.count>0?'var(--yellow)':'var(--green)';
  var mBg=m.security_count>0?'rgba(255,50,50,0.05)':m.count>0?'rgba(255,160,0,0.04)':'rgba(0,255,136,0.04)';
  var mBorder=m.security_count>0?'rgba(255,60,60,0.30)':m.count>0?'rgba(255,160,0,0.25)':'rgba(0,255,136,0.15)';
  var bodyHtml;
  if(!m.reachable){
    bodyHtml='<div style="font-size:var(--fs-xs);color:var(--red)">Machine inaccessible via SSH</div>';
  } else if(m.count===0){
    bodyHtml='<div style="font-size:var(--fs-xs);color:var(--green)">✓ Aucune mise à jour disponible</div>';
  } else {
    var pkgRowsHtml=m.packages.map(function(p){
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)"><td style="padding:.14rem .3rem;color:rgba(200,220,240,0.85);font-family:'Courier New',monospace">${esc(p.name)}</td><td style="padding:.14rem .3rem;color:rgba(0,217,255,0.75);font-family:'Courier New',monospace">${esc(p.version)}</td><td style="padding:.14rem .3rem;text-align:center">${p.security?'<span style="background:rgba(255,50,50,0.15);border:1px solid rgba(255,60,60,0.45);color:var(--red);border-radius:2px;padding:.05rem .3rem;font-size:var(--fs-xs);font-weight:700">SÉCURITÉ</span>':'<span style="color:var(--muted);font-size:var(--fs-xs)">stable</span>'}</td></tr>`;
    }).join('');
    bodyHtml=`<table style="width:100%;border-collapse:collapse;font-size:var(--fs-xs)"><thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)"><th style="text-align:left;padding:.15rem .3rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">Paquet</th><th style="text-align:left;padding:.15rem .3rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">Version</th><th style="text-align:center;padding:.15rem .3rem;color:var(--muted);font-weight:400;text-transform:uppercase;font-size:var(--fs-xs)">Type</th></tr></thead><tbody>${pkgRowsHtml}</tbody></table><div style="margin-top:.45rem;padding:.3rem .4rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.07);border-radius:3px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:var(--fs-xs);color:var(--cyan)">apt upgrade -y</span><span style="font-size:var(--fs-xs);color:var(--muted)">sur ${esc(m.name)} (${esc(m.ip)})</span></div>`;
  }
  return `<div style="margin-bottom:.65rem;padding:.5rem .6rem;background:${mBg};border:1px solid ${mBorder};border-radius:5px"><div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.35rem"><span style="font-size:var(--fs-xs);font-weight:700;color:${mc};font-family:'Courier New',monospace">●</span><span style="font-size:var(--fs-xs);font-weight:700;color:rgba(220,235,255,0.9)">${esc(m.name)}</span><span style="font-size:var(--fs-xs);color:var(--muted)">${esc(m.ip)}</span><span style="font-size:var(--fs-xs);color:rgba(150,170,200,0.5)">${esc(m.role)}</span><span style="margin-left:auto;font-size:var(--fs-xs);font-weight:700;color:${mc}">${m.reachable?m.count+' paquet'+(m.count>1?'s':''):'⚠ inaccessible'}</span></div>${bodyHtml}</div>`;
}
function _fbxSecBoxHtml(fbx,mDown,sl,temps,fans,uptime,sfpQ,sfpCol){
  var ipv6Html=fbx.ipv6?`<div style="padding:.4rem .55rem;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.07);border-radius:4px;flex:1;min-width:0"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.1rem">IPv6 WAN</div><div style="font-size:var(--fs-xs);color:rgba(0,217,255,.5);font-family:'Courier New',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fbx.ipv6)}</div></div>`:'';
  return `<div id="fbx-sec-box" style="display:none">${_fbxDebitHtml(fbx,mDown)}<div style="display:flex;gap:.5rem;margin-bottom:.7rem"><div style="padding:.4rem .55rem;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.07);border-radius:4px;flex:0 0 auto"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.1rem">⬆ Uptime Freebox</div><div style="font-size:var(--fs-md);font-weight:700;color:rgba(0,217,255,.75);font-family:'Courier New',monospace">${uptime}</div></div>${ipv6Html}</div>${_fbxSfpGponHtml(fbx,sfpQ,sfpCol)}${_fbxTempsHtml(temps,fans)}${_fbxSfpLanHtml(sl)}</div>`;
}

// ── MODAL AUTO-BAN ──
function openAutoBanModal(){
  if(_isOpen)return;
  var abl=window._ablData||[];
  var STAGE_COL={'EXPLOIT':'var(--red)','BRUTE':'var(--purple)','SCAN':'var(--yellow)','RECON':'var(--cyan)'};
  var recent24=0,now24=Date.now()-86400000;
  abl.forEach(function(e){if(new Date(e.ts).getTime()>now24)recent24++;});
  var rowsHtml=abl.map(function(e){
    var stCol=STAGE_COL[e.stage||'RECON']||'var(--orange)';
    var dt=new Date(e.ts);
    var ts=dt.toISOString().slice(0,10)+' '+dt.toISOString().slice(11,19)+' UTC';
    var rule=e.rule||'ban 24h';
    var ico=_fbxRuleIco(rule);
    return `<div class="abl-modal-row"><span style="color:var(--orange);font-weight:700">${esc(e.ip)}</span><span style="color:var(--muted)">${e.country&&e.country!=='-'?esc(e.country):'—'}</span><span style="background:${stCol}18;color:${stCol};border:1px solid ${stCol}44;border-radius:2px;padding:.08rem .3rem;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px;text-align:center">${esc(e.stage||'?')}</span><span style="color:rgba(0,255,136,0.7);font-size:var(--fs-xs)">${ico} ${esc(rule)}</span><span style="color:rgba(122,154,184,0.5);font-size:var(--fs-xs)">${ts}</span></div>`;
  }).join('');
  var emptyHtml=!abl.length?'<div style="color:var(--green);font-size:var(--fs-xs);padding:1rem 0">✓ Aucun auto-ban enregistré</div>':'';
  var listHtml=abl.length?`<div class="abl-modal-hdr"><span>IP</span><span>PAYS</span><span>STAGE</span><span>RÈGLE</span><span>HORODATAGE</span></div><div class="abl-scroll" style="max-height:420px">${rowsHtml}</div>`:'';
  var body=`<div style="font-family:'Courier New',monospace"><div style="display:flex;align-items:baseline;gap:1rem;margin-bottom:1rem;padding-bottom:.7rem;border-bottom:1px solid rgba(255,107,53,0.2)"><span style="font-size:var(--fs-3xl);font-weight:700;color:var(--orange)">${abl.length}</span><span style="font-size:var(--fs-xs);color:var(--muted)">bans total</span><span style="font-size:var(--fs-xl);font-weight:700;color:var(--red);margin-left:.8rem">${recent24}</span><span style="font-size:var(--fs-xs);color:var(--muted)">dernières 24h</span><span style="margin-left:auto;font-size:var(--fs-xs);color:rgba(255,107,53,0.5);letter-spacing:1px">BAN DURÉE 48H · AUTO-BAN SOC</span></div>${emptyHtml}${listHtml}</div>`;
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.textContent='⊛ ACTIONS PROACTIVES — HISTORIQUE AUTO-BAN';
  if(_modalBody)_modalBody.innerHTML=body;
  _isOpen=true; _overlay.classList.add('open'); document.body.style.overflow='hidden';
}

function _fbxTab(name){
  ['wan','box','chart'].forEach(function(n){
    var s=document.getElementById('fbx-sec-'+n);
    var b=document.getElementById('fbx-btn-'+n);
    if(s)s.style.display=n===name?'block':'none';
    if(b)b.className='fbx-tab-btn'+(n===name?' active':'');
  });
  if(name==='chart'){
    var sl=(window._fbxData||{}).sfp_lan;
    if(sl&&sl.chart_24h){
      window._sfpData={h24:sl.chart_24h||[],h7d:sl.chart_7d||[]};
      _raf2(function(){_sfpDraw('24h');});
    }
    // Graphe latence WAN dans l'onglet GRAPHIQUES
    _raf2(function(){
      var cg=document.getElementById('fbx-lat-chart-g');
      if(!cg)return;
      var hist=(window._wanData||{}).history||[];
      if(hist.length<2)return;
      drawLatencyChart(cg,hist);
      var ls=cg._latStats;
      var sd=document.getElementById('fbx-lat-stats-g');
      if(ls&&sd){
        sd.innerHTML=_fbxLatStatHtml('MIN',ls.min)+_fbxLatStatHtml('MAX',ls.max)+_fbxLatStatHtml('MOY',ls.avg)+_fbxLatStatHtml('ACT',ls.cur);
      }
    });
  }
}
function _sfpDraw(period){
  // Activer onglet et section
  ['24h','7d'].forEach(function(p){
    var b=document.getElementById('fbx-chart-btn-'+p);
    if(b)b.className='fbx-tab-btn'+(p===period?' active':'');
    var s=document.getElementById('fbx-period-'+p);
    if(s)s.style.display=p===period?'block':'none';
  });
  var data=period==='7d'?(window._sfpData&&window._sfpData.h7d||[]):(window._sfpData&&window._sfpData.h24||[]);
  var cId=period==='7d'?'fbx-chart-7d':'fbx-chart-24h';
  var lId=period==='7d'?'fbx-legend-7d':'fbx-legend-24h';
  var c=document.getElementById(cId);
  if(!c||!data.length)return;
  var fbx=window._fbxData||{};
  var opts={txSat:fbx.bandwidth_down?fbx.bandwidth_down*125:0, rxSat:fbx.bandwidth_up?fbx.bandwidth_up*125:0};
  drawTrafficChart(c,data,period,opts);
  var txS=c._txStats, rxS=c._rxStats;
  if(!txS)return;
  var leg=document.getElementById(lId);
  if(leg)leg.innerHTML=_fbxSBlk('&#8593; TX Freebox→LAN','0,217,255',txS,c._hasSpikes)+_fbxSBlk('&#8595; RX LAN→Freebox','0,255,136',rxS,false);
}
function openUpdModal(){
  if(_isOpen)return;
  var upd=(window._lastData||{}).updates||{};
  var machines=upd.machines||[];
  var uTotal=upd.total_count||0;
  var uSec=upd.total_security||0;
  var genAt=upd.generated_at?new Date(upd.generated_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  var hC=uSec>0?'var(--red)':uTotal>0?'var(--yellow)':'var(--green)';
  var machinesHtml=machines.map(function(m){return _updMachineCardHtml(m);}).join('');
  var body=`<div style="font-family:'Courier New',monospace"><div style="display:flex;gap:1rem;align-items:center;padding:.6rem .8rem;background:rgba(0,0,0,0.25);border-radius:4px;margin-bottom:.9rem;border:1px solid rgba(255,255,255,0.07)"><div><span style="font-size:var(--fs-3xl);font-weight:700;color:${hC}">${uTotal}</span><span style="font-size:var(--fs-xs);color:var(--muted);margin-left:.3rem">paquets en attente</span></div>${uSec>0?`<div style="padding:.3rem .55rem;background:rgba(255,50,50,0.10);border:1px solid rgba(255,60,60,0.5);border-radius:4px"><span style="font-size:var(--fs-xs);font-weight:700;color:var(--red)">⚠ ${uSec} PAQUETS SÉCURITÉ</span></div>`:''}${uTotal===0?'<span style="font-size:var(--fs-xs);font-weight:700;color:var(--green)">✓ Infrastructure à jour</span>':''}<span style="margin-left:auto;font-size:var(--fs-xs);color:var(--muted)">Vérifié le ${esc(genAt)}</span></div>${machinesHtml}</div>`;
  var mc2=document.getElementById('modal-card');
  if(mc2){mc2.classList.remove('modal-wide','modal-proto','modal-fbx','modal-kci','modal-geomap');}
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">⬆</span>MISES À JOUR — INFRASTRUCTURE';
  document.getElementById('modal-body').innerHTML=body;
  _isOpen=true; _overlay.classList.add('open'); document.body.style.overflow='hidden';
}

function openFbxAuthModal(){
  if(_isOpen)return;
  var errCode=window._fbxAuthError||'unknown';
  var errLbl={'no_token':'Fichier token absent ou vide','invalid_token':'Token révoqué — box réinitialisée','unreachable':'Freebox inaccessible sur le LAN','session_failed':'Échec ouverture de session API'};
  var errDesc=errLbl[errCode]||errCode;
  var isInvalid=errCode==='invalid_token'||errCode==='no_token';
  var body=_fbxAuthBodyHtml(errDesc,isInvalid);
  var mc2=document.getElementById('modal-card');
  if(mc2)mc2.classList.remove('modal-wide','modal-proto','modal-fbx','modal-kci','modal-geomap');
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='⬡ FREEBOX DELTA — AUTORISATION API';
  document.getElementById('modal-body').innerHTML=body;
  // Bindings CSP-safe — data-fbx-action (remplace onclick inline)
  (function(){ var b=document.getElementById('modal-body'); if(!b) return;
    b.addEventListener('click',function(e){
      var el=e.target.closest('[data-fbx-action]');
      if(!el) return;
      var a=el.getAttribute('data-fbx-action');
      if(a==='copy-cmd') navigator.clipboard&&navigator.clipboard.writeText('bash /opt/clt/setup-freebox-token.sh').catch(function(){});
      else if(a==='reload') location.reload();
    });
  })();
  _isOpen=true; _overlay.classList.add('open'); document.body.style.overflow='hidden';
}
function openFbxModal(){
  if(_isOpen)return;
  var fbx=window._fbxData||{};
  var wm=window._wanData||{};
  var sfpQ=fbx.sfp_quality;
  var sfpCol=sfpQ==='FAIBLE'?'var(--red)':sfpQ==='CORRECT'?'var(--yellow)':sfpQ==='BON'?'var(--green)':'var(--cyan)';
  var uptime=fbx.uptime_s?Math.floor(fbx.uptime_s/3600)+'h '+Math.floor((fbx.uptime_s%3600)/60)+'min':'—';

  var wmSt2=wm.status||'UP';
  var stLbl2={'UP':'STABLE','DOWN_ISP':'PANNE FAI','DOWN_LOCAL':'PANNE LOCALE','DEGRADED':'DÉGRADÉ'};
  var stCol2={'UP':'var(--green)','DOWN_ISP':'var(--red)','DOWN_LOCAL':'var(--red)','DEGRADED':'var(--amber)'};
  var stC2=stCol2[wmSt2]||'var(--cyan)';
  var sl=fbx.sfp_lan||null;
  var hist=wm.history||[];
  var incidents=wm.incidents||[];
  var temps=fbx.temps||[];
  var fans=fbx.fans||[];

  // ── Onglet WAN ──
  var secWan=_fbxSecWanHtml(wm,wmSt2,stC2,stLbl2,fbx,hist,incidents);

  // ── Onglet BOX & FIBRE ──
  var mDown=wmSt2==='DOWN_ISP'||wmSt2==='DOWN_LOCAL';
  var secBox=_fbxSecBoxHtml(fbx,mDown,sl,temps,fans,uptime,sfpQ,sfpCol);

  // ── Onglet GRAPHIQUES ──
  var cuts24=_fbxBuildCuts(incidents,86400,_fbxSfpGapsFrom(sl&&sl.chart_24h));
  var cuts7d=_fbxBuildCuts(incidents,604800,_fbxSfpGapsFrom(sl&&sl.chart_7d));
  var secChart='';
  if(sl&&sl.chart_24h){
    secChart='<div id="fbx-sec-chart" style="display:none">'
     // ── Latence WAN ──
     +(hist.length>1
       ?'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.3rem">◇ LATENCE WAN — 4 DERNIÈRES HEURES</div>'
        +'<canvas id="fbx-lat-chart-g" height="110" style="width:100%;display:block;margin-bottom:.4rem;border-radius:3px"></canvas>'
        +'<div id="fbx-lat-stats-g" style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.9rem"></div>'
       :'')
     // ── Trafic SFP — onglets période ──
     +'<div style="display:flex;gap:.4rem;margin-bottom:.55rem;border-bottom:1px solid rgba(0,217,255,0.08);padding-bottom:.4rem">'
     +'<button id="fbx-chart-btn-24h" class="fbx-tab-btn active" data-period="24h">◈ 24 HEURES</button>'
     +(sl.chart_7d?'<button id="fbx-chart-btn-7d" class="fbx-tab-btn" data-period="7d">◈ 7 JOURS</button>':'')
     +'</div>'
     // Section 24H
     +'<div id="fbx-period-24h">'
     +'<canvas id="fbx-chart-24h" width="900" height="220" style="width:100%;display:block;margin-bottom:.5rem;border-radius:3px"></canvas>'
     +'<div id="fbx-legend-24h" style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem"></div>'
     +_fbxCutsTableHtml(cuts24)
     +'</div>'
     // Section 7J (masquée par défaut)
     +(sl.chart_7d?'<div id="fbx-period-7d" style="display:none">'
     +'<canvas id="fbx-chart-7d" width="900" height="220" style="width:100%;display:block;margin-bottom:.5rem;border-radius:3px"></canvas>'
     +'<div id="fbx-legend-7d" style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem"></div>'
     +_fbxCutsTableHtml(cuts7d)
     +'</div>':'')
     +'</div>';
  }

  // ── Injection dans le modal ──
  var body='<div style="font-family:\'Courier New\',monospace;padding:.2rem 0">'+secWan+secBox+secChart+'</div>';
  var mc2=document.getElementById('modal-card');
  if(mc2){mc2.classList.remove('modal-wide','modal-proto','modal-fbx','modal-kci','modal-geomap');mc2.classList.add('modal-fbx');}
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.style.cssText='display:flex;align-items:center;justify-content:space-between;width:100%;gap:1rem';
  if(_ht)_ht.innerHTML='<span>⬡ FREEBOX DELTA — BOX &amp; WAN</span>'
    +'<div style="display:flex;gap:.35rem;flex-shrink:0">'
    +'<button id="fbx-btn-wan" class="fbx-tab-btn active" data-tab="wan">◇ WAN &amp; LATENCE</button>'
    +'<button id="fbx-btn-box" class="fbx-tab-btn" data-tab="box">⬡ BOX &amp; FIBRE</button>'
    +(sl&&sl.chart_24h?'<button id="fbx-btn-chart" class="fbx-tab-btn" data-tab="chart">◈ GRAPHIQUES</button>':'')
    +'</div>';
  if(_ht)_ht.querySelectorAll('.fbx-tab-btn[data-tab]').forEach(function(btn){
    btn.addEventListener('click',function(){_fbxTab(this.dataset.tab);});
  });
  document.getElementById('modal-body').innerHTML=body;
  document.querySelectorAll('.fbx-tab-btn[data-period]').forEach(function(btn){
    btn.addEventListener('click',function(){_sfpDraw(this.dataset.period);});
  });
  _isOpen=true; _overlay.classList.add('open'); document.body.style.overflow='hidden';

  // Graphe latence WAN dans l'onglet WAN
  if(hist.length>1){
    _raf2(function(){
      var cw=document.getElementById('wan-modal-spark');
      if(!cw)return;
      drawLatencyChart(cw,hist);
      var ls=cw._latStats;
      var sd=document.getElementById('fbx-lat-stats');
      if(ls&&sd){
        sd.innerHTML=_fbxLatStatHtml('MIN',ls.min)+_fbxLatStatHtml('MAX',ls.max)+_fbxLatStatHtml('MOY',ls.avg)+_fbxLatStatHtml('ACT',ls.cur);
      }
    });
  }
}

// ── MODAL LIGHTBOX — refs DOM déclarées dans 01-utils.js (__overlay/__modalBody/_modalClose) ──
