// ── openProxmoxModal helpers (module-level : NDT-51) ─────────────────────
function _pb(pct,cls){return'<div class="pb-track"><div class="pb '+cls+'" style="width:'+pct+'%"></div></div>';}
function _prow(lbl,used,total,pct,cls){
  return'<div class="pb-row"><div class="pb-hdr"><span>'+lbl+'</span><span>'+used+' / '+total+' ('+pct+'%)</span></div>'+_pb(pct,cls)+'</div>';
}
function _prxModalCpuHistHtml(pts,cpuC){
  var maxC=Math.max.apply(null,pts.map(function(p){return p.cpu||0;}))||1;
  var W=200,H=36;
  var step=W/(pts.length-1||1);
  var cpuPoly=pts.map(function(p,i){return(i*step)+','+(H-1-Math.round((p.cpu||0)*(H-2)/Math.max(maxC,5)));}).join(' ');
  var maxT=Math.max.apply(null,pts.map(function(p){return p.temp||0;}))||60;
  var minT=Math.min.apply(null,pts.map(function(p){return p.temp||maxT;}))||20;
  var tempPoly=pts.filter(function(p){return p.temp!=null;}).map(function(p){
    var xi=pts.indexOf(p)*step;
    return xi+','+(H-1-Math.round(((p.temp-minT)/(Math.max(maxT-minT,1)))*(H-2)));
  }).join(' ');
  var dur=Math.round(pts.length*5/60*10)/10;
  return'<div style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:.3rem 0 .15rem">Historique CPU/Temp — '+dur+'h</div>'
    +'<div style="position:relative;background:rgba(0,0,0,0.2);border-radius:3px;padding:.2rem">'
    +'<svg width="100%" height="'+H+'px" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="display:block">'
    +(tempPoly?'<polyline points="'+tempPoly+'" fill="none" stroke="rgba(245,158,11,0.45)" stroke-width="1" stroke-dasharray="2,2"/>':'')
    +'<polyline points="'+cpuPoly+'" fill="none" stroke="'+cpuC+'" stroke-width="1.5" stroke-linejoin="round"/>'
    +'</svg>'
    +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:rgba(122,154,184,0.35);margin-top:.1rem">'
    +'<span>-'+dur+'h</span><span style="color:var(--purple)">CPU</span><span style="color:rgba(245,158,11,0.6)">Temp</span><span>maintenant</span>'
    +'</div></div>';
}
// ── openModal helpers — Suricata proto view (module-level : NDT-50) ──────
var _SUR_PROTO_ITEMS=[{k:'SUR_DNS',col:'#00ff88',l:'DNS'},{k:'SUR_HTTP',col:'#f59e0b',l:'HTTP'},{k:'SUR_TLS',col:'#00d9ff',l:'TLS/SSL'},{k:'SUR_SSH',col:'#8b5cf6',l:'SSH'},{k:'SUR_FLOW',col:'#64748b',l:'FLOW'}];
function _mBuildSurSummaryHtml(surData){
  var sd=buildSurProtoDict(surData);
  var chips=_SUR_PROTO_ITEMS.filter(function(i){return sd[i.k]>0;}).map(function(i){
    return '<div class="stat-box" style="text-align:center;flex:1;padding:.25rem .3rem"><div class="sval" style="color:'+i.col+';font-size:var(--fs-xs)">'+fmt(sd[i.k])+'</div><div class="slbl">'+i.l+'</div></div>';
  }).join('');
  var threats='';
  if(sd.SUR_SCAN>0) threats+='<span style="padding:.12rem .35rem;background:rgba(255,59,92,0.15);border:1px solid rgba(255,59,92,0.4);border-radius:2px;font-size:var(--fs-xs);color:#ff3b5c;font-weight:700">⚡ SCAN '+sd.SUR_SCAN+' hits</span> ';
  if(sd.SUR_C2>0)   threats+='<span style="padding:.12rem .35rem;background:rgba(220,38,38,0.18);border:1px solid rgba(220,38,38,0.45);border-radius:2px;font-size:var(--fs-xs);color:#dc2626;font-weight:700">☠ C2 ×'+sd.SUR_C2+'</span>';
  return '<div style="margin-top:.6rem;border-top:1px solid rgba(255,59,92,0.2);padding-top:.45rem">'
    +'<div style="font-size:var(--fs-xs);color:rgba(255,59,92,0.5);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.35rem">◈ Suricata IDS réseau</div>'
    +'<div style="display:flex;gap:.3rem;flex-wrap:wrap">'+chips+'</div>'
    +(threats?'<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.3rem">'+threats+'</div>':'')
    +'</div>';
}
function _surKpiGaugeHtml(sp){
  var scanHits=sp.SUR_SCAN||0,c2=sp.SUR_C2||0;
  var thr=scanHits||c2
    ?'<div style="display:flex;gap:.4rem;margin-top:.4rem;flex-wrap:wrap">'
      +(scanHits?'<span style="padding:.15rem .4rem;background:rgba(255,59,92,0.15);border:1px solid rgba(255,59,92,0.4);border-radius:3px;font-size:var(--fs-xs);color:#ff3b5c;font-weight:700">⚡ SCAN '+scanHits+' hits</span>':'')
      +(c2?'<span style="padding:.15rem .4rem;background:rgba(220,38,38,0.18);border:1px solid rgba(220,38,38,0.45);border-radius:3px;font-size:var(--fs-xs);color:#dc2626;font-weight:700">☠ C2/TROJAN ×'+c2+'</span>':'')
      +'</div>':'';
  return '<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.35rem">Détections réseau Suricata IDS</div>'
    +'<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
    +_SUR_PROTO_ITEMS
     .filter(function(i){return sp[i.k]>0;})
     .map(function(i){return '<div class="stat-box" style="text-align:center;flex:1"><div class="sval" style="color:'+i.col+';font-size:var(--fs-xs)">'+fmt(sp[i.k])+'</div><div class="slbl">'+i.l+'</div></div>';})
     .join('')
    +'</div>'+thr;
}
// ── openModal proto helpers (module-level : NDT-78) ──────────────────────
function _mcSwitchProtoView(p,lbl,isLive,_modalBody,full5){
  var b5=_modalBody.querySelector('#ptBtn5'),b24=_modalBody.querySelector('#ptBtn24');
  if(b5)b5.classList.toggle('active',isLive);
  if(b24)b24.classList.toggle('active',!isLive);
  var pmD2=_modalBody.querySelector('#pm-donut');
  if(pmD2)drawProtoModalDonut(pmD2,p,lbl);
  var pmGauge=_modalBody.querySelector('#pm-gauge');
  if(pmGauge)pmGauge.innerHTML=buildProtoThreatGauge(p);
  var pmLeg=_modalBody.querySelector('#pm-legend');
  if(pmLeg)pmLeg.innerHTML=buildProtoModalLegend(p);
  var rpmEl=_modalBody.querySelector('#pt-rpm');
  if(rpmEl)rpmEl.textContent=isLive?(full5.rpm||'—')+' req/min':'données 24h';
}
function _mcRestoreLegend(p,_modalBody,surData){
  var pmLeg=_modalBody.querySelector('#pm-legend');
  if(pmLeg)pmLeg.innerHTML=buildProtoModalLegend(p)+_mBuildSurSummaryHtml(surData);
}
function openModal(cardEl){
  if(_isOpen)return;
  _isOpen=true;
  if(!cardEl){
    // appel direct (openJvModal, etc.) — contenu déjà injecté dans modal-body
    _overlay.classList.add('open');
    document.body.style.overflow='hidden';
    return;
  }
  var inner=cardEl.querySelector('.card-inner');
  if(!inner)return;
  var isMap   = !!cardEl.querySelector('#geomap');
  var isHeat  = !!cardEl.querySelector('.heatmap-canvas');
  var isRt    = !!cardEl.querySelector('#rt-area');
  var isProto = !!cardEl.querySelector('#proto-donut');
  var isKc    = !!cardEl.querySelector('#ckc-canvas');
  var mc = document.getElementById('modal-card');
  if(isMap) mc.classList.add('modal-geomap');
  else if(isHeat||isRt||isKc) mc.classList.add('modal-wide');
  if(isProto) mc.classList.add('modal-proto');
  // Thème couleur — cherche le 1er enfant direct de card-inner qui a classe "ct"
  var _themeMap={'r':'theme-red','g':'theme-green','c':'theme-cyan','p':'theme-purple','o':'theme-orange','y':'theme-yellow'};
  var _ctEl=null;
  for(var _ci=0;_ci<inner.children.length;_ci++){
    if(inner.children[_ci].classList&&inner.children[_ci].classList.contains('ct')){_ctEl=inner.children[_ci];break;}
  }
  var _hdrTitle=document.getElementById('modal-header-title');
  if(_ctEl){
    var _keys=Object.keys(_themeMap);
    for(var _ki=0;_ki<_keys.length;_ki++){
      if(_ctEl.classList.contains(_keys[_ki])){ mc.classList.add(_themeMap[_keys[_ki]]); break; }
    }
    // Titre modal — icône + nom de la tuile (retire "● LIVE" et texte superflu)
    if(_hdrTitle){
      var _iconEl=_ctEl.querySelector('.ct-icon');
      var _iconTxt=_iconEl?_iconEl.textContent:'';
      var _ctClone2=_ctEl.cloneNode(true);
      var _iconSp=_ctClone2.querySelector('.ct-icon');if(_iconSp)_iconSp.remove();
      var _tileTitle=_ctClone2.textContent.replace(/●\s*LIVE\s*/gi,'').trim();
      _hdrTitle.innerHTML=(_iconTxt?'<span style="margin-right:.45rem;opacity:.6">'+_iconTxt+'</span>':'')+_tileTitle;
    }
  }
  _modalBody.innerHTML=inner.innerHTML;
  // Supprimer l'en-tête .ct de la tuile copié dans le body (déjà affiché dans modal-header)
  if(!isProto){var _ctInBody=_modalBody.querySelector('.ct');if(_ctInBody)_ctInBody.remove();}
  _modalBody.style.fontSize='1.05em';
  _overlay.classList.add('open');
  document.body.style.overflow='hidden';
  _raf2(function(){
    if(isMap){
      var mc2=_modalBody.querySelector('canvas');
      if(mc2)drawGeoMap(_lfLastGeoips,mc2,_lfLastWanIp);
    }
    // Sparklines bande passante (carte dédiée)
    if(_lfNetRx.length){
      var spRx=_modalBody.querySelector('[data-key="rx"]');
      var spTx=_modalBody.querySelector('[data-key="tx"]');
      if(spRx)drawNetSparkline(spRx,_lfNetRx,'0,217,255',_lfMaxRx);
      if(spTx)drawNetSparkline(spTx,_lfNetTx,'0,255,136',_lfMaxTx);
    }
    // Attack heatmap en modal
    var hmc=_modalBody.querySelector('.heatmap-canvas');
    if(hmc&&window._lastTraffic){
      var tt=window._lastTraffic;
      hmc.classList.add('heatmap-expanded');
      animateAttackHeatmap(hmc,tt.requests_per_hour||{},tt.blocks_per_hour||{},tt.errors_per_hour||{},260);
    }
    // ACTIVITÉ TEMPS RÉEL en modal
    if(isRt&&window._lastData){
      var rtD=window._lastData.traffic||{};
      var rtK=Object.keys(rtD.requests_per_hour||{}).sort();
      var rtR=rtK.map(function(k){return rtD.requests_per_hour[k]||0;});
      var rtB=rtK.map(function(k){return(rtD.blocks_per_hour||{})[k]||0;});
      var rtA=_modalBody.querySelector('#rt-area');
      if(rtA)drawReqCurve(rtA,rtR,rtB);
      var nh=window._lastData.net_history||[];
      if(nh.length){
        var rx=nh.map(function(p){return p.rx||0;}),tx=nh.map(function(p){return p.tx||0;});
        var mRx=Math.max.apply(null,rx)||1,mTx=Math.max.apply(null,tx)||1;
        var mSpRx=_modalBody.querySelector('#rt-sp-rx'),mSpTx=_modalBody.querySelector('#rt-sp-tx');
        if(mSpRx)drawNetSparkline(mSpRx,rx,'0,217,255',mRx);
        if(mSpTx)drawNetSparkline(mSpTx,tx,'0,255,136',mTx);
      }
    }
    // Kill Chain en modal
    if(isKc&&window._lastData){
      var kcCv=_modalBody.querySelector('#ckc-canvas');
      if(kcCv)animateKillChain(kcCv,window._lastData.kill_chain||{},window._lastData.fail2ban||{});
    }
    // Proto donut en modal — grand donut avec étiquettes en orbite
    if(isProto){
      var proto5=window._liveProto||{};
      var proto24=(window._lastData&&window._lastData.traffic&&window._lastData.traffic.proto_breakdown)||{};
      var full5=window._liveProtoFull||{};
      var curProto=proto5;var curLbl='REQ/5MIN';
      var ctHdr=_modalBody.querySelector('.ct');
      // Cloner pour supprimer #proto-rpm (évite le doublon req/min en haut droite)
      var ctClone=ctHdr?ctHdr.cloneNode(true):null;
      if(ctClone){var rEl=ctClone.querySelector('#proto-rpm');if(rEl)rEl.remove();}
      var ctHTML=ctClone?ctClone.outerHTML:'';
      // Calcul taille donut : 56% de la largeur modale, plafonné par la hauteur
      var mCard=document.getElementById('modal-card');
      var mw=mCard.offsetWidth||Math.round(window.innerWidth*0.88);
      var avH=Math.round(window.innerHeight*0.88)-150;
      var leftColW=Math.floor((mw-40)*0.56);
      var sz=Math.min(leftColW,avH,740);
      sz=Math.max(sz,260);

      _modalBody.innerHTML=ctHTML
        +'<div class="proto-toggle-row">'
        +'<button class="proto-toggle-btn active" id="ptBtn5">⬤ LIVE 5 MIN</button>'
        +'<button class="proto-toggle-btn" id="ptBtn24">◉ 24 HEURES</button>'
        +'<button class="proto-toggle-btn" id="ptBtnSur" style="border-color:rgba(255,59,92,0.4);color:var(--red)">◈ SURICATA</button>'
        +'<span style="margin-left:auto;font-size:var(--fs-xs);color:var(--muted)" id="pt-rpm">'+(full5.rpm||'—')+' req/min</span>'
        +'<span id="pt-ts" style="font-size:var(--fs-xs);color:rgba(0,217,255,0.3);margin-left:.7rem;font-family:\'Courier New\',monospace"></span>'
        +'</div>'
        +'<div class="proto-modal-layout2">'
        +'<div class="proto-modal-left2"><canvas id="pm-donut" data-sz="'+sz+'" style="display:block"></canvas></div>'
        +'<div class="proto-modal-right2">'
        +'<div id="pm-gauge">'+buildProtoThreatGauge(curProto)+'</div>'
        +'<div id="pm-legend" style="margin-top:.2rem">'+buildProtoModalLegend(curProto)+'</div>'
        +(full5.rpm_buckets&&Object.keys(full5.rpm_buckets).length
          ?'<div class="proto-spark-wrap"><div class="proto-spark-lbl"><span>REQ/MIN — 5 DERNIÈRES MIN</span><span id="pt-spark-max"></span></div>'
          +'<canvas class="proto-spark-canvas" id="pm-spark" height="44"></canvas></div>'
          :'')
        +'</div>'
        +'</div>';
      var pmD=_modalBody.querySelector('#pm-donut');
      if(pmD)drawProtoModalDonut(pmD,curProto,curLbl);
      var pmSp=_modalBody.querySelector('#pm-spark');
      if(pmSp&&full5.rpm_buckets){
        requestAnimationFrame(function(){requestAnimationFrame(function(){drawProtoSpark(pmSp,full5.rpm_buckets);});});
        var smx=Math.max.apply(null,Object.values(full5.rpm_buckets));
        var sml=_modalBody.querySelector('#pt-spark-max');
        if(sml)sml.textContent='max '+smx+' req/min';
      }
      var surData=window._lastData&&window._lastData.suricata||{};
      var surProto=buildSurProtoDict(surData);
      // ── Détection trafic nginx disponible ─────────────────────────────────
      var _hasNginxInit=Object.keys(curProto).some(function(k){return (curProto[k]||0)>0;});
      _raf2(function(){
        var pmG0=_modalBody.querySelector('#pm-gauge');
        var pmLeg0=_modalBody.querySelector('#pm-legend');
        var pmD0=_modalBody.querySelector('#pm-donut');
        var rpmEl0=_modalBody.querySelector('#pt-rpm');
        if(!_hasNginxInit){
          // Aucun trafic nginx 5min — afficher Suricata automatiquement
          if(pmD0)drawProtoModalDonut(pmD0,surProto,'SURICATA');
          if(pmG0)pmG0.innerHTML=_surKpiGaugeHtml(surProto);
          if(pmLeg0)pmLeg0.innerHTML='';
          if(rpmEl0)rpmEl0.textContent='Suricata IDS réseau';
        } else {
          if(pmLeg0)pmLeg0.innerHTML=buildProtoModalLegend(curProto)+_mBuildSurSummaryHtml(surData);
        }
      });
      _raf2(function(){
        var b5=_modalBody.querySelector('#ptBtn5'),b24=_modalBody.querySelector('#ptBtn24'),bSur=_modalBody.querySelector('#ptBtnSur');
        // Si pas de trafic nginx au démarrage : SURICATA actif par défaut
        if(!_hasNginxInit&&b5&&bSur){b5.classList.remove('active');bSur.classList.add('active');}
        if(b5)b5.onclick=function(){
          [b5,b24,bSur].forEach(function(b){if(b)b.classList.remove('active');});
          b5.classList.add('active');
          _mcSwitchProtoView(proto5,'REQ/5MIN',true,_modalBody,full5);
          _mcRestoreLegend(proto5,_modalBody,surData);
        };
        if(b24)b24.onclick=function(){
          [b5,b24,bSur].forEach(function(b){if(b)b.classList.remove('active');});
          b24.classList.add('active');
          _mcSwitchProtoView(proto24,'REQ/24H',false,_modalBody,full5);
          _mcRestoreLegend(proto24,_modalBody,surData);
        };
        if(bSur)bSur.onclick=function(){
          [b5,b24,bSur].forEach(function(b){if(b)b.classList.remove('active');});
          bSur.classList.add('active');
          var pmD3=_modalBody.querySelector('#pm-donut');
          if(pmD3)drawProtoModalDonut(pmD3,surProto,'SURICATA');
          var pmGauge3=_modalBody.querySelector('#pm-gauge');
          if(pmGauge3)pmGauge3.innerHTML=_surKpiGaugeHtml(surProto);
          var pmLeg3=_modalBody.querySelector('#pm-legend');
          if(pmLeg3)pmLeg3.innerHTML='';
          var rpmEl=_modalBody.querySelector('#pt-rpm');
          if(rpmEl)rpmEl.textContent='Suricata IDS réseau';
        };
      });
    }
  });
}

// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// PROXMOX MODAL — RESSOURCES & CONTRE-MESURES
// ════════════════════════════════════════════════════════
function openProxmoxModal(data){
  if(_isOpen)return;
  var prx=data.proxmox||{};
  var node=(prx.nodes&&prx.nodes[0])||{};
  var vms=node.vms||[];
  var mc=document.getElementById('modal-card');
  mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-kci','modal-geomap','theme-red','theme-green','theme-cyan','theme-orange','theme-yellow');
  mc.classList.add('modal-win','theme-purple');
  var _ht=document.getElementById('modal-header-title');
  if(_ht) _ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">◈</span>PROXMOX VE — RESSOURCES &amp; SÉCURITÉ';
  var pveCpuHist=data.pve_cpu_history||[];
  var cpuPct=node.cpu_pct||0;
  var cpuC=cpuPct>85?'var(--red)':cpuPct>60?'var(--yellow)':'var(--purple)';
  var cpuTmpC=node.cpu_temp!=null?(node.cpu_temp>85?'var(--red)':node.cpu_temp>70?'var(--yellow)':'var(--green)'):'var(--muted)';
  var nvmeTmpC=node.nvme_temp!=null?(node.nvme_temp>70?'var(--red)':node.nvme_temp>55?'var(--yellow)':'var(--cyan)'):'var(--muted)';
  var cpuSectionHtml=`<div class="win-section"><div class="win-section-hdr"><span style="color:var(--purple)">▸</span> PROCESSEUR</div><div style="display:flex;align-items:center;gap:1rem;margin-bottom:.4rem">${winGaugeSVG(cpuPct,cpuC,'CPU',node.cpu_temp!=null?node.cpu_temp+'°C':'')}<div style="flex:1;font-size:var(--fs-xs)">${node.cpu_model?`<div style="font-size:var(--fs-xs);color:var(--text);font-family:Courier New,monospace;margin-bottom:.2rem" title="${esc(node.cpu_model)}">${esc((node.cpu_model||'').replace('12th Gen Intel(R) Core(TM) ','').substring(0,28))}</div>`:''}<div style="color:var(--muted)">Threads : <span style="color:var(--text)">${node.cpu_cores||'?'}</span></div><div style="color:var(--muted)">Charge : <span style="color:${cpuC}">${cpuPct}%</span></div><div style="margin-top:.3rem;display:flex;gap:.6rem">${node.cpu_temp!=null?`<span style="color:var(--muted)">CPU <span style="color:${cpuTmpC};font-weight:700">${node.cpu_temp}°C</span></span>`:''}${node.nvme_temp!=null?`<span style="color:var(--muted)">NVMe <span style="color:${nvmeTmpC}">${node.nvme_temp}°C</span></span>`:''}${node.acpi_temp!=null?`<span style="color:var(--muted)">ACPI <span style="color:var(--muted)">${node.acpi_temp}°C</span></span>`:''}</div></div></div>${pveCpuHist.length>1?_prxModalCpuHistHtml(pveCpuHist,cpuC):''}</div>`;
  var memSectionHtml='<div class="win-section"><div class="win-section-hdr"><span style="color:var(--purple)">▸</span> MÉMOIRE &amp; SYSTÈME</div>'
    +(node.mem_pct!==undefined?_prow('RAM',fmtMb(node.mem_used_mb),fmtMb(node.mem_total_mb),node.mem_pct,node.mem_pct>85?'pb-r':node.mem_pct>60?'pb-y':'pb-p'):'')
    +(node.swap_total_mb>0?_prow('Swap',fmtMb(node.swap_used_mb),fmtMb(node.swap_total_mb),node.swap_pct,node.swap_pct>85?'pb-r':node.swap_pct>60?'pb-y':'pb-c'):'')
    +(node.rootfs_total_gb>0?_prow('rootfs',node.rootfs_used_gb+' Go',node.rootfs_total_gb+' Go',node.rootfs_pct,'pb-y'):'')
    +'</div>';
  var storageSectionHtml=(node.storages&&node.storages.length)
    ?'<div class="win-section"><div class="win-section-hdr"><span style="color:var(--purple)">▸</span> STOCKAGE</div>'
      +node.storages.map(function(st){var sc=st.pct>85?'pb-r':st.pct>60?'pb-y':'pb-g';return _prow(esc(st.name)+' <span style="font-size:var(--fs-xs);color:var(--muted)">('+esc(st.type)+')</span>',st.used_gb+' Go',st.total_gb+' Go',st.pct,sc);}).join('')
      +'</div>':'';
  var vmRun=vms.filter(function(v){return v.status==='running';}).length;
  var vmRowsHtml=vms.map(function(vm){
    var run=vm.status==='running',cpuV=vm.cpu||0,memV=vm.mem_pct||0;
    return `<div style="display:flex;align-items:center;gap:.5rem;padding:.2rem .35rem;margin-bottom:.18rem;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,${run?'0.1':'0.04'});border-radius:3px"><span style="font-size:var(--fs-xs);color:${run?'var(--green)':'var(--red)'}">${run?'●':'○'}</span><span style="font-size:var(--fs-xs);font-family:Courier New,monospace;color:var(--text);min-width:2rem">${esc(vm.id||vm.vmid||'')}</span><span style="flex:1;font-size:var(--fs-xs);color:var(--text)">${esc(vm.name||'—')}</span>${run?`<span style="font-size:var(--fs-xs);color:var(--muted)">CPU <span style="color:var(--cyan)">${cpuV}%</span> · RAM <span style="color:var(--green)">${memV}%</span></span>`:`<span style="font-size:var(--fs-xs);color:var(--muted)">stopped</span>`}</div>`;
  }).join('');
  var h=`<div class="win-refresh-bar"><div style="display:flex;align-items:center;gap:.8rem"><span class="ct-icon" style="color:var(--purple);font-size:var(--fs-lg)">◈</span><span style="font-size:var(--fs-sm);font-weight:700;color:var(--purple);letter-spacing:2px">PROXMOX VE — ${SOC_INFRA.PROXMOX}</span></div><span class="win-modal-ts">Nœud : ${esc(node.name||'pve')} · uptime ${esc(node.uptime||'?')}</span></div><div class="win-modal-grid"><div>${cpuSectionHtml}${memSectionHtml}${storageSectionHtml}</div><div><div class="win-section"><div class="win-section-hdr"><span style="color:var(--purple)">▸</span> MACHINES VIRTUELLES</div><div style="display:flex;gap:.6rem;margin-bottom:.5rem"><div class="stat-box" style="flex:1;text-align:center"><div class="sval" style="color:var(--green);font-size:var(--fs-sm)">${vmRun}</div><div class="slbl">Running</div></div><div class="stat-box" style="flex:1;text-align:center"><div class="sval" style="color:var(--red);font-size:var(--fs-sm)">${vms.length-vmRun}</div><div class="slbl">Stopped</div></div><div class="stat-box" style="flex:1;text-align:center"><div class="sval" style="color:var(--purple);font-size:var(--fs-sm)">${vms.length}</div><div class="slbl">Total</div></div></div>${vmRowsHtml}</div></div></div><div style="font-size:var(--fs-xs);color:rgba(122,154,184,0.3);text-align:center;margin-top:.4rem">Actualisé toutes les 5 min</div>`;
  _modalBody.innerHTML=h;
  _modalBody.style.fontSize='1em';
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
  animateGauges();
}

