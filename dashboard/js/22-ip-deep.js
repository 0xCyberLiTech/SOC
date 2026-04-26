'use strict';
// ══════════════════════════════════════════════════════════════════════
//  22-ip-deep.js — INVESTIGATION IP APPROFONDIE
//  Modal : GeoIP · ASN/WHOIS · CrowdSec · Fail2ban · rsyslog
//  Fenêtre temporelle : 7 jours (alignée sur toutes les rétentions SOC)
//  Dépendances : 01-utils (JV_URL, esc, _isOpen, _overlay, _modalBody)
//                18-jarvis-engine (_socRetryFetch) — optionnel
// ══════════════════════════════════════════════════════════════════════

(function(){
  var s = document.createElement('style');
  s.textContent = '@keyframes ip-deep-scan{0%,100%{color:var(--yellow);box-shadow:0 0 0 1px rgba(255,200,0,.6)}50%{color:rgba(255,200,0,.4);box-shadow:0 0 0 1px rgba(255,200,0,.15)}}'
    + '@keyframes ip-deep-flow{from{stroke-dashoffset:42}to{stroke-dashoffset:0}}'
    + '.ip-deep-attack-line{animation:ip-deep-flow 1.4s linear infinite}'
    + '.leaflet-tooltip.ip-deep-tip{background:rgba(4,12,24,.88);border:1px solid rgba(0,217,255,.2);color:#00d9ff;font-family:"Courier New",monospace;font-size:var(--fs-xs);border-radius:2px;padding:2px 7px;box-shadow:none;white-space:nowrap}'
    + '.leaflet-tooltip.ip-deep-tip-red{background:rgba(24,4,8,.88);border:1px solid rgba(255,59,92,.3);color:#ff3b5c;font-family:"Courier New",monospace;font-size:var(--fs-xs);border-radius:2px;padding:2px 7px;box-shadow:none;white-space:nowrap}'
    + '.leaflet-tooltip.ip-deep-tip::before,.leaflet-tooltip.ip-deep-tip-red::before{display:none}'
    + '.idsc-tag{display:inline-block;padding:.08rem .35rem;border-radius:2px;font-size:calc(var(--fs-xs) - 1px);font-family:"Courier New",monospace;margin:.1rem .15rem .1rem 0;vertical-align:middle}'
    + '.idsc-tag.cve{background:rgba(255,59,92,.1);color:#ff3b5c;border:1px solid rgba(255,59,92,.3)}'
    + '.idsc-tag.bf{background:rgba(255,107,43,.1);color:#ff6b2b;border:1px solid rgba(255,107,43,.3)}'
    + '.idsc-tag.scan{background:rgba(255,200,0,.08);color:#ffc800;border:1px solid rgba(255,200,0,.25)}'
    + '.idsc-tag.cs{background:rgba(0,217,255,.07);color:rgba(0,217,255,.8);border:1px solid rgba(0,217,255,.2)}'
    + '.idsc-tag.ok{background:rgba(0,255,136,.07);color:var(--green);border:1px solid rgba(0,255,136,.2)}'
    + '.idw-asn{background:rgba(0,217,255,.04);border:1px solid rgba(0,217,255,.12);border-radius:3px;padding:.45rem .6rem;margin-bottom:.35rem}'
    + '.idw-row{display:flex;gap:.5rem;padding:.08rem 0;border-bottom:1px solid rgba(255,255,255,.03)}'
    + '.idw-row:last-child{border-bottom:none}'
    + '.idw-lbl{font-size:var(--fs-xs);color:rgba(122,154,184,.55);white-space:nowrap;min-width:6.5rem}'
    + '.idw-val{font-size:var(--fs-xs);color:rgba(185,215,240,.85);word-break:break-word}';
  document.head.appendChild(s);
})();

// ── État persistant ───────────────────────────────────────────────────
var _ipDeepLastResult = null;
var _ipDeepLoading    = false;
var _ipDeepMap        = null;

// ── Helpers ───────────────────────────────────────────────────────────
function _ipDeepIsValidIp(s) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every(function(o){return parseInt(o,10)<=255;});
}
function _ipDeepFmtTs(ts) {
  if (!ts) return '—';
  try {
    var d = new Date(ts);
    return d.toISOString().slice(0,10) + ' ' + d.toISOString().slice(11,16) + ' UTC';
  } catch(e) { return esc(ts); }
}
function _ipDeepFmtUnix(epoch) {
  if (!epoch) return '—';
  var d = new Date(epoch * 1000);
  return d.toISOString().slice(0,10) + ' ' + d.toISOString().slice(11,16);
}

