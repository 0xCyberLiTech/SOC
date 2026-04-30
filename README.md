<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ESOC+HOMELAB_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>SOC homelab · défense en profondeur · Kill Chain temps réel · IA intégrée</h2>

  <p align="center">
    <a href="https://0xcyberlitech.github.io/">
      <img src="https://img.shields.io/badge/Portfolio-0xCyberLiTech-181717?logo=github&style=flat-square" alt="Portfolio" />
    </a>
    <a href="https://github.com/0xCyberLiTech">
      <img src="https://img.shields.io/badge/Profil-GitHub-181717?logo=github&style=flat-square" alt="Profil GitHub" />
    </a>
    <a href="https://github.com/0xCyberLiTech/SOC">
      <img src="https://img.shields.io/badge/Dépôt-SOC-00B4D8?logo=github&style=flat-square" alt="Dépôt SOC" />
    </a>
    <a href="https://github.com/0xCyberLiTech?tab=repositories">
      <img src="https://img.shields.io/badge/Dépôts-publics-blue?style=flat-square" alt="Dépôts publics" />
    </a>
  </p>

</div>

<div align="center">
  <img src="https://img.icons8.com/fluency/96/000000/cyber-security.png" alt="CyberSec" width="80"/>
</div>

<div align="center">
  <p>
    <strong>6 couches blocage + 2 contrôle intégrité</strong> &nbsp;•&nbsp; <strong>~170 bots/scanners bloqués / 24h</strong> &nbsp;•&nbsp; <strong>5 hôtes supervisés</strong> &nbsp;•&nbsp; <strong>JARVIS IA proactive intégrée</strong>
  </p>
</div>

---

<h2 align="center">Philosophie du projet</h2>

<div align="center">
<table>
<tr>
<td align="center" width="33%">

**🎯 Conditions réelles**

Apprendre la cyberdéfense sur une infrastructure exposée à internet — pas un lab isolé. Chaque outil est confronté à de vrais scans, de vrais bots, de vraies tentatives d'exploit. Ce qui fonctionne ici fonctionne.

</td>
<td align="center" width="33%">

**🔒 Savoir construit, pas redistribué**

Le framework de déploiement et la documentation sont publics — la méthode est partageable. Les sources du dashboard (24 modules JS) et les scripts opérationnels restent privés : connaissance acquise, pas distribuée.

</td>
<td align="center" width="33%">

**🛡️ Résilience face à la compromission**

Si le serveur est compromis, l'attaquant ne récupère pas la configuration complète depuis ce dépôt. Les configs publiées sont anonymisées. L'archive de restauration reste hors ligne — rebuild en moins de 30 min sur VM vierge.

</td>
</tr>
</table>
</div>

---

<h2 align="center">Cartographie des menaces — Live</h2>

<div align="center">

![GeoIP World](assets/geoip-world.jpg)

*GeoIP — Cartographie mondiale des menaces 24h · arcs d'attaque animés · top pays · 169 IPs actives · 25 pays sources*

</div>

---

<h2 align="center">Kill Chain — Progression des attaques</h2>

<div align="center">

![Kill Chain](assets/kill-chain.png)

*Tracking en temps réel : RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ · fenêtre 15 min · score menace par IP*

</div>

---

<h2 align="center">Vue tactique Europe & Investigation IP</h2>

<div align="center">

| SOC Map — Vue Europe | Investigation IP |
|:--------------------:|:----------------:|
| ![SOC Map Europe](assets/socmap-europe.png) | ![IP Investigation](assets/ip-investigation.png) |
| *Score ÉLEVÉ 53 · 169 hostiles · 78% neutralisation · arcs kill chain* | *Modal forensique : Kill Chain · CrowdSec · Fail2ban · WHOIS · verdict* |

</div>

---

<h2 align="center">GeoIP — Statistiques & Corrélations</h2>

<div align="center">

![GeoIP Stats](assets/geoip-stats.png)

