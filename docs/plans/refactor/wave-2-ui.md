# Wave 2: standard UI primitives

Goal: a small set of UI primitives in `app/src/components/ui/` that every view builds on, so a new page is put together from existing pieces instead of copied markup.

Every task in this wave keeps the rendered DOM and its class names the same, unless the task says otherwise.

After each task, do a visual check in the browser on port 5199 (the `app-scratch` launch config). Visit the pages the task touched, take a screenshot, and compare it with how the page looked before the change. Mention in your report that you did this.

---

## R20 `cx()` class-name helper

**Model:** haiku. **Depends:** none. **Touches:** new `app/src/components/ui/cx.ts`, plus every `.tsx` file under `app/src` that has a `${x ? ' y' : ''}` className fragment.

Steps:
1. Create `ui/cx.ts`:
   `export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')`
2. Find the fragments with `grep -rn "? ' [a-z-]*' : ''" app/src --include=*.tsx`. There are about 31 of them.
3. Replace each one so it produces the same class list.
   - Spacing does not matter. Order does not matter.
   - Do not change which classes appear.
4. Several files repeat `${done ? ' is-done' : ''}${done && collapsed ? ' is-collapsed' : ''}`:
   - `blocks/Battle.tsx`
   - `blocks/Task.tsx`
   - `blocks/Tables.tsx` (2 places)
   - `features/hidden-items/HiddenItems.tsx`
   - `features/route-map/MapCard.tsx`

   Add `doneClasses(done: boolean, collapsed: boolean)` to `cx.ts` and use it in all of them.

Acceptance: the quick verify passes, and the check-off and collapse behaviour on a guide section still works on port 5199.

---

## R21 `<Panel>` and `<ShowMore>`

**Model:** haiku. **Depends:** R20. **Touches:**
- new `app/src/components/ui/Panel.tsx`
- `components/pokedex/SpeciesView.tsx`, `components/pokedex/SpeciesGuideLists.tsx`
- `components/reference/ItemView.tsx`, `components/reference/MoveView.tsx`, `components/reference/bits.tsx`

The same markup appears 16 times:

```tsx
<section className="panel wide">
  <div className="block-head"><h3>T</h3><span className="eyebrow">M</span></div>
  ...
</section>
```

Steps:
1. Create `Panel({ title, meta?, wide = true, className?, note?, id?, children })`.
   - It renders exactly that markup.
   - `meta` goes in the `.eyebrow` span. When `meta` is missing, leave the span out.
   - `note` renders `<p className="muted small pad">{note}</p>` after the children.
2. Replace every occurrence in the files listed under Touches.
3. The "Show all N / Show fewer" toggle is duplicated in `SpeciesGuideLists.tsx` (around lines 62-66) and `reference/bits.tsx` (around lines 53-57).
   - Create `useCapped<T>(list: T[], cap: number)`. It returns `{ shown, toggle: ReactNode | null }`.
   - Put it in `ui/ShowMore.tsx` and use it in both places.

Acceptance: these pages look the same as before on port 5199:
- the Pokedex species page
- the item page
- the move page

---

## R22 `<BlockTable>` for the guide's simple tables

**Model:** haiku. **Depends:** R20. **Touches:** `components/blocks/Tables.tsx` only, plus a new `ui/BlockTable.tsx`.

`Shop`, `Tutor`, `Pickup`, `Mining` and `WildHeld` in `Tables.tsx` (around lines 91-188) render the same structure. Only their cells differ:

```tsx
<section className="shop" id={id}>
  <div className="block-head">...</div>
  <table><tbody>{rows}</tbody></table>
</section>
```

Steps:
1. Create:
   ```tsx
   BlockTable<T>({ id, title, eyebrow, rows: T[], rowClass?: (r: T) => string, cells: (r: T, i: number) => ReactNode })
   ```
   `cells` returns the `<td>` elements.
2. Rewrite the five components on top of it. Keep their export names and props.

Acceptance:
- The quick verify passes.
- On port 5199, a section with a shop, a tutor and a pickup table looks the same as before.

---

## R23 Icons, `<ProgressRing>` and `<Meter>`

**Model:** haiku. **Depends:** R20. **Touches:**
- new `ui/icons.tsx`, `ui/ProgressRing.tsx`, `ui/Meter.tsx`
- `App.tsx`
- `features/guide-nav/BottomBar.tsx`, `features/guide-nav/OnThisPage.tsx`
- `components/blocks/Tables.tsx`
- `features/hidden-items/HiddenItems.tsx`
- `components/SectionView.tsx`
- `components/pokedex/PokedexView.tsx`
- the CSS files for `.ring` and `.hi-ring`

Steps:
1. Inline SVGs:
   - The back chevron, path `M10 3 5 8l5 5`, is duplicated in `App.tsx` (around line 203) and `BottomBar.tsx` (around line 19).
   - The chevron-down is in `OnThisPage.tsx`.
   - `SearchIcon` and `DexIcon` are wherever they are defined. Find them with grep.

   Move all of them into `ui/icons.tsx` as small components.
2. There are two near-duplicate progress rings:
   - `.ring` in `Tables.tsx` (around lines 12-20)
   - `.hi-ring` in `HiddenItems.tsx` (around lines 25-33)

   Create `ProgressRing({ value, max, size? })`, use it in both places, and merge the CSS into one class, `.ring`.
