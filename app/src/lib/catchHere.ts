// "Catch here": the species in a section's wild encounter tables, deduplicated and ordered by
// how worth catching they are (tier, then first appearance in the guide).
import type { DexLocation, RankEntry, Sym, Tier } from '../data/types'

export interface CatchSpecies {
  species: Sym
  name: string
  form: string | null
  tier: Tier | null
  // First place this species appears in the guide
  firstSeen: boolean
  caught: boolean
  // Not in any encounter table or prose mention after this section
  lastChance: boolean
}

interface EncLike {
  type: string
  methods?: { rows: { species: Sym; form: string | null; displayName: string; firstSeen: boolean }[] }[]
}

const TIER_ORDER: Record<Tier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 }

export interface CatchContext {
  ranks?: Record<Sym, RankEntry>
  caught: Record<string, true>
  // Places each species is listed, and the guide order of section ids; both optional (pokedex.json loads late)
  places?: (sym: Sym) => Pick<DexLocation, 'sectionId'>[] | undefined
  sectionOrder?: Record<string, number>
  here?: number
}

// Unknown sections count as later, so a species is only flagged when every listing is known to be earlier
const isLastChance = (ctx: CatchContext, sym: Sym) => {
  const { places, sectionOrder, here } = ctx
  if (!places || !sectionOrder || here == null) return false
  const list = places(sym)
  if (!list) return false
  return !list.some(p => (sectionOrder[p.sectionId] ?? Infinity) > here)
}

export const catchHere = (blocks: EncLike[], ctx: CatchContext): CatchSpecies[] => {
  const seen = new Map<Sym, CatchSpecies>()
  for (const b of blocks) {
    if (b.type !== 'encounters') continue
    for (const r of (b.methods ?? []).flatMap(m => m.rows)) {
      const prev = seen.get(r.species)
      if (prev) { prev.firstSeen ||= r.firstSeen; continue }
      seen.set(r.species, {
        species: r.species,
        name: r.displayName,
        form: r.form,
        tier: ctx.ranks?.[r.species]?.tier ?? null,
        firstSeen: r.firstSeen,
        caught: !!ctx.caught[r.species],
        lastChance: isLastChance(ctx, r.species)
      })
    }
  }
  const rank = (t: Tier | null) => t ? TIER_ORDER[t] : 5
  return [...seen.values()].sort((a, b) =>
    rank(a.tier) - rank(b.tier) || Number(b.firstSeen) - Number(a.firstSeen) || a.name.localeCompare(b.name))
}
