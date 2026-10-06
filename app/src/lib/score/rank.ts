import type { Chapter, Dex, Factor, GuideIndex, Learnsets, Moveset, Pokedex, RankEntry, Sym, Tier } from '../../data/types.ts'
import { multiplier } from '../typechart.ts'
import { SPEED_ABILITY, abilityValue } from './abilities.ts'
import { ancestors, buildMoveset, statsOf } from './moves.ts'

// Data-only "worth leveling" tiers. Five factors, each a percentile among fully evolved species:
//   stats         offense-weighted base stats, blended toward the Mega form for the part of the story
//                 after its Mega Stone is obtainable
//   moves         strength of the recommended set (best STAB) plus its type coverage
//   bosses        how the recommended set and typing fare against main-story boss Pokemon
//                 from the chapter the line becomes catchable onwards; weaknesses count for less
//                 when it outspeeds the boss or runs a setup move
//   availability  how early the line can be caught according to the guide's encounter tables
//   abilities     best ability it can realistically have (see abilities.ts)
// Pre-evolutions take the tier of their best final form.

export const WEIGHTS: Record<Factor, number> = { stats: 0.25, moves: 0.2, bosses: 0.25, availability: 0.15, abilities: 0.15 }

// Hidden abilities need a lucky encounter or a reset, so they count for less unless the guide's
// starter picker recommends resetting for one
export const HIDDEN_ABILITY_CREDIT = 0.7
// At most one Mega per team, so even a Mega available all game only counts this much
const MEGA_MAX_SHARE = 0.8

// Percentile cut-offs for S/A/B/C; everything below is D
const CUTS: [Tier, number][] = [['S', 95], ['A', 80], ['B', 50], ['C', 20]]
export const tierFor = (score: number): Tier => CUTS.find(([, min]) => score >= min)?.[0] ?? 'D'

export interface BossMon { types: Sym[]; spe: number; chapter: number }

// Named trainers: gym leaders, Elite Four, admins and recurring rivals have trainer types that are
// all caps or match their name (Cain, Victoria2); generic classes (MeteorGrunt, Hiker) do not
export const isMajorTrainer = (t: { name: string; trainerType: string }) =>
  /^[A-Z0-9_]{3,}$/.test(t.trainerType) ||
  t.trainerType.replace(/\d+$/, '').toLowerCase() === t.name.toLowerCase()

// Boss Pokemon from main-story battles (not postgame, not partner battles), with chapter order
export const bossMons = (idx: GuideIndex, chapters: Chapter[], pokedex: Pokedex): BossMon[] => {
  const order = Object.fromEntries(idx.chapters.map((c, i) => [c.id, i]))
  return chapters
    .filter(ch => ch.id.startsWith('episode-'))
    .flatMap(ch => ch.sections
      .flatMap(sec => sec.blocks)
      .flatMap(b => (b.type === 'battle' && !b.partner && b.trainers.some(isMajorTrainer) ? b.party : []))
      .flatMap(mon => {
        const s = pokedex.species[mon.species]
        const form = s?.forms[String(mon.form ?? 0)] ?? s?.forms['0']
        return form ? [{ types: form.types, spe: form.baseStats[5], chapter: order[ch.id] ?? 0 }] : []
      }))
}

// Earliest chapter index where the species or any pre-evolution is in an encounter table or shop,
// or bolded in the guide's prose (gifts, eggs, static encounters)
export const availableFrom = (pokedex: Pokedex, order: Record<string, number>, sym: Sym): number | null => {
  const line = [sym, ...ancestors(pokedex, sym)]
  const chapters = line
    .flatMap(s => [...(pokedex.species[s]?.locations ?? []), ...(pokedex.species[s]?.mentions ?? [])])
    .map(l => order[l.chapterId])
    .filter(c => c != null)
  return chapters.length ? Math.min(...chapters) : null
}

// Abilities that work against the user (Truant, Slow Start, Defeatist, Stall), read from their descriptions
const HINDERING = /can't attack on consecutive|temporarily halves|halves attacking|moves after all other/i
export const hinderedByAbility = (pokedex: Pokedex, sym: Sym): boolean => {
  const abilities = pokedex.species[sym].forms['0'].abilities
  return abilities.length > 0 && abilities.every(a => HINDERING.test(pokedex.abilities[a]?.desc ?? ''))
}

