import type { Pokedex, PokedexSpecies, Sym, Tier } from '../data/types'

export const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D']

export const TIER_LABEL: Record<Tier, string> = {
  S: 'Carries the run',
  A: 'Great pick',
  B: 'Solid',
  C: 'Usable',
  D: 'Skip leveling'
}

export const bst = (s: PokedexSpecies, form = '0') =>
  (s.forms[form] ?? s.forms['0']).baseStats.reduce((a, b) => a + b, 0)

// Every species reachable by evolving `sym` (any form), nearest first
export const descendants = (dex: Pokedex, sym: Sym): Sym[] => {
  const out: Sym[] = []
  const queue = [sym]
  while (queue.length) {
    const cur = dex.species[queue.shift()!]
    if (!cur) continue
    for (const form of Object.values(cur.forms)) {
      for (const evo of form.evolutions) {
        if (evo.species !== sym && !out.includes(evo.species)) {
          out.push(evo.species)
          queue.push(evo.species)
        }
      }
    }
  }
  return out
}

// Species that evolve directly into each species
export const preEvolutionMap = (dex: Pokedex): Record<Sym, Sym[]> => {
  const map: Record<Sym, Sym[]> = {}
  for (const [sym, s] of Object.entries(dex.species)) {
    for (const form of Object.values(s.forms)) {
      for (const evo of form.evolutions) {
        const list = (map[evo.species] ??= [])
        if (!list.includes(sym)) list.push(sym)
      }
    }
  }
  return map
}
