// Map finder for authoring routes/<game>/*.json. Needs scripts/build-maps.sh.
//
//   node scripts/maps.ts <game> names <text>             maps whose name contains text
//   node scripts/maps.ts <game> find <text> [mapId...]   events whose dialogue or name contains text
//   node scripts/maps.ts <game> map <id>                 doors/warps, NPCs, signs and items on a map
//   node scripts/maps.ts <game> grid <id> [x,y,w,h]      PNG of the map (or a box) with a coordinate grid
//   node scripts/maps.ts <game> preview <section> [id]   PNG of a section's routes as built, with grid
//   node scripts/maps.ts <game> section <section>        the section's paragraphs, plus map ids of its encounter tables
//   node scripts/maps.ts <game> check <section>          validate routes/<game>/<section>.json without building
//   node scripts/maps.ts <game> reach <id> <x,y> [x,y,w,h] [hide,ids] [--surf]  ASCII of tiles walkable from x,y
//                                                         (. reachable, # not, e/E event, W warp, @ start)
//   node scripts/maps.ts <game> items <id> [x,y,w,h]     item events (hidden items, item balls) + PNG labelled by event id
//   node scripts/maps.ts <game> items-check <section>    validate item-maps/<game>/<section>.json without building
//   node scripts/maps.ts <game> items-preview <section> [id]  PNG of a section's item map cards as built, with grid
//
// PNGs go to out/map-previews/; the path is printed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RouteDef, Tile } from '../app/src/lib/routes.ts'
import { itemEventInfo, validateItemCardDefs, type ItemCardDef, type ItemEventInfo } from '../app/src/lib/itemMaps.ts'
import { cardBox, mapData } from './apply-item-maps.ts'
import { resolveRoute, validateRouteDefs } from './apply-routes.ts'
import { blank, draw, writePng, type Rgba } from './png-rgba.ts'
import {
  assetsDir, defaultPage, imageLoader, reachable, visibleEvents, walker, loadIndex, loadMap, loadTilesets, mapsDir, renderMap,
  type Box, type GameMap
} from './rmxp.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [game, cmd, ...args] = process.argv.slice(2)
const dir = mapsDir(ROOT, game ?? '')
const outDir = join(ROOT, 'out/map-previews')

const usage = () => {
  console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(2, 16).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
  process.exit(2)
}
if (!game || !cmd) usage()

const index = loadIndex(dir)
const name = (id: number) => index[id]?.name ?? `?${id}`
const allMaps = () => Object.keys(index).map(Number).flatMap(id => { try { return [loadMap(dir, id)] } catch { return [] } })
const snip = (t = '', n = 110) => (t.length > n ? `${t.slice(0, n)}...` : t)

// 3x5 pixel digits for grid labels
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111']
const label = (img: Rgba, text: string, x: number, y: number, s = 2) => {
  const w = text.length * 4 * s + s, h = 5 * s + 2 * s
  const bg = blank(w, h, [0, 0, 0, 200])
  draw(img, bg, 0, 0, w, h, x, y)
  ;[...text].forEach((ch, i) => {
    const bits = DIGITS[Number(ch)]
    if (!bits) return
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      if (bits[r * 3 + c] !== '1') continue
      for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
        const px = x + s + (i * 4 + c) * s + xx, py = y + s + r * s + yy
        if (px >= 0 && py >= 0 && px < img.w && py < img.h) img.px.set([255, 255, 255, 255], (py * img.w + px) * 4)
      }
    }
  })
}
const fillRect = (img: Rgba, x: number, y: number, w: number, h: number, rgba: number[]) => {
  for (let yy = Math.max(0, y); yy < Math.min(img.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(img.w, x + w); xx++) {
    const o = (yy * img.w + xx) * 4, a = rgba[3] / 255
    for (let c = 0; c < 3; c++) img.px[o + c] = Math.round(rgba[c] * a + img.px[o + c] * (1 - a))
  }
}
// Grid every tile (faint) and every 5 tiles (strong), labelled with absolute map coordinates
const grid = (img: Rgba, box: Box) => {
  for (let i = 0; i <= box.w; i++) fillRect(img, i * 32, 0, (box.x + i) % 5 ? 1 : 2, img.h, (box.x + i) % 5 ? [255, 255, 255, 50] : [255, 255, 0, 150])
  for (let j = 0; j <= box.h; j++) fillRect(img, 0, j * 32, img.w, (box.y + j) % 5 ? 1 : 2, (box.y + j) % 5 ? [255, 255, 255, 50] : [255, 255, 0, 150])
  for (let i = 0; i < box.w; i++) if ((box.x + i) % 5 === 0) for (let j = 0; j < box.h; j += 5) label(img, String(box.x + i), i * 32 + 2, j * 32 + 2)
  for (let j = 0; j < box.h; j++) if ((box.y + j) % 5 === 0) for (let i = 2; i < box.w; i += 5) label(img, String(box.y + j), i * 32 + 2, j * 32 + 18)
}
const pathOverlay = (img: Rgba, path: Tile[], box: Box) => {
  path.forEach(([x, y], i) => {
    const cx = (x - box.x) * 32 + 16, cy = (y - box.y) * 32 + 16
    fillRect(img, cx - 4, cy - 4, 8, 8, [255, 214, 10, 255])
    const next = path[i + 1]
    if (!next || Math.max(Math.abs(next[0] - x), Math.abs(next[1] - y)) > 1) return
    if (next[0] !== x && next[1] !== y) {
      // Diagonal step (direct points): a short staircase of squares
      for (let k = 1; k < 8; k++) fillRect(img, cx + ((next[0] - x) * 32 * k) / 8 - 3, cy + ((next[1] - y) * 32 * k) / 8 - 3, 6, 6, [255, 214, 10, 255])
      return
    }
    const nx = (next[0] - box.x) * 32 + 16, ny = (next[1] - box.y) * 32 + 16
    fillRect(img, Math.min(cx, nx) - 3, Math.min(cy, ny) - 3, Math.abs(nx - cx) + 6, Math.abs(ny - cy) + 6, [255, 214, 10, 255])
  })
}
// A filled square on a tile with a number in it (event id or marker number)
const tileMarker = (img: Rgba, box: Box, x: number, y: number, text: string, rgb: number[]) => {
  const px = (x - box.x) * 32, py = (y - box.y) * 32
  fillRect(img, px + 1, py + 1, 30, 30, [...rgb, 230])
  label(img, text, px + Math.max(0, Math.round((32 - (text.length * 8 + 2)) / 2)), py + 9)
}
const HIDDEN_RGB = [220, 38, 38], BALL_RGB = [37, 99, 235]

const save = (file: string, img: Rgba) => {
  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, file)
  writeFileSync(path, writePng(img))
  console.log(path)
}

