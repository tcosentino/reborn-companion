#!/usr/bin/env bash
# Builds the unmodified generator markdown that upstream's golden test compares against.
# Runs the stock generator from the upstream `content` branch (BIGJRA main + our submitted PRs),
# so content fixes don't break the golden test but our generator changes still have to match it.
# Usage: bash scripts/build-baseline.sh <game> [out-dir] [ref]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/env.sh"
GAME="${1:-}"
require_game "$GAME"
GENERATOR="$(game_value "$GAME" build.generator)"
OUT="${2:-$ROOT/out/baseline}"
REF="${3:-content}"
mkdir -p "$OUT/_arch"
WORKTREE="$ROOT/out/baseline-src"
git -C "$ROOT/upstream" worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
git -C "$ROOT/upstream" worktree add --detach --quiet "$WORKTREE" "$REF"
trap 'git -C "$ROOT/upstream" worktree remove --force "$WORKTREE"' EXIT
cd "$WORKTREE"
ruby wt_generator.rb "$GENERATOR" "$ROOT/game-scripts" "$OUT/$GENERATOR.md"
