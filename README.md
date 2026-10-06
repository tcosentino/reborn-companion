# Reborn Companion

A Vite + React + TypeScript web app that serves as a complete guide, walkthrough and companion for **Pokemon Reborn** (v19.5). It is built from the source of [BIGJRA's Reborn walkthrough](https://bigjra.github.io/reborn/) ([repo](https://github.com/BIGJRA/BIGJRA.github.io), MIT licensed), with a much richer UI and the game data that guide leaves out.

## Why

BIGJRA's guide is the most complete Reborn walkthrough, but it ships as a single ~3 MB HTML page of prose and dense tables. That is hard to use on a phone, hard to search, and it drops useful data such as types, move power and weaknesses. This project keeps BIGJRA's walkthrough as the source of truth and changes how it is presented.

## Goals

- **Full walkthrough**: every main episode (1-19), every post-game episode (1-9) and the appendices, split into navigable sections such as "Obsidia Ward".
- **Trainer cards**: one row per Pokemon showing level, types, ability, moves and held item. A "Weak to" column computes type matchups, with 4x weaknesses listed first. Field effects appear where they apply.
- **Encounters, shops, tutors, partner battles, pickup tables**: rendered from data rather than static HTML.
  - Wild encounter tables group rows by method (Grass, Cave, Surf, rods...), one row per Pokemon. Time of day is the only thing shown as columns, and only when the Morning/Day/Night tables differ; methods mostly have different Pokemon, so method columns would be mostly empty. Grouping lives in `app/src/components/blocks/encounterGrid.ts`.
- **Companion features**: search across the whole guide, per-section progress tracking ("next unbeaten trainer"), a compact view, and team-coverage hints such as "Hits most of this team: Rock, Electric".
- **Mobile first**: readable at phone width, with light and dark themes.
- **Lazy loading**: one episode's JSON at a time. The full guide is several hundred trainers and about 20k lines of tables, which is too much to render at once on a phone.

## How the source works

`upstream/` is a clone of BIGJRA's repo. The raw walkthrough lives in `upstream/src/_raw/reborn/` (`main_ep_01.md` through `main_ep_19.md`, `post_ep_01.md` through `post_ep_09.md`, `appendices.md`, about 11.7k lines). The prose is plain markdown, but every table is a macro that is expanded at build time:

```
!battle(["Franklin", :StreetRat, 0])
!dbattle(["Grant", :MeteorGrunt, 1], ["Janis", :MeteorGrunt_090, 1])
!enc(103, nil, nil, "Underground Railnet (Obsidia Side)")
!shop("Devon Corporation", ["Potion", "Repel", "Poke Ball"])
```

| Macro | Count | Meaning |
| --- | --- | --- |
| `!battle` | 667 | single trainer battle |
| `!img` | 261 | image |
| `!enc` | 232 | wild encounter table for a map |
| `!dbattle` | 114 | double battle |
| `!shop` | 84 | mart inventory |
| `!partner` | 39 | partner (tag) battle |
| `!tutor` | 23 | move tutor |
| `!wildheld`, `!ttbattles`, `!pickup` | 1 each | misc tables |

`upstream/wt_generator.rb` and `upstream/_utils/*.rb` (`trainer_getter`, `encounter_getter`, `shop_getter`, `common`) expand these macros by reading the game's own data files from Reborn's `Scripts/` folder.

| File | Data |
| --- | --- |
| `trainertext.rb`, `ttypetext.rb` | trainer parties and trainer classes |
| `bosstext.rb` | boss battles |
| `enctext.rb` | wild encounters |
| `marttext.rb` | shops |
| `montext.rb` | species (types, abilities, stats) |
| `movetext.rb` | moves (type, power, category) |
| `abiltext.rb`, `itemtext.rb`, `typetext.rb` | abilities, items, type chart |
| `fieldtext.rb` | field effects |
| `metatext.rb` | map metadata |

## Data pipeline (planned)

Fork the generator so it emits JSON instead of HTML tables:

1. **Get game data**: download Reborn 19.5 from [rebornevo.com/pr/download](https://www.rebornevo.com/pr/download/) (about 700 MB, Mac build available). Copy its `Scripts/` folder to `game-scripts/` locally. The Scripts are not in BIGJRA's repo, because their build pulls them from a private repo.
2. **Extract**: run a modified `wt_generator.rb` with the Scripts path to write one JSON file per episode. Each file is an ordered list of blocks such as `{ type: 'prose', md }`, `{ type: 'battle', trainer, party: [...] }`, `{ type: 'encounters', ... }` and `{ type: 'shop', ... }`. It also writes shared lookup tables for species, moves, abilities, items, the type chart and fields.
3. **Render**: the Vite app loads the lookup tables once and episode JSON on demand.

**Fallback**: if the game files are unavailable, scrape BIGJRA's built HTML instead. Its tables use consistent classes (`trainer_section`, `shop_section`, `encounter_section`). This approach is more fragile and lacks types and move data.

## Planned layout

```
pokemon-rebor/
  upstream/          BIGJRA repo clone (gitignored; git clone https://github.com/BIGJRA/BIGJRA.github.io upstream)
  game-scripts/      local copy of Reborn Scripts/ (gitignored, never published)
  scripts/           extraction: Ruby JSON emitter and/or TS post-processing
  overrides/         per-section content edits applied to upstream's raw markdown at build time
  app/               Vite + React + TS app
    public/data/     generated JSON (episodes + lookups)
    src/
```

## Licensing and credit

- BIGJRA's walkthrough text is MIT licensed. Credit it and link back from every page.
- Reborn's game data has no formal license. Forum guidance allows fan use with credit, but **do not commit or publish the raw `Scripts/` folder**. Keep `game-scripts/` gitignored, and check with the Reborn developers before publicly hosting derived data.
- Some battle backgrounds and named NPC sprites may not be reused.

## Status

- [x] Prototype: redesigned Obsidia Ward section as a standalone page ([artifact](https://claude.ai/artifact/GfQd2ALrvCBC9L5fvCuc5K))
- [x] Cloned upstream repo and mapped its macros and game-file dependencies
- [x] Obtain Reborn 19.5 `Scripts/` locally (19.5.0 Mac build; live guide uses 19.5.18)
- [x] JSON emitter for the generator (`upstream` branch `json-export`, golden-tested byte-identical HTML against the `content` branch)
- [x] Scaffold the Vite app (`app/`, multi-game registry in `app/src/games.ts`)
- [x] Episode views, trainer cards, encounters, shops
- [x] Search (Cmd+K palette) and progress tracking: whole-guide progress, resume, hide defeated (see "Guide navigation")
- [ ] Compact view
- [ ] Deploy (possibly under troycosentino.com)

## Running locally

```
bash scripts/build-json.sh      # game-scripts/ -> out/json/reborn/
bash scripts/sync-data.sh       # builds search.json, then out/json/reborn/ -> app/public/data/reborn/
cd app && yarn && yarn dev      # http://localhost:5174/#/reborn/obsidia-ward
```

`sync-data.sh` runs `node scripts/build-search.ts` (Node >= 23.6, native TS type stripping) to write `out/json/<game>/search.json`, the compact index behind the Cmd+K palette (`app/src/components/palette/`). Palette deep links use `#/<game>/<section>/<anchor>`, where the anchor is a block id such as `battle-<teamIds>`, `enc-<slug>`, `shop-<slug>` or `tutor-<slug>`. The same script writes `battles.json` (each section's non-partner battle ids and labels, about 12 KB gzipped), which drives whole-guide progress without loading every chapter. It also lists each section's walkthrough tasks under `t` (see "Walkthrough tasks").

Tests: `bash scripts/test.sh` (override unit tests, generator golden + JSON tests) and `cd app && yarn test`.

## Editing guide content

Never edit `upstream/src/_raw/` in the `upstream/` working tree directly: `upstream/` is gitignored here and other sessions may reset it.

`upstream/` has three branches of our own, all pushed to the `fork` remote (`tcosentino/BIGJRA.github.io`) as a backup; push after changing them:

| Branch | Contents |
| --- | --- |
| `json-export` | our generator changes (JSON emitter, `WT_RAW_DIR`) on top of BIGJRA `main` |
| `content` | BIGJRA `main` plus our submitted content PR branches, merged with `--no-ff` |
| `companion` | `json-export` merged with `content`; this is what `upstream/` has checked out and what builds use |

Factual fixes to the guide (wrong directions, missing steps) go upstream as a PR to `BIGJRA/BIGJRA.github.io` from the fork `tcosentino/BIGJRA.github.io`:

1. In a separate clone of the fork, branch off BIGJRA `main`, edit `src/_raw/<game>/*.md`, push and open the PR.
2. In `upstream/` (remote `fork`): `git fetch fork <branch>`, merge it into `content`, then merge `content` into `companion`.
3. `bash scripts/build-baseline.sh` (the golden test baseline is built from `content`), then `bash scripts/build-json.sh && bash scripts/sync-data.sh`.

Once BIGJRA merges a PR, merging `origin/main` into `content` is a no-op for that change. Submitted PRs so far: [#35](https://github.com/BIGJRA/BIGJRA.github.io/pull/35) (Lower Peridot Ward donation guy).

Edits that only make sense in this app, such as `#/` links between sections, go in a section override in `overrides/<game>/` instead:

```
---
file: main_ep_01.md
heading: All Aboard!
---
Replacement body for that section (the heading line is kept).
```

`build-json.sh` copies the raw markdown to `out/raw/`, applies every override (`scripts/apply-overrides.ts`), and points the generator at the copy via `WT_RAW_DIR`. An override replaces everything from its heading to the next heading of the same or higher level, so subsections are replaced too. The build fails if the heading is missing or appears more than once in the file, so upstream renames surface immediately. Links to other sections use `#/<game>/<section-id>`.

Adding another game: produce the same JSON schema (`index.json`, `dex.json`, `chapters/*.json`, see `app/src/data/types.ts`) into `app/public/data/<id>/` and add an entry to `app/src/games.ts`.

## Guide navigation

Lives in `app/src/features/guide-nav/` with pure logic in `app/src/lib/guideNav.ts`, `catchHere.ts` and `sectionBattles.ts` (unit-tested).

- **Resume**: the block being read (the last anchored block above the reading line) or the battle last ticked is saved with the section (`pokeguide:<game>:lastAnchor`, next to the original plain `lastSection` key). Reloading that section returns to the block. The game root (`#/<game>`) shows a "Continue" card with the next unbeaten trainer there and your furthest progress.
- **Back to guide**: Pokedex, species and compare pages link back to the last section and block.
- **Whole-guide progress**: the sidebar shows beaten/total per section and per chapter from `battles.json`, marks the furthest section with a battle won, opens its chapter, and offers "Jump to my spot" (the first unbeaten battle from there on). Next to each battle count is a Pokemon caught count (ball icon): the distinct species listed in that section or chapter (encounter tables and shops, from `pokedex.json` locations via `sectionSpecies` in `app/src/lib/guideNav.ts`).
- **On this page**: a sticky dropdown listing the section's battles (with ticks), encounter tables, shops and tutors, highlighting the block in view.
- **Hide defeated**: collapses beaten trainer cards to their header row (`pokeguide:<game>:prefs`).
- **Catch here**: a header chip, "N species here, M not caught", expands into the section's wild species (deduplicated, sorted by tier then new-to-dex) with one-tap caught toggles. "Last listed here" flags species that no later encounter table or walkthrough mention lists (evolutions and unlisted gifts are not considered).
- **Phone bottom bar** (under 860px): Contents, previous/next section, Search, and a center button that jumps to the next unbeaten trainer, or marks it beaten once it is on screen. It replaces the floating Contents and search buttons.

## Walkthrough tasks

Optional catches, side quests and notable NPC items that the guide only mentions in prose ("talk to the northernmost dumpster to catch Gulpin") render as checkable task cards and count toward progress.

- **Source**: `tasks/<game>/<section-id>.json`, one array per section of `{ id, kind, title, match, species? }`. `kind` is `catch`, `quest` or `item`; `match` is the verbatim start of the paragraph the task covers; `species` (catch only) holds dex SYMs. The Reborn set (383 tasks in 138 sections) was drafted by Haiku subagents reading each section's prose, validated against the data (paragraph snapping, species lookup), then reviewed by Sonnet subagents (fixed paragraphs, titles and species, dropped non-tasks, added missed Mega Stones, Z-Crystals, legendaries and key items). `species` is checked against `pokedex.json`, which unlike `dex.json` lists every species. Edit these files by hand.
- **Build**: `sync-data.sh` runs `scripts/apply-tasks.ts` first, which lifts each matched paragraph out of its prose block into a `task` block (`app/src/lib/tasks.ts`). It is idempotent (earlier splits are undone first) and fails when a `match` finds no paragraph, two different matches overlap, or a file names an unknown section. Several tasks can share one paragraph by using the identical `match`; the first card carries the text.
- **Progress**: ticks live in the normal `progress` checklist as `task:<section>/<id>`, so never rename a task `id`. `battles.json` lists them under `t` (parallel to `s`), the progress-id baseline guards them, and the sidebar, section hero ("tasks done") and On this page counts include them. "Jump to my spot" and the bottom bar still follow battles only. Ticking a catch task also marks its species caught (unticking leaves caught alone).
- **Card**: `app/src/components/blocks/Task.tsx`, anchor `task-<id>`. Hide defeated also collapses done tasks.

## Starter picker

The Grand Hall's plain list of starter names renders as a card grid instead: one card per starter, grouped by type, with sprite, final form and its types, "worth leveling" tier, every ability (hidden ones tagged HA) and the natures worth soft-resetting for, each with its stat effect.

- **Source**: `starters/<game>/<section-id>.json`, `{ match, title?, picks: [{ species, ability, natures, note }] }`. `match` is the verbatim start of the paragraph the cards replace. `ability` is the SYM to reset for, or `null` when either is fine; `natures` are names, best first. Edit by hand.
- **Build**: `sync-data.sh` runs `scripts/apply-starters.ts` after tasks. It swaps the paragraph for a `starters` block (`app/src/lib/starters.ts`, which also holds the nature table), is idempotent, and fails on a missing paragraph or a species, ability or nature that is not in `pokedex.json`.
- **Card**: `app/src/components/blocks/Starters.tsx`, anchor `starters` (e.g. `#/reborn/grand-hall/starters`).

## Route maps

Paragraphs with non-obvious walking directions ("head out, and back up past the rod guy's house") get a route map: the game's own map with the path drawn on top and numbered stops.

- **Map data**: `bash scripts/build-maps.sh <game>` unzips `Data/` and the map graphics (`build.maps` in `games/<game>.json`) into `out/game/<game>/` and dumps all maps to `out/maps/<game>/` as JSON (`scripts/dump-maps.rb`: tiles, tilesets, events with their pages, dialogue and warps). Like sprites it is optional and local-only; never commit game files.
- **Source**: `routes/<game>/<section-id>.json`, one array per section of `{ id, match, map, title?, points: [{ at: [x, y], label?, via?, direct? }], surf?, hide?, pad?, spoiler? }`. `match` is the verbatim start of the paragraph; `map` is the game map id. Labelled points become numbered markers; a point on a person (solid character event that is not a door) stops on the tile in front of them and the card nudges the marker off their sprite, so readers can see who to talk to (if the way on leads through their tile, the next leg starts there); `via` points only steer the path; `direct` points are reached in a straight line (scripted stairs, surfing); `hide` drops events (cutscene actors) from the render and pathing; `surf` makes water walkable; `spoiler` keeps a puzzle solution covered until tapped. Pathing follows the game's rules: ledge jumps, tile-object bridges, and warps to other maps only at a route's ends. Doors that warp within the same map (multi-room dungeons) are followed automatically and break the drawn line. Authoring guide: `routes/AUTHORING.md`.
- **Build**: `sync-data.sh` runs `scripts/apply-routes.ts` after tasks. For each route it finds the shortest walkable path through the points (fewest turns, RMXP passability plus solid events, `scripts/rmxp.ts`), crops the map around it, renders the crop to `app/public/maps/<game>/<section>--<id>.png` (gitignored, re-rendered only when inputs change) and inserts a `route` block after the paragraph (`app/src/lib/routes.ts`). Without the map dump it warns and skips routes. It fails on a missing paragraph, unknown map or unreachable point.
- **Coverage**: the Reborn set (157 routes in 65 sections) was drafted by subagents reading every section, locating NPCs and doors from the map dump and checking each preview. Ice sliding, rock climb, waterfalls, diving and Strength puzzles are not modelled; those routes use `direct` points or were skipped.
- **Card**: `app/src/features/route-map/RouteMap.tsx` draws the path and markers as SVG over the crop, with a legend and a click-to-enlarge dialog. It hides itself if the image is missing (a host built without game files). Anchor `route-<id>`.
- **Authoring**: `node scripts/maps.ts <game> <cmd>` finds maps (`names`), NPCs by dialogue (`find`), doors and NPC coordinates (`map`), renders gridded maps (`grid`), prints a section's paragraphs (`section`), validates (`check`), shows walkable tiles (`reach`) and previews routes (`preview`) into `out/map-previews/`. Events are drawn in their default (pre-story-switch) state, so cutscene actors may need `hide`.

## Keeping progress safe

Progress (beaten trainers, caught Pokemon, hidden items, prefs, resume spot) lives in the browser's localStorage under `pokeguide:<game>:*`. App updates and rebuilds do not touch it, but three things can:

- **Origin change**: localStorage is per origin. Dev and `vite preview` are pinned to `localhost:5174` with `strictPort`, so a busy port fails instead of silently opening an empty 5175. Hosting the app elsewhere (e.g. troycosentino.com) is a new origin: use Back up / Restore.
- **Id changes**: battle ticks are keyed by battle id. `sync-data.sh` runs `scripts/check-progress-ids.ts`, which fails the build if any id in the committed baseline `progress-ids/<game>.json` disappears. Rerun with `--accept` only after deciding those ticks may be orphaned. Ticks for unknown ids are never deleted, so a reverted id comes back ticked.
- **Browser eviction or clearing**: the app requests persistent storage on load. The sidebar footer has **Back up** (downloads every `pokeguide:` key as JSON) and **Restore** (merges a backup in: checklists are unioned so nothing is unticked; prefs and resume spot take the file's values). Logic in `app/src/lib/backup.ts`.
- **Auto-backup**: while running under `yarn dev` or `yarn preview`, the app POSTs its backup to `/__backup` 10 s after load and every 30 minutes (`app/src/lib/autoBackup.ts`). The Vite plugin `app/backupPlugin.ts` writes `backups/progress-<local time>.json` at the repo root (gitignored), skipping empty or unchanged snapshots and keeping the newest 50. Restore any of them with the Restore button. On a static host the endpoint is absent and auto-backup switches itself off.

## Pokedex

`#/<game>/pokedex` lists every species, and `#/<game>/pokedex/<SPECIES>` shows one: stats, abilities, evolutions with their conditions, and every guide section where it can be found. The generator writes this data to `pokedex.json`, which holds all species plus ability names and evolution-parameter names. The app loads it in the background, so the guide never waits on it.

- **Caught checklist**: stored per browser (`pokeguide:<game>:caught` in localStorage) and shared between the Pokedex and the checkboxes in every wild encounter table. It does not sync across devices.
- **Available by**: filters to species found in encounter tables or shops up to a chosen episode. It defaults to the episode of the last guide section you viewed. Starters, gifts and eggs are not in encounter tables, so they only appear under "All species".
- **"Worth leveling" tiers (S-D)**: computed from game data plus one curated list (ability values in `app/src/lib/score/abilities.ts`). Each species gets five 0-100 percentile factors: base stats (blended toward its Mega form for the part of the story after the guide first mentions its Mega Stone), movepool, matchups against the guide's boss battles (weaknesses count for less when it outspeeds the boss or runs a setup move), availability (how early it is catchable) and ability (its best regular ability; hidden abilities count 70% unless the starter picker recommends resetting for them). They combine into a score, and tiers are percentile-based among fully evolved species: S top 5%, A next 15%, B next 30%, C next 30%, D bottom 20%. Pre-evolutions take their best final form's tier. The species page shows the factor breakdown and the data-derived reasons.
  - **Stats**: offense-weighted base stats.
  - **Movepool**: strength and type coverage of the recommended set.
  - **Boss matchups**: how that set and the species' typing fare against main-story boss Pokemon from the chapter it becomes catchable. Bosses are battles with named trainers, whose trainer type is all caps or matches their name.
  - **Availability**: the earliest chapter where the line is in an encounter table or shop, or bolded in the walkthrough prose (`mentions` in `pokedex.json`, which catches gifts, eggs and starters).
  - **Penalties**: the score is reduced for trade evolutions (which need a Link Stone in Reborn), evolutions at level 50+, and abilities whose description shows they hinder the user (Truant, Slow Start, Defeatist).
  - The logic lives in `app/src/lib/score/` and is unit-tested.
- **Recommended moveset**: the species page also shows a computed set (role, nature, four moves, coverage) built from the game's learnsets and move data, including moves a pre-evolution must learn. Compare shows it side by side.
- `ranks.json` and `movesets.json` are built by `node app/scripts/build-ranks.ts`, which `scripts/sync-data.sh` runs automatically.
- **Gift / special**: sections whose prose bolds the species (`mentions`) and that are not already listed under "Where to find", so gifts, eggs, statics and trades show up.
- **Faced in battle**: every trainer whose party includes the species (from `search.json`), grouped by episode and linked to the battle block. The first 10 show until "Show all".

## Item and move pages

- `#/<game>/item/<SYM>` lists every shop that sells an item (with price), every section whose prose names it as a pickup, and, for TMs, the move it teaches plus any tutors for that move. Items without a dex SYM (coins, Pokemon sold in shops) use a name key such as `500coins`.
- `#/<game>/move/<SYM>` shows type, category, power, accuracy and PP, the tutors and TMs that teach it, and every species that learns it by TM/tutor or level up (`learnsets.json`, loaded only on this page; long lists are capped until "Show all").
- Both pages are built client-side from `search.json` (`app/src/components/palette/places.ts`). Routes are in `app/src/lib/route.ts` (`itemHref`, `moveHref`); the pages live in `app/src/components/reference/`.
- TMs: `buildIndex.ts` keys TM/HM/TR items by number, merges shop listings with prose pickups such as `*TM57 Charge Beam*`, names them after their move and stores the move SYM as the row's fifth field. Shop and tutor anchors get display titles in `al` (parallel to `a`).
- Item and move hover cards add a "Where to get" / "Where to learn" line ("Sold at Grand Hall Candy ($12,000), Seventh Street Misc. Wares ($12,000), +4 more") that links to these pages, reusing the palette's cached search index.

## Search palette

- Hits with several locations show a `+N` chip. Click it or press Right arrow (caret at the end of the input) to list each location with its episode; Left arrow collapses.
- Shift+Enter, or the Dex/Page button, opens the Pokedex entry for Pokemon and the item/move page for items and moves.
- Scope prefixes: `t:` trainers, `p:` Pokemon, `i:` items, `m:` moves and TMs, `s:` sections (e.g. `m: iron`). Scoped searches show up to 30 hits per group.

## Token usage

`usage/README.md` tracks what building this project has cost in Claude Code tokens (by model, day, source and session, with estimated API list-price cost). `scripts/token-usage.ts` reads the local transcripts under `~/.claude/projects/` for this repo, `upstream/` and agent worktrees (subagents are billed to their parent session) and merges them into `usage/ledger.json`. Claude Code deletes transcripts after 30 days, so the committed ledger keeps sessions whose transcripts are gone. A Stop hook in `.claude/settings.json` reruns it after every Claude turn; run it by hand with `node scripts/token-usage.ts`. The app shows it at `#/usage` (linked from the game picker): per-chat cost with titles, daily cost and totals, hot-reloaded in dev when the ledger changes. Background calls that never reach the transcript (permission classifier, titles) are not counted, so totals run a few percent below Claude Code's own figure. Add new models to `PRICES` in the script; unknown ones are listed as unpriced.
