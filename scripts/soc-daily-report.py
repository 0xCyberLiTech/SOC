#!/usr/bin/env python3
# <SCRIPTS-DIR>/soc-daily-report.py — Rapport quotidien SOC 0xCyberLiTech
# Version : 2.5.0
# Date    : 2026-03-31
# Usage   : python3 <SCRIPTS-DIR>/soc-daily-report.py
# Cron    : 0 8 * * * root python3 <SCRIPTS-DIR>/soc-daily-report.py

import json, os, re, configparser, smtplib
from html import escape as he
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

MONITORING_JSON = '/var/www/monitoring/monitoring.json'
ALERT_CONF      = '<SCRIPTS-DIR>/alert.conf'
DASHBOARD_URL   = 'http://<SRV-NGIX-IP>:8080/'

# IPs internes à exclure des listes d'attaquants
_LAN_RE = re.compile(r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)')

def load_conf():
    if not os.path.exists(ALERT_CONF):
        print('[REPORT] alert.conf introuvable'); return None
    cfg = configparser.ConfigParser()
    cfg.read(ALERT_CONF)
    return cfg['smtp'] if 'smtp' in cfg else None

def send_report(cfg, subject, html_body, text_body):
    try:
        recipients = [a.strip() for a in cfg['to'].split(',') if a.strip()]
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = f"SOC 0xCyberLiTech <{cfg['login']}>"
        msg['To']      = ', '.join(recipients)
        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html',  'utf-8'))
        with smtplib.SMTP(cfg['host'], int(cfg['port']), timeout=15) as s:
            s.ehlo(); s.starttls(); s.ehlo()
            s.login(cfg['login'], cfg['password'])
            s.sendmail(cfg['login'], recipients, msg.as_string())
        print(f'[REPORT] Rapport envoyé à {len(recipients)} destinataire(s) : {subject}')
    except Exception as e:
        print(f'[REPORT] Erreur mail : {e}')

# ── Helpers ──────────────────────────────────────────────────────────────────

def threat_info(kc, f2b, t, cs=None, sur=None):
    sc  = kc.get('stage_counts', {})
    csd = (cs or {}).get('active_decisions', 0)
    css = (cs or {}).get('stage_counts', {})
    sur = sur or {}
    sev1 = sur.get('sev1_critical', 0) if sur.get('available') else 0
    # CRITIQUE : exploit actif non bloqué OU Suricata sévérité 1
    exploit_unblocked = [ip for ip in kc.get('active_ips', [])
                         if ip.get('stage') == 'EXPLOIT' and not ip.get('cs_decision')]
    if exploit_unblocked or sev1 > 0:
        return ('CRITIQUE', '#ef4444', '#2d0a0a')
    if f2b.get('total_banned', 0) > 10 or csd > 10:
        return ('ÉLEVÉ',   '#ef4444', '#2d0a0a')
    # MODÉRÉ : scan/brute actif ou bans CS présents
    if sc.get('SCAN', 0) > 0 or sc.get('BRUTE', 0) > 0 or css.get('BRUTE', 0) > 0:
        return ('MODÉRÉ',  '#f59e0b', '#2d1f00')
    if f2b.get('total_banned', 0) > 0 or csd > 0:
        return ('MODÉRÉ',  '#f59e0b', '#2d1f00')
    if t.get('geo_blocks', 0) > 100:
        return ('FAIBLE',  '#3b82f6', '#0a1528')
    return     ('NOMINAL', '#22c55e', '#0a1f0a')

def _pct_bar(val, warn=70, crit=90):
    try:
        v = float(val)
    except (TypeError, ValueError):
        return f'<span style="color:#6b7280">N/A</span>'
    color = '#22c55e' if v < warn else ('#f59e0b' if v < crit else '#ef4444')
    return (
        f'<div style="display:flex;align-items:center;gap:8px">'
        f'<div style="flex:1;height:6px;background:#1e3a5f;border-radius:3px">'
        f'<div style="width:{min(v,100):.0f}%;height:100%;background:{color};border-radius:3px"></div>'
        f'</div>'
        f'<span style="color:{color};font-weight:700;min-width:38px;text-align:right">{v:.1f}%</span>'
        f'</div>'
    )

def _section(title, content, icon=''):
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border-collapse:collapse">'
        f'<tr><td style="background:#0f1e35;border-left:3px solid #00d9ff;'
        f'padding:6px 12px;font-size:10px;font-weight:700;color:#00d9ff;'
        f'letter-spacing:2px;text-transform:uppercase">{icon}{title}</td></tr>'
        f'<tr><td style="background:#0b1628;padding:14px 16px;border:1px solid #1e3a5f;'
        f'border-top:none">{content}</td></tr>'
        f'</table>'
    )

