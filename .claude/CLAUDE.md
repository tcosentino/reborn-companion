# Reborn Companion

See `README.md` for the data pipeline, layout and run commands.

## Editing guide content

- Never edit `upstream/src/_raw/` directly. `upstream/` is gitignored here, its commits only exist locally, and other sessions may reset it, discarding uncommitted edits.
- Put content changes in `overrides/<game>/<section-id>.md` with `file:` and `heading:` frontmatter. `scripts/build-json.sh` applies them to a scratch copy (`out/raw/`) before generating.
- Rebuild with `bash scripts/build-json.sh && bash scripts/sync-data.sh`.
- Link to other sections with `#/<game>/<section-id>` (ids are in `app/public/data/<game>/index.json`).

## Tests

- `bash scripts/test.sh` (override unit tests + upstream generator tests) and `cd app && yarn test`.

## Progress data

- Battle checklist ids are `teamId`s joined as in `lib/route.ts` `battleId`. `battles.json` (from `app/src/lib/sectionBattles.ts`, run by `scripts/build-search.ts`) must count the same battles as `SectionView` (non-partner only), or sidebar totals drift from section totals.
