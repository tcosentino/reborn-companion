// Species that can learn a move, from learnsets.json. Pure so it can be unit-tested.
import type { Learnsets, Sym } from '../../data/types'

export interface Learner {
  sym: Sym
  // Forms that learn it, when it is not the base form ('0')
  forms: string[]
  // Lowest level-up level, for level learners
  level?: number
}

export interface Learners { machine: Learner[]; level: Learner[] }

// One entry per species: base form wins, otherwise the alternate forms that learn it are listed
export const learnersOf = (ls: Learnsets, move: Sym): Learners => {
  const machine: Learner[] = []
  const level: Learner[] = []
  for (const [sym, forms] of Object.entries(ls.species)) {
    const tm = Object.entries(forms).filter(([, f]) => f.machine.includes(move)).map(([k]) => k)
    if (tm.length) machine.push({ sym, forms: tm.includes('0') ? [] : tm })
    const lv = Object.entries(forms).flatMap(([k, f]) => f.level.filter(([, m]) => m === move).map(([l]) => ({ k, l })))
    if (lv.length) {
      const keys = [...new Set(lv.map(x => x.k))]
      level.push({ sym, forms: keys.includes('0') ? [] : keys, level: Math.min(...lv.map(x => x.l)) })
    }
  }
  level.sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
  return { machine, level }
}
