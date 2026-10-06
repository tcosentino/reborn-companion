# Reborn Companion

See `README.md` for the data pipeline, layout and run commands.

## Editing guide content

- Never edit `upstream/src/_raw/` directly. `upstream/` is gitignored here, its commits only exist locally, and other sessions may reset it, discarding uncommitted edits.
- Put content changes in `overrides/<game>/<section-id>.md` with `file:` and `heading:` frontmatter. `scripts/build-json.sh` applies them to a scratch copy (`out/raw/`) before generating.
- Rebuild with `bash scripts/build-json.sh && bash scripts/sync-data.sh`.
- Link to other sections with `#/<game>/<section-id>` (ids are in `app/public/data/<game>/index.json`).

## Walkthrough tasks

- Task definitions live in `tasks/<game>/<section-id>.json` (see README "Walkthrough tasks"). Never rename a task `id`: it is the saved progress key `task:<section>/<id>` and is in the progress-id baseline.
- If an upstream text change breaks a task's `match`, `sync-data.sh` fails; update the `match` to the new paragraph start rather than deleting the task.

## Tests

- `bash scripts/test.sh` (override, task and progress-id unit tests + upstream generator tests) and `cd app && yarn test`.

## Progress data

- Battle checklist ids are `teamId`s joined as in `lib/route.ts` `battleId`. `battles.json` (from `app/src/lib/sectionBattles.ts`, run by `scripts/build-search.ts`) must count the same battles as `SectionView` (non-partner only), or sidebar totals drift from section totals.
- Never rename battle ids casually: `progress-ids/<game>.json` is the committed baseline of every shipped id and `sync-data.sh` fails if one disappears (see README "Keeping progress safe"). Keep localStorage keys and value shapes backward compatible; dev/preview stay on port 5174.
- When testing in the browser, use a port other than 5174 (e.g. the `app-scratch` launch config on 5199) so test data never touches real progress. The scratch server still auto-backs up into the shared `backups/`; delete any snapshot a test wrote.