// ════════════════════════════════════════════════════════
// FAIL2BAN JAILS MODAL
// ════════════════════════════════════════════════════════
var JAIL_DESC={
  'nginx-cve':'Exploits CVE détectés — Path Traversal, Log4Shell, RCE (maxretry=1, bantime=24h)',
  'nginx-site01-444':'Connexions fermées sans réponse — IP bloquée par nginx (444)',
  'nginx-site01-400':'Requêtes HTTP malformées ou malveillantes (400)',
  'nginx-limit-req':'Rate-limiting dépassé — trop de requêtes (429)',
  'nginx-http-auth':'Tentatives d\'authentification HTTP échouées (401)',
  'sshd':'Tentatives d\'authentification SSH échouées (port 2272)',
  'proxmox-ui':'Tentatives d\'authentification échouées sur l\'interface web Proxmox VE',
  'apache-badbots':'Bots malveillants connus — User-Agent blacklistés (maxretry=2)',
  'apache-noscript':'Requêtes vers scripts inexistants — scan de vulnérabilités (maxretry=6)',
  'apache-overflows':'Tentatives de buffer overflow sur requêtes HTTP (maxretry=2)'
};
function _f2bFlag(cc){
  if(!cc||cc==='-'||cc.length!==2)return '';
  try{return String.fromCodePoint.apply(null,cc.toUpperCase().split('').map(function(c){return 0x1F1E6-65+c.charCodeAt(0);}));}catch(e){return '';}
}
function _f2bFmtBantime(s){
  if(!s||s<0)return '?';
  if(s>=86400)return Math.round(s/86400)+'j';
  if(s>=3600)return Math.round(s/3600)+'h';
  return Math.round(s/60)+'min';
}
// ── openSuricataModal helpers (module-level : NDT-52) ────────────────────
function _surKpiHtml(val,lbl,col){
  return '<div style="flex:1;text-align:center;padding:.55rem .4rem;border-right:1px solid rgba(255,255,255,0.05)">'
    +'<div style="font-size:var(--fs-3xl);font-weight:700;font-family:\'Courier New\',monospace;color:'+col+';line-height:1;text-shadow:0 0 10px '+col+'44">'+val+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:.25rem">'+lbl+'</div>'
    +'</div>';
}
function _surSecTitleHtml(icon,lbl,col){
  return '<div style="font-size:var(--fs-xs);color:'+col+';text-transform:uppercase;letter-spacing:.6px;font-weight:700;margin-bottom:.4rem;border-left:3px solid '+col+';padding-left:.5rem">'+icon+' '+lbl+'</div>';
}
function openSuricataModal(sur){
  if(!sur||!sur.available||_isOpen)return;
  var s1=sur.sev1_critical||0, s2=sur.sev2_high||0, s3=sur.sev3_medium||0;
  var tot=sur.total_alerts||0, rules=sur.rules_loaded||0;
  var topIps=sur.top_ips||[], topSigs=sur.top_signatures||[], rc=sur.recent_critical||[];
  var evts=sur.events||{}, enabledSrc=sur.enabled_sources||[];

  // ── KPI bar ──
  var trafficHtml=['dns','http','tls','ssh','flow'].map(function(k){
    return `<div style="flex:1;min-width:50px;padding:.3rem .35rem;background:rgba(0,217,255,0.05);border:1px solid rgba(0,217,255,0.15);border-left:3px solid rgba(0,217,255,.45);border-radius:0 2px 2px 0;text-align:center"><div style="font-size:var(--fs-sm);font-weight:700;color:var(--cyan);font-family:'Courier New',monospace">${evts[k]||0}</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.3px">${k}</div></div>`;
  }).join('');
  var criticalAlertsHtml=rc.length
    ?_surSecTitleHtml('⚠','Alertes critiques récentes (sév.1)','var(--red)')
      +'<div style="display:flex;flex-direction:column;gap:.3rem">'
      +rc.map(function(a){
        return `<div style="padding:.32rem .5rem .32rem .65rem;background:rgba(255,59,92,0.06);border-left:3px solid var(--red);border-radius:0 2px 2px 0"><div style="display:grid;grid-template-columns:108px 1fr auto auto;gap:.25rem .45rem;align-items:center;margin-bottom:.18rem"><span style="font-size:var(--fs-xs);color:var(--red);font-family:'Courier New',monospace;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.src_ip)}</span><span style="font-size:var(--fs-xs);color:rgba(122,154,184,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.ts||'')}</span>${a.proto?`<span style="font-size:var(--fs-xs);color:var(--cyan);padding:.03rem .18rem;border:1px solid rgba(0,217,255,.3);border-radius:2px;white-space:nowrap">${esc(a.proto)}</span>`:'<span></span>'}${a.dest_port?`<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.35);white-space:nowrap">:${a.dest_port}</span>`:'<span></span>'}</div><div style="font-size:var(--fs-xs);color:rgba(255,150,150,.9);line-height:1.35">${esc(a.signature)}</div>${a.category?`<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.35);margin-top:.06rem">${esc(a.category)}</div>`:''}</div>`;
      }).join('')+'</div>':'';
  var topIpsHtml=topIps.length
    ?_surSecTitleHtml('◉','Top IPs attaquantes','rgba(255,59,92,.6)')
      +'<div style="display:flex;flex-direction:column;gap:.18rem">'
      +topIps.map(function(e){
        var pct=Math.round(e.count*100/(topIps[0].count||1));
        var opacity=pct>66?.6:pct>33?.38:.22;
        return `<div style="display:grid;grid-template-columns:108px 1fr 40px;gap:.3rem;align-items:center;padding:.2rem .4rem .2rem .65rem;border-left:3px solid rgba(255,59,92,${opacity})"><span style="font-size:var(--fs-xs);color:var(--red);font-family:'Courier New',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.ip)}</span><div style="height:7px;background:rgba(255,59,92,0.1);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,rgba(255,59,92,.5),var(--red));border-radius:2px"></div></div><span style="font-size:var(--fs-xs);color:var(--amber);text-align:right;font-family:'Courier New',monospace;font-weight:700">${e.count}</span></div>`;
      }).join('')+'</div>':'';
  var topSigsHtml=topSigs.length
    ?_surSecTitleHtml('▸','Top signatures déclenchées','rgba(0,217,255,.5)')
      +'<div style="display:flex;flex-direction:column;gap:.15rem">'
      +topSigs.map(function(s){
        return `<div style="display:grid;grid-template-columns:40px 1fr;gap:.4rem;align-items:baseline;padding:.22rem .4rem .22rem .65rem;border-left:3px solid rgba(0,217,255,.18)"><span style="font-size:var(--fs-xs);color:var(--cyan);font-weight:700;font-family:'Courier New',monospace;text-align:right">${s.count}×</span><span style="font-size:var(--fs-xs);color:rgba(180,210,240,.85);line-height:1.35">${esc(s.sig)}</span></div>`;
      }).join('')+'</div>':'';
  var SRC_DESC={'et/open':'ET/Open — 40k règles généralistes','abuse.ch/feodotracker':'C2 Feodo/Emotet/TrickBot','abuse.ch/sslbl-blacklist':'SSL certs malveillants','abuse.ch/sslbl-ja3':'JA3 TLS fingerprints','abuse.ch/urlhaus':'URLhaus malware actives','etnetera/aggressive':'Malware agressif / 0-day','aleksibovellan/nmap':'Détection scans NMAP','oisf/trafficid':'Identification protocoles suspects','ptresearch/attackdetection':'PT Research exploits'};
  var sourcesHtml=enabledSrc.length
    ?_surSecTitleHtml('✓','Sources de règles actives ('+enabledSrc.length+')','rgba(0,255,136,.55)')
      +'<div style="display:flex;flex-direction:column;gap:.18rem">'
      +enabledSrc.map(function(s){
        var parts=(SRC_DESC[s]||s).split('—');
        return `<div style="display:grid;grid-template-columns:180px 1fr;gap:.4rem;align-items:center;padding:.22rem .4rem .22rem .65rem;border-left:3px solid rgba(0,255,136,.22)"><span style="display:flex;align-items:center;gap:.35rem;min-width:0"><span style="width:5px;height:5px;min-width:5px;background:var(--green);border-radius:50%;box-shadow:0 0 4px rgba(0,255,136,.5)"></span><span style="font-size:var(--fs-xs);color:var(--cyan);font-family:'Courier New',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s)}</span></span><span style="font-size:var(--fs-xs);color:rgba(122,154,184,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(parts[1]||parts[0]||'')}</span></div>`;
      }).join('')+'</div>':'';
  var h=`<div style="display:flex;gap:0;margin-bottom:.8rem;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">${_surKpiHtml(s1,'Critique sév.1','var(--red)')}${_surKpiHtml(s2,'High sév.2','var(--amber)')}${_surKpiHtml(s3,'Medium sév.3','var(--cyan)')}${_surKpiHtml(tot,'Total 24h','rgba(122,154,184,.6)')}<div style="flex:1;text-align:center;padding:.55rem .4rem"><div style="font-size:var(--fs-2xl);font-weight:700;font-family:'Courier New',monospace;color:rgba(122,154,184,.45);line-height:1">${Math.round(rules/1000)}k</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:.25rem">Règles actives</div></div></div><div style="margin-bottom:.75rem">${_surSecTitleHtml('◈','Trafic réseau observé','rgba(0,217,255,.6)')}<div style="display:flex;gap:.3rem;flex-wrap:wrap">${trafficHtml}</div></div>${rc.length?`<div style="margin-bottom:.75rem">${criticalAlertsHtml}</div>`:''} ${topIps.length?`<div style="margin-bottom:.75rem">${topIpsHtml}</div>`:''} ${topSigs.length?`<div style="margin-bottom:.75rem">${topSigsHtml}</div>`:''} ${enabledSrc.length?`<div>${sourcesHtml}</div>`:''}`;


  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-wide','theme-cyan');
  mc.style.height='';mc.style.maxHeight='82vh';
  var mh=document.getElementById('modal-header-title');
  if(mh)mh.innerHTML='<span style="margin-right:.45rem;opacity:.6">◈</span>SURICATA IDS — ANALYSE RÉSEAU 24H';
  var mb=document.getElementById('modal-body');
  mb.innerHTML=h;mb.style.overflowY='auto';mb.style.maxHeight='70vh';
  openModal();
}

