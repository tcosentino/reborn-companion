// Flat, keyboard-navigable option list for the palette: result hits, plus the locations
// of the one expanded hit right after it.
import { entryKey } from './entries'
import type { Place } from './places'
import type { Group, Hit } from './search'

export type Option =
  | { id: string; hit: Hit }
  | { id: string; hit: Hit; place: Place; n: number }
  | { id: string; recent: string }

export const isPlace = (o: Option | undefined): o is Extract<Option, { place: Place }> => !!o && 'place' in o
export const isHit = (o: Option | undefined): o is Extract<Option, { hit: Hit }> => !!o && 'hit' in o

export const resultOptions = (groups: Group[], expanded: string | null, placesOf: (h: Hit) => Place[]): Option[] =>
  groups.flatMap(g => g.hits.flatMap(hit => {
    const key = entryKey(hit.entry)
    const head: Option = { id: `pal-${key}`, hit }
    if (key !== expanded) return [head]
    const places = placesOf(hit)
    return places.length > 1 ? [head, ...places.map((place, n) => ({ id: `pal-${key}-at-${n}`, hit, place, n }))] : [head]
  }))

// Index of the parent hit for an option (itself when it is a hit)
export const parentIndex = (options: Option[], i: number) => {
  let j = i
  while (j > 0 && isPlace(options[j])) j--
  return j
}
