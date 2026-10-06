import { describe, expect, it } from 'vitest'
import type { Dex, Learnsets, MoveData, Pokedex } from '../../data/types'
import { boostsStat, buildMoveset, isUsableAttack, learnable, moveValue, roleOf } from './moves'
import { ABILITY_VALUE, DEFAULT_ABILITY, abilityValue } from './abilities'
import { HIDDEN_ABILITY_CREDIT, availableFrom, bestAbility, finalForms, firstMention, hinderedByAbility, isMajorTrainer, megaForms, megaShare, starterAbilities, tierFor } from './rank'

const move = (name: string, type: string, category: string, power: number | null, desc = '', accuracy = 100): MoveData =>
  ({ name, type, category, power, accuracy, pp: 10, desc })

const moves: Record<string, MoveData> = {
  FLAMETHROWER: move('Flamethrower', 'FIRE', 'special', 90, 'May burn.'),
  EMBER: move('Ember', 'FIRE', 'special', 40),
  AIRSLASH: move('Air Slash', 'FLYING', 'special', 75),
  SOLARBEAM: move('Solar Beam', 'GRASS', 'special', 120, 'A two-turn attack.'),
  HYPERBEAM: move('Hyper Beam', 'NORMAL', 'special', 150, 'The user must rest after.'),
  FOCUSPUNCH: move('Focus Punch', 'FIGHTING', 'physical', 150, 'It will fail if the user is hit this turn.'),
  BOUNCE: move('Bounce', 'FLYING', 'physical', 85, 'The user bounces up high, then drops on the target.'),
  FOCUSBLAST: move('Focus Blast', 'FIGHTING', 'special', 120, '', 70),
  DRAGONPULSE: move('Dragon Pulse', 'DRAGON', 'special', 85),
  NASTYPLOT: move('Nasty Plot', 'DARK', 'status', null, "It sharply raises the user's Sp. Atk."),
  SWORDSDANCE: move('Swords Dance', 'NORMAL', 'status', null, "It sharply raises the user's Attack stat."),
  DRAGONDANCE: move('Dragon Dance', 'DRAGON', 'status', null, 'The user performs a dance that boosts its Attack and Speed stats.'),
  GROWL: move('Growl', 'NORMAL', 'status', null, "Lowers the target's Attack stat.")
}

const t = (weaknesses: string[], resistances: string[] = [], immunities: string[] = []) => ({ name: '', weaknesses, resistances, immunities })
const dex = {
  types: {
    FIRE: t(['WATER', 'GROUND', 'ROCK'], ['FIRE', 'GRASS', 'BUG', 'STEEL', 'ICE']),
    FLYING: t(['ROCK', 'ELECTRIC', 'ICE'], ['GRASS', 'FIGHTING', 'BUG'], ['GROUND']),
    GRASS: t(['FIRE', 'FLYING', 'ICE', 'BUG', 'POISON'], ['WATER', 'GRASS', 'GROUND', 'ELECTRIC']),
    WATER: t(['GRASS', 'ELECTRIC'], ['FIRE', 'WATER', 'ICE', 'STEEL']),
    STEEL: t(['FIRE', 'FIGHTING', 'GROUND']),
    ICE: t(['FIRE', 'FIGHTING', 'ROCK', 'STEEL']),
    ROCK: t(['WATER', 'GRASS', 'FIGHTING', 'GROUND', 'STEEL']),
    DRAGON: t(['DRAGON', 'ICE', 'FAIRY']),
    NORMAL: t(['FIGHTING'])
  }
} as unknown as Dex

const form = (types: string[], stats: number[], evolutions: { species: string; method: string; parameter: number | null }[] = [], abilities = ['BLAZE']) =>
  ({ '0': { name: 'Normal Form', types, baseStats: stats, abilities, evolutions } })

const pokedex: Pokedex = {
  species: {
    CHARMANDER: { name: 'Charmander', num: 4, catchRate: 45, kind: '', forms: form(['FIRE'], [39, 52, 43, 60, 50, 65], [{ species: 'CHARIZARD', method: 'Level', parameter: 36 }]), locations: [], mentions: [{ chapterId: 'c0', sectionId: 'a', sectionTitle: 'A' }] },
    CHARIZARD: { name: 'Charizard', num: 6, catchRate: 45, kind: '', forms: form(['FIRE', 'FLYING'], [78, 84, 78, 109, 85, 100]), locations: [{ chapterId: 'c2', sectionId: 'b', sectionTitle: 'B', place: 'B', methods: ['Grass'], levels: [] }] },
    SLAKING: { name: 'Slaking', num: 289, catchRate: 45, kind: '', forms: form(['NORMAL'], [150, 160, 100, 95, 65, 100], [], ['TRUANT']), locations: [] }
  },
  abilities: { BLAZE: { name: 'Blaze', desc: 'Powers up Fire moves in a pinch.' }, TRUANT: { name: 'Truant', desc: "Pokémon can't attack on consecutive turns." } },
  names: {}
}

