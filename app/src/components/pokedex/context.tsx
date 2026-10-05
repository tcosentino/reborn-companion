import { createContext, useContext } from 'react'
import type { Pokedex, RankEntry, Sym } from '../../data/types'

export interface PokedexData {
  dex: Pokedex
  ranks: Record<Sym, RankEntry>
  // Guide order of chapters, used for "available by" filtering
  chapterOrder: Record<string, number>
}

// Null while pokedex.json is still loading; guide views render without dex extras until then
export const PokedexContext = createContext<PokedexData | null>(null)
export const usePokedex = () => useContext(PokedexContext)

// Index of the earliest chapter a species can be found in, or Infinity if the guide never lists it
export const firstChapter = (data: PokedexData, sym: Sym) =>
  Math.min(Infinity, ...(data.dex.species[sym]?.locations ?? []).map(l => data.chapterOrder[l.chapterId] ?? Infinity))
