# Wave 1: shared lib primitives

Goal: every piece of domain logic lives in exactly one place under `app/src/lib/`. Both the app and the `scripts/` build pipeline import from there.

All Wave 0 tasks must have landed. Inside this wave, follow the order on the board, because several tasks edit the same lib files.

---

## R10 `lib/blocks.ts`: shared block and paragraph helpers

**Model:** sonnet. **Depends:** R02. **Touches:**
- `app/src/lib/blocks.ts` (new) and `blocks.test.ts` (new)
- `lib/routes.ts`, `lib/tasks.ts`, `lib/starters.ts`, `lib/itemMaps.ts`
- `scripts/maps.ts`, `scripts/apply-tasks.ts`, `scripts/apply-routes.ts`, `scripts/rmxp.ts`, `scripts/png-crop.ts`

The same small helpers are copied across files:
- `const paragraphs = (md: string) => md.split('\n\n')...` appears in `lib/routes.ts`, `lib/tasks.ts`, `lib/starters.ts` and `scripts/maps.ts`.
- `interface BlockLike { type: string; markdown?: string }` appears in `routes.ts`, `tasks.ts` and `starters.ts`.
- `const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/` appears in `lib/itemMaps.ts`, `scripts/apply-tasks.ts` and `scripts/apply-routes.ts`.
- `type Tile` is declared in `lib/routes.ts`, `lib/itemMaps.ts` and `scripts/rmxp.ts`. `type Box` is declared in `scripts/rmxp.ts` and `scripts/png-crop.ts`. Use grep to confirm each shape is identical.

Steps:
1. Create `app/src/lib/blocks.ts` exporting `BlockLike`, `paragraphs`, `SLUG`, `Tile` and `Box`. Keep the file type-erasable (see the contract).
2. Move `unapplyInserted` from `lib/routes.ts` into `blocks.ts`. Re-export it from `routes.ts` only if something outside lib imports it from there; otherwise update the imports.
3. Add `unapplyLifted(blocks, type, { skipEmpty })` to `blocks.ts`. It replaces both `unapplyTasks` (tasks.ts) and `unapplyStarters` (starters.ts). The two functions are identical except that tasks skips `type === 'task' && !b.markdown`.
4. Keep `unapplyTasks` and `unapplyStarters` as one-line wrappers, e.g. `export const unapplyTasks = <B>(blocks) => unapplyLifted(blocks, 'task', { skipEmpty: true })`, because tests and scripts import those names.
5. Replace every copy with an import. Scripts import with `'../app/src/lib/blocks.ts'`.
6. Write a test for `paragraphs` and `unapplyLifted`.

Acceptance: `grep -rn "md.split('\\\\n\\\\n')" app/src scripts` shows only `blocks.ts`. The quick and full verify checks both pass with no data diff.

---

## R11 One id validator, all validators in lib

**Model:** sonnet. **Depends:** R10. **Touches:** `lib/blocks.ts`, `lib/tasks.ts`, `lib/routes.ts`, `lib/itemMaps.ts`, `scripts/apply-tasks.ts`, `scripts/apply-routes.ts`, `scripts/maps.ts`, and the tests that import these validators.

There are three validators:
- `validateDefs` in `scripts/apply-tasks.ts`
- `validateRouteDefs` in `scripts/apply-routes.ts`
- `validateItemCardDefs` in `lib/itemMaps.ts`

All three repeat the same checks for slug, duplicate id and missing `match`. The error text differs only by a noun:
- `bad id` / `bad route id` / `bad card id`
- `duplicate id` / `duplicate route id` / `duplicate card id`

Steps:
1. Add `validateDefIds(section: string, defs: { id: unknown; match?: unknown }[], noun = ''): string[]` to `blocks.ts`.
   - It must produce **exactly** the current strings, for example `${section}: bad ${noun}id "${id}"`, where noun is `''`, `'route '` or `'card '`.
   - It must also produce `${section}/${id}: missing match`.
2. Change each validator to call it, then keep only its own extra checks.
   - Keep the original order of errors within each def. The id and duplicate checks come first today; check each file.
3. Move `validateDefs` into `lib/tasks.ts` as `validateTaskDefs`, together with its `KINDS` constant.
4. Move `validateRouteDefs` into `lib/routes.ts`.
   - It takes an optional `MapIndex`. Import only that type, with `import type`, from `scripts/rmxp.ts`. If that breaks the app's tsc include, use a structural type: `maps?: Record<number, unknown>`.
