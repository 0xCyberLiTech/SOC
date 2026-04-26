'use strict';

// ── Footer IPs — SOC_INFRA (P4) ──
(function(){
  const s=document.getElementById('footer-srv-ip');
  const c=document.getElementById('footer-lan-cidr');
  if(s)s.textContent=SOC_INFRA.SRV_NGIX;
  if(c)c.textContent=SOC_INFRA.LAN_CIDR;
})();

// ── Leaflet close button ──
(function(){
  const btn=document.getElementById('lf-close-btn');
  if(btn) btn.addEventListener('click',function(){_toggleLeaflet(null);});
})();

// ── PING JARVIS button ──
(function(){
  const btn=document.getElementById('pro-ping-btn');
  if(btn){
    btn.addEventListener('click',function(e){pingJarvis(e);});
    btn.addEventListener('mouseover',function(){this.style.background='rgba(0,255,136,0.12)';});
    btn.addEventListener('mouseout',function(){this.style.background='rgba(0,255,136,0.04)';});
  }
})();

// ── IP HUD close ──
(function(){
  const hud=document.getElementById('ip-hud');
  if(hud) hud.addEventListener('click',function(e){if(e.target===hud)closeIpHud();});
  const closeBtn=document.getElementById('ih-close');
  if(closeBtn) closeBtn.addEventListener('click',function(){closeIpHud();});
})();

document.addEventListener('click',function(e){
  if(!_ipHudOpen)return;
  const hud=document.getElementById('ip-hud');
  if(hud&&!hud.contains(e.target))closeIpHud();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    const pp=document.getElementById('ip-deep-popup');
    if(pp&&pp.style.display!=='none'){pp.style.display='none';return;}
    closeModal();closeIpHud();return;
  }
  if(_isOpen)return;
  if(e.key==='f'||e.key==='F'){if(window._lastData)openFirewallModal(window._lastData);}
  if(e.key==='t'||e.key==='T'){if(window._lastData)openTrafficModal(window._lastData);}
  if(e.key==='r'||e.key==='R')load();
  if(e.key==='z'||e.key==='Z')toggleProj();
  if(e.key==='i'||e.key==='I'){const hb=document.getElementById('ip-deep-hdr-btn');if(hb)hb.click();}
});

// ── INVESTIGATION IP — popup saisie depuis bouton header ──
(function(){
  const hdrBtn=document.getElementById('ip-deep-hdr-btn');
  const popup=document.getElementById('ip-deep-popup');
  const input=document.getElementById('ip-deep-popup-input');
  const btn=document.getElementById('ip-deep-popup-btn');
  const closeBtn=document.getElementById('ip-deep-popup-close');
  function _submitPopup(){
    const ip=input?input.value.trim():'';
    if(!ip)return;
    if(popup)popup.style.display='none';
    if(window.openIpDeepModal)openIpDeepModal(ip);
  }
  function _togglePopup(){
    if(!popup)return;
    const visible=popup.style.display!=='none';
    popup.style.display=visible?'none':'block';
    if(!visible&&input)setTimeout(function(){input.focus();},40);
  }
  if(hdrBtn)hdrBtn.addEventListener('click',function(e){e.stopPropagation();_togglePopup();});
  if(btn)btn.addEventListener('click',_submitPopup);
  if(closeBtn)closeBtn.addEventListener('click',function(){if(popup)popup.style.display='none';});
  if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.stopPropagation();_submitPopup();}});
  document.addEventListener('click',function(e){
    if(!popup||popup.style.display==='none')return;
    if(popup.contains(e.target)||e.target===hdrBtn)return;
    popup.style.display='none';
  });
})();

// ── Délégation mouseenter/leave sur le grid (une seule fois) ──
// Évite la duplication de listeners lors des multiples appels à bindCards()
(function(){
  const grid=document.getElementById('grid');
  if(grid&&!grid._ipHoverDelegated){
    grid._ipHoverDelegated=true;
    grid.addEventListener('mouseover',function(e){
      const row=e.target.closest('[data-ips]');
      if(row)showIpPopup(row,e);
    });
    grid.addEventListener('mouseout',function(e){
      const row=e.target.closest('[data-ips]');
      if(row)hideIpPopup();
    });
  }
})();

function bindCards(){
  document.querySelectorAll('#grid .card').forEach(function(card){
    if(!card.querySelector('.card-close-hint')){
      const hint=document.createElement('div');
      hint.className='card-close-hint';
      hint.textContent='↗';
      card.insertBefore(hint,card.firstChild);
    }
    if(card.dataset.winModal){
      card.onclick=function(e){e.stopPropagation();if(window._lastData)openWindowsModal(window._lastData.windows_disk||{},card.dataset.winModal);};
    } else if(card.dataset.gpuModal){
      card.onclick=function(e){e.stopPropagation();if(window._lastData)openGpuModal(window._lastData.windows_disk||{});};
    } else if(card.id==='fbx-tile'){
      card.onclick=function(e){e.stopPropagation();if(window._fbxAuthError)openFbxAuthModal();else openFbxModal();};
    } else if(card.id==='jv-tile'){
      card.onclick=function(e){if(e.target.tagName==='BUTTON'||e.target.classList.contains('jv-tile-open'))return;if(window.openJvModal)window.openJvModal();};
    } else if(card.id==='geo-tile'){
      card.onclick=function(e){if(e.target.closest('button,a'))return;if(typeof openGeoModal==='function')openGeoModal();};
    } else if(card.id==='rsyslog-tile'){
      card.onclick=function(e){if(e.target.closest('button,a'))return;if(typeof openRsyslogModal==='function')openRsyslogModal();};
    } else if(card.id==='ts-card'){
      card.onclick=null;
    } else if(card.dataset.noModal){
      card.onclick=null;
    } else {
      card.onclick=function(e){if(e.target.closest('button,a'))return;openModal(card);};
    }
  });
}

