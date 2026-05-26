'use strict';
var _POPUP_CLEANUP_MS = 150; // délai nettoyage classe popup IP après masquage
function load(){
  var xhr=new XMLHttpRequest();
  xhr.open('GET','/monitoring.json');
  if(_lastModified) xhr.setRequestHeader('If-Modified-Since', _lastModified);
  xhr.timeout=_XHR_TIMEOUT_MON_MS;
  xhr.ontimeout=function(){document.getElementById('gen-at').textContent='TIMEOUT';};
  xhr.onload=function(){
    // 304 = fichier inchangé → rien à faire
    if(xhr.status===304) return;
    if(xhr.status===200){
      var lm=xhr.getResponseHeader('Last-Modified');
      if(lm) _lastModified=lm;
      try{
        var parsed=JSON.parse(xhr.responseText);
        // Différer le render au moment idle du browser — zéro freeze, zéro clipping
        var _doRender=function(){ render(parsed); bindCards(); };
        if('requestIdleCallback' in window){
          requestIdleCallback(_doRender, {timeout:4000});
        } else {
          setTimeout(_doRender, 0); // fallback Safari/anciens browsers
        }
        // Accumulation historique CPU Windows (toujours depuis monitoring.json)
        if(parsed.windows_disk&&parsed.windows_disk.cpu){
          _winCpuHistory.push(parsed.windows_disk.cpu.usage||0);
          if(_winCpuHistory.length>_winHistMax)_winCpuHistory.shift();
        }
        // Historique GPU : JARVIS prioritaire (données fraîches 30s) — sinon fallback monitoring.json
        if(window._jvLastStats && typeof updateGpuTile === 'function'){
          updateGpuTile(window._jvLastStats);
          var jst=window._jvLastStats;
          _winGpuHistory.push(jst.gpu_util||0); if(_winGpuHistory.length>_winHistMax)_winGpuHistory.shift();
          var mt=jst.mem_total||0,mu=jst.mem_used||0;
          _winVramHistory.push(mt>0?Math.round(mu*100/mt):0); if(_winVramHistory.length>_winHistMax)_winVramHistory.shift();
        } else if(parsed.windows_disk&&parsed.windows_disk.gpu){
          _winGpuHistory.push(parsed.windows_disk.gpu.usage||0);
          if(_winGpuHistory.length>_winHistMax)_winGpuHistory.shift();
          _winVramHistory.push(parsed.windows_disk.gpu.vram_pct||0);
          if(_winVramHistory.length>_winHistMax)_winVramHistory.shift();
          _winPwrHistory.push(parsed.windows_disk.gpu.power_pct||0);
          if(_winPwrHistory.length>_winHistMax)_winPwrHistory.shift();
        }
        // ── JARVIS auto-engine hook ──
        if(window._jvAutoCheck) window._jvAutoCheck(parsed);
        if(_gpuModalOpen&&parsed.windows_disk){
          _modalBody.innerHTML=buildGpuModal(parsed.windows_disk);
          animateGauges();drawGpuCharts();
        } else if(_winModalOpen&&parsed.windows_disk){
          var modalType=window._winModalType||'res';
          if(modalType==='bkp'){
            _modalBody.innerHTML=buildBackupModal(parsed.windows_disk);
            animateGauges();
          } else {
            _modalBody.innerHTML=buildWindowsModal(parsed.windows_disk);
            animateGauges();drawWinCharts();
          }
        }
      }
      catch(e){}
    } else {
      document.getElementById('gen-at').textContent='HTTP '+xhr.status;
    }
  };
  xhr.onerror=function(){document.getElementById('gen-at').textContent='NETWORK ERROR';};
  xhr.send();
}
load();var _loadInt=setInterval(load,_POLL_MONITOR_MS);
// _routerInt retiré 2026-05-17
// Cleanup intervals au déchargement de la page (évite memory leaks si SPA)
window.addEventListener('beforeunload',function(){
  clearInterval(_loadInt);
  clearInterval(_heartbeatInt);clearInterval(_protoInt);
});

// ── Heartbeat vers JARVIS (signale que le dashboard est ouvert) ──
// JV_URL déclaré dans 01-utils.js (DT-A)
// Modèle LLM actif — mis à jour au heartbeat — détermine num_predict SOC
// _jvActiveModel → bus _SOC via shim (01-utils) — N2
function _socNumPredict(){
  // Adapte num_predict selon la taille du modèle actif
  // Grand modèle (24b+) → 2048 · moyen (14b) → 1536 · petit / défaut → 1024
  var m=(_jvActiveModel||'').toLowerCase();
  if(/24b|32b|70b|reasoning/.test(m)) return 2048;
  if(/14b|12b/.test(m)) return 1536;
  return 1024;
}
function _socHeartbeat(){
  fetch(JV_URL+'/api/soc/heartbeat',{method:'POST',signal:AbortSignal.timeout(_PING_TMO_MS)}).catch(function(e){});
  // Récupérer le modèle actif pour adapter num_predict SOC
  fetch(JV_URL+'/api/models',{signal:AbortSignal.timeout(_PING_TMO_MS)}).then(function(r){return r.json();}).then(function(d){
    if(d&&d.current) _jvActiveModel=d.current;
  }).catch(function(e){});
}
_socHeartbeat();
var _heartbeatInt=setInterval(_socHeartbeat, _POLL_HEARTBEAT_MS);
// Heartbeat immédiat au retour au premier plan — évite que Python pense le dashboard fermé
// (le throttling navigateur arrête setInterval en arrière-plan → TTL 120s peut expirer)
document.addEventListener('visibilitychange', function(){ if(!document.hidden) _socHeartbeat(); });