*Kill Chain 15 min · Top pays attaquants · Scénarios CrowdSec · Heatmap activité · Top 60 IPs 24h*

</div>

---

<h2 align="center">Moteur de corrélation & Chaîne de défense</h2>

<div align="center">

| XDR — Corrélation cross-source | Chaîne de défense — Pipeline sécurité |
|:------------------------------:|:-------------------------------------:|
| ![XDR Engine](assets/xdr-engine.png) | ![Defense Chain](assets/defense-chain.png) |
| *COLLECT · NORMALIZE · CORRELATE · RESPOND · Score 200* | *UFW → GeoIP → WAF → CrowdSec → Suricata → Fail2ban → nginx · 8 couches* |

</div>

---

<h2 align="center">Heatmap & Monitoring système</h2>

<div align="center">

| Heatmap Attaques 24h | Windows / GPU Metrics |
|:--------------------:|:---------------------:|
| ![Heatmap](assets/heatmap.png) | ![Windows Metrics](assets/windows-metrics.png) |
| *13.2k req · 358 bloqués · 2.7% · pics horaires détectés* | *CPU · RAM · GPU RTX · disques — supervision machine hôte* |

</div>

---

<h2 align="center">JARVIS — IA défensive intégrée</h2>

<div align="center">

![JARVIS AI](assets/jarvis-ai.png)

*JARVIS (Ollama phi4-reasoning) · réponse proactive automatique · alertes TTS · analyse LLM événements critiques · ban auto*

</div>

---

<h2 align="center">Construction par phases</h2>

| # | Phase | Ce qui a été construit | Pourquoi ce choix |
|---|-------|----------------------|-------------------|
| 1 | **Reverse proxy + SSL** | nginx · TLS Let's Encrypt · vhosts · headers sécurité · access_log JSON structuré | Point d'entrée unique — logs structurés dès le départ pour tout le pipeline |
| 2 | **CrowdSec WAF + bouncer nftables** | AppSec 150+ règles · bouncer kernel-space · scénarios custom · whitelist LAN | Blocage comportemental avant que nginx traite la requête — kernel-space = zéro bypass applicatif |
| 3 | **fail2ban + UFW + GeoIP block** | 3 jails nginx/ssh · nftables · blocage géographique MaxMind GeoLite2 | Compléter CrowdSec : patterns ciblés, firewall stateful, filtrage géo en entrée |
| 4 | **Dashboard monitoring** | monitoring_gen.py · monitoring.json · SPA Vanilla JS · premières tuiles système | Sans visibilité temps réel, la défense est aveugle — dashboard avant tout ajout |
| 5 | **Kill Chain + GeoIP cartographie** | Classification 5 stages · score 0–100 · canvas monde · heatmap 24h · top IPs | Transformer les logs bruts en renseignement tactique — qui fait quoi, d'où, quand |
| 6 | **Suricata IDS 7 + rsyslog centralisé** | 49k règles Emerging Threats · AF_PACKET · eve.json · 5 hôtes centralisés | Détection réseau passive indépendante + corrélation cross-host unifiée |
| 7 | **JARVIS IA défensive** | Ollama phi4-reasoning · auto-engine · TTS · ban-ip · restart-service | Couche d'expertise optionnelle — le SOC se défend seul, JARVIS amplifie quand disponible |
| 8 | **AppArmor + AIDE HIDS** | Confinement processus · base intégrité 49k fichiers · exclusions CrowdSec hub | Dernier rempart : un attaquant qui passe tout le reste ne peut ni s'étendre ni persister |
| 9 | **DR exercice réel + audit 10/10** | Exercice Phase A/B/C (2026-04-28) · 8 écarts corrigés · 144 NDT · 90 passes | Valider que le système se reconstruit réellement, pas juste sur le papier |

---

<h2 align="center">Points forts</h2>

