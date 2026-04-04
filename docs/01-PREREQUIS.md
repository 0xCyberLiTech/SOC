# Étape 1 — Prérequis & Environnement

## Objectif
Préparer l'environnement cible avant toute installation.  
Un serveur mal préparé génère 80% des problèmes rencontrés par la suite.

---

## Infrastructure minimale recommandée

| Composant | Minimum | Recommandé |
|-----------|---------|-----------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 Go | 4 Go |
| Disque | 20 Go | 50 Go |
| OS | Debian 11 | Debian 12/13 |
| Réseau | 1 interface | 1 interface + accès LAN |

> Ce projet a été développé et testé sur **Proxmox VE** avec des VMs Debian 13.  
> Il fonctionne sur n'importe quel VPS ou serveur bare-metal Debian.

---

## Étape 1.1 — Mise à jour système

```bash
apt update && apt upgrade -y
apt install -y curl wget git python3 python3-pip ufw fail2ban
```

---

## Étape 1.2 — Utilisateur et accès SSH

```bash
# Créer un utilisateur d'administration dédié
adduser socadmin
usermod -aG sudo socadmin

# Copier votre clé publique SSH
mkdir -p /home/socadmin/.ssh
echo "ssh-ed25519 VOTRE_CLE_PUBLIQUE commentaire" >> /home/socadmin/.ssh/authorized_keys
chmod 700 /home/socadmin/.ssh
chmod 600 /home/socadmin/.ssh/authorized_keys
```

---

## Étape 1.3 — Sécurisation SSH

Fichier : `/etc/ssh/sshd_config`

```bash
# Désactiver l'authentification par mot de passe
PasswordAuthentication no
PermitRootLogin prohibit-password

# Port non standard (recommandé)
Port 2222

# Limiter les tentatives
MaxAuthTries 3
LoginGraceTime 20
```

```bash
systemctl restart sshd
```

> **Attention** : Vérifier que votre clé SSH fonctionne AVANT de désactiver les mots de passe.

---

## Étape 1.4 — Pare-feu de base (UFW)

```bash
# Politique par défaut : tout bloquer en entrée
ufw default deny incoming
ufw default allow outgoing

# Autoriser SSH sur votre port
ufw allow 2222/tcp comment 'SSH'

# Autoriser le dashboard SOC (accès LAN uniquement)
ufw allow from 192.168.x.0/24 to any port 8080 comment 'Dashboard SOC LAN'

# Activer
ufw enable
ufw status verbose
```

---

## Étape 1.5 — Python et dépendances

```bash
pip3 install requests paramiko psutil

# Vérification
python3 -c "import requests, paramiko, psutil; print('OK')"
```

---

## Arborescence cible

```
/opt/soc/
├── scripts/
│   ├── monitoring_gen.py     # Collecte des données (toutes les 5 min)
│   ├── monitoring.sh         # Wrapper cron
│   ├── alert.conf            # Configuration des alertes
│   └── ufw-snapshot.sh       # Export des règles UFW
├── logs/
│   └── soc.log
└── /var/www/monitoring/      # Servi par nginx
    ├── index.html            # Dashboard (fichier unique)
    └── monitoring.json       # Données générées
```

---

## Vérification avant de passer à l'étape 2

```bash
# Connexion SSH OK ?
ssh -p 2222 socadmin@VOTRE_IP "echo OK"

# UFW actif ?
ufw status | grep "Status: active"

# Python OK ?
python3 --version
```

---

**Étape suivante →** [02 — nginx & déploiement web](./02-NGINX-WEB.md)
