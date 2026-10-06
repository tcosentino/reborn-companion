// Guards saved progress across rebuilds. Ticked battles and tasks are stored by id (lib/route.ts battleId), so a
// generator or content change that renames or drops an id silently orphans those ticks in every browser.
// The committed baseline progress-ids/<game>.json lists every battle id ever shipped; a rebuild that loses one fails.
//
// CLI: node scripts/check-progress-ids.ts <game> [--accept]
//   --accept  record the current ids as the new baseline (only after checking the lost ticks are acceptable)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type Battles = { s: Record<string, [string, string][]>; t?: Record<string, [string, string][]> }

export const battleIds = (battles: Battles): string[] =>
  [...new Set([...Object.values(battles.s), ...Object.values(battles.t ?? {})].flatMap(list => list.map(([id]) => id)))].sort()

export const missingIds = (baseline: string[], current: string[]): string[] => {
  const have = new Set(current)
  return baseline.filter(id => !have.has(id))
}

const main = (game: string, accept: boolean) => {
  const current = battleIds(JSON.parse(readFileSync(join(ROOT, 'out/json', game, 'battles.json'), 'utf8')))
  const file = join(ROOT, 'progress-ids', `${game}.json`)
  const baseline: string[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  const missing = missingIds(baseline, current)
  if (missing.length && !accept) {
    console.error(`${missing.length} battle id(s) from progress-ids/${game}.json are gone; saved ticks for them would be orphaned:`)
    missing.slice(0, 20).forEach(id => console.error(`  ${id}`))
    if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`)
    console.error(`Fix the id change, or rerun with --accept: node scripts/check-progress-ids.ts ${game} --accept`)
    process.exit(1)
  }
  // Keep accepted-but-gone ids out; keep everything still shipped plus anything new
  const next = accept ? current : [...new Set([...baseline, ...current])].sort()
  mkdirSync(join(ROOT, 'progress-ids'), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 1) + '\n')
  console.log(`progress ids ok for ${game} (${current.length} battles and tasks)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [game, flag] = process.argv.slice(2)
  if (!game) { console.error('usage: node scripts/check-progress-ids.ts <game> [--accept]'); process.exit(2) }
  main(game, flag === '--accept')
}