| | Capacité | Détail |
|--|----------|--------|
| 🛡️ | **8 couches défense** | Blocage actif : UFW · nftables · GeoIP Block · CrowdSec WAF · Suricata IDS · Fail2ban — Contrôle : AppArmor (isolation processus) · AIDE HIDS (intégrité fichiers) |
| 🧠 | **IA défensive** | JARVIS (Ollama phi4-reasoning) — couche optionnelle · le SOC se défend seul 24h/24 · quand la machine Windows est active : analyse LLM · alertes TTS · ban contextuel |
| 📡 | **Logs centralisés** | 5 hôtes via rsyslog — corrélation cross-host temps réel |
| 🎯 | **Kill Chain** | Tracking RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ par IP |
| 📊 | **Score menace** | 24 briques · calcul temps réel · seuils FAIBLE / MOYEN / ÉLEVÉ / CRITIQUE |
| 🔍 | **XDR** | Corrélation Fail2ban + ModSec + UFW + Suricata + rsyslog + routeur |
| 🗺️ | **GeoIP** | Cartographie Leaflet + MaxMind · arcs d'attaque animés · top pays |
| 🔄 | **Plug-and-play** | Archive 13 blocs · restauration complète sur VM vierge en < 30 min |
| 🔥 | **DR validé en conditions réelles** | Exercice Phase A/B/C exécuté le 2026-04-28 · basculement réseau · 8 écarts corrigés · [rapport](DEPLOY/DR-EXERCISE-2026-04-28.md) |
| ✅ | **Audit 10/10** | Zéro dette technique · 90 passes · 144 NDT corrigés |

---

<h2 align="center">Stack technique</h2>

```
OS          Debian 13 (Trixie)
Proxy       nginx 1.26 — reverse proxy · TLS · vhosts
Sécurité    CrowdSec (WAF AppSec ~207 vpatch CVE) · Suricata IDS (96k règles)
            Fail2ban · AppArmor · UFW + nftables · AIDE HIDS
Logs        rsyslog centralisé (5 hôtes) · GoAccess
Dashboard   SPA vanilla JS — 24 modules · 35 tuiles · zéro dépendance NPM
Backend     Python 3.11 — monitoring_gen.py (génération JSON live)
IA          JARVIS — Ollama phi4-reasoning · Flask · edge-tts
GeoIP       MaxMind GeoLite2 · Leaflet.js
Infra       Proxmox VE — 3 VMs (srv-ngix · site-01 · site-02)
```

---

<h2 align="center">Architecture</h2>

```
INTERNET
   │
   ▼
┌─────────────────────────────────────────────────────┐
│                    srv-ngix                         │
│                                                     │
│  UFW + nftables ──→ GeoIP Block ──→ CrowdSec WAF    │
│       ──→ Suricata IDS ──→ Fail2ban ──→ nginx       │
│       ──→ AppArmor · AIDE HIDS                      │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │         Dashboard SOC (port 8080)            │   │
│  │  24 modules JS · polling 60s · Kill Chain    │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  rsyslog ◄── site-01 · site-02 · pve · <ROUTER>     │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   site-01                site-02
   Apache · AppArmor      Apache · AppArmor
   ModSecurity WAF        ModSecurity WAF
```

---

<h2 align="center">Par où commencer ?</h2>

| Objectif | Point d'entrée |
|----------|---------------|
| 📖 **Comprendre l'architecture** et les choix défensifs | Documentation [01](01-PRESENTATION.md) → [09](09-ROADMAP.md) |
| ⚙️ **Installer la stack logicielle** sur Debian 13 | [deploy-soc.sh](DEPLOY/deploy-soc.sh) — paquets + configuration de base |
| 🔧 **Adapter une configuration** à votre infrastructure | [CONFIGS/](CONFIGS/) — exemples anonymisés · placeholders `<NOM>` |
| 📋 **Comprendre la méthodologie** de déploiement | [GUIDE-DEPLOIEMENT-RAPIDE.md](DEPLOY/GUIDE-DEPLOIEMENT-RAPIDE.md) — workflow disaster recovery |

