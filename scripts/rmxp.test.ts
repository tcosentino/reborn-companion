import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultPage, findPath, tilePassable, walker, type GameMap, type Tileset } from './rmxp.ts'
import { resolveRoute, validateRouteDefs } from './apply-routes.ts'
import { blank, draw, readPng, writePng } from './png-rgba.ts'

// Tiles: 384 floor, 385 wall (all directions blocked), 386 fence that blocks leaving/entering upward
const tileset: Tileset = { name: 't', tileset: 't', autotiles: [], passages: [], priorities: [] }
tileset.passages[385] = 0x0f
tileset.passages[386] = 0x08
const mapOf = (rows: string[], events: GameMap['events'] = []): GameMap => {
  const width = rows[0].length, height = rows.length
  const data = new Array(width * height * 3).fill(0)
  rows.forEach((r, y) => [...r].forEach((c, x) => { data[x + y * width] = c === '#' ? 385 : c === '^' ? 386 : 384 }))
  return { id: 1, name: 'm', tileset: 1, width, height, layers: 3, data, events }
}

test('tilePassable honours walls and direction bits', () => {
  const m = mapOf(['.#^'])
  assert.equal(tilePassable(m, tileset, 0, 0, 1), true)
  assert.equal(tilePassable(m, tileset, 1, 0, 1), false)
  assert.equal(tilePassable(m, tileset, 2, 0, 8), false)
  assert.equal(tilePassable(m, tileset, 2, 0, 1), true)
  assert.equal(tilePassable(m, tileset, 3, 0, 1), false)
})

test('findPath walks around walls and prefers fewer turns', () => {
  const m = mapOf([
    '.....',
    '.###.',
    '.....'
  ])
  const path = findPath(walker(m, tileset), 5, 3, [0, 0], [4, 2])!
  assert.equal(path.length, 7)
  const turns = path.slice(2).filter((p, i) => (p[0] - path[i + 1][0]) !== (path[i + 1][0] - path[i][0])).length
  assert.equal(turns, 1)
})

test('findPath may start and end on blocked tiles (doors, NPCs) but not cross them', () => {
  const m = mapOf(['#..#'])
  assert.deepEqual(findPath(walker(m, tileset), 4, 1, [0, 0], [3, 0]), [[0, 0], [1, 0], [2, 0], [3, 0]])
  assert.equal(findPath(walker(mapOf(['.#.']), tileset), 3, 1, [0, 0], [2, 0]), null)
})

test('solid NPCs block the path unless hidden', () => {
  const npc = { id: 7, name: 'n', x: 1, y: 0, pages: [{ cond: false, through: false, trigger: 0, char: 'trchar001' }] }
  const m = mapOf(['...'], [npc])
  assert.equal(findPath(walker(m, tileset), 3, 1, [0, 0], [2, 0]), null)
  assert.ok(findPath(walker(m, tileset, new Set([7])), 3, 1, [0, 0], [2, 0]))
})

test('defaultPage is the last unconditional page', () => {
  const p = (cond: boolean, char?: string) => ({ cond, through: false, trigger: 0, char })
  assert.equal(defaultPage({ id: 1, name: '', x: 0, y: 0, pages: [p(false, 'a'), p(false, 'b'), p(true, 'c')] })?.char, 'b')
  assert.equal(defaultPage({ id: 1, name: '', x: 0, y: 0, pages: [p(true, 'a')] }), null)
})

test('resolveRoute crops around the path with padding and reports unreachable points', () => {
  const m = mapOf(Array(30).fill('.'.repeat(40)))
  const r = resolveRoute({ id: 'r', match: 'x', map: 1, points: [{ at: [10, 10], label: 'A' }, { at: [20, 12], label: 'B' }] }, m, tileset)
  assert.ok(typeof r !== 'string')
  assert.deepEqual(r.box, { x: 6, y: 6, w: 19, h: 11 })
  const walled = mapOf(['.#.'])
  assert.match(resolveRoute({ id: 'r', match: 'x', map: 1, points: [{ at: [0, 0], label: 'A' }, { at: [2, 0], label: 'B' }] }, walled, tileset) as string, /no walkable path/)
})

