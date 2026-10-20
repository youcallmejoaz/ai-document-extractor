"""Build the calm UI segments: repo clip in a rounded window on cream, slow push-in, caption chips, JO mark.
Usage: python3 build_ui.py PROJECT_DIR [segment ids...]   (reads PROJECT_DIR/project.json)"""
import subprocess, os, sys, json
from playwright.sync_api import sync_playwright

KIT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(sys.argv[1]); want = sys.argv[2:]
P = json.load(open(os.path.join(PROJ, "project.json")))
FPS = P.get("fps", 30)
CL = os.path.join(PROJ, P.get("clips_dir", "clips"))
OUT = os.path.join(KIT, "remotion", "public", "seg")      # Remotion reads the finished segments from here
AS = os.path.join(PROJ, "build", "ui_assets")
os.makedirs(AS, exist_ok=True); os.makedirs(OUT, exist_ok=True)
UI = [(g["id"], g["start"], g["end"], g["clip"], g["clip_in"], g["clip_out"], g["chips"]) for g in P["segments"] if g["type"] == "ui"]
for g in UI:
    assert os.path.exists(f"{CL}/{g[3]}.mp4"), f"missing clip {CL}/{g[3]}.mp4"

BG = """<html><body style="margin:0;width:1920px;height:1080px;background:#F4F1EA;position:relative;overflow:hidden">
<div style="position:absolute;inset:0;background-image:radial-gradient(rgba(26,25,21,.10) 2px,transparent 2.5px);background-size:44px 44px"></div>
<div style="position:absolute;width:520px;height:520px;border-radius:50%;background:rgba(217,119,87,.16);left:-140px;top:-160px"></div>
<div style="position:absolute;width:420px;height:420px;border-radius:50%;background:rgba(217,119,87,.12);right:-120px;bottom:-140px"></div>
<div style="position:absolute;left:200px;top:28px;width:1520px;height:862px;border-radius:30px;box-shadow:0 30px 80px rgba(26,25,21,.22)"></div>
</body></html>"""
MASK = """<html><body style="margin:0;width:1504px;height:846px;background:transparent">
<div style="width:1504px;height:846px;border-radius:26px;background:#fff"></div></body></html>"""
CHIP = """<html><body style="margin:0;background:transparent;display:inline-block">
<div id=c style="display:inline-block;padding:22px 46px;border-radius:999px;background:#D97757;color:#fff;font:800 46px 'Inter';letter-spacing:-.01em;box-shadow:0 14px 34px rgba(26,25,21,.25);margin:30px">{t}</div></body></html>"""

def chip_name(t): return f"{AS}/chip_" + "".join(ch for ch in t if ch.isalnum())[:40] + ".png"

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1920, "height": 1080})
    pg.set_content(BG); pg.screenshot(path=f"{AS}/ui_bg.png")
    pg.set_viewport_size({"width": 1504, "height": 846}); pg.set_content(MASK)
    pg.screenshot(path=f"{AS}/mask.png", omit_background=True)
    pg.set_viewport_size({"width": 1920, "height": 300})
    for seg in UI:
        for t, _ in seg[6]:
            pg.set_content(CHIP.format(t=t.replace("'", "&#39;")))
            box = pg.locator("#c").bounding_box()
            pg.screenshot(path=chip_name(t), omit_background=True,
                          clip={"x": box["x"] - 30, "y": box["y"] - 30, "width": box["width"] + 60, "height": box["height"] + 60})
    b.close()

# mask -> grayscale alpha
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{AS}/mask.png", "-vf", "alphaextract", f"{AS}/mask_a.png"], check=True)
WM = os.path.join(KIT, "assets", "jo-mark.png")

for name, s, e, clip, ci, co, chips in UI:
    if want and name not in want: continue
    f0, f1 = round(s * FPS), round(e * FPS); n = f1 - f0; D = n / FPS
    speed = (co - ci) / D
    inputs = ["-i", f"{CL}/{clip}.mp4", "-loop", "1", "-i", f"{AS}/ui_bg.png", "-loop", "1", "-i", f"{AS}/mask_a.png", "-loop", "1", "-i", WM]
    fc = (f"[0:v]trim={ci}:{co},setpts=(PTS-STARTPTS)/{speed:.5f},fps={FPS},tpad=stop_mode=clone:stop_duration=3,scale=1504:846,format=rgba[cl];"
          f"[2:v]format=gray,scale=1504:846[m];[cl][m]alphamerge[win];"
          f"[1:v][win]overlay=208:36:shortest=0,format=rgba,"
          f"scale=w='trunc(1920*(1+0.045*t/{D:.3f})/2)*2':h=-2:eval=frame,crop=1920:1080,setsar=1[z];")
    last = "z"
    for i, (t, at) in enumerate(chips):
        rel = max(0.0, at - s)
        end = chips[i + 1][1] - s if i + 1 < len(chips) else D + 1
        inputs += ["-loop", "1", "-t", f"{D:.3f}", "-i", chip_name(t)]
        k = 4 + i
        fc += (f"[{k}:v]format=rgba,fade=in:st={rel:.2f}:d=0.3:alpha=1,fade=out:st={max(rel, end - 0.25):.2f}:d=0.25:alpha=1[c{i}];"
               f"[{last}][c{i}]overlay=(W-w)/2:802:eval=init[o{i}];")
        last = f"o{i}"
    fc += f"[3:v]scale=78:78,format=rgba,colorchannelmixer=aa=0.85[wm];[{last}][wm]overlay=W-w-40:40,format=yuv420p[v]"
    cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[v]", "-frames:v", str(n),
           "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-an", f"{OUT}/{name}.mp4"]
    subprocess.run(cmd, check=True)
    print("wrote", name, n, "frames", f"speed {speed:.2f}x", flush=True)