> **Ce dépôt met à disposition :**
> Architecture complète · 9 documents techniques · framework de déploiement · configs anonymisées · rapport DR exercice réel (2026-04-28)
>
> 🔒 Les sources du dashboard (24 modules JS) et les scripts opérationnels restent privés — connaissance construite, pas redistribuée.

> **Infrastructure de référence** : ce SOC tourne sur **Proxmox VE** (machine physique) hébergeant 3 VMs Debian 13.
> La reconstruction sur un autre hyperviseur (KVM, VMware, bare-metal) est possible en adaptant les 4 IPs du bloc CONFIG de `deploy-soc.sh` :
>
> | Placeholder | Rôle | Exemple générique |
> |-------------|------|-------------------|
> | `<SRV-NGIX-IP>` | VM nginx + SOC dashboard | `203.0.113.10` |
> | `<CLT-IP>` | VM site-01 (Apache) | `203.0.113.11` |
> | `<PA85-IP>` | VM site-02 (Apache) | `203.0.113.12` |
> | `<PROXMOX-IP>` | Hyperviseur Proxmox VE | `203.0.113.1` |

---

<h2 align="center">Documentation</h2>

| # | Document | Description |
|---|----------|-------------|
| 01 | [PRESENTATION.md](01-PRESENTATION.md) | Présentation, objectifs, points forts |
| 02 | [ARCHITECTURE.md](02-ARCHITECTURE.md) | Infrastructure, stack, schéma réseau |
| 03 | [SECURITE-BRIQUES.md](03-SECURITE-BRIQUES.md) | 8 couches défense · matrice couverture par vecteur |
| 04 | [DASHBOARD-SOC.md](04-DASHBOARD-SOC.md) | Dashboard : modules JS · tuiles · polling · CSS |
| 05 | [CHAINE-DEFENSE.md](05-CHAINE-DEFENSE.md) | Flux attaque → détection → ban · intégrations |
| 06 | [THREATSCORE.md](06-THREATSCORE.md) | Score menace : 24 briques · formule · anti-doublons |
| 07 | [RSYSLOG-CENTRAL.md](07-RSYSLOG-CENTRAL.md) | Logs centralisés : 5 hôtes · filtres · rétention |
| 08 | [JARVIS-DEFENSE.md](08-JARVIS-DEFENSE.md) | Défense proactive IA : boucle 60s · 12 déclencheurs |
| 09 | [ROADMAP.md](09-ROADMAP.md) | Axes d'évolution · décisions d'architecture |

---

<h2 align="center">Framework de déploiement</h2>

> ⚠️ **Disaster recovery personnel — non reproductible depuis ce dépôt seul.**
> `restore-soc.sh` nécessite une archive de configuration privée (configs, clés SSH, scripts opérationnels) conservée hors dépôt.
> `deploy-soc.sh` est utilisable indépendamment pour installer la stack logicielle sur n'importe quel Debian 13.

| Script / Guide | Rôle | Utilisable sans archive |
|----------------|------|:-----------------------:|
| [deploy-soc.sh](DEPLOY/deploy-soc.sh) | Installation paquets — nginx · CrowdSec · Suricata · Fail2ban · AIDE · rsyslog · `--dry-run` · `--step` | ✅ |
| [restore-soc.sh](DEPLOY/restore-soc.sh) | Restauration complète depuis archive privée — 13 blocs · `--dry-run` · `--step` · rollback auto | 🔒 archive requise |
| [create-archive.sh](DEPLOY/create-archive.sh) | Export de la configuration en cours — génère l'archive 13 blocs | ✅ |
| [GUIDE-DEPLOIEMENT-RAPIDE.md](DEPLOY/GUIDE-DEPLOIEMENT-RAPIDE.md) | Documentation du workflow complet — référence méthodologique | ✅ |
| [RUNBOOK-DEBIAN13.md](DEPLOY/RUNBOOK-DEBIAN13.md) | Runbook installation Debian 13 | ✅ |
| [CHECKLIST-DEPLOY.md](DEPLOY/CHECKLIST-DEPLOY.md) | 61 points de vérification post-déploiement | ✅ |
| [CHECKLIST-OPERATIONNELLE.md](DEPLOY/CHECKLIST-OPERATIONNELLE.md) | Checklist exploitation quotidienne | ✅ |
| [DR-EXERCISE-2026-04-28.md](DEPLOY/DR-EXERCISE-2026-04-28.md) | **Rapport exercice DR réel** — Phase A/B/C · 8 écarts détectés et corrigés | ✅ |
| [CONTENU-ARCHIVE.md](REFERENCE/CONTENU-ARCHIVE.md) | Structure détaillée des 13 blocs de l'archive | ✅ |
| [AUDIT-ARCHIVE-CHECKLIST.md](REFERENCE/AUDIT-ARCHIVE-CHECKLIST.md) | Checklist avant chaque archivage | ✅ |

