// Builds out/json/<game>/search.json, the compact index behind the Cmd+K palette.
// Usage: node scripts/build-search.ts <game>   (Node >= 23.6 strips TS types natively; tsx also works)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import type { Chapter, Dex, GuideIndex } from '../app/src/data/types'
import { buildSearchIndex } from '../app/src/components/palette/buildIndex.ts'
import { buildSectionBattles } from '../app/src/lib/sectionBattles.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const game = process.argv[2]
if (!game) {
  console.error('usage: node scripts/build-search.ts <game>')
  process.exit(1)
}
const dir = join(root, 'out', 'json', game)
const read = <T>(file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf8'))

const t0 = performance.now()
const index = read<GuideIndex>('index.json')
const dex = read<Dex>('dex.json')
const chapters = new Map(index.chapters.map(c => [c.file, read<Chapter>(c.file)]))
const out = JSON.stringify(buildSearchIndex(index, dex, chapters))
writeFileSync(join(dir, 'search.json'), out)

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`
console.log(`search.json: ${kb(Buffer.byteLength(out))} raw, ${kb(gzipSync(out).length)} gzip (${Math.round(performance.now() - t0)} ms)`)

// Per-section battle ids for whole-guide progress in the sidebar
const battles = JSON.stringify(buildSectionBattles(index, chapters))
writeFileSync(join(dir, 'battles.json'), battles)
console.log(`battles.json: ${kb(Buffer.byteLength(battles))} raw, ${kb(gzipSync(battles).length)} gzip`)
