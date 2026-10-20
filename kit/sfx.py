"""Synthesise subtle SFX (whoosh, pop, stamp thump, click) from scratch and lay them on the timeline.
Usage: python3 sfx.py PROJECT_DIR  -> PROJECT_DIR/build/sfx.wav. Nothing is sampled, so nothing can be claimed."""
import numpy as np, json, sys, wave, os
P = json.load(open(os.path.join(sys.argv[1], "project.json")))
SCENES = [g for g in P["segments"] if g["type"] == "motion"]
DUR = P["segments"][-1]["end"]
SR = 48000; N = int(DUR * SR); rng = np.random.default_rng(7)
out = np.zeros((N, 2))
def env(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)
def whoosh(dur=0.5):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.arange(n) / SR
    # sweep a one-pole lowpass upward then down
    fc = 300 + 5000 * np.sin(np.pi * t / dur) ** 2; y = np.zeros(n); s = 0
    for i in range(n): a = 1 - np.exp(-2 * np.pi * fc[i] / SR); s += a * (x[i] - s); y[i] = s
    e = np.sin(np.pi * t / dur) ** 1.5; y *= e
    pan = np.linspace(-0.6, 0.6, n)
    return np.stack([y * (1 - pan) / 2, y * (1 + pan) / 2], 1) * 0.9
def pop():
    n = int(0.12 * SR); t = np.arange(n) / SR; f = 900 * np.exp(-t * 18) + 380
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.03); return np.stack([y, y], 1) * 0.45
def thump():
    n = int(0.35 * SR); t = np.arange(n) / SR; f = 140 * np.exp(-t * 10) + 50
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.09) + rng.standard_normal(n) * env(n, 0.001, 0.012) * 0.3
    return np.stack([y, y], 1) * 0.8
def click():
    n = int(0.04 * SR); y = rng.standard_normal(n) * env(n, 0.0003, 0.004) + np.sin(2 * np.pi * 2600 * np.arange(n) / SR) * env(n, 0.0003, 0.006)
    return np.stack([y, y], 1) * 0.35
def put(t, s, g=1.0):
    i = int(t * SR); j = min(N, i + len(s)); out[i:j] += s[:j - i] * g
W = whoosh()
for sc in SCENES:
    if sc['start'] > 0: put(max(0, sc['start'] - 0.12), W, 0.55)
    for e in sc['els']:
        a = e.get('anim', 'pop')
        if a == 'stamp': put(e['t'] + 0.05, thump(), 0.8)
        elif a in ('pop', 'drop'): put(e['t'] + 0.04, pop(), 0.5)
# whoosh into UI windows too, softer
for g in P["segments"]:
    if g["type"] == "ui" and g["start"] > 0: put(max(0, g["start"] - 0.12), W, 0.35)
for t in P.get("clicks", []): put(t, click(), 0.9)
out *= 0.9 / max(0.9, np.abs(out).max())
os.makedirs(os.path.join(sys.argv[1], 'build'), exist_ok=True)
with wave.open(os.path.join(sys.argv[1], 'build', 'sfx.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('peak', np.abs(out).max())
