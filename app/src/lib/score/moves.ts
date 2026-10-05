import type { Dex, Learnsets, MoveData, MoveSource, Moveset, Pokedex, SetMove, Sym } from '../../data/types.ts'
import { multiplier } from '../typechart.ts'

// Imports use explicit .ts extensions so app/scripts/build-ranks.ts can run on plain Node (type stripping).

export interface Learnable { move: Sym; source: MoveSource; level?: number; from?: Sym }

// Lower is easier to get during a playthrough
const SOURCE_COST: Record<MoveSource, number> = { level: 0, relearn: 1, machine: 1, egg: 3 }

const parentCache = new WeakMap<Pokedex, Record<Sym, Sym[]>>()

const parentsOf = (dex: Pokedex): Record<Sym, Sym[]> => {
  const cached = parentCache.get(dex)
  if (cached) return cached
  const parents: Record<Sym, Sym[]> = {}
  for (const [s, entry] of Object.entries(dex.species)) {
    for (const form of Object.values(entry.forms)) {
      for (const evo of form.evolutions) {
        const list = (parents[evo.species] ??= [])
        if (!list.includes(s)) list.push(s)
      }
    }
  }
  parentCache.set(dex, parents)
  return parents
}

// Species that evolve into `sym`, nearest first
export const ancestors = (dex: Pokedex, sym: Sym): Sym[] => {
  const parents = parentsOf(dex)
  const out: Sym[] = []
  const queue = [...(parents[sym] ?? [])]
  while (queue.length) {
    const p = queue.shift()!
    if (out.includes(p) || p === sym) continue
    out.push(p)
    queue.push(...(parents[p] ?? []))
  }
  return out
}

// Every move the species can know, from its own learnset or a pre-evolution's, keeping the easiest route
export const learnable = (dex: Pokedex, learnsets: Learnsets, sym: Sym): Learnable[] => {
  const best = new Map<Sym, Learnable>()
  const offer = (l: Learnable) => {
    const cur = best.get(l.move)
    const cost = (x: Learnable) => SOURCE_COST[x.source] + (x.from ? 0.5 : 0) + (x.level ?? 0) / 200
    if (!cur || cost(l) < cost(cur)) best.set(l.move, l)
  }
  for (const owner of [sym, ...ancestors(dex, sym)]) {
    const ls = learnsets.species[owner]?.['0']
    if (!ls) continue
    const from = owner === sym ? undefined : owner
    ls.level.forEach(([level, move]) => offer({ move, source: 'level', level, from }))
    ls.relearn.forEach(move => offer({ move, source: 'relearn', from }))
    ls.machine.forEach(move => offer({ move, source: 'machine', from }))
    ls.egg.forEach(move => offer({ move, source: 'egg', from }))
  }
  return [...best.values()]
}

// Damaging moves that are reliable in normal play: no recharge, charge turns, self-KO or situational effects
const UNRELIABLE = /must rest|recharge|user faints|faints after|two-turn|first turn|second turn|turn two|next turn|two turns after|only works|only be used|only after|fails? if|fails unless|only if|must eat|if the target is asleep|damages the user|terrible damage|bounces up|soars|burrows|dives|vanishes|disappears|z-move|max move|dynamax/i

export const isUsableAttack = (m: MoveData | undefined): m is MoveData =>
  !!m && m.category !== 'status' && (m.power ?? 0) >= 30 && (m.accuracy ?? 100) >= 70 && !UNRELIABLE.test(m.desc)

