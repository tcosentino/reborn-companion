# Refactor agent contract

Every refactor task agent reads this file first, then only its own task section. These rules override anything that looks like a shortcut.

## Scope

- Do exactly one task (the id you were given). Do not fix other things you notice; list them under "Noticed" in your report instead.
- Only touch files listed under **Touches** for your task, plus new files the task asks you to create and the tests for them. If you must touch another file, stop and report why.
- Line numbers in task text are hints from a review and may have drifted. Find code with grep using the quoted snippet, not the line number.
- If the code does not look like the task describes, stop and report. Do not improvise a different refactor.

## Never break saved progress

Players' progress lives in localStorage and is keyed by ids built in code. These must stay **byte-identical**:

- Battle ids: `teamIds.map(t => t.join(':')).join('+')`, anchors `battle-<id>`
- Task keys: `task:<section>/<id>`
- Item checkbox ids: `item:<section>/<card id>/<event id>`
- Hidden screenshot ids: `<sectionId>:<file>:<key>`
- localStorage keys: `pokeguide:<game>:<list>` (including `palette-recent`, dex filters)
- Never rename an `id` in `tasks/`, `routes/`, `item-maps/`, `hidden-maps/` JSON, and never edit `progress-ids/*.json` by hand.

If a refactor touches any of these, the pinning tests from task R02 must still pass unchanged. Never edit a pinning test to make it pass.

## Behaviour stays the same

- Refactors are behaviour-preserving unless the task explicitly says "behaviour change".
- Generated data must not change: `bash scripts/verify.sh --full` compares `app/public/data/reborn` against the snapshot. Any difference fails the task unless the task lists it under "Expected data diff".

## Code style (from the user's global instructions)

- TypeScript, 2-space indent, single quotes, no semicolons, ES modules, functional style.
- Match the surrounding comment density: short, only where the "why" is not obvious. No emojis.
- `app/src/lib/**` files imported by `scripts/` must stay type-erasable (no enums, no namespaces, no parameter properties) and use explicit `.ts` import extensions, because Node runs them with native type stripping.
- New shared code goes where the task says. Do not create extra abstraction layers.

## Do not

- Do not edit `upstream/` (gitignored, reset by other sessions).
- Do not run the dev server on port 5174. For browser checks use the `app-scratch` launch config (port 5199). Delete any `backups/` snapshot your test created.
- Do not push, open PRs or change git config.
- Do not edit `.claude/CLAUDE.md` or `README.md` unless the task says so.

## Finish

1. Run `bash scripts/verify.sh` (quick). If the task says so, also run `bash scripts/verify.sh --full`.
2. `git add` only the files you changed and commit with a conventional message, e.g. `refactor(lib): share paragraph helpers`, ending with:
   `Co-Authored-By: Claude <noreply@anthropic.com>`
3. Report back in this shape, under 200 words:

```
Task: R12
Status: done | blocked
Commit: <sha>
LOC: +<added> -<removed> (from git show --stat)
Verify: quick pass | full pass | <failure output>
Noticed: <out-of-scope issues, or none>
```

Until task R01 has landed, `scripts/verify.sh` does not exist. Run `bash scripts/test.sh` and `cd app && yarn test && yarn build` instead.