def _kv(label, value, color='#dde8f5'):
    return (
        f'<tr>'
        f'<td style="color:#7a9ab8;padding:4px 0;font-size:12px;width:190px;vertical-align:top">{label}</td>'
        f'<td style="color:{color};font-weight:700;padding:4px 0;font-size:13px">{value}</td>'
        f'</tr>'
    )

def _badge(text, color, bg):
    return (
        f'<span style="background:{bg};color:{color};border:1px solid {color};'
        f'border-radius:3px;padding:1px 7px;font-size:11px;font-weight:700;letter-spacing:1px">{text}</span>'
    )

_STAGE_CSS = {
    'RECON':   ('#3b82f6', '#0a1528'),
    'SCAN':    ('#f59e0b', '#2d1f00'),
    'EXPLOIT': ('#ef4444', '#2d0a0a'),
    'BRUTE':   ('#bf5fff', '#1a0d2e'),
}

# ── Sections HTML ─────────────────────────────────────────────────────────────

def _html_trafic(t):
    total = t.get('total_requests', 0)
    geo   = t.get('geo_blocks', 0)
    pct   = round(geo / max(total, 1) * 100, 1)
    s2    = t.get('status_2xx', 0)
    s3    = t.get('status_3xx', 0)
    s4    = t.get('status_4xx', 0)
    s5    = t.get('status_5xx', 0)
    bots  = t.get('bots', 0)
    err_r = t.get('error_rate', 0)
    vol   = round(t.get('total_bytes', 0) / 1024 / 1024, 1)

    codes = (
        f'<table cellpadding="0" cellspacing="0" style="margin-top:10px;width:100%"><tr>'
        f'<td style="text-align:center;padding:6px 4px">'
        f'<div style="color:#22c55e;font-size:14px;font-weight:700">{s2:,}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">2xx OK</div></td>'
        f'<td style="text-align:center;padding:6px 4px">'
        f'<div style="color:#3b82f6;font-size:14px;font-weight:700">{s3:,}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">3xx REDIR</div></td>'
        f'<td style="text-align:center;padding:6px 4px">'
        f'<div style="color:#f59e0b;font-size:14px;font-weight:700">{s4:,}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">4xx ERR</div></td>'
        f'<td style="text-align:center;padding:6px 4px">'
        f'<div style="color:#ef4444;font-size:14px;font-weight:700">{s5:,}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">5xx CRIT</div></td>'
        f'</tr></table>'
    )

    rows = (
        f'<table width="100%" cellpadding="0" cellspacing="0">'
        + _kv('Requêtes totales', f'{total:,}')
        + _kv('Bloquées GeoIP', f'{geo:,} <span style="color:#7a9ab8;font-size:11px">({pct}%)</span>', '#f59e0b')
        + _kv('Visiteurs uniques', f'{t.get("unique_visitors",0):,}', '#00d9ff')
        + _kv('Bots détectés', f'{bots:,}', '#bf5fff' if bots > 0 else '#22c55e')
        + _kv('Taux d\'erreur', f'{err_r}%', '#ef4444' if float(err_r or 0) > 1 else '#22c55e')
        + _kv('Volume transféré', f'{vol} Mo')
        + '</table>'
        + codes
    )
    return rows

