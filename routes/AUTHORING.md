# Authoring route maps

A route map is a walking path drawn over the game's real map, shown right after the walkthrough paragraph that describes it. Definitions live in `routes/<game>/<section-id>.json`. This guide is for people and agents adding them.

## Tools (run from the repo root; read-only apart from the route files you write)

All are `node --no-warnings scripts/maps.ts reborn <command>`:

| Command | Use |
| --- | --- |
| `section <section>` | The section's paragraphs in order, with `[battle]`, `[guide image]`, `[encounters map N]` and `[route id]` markers. Encounter markers give the game map id for an area. |
| `names <text>` | Maps by name. Interiors are children of the outdoor map (e.g. 37 is Lower Peridot Ward outdoors, 47 a house in it). |
| `find <text> [mapId...]` | Events whose dialogue contains the text: the fastest way to find a specific NPC and its exact tile, or which interior holds an NPC. |
| `map <id>` | Every door/warp (destination map and landing tile), NPC (first dialogue) and sign, with coordinates. Door events sit on the door tile. A warp's landing tile is exactly where the player appears, which makes it the natural start point after leaving a building. `[vanishes later]` marks story actors that leave at some point (candidates for `hide`). |
| `grid <id> [x,y,w,h]` | PNG of the map, or a box of it, with a coordinate grid: yellow lines every 5 tiles, labelled. Read the PNG to orient yourself. Prefer boxes of about 30x30. |
| `reach <id> <x,y> [x,y,w,h] [hide,ids] [--surf]` | ASCII map of the tiles walkable from x,y: `.` reachable, `#` not, `W` warp, `e`/`E` event, `@` start. Use it to debug "no walkable path". |
| `check <section>` | Validates the route file: ids, match text, map, and that a path exists. |
| `preview <section> [routeId]` | Renders each route as it will be built: yellow path, red squares on points, grid. Always Read the preview and confirm the path follows the paragraph. |

Movement follows the game's rules (`scripts/rmxp.ts`):
- Doors and stairs that warp within the same map (multi-room dungeons such as factories and caves are often one map) are followed automatically. The line breaks there and the app marks both ends.
- Warps to other maps (doors, sand vortexes, ladders) block the path unless they are its first or last point.
- Ledges are jumped one-way, in the direction the player walks.
- Tile objects such as bridge pieces and barriers use their tile's passability.
- Surfing needs `"surf": true` on the route (and `--surf` on `reach`).
- Not modelled, so use `direct` points: ice sliding, rock climb, waterfalls, diving and Strength puzzles.

## Format

```json
[
  {
    "id": "name-rater",
    "match": "Head out, and back up past the rod guy's house.",
    "map": 37,
    "title": "Pool to the Name Rater",
    "points": [
      { "at": [33, 51], "label": "Pool owner's house" },
      { "at": [19, 45], "label": "Rod guy's house" },
      { "at": [20, 32], "label": "Name Rater's house" }
    ]
  }
]
```

- `id`: kebab-case and unique within the section. Never rename it once shipped (it is the page anchor).
- `match`: the verbatim start of the paragraph, copied exactly with punctuation and markdown (`**`, `*`). About 6-12 words is enough. The map shows after that paragraph.
- `map`: the game map id. One route covers one map. When a paragraph's walk crosses two maps and both need help, write two routes with the same `match`; they show in order.
- `points`: `[x, y]` tiles.
  - The first and last points need a `label`. Label every meaningful stop (door, NPC, item, ladder), because labelled points become numbered markers with a legend.
  - `"via": true` with no label only steers the path.
  - `"direct": true` reaches the point in a straight line from the previous one instead of pathfinding. Use it for scripted diagonal stairs, surfing, rails or cutscene moves the pathfinder cannot follow.
  - Points on doors, NPCs and items are fine, since the path may start or end on a blocked tile.
- `title`: short, e.g. "To the Old Rod house".
- `surf`: optional; `true` makes water walkable for the whole route.
- `hide`: optional event ids left out of the render and pathing. Events are drawn in their default (pre-story) state, so cutscene actors and police lines may appear or block. Hide them when they are gone at this point in the story.
- `pad`: optional context tiles around the path (default 4).
- `spoiler`: optional; `true` for puzzle solutions the guide hides behind a spoiler. The map stays covered until the reader taps "Show solution".
- JSON uses 2-space indentation.

## What deserves a route map (quality over quantity)

Add one when the paragraph tells the player to walk somewhere specific on one map and the way is not obvious from the text alone:
- finding a particular house, NPC, item or hidden spot
- multi-step directions ("head right, then up as soon as you can, then into the alley")
- mazes, caves, factory and dungeon floors, puzzle paths (switch orders, terminals, warp-panel sequences), alleys, back routes
- a sequence of stops across one area (several houses with items or trades)

Skip it when:
- the direction is trivial: one straight walk, "head to the next area", "go back to the Pokemon Center", or a room you can see all of
- the paragraph is story or cutscene text, battle commentary or an item list
- you cannot confidently pin down the map and coordinates. A wrong map is worse than none.
- the paragraph only lists hidden items (A)(B) next to a `[guide image]` that already shows those spots. Hidden items are not events, so their tiles cannot be looked up.

Typical density is 0-4 routes per section, and many sections get none.

## Process per route

1. Read the section and pick candidate paragraphs.
2. Identify the map from encounter markers, `names`, and `find` on NPC dialogue. Get exact door and NPC coordinates with `map`, and look at `grid` images to check where "up", "left" and "around" actually lead.
3. Start where the player is at the beginning of that paragraph: the landing tile outside the building they just left, or where the previous route ended. End on the destination door, NPC or item.
4. Write the file, run `check`, then `preview` and look at the PNG. Fix wrong turns with `via` points and blocking actors with `hide`. Use `reach` when a path is missing.