// ── Décodeur scénarios CrowdSec → libellés humains ───────────────────
function _ipDeepScenarioDesc(s) {
  if (!s) return {lbl: '—', cls: 'cs'};
  var sl = s.toLowerCase();
  var _map = [
    [/cve-2021-41773/,     'CVE-2021-41773 — Path Traversal Apache',     'cve'],
    [/cve-2021-42013/,     'CVE-2021-42013 — RCE Apache',                'cve'],
    [/cve-2022-26134/,     'CVE-2022-26134 — RCE Confluence',            'cve'],
    [/cve-2023-44978/,     'CVE-2023-44978 — Exploit nginx',             'cve'],
    [/cve-2017-5638/,      'CVE-2017-5638 — RCE Struts',                 'cve'],
    [/cve-\d{4}-\d+/,      null,                                          'cve'],
    [/fail2ban.*cve/,      'Fail2ban — Exploitation CVE',                'cve'],
    [/nginx.*cve|cve.*nginx/, 'CVE nginx détectée',                      'cve'],
    [/ssh.?(bf|brute|force)/, 'Brute force SSH',                         'bf'],
    [/http.?(bf|brute|force)/, 'Brute force HTTP',                       'bf'],
    [/ftp.?(bf|brute)/,    'Brute force FTP',                            'bf'],
    [/rdp.?(bf|brute)/,    'Brute force RDP',                            'bf'],
    [/credential|stuffing/, 'Credential stuffing',                       'bf'],
    [/backdoor|webshell/,  'Tentative backdoor / webshell',              'cve'],
    [/injection|sqli/,     'Tentative injection SQL',                    'cve'],
    [/xss|cross.site/,     'Tentative XSS',                              'cve'],
    [/path.trav|lfi|rfi/,  'Path traversal / inclusion',                 'cve'],
    [/sensitive|passwd|shadow|etc\//, 'Accès fichiers sensibles',        'cve'],
    [/probing|probe/,      'Sondage actif',                              'scan'],
    [/scan|port.scan/,     'Scan de ports / services',                   'scan'],
    [/crawl|spider/,       'Crawler agressif',                           'scan'],
    [/enumerat/,           'Énumération',                                'scan'],
    [/major.severity/,     'Alerte haute sévérité (agrégat)',            'cve'],
    [/crowdsecurity.custom.*sur|suricata/, 'Règle Suricata personnalisée', 'cs'],
    [/dos|flood|ddos/,     'Déni de service',                            'cve'],
    [/tor.exit/,           'Nœud Tor exit',                              'scan'],
    [/vpn|proxy/,          'VPN / proxy détecté',                        'scan'],
    [/honeypot/,           'Honeypot déclenché',                         'scan'],
    [/fail2ban/,           'Action Fail2ban',                            'cs'],
  ];
  for (var i = 0; i < _map.length; i++) {
    if (_map[i][0].test(sl)) {
      var lbl = _map[i][1];
      if (!lbl) {
        // Extraire le numéro CVE
        var m = sl.match(/(cve-\d{4}-\d+)/i);
        lbl = m ? m[1].toUpperCase() + ' — Exploitation' : s;
      }
      return {lbl: lbl, cls: _map[i][2]};
    }
  }
  return {lbl: s, cls: 'cs'};
}

// ── Contexte de menace (une ligne de synthèse) ────────────────────────
function _ipDeepThreatContext(cs, f2b, abn) {
  var tags = [];
  var scenarios = [];
  if (cs.decisions && cs.decisions.length) {
    cs.decisions.forEach(function(d){ if(d.scenario) scenarios.push(d.scenario); });
  }
  if (cs.alerts_detail && cs.alerts_detail.length) {
    cs.alerts_detail.forEach(function(a){ if(a.scenario && scenarios.indexOf(a.scenario)<0) scenarios.push(a.scenario); });
  }
  var hasCve   = scenarios.some(function(s){ return /cve/i.test(s) || /backdoor|webshell|injection|path.trav/i.test(s); });
  var hasBrute = scenarios.some(function(s){ return /bf|brute|force|credential/i.test(s); });
  var hasScan  = scenarios.some(function(s){ return /scan|probe|crawl|enumerat/i.test(s); });
  var hasSur   = scenarios.some(function(s){ return /suricata|sur|major.severity/i.test(s); });
  if (hasCve)   tags.push('<span class="idsc-tag cve">⚠ EXPLOIT / CVE</span>');
  if (hasBrute) tags.push('<span class="idsc-tag bf">⊛ BRUTE FORCE</span>');
  if (hasScan)  tags.push('<span class="idsc-tag scan">◎ SCAN</span>');
  if (hasSur)   tags.push('<span class="idsc-tag cve">⊹ IDS SURICATA</span>');
  if (cs.banned) tags.push('<span class="idsc-tag cs">⊘ CS BAN ACTIF</span>');
  else if (f2b.banned) tags.push('<span class="idsc-tag cs">⊘ F2B BAN ACTIF</span>');
  if (abn && abn.count > 0) tags.push('<span class="idsc-tag bf">↺ '+abn.count+' RÉCIDIVE'+(abn.count>1?'S':'')+'</span>');
  return tags.join('');
}

// ── Parser WHOIS → données structurées ───────────────────────────────
function _ipDeepParseWhois(lines) {
  var fields = {};
  var _keys = ['org-name','orgname','owner','netname','descr','country','route','cidr','org-type','abuse-mailbox','aut-num','as-name'];
  (lines||[]).forEach(function(l){
    var m = l.match(/^([^:]+):\s*(.+)$/);
    if (!m) return;
    var k = m[1].toLowerCase().trim();
    var v = m[2].trim();
    if (_keys.indexOf(k) >= 0 && !fields[k]) fields[k] = v;
  });
  // Normalise org
  if (!fields['org-name'] && fields['orgname']) fields['org-name'] = fields['orgname'];
  if (!fields['org-name'] && fields['owner'])   fields['org-name'] = fields['owner'];
  return fields;
}

// ── Fetch (POST anti-CSRF) ────────────────────────────────────────────
function _ipDeepFetch(ip, onResult) {
  _ipDeepLoading = true;
  fetch(JV_URL + '/api/soc/ip-deep', {
    method: 'POST', mode: 'cors',
    headers: {'Content-Type': 'application/json'},
    body:   JSON.stringify({ip: ip}),
    signal: AbortSignal.timeout(55000),
  })
  .then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
  .then(function(data){ _ipDeepLoading = false; _ipDeepLastResult = data; onResult(null, data); })
  .catch(function(e){ _ipDeepLoading = false; onResult(e, null); });
}

// ── Résumé compact (tile) ─────────────────────────────────────────────
function _ipDeepSummaryHtml(r) {
  if (!r || r.error) return '<div style="color:var(--red);font-size:var(--fs-xs)">'+(r&&r.error?esc(r.error):'Erreur inconnue')+'</div>';
  var cs  = r.crowdsec || {};
  var f2b = r.fail2ban || {};
  var geo = r.geoip    || {};
  var abn = r.autoban  || {};
  var banned = cs.banned || f2b.banned;
  var banLbl = cs.banned ? 'CS BAN' : (f2b.banned ? 'F2B BAN' : '');
  var geoStr = geo.country ? esc(geo.country) + (geo.city?' · '+esc(geo.city):'') : '—';
  return '<div style="font-family:\'Courier New\',monospace;font-size:var(--fs-sm);font-weight:700;color:var(--cyan);letter-spacing:.5px;margin-bottom:.4rem">'+esc(r.ip||'')+'</div>'
    + '<div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.5rem">'
    + '<div style="flex:1;min-width:10rem">'
    +   '<div style="font-size:var(--fs-xs);color:var(--muted)">GeoIP</div>'
    +   '<div style="font-size:var(--fs-xs);color:var(--text)">'+geoStr+'</div>'
    + '</div>'
    + '<div style="flex:0 0 auto;text-align:right">'
    +   (banned ? '<div style="color:var(--red);font-weight:700;font-size:var(--fs-xs);letter-spacing:.5px">⊘ '+banLbl+'</div>'
               : '<div style="color:var(--green);font-size:var(--fs-xs)">✓ Non banni</div>')
    +   (abn.count>0 ? '<div style="font-size:var(--fs-xs);color:var(--orange)">⊛ '+abn.count+' récidive'+(abn.count>1?'s':'')+'</div>' : '')
    + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem">'
    + _ipDeepStatBadge('nginx',     r.nginx_hits||0,          'hits nginx')
    + _ipDeepStatBadge('rsyslog',   (r.rsyslog||{}).total||0, 'entrées logs')
    + _ipDeepStatBadge('CS alertes',cs.alerts_30d||0,         'alertes 7j')
    + _ipDeepStatBadge('F2B hist.', f2b.total_records||0,     'bans F2B')
    + '</div>';
}
function _ipDeepStatBadge(lbl, val, sublbl) {
  var c = val > 0 ? 'var(--cyan)' : 'var(--muted)';
  return '<div class="stat-box" style="text-align:center;min-width:4rem">'
    + '<div class="sval" style="color:'+c+';font-size:var(--fs-sm)">'+val+'</div>'
    + '<div class="slbl">'+esc(lbl)+'</div>'
    + '</div>';
}

// ── Ouverture modal ───────────────────────────────────────────────────
function openIpDeepModal(ip) {
  if (_isOpen) return;
  if (!ip && _ipDeepLastResult) ip = _ipDeepLastResult.ip;
  if (!ip) return;
  if (_ipDeepMap) { _ipDeepMap.remove(); _ipDeepMap = null; }

  var mc  = document.getElementById('modal-card');
  mc.className = 'modal-card modal-win theme-cyan';
  var _ht = document.getElementById('modal-header-title');
  if (_ht) _ht.innerHTML = '<span style="opacity:.5;margin-right:.4rem">⊛</span>INVESTIGATION IP — '+esc(ip);

  _overlay.classList.add('open');
  _isOpen = true;
  document.body.style.overflow = 'hidden';

  if (_ipDeepLastResult && _ipDeepLastResult.ip === ip) {
    _modalBody.innerHTML = _ipDeepModalBody(_ipDeepLastResult);
    _ipDeepBindActions(_ipDeepLastResult);
    setTimeout(function(){ _ipDeepInitMap(_ipDeepLastResult.geoip||{}, _ipDeepLastResult.ip||''); }, 60);
    return;
  }

  _modalBody.innerHTML = '<div style="text-align:center;padding:2.8rem 1rem 2rem;font-family:\'Courier New\',monospace">'
    +'<div style="font-size:var(--fs-4xl);color:var(--cyan);display:inline-block;margin-bottom:.8rem;animation:jarvisThink 2s linear infinite;text-shadow:0 0 18px rgba(0,217,255,.55)">⊛</div>'
    +'<div style="color:var(--cyan);font-size:var(--fs-xs);letter-spacing:1.4px;margin-bottom:.5rem">INVESTIGATION EN COURS <span style="opacity:.45">—</span> <span id="ip-deep-timer" style="font-weight:700">0</span>s</div>'
    +'<div style="position:relative;height:2px;background:rgba(0,217,255,.08);border-radius:1px;margin:.35rem auto .75rem;width:72%;overflow:hidden">'
    +'<div style="position:absolute;top:0;left:0;height:100%;width:38%;background:linear-gradient(90deg,transparent,var(--cyan),transparent);animation:geoScanBar 1.4s ease-in-out infinite"></div>'
    +'</div>'
    +'<div id="ip-deep-sources" style="font-size:calc(var(--fs-xs) - 1px);line-height:1.9;letter-spacing:.4px"></div>'
    +'<div style="color:rgba(122,154,184,.2);font-size:calc(var(--fs-xs) - 2px);margin-top:.6rem;letter-spacing:.6px">fenêtre 7 jours</div>'
    +'</div>';

  var _t0  = Date.now();
  var _tmr = setInterval(function(){
    var el = document.getElementById('ip-deep-timer');
    if (el) el.textContent = Math.round((Date.now()-_t0)/1000);
  }, 1000);
  var _srcs = ['GeoIP','CrowdSec CTI','Fail2ban','WHOIS / ASN','rsyslog'];
  var _si   = 0;
  var _stmr = setInterval(function(){
    var el = document.getElementById('ip-deep-sources');
    if (!el) return;
    _si = (_si+1) % _srcs.length;
    el.innerHTML = _srcs.map(function(s,i){
      return i===_si
        ? '<span style="color:var(--cyan);font-weight:700;text-shadow:0 0 9px rgba(0,217,255,.6)">▸ '+s+'</span>'
        : '<span style="color:rgba(122,154,184,.25)">'+s+'</span>';
    }).join('<span style="color:rgba(122,154,184,.12)"> · </span>');
  }, 700);

  _ipDeepFetch(ip, function(err, r) {
    clearInterval(_tmr); clearInterval(_stmr);
    if (err || !r) {
      var offline = err instanceof TypeError;
      _modalBody.innerHTML = offline
        ? '<div style="color:var(--yellow);padding:1.2rem 1rem;font-family:\'Courier New\',monospace">'
          +'<div style="font-size:var(--fs-sm);font-weight:700;letter-spacing:.5px;margin-bottom:.4rem">⚠ JARVIS hors ligne</div>'
          +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.7)">L\'investigation approfondie nécessite JARVIS actif.<br>Démarrer JARVIS puis relancer l\'analyse.</div></div>'
        : '<div style="color:var(--red);padding:1rem;font-family:\'Courier New\',monospace;font-size:var(--fs-xs)">Erreur — '+(err?esc(String(err)):'Réponse invalide')+'</div>';
      return;
    }
    _modalBody.innerHTML = _ipDeepModalBody(r);
    _ipDeepBindActions(r);
    setTimeout(function(){ _ipDeepInitMap(r.geoip||{}, r.ip||''); }, 60);
  });
}

