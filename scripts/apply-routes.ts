// Applies routes/<game>/<section-id>.json to the generated chapters in out/json/<game>/ (see app/src/lib/routes.ts):
// finds the walking path between each route's points, renders the map crop to app/public/maps/<game>/ and inserts a
// `route` block after the matched paragraph. Idempotent, like apply-tasks.ts.
// Needs the map dump from scripts/build-maps.sh; without it, route blocks are skipped with a warning.
//
// CLI: node scripts/apply-routes.ts <game>
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chapter, GuideIndex } from '../app/src/data/types'
import { applyRoutes, unapplyRoutes, type RouteBlock, type RouteDef, type Tile } from '../app/src/lib/routes.ts'
import { writePng } from './png-rgba.ts'
import {
  assetsDir, findPath, hasMaps, imageLoader, loadIndex, loadMap, loadTilesets, mapsDir, renderMap, walker,
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

// Path through every point in order, then a crop around it with `pad` tiles of context (at least 12x8)
export const resolveRoute = (def: RouteDef, map: GameMap, tileset: Tileset): { path: Tile[]; box: Box } | string => {
  const hide = new Set(def.hide ?? [])
  const w = walker(map, tileset, { hide, surf: !!def.surf })
  const out = map.width, oh = map.height
  for (const p of def.points) {
    const [x, y] = p.at
    if (x < 0 || y < 0 || x >= out || y >= oh) return `point (${x},${y}) is outside the ${out}x${oh} map`
  }
  const path: Tile[] = [def.points[0].at]
  for (let i = 1; i < def.points.length; i++) {
    if (def.points[i].direct) { path.push(...line(def.points[i - 1].at, def.points[i].at).slice(1)); continue }
    const seg = findPath(w, out, oh, def.points[i - 1].at, def.points[i].at)
    if (!seg) return `no walkable path from (${def.points[i - 1].at}) to (${def.points[i].at})`
    path.push(...seg.slice(1))
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
  return { path, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } }
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

export const routeBlock = (def: RouteDef, map: GameMap, path: Tile[], box: Box, src: string): RouteBlock => {
  let n = 0
  return {
    type: 'route', id: def.id, ...(def.title ? { title: def.title } : {}), mapName: map.name, src, w: box.w, h: box.h,
    path: path.map(([x, y]) => [x - box.x, y - box.y] as Tile),
    ...(def.spoiler ? { spoiler: true } : {}),
    marks: def.points.filter(p => p.label && !p.via).map(p => ({ x: p.at[0] - box.x, y: p.at[1] - box.y, n: ++n, label: p.label! }))
  }
}

const main = (game: string) => {
  const dir = join(ROOT, 'routes', game)
  const out = join(ROOT, 'out/json', game)
  const maps = mapsDir(ROOT, game)
  const imgDir = join(ROOT, 'app/public/maps', game)
  const defs = new Map<string, RouteDef[]>(existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), JSON.parse(readFileSync(join(dir, f), 'utf8'))])
    : [])
  const ready = hasMaps(maps)
  if (!ready && defs.size) console.warn(`apply-routes: no map dump in out/maps/${game} (run scripts/build-maps.sh ${game}); skipping route maps`)
  const index = ready ? loadIndex(maps) : undefined
  const errors = [...defs].flatMap(([s, d]) => validateRouteDefs(s, d, index))
  const tilesets = ready ? loadTilesets(maps) : {}
  const load = imageLoader(assetsDir(ROOT, game))
  const mapCache = new Map<number, GameMap>()
  const keep = new Set<string>()
  if (ready) mkdirSync(imgDir, { recursive: true })

  const build = (section: string, def: RouteDef) => {
    if (!mapCache.has(def.map)) mapCache.set(def.map, loadMap(maps, def.map))
    const map = mapCache.get(def.map)!
    const tileset = tilesets[map.tileset]
    const r = resolveRoute(def, map, tileset)
    if (typeof r === 'string') { errors.push(`${section}/${def.id}: ${r}`); return null }
    const file = `${section}--${def.id}.png`
    keep.add(file)
    const hash = createHash('sha1').update(JSON.stringify([def.hide ?? [], r.box, map.data.length])).update(readFileSync(join(maps, `map${def.map}.json`))).digest('hex').slice(0, 10)
    const stamp = join(imgDir, `${file}.v`)
    if (!existsSync(join(imgDir, file)) || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== hash) {
      writeFileSync(join(imgDir, file), writePng(renderMap(map, tileset, load, r.box, new Set(def.hide ?? []))))
      writeFileSync(stamp, hash)
    }
    return routeBlock(def, map, r.path, r.box, `maps/${game}/${file}?v=${hash}`)
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
  if (ready && !errors.length) readdirSync(imgDir).filter(f => !keep.has(f.replace(/\.v$/, ''))).forEach(f => rmSync(join(imgDir, f)))
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
