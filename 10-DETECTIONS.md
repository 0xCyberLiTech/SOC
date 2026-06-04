<div align="center">

  <br></br>

  <a href="https://github.com/0xCyberLiTech">
    <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=50&duration=6000&pause=1000000000&color=00B4D8&center=true&vCenter=true&width=1100&lines=%3EDETECTION+AS+CODE_" alt="SOC 0xCyberLiTech — Détections" />
  </a>

  <br></br>

  <h2>Moteur de détection — Sigma · maturité par maillon · couverture MITRE multi-moteurs</h2>

  <p align="center">
    <a href="https://0xcyberlitech.github.io/">
      <img src="https://img.shields.io/badge/Portfolio-0xCyberLiTech-181717?logo=github&style=flat-square" alt="Portfolio" />
    </a>
    <a href="https://github.com/0xCyberLiTech">
      <img src="https://img.shields.io/badge/Profil-GitHub-181717?logo=github&style=flat-square" alt="Profil GitHub" />
    </a>
  </p>

</div>

---

## Detection-as-code : écrire, tester, documenter

Les détections du SOC sont des **règles versionnées** (format **Sigma**), pas des configs opaques.
Chaque détection suit un **cycle de maturité contrôlé** — on n'arme jamais une règle sur un coup de tête :

```
🔵 écrite  →  🟡 alert-only (lecture)  →  🟠 dry-run (ban SIMULÉ)  →  🟢 enforce (ban réel)
```

On observe d'abord (alert-only), on simule (dry-run, « il bannirait X »), puis on arme **seulement après
review : 0 faux positif prouvé**. Réversible à tout instant (ban court, kill-switch).

---

## Catalogue des détections (porte d'entrée web)

| Détection | Maillon Kill Chain | MITRE | Mode | Ce qu'elle attrape |
|---|---|---|---|---|
| `recon-sensitive-files` | RECON | T1595.003 | 🟢 enforce | scan de `/.env`, `/.git`, `/.aws/credentials`, `/.ssh/id_rsa`… (vol de secrets exposés) |
| `scan-admin-panels` | SCAN | T1595.003 | 🟢 enforce | énumération de panels (`/wp-admin`, `/phpmyadmin`, `/actuator`, `/manager/html`…) |
| `exploit-attempts` | EXPLOIT | T1190 | 🟢 enforce | traversée (`/etc/passwd`), endpoints RCE (`/cgi-bin/`, `/boaform/`), vol de config |
| `exploit-log4shell-jndi` | EXPLOIT | T1190 | 🟡 alert-only | **Log4Shell** (CVE-2021-44228) : `${jndi:…}` + variantes obfusquées + URL-encodé |
| `brute-force-auth` | BRUTE | T1110 | 🟠 dry-run | acharnement sur les endpoints d'auth — **agrégation par IP au-dessus d'un seuil** (la répétition, pas l'accès) |
| `discovery-enumeration` *(SigmaHQ)* | — | T1083 | 🟡 alert-only | énumération de fichiers/répertoires |
| `execution-webshell` *(SigmaHQ)* | — | T1059 | 🟡 alert-only | exécution via webshell (`cmd=`, `shell_exec`, signatures connues) |

> 🟢 **enforce** = ban réel · 🟠 **dry-run** = simulé (accumule la preuve) · 🟡 **alert-only** = observation.
> BRUTE reste en dry-run tant qu'aucune attaque réelle n'a fourni de donnée à juger (data-gated).

---

## Le moteur — minimal, mais blindé

Moteur Sigma **maison** qui lit les logs du serveur web, applique les règles et écrit des alertes JSONL.
Il **n'agit jamais** sauf en mode enforce, derrière **2 verrous + 6 garde-fous** :

- **Double gate** : enforce désarmé par défaut (variable d'env) **ET** kill-switch fichier (`touch …disarm` → stop immédiat).
- **6 rails** : (1) désarmé par défaut · (2) **fenêtre récente** (jamais l'historique) · (3) **whitelist** (RFC1918 + IP de confiance, source unique) · (4) **plafond par cycle** (anti-emballement) · (5) **ban court réversible** · (6) **kill-switch**.
- **Fail-closed** : config incomplète → on n'arme pas. **Source unique** : seuils/whitelist centralisés (zéro hardcode).

Garantie structurelle : une IP **interne ou de confiance ne peut PAS être bannie** — pas « 0 observé », mais **0 possible** par construction.

---

## Couverture MITRE — multi-moteurs (honnête)

La couverture ne se limite pas à Sigma : elle agrège **4 moteurs** avec une **priorité disjointe**
(Sigma > Suricata > CrowdSec > Host), 1 tactique = 1 moteur, le reste = **angle mort assumé**.

```
Couverture : 12 / 14 tactiques MITRE
  • Sigma     5  (règles maison, tunables, promouvables)
  • Suricata  4  (capacité : classtypes activés du ruleset — privesc, C2, exfil, impact)
  • Host      3  (détection auditd/rsyslog central — persistence, defense evasion, lateral)
  • Angles morts honnêtes : Resource Development, Collection
```

> Le chiffre est en **capacité stable** (ce qu'on PEUT détecter), pas une valeur volatile.

---

## Multi-source — la même langue (MITRE) pour toutes les sources

Au-delà du web, les détections **host (auditd)** et **IDS (Suricata)** sont aussi exprimées en **Sigma natif**
(`detections/sigma/multi-source/`) — *detection-as-code* unifiée :

| Règle | Source | MITRE |
|---|---|---|
| `host-auditd-defense-evasion` | auditd (écriture `/etc/audit`, exec auditctl par session interactive) | T1562.001 |
| `ids-suricata-privesc` | Suricata (classtypes `attempted-admin/user`) | T1068 |

---

## Exemple — la règle Log4Shell (format réel)

```yaml
title: Exploitation Log4Shell / JNDI (CVE-2021-44228)
status: experimental
detection:
  selection:
    c-uri|contains:
      - '${jndi:'        # forme directe (ldap/rmi/dns…)
      - '…'              # + variantes obfusquées & URL-encodées (liste complète = dépôt privé)
  filter_internal:
    src_ip|cidr: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8']
  condition: selection and not filter_internal
level: critical
tags: [attack.initial-access, attack.t1190]
```

Le moteur matche la **ligne entière** du log → les payloads livrés via **User-Agent / en-têtes** sont capturés.

> 🔒 **Choix anti-évasion** : les **listes complètes de patterns** et les **seuils exacts** sont volontairement
> gardés dans le **dépôt opérationnel privé**, pas ici. Cette vitrine montre l'**approche** et la **logique**,
> pas la recette qu'un attaquant ciblé pourrait contourner.

---

## Validé par une batterie de test

Chaque détection est validée par un **corpus d'attaque synthétique** passé dans le moteur (IP de test
externes) : on vérifie que **chaque règle attrape son attaque**, que le **seuil d'agrégation BRUTE** ne flagge
que l'IP qui le dépasse, que le **filtre interne** exclut bien le RFC1918, et que le trafic **bénin** ne matche
rien. *Test-driven detection* — une détection non testée n'est pas une détection.

---

<div align="center">
  <sub>SOC homelab 0xCyberLiTech — détection-as-code · MITRE ATT&CK · Sigma · zéro faux positif structurel</sub>
</div>
