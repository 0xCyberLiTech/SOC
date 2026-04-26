'use strict';
function openFirewallModal(d){
  if(!d||_isOpen)return;
  if(_fwAnimFrame){cancelAnimationFrame(_fwAnimFrame);_fwAnimFrame=null;}
  if(_fwFluxFrame){cancelAnimationFrame(_fwFluxFrame);_fwFluxFrame=null;}
  var fw=d.firewall_matrix||{};
  var hosts=fw.hosts||[];
  var hm={};hosts.forEach(function(h){hm[h.name]=h;});
  var scores=hosts.filter(function(h){return h.conformity!==undefined;}).map(function(h){return h.conformity;});
  var minS=scores.length?Math.min.apply(null,scores):100;
  var minSC=minS>=90?'var(--green)':minS>=70?'var(--yellow)':'var(--red)';
  var hcol={'srv-ngix':'var(--cyan)','site-01':'var(--green)','site-02':'var(--green)','proxmox':'var(--purple)'};

  var _g=new Date(d.generated_at||'');
  var _genTs=isNaN(_g.getTime())?'—':_fmtDateTs(_g); // NDT-149
  var hostCardsHtml=['srv-ngix','site-01','site-02','proxmox'].map(function(n){
    var hh=hm[n]||{name:n};
    var sc=hh.conformity!==undefined?hh.conformity:(hh.error?0:95);
    var scc=sc>=90?'var(--green)':sc>=70?'var(--yellow)':'var(--red)';
    var ua=hh.ufw_active;
    var bc=ua===false?'rgba(255,59,92,0.38)':ua===true?'rgba(0,255,136,0.2)':'rgba(191,95,255,0.2)';
    var ufwBadge=ua===true?'<span class="badge up" style="font-size:var(--fs-xs);padding:.04rem .28rem">UFW ●</span>':ua===false?'<span class="badge dn" style="font-size:var(--fs-xs);padding:.04rem .28rem">UFW ○</span>':'<span style="font-size:var(--fs-xs);color:var(--purple)">PVE-FW</span>';
    var bodyHtml=hh.error
      ?`<div style="color:var(--red);font-size:var(--fs-xs)">⚠ ${esc(hh.error)}</div>`
      :`<div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:.18rem"><div><div style="font-size:var(--fs-xl);font-weight:700;font-family:'Courier New',monospace;color:${scc};line-height:1;text-shadow:0 0 10px ${scc}">${sc}</div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.4px">SCORE</div></div>${ufwBadge}</div>`
        +(hh.ufw_rules?`<div style="font-size:var(--fs-xs);color:var(--muted)">${hh.ufw_rules} règles</div>`:'')
        +(hh.issues||[]).map(function(iss){return`<div style="font-size:var(--fs-xs);color:var(--red)">▸ ${esc(iss)}</div>`;}).join('');
    return `<div class="fw-hc" style="border-color:${bc}"><div style="font-size:var(--fs-xs);font-weight:700;font-family:'Courier New',monospace;color:${hcol[n]}">${n}</div><div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.35rem">${esc(hh.ip||'')}${hh.role?' · '+esc(hh.role):''}</div>${bodyHtml}</div>`;
  }).join('');
  var _known=[80,443,<SSH-PORT>,8080,8006,587,25,22,6060,6061,8089,7422,3128,85,514];
  var _anomPorts=[];
  (hosts||[]).forEach(function(hh){(hh.listening_ports||[]).forEach(function(p){if(_known.indexOf(p)<0){_anomPorts.push(esc(hh.host||hh.ip||'?')+':'+p);}});});
  var h=`<div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.9rem;padding-bottom:.7rem;padding-right:2.4rem;border-bottom:1px solid rgba(0,217,255,0.12)"><div style="font-size:var(--fs-xl);color:var(--green);text-shadow:0 0 12px var(--green)">▣</div><div style="flex:1"><div style="font-size:var(--fs-md);font-weight:700;color:var(--cyan);letter-spacing:2px;font-family:'Courier New',monospace">FIREWALL STATUS MATRIX</div><div style="font-size:var(--fs-xs);color:var(--muted);letter-spacing:.8px;margin-top:.12rem">ANALYSE INFRASTRUCTURE — ${_genTs}</div></div><div style="text-align:right;flex-shrink:0;white-space:nowrap"><div style="font-size:var(--fs-2xl);font-weight:700;font-family:'Courier New',monospace;color:${minSC};text-shadow:0 0 14px ${minSC};line-height:1">${minS}<span style="font-size:var(--fs-xs);color:var(--muted)">/100</span></div><div style="font-size:var(--fs-xs);color:var(--muted);text-transform:uppercase;letter-spacing:.4px">CONFORMITÉ MIN</div></div><div style="display:flex;flex-direction:column;gap:.3rem;flex-shrink:0"><button class="fw-snap-btn" data-fw-action="snap">📸 Snapshot</button><button class="fw-hist-btn" data-fw-action="hist">📋 Historique</button></div></div><div class="fw-hg">${hostCardsHtml}</div><div class="fw-tabs"><div class="fw-tab active" data-tab="topo">◈ Topologie</div><div class="fw-tab" data-tab="matrix">▦ Matrice Ports</div><div class="fw-tab" data-tab="rules">≡ Firewalls &amp; Défense</div><div class="fw-tab" data-tab="flux">⟿ Flux Firewall</div></div><div id="fw-tab-topo"><canvas id="fw-topo-c" height="220" style="width:100%;display:block;border:1px solid rgba(0,217,255,0.2);border-radius:2px;margin-bottom:.6rem"></canvas>${buildFwDefenseChain(d)}</div><div id="fw-tab-matrix" class="fw-panel-hidden">${buildFwMatrix(hosts)}</div><div id="fw-tab-rules" class="fw-panel-hidden">${buildFwRules(hosts)}</div><div id="fw-tab-flux" class="fw-panel-hidden"><canvas id="fw-flux-c" height="1380" style="width:100%;display:block;border:1px solid rgba(0,217,255,0.2);border-radius:2px"></canvas></div><div style="display:flex;flex-wrap:wrap;gap:.7rem;font-size:var(--fs-xs);margin-top:.75rem;padding-top:.55rem;border-top:1px solid rgba(0,217,255,0.08)"><span class="fw-cp">● PUB — Internet</span><span class="fw-cl">◉ LAN — Réseau local</span><span class="fw-co">► OUT — Sortant seulement</span><span class="fw-cn">— N/A</span>${_anomPorts.length?`<span class="fw-ca">⚠ ANOMALIE — port(s) inconnu(s) : ${_anomPorts.join(', ')}</span>`:''}</div>`;

  // Open modal
  document.getElementById('modal-card').classList.add('modal-wide','theme-cyan');
  var _fwHt=document.getElementById('modal-header-title');
  if(_fwHt)_fwHt.innerHTML='<span style="margin-right:.45rem;opacity:.6">■</span>FIREWALL — MATRICE RÉSEAU';
  var _fwMb=document.getElementById('modal-body');
  _fwMb.innerHTML=h;
  _fwMb.querySelectorAll('.fw-tabs:not(#tr-tabs) .fw-tab').forEach(function(el){
    el.addEventListener('click',function(){fwTab(this,this.getAttribute('data-tab'));});
  });
  _fwMb.querySelectorAll('[data-fw-action]').forEach(function(btn){
    btn.addEventListener('click',function(){
      if(this.dataset.fwAction==='snap'){if(window._fwSnapshotNow)window._fwSnapshotNow();}
      else if(this.dataset.fwAction==='hist'){if(window._fwOpenSnapHist)window._fwOpenSnapHist();}
    });
  });
  _overlay.classList.add('open');
  _isOpen=true;
  document.body.style.overflow='hidden';
  requestAnimationFrame(function(){requestAnimationFrame(function(){drawFwTopo(d);});});
}