def _html_nginx(t):
    proto = t.get('proto_breakdown', {})
    countries = t.get('top_countries', [])[:5]
    top_pages = t.get('top_pages', [])[:5]

    proto_rows = ''
    for k, v in sorted(proto.items(), key=lambda x: -x[1]):
        bar_w = min(int(v / max(sum(proto.values()), 1) * 100), 100)
        proto_rows += (
            f'<tr>'
            f'<td style="color:#7a9ab8;font-size:11px;padding:3px 0;width:120px">{he(k)}</td>'
            f'<td style="padding:3px 8px">'
            f'<div style="height:5px;background:#1e3a5f;border-radius:3px">'
            f'<div style="width:{bar_w}%;height:100%;background:#00d9ff;border-radius:3px;opacity:.7"></div>'
            f'</div></td>'
            f'<td style="color:#dde8f5;font-size:12px;font-weight:700;text-align:right;padding:3px 0;white-space:nowrap">{v:,}</td>'
            f'</tr>'
        )

    country_rows = ''
    for c in countries:
        # format [code, count] ou {country, count}
        if isinstance(c, (list, tuple)):
            c_name, c_cnt = c[0], c[1]
        else:
            c_name, c_cnt = c.get('country','?'), c.get('count',0)
        country_rows += (
            f'<tr>'
            f'<td style="color:#dde8f5;font-size:12px;padding:3px 8px;border-bottom:1px solid #1e3a5f">'
            f'{he(str(c_name))}</td>'
            f'<td style="color:#00d9ff;font-size:12px;font-weight:700;text-align:right;padding:3px 8px;border-bottom:1px solid #1e3a5f">'
            f'{c_cnt:,}</td>'
            f'</tr>'
        )

    page_rows = ''
    for p in top_pages:
        # format [url, count] ou {url, count}
        if isinstance(p, (list, tuple)):
            p_url, p_cnt = p[0], p[1]
        else:
            p_url, p_cnt = p.get('url','?'), p.get('count',0)
        p_short = p_url[:38] + '…' if len(p_url) > 38 else p_url
        page_rows += (
            f'<tr>'
            f'<td style="color:#7a9ab8;font-size:11px;font-family:monospace;padding:3px 8px;'
            f'border-bottom:1px solid #1e3a5f;word-break:break-all">{he(p_short)}</td>'
            f'<td style="color:#dde8f5;font-size:12px;font-weight:700;text-align:right;padding:3px 8px;'
            f'border-bottom:1px solid #1e3a5f;white-space:nowrap">{p_cnt:,}</td>'
            f'</tr>'
        )

    return (
        f'<table width="100%" cellpadding="0" cellspacing="0">'
        f'<tr valign="top">'
        f'<td width="48%" style="padding-right:12px">'
        f'<div style="color:#7a9ab8;font-size:10px;letter-spacing:1px;margin-bottom:6px">PROTOCOLES</div>'
        f'<table width="100%" cellpadding="0" cellspacing="0">{proto_rows}</table>'
        f'</td>'
        f'<td width="24%" style="padding-right:12px">'
        f'<div style="color:#7a9ab8;font-size:10px;letter-spacing:1px;margin-bottom:6px">TOP PAYS</div>'
        f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">{country_rows}</table>'
        f'</td>'
        f'<td width="28%">'
        f'<div style="color:#7a9ab8;font-size:10px;letter-spacing:1px;margin-bottom:6px">TOP PAGES</div>'
        f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">{page_rows}</table>'
        f'</td>'
        f'</tr></table>'
    )

def _html_f2b(f2b):
    jails_rows = ''
    for j in f2b.get('jails', []):
        banned = j.get('cur_banned', 0)
        col    = '#ef4444' if banned > 0 else '#22c55e'
        st_txt = f'ACTIF ({banned})' if banned > 0 else 'CLEAN'
        ips_html = ''
        if j.get('banned_ips'):
            parts = []
            for ip in j['banned_ips']:
                if isinstance(ip, dict):
                    parts.append(f'<span style="color:#ef4444">{he(str(ip["ip"]))}</span>'
                                 f'<span style="color:#7a9ab8"> ({he(str(ip.get("country","-")))})</span>')
                else:
                    parts.append(f'<span style="color:#ef4444">{he(str(ip))}</span>')
            ips_html = '<br><span style="font-size:10px">' + ' &nbsp;·&nbsp; '.join(parts) + '</span>'
        jails_rows += (
            f'<tr>'
            f'<td style="color:#dde8f5;padding:5px 8px;font-size:12px;border-bottom:1px solid #1e3a5f">'
            f'{he(str(j["jail"]))}{ips_html}</td>'
            f'<td style="color:{col};padding:5px 8px;font-size:12px;font-weight:700;'
            f'text-align:right;border-bottom:1px solid #1e3a5f;white-space:nowrap">{st_txt}</td>'
            f'</tr>'
        )
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px">'
        + _kv('IPs bannies actives',
              str(f2b.get('total_banned', 0)),
              '#ef4444' if f2b.get('total_banned', 0) > 0 else '#22c55e')
        + _kv('Échecs (cumul)', str(f2b.get('total_failed', 0)))
        + '</table>'
        + f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        + f'<tr style="background:#0f1e35">'
        + f'<th style="color:#7a9ab8;padding:4px 8px;font-size:10px;text-align:left;font-weight:600;letter-spacing:1px">JAIL</th>'
        + f'<th style="color:#7a9ab8;padding:4px 8px;font-size:10px;text-align:right;font-weight:600;letter-spacing:1px">STATUT</th>'
        + f'</tr>' + jails_rows + '</table>'
    )