5. Update the imports in `scripts/` and `scripts/maps.ts`.
6. Move the related tests from `scripts/apply-tasks.test.ts` (and `apply-routes` tests, if any) into vitest next to the lib file.

Acceptance:
- The error strings are unchanged.
- Both test suites pass.
- `grep -rn "const SLUG" app/src scripts` shows only `blocks.ts`.

---

## R12 One home for battle ids, anchors and labels

**Model:** sonnet. **Depends:** R02. **Touches:**
- `lib/sectionBattles.ts`, `lib/route.ts`, `lib/guideNav.ts`
- `components/palette/anchors.ts`
- `components/SectionView.tsx`, `components/blocks/Battle.tsx`
- `features/guide-nav/ResumeCard.tsx`
- `scripts/check-progress-ids.ts`
- `data/types.ts` (`TeamId` only)

The same id-building code is copied in several places:
- `teamIds.map(t => t.join(':')).join('+')` appears three times: `lib/route.ts` `battleId`, `lib/sectionBattles.ts` `battleKey`, and `palette/anchors.ts` `battleAnchor`.
- The string `'battle-'` is built by hand in `SectionView.tsx` (4 places), `Battle.tsx`, `ResumeCard.tsx` and `lib/guideNav.ts` (where it is also sliced off).
- `b.trainers.map(t => t.teamId)` appears about 6 times.
- The trainer label is built three times: `sectionBattles.ts` `battleLabel`, `guideNav.ts` around line 79, and `SectionView.tsx` around line 83.

Steps:
1. Put these exports in `lib/sectionBattles.ts`, which is already type-erasable and imported by scripts:
   - `type TeamId = [string, string, number]`, also exported from `data/types.ts` by re-export or a move, whichever keeps imports simplest
   - `battleId(teamIds: TeamId[]): string`
   - `battleIdOf(b: { trainers: { teamId: TeamId }[] }): string`
   - `BATTLE_ANCHOR_PREFIX = 'battle-'`, `battleAnchor(id: string)` and `battleIdFromAnchor(anchor: string)`
   - `battleLabel`, already there: export it if it is not
   - one `TrainerLike` type that replaces `guideNav.PageBlock`'s trainer shape, `sectionBattles.BattleLike` and `anchors.AnchorBlock`
2. Delete `battleKey`. `lib/route.ts` re-exports `battleId` so existing imports keep working, or update the imports.
3. Replace every hand-built copy listed above. In `palette/anchors.ts`, make `battleAnchor(teamIds)` call `battleAnchor(battleId(teamIds))` from lib, or update its callers.
4. `scripts/check-progress-ids.ts` redeclares a cut-down `SectionBattles` type. Use `import type` from `lib/sectionBattles.ts` instead.
5. Before you finish, run `grep -rn "join('+')\|'battle-'\|\`battle-" app/src scripts`. Only `sectionBattles.ts` and tests may match.

Acceptance:
- The R02 pinning tests pass unchanged.
- `verify.sh --full` shows no data diff (`battles.json` is byte-identical).

---

## R13 One builder for the hidden screenshot id

**Model:** haiku. **Depends:** R02. **Touches:** `lib/itemMaps.ts`, `features/hidden-items/group.ts`.

The format `${sectionId ?? ''}:${file}:${key}` is built in two places: inside `itemLinkGroups` in `lib/itemMaps.ts` (around line 205), and in `idPrefix` in `features/hidden-items/group.ts` (around line 101), which then gets an entry suffix.

Steps:
1. Export `hiddenShotId(scope: string, file: string, key: string)` from `lib/itemMaps.ts`, next to `itemCheckId`.
2. Use it in both places.
3. Do not change how `scope` is computed by any caller. In particular, `sectionBattles.ts` uses `sec.id ?? ''` while other code uses `sec.id ?? c.id`. Leave both alone, and mention the difference in your report.

Acceptance: the R02 tests pass unchanged and the quick verify passes.

---

## R14 `lib/format.ts`: display formatting helpers

