import { describe, expect, it } from 'vitest'
import type { Learnsets, LearnsetForm } from '../../data/types'
import { learnersOf } from './learners'

const f = (machine: string[], level: [number, string][] = []): LearnsetForm => ({ level, machine, egg: [], relearn: [] })

const ls = {
  species: {
    PIKACHU: { 0: f(['CHARGEBEAM', 'THUNDERBOLT'], [[42, 'THUNDERBOLT']]) },
    RAICHU: { 0: f(['THUNDERBOLT']), 1: f(['THUNDERBOLT', 'PSYCHIC']) },
    MAGNEMITE: { 0: f(['CHARGEBEAM'], [[1, 'THUNDERSHOCK'], [29, 'THUNDERBOLT']]) },
    ROTOM: { 0: f([]), 1: f([], [[15, 'OVERHEAT']]) }
  },
  moves: {}
} as unknown as Learnsets

describe('learnersOf', () => {
  it('lists machine learners once per species in learnset order', () => {
    expect(learnersOf(ls, 'THUNDERBOLT').machine.map(l => l.sym)).toEqual(['PIKACHU', 'RAICHU'])
  })

  it('names the forms when only an alternate form learns it', () => {
    expect(learnersOf(ls, 'PSYCHIC').machine).toEqual([{ sym: 'RAICHU', forms: ['1'] }])
    expect(learnersOf(ls, 'OVERHEAT').level).toEqual([{ sym: 'ROTOM', forms: ['1'], level: 15 }])
  })

  it('sorts level-up learners by level', () => {
    expect(learnersOf(ls, 'THUNDERBOLT').level.map(l => [l.sym, l.level])).toEqual([['MAGNEMITE', 29], ['PIKACHU', 42]])
  })

  it('returns empty lists for unknown moves', () => {
    expect(learnersOf(ls, 'SPLASH')).toEqual({ machine: [], level: [] })
  })
})
