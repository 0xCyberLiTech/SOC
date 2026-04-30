<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3ENGINX+CONF_" alt="SOC 0xCyberLiTech" />
  </a>

  <br></br>

  <h2>Configuration nginx — reverse proxy · TLS · vhosts · headers sécurité · GeoIP.</h2>

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

Ce document contient les configurations nginx anonymisées : nginx.conf principal, vhosts par domaine, snippets SSL, headers de sécurité (CSP, HSTS, X-Frame-Options) et blocage GeoIP.

- ⚙️ nginx.conf — worker_processes, gzip, keepalive, log_format JSON
- 🌐 Vhosts — site-01, site-02, monitoring (port 8080), snippets SSL
- 🔒 Headers sécurité — CSP, HSTS, X-Frame-Options, Referrer-Policy
- 🗺️ GeoIP block — blocage par pays avec MaxMind GeoLite2
- 🍯 Honeypot — URLs pièges intégrées aux vhosts (ban auto CrowdSec)

---

<h2 align="center">nginx.conf — Configuration principale</h2>

`/etc/nginx/nginx.conf`

```nginx
user www-data;
worker_processes auto;
pid /run/nginx.pid;

# Modules requis : geoip2 + headers-more
load_module modules/ngx_http_geoip2_module.so;
load_module modules/ngx_http_headers_more_filter_module.so;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    # Bases
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;
    server_tokens off;                          # masquer version nginx

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logs
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    '$geoip2_data_country_code';   # pays source injecté

    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    # GeoIP2 — bases MaxMind locales
    geoip2 /usr/share/GeoIP/GeoLite2-Country.mmdb {
        $geoip2_data_country_code country iso_code;
    }
    geoip2 /usr/share/GeoIP/GeoLite2-City.mmdb {
        $geoip2_data_city_name city names fr;
    }

    # Clés API (NVD) — incluses dans tous les vhosts
    include /etc/nginx/api-keys.conf;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Vhosts
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

---

<h2 align="center">Vhost — Dashboard SOC (port 8080)</h2>

`/etc/nginx/sites-available/monitoring`

```nginx
server {
    listen 8080;
    server_name <SRV-NGIX-IP>;

    root /var/www/monitoring;
    index index.html;

    # Accès LAN uniquement
    allow <LAN-SUBNET>;
    deny all;

    location / {
        try_files $uri $uri/ =404;
    }

    # monitoring.json — généré toutes les 5 min
    location /monitoring.json {
        add_header Cache-Control "no-cache, no-store";
        add_header Access-Control-Allow-Origin "*";
    }

    access_log /var/log/nginx/monitoring-access.log;
    error_log  /var/log/nginx/monitoring-error.log;
}
```

---

<h2 align="center">Vhost — Reverse proxy HTTPS</h2>

`/etc/nginx/sites-available/<YOUR-DOMAIN>`

```nginx
# Redirection HTTP → HTTPS
server {
    listen 80;
    server_name <YOUR-DOMAIN> www.<YOUR-DOMAIN>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name <YOUR-DOMAIN>;

    # Certificats Let's Encrypt
    ssl_certificate     /etc/letsencrypt/live/<YOUR-DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<YOUR-DOMAIN>/privkey.pem;

    include /etc/nginx/snippets/ssl-params.conf;
    include /etc/nginx/snippets/security-headers.conf;
    include /etc/nginx/snippets/geoip-block.conf;

    root /var/www/<YOUR-DOMAIN>;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;
}
```

---

<h2 align="center">Snippet — Headers sécurité</h2>

`/etc/nginx/snippets/security-headers.conf`

```nginx
# Supprimer l'en-tête Server (headers-more requis)
more_clear_headers Server;

# HSTS — 2 ans, inclure sous-domaines
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# Clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# XSS Protection
add_header X-XSS-Protection "1; mode=block" always;

# MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# Referrer
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# CSP — adapter selon les ressources du site
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self';" always;

# Permissions Policy
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

<h2 align="center">Snippet — Blocage GeoIP</h2>

`/etc/nginx/snippets/geoip-block.conf`

```nginx
# Bloquer les pays à risque élevé
# $geoip2_data_country_code injecté depuis nginx.conf
geo $geoip2_data_country_code $blocked_country {
    default         0;
    CN              1;   # Chine
    RU              1;   # Russie
    KP              1;   # Corée du Nord
    IR              1;   # Iran
    BY              1;   # Biélorussie
    # Ajouter selon les logs d'attaque observés
}

# Dans le vhost : if ($blocked_country) { return 403; }
```

---

<h2 align="center">Snippet — Paramètres SSL</h2>

`/etc/nginx/snippets/ssl-params.conf`

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

ssl_session_cache    shared:SSL:10m;
ssl_session_timeout  1d;
ssl_session_tickets  off;

ssl_stapling on;
ssl_stapling_verify on;

# DH params — générer : openssl dhparam -out /etc/nginx/dhparam.pem 4096
ssl_dhparam /etc/nginx/dhparam.pem;
```

---

<h2 align="center">Clés API</h2>

`/etc/nginx/api-keys.conf` — permissions `600 root:root`

```nginx
# Clé NVD (National Vulnerability Database)
# https://nvd.nist.gov/developers/request-an-api-key
geo $api_nvd_key {
    default "<YOUR_NVD_API_KEY>";
}
```

---

<div align="center">

## Stack technique

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
  <a href="https://www.docker.com"><img src="https://skillicons.dev/icons?i=docker" width="48" title="Docker" /></a>
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
  <a href="https://pytorch.org"><img src="https://skillicons.dev/icons?i=pytorch" width="48" title="PyTorch" /></a>
  <a href="https://www.tensorflow.org"><img src="https://skillicons.dev/icons?i=tensorflow" width="48" title="TensorFlow" /></a>
  <a href="https://www.raspberrypi.com"><img src="https://skillicons.dev/icons?i=raspberrypi" width="48" title="Raspberry Pi" /></a>
  <br/><br/>
  <a href="https://ollama.com"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" /></a>
  &nbsp;
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Anthropic-D97757?style=for-the-badge&logo=anthropic&logoColor=white" alt="Anthropic" /></a>
</td>
</tr>
</table>

<br/>

<sub>🔒 Projets proposés par <a href="https://github.com/0xCyberLiTech">0xCyberLiTech</a> · Développés en collaboration avec <a href="https://claude.ai">Claude AI</a> (Anthropic) 🔒</sub>

</div>
