#!/bin/sh
# Runs from the nginx image entrypoint (/docker-entrypoint.d) before nginx starts.
# When this image is new (first start after a deploy), publish the site baked into it as a release
# in the shared volume and make it live, so a deploy serves its own build at once. ttw-builder then
# replaces it with a fresh build and keeps it in step with the episode feed.
# A plain restart of the same image changes nothing (the builder's newer release stays live).
set -eu
SITE=/srv/site
SUM="$(cd /usr/share/nginx/html && find . -type f | sort | xargs md5sum | md5sum | cut -c1-32)"
mkdir -p "$SITE/releases"
if [ -L "$SITE/current" ] && [ -e "$SITE/current/index.html" ] && [ "$(cat "$SITE/.baked-sum" 2>/dev/null || true)" = "$SUM" ]; then
  echo "ttw: same image as before, keeping $SITE/current -> $(readlink "$SITE/current")"
  exit 0
fi
REL="baked-$(date +%s)"
while [ -e "$SITE/releases/$REL" ]; do sleep 1; REL="baked-$(date +%s)"; done
cp -a /usr/share/nginx/html "$SITE/releases/$REL"
ln -sfn "releases/$REL" "$SITE/current"
echo "$SUM" > "$SITE/.baked-sum"
echo "ttw: seeded $SITE/current -> releases/$REL"
