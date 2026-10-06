// RPG Maker XP map model (JSON from scripts/dump-maps.rb): loading, passability, path finding and rendering.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blank, draw, readPng, type Rgba } from './png-rgba.ts'

export interface EventPage {
  cond: boolean
  through: boolean
  trigger: number
  char?: string
  tile?: number
  dir?: number
  pattern?: number
  opacity?: number
  blend?: number
  warp?: { map: number; x: number; y: number }
  text?: string
  choices?: string[]
  // Item ball or hidden item (Kernel.pbItemBall): the item SYM it gives
  item?: string
}
export interface MapEvent { id: number; name: string; x: number; y: number; pages: EventPage[] }
export interface GameMap {
  id: number
  name: string
  tileset: number
  width: number
  height: number
  layers: number
  data: number[]
  events: MapEvent[]
}
export interface Tileset { name: string; tileset: string; autotiles: string[]; passages: number[]; priorities: number[]; terrain?: number[] }
export type MapIndex = Record<string, { name: string; parent: number }>

export const mapsDir = (root: string, game: string) => join(root, 'out/maps', game)
export const assetsDir = (root: string, game: string) => join(root, 'out/game', game)

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8'))
export const loadIndex = (dir: string) => readJson<MapIndex>(join(dir, 'index.json'))
export const loadTilesets = (dir: string) => readJson<Record<string, Tileset>>(join(dir, 'tilesets.json'))
export const loadMap = (dir: string, id: number) => readJson<GameMap>(join(dir, `map${id}.json`))
export const hasMaps = (dir: string) => existsSync(join(dir, 'index.json'))

export const tileAt = (m: GameMap, x: number, y: number, z: number) => m.data[x + y * m.width + z * m.width * m.height]

// The page shown before any story switch is set: the last page without conditions. Null when every page is conditional.
export const defaultPage = (e: MapEvent): EventPage | null => [...e.pages].reverse().find(p => !p.cond) ?? null

// Events drawn on the map: a default page with a character or tile graphic
export const visibleEvents = (m: GameMap, hide: Set<number> = new Set()) =>
  m.events.flatMap(e => {
    const p = defaultPage(e)
    return p && !hide.has(e.id) && (p.char || p.tile) ? [{ e, p }] : []
  })

// Direction bits in RMXP passages: 1 down, 2 left, 4 right, 8 up
const DIRS = [[0, 1, 1, 8], [-1, 0, 2, 4], [1, 0, 4, 2], [0, -1, 8, 1]] as const

// PBTerrain tags (Field.rb) used by movement
export const TERRAIN = { Ledge: 1, DeepWater: 5, StillWater: 6, Water: 7, WaterfallCrest: 9 } as const
const SURFABLE = new Set<number>([TERRAIN.DeepWater, TERRAIN.StillWater, TERRAIN.Water, TERRAIN.WaterfallCrest])

// Game_Map#terrain_tag: the top layer's non-zero tag
export const terrainAt = (m: GameMap, ts: Tileset, x: number, y: number) => {
  for (let z = m.layers - 1; z >= 0; z--) {
    const tag = ts.terrain?.[tileAt(m, x, y, z)] ?? 0
    if (tag > 0) return tag
  }
  return 0
}

export interface MoveRules {
  // Event ids left out (story actors that are gone at this point)
  hide?: Set<number>
  // Water tiles are walkable (the player is surfing)
  surf?: boolean
}

// Game_Map#passable? / playerPassable?: tile-graphic events first, then the top layer down; a blocking bit
// blocks, a priority-0 tile settles it as passable. `tileEvents` maps "x,y" to solid tile-graphic event tiles.
export const tilePassable = (m: GameMap, ts: Tileset, x: number, y: number, bit: number, tileEvents?: Map<string, number[]>, surf = false) => {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return false
  for (const t of tileEvents?.get(`${x},${y}`) ?? []) {
    const pass = ts.passages[t] ?? 0
    if (pass & bit || (pass & 0x0f) === 0x0f) return false
    if ((ts.priorities[t] ?? 0) === 0) return true
  }
  for (let z = m.layers - 1; z >= 0; z--) {
    const t = tileAt(m, x, y, z)
    if (t === 0) continue
    if (surf && SURFABLE.has(ts.terrain?.[t] ?? 0)) return true
    const pass = ts.passages[t] ?? 0
    if (pass & bit || (pass & 0x0f) === 0x0f) return false
    if ((ts.priorities[t] ?? 0) === 0) return true
  }
  return true
}

