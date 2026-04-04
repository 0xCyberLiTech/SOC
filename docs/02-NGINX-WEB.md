# Étape 2 — nginx & Déploiement web

## Objectif
Exposer le dashboard SOC via nginx sur le réseau local.  
Le dashboard est un **fichier HTML unique** — nginx ne fait que le servir.

---

## Étape 2.1 — Installation nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

---

## Étape 2.2 — Arborescence web

```bash
# Créer le répertoire de monitoring
mkdir -p /var/www/monitoring
chown -R www-data:www-data /var/www/monitoring

# Permissions en écriture pour le script Python (tourne en root via cron)
chmod 755 /var/www/monitoring
```

---

## Étape 2.3 — Virtual host nginx

Fichier : `/etc/nginx/sites-available/monitoring`

```nginx
server {
    listen 8080;
    server_name _;

    root /var/www/monitoring;
    index index.html;

    # Accès LAN uniquement
    allow 192.168.x.0/24;
    deny all;

    # Dashboard principal
    location / {
        try_files $uri $uri/ =404;
    }

    # JSONs de données — cache court
    location ~* \.json$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        expires 0;
    }

    # Logs dédiés
    access_log /var/log/nginx/monitoring-access.log;
    error_log  /var/log/nginx/monitoring-error.log;
}
```

```bash
# Activer le vhost
ln -s /etc/nginx/sites-available/monitoring /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Étape 2.4 — Déployer le dashboard

```bash
# Depuis votre machine Windows/Linux
scp -P 2222 monitoring-index.html socadmin@VOTRE_IP:/var/www/monitoring/index.html

# Vérification
curl -s -o /dev/null -w "%{http_code}" http://VOTRE_IP:8080/
# → 200
```

---

## Étape 2.5 — GeoIP (optionnel mais recommandé)

GeoIP permet d'afficher les pays d'origine des attaquants sur la carte mondiale.

```bash
# Installer geoipupdate
apt install -y geoipupdate

# Configurer /etc/GeoIP.conf avec votre compte MaxMind (gratuit)
# AccountID VOTRE_ACCOUNT_ID
# LicenseKey VOTRE_LICENSE_KEY
# EditionIDs GeoLite2-City GeoLite2-Country GeoLite2-ASN

# Première mise à jour
geoipupdate

# Cron quotidien — 03h00
echo "0 3 * * * root /usr/bin/geoipupdate && systemctl reload nginx" \
    > /etc/cron.d/geoipupdate
```

---

## Étape 2.6 — Logrotate

Fichier : `/etc/logrotate.d/monitoring-soc`

```
/var/log/nginx/monitoring-*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}
```

---

## Vérification

```bash
# nginx actif ?
systemctl is-active nginx

# Vhost chargé ?
nginx -T | grep "listen 8080"

# Dashboard accessible ?
curl -s http://localhost:8080/ | grep -o 'v[0-9]\+\.[0-9]\+\.[0-9]\+'
```

---

**Étape suivante →** [03 — CrowdSec](./03-CROWDSEC.md)
