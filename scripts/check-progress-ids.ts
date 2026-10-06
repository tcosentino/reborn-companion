// Guards saved progress across rebuilds. Ticked battles, tasks and item map items are stored by id (lib/route.ts battleId), so a
// generator or content change that renames or drops an id silently orphans those ticks in every browser.
// The committed baseline progress-ids/<game>.json lists every battle id ever shipped; a rebuild that loses one fails.
//
// CLI: node scripts/check-progress-ids.ts <game> [--accept]
//   --accept  record the current ids as the new baseline (only after checking the lost ticks are acceptable)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type Battles = { s: Record<string, [string, string][]>; t?: Record<string, [string, string][]>; i?: Record<string, string[]> }

export const battleIds = (battles: Battles): string[] =>
  [...new Set([
    ...[...Object.values(battles.s), ...Object.values(battles.t ?? {})].flatMap(list => list.map(([id]) => id)),
    ...Object.values(battles.i ?? {}).flat()
  ])].sort()

// Item map ids (`item:`) only exist when the build had the map dump (scripts/build-maps.sh); without it
// (`itemMaps` false) they are not reported missing, since a later build with the dump restores them unchanged.
export const missingIds = (baseline: string[], current: string[], itemMaps = true): string[] => {
  const have = new Set(current)
  return baseline.filter(id => !have.has(id) && (itemMaps || !id.startsWith('item:')))
}

const main = (game: string, accept: boolean) => {
  const battles: Battles = JSON.parse(readFileSync(join(ROOT, 'out/json', game, 'battles.json'), 'utf8'))
  const current = battleIds(battles)
  const file = join(ROOT, 'progress-ids', `${game}.json`)
  const baseline: string[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  const itemMaps = existsSync(join(ROOT, 'out/maps', game, 'index.json'))
  if (!itemMaps && baseline.some(id => id.startsWith('item:'))) console.warn('check-progress-ids: no map dump, so item map ids are not checked')
  const missing = missingIds(baseline, current, itemMaps)
  if (missing.length && !accept) {
    console.error(`${missing.length} battle id(s) from progress-ids/${game}.json are gone; saved ticks for them would be orphaned:`)
    missing.slice(0, 20).forEach(id => console.error(`  ${id}`))
    if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`)
    console.error(`Fix the id change, or rerun with --accept: node scripts/check-progress-ids.ts ${game} --accept`)
    process.exit(1)
  }
  // Keep accepted-but-gone ids out; keep everything still shipped plus anything new
  const next = accept ? [...new Set([...current, ...(itemMaps ? [] : baseline.filter(id => id.startsWith('item:')))])].sort() : [...new Set([...baseline, ...current])].sort()
  mkdirSync(join(ROOT, 'progress-ids'), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 1) + '\n')
  console.log(`progress ids ok for ${game} (${current.length} battles, tasks and item map items)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [game, flag] = process.argv.slice(2)
  if (!game) { console.error('usage: node scripts/check-progress-ids.ts <game> [--accept]'); process.exit(2) }
  main(game, flag === '--accept')
}