// One move from a tile: a step, or a ledge jump over `over` (Field.rb pbLedge: walking into a ledge tile jumps two tiles)
export interface Move { d: number; to: Tile; over?: Tile }

export interface Walker {
  canStep: (x: number, y: number, d: number) => boolean
  moves: (x: number, y: number) => Move[]
  // Doors and stairs that move the player elsewhere on the same map ("x,y" -> landing tile)
  warps?: Map<string, Tile>
}

// Movement rules for the player: tile passability both ways, solid characters (not "through"), tile-graphic
// events (bridges, barriers) by their tile's passability, ledge jumps, and optionally surfing.
export const walker = (m: GameMap, ts: Tileset, rules: MoveRules | Set<number> = {}): Walker => {
  const { hide = new Set<number>(), surf = false } = rules instanceof Set ? { hide: rules } : rules
  const shown = visibleEvents(m, hide).filter(({ p }) => !p.through)
  const solid = new Set(shown.filter(({ p }) => p.char).map(({ e }) => `${e.x},${e.y}`))
  const tileEvents = new Map<string, number[]>()
  shown.filter(({ p }) => !p.char && p.tile).forEach(({ e, p }) => tileEvents.set(`${e.x},${e.y}`, [...tileEvents.get(`${e.x},${e.y}`) ?? [], p.tile!]))
  const warps = new Map(m.events.filter(e => !hide.has(e.id)).flatMap(e => {
    const w = (defaultPage(e) ?? e.pages.find(p => p.warp))?.warp ?? e.pages.find(p => p.warp)?.warp
    return w && w.map === m.id ? [[`${e.x},${e.y}`, [w.x, w.y] as Tile]] : []
  }))
  // Warps to other maps (doors, vortexes, ladders) would take the player off this map: only a route's ends may use
  // them. Only the default page counts, so story-only triggers (every page conditional) do not block.
  const exits = new Set(m.events.filter(e => !hide.has(e.id)).flatMap(e => {
    const w = defaultPage(e)?.warp
    return w && w.map !== m.id ? [`${e.x},${e.y}`] : []
  }))
  const pass = (x: number, y: number, bit: number) => tilePassable(m, ts, x, y, bit, tileEvents, surf)
  const canStep = (x: number, y: number, d: number) => {
    const [dx, dy, out, inn] = DIRS[d]
    const nx = x + dx, ny = y + dy
    return pass(x, y, out) && pass(nx, ny, inn) && !solid.has(`${nx},${ny}`) && !exits.has(`${nx},${ny}`)
  }
  return {
    warps,
    canStep,
    moves: (x, y) => DIRS.flatMap(([dx, dy], d): Move[] => {
      const nx = x + dx, ny = y + dy
      if (canStep(x, y, d)) return [{ d, to: [nx, ny] }]
      if (terrainAt(m, ts, nx, ny) !== TERRAIN.Ledge) return []
      const jx = nx + dx, jy = ny + dy
      return pass(jx, jy, 0) && !solid.has(`${jx},${jy}`) && !exits.has(`${jx},${jy}`) ? [{ d, to: [jx, jy], over: [nx, ny] }] : []
    })
  }
}

export type Tile = [number, number]

