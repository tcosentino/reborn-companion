import { describe, expect, it } from 'vitest'
import type { Evolution, Pokedex } from '../data/types'
import { describeEvolution } from './evolution'
import { descendants, preEvolutionMap } from './ranking'
import { compareHref, dexHref, parseCompare, parseHash } from './route'
import { leaders, multLabel } from './compare'

const mon = (name: string, total: number, evolutions: Evolution[] = []) => ({
  name, num: 0, catchRate: 45, kind: '', locations: [],
  forms: { '0': { name: 'Normal Form', types: ['NORMAL'], baseStats: [total, 0, 0, 0, 0, 0], abilities: [], evolutions } }
})

const dex: Pokedex = {
  species: {
    GASTLY: mon('Gastly', 310, [{ species: 'HAUNTER', method: 'Level', parameter: 25 }]),
    HAUNTER: mon('Haunter', 405, [{ species: 'GENGAR', method: 'Trade', parameter: null }]),
    GENGAR: mon('Gengar', 500),
    EEVEE: mon('Eevee', 325, [
      { species: 'VAPOREON', method: 'Item', parameter: 'WATERSTONE' },
      { species: 'ESPEON', method: 'HappinessDay', parameter: 0 }
    ]),
    VAPOREON: mon('Vaporeon', 525),
    ESPEON: mon('Espeon', 525),
    SENTRET: mon('Sentret', 215, [{ species: 'FURRET', method: 'Level', parameter: 15 }]),
    FURRET: mon('Furret', 415),
    MANKEY: mon('Mankey', 305, [{ species: 'PRIMEAPE', method: 'Level', parameter: 28 }]),
    PRIMEAPE: mon('Primeape', 455, [{ species: 'ANNIHILAPE', method: 'HasMove', parameter: 'RAGEFIST' }]),
    ANNIHILAPE: mon('Annihilape', 535)
  },
  abilities: {},
  names: { WATERSTONE: 'Water Stone', RAGEFIST: 'Rage Fist' }
}

describe('ranking', () => {
  it('walks every evolution branch', () => {
    expect(descendants(dex, 'GASTLY')).toEqual(['HAUNTER', 'GENGAR'])
    expect(descendants(dex, 'EEVEE').sort()).toEqual(['ESPEON', 'VAPOREON'])
    expect(descendants(dex, 'GENGAR')).toEqual([])
  })

  it('maps pre-evolutions', () => {
    const pre = preEvolutionMap(dex)
    expect(pre.GENGAR).toEqual(['HAUNTER'])
    expect(pre.GASTLY).toBeUndefined()
  })
})

describe('describeEvolution', () => {
  it('names items, moves and conditions', () => {
    expect(describeEvolution(dex, { species: 'X', method: 'Level', parameter: 16 })).toBe('Level 16')
    expect(describeEvolution(dex, { species: 'X', method: 'Item', parameter: 'WATERSTONE' })).toBe('Use Water Stone')
    expect(describeEvolution(dex, { species: 'X', method: 'HasMove', parameter: 'RAGEFIST' })).toBe('Level up knowing Rage Fist')
    expect(describeEvolution(dex, { species: 'X', method: 'Trade', parameter: null })).toBe('Trade')
    expect(describeEvolution(dex, { species: 'X', method: 'Mystery', parameter: 3 })).toBe('Mystery 3')
  })
})

describe('pokedex routes', () => {
  it('parses list and species routes', () => {
    expect(parseHash('#/reborn/pokedex')).toEqual({ game: 'reborn', section: null, pokedex: true, species: null, compare: null })
    expect(parseHash(dexHref('reborn', 'GENGAR'))).toEqual({ game: 'reborn', section: null, pokedex: true, species: 'GENGAR', compare: null })
    expect(parseHash('#/reborn/opal-ward')).toMatchObject({ section: 'opal-ward', pokedex: false, compare: null })
  })

  it('parses compare routes, deduped and capped', () => {
    expect(parseHash(compareHref('reborn', ['GENGAR', 'ALAKAZAM']))).toMatchObject({ pokedex: true, species: null, compare: ['GENGAR', 'ALAKAZAM'] })
    expect(parseHash('#/reborn/pokedex/compare')).toMatchObject({ compare: [] })
    expect(parseCompare('A,B,A,,C,D,E')).toEqual(['A', 'B', 'C', 'D'])
  })
})

describe('compare helpers', () => {
  it('highlights only strict leaders', () => {
    expect(leaders([100, 80, 100])).toEqual([0, 2])
    expect(leaders([90, 90])).toEqual([])
    expect(leaders([90])).toEqual([])
  })

  it('labels multipliers', () => {
    expect([4, 2, 0.5, 0.25, 0].map(multLabel)).toEqual(['4x', '2x', '½', '¼', '0'])
  })
})
