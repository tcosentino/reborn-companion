// Hidden-item maps: the guide's hand-marked hiddenNNN.png screenshots redrawn from the game's own map, with a
// marker on each lettered item's exact tile. hidden-maps/<game>.json pairs every letter with a map event;
// scripts/apply-hidden-maps.ts renders the crop and attaches it to the screenshot's image block as `map`.
// Only type-erasable TS here: the build script runs under Node's native type stripping.

export type Tile = [number, number]

// One entry in hidden-maps/<game>.json, keyed by screenshot file: the game map and each letter's event id
export interface HiddenMapDef {
  map: number
  events: Record<string, number>
  // Extra tiles of context around the markers (default 3)
  pad?: number
}

export interface ItemMark { key: string; x: number; y: number }

// Attached to an ImageBlock. Marks are relative to the crop, in 32 px tiles
export interface ItemMap {
  mapName: string
  // Map crop, relative to the app's BASE_URL
  src: string
  w: number
  h: number
  marks: ItemMark[]
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Item display name to SYM, from dex.json items
export const itemSyms = (items: Record<string, { name: string }>) => {
  const bySym = new Map(Object.entries(items).map(([sym, i]) => [norm(i.name), sym]))
  return (name: string) => bySym.get(norm(name))
}

export interface ItemEvent { id: number; x: number; y: number; item: string }
export interface ItemMapCandidate { id: number; name: string; events: ItemEvent[] }

// How many of the wanted items the map has, counting repeats
const hits = (want: string[], events: ItemEvent[]) => {
  const pool = events.map(e => e.item)
  return want.filter(w => { const i = pool.indexOf(w); if (i < 0) return false; pool.splice(i, 1); return true }).length
}

// Words of the section title that appear in the map name ("obsidia-slums" vs "Obsidia Slums B1F")
const nameScore = (section: string, mapName: string) => {
  const name = norm(mapName)
  return section.split('-').filter(w => w.length > 2 && name.includes(w)).length
}

// Letters to events: every combination of same-item events (none reused), keeping the tightest cluster, since
// each screenshot shows one part of the map. Letters whose item is not on the map are left out.
export const assignLetters = (want: { letter: string; item: string }[], events: ItemEvent[], limit = 50000): Record<string, number> => {
  const options = want.map(w => events.filter(e => e.item === w.item))
  let best: { size: number; pick: (ItemEvent | null)[] } | null = null
  let tried = 0
  const pick: (ItemEvent | null)[] = []
  const walk = (i: number) => {
    if (tried > limit) return
    if (i === want.length) {
      tried++
      const got = pick.filter((e): e is ItemEvent => !!e)
      const xs = got.map(e => e.x), ys = got.map(e => e.y)
      const size = got.length ? Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) : 0
      if (!best || size < best.size) best = { size, pick: [...pick] }
      return
    }
    const free = options[i].filter(e => !pick.includes(e))
    if (!free.length) { pick.push(null); walk(i + 1); pick.pop(); return }
    for (const e of free) { pick.push(e); walk(i + 1); pick.pop() }
  }
  walk(0)
  const chosen = (best as { pick: (ItemEvent | null)[] } | null)?.pick ?? []
  return Object.fromEntries(want.flatMap((w, i) => chosen[i] ? [[w.letter, chosen[i]!.id]] : []))
}

type Want = { letter: string; item: string }[]

// Maps that could hold a screenshot: those with the most of its items, the name closest to the section first,
// then the lowest id. `claimed` holds events other screenshots already use.
export const rankMaps = (section: string, want: Want, maps: ItemMapCandidate[], claimed: Set<string> = new Set()) => {
  const items = want.map(w => w.item)
  const ranked = maps
    .map(m => ({ m, events: m.events.filter(e => !claimed.has(`${m.id}:${e.id}`)) }))
    .map(c => ({ ...c, hit: hits(items, c.events), name: nameScore(section, c.m.name) }))
    .filter(c => c.hit > 0)
    .sort((a, b) => b.hit - a.hit || b.name - a.name || a.m.id - b.m.id)
  return ranked.filter(c => c.hit === ranked[0].hit)
}

