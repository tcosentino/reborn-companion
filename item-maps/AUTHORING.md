# Authoring item maps

An item map card draws the item balls and hidden items that a walkthrough paragraph lists ("grab a hidden *Full Heal*, then a *Guard Spec* to the west") on the game's own map as a numbered checklist. It shows right after that paragraph. Definitions live in `item-maps/<game>/<section-id>.json`, one file per section. This guide is for people and agents adding them, usually one section per agent.

## Rules

- Only write `item-maps/<game>/<your-section-id>.json`. Do not edit other files, `upstream/`, or other sections' files.
- Never rename a card `id` or change an item's `event` once a card has shipped: they make up the saved checkbox id `item:<section>/<card id>/<event id>`. Adding items or cards is fine.
- Do not run `bash scripts/build.sh` or `scripts/sync-data.sh` if other agents are authoring at the same time; they rewrite shared build output. The commands below are read-only and enough to validate your file.

## Tools (run from the repo root)

All are `node --no-warnings scripts/maps.ts reborn <command>`:

| Command | Use |
| --- | --- |
| `section <section>` | The section's paragraphs in order, with `[guide image file]`, `[encounters map N: name]`, `[route id]` and `[item map id]` markers. Encounter markers give the map id of an area. |
| `names <text>` | Maps by name (e.g. `names Underroot`). Interiors and floors are separate maps. |
| `items <mapId> [x,y,w,h]` | Every item event on the map: `ev<id> (x,y) hidden/ball ITEMSYM`, plus a gridded PNG in `out/map-previews/items-map<id>.png` with each event id on its tile (red = hidden, blue = item ball). On big maps pass a box of about 40x40 tiles so the labels stay legible. |
| `grid <mapId> [x,y,w,h]` | Plain gridded map PNG, for orientation. |
| `items-check <section>` | Validates your file: ids, match text against the paragraphs, map ids, that every event exists and gives an item, and that `image` is in the section. |
| `items-preview <section> [cardId]` | Renders each card as it will be built (numbered markers in file order) to `out/map-previews/items-<section>--<id>.png` and prints the items. |

Read PNGs with the Read tool. The guide's own screenshots are in `upstream/src/assets/images/reborn/<file>` (read-only).

## Format

```json
[
  {
    "id": "healing-house-down",
    "match": "Itemfind here for an *Exp. Candy S* then head down the hill",
    "map": 150,
    "title": "From the healing house down to the fire",
    "image": "rhodo1.png",
    "items": [
      { "event": 140 },
      { "event": 146 },
      { "event": 44, "label": "Guard Spec. (west of the fire)" }
    ]
  }
]
```

- `id`: kebab-case, unique within the section, describes the area (`underroot-north`, `beryl-bridge`).
- `match`: the verbatim start of the paragraph, copied exactly from `section` output including markdown (`*Item*`, `**Pokemon**`) and punctuation. 6-12 words is enough. The card goes after this paragraph.
- `map`: the game map id. One card covers one map; if a paragraph's items are on two maps (or floors), write two cards with the same `match`; they show in file order.
- `items`: the item events in the order the paragraph mentions them (markers are numbered 1..n in this order). `label` is optional; by default the legend shows the item's name. Use a label only to add a short location hint when two items share a name.
- `title`: optional, short, names the area.
- `image`: optional. When the paragraph sits next to a plain guide screenshot (`[guide image rhodo1.png]` in `section` output) that only exists to show where these items are, name it here: the card replaces it and links to it. Do not use it for screenshots that show a route, puzzle or anything else, and never for `hiddenNNN.png` (those are handled by `hidden-maps/`).
- `pad`: optional context tiles around the markers (default 3).
- JSON uses 2-space indentation and ends with a newline.

## What to include

- Paragraphs that name item balls or hidden items to pick up in an area ("a hidden *X Speed*", "you'll find a *Potion* on the ground", "Itemfind here for..."). Typical density: one card per paragraph that lists items, or one card for a short run of paragraphs in the same small area (place it after the last of them and use that paragraph's `match`).
- Skip: items given by NPCs, shops, gifts, key items from cutscenes, items behind events the dump cannot see (the item is missing from `items`), and items on a `hiddenNNN.png` screenshot (already covered).
- Only include an event when you are confident it is the one the paragraph means. A wrong marker is worse than none. If an item is not on the map, check interiors and neighbouring maps with `names`; if it still is not there, leave it out.

## Process per section

1. `section <section>`: pick the paragraphs that list items. Note encounter map ids, nearby screenshots and existing route maps (they confirm map ids and where the player is).
2. For each area, find the map (`names`, encounter markers) and run `items <mapId>`. Match each item in the paragraph to an event with the same item SYM (`*Exp. Candy S*` is `EXPCANDYS`, `*Paralyze Heal*` is `PARLYZHEAL`, `*Poke Ball*` is `POKEBALL`).
3. When an item appears more than once on the map, decide by geography: look at the `items` PNG (with a box) and the paragraph's directions ("head up", "to the west", "by the healing house"), the guide screenshot if there is one, and which events earlier or later paragraphs already use. Prefer events close to each other and along the described path.
4. Write the file, run `items-check <section>` until it prints `ok`, then `items-preview <section>` and Read each PNG: the markers should sit where the paragraph says, and the crop should not be huge. If a card spans most of a large map, split it into cards per paragraph.
5. Report the cards you wrote, any items you left out and why, and any ambiguous choices.
