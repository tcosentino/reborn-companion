import type { TierList } from '../types'

// Curated tier lists, one JSON file per game id. A game without one falls back to stat estimates.
const files = import.meta.glob<TierList>('./*.json', { eager: true, import: 'default' })

export const tierList = (game: string): TierList | null => files[`./${game}.json`] ?? null
