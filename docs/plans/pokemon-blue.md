# Plan: Pokemon Blue guide

Status: research only (2026-10-05). Nothing built yet.

## Why Blue is different from Reborn

Reborn starts from BIGJRA's MIT markdown guide plus RPG Maker game files. Blue has neither:

- No permissively licensed Red/Blue walkthrough prose exists. Guide text has to be our own.
- Game data comes from the pret disassembly (assembly source), not RPG Maker files.
- Maps are Game Boy block/tile maps, so `scripts/rmxp.ts` does not apply.
- Blue is first-party Nintendo, so takedown risk is higher than for a fan game. Keep map renders, sprites and pret-derived assets local-only.

## Sources

| Source | Use | License |
|---|---|---|
| [pret/pokered](https://github.com/pret/pokered) | Primary data: trainers, items, hidden items, encounters, marts, trades, maps | None (no grant); use facts, do not ship files |
| [pret/pokeyellow](https://github.com/pret/pokeyellow) | Yellow later, as its own game id | None |
| [pret/pokefirered](https://github.com/pret/pokefirered) | FireRed/LeafGreen; much already JSON, easiest mainline target | None |
| [PokeAPI](https://github.com/PokeAPI/pokeapi) | Species/move/type display data, encounter cross-check | BSD-3 (code) |
| [StrategyWiki RB walkthrough](https://strategywiki.org/wiki/Pok%C3%A9mon_Red_and_Blue) | Only reusable prose, if ever needed | CC BY-SA 3.0 |
| [Bulbapedia RB walkthrough](https://bulbapedia.bulbagarden.net/wiki/Red_and_Blue_walkthrough) | Manual verification | CC BY-NC-SA 2.5 (enforced) |
| Serebii, PokemonDB, GameFAQs, Smogon | Manual verification only | All rights reserved |

## Steps

### 1. Scope

- Personal/local use, same as Reborn map renders.
- Red/Blue as one game (Blue first). Yellow is a separate game id later.

### 2. Get the data

Clone `pret/pokered` into a gitignored location (e.g. `out/game/blue/`). No ROM build needed; data and PNG graphics are in the repo.

| Data | pret file |
|---|---|
| Trainer parties | `data/trainers/parties.asm` |
| Trainers, item balls, warps (x/y) | `data/maps/objects/*.asm` |
| Hidden items | `data/events/hidden_item_coords.asm`, `data/events/hidden_events.asm` |
| Wild encounters | `data/wild/maps/*.asm`, `good_rod`/`super_rod` |
| Shops | `data/items/marts.asm` |
| In-game trades | `data/events/trades.asm` |
| Maps | `maps/*.blk` + tilesets/blocksets in `gfx/` |

### 3. Extractor

`scripts/pret/extract.ts`: regex-parse the `.asm` files into one JSON per map:

- trainers (link `object_event` trainer class + index to `parties.asm`)
- item balls, hidden items with x/y
- encounters per method, Blue conditionals resolved
- marts, trades

Unit tests against known maps (Viridian Forest, Mt. Moon).

### 4. Story order (hand-authored)

The data has no progression order. Define ~30-40 sections in `games/blue.json` (town / route / dungeon / gym) and assign pret maps to each.

Hand-list scripted battles that live in scripts, not object events: rival fights, Giovanni, Elite Four, Snorlax, legendaries.

### 5. Guide content

- Generate one source file per section from extracted data plus short original prose (LLM draft, hand review). Commit as our own content, e.g. `guides/blue/*.md`.
- Prefer emitting BIGJRA-style markdown so `overrides/`, `tasks/` and `routes/` keep working. Open question: confirm `build-json.sh` can process markdown outside `upstream/`. Fallback: emit chapter JSON (`id`, `title`, `slug`, `sections[].blocks`) directly.

### 6. Maps

- New Game Boy renderer: `.blk` -> blocks -> tiles -> PNG.
- Markers come straight from pret coordinates (simpler than Reborn's screenshot matching for hidden items).
- Local-only output, like `app/public/maps/`.

### 7. App wiring

- `games/blue.json`, dex/sprite/learnset data (pret or PokeAPI).
- `progress-ids/blue.json` baseline once ids are stable; never rename ids after that.
- `bash scripts/test.sh`, `cd app && yarn test`, check on the scratch server (port 5199).

### 8. Validation

- Compare per-area trainer/item/hidden-item counts against Bulbapedia or Serebii by hand.
- Diff encounters against PokeAPI.

## Known gaps and gotchas

- Red/Green had broken hidden items fixed in Blue (Bulbapedia "Broken hidden items").
- Red vs Blue encounter differences need resolving in the extractor.
- Yellow changes teams and adds Pikachu-specific events; treat as its own game.
- Item version differences are not explicit in pret.

## First spike

Viridian Forest end to end: clone pokered, extract its trainers/items/hidden items/encounters, render the map, show it as one section in the app. Proves extractor, renderer and content format before authoring the rest.

## Related: other BIGJRA guides

`upstream/src/_raw/` also has Rejuvenation (18 files, ~90k words, complete, same format) and Desolation (6 files, ~16k words, early, episode 1 titled TODO). Rejuvenation is the cheapest next game: same format and generator. Check first whether the committed markdown is enough without BIGJRA's private scripts repo (`PRIVATE_REPO_PAT` in `upstream/Rakefile`).
