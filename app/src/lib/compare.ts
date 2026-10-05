import type { Dex, Sym } from '../data/types'
import { attackingTypes, multiplier } from './typechart'

// Column indexes holding the highest value; empty when every column ties (nothing to highlight)
export const leaders = (values: number[]): number[] => {
  if (values.length < 2) return []
  const max = Math.max(...values)
  const top = values.flatMap((v, i) => (v === max ? [i] : []))
  return top.length === values.length ? [] : top
}

// Defensive multiplier of each attacking type against each compared Pokemon,
// keeping only types where at least one of them takes non-neutral damage
export const matchupRows = (dex: Dex, typesPerMon: Sym[][]): { type: Sym; mults: number[] }[] =>
  attackingTypes(dex)
    .map(type => ({ type, mults: typesPerMon.map(def => multiplier(dex, type, def)) }))
    .filter(r => r.mults.some(m => m !== 1))

export const multLabel = (m: number) =>
  m === 0 ? '0' : m === 0.25 ? '¼' : m === 0.5 ? '½' : `${m}x`