---

<h2 align="center">Scripts Python & Shell</h2>

| Fichier | Rôle | Statut |
|---------|------|--------|
| `monitoring_gen.py` | **Moteur principal** — génère `monitoring.json` toutes les 5 min · 60+ fonctions · parsing nginx / CrowdSec / Suricata / Fail2ban / rsyslog | 🔒 privé |
| `soc-daily-report.py` | Rapport HTML quotidien par mail (08h00) | 🔒 privé |
| `monitoring.sh` | Wrapper cron + GoAccess HTML analytics | 🔒 privé |
| `proto-live.py` | Statistiques protocoles temps réel (fenêtre 5 min) | 🔒 privé |
| [alert.conf.example](scripts/alert.conf.example) | Configuration SMTP alertes — copier en `alert.conf` | ✅ public |
| [jail.local](scripts/jail.local) | Fail2ban — 3 jails : sshd · nginx-cve · nginx-botsearch | ✅ public |
| [rsyslog-10-central-receiver.conf](scripts/rsyslog-10-central-receiver.conf) | Récepteur rsyslog central (TCP+UDP 514) | ✅ public |
| [rsyslog-99-forward-site01.conf](scripts/rsyslog-99-forward-site01.conf) | Émetteur rsyslog — site-01 → srv-ngix | ✅ public |
| [rsyslog-99-forward-site02.conf](scripts/rsyslog-99-forward-site02.conf) | Émetteur rsyslog — site-02 → srv-ngix | ✅ public |
| [apparmor-apache2-clt.conf](scripts/apparmor-apache2-clt.conf) | Profil AppArmor Apache2 — site-01 | ✅ public |
| [apparmor-apache2-pa85.conf](scripts/apparmor-apache2-pa85.conf) | Profil AppArmor Apache2 — site-02 | ✅ public |
| [crowdsec/](scripts/crowdsec/) | 4 scénarios CrowdSec custom (http-bad-ua · exploit-scan · php-rce · geo-block) | ✅ public |
| [logrotate.d/](scripts/logrotate.d/) | 7 règles logrotate : nginx · fail2ban · monitoring · rsyslog · aide · ufw · sites | ✅ public |

---

<h2 align="center">Dashboard SOC</h2>

SPA Vanilla JS — zéro dépendance NPM · 24 modules · 35 tuiles.

> Les sources JS ne sont pas publiées dans ce dépôt. La page HTML et le CSS sont disponibles à titre de référence.

| Caractéristique | Détail |
|---|---|
| **Architecture** | 24 modules JS à responsabilité unique — rendu, canvas, fetch, modals, XDR, investigation IP… |
| **35 tuiles** | Kill Chain · GeoIP · XDR · Fail2ban · CrowdSec · Suricata · AIDE HIDS · rsyslog · nginx · Freebox · JARVIS |
| **Kill Chain** | Canvas 2D — tracking RECON → SCAN → EXPLOIT → BRUTE → NEUTRALISÉ · score menace par IP |
| **Investigation IP** | Modal forensique — CrowdSec · Fail2ban · GeoIP · WHOIS · verdict · historique 30j |
| **XDR Engine** | Corrélation cross-source 6 flux · score 0-200 · seuils FAIBLE / MOYEN / ÉLEVÉ / CRITIQUE |
| **GeoIP** | Leaflet.js + MaxMind GeoLite2 — cartographie mondiale · arcs d'attaque animés |
| **Polling** | Cycle 60s — toutes les tuiles se rafraîchissent automatiquement · zéro rechargement de page |
| **Thème** | Glassmorphism — tokens CSS `--fs-*` · responsive · zéro framework CSS |
| **Qualité** | Audit 10/10 · 90 passes · 144 NDT corrigés · zéro dette technique |

