import type { EncounterMethod, EncounterRow, Sym } from '../../data/types'

export interface GridRow {
  species: Sym
  form: string | null
  displayName: string
  firstSeen: boolean
  levels: string
  // One entry per time column for a timed method, a single entry otherwise
  rates: (number | null)[]
}
export interface GridGroup { method: string; label: string; timed: boolean; rows: GridRow[] }
export interface EncounterGrid { times: string[]; groups: GridGroup[] }

const METHOD_LABELS: Record<string, string> = {
  'Fishing-Old': 'Old Rod',
  'Fishing-Good': 'Good Rod',
  'Fishing-Super': 'Super Rod',
  Surfing: 'Surf'
}

const TIME_ORDER = ['Morning', 'Day', 'Night']
const timeRank = (t: string) => (TIME_ORDER.indexOf(t) + TIME_ORDER.length + 1) % (TIME_ORDER.length + 1)

// Morning/Day/Night tables are often identical; collapse them into one untimed table
export const collapseTimes = (methods: EncounterMethod[]): EncounterMethod[] => {
  const out: EncounterMethod[] = []
  for (const m of methods) {
    const sibs = methods.filter(x => x.method === m.method)
    const same = sibs.length > 1 && sibs.every(s => JSON.stringify(s.rows) === JSON.stringify(sibs[0].rows))
    if (same) {
      if (!out.some(o => o.method === m.method)) out.push({ ...m, time: null })
    } else out.push(m)
  }
  return out
}

const keyOf = (r: EncounterRow) => `${r.species}|${r.form ?? ''}`
const total = (r: GridRow) => r.rates.reduce<number>((s, x) => s + (x ?? 0), 0)

// Merge one method's tables into one row per Pokemon, with a rate per column
const mergeRows = (tables: { col: number; rows: EncounterRow[] }[], width: number): GridRow[] => {
  const byKey = new Map<string, GridRow & { min: number; max: number }>()
  for (const { col, rows } of tables) {
    for (const r of rows) {
      const k = keyOf(r)
      const row = byKey.get(k) ?? {
        species: r.species, form: r.form, displayName: r.displayName, firstSeen: false,
        levels: '', rates: Array<number | null>(width).fill(null), min: r.minLevel, max: r.maxLevel
      }
      row.firstSeen ||= r.firstSeen
      row.min = Math.min(row.min, r.minLevel)
      row.max = Math.max(row.max, r.maxLevel)
      row.rates[col] = (row.rates[col] ?? 0) + r.rate
      byKey.set(k, row)
    }
  }
  return [...byKey.values()]
    .map(({ min, max, ...r }) => ({ ...r, levels: min === max ? `${min}` : `${min}-${max}` }))
    .sort((a, z) => total(z) - total(a) || a.displayName.localeCompare(z.displayName))
}

// Rows grouped by method; only time of day becomes columns, since that is where the same
// Pokemon recur. Methods differ in who appears, so separate columns would be mostly empty.
export const buildEncounterGrid = (methods: EncounterMethod[]): EncounterGrid => {
  const tables = collapseTimes(methods)
  const times = [...new Set(tables.flatMap(t => (t.time ? [t.time] : [])))].sort((a, z) => timeRank(a) - timeRank(z))
  const order = [...new Set(tables.map(t => t.method))]
  const groups = order.map(method => {
    const own = tables.filter(t => t.method === method)
    const timed = own.some(t => t.time)
    const rows = timed
      ? mergeRows(own.map(t => ({ col: times.indexOf(t.time ?? ''), rows: t.rows })), times.length)
      : mergeRows(own.map(t => ({ col: 0, rows: t.rows })), 1)
    return { method, label: METHOD_LABELS[method] ?? method, timed, rows }
  })
  return { times, groups }
}
