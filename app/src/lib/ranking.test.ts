import { describe, expect, it } from 'vitest'
import type { Evolution, Pokedex, TierList } from '../data/types'
import { describeEvolution } from './evolution'
import { descendants, estimateTier, preEvolutionMap, rankAll, rankSpecies } from './ranking'
import { dexHref, parseHash } from './route'

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

const tiers: TierList = {
  source: 'test',
  tiers: {
    GENGAR: { tier: 'A', note: 'Fast special attacker.', basis: 'community' },
    VAPOREON: { tier: 'B', note: 'Bulky water.' },
    ESPEON: { tier: 'S', note: 'Sweeps.' }
  }
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

  it('uses curated tiers directly', () => {
    expect(rankSpecies(dex, tiers, 'GENGAR')).toMatchObject({ tier: 'A', source: 'curated', basis: 'community' })
  })

  it('inherits the best curated tier from any evolution', () => {
    const r = rankSpecies(dex, tiers, 'EEVEE')
    expect(r).toMatchObject({ tier: 'S', source: 'inherited', via: 'ESPEON' })
    expect(r?.note).toContain('Espeon')
    expect(rankSpecies(dex, tiers, 'GASTLY')).toMatchObject({ tier: 'A', via: 'GENGAR', basis: 'community' })
  })

  it('estimates from the best evolution base stat total when not curated', () => {
    expect(rankSpecies(dex, tiers, 'SENTRET')).toMatchObject({ tier: 'D', source: 'estimate', via: 'FURRET' })
    expect(rankSpecies(dex, tiers, 'MANKEY')).toMatchObject({ tier: 'B', source: 'estimate', via: 'ANNIHILAPE' })
    expect(rankSpecies(dex, null, 'FURRET')).toMatchObject({ source: 'estimate', via: undefined })
  })

  it('estimate thresholds', () => {
    expect(['A', 'B', 'C', 'D'].map((_, i) => estimateTier([600, 520, 450, 449][i]))).toEqual(['A', 'B', 'C', 'D'])
  })

  it('ranks the whole dex', () => {
    expect(Object.keys(rankAll(dex, tiers))).toHaveLength(Object.keys(dex.species).length)
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
    expect(parseHash('#/reborn/pokedex')).toEqual({ game: 'reborn', section: null, pokedex: true, species: null })
    expect(parseHash(dexHref('reborn', 'GENGAR'))).toEqual({ game: 'reborn', section: null, pokedex: true, species: 'GENGAR' })
    expect(parseHash('#/reborn/opal-ward')).toMatchObject({ section: 'opal-ward', pokedex: false })
  })
})
