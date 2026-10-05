import { useEffect, useState } from 'react'

// Routes: #/<game>, #/<game>/<sectionId>[/<anchor>], #/<game>/pokedex and #/<game>/pokedex/<SPECIES>
// <anchor> is a block element id inside the section (battle-..., enc-..., shop-..., tutor-...)
export interface Route { game: string | null; section: string | null; pokedex: boolean; species: string | null; anchor?: string | null }

export const parseHash = (hash: string): Route => {
  const [game, section, rest] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  if (section === 'pokedex') return { game: game || null, section: null, pokedex: true, species: rest || null }
  return { game: game || null, section: section || null, pokedex: false, species: null, anchor: rest || null }
}

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