// Shown by default but a later conditional page has no graphic: a story actor that leaves at some point
const vanishes = (e: GameMap['events'][number]) => {
  const p = defaultPage(e)
  return !!p && !!(p.char || p.tile) && e.pages.some(pg => pg.cond && !pg.char && !pg.tile)
}

const describe = (m: GameMap) => {
  console.log(`map ${m.id} "${m.name}" ${m.width}x${m.height} (parent: ${name(index[m.id]?.parent)})`)
  for (const e of m.events) {
    const p = defaultPage(e) ?? e.pages[0]
    const warp = e.pages.find(pg => pg.warp)?.warp
    const text = e.pages.map(pg => pg.text).find(Boolean)
    const kind = warp ? `door -> map ${warp.map} "${name(warp.map)}" (${warp.x},${warp.y})`
      : p.char?.startsWith('trchar') || p.char?.startsWith('NPC') ? `npc ${p.char}`
      : p.char ? `obj ${p.char}` : p.tile ? 'tile-object' : 'invisible'
    if (!warp && !text && !p.char && !p.tile) continue
    console.log(`  ev${e.id} (${e.x},${e.y}) ${kind}${p.through ? ' [through]' : ''}${e.pages.every(pg => pg.cond) ? ' [conditional]' : ''}${vanishes(e) ? ' [vanishes later: hide if gone by now]' : ''}${text ? `: ${snip(text)}` : ''}`)
  }
}

const parseBox = (s: string | undefined, m: GameMap): Box => {
  if (!s) return { x: 0, y: 0, w: m.width, h: m.height }
  const [x, y, w, h] = s.split(',').map(Number)
  return { x, y, w: Math.min(w, m.width - x), h: Math.min(h, m.height - y) }
}

interface SectionJson { id?: string; title: string; blocks: { type: string; markdown?: string; mapId?: number; name?: string; file?: string; id?: string }[] }
const paragraphs = (md: string) => md.split('\n\n').map(p => p.trim()).filter(Boolean)
// Sections from the synced guide data (app/public/data), which already has tasks split out
const findSection = (id: string): SectionJson => {
  const data = join(ROOT, 'app/public/data', game)
  const guide = JSON.parse(readFileSync(join(data, 'index.json'), 'utf8')) as { chapters: { id: string; file: string }[] }
  for (const c of guide.chapters) {
    const ch = JSON.parse(readFileSync(join(data, c.file), 'utf8')) as { sections: SectionJson[] }
    const sec = ch.sections.find(s => (s.id ?? c.id) === id)
    if (sec) return sec
  }
  throw new Error(`no section ${id}`)
}

const load = imageLoader(assetsDir(ROOT, game))
const tilesets = loadTilesets(dir)