// ── Verdict ───────────────────────────────────────────────────────────
function _ipDeepVerdict(isBanned, alerts7d, recidives) {
  if (isBanned && recidives > 0)     return {lbl:'CRITIQUE', col:'#ff3b5c', bg:'rgba(255,59,92,.12)'};
  if (isBanned)                      return {lbl:'ÉLEVÉ',    col:'#ff6b2b', bg:'rgba(255,107,43,.10)'};
  if (recidives > 0 || alerts7d > 5) return {lbl:'ÉLEVÉ',    col:'#ff6b2b', bg:'rgba(255,107,43,.10)'};
  if (alerts7d > 0)                  return {lbl:'MODÉRÉ',   col:'#ffc800', bg:'rgba(255,200,0,.08)'};
  return {lbl:'NEUTRE', col:'#00ff88', bg:'rgba(0,255,136,.06)'};
}

// ── Corps du modal ────────────────────────────────────────────────────
function _ipDeepModalBody(r) {
  var ip  = r.ip  || '?';
  var cs  = r.crowdsec || {};
  var f2b = r.fail2ban || {};
  var geo = r.geoip    || {};
  var abn = r.autoban  || {};
  var isBanned = cs.banned || f2b.banned;
  var verdict  = _ipDeepVerdict(isBanned, cs.alerts_30d||0, abn.count||0);
  var ctxTags  = _ipDeepThreatContext(cs, f2b, abn);
  var whoisParsed = _ipDeepParseWhois(r.whois||[]);

  // ── BANDEAU VERDICT ──
  var verdictH = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:.7rem;padding:.45rem .7rem;background:'+verdict.bg+';border:1px solid '+verdict.col+'44;border-radius:3px;margin-bottom:.5rem">'
    + '<span style="font-family:\'Courier New\',monospace;font-weight:700;font-size:var(--fs-sm);color:'+verdict.col+';letter-spacing:1px;white-space:nowrap">⊛ '+verdict.lbl+'</span>'
    + '<span style="font-size:var(--fs-xl);color:var(--cyan);font-family:\'Courier New\',monospace;font-weight:700">'+esc(ip)+'</span>'
    + (geo.iso ? '<span style="font-size:var(--fs-xs);color:var(--muted)">'+esc(geo.iso)+'</span>' : '')
    + (geo.country ? '<span style="font-size:var(--fs-xs);color:rgba(185,215,240,.6)">'+esc(geo.country)+(geo.city?' · '+esc(geo.city):'')+'</span>' : '')
    + (isBanned
      ? '<span style="background:rgba(255,59,92,.15);color:var(--red);border:1px solid rgba(255,59,92,.4);border-radius:3px;padding:.1rem .45rem;font-size:var(--fs-xs);font-weight:700">⊘ BANNI</span>'
      : '<span style="background:rgba(0,255,136,.06);color:var(--green);border:1px solid rgba(0,255,136,.2);border-radius:3px;padding:.1rem .45rem;font-size:var(--fs-xs)">✓ Non banni</span>')
    + (r.is_lan ? '<span style="background:rgba(0,217,255,.08);color:var(--cyan);border:1px solid rgba(0,217,255,.2);border-radius:3px;padding:.1rem .45rem;font-size:var(--fs-xs)">LAN</span>' : '')
    + '<span class="win-modal-ts" style="margin-left:auto">7j · '+esc(r.ts||'—')+'</span>'
    + '</div>'
    + (ctxTags ? '<div style="margin-bottom:.55rem;padding:.2rem .1rem">'+ctxTags+'</div>' : '');

  // ── STAT BOXES ──
  var _sb = 'flex:1;min-width:0;text-align:center';
  var statsH = '<div style="display:flex;gap:.4rem;margin-bottom:.8rem">'
    + '<div class="stat-box" style="'+_sb+'"><div class="sval" style="color:'+(cs.alerts_30d>0?'var(--red)':'var(--green)')+'">'+(cs.alerts_30d||0)+'</div><div class="slbl">Alertes CS 7j</div></div>'
    + '<div class="stat-box" style="'+_sb+'"><div class="sval" style="color:'+(f2b.total_records>0?'var(--yellow)':'var(--green)')+'">'+(f2b.total_records||0)+'</div><div class="slbl">Bans F2B total</div></div>'
    + '<div class="stat-box" style="'+_sb+'"><div class="sval" style="color:'+(abn.count>0?'var(--orange)':'var(--green)')+'">'+(abn.count||0)+'</div><div class="slbl">Récidives SOC</div></div>'
    + '<div class="stat-box" style="'+_sb+'"><div class="sval" style="color:'+(r.nginx_hits>0?'var(--cyan)':'var(--muted)')+'">'+(r.nginx_hits||0)+'</div><div class="slbl">Hits nginx</div></div>'
    + '<div class="stat-box" style="'+_sb+'"><div class="sval" style="color:'+((r.rsyslog||{}).total>0?'var(--cyan)':'var(--muted)')+'">'+((r.rsyslog||{}).total||0)+'</div><div class="slbl">Entrées logs</div></div>'
    + '</div>';

  // ── COLONNES ──
  var colL = _ipDeepColGeo(geo)
    + _ipDeepColAsn(whoisParsed, r.whois||[], ip);

  var colR = _ipDeepColCrowdSec(cs)
    + _ipDeepColFail2ban(f2b, cs)
    + _ipDeepColAutoban(abn)
    + _ipDeepColRsyslog(r.rsyslog||{})
    + _ipDeepColNginxLast(r.nginx_last||[], r.nginx_hits||0, cs.alerts_30d||0);

  // ── ACTIONS ──
  var actH = '<div class="win-section" style="margin-top:.6rem">'
    + '<div class="win-section-hdr"><span style="color:var(--red)">▸</span> ACTIONS DÉFENSIVES</div>'
    + '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">'
    +   '<button class="ip-deep-ban-btn" data-ip="'+esc(ip)+'" data-dur="24h"   style="'+_ipDeepBtnStyle('var(--orange)')+'" title="Ban 24h via CrowdSec">⊘ Ban 24h</button>'
    +   '<button class="ip-deep-ban-btn" data-ip="'+esc(ip)+'" data-dur="168h"  style="'+_ipDeepBtnStyle('var(--yellow)')+'" title="Ban 7 jours">⊘ Ban 7j</button>'
    +   '<button class="ip-deep-ban-btn" data-ip="'+esc(ip)+'" data-dur="8760h" style="'+_ipDeepBtnStyle('var(--red)')+'"    title="Ban permanent (1 an)">⊘ Ban PERM</button>'
    +   '<button class="ip-deep-unban-btn" data-ip="'+esc(ip)+'" style="'+_ipDeepBtnStyle('var(--green)')+'" title="Lever le ban CrowdSec">✓ Unban</button>'
    +   '<span id="ip-deep-action-result" style="font-size:var(--fs-xs);color:var(--cyan);margin-left:.5rem"></span>'
    + '</div>'
    + '</div>';

  // ── CARTE ──
  var mapH = (geo.lat && geo.lon)
    ? '<div class="win-section" style="margin-bottom:.6rem">'
      +'<div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> TRAJET ATTAQUE — ORIGINE GÉOGRAPHIQUE</div>'
      +'<div id="ip-deep-map" style="height:200px;border-radius:3px;overflow:hidden;border:1px solid rgba(0,217,255,.1)"></div>'
      +'<div style="display:flex;gap:1.2rem;margin-top:.3rem;font-size:var(--fs-xs)">'
      +  '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00ff88;margin-right:.3rem"></span>Serveur (France · srv-ngix)</span>'
      +  '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b5c;margin-right:.3rem"></span>'
      +  esc((geo.country||'Attaquant')+(geo.city?' · '+geo.city:''))+' · '+Math.abs(geo.lat).toFixed(3)+'°'+(geo.lat>=0?'N':'S')+' '+Math.abs(geo.lon).toFixed(3)+'°'+(geo.lon>=0?'E':'W')+'</span>'
      +'</div>'
      +'</div>'
    : '';

  return verdictH + statsH + mapH
    + '<div class="win-modal-grid" style="align-items:start">'
    +   '<div>'+colL+'</div>'
    +   '<div>'+colR+'</div>'
    + '</div>'
    + actH;
}

