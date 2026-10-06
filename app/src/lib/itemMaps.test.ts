import { describe, expect, it } from 'vitest'
import { assignLetters, cropBox, itemSyms, rankMaps, suggestHiddenMap, type ItemMapCandidate } from './itemMaps'

const ev = (id: number, x: number, y: number, item: string) => ({ id, x, y, item })

const maps: ItemMapCandidate[] = [
  { id: 5, name: 'Route 1', events: [ev(1, 0, 0, 'POTION'), ev(2, 1, 0, 'REPEL')] },
  { id: 37, name: 'Lower Peridot Ward', events: [ev(1, 2, 2, 'POTION'), ev(2, 30, 30, 'REPEL'), ev(3, 3, 2, 'REPEL'), ev(4, 40, 2, 'ANTIDOTE')] },
  { id: 52, name: 'Lower Peridot Alley', events: [ev(1, 0, 0, 'POTION')] }
]
const want = [{ letter: 'A', item: 'POTION' }, { letter: 'B', item: 'REPEL' }]

describe('itemSyms', () => {
  it('looks items up by display name, ignoring case, accents and punctuation', () => {
    const sym = itemSyms({ POKEBALL: { name: 'Poké Ball' }, PARLYZHEAL: { name: 'Paralyze Heal' } })
    expect(sym('Poke Ball')).toBe('POKEBALL')
    expect(sym('paralyze heal')).toBe('PARLYZHEAL')
    expect(sym('Nope')).toBeUndefined()
  })
})

describe('rankMaps', () => {
  it('keeps the maps with the most items, the one named like the section first', () => {
    expect(rankMaps('lower-peridot-ward', want, maps).map(c => c.m.id)).toEqual([37, 5])
  })
  it('skips claimed events', () => {
    expect(rankMaps('route-1', want, maps, new Set(['5:2'])).map(c => c.m.id)).toEqual([37])
  })
})

describe('assignLetters', () => {
  it('picks the tightest cluster when an item appears twice', () => {
    expect(assignLetters(want, maps[1].events)).toEqual({ A: 1, B: 3 })
  })
  it('never reuses an event and leaves out letters the map lacks', () => {
    const two = [{ letter: 'A', item: 'POTION' }, { letter: 'B', item: 'POTION' }, { letter: 'C', item: 'ELIXIR' }]
    expect(assignLetters(two, [ev(1, 0, 0, 'POTION')])).toEqual({ A: 1 })
  })
})

describe('suggestHiddenMap', () => {
  it('uses the located map and only the events inside the screenshot', () => {
    const d = suggestHiddenMap('lower-peridot-ward', want, maps, new Set(), { map: 37, box: [25, 25, 10, 10] })
    expect(d).toEqual({ map: 37, events: { B: 2 } })
  })
  it('falls back to the top-ranked map', () => {
    expect(suggestHiddenMap('lower-peridot-ward', want, maps)?.map).toBe(37)
    expect(suggestHiddenMap('x', [{ letter: 'A', item: 'ELIXIR' }], maps)).toBeNull()
  })
})

describe('cropBox', () => {
  it('pads around the marks and keeps a minimum size inside the map', () => {
    expect(cropBox([[10, 10], [12, 11]], 50, 50)).toEqual({ x: 5, y: 7, w: 12, h: 8 })
    expect(cropBox([[0, 0]], 10, 6)).toEqual({ x: 0, y: 0, w: 10, h: 6 })
  })
})
