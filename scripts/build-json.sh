#!/usr/bin/env bash
# Generates the walkthrough markdown plus the structured JSON export.
# JSON goes to out/json/reborn/ (markdown to a scratch dir under out/json-md/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH=/opt/homebrew/opt/ruby/bin:$PATH
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 RUBYOPT="-Eutf-8:utf-8"
export GEM_HOME="$ROOT/.gems" GEM_PATH="$ROOT/.gems"
JSON_OUT="${1:-$ROOT/out/json/reborn}"
MD_OUT="$ROOT/out/json-md"
# Only clear generator output; sprites.json, fields.json and search.json come from other scripts
rm -rf "$JSON_OUT/chapters" "$JSON_OUT/index.json" "$JSON_OUT/dex.json" "$JSON_OUT/pokedex.json" "$MD_OUT"
mkdir -p "$JSON_OUT" "$MD_OUT"
# Build from a scratch copy of upstream's raw markdown with overrides/<game>/*.md applied,
# so content edits live in this repo and upstream/ stays a clean fork
RAW_OUT="$ROOT/out/raw"
rm -rf "$RAW_OUT"
mkdir -p "$RAW_OUT"
cp -R "$ROOT/upstream/src/_raw/reborn" "$RAW_OUT/reborn"
node "$ROOT/scripts/apply-overrides.ts" "$ROOT/overrides/reborn" "$RAW_OUT/reborn"
export WT_RAW_DIR="$RAW_OUT"
cd "$ROOT/upstream"
ruby wt_generator.rb reborn "$ROOT/game-scripts" "$MD_OUT/reborn.md" --json "$JSON_OUT"
ruby "$ROOT/scripts/build-fields.rb" "$JSON_OUT"