// Final forms reachable from sym (sym itself when it does not evolve)
export const finalForms = (pokedex: Pokedex, sym: Sym): Sym[] => {
  const out: Sym[] = []
  const seen = new Set<Sym>()
  const walk = (s: Sym) => {
    if (seen.has(s)) return
    seen.add(s)
    const evos = Object.values(pokedex.species[s]?.forms ?? {}).flatMap(f => f.evolutions.map(e => e.species)).filter(e => pokedex.species[e])
    if (evos.length === 0) out.push(s)
    else evos.forEach(walk)
  }
  walk(sym)
  return out
}

// Evolving into `sym` needs a trade (a scarce Link Stone in Reborn) or a very high level somewhere in the line
const friction = (pokedex: Pokedex, sym: Sym): number => {
  let mult = 1
  for (const p of ancestors(pokedex, sym)) {
    for (const form of Object.values(pokedex.species[p].forms)) {
      for (const e of form.evolutions) {
        if (e.species !== sym && !ancestors(pokedex, sym).includes(e.species)) continue
        if (/Trade/.test(e.method)) mult = Math.min(mult, 0.93)
        else if (/Level/.test(e.method) && typeof e.parameter === 'number' && e.parameter >= 50) mult = Math.min(mult, 0.92)
      }
    }
  }
  return mult
}

// Mega forms of a species, each with the stone that triggers it (matched on the item's description and,
// for X/Y Megas, the stone's suffix). Megas without a holdable stone (Rayquaza, Primals) are skipped.
export const megaForms = (dex: Dex, pokedex: Pokedex, sym: Sym): { form: string; stone: string }[] => {
  const species = pokedex.species[sym]
  if (!species) return []
  return Object.entries(species.forms).flatMap(([key, f]) => {
    const m = f.name.match(/^Mega(?: ([XY]))? Form/)
    if (!m) return []
    const stone = Object.values(dex.items ?? {}).find(i =>
      i.desc.includes(`Have ${species.name} hold it`) && /Mega Evolve/.test(i.desc) && (!m[1] || i.name.endsWith(` ${m[1]}`)))
    return stone ? [{ form: key, stone: stone.name }] : []
  })
}

// Earliest chapter index whose guide text mentions `text`
export const firstMention = (chapterText: string[], text: string): number | null => {
  const i = chapterText.findIndex(t => t.includes(text))
  return i < 0 ? null : i
}

// Share of the main story (from when the line is catchable) spent with the Mega available, capped
export const megaShare = (avail: number | null, stone: number | null, mainChapters: number): number => {
  if (avail == null || stone == null || stone >= mainChapters || avail >= mainChapters) return 0
  return MEGA_MAX_SHARE * (mainChapters - Math.max(stone, avail)) / (mainChapters - avail)
}

// Ability the guide's starter picker recommends resetting for, keyed by starter species
export const starterAbilities = (chapters: Chapter[]): Record<Sym, Sym> =>
  Object.fromEntries(chapters
    .flatMap(ch => ch.sections.flatMap(sec => sec.blocks))
    .flatMap(b => (b.type === 'starters' ? b.picks : []))
    .flatMap(p => (p.ability ? [[p.species, p.ability]] : [])))

export interface AbilityPick { ability: Sym; value: number; source: 'regular' | 'hidden' | 'starter' | 'mega' }

