import { describe, expect, it } from 'vitest'
import type { Dex } from '../../data/types'
import { buildEntries } from './entries'
import type { SearchIndex } from './indexTypes'
import { isPlace, parentIndex, resultOptions } from './options'
import { entryPlaces } from './places'
import { search, type Hit } from './search'

const idx: SearchIndex = {
  v: 1,
  ch: ['Episode 1: Start', 'Episode 2: Reap'],
  s: [['grand-hall', 'Grand Hall', 0], ['opal-ward', 'Opal Ward', 1]],
  a: ['shop-devon', 'shop-mart'],
  al: ['Devon Corporation', 'Poke Mart'],
  m: [], f: [], t: [], p: [],
  i: [
    ['Potion', 'POTION', [[0, 0, 300], [1, 1, 300]], [1]],
    ['Super Potion', 'SUPERPOTION', [[1, 1, 700]], []]
  ],
  mv: []
}
const groups = search(buildEntries(idx, { species: {} } as unknown as Dex), 'potion')
const placesOf = (h: Hit) => entryPlaces(idx, h.entry)

describe('resultOptions', () => {
  it('lists only hits when nothing is expanded', () => {
    expect(resultOptions(groups, null, placesOf).map(o => o.id)).toEqual(['pal-item-0', 'pal-item-1'])
  })

  it('inserts every location of the expanded hit after it, labelled by episode', () => {
    const opts = resultOptions(groups, 'item-0', placesOf)
    expect(opts.map(o => o.id)).toEqual(['pal-item-0', 'pal-item-0-at-0', 'pal-item-0-at-1', 'pal-item-0-at-2', 'pal-item-1'])
    expect(opts.filter(isPlace).map(o => `${o.place.episode} ${o.place.label}`)).toEqual(['Ep 1 Devon Corporation', 'Ep 2 Poke Mart', 'Ep 2 Opal Ward'])
    expect(parentIndex(opts, 3)).toBe(0)
    expect(parentIndex(opts, 4)).toBe(4)
  })

  it('does not expand a hit with a single location', () => {
    expect(resultOptions(groups, 'item-1', placesOf)).toHaveLength(2)
  })
})
