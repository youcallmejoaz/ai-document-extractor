#!/usr/bin/env bash
# Make a phone voice recording sound like a close condenser mic, then set it to -16 LUFS.
# Usage: bash enhance_voice.sh IN_AUDIO OUT.wav
# Chain: rumble cut, noise reduction, warmth, mud cut, presence and air lift, de-ess, compression, soft gate.
# If it sounds hollow or watery, lower afftdn nr (22 -> 14). If "s" sounds bite, raise deesser i.
set -euo pipefail
IN="$1"; OUT="$2"; TMP="$(mktemp -d)"
CH="highpass=f=80:poles=2,afftdn=nr=22:nf=-50:tn=1:ad=0.6,equalizer=f=120:t=q:w=1:g=1.5,equalizer=f=280:t=q:w=1.1:g=-3.5,equalizer=f=3400:t=q:w=0.9:g=4.5,highshelf=f=9000:g=6,deesser=i=0.45:m=0.5:f=0.5,acompressor=threshold=-22dB:ratio=3.2:attack=6:release=90:makeup=4dB:knee=4,agate=threshold=0.02:range=0.18:attack=6:release=200:knee=3"
ffmpeg -v error -y -i "$IN" -af "$CH" -ar 48000 -ac 2 "$TMP/pre.wav"
I=$(ffmpeg -i "$TMP/pre.wav" -af ebur128 -f null - 2>&1 | grep -A3 Summary | grep " I:" | awk '{print $2}')
G=$(python3 -c "print(-16-($I))")
ffmpeg -v error -y -i "$TMP/pre.wav" -af "volume=${G}dB,alimiter=limit=0.84:level=false" "$OUT"
rm -rf "$TMP"; echo "voice enhanced -> $OUT (gain ${G} dB)"