// Status moves that boost the user's attacking stat
export const boostsStat = (m: MoveData | undefined, category: 'physical' | 'special'): boolean => {
  if (!m || m.category !== 'status') return false
  const d = m.desc.toLowerCase()
  if (!/raises|boosts/.test(d) || !/user|its /.test(d) || /target's|ally/.test(d)) return false
  return category === 'physical' ? /\battack\b/.test(d.replace(/sp\. atk/g, '')) : /sp\. atk/.test(d)
}

export const statsOf = (dex: Pokedex, sym: Sym) => {
  const [hp, atk, def, spa, spd, spe] = dex.species[sym].forms['0'].baseStats
  return { hp, atk, def, spa, spd, spe }
}

export type Role = Moveset['role']

export const roleOf = (atk: number, spa: number): Role =>
  Math.abs(atk - spa) <= 10 ? 'Mixed' : atk > spa ? 'Physical' : 'Special'

// Expected damage weight of a move for this species, before matchups
export const moveValue = (m: MoveData, types: Sym[], atk: number, spa: number, source: MoveSource): number => {
  const stat = m.category === 'physical' ? atk : spa
  const stab = types.includes(m.type) ? 1.5 : 1
  const access = source === 'egg' ? 0.75 : 1
  return (m.power ?? 0) * ((m.accuracy ?? 100) / 100) * stab * (stat / 100) * access
}

const NATURES: Record<Role, [string, string]> = {
  Physical: ['Jolly', 'Adamant'],
  Special: ['Timid', 'Modest'],
  Mixed: ['Hasty', 'Mild']
}

// Defending single types used for coverage counts
export const singleTypes = (dex: Dex): Sym[] => Object.keys(dex.types).filter(t => !['QMARKS', 'SHADOW'].includes(t))

const seHits = (dex: Dex, moveType: Sym, defenders: Sym[]) => defenders.filter(t => multiplier(dex, moveType, [t]) > 1)

// Greedy 4-move set: best STAB first, then moves that add the most new super-effective coverage,
// with a stat-boosting move in place of the weakest attack when the species is fast enough to use it
export const buildMoveset = (dex: Dex, pokedex: Pokedex, learnsets: Learnsets, sym: Sym): Moveset | null => {
  const species = pokedex.species[sym]
  if (!species) return null
  const types = species.forms['0'].types
  const { atk, spa, spe } = statsOf(pokedex, sym)
  const role = roleOf(atk, spa)
  const allowed = role === 'Mixed' ? ['physical', 'special'] : [role.toLowerCase()]
  const defenders = singleTypes(dex)

  const pool = learnable(pokedex, learnsets, sym)
    .map(l => ({ l, m: learnsets.moves[l.move] }))
    .filter((x): x is { l: Learnable; m: MoveData } => isUsableAttack(x.m) && allowed.includes(x.m.category))
    .map(x => ({ ...x, v: moveValue(x.m, types, atk, spa, x.l.source) }))
  if (pool.length === 0) return null

  const vmax = Math.max(...pool.map(p => p.v))
  const chosen: typeof pool = []
  const covered = new Set<Sym>()
  const pick = (x: (typeof pool)[number]) => {
    chosen.push(x)
    if ((x.m.power ?? 0) >= 60) seHits(dex, x.m.type, defenders).forEach(t => covered.add(t))
  }

  // One STAB move per own type first, strongest first
  const stabs = types
    .map(t => pool.filter(p => p.m.type === t).sort((a, b) => b.v - a.v)[0])
    .filter(Boolean)
    .sort((a, b) => b.v - a.v)
  stabs.forEach(pick)

  const setup = learnable(pokedex, learnsets, sym)
    .map(l => ({ l, m: learnsets.moves[l.move] }))
    .filter(x => x.l.source !== 'egg' && (role === 'Mixed'
      ? boostsStat(x.m, atk >= spa ? 'physical' : 'special')
      : boostsStat(x.m, role === 'Physical' ? 'physical' : 'special')))
    .sort((a, b) => SOURCE_COST[a.l.source] - SOURCE_COST[b.l.source])[0]
  const attackSlots = setup && spe >= 70 ? 3 : 4

  while (chosen.length < attackSlots) {
    const used = new Set(chosen.map(c => c.m.type))
    const next = pool
      .filter(p => !chosen.includes(p))
      .map(p => {
        const gain = (p.m.power ?? 0) >= 60 ? seHits(dex, p.m.type, defenders).filter(t => !covered.has(t)).length : 0
        return { p, s: p.v / vmax + 0.12 * gain + (used.has(p.m.type) ? -0.6 : 0.1) }
      })
      .sort((a, b) => b.s - a.s)[0]
    if (!next) break
    pick(next.p)
  }

  const toSet = ({ l, m }: { l: Learnable; m: MoveData }): SetMove => ({
    move: l.move, name: m.name, type: m.type, category: m.category, power: m.power, accuracy: m.accuracy,
    source: l.source, ...(l.level != null && { level: l.level }), ...(l.from && { from: l.from })
  })
  const moves = chosen.map(toSet)
  if (setup && attackSlots === 3) moves.push(toSet(setup))

  const fast = spe >= 80
  const stabNames = chosen.filter(c => types.includes(c.m.type)).map(c => c.m.name)
  const note = [
    `${role} attacker`,
    stabNames.length ? `STAB ${stabNames.join(' and ')}` : 'no strong STAB moves',
    `super-effective on ${covered.size} of ${defenders.length} types`
  ].join('; ') + '.'

  return {
    role,
    nature: NATURES[role][fast ? 0 : 1],
    moves,
    coverage: defenders.filter(t => covered.has(t)),
    note
  }
}
