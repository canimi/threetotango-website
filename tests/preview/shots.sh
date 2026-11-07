#!/usr/bin/env bash
# Test-only: build with a preview feed, add placeholder media into dist/ (never public/),
# serve with `astro preview` and capture screenshots. Usage: tests/preview/shots.sh <outdir> [name=W,H,/path ...]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:?outdir}"; shift
TMP="$(mktemp -d)"
python3 -I "$REPO/tests/preview/make-fixture.py" "$REPO" "$TMP"
mkdir -p "$TMP/media/hero"
# 6 s looping placeholder "episode" from the Nora crop (slow push-in)
ffmpeg -loglevel error -y -loop 1 -i "$REPO/public/img/cast/nora-full.webp" -t 6 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='1+0.0015*on':d=150:s=360x640:fps=25,format=yuv420p" \
  -c:v libx264 -preset veryfast "$TMP/media/hero/preview-hero.mp4"
cd "$REPO"
rm -rf dist
EPISODES_FILE="$TMP/episodes.json" npx astro build >/dev/null
cp -r "$TMP/media" dist/media
PORT=4329
npx astro preview --port $PORT >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -rf "$TMP"' EXIT
for i in $(seq 1 40); do curl -sf "http://localhost:$PORT/" >/dev/null && break; sleep 0.5; done
mkdir -p "$OUT"
for spec in "$@"; do
  name="${spec%%=*}"; rest="${spec#*=}"; size="${rest%%,/*}"; path="/${rest#*,/}"
  google-chrome --headless=new --no-sandbox --hide-scrollbars --disable-gpu --mute-audio \
    --virtual-time-budget=4000 --window-size="$size" --screenshot="$OUT/$name.png" \
    "http://localhost:$PORT$path" >/dev/null 2>&1 || echo "failed $name"
done