**Model:** haiku. **Depends:** none. **Touches:**
- `app/src/lib/format.ts` (new) and `format.test.ts` (new)
- `components/palette/CommandPalette.tsx`, `components/palette/places.ts`
- `components/pokedex/SpeciesGuideLists.tsx`, `components/pokedex/PokedexView.tsx`, `components/pokedex/SpeciesView.tsx`
- `components/blocks/Battle.tsx`
- `features/hovercards/HoverCardHost.tsx`
- `components/reference/ItemView.tsx`, `components/reference/MoveView.tsx`

Steps:
1. `lvRange(a, b)` is defined identically in `CommandPalette.tsx`, `places.ts` and `SpeciesGuideLists.tsx`, and inlined in `Battle.tsx` (find `Lv ` there). Move it to `format.ts`.
2. Add `dexNum(n)` returning `` `#${String(n).padStart(3, '0')}` ``. Use it in `PokedexView`, `SpeciesView` and `HoverCardHost`.
3. Add `plural(n, one, many = one + 's')` returning `` `${n} ${n === 1 ? one : many}` ``.
   - Replace `n === 1 ? 'x' : 'xs'` ternaries in ItemView, SpeciesGuideLists and CommandPalette only where the output stays identical.
   - Run `grep -rn "=== 1 ?" app/src` to find them.
4. Add `moveStat(v: number | null | undefined)` for move power and accuracy. It returns `'–'` (en dash) when the value is missing.
   - `HoverCardHost.tsx` uses `-` and `MoveView.tsx` uses `–` for the same thing.
   - This is a **behaviour change**: the hover card will show an en dash. That change is approved.
5. Write unit tests for each helper.

Acceptance: `grep -rn "const lvRange\|padStart(3" app/src` shows only `format.ts`.

---

## R15 `lib/species.ts`: form, types and abilities lookups (fixes a crash)

**Model:** sonnet. **Depends:** R14. **Touches:**
- `app/src/lib/species.ts` (new) and `species.test.ts` (new)
- `components/blocks/Battle.tsx`, `components/blocks/Starters.tsx`, `components/blocks/Tables.tsx`
- `features/hovercards/HoverCardHost.tsx`
- `components/palette/CommandPalette.tsx`
- `components/pokedex/PokedexView.tsx`, `components/pokedex/SpeciesView.tsx`, `components/pokedex/CompareView.tsx`
- `components/dex/StatBars.tsx`
- `lib/ranking.ts`, `lib/starters.ts`, `lib/score/rank.ts`, `lib/score/moves.ts`

The form lookup is written about 20 different ways, for example `sp.forms[String(form ?? 0)] ?? Object.values(sp.forms)[0]`, `s.forms['0']` and `forms['0']?.types`. To list them all, run `grep -rn "forms\['0'\]\|forms\[String" app/src`.

`PokedexView.tsx` (around line 111) reads `s.forms['0'].types` with no fallback. It crashes for any species that has no form 0.

Steps:
1. In `species.ts` (type-erasable):
   - `formOf(sp, form?)` returns `sp.forms[String(form ?? 0)] ?? Object.values(sp.forms)[0]`.
   - `typesOf(sp, form?)` returns `formOf(sp, form)?.types ?? []`.
   - `formAbilities(form)` returns `{ sym, hidden: boolean }[]`, deduped. Model it on the deduping version in `SpeciesView.tsx` (around lines 147-152) and `CompareView.tsx` (around lines 127-130).
2. Replace every lookup, including those in `lib/score/*`. Keep each call site's existing fallback value when there is no species (`'NORMAL'`, `'QMARKS'`, `[]`).
3. Base stat total: `lib/ranking.ts` already exports `bst`. Move it to `species.ts` and re-export it from `ranking.ts`. Use it in `SpeciesView.tsx`, `CompareView.tsx` and `StatBars.tsx`, which sum the stats by hand today.
4. Replace the four hand-built "abilities plus hidden ability" lists:
   - `HoverCardHost.tsx` (about lines 39-42)
   - `Starters.tsx` (about line 31)
   - `SpeciesView.tsx`
   - `CompareView.tsx`

   Deduping in the two places that do not dedupe today is an approved **behaviour change**.
5. Write tests: a species without form `'0'` must not throw.

Acceptance:
- `verify.sh --full` shows no data diff. `ranks.json` must be identical, because `lib/score` feeds it.
- The grep in the context above shows only `species.ts`.

---

## R16 `lib/storage.ts`: one guarded localStorage layer

