import { describe, expect, it } from 'vitest'
import type { Dex } from '../data/types'
import { multiplier, teamCoverage, weaknesses } from './typechart'

const t = (weaknesses: string[], resistances: string[] = [], immunities: string[] = []) =>
  ({ name: '', weaknesses, resistances, immunities })

// Minimal chart: defensive data per type, as emitted in dex.types
const dex = {
  types: {
    NORMAL: t(['FIGHTING'], [], ['GHOST']),
    FIGHTING: t(['FLYING', 'PSYCHIC']),
    FLYING: t(['ROCK', 'ELECTRIC', 'ICE'], ['GRASS', 'FIGHTING', 'BUG'], ['GROUND']),
    ROCK: t(['WATER', 'GRASS', 'FIGHTING', 'GROUND', 'STEEL'], ['NORMAL', 'FIRE', 'POISON', 'FLYING']),
    ELECTRIC: t(['GROUND'], ['ELECTRIC', 'FLYING', 'STEEL']),
    ICE: t(['FIRE', 'FIGHTING', 'ROCK', 'STEEL'], ['ICE']),
    GROUND: t(['WATER', 'GRASS', 'ICE'], ['POISON', 'ROCK'], ['ELECTRIC']),
    GHOST: t(['GHOST', 'DARK'], ['POISON', 'BUG'], ['NORMAL', 'FIGHTING']),
    QMARKS: t([])
  }
} as unknown as Dex

describe('typechart', () => {
  it('multiplies across dual types', () => {
    expect(multiplier(dex, 'ELECTRIC', ['FLYING'])).toBe(2)
    expect(multiplier(dex, 'ICE', ['FLYING', 'GROUND'])).toBe(4)
    expect(multiplier(dex, 'FIGHTING', ['NORMAL', 'FLYING'])).toBe(1)
  })

  it('treats immunity as zero', () => {
    expect(multiplier(dex, 'GROUND', ['FLYING', 'ROCK'])).toBe(0)
    expect(multiplier(dex, 'NORMAL', ['GHOST'])).toBe(0)
  })

  it('lists 4x weaknesses first and skips pseudo types', () => {
    const w = weaknesses(dex, ['FLYING', 'GROUND'])
    expect(w[0]).toEqual(['ICE', 4])
    expect(w.map(([s]) => s)).not.toContain('QMARKS')
    expect(w.map(([s]) => s)).not.toContain('ELECTRIC')
  })

  it('ranks team coverage by members hit', () => {
    const cov = teamCoverage(dex, [['NORMAL', 'FLYING'], ['FLYING'], ['GROUND']])
    expect(cov[0]).toEqual({ type: 'ICE', hits: 3 })
    expect(cov.find(c => c.type === 'ELECTRIC')).toEqual({ type: 'ELECTRIC', hits: 2 })
  })
})