// ── Carte Leaflet ─────────────────────────────────────────────────────
function _ipDeepInitMap(geo, ip) {
  if (!geo || !geo.lat || !geo.lon) return;
  if (typeof _loadLeaflet !== 'function') return;
  _loadLeaflet(function() {
    if (_ipDeepMap) { _ipDeepMap.remove(); _ipDeepMap = null; }
    var container = document.getElementById('ip-deep-map');
    if (!container) return;
    var srvLat = 48.85, srvLon = 2.35;
    var atkLat = geo.lat, atkLon = geo.lon;
    _ipDeepMap = L.map(container, {zoomControl:false, attributionControl:false, scrollWheelZoom:false});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {maxZoom:14}).addTo(_ipDeepMap);
    _ipDeepMap.fitBounds(L.latLngBounds([[srvLat,srvLon],[atkLat,atkLon]]), {padding:[40,40]});
    var dLon = (srvLon-atkLon)*Math.PI/180;
    var rl1  = atkLat*Math.PI/180, rl2 = srvLat*Math.PI/180;
    var bearing = (Math.atan2(Math.sin(dLon)*Math.cos(rl2), Math.cos(rl1)*Math.sin(rl2)-Math.sin(rl1)*Math.cos(rl2)*Math.cos(dLon))*180/Math.PI+360)%360;
    L.polyline([[atkLat,atkLon],[srvLat,srvLon]], {color:'#ff3b5c',weight:2,opacity:.75,dashArray:'8,7',className:'ip-deep-attack-line'}).addTo(_ipDeepMap);
    L.marker([srvLat,srvLon], {icon:L.divIcon({html:'<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:11px solid #ff3b5c;transform:rotate('+bearing+'deg);transform-origin:50% 75%;opacity:.9"></div>',className:'',iconSize:[10,11],iconAnchor:[5,8]}),interactive:false}).addTo(_ipDeepMap);
    L.circleMarker([srvLat,srvLon], {radius:7,color:'#00ff88',fillColor:'#00ff88',fillOpacity:.9,weight:2}).addTo(_ipDeepMap).bindTooltip('⊕ Serveur · France',{permanent:true,direction:'top',className:'ip-deep-tip'});
    L.circleMarker([atkLat,atkLon], {radius:9,color:'#ff3b5c',fillColor:'#ff3b5c',fillOpacity:.9,weight:2}).addTo(_ipDeepMap).bindTooltip('⊘ '+esc(ip||'?')+' · '+esc(geo.country||'?'),{permanent:true,direction:'bottom',className:'ip-deep-tip-red'});
    setTimeout(function(){ if(_ipDeepMap) _ipDeepMap.invalidateSize(); }, 100);
  });
}

