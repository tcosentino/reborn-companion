// Small fuzzy scorer and grouped ranking for the command palette.
// Tiers (higher always wins): exact > prefix > word-boundary > all-words-prefix > substring > subsequence.

export type Kind = 'section' | 'trainer' | 'species' | 'item' | 'move'

export const KINDS: Kind[] = ['section', 'trainer', 'species', 'item', 'move']

export const KIND_LABEL: Record<Kind, string> = {
  section: 'Sections', trainer: 'Trainers', species: 'Pokemon', item: 'Items', move: 'Moves'
}

export const DEFAULT_CAPS: Record<Kind, number> = { section: 5, trainer: 8, species: 6, item: 6, move: 5 }
// A scoped search shows one or two groups, so it can list more
export const SCOPED_CAP = 30

// Query prefixes that restrict results to one kind: "t: julia", "m:iron"
export const SCOPES: { prefix: string; kind: Kind; label: string }[] = [
  { prefix: 't', kind: 'trainer', label: 'trainer' },
  { prefix: 'p', kind: 'species', label: 'Pokemon' },
  { prefix: 'i', kind: 'item', label: 'item' },
  { prefix: 'm', kind: 'move', label: 'move/TM' },
  { prefix: 's', kind: 'section', label: 'section' }
]

export interface Scoped { scope: Kind | null; query: string }

export const parseScope = (raw: string): Scoped => {
  const m = /^\s*([a-z]):\s*/i.exec(raw)
  const hit = m && SCOPES.find(s => s.prefix === m[1].toLowerCase())
  return hit ? { scope: hit.kind, query: raw.slice(m[0].length) } : { scope: null, query: raw }
}

export interface Entry {
  kind: Kind
  // Row index into the matching search-index table
  ref: number
  // Normalized searchable strings; the first is the primary label
  terms: string[]
  // Small tie-breaker added to the score (e.g. species that appear in the guide)
  boost?: number
  // A second scope this entry belongs to (TM items show up under the move scope)
  also?: Kind
}

export interface Hit { entry: Entry; score: number }
export interface Group { kind: Kind; hits: Hit[]; total: number }

export const normalize = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c)

const wordStarts = (t: string) => {
  const out: number[] = []
  for (let i = 0; i < t.length; i++) if (isWordChar(t[i]) && !isWordChar(t[i - 1])) out.push(i)
  return out
}

// Greedy subsequence match starting at one position of the first character
const subseqFrom = (needle: string, t: string, start: number): number => {
  let prev = start
  let runs = 0
  let starts = isWordChar(t[start - 1]) ? 0 : 1
  for (let k = 1; k < needle.length; k++) {
    const at = t.indexOf(needle[k], prev + 1)
    if (at < 0) return 0
    if (at === prev + 1) runs++
    if (!isWordChar(t[at - 1])) starts++
    prev = at
  }
  const span = prev - start + 1
  if (span > needle.length * 2 + 3) return 0
  const contiguity = runs / (needle.length - 1)
  return Math.max(1, Math.round(100 + 120 * contiguity + 60 * (starts / needle.length) - Math.min(start, 20) - (span - needle.length)))
}

// Best alignment over the first few occurrences of the needle's first character
const subsequence = (q: string, t: string): number => {
  const needle = q.replace(/ /g, '')
  if (needle.length < 2) return 0
  let best = 0
  for (let i = t.indexOf(needle[0]), tries = 0; i >= 0 && tries < 8; i = t.indexOf(needle[0], i + 1), tries++) {
    const s = subseqFrom(needle, t, i)
    if (s > best) best = s
  }
  return Math.min(best, 300)
}

// Score one normalized query against one normalized term. 0 = no match.
export const score = (q: string, t: string): number => {
  if (!q || !t) return 0
  if (t === q) return 1000
  const extra = Math.min(t.length - q.length, 99)
  if (t.startsWith(q)) return 900 - extra
  const starts = wordStarts(t)
  const wb = starts.find(i => t.startsWith(q, i))
  if (wb !== undefined) return 750 - Math.min(wb, 50) - Math.floor(extra / 8)
  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length > 1) {
    const words = starts.map(i => t.slice(i))
    if (tokens.every(tok => words.some(w => w.startsWith(tok)))) return 600 - Math.floor(extra / 8)
  }
  const sub = t.indexOf(q)
  if (sub >= 0) return 500 - Math.min(sub, 50) - Math.floor(extra / 8)
  return subsequence(q, t)
}

export const scoreEntry = (q: string, e: Entry) => {
  let best = 0
  for (const t of e.terms) {
    const s = score(q, t)
    if (s > best) best = s
  }
  return best ? best + (e.boost ?? 0) : 0
}

// Rank entries for a query, grouped by kind. Groups are ordered by their best hit
// (ties fall back to KINDS order), hits inside a group by score then index order.
// A scope prefix (see SCOPES) limits the kinds searched and lifts the caps.
export const search = (entries: Entry[], query: string, caps: Record<Kind, number> = DEFAULT_CAPS): Group[] => {
  const { scope, query: rest } = parseScope(query)
  const q = normalize(rest)
  if (!q) return []
  const cap = (k: Kind) => scope ? SCOPED_CAP : caps[k]
  const byKind = new Map<Kind, Hit[]>()
  for (const entry of entries) {
    if (scope && entry.kind !== scope && entry.also !== scope) continue
    const s = scoreEntry(q, entry)
    if (!s) continue
    const list = byKind.get(entry.kind)
    if (list) list.push({ entry, score: s })
    else byKind.set(entry.kind, [{ entry, score: s }])
  }
  const groups: Group[] = []
  for (const kind of KINDS) {
    const hits = byKind.get(kind)
    if (!hits) continue
    hits.sort((a, b) => b.score - a.score || a.entry.ref - b.entry.ref)
    groups.push({ kind, hits: hits.slice(0, cap(kind)), total: hits.length })
  }
  return groups.sort((a, b) => b.hits[0].score - a.hits[0].score || KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
}