switch (cmd) {
  case 'names': {
    const q = args.join(' ').toLowerCase()
    Object.entries(index).filter(([, i]) => i.name.toLowerCase().includes(q)).forEach(([id, i]) => console.log(`${id}\t${i.name}\t(parent ${i.parent} ${name(i.parent)})`))
    break
  }
  case 'find': {
    const [text, ...ids] = args
    const q = text.toLowerCase()
    const maps = ids.length ? ids.map(id => loadMap(dir, Number(id))) : allMaps()
    for (const m of maps) for (const e of m.events) {
      const hit = e.pages.find(p => p.text?.toLowerCase().includes(q) || p.choices?.some(c => c.toLowerCase().includes(q)))
      if (hit || e.name.toLowerCase().includes(q)) console.log(`map ${m.id} "${m.name}" ev${e.id} (${e.x},${e.y}): ${snip(hit?.text ?? e.name, 160)}`)
    }
    break
  }
  case 'map': describe(loadMap(dir, Number(args[0]))); break
  case 'grid': {
    const m = loadMap(dir, Number(args[0]))
    const box = parseBox(args[1], m)
    const img = renderMap(m, tilesets[m.tileset], load, box)
    grid(img, box)
    save(`map${m.id}${args[1] ? `-${args[1].replaceAll(',', '_')}` : ''}.png`, img)
    break
  }
  case 'preview': {
    const [section, only] = args
    if (!section) usage()
    const defs: RouteDef[] = JSON.parse(readFileSync(join(ROOT, 'routes', game, `${section}.json`), 'utf8'))
    for (const def of defs.filter(d => !only || d.id === only)) {
      const m = loadMap(dir, def.map)
      const r = resolveRoute(def, m, tilesets[m.tileset])
      if (typeof r === 'string') { console.error(`${def.id}: ${r}`); process.exitCode = 1; continue }
      const img = renderMap(m, tilesets[m.tileset], load, r.box, new Set(def.hide ?? []))
      grid(img, r.box)
      pathOverlay(img, r.path, r.box)
      def.points.forEach((p, i) => { if (!p.via) fillRect(img, (r.stops[i].at[0] - r.box.x) * 32 + 6, (r.stops[i].at[1] - r.box.y) * 32 + 6, 20, 20, [220, 38, 38, 255]) })
      console.log(`${def.id}: ${r.path.length - 1} steps, box ${JSON.stringify(r.box)}`)
      save(`${section}--${def.id}.png`, img)
    }
    break
  }
  case 'section': {
    const sec = findSection(args[0])
    console.log(`# ${sec.title}`)
    for (const b of sec.blocks) {
      if (b.type === 'prose' || (b.type === 'task' && b.markdown)) paragraphs(b.markdown!).forEach(p => console.log(`\n[para] ${p}`))
      else if (b.type === 'encounters') console.log(`\n[encounters map ${b.mapId}: ${b.name}]`)
      else if (b.type === 'battle') console.log(`\n[battle]`)
      else if (b.type === 'image') console.log(`\n[guide image ${b.file}]`)
      else if (b.type === 'route') console.log(`\n[route ${b.id}]`)
      else if (b.type === 'itemMap') console.log(`\n[item map ${b.id}]`)
    }
    break
  }
  case 'check': {
    const section = args[0]
    if (!section) usage()
    const defs: RouteDef[] = JSON.parse(readFileSync(join(ROOT, 'routes', game, `${section}.json`), 'utf8'))
    const errors = validateRouteDefs(section, defs, index)
    const paras = findSection(section).blocks.flatMap(b => b.markdown && (b.type === 'prose' || b.type === 'task') ? paragraphs(b.markdown) : [])
    for (const d of defs) {
      if (!paras.some(p => p.startsWith(d.match.trim()))) errors.push(`${section}/${d.id}: no paragraph starts with "${d.match}"`)
      if (index[d.map] && Array.isArray(d.points) && d.points.length > 1) {
        const m = loadMap(dir, d.map)
        const r = resolveRoute(d, m, tilesets[m.tileset])
        if (typeof r === 'string') errors.push(`${section}/${d.id}: ${r}`)
      }
    }
    errors.forEach(e => console.error(e))
    console.log(errors.length ? `${errors.length} problem(s)` : `ok: ${defs.length} route(s)`)
    if (errors.length) process.exitCode = 1
    break
  }
  case 'items': {
    const m = loadMap(dir, Number(args[0]))
    const items = m.events.map(itemEventInfo).filter((e): e is ItemEventInfo => !!e)
    console.log(`map ${m.id} "${m.name}" ${m.width}x${m.height}: ${items.length} item event(s)`)
    for (const e of items) {
      const ev = m.events.find(x => x.id === e.id)!
      console.log(`  ev${e.id}\t(${e.x},${e.y})\t${e.hidden ? 'hidden' : 'ball  '}\t${e.item}${ev.pages.every(p => p.cond) ? ' [conditional]' : ''}`)
    }
    if (!items.length) break
    // Around the items unless a box is given; red squares are hidden items, blue ones item balls, labelled by event id
    const xs = items.map(e => e.x), ys = items.map(e => e.y)
    const box = args[1] ? parseBox(args[1], m) : {
      x: Math.max(0, Math.min(...xs) - 3), y: Math.max(0, Math.min(...ys) - 3),
      w: Math.min(m.width, Math.max(...xs) + 4) - Math.max(0, Math.min(...xs) - 3), h: Math.min(m.height, Math.max(...ys) + 4) - Math.max(0, Math.min(...ys) - 3)
    }
    const img = renderMap(m, tilesets[m.tileset], load, box)
    grid(img, box)
    items.filter(e => e.x >= box.x && e.y >= box.y && e.x < box.x + box.w && e.y < box.y + box.h)
      .forEach(e => tileMarker(img, box, e.x, e.y, String(e.id), e.hidden ? HIDDEN_RGB : BALL_RGB))
    save(`items-map${m.id}${args[1] ? `-${args[1].replaceAll(',', '_')}` : ''}.png`, img)
    break
  }
  case 'items-check':
  case 'items-preview': {
    const [section, only] = args
    if (!section) usage()
    const defs: ItemCardDef[] = JSON.parse(readFileSync(join(ROOT, 'item-maps', game, `${section}.json`), 'utf8'))
    const data = mapData(dir)
    const errors = validateItemCardDefs(section, defs, data)
    if (cmd === 'items-check') {
      const sec = findSection(section)
      const paras = sec.blocks.flatMap(b => b.markdown && (b.type === 'prose' || b.type === 'task') ? paragraphs(b.markdown) : [])
      const images = new Set(sec.blocks.flatMap(b => b.type === 'image' && b.file ? [b.file] : []))
      for (const d of Array.isArray(defs) ? defs : []) {
        if (typeof d.match === 'string' && !paras.some(p => p.startsWith(d.match.trim()))) errors.push(`${section}/${d.id}: no paragraph starts with "${d.match}"`)
        if (d.image && !images.has(d.image)) errors.push(`${section}/${d.id}: no guide image ${d.image} in this section`)
      }
      errors.forEach(e => console.error(e))
      console.log(errors.length ? `${errors.length} problem(s)` : `ok: ${defs.length} item map card(s), ${defs.reduce((n, d) => n + d.items.length, 0)} item(s)`)
      if (errors.length) process.exitCode = 1
      break
    }
    if (errors.length) { errors.forEach(e => console.error(e)); process.exitCode = 1; break }
    for (const def of defs.filter(d => !only || d.id === only)) {
      const { map: m, events } = data.get(def.map)
      const box = cardBox(def, m, events)
      const img = renderMap(m, tilesets[m.tileset], load, box)
      grid(img, box)
      def.items.forEach((it, i) => {
        const e = events.get(it.event)!
        tileMarker(img, box, e.x, e.y, String(i + 1), e.hidden ? HIDDEN_RGB : BALL_RGB)
        console.log(`  ${i + 1}. ev${e.id} (${e.x},${e.y}) ${e.hidden ? 'hidden' : 'ball'} ${e.item}${it.label ? ` "${it.label}"` : ''}`)
      })
      console.log(`${def.id}: map ${m.id} "${m.name}", box ${JSON.stringify(box)}`)
      save(`items-${section}--${def.id}.png`, img)
    }
    break
  }
  case 'reach': {
    const m = loadMap(dir, Number(args[0]))
    const [sx, sy] = args[1].split(',').map(Number)
    const box = parseBox(args[2], m)
    const hide = new Set((args[3] && args[3] !== '--surf' ? args[3] : '').split(',').filter(Boolean).map(Number))
    const w = walker(m, tilesets[m.tileset], { hide, surf: args.includes('--surf') })
    const seen = reachable(w, m.width, m.height, [sx, sy])
    const ev = new Set(visibleEvents(m, hide).map(({ e }) => `${e.x},${e.y}`))
    const rows = [`     ${Array.from({ length: box.w }, (_, i) => String((box.x + i) % 10)).join('')}`]
    for (let y = box.y; y < box.y + box.h; y++) {
      let row = `${String(y).padStart(4)} `
      for (let x = box.x; x < box.x + box.w; x++) {
        const k = `${x},${y}`
        row += x === sx && y === sy ? '@' : w.warps?.has(k) ? 'W' : ev.has(k) ? (seen.has(k) ? 'E' : 'e') : seen.has(k) ? '.' : '#'
      }
      rows.push(row)
    }
    console.log(rows.join('\n'))
    break
  }
  default: usage()
}
