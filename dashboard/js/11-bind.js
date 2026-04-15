
// ── Leaflet close button ──
(function(){
  var btn=document.getElementById('lf-close-btn');
  if(btn) btn.addEventListener('click',function(){_toggleLeaflet(null);});
})();

// ── PING JARVIS button ──
(function(){
  var btn=document.getElementById('pro-ping-btn');
  if(btn){
    btn.addEventListener('click',function(e){pingJarvis(e);});
    btn.addEventListener('mouseover',function(){this.style.background='rgba(0,255,136,0.12)';});
    btn.addEventListener('mouseout',function(){this.style.background='rgba(0,255,136,0.04)';});
  }
})();

// ── IP HUD close ──
(function(){
  var hud=document.getElementById('ip-hud');
  if(hud) hud.addEventListener('click',function(e){if(e.target===hud)closeIpHud();});
  var closeBtn=document.getElementById('ih-close');
  if(closeBtn) closeBtn.addEventListener('click',function(){closeIpHud();});
})();

document.addEventListener('click',function(e){
  if(!_ipHudOpen)return;
  var hud=document.getElementById('ip-hud');
  if(hud&&!hud.contains(e.target))closeIpHud();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeModal();closeIpHud();return;}
  if(_isOpen)return;
  if(e.key==='f'||e.key==='F'){if(window._lastData)openFirewallModal(window._lastData);}
  if(e.key==='t'||e.key==='T'){if(window._lastData)openTrafficModal(window._lastData);}
  if(e.key==='r'||e.key==='R')load();
  if(e.key==='z'||e.key==='Z')toggleProj();
});

// ── Délégation mouseenter/leave sur le grid (une seule fois) ──
// Évite la duplication de listeners lors des multiples appels à bindCards()
(function(){
  var grid=document.getElementById('grid');
  if(grid&&!grid._ipHoverDelegated){
    grid._ipHoverDelegated=true;
    grid.addEventListener('mouseover',function(e){
      var row=e.target.closest('[data-ips]');
      if(row)showIpPopup(row,e);
    });
    grid.addEventListener('mouseout',function(e){
      var row=e.target.closest('[data-ips]');
      if(row)hideIpPopup();
    });
  }
})();

function bindCards(){
  document.querySelectorAll('#grid .card').forEach(function(card){
    if(!card.querySelector('.card-close-hint')){
      var hint=document.createElement('div');
      hint.className='card-close-hint';
      hint.textContent='↗';
      card.insertBefore(hint,card.firstChild);
    }
    if(card.dataset.winModal){
      (function(t){card.onclick=function(e){e.stopPropagation();if(window._lastData)openWindowsModal(window._lastData.windows_disk||{},t);};})(card.dataset.winModal);
    } else if(card.dataset.gpuModal){
      card.onclick=function(e){e.stopPropagation();if(window._lastData)openGpuModal(window._lastData.windows_disk||{});};
    } else if(card.id==='fbx-tile'){
      card.onclick=function(e){e.stopPropagation();if(window._fbxAuthError)openFbxAuthModal();else openFbxModal();};
    } else if(card.id==='jv-tile'){
      card.onclick=function(e){if(e.target.tagName==='BUTTON'||e.target.classList.contains('jv-tile-open'))return;if(window.openJvModal)window.openJvModal();};
    } else {
      card.onclick=function(e){if(e.target.closest('button,a'))return;openModal(card);};
    }
  });
}