// ── openF2bModal helpers (module-level : NDT-53) ─────────────────────────
function _f2bKpiHtml(val,lbl,col,pulse){
  return '<div style="flex:1;text-align:center;padding:.55rem .4rem;border-right:1px solid rgba(255,255,255,0.05)">'
    +'<div style="font-size:var(--fs-3xl);font-weight:700;font-family:\'Courier New\',monospace;color:'+col+';line-height:1'+(pulse?';animation:pulse 1.4s infinite':'')+';text-shadow:0 0 10px '+col+'44">'+val+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:.2rem">'+lbl+'</div>'
    +'</div>';
}
function openF2bModal(f2b){
  if(!f2b||_isOpen)return;
  var pvf2b=f2b.proxmox||{};
  var cltf2b=f2b.site01||{};
  var pa85f2b=f2b.site02||{};
  var allHosts=[
    {label:'SRV-NGIX', jails:f2b.jails||[], avail:true, note:'nginx · ignoreip '+SOC_INFRA.LAN_CIDR+''},
    {label:'PROXMOX',  jails:pvf2b.jails||[], avail:pvf2b.available, stale:pvf2b.stale,
     note:pvf2b.available&&pvf2b.generated_at?'sync '+pvf2b.generated_at.replace('T',' ').slice(0,16)+' UTC':'push cron 5 min'},
    {label:'SITE01',      jails:cltf2b.jails||[], avail:cltf2b.available, note:'apache · ignoreip '+SOC_INFRA.LAN_CIDR+''},
    {label:'SITE02',     jails:pa85f2b.jails||[], avail:pa85f2b.available, note:'apache · ignoreip '+SOC_INFRA.LAN_CIDR+''}
  ];
  var totalBanned=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.reduce(function(x,j){return x+(j.cur_banned||0);},0):0);},0);
  var totalFailed=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.reduce(function(x,j){return x+(j.tot_failed||0);},0):0);},0);
  var activeJails=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.filter(function(j){return j.cur_banned>0;}).length:0);},0);
  var prebanJails=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.filter(function(j){return j.cur_failed>0&&j.cur_banned===0;}).length:0);},0);
  var totalJails=allHosts.reduce(function(a,h){return a+(h.avail?h.jails.length:0);},0);
  var banCol=totalBanned>0?'var(--red)':'var(--green)';


  // ── KPI bar + 2×2 host grid ──
  var hostsGridHtml=allHosts.map(function(host){
    var hostBan=host.avail?host.jails.reduce(function(a,j){return a+(j.cur_banned||0);},0):0;
    var hasBan=hostBan>0;
    var accentCol=!host.avail?'rgba(122,154,184,.2)':hasBan?'rgba(255,60,60,.75)':'rgba(0,255,136,.45)';
    var borderOther=!host.avail?'rgba(122,154,184,.07)':hasBan?'rgba(255,60,60,.12)':'rgba(0,217,255,.07)';
    var hdrCol=!host.avail?'var(--muted)':hasBan?'var(--red)':'var(--cyan)';
    var statusBadge=!host.avail
      ?'<span style="font-size:var(--fs-xs);padding:.03rem .28rem;background:rgba(122,154,184,.07);border:1px solid rgba(122,154,184,.15);border-radius:2px;color:var(--muted)">HORS LIGNE</span>'
      :host.stale
        ?'<span style="font-size:var(--fs-xs);padding:.03rem .28rem;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.22);border-radius:2px;color:var(--amber)">⚠ STALE</span>'
        :hasBan
          ?`<span style="font-size:var(--fs-xs);padding:.03rem .32rem;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.32);border-radius:2px;color:var(--red);font-weight:700">▸ ${hostBan} BAN</span>`
          :'<span style="font-size:var(--fs-xs);padding:.03rem .28rem;background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.16);border-radius:2px;color:var(--green)">✓ CLEAN</span>';
    var jailsBodyHtml=!host.avail
      ?'<div style="font-size:var(--fs-xs);color:var(--muted);padding:.35rem 0">Données non disponibles</div>'
      :!host.jails.length
        ?'<div style="font-size:var(--fs-xs);color:var(--muted);padding:.35rem 0">Aucune jail détectée</div>'
        :(function(){
          var sorted=host.jails.slice().sort(function(a,b){return (b.cur_banned+b.cur_failed)-(a.cur_banned+a.cur_failed);});
          return '<div style="display:grid;grid-template-columns:1fr 4.8rem 4.8rem 3.8rem;gap:.08rem .35rem;margin-bottom:.15rem">'
            +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);text-transform:uppercase;letter-spacing:.4px">JAIL</span>'
            +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);text-align:right">BAN/Σ</span>'
            +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);text-align:right">FAIL/Σ</span>'
            +'<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);text-align:right">DURÉE</span>'
            +'</div>'
            +'<div style="height:1px;background:rgba(255,255,255,0.048);margin-bottom:.12rem"></div>'
            +sorted.map(function(j){
              var isOn=j.cur_banned>0,isPreban=j.cur_failed>0&&!isOn;
              var rowBg=isOn?'rgba(255,60,60,.05)':isPreban?'rgba(245,158,11,.04)':'transparent';
              var blStyle=isOn?'border-left:2px solid rgba(255,60,60,.38);':isPreban?'border-left:2px solid rgba(245,158,11,.3);':'border-left:2px solid transparent;';
              var nameCol=isOn?'var(--red)':isPreban?'var(--amber)':'rgba(122,154,184,.7)';
              var bCol=isOn?'var(--red)':'rgba(122,154,184,.28)';
              var fCol=j.cur_failed>0?'var(--amber)':'rgba(122,154,184,.28)';
              var bt=j.bantime?_f2bFmtBantime(j.bantime):'—';
              var jname=j.jail.replace(/^apache-/,'ap-');
              var desc=JAIL_DESC[j.jail]||'';
              var bannedIpsHtml=(j.banned_ips&&j.banned_ips.length)
                ?'<div style="display:flex;flex-wrap:wrap;gap:.15rem;margin:.06rem 0 .28rem .28rem;padding:.22rem .3rem;border-left:2px solid rgba(255,60,60,.32);background:rgba(255,60,60,.04);border-radius:0 2px 2px 0">'
                  +j.banned_ips.map(function(ipObj){
                    var ip=typeof ipObj==='object'?ipObj.ip:ipObj;
                    var flag=_f2bFlag(typeof ipObj==='object'?ipObj.country:'-');
                    return `<span style="font-size:var(--fs-xs);padding:.05rem .22rem;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.2);border-radius:2px;color:rgba(255,120,120,.85);font-family:monospace;white-space:nowrap">${flag?flag+' ':''}${esc(ip)}</span>`;
                  }).join('')+'</div>':'';
              return `<div style="display:grid;grid-template-columns:1fr 4.8rem 4.8rem 3.8rem;gap:.08rem .35rem;align-items:start;padding:.25rem .15rem .25rem .3rem;border-radius:2px;background:${rowBg};${blStyle}"><div style="overflow:hidden"><div style="font-size:var(--fs-xs);color:${nameCol};font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${isOn?'700':'400'}">${esc(jname)}</div>${desc?`<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.03rem">${esc(desc)}</div>`:''}</div><div style="text-align:right;padding-top:.08rem"><span style="font-size:var(--fs-xs);font-weight:${isOn?'700':'400'};color:${bCol}">${j.cur_banned||0}</span><span style="font-size:var(--fs-xs);color:rgba(245,158,11,.32)">/${j.tot_banned||0}</span></div><div style="text-align:right;padding-top:.08rem"><span style="font-size:var(--fs-xs);font-weight:${j.cur_failed>0?'700':'400'};color:${fCol}">${j.cur_failed||0}</span><span style="font-size:var(--fs-xs);color:rgba(122,154,184,.22)">/${j.tot_failed||0}</span></div><div style="font-size:var(--fs-xs);color:rgba(122,154,184,.4);text-align:right;font-family:monospace;padding-top:.08rem">${bt}</div></div>${bannedIpsHtml}`;
            }).join('');
        })();
    return `<div style="background:rgba(0,0,0,0.2);border:1px solid ${borderOther};border-left:3px solid ${accentCol};border-radius:2px;padding:.55rem .65rem"><div style="display:flex;align-items:center;gap:.45rem;margin-bottom:.42rem;padding-bottom:.38rem;border-bottom:1px solid rgba(255,255,255,0.055)"><span style="font-size:var(--fs-sm);font-weight:700;color:${hdrCol};letter-spacing:1.5px">${host.label}</span>${statusBadge}<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.22);margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:11rem">${host.note}</span></div>${jailsBodyHtml}</div>`;
  }).join('');
  var h=`<div style="display:flex;align-items:center;gap:0;margin-bottom:.85rem;background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">${_f2bKpiHtml(totalBanned,'IPs bannies',banCol,false)}${_f2bKpiHtml(activeJails,'Jails actives',activeJails>0?'var(--red)':'rgba(122,154,184,.4)',false)}${prebanJails>0?_f2bKpiHtml(prebanJails,'Pré-ban ⚠','var(--amber)',true):''}${_f2bKpiHtml(totalFailed,'Échecs cumul',totalFailed>0?'var(--yellow)':'rgba(122,154,184,.4)',false)}<div style="padding:.55rem .8rem;text-align:right;flex-shrink:0"><div style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);line-height:1.6">${totalJails} jails · 4 hôtes</div><div style="font-size:var(--fs-xs);color:rgba(122,154,184,.2)">refresh 5 min</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">${hostsGridHtml}</div>`;


  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-wide');
  mc.style.height='auto';
  mc.style.maxHeight='90vh';
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">⊘</span>FAIL2BAN — ÉTAT DÉTAILLÉ · 4 HÔTES';
  var mb=document.getElementById('modal-body');
  mb.innerHTML=h;
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
}