def _html_crowdsec(cs):
    if not cs or not cs.get('available'):
        return '<p style="color:#7a9ab8;margin:0;font-size:12px">CrowdSec non disponible</p>'
    csd  = cs.get('active_decisions', 0)
    csa  = cs.get('alerts_24h', 0)
    psr  = cs.get('parser_stats', {})
    lp   = psr.get('lines_read', 0)
    sc   = cs.get('stage_counts', {})
    scs  = cs.get('scenarios', [])
    tips = cs.get('top_ips', [])

    col_d = '#ef4444' if csd > 0 else '#22c55e'
    # Stats
    html = (
        f'<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px"><tr>'
        f'<td style="text-align:center;padding:8px 4px;background:#0f1e35;border-radius:4px;margin:2px">'
        f'<div style="color:{col_d};font-size:16px;font-weight:700">{csd}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">DÉCISIONS ACTIVES</div></td>'
        f'<td width="8"></td>'
        f'<td style="text-align:center;padding:8px 4px;background:#0f1e35;border-radius:4px">'
        f'<div style="color:#f59e0b;font-size:16px;font-weight:700">{csa}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">ALERTES 24H</div></td>'
        f'<td width="8"></td>'
        f'<td style="text-align:center;padding:8px 4px;background:#0f1e35;border-radius:4px">'
        f'<div style="color:#00d9ff;font-size:16px;font-weight:700">{lp:,}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">LIGNES ANALYSÉES</div></td>'
        f'</tr></table>'
    )
    # Kill Chain stages CrowdSec
    html += '<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px;margin-bottom:6px">KILL CHAIN — SCÉNARIOS 24H</div>'
    html += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px"><tr>'
    for stage in ('RECON', 'SCAN', 'EXPLOIT', 'BRUTE'):
        v = sc.get(stage, 0)
        c, bg = _STAGE_CSS[stage]
        col = c if v > 0 else '#2e4a6a'
        html += (
            f'<td style="text-align:center;padding:6px 2px;background:#0f1e35;border-radius:3px">'
            f'<div style="color:{col};font-size:13px;font-weight:700">{v}</div>'
            f'<div style="color:#2e4a6a;font-size:8px;letter-spacing:.5px">{stage}</div></td>'
            f'<td width="4"></td>'
        )
    html += '</tr></table>'
    # Top scénarios
    if scs:
        sc_max = scs[0].get('count', 1)
        html += '<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px;margin-bottom:6px">TOP SCÉNARIOS</div>'
        for s in scs[:5]:
            c, _ = _STAGE_CSS.get(s.get('stage', 'RECON'), ('#3b82f6', ''))
            pct = min(int(s.get('count', 0) * 100 / max(sc_max, 1)), 100)
            html += (
                f'<div style="margin-bottom:5px">'
                f'<table width="100%" cellpadding="0" cellspacing="0"><tr>'
                f'<td style="color:#00d9ff;font-size:10px;font-family:monospace">{he(str(s.get("name","")))}</td>'
                f'<td style="text-align:right;white-space:nowrap">'
                f'<span style="color:{c};font-size:9px;font-weight:700">{he(str(s.get("stage","")))}</span>'
                f'&nbsp;<span style="color:#f59e0b;font-size:11px;font-weight:700">{s.get("count",0)}</span>'
                f'</td></tr></table>'
                f'<div style="height:2px;background:#1e3a5f;border-radius:1px">'
                f'<div style="width:{pct}%;height:2px;background:{c};border-radius:1px;opacity:.7"></div></div>'
                f'</div>'
            )
    # IPs bannies
    if tips:
        html += '<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px;margin-top:10px;margin-bottom:6px">IPS BANNIES ACTIVES</div>'
        html += '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        for e in tips[:6]:
            c, _ = _STAGE_CSS.get(e.get('stage', 'RECON'), ('#3b82f6', ''))
            cc = f'[{he(str(e["country"]))}]' if e.get('country') and e['country'] != '-' else ''
            html += (
                f'<tr style="border-bottom:1px solid #1e3a5f">'
                f'<td style="color:#ff6b35;font-size:11px;font-family:monospace;padding:4px 6px">{he(str(e.get("ip","")))}</td>'
                f'<td style="color:#7a9ab8;font-size:10px;padding:4px 4px">{cc}</td>'
                f'<td style="padding:4px 4px">{_badge(he(str(e.get("stage",""))), c, _STAGE_CSS.get(e.get("stage",""), ("#3b82f6",""))[1])}</td>'
                f'<td style="color:#7a9ab8;font-size:10px;padding:4px 6px;text-align:right">{he(str(e.get("duration","")))}</td>'
                f'</tr>'
            )
        html += '</table>'
    elif csd == 0:
        html += '<p style="color:#22c55e;margin:8px 0 0;font-size:12px">&#10003; Surveillance active — aucune IP bannie</p>'
    return html

