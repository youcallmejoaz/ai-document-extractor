# Joel's faceless build video kit

Turns one voice recording plus the app clips Claude Code recorded into a finished 1080p YouTube video:
branded motion scenes (cream, terracotta, charcoal, Inter Display), the real app clips cut in calmly at the
moment you describe them, word-by-word captions, a cleaned "condenser mic" voice, an original instrumental
that ducks under your voice, synthesised sound effects, and a -14 LUFS mix. No watermarking tool is used
anywhere: every step runs locally (ffmpeg, Playwright, Remotion, pocketsphinx).

The worked example is `examples/document-extractor/` (the 20 Oct 2026 AI Document Extractor video).

## What goes in a project folder

| File | What it is |
| --- | --- |
| `voice.m4a` (any audio) | Your recording, reading `script.txt` word for word |
| `script.txt` | The read-aloud script, paragraphs separated by a blank line |
| `clips/` | The app clips from the build repo (`C01_hook.mp4` ...), 1920x1080 |
| `scenes.py` | The scene plan, written per video from `build/align/sentences.json` |
| `project.json` | Made by running `scenes.py` |

## Steps

```bash
bash kit/make_video.sh setup  PROJECT     # once per machine
bash kit/make_video.sh align  PROJECT     # word timings -> PROJECT/build/align/
#   write PROJECT/scenes.py (copy the example), then: python3 PROJECT/scenes.py
bash kit/make_video.sh video  PROJECT     # -> PROJECT/build/video_silent.mp4 (about 10 min per minute of video on 2 cores)
bash kit/make_video.sh audio  PROJECT     # -> PROJECT/build/FINAL.mp4 + stems
```

Check a frame sheet across the video and the captions against the voice before delivering.

## The pieces

| File | Job |
| --- | --- |
| `kit/align.py` | Force-aligns the script to the voice (pocketsphinx, offline) |
| `kit/blocks.py` | Motion building blocks: `T()`, `motion()`, `ui()`, cards, stamps, name and end cards |
| `kit/build_ui.py` | App clip in a rounded window on cream, sped to fit, slow push-in, caption chips, JO mark |
| `kit/remotion/` | Renders motion scenes with spring animation, UI segments and captions in one pass |
| `kit/enhance_voice.sh` | Noise cut, EQ, de-ess, compression, gate, -16 LUFS voice |
| `kit/compose_music.py` | Original 100 BPM lo-fi tech groove of any length (`SEED=7` for a new take) |
| `kit/sfx.py` | Whooshes on scene changes, pops, stamp thumps, clicks at `clicks` times |
| `kit/mix.py` | Ducks music under speech, silences it on `key_lines`, mixes, lifts to -14 LUFS |