// ── Panneau info [data-panel] — fixe haut-droite · fermeture manuelle ──
(function(){
  function _reEsc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function _fmtPanel(txt){
    let safe=txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const hdrs=['RÔLE','MÉTRIQUES SURVEILLÉES','COMPORTEMENT ATTENDU',
              'JARVIS (si online)','PIPELINE','VALEUR AJOUTÉE'];
    hdrs.forEach(function(h){
      const hesc=h.replace(/&/g,'&amp;');
      safe=safe.replace(new RegExp(_reEsc(hesc)+' :','g'),
        '<br><span style="color:rgba(0,217,255,.85);font-weight:700;letter-spacing:.4px;display:block;margin-top:.5rem">'+hesc+' :</span>');
    });
    return safe.replace(/^<br>/,'');
  }
  const panel=document.createElement('div');
  panel.id='soc-panel';
  document.body.appendChild(panel);
  let _activeCard=null;
  let _activePanelTitle=null;
  function _clearActive(){
    if(_activeCard){_activeCard.classList.remove('soc-panel-active');_activeCard=null;}
    _activePanelTitle=null;
    panel.style.display='none';
  }
  function _applyActiveCard(el){
    _activeCard=el.closest('.card')||null;
    _activePanelTitle=el.dataset.panelTitle||null;
    if(_activeCard) _activeCard.classList.add('soc-panel-active');
  }
  // Appelé après chaque re-render — restaure le clignotement si panel ouvert
  window._socPanelRestoreActive=function(){
    if(!_activePanelTitle||panel.style.display==='none') return;
    let trigger=null;
    document.querySelectorAll('[data-panel-title]').forEach(function(el){if(el.getAttribute('data-panel-title')===_activePanelTitle)trigger=el;});
    if(!trigger) return;
    const card=trigger.closest('.card');
    if(card&&!card.classList.contains('soc-panel-active')) card.classList.add('soc-panel-active');
    _activeCard=card;
  };
  document.addEventListener('click',function(e){
    const el=e.target.closest('[data-panel]');
    if(el){
      e.stopPropagation();
      e.preventDefault();
      _clearActive();
      panel.innerHTML='<div id="soc-panel-hdr">'
        +'<span id="soc-panel-title">'+esc(el.dataset.panelTitle||'')+'</span>'
        +'<button id="soc-panel-close">✕</button>'
        +'</div>'
        +'<div id="soc-panel-body">'+_fmtPanel(el.dataset.panel||'')+'</div>';
      panel.style.display='block';
      _applyActiveCard(el);
      document.getElementById('soc-panel-close').onclick=function(){_clearActive();};
    }
  },true);
})();

// ── Tooltip SOC [data-tip] — body-level, immune à overflow:hidden ──
(function(){
  const tip=document.createElement('div');
  tip.id='soc-tip';
  tip.style.cssText='background:rgba(6,14,30,.97);color:rgba(185,215,240,.85);'
    +'border:1px solid rgba(0,217,255,.28);border-left:2px solid rgba(0,217,255,.6);'
    +'border-radius:3px;padding:.38rem .65rem;'
    +'font:11px/1.6 "Courier New",monospace;letter-spacing:.3px;'
    +'box-shadow:0 0 14px rgba(0,217,255,.1),0 4px 18px rgba(0,0,0,.65);'
    +'max-width:22rem;white-space:normal;opacity:0;transition:opacity .15s;display:none';
  document.body.appendChild(tip);
  let _cur=null;
  document.addEventListener('mouseover',function(e){
    const el=e.target.closest('[data-tip]');
    if(!el||el===_cur) return;
    _cur=el;
    tip.textContent=el.dataset.tip;
    tip.style.display='block';
    tip.style.opacity='0';
    const r=el.getBoundingClientRect();
    const tw=tip.offsetWidth||200, th=tip.offsetHeight||36;
    const top=r.top-th-8>=0?r.top-th-8:r.bottom+8;
    const left=Math.max(8,Math.min(r.left+r.width/2-tw/2,window.innerWidth-tw-8));
    tip.style.top=top+'px';
    tip.style.left=left+'px';
    tip.style.opacity='1';
  });
  document.addEventListener('mouseout',function(e){
    const el=e.target.closest('[data-tip]');
    if(!el) return;
    if(!e.relatedTarget||!el.contains(e.relatedTarget)){_cur=null;tip.style.opacity='0';}
  });
  document.addEventListener('scroll',function(){tip.style.opacity='0';_cur=null;},{passive:true});
})();
