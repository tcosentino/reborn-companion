// Applies routes/<game>/<section-id>.json to the generated chapters in out/json/<game>/ (see app/src/lib/routes.ts):
// finds the walking path between each route's points, renders the map crop to app/public/maps/<game>/ and inserts a
// `route` block after the matched paragraph. Idempotent, like apply-tasks.ts.
// Needs the map dump from scripts/build-maps.sh; without it, route blocks are skipped with a warning.
//
// CLI: node scripts/apply-routes.ts <game>
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chapter, GuideIndex } from '../app/src/data/types'
import { applyRoutes, unapplyRoutes, type RouteBlock, type RouteDef, type Tile } from '../app/src/lib/routes.ts'
import { pruneRenders, readSectionDefs, renderCached } from './map-cards.ts'
import { writePng } from './png-rgba.ts'
import {
  assetsDir, findPath, hasMaps, imageLoader, loadIndex, loadMap, loadTilesets, mapsDir, renderMap, visibleEvents, walker,
  type Box, type GameMap, type MapIndex, type Tileset
} from './rmxp.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const validateRouteDefs = (section: string, defs: RouteDef[], maps?: MapIndex): string[] => {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const d of defs) {
    const at = `${section}/${d.id}`
    if (!SLUG.test(d.id)) errors.push(`${section}: bad route id "${d.id}"`)
    if (seen.has(d.id)) errors.push(`${section}: duplicate route id "${d.id}"`)
    seen.add(d.id)
    if (!d.match?.trim()) errors.push(`${at}: missing match`)
    if (!Number.isInteger(d.map)) errors.push(`${at}: missing map id`)
    else if (maps && !maps[d.map]) errors.push(`${at}: no map ${d.map}`)
    if (!Array.isArray(d.points) || d.points.length < 2) errors.push(`${at}: needs at least two points`)
    else if (d.points.some(p => !Array.isArray(p.at) || p.at.length !== 2 || !p.at.every(Number.isInteger))) errors.push(`${at}: every point needs at: [x, y]`)
    else if (!d.points[0].label || !d.points[d.points.length - 1].label) errors.push(`${at}: first and last points need a label`)
  }
  return errors
}

export interface Built { block: RouteBlock; box: Box; path: Tile[]; map: GameMap; tileset: Tileset }

// Where each point's marker goes. A point on a person stops on the tile in front of them, facing them, so
// neither the line nor the marker hides who the reader is looking for.
export interface Stop { at: Tile; face?: Tile }

// Path through every point in order, then a crop around it with `pad` tiles of context (at least 12x8)
export const resolveRoute = (def: RouteDef, map: GameMap, tileset: Tileset): { path: Tile[]; box: Box; stops: Stop[] } | string => {
  const hide = new Set(def.hide ?? [])
  const w = walker(map, tileset, { hide, surf: !!def.surf })
  const out = map.width, oh = map.height
  for (const p of def.points) {
    const [x, y] = p.at
    if (x < 0 || y < 0 || x >= out || y >= oh) return `point (${x},${y}) is outside the ${out}x${oh} map`
  }
  // Solid characters that are not doors: NPCs, trainers, item balls
  const people = new Set(visibleEvents(map, hide).filter(({ e, p }) => p.char && !p.through && !e.pages.some(pg => pg.warp)).map(({ e }) => `${e.x},${e.y}`))
  let from = def.points[0].at
  const path: Tile[] = [from]
  const stops: Stop[] = [{ at: from }]
  for (let i = 1; i < def.points.length; i++) {
    const to = def.points[i].at
    const walk = (a: Tile) => def.points[i].direct ? line(a, to) : findPath(w, out, oh, a, to)
    let seg = walk(from)
    // Some people leave once talked to and the way on is through their tile: walk on from where they stood
    const prev = def.points[i - 1].at
    if (!seg && from !== prev && (seg = walk(prev))) path.push(prev)
    if (!seg) return `no walkable path from (${prev}) to (${to})`
    const leg = seg.slice(1)
    if (people.has(`${to[0]},${to[1]}`) && leg.length) {
      leg.pop()
      const at = leg[leg.length - 1] ?? from
      stops.push({ at, face: [Math.sign(to[0] - at[0]), Math.sign(to[1] - at[1])] })
      from = at
    } else {
      stops.push({ at: to })
      from = to
    }
    path.push(...leg)
  }
  const pad = def.pad ?? 4
  const xs = path.map(p => p[0]), ys = path.map(p => p[1])
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad
  const grow = (lo: number, hi: number, min: number, size: number): [number, number] => {
    const need = Math.max(0, min - (hi - lo + 1))
    lo -= Math.floor(need / 2); hi += Math.ceil(need / 2)
    if (lo < 0) { hi -= lo; lo = 0 }
    if (hi > size - 1) { lo -= hi - (size - 1); hi = size - 1 }
    return [Math.max(0, lo), hi]
  }
  ;[x0, x1] = grow(x0, x1, 12, out)
  ;[y0, y1] = grow(y0, y1, 8, oh)
  return { path, stops, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } }
}