test('validateRouteDefs checks ids, maps and points', () => {
  const ok = { id: 'a', match: 'M', map: 1, points: [{ at: [0, 0] as [number, number], label: 'A' }, { at: [1, 1] as [number, number], label: 'B' }] }
  assert.deepEqual(validateRouteDefs('s', [ok], { 1: { name: 'm', parent: 0 } }), [])
  const errors = validateRouteDefs('s', [{ ...ok, id: 'Bad' }, { ...ok, map: 2 }, { ...ok, id: 'c', points: [ok.points[0]] }], { 1: { name: 'm', parent: 0 } })
  assert.equal(errors.length, 3)
})

test('png round trip and additive blending', () => {
  const img = blank(2, 1, [10, 20, 30, 255])
  const glow = blank(1, 1, [100, 100, 100, 255])
  draw(img, glow, 0, 0, 1, 1, 1, 0, 255, 'add')
  const back = readPng(writePng(img))
  assert.deepEqual([...back.px], [10, 20, 30, 255, 110, 120, 130, 255])
})

test('findPath follows doors that warp within the same map', () => {
  const door = { id: 3, name: 'd', x: 1, y: 0, pages: [{ cond: false, through: false, trigger: 1, warp: { map: 1, x: 2, y: 2 } }] }
  const m = mapOf(['..#', '###', '...'], [door])
  assert.deepEqual(findPath(walker(m, tileset), 3, 3, [0, 0], [0, 2]), [[0, 0], [1, 0], [2, 2], [1, 2], [0, 2]])
})

test('direct points draw a straight line instead of walking', () => {
  const m = mapOf(['.#.', '.#.', '.#.'])
  const r = resolveRoute({ id: 'r', match: 'x', map: 1, points: [{ at: [0, 0], label: 'A' }, { at: [2, 2], label: 'B', direct: true }] }, m, tileset)
  assert.ok(typeof r !== 'string')
  assert.deepEqual(r.path, [[0, 0], [1, 1], [2, 2]])
})

test('ledges are jumped in the direction walked, and the ledge tile stays in the path', () => {
  const ts: Tileset = { ...tileset, passages: [...tileset.passages], terrain: [] }
  ts.passages[387] = 0x0f
  ts.terrain![387] = 1
  const m = mapOf(['.', '.', '.'])
  m.data[0 + 1 * 1] = 387
  assert.deepEqual(findPath(walker(m, ts), 1, 3, [0, 0], [0, 2]), [[0, 0], [0, 1], [0, 2]])
})

test('surfing makes water walkable; tile events use their own passability', () => {
  const ts: Tileset = { ...tileset, passages: [...tileset.passages], terrain: [] }
  ts.passages[388] = 0x0f
  ts.terrain![388] = 7
  const m = mapOf(['...'])
  m.data[1] = 388
  assert.equal(findPath(walker(m, ts), 3, 1, [0, 0], [2, 0]), null)
  assert.ok(findPath(walker(m, ts, { surf: true }), 3, 1, [0, 0], [2, 0]))
  // A floor tile event (bridge piece) over the water is walkable
  const bridge = { id: 9, name: 'b', x: 1, y: 0, pages: [{ cond: false, through: false, trigger: 0, tile: 384 }] }
  assert.ok(findPath(walker({ ...m, events: [bridge] }, ts), 3, 1, [0, 0], [2, 0]))
})

test('warps to other maps block the path unless they are its end', () => {
  const vortex = { id: 4, name: 'v', x: 1, y: 0, pages: [{ cond: false, through: true, trigger: 1, warp: { map: 99, x: 0, y: 0 } }] }
  const m = mapOf(['...', '...'], [vortex])
  assert.deepEqual(findPath(walker(m, tileset), 3, 2, [0, 0], [2, 0]), [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]])
  assert.deepEqual(findPath(walker(m, tileset), 3, 2, [0, 0], [1, 0]), [[0, 0], [1, 0]])
})
