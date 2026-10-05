import { useEffect, useState } from 'react'
import type { Chapter, Dex, GuideIndex, Movesets, Pokedex, Ranks } from './types'
import type { SectionBattles } from '../lib/sectionBattles'

const cache = new Map<string, Promise<unknown>>()

const fetchJson = <T,>(url: string): Promise<T> => {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`)
      return r.json()
    }))
  }
  return cache.get(url) as Promise<T>
}

const base = (game: string) => `${import.meta.env.BASE_URL}data/${game}/`

export const loadIndex = (game: string) => fetchJson<GuideIndex>(`${base(game)}index.json`)
export const loadDex = (game: string) => fetchJson<Dex>(`${base(game)}dex.json`)
export const loadPokedex = (game: string) => fetchJson<Pokedex>(`${base(game)}pokedex.json`)
export const loadRanks = (game: string) => fetchJson<Ranks>(`${base(game)}ranks.json`)
export const loadMovesets = (game: string) => fetchJson<Movesets>(`${base(game)}movesets.json`)
export const loadBattles = (game: string) => fetchJson<SectionBattles>(`${base(game)}battles.json`)
export const loadChapter = (game: string, file: string) => fetchJson<Chapter>(`${base(game)}${file}`)

type AsyncState<T> = { data?: T; error?: string }

export const useAsync = <T,>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> => {
  const [state, setState] = useState<AsyncState<T>>({})
  useEffect(() => {
    let live = true
    setState({})
    fn().then(data => live && setState({ data }), e => live && setState({ error: String(e.message ?? e) }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
