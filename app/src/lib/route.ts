import { useEffect, useState } from 'react'

// Routes: #/<game> and #/<game>/<sectionId>
export interface Route { game: string | null; section: string | null }

export const parseHash = (hash: string): Route => {
  const [game, section] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  return { game: game || null, section: section || null }
}

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