function _ipDeepBtnStyle(col) {
  return 'background:rgba(0,0,0,.3);border:1px solid '+col+';color:'+col
    +';padding:.3rem .8rem;border-radius:3px;cursor:pointer;font-family:"Courier New",monospace;font-size:var(--fs-xs);font-weight:700;letter-spacing:.5px;transition:background .15s';
}

// ── Section GÉOLOCALISATION ───────────────────────────────────────────
function _ipDeepColGeo(geo) {
  var country = geo.country || '';
  var city    = geo.city    || '';
  if (!country && !(geo.lat && geo.lon)) return '';
  var _hasCoords = typeof geo.lat==='number' && typeof geo.lon==='number';
  var coordStr = _hasCoords
    ? Math.abs(geo.lat).toFixed(4)+'° '+(geo.lat>=0?'N':'S')+' · '+Math.abs(geo.lon).toFixed(4)+'° '+(geo.lon>=0?'E':'W')
    : null;
  var mapUrl = _hasCoords
    ? 'https://www.openstreetmap.org/?mlat='+geo.lat.toFixed(6)+'&mlon='+geo.lon.toFixed(6)+'&zoom=10'
    : '';
  var rows = [
    country   ? ['Pays',   esc(country)+(geo.iso?' <span style="opacity:.5">('+esc(geo.iso)+')</span>':'')] : null,
    city      ? ['Ville',  esc(city)] : null,
    (!city && coordStr) ? ['Zone', '<span style="color:rgba(122,154,184,.55);font-style:italic">Non disponible dans GeoLite2</span>'] : null,
    coordStr  ? ['Coords', (mapUrl ? '<a href="'+mapUrl+'" target="_blank" rel="noopener" style="color:rgba(0,217,255,.6);text-decoration:none">'+esc(coordStr)+' ⊕</a>' : esc(coordStr))] : null,
  ].filter(Boolean);
  return '<div class="win-section"><div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> GÉOLOCALISATION</div>'
    + '<table style="width:100%;border-collapse:collapse">'
    + rows.map(function(r){ return '<tr>'
        +'<td style="font-size:var(--fs-xs);color:var(--muted);padding:.12rem .5rem .12rem 0;white-space:nowrap;vertical-align:top;width:4.5rem">'+r[0]+'</td>'
        +'<td style="font-size:var(--fs-xs);color:var(--text)">'+r[1]+'</td></tr>'; }).join('')
    + '</table></div>';
}

