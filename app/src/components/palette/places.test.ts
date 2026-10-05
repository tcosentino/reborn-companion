import { describe, expect, it } from 'vitest'
import type { Dex } from '../../data/types'
import { buildEntries } from './entries'
import type { SearchIndex } from './indexTypes'
import { entryPlaces, findItem, itemPageKey, summarize, tmsFor } from './places'
import { search } from './search'

const idx: SearchIndex = {
  v: 1,
  ch: ['Episode 1: Start', 'Episode 2: Reap', 'Postgame Episode 3: The Umbral Issue'],
  s: [['grand-hall', 'Grand Hall', 0], ['opal-ward', 'Opal Ward', 1], ['railnet', 'Railnet', 2]],
  a: ['shop-devon', 'shop-mart', 'battle-Wayne:StreetRat:0', 'enc-railnet', 'tutor-seventh'],
  al: ['Devon Corporation', 'Poke Mart', '', 'Railnet', 'Seventh Street Tutor'],
  m: ['Cave'],
  f: [],
  t: [['Wayne', 'Street Rat', [0, 2], 2, 16, 16, -1, [0], 0]],
  p: [['KLINK', [[2, 3, 0, 12, 18], [1, 3, 0, 20, 20]], 1, [0, 2]]],
  i: [
    ['Potion', 'POTION', [[0, 0, 300], [1, 1, 300], [2, 1, 300]], [1, 2]],
    ['TM64 Explosion', 'TM64', [[1, 0, 7500]], [], 'EXPLOSION'],
    ['500 Coins', '', [[0, 0, 10000]], []]
  ],
  mv: [['Iron Defense', 'IRONDEFENSE', [[2, 4, 1000]]]]
}
const dex = { species: { KLINK: { name: 'Klink' } } } as unknown as Dex
const entries = buildEntries(idx, dex)
const first = (q: string) => search(entries, q)[0].hits[0].entry

describe('entryPlaces', () => {
  it('lists every shop and find for an item, labelled with its episode', () => {
    const places = entryPlaces(idx, first('potion'))
    expect(places.map(p => [p.kind, p.episode, p.label, p.anchor])).toEqual([
      ['shop', 'Ep 1', 'Devon Corporation', 'shop-devon'],
      ['shop', 'Ep 2', 'Poke Mart', 'shop-mart'],
      ['shop', 'Postgame 3', 'Poke Mart', 'shop-mart'],
      ['found', 'Ep 2', 'Opal Ward', null],
      ['found', 'Postgame 3', 'Railnet', null]
    ])
  })

  it('lists every section a trainer appears in at its battle anchor', () => {
    expect(entryPlaces(idx, first('wayne')).map(p => [p.section, p.anchor])).toEqual([
      ['grand-hall', 'battle-Wayne:StreetRat:0'],
      ['railnet', 'battle-Wayne:StreetRat:0']
    ])
  })

  it('lists catches with method and levels', () => {
    expect(entryPlaces(idx, first('klink')).map(p => [p.episode, p.detail])).toEqual([
      ['Postgame 3', 'Cave, Lv 12–18'],
      ['Ep 2', 'Cave, Lv 20']
    ])
  })

  it('gives sections and moves a single place', () => {
    expect(entryPlaces(idx, first('opal ward'))).toHaveLength(1)
    expect(entryPlaces(idx, first('iron defense'))[0]).toMatchObject({ kind: 'tutor', label: 'Seventh Street Tutor', price: 1000 })
  })
})

describe('item lookups', () => {
  it('finds items by SYM or by name key for unnamed rows', () => {
    expect(itemPageKey(idx.i[2])).toBe('500coins')
    expect(findItem(idx, '500coins')?.[0]).toBe('500 Coins')
    expect(findItem(idx, 'POTION')?.[0]).toBe('Potion')
    expect(findItem(idx, 'NOPE')).toBeUndefined()
  })

  it('finds the TMs that teach a move, and puts TM items under the move scope', () => {
    expect(tmsFor(idx, 'EXPLOSION').map(r => r[1])).toEqual(['TM64'])
    expect(search(entries, 'm: explosion').map(g => g.kind)).toEqual(['item'])
  })
})

describe('summarize', () => {
  it('shows the first places with prices, dedupes repeated shops and counts the rest', () => {
    const places = entryPlaces(idx, first('potion'))
    expect(summarize(places)).toBe('Sold at Devon Corporation ($300), Poke Mart ($300), +2 more')
    expect(summarize(places, 5)).toBe('Sold at Devon Corporation ($300), Poke Mart ($300), Found in Opal Ward, Railnet')
  })
})
