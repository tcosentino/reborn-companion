import { useCallback, useEffect, useState } from 'react'

// Feature-local checkbox storage. TODO: swap for `useChecklist(game, list)` from lib/progress.ts once that lands.
const key = (game: string) => `pokeguide:${game}:hidden`

const read = (game: string): Record<string, true> => {
  try { return JSON.parse(localStorage.getItem(key(game)) ?? '{}') } catch { return {} }
}

const listeners = new Set<() => void>()

export const useHiddenChecked = (game: string) => {
  const [done, setDone] = useState(() => read(game))

  useEffect(() => {
    const sync = () => setDone(read(game))
    listeners.add(sync)
    sync()
    return () => { listeners.delete(sync) }
  }, [game])

  const toggle = useCallback((id: string) => {
    const next = { ...read(game) }
    if (next[id]) delete next[id]
    else next[id] = true
    try { localStorage.setItem(key(game), JSON.stringify(next)) } catch { /* storage unavailable */ }
    listeners.forEach(l => l())
  }, [game])

  return { done, toggle }
}