// ── PROTO LIVE — polling 15s ──────────────────────────────────────────────
function loadProtoLive(){
  var xhr=new XMLHttpRequest();
  xhr.open('GET','/proto-live.json');
  if(_lastModifiedProto) xhr.setRequestHeader('If-Modified-Since',_lastModifiedProto);
  xhr.timeout=10000;
  xhr.ontimeout=function(){};
  xhr.onerror=function(){};
  xhr.onload=function(){
    if(xhr.status===304)return;
    if(xhr.status!==200)return;
    var lmp=xhr.getResponseHeader('Last-Modified');
    if(lmp)_lastModifiedProto=lmp;
    try{
      var d=JSON.parse(xhr.responseText);
      window._liveProto=d.proto||{};
      window._liveProtoFull=d;
      var now=new Date();
      var ts=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0')+':'+now.getSeconds().toString().padStart(2,'0');
      if(!_isOpen){
        // ── Mise à jour FLUX LIVE tile ──
        var flCard=document.getElementById('flux-live-card');
        if(flCard){
          var PROTO_META2={
            'HTTP':PROTO_PALETTE.GEO,'HTTPS':_COL_CYAN_HEX,'ASSETS':_COL_GREEN_HEX,
            'GEO_BLOCK':PROTO_PALETTE.GEO,'CLOSED':_COL_RED_HEX,'HTTP_REDIRECT':PROTO_PALETTE.NEUTRAL,
            'NOT_FOUND':_COL_PURPLE_HEX,'SCANNER':PROTO_PALETTE.THREAT,'BOT':_COL_YELLOW_HEX,
            'LEGIT_BOT':PROTO_PALETTE.BOT_LEGIT,'OTHER':PROTO_PALETTE.FLOW
          };
          var lproto2=d.proto||{};
          var maxVal2=Math.max.apply(null,Object.values(lproto2).concat([1]));
          var csBans2=(window._lastData&&window._lastData.crowdsec&&window._lastData.crowdsec.active_decisions)||0;
          maxVal2=Math.max(maxVal2,csBans2);
          // RPM bar
          var rpmBar=flCard.querySelector('#rpm-bar');
          if(rpmBar){var rw=Math.min(100,Math.round((d.rpm||0)*3));rpmBar.style.width=rw+'%';}
          // Proto bars
          Object.entries(lproto2).forEach(function(e){
            var col=(PROTO_META2[e[0]]||PROTO_PALETTE.FLOW).replace(/[^a-z0-9]/gi,'_');
            var bar=flCard.querySelector('[id="lb-'+col+'"]');
            if(bar){var w=Math.max(1,Math.round(e[1]*100/maxVal2));bar.style.width=w+'%';}
          });
          // update rpm text
          var rpmDiv=flCard.querySelector('[style*="req / min"]');
          if(rpmDiv&&rpmDiv.previousElementSibling){rpmDiv.previousElementSibling.textContent=(d.rpm||0).toFixed(1);}
        }
        _refreshProtoTile(window._liveProto||{});
      }else{
        // Modal ouvert en mode LIVE — rafraîchir si onglet LIVE actif
        var btn5=document.getElementById('ptBtn5');
        if(btn5&&btn5.classList.contains('active')){
          var _mb=document.getElementById('modal-body');
          if(_mb)_mcSwitchProtoView(window._liveProto||{},'REQ/5MIN',true,_mb,window._liveProtoFull||{});
          var pmSp=document.getElementById('pm-spark');
          if(pmSp&&d.rpm_buckets)drawProtoSpark(pmSp,d.rpm_buckets);
          var smx=d.rpm_buckets?Math.max.apply(null,Object.values(d.rpm_buckets)):0;
          var sml=document.getElementById('pt-spark-max');
          if(sml&&smx)sml.textContent='max '+smx+' req/min';
        }
      }
    }catch(e){}
  };
  xhr.send();
}
// Appel initial immédiat, puis idle-scheduled toutes les 15s
loadProtoLive();
var _protoInt=setInterval(function(){
  if('requestIdleCallback' in window){
    requestIdleCallback(loadProtoLive, {timeout:3000});
  } else {
    loadProtoLive();
  }
},_POLL_PROTO_MS);

// ── IP POPUP ─────────────────────────────────────────────────────────────────
var _ipPopup=null;
function _getIpPopup(){
  if(!_ipPopup){
    _ipPopup=document.createElement('div');
    _ipPopup.id='ip-popup';
    document.body.appendChild(_ipPopup);
  }
  return _ipPopup;
}
function showIpPopup(row,e){
  var raw=row.getAttribute('data-ips');
  if(!raw)return;
  var ips=raw.split(',');
  var p=_getIpPopup();
  var rowsHtml=ips.map(function(ip){return '<div class="ip-popup-row">'+esc(ip)+'</div>';}).join('');
  p.innerHTML='<div class="ip-popup-title">&#9658; IPS BANNIES ('+ips.length+')</div>'+rowsHtml;
  p.classList.add('ip-popup-shown');
  // Position à droite du curseur, recadré dans la fenêtre
  var x=e.clientX+14,y=e.clientY-10;
  p.style.left=x+'px';p.style.top=y+'px';
  requestAnimationFrame(function(){
    var pw=p.offsetWidth,ph=p.offsetHeight;
    if(x+pw>window.innerWidth-10)p.style.left=(e.clientX-pw-10)+'px';
    if(y+ph>window.innerHeight-10)p.style.top=(window.innerHeight-ph-10)+'px';
    p.classList.add('visible');
  });
}
function hideIpPopup(){
  var p=_getIpPopup();
  p.classList.remove('visible');
  setTimeout(function(){if(!p.classList.contains('visible'))p.classList.remove('ip-popup-shown');},_POPUP_CLEANUP_MS);
}
