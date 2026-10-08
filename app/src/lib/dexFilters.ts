// Pokedex search filters, remembered per game so leaving the Pokedex and coming back keeps them.
// Per-viewer convenience: storage failures fall back to defaults.
import type { Tier } from '../data/types'
import { TIERS } from './ranking'

export type CaughtFilter = 'all' | 'caught' | 'missing'
export type Sort = 'num' | 'tier' | 'first'

export interface DexFilters {
  q: string
  type: string
  tier: Tier | ''
  caught: CaughtFilter
  // '' = every species
  upTo: string
  sort: Sort
}

const CAUGHT: CaughtFilter[] = ['all', 'caught', 'missing']
const SORTS: Sort[] = ['num', 'tier', 'first']

const filtersKey = (game: string) => `pokeguide:${game}:dex-filters`

export const defaultFilters = (defaultChapter: string | null): DexFilters =>
  ({ q: '', type: '', tier: '', caught: 'all', upTo: defaultChapter ?? '', sort: 'num' })

const str = (v: unknown, fallback: string) => typeof v === 'string' ? v : fallback
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? v as T : fallback

// Unknown or stale values (a chapter id that no longer exists) fall back to the defaults field by field
export const parseFilters = (json: string | null, defaults: DexFilters, chapterIds: readonly string[]): DexFilters => {
  let v: Record<string, unknown>
  try {
    const parsed = JSON.parse(json ?? 'null')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaults
    v = parsed
  } catch { return defaults }
  const upTo = str(v.upTo, defaults.upTo)
  return {
    q: str(v.q, defaults.q),
    type: str(v.type, defaults.type),
    tier: oneOf<Tier | ''>(v.tier, ['', ...TIERS], defaults.tier),
    caught: oneOf(v.caught, CAUGHT, defaults.caught),
    upTo: upTo === '' || chapterIds.includes(upTo) ? upTo : defaults.upTo,
    sort: oneOf(v.sort, SORTS, defaults.sort)
  }
}

export const readFilters = (game: string, defaults: DexFilters, chapterIds: readonly string[]): DexFilters => {
  try { return parseFilters(localStorage.getItem(filtersKey(game)), defaults, chapterIds) } catch { return defaults }
}

export const writeFilters = (game: string, filters: DexFilters) => {
  try { localStorage.setItem(filtersKey(game), JSON.stringify(filters)) } catch { /* storage unavailable */ }
}
