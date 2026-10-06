import { describe, expect, it } from 'vitest'
import { applyRoutes, markOffset, pathRuns, unapplyRoutes, type RouteBlock, type RouteDef } from './routes'

const prose = (markdown: string) => ({ type: 'prose', markdown })
const task = (markdown: string) => ({ type: 'task', markdown })
const battle = { type: 'battle' }

const def = (over: Partial<RouteDef> = {}): RouteDef => ({
  id: 'name-rater', match: 'Head out', map: 37, points: [{ at: [1, 1], label: 'A' }, { at: [2, 2], label: 'B' }], ...over
})
const block = (id = 'name-rater'): RouteBlock => ({ type: 'route', id, mapName: 'Ward', src: 'maps/x.png', w: 12, h: 8, path: [[1, 1]], marks: [] })

describe('applyRoutes', () => {
  it('inserts the route after the matched paragraph, splitting the prose', () => {
    const r = applyRoutes([prose('Intro.\n\nHead out, and back up.\n\nOutro.'), battle], [{ def: def(), block: block() }])
    expect(r.missing).toEqual([])
    expect(r.blocks).toEqual([prose('Intro.\n\nHead out, and back up.'), block(), prose('Outro.'), battle])
  })

  it('places a route after a task card and its sibling tasks', () => {
    const blocks = [task('Head out to the house.'), task(''), prose('Next.')]
    const r = applyRoutes(blocks, [{ def: def(), block: block() }])
    expect(r.blocks).toEqual([task('Head out to the house.'), task(''), block(), prose('Next.')])
  })

  it('keeps several routes on one paragraph in definition order', () => {
    const r = applyRoutes([prose('Head out.')], [{ def: def({ id: 'a' }), block: block('a') }, { def: def({ id: 'b' }), block: block('b') }])
    expect(r.blocks).toEqual([prose('Head out.'), block('a'), block('b')])
  })

  it('reports routes whose match finds nothing', () => {
    const r = applyRoutes([prose('Nothing here.')], [{ def: def(), block: block() }])
    expect(r.missing.map(d => d.id)).toEqual(['name-rater'])
  })

  it('is idempotent: rerunning replaces earlier inserts', () => {
    const once = applyRoutes([prose('Intro.\n\nHead out.\n\nOutro.')], [{ def: def(), block: block() }]).blocks
    const twice = applyRoutes(once, [{ def: def(), block: block() }]).blocks
    expect(twice).toEqual(once)
  })
})

describe('unapplyRoutes', () => {
  it('drops routes and rejoins the prose they split', () => {
    expect(unapplyRoutes([prose('A.'), block(), prose('B.'), battle])).toEqual([prose('A.\n\nB.'), battle])
  })
})

describe('pathRuns', () => {
  it('breaks the path where it jumps through a warp, keeping diagonal steps joined', () => {
    expect(pathRuns([[0, 0], [1, 0], [5, 5], [6, 6], [6, 7]])).toEqual([[[0, 0], [1, 0]], [[5, 5], [6, 6], [6, 7]]])
  })
})

describe('markOffset', () => {
  it('leaves plain stops alone and slides markers off the person faced', () => {
    expect(markOffset(undefined, 1)).toEqual([0, 0])
    // Person above: their tile starts half a tile up, so a small nudge down clears it
    expect(markOffset([0, -1], 2)).toEqual([0, 16])
    // Person below: their sprite reaches into the stop's tile, so the marker moves a full radius up
    expect(markOffset([0, 1], 1)).toEqual([0, -16])
    expect(markOffset([1, 0], 1)).toEqual([0, 0])
  })
})