// Best ability a final form can realistically use: regular abilities at full value, the hidden ability at
// HIDDEN_ABILITY_CREDIT (full when the starter picker recommends it), a Mega's ability scaled by its share
export const bestAbility = (pokedex: Pokedex, sym: Sym, starter: Record<Sym, Sym>, megas: { form: string; share: number }[]): AbilityPick | null => {
  const form = pokedex.species[sym].forms['0']
  const picked = [sym, ...ancestors(pokedex, sym)].map(s => starter[s]).find(Boolean)
  const options: AbilityPick[] = [
    ...form.abilities.map(a => ({ ability: a, value: abilityValue(a), source: 'regular' as const })),
    ...(form.hiddenAbility ? [{ ability: form.hiddenAbility, value: abilityValue(form.hiddenAbility) * (picked === form.hiddenAbility ? 1 : HIDDEN_ABILITY_CREDIT), source: (picked === form.hiddenAbility ? 'starter' : 'hidden') as AbilityPick['source'] }] : []),
    ...megas.flatMap(m => pokedex.species[sym].forms[m.form].abilities.map(a => ({ ability: a, value: abilityValue(a) * m.share, source: 'mega' as const })))
  ]
  return options.sort((a, b) => b.value - a.value)[0] ?? null
}

const statScore = (st: number[]) => {
  const [hp, atk, def, spa, spd, spe] = st
  const offense = Math.max(atk, spa) + (Math.abs(atk - spa) <= 10 ? 10 : 0)
  return 1.2 * offense + 0.8 * spe + 0.5 * hp + 0.35 * def + 0.35 * spd
}

const tradeEvolved = (pokedex: Pokedex, sym: Sym) =>
  ancestors(pokedex, sym).some(p => Object.values(pokedex.species[p].forms)
    .some(f => f.evolutions.some(e => /Trade/.test(e.method) && (e.species === sym || ancestors(pokedex, sym).includes(e.species)))))

interface Raw { stats: number; moves: number; bosses: number; availability: number | null; abilities: number; hit: number; weak: number; avail: number | null; ability: AbilityPick | null; mega: { stone: string; chapter: number; share: number } | null }

interface Ctx { dex: Dex; pokedex: Pokedex; bosses: BossMon[]; order: Record<string, number>; mainChapters: number; chapterText: string[]; starter: Record<Sym, Sym> }

const rawFor = ({ dex, pokedex, bosses, order, mainChapters, chapterText, starter }: Ctx, set: Moveset | null, sym: Sym): Raw => {
  const s = statsOf(pokedex, sym)
  const forms = pokedex.species[sym].forms
  const types = forms['0'].types
  const avail = availableFrom(pokedex, order, sym)

  // Best Mega, blended in for the share of the story it is usable
  const megas = megaForms(dex, pokedex, sym).map(m => {
    const chapter = firstMention(chapterText, m.stone)
    return { ...m, chapter, share: megaShare(avail, chapter, mainChapters), score: statScore(forms[m.form].baseStats) }
  }).sort((a, b) => b.share * b.score - a.share * a.score)
  const mega = megas[0]?.share ? megas[0] : null
  const base = statScore(forms['0'].baseStats)
  const stats = mega ? base + mega.share * (mega.score - base) : base

  const ability = bestAbility(pokedex, sym, starter, megas)
  const speedMult = ability && ability.source !== 'hidden' ? SPEED_ABILITY[ability.ability] ?? 1 : 1
  const speed = (mega ? s.spe + mega.share * (forms[mega.form].baseStats[5] - s.spe) : s.spe) * speedMult
  const setup = set?.moves.some(m => m.category === 'status') ?? false

  const attacks = set?.moves.filter(m => m.category !== 'status') ?? []
  const statFor = (cat: string) => (cat === 'physical' ? s.atk : s.spa)
  const stabBest = Math.max(0, ...attacks.filter(m => types.includes(m.type)).map(m => (m.power ?? 0) * ((m.accuracy ?? 100) / 100) * statFor(m.category) / 100))
  const anyBest = Math.max(0, ...attacks.map(m => (m.power ?? 0) * ((m.accuracy ?? 100) / 100) * statFor(m.category) / 100))
  const moves = (1.5 * stabBest + anyBest) * (1 + (set?.coverage.length ?? 0) / 18)

  // Postgame-only lines face no main-story bosses; judge their matchups against all of them
  // (lateness is already captured by availability)
  const later = bosses.filter(b => avail == null || b.chapter >= avail)
  const faced = later.length ? later : bosses
  let hit = 0
  let weak = 0
  let score = 0
  for (const b of faced) {
    const best = Math.max(0, ...attacks.map(m => multiplier(dex, m.type, b.types) * (types.includes(m.type) ? 1.5 : 1)))
    const worst = Math.max(...b.types.map(t => multiplier(dex, t, types)))
    if (best >= 2) hit++
    if (worst >= 2) weak++
    // A weakness matters less when it moves first or can set up and sweep before the foe hits back
    const exposure = (speed > b.spe ? 0.6 : 1) * (setup ? 0.85 : 1)
    score += (best >= 3 ? 1 : best >= 2 ? 0.8 : best >= 1.5 ? 0.45 : best >= 1 ? 0.3 : 0) -
      (worst >= 4 ? 0.6 : worst >= 2 ? 0.35 : 0) * exposure + (worst === 0 ? 0.3 : worst <= 0.5 ? 0.15 : 0)
  }
  const n = Math.max(faced.length, 1)

  // Never obtainable in the guide scores 0; postgame-only barely above
  const availability = avail == null ? 0 : avail >= mainChapters ? 0.05 : 1 - avail / mainChapters

  return {
    stats, moves, bosses: score / n, availability, abilities: ability?.value ?? 0, hit: hit / n, weak: weak / n, avail, ability,
    mega: mega ? { stone: mega.stone, chapter: mega.chapter!, share: mega.share } : null
  }
}

