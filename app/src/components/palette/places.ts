// Every place a search-index row points at (shops, field finds, tutors, catches, battles),
// shared by the palette's location picker, the item/move pages and the hover cards.
import { money } from '../common'
import { itemKey } from './buildIndex'
import { chapterShort } from './entries'
import type { ItemRow, MoveRow, Price, SearchIndex } from './indexTypes'
import type { Entry } from './search'

export type PlaceKind = 'shop' | 'found' | 'tutor' | 'catch' | 'battle' | 'section'

export interface Place {
  kind: PlaceKind
  sIdx: number
  section: string
  anchor: string | null
  // Section title and its episode ("Ep 3", "Postgame 2")
  title: string
  episode: string
  // Block title for shops and tutors, otherwise the section title
  label: string
  price: Price
  // Extra text such as "Cave, Lv 12–18"
  detail?: string
}

const VERB: Partial<Record<PlaceKind, string>> = { shop: 'Sold at', found: 'Found in', tutor: 'Tutor at', catch: 'Caught in' }

const lvRange = (a: number, b: number) => a === b ? `Lv ${a}` : `Lv ${a}–${b}`

export const placeAt = (idx: SearchIndex, kind: PlaceKind, sIdx: number, aIdx: number, price: Price = null, detail?: string): Place => {
  const [section, title, ch] = idx.s[sIdx]
  const anchorLabel = aIdx >= 0 ? idx.al?.[aIdx] : ''
  return {
    kind, sIdx, section, anchor: aIdx >= 0 ? idx.a[aIdx] : null, title,
    episode: chapterShort(idx.ch[ch] ?? ''), label: anchorLabel || title, price, detail
  }
}

const uniqPlaces = (list: Place[]) =>
  list.filter((p, i) => list.findIndex(q => q.section === p.section && q.anchor === p.anchor && q.kind === p.kind) === i)

export const itemPlaces = (idx: SearchIndex, row: ItemRow): Place[] => uniqPlaces([
  ...row[2].map(([s, a, price]) => placeAt(idx, 'shop', s, a, price)),
  ...row[3].map(s => placeAt(idx, 'found', s, -1))
])

export const movePlaces = (idx: SearchIndex, row: MoveRow): Place[] =>
  uniqPlaces(row[2].map(([s, a, price]) => placeAt(idx, 'tutor', s, a, price)))

// Item page key: the item SYM, or a name key for rows the dex does not know (coins, shop Pokemon)
export const itemPageKey = (row: ItemRow) => row[1] || itemKey(row[0])

export const findItem = (idx: SearchIndex, key: string) =>
  idx.i.find(r => r[1] === key) ?? idx.i.find(r => !r[1] && itemKey(r[0]) === key)

export const findMove = (idx: SearchIndex, sym: string) => idx.mv.find(r => r[1] === sym)

// TM/HM/TR items that teach a move
export const tmsFor = (idx: SearchIndex, sym: string) => idx.i.filter(r => r[4] === sym)

// Every place an entry points at, in guide order of the underlying row
export const entryPlaces = (idx: SearchIndex, e: Entry): Place[] => {
  switch (e.kind) {
    case 'section': return [placeAt(idx, 'section', e.ref, -1)]
    case 'trainer': {
      const [, , secs, a] = idx.t[e.ref]
      return uniqPlaces(secs.map(s => placeAt(idx, 'battle', s, a)))
    }
    case 'species': {
      const [, catches, , first] = idx.p[e.ref]
      if (catches.length) return uniqPlaces(catches.map(([s, a, m, lo, hi]) => placeAt(idx, 'catch', s, a, null, `${idx.m[m]}, ${lvRange(lo, hi)}`)))
      return first ? [placeAt(idx, 'section', first[0], first[1])] : []
    }
    case 'item': return itemPlaces(idx, idx.i[e.ref])
    case 'move': return movePlaces(idx, idx.mv[e.ref])
  }
}

const priced = (p: Place) => p.price != null && p.price !== '' && p.price !== 0 ? ` (${money(p.price)})` : ''

// "Devon Corporation ($300)"
export const placeText = (p: Place) => `${p.label}${priced(p)}`

// "Sold at Devon Corporation ($300), Grand Hall Candy ($200), Found in Opal Ward, +2 more".
// Repeated labels (the same chain mart in several sections) are shown once.
export const summarize = (places: Place[], max = 2) => {
  const seen = new Set<string>()
  const distinct = places.filter(p => {
    const k = `${p.kind}|${placeText(p)}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const shown = distinct.slice(0, max)
  const parts = shown.map((p, i) => {
    const verb = i === 0 || shown[i - 1].kind !== p.kind ? VERB[p.kind] : undefined
    return `${verb ? `${verb} ` : ''}${placeText(p)}`
  })
  const rest = distinct.length - shown.length
  return parts.join(', ') + (rest > 0 ? `, +${rest} more` : '')
}
