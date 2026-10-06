// Applies tasks/<game>/<section-id>.json to the generated chapters in out/json/<game>/ (see app/src/lib/tasks.ts).
// Idempotent: earlier splits are undone first, so sync-data.sh can rerun without regenerating.
// Fails when a task's `match` finds no paragraph, so upstream text changes surface instead of silently dropping ticks.
//
// CLI: node scripts/apply-tasks.ts <game>
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chapter, GuideIndex } from '../app/src/data/types'
import { applyTasks, type TaskDef } from '../app/src/lib/tasks.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const KINDS = new Set(['catch', 'quest', 'item'])

export const validateDefs = (section: string, defs: TaskDef[]): string[] => {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const d of defs) {
    if (!SLUG.test(d.id)) errors.push(`${section}: bad id "${d.id}"`)
    if (seen.has(d.id)) errors.push(`${section}: duplicate id "${d.id}"`)
    seen.add(d.id)
    if (!KINDS.has(d.kind)) errors.push(`${section}/${d.id}: bad kind "${d.kind}"`)
    if (!d.title?.trim()) errors.push(`${section}/${d.id}: missing title`)
    if (!d.match?.trim()) errors.push(`${section}/${d.id}: missing match`)
  }
  return errors
}

const main = (game: string) => {
  const dir = join(ROOT, 'tasks', game)
  const out = join(ROOT, 'out/json', game)
  const defs = new Map<string, TaskDef[]>(existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), JSON.parse(readFileSync(join(dir, f), 'utf8'))])
    : [])
  const errors = [...defs].flatMap(([s, d]) => validateDefs(s, d))
  const unseen = new Set(defs.keys())
  let applied = 0
  const index: GuideIndex = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))
  for (const c of index.chapters) {
    const file = join(out, c.file)
    const chapter: Chapter = JSON.parse(readFileSync(file, 'utf8'))
    for (const sec of chapter.sections) {
      const key = sec.id ?? c.id
      unseen.delete(key)
      const r = applyTasks(sec.blocks, key, defs.get(key) ?? [])
      sec.blocks = r.blocks as typeof sec.blocks
      applied += r.blocks.length - r.blocks.filter(b => b.type !== 'task').length
      r.missing.forEach(d => errors.push(`${key}/${d.id}: no paragraph starts with "${d.match}"`))
      r.ambiguous.forEach(d => errors.push(`${key}/${d.id}: match "${d.match}" overlaps another task`))
    }
    writeFileSync(file, JSON.stringify(chapter))
  }
  unseen.forEach(s => errors.push(`tasks/${game}/${s}.json: no such section`))
  if (errors.length) {
    errors.forEach(e => console.error(e))
    process.exit(1)
  }
  console.log(`tasks ok for ${game} (${applied} tasks)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const game = process.argv[2]
  if (!game) { console.error('usage: node scripts/apply-tasks.ts <game>'); process.exit(2) }
  main(game)
}
