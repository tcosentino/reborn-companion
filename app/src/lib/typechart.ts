import type { Dex, Sym } from '../data/types'

// Types that exist in game data but never appear as a real attacking type in matchups
const PSEUDO_TYPES = new Set(['QMARKS', 'SHADOW'])

export const attackingTypes = (dex: Dex): Sym[] =>
  Object.keys(dex.types).filter(t => !PSEUDO_TYPES.has(t))

export const multiplier = (dex: Dex, attack: Sym, defend: Sym[]): number =>
  defend.reduce((m, d) => {
    const t = dex.types[d]
    if (!t) return m
    if (t.immunities.includes(attack)) return 0
    if (t.weaknesses.includes(attack)) return m * 2
    if (t.resistances.includes(attack)) return m * 0.5
    return m
  }, 1)

// Attacking types that hit `defend` super-effectively, strongest first
export const weaknesses = (dex: Dex, defend: Sym[]): [Sym, number][] =>
  attackingTypes(dex)
    .map(t => [t, multiplier(dex, t, defend)] as [Sym, number])
    .filter(([, x]) => x > 1)
    .sort((a, b) => b[1] - a[1])

// Attacking types ranked by how many party members they hit super-effectively
export const teamCoverage = (dex: Dex, team: Sym[][]): { type: Sym; hits: number }[] =>
  attackingTypes(dex)
    .map(type => ({ type, hits: team.filter(def => multiplier(dex, type, def) > 1).length }))
    .filter(r => r.hits > 0)
    .sort((a, b) => b.hits - a.hits)
