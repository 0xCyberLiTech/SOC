#!/usr/bin/env python3
# /opt/clt/proto-live.py — Protocoles nginx temps réel (fenêtre 5 min)
# Version : 2.0.0 — 2026-03-11

import re, json, os
from datetime import datetime, timezone, timedelta

LOG_FILE   = '/var/log/nginx/access.log'
OUT_FILE   = '/var/www/monitoring/proto-live.json'
WINDOW_MIN = 5

LOG_RE = re.compile(
    r'^(?P<ip>\S+) \[(?P<time>[^\]]+)\] "(?P<request>[^"]+)" '
    r'(?P<status>\d{3}) (?P<bytes>\d+) "(?:[^"]*)" "(?P<ua>[^"]*)" country=(?P<country>\S+)'
    r'(?: scheme=(?P<scheme>\S+))?'
)
SCANNER_RE = re.compile(r'masscan|zgrab|nuclei|nikto|sqlmap|nmap|dirbuster|gobuster|hydra|metasploit|burpsuite|acunetix|nessus|openvas|wfuzz|ffuf|feroxbuster|curl/|python-requests|Go-http-client|libwww-perl', re.I)
LEGIT_BOTS = re.compile(r'Googlebot|Bingbot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|WhatsApp', re.I)
BOT_RE     = re.compile(r'bot|crawl|spider|slurp', re.I)
STATIC_RE  = re.compile(r'\.(css|js|png|jpg|jpeg|gif|ico|woff2?|svg|webp|ttf)(\?|$)', re.I)

def classify(status, ua, path, scheme):
    if status == 444:                                    return 'CLOSED'
    if status == 429:                                    return 'RATE_LIMIT'
    if status == 403:                                    return 'GEO_BLOCK'
    if SCANNER_RE.search(ua) and not LEGIT_BOTS.search(ua): return 'SCANNER'
    if LEGIT_BOTS.search(ua):                            return 'LEGIT_BOT'
    if BOT_RE.search(ua):                                return 'BOT'
    if scheme == 'http' or status in (301, 302):         return 'HTTP'
    if status == 404:                                    return 'NOT_FOUND'
    if status >= 500:                                    return 'ERROR_5XX'
    if STATIC_RE.search(path):                           return 'ASSETS'
    if 200 <= status < 300:                              return 'HTTPS'
    return 'OTHER'

cutoff = datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MIN)
proto, total, rps = {}, 0, {}

try:
    with open(LOG_FILE, 'rb') as f:
        f.seek(0, 2); size = f.tell()
        f.seek(max(0, size - 131072))
        raw = f.read().decode('utf-8', errors='replace')
    for line in raw.splitlines():
        m = LOG_RE.match(line)
        if not m: continue
        try: ts = datetime.strptime(m.group('time'), '%d/%b/%Y:%H:%M:%S %z')
        except ValueError: continue
        if ts < cutoff: continue
        status = int(m.group('status'))
        ua     = m.group('ua') or ''
        req    = m.group('request') or ''
        parts  = req.split()
        path   = parts[1] if len(parts) >= 2 else ''
        scheme = m.group('scheme') or ''
        key = classify(status, ua, path, scheme)
        proto[key] = proto.get(key, 0) + 1
        total += 1
        b = ts.strftime('%H:%M')
        rps[b] = rps.get(b, 0) + 1
except FileNotFoundError:
    pass

rpm = round(total / WINDOW_MIN, 1) if total > 0 else 0
out = {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'window_min': WINDOW_MIN, 'total': total, 'rpm': rpm,
    'proto': proto,
    'rpm_buckets': dict(sorted(rps.items())[-WINDOW_MIN:]),
}
tmp = OUT_FILE + '.tmp'
with open(tmp, 'w') as f: json.dump(out, f, separators=(',', ':'))
os.replace(tmp, OUT_FILE); os.chmod(OUT_FILE, 0o644)
try:
    import shutil; shutil.chown(OUT_FILE, 'www-data', 'www-data')
except (PermissionError, LookupError, OSError): pass
