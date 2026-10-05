#!/usr/bin/env bash
# Copy generated guide JSON into the app's public data folder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${1:-reborn}"
rm -rf "$ROOT/app/public/data/$GAME"
mkdir -p "$ROOT/app/public/data"
cp -R "$ROOT/out/json/$GAME" "$ROOT/app/public/data/$GAME"
echo "synced $GAME -> app/public/data/$GAME"
# Data-driven tiers and recommended movesets (needs learnsets.json from the generator)
node --no-warnings "$ROOT/app/scripts/build-ranks.ts" "$ROOT/app/public/data/$GAME"
