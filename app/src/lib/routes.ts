// Route maps: a walking path drawn over the game's own map, placed after the paragraph that describes it.
// Curated definitions live in routes/<game>/<section-id>.json; scripts/apply-routes.ts finds the path between
// the points, renders the map crop and inserts a `route` block after the matched paragraph.
// Only type-erasable TS here: the build script runs under Node's native type stripping.

export type Tile = [number, number]

// A point on the route, in map tiles. Labelled points get numbered markers; `via` points only steer the path.
// `direct` reaches the point in a straight line from the previous one instead of walking (scripted stairs,
// surfing, cutscene moves the pathfinder cannot follow).
export interface RoutePointDef {
  at: Tile
  label?: string
  via?: boolean
  direct?: boolean
}

// One entry in routes/<game>/<section-id>.json
export interface RouteDef {
  // Kebab slug, unique within the section (anchor `route-<id>`)
  id: string
  // Verbatim start of the paragraph the route illustrates (whitespace-trimmed)
  match: string
  // Game map id (out/maps/<game>/index.json)
  map: number
  title?: string
  points: RoutePointDef[]
  // The player is surfing: water tiles are walkable
  surf?: boolean
  // Event ids to leave out of the render and pathing (e.g. story-only NPCs that are gone by this point)
  hide?: number[]
  // Extra tiles of context around the path (default 4)
  pad?: number
  // A puzzle solution: the map stays covered until the reader asks to see it
  spoiler?: boolean
}

// `face`: the stop is in front of a person, in this direction; the marker is drawn clear of their sprite
export interface RouteMark { x: number; y: number; n: number; label: string; face?: Tile }

export interface RouteBlock {
  type: 'route'
  id: string
  title?: string
  mapName: string
  // Map crop, relative to the app's BASE_URL
  src: string
  // Crop size in tiles (32 px each); path and marks are relative to the crop
  w: number
  h: number
  // Tiles in walking order. A jump of more than one tile is a warp (door or stairs on the same map): the line breaks.
  path: Tile[]
  marks: RouteMark[]
  spoiler?: boolean
}

// Marker radius in map pixels (tiles are 32), before the card's scale factor k
export const MARK_R = 14

// A stop in front of a person: slide the marker away from them until it clears their sprite. Character sprites
// are a tile and a half tall, so someone below the stop reaches up into its tile.
export const markOffset = (face: Tile | undefined, k: number): Tile => {
  if (!face) return [0, 0]
  const r = (MARK_R + 2) * k
  const d = face[1] > 0 ? r : Math.max(0, r - 16)
  return [-face[0] * d || 0, -face[1] * d || 0]
}

interface BlockLike { type: string; markdown?: string }

export const routeAnchor = (slug: string) => `route-${slug}`

// Splits a path into drawable runs at warps (consecutive tiles more than one tile apart, diagonals included)
export const pathRuns = (path: Tile[]): Tile[][] =>
  path.reduce<Tile[][]>((runs, t, i) => {
    const p = path[i - 1]
    if (!p || Math.max(Math.abs(t[0] - p[0]), Math.abs(t[1] - p[1])) > 1) runs.push([t])
    else runs[runs.length - 1].push(t)
    return runs
  }, [])

const paragraphs = (md: string) => md.split('\n\n').map(p => p.trim()).filter(Boolean)

// Undo earlier inserts of one block type (route maps, item maps): those blocks are dropped and the prose they split
// is joined again
export const unapplyInserted = <B extends BlockLike>(blocks: B[], type: string): B[] => {
  const out: B[] = []
  for (const b of blocks) {
    if (b.type === type) continue
    const prev = out[out.length - 1]
    if (b.type === 'prose' && prev?.type === 'prose') prev.markdown = `${prev.markdown}\n\n${b.markdown}`
    else out.push(b.type === 'prose' ? { ...b } : b)
  }
  return out
}

export const unapplyRoutes = <B extends BlockLike>(blocks: (B | RouteBlock)[]): B[] => unapplyInserted(blocks, 'route') as B[]

// Inserts each built block after the paragraph (or task card) its def matches, after undoing earlier inserts of the
// same type. Returns the new blocks and the defs whose match found nothing.
export const insertAfterParagraphs = <B extends BlockLike, D extends { match: string }, I extends BlockLike>(
  blocks: (B | I)[], items: { def: D; block: I }[], type: I['type']
) => {
  const base = unapplyInserted(blocks, type) as (B | I)[]
  const used = new Set<D>()
  const take = (p: string) => items.filter(r => !used.has(r.def) && p.startsWith(r.def.match.trim()))
    .map(r => { used.add(r.def); return r.block })
  const out: (B | I)[] = []
  for (let i = 0; i < base.length; i++) {
    const b = base[i]
    if (b.type === 'task') {
      // Task cards sharing a paragraph follow it with an empty markdown; place inserts after the whole group
      const hits = b.markdown ? take(b.markdown.trim()) : []
      out.push(b)
      while (hits.length && base[i + 1]?.type === 'task' && !base[i + 1].markdown) out.push(base[++i])
      out.push(...hits)
      continue
    }
    if (b.type !== 'prose') { out.push(b); continue }
    let pending: string[] = []
    for (const p of paragraphs(b.markdown as string)) {
      pending.push(p)
      const hits = take(p)
      if (!hits.length) continue
      out.push({ ...b, markdown: pending.join('\n\n') }, ...hits)
      pending = []
    }
    if (pending.length) out.push({ ...b, markdown: pending.join('\n\n') })
  }
  return { blocks: out, missing: items.filter(r => !used.has(r.def)).map(r => r.def) }
}

// Inserts each built route after the paragraph (or task card) its def matches.
// Returns the new blocks and the routes whose match found nothing.
export const applyRoutes = <B extends BlockLike>(blocks: (B | RouteBlock)[], routes: { def: RouteDef; block: RouteBlock }[]) =>
  insertAfterParagraphs<B, RouteDef, RouteBlock>(blocks, routes, 'route')
