# Reborn Companion

A Vite + React + TypeScript web app that serves as a complete guide, walkthrough and companion for **Pokemon Reborn** (v19.5). It is built from the source of [BIGJRA's Reborn walkthrough](https://bigjra.github.io/reborn/) ([repo](https://github.com/BIGJRA/BIGJRA.github.io), MIT licensed), with a much richer UI and the game data that guide leaves out.

## Why

BIGJRA's guide is the most complete Reborn walkthrough, but it ships as a single ~3 MB HTML page of prose and dense tables. That is hard to use on a phone, hard to search, and it drops useful data such as types, move power and weaknesses. This project keeps BIGJRA's walkthrough as the source of truth and changes how it is presented.

## Goals

- **Full walkthrough**: every main episode (1-19), every post-game episode (1-9) and the appendices, split into navigable sections such as "Obsidia Ward".
- **Trainer cards**: one row per Pokemon showing level, types, ability, moves and held item. A "Weak to" column computes type matchups, with 4x weaknesses listed first. Field effects appear where they apply.
- **Encounters, shops, tutors, partner battles, pickup tables**: rendered from data rather than static HTML.
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
- [x] JSON emitter for the generator (`upstream` branch `json-export`, golden-tested byte-identical HTML)
- [x] Scaffold the Vite app (`app/`, multi-game registry in `app/src/games.ts`)
- [x] Episode views, trainer cards, encounters, shops
- [ ] Search, progress tracking, compact view
- [ ] Deploy (possibly under troycosentino.com)

## Running locally

```
bash scripts/build-json.sh      # game-scripts/ -> out/json/reborn/
bash scripts/sync-data.sh       # out/json/reborn/ -> app/public/data/reborn/
cd app && yarn && yarn dev      # http://localhost:5174/#/reborn/obsidia-ward
```

Tests: `bash scripts/test.sh` (generator golden + JSON tests) and `cd app && yarn test`.

Adding another game: produce the same JSON schema (`index.json`, `dex.json`, `chapters/*.json`, see `app/src/data/types.ts`) into `app/public/data/<id>/` and add an entry to `app/src/games.ts`.