**Model:** sonnet. **Depends:** R02. **Touches:**
- `app/src/lib/storage.ts` (new) and its test
- `lib/progress.ts`, `lib/dexFilters.ts`, `lib/backup.ts`
- `components/palette/CommandPalette.tsx` (only the recent-search read and write)

Steps:
1. `storage.ts` exports:
   - `storageKey(game, name)` returning `` `pokeguide:${game}:${name}` ``
   - `readJson<T>(key, fallback: T): T`, guarded with try/catch
   - `writeJson(key, value): boolean`, guarded with try/catch
2. In `progress.ts`:
   - `toggle`, `setMany` and `replace` each repeat the write, try/catch and notify-listeners steps. Add one private `write(game, list, obj)`.
   - Express `toggle` through `setMany` if that is behaviour-identical.
3. Use `readJson`/`writeJson` in `dexFilters.ts` (around lines 50-56) and in CommandPalette's recent-search code (around lines 24-32).
4. `backup.ts` hardcodes the regex `(progress|caught|hidden)`.
   - Export `MERGED_LISTS = ['progress', 'caught', 'hidden'] as const` from `progress.ts`, or from wherever the list names are defined.
   - Build the regex from that list.

Acceptance:
- The R02 key tests pass unchanged.
- `grep -rn "localStorage\." app/src` shows only `storage.ts`, tests and `autoBackup.ts`/`backup.ts` if they enumerate keys. Report any others.

---

## R17 Remove duplicate evolution and type helpers

**Model:** sonnet. **Depends:** R15. **Touches:** `lib/evolution.ts`, `lib/ranking.ts`, `lib/ranking.test.ts`, `lib/score/moves.ts`, `lib/typechart.ts`.

Steps:
1. `preEvolutionMap` (`lib/ranking.ts`, around lines 36-47) and the private `parentsOf` (`score/moves.ts`, around lines 13-27) build the same map.
   - Export one `preEvolutions(pokedex)` from `lib/evolution.ts`, cached in a `WeakMap` keyed by the pokedex object.
   - Use it in both places.
2. `singleTypes` (`score/moves.ts`, around line 104) is `attackingTypes` (`lib/typechart.ts`, around line 6) with the pseudo-type list pasted in. Use `attackingTypes`.
3. `descendants` (`ranking.ts`, around lines 17-33) is only used by `ranking.test.ts`. Delete it and its tests.
   - First confirm with `grep -rn descendants app/src scripts`.

Acceptance: `verify.sh --full` shows no data diff (`ranks.json` and `movesets.json` are identical).

---

## R18 Simplify `score/rank.ts`

**Model:** sonnet. **Depends:** R17. **Touches:** `lib/score/rank.ts` only, plus its test.

Steps:
1. `friction` (around lines 73-85) and `tradeEvolved` (around lines 141-143) walk the same ancestor chain, and they call `ancestors()` inside inner loops.
   - Replace both with one `evolutionLine(pokedex, sym)` that returns `{ trade: boolean, lateLevel: boolean }`.
   - Compute the ancestor set once.
2. Line 25 calls `finalForms` twice for each species. Call it once.
3. Lines 170-171 compute the same damage expression twice. Extract `dmg(m)`.
4. Lines 27-32 and 43 build the per-factor records by hand. Replace them with `const FACTORS = Object.keys(WEIGHTS) as Factor[]` and `Object.fromEntries`.

Acceptance: `ranks.json` must be byte-identical, so run `verify.sh --full`. Any diff fails this task.

---

## R19 Tighten `data/types.ts`

**Model:** haiku. **Depends:** R12. **Touches:** `app/src/data/types.ts`, `app/src/games.ts`, `scripts/game.ts`, `lib/route.ts`, `lib/guideNav.ts`, and files that use `TaskRef`/`BattleRef`.

Steps:
1. The inline shape of `Dex.moves` (around line 157) is the same as `MoveData` (around line 200). Use `Record<Sym, MoveData>`.
2. The `{ name; desc }` ability shape appears twice (around lines 158 and 191). Add `AbilityData`.
3. `PokedexSpecies.mentions` (around line 186) should be `Pick<DexLocation, 'chapterId' | 'sectionId' | 'sectionTitle'>`.
4. `TaskRef` and `BattleRef` are both `[string, string]`. Replace them with one `CheckRef`.
   - `guideNav.progressRefs` types tasks as `BattleRef[]` today.
   - Keep the old names as aliases only if more than 3 files import them.
