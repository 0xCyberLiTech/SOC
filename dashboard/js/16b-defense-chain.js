'use strict';
// ── 16b — CHAÎNE DE DÉFENSE — ÉTAT LOGIQUE TEMPS RÉEL ──────────────────────
// v1.2.1 — 2026-04-19 — getSub Suricata dynamique + esc(def.sub)

// ── CSS injection (une seule fois) ───────────────────────────────────────────
var _dcCssInjected=false;
function _dcInjectCss(){
  if(_dcCssInjected)return;
  _dcCssInjected=true;
  var s=document.createElement('style');
  s.textContent=[
    '.dc-wrap{display:flex;flex-direction:column;align-items:center;gap:0;width:100%;user-select:none;}',
    '.dc-label-top,.dc-label-bot{font-size:var(--fs-xs);font-weight:700;letter-spacing:1.5px;text-align:center;',
    'padding:.32rem .9rem;border-radius:2px;}',
    '.dc-label-top{color:#ff3b5c;border:1px solid rgba(255,59,92,.3);background:rgba(255,59,92,.06);}',
    '.dc-label-bot{color:#00ff88;border:1px solid rgba(0,255,136,.3);background:rgba(0,255,136,.06);}',
    '.dc-arrow{width:2px;height:16px;background:linear-gradient(to bottom,rgba(0,217,255,.45),rgba(0,217,255,.1));',
    'margin:0 auto;position:relative;}',
    '.dc-arrow::after{content:"";position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);',
    'border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid rgba(0,217,255,.4);}',
    /* Main nodes */
    '.dc-node{position:relative;width:100%;max-width:24rem;cursor:pointer;border-radius:3px;padding:.4rem .65rem;',
    'border:1px solid rgba(0,217,255,.1);border-left:3px solid var(--dc-col,rgba(0,217,255,.6));',
    'background:rgba(0,0,0,.28);transition:background .15s,transform .1s,box-shadow .15s;}',
    '.dc-node:hover{background:rgba(0,217,255,.06);transform:translateX(2px);box-shadow:0 0 10px rgba(0,217,255,.12);}',
    '.dc-node.dc-down{border-left-color:#ff3b5c!important;animation:dc-pulse 1.8s ease-in-out infinite;}',
    '.dc-node.dc-na{border-left-color:#4a5568!important;opacity:.6;}',
    '@keyframes dc-pulse{0%,100%{box-shadow:0 0 0 rgba(255,59,92,0);}50%{box-shadow:0 0 12px rgba(255,59,92,.5);}}',
    '@keyframes dc-pulse-act{0%,100%{box-shadow:0 0 0 rgba(0,0,0,0);}50%{box-shadow:0 0 var(--dc-pa,5px) var(--dc-col,rgba(0,217,255,.45));}}',
    '.dc-node-inner{display:flex;align-items:center;gap:.45rem;}',
    '.dc-node-ico{font-size:var(--fs-md);width:1.15rem;text-align:center;flex-shrink:0;}',
    '.dc-node-text{flex:1;min-width:0;}',
    '.dc-node-lbl{font-size:var(--fs-xs);font-weight:700;color:var(--text);letter-spacing:.4px;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dc-node-sub{font-size:calc(var(--fs-xs) - 1px);color:var(--muted);opacity:.8;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dc-node-val{font-family:"Courier New",monospace;font-size:var(--fs-xs);font-weight:700;',
    'min-width:3.8rem;text-align:right;flex-shrink:0;}',
    '.dc-node-badge{min-width:3rem;text-align:right;flex-shrink:0;}',
    /* Barre de charge */
    '.dc-load-wrap{height:2px;background:rgba(255,255,255,.05);border-radius:0 0 2px 2px;margin-top:.3rem;overflow:hidden;}',
    '.dc-load-bar{height:100%;border-radius:0 0 2px 2px;transition:width .8s ease;min-width:2px;}',
    /* Badges */
    '.dc-badge-ok{font-size:calc(var(--fs-xs) - 1px);font-weight:700;color:#00ff88;',
    'background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.3);padding:.04rem .3rem;border-radius:2px;letter-spacing:.5px;}',
    '.dc-badge-down{font-size:calc(var(--fs-xs) - 1px);font-weight:700;color:#ff3b5c;',
    'background:rgba(255,59,92,.1);border:1px solid rgba(255,59,92,.3);padding:.04rem .3rem;border-radius:2px;letter-spacing:.5px;}',
    '.dc-badge-na{font-size:calc(var(--fs-xs) - 1px);font-weight:700;color:#64748b;',
    'background:rgba(100,116,139,.08);border:1px solid rgba(100,116,139,.2);padding:.04rem .3rem;border-radius:2px;letter-spacing:.5px;}',
    /* Split connector */
    '.dc-split{position:relative;width:100%;max-width:44rem;height:14px;}',
    '.dc-split::before{content:"";position:absolute;top:0;left:6%;right:6%;height:1px;background:rgba(0,217,255,.28);}',
    /* Branches */
    '.dc-branches-row{display:flex;align-items:flex-start;gap:.7rem;width:100%;max-width:44rem;}',
    '.dc-branch-col{display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;}',
    '.dc-branch-vline{width:1px;height:13px;background:rgba(0,217,255,.28);}',
    '.dc-branch-head{font-size:calc(var(--fs-xs) - 1px);font-weight:700;letter-spacing:.9px;',
    'color:var(--muted);text-align:center;margin-bottom:.3rem;width:100%;}',
    '.dc-branch-node{cursor:pointer;border-radius:3px;padding:.28rem .45rem;',
    'border:1px solid rgba(0,217,255,.08);border-left:2px solid var(--dc-col,#00d9ff);',
    'background:rgba(0,0,0,.22);width:100%;margin-bottom:.2rem;',
    'transition:background .15s,transform .1s;}',
    '.dc-branch-node:hover{background:rgba(0,217,255,.07);transform:scale(1.015);}',
    '.dc-branch-node.dc-down{border-left-color:#ff3b5c!important;animation:dc-pulse 1.8s ease-in-out infinite;}',
    '.dc-branch-inner{display:flex;align-items:center;gap:.3rem;}',
    '.dc-branch-ico{font-size:var(--fs-xs);flex-shrink:0;}',
    '.dc-branch-text{flex:1;min-width:0;overflow:hidden;}',
    '.dc-branch-lbl2{font-size:calc(var(--fs-xs) - 1px);font-weight:700;color:var(--text);',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dc-branch-sub2{font-size:calc(var(--fs-xs) - 2px);color:var(--muted);opacity:.75;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dc-branch-bdg{flex-shrink:0;}',
    /* Popup */
    '.dc-popup{position:fixed;z-index:9998;min-width:17rem;max-width:21rem;',
    'background:rgba(6,16,30,.97);border:1px solid rgba(0,217,255,.38);border-radius:4px;',
    'padding:.75rem .8rem;box-shadow:0 0 20px rgba(0,217,255,.18);pointer-events:auto;}',
    '.dc-popup-hidden{display:none!important;}',
    '.dc-popup-title{font-size:var(--fs-sm);font-weight:700;letter-spacing:.5px;margin-bottom:.45rem;',
    'display:flex;align-items:center;gap:.35rem;}',
    '.dc-popup-role{font-size:var(--fs-xs);color:var(--muted);line-height:1.55;margin-bottom:.5rem;',
    'border-left:2px solid rgba(0,217,255,.25);padding-left:.45rem;}',
    '.dc-popup-metrics{display:flex;flex-direction:column;gap:.18rem;margin-bottom:.45rem;}',
    '.dc-popup-metric{display:flex;justify-content:space-between;gap:.5rem;font-size:var(--fs-xs);}',
    '.dc-popup-mk{color:var(--muted);opacity:.8;flex-shrink:0;}',
    '.dc-popup-mv{font-family:"Courier New",monospace;font-weight:700;color:var(--text);text-align:right;}',
    '.dc-popup-deps{font-size:calc(var(--fs-xs) - 1px);color:var(--muted);opacity:.65;',
    'border-top:1px solid rgba(0,217,255,.1);padding-top:.38rem;}',
    '.dc-popup-close{position:absolute;top:.35rem;right:.5rem;cursor:pointer;',
    'color:var(--muted);font-size:var(--fs-sm);line-height:1;padding:.1rem .3rem;opacity:.65;}',
    '.dc-popup-close:hover{color:#ff3b5c;opacity:1;}'
  ].join('');
  document.head.appendChild(s);
}

// ── Briques principales (ordre flux) ─────────────────────────────────────────
var _DC_MAIN=[
  {
    id:'ufw',ico:'⊘',col:'rgba(255,59,92,.9)',
    lbl:'UFW + nftables',sub:'Pare-feu réseau · 1ère ligne',
    role:'Filtre les connexions réseau entrantes et sortantes. Bloque les ports non autorisés et rejette tout trafic non sollicité avant qu\'il n\'atteigne l\'application.',
    getOk:function(d){return (d.ufw||{}).active!==false;},
    getLoadNum:function(d){return (d.ufw||{}).blocked_total||0;},
    getVal:function(d){var u=d.ufw||{};return u.blocked_total>0?fmt(u.blocked_total):'0 pqts';},
    getMetrics:function(d){
      var u=d.ufw||{};
      return [
        {k:'État',v:u.active!==false?'ACTIF':'INACTIF'},
        {k:'Paquets bloqués',v:fmt(u.blocked_total||0)},
        {k:'Règles actives',v:u.rules_count!=null?fmt(u.rules_count):'N/A'},
        {k:'Logging',v:u.logging||'N/A'}
      ];
    },
    getDeps:function(){return 'Couche 1 — agit avant tout traitement nginx';}
  },
  {
    id:'geoip',ico:'◎',col:'rgba(255,107,53,.9)',
    lbl:'GeoIP Block',sub:'Filtrage géographique',
    role:'Bloque les requêtes provenant de pays à risque élevé. Réduit la surface d\'attaque en rejetant le trafic de géographies non légitimes au niveau nginx.',
    getOk:function(d){return (d.traffic||{}).geo_blocks>0||!!(d.crowdsec||{}).available;},
    getLoadNum:function(d){return (d.traffic||{}).geo_blocks||0;},
    getVal:function(d){var v=(d.traffic||{}).geo_blocks||0;return v>0?fmt(v):'0';},
    getMetrics:function(d){
      var t=d.traffic||{};
      var pct=t.total_requests>0?Math.round((t.geo_blocks||0)*100/t.total_requests):0;
      return [
        {k:'Requêtes bloquées',v:fmt(t.geo_blocks||0)},
        {k:'Taux filtrage',v:t.total_requests>0?pct+'%':'N/A'},
        {k:'Module',v:'ngx_http_geoip2_module'}
      ];
    },
    getDeps:function(){return 'Couche 2 — après UFW, avant AppSec WAF';}
  },
  {
    id:'appsec',ico:'⬡',col:'rgba(191,95,255,.9)',
    lbl:'AppSec WAF',sub:'CrowdSec WAF · ~207 vpatch CVE',
    role:'WAF applicatif CrowdSec. Détecte et bloque les exploits web connus (SQLi, XSS, LFI, CVE patching virtuel) en temps réel avant qu\'ils n\'atteignent le backend.',
    getOk:function(d){var cs=d.crowdsec||{};return !!(cs.available&&cs.appsec&&cs.appsec.active);},
    getLoadNum:function(d){return (d.crowdsec&&d.crowdsec.appsec&&d.crowdsec.appsec.blocked)||0;},
    getVal:function(d){var v=(d.crowdsec&&d.crowdsec.appsec&&d.crowdsec.appsec.blocked)||0;return v>0?fmt(v):'0 req';},
    getMetrics:function(d){
      var ap=(d.crowdsec||{}).appsec||{};
      return [
        {k:'État',v:ap.active?'ACTIF':'INACTIF'},
        {k:'Vpatch CVE',v:'~207 règles'},
        {k:'Requêtes filtrées',v:fmt(ap.blocked||0)},
        {k:'Mode',v:ap.mode||'enforce'}
      ];
    },
    getDeps:function(){return 'Bouncer nginx natif — décisions partagées CrowdSec';}
  },
  {
    id:'cs',ico:'⊛',col:'rgba(255,215,0,.9)',
    lbl:'CrowdSec IDS/IPS',sub:'Détection comportementale + blocage',
    role:'Analyse comportementale du trafic. Détecte brute force, scan, exploitation et partage les décisions de ban avec tous les bouncers actifs du réseau.',
    getOk:function(d){return !!(d.crowdsec||{}).available;},
    getLoadNum:function(d){return (d.crowdsec||{}).active_decisions||0;},
    getVal:function(d){var v=(d.crowdsec||{}).active_decisions||0;return v>0?fmt(v)+' IPs':'0 IP';},
    getMetrics:function(d){
      var cs=d.crowdsec||{};
      return [
        {k:'État',v:cs.available?'ACTIF':'INACTIF'},
        {k:'IPs bannies actives',v:fmt(cs.active_decisions||0)},
        {k:'Alertes 24h',v:fmt(cs.alerts_24h||0)},
        {k:'Scénarios actifs',v:fmt((cs.scenarios||[]).length)},
        {k:'Bouncers',v:fmt((cs.bouncers||[]).length)}
      ];
    },
    getDeps:function(){return 'Couche 4 — pilote fail2ban · AppSec · scénarios Suricata';}
  },
  {
    id:'sur',ico:'◈',col:'rgba(255,165,0,.9)',
    lbl:'Suricata IDS',sub:'Analyse réseau · ~90k règles',getSub:function(d){var s=d.suricata||{};return 'Analyse réseau · '+(s.rules_loaded?fmt(s.rules_loaded)+' règles':'~90k règles');},
    role:'IDS réseau basé sur signatures. Analyse les paquets en profondeur (DPI) sur toutes les couches. Sévérité 1 → ban CS 168h · Sévérité 2 → ban CS 48h via scénarios custom.',
    getOk:function(d){return (d.suricata||{}).available===true;},
    getLoadNum:function(d){var s=d.suricata||{};return s.alerts_24h||s.total_alerts||0;},
    getVal:function(d){var s=d.suricata||{};var v=s.alerts_24h||s.total_alerts||0;return v>0?fmt(v)+' alt':'0 alt';},
    getMetrics:function(d){
      var s=d.suricata||{};
      return [
        {k:'État',v:s.available===true?'ACTIF':'INACTIF'},
        {k:'Alertes totales',v:fmt(s.total_alerts||0)},
        {k:'Alertes 24h',v:s.alerts_24h!=null?fmt(s.alerts_24h):'N/A'},
        {k:'Sévérité 1 (critique)',v:fmt(s.sev1_critical||s.sev1_24h||0)},
        {k:'Sévérité 2 (haute)',v:fmt(s.sev2_high||s.sev2_24h||0)},
        {k:'Règles chargées',v:s.rules_loaded?fmt(s.rules_loaded):'~90k'}
      ];
    },
    getDeps:function(){return 'Sév.1 → ban CS 168h · Sév.2 → ban CS 48h (scénarios custom)';}
  },
  {
    id:'f2b',ico:'◈',col:'rgba(0,217,255,.9)',
    lbl:'fail2ban',sub:'Bannissement adaptatif multi-hôtes',
    role:'Analyse les logs nginx/SSH/Apache en temps réel. Bannit les IPs après N échecs via iptables/nftables. Couvre srv-ngix, Proxmox, CLT et PA85.',
    getOk:function(d){var f=d.fail2ban||{};return !!(f.jails&&f.jails.length);},
    getLoadNum:function(d){
      var f=d.fail2ban||{};
      var tot=f.total_banned||0;
      if(f.proxmox&&f.proxmox.available)tot+=f.proxmox.total_banned||0;
      if(f.clt&&f.clt.available)tot+=f.clt.total_banned||0;
      if(f.pa85&&f.pa85.available)tot+=f.pa85.total_banned||0;
      return tot;
    },
    getVal:function(d){
      var f=d.fail2ban||{};
      var tot=f.total_banned||0;
      if(f.proxmox&&f.proxmox.available)tot+=f.proxmox.total_banned||0;
      if(f.clt&&f.clt.available)tot+=f.clt.total_banned||0;
      if(f.pa85&&f.pa85.available)tot+=f.pa85.total_banned||0;
      return tot>0?fmt(tot)+' IPs':'0 IP';
    },
    getMetrics:function(d){
      var f=d.fail2ban||{};
      return [
        {k:'srv-ngix',v:fmt(f.total_banned||0)+' bans · '+((f.jails||[]).length)+' jails'},
        {k:'Proxmox',v:f.proxmox&&f.proxmox.available?fmt(f.proxmox.total_banned||0)+' bans':'N/A'},
        {k:'CLT',v:f.clt&&f.clt.available?fmt(f.clt.total_banned||0)+' bans':'N/A'},
        {k:'PA85',v:f.pa85&&f.pa85.available?fmt(f.pa85.total_banned||0)+' bans':'N/A'},
        {k:'Bantime',v:'24h (défaut)'}
      ];
    },
    getDeps:function(){return 'Jails : nginx-botsearch · nginx-http-auth · nginx-cve · sshd';}
  },
  {
    id:'nginx',ico:'⊘',col:'rgba(0,255,136,.9)',
    lbl:'nginx',sub:'Reverse proxy · vhosts · TLS',
    role:'Serveur web principal. Termine les connexions TLS, route les requêtes vers les vhosts CLT/PA85, sert le dashboard SOC. Bouncer CrowdSec intégré comme module natif.',
    getOk:function(d){
      var svcs=d.services||{};
      var keys=Object.keys(svcs);
      for(var i=0;i<keys.length;i++){if(keys[i].indexOf('nginx')!==-1)return svcs[keys[i]].status==='UP';}
      return (d.traffic||{}).total_requests>0;
    },
    getLoadNum:function(d){return (d.traffic||{}).total_requests||0;},
    getVal:function(d){var v=(d.traffic||{}).total_requests||0;return v>0?fmt(v)+' req':'0 req';},
    getMetrics:function(d){
      var t=d.traffic||{};
      var svcs=d.services||{};
      var nginxUp=false;
      Object.keys(svcs).forEach(function(k){if(k.indexOf('nginx')!==-1)nginxUp=svcs[k].status==='UP';});
      return [
        {k:'État',v:nginxUp?'ACTIF':'INACTIF'},
        {k:'Requêtes totales',v:fmt(t.total_requests||0)},
        {k:'Requêtes 24h',v:fmt(t.requests_24h||0)},
        {k:'Taux erreur',v:t.error_rate!=null?t.error_rate.toFixed(1)+'%':'N/A'}
      ];
    },
    getDeps:function(){return 'Bouncer CrowdSec intégré · AppArmor confiné · TLS Let\'s Encrypt';}
  },
  {
    id:'xdr',ico:'◈',col:'rgba(0,200,255,.85)',
    lbl:'XDR — Corrélation rsyslog',sub:'Cross-host · kill chain · 5 hôtes',
    role:'Moteur de corrélation XDR : centralise les logs de srv-ngix, Proxmox, CLT, PA85 et GT-BE98 via rsyslog. Corrèle les événements cross-hôtes pour détecter les IPs actives sur plusieurs vecteurs simultanément (C2 sortant, kill chain multi-étapes, récidivistes). Alimente directement le score de menace global.',
    getOk:function(d){return (d.rsyslog||{}).available!==false;},
    getLoadNum:function(d){return (d.xhosts||{}).corr_count||0;},
    getVal:function(d){var v=(d.xhosts||{}).corr_count||0;return v>0?fmt(v)+' IP corr.':'0 corr.';},
    getMetrics:function(d){
      var rs=d.rsyslog||{}, xh=d.xhosts||{};
      return [
        {k:'État',v:rs.available!==false?'ACTIF':'INACTIF'},
        {k:'IPs corrélées',v:fmt(xh.corr_count||0)},
        {k:'Destinations uniques',v:fmt(xh.total_dst||0)},
        {k:'Hôtes couverts',v:'srv-ngix · proxmox · clt · pa85 · GT-BE98'},
        {k:'Kill chain cross-host',v:Object.keys(xh.kill_chain_ips||{}).length+' IPs'},
        {k:'F2B bans VMs',v:fmt(((xh.f2b_bans||{}).clt||[]).length+((xh.f2b_bans||{}).pa85||[]).length)+' (clt+pa85)'}
      ];
    },
    getDeps:function(){return 'Alimente computeThreatScore · C2 sortant · récidivistes · bans VMs';}
  }
];

// ── Branches terminales ───────────────────────────────────────────────────────
var _DC_BRANCHES=[
  {
    id:'srv_nginx',lbl:'SRV-NGIX',
    subs:[
      {
        id:'aa_nginx',ico:'⬡',col:'rgba(0,255,136,.85)',
        lbl:'AppArmor',sub:'nginx workers confinés',
        role:'Profil AppArmor enforce pour nginx sur srv-ngix. Confine les workers — restreint l\'accès aux fichiers, sockets et syscalls autorisés uniquement.',
        getOk:function(d){return (d.apparmor_nginx||{}).enforce===true;},
        getVal:function(d){return (d.apparmor_nginx||{}).processes_confined||0;},
        getMetrics:function(d){
          var a=d.apparmor_nginx||{};
          return [
            {k:'Mode',v:a.enforce===true?'enforce':a.available===false?'N/A':'complain'},
            {k:'Workers confinés',v:fmt(a.processes_confined||0)},
            {k:'Profil',v:'usr.sbin.nginx'}
          ];
        },
        getDeps:function(){return 'Renforce la sécurité du reverse proxy nginx';}
      },
      {
        id:'aide_nginx',ico:'◉',col:'rgba(0,200,255,.85)',
        lbl:'AID',sub:'HIDS · intégrité fichiers',
        role:'AIDE surveille l\'intégrité des fichiers critiques sur srv-ngix (~49 945 entrées). Détecte toute modification non autorisée des configs nginx, CrowdSec, scripts SOC, SSH, fail2ban. Vérification cron 03h00 — alerte si différence.',
        getOk:function(d){var a=d.aide||{};return a.available!==false&&(a.status==='OK'||a.status==='PENDING');},
        getVal:function(d){var a=d.aide||{};return a.status==='OK'?'INTÈGRE':(a.status==='ALERT'?'ALERTE':a.status||'N/A');},
        getMetrics:function(d){
          var a=d.aide||{};
          return [
            {k:'Statut',v:a.status==='OK'?'INTÈGRE':(a.status==='ALERT'?'ALERTE':a.status||'N/A')},
            {k:'Entrées indexées',v:a.entries_total?a.entries_total.toLocaleString('fr-FR'):'~49 945'},
            {k:'Dernière vérif.',v:a.age_hours!=null?'il y a '+a.age_hours+'h':'cron 03h00'},
            {k:'Différences',v:(a.changed||0)+' mod · '+(a.added||0)+' add · '+(a.removed||0)+' del'},
            {k:'Cron',v:'03h00 — /etc/cron.d/aide-soc'}
          ];
        },
        getDeps:function(){return 'Périmètre : /opt/clt/ · /var/www/ · /etc/crowdsec/ · nginx · SSH';}
      }
    ]
  },
  {
    id:'clt',lbl:'CLT',
    subs:[
      {
        id:'aa_clt',ico:'⬡',col:'rgba(0,160,200,.85)',
        lbl:'AppArmor',sub:'Apache2 CLT confiné',
        role:'Profil AppArmor enforce pour Apache2 sur VM CLT. Limite Apache2 aux ressources nécessaires pour servir le site cybersécurité.',
        getOk:function(d){return (d.clt_apparmor||{}).enforce===true;},
        getVal:function(d){return (d.clt_apparmor||{}).processes_confined||0;},
        getMetrics:function(d){
          var a=d.clt_apparmor||{};
          return [
            {k:'Mode',v:a.enforce===true?'enforce':a.available===false?'N/A':'complain'},
            {k:'Workers confinés',v:fmt(a.processes_confined||0)},
            {k:'VM',v:'CLT — '+SOC_INFRA.CLT}
          ];
        },
        getDeps:function(){return 'VM 106 — Apache2 + site cybersécurité';}
      },
      {
        id:'ms_clt',ico:'◈',col:'rgba(0,217,255,.85)',
        lbl:'ModSecurity',sub:'WAF OWASP CRS Apache',
        role:'WAF ModSecurity avec le Core Rule Set OWASP. Filtre les requêtes HTTP malveillantes (SQLi, XSS, LFI, RCE) au niveau Apache2 avant traitement applicatif.',
        getOk:function(d){return (d.clt_modsec||{}).engine_on===true;},
        getVal:function(d){var m=d.clt_modsec||{};if(!m.engine_on)return 'OFF';return m.blocking===true?'BLOCAGE':'DÉTECTION';},
        getMetrics:function(d){
          var m=d.clt_modsec||{};
          return [
            {k:'Moteur',     v:m.engine_on===true?'ON':'OFF'},
            {k:'Mode',       v:m.blocking===true?'BLOCAGE (deny 403)':'DÉTECTION (pass)'},
            {k:'Blocs/1h',   v:typeof m.blocks_1h==='number'?String(m.blocks_1h):'—'},
            {k:'Attaques/24h',v:typeof m.attack_count==='number'?String(m.attack_count):'—'},
            {k:'FP/24h',     v:typeof m.fp_count==='number'?String(m.fp_count):'—'},
            {k:'Règles',     v:'OWASP CRS v3.3 (32 règles)'}
          ];
        },
        getDeps:function(){return 'Complète AppArmor — protège les routes PHP/Apache';}
      }
    ]
  },
  {
    id:'pa85',lbl:'PA85',
    subs:[
      {
        id:'aa_pa85',ico:'⬡',col:'rgba(120,80,200,.85)',
        lbl:'AppArmor',sub:'Apache2 PA85 confiné',
        role:'Profil AppArmor enforce pour Apache2 sur VM PA85. Confine Apache2 pour le site associatif PA85 avec formulaires PHP (contact, RDV).',
        getOk:function(d){return (d.pa85_apparmor||{}).enforce===true;},
        getVal:function(d){return (d.pa85_apparmor||{}).processes_confined||0;},
        getMetrics:function(d){
          var a=d.pa85_apparmor||{};
          return [
            {k:'Mode',v:a.enforce===true?'enforce':a.available===false?'N/A':'complain'},
            {k:'Workers confinés',v:fmt(a.processes_confined||0)},
            {k:'VM',v:'PA85 — '+SOC_INFRA.PA85}
          ];
        },
        getDeps:function(){return 'VM 107 — Apache2 + site associatif PA85';}
      },
      {
        id:'ms_pa85',ico:'◈',col:'rgba(120,80,200,.75)',
        lbl:'ModSecurity',sub:'WAF OWASP CRS Apache',
        role:'WAF ModSecurity avec le Core Rule Set OWASP sur VM PA85. Même protection que CLT — SQLi, XSS, LFI filtrés au niveau Apache2.',
        getOk:function(d){return (d.pa85_modsec||{}).engine_on===true;},
        getVal:function(d){var m=d.pa85_modsec||{};if(!m.engine_on)return 'OFF';return m.blocking===true?'BLOCAGE':'DÉTECTION';},
        getMetrics:function(d){
          var m=d.pa85_modsec||{};
          return [
            {k:'Moteur',     v:m.engine_on===true?'ON':'OFF'},
            {k:'Mode',       v:m.blocking===true?'BLOCAGE (deny 403)':'DÉTECTION (pass)'},
            {k:'Blocs/1h',   v:typeof m.blocks_1h==='number'?String(m.blocks_1h):'—'},
            {k:'Attaques/24h',v:typeof m.attack_count==='number'?String(m.attack_count):'—'},
            {k:'FP/24h',     v:typeof m.fp_count==='number'?String(m.fp_count):'—'},
            {k:'Règles',     v:'OWASP CRS v3.3 (32 règles)'}
          ];
        },
        getDeps:function(){return 'Complète AppArmor — protège les routes PHP/Apache';}
      }
    ]
  },
  {
    id:'jarvis',lbl:'JARVIS',
    subs:[
      {
        id:'jarvis_ai',ico:'⬡',col:'rgba(0,255,136,.9)',
        lbl:'JARVIS AI',sub:'IA locale · réponse autonome',
        role:'Assistant IA local (Ollama LLM). Surveille le dashboard en boucle 60s. Auto-ban IPs critiques via CrowdSec, restart services down, analyse LLM des menaces, alertes vocales TTS.',
        getOk:function(_d){
          // Source de vérité 1 : fetch /api/status (dcPollJarvis)
          if(_dcJarvisState.available) return true;
          // Source de vérité 2 : window._jvOnline (set par checkNow/pingJarvis dans 18-jarvis-engine.js)
          return !!window._jvOnline;
        },
        getVal:function(_d){
          var m=_dcJarvisState.model||'';
          return m?m.split(':')[0].slice(0,10):'localhost';
        },
        getMetrics:function(_d){
          var j=_dcJarvisState;
          var ok=j.available||!!window._jvOnline;
          // Fallback modèle depuis window._jvLastStats (checkNow /api/stats)
          var st=window._jvLastStats||{};
          var model=j.model||st.model||st.llm_model||st.active_model||'N/A';
          // Fallback bans depuis window._PRO_DATA (fetchSocActions /api/soc/actions)
          var pd=window._PRO_DATA||{};
          var bans=j.bans_24h||(pd.by_type&&pd.by_type.ban_ip)||pd.total||0;
          var eng=j.soc_engine_active||!!(st.soc_engine_active||st.soc_engine)||!!window._jvOnline;
          return [
            {k:'État',v:ok?'ONLINE':'OFFLINE'},
            {k:'Modèle LLM',v:ok?model:'N/A'},
            {k:'URL',v:JV_URL},
            {k:'Bans 24h',v:fmt(bans)},
            {k:'Alertes TTS',v:fmt(j.alerts_24h||0)},
            {k:'SOC engine',v:eng?'ACTIF':'N/A'}
          ];
        },
        getDeps:function(){return 'Boucle 60s — ban/unban/restart via CrowdSec · TTS alertes';}
      }
    ]
  }
];

// ── Ping JARVIS (côté navigateur — localhost:5000 inaccessible depuis srv-ngix) ──
var _dcJarvisState={available:false,model:'',bans_24h:0,soc_engine_active:false};
var _dcJarvisPollActive=false;
function _dcPollJarvis(){
  if(_dcJarvisPollActive)return;
  _dcJarvisPollActive=true;
  function _poll(){
    var _ctrl=new AbortController();setTimeout(function(){_ctrl.abort();},3000);
    fetch(JV_URL+'/api/status',{signal:_ctrl.signal})
      .then(function(r){return r.ok?r.json():Promise.reject(r.status);})
      .then(function(data){
        _dcJarvisState={
          available:true,
          model:data.model||data.llm_model||data.active_model||'',
          bans_24h:+(data.bans_24h||data.total_bans||0),
          alerts_24h:+(data.alerts_24h||0),
          soc_engine_active:!!(data.soc_engine_active||data.soc_engine),
        };
        window._dcJarvisState=_dcJarvisState;
        // Mise à jour DOM immédiate — nœud branche JARVIS AI
        var node=document.querySelector('[data-dcid="jarvis_ai"]');
        if(node){
          node.classList.remove('dc-down');
          var bdg=node.querySelector('.dc-branch-bdg');
          if(bdg)bdg.innerHTML='<span class="dc-badge-ok" style="font-size:calc(var(--fs-xs) - 2px);padding:.02rem .25rem">ACTIF</span>';
          node.style.animation='dc-pulse-act 5s ease-in-out infinite';
          node.style.setProperty('--dc-pa','3px');
        }
      })
      .catch(function(){
        _dcJarvisState={available:false};
        window._dcJarvisState=_dcJarvisState;
        var node=document.querySelector('[data-dcid="jarvis_ai"]');
        if(node){
          node.classList.add('dc-down');
          var bdg=node.querySelector('.dc-branch-bdg');
          if(bdg)bdg.innerHTML='<span class="dc-badge-down" style="font-size:calc(var(--fs-xs) - 2px);padding:.02rem .25rem">DOWN</span>';
          node.style.animation='';
        }
      });
    setTimeout(_poll,30000);
  }
  _poll();
}

// ── HTML brique principale ────────────────────────────────────────────────────
function _dcNodeHtml(def,d,maxLoad){
  var ok=def.getOk(d);
  var cls='dc-node '+(ok?'':'dc-down');
  var badge=ok?'<span class="dc-badge-ok">ACTIF</span>':'<span class="dc-badge-down">DOWN</span>';
  var loadNum=def.getLoadNum?def.getLoadNum(d):0;
  var loadPct=maxLoad>0?Math.max(2,Math.round(loadNum*100/maxLoad)):2;
  // Pulse dosé par activité (uniquement si brique ACTIVE)
  var pulseStyle='';
  if(ok && loadPct>8){
    var pa=loadPct<30?'4px':(loadPct<65?'8px':'14px');
    var pd=loadPct<30?'4.5s':(loadPct<65?'2.8s':'1.6s');
    pulseStyle=';animation:dc-pulse-act '+pd+' ease-in-out infinite;--dc-pa:'+pa;
  }
  return '<div class="'+cls+'" style="--dc-col:'+def.col+pulseStyle+'" data-dcid="'+def.id+'">'
   +'<div class="dc-node-inner">'
   +'<span class="dc-node-ico" style="color:'+def.col+';text-shadow:0 0 6px '+def.col+'">'+def.ico+'</span>'
   +'<div class="dc-node-text">'
   +'<div class="dc-node-lbl">'+def.lbl+'</div>'
   +'<div class="dc-node-sub">'+esc(def.getSub?def.getSub(d):def.sub)+'</div>'
   +'</div>'
   +'<span class="dc-node-val" style="color:'+def.col+'">'+esc(String(def.getVal(d)))+'</span>'
   +'<div class="dc-node-badge">'+badge+'</div>'
   +'</div>'
   +'<div class="dc-load-wrap"><div class="dc-load-bar" style="width:'+loadPct+'%;background:'+def.col+'"></div></div>'
   +'</div>';
}

// ── HTML brique de branche ────────────────────────────────────────────────────
function _dcBranchSubHtml(sub,d){
  var ok=sub.getOk(d);
  var badge=ok?'<span class="dc-badge-ok" style="font-size:calc(var(--fs-xs) - 2px);padding:.02rem .25rem">ACTIF</span>'
              :'<span class="dc-badge-down" style="font-size:calc(var(--fs-xs) - 2px);padding:.02rem .25rem">DOWN</span>';
  // Pulse léger continu sur briques actives de branche
  var bPulse=ok?';animation:dc-pulse-act 5s ease-in-out infinite;--dc-pa:3px':'';
  return '<div class="dc-branch-node '+(ok?'':'dc-down')+'" style="--dc-col:'+sub.col+bPulse+'" data-dcid="'+sub.id+'">'
   +'<div class="dc-branch-inner">'
   +'<span class="dc-branch-ico" style="color:'+sub.col+'">'+sub.ico+'</span>'
   +'<div class="dc-branch-text">'
   +'<div class="dc-branch-lbl2">'+sub.lbl+'</div>'
   +'<div class="dc-branch-sub2">'+sub.sub+'</div>'
   +'</div>'
   +'<div class="dc-branch-bdg">'+badge+'</div>'
   +'</div></div>';
}

// ── Popup ─────────────────────────────────────────────────────────────────────
var _dcPopup=null;
var _dcDocBound=false;

function _dcGetPopup(){
  if(!_dcPopup){
    _dcPopup=document.createElement('div');
    _dcPopup.className='dc-popup dc-popup-hidden';
    _dcPopup.id='dc-popup';
    document.body.appendChild(_dcPopup);
    _dcPopup.addEventListener('click',function(e){e.stopPropagation();});
  }
  return _dcPopup;
}

function _dcShowPopup(nodeEl,def,d){
  var pop=_dcGetPopup();
  var ok=def.getOk(d);
  var metrics=def.getMetrics(d);
  var metricsHtml=metrics.map(function(m){
    return '<div class="dc-popup-metric"><span class="dc-popup-mk">'+esc(m.k)+'</span>'
          +'<span class="dc-popup-mv">'+esc(String(m.v))+'</span></div>';
  }).join('');
  pop.innerHTML='<span class="dc-popup-close" id="dc-popup-close">✕</span>'
   +'<div class="dc-popup-title" style="color:'+def.col+'">'
   +'<span style="text-shadow:0 0 6px '+def.col+'">'+def.ico+'</span>'+esc(def.lbl)
   +(ok?'<span class="dc-badge-ok" style="margin-left:auto">ACTIF</span>'
       :'<span class="dc-badge-down" style="margin-left:auto">DOWN</span>')
   +'</div>'
   +'<div class="dc-popup-role">'+def.role+'</div>'
   +'<div class="dc-popup-metrics">'+metricsHtml+'</div>'
   +'<div class="dc-popup-deps">↳ '+def.getDeps()+'</div>';
  document.getElementById('dc-popup-close').addEventListener('click',function(){_dcHidePopup();});
  pop.classList.remove('dc-popup-hidden');
  var rect=nodeEl.getBoundingClientRect();
  var px=rect.right+10, py=rect.top;
  pop.style.left=px+'px';
  pop.style.top=py+'px';
  requestAnimationFrame(function(){
    if(!pop||pop.classList.contains('dc-popup-hidden'))return;
    var pw=pop.offsetWidth,ph=pop.offsetHeight;
    if(px+pw>window.innerWidth-10)pop.style.left=Math.max(8,rect.left-pw-10)+'px';
    if(py+ph>window.innerHeight-10)pop.style.top=Math.max(8,window.innerHeight-ph-8)+'px';
  });
}

function _dcHidePopup(){
  if(_dcPopup)_dcPopup.classList.add('dc-popup-hidden');
}

// ── Bind événements ───────────────────────────────────────────────────────────
function _dcBind(d){
  if(!_dcDocBound){
    _dcDocBound=true;
    document.addEventListener('click',function(e){
      if(_dcPopup&&!_dcPopup.classList.contains('dc-popup-hidden')){
        if(!_dcPopup.contains(e.target)&&!e.target.closest('[data-dcid]')){
          _dcHidePopup();
        }
      }
    });
  }
  _DC_MAIN.forEach(function(def){
    var el=document.querySelector('[data-dcid="'+def.id+'"]');
    if(el)el.addEventListener('click',function(e){e.stopPropagation();_dcShowPopup(el,def,d);});
  });
  _DC_BRANCHES.forEach(function(br){
    br.subs.forEach(function(sub){
      var el=document.querySelector('[data-dcid="'+sub.id+'"]');
      if(el)el.addEventListener('click',function(e){e.stopPropagation();_dcShowPopup(el,sub,d);});
    });
  });
}

// ── Rendu tuile ───────────────────────────────────────────────────────────────
function _dcRenderTile(d,g){
  _dcInjectCss();
  // Sync depuis window._jvOnline (source de vérité : checkNow/pingJarvis dans 18-jarvis-engine.js)
  if(window._jvOnline && !_dcJarvisState.available){
    _dcJarvisState.available=true;
    window._dcJarvisState=_dcJarvisState;
  }
  _dcPollJarvis(); // démarre le ping browser-side localhost:5000 (idempotent)
  window._dcJarvisState=_dcJarvisState;

  // Calcul max charge (pour barres proportionnelles)
  var maxLoad=1;
  _DC_MAIN.forEach(function(def){if(def.getLoadNum){var v=def.getLoadNum(d);if(v>maxLoad)maxLoad=v;}});

  // Nœuds principaux avec flèches entre chaque (sauf après le dernier)
  var mainHtml=_DC_MAIN.map(function(def,i){
    return _dcNodeHtml(def,d,maxLoad)+(i<_DC_MAIN.length-1?'<div class="dc-arrow"></div>':'');
  }).join('');

  // Branches
  var branchesHtml=_DC_BRANCHES.map(function(br){
    var subsHtml=br.subs.map(function(sub){return _dcBranchSubHtml(sub,d);}).join('');
    return '<div class="dc-branch-col">'
     +'<div class="dc-branch-vline"></div>'
     +'<div class="dc-branch-head">'+br.lbl+'</div>'
     +subsHtml
     +'</div>';
  }).join('');

  // Compteur état global
  var downMain=_DC_MAIN.filter(function(def){return !def.getOk(d);}).length;
  var downBranch=0;
  _DC_BRANCHES.forEach(function(br){br.subs.forEach(function(s){if(!s.getOk(d))downBranch++;});});
  var downTotal=downMain+downBranch;
  var statusCol=downTotal===0?'var(--green)':(downMain>0?'var(--red)':'var(--amber)');
  var statusLbl=downTotal===0?'TOUTES BRIQUES ACTIVES':(downTotal+' BRIQUE'+(downTotal>1?'S':'')+' DOWN');

  var h='<div class="card wide" id="defense-chain-card">'
   +'<div class="corner tl"></div><div class="corner tr"></div>'
   +'<div class="card-inner">'
   +'<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;'
   +'margin-bottom:.65rem;padding-bottom:.55rem;border-bottom:1px solid rgba(255,59,92,.15);min-width:0;">'
   +'<div style="display:flex;align-items:center;gap:.45rem;font-size:var(--fs-md);'
   +'text-transform:uppercase;letter-spacing:1.5px;color:var(--red);min-width:0;overflow:hidden;">'
   +'<span class="ct-icon" style="flex-shrink:0">⬡</span>'
   +'<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">CHAÎNE DE DÉFENSE</span>'
   +'<span data-panel="RÔLE : visualisation temps réel de la chaîne défensive multicouche — chaque brique est un rempart indépendant qui filtre le trafic avant de le transmettre à la suivante. Un seul regard suffit pour confirmer que toute la défense est intacte.\n\nMÉCANISMES EN CASCADE : le trafic entrant traverse 6 couches — UFW (firewall statique, bloc IP/ports) → CrowdSec WAF/IPS (AppSec OWASP + décisions communautaires CTI) → Fail2ban (bruteforce · scan · répétitions) → ModSec (règles OWASP HTTP layer 7) → Suricata IDS (signatures réseau, anomalies protocoles) → AppArmor (isolation processus, containment post-exploit). Chaque couche élimine une classe de menace distincte.\n\nCOMPORTEMENT ATTENDU : toutes les briques affichées en vert · statut TOUTES BRIQUES ACTIVES · aucun service DOWN · flèche directe vers TRAFIC LÉGITIME ADMIS sans détour par les branches de blocage.\n\nJARVIS (si online) : surveille l état de chaque nœud en temps réel. Si une brique passe DOWN → alerte vocale immédiate + tentative de restart automatique. Détecte les anomalies (pic de bans, Suricata silencieux, CrowdSec décisions à zéro) et déclenche une analyse LLM proactive.\n\nVALEUR AJOUTÉE : remplace la consultation de 6 outils séparés. Le vert global confirme l intégrité défensive sans ouvrir nginx, crowdsec, fail2ban, suricata et apparmor individuellement. En cas d incident, la brique en rouge localise immédiatement la faille dans la chaîne." data-panel-title="CHAÎNE DE DÉFENSE" class="soc-panel-i" style="--pi-dim:rgba(255,100,100,.55);--pi-bright:rgba(255,100,100,.95);--pi-glow:rgba(255,100,100,.5);margin-left:.35rem">ⓘ</span>'
   +'</div>'
   +'<div style="flex-shrink:0;padding-right:.9rem;">'
   +'<span style="font-size:var(--fs-xs);font-family:\'Courier New\',monospace;font-weight:700;color:'+statusCol+';white-space:nowrap;">'+statusLbl+'</span>'
   +'</div>'
   +'</div>'
   +'<div class="dc-wrap">'
   +'<div class="dc-label-top">⬡ INTERNET — TRAFIC ENTRANT</div>'
   +'<div class="dc-arrow"></div>'
   +mainHtml
   +'<div class="dc-split"></div>'
   +'<div class="dc-branches-row">'+branchesHtml+'</div>'
   +'<div class="dc-arrow" style="margin-top:.2rem"></div>'
   +'<div class="dc-label-bot">✓ TRAFIC LÉGITIME ADMIS</div>'
   +'</div>'
   +'</div></div>';

  g.insertAdjacentHTML('beforeend',h);
  _dcBind(d);
}

window._renderDefenseChain=_dcRenderTile;
