#!/usr/bin/env bash
# Joel's faceless build video pipeline. Usage: bash make_video.sh STAGE PROJECT_DIR
#   setup   install pocketsphinx + Remotion (once per machine)
#   align   time every script word to the voice     -> PROJECT_DIR/build/align/{words,sentences,captions}.json
#           (then write PROJECT_DIR/scenes.py from sentences.json and run it -> project.json)
#   video   UI segments + motion + captions render  -> PROJECT_DIR/build/video_silent.mp4
#   audio   voice clean-up, original music, sfx, ducked mix -> PROJECT_DIR/build/FINAL.mp4 + stems
#   all     video then audio
set -euo pipefail
STAGE="$1"; PROJ="$(cd "$2" && pwd)"; KIT="$(cd "$(dirname "$0")" && pwd)"
B="$PROJ/build"; mkdir -p "$B"
browser() { for c in /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell /opt/pw-browsers/chromium-*/chrome-linux/chrome; do [ -x "$c" ] && { echo "$c"; return; }; done; echo ""; }
case "$STAGE" in
setup)
  pip install --break-system-packages -q pocketsphinx==5.1.1 numpy scipy playwright pillow
  (cd "$KIT/remotion" && npm install --silent)
  fc-list | grep -qi "Inter Display" || echo "WARNING: Inter Display font missing; install Inter (e.g. fonts-inter) or the look will fall back"
  ;;
align)
  VOICE=$(python3 -c "import json;print(json.load(open('$PROJ/project.json')).get('voice','voice.m4a'))" 2>/dev/null || echo voice.m4a)
  python3 "$KIT/align.py" "$PROJ/$VOICE" "$PROJ/script.txt" "$B/align"
  ;;
video)
  python3 "$KIT/build_ui.py" "$PROJ"
  cp "$PROJ/project.json" "$KIT/remotion/src/project.json"; cp "$B/align/captions.json" "$KIT/remotion/src/captions.json"
  BR=$(browser); ARGS=(); [ -n "$BR" ] && ARGS=(--browser-executable="$BR")
  (cd "$KIT/remotion" && npx remotion render src/index.jsx Main "$B/video_silent.mp4" "${ARGS[@]}" --crf=18 --concurrency="$(nproc)")
  ;;
audio)
  VOICE=$(python3 -c "import json;print(json.load(open('$PROJ/project.json'))['voice'])")
  DUR=$(python3 -c "import json;print(json.load(open('$PROJ/project.json'))['segments'][-1]['end'])")
  bash "$KIT/enhance_voice.sh" "$PROJ/$VOICE" "$B/voice_enhanced.wav"
  [ -f "$B/music.wav" ] || python3 "$KIT/compose_music.py" "$B/music.wav" "$DUR" "${SEED:-42}"
  python3 "$KIT/sfx.py" "$PROJ"
  python3 "$KIT/mix.py" "$PROJ" "$B/video_silent.mp4" "$B/FINAL.mp4"
  ;;
all) bash "$0" video "$PROJ"; bash "$0" audio "$PROJ" ;;
*) echo "unknown stage $STAGE"; exit 1 ;;
esac
