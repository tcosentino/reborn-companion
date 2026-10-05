import { useEffect, useState } from 'react'

// Routes: #/<game>, #/<game>/<sectionId>[/<anchor>], #/<game>/pokedex, #/<game>/pokedex/<SPECIES>
// and #/<game>/pokedex/compare/<SPECIES>,<SPECIES>,...
// <anchor> is a block element id inside the section (battle-..., enc-..., shop-..., tutor-...)
export interface Route {
  game: string | null
  section: string | null
  pokedex: boolean
  species: string | null
  // Species being compared; null when not on the compare page
  compare: string[] | null
  anchor?: string | null
}

export const MAX_COMPARE = 4

// Unique, non-empty, capped at MAX_COMPARE
export const parseCompare = (list: string | undefined): string[] =>
  [...new Set((list ?? '').split(',').map(s => s.trim()).filter(Boolean))].slice(0, MAX_COMPARE)

export const parseHash = (hash: string): Route => {
  const [game, section, rest, list] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  if (section === 'pokedex' && rest === 'compare') {
    return { game: game || null, section: null, pokedex: true, species: null, compare: parseCompare(list) }
  }
  if (section === 'pokedex') return { game: game || null, section: null, pokedex: true, species: rest || null, compare: null }
  return { game: game || null, section: section || null, pokedex: false, species: null, compare: null, anchor: rest || null }
}

export const compareHref = (game: string, species: string[]) =>
  `#/${game}/pokedex/compare${species.length ? `/${species.map(encodeURIComponent).join(',')}` : ''}`

export const dexHref = (game: string, species?: string | null) =>
  `#/${game}/pokedex${species ? `/${encodeURIComponent(species)}` : ''}`

export const href = (game: string, section?: string | null, anchor?: string | null) =>
  `#/${game}${section ? `/${encodeURIComponent(section)}${anchor ? `/${encodeURIComponent(anchor)}` : ''}` : ''}`

export const useRoute = (): Route => {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export const battleId = (teamIds: [string, string, number][]) =>
  teamIds.map(t => t.join(':')).join('+')