// Shortest 4-way path from a to b, fewest turns among equally short ones. Leaving a and entering b ignore
// passability, since points are often doors, NPCs or items that the player walks up to.
export const findPath = (w: Walker, width: number, height: number, a: Tile, b: Tile): Tile[] | null => {
  const TURN = 1, STEP = 1000
  // State: tile * 4 + facing; buckets keyed by cost keep this a simple Dijkstra
  const cost = new Map<number, number>()
  const prev = new Map<number, number>()
  const buckets = new Map<number, number[]>()
  let top = 0
  const push = (s: number, c: number, from: number) => {
    if ((cost.get(s) ?? Infinity) <= c) return
    cost.set(s, c)
    prev.set(s, from)
    if (!buckets.has(c)) buckets.set(c, [])
    top = Math.max(top, c)
    buckets.get(c)!.push(s)
  }
  const start = (a[1] * width + a[0]) * 4
  for (let d = 0; d < 4; d++) push(start + d, 0, -1)
  const goal = b[1] * width + b[0]
  let end = -1
  for (let c = 0; end < 0 && c <= top; c++) {
    for (const s of buckets.get(c) ?? []) {
      if (cost.get(s) !== c) continue
      const t = s >> 2, facing = s & 3, x = t % width, y = Math.floor(t / width)
      if (t === goal) { end = s; break }
      const fromStart = x === a[0] && y === a[1]
      // Stepping onto a same-map warp lands on its destination (drawn as a break in the path). A leg that
      // starts on a warp (a door used as a point) may take it or walk off.
      const warp = w.warps?.get(`${x},${y}`)
      if (warp) {
        const [wx, wy] = warp
        if (wx >= 0 && wy >= 0 && wx < width && wy < height) push((wy * width + wx) * 4 + facing, c + STEP, s)
        if (!fromStart) continue
      }
      const moves = w.moves(x, y)
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = DIRS[d]
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const atEnd = nx === b[0] && ny === b[1]
        const intoWarp = w.warps?.has(`${nx},${ny}`) && tilePassableFrom(w, x, y, d)
        const jump = moves.find(mv => mv.d === d && mv.over)
        if (jump && !atEnd) {
          const [jx, jy] = jump.to
          if (jx >= 0 && jy >= 0 && jx < width && jy < height) push((jy * width + jx) * 4 + d, c + 2 * STEP + (fromStart || d === facing ? 0 : TURN), s)
          continue
        }
        if (!atEnd && !intoWarp && !w.canStep(x, y, d) && !(fromStart && tileOpen(w, nx, ny))) continue
        push((ny * width + nx) * 4 + d, c + STEP + (fromStart || d === facing ? 0 : TURN), s)
      }
    }
  }
  if (end < 0) return null
  const path: Tile[] = []
  for (let s = end; s >= 0; s = prev.get(s)!) {
    const t: Tile = [(s >> 2) % width, Math.floor((s >> 2) / width)]
    const last = path[path.length - 1]
    if (last && last[0] === t[0] && last[1] === t[1]) continue
    // A ledge jump moves two tiles in a straight line: put the ledge tile back so the line stays unbroken
    const p = prev.get(s)!
    if (last && Math.abs(last[0] - t[0]) + Math.abs(last[1] - t[1]) === 2 && (last[0] === t[0] || last[1] === t[1]) && p !== undefined
      && !w.warps?.has(`${t[0]},${t[1]}`)) path.push([(last[0] + t[0]) / 2, (last[1] + t[1]) / 2])
    path.push(t)
  }
  return path.reverse()
}

// Every tile walkable from start ("x,y" keys), following same-map warps; for debugging unreachable points
export const reachable = (w: Walker, width: number, height: number, start: Tile): Set<string> => {
  const seen = new Set([`${start[0]},${start[1]}`])
  const queue: Tile[] = [start]
  const visit = (t: Tile) => { const k = `${t[0]},${t[1]}`; if (!seen.has(k)) { seen.add(k); queue.push(t) } }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]
    const warp = w.warps?.get(`${x},${y}`)
    if (warp) { visit(warp); if (i > 0) continue }
    w.moves(x, y).forEach(mv => visit(mv.to))
    // Like findPath, a start on a blocked tile (door, NPC, pond edge) may step to any open neighbour
    if (i === 0) DIRS.forEach(([dx, dy]) => { const n: Tile = [x + dx, y + dy]; if (n[0] >= 0 && n[1] >= 0 && n[0] < width && n[1] < height && tileOpen(w, ...n)) visit(n) })
    DIRS.forEach(([dx, dy], d) => {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && w.warps?.has(`${nx},${ny}`) && tilePassableFrom(w, x, y, d)) visit([nx, ny])
    })
  }
  return seen
}

// Leaving (x, y) toward d is allowed by the tile itself, whatever is on the other side (a door tile is often solid)
const tilePassableFrom = (w: Walker, x: number, y: number, d: number) => w.canStep(x, y, d) || DIRS.some((_, e) => e !== d && w.canStep(x, y, e))

// A tile the player could stand on (enterable from some side)
const tileOpen = (w: Walker, x: number, y: number) =>
  DIRS.some(([dx, dy], d) => w.canStep(x - dx, y - dy, d))

// --- Rendering ---------------------------------------------------------------------------------------------------

