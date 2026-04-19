#!/usr/bin/env bash
# Build square PWA icons from the dog photo (macOS sips). Run from repo root or via npm run icons.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/lavanda.png}"
if [[ ! -f "$SRC" ]]; then
  echo "Source image not found: $SRC" >&2
  exit 1
fi
TMP="${TMPDIR:-/tmp}/lavpwa-$$.png"
trap 'rm -f "$TMP"' EXIT
sips -Z 512 "$SRC" --out "$TMP"
# Square canvas, light pad matches in-game floor so black dog reads well on home screen
sips -p 512 512 --padColor e8e4f0 "$TMP" --out "$ROOT/public/icon-512.png"
sips -z 192 192 "$ROOT/public/icon-512.png" --out "$ROOT/public/icon-192.png"
sips -z 180 180 "$ROOT/public/icon-512.png" --out "$ROOT/public/apple-touch-icon.png"
echo "Wrote public/icon-512.png, icon-192.png, apple-touch-icon.png"
