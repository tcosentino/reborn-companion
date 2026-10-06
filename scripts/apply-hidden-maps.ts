// Redraws the guide's hidden-item screenshots (hiddenNNN.png) from the game's own maps (see app/src/lib/itemMaps.ts).
// hidden-maps/<game>.json pairs each screenshot with a game map and each of its letters with an item event; this
// renders a crop around those events to app/public/maps/<game>-items/ and sets `map` on the screenshot's image block.
// Fails when a paired event no longer gives the letter's item. Idempotent; without the map dump (scripts/build-maps.sh)
// it warns and strips `map`, so the app falls back to the screenshot.
//
// CLI: node scripts/apply-hidden-maps.ts <game> [--suggest]
//   --suggest  pair screenshots missing from hidden-maps/<game>.json automatically (by item, section name and the
//              tightest cluster of events) and write them to the file for review
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chapter, Dex, GuideIndex, ImageBlock } from '../app/src/data/types'
import { groupHiddenItems } from '../app/src/features/hidden-items/group.ts'
import {
  cropBox, itemSyms, rankMaps, suggestHiddenMap, type HiddenMapDef, type ItemMap, type ItemMapCandidate, type Located, type Tile
} from '../app/src/lib/itemMaps.ts'
import { writePng } from './png-rgba.ts'
import { assetsDir, hasMaps, imageLoader, loadMap, loadTilesets, mapsDir, renderMap, type GameMap, type Tileset } from './rmxp.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const itemOf = (m: GameMap, id: number) => m.events.find(e => e.id === id)?.pages.find(p => p.item)?.item

// Every map's item events (hidden items and item balls), for --suggest
const candidates = (dir: string): ItemMapCandidate[] =>
  readdirSync(dir).filter(f => /^map\d+\.json$/.test(f)).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as GameMap)
    .map(m => ({
      id: m.id, name: m.name,
      events: m.events.flatMap(e => { const item = e.pages.find(p => p.item)?.item; return item ? [{ id: e.id, x: e.x, y: e.y, item }] : [] })
    }))
    .filter(m => m.events.length && m.name !== 'REMOVED')

// Each screenshot in the guide with its lettered items as SYMs, in section order. `src` is the image's site path.
export const screenshots = (sections: { id: string; blocks: Chapter['sections'][number]['blocks'] }[], sym: (name: string) => string | undefined) =>
  sections.flatMap(s => groupHiddenItems(s.blocks, s.id).flatMap(b => b.type === 'hiddenItems'
    ? [{ section: s.id, file: b.file, src: b.src, want: b.entries.flatMap(e => { const item = sym(e.name); return item ? [{ letter: e.letter, item }] : [] }) }]
    : []))

// Where each screenshot sits on its candidate maps (scripts/locate-shots.py, numpy + Pillow). Renders the candidate
// maps in full to out/hidden-maps/<game>/. Without Python the suggestions fall back to item and name matching.
const locateShots = (game: string, shots: { file: string; shot: string; maps: number[] }[], maps: string, tilesets: Record<string, Tileset>, load: ReturnType<typeof imageLoader>): Record<string, Located> => {
  const dir = join(ROOT, 'out/hidden-maps', game)
  mkdirSync(join(dir, 'full'), { recursive: true })
  const todo = shots.filter(s => existsSync(s.shot))
  for (const id of new Set(todo.flatMap(s => s.maps))) {
    const png = join(dir, 'full', `${id}.png`)
    if (existsSync(png)) continue
    const m = loadMap(maps, id)
    writeFileSync(png, writePng(renderMap(m, tilesets[m.tileset], load, { x: 0, y: 0, w: m.width, h: m.height })))
  }
  writeFileSync(join(dir, 'candidates.json'), JSON.stringify(todo))
  const r = spawnSync('python3', [join(ROOT, 'scripts/locate-shots.py'), dir], { stdio: 'inherit' })
  if (r.status !== 0) { console.warn('apply-hidden-maps: locate-shots.py failed; suggesting by items and section name only'); return {} }
  return JSON.parse(readFileSync(join(dir, 'located.json'), 'utf8'))
}