def _html_suricata(sur):
    if not sur or not sur.get('available'):
        return '<p style="color:#7a9ab8;margin:0;font-size:12px">Suricata non disponible ou aucune alerte 24h</p>'
    total = sur.get('total_alerts', 0)
    sev1  = sur.get('sev1_critical', 0)
    sev2  = sur.get('sev2_high', 0)
    sev3  = sur.get('sev3_medium', 0)
    tips  = sur.get('top_ips', [])
    tsigs = sur.get('top_signatures', [])

    col1 = '#ef4444' if sev1 > 0 else '#22c55e'
    col2 = '#f59e0b' if sev2 > 0 else '#22c55e'

    html = (
        f'<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px"><tr>'
        f'<td style="text-align:center;padding:8px 4px;background:#0f1e35;border-radius:4px">'
        f'<div style="color:#f59e0b;font-size:16px;font-weight:700">{total}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">ALERTES 24H</div></td>'
        f'<td width="6"></td>'
        f'<td style="text-align:center;padding:8px 4px;background:#0f1e35;border-radius:4px">'
        f'<div style="color:{col1};font-size:16px;font-weight:700">{sev1}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">SÉV.1 CRITIQUE</div></td>'
        f'<td width="6"></td>'
        f'<td style="text-align:center;padding:8px 4px;background:#0f1e35;border-radius:4px">'
        f'<div style="color:{col2};font-size:16px;font-weight:700">{sev2}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">SÉV.2 ÉLEVÉE</div></td>'
        f'<td width="6"></td>'
        f'<td style="text-align:center;padding:8px 4px;background:#0f1e35;border-radius:4px">'
        f'<div style="color:#3b82f6;font-size:16px;font-weight:700">{sev3}</div>'
        f'<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px">SÉV.3 MOYENNE</div></td>'
        f'</tr></table>'
    )
    if sev1 > 0:
        html += (
            f'<div style="background:#2d0a0a;border:1px solid #ef4444;border-radius:3px;'
            f'padding:6px 10px;margin-bottom:10px;font-size:11px;color:#ef4444">'
            f'&#9888; {sev1} alerte(s) critique(s) sévérité 1 — exploit actif détecté'
            f'</div>'
        )
    if tips:
        html += '<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px;margin-bottom:6px">TOP IPs ATTAQUANTES</div>'
        html += '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        for e in tips[:5]:
            html += (
                f'<tr style="border-bottom:1px solid #1e3a5f">'
                f'<td style="color:#ff6b35;font-size:11px;font-family:monospace;padding:3px 6px">{he(str(e.get("ip","")))}</td>'
                f'<td style="color:#f59e0b;font-size:11px;font-weight:700;text-align:right;padding:3px 6px">{e.get("count",0)} alertes</td>'
                f'</tr>'
            )
        html += '</table>'
    if tsigs:
        html += '<div style="color:#7a9ab8;font-size:9px;letter-spacing:1px;margin-top:10px;margin-bottom:6px">TOP SIGNATURES</div>'
        html += '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
        for s in tsigs[:5]:
            sig_raw = s.get('sig', '')
            sig_short = he(sig_raw[:55] + ('…' if len(sig_raw) > 55 else ''))
            html += (
                f'<tr style="border-bottom:1px solid #1e3a5f">'
                f'<td style="color:#dde8f5;font-size:10px;font-family:monospace;padding:3px 6px">{sig_short}</td>'
                f'<td style="color:#f59e0b;font-size:11px;font-weight:700;text-align:right;padding:3px 6px;white-space:nowrap">{s.get("count",0)}</td>'
                f'</tr>'
            )
        html += '</table>'
    return html

def _html_killchain(kc):
    sc   = kc.get('stage_counts', {})
    rows = ''
    any_kc = False
    for stage in ('RECON', 'SCAN', 'EXPLOIT', 'BRUTE'):
        v = sc.get(stage, 0)
        if v > 0:
            any_kc = True
            c, bg = _STAGE_CSS[stage]
            rows += (
                f'<tr>'
                f'<td style="padding:5px 8px;border-bottom:1px solid #1e3a5f">'
                f'{_badge(stage, c, bg)}</td>'
                f'<td style="color:#dde8f5;padding:5px 8px;font-size:13px;font-weight:700;'
                f'text-align:right;border-bottom:1px solid #1e3a5f">{v} IP(s)</td>'
                f'</tr>'
            )
    if not any_kc:
        return '<p style="color:#22c55e;margin:0;font-size:13px">&#10003; Aucune activité offensive détectée</p>'
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">{rows}</table>'

def _html_attackers(kc):
    top = [ip for ip in kc.get('active_ips', []) if not _LAN_RE.match(ip.get('ip', ''))][:5]
    if not top:
        return '<p style="color:#22c55e;margin:0;font-size:13px">&#10003; Aucun attaquant externe actif</p>'
    rows = ''
    for ip in top:
        stage = ip.get('stage', '?')
        c, bg = _STAGE_CSS.get(stage, ('#7a9ab8', '#0b1628'))
        rows += (
            f'<tr>'
            f'<td style="color:#00d9ff;padding:5px 8px;font-size:12px;font-family:monospace;'
            f'border-bottom:1px solid #1e3a5f">{he(str(ip.get("ip","?")))}</td>'
            f'<td style="padding:5px 8px;border-bottom:1px solid #1e3a5f">{_badge(he(stage),c,bg)}</td>'
            f'<td style="color:#7a9ab8;padding:5px 8px;font-size:12px;text-align:right;'
            f'border-bottom:1px solid #1e3a5f">{he(str(ip.get("country","-")))}</td>'
            f'</tr>'
        )
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">{rows}</table>'

