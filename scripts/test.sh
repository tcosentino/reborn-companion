#!/usr/bin/env bash
# Runs the script unit tests, then the upstream minitest suite (golden HTML test + JSON export tests).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH=/opt/homebrew/opt/ruby/bin:$PATH
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 RUBYOPT="-Eutf-8:utf-8"
export GEM_HOME="$ROOT/.gems"
export GEM_PATH="$ROOT/.gems:$(ruby -e 'print Gem.default_dir')"
export WT_GAME_SCRIPTS="$ROOT/game-scripts" WT_BASELINE_DIR="$ROOT/out/baseline"
node --test "$ROOT"/scripts/*.test.ts
cd "$ROOT/upstream"
ruby -Itest -e 'Dir["test/*_test.rb"].sort.each { |f| require File.expand_path(f) }' -- "$@"
