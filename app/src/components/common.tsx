import { createContext, useContext } from 'react'
import type { Dex, Sym } from '../data/types'
import type { GameConfig } from '../games'

export const DexContext = createContext<Dex | null>(null)
export const GameContext = createContext<GameConfig | null>(null)

export const useDex = () => {
  const dex = useContext(DexContext)
  if (!dex) throw new Error('Dex not loaded')
  return dex
}

export const useGame = () => {
  const game = useContext(GameContext)
  if (!game) throw new Error('Game not selected')
  return game
}

export const typeVar = (t: Sym) => `var(--t-${t.toLowerCase()}, var(--t-qmarks))`

export const TypeChip = ({ type, small, suffix }: { type: Sym; small?: boolean; suffix?: string }) => {
  const dex = useDex()
  return (
    <span className={`type${small ? ' sm' : ''}`} style={{ ['--tc' as string]: typeVar(type) }}>
      {dex.types[type]?.name ?? type}
      {suffix && <span className="x">{suffix}</span>}
    </span>
  )
}

export const itemName = (dex: Dex, sym: Sym | null) => (sym && dex.items[sym]?.name) || sym

export const money = (p: number | string | null) =>
  typeof p === 'number' ? `$${p.toLocaleString('en-US')}` : p ?? ''
