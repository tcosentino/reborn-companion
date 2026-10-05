import { useEffect, useState } from 'react'

// Routes: #/<game>, #/<game>/<sectionId>[/<anchor>], #/<game>/pokedex, #/<game>/pokedex/<SPECIES>
// and #/<game>/pokedex/compare/<SPECIES>,<SPECIES>,...
// Reference pages: #/<game>/item/<SYM> and #/<game>/move/<SYM>. They count as Pokedex pages
// (pokedex: true) so the guide keeps the last section in the sidebar.
// <anchor> is a block element id inside the section (battle-..., enc-..., shop-..., tutor-...)
export interface Route {
  game: string | null
  section: string | null
  pokedex: boolean
  species: string | null
  // Species being compared; null when not on the compare page
  compare: string[] | null
  anchor?: string | null
  // Item page key (item SYM, or itemKey of the name for unnamed rows) and move page SYM
  item?: string
  move?: string
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
  if ((section === 'item' || section === 'move') && rest) {
    return { game: game || null, section: null, pokedex: true, species: null, compare: null, ...(section === 'item' ? { item: rest } : { move: rest }) }
  }
  if (section === 'pokedex') return { game: game || null, section: null, pokedex: true, species: rest || null, compare: null }
  return { game: game || null, section: section || null, pokedex: false, species: null, compare: null, anchor: rest || null }
}

export const compareHref = (game: string, species: string[]) =>
  `#/${game}/pokedex/compare${species.length ? `/${species.map(encodeURIComponent).join(',')}` : ''}`

export const dexHref = (game: string, species?: string | null) =>
  `#/${game}/pokedex${species ? `/${encodeURIComponent(species)}` : ''}`

export const itemHref = (game: string, key: string) => `#/${game}/item/${encodeURIComponent(key)}`
export const moveHref = (game: string, sym: string) => `#/${game}/move/${encodeURIComponent(sym)}`

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
