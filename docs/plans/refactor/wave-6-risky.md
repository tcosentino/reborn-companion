# Wave 6: higher-risk consolidations

These tasks change real behaviour or rendering. Each one is done by a sonnet agent and reviewed by opus before merge. Run them last, one at a time.

---

## R60 Render hidden-item screenshots through MapCard

**Model:** sonnet, with an opus review. **Depends:** R50, R30. **Touches:** `features/hidden-items/HiddenItems.tsx`, `features/hidden-items/hidden-items.css`, `features/route-map/MapCard.tsx`, `features/route-map/route-map.css`.

`HiddenItems.tsx` has two parts that copy MapCard:
- `Screenshot` (around lines 35-98) re-implements MapCard's checklist legend (`MapCard.tsx`, around lines 59-79).
- Its own `Lightbox` re-implements MapCard's dialog (around lines 109-155).

`hidden-items.css` mirrors `route-map.css`:
- `.hi-head` copies `.rm-head`.
- `.hi-legend` copies `.rm-checklist`.
- `.hi-text` and `.hi-name` copy `.rm-text` and `.rm-label`.

Steps:
1. Extend MapCard so it can show a plain image with no SVG overlay, e.g. `map: { src, width, height, overlay?: false }`. Keep its current props working.
2. Render `Screenshot` through MapCard. Delete the duplicate legend, the `Lightbox` and the `.hi-*` rules that become unused.
3. **Checkbox ids must not change.**
   - Keep passing the same `ids[i]` (from `hiddenEntryId(b, e)` and `itemCheckId`) into `MapMark.onToggle`.
   - Add a test that renders a hidden-items block and asserts the checkbox ids, before and after the change.

Acceptance:
- The R02 tests pass.
- On port 5199, checking a hidden item in the screenshot card checks the same item in its linked list. Reload, and confirm the check persists.
- Opening the lightbox works.

---

## R61 Run the whole sync pipeline in one process

**Model:** sonnet, with an opus review. **Depends:** R42, R43. **Touches:** new `scripts/apply-all.ts`, `scripts/sync-data.sh`, README "Running locally".

`sync-data.sh` runs 6 node processes, and each one parses and rewrites every chapter JSON. The cost is fine at today's ~140 sections. At about 1k sections or 50MB of chapter JSON, the repeated parse and stringify becomes the main cost of a sync.

Steps:
1. `apply-all.ts <game>`:
   1. Load the chapters once.
   2. Run tasks, starters, routes, hidden-maps and item-maps in the current order.
   3. Write once.
   4. Then run the search and battles builders.

   Battles must see the applied tasks; see the comment in `sync-data.sh`. Keep each individual `apply-*.ts` script working on its own for authoring.
2. Have `sync-data.sh` call `apply-all.ts` instead of the five separate scripts.

Acceptance:
- `verify.sh --full` shows no data diff.
- Report the wall time of `sync-data.sh reborn` before and after.

---

## R62 Merge the two crop functions (ask Troy first)

**Model:** sonnet. **Depends:** R43. **Status:** needs approval. It changes how the route map images are cropped.

There are two crop functions:
- `cropAround` in `scripts/apply-routes.ts` (around line 87). It grows the crop around the centre.
- `cropBox` in `lib/itemMaps.ts` (around line 113). It grows the low side first.

Both pad the box, enforce a minimum of 12x8 and clamp it to the map. Merge them into one `cropBox(..., { center })` and keep both behaviours behind the flag. If Troy approves, switch routes to the shared default.

`maps.ts` (around lines 307-311) also builds a box by hand that could be `cropBox(tiles, w, h, 3, 0, 0)`.

Acceptance:
- With `{ center: true }` for routes, the data shows no diff.
- If Troy approves the switch, review the changed PNGs.
