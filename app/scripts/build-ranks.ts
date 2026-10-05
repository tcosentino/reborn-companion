// Builds ranks.json and movesets.json for one game's data folder from game data only.
// Usage: node app/scripts/build-ranks.ts app/public/data/<game>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Chapter, Dex, GuideIndex, Learnsets, Pokedex } from '../src/data/types.ts'
import { computeRanks } from '../src/lib/score/rank.ts'

const dir = process.argv[2]
if (!dir) {
  console.error('Usage: node app/scripts/build-ranks.ts <data dir>')
  process.exit(1)
}

const read = <T>(file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf8'))
const idx = read<GuideIndex>('index.json')

const { ranks, movesets } = computeRanks({
  dex: read<Dex>('dex.json'),
  pokedex: read<Pokedex>('pokedex.json'),
  learnsets: read<Learnsets>('learnsets.json'),
  idx,
  chapters: idx.chapters.map(c => read<Chapter>(c.file))
})

writeFileSync(join(dir, 'ranks.json'), JSON.stringify(ranks))
writeFileSync(join(dir, 'movesets.json'), JSON.stringify(movesets))
const tiers = Object.values(ranks.species).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.tier]: (acc[r.tier] ?? 0) + 1 }), {})
console.log(`ranks: ${Object.keys(ranks.species).length} species ${JSON.stringify(tiers)}; movesets: ${Object.keys(movesets.species).length}`)
