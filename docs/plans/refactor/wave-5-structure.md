# Wave 5: structure, guardrails and docs

Goal: the folder layout explains the architecture, tooling stops regressions from coming back, and the docs match the code.

Run this wave after Waves 1 to 4. R50 moves many files, so nothing else should run alongside it.

---

## R50 Folder layout: `components/` = shared UI, `features/` = screens, `lib/` = logic

**Model:** sonnet. **Depends:** all of Waves 1 to 4. **Touches:** file moves and import updates across `app/src`.

Today `components/` imports from `features/` and `features/` imports from `components/`. Also, `components/palette/` holds the search data layer that hovercards, the reference pages, the Pokedex and `App` all use.

Target layout:

```
app/src/
  lib/            pure logic, no React (already); add lib/search/
  data/           types + loaders
  components/     shared presentational pieces only: ui/, dex/, blocks/, common.tsx, SectionView.tsx
  features/       screens and feature-specific UI: guide-nav, hidden-items, hovercards, route-map, usage,
                  palette, pokedex, reference
```

Steps:
1. `git mv` the following non-UI files from `components/palette/` to `lib/search/`:
   - `entries.ts`, `places.ts`, `indexTypes.ts`, `buildIndex.ts`, `search.ts`, `anchors.ts`, `options.ts`
   - their tests

   Use `git mv` so history follows the files. `anchorScroll.ts` touches the DOM, so it goes to `components/ui/`.
2. `git mv` these folders:
   - `components/palette` (the rest of it) to `features/palette`
   - `components/pokedex` to `features/pokedex`
   - `components/reference` to `features/reference`
3. Update every import. `scripts/build-search.ts` imports `buildIndex`, so update it too.
4. Check the rule: run `grep -rn "from '\.\./\.\./features\|from '\.\./features" app/src/components app/src/lib`. It should return nothing.
   - If a component still needs something from `features/`, move that piece down into `components/` or `lib/` instead.
5. Update `.claude/CLAUDE.md` paths that mention moved files. The only such path is `app/src/components/dex/ItemSprite.tsx`, which does not move.

Acceptance: `verify.sh --full` shows no data diff, and a browser smoke test on port 5199 passes. Visit:
- a guide section
- the Pokedex
- a species page
- the item page
- the palette
- a hover card

---

## R51 Dead exports and a knip guardrail

**Model:** sonnet. **Depends:** R50. **Touches:** `app/package.json`, new `app/knip.json`, `scripts/verify.sh`, and `export` keywords across `app/src` and `scripts/`.

Steps:
1. Add `knip` as an app devDependency with `yarn add -D knip` in `app/`. Configure it:
   - entry files: `src/main.tsx`, `vite.config.ts`, `../scripts/*.ts`
   - project files: `src/**/*.{ts,tsx}`, `../scripts/**/*.ts`
2. Run `yarn knip`. For each unused export:
   - If only its own file uses it, drop the `export` keyword.
   - If nothing uses it at all, delete it.
   - Known cases from the review: `toGameConfig` (used only by its test, so keep it and add a knip ignore), `INTERVAL_MS`, `runAutoBackup`, `bossMons`, `topBoosts`, `loadSprites`, `loadItemSprites`, `useItemSpriteManifest`, and about 20 types.
3. Add a `"knip": "knip"` script and run it as a step in `verify.sh` quick mode.

Acceptance: `yarn knip` exits 0, and the quick verify passes.

---

## R52 Formatter (ask Troy first)

**Model:** haiku. **Depends:** R51. **Status:** needs approval. It reformats the whole tree in one commit.

Steps:
1. Add Prettier with the house style:
   - `semi: false`
   - `singleQuote: true`
   - `printWidth: 120`, or whatever matches the current code (measure the 95th percentile of line lengths first)
   - `arrowParens: 'avoid'`
2. Run it once as a standalone `style:` commit, and add that commit's sha to `.git-blame-ignore-revs`.
3. Add `yarn format:check` to `verify.sh`.

---

## R53 README refresh and architecture section

**Model:** sonnet. **Depends:** R50. **Touches:** `README.md`.

Steps:
1. Remove or rewrite the stale planning sections:
   - "Data pipeline (planned)"
   - "Planned layout"
   - "Status", if it is outdated

   Compare each one with what actually exists.
2. Add an "Architecture" section:
   - A one-screen data-flow diagram in a fenced text block: upstream markdown, Ruby generator, `out/json`, the `apply-*` scripts, `build-search` and `build-ranks`, `app/public/data`, and the app.
   - The folder rules from R50.
   - The list of shared building blocks and where they live:
     - `lib/blocks.ts`, `lib/sectionBattles.ts` (ids), `lib/species.ts`, `lib/format.ts`, `lib/storage.ts`
     - `components/ui/*`
     - `scripts/applier.ts`, `scripts/guide-io.ts`, `mapStore`
     - `scripts/verify.sh`
3. Add an "Adding a new kind of section card" recipe:
   1. Def type and validator in `lib/`.
   2. The apply function.
   3. A 10-line `scripts/apply-<kind>.ts` using `runSectionApplier`.
   4. A line in `sync-data.sh`.
   5. A block component built on `Panel` or `BlockTable`.
   6. Progress ids added to the baseline.

Acceptance: every path named in the README exists. Check this with a script that greps each backticked path.

---

## R54 Project instructions for future agents

**Model:** haiku. **Depends:** R53. **Touches:** `.claude/CLAUDE.md`.

Add a short "Code conventions" section of at most 12 lines. It should say:
- Gate changes with `bash scripts/verify.sh`, or `--full` for pipeline or lib changes.
- Before writing a helper, check the shared modules listed in README "Architecture".
- Use the UI primitives: `Panel`, `BlockTable`, `cx`, `Meter`, `ProgressRing`, `usePageTitle`, `useEventListener`. Do not hand-roll their markup.
- Put localStorage access only in `lib/storage.ts`.
- Build battle ids and anchors only in `lib/sectionBattles.ts`. Never edit `lib/progressIds.test.ts` expectations.
- Every new script uses `cli()` and `ROOT` from `game.ts`.
- `components/` and `lib/` never import from `features/`.

Do not change any existing CLAUDE.md rules.

---

## R55 CI for tests (ask Troy first)

**Model:** haiku. **Depends:** R51. **Status:** needs approval. It adds a GitHub workflow to a public remote.

Add `.github/workflows/ci.yml`. It runs on push and pull_request:
1. `yarn install --frozen-lockfile` in `app/`
2. `yarn test`
3. `yarn build`
4. `yarn knip`
5. `node --test scripts/*.test.ts`

Skip the upstream Ruby tests and the full build: they need `upstream/` and the game files, which are local-only.