def _html_services(svcs):
    rows = ''
    if isinstance(svcs, dict):
        for name, info in svcs.items():
            up  = info.get('status') == 'UP'
            col = '#22c55e' if up else '#ef4444'
            rows += (
                f'<tr>'
                f'<td style="color:#dde8f5;padding:5px 8px;font-size:13px;border-bottom:1px solid #1e3a5f">{he(str(name))}</td>'
                f'<td style="color:{col};padding:5px 8px;font-weight:700;text-align:center;border-bottom:1px solid #1e3a5f">'
                f'{"● UP" if up else "● DOWN"}</td>'
                f'<td style="color:#7a9ab8;padding:5px 8px;font-size:12px;text-align:right;border-bottom:1px solid #1e3a5f">'
                f'{he(str(info.get("ms","?")))} ms</td>'
                f'</tr>'
            )
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">{rows}</table>'

def _html_ssl(ssl_l):
    rows = ''
    for c in ssl_l:
        d_left = c.get('days_left', '?')
        ok     = isinstance(d_left, int) and d_left > 30
        col    = '#22c55e' if ok else ('#f59e0b' if isinstance(d_left, int) and d_left > 7 else '#ef4444')
        rows += (
            f'<tr>'
            f'<td style="color:#dde8f5;padding:5px 8px;font-size:13px;border-bottom:1px solid #1e3a5f">{he(str(c.get("domain","?")))}</td>'
            f'<td style="color:{col};padding:5px 8px;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #1e3a5f">{he(str(d_left))} j</td>'
            f'<td style="color:#7a9ab8;padding:5px 8px;font-size:12px;text-align:right;border-bottom:1px solid #1e3a5f">{he(str(c.get("expiry","?")))}</td>'
            f'</tr>'
        )
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">{rows}</table>'

def _html_system(sys_):
    mem  = sys_.get('memory', {})
    disk = sys_.get('disk', {})
    load = sys_.get('load', {})
    return (
        f'<table width="100%" cellpadding="0" cellspacing="0">'
        f'<tr><td style="color:#7a9ab8;padding:5px 0;font-size:12px;width:80px">CPU</td>'
        f'<td style="padding:5px 0">{_pct_bar(sys_.get("cpu_pct", 0))}</td></tr>'
        f'<tr><td style="color:#7a9ab8;padding:5px 0;font-size:12px">RAM</td>'
        f'<td style="padding:5px 0">{_pct_bar(mem.get("pct", 0), 75, 90)}'
        f'<span style="color:#7a9ab8;font-size:10px"> {mem.get("used_mb","?")} / {mem.get("total_mb","?")} Mo</span></td></tr>'
        f'<tr><td style="color:#7a9ab8;padding:5px 0;font-size:12px">Disk</td>'
        f'<td style="padding:5px 0">{_pct_bar(disk.get("pct", 0), 70, 85)}'
        f'<span style="color:#7a9ab8;font-size:10px"> {disk.get("used_gb","?")} / {disk.get("total_gb","?")} Go</span></td></tr>'
        f'<tr><td style="color:#7a9ab8;padding:5px 0;font-size:12px">Load</td>'
        f'<td style="color:#dde8f5;padding:5px 0;font-size:13px;font-weight:700">'
        f'{he(str(load.get("1m","?")))} <span style="color:#7a9ab8;font-size:11px">(1m)</span> &nbsp;'
        f'{he(str(load.get("5m","?")))} <span style="color:#7a9ab8;font-size:11px">(5m)</span> &nbsp;'
        f'{he(str(load.get("15m","?")))} <span style="color:#7a9ab8;font-size:11px">(15m)</span></td></tr>'
        f'<tr><td style="color:#7a9ab8;padding:5px 0;font-size:12px">Uptime</td>'
        f'<td style="color:#22c55e;padding:5px 0;font-size:13px;font-weight:700">{he(str(sys_.get("uptime","?")))}</td></tr>'
        f'</table>'
    )

# ── Build HTML complet ────────────────────────────────────────────────────────

