// Applies starters/<game>/<section-id>.json to the generated chapters in out/json/<game>/ (see app/src/lib/starters.ts):
// the paragraph listing the starters becomes a `starters` card block. Idempotent, like apply-tasks.ts.
// Fails when the paragraph is missing or a pick names an unknown species, ability or nature.
//
// CLI: node scripts/apply-starters.ts <game>
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chapter, GuideIndex } from '../app/src/data/types'
import { applyStarters, validateStarters, type StartersDef } from '../app/src/lib/starters.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const main = (game: string) => {
  const dir = join(ROOT, 'starters', game)
  const out = join(ROOT, 'out/json', game)
  const defs = new Map<string, StartersDef>(existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), JSON.parse(readFileSync(join(dir, f), 'utf8'))])
    : [])
  // pokedex.json lists every species; dex.json only those in battles and tables
  const { species } = JSON.parse(readFileSync(join(out, 'pokedex.json'), 'utf8'))
  const errors = [...defs].flatMap(([s, d]) => validateStarters(d, species).map(e => `${s}: ${e}`))
  const unseen = new Set(defs.keys())
  const index: GuideIndex = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))
  for (const c of index.chapters) {
    const file = join(out, c.file)
    const chapter: Chapter = JSON.parse(readFileSync(file, 'utf8'))
    let changed = false
    for (const sec of chapter.sections) {
      const key = sec.id ?? c.id
      const def = defs.get(key)
      if (!def) continue
      unseen.delete(key)
      const r = applyStarters(sec.blocks, def)
      if (!r.found) errors.push(`${key}: no paragraph starts with "${def.match}"`)
      sec.blocks = r.blocks as typeof sec.blocks
      changed = true
    }
    if (changed) writeFileSync(file, JSON.stringify(chapter))
  }
  unseen.forEach(s => errors.push(`starters/${game}/${s}.json: no such section`))
  if (errors.length) {
    errors.forEach(e => console.error(e))
    process.exit(1)
  }
  console.log(`starters ok for ${game} (${defs.size} sections)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const game = process.argv[2]
  if (!game) { console.error('usage: node scripts/apply-starters.ts <game>'); process.exit(2) }
  main(game)
}
