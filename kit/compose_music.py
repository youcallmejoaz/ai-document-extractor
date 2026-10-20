"""Original instrumental for Joel's video, synthesised from scratch (no samples, no loops from anywhere).
Upbeat lo-fi/tech groove, 100 BPM, A minor, with an intro, a drum-free break and an outro.
Usage: python3 compose_music.py OUT.wav SECONDS [SEED]. A different seed gives a different take of the groove.
Because it is generated here, it exists nowhere else, so Content ID has nothing to match."""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000; BPM = 100; BEAT = 60 / BPM; BAR = 4 * BEAT
SECS = float(sys.argv[2]) + 5; BARS = int(SECS / BAR) + 1; N = int(BARS * BAR * SR) + SR * 4
rng = np.random.default_rng(int(sys.argv[3]) if len(sys.argv) > 3 else 42)
L = np.zeros(N); R = np.zeros(N)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def add(t, x, g=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(x)); x = x[:j - i] * g
    L[i:j] += x * (1 - pan) / 1.0 if pan > 0 else x; R[i:j] += x * (1 + pan) if pan < 0 else x
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR

def kick():
    t = tt(0.45); f = 48 + 90 * np.exp(-t * 28); y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    return np.tanh(y * 1.6) + rng.standard_normal(len(t)) * np.exp(-t * 300) * 0.15
def clap():
    t = tt(0.3); n = rng.standard_normal(len(t)); e = np.zeros(len(t))
    for k in range(3): e += np.exp(-np.maximum(t - k * 0.011, 0) * 90) * (t >= k * 0.011)
    e += np.exp(-t * 18) * 0.5; return bp(n, 900, 5000) * e * 0.6
def hat(open_=False):
    t = tt(0.25 if open_ else 0.06); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (14 if open_ else 70)) * 0.35
def shaker():
    t = tt(0.08); return bp(rng.standard_normal(len(t)), 4000, 11000) * np.sin(np.pi * t / 0.08) * 0.12
def bass(m, d):
    t = tt(d); f = hz(m); y = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sign(np.sin(2 * np.pi * f * t))
    y = lp(y, 600); e = np.minimum(1, t / 0.005) * np.exp(-t * 2.2) * np.minimum(1, (d - t) / 0.02 + 0.0).clip(0, 1)
    return y * e * 0.55
def epiano(m, d):
    t = tt(d + 1.2); f = hz(m)
    y = (np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 4)) * np.exp(-t * 1.1)
         + 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 3))
    y *= 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)  # tremolo
    rel = np.clip((d + 1.2 - t) / 1.2, 0, 1); return y * np.minimum(1, t / 0.004) * rel * 0.22
def pad(ms, d):
    t = tt(d); y = np.zeros(len(t))
    for m in ms:
        for det in (-0.07, 0.07):
            f = hz(m) * 2 ** (det / 12); y += 2 * (t * f % 1) - 1
    y = lp(y, 1400); e = np.minimum(1, t / 0.6) * np.clip((d - t) / 0.6, 0, 1); return y * e * 0.025
def pluck(m, d=0.6):
    f = hz(m); p = int(SR / f); buf = rng.uniform(-1, 1, p); n = int(d * SR); y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i % p]; buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return lp(y, 5000) * 0.3

# Am - F - C - G   (Am7, Fmaj7, C, G6)
CH = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 64]]
ROOT = [45, 41, 48, 43]
MEL = [(0, 76), (1.5, 74), (2, 72), (3, 69), (4.5, 72), (5, 74), (6, 76), (7, 79),
       (8, 81), (9.5, 79), (10, 76), (11, 74), (12.5, 72), (13, 74), (14, 69)]  # beats over 4 bars, A minor pentatonic
SW = 0.035  # swing on off-beat 8ths
kick_s, clap_s = kick(), clap()
pump = np.ones(N)
def section(b):
    if b < 4: return 'intro'
    if int(BARS * 0.46) <= b < int(BARS * 0.46) + 8: return 'break'
    if b >= BARS - 4: return 'outro'
    return 'full'
for b in range(BARS):
    t0 = b * BAR; c = b % 4; sec = section(b)
    add(t0, pad(CH[c], BAR + 0.3), 1.0)
    for bt in (0, 1.5, 2.5):
        for m in CH[c]: add(t0 + bt * BEAT, epiano(m + 12, BEAT * 0.9), 0.9 if sec != 'intro' else 0.6, pan=0.25 * ((m % 3) - 1))
    if sec in ('full', 'break', 'outro'):
        for bt, d in ((0, 0.9), (1.5, 0.45), (2, 0.9), (3.5, 0.45)):
            add(t0 + bt * BEAT, bass(ROOT[c], d * BEAT), 1.0 if sec != 'break' else 0.7)
    if sec in ('full', 'outro'):
        for bt in (0, 1.75, 2.5):
            add(t0 + bt * BEAT, kick_s, 0.9)
            i = int((t0 + bt * BEAT) * SR); k = int(0.25 * SR)
            if i + k < N: pump[i:i + k] = np.minimum(pump[i:i + k], 0.55 + 0.45 * (np.arange(k) / k) ** 0.6)
        for bt in (1, 3): add(t0 + bt * BEAT, clap_s, 0.8)
    if sec != 'intro':
        for e in range(8):
            off = SW if e % 2 else 0
            add(t0 + (e * 0.5 + off) * BEAT, hat(open_=(e == 7 and b % 2)), 0.9, pan=0.3)
        for s in range(16): add(t0 + (s * 0.25 + (SW if s % 2 else 0)) * BEAT, shaker(), 0.7, pan=-0.35)
    if sec == 'full' and (b // 8) % 2 == 1:  # melody every other 8-bar phrase
        for bt, m in MEL:
            if int(bt // 4) == c: add(t0 + (bt % 4) * BEAT, pluck(m, 0.7), 0.8, pan=-0.2)

# sidechain pump on the music bed (not on drums would be ideal, fine as glue)
L *= pump; R *= pump
# simple stereo reverb
ir_t = tt(2.2); irL = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2); irR = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
irL = lp(irL, 6000); irR = lp(irR, 6000)
wetL = fftconvolve(L, irL)[:N]; wetR = fftconvolve(R, irR)[:N]
L = L + 0.018 * wetL; R = R + 0.018 * wetR
x = np.stack([L, R], 1); x = lp(hp(x.T, 30), 13000).T
x = np.tanh(x / np.abs(x).max() * 1.4) ; x /= np.abs(x).max() / 0.89
end = int(BARS * BAR * SR + 2.5 * SR); x = x[:end]
fo = int(3 * SR); x[-fo:] *= np.linspace(1, 0, fo)[:, None]
import wave
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
print('seconds', len(x) / SR)
