#!/usr/bin/env bash
# Extracts a game's map data and map graphics from its download zip (build.maps in games/<game>.json) into
# out/game/<game>/, then dumps every map to out/maps/<game>/ as JSON. Optional, like sprites: without it,
# scripts/apply-routes.ts skips route maps. Game files stay local (gitignored); never commit them.
# Usage: bash scripts/build-maps.sh <game>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/env.sh"
GAME="${1:-}"
require_game "$GAME"
MAPS="$(game_value "$GAME" build.maps)"
if [ -z "$MAPS" ]; then
  echo "games/$GAME.json has no build.maps; nothing to extract" >&2
  exit 1
fi
ZIP="$(game_value "$GAME" build.maps.zip)"
ZIP="${ZIP/#\~/$HOME}"
PREFIX="$(game_value "$GAME" build.maps.game)"
DEST="$ROOT/out/game/$GAME"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
unzip -q -o "$ZIP" "$PREFIX/Data/Map*.rxdata" "$PREFIX/Data/Tilesets.rxdata" \
  "$PREFIX/Graphics/Tilesets/*" "$PREFIX/Graphics/Autotiles/*" "$PREFIX/Graphics/Characters/*" -d "$SCRATCH"
rm -rf "$DEST"
mkdir -p "$DEST"
mv "$SCRATCH/$PREFIX/Data" "$SCRATCH/$PREFIX/Graphics" "$DEST/"
rm -rf "$ROOT/out/maps/$GAME"
ruby "$ROOT/scripts/dump-maps.rb" "$DEST" "$ROOT/out/maps/$GAME"
