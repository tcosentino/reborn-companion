# Wave 3: CSS tokens and cleanup

Goal: one set of design tokens in `app/src/styles.css`, no duplicated recipes and no dead rules.

Run these after Wave 2, because R23 and R30 touch the same rules.

Visual verification on port 5199 is required for both tasks. Check light and dark mode (`resize_window` colorScheme) and a mobile width (375px).

---

## R30 Design tokens and shared classes

**Model:** sonnet. **Depends:** R23. **Touches:** `app/src/styles.css` and every `*.css` under `app/src`.

Steps:
1. Radius scale. There are 11 distinct `border-radius` values today: 10px ×21, 6px ×18, 4px ×11, 3px ×9, 8px ×8, 5px ×6, and others.
   - Add these tokens to `:root`: `--r-xs: 3px`, `--r-sm: 4px`, `--r-md: 6px`, `--r-lg: 10px`, `--r-pill: 999px`.
   - Map each existing value to the nearest token: 5px becomes `--r-sm`, 8px becomes `--r-lg`.
   - The maximum visual shift is 2px. This behaviour change is approved.
2. The card recipe `background: var(--surface); border: 1px solid var(--line); border-radius: 10px` appears about 14 times.
   - Add a `.card` class to `styles.css`.
   - Where a rule is only that recipe, replace it by adding `card` to the element's className and deleting the CSS.
   - Where the rule has more declarations, keep the extras and drop the three shared ones.
   - Touch TSX classNames only to add `card`.
3. `.sr-only` is defined twice: `hidden-items.css` (around line 54) and `route-map.css` (around line 68). Keep one copy, in `styles.css`.
4. The `--marker` dark-mode tokens are repeated in `hidden-items.css` and `route-map.css`. Move them into the theme blocks in `styles.css`.
5. Untheme-able colours:
   - the `#000` canvas background
   - the `rgba(0,0,0,.7–.8)` backdrops
   - the hard-coded hex colours in `components/dex/StatBars.css`

   Add tokens for them, `--backdrop` and `--stat-*`, with the same values in light mode. Add dark values only where the light value is clearly wrong on a dark background.

Acceptance: screenshots of these pages in light, dark and mobile show no layout change beyond radius rounding:
- a guide section
- the Pokedex list
- a species page
- the palette
- a route map
- a hidden-items card

---

## R31 Remove dead CSS

**Model:** haiku. **Depends:** R30. **Touches:** every `*.css` under `app/src`.

Steps:
1. Delete the rules that are known to be unused:
   - `.stat-table` and `.stat-bar` (`styles.css`, around lines 309-313)
   - `.menu-btn` (`guide-nav.css`, around line 11)
2. For every other class selector in every CSS file, grep `app/src` for the class name, as a string or inside a template string.
   - Delete a rule only when its class has zero hits outside CSS.
   - List each deletion in your report.
   - Be careful with classes built dynamically: `` `t-${type}` ``, `is-*`, and `type` chips. When in doubt, keep the rule.

Acceptance: the quick verify passes, and a spot check on port 5199 shows nothing has lost its styling.
