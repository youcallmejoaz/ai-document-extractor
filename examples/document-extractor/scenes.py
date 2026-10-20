"""Scene plan for the AI Document Extractor video (20 Oct 2026). This is the worked example: copy it for a new build.
Every time is absolute seconds in the voice-over, read off build/align/sentences.json and words.json."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "kit"))
from blocks import *

MOTION = [
 motion("M01_intro", 0.0, 8.4, seed=3, els=[
   T(2.4, '<div class="h1" style="font-size:260px;color:#D97757">Hours</div>', 560, 330, d=0.6),
   T(3.2, '<div class="h1" style="font-size:96px">copying PDF quotes</div>', 600, 560, anim="up"),
   T(5.0, '<div class="h1" style="font-size:96px">into a <span class="mark"><i></i>spreadsheet?</span></div>', 640, 690, anim="up", mt=5.6),
   T(3.9, ICON["pdf"], 1260, 300, anim="drop", float=10),
   T(4.3, ICON["pdf"], 1420, 380, anim="drop", float=12, ph=1),
   T(4.7, ICON["pdf"], 1580, 300, anim="drop", float=9, ph=2),
   T(5.6, grid_sheet(), 1450, 720, anim="up"),
   T(7.0, '<div class="pill" style="font-size:44px">This is for you.</div>', 600, 900, anim="pop"),
 ]),
 motion("M02_name", 18.8, 24.6, seed=11, els=[
   T(19.1, '<div style="width:220px;height:220px;border-radius:50%;background:#D97757;color:#fff;display:flex;align-items:center;justify-content:center" class="h1"><span style="font-size:110px">JO</span></div>', 960, 300, d=0.6),
   T(19.3, '<div class="h1" style="font-size:120px;white-space:nowrap">I&#39;m <em>Joel.</em></div>', 960, 500, anim="up"),
   T(19.9, '<div class="h1" style="font-size:56px;white-space:nowrap;color:#1A1915">%T%</div>', 960, 640, anim="type", text="I build AI systems that take repetitive work off businesses", d=2.6),
   T(22.9, '<div class="pill" style="font-size:52px">...in a week.</div>', 960, 790, anim="pop"),
 ]),
 motion("M03_steps", 24.6, 43.8, seed=5, els=[
   T(25.3, '<div class="lab">SO HERE&#39;S THE THING</div>', 960, 120, anim="fade"),
   T(25.6, '<div class="h1" style="font-size:110px;white-space:nowrap"><em>5</em> simple steps</div>', 960, 240, anim="up"),
   T(28.2, step_card(1, "doc", "PDF in"), 280, 600, cls="step", hl=[28.2, 29.3]),
   T(29.3, step_card(2, "ai", "AI reads it"), 620, 600, cls="step", hl=[29.3, 32.4]),
   T(32.4, step_card(3, "src", "Shows the source"), 960, 600, cls="step", hl=[32.4, 34.5]),
   T(34.5, step_card(4, "ok", "Person approves"), 1300, 600, cls="step", hl=[34.5, 38.3]),
   T(38.3, step_card(5, "dash", "Saved to dashboard"), 1640, 600, cls="step", hl=[38.3, 41.7]),
   T(41.8, '<div class="pill" style="font-size:44px">Let me show you</div>', 960, 920, anim="pop", float=6),
 ]),
 motion("M05_receipt", 67.0, 75.25, seed=9, els=[
   T(67.0, '<div class="h1" style="font-size:150px;white-space:nowrap">Done in <em>seconds.</em></div>', 960, 520, d=0.45, out=68.6),
   T(68.8, '<div class="lab">NOW</div>', 960, 300, anim="fade", out=73.6),
   T(68.9, '<div class="h1" style="font-size:96px;text-align:center;white-space:nowrap">this is where it gets</div>', 960, 440, anim="up", out=73.6),
   T(72.2, '<div class="h1" style="font-size:150px"><span class="mark"><i></i><em>interesting.</em></span></div>', 960, 610, d=0.45, out=73.6, mt=72.5),
   T(73.8, '<div class="h1" style="font-size:96px;white-space:nowrap">Every value has a</div>', 760, 460, anim="up"),
   T(74.4, '<div class="h1" style="font-size:150px;color:#D97757">receipt.</div>', 760, 620, d=0.4),
   T(74.4, '<div style="width:420px;background:#fff;border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,.15);padding:30px;font:700 24px Inter;line-height:1.9;color:#6b655c">Premium &nbsp;4,812.50<br>Source &nbsp;&quot;&#163;4,812.50 GBP&quot;<br><span style="color:#D97757">Page 1</span><br><span style="letter-spacing:6px">- - - - - - - - -</span></div>', 1500, 560, anim="drop", float=8),
 ]),
 motion("M06_yes", 102.9, 110.5, seed=13, els=[
   T(103.0, '<div class="h1" style="font-size:84px;text-align:center;white-space:nowrap">Nothing is saved until a person says</div>', 960, 330, anim="up", out=105.1),
   T(104.3, '<div class="h1" style="font-size:220px;color:#fff;background:#D97757;border-radius:36px;padding:10px 60px">YES</div>', 960, 560, anim="stamp", d=0.4, out=105.1),
   T(105.3, '<div class="card" style="width:640px;text-align:center"><div class="lab">THE AI</div><div class="h1" style="font-size:82px;margin-top:14px">heavy lifting</div></div>', 560, 540, anim="left"),
   T(107.2, '<div class="card" style="width:640px;text-align:center;background:#1A1915;color:#F4F1EA"><div class="lab">YOUR TEAM</div><div class="h1" style="font-size:82px;margin-top:14px">in <em>control</em></div></div>', 1360, 540, anim="right"),
 ]),
 motion("M07_how", 126.1, 131.5, seed=17, els=[
   T(126.2, '<div class="lab">A QUICK LOOK AT</div>', 960, 360, anim="fade"),
   T(126.4, '<div class="h1" style="font-size:150px;white-space:nowrap">how I <em>work.</em></div>', 960, 500, anim="up"),
   T(129.6, '<div class="pill" style="font-size:50px;background:#1A1915">Built with Claude Code</div>', 960, 720, anim="pop", float=6),
 ]),
 motion("M08_honest", 144.3, 167.3, seed=19, els=[
   T(144.4, '<div class="h1" style="font-size:150px">Reliable.</div>', 960, 400, anim="up", out=149.4, mt=146.7),
   T(146.9, '<div class="h1" style="font-size:96px;white-space:nowrap">In <em>a week</em>, not <span class="strike"><b></b>months.</span></div>', 960, 600, anim="up", out=149.4, mt=148.2),
   T(149.7, '<div class="lab">LET&#39;S BE HONEST</div>', 960, 110, anim="fade"),
   T(151.3, '<div class="h1" style="font-size:64px;white-space:nowrap">It&#39;s not as easy as it sounds.</div>', 960, 210, anim="up"),
   T(154.2, warn_box("Blurry scans"), 560, 420, anim="left"),
   T(157.0, warn_box("Different layouts"), 560, 600, anim="left"),
   T(158.6, warn_box("Misread values"), 560, 780, anim="left"),
   T(161.7, '<div class="lab" style="color:#1A1915">THE SAFEGUARDS</div>', 1390, 320, anim="fade"),
   T(163.3, safe_box("Shows its sources"), 1390, 420, anim="right"),
   T(164.0, safe_box("Flags anything doubtful"), 1390, 600, anim="right"),
   T(166.6, safe_box("A person approves"), 1390, 780, anim="right"),
 ]),
 motion("M09_business", 167.3, 198.8, seed=23, els=[
   T(168.4, '<div class="lab">FOR YOUR BUSINESS</div>', 960, 200, anim="fade", out=174.6),
   T(169.6, check_row("Less typing"), 960, 380, anim="left", out=174.6),
   T(171.2, check_row("Fewer mistakes"), 960, 540, anim="left", out=174.6),
   T(173.3, check_row("Data you can trust"), 960, 700, anim="left", out=174.6),
   T(174.9, '<div class="h1" style="font-size:110px;white-space:nowrap">A version for <em>you</em></div>', 960, 200, anim="up", out=184.2),
   T(176.4, tile("Your documents and fields"), 520, 520, out=184.2, float=6),
   T(178.4, tile("Logins"), 1400, 520, out=184.2, float=6, ph=1),
   T(180.0, tile("Every change recorded"), 520, 800, out=184.2, float=6, ph=2),
   T(181.5, tile("Your CRM or Google Sheets"), 1400, 800, out=184.2, float=6, ph=3),
   T(184.5, '<div class="lab">RUNNING COST</div>', 960, 200, anim="fade"),
   T(186.7, '<div class="h1" style="font-size:150px;white-space:nowrap">a few <em>cents</em></div>', 960, 380),
   T(187.4, '<div class="h1" style="font-size:64px;color:#6b655c">per document</div>', 960, 510, anim="up"),
   T(189.5, '<div class="card" style="font-size:60px;white-space:nowrap" ><span class="h1">Hosting: free to about <em>$7</em> a month</span></div>', 960, 700, anim="up"),
   T(196.6, '<div class="h1" style="font-size:60px;color:#D97757;border:8px solid #D97757;border-radius:18px;padding:8px 30px;letter-spacing:.1em">ESTIMATE</div>', 1560, 360, anim="stamp", rot=-12),
 ]),
 motion("M10_close", 198.8, 228.25, seed=29, els=[
   T(199.0, '<div class="h1" style="font-size:104px;text-align:center;line-height:1.05">Still copying data<br>by <span class="mark"><i></i><em>hand?</em></span></div>', 960, 400, anim="up", out=206.0, mt=202.9),
   T(204.2, '<div class="pill" style="font-size:56px">I&#39;d love to build your version.</div>', 960, 680, out=206.0),
   T(206.2, '<div class="h1" style="font-size:150px">And that&#39;s it.</div>', 960, 540, anim="pop", out=207.6),
   T(207.8, '<div style="width:240px;height:240px;border-radius:50%;background:#D97757;color:#fff;display:flex;align-items:center;justify-content:center" class="h1"><span style="font-size:120px">JO</span></div>', 960, 300, d=0.6, float=8),
   T(208.2, '<div class="h1" style="font-size:84px;white-space:nowrap">Joel Osumah-Suleiman</div>', 960, 510, anim="up"),
   T(208.6, '<div class="h1" style="font-size:64px;white-space:nowrap">AI that <em>does the work.</em></div>', 960, 610, anim="up"),
   T(209.4, '<div class="pill" style="font-size:44px">New build every Tuesday</div>', 960, 760, anim="pop", float=5),
 ]),
]

UI = [
 ui("U01", 8.4, 18.8, "C01_hook", 0, 10.4, [("3 quotes in. Clean records out.", 8.9)]),
 ui("U02", 43.8, 54.1, "C04_upload", 0.3, 10.6, [("Drop in your quotes", 44.3), ("Click Extract", 51.2)]),
 ui("U03a", 54.1, 60.1, "C05_record_fills", 0, 6, [("The AI reads each quote", 54.5)]),
 ui("U03b", 60.1, 67.0, "C05_record_fills", 6, 24.5, [("AI fills every field", 60.2)]),
 ui("U04", 75.25, 82.5, "C06_source", 0, 7.25, [("Exact line + page", 75.8)]),
 ui("U04b", 82.5, 87.8, "C06_source_closeup", 7, 20, [("No source? Don't trust it.", 82.6)]),
 ui("U05", 87.8, 94.0, "C07_human_check", 0, 6.2, [("Review screen", 88.2), ("Amber = check this", 92.2)]),
 ui("U05b", 94.0, 102.9, "C07_human_check_closeup", 14, 33.9, [("Fix it. Approve.", 98.8)]),
 ui("U06", 110.5, 118.0, "C08_duplicate_dashboard", 1, 21.5, [("Duplicate? Flagged red.", 111.0)]),
 ui("U06b", 118.0, 126.1, "C08_duplicate_dashboard", 21.5, 25, [("One clean dashboard", 118.3)]),
 ui("U07", 131.5, 139.0, "C09_prompts", 0, 9.8, [("Plan first", 133.6)]),
 ui("U07b", 139.0, 144.3, "C09_prompts", 19.6, 29.4, [("Build step by step. Test.", 139.2)]),
]

PROJECT = dict(
    title="AI Document Extractor",
    fps=30,
    voice="voice.m4a",            # Joel's recording, in this folder
    script="script.txt",           # the read-aloud script he followed, word for word
    clips_dir="clips",             # the repo's clips/ folder (C01_hook.mp4 ...)
    segments=sorted(MOTION + UI, key=lambda s: s["start"]),
    key_lines=[[68.6, 75.2], [82.4, 87.7], [102.8, 110.4], [146.6, 149.5], [161.6, 167.3], [198.7, 206.1]],  # music cuts out
    clicks=[51.5, 102.0, 119.2],   # click sounds on screen clicks inside UI clips
    captions_end=207.3,            # no captions over the end card
)

if __name__ == "__main__":
    import json, os
    here = os.path.dirname(os.path.abspath(__file__))
    json.dump(PROJECT, open(os.path.join(here, "project.json"), "w"), indent=1)
    segs = PROJECT["segments"]
    for a, b in zip(segs, segs[1:]):
        assert abs(a["end"] - b["start"]) < 1e-6, f"gap or overlap between {a['id']} and {b['id']}"
    print(len(segs), "segments, ends at", segs[-1]["end"], "s -> project.json")