3. There are two progress meters: `SectionView.tsx` (around line 144) and `PokedexView.tsx` (around line 66).
   - Create `Meter({ value, max, label })`.
   - Give it `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`.
   - The Pokedex meter is missing these attributes today. Adding them is an approved behaviour change.

Acceptance: both rings and both meters look the same as before on port 5199.

---

## R24 `useEventListener` hook

**Model:** sonnet. **Depends:** none. **Touches:** new `app/src/components/ui/useEventListener.ts`, `features/hovercards/HoverCardHost.tsx`, `components/palette/CommandPalette.tsx`, `features/guide-nav/OnThisPage.tsx`, `features/guide-nav/useAnchorInView.ts`.

Steps:
1. Write `useEventListener(target: EventTarget | null | (() => EventTarget | null), type, handler, options?)`.
   - It keeps the latest handler in a ref, so callers do not need `useCallback`.
   - It removes the listener on unmount.
2. Replace the manual add and remove pairs:
   - `HoverCardHost.tsx` (around lines 199-214 and 244-249)
   - `CommandPalette.tsx` (around lines 160-165)
   - `OnThisPage.tsx` (around lines 17-22)
   - `useAnchorInView.ts` (around lines 32-38)

   Keep `passive` and `capture` options exactly as they are.
3. In `HoverCardHost.tsx`, `anchorBox` (around lines 136-140) only returns `getBoundingClientRect()`, and its comment is wrong. Inline it.

Acceptance: these behave the same as before on port 5199:
- hover cards open and close
- the palette hotkey (Cmd+K or `/`) works
- the On-this-page highlight follows scrolling

---

## R25 Slim down `App.tsx`

**Model:** sonnet. **Depends:** R23. **Touches:** `App.tsx`, new `features/guide-nav/Sidebar.tsx`, new `ui/usePageTitle.ts`, `components/reference/ItemView.tsx`, `components/reference/MoveView.tsx`.

Steps:
1. Move `Sidebar`, `Count` and `Counts` (around lines 52-135) out of `App.tsx` into `features/guide-nav/Sidebar.tsx`.
2. Replace the nested Pokedex route ternary (around lines 211-224) with a `PokedexRoute` component in the same new file or in `components/pokedex/`.
3. `loadBattles` is imported twice. Remove the duplicate import.
4. `document.title` is formatted in three places: `App.tsx` (around line 179), `ItemView.tsx` and `MoveView.tsx`.
   - Create `usePageTitle(...parts: (string | undefined)[])`. It joins the defined parts with `' · '` and appends `'PokeGuide'`.
   - The titles must stay identical.

Acceptance:
- `App.tsx` is under 150 lines.
- The page title stays the same on these pages: guide, item, move and Pokedex.

---

## R26 Split `CommandPalette.tsx` (450 lines)

**Model:** sonnet. **Depends:** R16, R1A, R24. **Touches:** the `components/palette/CommandPalette.tsx` file and new siblings `PaletteRow.tsx`, `useRecentSearches.ts`, `usePaletteHotkeys.ts`, `CommandPalette.css`.

Steps:
1. Move `Row` (around lines 59-129) into `PaletteRow.tsx`.
2. Move the recent-search code (around lines 22-33, 213-219 and 361) into `useRecentSearches(game)`. It must keep the key `pokeguide:<game>:palette-recent`. The R02 tests must still pass.
3. Move the hotkey code (around lines 149-166) into `usePaletteHotkeys`.
4. Replace the custom focus trap, scroll lock and Esc handling (around lines 178-191 and 299-314) with a native `<dialog>` and `showModal()`, the same way `features/route-map/MapCard.tsx` does it.
   - The dialog must still close on Esc and on a backdrop click.
   - Focus must return to the previously focused element when it closes.

Acceptance: these all work on port 5199:
- opening the palette with its hotkey
- typing to search
- arrow keys plus Enter to navigate
- Esc to close
- recent searches still appear after a reload

`CommandPalette.tsx` must be under 250 lines.

---

## R27 Split `HoverCardHost.tsx`

**Model:** haiku. **Depends:** R15, R24. **Touches:** `features/hovercards/HoverCardHost.tsx`, new `features/hovercards/cards.tsx`.

Steps:
1. Move `SpeciesCard`, `MoveCard`, `ItemCard` and `AbilityCard` (around lines 29-134) into `cards.tsx`. Make no other changes.

Acceptance: hovering a Pokemon, a move, an item and an ability each shows the same card as before.

---

## R28 Duplicate UI constants

**Model:** haiku. **Depends:** none. **Touches:** `components/blocks/Battle.tsx`, `components/dex/StatBars.tsx`, `components/pokedex/SpeciesView.tsx`, `components/pokedex/CompareView.tsx`, `lib/format.ts`.

Steps:
1. `STAT_LABELS` is defined in both `Battle.tsx` (around line 11) and `StatBars.tsx` (around line 4).
   - If the two are identical, export one from `lib/format.ts` (create the file if R14 has not run yet).
   - If they differ, report the difference and keep both.
2. `FACTORS` is defined in both `SpeciesView.tsx` (around line 15) and `CompareView.tsx` (around line 13), with different labels.
   - Export the factor keys once from `lib/score/rank.ts`, where `WEIGHTS` lives.
   - Keep each view's own label map.

Acceptance: the quick verify passes.