const ls = (level: [number, string][], machine: string[] = [], egg: string[] = []) => ({ '0': { level, machine, egg, relearn: [] } })
const learnsets: Learnsets = {
  species: {
    CHARMANDER: ls([[1, 'EMBER'], [30, 'FLAMETHROWER']], ['SOLARBEAM', 'SWORDSDANCE'], ['DRAGONPULSE']),
    CHARIZARD: ls([[1, 'AIRSLASH']], ['FLAMETHROWER', 'HYPERBEAM', 'FOCUSBLAST', 'NASTYPLOT', 'GROWL', 'BOUNCE', 'FOCUSPUNCH']),
    SLAKING: ls([])
  },
  moves
}

describe('move filters', () => {
  it('drops recharge, charge-turn, semi-invulnerable and conditional moves', () => {
    expect(isUsableAttack(moves.FLAMETHROWER)).toBe(true)
    expect(isUsableAttack(moves.FOCUSBLAST)).toBe(true)
    for (const m of ['SOLARBEAM', 'HYPERBEAM', 'FOCUSPUNCH', 'BOUNCE', 'NASTYPLOT']) expect(isUsableAttack(moves[m])).toBe(false)
  })

  it('detects stat boosts by category from descriptions', () => {
    expect(boostsStat(moves.NASTYPLOT, 'special')).toBe(true)
    expect(boostsStat(moves.NASTYPLOT, 'physical')).toBe(false)
    expect(boostsStat(moves.SWORDSDANCE, 'physical')).toBe(true)
    expect(boostsStat(moves.DRAGONDANCE, 'physical')).toBe(true)
    expect(boostsStat(moves.GROWL, 'physical')).toBe(false)
  })

  it('picks a role from attacking stats', () => {
    expect(roleOf(130, 60)).toBe('Physical')
    expect(roleOf(60, 130)).toBe('Special')
    expect(roleOf(110, 105)).toBe('Mixed')
  })
})

describe('learnable', () => {
  it('includes pre-evolution moves and keeps the easiest source', () => {
    const l = learnable(pokedex, learnsets, 'CHARIZARD')
    expect(l.find(x => x.move === 'DRAGONPULSE')).toMatchObject({ source: 'egg', from: 'CHARMANDER' })
    // Flamethrower: TM on Charizard beats level 30 on Charmander only when cheaper; level is cheapest
    expect(l.find(x => x.move === 'FLAMETHROWER')).toMatchObject({ source: 'level', level: 30, from: 'CHARMANDER' })
  })
})