---

<h2 align="center">Configurations de référence</h2>

Fichiers de configuration anonymisés — remplacer les placeholders `<LAN-SUBNET>`, `<SSH-PORT>`, `<SRV-NGIX-IP>`, etc.

| # | Fichier | Description |
|---|---------|-------------|
| 01 | [nginx.md](CONFIGS/01-nginx.md) | nginx.conf · vhosts · snippets SSL · headers sécurité · GeoIP block |
| 02 | [crowdsec.md](CONFIGS/02-crowdsec.md) | Collections · LAPI · bouncer nftables · scénarios custom · whitelist LAN |
| 03 | [fail2ban.md](CONFIGS/03-fail2ban.md) | jail.local · action crowdsec-sync · filtres nginx-cve · nginx-botsearch |
| 04 | [suricata.md](CONFIGS/04-suricata.md) | AF_PACKET · ring buffer · eve.json · update.yaml · sysctl hardening |
| 05 | [rsyslog.md](CONFIGS/05-rsyslog.md) | Récepteur central · 5 hôtes · template par hôte · logrotate · corrélations |
| 06 | [ufw-apparmor.md](CONFIGS/06-ufw-apparmor.md) | Règles UFW entrantes/sortantes · bouncer nftables · profils AppArmor |
| 07 | [crons.md](CONFIGS/07-crons.md) | 9 tâches planifiées : monitoring · Suricata · CrowdSec · rapport · GeoIP |

---

<div align="center">

## Technologies

<table>
<tr>
<td align="center"><b>🖥️ Infrastructure & Sécurité</b></td>
<td align="center"><b>💻 Développement & Web</b></td>
<td align="center"><b>🤖 Intelligence Artificielle</b></td>
</tr>
<tr>
<td align="center">
  <a href="https://www.kernel.org/"><img src="https://skillicons.dev/icons?i=linux" width="48" title="Linux" /></a>
  <a href="https://www.debian.org"><img src="https://skillicons.dev/icons?i=debian" width="48" title="Debian" /></a>
  <a href="https://www.gnu.org/software/bash/"><img src="https://skillicons.dev/icons?i=bash" width="48" title="Bash" /></a>
  <br/>
  <a href="https://nginx.org"><img src="https://skillicons.dev/icons?i=nginx" width="48" title="Nginx" /></a>
  <a href="https://git-scm.com"><img src="https://skillicons.dev/icons?i=git" width="48" title="Git" /></a>
</td>
<td align="center">
  <a href="https://www.python.org"><img src="https://skillicons.dev/icons?i=python" width="48" title="Python" /></a>
  <a href="https://flask.palletsprojects.com"><img src="https://skillicons.dev/icons?i=flask" width="48" title="Flask" /></a>
  <a href="https://developer.mozilla.org/docs/Web/HTML"><img src="https://skillicons.dev/icons?i=html" width="48" title="HTML5" /></a>
  <br/>
  <a href="https://developer.mozilla.org/docs/Web/CSS"><img src="https://skillicons.dev/icons?i=css" width="48" title="CSS3" /></a>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" width="48" title="JavaScript" /></a>
  <a href="https://code.visualstudio.com"><img src="https://skillicons.dev/icons?i=vscode" width="48" title="VS Code" /></a>
</td>
<td align="center">
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  <br/><br/>
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projets proposés par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Développés en collaboration avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>
