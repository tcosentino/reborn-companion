# Guide maps: progress log

Goal (Troy, 2026-10-08): every place the guide puts you in has a map, every named place ("where the X house was") has a marker, and hidden items get checkboxes. Guide fixes stay local (no upstream PRs).

Last updated: 2026-10-09 (all 15 groups done, rebuilt, browser-checked).

## Status at a glance

| | Count |
|---|---|
| Sections in the guide | 207 |
| Sections with at least one map card | 195 |
| Route cards (`routes/reborn/`) | 1,060 (901 are "spots" place overviews) |
| Item map cards (`item-maps/reborn/`) | 769, covering 1,990 item checkboxes |
| Authoring groups done | 15 of 15 |

## What was done, in order

1. **Audit** (8 Sonnet agents, read-only). 586 findings: missing checkboxes, prose-only items, items in the game files the guide never mentions, directions needing a map, unclear text. Report: [guide-audit.md](guide-audit.md), data: [guide-audit-findings.json](guide-audit-findings.json).
2. **Pilot** (1 Sonnet agent) on Obsidia Ward, Obsidia Slums and Coral Ward to calibrate. Led to tighter rules: one overview per map per section, a small card right at "back to where X was" paragraphs, no cards for Pokemon Center / Mart / one-person rooms.
3. **Spots cards committed** (`4d66ce2`): route cards with `"spots": true` mark places without drawing a path. These are the "where am I / where is X" overview maps.
4. **Authoring tools** (`5032d77`, Sonnet agent): numbered markers + legend in previews, `map --brief`, `warps`, `cards`, `fmt`, `--limit`. See `routes/AUTHORING.md`.
5. **Pending item-map work from an earlier session committed** (`88a4ade`). This turned out to break 94 saved Tourmaline Desert item ids (see Open issues).
6. **15 authoring groups** (Sonnet agents, ~15 sections each), each validated with `check` / `items-check` and committed separately:

| Commit | Sections |
|---|---|
| `c9eb4f5` | Episodes 1-2 (+ pilot cleanup) |
| `396c227` | Episodes 2-4 |
| `25229c7` | Episodes 5-7 |
| `e13e827` | Episodes 8-10 |
| `bcf3818` | Episodes 10-12 |
| `339a6b7` | Episodes 12-15 |
| `0a2e63c` | Episode 16 wards |
| `c8e568f` | Episodes 16-17 quests (Devon, Mega-Z Ring, Beldum, Amaranth volunteers...) |
| `9b11a72` | Episodes 17-18 desert arc |
| `11f1db1` | Episode 18 Agate arc |
| `56f76a6` | Episode 19 |
| `44eb4bb` | Postgame 1-4 |
| `9e3ef9a` | Postgame 4-6 |
| `ab904f0` | Postgame 6-7 |
| `8b2f1e7` | Postgame 8-9 |

7. **Linked checkboxes** (`9e0709d`, Sonnet agent): the same game item on two checklists (two sections, or a card plus a hidden-item screenshot) now ticks and unticks together. Stored progress keys unchanged.

8. **Tourmaline Desert ids restored** (`ddd3411`): the 94 moved items are back on their original card ids, so no saved ticks are lost.
9. **Full rebuild** (`bash scripts/build.sh reborn`) passes, including the progress-id check. New checkbox ids recorded in the baseline (`2689de2`).
10. **Browser check** on the scratch server (port 5199): map cards render with no console errors, and a tick on Joining a Gang's Magma hideout TM46 shows as ticked on Defeating the Rival Gang. Test tick and backup snapshot removed.

## Open issues

- Most new cards passed `check`, but agents only looked at a sample of previews. Markers flagged as guesses are listed below; worth a glance when you reach them in the app.
- Same-item cards in different sections now tick together (19 linked groups), but they still show as separate markers in each section.

## Known gaps (follow-up passes)

**Puzzles with no walking route yet** (only place markers or nothing): Obsidia Park 9-tree puzzle, Route 2 Crustle pushes, Ametrine ice rink and 4F ice, Celestinine 3F boulders, Rocket Hideout spinners, Wasteland Wall boulders, Tanzan Meteor Base teleport/rotary rooms, Mirage Tower puzzle floors, Neo Blacksteam paths, Subseven statue maze, Rhodochrine Tree prime floors, New World Helix, Garchomp statue maze, Water Treatment Center grids (places only), Victory Road (items and places, no paths).

**Places with no card**: Byxbysion Tunnels, Pyrous Mountain 1F-3F ladders, Apophyll Academy interiors, Scrapyard train interiors, Zero's building in Labradorra, tournament fight rooms, Suspension Badge gym, Tanzan Gem Caves, Citae Astrae red-door room and Ruby Tower.

**NPCs not found in the game data** (marked near a landmark or not at all): Lykos tutor, Spinel Choice Scarf girl, Azer, Ringmaster, several Nightclub NPCs, Peridot trade house and rival, Calcenon "story building".

**Items not carded yet**: Distorted Space / Neoteric Isle / Twilight Factory / Rhodochrine Tree postgame items, Splash Grounds relics (ev 154-167), Route 3 Data Chip and TM58, several Citrine/Ametrine/Celestinine extras, Railnet 228/368 extras, Tanzan 260 extras, Beryl second Blue Shard. Many were left out on purpose when the agent could not confirm they are reachable at that point in the story.

**Worth verifying**: Zapdos card uses Yureyu Power Plant (guide says Beryl factory); Twilight Desert ZCells 05-14 are unnumbered; Inside the Void Luna/Taka marker.

**From the audit, not started**: missing checkbox tasks (Z-Cells 01-71, TMX field-move TMs, Field/PULSE readouts, quest steps), 50 dead `#anchor` links, text errors (Iolia Blue/Red Shard, "Evolve Dusknoir", gang alleyway swap).