// RMXP autotile layout: for each of the 48 shapes, the four 16px quarters (1-based, 6 per row) of the 96x128 sheet
const AUTOTILES = [
  [[27, 28, 33, 34], [5, 28, 33, 34], [27, 6, 33, 34], [5, 6, 33, 34], [27, 28, 33, 12], [5, 28, 33, 12], [27, 6, 33, 12], [5, 6, 33, 12]],
  [[27, 28, 11, 34], [5, 28, 11, 34], [27, 6, 11, 34], [5, 6, 11, 34], [27, 28, 11, 12], [5, 28, 11, 12], [27, 6, 11, 12], [5, 6, 11, 12]],
  [[25, 26, 31, 32], [25, 6, 31, 32], [25, 26, 31, 12], [25, 6, 31, 12], [15, 16, 21, 22], [15, 16, 21, 12], [15, 16, 11, 22], [15, 16, 11, 12]],
  [[29, 30, 35, 36], [29, 30, 11, 36], [5, 30, 35, 36], [5, 30, 11, 36], [39, 40, 45, 46], [5, 40, 45, 46], [39, 6, 45, 46], [5, 6, 45, 46]],
  [[25, 30, 31, 36], [15, 16, 45, 46], [13, 14, 19, 20], [13, 14, 19, 12], [17, 18, 23, 24], [17, 18, 11, 24], [41, 42, 47, 48], [5, 42, 47, 48]],
  [[37, 38, 43, 44], [37, 6, 43, 44], [13, 18, 19, 24], [13, 14, 43, 44], [37, 42, 43, 48], [17, 18, 47, 48], [13, 18, 43, 48], [1, 2, 7, 8]]
].flat()

export interface Box { x: number; y: number; w: number; h: number }

export const imageLoader = (assets: string) => {
  const cache = new Map<string, Rgba | null>()
  return (folder: string, name: string): Rgba | null => {
    const key = `${folder}/${name}`
    if (!cache.has(key)) {
      const file = join(assets, 'Graphics', folder, `${name}.png`)
      cache.set(key, name && existsSync(file) ? readPng(readFileSync(file)) : null)
    }
    return cache.get(key)!
  }
}

// Renders the box (in tiles) of a map: priority-0 tiles, then events by row, then tiles drawn above characters.
export const renderMap = (m: GameMap, ts: Tileset, load: ReturnType<typeof imageLoader>, box: Box, hide: Set<number> = new Set()): Rgba => {
  const img = blank(box.w * 32, box.h * 32, [0, 0, 0, 255])
  const sheet = load('Tilesets', ts.tileset)
  const drawTile = (t: number, px: number, py: number, opacity = 255) => {
    if (t >= 384) {
      if (sheet) draw(img, sheet, ((t - 384) % 8) * 32, Math.floor((t - 384) / 8) * 32, 32, 32, px, py, opacity)
      return
    }
    if (t < 48) return
    const auto = load('Autotiles', ts.autotiles[Math.floor(t / 48) - 1])
    if (!auto) return
    if (auto.h === 32) { draw(img, auto, 0, 0, 32, 32, px, py, opacity); return }
    AUTOTILES[t % 48].forEach((n, q) =>
      draw(img, auto, ((n - 1) % 6) * 16, Math.floor((n - 1) / 6) * 16, 16, 16, px + (q % 2) * 16, py + Math.floor(q / 2) * 16, opacity))
  }
  const tiles = (above: boolean) => {
    for (let z = 0; z < m.layers; z++) {
      for (let y = box.y; y < box.y + box.h; y++) {
        for (let x = box.x; x < box.x + box.w; x++) {
          const t = tileAt(m, x, y, z)
          if (t && ((ts.priorities[t] ?? 0) > 0) === above) drawTile(t, (x - box.x) * 32, (y - box.y) * 32)
        }
      }
    }
  }
  tiles(false)
  const events = visibleEvents(m, hide).filter(({ e }) => e.x >= box.x - 2 && e.x < box.x + box.w + 2 && e.y >= box.y - 2 && e.y < box.y + box.h + 4)
  for (const { e, p } of events.sort((a, b) => a.e.y - b.e.y)) {
    const px = (e.x - box.x) * 32, py = (e.y - box.y) * 32
    if (p.tile) { drawTile(p.tile, px, py, p.opacity ?? 255); continue }
    const c = load('Characters', p.char!)
    if (!c) continue
    const fw = Math.floor(c.w / 4), fh = Math.floor(c.h / 4)
    const row = ({ 2: 0, 4: 1, 6: 2, 8: 3 } as Record<number, number>)[p.dir ?? 2] ?? 0
    draw(img, c, (p.pattern ?? 0) * fw, row * fh, fw, fh, px + 16 - Math.floor(fw / 2), py + 32 - fh, p.opacity ?? 255, p.blend === 1 ? 'add' : 'normal')
  }
  tiles(true)
  return img
}