// Tile box [x, y, w, h] (fractional) where the screenshot was found on the map, from scripts/locate-shots.py
export interface Located { map: number; box: [number, number, number, number] }

// Pairs a screenshot with a map and its letters with events. With `located`, that map is used and only events
// inside the screenshot's footprint count; otherwise the top-ranked map and the tightest cluster of events.
export const suggestHiddenMap = (section: string, want: Want, maps: ItemMapCandidate[], claimed: Set<string> = new Set(), located?: Located): HiddenMapDef | null => {
  const ranked = rankMaps(section, want, maps, claimed)
  const top = located ? ranked.find(c => c.m.id === located.map) : ranked[0]
  if (!top) return null
  const inside = located
    ? top.events.filter(e => {
      const [x, y, w, h] = located.box
      return e.x >= Math.floor(x) && e.x < x + w && e.y >= Math.floor(y) && e.y < y + h
    })
    : top.events
  return { map: top.m.id, events: assignLetters(want, inside) }
}

// Crop around the markers with `pad` tiles of context, at least minW x minH, kept inside the map
export const cropBox = (tiles: Tile[], width: number, height: number, pad = 3, minW = 12, minH = 8) => {
  const xs = tiles.map(t => t[0]), ys = tiles.map(t => t[1])
  const grow = (lo: number, hi: number, min: number, max: number): [number, number] => {
    lo = Math.max(0, lo - pad)
    hi = Math.min(max - 1, hi + pad)
    while (hi - lo + 1 < Math.min(min, max)) {
      if (lo > 0) lo--
      if (hi - lo + 1 < Math.min(min, max) && hi < max - 1) hi++
    }
    return [lo, hi]
  }
  const [x0, x1] = grow(Math.min(...xs), Math.max(...xs), minW, width)
  const [y0, y1] = grow(Math.min(...ys), Math.max(...ys), minH, height)
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

// Item map cards: item balls and hidden items that the guide only lists in prose ("a hidden *Max Revive* behind the
// third tree"), drawn on the game map as a numbered checklist. Curated in item-maps/<game>/<section-id>.json;
// scripts/apply-item-maps.ts renders the crop and inserts an `itemMap` block after the matched paragraph.

// One item on a card: the map event that gives it, and an optional legend label (default: the item's name)
export interface ItemCardItemDef { event: number; label?: string }

// One entry in item-maps/<game>/<section-id>.json. One card covers one map (floors are separate cards).
export interface ItemCardDef {
  // Kebab slug, unique within the section. Part of every checkbox id, so never rename it.
  id: string
  // Verbatim start of the paragraph the card goes after (whitespace-trimmed)
  match: string
  // Game map id (out/maps/<game>/index.json)
  map: number
  title?: string
  // In legend order; markers are numbered 1..n in this order
  items: ItemCardItemDef[]
  // Extra tiles of context around the markers (default 3)
  pad?: number
  // A plain guide screenshot in the same section that this card supersedes: it is folded into the card
  image?: string
}

export interface ItemCardMark {
  key: string
  event: number
  // Item SYM and legend label
  item: string
  label: string
  // No graphic on the map (found with the Itemfinder or by pressing A on the tile)
  hidden: boolean
  // Tile in the crop
  x: number
  y: number
}

export interface ItemCardBlock extends ItemMap {
  type: 'itemMap'
  // Card slug (anchor `items-<id>`)
  id: string
  // Section id, for checkbox ids
  section: string
  title?: string
  marks: ItemCardMark[]
  // The folded guide screenshot (`image`), linked from the card and shown if the render is missing
  shot?: { file: string; src: string }
}

// Checkbox id in the `hidden` checklist, next to the hidden-item screenshot ids
export const itemCheckId = (section: string, card: string, event: number) => `item:${section}/${card}/${event}`
export const itemCardAnchor = (slug: string) => `items-${slug}`

// Every item event's checkbox id per card block, in guide order (battles.json `i`, guarded by the progress-id baseline)
export const itemCardIds = (blocks: { type: string }[]): string[] =>
  blocks.flatMap(b => b.type === 'itemMap'
    ? (b as ItemCardBlock).marks.map(m => itemCheckId((b as ItemCardBlock).section, (b as ItemCardBlock).id, m.event))
    : [])

// A map event that gives an item, as recorded by scripts/dump-maps.rb
export interface ItemEventInfo { id: number; x: number; y: number; item: string; hidden: boolean }

interface PageLike { item?: string; char?: string; tile?: number }

// The event's item and whether it is hidden (its item page has no graphic), or null when it gives no item
export const itemEventInfo = (e: { id: number; x: number; y: number; pages: PageLike[] }): ItemEventInfo | null => {
  const p = e.pages.find(pg => pg.item)
  return p?.item ? { id: e.id, x: e.x, y: e.y, item: p.item, hidden: !p.char && !p.tile } : null
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Shape checks that need no map data. `events` (event id -> item info, or null for a non-item event) and `maps`
// (known map ids) add the data checks when the map dump is present.
export const validateItemCardDefs = (
  section: string, defs: ItemCardDef[],
  data?: { hasMap: (id: number) => boolean; event: (map: number, id: number) => ItemEventInfo | null | undefined }
): string[] => {
  const errors: string[] = []
  if (!Array.isArray(defs)) return [`${section}: file must be a JSON array of cards`]
  const seen = new Set<string>()
  for (const d of defs) {
    const at = `${section}/${d.id}`
    if (typeof d.id !== 'string' || !SLUG.test(d.id)) errors.push(`${section}: bad card id "${d.id}"`)
    if (seen.has(d.id)) errors.push(`${section}: duplicate card id "${d.id}"`)
    seen.add(d.id)
    if (typeof d.match !== 'string' || !d.match.trim()) errors.push(`${at}: missing match`)
    if (d.image !== undefined && (typeof d.image !== 'string' || /^hidden\d+\./.test(d.image))) errors.push(`${at}: image must be a plain screenshot file name (hiddenNNN.png belongs in hidden-maps/)`)
    if (!Number.isInteger(d.map)) { errors.push(`${at}: missing map id`); continue }
    if (data && !data.hasMap(d.map)) { errors.push(`${at}: no map ${d.map}`); continue }
    if (!Array.isArray(d.items) || !d.items.length) { errors.push(`${at}: needs at least one item`); continue }
    const events = new Set<number>()
    for (const it of d.items) {
      if (!Number.isInteger(it?.event)) { errors.push(`${at}: every item needs an integer event`); continue }
      if (events.has(it.event)) errors.push(`${at}: event ${it.event} is listed twice`)
      events.add(it.event)
      if (it.label !== undefined && (typeof it.label !== 'string' || !it.label.trim())) errors.push(`${at}: event ${it.event} has an empty label`)
      if (!data) continue
      const info = data.event(d.map, it.event)
      if (info === undefined) errors.push(`${at}: map ${d.map} has no event ${it.event}`)
      else if (info === null) errors.push(`${at}: event ${it.event} on map ${d.map} is not an item ball or hidden item`)
    }
  }
  return errors
}

// Card block marks from a def and its events, numbered in def order and made relative to the crop
export const itemCardMarks = (def: ItemCardDef, events: Map<number, ItemEventInfo>, box: { x: number; y: number }, name: (sym: string) => string): ItemCardMark[] =>
  def.items.map((it, i) => {
    const e = events.get(it.event)!
    return { key: String(i + 1), event: e.id, item: e.item, label: it.label ?? name(e.item), hidden: e.hidden, x: e.x - box.x, y: e.y - box.y }
  })

// Image blocks a card folds in carry the card's id; unapply clears it (see scripts/apply-item-maps.ts)
interface ImageLike { type: string; file?: string; itemCard?: string }
export const foldImages = <B extends ImageLike>(blocks: B[], byFile: Map<string, string>): { blocks: B[]; missing: string[] } => {
  const found = new Set<string>()
  const out = blocks.map(b => {
    if (b.type !== 'image') return b
    const { itemCard: _, ...rest } = b
    const card = b.file ? byFile.get(b.file) : undefined
    if (!card) return rest as B
    found.add(b.file!)
    return { ...rest, itemCard: card } as B
  })
  return { blocks: out, missing: [...byFile.keys()].filter(f => !found.has(f)) }
}
