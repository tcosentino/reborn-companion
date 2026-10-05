import { useCallback, useEffect, useState } from 'react'

// Per-browser checklists (defeated trainers, caught Pokemon). Storage can be unavailable, so every access is guarded.
// 'compare' is the tray of species queued for the compare page (insertion order is kept)
// 'prefs' holds boolean view settings such as hideDefeated
export type Checklist = 'progress' | 'caught' | 'hidden' | 'compare' | 'prefs'

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

  // Replace the whole list (order of `ids` is kept)
  const replace = useCallback((ids: string[]) => {
    try { localStorage.setItem(key(game, list), JSON.stringify(Object.fromEntries(ids.map(id => [id, true])))) } catch { /* storage unavailable */ }
    listeners.forEach(l => l())
  }, [game, list])

  return { done, toggle, replace }
}

export const useProgress = (game: string) => useChecklist(game, 'progress')
export const useCaught = (game: string) => useChecklist(game, 'caught')

export const usePrefs = (game: string) => useChecklist(game, 'prefs')

// Last guide section viewed, used as the default "available by" point in the Pokedex and for resuming.
// lastSection stays a plain section id (the original format); the block anchor within it is stored
// separately as JSON so older readers keep working.
export interface Spot { section: string; anchor: string | null }

const lastKey = (game: string) => `pokeguide:${game}:lastSection`
const anchorKey = (game: string) => `pokeguide:${game}:lastAnchor`

// The saved anchor only counts when it belongs to the saved section
export const parseSpot = (section: string | null, anchorJson: string | null): Spot | null => {
  if (!section) return null
  try {
    const a = JSON.parse(anchorJson ?? 'null') as Partial<Spot> | null
    return { section, anchor: a?.section === section && typeof a.anchor === 'string' ? a.anchor : null }
  } catch { return { section, anchor: null } }
}

export const readLastSection = (game: string): string | null => {
  try { return localStorage.getItem(lastKey(game)) } catch { return null }
}
export const readLastSpot = (game: string): Spot | null => {
  try { return parseSpot(localStorage.getItem(lastKey(game)), localStorage.getItem(anchorKey(game))) } catch { return null }
}
// Pass an anchor to also record the block in view; omit it to keep the saved one
export const writeLastSection = (game: string, id: string, anchor?: string | null) => {
  try {
    localStorage.setItem(lastKey(game), id)
    if (anchor !== undefined) localStorage.setItem(anchorKey(game), JSON.stringify({ section: id, anchor }))
  } catch { /* storage unavailable */ }
}
