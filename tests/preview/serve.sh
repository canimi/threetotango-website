#!/usr/bin/env bash
# Test-only: build with the preview feed, add placeholder media into dist/ (never public/), serve on :4329.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
python3 -I "$REPO/tests/preview/make-fixture.py" "$REPO" "$TMP"
mkdir -p "$TMP/media/hero"
ffmpeg -loglevel error -y -loop 1 -i "$REPO/public/img/cast/nora-full.webp" -t 6 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='1+0.0015*on':d=150:s=360x640:fps=25,format=yuv420p" \
  -c:v libx264 -preset veryfast "$TMP/media/hero/preview-hero.mp4"
cd "$REPO"
rm -rf dist
EPISODES_FILE="$TMP/episodes.json" npx astro build >/dev/null
cp -r "$TMP/media" dist/media
rm -rf "$TMP"
exec npx astro preview --port "${PORT:-4329}"
