// Pure helpers for guide navigation: whole-guide progress, "my spot", the block in view
// and the "On this page" list. Rendering lives in features/guide-nav/.
import type { DexLocation, Sym } from '../data/types'
import type { BattleRef } from './sectionBattles'

export interface Tally { beaten: number; total: number }

export const tally = (refs: BattleRef[] | undefined, done: Record<string, true>): Tally => ({
  beaten: (refs ?? []).filter(([id]) => done[id]).length,
  total: refs?.length ?? 0
})

// A section's checklist entries for whole-guide progress: its battles, then its walkthrough tasks
export const progressRefs = (battles: Record<string, BattleRef[]>, tasks: Record<string, BattleRef[]> | undefined, id: string): BattleRef[] | undefined =>
  tasks?.[id] ? [...(battles[id] ?? []), ...tasks[id]] : battles[id]

export const sumTallies = (ts: Tally[]): Tally =>
  ts.reduce((a, t) => ({ beaten: a.beaten + t.beaten, total: a.total + t.total }), { beaten: 0, total: 0 })

// Section id -> species listed there (encounter tables and shops), from pokedex.json locations
export const sectionSpecies = (species: Record<Sym, { locations: Pick<DexLocation, 'sectionId'>[] }>): Record<string, Sym[]> => {
  const out: Record<string, Set<Sym>> = {}
  for (const [sym, s] of Object.entries(species)) for (const l of s.locations) (out[l.sectionId] ??= new Set()).add(sym)
  return Object.fromEntries(Object.entries(out).map(([id, set]) => [id, [...set]]))
}

// Caught out of the distinct species across the given sections (a species listed twice counts once)
export const caughtTally = (lists: (Sym[] | undefined)[], caught: Record<string, true>): Tally => {
  const all = new Set(lists.flatMap(l => l ?? []))
  return { beaten: [...all].filter(s => caught[s]).length, total: all.size }
}

export const nextUnbeaten = (refs: BattleRef[] | undefined, done: Record<string, true>) =>
  refs?.find(([id]) => !done[id])

// Index (into `order`) of the furthest section with at least one beaten battle, or -1
export const furthestBeaten = (order: string[], battles: Record<string, BattleRef[]>, done: Record<string, true>) =>
  order.findLastIndex(id => battles[id]?.some(([b]) => done[b]))

// Where the player is: the first unbeaten battle at or after the furthest section with progress.
// Falls back to that section's top when everything after it is beaten. Null before any progress.
export const mySpot = (order: string[], battles: Record<string, BattleRef[]>, done: Record<string, true>) => {
  const from = furthestBeaten(order, battles, done)
  if (from < 0) return null
  for (const id of order.slice(from)) {
    const next = nextUnbeaten(battles[id], done)
    if (next) return { section: id, anchor: `battle-${next[0]}`, label: next[1] }
  }
  return { section: order[from], anchor: null, label: null }
}

// The block being read: the last anchor whose top has scrolled above `line` (px from the viewport top)
export const anchorAt = (tops: [string, number][], line: number): string | null =>
  tops.reduce<string | null>((cur, [id, top]) => top <= line ? id : cur, null)

export type PageKind = 'battle' | 'encounters' | 'shop' | 'tutor' | 'task'

export interface PageItem { id: string; kind: PageKind; label: string; beaten?: boolean }

interface PageBlock {
  type: string
  partner?: boolean
  // Task blocks: progress key
  id?: string
  name?: string
  title?: string
  trainers?: { name: string; title: string; teamId: [string, string, number] }[]
}

const KINDS = new Set(['battle', 'encounters', 'shop', 'tutor', 'task'])

// One entry per anchored block, in page order. Partner battles have no beaten state; tasks use it for done.
export const pageItems = (blocks: PageBlock[], anchors: (string | null)[], done: Record<string, true>): PageItem[] =>
  blocks.flatMap<PageItem>((b, i) => {
    const id = anchors[i]
    if (!id || !KINDS.has(b.type)) return []
    const kind = b.type as PageKind
    if (kind === 'battle') {
      const label = (b.trainers ?? []).map(t => `${t.title} ${t.name}`).join(' & ')
      return [{ id, kind, label: b.partner ? `Partner: ${label}` : label, beaten: b.partner ? undefined : !!done[id.slice('battle-'.length)] }]
    }
    if (kind === 'task') return [{ id, kind, label: b.title ?? '', beaten: !!(b.id && done[b.id]) }]
    return [{ id, kind, label: b.name ?? b.title ?? '' }]
  })