// ── openCsModal helpers (module-level : NDT-54) ──────────────────────────
function _csFmtBytes(b){if(!b)return'0 B';var u=['B','KB','MB','GB'];var i=0;while(b>=1024&&i<3){b/=1024;i++;}return Math.round(b*10)/10+' '+u[i];}
function openCsModal(cs){
  if(!cs||_isOpen)return;
  var csD=cs.active_decisions||0, csA=cs.alerts_24h||0;
  var csStages=cs.stage_counts||{}, csSc=cs.scenarios||[], csIps=cs.top_ips||[];
  var csPsr=cs.parser_stats||{};
  var csBouncers=cs.bouncers||[], csBV=cs.ban_velocity||{}, csBStats=cs.bouncer_stats||{}, csAppsec=cs.appsec||{};
  var csTrend=cs.alerts_trend||{};
  var csCol=csD>0?'var(--red)':'var(--green)';
  var csGlow=csD>0?'0 0 12px rgba(255,60,60,.55)':'0 0 8px rgba(0,255,136,.4)';
  var STAGE_COL={'RECON':'var(--cyan)','SCAN':'var(--yellow)','EXPLOIT':'var(--orange)','BRUTE':'var(--red)'};
  var STAGE_ICO={'RECON':'◎','SCAN':'◈','EXPLOIT':'◉','BRUTE':'⊗'};
  var tDir=csTrend.dir||'stable', tPct=csTrend.pct||0;
  var tArrow=tDir==='up'?'↑':tDir==='down'?'↓':'→';
  var tCol=tDir==='up'?'var(--red)':tDir==='down'?'var(--green)':'rgba(122,154,184,.5)';

  var bouncersHtml=csBouncers.map(function(b){
    var isAppsec=b.name.indexOf('appsec')!==-1;
    var bOk=isAppsec?csAppsec.active:b.healthy;
    var bCol=bOk?'var(--green)':'var(--red)';
    var bShort=b.name.replace('crowdsec-firewall-bouncer-','').replace('crowdsec-','').replace('-bouncer','');
    var bLabel=isAppsec?(bOk?'WAF actif':'WAF inactif'):(b.age_sec!=null?(b.age_sec<60?b.age_sec+'s':Math.floor(b.age_sec/60)+'m ago'):'—');
    var bExtra=isAppsec&&bOk?`<span style="font-size:var(--fs-xs);color:var(--muted);margin-left:.3rem">${csAppsec.processed||0} req</span>`:'';
    return `<div style="display:flex;align-items:center;gap:.5rem;font-size:var(--fs-xs);padding:.12rem 0"><span style="color:${bCol};font-size:var(--fs-xs)">●</span><span style="color:var(--text);flex:1">${esc(bShort)}</span><span style="color:var(--muted);font-size:var(--fs-xs)">${bLabel}</span>${bExtra}</div>`;
  }).join('');
  var exploitAlertHtml=(function(){
    if(!((csStages.EXPLOIT||0)>0||(csStages.BRUTE||0)>0))return '';
    var _aS=(csStages.EXPLOIT||0)>0?'EXPLOIT':'BRUTE';
    var _aC=csStages[_aS];
    var _aCl=_aS==='EXPLOIT'?'#ff6b35':'var(--red)';
    var _aBg=_aS==='EXPLOIT'?'rgba(255,107,53,.12)':'rgba(255,59,92,.12)';
    var _aBd=_aS==='EXPLOIT'?'rgba(255,107,53,.4)':'rgba(255,59,92,.4)';
    return `<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .7rem;background:${_aBg};border:1px solid ${_aBd};border-radius:3px;margin-bottom:.8rem;animation:blink 1.5s ease-in-out infinite"><span style="color:${_aCl};font-size:var(--fs-md);font-weight:900">⚠</span><span style="font-size:var(--fs-xs);color:${_aCl};font-weight:700;letter-spacing:.6px;text-transform:uppercase">${_aS} ACTIF — ${_aC} scénario${_aC>1?'s':''} détecté${_aC>1?'s':''}</span></div>`;
  })();
  var killChainHtml=['RECON','SCAN','EXPLOIT','BRUTE'].map(function(s){
    var cnt=csStages[s]||0,col=cnt>0?STAGE_COL[s]:'rgba(122,154,184,.3)';
    return `<div style="flex:1;text-align:center;padding:.4rem .2rem;background:rgba(255,255,255,.03);border-radius:3px"><div style="font-size:var(--fs-xl);color:${col};font-weight:700">${STAGE_ICO[s]}<br>${cnt}</div><div style="font-size:var(--fs-xs);color:var(--muted);letter-spacing:.4px;text-transform:uppercase;margin-top:.15rem">${s}</div></div>`;
  }).join('');
  var scMax=csSc[0]?csSc[0].count||1:1;
  var scenariosHtml=csSc.length
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.4rem">Top scénarios détectés</div>'
      +csSc.slice(0,6).map(function(sc){
        var sc_col=STAGE_COL[sc.stage]||'var(--cyan)',pct=Math.round(sc.count*100/scMax);
        return `<div style="margin-bottom:.4rem"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.12rem"><span style="font-size:var(--fs-xs);color:var(--cyan);font-family:'Courier New',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:72%">${sc.name}</span><span style="display:flex;align-items:center;gap:.3rem"><span style="font-size:var(--fs-xs);color:${sc_col};font-weight:700;text-transform:uppercase;letter-spacing:.4px">${sc.stage}</span><span style="font-size:var(--fs-xs);color:var(--amber);font-weight:700;min-width:1.8rem;text-align:right">${sc.count}</span></span></div><div style="height:3px;background:rgba(255,255,255,.05);border-radius:2px"><div style="width:${pct}%;height:3px;background:${sc_col};border-radius:2px;opacity:.7"></div></div></div>`;
      }).join(''):'';
  var ipsBanniesHtml=csIps.length
    ?'<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:.7rem;margin-bottom:.4rem">IPs bannies actives</div>'
      +csIps.map(function(e){
        var st_col=STAGE_COL[e.stage]||'var(--orange)';
        var dur=e.duration?`<span style="color:rgba(122,154,184,.5);margin-left:.3rem">${e.duration}</span>`:'';
        var as_lbl=e.as_name?`<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.45);margin-left:.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:6rem" title="${esc(e.as_name)}">${esc(e.as_name.slice(0,20))}</span>`:'';
        var cc=e.country&&e.country!=='-'?`<span style="font-size:var(--fs-xs);color:var(--muted);margin:0 .25rem">[${esc(e.country)}]</span>`:'';
        return `<div style="display:flex;align-items:center;padding:.22rem 0;border-bottom:1px solid rgba(255,255,255,.04);gap:.2rem"><span style="font-size:var(--fs-xs);color:#ff6b35;font-family:'Courier New',monospace;min-width:8rem">${esc(e.ip)}</span>${cc}<span style="font-size:var(--fs-xs);color:${st_col};font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:rgba(255,255,255,.04);padding:.06rem .3rem;border-radius:2px">${esc(e.stage)}</span>${as_lbl}${dur}</div>`;
      }).join(''):'';
  var emptyStateHtml=(!csSc.length&&!csIps.length)
    ?`<div style="font-size:var(--fs-xs);color:var(--green);margin-top:.6rem;font-family:'Courier New',monospace">✓ Surveillance active — en attente de détections</div>`
      +(csPsr.lines_read?`<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.5);margin-top:.4rem">${fmt(csPsr.lines_read)} lignes analysées depuis démarrage</div>`:''):'';
  var kpiTrendHtml=csTrend.prev_24h!==undefined?`<div style="width:1px;height:1.5rem;background:rgba(255,255,255,.08)"></div><div style="display:flex;align-items:baseline;gap:.4rem"><span style="font-size:var(--fs-2xl);font-weight:700;color:${tCol}">${tArrow}${tPct>0?'+':''}${tPct}%</span><span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">vs J-1</span></div>`:'';
  var kpiBansHtml=csBV.last_1h!==undefined?`<div style="width:1px;height:1.5rem;background:rgba(255,255,255,.08)"></div><div style="display:flex;align-items:baseline;gap:.4rem"><span style="font-size:var(--fs-2xl);font-weight:700;color:${csBV.spike?'var(--red)':'var(--green)'}">${csBV.last_1h}</span><span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">BANS/H</span></div>`:'';
  var kpiBlockedHtml=csBStats.dropped_bytes?`<div style="width:1px;height:1.5rem;background:rgba(255,255,255,.08)"></div><div style="display:flex;align-items:baseline;gap:.4rem"><span style="font-size:var(--fs-xl);font-weight:700;color:var(--cyan)">${_csFmtBytes(csBStats.dropped_bytes)}</span><span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">BLOQUÉ</span></div>`:'';
  var h=`<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:.8rem">⊛ CrowdSec — Analyse comportementale détaillée</div><div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:1rem;padding:.6rem 1.2rem;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.07);border-radius:3px;flex-wrap:wrap"><div style="display:flex;align-items:baseline;gap:.4rem"><span style="font-size:var(--fs-3xl);font-weight:700;color:${csCol};text-shadow:${csGlow}">${csD}</span><span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">DÉCISIONS ACTIVES</span></div><div style="width:1px;height:1.5rem;background:rgba(255,255,255,.08)"></div><div style="display:flex;align-items:baseline;gap:.4rem"><span style="font-size:var(--fs-2xl);font-weight:700;color:var(--amber)">${csA}</span><span style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase">ALERTES 24H</span></div>${kpiTrendHtml}${kpiBansHtml}${kpiBlockedHtml}${csPsr.lines_read!==undefined?`<span style="font-size:var(--fs-xs);color:rgba(122,154,184,.3);margin-left:auto">${fmt(csPsr.lines_read)} lignes analysées</span>`:''}</div><div style="margin-bottom:.8rem;padding:.5rem .8rem;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.07);border-radius:3px"><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem">Bouncers</div>${bouncersHtml}</div>${exploitAlertHtml}<div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:.5rem">Kill Chain — scénarios 24h</div><div style="display:flex;gap:.5rem;margin-bottom:.9rem">${killChainHtml}</div>${scenariosHtml}${ipsBanniesHtml}${emptyStateHtml}<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.22);margin-top:.6rem;text-align:right;letter-spacing:.4px">Actualisé toutes les 5 min</div>`;
  var mc=document.getElementById('modal-card');
  mc.classList.add('modal-wide');
  mc.style.height='auto';
  mc.style.maxHeight='90vh';
  var _ht=document.getElementById('modal-header-title');
  if(_ht)_ht.innerHTML='<span style="margin-right:.45rem;opacity:.6">⊛</span>CROWDSEC — ANALYSE COMPORTEMENTALE';
  var mb=document.getElementById('modal-body');
  mb.innerHTML=h;
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
}

