# Wave 0: safety net

These tasks must land first. Every later task relies on them to prove it changed nothing. Run them in order.

---

## R01 Verification script

**Model:** sonnet. **Depends:** none. **Touches:** `scripts/verify.sh` (new), `.gitignore` if needed.

Goal: one command that every later task runs as its gate.

Create `scripts/verify.sh` (bash, `set -euo pipefail`, same header style as `scripts/sync-data.sh`):

- `bash scripts/verify.sh`, the quick mode, does the following:
  1. Run `bash scripts/test.sh`.
  2. Run `yarn test` in `app/`.
  3. Run `yarn build` in `app/` (tsc and the vite build).
  4. Stop at the first failure and print which step failed.
- `bash scripts/verify.sh --full` does the quick steps, then:
  1. Run `bash scripts/build.sh reborn`.
  2. Hash every file under `app/public/data/reborn/`: sorted relative path plus `shasum -a 256`.
  3. Compare the hashes with `out/verify/reborn.sha256` and print `added`, `removed` and `changed` paths. Exit 1 if anything differs.
- `bash scripts/verify.sh --snapshot` runs `build.sh reborn`, then writes the snapshot file. The snapshot lives under `out/`, which is gitignored and stays local.
- Make the hashing a small function so the game id can become an argument later. Default to `reborn`.
- Follow the user's global rule: write the script so it never needs a long one-liner at the call site.

Then run `bash scripts/verify.sh --snapshot` on the current `main` to create the baseline. Run `--full` and confirm it reports no diff.

Add one paragraph to README "Running locally" that names the three modes.

Acceptance:
- `--full` passes on an unchanged tree.
- Editing one generated JSON file by hand makes `--full` fail and name that file. Restore the file afterwards.

---

## R02 Pin every saved-progress id format with tests

**Model:** sonnet. **Depends:** none. **Touches:** new `app/src/lib/progressIds.test.ts` only.

Goal: tests that fail if any id or key format drifts. Later refactors move these builders around, and this test is the tripwire.

Write vitest cases that import the **current** builders and assert exact strings:
- `battleId` from `lib/route.ts`:
  - `[['A','B',0],['C','D',1]]` must give `'A:B:0+C:D:1'`.
  - A single team gives `'A:B:0'`.
- `battleKey` in `lib/sectionBattles.ts` must give the same output as `battleId` for the same input.
  - `battleKey` may not be exported. If it is not, test through the exported function that builds `battles.json` entries.
- `battleAnchor` in `components/palette/anchors.ts` must give `'battle-A:B:0+C:D:1'`.
- `taskKey` in `lib/tasks.ts` must give `task:<section>/<id>`.
- `itemCheckId` in `lib/itemMaps.ts` must give `item:<section>/<card>/<event>`. Read the function to get the exact argument order.
- Hidden screenshot ids:
  - Use `idPrefix` and `hiddenEntryId` in `features/hidden-items/group.ts`, plus the id built inside `itemLinkGroups` in `lib/itemMaps.ts`.
  - Assert the `<sectionId>:<file>:<key>` format.
  - Assert that both paths produce the same string for the same input.
- localStorage keys:
  - In `lib/progress.ts` assert the key for each list (`progress`, `caught`, `hidden`) is `pokeguide:<game>:<list>`.
  - Do the same for the palette recent key (`pokeguide:<game>:palette-recent`, in `CommandPalette.tsx`) and the dex filter key (in `lib/dexFilters.ts`).
  - If a key is only built inline, assert it by:
    - stubbing `localStorage`
    - calling the public function that writes it
    - reading back which key was set

  Do not refactor in this task to make a key testable.
- `backup.ts`: assert the list regex matches `progress`, `caught` and `hidden`, and nothing else.

Use only public behaviour. Add a header comment: `// Pins saved-progress id formats. Never edit expected strings: change the code instead.`

Acceptance: `yarn test` passes, and no production files changed.

---

## R03 Type-check the build scripts

**Model:** sonnet. **Depends:** R01. **Touches:** new `scripts/tsconfig.json`, `scripts/verify.sh`, `app/tsconfig.json`, and type-only fixes in `scripts/*.ts` and `app/scripts/*.ts`.

Goal: today `tsc` only checks `app/src`, so `scripts/` can rot without anyone noticing.

Steps:
- Add `scripts/tsconfig.json` with:
  - `strict`, `noEmit`, `allowImportingTsExtensions`
  - `module` `nodenext`, `target` `ES2023`
  - `types: ["node"]`
  - `include`: `["*.ts", "../app/scripts/*.ts"]`

  Resolve `@types/node` from `app/node_modules`, e.g. with `typeRoots`. Do not add a root package.json.
- Run `app/node_modules/.bin/tsc -p scripts`. For each error:
  - If it can be fixed with a type annotation, a type import or a narrow cast, without changing runtime code, fix it.
  - Otherwise add `// @ts-expect-error <reason>` and list it in your report.
- Add this check as a step in `verify.sh` quick mode.
- `app/tsconfig.json` sets `allowImportingTsExtensions` twice. Remove the duplicate.

Acceptance:
- `tsc -p scripts` passes.
- `verify.sh --full` shows no data diff.