const main = (game: string, suggest: boolean) => {
  const out = join(ROOT, 'out/json', game)
  const maps = mapsDir(ROOT, game)
  const defsFile = join(ROOT, 'hidden-maps', `${game}.json`)
  const imgDir = join(ROOT, 'app/public/maps', `${game}-items`)
  const defs: Record<string, HiddenMapDef> = existsSync(defsFile) ? JSON.parse(readFileSync(defsFile, 'utf8')) : {}
  const ready = hasMaps(maps)
  if (!ready && Object.keys(defs).length) console.warn(`apply-hidden-maps: no map dump in out/maps/${game} (run scripts/build-maps.sh ${game}); keeping screenshots`)

  const guide: GuideIndex = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))
  const chapters = guide.chapters.map(c => ({ file: join(out, c.file), chapter: JSON.parse(readFileSync(join(out, c.file), 'utf8')) as Chapter }))
  const sections = chapters.flatMap(({ chapter }, i) => chapter.sections.map(s => ({ id: s.id ?? guide.chapters[i].id, blocks: s.blocks })))
  const dex: Dex = JSON.parse(readFileSync(join(out, 'dex.json'), 'utf8'))
  const shots = screenshots(sections, itemSyms(dex.items))
  const errors: string[] = []

  if (suggest && ready) {
    const pool = candidates(maps)
    const claimed = new Set(Object.values(defs).flatMap(d => Object.values(d.events).map(e => `${d.map}:${e}`)))
    // The guide's site source sits two levels above its raw markdown (upstream/src)
    const site = join(ROOT, JSON.parse(readFileSync(join(ROOT, 'games', `${game}.json`), 'utf8')).build.rawDir, '../..')
    const located = locateShots(game, shots.filter(s => !defs[s.file]).map(s => ({
      file: s.file, shot: join(site, s.src), maps: rankMaps(s.section, s.want, pool, claimed).slice(0, 12).map(c => c.m.id)
    })), maps, loadTilesets(maps), imageLoader(assetsDir(ROOT, game)))
    for (const s of shots) {
      if (defs[s.file]) continue
      const d = suggestHiddenMap(s.section, s.want, pool, claimed, located[s.file])
      if (!d) { console.warn(`${s.file}: no map has its items`); continue }
      defs[s.file] = d
      Object.values(d.events).forEach(e => claimed.add(`${d.map}:${e}`))
      console.log(`${s.file} (${s.section}) -> map ${d.map} ${pool.find(m => m.id === d.map)?.name}, ${Object.keys(d.events).length}/${s.want.length} letters`)
    }
    const sorted = Object.fromEntries(Object.entries(defs).sort(([a], [b]) => a.localeCompare(b)))
    mkdirSync(dirname(defsFile), { recursive: true })
    writeFileSync(defsFile, `${JSON.stringify(sorted, null, 2)}\n`)
  }

  // Validate pairings against the guide and the map dump
  const known = new Set(shots.map(s => s.file))
  Object.keys(defs).filter(f => !known.has(f)).forEach(f => errors.push(`hidden-maps/${game}.json: ${f} is not a hidden-items screenshot in the guide`))
  const mapCache = new Map<number, GameMap>()
  const mapOf = (id: number) => {
    if (!mapCache.has(id)) mapCache.set(id, loadMap(maps, id))
    return mapCache.get(id)!
  }
  if (ready) {
    for (const s of shots) {
      const d = defs[s.file]
      if (!d) continue
      if (!existsSync(join(maps, `map${d.map}.json`))) { errors.push(`${s.file}: no map ${d.map}`); continue }
      const m = mapOf(d.map)
      for (const [letter, ev] of Object.entries(d.events)) {
        const want = s.want.find(w => w.letter === letter)
        const got = itemOf(m, ev)
        if (!want) errors.push(`${s.file}: letter ${letter} is not in the guide`)
        else if (got !== want.item) errors.push(`${s.file}: ${letter} is ${want.item} in the guide but event ${ev} on map ${d.map} gives ${got ?? 'nothing'}`)
      }
    }
  }

  const tilesets = ready ? loadTilesets(maps) : {}
  const load = imageLoader(assetsDir(ROOT, game))
  const keep = new Set<string>()
  if (ready) mkdirSync(imgDir, { recursive: true })
  const build = (file: string, d: HiddenMapDef): ItemMap => {
    const m = mapOf(d.map)
    const marks = Object.entries(d.events).sort(([a], [b]) => a.localeCompare(b)).map(([key, ev]) => {
      const e = m.events.find(x => x.id === ev)!
      return { key, x: e.x, y: e.y }
    })
    const box = cropBox(marks.map(k => [k.x, k.y] as Tile), m.width, m.height, d.pad)
    const png = file.replace(/\.\w+$/, '.png')
    keep.add(png)
    const hash = createHash('sha1').update(JSON.stringify(box)).update(readFileSync(join(maps, `map${d.map}.json`))).digest('hex').slice(0, 10)
    const stamp = join(imgDir, `${png}.v`)
    if (!existsSync(join(imgDir, png)) || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== hash) {
      writeFileSync(join(imgDir, png), writePng(renderMap(m, tilesets[m.tileset], load, box)))
      writeFileSync(stamp, hash)
    }
    return {
      mapName: m.name, src: `maps/${game}-items/${png}?v=${hash}`, w: box.w, h: box.h,
      marks: marks.map(k => ({ key: k.key, x: k.x - box.x, y: k.y - box.y }))
    }
  }

  let applied = 0
  const usable = ready && !errors.length
  for (const { file, chapter } of chapters) {
    for (const sec of chapter.sections) {
      for (const b of sec.blocks) {
        if (b.type !== 'image') continue
        const img = b as ImageBlock
        delete img.map
        const d = defs[img.file]
        if (usable && d && Object.keys(d.events).length) { img.map = build(img.file, d); applied++ }
      }
    }
    writeFileSync(file, JSON.stringify(chapter))
  }
  if (usable) readdirSync(imgDir).filter(f => !keep.has(f.replace(/\.v$/, ''))).forEach(f => rmSync(join(imgDir, f)))
  if (errors.length) {
    errors.forEach(e => console.error(e))
    process.exit(1)
  }
  console.log(`hidden item maps ok for ${game} (${applied} of ${shots.length} screenshots redrawn)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const game = process.argv[2]
  if (!game) { console.error('usage: node scripts/apply-hidden-maps.ts <game> [--suggest]'); process.exit(2) }
  main(game, process.argv.includes('--suggest'))
}
