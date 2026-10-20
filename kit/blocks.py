"""Building blocks for motion scenes in Joel's branding (cream #F4F1EA, terracotta #D97757, charcoal #1A1915, Inter Display).
A scene is dict(id, type="motion", start, end, seed, els=[...]); each element comes from T().
Times are ABSOLUTE seconds in the voice-over, so read them straight off sentences.json / words.json.

T(t, html, x, y, anim, d, out, ...) places html centred at (x, y) on the 1920x1080 frame, entering at t:
  anim: pop (springy scale), up, left, right, fade, drop (falls in with a bounce), stamp (slams in, rotated: rot=-12),
        type (typewriter: html has %T%, pass text= and d= typing seconds)
  d: entry duration; out: time it fades away; float=px gentle bob, ph=phase; spin=deg/s
  mt: time a .mark highlight sweep or .strike line draws (default t+0.35)
  hl=[t0, t1]: adds class "on" while t0<=T<t1 (with cls="step" a step card turns terracotta)
CSS classes available in html: .h1 (900 weight headline), .lab (small terracotta caps label), .pill (terracotta button),
  .card (white rounded card), <em> (terracotta words), <span class="mark"><i></i>word</span> (highlight sweep),
  <span class="strike"><b></b>word</span> (strike-through line). Escape apostrophes as &#39;."""
C = "translate(-50%,-50%)"

def T(t, html, x=960, y=540, anim="pop", d=0.5, out=None, style="", cls="", **kw):
    s = dict(t=t, html=html, anim=anim, d=d, style=f"left:{x}px;top:{y}px;{style}", cls=cls, base=C)
    if out is not None: s["out"] = out
    s.update(kw); return s

ICON = {
 "doc": '<svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#1A1915" stroke-width="1.6"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5"/><path d="M9 13h7M9 17h5"/></svg>',
 "ai": '<svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#1A1915" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/><path d="M8 11h6M11 8v6"/></svg>',
 "src": '<svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#D97757" stroke-width="1.8"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
 "ok": '<svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#1A1915" stroke-width="1.6"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M15 11l2 2 4-4"/></svg>',
 "dash": '<svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#1A1915" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/></svg>',
 "pdf": '<div style="width:120px;height:150px;background:#fff;border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.14);padding:16px"><div style="background:#D97757;color:#fff;font:800 22px Inter;border-radius:6px;padding:3px 8px;display:inline-block">PDF</div><div style="height:9px;background:#e6e1d8;border-radius:5px;margin:14px 0 8px"></div><div style="height:9px;background:#e6e1d8;border-radius:5px;width:70%;margin-bottom:8px"></div><div style="height:9px;background:#e6e1d8;border-radius:5px"></div></div>',
}

def grid_sheet():
    rows = "".join(f'<div style="display:flex;gap:8px;margin-bottom:8px">' + "".join(
        f'<div style="width:96px;height:30px;border-radius:6px;background:{"#D97757" if (r==0) else "#efe9df"}"></div>' for c in range(5)) + "</div>" for r in range(6))
    return f'<div class="card" style="padding:26px">{rows}</div>'

def step_card(n, icon, label):
    return (f'<div class="card" style="width:270px;height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px">'
            f'<div style="font:800 26px Inter;color:#D97757">{n}</div>{ICON[icon]}'
            f'<div class="h1" style="font-size:38px;text-align:center;line-height:1.05">{label}</div></div>')

def check_row(text, color="#D97757"):
    return (f'<div style="display:flex;align-items:center;gap:26px"><div style="width:74px;height:74px;border-radius:50%;background:{color};display:flex;align-items:center;justify-content:center">'
            f'<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2"><path d="M5 12l5 5 9-10"/></svg></div>'
            f'<div class="h1" style="font-size:76px">{text}</div></div>')

def warn_box(text):
    return f'<div style="background:#FBEEE8;border-left:10px solid #D97757;border-radius:20px;padding:24px 34px;width:560px" class="h1"><span style="font-size:52px">{text}</span></div>'

def safe_box(text):
    return f'<div style="background:#fff;border-left:10px solid #1A1915;border-radius:20px;padding:24px 34px;width:640px;box-shadow:0 10px 30px rgba(0,0,0,.08)" class="h1"><span style="font-size:52px">{text}</span></div>'

def tile(text):
    return f'<div class="card" style="width:400px;height:220px;display:flex;align-items:center;justify-content:center;text-align:center"><div class="h1" style="font-size:50px">{text}</div></div>'


def stamp(text, size=60):
    return (f'<div class="h1" style="font-size:{size}px;color:#D97757;border:8px solid #D97757;border-radius:18px;'
            f'padding:8px 30px;letter-spacing:.1em">{text}</div>')

def jo_circle(size=220):
    return (f'<div style="width:{size}px;height:{size}px;border-radius:50%;background:#D97757;color:#fff;display:flex;'
            f'align-items:center;justify-content:center" class="h1"><span style="font-size:{size // 2}px">JO</span></div>')

def end_card(t, name="Joel Osumah-Suleiman", line="AI that <em>does the work.</em>", pill="New build every Tuesday"):
    """the standard closing card: JO mark, full name, tagline, Tuesday pill"""
    return [T(t, jo_circle(240), 960, 300, d=0.6, float=8),
            T(t + 0.4, f'<div class="h1" style="font-size:84px;white-space:nowrap">{name}</div>', 960, 510, anim="up"),
            T(t + 0.8, f'<div class="h1" style="font-size:64px;white-space:nowrap">{line}</div>', 960, 610, anim="up"),
            T(t + 1.6, f'<div class="pill" style="font-size:44px">{pill}</div>', 960, 760, anim="pop", float=5)]

def name_card(t, tagline, pill="...in a week.", pill_t=None):
    """the standard 'I'm Joel' intro card"""
    return [T(t, jo_circle(220), 960, 300, d=0.6),
            T(t + 0.2, '<div class="h1" style="font-size:120px;white-space:nowrap">I&#39;m <em>Joel.</em></div>', 960, 500, anim="up"),
            T(t + 0.8, '<div class="h1" style="font-size:56px;white-space:nowrap">%T%</div>', 960, 640, anim="type", text=tagline, d=2.6),
            T(pill_t or t + 3.8, f'<div class="pill" style="font-size:52px">{pill}</div>', 960, 790, anim="pop")]

def ui(id, start, end, clip, clip_in, clip_out, chips):
    """a calm screen segment: repo clip [clip_in, clip_out] in a rounded window, sped to fit [start, end],
    slow push-in, terracotta caption chips [(text, absolute time), ...] at the bottom of the window"""
    return dict(id=id, type="ui", start=start, end=end, clip=clip, clip_in=clip_in, clip_out=clip_out, chips=chips)

def motion(id, start, end, els, seed=7):
    return dict(id=id, type="motion", start=start, end=end, seed=seed, els=els)
