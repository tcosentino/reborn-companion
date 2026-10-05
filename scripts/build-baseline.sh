#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH=/opt/homebrew/opt/ruby/bin:$PATH
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 RUBYOPT="-Eutf-8:utf-8"
export GEM_HOME="$ROOT/.gems" GEM_PATH="$ROOT/.gems"
OUT="${1:-$ROOT/out/baseline}"
mkdir -p "$OUT"
cd "$ROOT/upstream"
ruby wt_generator.rb reborn "$ROOT/game-scripts" "$OUT/reborn.md"
