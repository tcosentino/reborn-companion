#!/usr/bin/env bash
# Builds the unmodified generator markdown that upstream's golden test compares against.
# Runs the stock generator from the upstream `content` branch (BIGJRA main + our submitted PRs),
# so content fixes don't break the golden test but our generator changes still have to match it.
# Usage: bash scripts/build-baseline.sh [out-dir] [ref]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH=/opt/homebrew/opt/ruby/bin:$PATH
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 RUBYOPT="-Eutf-8:utf-8"
export GEM_HOME="$ROOT/.gems" GEM_PATH="$ROOT/.gems"
OUT="${1:-$ROOT/out/baseline}"
REF="${2:-content}"
mkdir -p "$OUT/_arch"
WORKTREE="$ROOT/out/baseline-src"
git -C "$ROOT/upstream" worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
git -C "$ROOT/upstream" worktree add --detach --quiet "$WORKTREE" "$REF"
trap 'git -C "$ROOT/upstream" worktree remove --force "$WORKTREE"' EXIT
cd "$WORKTREE"
ruby wt_generator.rb reborn "$ROOT/game-scripts" "$OUT/reborn.md"