// Percentile (0-100) of each value within its list
const percentiles = (values: number[]): number[] => {
  const sorted = [...values].sort((a, b) => a - b)
  return values.map(v => {
    const below = sorted.filter(x => x < v).length
    const equal = sorted.filter(x => x === v).length
    return Math.round(((below + equal / 2) / sorted.length) * 100)
  })
}

const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

export interface RankInput {
  dex: Dex
  pokedex: Pokedex
  learnsets: Learnsets
  idx: GuideIndex
  chapters: Chapter[]
}

export const computeRanks = ({ dex, pokedex, learnsets, idx, chapters }: RankInput) => {
  const order = Object.fromEntries(idx.chapters.map((c, i) => [c.id, i]))
  const mainChapters = idx.chapters.filter(c => c.id.startsWith('episode-')).length
  const bosses = bossMons(idx, chapters, pokedex)
  const ctx: Ctx = {
    dex, pokedex, bosses, order, mainChapters,
    chapterText: idx.chapters.map(c => JSON.stringify(chapters.find(ch => ch.id === c.id) ?? '')),
    starter: starterAbilities(chapters)
  }
  const syms = Object.keys(pokedex.species)

  const movesets: Record<Sym, Moveset> = {}
  for (const sym of syms) {
    const set = buildMoveset(dex, pokedex, learnsets, sym)
    if (set) movesets[sym] = set
  }

  const finals = syms.filter(s => finalForms(pokedex, s).length === 1 && finalForms(pokedex, s)[0] === s)
  const raw = finals.map(s => rawFor(ctx, movesets[s] ?? null, s))
  const pct: Record<Factor, (number | null)[]> = {
    stats: percentiles(raw.map(r => r.stats)),
    moves: percentiles(raw.map(r => r.moves)),
    bosses: percentiles(raw.map(r => r.bosses)),
    abilities: percentiles(raw.map(r => r.abilities)),
    availability: (() => {
      const known = raw.flatMap(r => (r.availability == null ? [] : [r.availability]))
      const p = percentiles(known)
      let i = 0
      return raw.map(r => (r.availability == null ? null : p[i++]))
    })()
  }
  const composite = finals.map((s, i) => {
    const total = (Object.keys(WEIGHTS) as Factor[])
      .reduce((sum, f) => sum + WEIGHTS[f] * (pct[f][i] ?? 50), 0)
    return total * friction(pokedex, s) * (hinderedByAbility(pokedex, s) ? 0.6 : 1)
  })
  const scores = percentiles(composite)

  const finalEntry: Record<Sym, RankEntry> = {}
  finals.forEach((sym, i) => {
    const r = raw[i]
    const f = Object.fromEntries((Object.keys(WEIGHTS) as Factor[]).map(k => [k, pct[k][i]])) as Record<Factor, number | null>
    const st = pokedex.species[sym].forms['0'].baseStats
    const topStats = st.map((v, j) => [STAT_NAMES[j], v] as const).sort((a, b) => b[1] - a[1]).slice(0, 2)
    const set = movesets[sym]
    const stab = set?.moves.find(m => m.category !== 'status' && pokedex.species[sym].forms['0'].types.includes(m.type))
    const chapterTitle = r.avail != null ? idx.chapters[r.avail].title : null

    const good: string[] = []
    const bad: string[] = []
    if ((f.stats ?? 0) >= 70) good.push(`Strong stats: ${topStats.map(([n, v]) => `${n} ${v}`).join(', ')}`)
    if ((f.stats ?? 100) <= 30) bad.push(`Low base stats (total ${st.reduce((a, b) => a + b, 0)})`)
    if ((f.moves ?? 0) >= 70 && stab) good.push(`Strong moves: ${stab.name} (${stab.power}), super-effective on ${set.coverage.length} types`)
    if ((f.moves ?? 100) <= 30) bad.push(set ? `Thin movepool: covers ${set.coverage.length} types` : 'Almost no damaging moves')
    if (r.ability && r.ability.value >= 0.6) {
      const name = pokedex.abilities[r.ability.ability]?.name ?? r.ability.ability
      good.push(r.ability.source === 'mega' ? `Mega ability: ${name}` : r.ability.source === 'hidden' ? `Strong hidden ability: ${name}` : `Strong ability: ${name}`)
    }
    if (r.mega && r.mega.share >= 0.2) good.push(`Mega Evolves from ${idx.chapters[r.mega.chapter].title} (${r.mega.stone})`)
    if ((f.bosses ?? 0) >= 70) good.push(`Hits ${Math.round(r.hit * 100)}% of later boss Pokemon super-effectively`)
    if ((f.bosses ?? 100) <= 30) bad.push(`Struggles against bosses: weak to ${Math.round(r.weak * 100)}% of them`)
    if (chapterTitle && (f.availability ?? 0) >= 70) good.push(`Catchable early: ${chapterTitle}`)
    if (chapterTitle && r.avail != null && r.avail < mainChapters && (f.availability ?? 100) <= 30) bad.push(`Only catchable late: ${chapterTitle}`)
    if (r.avail == null) bad.push('Not obtainable anywhere in the guide')
    else if (r.avail >= mainChapters) bad.push(`Postgame only: ${chapterTitle}`)
    if (friction(pokedex, sym) < 1) bad.push(tradeEvolved(pokedex, sym) ? 'Trade evolution: needs a Link Stone' : 'Evolves at level 50 or later')
    if (hinderedByAbility(pokedex, sym)) bad.push(`Held back by its ability: ${pokedex.species[sym].forms['0'].abilities.map(a => pokedex.abilities[a]?.name ?? a).join(', ')}`)

    const tier = tierFor(scores[i])
    finalEntry[sym] = {
      tier,
      score: scores[i],
      factors: f,
      note: [good[0], bad[0]].filter(Boolean).join('. ') + (good.length || bad.length ? '.' : 'Average across the board.'),
      reasons: { good, bad }
    }
  })

  // Every species: its own entry if final, otherwise its best final form's
  const species: Record<Sym, RankEntry> = {}
  for (const sym of syms) {
    if (finalEntry[sym]) { species[sym] = finalEntry[sym]; continue }
    const best = finalForms(pokedex, sym)
      .filter(f => finalEntry[f])
      .sort((a, b) => finalEntry[b].score - finalEntry[a].score)[0]
    if (!best) continue
    const e = finalEntry[best]
    species[sym] = { ...e, via: best, note: `Rated as ${pokedex.species[best].name}. ${e.note}` }
  }

  return {
    ranks: {
      generatedAt: new Date().toISOString(),
      method: 'Percentiles among fully evolved species of stats including Mega forms once their stone is obtainable (25%), moveset strength and coverage (20%), matchups against main-story boss Pokemon adjusted for speed and setup (25%), how early the line is catchable (15%) and best ability (15%), reduced for trade or level 50+ evolutions. S top 5%, A next 15%, B next 30%, C next 30%, D bottom 20%.',
      species
    },
    movesets: { generatedAt: new Date().toISOString(), species: movesets }
  }
}
