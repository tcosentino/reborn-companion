# Wave 4: build pipeline

Goal: every `scripts/*.ts` entry point is a thin CLI wrapper around shared helpers. Adding a new kind of section card should take one def type, one apply function and one 10-line script.

Wave 1 (R10, R11) must have landed. Every task here is gated by `verify.sh --full`.

---

## R40 Shell boilerplate

**Model:** haiku. **Depends:** R01. **Touches:** `scripts/env.sh`, `scripts/build.sh`, `scripts/build-json.sh`, `scripts/sync-data.sh`, `scripts/build-maps.sh`, `scripts/build-baseline.sh`, `scripts/verify.sh`.

Steps:
1. Five scripts repeat the same four lines:
   ```
   ROOT=...; source env.sh; GAME="${1:-}"; require_game "$GAME"
   ```
   - Add `init_game "$@"` to `env.sh`. It sets and exports `GAME` and calls `require_game`.
   - Each script keeps its own `ROOT=` line and `source` line. Those cannot move, because `env.sh` needs `ROOT`.
2. Add `run_ts() { node --no-warnings "$ROOT/scripts/$1.ts" "${@:2}"; }` to `env.sh`, and use it for every `node --no-warnings` call in `sync-data.sh`.
3. `env.sh` line 5 runs `ruby -e` on every source, which costs about 100ms even for scripts that never use Ruby.
   - Compute `GEM_PATH` only when it is unset, inside a function `use_ruby` called by the scripts that run Ruby: `build-json.sh`, `build-maps.sh`, `build-baseline.sh` and `test.sh`.
   - Check which scripts actually call ruby before you edit.
4. Leave `build.sh` as it is. It is the documented entry point.

Acceptance: these behave exactly as before:
- `bash scripts/verify.sh --full`
- `bash scripts/sync-data.sh` with no argument, which must still print the usage message

---

## R41 Shared script plumbing: ROOT, loadChapters, mainRoot

**Model:** sonnet. **Depends:** R03. **Touches:**
- `scripts/game.ts`, `scripts/map-cards.ts`
- `scripts/apply-*.ts`, `scripts/check-progress-ids.ts`, `scripts/maps.ts`, `scripts/build-search.ts`, `scripts/build-sprites.ts`
- `app/scripts/build-ranks.ts`, which moves to `scripts/build-ranks.ts`
- `scripts/sync-data.sh`
- README, but only the paragraph that mentions `build-ranks`

Steps:
1. `const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')` is redefined in 8 files. One of them, `build-search.ts`, calls it `root`.
   - `scripts/game.ts` already exports `ROOT`. Import it from there everywhere.
   - Leave `token-usage.ts` alone, because it is unrelated to the game pipeline.
2. The "read index.json then every chapter" loop is copied in `build-search.ts` (around lines 18-23), `app/scripts/build-ranks.ts` (around lines 14-23) and the apply scripts.
   - `loadChapters` in `scripts/map-cards.ts` already does this.
   - Move `loadChapters` and `readSectionDefs` into a new `scripts/guide-io.ts`, and use them everywhere.
3. Move `app/scripts/build-ranks.ts` to `scripts/build-ranks.ts`. Update its imports, the call in `sync-data.sh`, and any README reference. Delete `app/scripts/` if it ends up empty.
4. The worktree main-root fallback is duplicated in `build-sprites.ts` (around line 33). Add `mainRoot()` to `game.ts` and use it there. `build-fields.rb` keeps its Ruby copy, but add a comment that points at `mainRoot()`.

Acceptance: `verify.sh --full` shows no data diff.

---

## R42 Generic section applier and `cli()`

**Model:** sonnet. **Depends:** R11, R41. **Touches:** new `scripts/applier.ts`, `scripts/apply-tasks.ts`, `scripts/apply-starters.ts`, `scripts/apply-routes.ts`, `scripts/apply-item-maps.ts`, `scripts/check-progress-ids.ts`.

All four apply scripts repeat the same skeleton:
1. Read `<dir>/<game>/<section>.json` into a Map, then validate it.
2. Load the chapters.
3. For each section, set `key = sec.id ?? c.id`, delete the key from `unseen`, apply, and turn any misses into `no paragraph starts with "<match>"`.
4. Write each chapter back.
5. Report `<dir>/<game>/<s>.json: no such section` for every key left in `unseen`.
6. Print the errors and `process.exit(1)`, or print `ok`.

Steps:
1. In `scripts/applier.ts`:
   - `runSectionApplier<D>({ game, dir, label, validate, apply, writeOnlyChanged? })`. It owns steps 2 to 6.
   - `apply(sec, key, def)` returns `{ blocks, missing: string[], ambiguous?: string[], changed?: boolean }`.
   - `cli(usage: string, main: (args: string[]) => void)` replaces the `import.meta.url === \`file://${process.argv[1]}\`` guard and the usage/exit block at the bottom of each script.