function closeModal(){
  if(!_isOpen)return;
  if(_mapAnimFrames['modal']){cancelAnimationFrame(_mapAnimFrames['modal']);delete _mapAnimFrames['modal'];}
  if(_fwAnimFrame){cancelAnimationFrame(_fwAnimFrame);_fwAnimFrame=null;}
  if(_fwFluxFrame){cancelAnimationFrame(_fwFluxFrame);_fwFluxFrame=null;}
  if(_kcAnimFrame){cancelAnimationFrame(_kcAnimFrame);_kcAnimFrame=null;}
  if(_kciAnimFrame){cancelAnimationFrame(_kciAnimFrame);_kciAnimFrame=null;}
  if(_protoAnim){cancelAnimationFrame(_protoAnim);_protoAnim=null;}
  _overlay.classList.add('closing');
  setTimeout(function(){
    _overlay.classList.remove('open','closing');
    var _mc=document.getElementById('modal-card');
    _mc.classList.remove('modal-wide','modal-proto','modal-xl','modal-win','modal-gpu','modal-router','modal-kci','modal-geomap','theme-red','theme-green','theme-cyan','theme-purple','theme-orange','theme-yellow');
    _mc.style.height='';_mc.style.maxHeight='';
    var _hdrReset=document.getElementById('modal-header-title');if(_hdrReset)_hdrReset.textContent='// DÉTAIL';
    _winModalOpen=false;
    _gpuModalOpen=false;
    _modalBody.innerHTML='';
    _isOpen=false;
    document.body.style.overflow='';
    // Relancer Kill Chain sur canvas principal si présent
    var kcMain=document.getElementById('ckc-canvas');
    if(kcMain&&window._lastData)animateKillChain(kcMain,window._lastData.kill_chain||{},window._lastData.fail2ban||{});
  },200);
}

_modalClose.addEventListener('click',function(e){e.stopPropagation();closeModal();});
_overlay.addEventListener('click',function(e){if(e.target===_overlay)closeModal();});

// ══════════════════════════════════════════════════════
// MODAL IP ENRICHI — GeoMap click