// Straight 8-connected line between two tiles (Bresenham), so it draws as one unbroken run
const line = ([x0, y0]: Tile, [x1, y1]: Tile): Tile[] => {
  const out: Tile[] = []
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy, x = x0, y = y0
  for (;;) {
    out.push([x, y])
    if (x === x1 && y === y1) return out
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
}

export const routeBlock = (def: RouteDef, map: GameMap, path: Tile[], stops: Stop[], box: Box, src: string): RouteBlock => {
  let n = 0
  return {
    type: 'route', id: def.id, ...(def.title ? { title: def.title } : {}), mapName: map.name, src, w: box.w, h: box.h,
    path: path.map(([x, y]) => [x - box.x, y - box.y] as Tile),
    ...(def.spoiler ? { spoiler: true } : {}),
    marks: def.points.flatMap((p, i) => {
      if (!p.label || p.via) return []
      const { at: [x, y], face } = stops[i]
      return [{ x: x - box.x, y: y - box.y, n: ++n, label: p.label, ...(face ? { face } : {}) }]
    })
  }
}

const main = (game: string) => {
  const dir = join(ROOT, 'routes', game)
  const out = join(ROOT, 'out/json', game)
  const maps = mapsDir(ROOT, game)
  const imgDir = join(ROOT, 'app/public/maps', game)
  const defs = readSectionDefs<RouteDef>(dir)
  const ready = hasMaps(maps)
  if (!ready && defs.size) console.warn(`apply-routes: no map dump in out/maps/${game} (run scripts/build-maps.sh ${game}); skipping route maps`)
  const index = ready ? loadIndex(maps) : undefined
  const errors = [...defs].flatMap(([s, d]) => validateRouteDefs(s, d, index))
  const tilesets = ready ? loadTilesets(maps) : {}
  const load = imageLoader(assetsDir(ROOT, game))
  const mapCache = new Map<number, GameMap>()
  const keep = new Set<string>()

  const build = (section: string, def: RouteDef) => {
    if (!mapCache.has(def.map)) mapCache.set(def.map, loadMap(maps, def.map))
    const map = mapCache.get(def.map)!
    const tileset = tilesets[map.tileset]
    const r = resolveRoute(def, map, tileset)
    if (typeof r === 'string') { errors.push(`${section}/${def.id}: ${r}`); return null }
    const file = `${section}--${def.id}.png`
    keep.add(file)
    const hash = renderCached(imgDir, file, [JSON.stringify([def.hide ?? [], r.box, map.data.length]), readFileSync(join(maps, `map${def.map}.json`))],
      () => writePng(renderMap(map, tileset, load, r.box, new Set(def.hide ?? []))))
    return routeBlock(def, map, r.path, r.stops, r.box, `maps/${game}/${file}?v=${hash}`)
  }

  const unseen = new Set(defs.keys())
  let applied = 0
  const guide: GuideIndex = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))
  for (const c of guide.chapters) {
    const file = join(out, c.file)
    const chapter: Chapter = JSON.parse(readFileSync(file, 'utf8'))
    for (const sec of chapter.sections) {
      const key = sec.id ?? c.id
      unseen.delete(key)
      const sectionDefs = ready && !errors.length ? defs.get(key) ?? [] : []
      const routes = sectionDefs.flatMap(def => { const block = build(key, def); return block ? [{ def, block }] : [] })
      const r = applyRoutes(sec.blocks, routes)
      sec.blocks = (ready ? r.blocks : unapplyRoutes(sec.blocks)) as typeof sec.blocks
      applied += routes.length - r.missing.length
      r.missing.forEach(d => errors.push(`${key}/${d.id}: no paragraph starts with "${d.match}"`))
    }
    writeFileSync(file, JSON.stringify(chapter))
  }
  unseen.forEach(s => errors.push(`routes/${game}/${s}.json: no such section`))
  // Drop renders of routes that no longer exist
  if (ready && !errors.length) pruneRenders(imgDir, keep)
  if (errors.length) {
    errors.forEach(e => console.error(e))
    process.exit(1)
  }
  console.log(`routes ok for ${game} (${applied} route maps)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const game = process.argv[2]
  if (!game) { console.error('usage: node scripts/apply-routes.ts <game>'); process.exit(2) }
  main(game)
}
