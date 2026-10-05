import { useCallback, useEffect, useState } from 'react'

// Per-browser checklists (defeated trainers, caught Pokemon). Storage can be unavailable, so every access is guarded.
export type Checklist = 'progress' | 'caught'

const key = (game: string, list: Checklist) => `pokeguide:${game}:${list}`

const read = (game: string, list: Checklist): Record<string, true> => {
  try { return JSON.parse(localStorage.getItem(key(game, list)) ?? '{}') } catch { return {} }
}

const listeners = new Set<() => void>()

export const useChecklist = (game: string, list: Checklist) => {
  const [done, setDone] = useState(() => read(game, list))

  useEffect(() => {
    const sync = () => setDone(read(game, list))
    listeners.add(sync)
    sync()
    return () => { listeners.delete(sync) }
  }, [game, list])

  const toggle = useCallback((id: string) => {
    const next = { ...read(game, list) }
    if (next[id]) delete next[id]
    else next[id] = true
    try { localStorage.setItem(key(game, list), JSON.stringify(next)) } catch { /* storage unavailable */ }
    listeners.forEach(l => l())
  }, [game, list])

  return { done, toggle }
}

export const useProgress = (game: string) => useChecklist(game, 'progress')
export const useCaught = (game: string) => useChecklist(game, 'caught')

// Last guide section viewed, used as the default "available by" point in the Pokedex
const lastKey = (game: string) => `pokeguide:${game}:lastSection`
export const readLastSection = (game: string): string | null => {
  try { return localStorage.getItem(lastKey(game)) } catch { return null }
}
export const writeLastSection = (game: string, id: string) => {
  try { localStorage.setItem(lastKey(game), id) } catch { /* storage unavailable */ }
}
