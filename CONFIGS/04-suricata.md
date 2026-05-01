<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ESURICATA+CONF_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Configuration Suricata IDS 7 — AF_PACKET · 49k règles ET · eve.json · sysctl.</h2>

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
    <a href="../README.md">
      <img src="https://img.shields.io/badge/📄%20README-SOC-00B4D8?style=flat-square" alt="README" />
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
    <strong>Cybersécurité défensive</strong> <img src="https://img.icons8.com/color/24/000000/lock--v1.png"/> &nbsp;•&nbsp; <strong>Homelab en production</strong> <img src="https://img.icons8.com/color/24/000000/linux.png"/> &nbsp;•&nbsp; <strong>IA locale intégrée</strong> <img src="https://img.icons8.com/color/24/000000/shield-security.png"/>
  </p>
</div>

---

<div align="center">
## À propos & Objectifs.
</div>

Ce document couvre la configuration Suricata 7 en mode IDS passif : AF_PACKET sur interface réseau, ring buffer, sortie eve.json, mise à jour automatique des règles Emerging Threats et hardening sysctl.

- 📡 Mode IDS passif — AF_PACKET sur ens18, zero-copy, ring buffer 128Mo
- 📋 49 343 règles Emerging Threats — mise à jour quotidienne via suricata-update
- 📄 Sortie eve.json — alertes structurées, parsées par CrowdSec acquis
- ⚙️ sysctl hardening — net.core.rmem_max, disable_ipv6, forwarding
- 🔗 Pipeline IDS→IPS — Suricata détecte → CrowdSec lit eve.json → nftables bloque

---

<h2 align="center">Rôle dans le SOC</h2>

Suricata est l'IDS réseau du SOC — il analyse le trafic en **mode AF_PACKET** (copie noyau, zéro perte de paquets) et génère des alertes dans `eve.json` consommées par `monitoring_gen.py`.

- **~106 000 règles** : Emerging Threats Pro + ET Open
- **Mise à jour automatique** : `suricata-update` via cron 03h30
- **Ring buffer 100k packets** : absorbe les pics de trafic

---

<h2 align="center">suricata.yaml — Sections clés</h2>

`/etc/suricata/suricata.yaml`

```yaml
%YAML 1.1
---

# Interface réseau — AF_PACKET (mode capture noyau)
af-packet:
  - interface: eth0
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes
    use-mmap: yes
    tpacket-v3: yes
    ring-size: 100000          # buffer 100k packets — absorbe les pics

# Variables réseau — adapter à votre infra
vars:
  address-groups:
    HOME_NET: "[<LAN-SUBNET>]"
    EXTERNAL_NET: "!$HOME_NET"
    HTTP_SERVERS: "$HOME_NET"
    SMTP_SERVERS: "$HOME_NET"
    SQL_SERVERS: "$HOME_NET"
    DNS_SERVERS: "$HOME_NET"
    TELNET_SERVERS: "$HOME_NET"

  port-groups:
    HTTP_PORTS: "80"
    SHELLCODE_PORTS: "!80"
    ORACLE_PORTS: 1521
    SSH_PORTS: <SSH-PORT>
    DNP3_PORTS: 20000
    MODBUS_PORTS: 502
    FILE_DATA_PORTS: "[$HTTP_PORTS,110,143]"
    FTP_PORTS: 21
    VXLAN_PORTS: 4789
    TEREDO_PORTS: 3544

# Outputs — eve.json est la source du dashboard SOC
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: /var/log/suricata/eve.json
      # Types d'événements enregistrés
      types:
        - alert:
            payload: yes
            payload-buffer-size: 4kb
            http-body: yes
            http-body-printable: yes
            metadata: yes
        - http:
            extended: yes
        - dns:
            query: yes
            answer: yes
        - tls:
            extended: yes
        - files:
            force-magic: yes
        - smtp
        - ssh
        - flow
        - netflow

  - fast:
      enabled: yes
      filename: /var/log/suricata/fast.log
      append: yes

  - stats:
      enabled: yes
      filename: /var/log/suricata/stats.log
      append: yes
      interval: 8

# Règles — chargées par suricata-update
default-rule-path: /var/lib/suricata/rules
rule-files:
  - suricata.rules

# Performances
threading:
  set-cpu-affinity: no
  cpu-affinity:
    - management-cpu-set:
        cpu: [0]
    - receive-cpu-set:
        cpu: [0]
    - worker-cpu-set:
        cpu: ["all"]
        mode: "exclusive"

# Détection
detect:
  profile: medium
  custom-values:
    toclient-groups: 3
    toserver-groups: 25

# Sécurité kernel — requis pour AF_PACKET avec Suricata
# sysctl net.ipv4.conf.all.rp_filter = 2  (dans /etc/sysctl.d/99-hardening.conf)
```

---

<h2 align="center">update.yaml — Sources de règles</h2>

`/etc/suricata/update.yaml`

```yaml
# Sources activées pour suricata-update
sources:
  # Emerging Threats Open (gratuit)
  - name: et/open
    url: https://rules.emergingthreats.net/open/suricata-%(__version__)s/emerging.rules.tar.gz

  # Emerging Threats Pro (payant — recommandé en production)
  # - name: et/pro
  #   url: https://rules.emergingthreats.net/%(secret-code)s/suricata-%(__version__)s/etpro.rules.tar.gz
  #   secret-code: <ET-PRO-SECRET>
```

---

<h2 align="center">Hardening kernel requis</h2>

`/etc/sysctl.d/99-hardening.conf`

```ini
# OBLIGATOIRE pour Suricata AF_PACKET
# Sans ce paramètre : warning "rp_filter" et paquets perdus
net.ipv4.conf.all.rp_filter = 2
net.ipv4.conf.default.rp_filter = 2

# Désactiver IPv6 si non utilisé
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
```

```bash
sysctl -p /etc/sysctl.d/99-hardening.conf
```

---

<h2 align="center">Commandes de référence</h2>

```bash
# Vérifier le démarrage et les règles chargées
grep "rules loaded" /var/log/suricata/suricata.log
# Attendu : X rules loaded, 0 rules failed

# Alertes en temps réel
tail -f /var/log/suricata/eve.json | jq 'select(.event_type=="alert") | {src: .src_ip, sig: .alert.signature}'

# Mettre à jour les règles
suricata-update
systemctl reload suricata

# Stats ring buffer
grep "ring" /var/log/suricata/suricata.log

# Tester la config
suricata -T -c /etc/suricata/suricata.yaml
```

---

<div align="center">

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
