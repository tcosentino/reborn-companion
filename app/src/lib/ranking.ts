import type { Pokedex, PokedexSpecies, Sym, Tier, TierEntry, TierList } from '../data/types'

export const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D']

export const TIER_LABEL: Record<Tier, string> = {
  S: 'Carries the run',
  A: 'Great pick',
  B: 'Solid',
  C: 'Usable',
  D: 'Skip leveling'
}

export interface Rank {
  tier: Tier
  note: string
  // curated: rated directly; inherited: rated through an evolution; estimate: from base stats
  source: 'curated' | 'inherited' | 'estimate'
  basis?: TierEntry['basis']
  via?: Sym
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

export const estimateTier = (total: number): Tier =>
  total >= 600 ? 'A' : total >= 520 ? 'B' : total >= 450 ? 'C' : 'D'

const better = (a: Tier, b: Tier) => TIERS.indexOf(a) < TIERS.indexOf(b)

export const rankSpecies = (dex: Pokedex, tiers: TierList | null, sym: Sym): Rank | null => {
  const s = dex.species[sym]
  if (!s) return null
  const own = tiers?.tiers[sym]
  if (own) return { tier: own.tier, note: own.note, source: 'curated', basis: own.basis }

  const line = descendants(dex, sym)
  let best: ({ sym: Sym } & TierEntry) | null = null
  for (const d of line) {
    const t = tiers?.tiers[d]
    if (t && (!best || better(t.tier, best.tier))) best = { sym: d, ...t }
  }
  if (best) {
    const name = dex.species[best.sym]?.name ?? best.sym
    return { tier: best.tier, note: `Evolves into ${name}. ${best.note}`, source: 'inherited', basis: best.basis, via: best.sym }
  }

  const [topSym, topTotal] = [sym, ...line]
    .filter(x => dex.species[x])
    .map(x => [x, bst(dex.species[x])] as const)
    .reduce((a, b) => (b[1] > a[1] ? b : a))
  const via = topSym === sym ? '' : ` as ${dex.species[topSym].name}`
  return {
    tier: estimateTier(topTotal),
    note: `Estimated from base stats: ${topTotal} total${via}.`,
    source: 'estimate',
    via: topSym === sym ? undefined : topSym
  }
}

// Ranks for the whole dex, computed once per data load
export const rankAll = (dex: Pokedex, tiers: TierList | null): Record<Sym, Rank> =>
  Object.fromEntries(
    Object.keys(dex.species).map(sym => [sym, rankSpecies(dex, tiers, sym)] as const).filter((e): e is [Sym, Rank] => !!e[1])
  )
