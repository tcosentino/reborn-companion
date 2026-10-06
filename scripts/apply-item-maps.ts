// Applies item-maps/<game>/<section-id>.json to the generated chapters in out/json/<game>/ (see app/src/lib/itemMaps.ts):
// for each card, renders a crop of the game map around its item events to app/public/maps/<game>-item-cards/ and
// inserts an `itemMap` block (a numbered, checkable item list on the map) after the matched paragraph. A card's
// `image` screenshot is folded into the card. Idempotent, like apply-routes.ts.
// Fails on a missing paragraph or screenshot, unknown section, map or event, or an event that gives no item.
// Needs the map dump from scripts/build-maps.sh; without it the cards are skipped with a warning.
//
// CLI: node scripts/apply-item-maps.ts <game>
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Dex } from '../app/src/data/types'
import {
  cropBox, foldImages, itemCardMarks, itemEventInfo, validateItemCardDefs,
  type ItemCardBlock, type ItemCardDef, type ItemEventInfo, type Tile
} from '../app/src/lib/itemMaps.ts'
import { insertAfterParagraphs, unapplyInserted } from '../app/src/lib/routes.ts'
import { loadChapters, pruneRenders, readSectionDefs, renderCached } from './map-cards.ts'
import { writePng } from './png-rgba.ts'
import { assetsDir, hasMaps, imageLoader, loadIndex, loadMap, loadTilesets, mapsDir, renderMap, type GameMap } from './rmxp.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Map and event lookups over the map dump, cached per map. `event` is undefined for no such event, null for a
// non-item event.
export const mapData = (dir: string) => {
  const index = loadIndex(dir)
  const cache = new Map<number, { map: GameMap; events: Map<number, ItemEventInfo | null> }>()
  const get = (id: number) => {
    if (!cache.has(id)) {
      const map = loadMap(dir, id)
      cache.set(id, { map, events: new Map(map.events.map(e => [e.id, itemEventInfo(e)])) })
    }
    return cache.get(id)!
  }
  return {
    index,
    get,
    hasMap: (id: number) => !!index[id],
    event: (map: number, id: number) => { const ev = get(map).events; return ev.has(id) ? ev.get(id) ?? null : undefined }
  }
}

// Crop box around a card's events
export const cardBox = (def: ItemCardDef, map: GameMap, events: Map<number, ItemEventInfo | null>) =>
  cropBox(def.items.map(it => { const e = events.get(it.event)!; return [e.x, e.y] as Tile }), map.width, map.height, def.pad)

const main = (game: string) => {
  const out = join(ROOT, 'out/json', game)
  const maps = mapsDir(ROOT, game)
  const imgDir = join(ROOT, 'app/public/maps', `${game}-item-cards`)
  const defs = readSectionDefs<ItemCardDef>(join(ROOT, 'item-maps', game))
  const ready = hasMaps(maps)
  if (!ready && defs.size) console.warn(`apply-item-maps: no map dump in out/maps/${game} (run scripts/build-maps.sh ${game}); skipping item maps`)
  const data = ready ? mapData(maps) : undefined
  const errors = [...defs].flatMap(([s, d]) => validateItemCardDefs(s, d, data))
  const dex: Dex = JSON.parse(readFileSync(join(out, 'dex.json'), 'utf8'))
  const itemName = (sym: string) => dex.items[sym]?.name ?? sym
  const tilesets = ready ? loadTilesets(maps) : {}
  const load = imageLoader(assetsDir(ROOT, game))
  const keep = new Set<string>()
  const usable = ready && !errors.length

  const build = (section: string, def: ItemCardDef, shot?: { file: string; src: string }): ItemCardBlock => {
    const { map, events } = data!.get(def.map)
    const box = cardBox(def, map, events)
    const file = `${section}--${def.id}.png`
    keep.add(file)
    const hash = renderCached(imgDir, file, [JSON.stringify(box), readFileSync(join(maps, `map${def.map}.json`))],
      () => writePng(renderMap(map, tilesets[map.tileset], load, box)))
    return {
      type: 'itemMap', id: def.id, section, ...(def.title ? { title: def.title } : {}),
      mapName: map.name, src: `maps/${game}-item-cards/${file}?v=${hash}`, w: box.w, h: box.h,
      marks: itemCardMarks(def, events as Map<number, ItemEventInfo>, box, itemName),
      ...(shot ? { shot } : {})
    }
  }

  // The same item on two cards (or on a hidden-items screenshot) would get two checkboxes: warn, since it may be deliberate
  const owner = new Map<string, string>()
  const hiddenDefs = join(ROOT, 'hidden-maps', `${game}.json`)
  if (existsSync(hiddenDefs)) {
    for (const [file, d] of Object.entries(JSON.parse(readFileSync(hiddenDefs, 'utf8')) as Record<string, { map: number; events: Record<string, number> }>)) {
      Object.values(d.events).forEach(e => owner.set(`${d.map}:${e}`, `hidden-maps ${file}`))
    }
  }
  for (const [section, list] of defs) for (const d of Array.isArray(list) ? list : []) for (const it of d.items ?? []) {
    const k = `${d.map}:${it.event}`
    if (owner.has(k)) console.warn(`apply-item-maps: ${section}/${d.id} event ${it.event} on map ${d.map} is also on ${owner.get(k)}`)
    else owner.set(k, `${section}/${d.id}`)
  }

  const unseen = new Set(defs.keys())
  let applied = 0
  for (const { id, file, chapter } of loadChapters(out)) {
    for (const sec of chapter.sections) {
      const key = sec.id ?? id
      unseen.delete(key)
      const sectionDefs = usable ? defs.get(key) ?? [] : []
      const images = new Map(sectionDefs.flatMap(d => d.image ? [[d.image, d.id] as [string, string]] : []))
      const folded = foldImages(sec.blocks, images)
      folded.missing.forEach(f => errors.push(`${key}: no guide image ${f} in this section`))
      const shots = new Map(folded.blocks.flatMap(b => b.type === 'image' && b.itemCard ? [[b.itemCard, { file: b.file, src: b.src }] as const] : []))
      const cards = sectionDefs.map(def => ({ def, block: build(key, def, shots.get(def.id)) }))
      const r = insertAfterParagraphs(folded.blocks, cards, 'itemMap')
      r.missing.forEach(d => errors.push(`${key}/${d.id}: no paragraph starts with "${d.match}"`))
      applied += cards.length - r.missing.length
      sec.blocks = (usable ? r.blocks : unapplyInserted(folded.blocks, 'itemMap')) as typeof sec.blocks
    }
    writeFileSync(file, JSON.stringify(chapter))
  }
  unseen.forEach(s => errors.push(`item-maps/${game}/${s}.json: no such section`))
  if (usable && !errors.length) pruneRenders(imgDir, keep)
  if (errors.length) {
    errors.forEach(e => console.error(e))
    process.exit(1)
  }
  console.log(`item maps ok for ${game} (${applied} cards)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const game = process.argv[2]
  if (!game) { console.error('usage: node scripts/apply-item-maps.ts <game>'); process.exit(2) }
  main(game)
}
