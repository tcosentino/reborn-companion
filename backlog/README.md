# Backlog

Things that need doing later: bugs noticed in passing, follow-ups, ideas, work left half-done at the end of a session. Not the walkthrough checklist (that is `tasks/<game>/`).

One Markdown file per item, so parallel sessions never edit the same file.

- `backlog/<slug>.md`: open or blocked
- `backlog/done/<slug>.md`: closed (kept for history)

## Commands

```
node scripts/backlog.ts                         # open items, highest priority first
node scripts/backlog.ts --all                   # include done
node scripts/backlog.ts add "Title" --area maps --priority high   # creates backlog/<slug>.md, fill in the body
node scripts/backlog.ts done <slug>             # sets status done + closed date, moves to done/
node scripts/backlog.ts check                   # validate frontmatter (also run by scripts/test.sh)
```

## Format

```markdown
---
title: Fix 50 dead #anchor links
status: open          # open | blocked | done
priority: normal      # high | normal | low
area: guide           # free text: app, maps, item-maps, guide, pipeline, tasks, sprites, ...
created: 2026-10-09
source: docs/guide-audit.md   # optional: where it came from
---

## Context

What you saw, where (`file:line`, section id, commit), why it matters.

## Done when

The concrete check that closes it.
```

Optional extra keys: `source`, `blocked-by` (what it waits on), `closed` (set by `done`).

## Rules for agents

- **Add** an item when you find something real that is out of scope for the current task, or when you stop before finishing. Write the body so a fresh session can act on it without this conversation: file paths, section ids, commands, what you already tried.
- **Check first**: run `node scripts/backlog.ts` and skim for a duplicate; update the existing file instead.
- **Pick up**: when you start an item, keep it open; when finished, run `done <slug>` and commit it with the fix.
- Do not log vague code smells or things you can fix in a couple of lines right now; just fix those.
- Never delete an item to close it; use `done` (or set `status: done` with a one-line reason in the body if it was dropped).