// ── Section ASN / RÉSEAU (parsé depuis WHOIS) ─────────────────────────
function _ipDeepColAsn(parsed, rawLines, ip) {
  var hasData = parsed['org-name'] || parsed['netname'] || parsed['route'] || parsed['cidr'] || parsed['aut-num'];
  var hasRaw  = rawLines && rawLines.length > 0;

  var _labelMap = {
    'org-name':      'Organisation',
    'netname':       'Réseau',
    'descr':         'Description',
    'as-name':       'AS Name',
    'aut-num':       'AS Number',
    'route':         'Route annoncée',
    'cidr':          'CIDR',
    'country':       'Pays (WHOIS)',
    'org-type':      'Type',
    'abuse-mailbox': 'Abuse contact',
  };
  var _order = ['org-name','netname','as-name','aut-num','route','cidr','descr','country','org-type','abuse-mailbox'];

  var structRows = [];
  _order.forEach(function(k){
    if (parsed[k] && _labelMap[k]) {
      var v = parsed[k];
      // Colorise l'AS number et la route
      if (k === 'aut-num') v = '<span style="color:var(--cyan)">'+esc(v)+'</span>';
      else if (k === 'route' || k === 'cidr') v = '<span style="color:rgba(255,200,0,.8)">'+esc(v)+'</span>';
      else v = esc(v);
      structRows.push([_labelMap[k], v]);
    }
  });

  var html = '<div class="win-section"><div class="win-section-hdr"><span style="color:var(--cyan)">▸</span> RÉSEAU / ASN</div>';

  if (!hasData && !hasRaw) {
    var _ipEnc = encodeURIComponent(ip||'');
    html += '<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.5);margin-bottom:.45rem;font-style:italic">WHOIS non disponible — IP hors registres standards</div>'
      + '<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.3rem">Interroger manuellement :</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:.3rem">'
      + '<a href="https://bgp.he.net/ip/'+_ipEnc+'" target="_blank" rel="noopener" style="color:rgba(0,217,255,.65);text-decoration:none;border:1px solid rgba(0,217,255,.2);padding:.1rem .38rem;border-radius:2px;font-size:var(--fs-xs)">⊕ BGP.HE</a>'
      + '<a href="https://search.arin.net/rdap/?query='+_ipEnc+'" target="_blank" rel="noopener" style="color:rgba(0,217,255,.65);text-decoration:none;border:1px solid rgba(0,217,255,.2);padding:.1rem .38rem;border-radius:2px;font-size:var(--fs-xs)">⊕ ARIN</a>'
      + '<a href="https://www.whois.com/whois/'+_ipEnc+'" target="_blank" rel="noopener" style="color:rgba(0,217,255,.65);text-decoration:none;border:1px solid rgba(0,217,255,.2);padding:.1rem .38rem;border-radius:2px;font-size:var(--fs-xs)">⊕ WHOIS</a>'
      + '<a href="https://ipinfo.io/'+_ipEnc+'" target="_blank" rel="noopener" style="color:rgba(0,217,255,.65);text-decoration:none;border:1px solid rgba(0,217,255,.2);padding:.1rem .38rem;border-radius:2px;font-size:var(--fs-xs)">⊕ IPInfo</a>'
      + '</div>';
    return html + '</div>';
  }

  if (structRows.length) {
    html += '<div class="idw-asn">';
    structRows.forEach(function(r){
      html += '<div class="idw-row"><span class="idw-lbl">'+esc(r[0])+'</span><span class="idw-val">'+r[1]+'</span></div>';
    });
    html += '</div>';
  }

  if (rawLines && rawLines.length) {
    html += '<details style="margin-top:.2rem"><summary style="font-size:var(--fs-xs);color:rgba(0,217,255,.45);cursor:pointer;list-style:none;letter-spacing:.3px">▸ WHOIS brut ('+rawLines.length+' lignes)</summary>'
      +'<div style="font-size:var(--fs-xs);color:rgba(122,154,184,.6);font-family:\'Courier New\',monospace;line-height:1.7;max-height:110px;overflow-y:auto;margin-top:.3rem;padding:.3rem .4rem;background:rgba(0,0,0,.2);border-radius:2px">'
      + rawLines.map(function(l){ return esc(l); }).join('<br>')
      +'</div></details>';
  }

  return html + '</div>';
}