5. `scripts/game.ts` `GameManifest` repeats `app/src/games.ts` `GameConfig`. Make it `interface GameManifest extends GameConfig { build: ... }`, using an `import type`.

Acceptance: the quick verify passes, and this is a types-only change (no runtime diff).

---

## R1A Data loading: one optional-JSON fetch and one search-index hook

**Model:** sonnet. **Depends:** R16. **Touches:**
- `app/src/data/load.ts`
- `components/dex/sprites.ts`, `components/dex/ItemSprite.tsx`
- `components/fields/fieldData.ts`
- `features/hovercards/WhereLine.tsx`
- `components/reference/ItemView.tsx`, `components/reference/MoveView.tsx`
- `components/pokedex/SpeciesGuideLists.tsx`
- `components/palette/CommandPalette.tsx` (only the index-loading code)

Steps:
1. `load.ts` has about 8 loaders that differ only by file name. Collapse them with `const loader = <T>(file: string) => (game: string) => fetchJson<T>(...)`. Keep every exported name.
2. **Behaviour change (approved):** a rejected fetch is cached forever today. Delete the cache entry when a fetch rejects, so a later call retries.
3. Three files repeat the same "cache Map, fetch, `r.ok ? json : {}`, catch, `let live` hook" pattern:
   - `sprites.ts` (around lines 15-47)
   - `ItemSprite.tsx` (around lines 9-41)
   - `fieldData.ts` (around lines 19-39)

   Add `fetchOptionalJson<T>(url, fallback: T): Promise<T>` to `load.ts`, cached per URL. Rewrite each hook on top of it with the existing `useAsync`.
4. Add `useSearchIndex(): AsyncState<SearchIndex>` next to `useAsync`. Replace:
   - the custom hook in `WhereLine.tsx`
   - the `useAsync(() => loadSearchIndex(game.id), [game.id])` calls in `ItemView`, `MoveView` and `SpeciesGuideLists`

   CommandPalette has prefetch logic: keep the prefetch, but have it call the same cached loader.
5. Write a test: the loader retries after a rejection.

Acceptance: the quick verify passes. Then do a browser check on the `app-scratch` launch config (port 5199): open a section, hover a Pokemon, open the palette and search, and confirm sprites render.

---

## R1B One text normaliser

**Model:** haiku. **Depends:** none. **Touches:** new `app/src/lib/text.ts`, `features/hidden-items/HiddenItems.tsx`, `components/dex/ItemSprite.tsx`, `components/palette/buildIndex.ts`, `components/palette/search.ts`, `components/palette/anchors.ts`, `features/hovercards/names.ts`.

Steps:
1. `norm` in `HiddenItems.tsx` (around line 11) is identical to `normItemName` in `ItemSprite.tsx` (around line 22). Keep one and export it from `lib/text.ts`.
2. Accent stripping is re-implemented in `buildIndex.ts`, `search.ts`, `anchors.ts` and `names.ts`. Add `stripAccents(s)` to `lib/text.ts`.
   - Before replacing, read each copy. Replace only the ones that are character-for-character the same transform.
   - The search index is built at build time. `verify.sh --full` must show no diff in `search.json` (or whatever the index file is named).

Acceptance: `verify.sh --full` shows no data diff.

---

## R1C Shared test fixtures

**Model:** haiku. **Depends:** R10, R15. **Touches:** new `app/src/test/fixtures.ts` and the `*.test.ts` files listed below.

Steps:
1. The builders `prose`, `battle`, `task` and `def(over)` are repeated in:
   - `lib/routes.test.ts` (lines 4-6)
   - `lib/tasks.test.ts` (lines 4-5)
   - `lib/starters.test.ts` (line 5)
   - `features/hidden-items/group.test.ts` (lines 6-7)

   Move them into `fixtures.ts`.
2. Add a `species(name, over?)` builder. Use it in `lib/ranking.test.ts` (`mon`) and `lib/score/score.test.ts` (around lines 145-174, including the nested override spread).
3. `ranking.test.ts` also tests `route.ts`, `compare.ts` and `evolution.ts`. Move those cases into `route.test.ts`, `compare.test.ts` and `evolution.test.ts`.

Acceptance: the same number of passing tests as before (compare vitest's count), and the quick verify passes.
