'use strict';
// ════════════════════════════════════════════════════════
// SOC ENHANCEMENTS — Alert Strip · Freshness · Projection
// ════════════════════════════════════════════════════════
function updateAlertStrip(d){
  var alerts=[],t=d.traffic||{},f2b=d.fail2ban||{},ufw=d.ufw||{},sys=d.system||{};
  var ts=computeThreatScore(d);
  var svcUp=Object.values(d.services||{}).filter(function(s){return s.status==='UP';}).length;
  var svcTot=Object.keys(d.services||{}).length;
  var minSsl=Math.min.apply(null,(d.ssl||[]).map(function(s){return typeof s.days_left==='number'?s.days_left:999;}));
  var cpu=sys.cpu_pct||0,mem=(sys.memory||{}).pct||0;
  // Threat level
  if(ts.score>=70) alerts.push({c:'as-cr',t:'◉ MENACE '+ts.level+' — '+ts.score+'/100'});
  else if(ts.score>=50) alerts.push({c:'as-wn',t:'▲ MENACE '+ts.level+' — '+ts.score+'/100'});
  // Services
  if(svcUp<svcTot) alerts.push({c:'as-cr',t:'⚠ SERVICE DOWN '+svcUp+'/'+svcTot});
  // SSL
  if(minSsl<=7) alerts.push({c:'as-cr',t:'SSL EXPIRY '+minSsl+'j'});
  else if(minSsl<=30) alerts.push({c:'as-wn',t:'SSL EXPIRY '+minSsl+'j'});
  // Errors 5xx
  if((t.error_rate||0)>2) alerts.push({c:'as-cr',t:'✗ ERREURS 5xx '+t.error_rate+'%'});
  else if((t.error_rate||0)>0.5) alerts.push({c:'as-wn',t:'✗ ERREURS 5xx '+t.error_rate+'%'});
  // F2B bans
  if((f2b.total_banned||0)>0) alerts.push({c:'as-wn',t:'⛔ F2B '+f2b.total_banned+' IP(s) BANNI(ES)'});
  // High GeoIP
  if((t.geo_blocks||0)>800) alerts.push({c:'as-wn',t:'⚡ GEOIP '+fmt(t.geo_blocks)+' BLOCAGES'});
  // CPU/RAM
  if(cpu>85) alerts.push({c:'as-cr',t:'⚙ CPU '+cpu+'%'});
  if(mem>85) alerts.push({c:'as-cr',t:'⚙ RAM '+mem+'%'});
  // Trend spike
  if(_snap.geo&&(t.geo_blocks||0)>_snap.geo*1.4&&(t.geo_blocks||0)>50)
    alerts.push({c:'as-wn',t:'↑ GEO +'+Math.round(((t.geo_blocks||0)/_snap.geo-1)*100)+'% vs cycle préc.'});

  var strip=document.getElementById('as-strip');
  var lbl=document.getElementById('as-lbl');
  var items=document.getElementById('as-items');
  if(!strip||!items)return;

  if(alerts.length===0){
    strip.className='as-strip ok';
    lbl.className='as-lbl ok';
    lbl.textContent='◉ NOMINAL';
    items.innerHTML='<span class="as-tag as-ok">✓ TOUS LES SYSTÈMES OPÉRATIONNELS</span>';
  } else {
    strip.className='as-strip';
    lbl.className='as-lbl';
    lbl.textContent='◉ ALERTS ['+alerts.length+']';
    items.innerHTML=alerts.map(function(a){return '<span class="as-tag '+a.c+'">'+a.t+'</span>';}).join('');
  }
  updateFreshness(d);
}

function updateFreshness(d){
  if(!d||!d.generated_at)return;
  var frDot=document.getElementById('fr-dot');
  var asAge=document.getElementById('as-age');
  var age=Math.round((Date.now()-new Date(d.generated_at))/1000);
  if(isNaN(age)||age<0)age=0;
  var ageMin=Math.floor(age/60),ageSec=age%60;
  var col=age<150?'var(--green)':age<360?'var(--yellow)':'var(--red)';
  if(frDot){frDot.style.background=col;frDot.style.boxShadow='0 0 5px '+col;}
  if(asAge){asAge.style.color=col;asAge.textContent='DATA '+ageMin+'m'+String(ageSec).padStart(2,'0')+'s';}
}

function checkFreshness(){
  if(window._lastData)updateFreshness(window._lastData);
}

var _projMode=false;
function toggleProj(){
  _projMode=!_projMode;
  document.body.classList.toggle('proj-mode',_projMode);
  var btn=document.getElementById('fs-btn');
  if(_projMode){
    var el=document.documentElement;
    if(el.requestFullscreen)el.requestFullscreen();
    else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen();
    if(btn)btn.textContent='\u22a1';
  } else {
    if(document.exitFullscreen)document.exitFullscreen();
    else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    if(btn)btn.textContent='\u25a1';
  }
}
document.addEventListener('fullscreenchange',function(){
  if(!document.fullscreenElement&&_projMode){_projMode=false;document.body.classList.remove('proj-mode');var b=document.getElementById('fs-btn');if(b)b.textContent='\u25a1';}
});

// Real-time clock
function tickClock(){
  var cl=document.getElementById('soc-clock');
  if(!cl)return;
  var n=new Date();
  cl.textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');
}
var _clockInt=setInterval(tickClock,1000);tickClock();
var _freshnessInt=setInterval(checkFreshness,_POLL_FRESHNESS_MS);
window.addEventListener('beforeunload',function(){
  clearInterval(_clockInt);clearInterval(_freshnessInt);
});

