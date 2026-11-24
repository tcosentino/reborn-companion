# Refactor board

Status: planned 2026-10-09. Nothing is executed yet.

Source: three read-only review agents (UI, lib and data, build pipeline) covering about 14k lines. The target is roughly 650-750 fewer lines. More importantly, each rule (ids, storage keys, form lookup, block markup, map rendering) should live in exactly one place.

## How this works

- **Executors** are cheap subagents (haiku or sonnet, per task). Each one gets the dispatch prompt below and does one task.
- **Reviewer:** after each wave, an opus agent runs the wave review below before the next wave starts.
- **Safety net:** Wave 0 builds it, and nothing else starts until Wave 0 is green.
  - `scripts/verify.sh` runs the tests and type checks, and in `--full` mode diffs the generated data against a snapshot.
  - `lib/progressIds.test.ts` pins every saved-progress id format.
- **Order:** run tasks one at a time in the main checkout, in the order of the table below. Two tasks may run in parallel only when both are in the same wave, all their dependencies are done, and their **Touches** lists share no file. Use `isolation: worktree` for parallel runs, then merge.
- **Approval gates:** tasks marked "ask Troy" wait for explicit approval in chat.

## Dispatch prompt (copy per task)

```
You are executing refactor task <ID> in /Users/troycosentino/Claude-Experiments/pokemon-rebor.
1. Read docs/plans/refactor/CONTRACT.md and follow it exactly.
2. Read only the "## <ID>" section of docs/plans/refactor/<wave file>. Do that task and nothing else.
3. Finish with the report format from the contract.
```

## Wave review prompt (opus)

```
Review refactor wave <N> in /Users/troycosentino/Claude-Experiments/pokemon-rebor.
Read docs/plans/refactor/CONTRACT.md and docs/plans/refactor/<wave file>.
Run `bash scripts/verify.sh --full`. Then read `git diff <wave-start-sha>..HEAD`.
Check that each task did what its section says and nothing more. Check also:
- saved-progress ids and keys are unchanged
- no duplicate helper survived where the task said it should be gone (grep)
- code style follows the contract
Report:
- pass/fail per task
- regressions, with file:line
- net LOC for the wave (git diff --shortstat)
- follow-ups
Do not edit files.
```

## Tasks

| ID | Task | Model | Depends | Est. LOC | Status |
|---|---|---|---|---|---|
| **Wave 0** | [wave-0-safety.md](wave-0-safety.md) | | | | |
| R01 | `scripts/verify.sh` with data snapshot diff | sonnet | - | +60 | todo |
| R02 | Pin saved-progress id formats in tests | sonnet | - | +80 | todo |
| R03 | Type-check `scripts/` | sonnet | R01 | +15 | todo |
| **Wave 1** | [wave-1-lib.md](wave-1-lib.md) | | | | |
| R10 | `lib/blocks.ts` shared block helpers | sonnet | R02 | -40 | todo |
| R11 | One id validator, all validators in lib | sonnet | R10 | -20 | todo |
| R12 | One home for battle ids, anchors and labels | sonnet | R02 | -15 | todo |
| R13 | `hiddenShotId` builder | haiku | R02 | -2 | todo |
| R14 | `lib/format.ts` (lvRange, dexNum, plural, moveStat) | haiku | - | -15 | todo |
| R15 | `lib/species.ts` form, types and abilities lookups (fixes the PokedexView crash) | sonnet | R14 | -30 | todo |
| R16 | `lib/storage.ts` guarded localStorage | sonnet | R02 | -15 | todo |
| R17 | Remove duplicate evolution and type helpers | sonnet | R15 | -35 | todo |
| R18 | Simplify `score/rank.ts` | sonnet | R17 | -20 | todo |
| R19 | Tighten `data/types.ts` | haiku | R12 | -15 | todo |
| R1A | Data loading: optional JSON, `useSearchIndex`, retry on failure | sonnet | R16 | -45 | todo |
| R1B | One text normaliser | haiku | - | -10 | todo |
| R1C | Shared test fixtures | haiku | R10, R15 | -25 | todo |
| **Wave 2** | [wave-2-ui.md](wave-2-ui.md) | | | | |
| R20 | `cx()` and `doneClasses()` | haiku | - | -15 | todo |
| R21 | `<Panel>` and `useCapped` | haiku | R20 | -25 | todo |
| R22 | `<BlockTable>` | haiku | R20 | -35 | todo |
| R23 | Icons, `<ProgressRing>`, `<Meter>` | haiku | R20 | -20 | todo |
| R24 | `useEventListener` | sonnet | - | -25 | todo |
| R25 | Slim `App.tsx`, `usePageTitle` | sonnet | R23 | ~0 | todo |
| R26 | Split `CommandPalette.tsx`, native dialog | sonnet | R16, R1A, R24 | -30 | todo |
| R27 | Split `HoverCardHost.tsx` | haiku | R15, R24 | ~0 | todo |
| R28 | Duplicate UI constants | haiku | - | -10 | todo |
| **Wave 3** | [wave-3-css.md](wave-3-css.md) | | | | |
| R30 | Design tokens, `.card`, shared `.sr-only` | sonnet | R23 | -40 | todo |
| R31 | Remove dead CSS | haiku | R30 | -20 | todo |
| **Wave 4** | [wave-4-pipeline.md](wave-4-pipeline.md) | | | | |
| R40 | Shell boilerplate (`init_game`, `run_ts`, lazy ruby) | haiku | R01 | -15 | todo |
| R41 | Shared script plumbing (`ROOT`, `guide-io.ts`, move build-ranks) | sonnet | R03 | -30 | todo |
| R42 | Generic section applier and `cli()` | sonnet | R11, R41 | -70 | todo |
| R43 | One map store in `rmxp.ts` | sonnet | R41 | -40 | todo |
| R44 | Split and fix `maps.ts` | sonnet | R42, R43 | -40 | todo |
| R45 | Script test fixtures | haiku | R43 | -10 | todo |
| **Wave 5** | [wave-5-structure.md](wave-5-structure.md) | | | | |
| R50 | Folder layout (`lib/search`, `features/*`) | sonnet | Waves 1-4 | ~0 | todo |
| R51 | Dead exports and knip guardrail | sonnet | R50 | -20 | todo |
| R52 | Prettier (ask Troy) | haiku | R51 | ~0 | needs approval |
| R53 | README refresh and architecture section | sonnet | R50 | ~0 | todo |
| R54 | CLAUDE.md code conventions | haiku | R53 | +12 | todo |
| R55 | CI workflow (ask Troy) | haiku | R51 | +25 | needs approval |
| **Wave 6** | [wave-6-risky.md](wave-6-risky.md) | | | | |
| R60 | Hidden-item screenshots through MapCard | sonnet + opus review | R50, R30 | -90 | todo |
| R61 | Single-process sync pipeline | sonnet + opus review | R42, R43 | -10 | todo |
| R62 | Merge crop functions (ask Troy) | sonnet | R43 | -12 | needs approval |

The executor updates its row's Status to `done` in the same commit.

## Bugs fixed along the way

- R15: `PokedexView` crashes on a species with no form `'0'`.
- R1A: a failed data fetch is cached until the page reloads.
- R44: `maps.ts fmt` and `maps.ts cards` throw without the map dump.

## Scale notes

- R61: the per-script parse and rewrite of every chapter is fine at about 140 sections, and becomes the main cost of sync at about 1k sections or 50MB of JSON.
- R18: repeated ancestor walks in ranking cost about O(species x line^2), which is harmless at about 1k species.
