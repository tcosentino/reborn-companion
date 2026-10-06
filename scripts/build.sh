#!/usr/bin/env bash
# Single entrypoint: generate a game's JSON and sync it into the app.
# Usage: bash scripts/build.sh <game>
# Sprites are separate and optional (they need the game download): node scripts/build-sprites.ts <game>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/build-json.sh" "$@"
bash "$ROOT/scripts/sync-data.sh" "$1"
