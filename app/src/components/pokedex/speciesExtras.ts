// Pure helpers for the species page's "Gift / special" and "Faced in battle" lists.
import type { PokedexSpecies, Sym } from '../../data/types'
import { chapterShort } from '../palette/entries'
import type { SearchIndex } from '../palette/indexTypes'

export type Mention = NonNullable<PokedexSpecies['mentions']>[number]

// Sections whose prose highlights the species (gifts, eggs, statics, trades) and that are not
// already listed as an encounter table or shop under "Where to find"
export const specialMentions = (s: PokedexSpecies): Mention[] => {
  const listed = new Set(s.locations.map(l => l.sectionId))
  return (s.mentions ?? []).filter((m, i, all) => !listed.has(m.sectionId) && all.findIndex(x => x.sectionId === m.sectionId) === i)
}

// Episode label ("Ep 3") for a section id, via the search index
export const episodeOf = (idx: SearchIndex | null | undefined, sectionId: string) => {
  const s = idx?.s.find(r => r[0] === sectionId)
  return s ? chapterShort(idx!.ch[s[2]] ?? '') : null
}

export interface Opponent {
  names: string
  cls: string
  section: string
  sectionTitle: string
  anchor: string | null
  episode: string
  minLv: number
  maxLv: number
}

// Trainers whose party includes the species, in guide order
export const opponentsOf = (idx: SearchIndex, sym: Sym): Opponent[] => {
  const p = idx.p.findIndex(r => r[0] === sym)
  if (p < 0) return []
  return idx.t.filter(t => t[7].includes(p)).map(([names, cls, secs, a, minLv, maxLv]) => {
    const [section, sectionTitle, ch] = idx.s[secs[0]]
    return { names, cls, section, sectionTitle, anchor: a >= 0 ? idx.a[a] : null, episode: chapterShort(idx.ch[ch] ?? ''), minLv, maxLv }
  })
}

// Consecutive runs that share a key, keeping order: [[key, items], ...]
export const groupRuns = <T,>(list: T[], key: (x: T) => string): [string, T[]][] =>
  list.reduce<[string, T[]][]>((out, x) => {
    const k = key(x)
    const last = out[out.length - 1]
    if (last && last[0] === k) last[1].push(x)
    else out.push([k, [x]])
    return out
  }, [])
