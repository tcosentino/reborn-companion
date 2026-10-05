import { useEffect, useState } from 'react'

// Routes: #/<game>, #/<game>/<sectionId>, #/<game>/pokedex and #/<game>/pokedex/<SPECIES>
export interface Route { game: string | null; section: string | null; pokedex: boolean; species: string | null }

export const parseHash = (hash: string): Route => {
  const [game, section, species] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  if (section === 'pokedex') return { game: game || null, section: null, pokedex: true, species: species || null }
  return { game: game || null, section: section || null, pokedex: false, species: null }
}

export const dexHref = (game: string, species?: string | null) =>
  `#/${game}/pokedex${species ? `/${encodeURIComponent(species)}` : ''}`

export const href = (game: string, section?: string | null) =>
  `#/${game}${section ? `/${encodeURIComponent(section)}` : ''}`

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
