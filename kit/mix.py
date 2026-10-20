"""Duck the music under Joel's voice, cut it out on key lines, mix voice + music + sfx, and mux onto the video.
Usage: python3 mix.py PROJECT_DIR VIDEO_IN VIDEO_OUT
Reads project.json (key_lines) and build/: voice_enhanced.wav, music.wav, sfx.wav. Speech is detected on the
RAW voice (the enhanced one has gated gaps that fool detection). Writes stems to build/ and the final file at -14 LUFS."""
import numpy as np, subprocess, sys, wave, json, os
PROJ, vin, vout = sys.argv[1:4]
P = json.load(open(os.path.join(PROJ, "project.json"))); B = os.path.join(PROJ, "build")
SR = 48000; DUR = P["segments"][-1]["end"]; N = int(DUR * SR)
music_in = os.path.join(B, "music.wav")

def load(path, extra=[]):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *extra, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4").reshape(-1, 2).astype(np.float64)

voice = load(os.path.join(B, "voice_enhanced.wav"))[:N]; voice = np.pad(voice, ((0, N - len(voice)), (0, 0)))
sfx = load(os.path.join(B, "sfx.wav"))[:N]; sfx = np.pad(sfx, ((0, N - len(sfx)), (0, 0)))
m = load(music_in)
# loop the music with a 2 s crossfade until it covers the video
xf = 2 * SR; track = m.copy()
while len(track) < N + SR:
    r = np.linspace(0, 1, xf)[:, None]
    track = np.concatenate([track[:-xf], track[-xf:] * (1 - r) + m[:xf] * r, m[xf:]])
track = track[:N]
# normalise music loudness to about -20 dBFS RMS
track *= 10 ** (-20 / 20) / (np.sqrt((track ** 2).mean()) + 1e-9)

# speech activity from the voice itself (10 ms frames), with hangover
hop = SR // 100; fr = N // hop
det = load(os.path.join(PROJ, P["voice"]))[:N]; det = np.pad(det, ((0, N - len(det)), (0, 0)))
rms = np.sqrt((det[:fr * hop].mean(1).reshape(fr, hop) ** 2).mean(1)) + 1e-9
db = 20 * np.log10(rms); thr = np.percentile(db, 30) + 12
talk = db > thr
hang = 35
act = np.convolve(talk.astype(float), np.ones(2 * hang + 1), "same") > 0

GAP, UNDER, OFF = -4.0, -17.0, -80.0     # dB relative to the normalised music
KEY = [tuple(k) for k in P.get("key_lines", [])]
target = np.where(act, UNDER, GAP).astype(float)
t = np.arange(fr) / 100
for a, b in KEY: target[(t >= a) & (t <= b)] = OFF
target[t < 2.0] = 0.0                     # intro sting before the first word
# smooth: fast down (0.15 s), slow up (0.7 s), in linear gain
g = 10 ** (target / 20); sm = np.zeros_like(g); s = g[0]
dn, up = 1 - np.exp(-1 / 15), 1 - np.exp(-1 / 70)
for i, v in enumerate(g): s += (dn if v < s else up) * (v - s); sm[i] = s
gain = np.interp(np.arange(N) / SR, t, sm)
fade = np.clip((DUR - np.arange(N) / SR) / 3.0, 0, 1)  # 3 s fade out at the end
music = track * (gain * fade)[:, None]

mix = voice + music + sfx * 0.5
peak = np.abs(mix).max(); mix *= min(1.0, 0.95 / peak)
def wav(name, x):
    with wave.open(name, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
wav(f"{B}/stem_music_ducked.wav", music); wav(f"{B}/stem_sfx.wav", sfx * 0.5); wav(f"{B}/mix.wav", mix)
# mux, then lift the whole mix to YouTube loudness (-14 LUFS) with a limiter
I = float([l for l in subprocess.run(["ffmpeg", "-i", f"{B}/mix.wav", "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr.split("Summary:")[1].splitlines() if " I:" in l][0].split()[1])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vin, "-i", f"{B}/mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                "-af", f"volume={-14 - I:.2f}dB,alimiter=limit=0.89:level=false", "-c:a", "aac", "-b:a", "256k",
                "-shortest", "-movflags", "+faststart", vout], check=True)
print("done", vout, "| speech detected in", round(act.mean() * 100), "% of frames (should be 60 to 95)")