// ── Section CROWDSEC ──────────────────────────────────────────────────
function _ipDeepColCrowdSec(cs) {
  var col = cs.banned ? 'var(--red)' : (cs.alerts_30d > 0 ? 'var(--orange)' : 'var(--green)');
  var html = '<div class="win-section"><div class="win-section-hdr"><span style="color:'+col+'">▸</span> CROWDSEC</div>'
    + '<div style="display:flex;gap:.8rem;margin-bottom:.5rem;align-items:center">'
    + '<div style="font-size:var(--fs-xs);text-align:center">'
    +   '<div style="font-size:var(--fs-2xl);font-weight:700;color:'+(cs.banned?'var(--red)':'var(--green)')+'">'+(cs.count||0)+'</div>'
    +   '<div style="color:var(--muted)">bans actifs</div>'
    + '</div>'
    + '<div style="font-size:var(--fs-xs);text-align:center">'
    +   '<div style="font-size:var(--fs-2xl);font-weight:700;color:'+(cs.alerts_30d>0?'var(--orange)':'var(--green)')+'">'+(cs.alerts_30d||0)+'</div>'
    +   '<div style="color:var(--muted)">alertes 7j</div>'
    + '</div>'
    + '</div>';

  if (cs.decisions && cs.decisions.length) {
    html += '<div style="font-size:var(--fs-xs);color:var(--muted);letter-spacing:.3px;margin-bottom:.2rem">DÉCISIONS ACTIVES</div>';
    cs.decisions.forEach(function(d){
      var desc = _ipDeepScenarioDesc(d.scenario||d.reason||'ban');
      html += '<div style="padding:.28rem .45rem;background:rgba(255,59,92,.06);border-left:3px solid rgba(255,59,92,.55);border-radius:0 3px 3px 0;margin-bottom:.25rem;line-height:1.65">'
        + '<div style="font-size:var(--fs-xs);color:var(--text);font-weight:700">'+esc(desc.lbl)+'</div>'
        + '<div style="font-size:calc(var(--fs-xs) - 1px);color:rgba(122,154,184,.6);margin-top:.05rem">'
        +   (d.duration ? '<span style="color:rgba(255,200,0,.75)">⏱ '+esc(d.duration)+'</span> · ' : '')
        +   '<span>'+esc(d.origin||'cscli')+'</span>'
        +   ' · <span style="color:rgba(255,59,92,.7)">'+esc(d.type||'ban')+'</span>'
        +   (d.scenario && d.scenario !== desc.lbl ? ' <span style="opacity:.4">— '+esc(d.scenario)+'</span>' : '')
        + '</div>'
        + '</div>';
    });
  } else if (!cs.banned) {
    html += '<div style="font-size:var(--fs-xs);color:var(--green);padding:.15rem 0">✓ Aucune décision active</div>';
  }

  if (cs.alerts_detail && cs.alerts_detail.length) {
    html += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-top:.4rem;margin-bottom:.12rem;letter-spacing:.3px">DERNIÈRES ALERTES</div>'
      + '<div style="max-height:160px;overflow-y:auto">';
    cs.alerts_detail.slice(0,10).forEach(function(a){
      var desc = _ipDeepScenarioDesc(a.scenario||'');
      html += '<div style="display:grid;grid-template-columns:auto 1fr auto;gap:.4rem;align-items:baseline;padding:.1rem 0;border-bottom:1px solid rgba(255,255,255,.03)">'
        + '<span style="font-size:var(--fs-xs);color:var(--muted);white-space:nowrap">'+_ipDeepFmtTs(a.ts).slice(0,16)+'</span>'
        + '<span class="idsc-tag '+desc.cls+'" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(var(--fs-xs) - 1px)">'+esc(desc.lbl)+'</span>'
        + '<span style="font-size:var(--fs-xs);color:var(--muted);white-space:nowrap">×'+a.count+'</span>'
        + '</div>';
    });
    html += '</div>';
  }

  return html + '</div>';
}