2. Convert `apply-tasks.ts`, `apply-starters.ts`, `apply-routes.ts` and `apply-item-maps.ts`, keeping these behaviours:
   - apply-starters only writes chapters it changed (`writeOnlyChanged`).
   - apply-tasks also reports `ambiguous`.
   - The exact error strings stay the same. Only their order may change, because defs are read in sorted order.
3. `check-progress-ids.ts` uses `cli()` too.
4. `apply-hidden-maps.ts` has a different shape: one JSON file per game. Convert it only to `cli()`.

Acceptance:
- `verify.sh --full` shows no data diff.
- Each apply script prints the same error for a deliberately broken def, e.g. a `match` that matches nothing. Test it, then revert the def.

---

## R43 One map store in `rmxp.ts`

**Model:** sonnet. **Depends:** R41. **Touches:** `scripts/rmxp.ts`, `scripts/map-cards.ts`, `scripts/apply-routes.ts`, `scripts/apply-hidden-maps.ts`, `scripts/apply-item-maps.ts`, `scripts/maps.ts`, `scripts/check-progress-ids.ts`, `scripts/png-rgba.ts`.

Four files repeat the same pieces:
- A map cache: `apply-routes.ts` (around lines 143-148), `apply-hidden-maps.ts` (around lines 100-104), `apply-item-maps.ts` (around lines 26-42), and `maps.ts`, which reloads every time.
- The tileset and image loader setup.
- The `renderCached(imgDir, file, [box, readFileSync(mapJson)], () => writePng(renderMap(...)))` call.
- The "no map dump" warning.

Steps:
1. Add `mapStore(root, game)` to `rmxp.ts`. It returns:
   ```
   { ready, index, tilesets, map(id), render(box, mapId, hide?), renderCached(imgDir, file, mapId, box, hide?): string /* hash */, warnMissing(tool) }
   ```
   Everything inside it loads lazily on first use.
2. Use it in all four scripts. The `mapData` lookup with its item events, in `map-cards.ts`, becomes a thin layer on top.
3. `check-progress-ids.ts` (around line 33) builds the maps path by hand. Use `hasMaps(mapsDir(...))` instead.
4. `apply-hidden-maps.ts`:
   - `itemOf` (around line 25) and the code around line 32 re-implement `itemEventInfo` from `lib/itemMaps.ts`. Use it.
   - Around line 80 it parses `games/<game>.json` by hand. Use `loadGame(game).build.rawDir` instead.
5. The hidden-maps def type is retyped inline in `apply-item-maps.ts` (around line 83) and `maps.ts` (around line 367). Import `HiddenMapDef` instead.
6. Dead code:
   - Delete `crop` from `png-rgba.ts` (around line 73) after confirming it has no callers with grep.
   - Un-export `tileAt`, `terrainAt` and `TERRAIN` in `rmxp.ts` if nothing outside the file uses them.

Expected data diff: if the cache key changes, the `?v=` hashes on map image URLs in chapter JSON may change once. Ids must not change. Report the diff paths.

Acceptance: the map images in `app/public/maps/` are visually identical. Compare a few files with `cmp`; PNG bytes should match.

---

## R44 Split and fix `scripts/maps.ts` (415 lines)

**Model:** sonnet. **Depends:** R42, R43. **Touches:** `scripts/maps.ts`, new `scripts/png-draw.ts`, README "Route maps" if the usage text changes.

Steps:
1. **Bug:** `maps.ts` calls `loadIndex` and `loadTilesets` at module top level (around lines 46 and 181). As a result, `node scripts/maps.ts reborn fmt` and `cards` throw when `build-maps.sh` has not run. Load them lazily through `mapStore` from R43.
2. Move the drawing helpers (around lines 51-103) into `scripts/png-draw.ts`: `DIGITS`, `label`, `fillRect`, `grid`, `pathOverlay` and `tileMarker`.
3. `findSection` (around lines 159-168) re-implements guide loading with its own `SectionJson` type. Use `loadChapters` from `guide-io.ts` instead.
4. The match checking in `check` (around lines 283-285) and `items-check` (around lines 329-332) is duplicated. Extract `checkMatches(section, defs, paras)`.
5. Replace the `switch` with a `commands: Record<string, { usage: string, run: (args) => void }>` table. Generate the usage text from the table.
   - Today it is sliced from fixed source lines (`slice(2, 22)`), which breaks whenever the header comment changes.

Acceptance:
- Every subcommand in the README "Route maps" and `item-maps/AUTHORING.md` still works.
- `node scripts/maps.ts reborn fmt` works on a machine without `out/game/`. Test it by temporarily pointing the game config at an empty directory, or report that you could not test it.

---

## R45 Script test fixtures

**Model:** haiku. **Depends:** R43. **Touches:** new `scripts/test-fixtures.ts`, `scripts/rmxp.test.ts`, `scripts/apply-item-maps.test.ts`.

`rmxp.test.ts` (around line 11, `mapOf`) and `apply-item-maps.test.ts` (around line 7) build `GameMap` objects separately. Move both builders into `test-fixtures.ts`, as `mapOf` and `page(...)`.

Acceptance: the same number of tests as before, all passing.
