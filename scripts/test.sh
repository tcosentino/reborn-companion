#!/usr/bin/env bash
# Runs the script unit tests, then the upstream minitest suite (golden HTML test + JSON export tests).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/env.sh"
export WT_GAME_SCRIPTS="$ROOT/game-scripts" WT_BASELINE_DIR="$ROOT/out/baseline"
node --test "$ROOT"/scripts/*.test.ts
cd "$ROOT/upstream"
ruby -Itest -e 'Dir["test/*_test.rb"].sort.each { |f| require File.expand_path(f) }' -- "$@"
