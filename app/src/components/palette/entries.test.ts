import { describe, expect, it } from 'vitest'
import type { Dex } from '../../data/types'
import { buildEntries, chapterShort, targetOf } from './entries'
import type { SearchIndex } from './indexTypes'
import { search } from './search'

const idx: SearchIndex = {
  v: 1,
  ch: ["Episode 2: Reap What's Been Sewn", 'Postgame Episode 3: The Umbral Issue', 'Appendices'],
  s: [['obsidia-ward', 'Obsidia Ward', 0], ['railnet', 'Railnet', 0]],
  a: ['battle-Wayne:StreetRat:0', 'enc-railnet', 'shop-devon'],
  m: ['Cave'],
  f: [],
  t: [['Wayne', 'Street Rat', [0], 0, 16, 16, -1, [1], 0]],
  p: [['KLINK', [[1, 1, 0, 12, 18]], 0, [1, 1]], ['PIDGEY', [], 1, [0, 0]], ['MEW', [], 0, null]],
  i: [['Potion', 'POTION', [[0, 2, 300]], [1]], ['Steel Gem', 'STEELGEM', [], [1]]],
  mv: [['Iron Defense', 'IRONDEFENSE', [[1, -1, 1000]]]]
}
const dex = { species: { KLINK: { name: 'Klink' }, PIDGEY: { name: 'Pidgey' }, MEW: { name: 'Mew' } } } as unknown as Dex
const entries = buildEntries(idx, dex)
const first = (q: string) => search(entries, q)[0].hits[0].entry

describe('chapterShort', () => {
  it('shortens episode titles', () => {
    expect(idx.ch.map(chapterShort)).toEqual(['Ep 2', 'Postgame 3', 'Appendices'])
  })
})

describe('targetOf', () => {
  it('sends trainers to their battle block', () => {
    expect(targetOf(idx, first('wayne'))).toEqual({ section: 'obsidia-ward', anchor: 'battle-Wayne:StreetRat:0' })
  })
  it('sends species to the first place they can be caught, else first appearance', () => {
    expect(targetOf(idx, first('klink'))).toEqual({ section: 'railnet', anchor: 'enc-railnet' })
    expect(targetOf(idx, first('pidgey'))).toEqual({ section: 'obsidia-ward', anchor: 'battle-Wayne:StreetRat:0' })
    expect(targetOf(idx, first('mew'))).toBeNull()
  })
  it('sends items to a shop, else where they are found', () => {
    expect(targetOf(idx, first('potion'))).toEqual({ section: 'obsidia-ward', anchor: 'shop-devon' })
    expect(targetOf(idx, first('steel gem'))).toEqual({ section: 'railnet', anchor: null })
  })
  it('sends sections to the top and moves to their tutor', () => {
    expect(targetOf(idx, first('obsidia'))).toEqual({ section: 'obsidia-ward', anchor: null })
    expect(targetOf(idx, first('iron def'))).toEqual({ section: 'railnet', anchor: null })
  })
})