// ── Section FAIL2BAN ──────────────────────────────────────────────────
function _ipDeepColFail2ban(f2b, cs) {
  var col = f2b.banned ? 'var(--red)' : (f2b.total_records > 0 ? 'var(--yellow)' : 'var(--green)');
  var html = '<div class="win-section"><div class="win-section-hdr"><span style="color:'+col+'">▸</span> FAIL2BAN</div>'
    + '<div style="display:flex;gap:.8rem;margin-bottom:.35rem;align-items:center">'
    + '<div style="font-size:var(--fs-xs);text-align:center">'
    +   '<div style="font-size:var(--fs-xl);font-weight:700;color:'+(f2b.banned?'var(--red)':'var(--green)')+'">'+
        (f2b.jails&&f2b.jails.length ? f2b.jails.length : (f2b.banned?'!':'0'))+'</div>'
    +   '<div style="color:var(--muted)">jails actifs</div>'
    + '</div>'
    + '<div style="font-size:var(--fs-xs);text-align:center">'
    +   '<div style="font-size:var(--fs-xl);font-weight:700;color:'+(f2b.total_records>0?'var(--yellow)':'var(--green)')+'">'+(f2b.total_records||0)+'</div>'
    +   '<div style="color:var(--muted)">historique 7j</div>'
    + '</div>'
    + '</div>';

  if (f2b.jails && f2b.jails.length) {
    html += '<div style="margin-bottom:.3rem">';
    f2b.jails.forEach(function(j){
      html += '<span class="idsc-tag cve">⊘ '+esc(j)+'</span>';
    });
    html += '</div>';
  }

  if (f2b.history && f2b.history.length) {
    html += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.12rem;letter-spacing:.3px">HISTORIQUE BANS</div>'
      + '<div style="max-height:110px;overflow-y:auto">';
    f2b.history.slice(0,8).forEach(function(e){
      html += '<div style="display:grid;grid-template-columns:5rem 1fr auto;gap:.4rem;align-items:baseline;padding:.08rem 0;border-bottom:1px solid rgba(255,255,255,.03)">'
        + '<span style="font-size:var(--fs-xs);color:var(--yellow);white-space:nowrap">'+esc(e.jail||'?')+'</span>'
        + '<span style="font-size:var(--fs-xs);color:var(--muted)">'+_ipDeepFmtUnix(e.ts)+'</span>'
        + '<span style="font-size:var(--fs-xs);color:var(--muted)">×'+e.count+'</span>'
        + '</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="font-size:var(--fs-xs);color:var(--green);margin-top:.1rem">✓ Jamais banni sur srv-ngix (7j)</div>';
    if (cs && cs.banned) {
      html += '<div style="font-size:var(--fs-xs);color:rgba(0,217,255,.55);margin-top:.15rem">ⓘ IP gérée directement par CrowdSec</div>';
    }
  }

  return html + '</div>';
}

// ── Section AUTO-BAN SOC ──────────────────────────────────────────────
function _ipDeepColAutoban(abn) {
  if (!abn || !abn.count) return '';
  return '<div class="win-section"><div class="win-section-hdr"><span style="color:var(--orange)">▸</span> AUTO-BAN SOC — RÉCIDIVES ('+abn.count+')</div>'
    + (abn.history && abn.history.length
      ? '<div style="max-height:110px;overflow-y:auto">'
        + abn.history.slice(0,10).map(function(e){
          return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:.4rem;align-items:baseline;padding:.1rem 0;border-bottom:1px solid rgba(255,255,255,.04)">'
            + '<span style="font-size:var(--fs-xs);color:var(--orange)">'+esc(e.stage||'?')+'</span>'
            + '<span style="font-size:var(--fs-xs);color:var(--muted)">'+_ipDeepFmtTs(e.ts).slice(0,16)+'</span>'
            + '<span style="font-size:var(--fs-xs);color:var(--muted)">'+esc(e.duration||'')+'</span>'
            + '</div>';
        }).join('')
        +'</div>'
      : '')
    + '</div>';
}

// ── Section RSYSLOG ───────────────────────────────────────────────────
function _ipDeepColRsyslog(rs) {
  var total  = (rs && rs.total) || 0;
  var col    = total > 0 ? '#a78bfa' : 'var(--muted)';
  var html   = '<div class="win-section"><div class="win-section-hdr"><span style="color:'+col+'">▸</span> RSYSLOG CENTRAL</div>';
  if (!total) {
    return html + '<div style="font-size:var(--fs-xs);color:var(--muted)">Aucune entrée sur 7j<br><span style="opacity:.6">6 hôtes supervisés : srv-ngix · site-01 · site-02 · pve · jarvis · routeur</span></div></div>';
  }
  var sources = rs.sources || {};
  var keys = Object.keys(sources).sort(function(a,b){ return sources[b]-sources[a]; });
  html += '<div style="font-size:var(--fs-xs);color:var(--muted);margin-bottom:.3rem">'
    + 'Total : <span style="color:#a78bfa;font-weight:700">'+total+'</span> entrées · '+keys.length+' source'+(keys.length>1?'s':'')+'</div>';
  if (keys.length) {
    html += '<div style="max-height:110px;overflow-y:auto">';
    keys.slice(0,12).forEach(function(k){
      var pct = Math.round(sources[k]/total*100);
      var w   = Math.max(3, pct);
      html += '<div style="font-size:var(--fs-xs);margin-bottom:.18rem">'
        + '<div style="display:flex;justify-content:space-between;margin-bottom:.05rem">'
        +   '<span style="color:#a78bfa;font-family:\'Courier New\',monospace;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:70%">'+esc(k)+'</span>'
        +   '<span style="color:var(--muted)">'+sources[k]+' · '+pct+'%</span>'
        + '</div>'
        + '<div style="height:3px;background:rgba(167,139,250,.12);border-radius:2px"><div style="height:100%;width:'+w+'%;background:#a78bfa;border-radius:2px"></div></div>'
        + '</div>';
    });
    html += '</div>';
  }
  return html + '</div>';
}

// ── Section NGINX ─────────────────────────────────────────────────────
function _ipDeepColNginxLast(lines, nginxHits, csAlerts) {
  var col = (lines && lines.length) ? 'var(--cyan)' : 'var(--muted)';
  if (!lines || !lines.length) {
    var note = '';
    if (!nginxHits && csAlerts > 0) {
      note = '<div style="font-size:var(--fs-xs);color:rgba(255,200,0,.6);margin-top:.3rem;line-height:1.6">'
        +'ⓘ CrowdSec a détecté '+csAlerts+' alerte'+(csAlerts>1?'s':'')+' sans trace nginx.<br>'
        +'<span style="opacity:.7">IP probablement bloquée en amont (nftables/UFW) avant d\'atteindre nginx, ou accès sur port non loggué.</span>'
        +'</div>';
    }
    return '<div class="win-section"><div class="win-section-hdr"><span style="color:'+col+'">▸</span> NGINX — DERNIÈRES REQUÊTES</div>'
      + '<div style="font-size:var(--fs-xs);color:var(--muted)">Aucune requête nginx sur 7j</div>'
      + note + '</div>';
  }
  return '<div class="win-section"><div class="win-section-hdr"><span style="color:'+col+'">▸</span> NGINX — DERNIÈRES REQUÊTES ('+lines.length+')</div>'
    + '<div style="max-height:130px;overflow-y:auto">'
    + lines.map(function(l){
      return '<div style="font-size:var(--fs-xs);color:var(--muted);font-family:\'Courier New\',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:.07rem 0;border-bottom:1px solid rgba(255,255,255,.03)">'+esc(l)+'</div>';
    }).join('')
    + '</div></div>';
}

// ── Bind actions ban/unban ─────────────────────────────────────────────
function _ipDeepBindActions(r) {
  var ip = r.ip;
  var doFetch = (typeof _socRetryFetch === 'function') ? _socRetryFetch : function(url,opts,cb){
    fetch(url, Object.assign({signal:AbortSignal.timeout(15000)}, opts, {
      headers: Object.assign({'X-Requested-With':'XMLHttpRequest'}, (opts.headers||{}))
    })).then(function(r){return r.json();}).then(cb).catch(function(e){cb({ok:false,error:String(e)});});
  };
  document.querySelectorAll('.ip-deep-ban-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var dur   = btn.dataset.dur || '24h';
      var resEl = document.getElementById('ip-deep-action-result');
      if (resEl) resEl.textContent = '⊙ Ban en cours…';
      doFetch(JV_URL+'/api/soc/ban-ip', {
        method:'POST', mode:'cors',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ip:ip, reason:'SOC ip-deep — ban '+dur, duration:dur}),
      }, function(res){
        if (resEl) resEl.style.color = res.ok ? 'var(--green)' : 'var(--red)';
        if (resEl) resEl.textContent  = res.ok ? '✓ Ban appliqué ('+dur+')' : '✗ Erreur — '+(res.result||res.error||'?');
      });
    });
  });
  document.querySelectorAll('.ip-deep-unban-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var resEl = document.getElementById('ip-deep-action-result');
      if (resEl) resEl.textContent = '⊙ Unban en cours…';
      doFetch(JV_URL+'/api/soc/unban-ip', {
        method:'POST', mode:'cors',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ip:ip}),
      }, function(res){
        if (resEl) resEl.style.color = res.ok ? 'var(--green)' : 'var(--red)';
        if (resEl) resEl.textContent  = res.ok ? '✓ Ban levé' : '✗ Erreur — '+(res.result||res.error||'?');
      });
    });
  });
}

window.openIpDeepModal = openIpDeepModal;

window.addEventListener('load', function(){
  var _orig = window.closeModal;
  window.closeModal = function(){
    if (_ipDeepMap){ try{ _ipDeepMap.remove(); }catch(e){} _ipDeepMap = null; }
    _ipDeepLastResult = null;
    var pInp = document.getElementById('ip-deep-popup-input');
    if (pInp) pInp.value = '';
    if (typeof _orig === 'function') _orig.apply(this, arguments);
  };
});
