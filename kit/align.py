"""Force-align the read-aloud script to the voice recording (pocketsphinx, fully offline).
Usage: python3 align.py VOICE_FILE SCRIPT_TXT OUT_DIR
Writes OUT_DIR/words.json [[word,start,end]...] in script spelling, captions.json (caption phrases)
and sentences.json (sentence start/end, used to time the scenes).

How it works: the voice is split into speech chunks at real pauses (pocketsphinx Segmenter). Each chunk
is force-aligned against the next sentences of the script, trying the largest sentence end that fits
first. Extra words never fit, so the largest that aligns is right. Wide beams forgive a word said fast,
slurred or skipped. Whole-file alignment fails on long recordings, which is why it chunks.
The script must match what was said closely; unscripted speech after the last line is ignored."""
import sys, json, re, subprocess, os, io
from pocketsphinx import Decoder, Segmenter, get_model_path
voice, script, out = sys.argv[1:4]; os.makedirs(out, exist_ok=True)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", voice, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     capture_output=True, check=True).stdout
words = open(script).read().split()
clean = [re.sub(r"[^a-z0-9']", "", w.lower()) for w in words]
VOC = {l.split()[0].split("(")[0] for l in open(get_model_path() + "/en-us/cmudict-en-us.dict")}
NUM = dict(zip("0123456789", "zero one two three four five six seven eight nine".split()))
def say(c):
    """dictionary-safe tokens for one script word: split compounds (logins -> log ins), spell digits"""
    if not c or c in VOC: return [c] if c else []
    if c.isdigit(): return [NUM[x] for x in c]
    for k in range(2, len(c) - 1):
        if c[:k] in VOC and c[k:] in VOC: return [c[:k], c[k:]]
    if c.endswith("'s") and c[:-2] in VOC: return [c[:-2]]
    print("not in dictionary, timing will be interpolated:", c); return []
toks = [say(c) for c in clean]
units = [t for ts in toks for t in ts]

chunks = [(s.start_time, s.end_time) for s in Segmenter(sample_rate=16000).segment(io.BytesIO(raw))]
merged = []                                   # merge chunks split by tiny gaps
for a, b in chunks:
    if merged and a - merged[-1][1] < 0.25: merged[-1] = (merged[-1][0], b)
    else: merged.append((a, b))

def align(tokens, a, b, wide=False):
    """force-align tokens inside [a, b] seconds; returns word (start, end) list or None"""
    kw = dict(beam=1e-80, wbeam=1e-60, pbeam=1e-80) if wide else {}
    d = Decoder(samprate=16000, bestpath=False, **kw)
    d.set_align_text(" ".join(tokens))
    f0 = max(0, int(a * 100)); f1 = min(len(raw) // 320, int(b * 100))
    d.start_utt(); d.process_raw(raw[f0 * 320:f1 * 320], full_utt=True); d.end_utt()
    sg = d.seg()
    if sg is None: return None
    ws = [x for x in sg if not x.word.startswith("<") and not x.word.startswith("[")]
    if len(ws) != len(tokens): return None
    t = [((f0 + x.start_frame) / 100, (f0 + x.end_frame + 1) / 100) for x in ws]
    # wide beams can cram an extra sentence into a chunk's tail; a word under 50 ms means that happened
    if wide and any(e - s < 0.05 for s, e in t): return None
    return t

# Align one speech chunk (between real pauses) at a time. A chunk almost always ends at the end of a
# sentence, so the candidate word counts are the sentence ends that could fit in it, tried largest first:
# normal beams, then wide beams (which tolerate a word said fast, slurred or skipped). Extra words never
# fit, so the largest candidate that aligns is the right one. A chunk with no fitting sentence end
# (it splits a sentence) falls back to clause ends, then to the most words that align.
sent_end, clause_end, k = set(), set(), 0
for w, ts in zip(words, toks):
    k += len(ts)
    if re.search(r"[.?!]$", w): sent_end.add(k)
    if re.search(r"[,:;]$", w): clause_end.add(k)
sent_end.add(len(units))
times, j, cursor = [], 0, 0.0
for a, b in merged:
    if j >= len(units): break
    a = min(a, cursor) if cursor > 0 else max(0.0, a - 0.15)   # pick up words a chunk edge cut off
    b = b + 0.15
    hi = min(len(units) - j, int((b - a) * 5) + 3)
    best = None
    for pool in (sent_end, clause_end):
        for n in sorted((e - j for e in pool if 0 < e - j <= hi), reverse=True):
            best = align(units[j:j + n], a, b) or align(units[j:j + n], a, b, wide=True)
            if best: break
        if best: break
    if best is None:
        for n in range(hi, 0, -1):
            best = align(units[j:j + n], a, b)
            if best: break
    if best is None:
        print(f"chunk {a:.1f}s to {b:.1f}s has no script words (skipped)"); continue
    times += best; j += len(best); cursor = best[-1][1]
    print(f"chunk {a:.1f}s to {b:.1f}s: {len(best)} words", flush=True)
if j < len(units):
    json.dump(times, open(f"{out}/partial.json", "w"))
    sys.exit(f"alignment stopped after {j} of {len(units)} words: check script.txt matches what was said")

res, k = [], 0
for w, ts in zip(words, toks):
    if not ts:
        p = res[-1][2] if res else 0.0; res.append([w, p, round(p + 0.2, 2)]); continue
    res.append([w, round(times[k][0], 2), round(times[k + len(ts) - 1][1], 2)]); k += len(ts)
json.dump(res, open(f"{out}/words.json", "w"))

ph, cur = [], []
for w, s, e in res:
    if cur and (len(cur) >= 5 or s - cur[-1]["e"] > 0.45): ph.append(cur); cur = []
    cur.append(dict(w=w, s=s, e=e))
    if re.search(r"[.,?!:]$", w): ph.append(cur); cur = []
if cur: ph.append(cur)
json.dump(ph, open(f"{out}/captions.json", "w"))

sent, cur = [], []
for w, s, e in res:
    cur.append((w, s, e))
    if re.search(r"[.?!]$", w):
        sent.append(dict(text=" ".join(x[0] for x in cur), start=cur[0][1], end=cur[-1][2])); cur = []
json.dump(sent, open(f"{out}/sentences.json", "w"), indent=1)
print(len(res), "words aligned,", len(sent), "sentences, speech ends at", res[-1][2], "s ->", out)