def build_html(d):
    now   = datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M UTC')
    t     = d.get('traffic', {})
    f2b   = d.get('fail2ban', {})
    svcs  = d.get('services', {})
    ssl_l = d.get('ssl', [])
    sys_  = d.get('system', {})
    kc    = d.get('kill_chain', {})
    cs    = d.get('crowdsec', {})
    sur   = d.get('suricata', {})

    t_label, t_color, t_bg = threat_info(kc, f2b, t, cs, sur)

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SOC Report — 0xCyberLiTech</title></head>
<body style="margin:0;padding:0;background:#060e1a;font-family:'Courier New',Courier,monospace">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060e1a;padding:24px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0d1525 0%,#0f2040 100%);
    border:1px solid #00d9ff;border-bottom:3px solid #00d9ff;
    padding:22px 24px;border-radius:6px 6px 0 0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="color:#00d9ff;font-size:20px;font-weight:700;letter-spacing:3px">
            [ 0xCyberLiTech ]
          </div>
          <div style="color:#7a9ab8;font-size:10px;letter-spacing:2px;margin-top:3px">
            SOC MONITORING — RAPPORT QUOTIDIEN
          </div>
        </td>
        <td align="right" valign="top">
          <div style="background:{t_bg};border:1px solid {t_color};border-radius:4px;
            padding:6px 14px;display:inline-block;text-align:center">
            <div style="color:#7a9ab8;font-size:9px;letter-spacing:2px;margin-bottom:3px">NIVEAU MENACE</div>
            <div style="color:{t_color};font-size:15px;font-weight:700;letter-spacing:2px">{t_label}</div>
          </div>
        </td>
      </tr>
    </table>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #1e3a5f">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#7a9ab8;font-size:11px">&#128197; {now}</td>
          <td style="color:#7a9ab8;font-size:11px;text-align:right">srv-ngix &middot; <SRV-NGIX-IP></td>
        </tr>
      </table>
    </div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#0b1628;padding:18px 20px;border:1px solid #1e3a5f;border-top:none;border-bottom:none">

    {_section('Trafic nginx 24h', _html_trafic(t))}
    {_section('Nginx — protocoles &amp; géographie', _html_nginx(t))}
    {_section('⊛ CrowdSec — Analyse comportementale', _html_crowdsec(cs))}
    {_section('Fail2ban — sshd', _html_f2b(f2b))}
    {_section('◈ IDS Réseau — Suricata 7', _html_suricata(sur))}
    {_section('Cyber Kill Chain — attaques actives (15 min)', _html_killchain(kc))}
    {_section('Top attaquants externes', _html_attackers(kc))}
    {_section('Services web', _html_services(svcs))}
    {_section('Certificats SSL', _html_ssl(ssl_l))}
    {_section('Système — srv-ngix', _html_system(sys_))}

  </td></tr>

  <!-- FOOTER DASHBOARD -->
  <tr><td style="background:#0a1020;border:1px solid #1e3a5f;border-top:none;
    padding:0;border-radius:0 0 6px 6px;overflow:hidden">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#0f1e35;border-top:2px solid #00d9ff33;padding:14px 20px">
          <div style="color:#7a9ab8;font-size:9px;letter-spacing:2px;margin-bottom:6px">
            ACCÈS DASHBOARD SOC
          </div>
          <a href="{DASHBOARD_URL}"
             style="color:#00d9ff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px">
            &#9632; {DASHBOARD_URL}
          </a>
          <div style="color:#2e4a6a;font-size:10px;margin-top:4px">
            Accès LAN uniquement &mdash; <LAN-CIDR>
          </div>
        </td>
        <td align="right" style="background:#0f1e35;border-top:2px solid #00d9ff33;padding:14px 20px;white-space:nowrap">
          <div style="color:#2e4a6a;font-size:9px;letter-spacing:1px">0xCyberLiTech</div>
          <div style="color:#2e4a6a;font-size:9px">Rapport automatique &mdash; Ne pas répondre</div>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""

# ── Fallback texte ────────────────────────────────────────────────────────────

