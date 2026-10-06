import { describe, expect, it } from 'vitest'
import {
  assignLetters, cropBox, foldImages, itemCardIds, itemCardMarks, itemCheckId, itemEventInfo, itemSyms, rankMaps, suggestHiddenMap,
  validateItemCardDefs, type ItemCardBlock, type ItemCardDef, type ItemEventInfo, type ItemMapCandidate
} from './itemMaps'
import { insertAfterParagraphs } from './routes'

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

describe('item map cards', () => {
  const info = (id: number, x: number, y: number, item: string, hidden = true): ItemEventInfo => ({ id, x, y, item, hidden })
  const events = new Map<number, ItemEventInfo | null>([[3, info(3, 10, 5, 'POTION')], [4, info(4, 12, 9, 'GREATBALL', false)], [5, null]])
  const data = { hasMap: (id: number) => id === 7, event: (_: number, id: number) => events.has(id) ? events.get(id) ?? null : undefined }
  const card: ItemCardDef = { id: 'north', match: 'Head up.', map: 7, items: [{ event: 4 }, { event: 3, label: 'Potion (behind the rock)' }] }

  it('reads hidden vs visible items from the event pages', () => {
    expect(itemEventInfo({ id: 1, x: 0, y: 0, pages: [{ char: 'NPC 01' }, { item: 'POTION' }] })).toEqual(info(1, 0, 0, 'POTION'))
    expect(itemEventInfo({ id: 2, x: 0, y: 0, pages: [{ item: 'REPEL', char: 'itemball' }] })?.hidden).toBe(false)
    expect(itemEventInfo({ id: 3, x: 0, y: 0, pages: [{ char: 'NPC 01' }] })).toBeNull()
  })

  it('accepts a valid card', () => {
    expect(validateItemCardDefs('s', [card], data)).toEqual([])
  })

  it('rejects unknown maps, unknown events, non-item events and bad shapes', () => {
    expect(validateItemCardDefs('s', [{ ...card, map: 8 }], data)).toEqual(['s/north: no map 8'])
    expect(validateItemCardDefs('s', [{ ...card, items: [{ event: 9 }] }], data)).toEqual(['s/north: map 7 has no event 9'])
    expect(validateItemCardDefs('s', [{ ...card, items: [{ event: 5 }] }], data)).toEqual(['s/north: event 5 on map 7 is not an item ball or hidden item'])
    expect(validateItemCardDefs('s', [{ ...card, items: [{ event: 3 }, { event: 3 }] }], data)).toEqual(['s/north: event 3 is listed twice'])
    expect(validateItemCardDefs('s', [card, { ...card, id: 'North' }, card])).toEqual(['s: bad card id "North"', 's: duplicate card id "north"'])
    expect(validateItemCardDefs('s', [{ ...card, match: ' ', image: 'hidden012.png' }])).toHaveLength(2)
  })

  it('numbers marks in file order, relative to the crop, labelled by item name unless overridden', () => {
    const marks = itemCardMarks(card, events as Map<number, ItemEventInfo>, { x: 8, y: 4 }, sym => sym === 'GREATBALL' ? 'Great Ball' : sym)
    expect(marks).toEqual([
      { key: '1', event: 4, item: 'GREATBALL', label: 'Great Ball', hidden: false, x: 4, y: 5 },
      { key: '2', event: 3, item: 'POTION', label: 'Potion (behind the rock)', hidden: true, x: 2, y: 1 }
    ])
  })

  const block = (id: string, evs: number[]): ItemCardBlock => ({
    type: 'itemMap', id, section: 'jungle', mapName: 'Jungle', src: 'x.png', w: 12, h: 8,
    marks: evs.map((event, i) => ({ key: String(i + 1), event, item: 'POTION', label: 'Potion', hidden: true, x: 0, y: 0 }))
  })

  it('checkbox ids are section, card and event', () => {
    expect(itemCheckId('jungle', 'north', 4)).toBe('item:jungle/north/4')
    expect(itemCardIds([{ type: 'prose' }, block('north', [4, 3]), block('south', [9])])).toEqual(['item:jungle/north/4', 'item:jungle/north/3', 'item:jungle/south/9'])
  })

  it('goes after its paragraph and is idempotent', () => {
    const prose = [{ type: 'prose', markdown: 'Intro.\n\nHead up. Grab a *Potion*.\n\nLater.' }]
    const once = insertAfterParagraphs(prose, [{ def: card, block: block('north', [3]) }], 'itemMap')
    expect(once.missing).toEqual([])
    expect(once.blocks.map(b => b.type)).toEqual(['prose', 'itemMap', 'prose'])
    const twice = insertAfterParagraphs(once.blocks, [{ def: card, block: block('north', [3]) }], 'itemMap')
    expect(twice.blocks).toEqual(once.blocks)
    expect(insertAfterParagraphs(prose, [{ def: { ...card, match: 'Nope' }, block: block('north', [3]) }], 'itemMap').missing).toHaveLength(1)
  })

  it('folds named screenshots into their card and unfolds the rest', () => {
    const blocks = [{ type: 'image', file: 'a.png', itemCard: 'old' }, { type: 'image', file: 'b.png' }]
    const r = foldImages(blocks, new Map([['b.png', 'north'], ['c.png', 'south']]))
    expect(r.blocks).toEqual([{ type: 'image', file: 'a.png' }, { type: 'image', file: 'b.png', itemCard: 'north' }])
    expect(r.missing).toEqual(['c.png'])
  })
})
