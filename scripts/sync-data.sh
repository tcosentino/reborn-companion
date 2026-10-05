#!/usr/bin/env bash
# Build the palette search index and battles.json, then copy generated guide JSON into the app's public data folder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="${1:-reborn}"
node --no-warnings "$ROOT/scripts/build-search.ts" "$GAME"
rm -rf "$ROOT/app/public/data/$GAME"
mkdir -p "$ROOT/app/public/data"
cp -R "$ROOT/out/json/$GAME" "$ROOT/app/public/data/$GAME"
echo "synced $GAME -> app/public/data/$GAME"
# Data-driven tiers and recommended movesets (needs learnsets.json from the generator)
node --no-warnings "$ROOT/app/scripts/build-ranks.ts" "$ROOT/app/public/data/$GAME"
# Fail if a rebuild drops battle ids that saved progress may reference
node --no-warnings "$ROOT/scripts/check-progress-ids.ts" "$GAME"
