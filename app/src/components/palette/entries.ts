// Turns the compact search index into searchable entries and resolves each
// entry to a navigation target. Kept free of React so it is easy to test.
import type { Dex } from '../../data/types'
import type { SearchIndex } from './indexTypes'
import { normalize, type Entry } from './search'

// Species results offer "Open in Pokedex" (#/<game>/pokedex/<SYM>) when true
export const OPEN_IN_POKEDEX = true

export interface Target { section: string; anchor: string | null }

const cache = new Map<string, Promise<SearchIndex>>()

export const loadSearchIndex = (game: string): Promise<SearchIndex> => {
  const url = `${import.meta.env.BASE_URL}data/${game}/search.json`
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then(r => {
      if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`)
      return r.json() as Promise<SearchIndex>
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}

export const speciesName = (dex: Dex, sym: string) => dex.species[sym]?.name ?? sym

// "Episode 2: Reap What's Been Sewn" -> "Ep 2", "Postgame Episode 3: ..." -> "Postgame 3"
export const chapterShort = (title: string) => {
  const m = /^(postgame )?episode (\d+)/i.exec(title)
  if (!m) return title.split(':')[0]
  return `${m[1] ? 'Postgame' : 'Ep'} ${m[2]}`
}

export const buildEntries = (idx: SearchIndex, dex: Dex): Entry[] => {
  const out: Entry[] = []
  idx.s.forEach(([, title], ref) => out.push({ kind: 'section', ref, terms: [normalize(title)] }))
  idx.t.forEach(([names, cls], ref) => out.push({ kind: 'trainer', ref, terms: [normalize(`${cls} ${names}`), normalize(names)] }))
  idx.p.forEach(([sym, catches, , first], ref) => {
    const inGuide = !!first
    if (!inGuide && !OPEN_IN_POKEDEX) return
    out.push({ kind: 'species', ref, terms: [normalize(speciesName(dex, sym))], boost: catches.length ? 3 : inGuide ? 2 : 0 })
  })
  idx.i.forEach(([name, , , , teaches], ref) => out.push({ kind: 'item', ref, terms: [normalize(name)], ...(teaches ? { also: 'move' as const } : {}) }))
  idx.mv.forEach(([name], ref) => out.push({ kind: 'move', ref, terms: [normalize(name)] }))
  return out
}

const at = (idx: SearchIndex, sIdx: number, aIdx: number): Target =>
  ({ section: idx.s[sIdx][0], anchor: aIdx >= 0 ? idx.a[aIdx] : null })

// Where choosing an entry should land in the guide, or null when it only lives in the Pokedex
export const targetOf = (idx: SearchIndex, e: Entry): Target | null => {
  switch (e.kind) {
    case 'section': return at(idx, e.ref, -1)
    case 'trainer': {
      const t = idx.t[e.ref]
      return at(idx, t[2][0], t[3])
    }
    case 'species': {
      const [, catches, , first] = idx.p[e.ref]
      if (catches.length) return at(idx, catches[0][0], catches[0][1])
      return first ? at(idx, first[0], first[1]) : null
    }
    case 'item': {
      const [, , shops, hidden] = idx.i[e.ref]
      if (shops.length) return at(idx, shops[0][0], shops[0][1])
      return hidden.length ? at(idx, hidden[0], -1) : null
    }
    case 'move': {
      const tutors = idx.mv[e.ref][2]
      return tutors.length ? at(idx, tutors[0][0], tutors[0][1]) : null
    }
  }
}

// Stable key for React lists and DOM ids
export const entryKey = (e: Entry) => `${e.kind}-${e.ref}`