describe('buildMoveset', () => {
  it('builds a special set with both STABs, coverage and a boosting move', () => {
    const set = buildMoveset(dex, pokedex, learnsets, 'CHARIZARD')!
    expect(set.role).toBe('Special')
    expect(set.nature).toBe('Timid')
    const names = set.moves.map(m => m.move)
    expect(names).toHaveLength(4)
    expect(names.slice(0, 2).sort()).toEqual(['AIRSLASH', 'FLAMETHROWER'])
    expect(names).toContain('NASTYPLOT')
    expect(names).not.toContain('HYPERBEAM')
    expect(names).not.toContain('SOLARBEAM')
    expect(set.coverage).toContain('GRASS')
  })

  it('never repeats a type while another type is available', () => {
    const set = buildMoveset(dex, pokedex, learnsets, 'CHARIZARD')!
    const types = set.moves.filter(m => m.category !== 'status').map(m => m.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('discounts moves learned very late', () => {
    expect(moveValue(moves.FLAMETHROWER, ['FIRE'], 100, 100, 'level', 80)).toBeLessThan(moveValue(moves.FLAMETHROWER, ['FIRE'], 100, 100, 'level', 30))
  })

  it('returns null when nothing can attack', () => {
    expect(buildMoveset(dex, pokedex, learnsets, 'SLAKING')).toBeNull()
  })
})

describe('rank helpers', () => {
  it('maps percentiles to tiers', () => {
    expect([99, 95, 80, 50, 20, 19].map(tierFor)).toEqual(['S', 'S', 'A', 'B', 'C', 'D'])
  })

  it('recognizes named trainers but not generic classes', () => {
    expect(isMajorTrainer({ name: 'Julia', trainerType: 'JULIA' })).toBe(true)
    expect(isMajorTrainer({ name: 'Victoria', trainerType: 'Victoria2' })).toBe(true)
    expect(isMajorTrainer({ name: 'Geoff', trainerType: 'MeteorGrunt' })).toBe(false)
  })

  it('takes availability from the earliest table or prose mention in the line', () => {
    const order = { c0: 0, c1: 1, c2: 2 }
    expect(availableFrom(pokedex, order, 'CHARIZARD')).toBe(0)
    expect(availableFrom(pokedex, order, 'SLAKING')).toBeNull()
  })

  it('finds final forms and hindering abilities', () => {
    expect(finalForms(pokedex, 'CHARMANDER')).toEqual(['CHARIZARD'])
    expect(hinderedByAbility(pokedex, 'SLAKING')).toBe(true)
    expect(hinderedByAbility(pokedex, 'CHARIZARD')).toBe(false)
  })
})

describe('abilities and megas', () => {
  const blaziken: Pokedex = {
    species: {
      TORCHIC: { name: 'Torchic', num: 255, catchRate: 45, kind: '', locations: [], forms: { '0': { name: 'Normal Form', types: ['FIRE'], baseStats: [45, 60, 40, 70, 50, 45], abilities: ['BLAZE'], hiddenAbility: 'SPEEDBOOST', evolutions: [{ species: 'BLAZIKEN', method: 'Level', parameter: 16 }] } } },
      BLAZIKEN: {
        name: 'Blaziken', num: 257, catchRate: 45, kind: '', locations: [], forms: {
          '0': { name: 'Normal Form', types: ['FIRE', 'FIGHTING'], baseStats: [80, 120, 70, 110, 70, 80], abilities: ['BLAZE'], hiddenAbility: 'SPEEDBOOST', evolutions: [] },
          '1': { name: 'Mega Form', types: ['FIRE', 'FIGHTING'], baseStats: [80, 160, 80, 130, 80, 100], abilities: ['SPEEDBOOST'], evolutions: [] }
        }
      }
    },
    abilities: {},
    names: {}
  }
  const items = {
    BLAZIKENITE: { name: 'Blazikenite', desc: 'Have Blaziken hold it, and this stone will enable it to Mega Evolve during battle.', price: 999 },
    CHARIZARDITEX: { name: 'Charizardite X', desc: 'Have Charizard hold it, and this stone will enable it to Mega Evolve during battle.', price: 999 }
  }
  const megaDex = { ...dex, items } as unknown as Dex

  it('values curated abilities and defaults the rest', () => {
    expect(abilityValue('SPEEDBOOST')).toBe(1)
    expect(abilityValue('RUNAWAY')).toBe(DEFAULT_ABILITY)
    expect(Object.values(ABILITY_VALUE).every(v => v >= 0 && v <= 1)).toBe(true)
  })

  it('discounts hidden abilities unless the starter picker recommends them', () => {
    expect(bestAbility(blaziken, 'BLAZIKEN', {}, [])).toMatchObject({ ability: 'SPEEDBOOST', source: 'hidden', value: HIDDEN_ABILITY_CREDIT })
    expect(bestAbility(blaziken, 'BLAZIKEN', { TORCHIC: 'SPEEDBOOST' }, [])).toMatchObject({ ability: 'SPEEDBOOST', source: 'starter', value: 1 })
  })

  it('scales a Mega ability by its share of the story', () => {
    const pick = bestAbility({ ...blaziken, species: { ...blaziken.species, BLAZIKEN: { ...blaziken.species.BLAZIKEN, forms: { ...blaziken.species.BLAZIKEN.forms, '0': { ...blaziken.species.BLAZIKEN.forms['0'], hiddenAbility: null } } } } }, 'BLAZIKEN', {}, [{ form: '1', share: 0.5 }])
    expect(pick).toMatchObject({ ability: 'SPEEDBOOST', source: 'mega', value: 0.5 })
  })

  it('reads starter picks from starters blocks', () => {
    const chapters = [{ id: 'c0', sections: [{ blocks: [{ type: 'starters', picks: [{ species: 'TORCHIC', ability: 'SPEEDBOOST' }, { species: 'CHIKORITA', ability: null }] }] }] }] as never
    expect(starterAbilities(chapters)).toEqual({ TORCHIC: 'SPEEDBOOST' })
  })

  it('matches Mega forms to their stones', () => {
    expect(megaForms(megaDex, blaziken, 'BLAZIKEN')).toEqual([{ form: '1', stone: 'Blazikenite' }])
    expect(megaForms(megaDex, blaziken, 'TORCHIC')).toEqual([])
  })

  it('finds the first chapter mentioning a stone and the share of the story after it', () => {
    expect(firstMention(['nothing', 'get the Blazikenite here', 'Blazikenite again'], 'Blazikenite')).toBe(1)
    expect(firstMention(['nothing'], 'Blazikenite')).toBeNull()
    expect(megaShare(0, 0, 10)).toBeCloseTo(0.8)
    expect(megaShare(0, 5, 10)).toBeCloseTo(0.4)
    expect(megaShare(0, 10, 10)).toBe(0)
    expect(megaShare(0, null, 10)).toBe(0)
  })
})
