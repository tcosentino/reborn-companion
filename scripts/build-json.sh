#!/usr/bin/env bash
# Generates the walkthrough markdown plus the structured JSON export for one game (see games/<game>.json).
# Usage: bash scripts/build-json.sh <game> [json-out-dir]
# JSON goes to out/json/<game>/ (markdown to a scratch dir under out/json-md/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/env.sh"
GAME="${1:-}"
require_game "$GAME"
GENERATOR="$(game_value "$GAME" build.generator)"
RAW_DIR="$(game_value "$GAME" build.rawDir)"
FIELDS_SCRIPT="$(game_value "$GAME" build.fieldsScript)"
JSON_OUT="${2:-$ROOT/out/json/$GAME}"
MD_OUT="$ROOT/out/json-md"
# Only clear generator output; sprites.json, fields.json and search.json come from other scripts
rm -rf "$JSON_OUT/chapters" "$JSON_OUT/index.json" "$JSON_OUT/dex.json" "$JSON_OUT/pokedex.json" "$MD_OUT"
mkdir -p "$JSON_OUT" "$MD_OUT"
# Build from a scratch copy of upstream's raw markdown with overrides/<game>/*.md applied,
# so content edits live in this repo and upstream/ stays a clean fork.
# The generator reads <WT_RAW_DIR>/<generator>/, so the copy is named after the generator id.
RAW_OUT="$ROOT/out/raw"
rm -rf "$RAW_OUT"
mkdir -p "$RAW_OUT"
cp -R "$ROOT/$RAW_DIR" "$RAW_OUT/$GENERATOR"
if [ -d "$ROOT/overrides/$GAME" ]; then
  node "$ROOT/scripts/apply-overrides.ts" "$ROOT/overrides/$GAME" "$RAW_OUT/$GENERATOR"
fi
export WT_RAW_DIR="$RAW_OUT"
cd "$ROOT/upstream"
ruby wt_generator.rb "$GENERATOR" "$ROOT/game-scripts" "$MD_OUT/$GAME.md" --json "$JSON_OUT"
if [ -n "$FIELDS_SCRIPT" ]; then
  ruby "$ROOT/scripts/build-fields.rb" "$FIELDS_SCRIPT" "$JSON_OUT"
fi
