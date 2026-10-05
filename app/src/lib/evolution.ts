import type { Evolution, Pokedex } from '../data/types'

const TIME: Record<string, string> = { Day: 'during the day', Night: 'at night' }

// Human-readable evolution condition, e.g. "Level 16", "Use Water Stone", "Trade holding Metal Coat"
export const describeEvolution = (dex: Pokedex, evo: Evolution): string => {
  const p = evo.parameter
  const name = typeof p === 'string' ? dex.names[p] ?? p : String(p)
  switch (evo.method) {
    case 'Level': return `Level ${p}`
    case 'LevelDay': return `Level ${p} ${TIME.Day}`
    case 'LevelNight': return `Level ${p} ${TIME.Night}`
    case 'LevelMale': return `Level ${p} (male)`
    case 'LevelFemale': return `Level ${p} (female)`
    case 'LevelRain': return `Level ${p} in rain`
    case 'Item': return `Use ${name}`
    case 'ItemMale': return `Use ${name} (male)`
    case 'ItemFemale': return `Use ${name} (female)`
    case 'Trade': return 'Trade'
    case 'TradeItem': return `Trade holding ${name}`
    case 'DayHoldItem': return `Level up holding ${name} ${TIME.Day}`
    case 'NightHoldItem': return `Level up holding ${name} ${TIME.Night}`
    case 'Happiness': return 'High friendship'
    case 'HappinessDay': return `High friendship ${TIME.Day}`
    case 'HappinessNight': return `High friendship ${TIME.Night}`
    case 'Affection': return 'High affection, knowing a Fairy move'
    case 'HasMove': return `Level up knowing ${name}`
    case 'HasInParty': return `Level up with ${name} in party`
    case 'Location': return 'Level up at a special location'
    case 'AttackGreater': return `Level ${p}, Attack > Defense`
    case 'DefenseGreater': return `Level ${p}, Defense > Attack`
    case 'AtkDefEqual': return `Level ${p}, Attack = Defense`
    case 'Silcoon': case 'Cascoon': return `Level ${p} (random)`
    case 'Ninjask': return `Level ${p}`
    case 'Shedinja': return 'Empty party slot when Nincada evolves'
    case 'BadInfluence': return `Level ${p} (special condition)`
    default: return `${evo.method}${p != null ? ` ${p}` : ''}`
  }
}