def build_text(d):
    now = datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M UTC')
    t   = d.get('traffic', {})
    f2b = d.get('fail2ban', {})
    cs  = d.get('crowdsec', {})
    sur = d.get('suricata', {})
    svcs= d.get('services', {})
    ssl_= d.get('ssl', [])
    sys_= d.get('system', {})
    kc  = d.get('kill_chain', {})
    sc  = kc.get('stage_counts', {})
    top = [ip for ip in kc.get('active_ips',[]) if not _LAN_RE.match(ip.get('ip',''))][:5]
    sep = '─' * 50
    mem = sys_.get('memory', {}); disk = sys_.get('disk', {}); load = sys_.get('load', {})
    lines = [
        'SOC 0xCyberLiTech — Rapport quotidien',
        f'Généré le {now} — srv-ngix (<SRV-NGIX-IP>)', '',
        f'NIVEAU MENACE : {threat_info(kc,f2b,t,cs,sur)[0]}', '',
        sep, 'TRAFIC 24H', sep,
        f'  Requêtes totales  : {t.get("total_requests",0):,}',
        f'  Bloquées GeoIP    : {t.get("geo_blocks",0):,}',
        f'  2xx/3xx/4xx/5xx   : {t.get("status_2xx",0)} / {t.get("status_3xx",0)} / {t.get("status_4xx",0)} / {t.get("status_5xx",0)}',
        f'  Bots              : {t.get("bots",0):,}',
        f'  Visiteurs uniques : {t.get("unique_visitors",0):,}',
        f'  Volume            : {round(t.get("total_bytes",0)/1024/1024,1)} Mo',
        '', sep, 'CROWDSEC', sep,
        f'  Décisions actives : {cs.get("active_decisions",0)}',
        f'  Alertes 24h       : {cs.get("alerts_24h",0)}',
        f'  Lignes analysées  : {(cs.get("parser_stats") or {}).get("lines_read",0):,}',
    ]
    cs_sc = cs.get('stage_counts', {})
    for stage in ('RECON', 'SCAN', 'EXPLOIT', 'BRUTE'):
        v = cs_sc.get(stage, 0)
        if v > 0:
            lines.append(f'  {stage:<12} {v} alerte(s)')
    for e in cs.get('top_ips', [])[:5]:
        cc = e.get('country', '-')
        lines.append(f'  {e.get("ip",""):<18} [{cc}]  {e.get("stage",""):<8}  {e.get("scenario","")[:30]}')
    lines += ['', sep, 'FAIL2BAN (sshd)', sep,
        f'  IPs bannies : {f2b.get("total_banned",0)} — Échecs : {f2b.get("total_failed",0)}',
    ]
    for j in f2b.get('jails',[]):
        st = f'ACTIF ({j.get("cur_banned",0)})' if j.get('cur_banned',0)>0 else 'CLEAN'
        lines.append(f'  {j["jail"]:<22} {st}')
    lines += ['', sep, 'SURICATA IDS 24H', sep]
    if sur.get('available'):
        lines += [
            f'  Alertes totales   : {sur.get("total_alerts",0)}',
            f'  Sévérité 1 (CRIT) : {sur.get("sev1_critical",0)}',
            f'  Sévérité 2 (HIGH) : {sur.get("sev2_high",0)}',
            f'  Sévérité 3 (MED)  : {sur.get("sev3_medium",0)}',
        ]
        for e in sur.get('top_ips', [])[:3]:
            lines.append(f'  {e.get("ip",""):<18} {e.get("count",0)} alertes')
        for s in sur.get('top_signatures', [])[:3]:
            lines.append(f'  {s.get("sig","")[:50]}  ({s.get("count",0)})')
    else:
        lines.append('  Suricata non disponible')
    lines += ['', sep, 'KILL CHAIN (15 min)', sep]
    active = [(s, sc.get(s,0)) for s in ('RECON','SCAN','EXPLOIT','BRUTE') if sc.get(s,0)>0]
    lines += [f'  {s:<12} {v} IP(s)' for s,v in active] or ['  Aucune activité offensive']
    lines += ['', sep, 'TOP ATTAQUANTS', sep]
    lines += [f'  {ip.get("ip","?"):<18} {ip.get("stage","?"):<8} {ip.get("country","-")}' for ip in top] or ['  Aucun attaquant externe actif']
    lines += ['', sep, 'SERVICES', sep]
    if isinstance(svcs, dict):
        for name, info in svcs.items():
            lines.append(f'  [{"UP" if info.get("status")=="UP" else "DOWN"}] {name} ({info.get("ms","?")} ms)')
    lines += ['', sep, 'SSL', sep]
    for c in ssl_:
        lines.append(f'  {c.get("domain","?")} — {c.get("days_left","?")} j ({c.get("expiry","?")})')
    lines += ['', sep, 'SYSTÈME', sep,
        f'  CPU  : {sys_.get("cpu_pct","?")}%',
        f'  RAM  : {mem.get("used_mb","?")} / {mem.get("total_mb","?")} Mo ({mem.get("pct","?")}%)',
        f'  Disk : {disk.get("used_gb","?")} / {disk.get("total_gb","?")} Go ({disk.get("pct","?")}%)',
        f'  Load : {load.get("1m","?")} / {load.get("5m","?")} / {load.get("15m","?")}',
        f'  Uptime : {sys_.get("uptime","?")}',
        '', sep, f'Dashboard : {DASHBOARD_URL}', sep,
    ]
    return '\n'.join(lines)

def main():
    cfg = load_conf()
    if not cfg: return
    if not os.path.exists(MONITORING_JSON):
        print('[REPORT] monitoring.json introuvable'); return
    with open(MONITORING_JSON) as f:
        data = json.load(f)
    html_body = build_html(data)
    text_body = build_text(data)
    date_str  = datetime.now(timezone.utc).strftime('%d/%m/%Y')
    subject   = f"[SOC] Rapport quotidien 0xCyberLiTech — {date_str}"
    send_report(cfg, subject, html_body, text_body)

if __name__ == '__main__':
    main()
