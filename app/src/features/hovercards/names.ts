import type { Dex, Sym } from '../../data/types'

/** Case-insensitive key: straight/curly quotes unified, accents dropped (Poké = Poke), spaces collapsed. */
export const normalizeName = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export interface NameMaps { species: Map<string, Sym>; items: Map<string, Sym> }

const toMap = (entries: Record<Sym, { name: string }>) => {
  const m = new Map<string, Sym>()
  for (const [sym, e] of Object.entries(entries)) {
    const key = normalizeName(e.name)
    if (!m.has(key)) m.set(key, sym)
  }
  return m
}

const cache = new WeakMap<Dex, NameMaps>()

/** Built once per dex object. */
export const nameMaps = (dex: Dex): NameMaps => {
  let maps = cache.get(dex)
  if (!maps) {
    maps = { species: toMap(dex.species), items: toMap(dex.items) }
    cache.set(dex, maps)
  }
  return maps
}

export type LinkKind = 'species' | 'item'

/** The guide marks items in *italics* and Pokemon in **bold**. */
export const matchMarked = (maps: NameMaps, tag: 'EM' | 'STRONG', text: string): { kind: LinkKind; sym: Sym } | null => {
  const key = normalizeName(text)
  if (!key) return null
  const [kind, map] = tag === 'EM' ? (['item', maps.items] as const) : (['species', maps.species] as const)
  const sym = map.get(key)
  return sym ? { kind, sym } : null
}

/** Mark matching <em>/<strong> elements under root as hover triggers. Returns counts. */
export const linkProse = (root: ParentNode, maps: NameMaps) => {
  let matched = 0
  let total = 0
  root.querySelectorAll<HTMLElement>('em, strong').forEach(el => {
    total++
    if (el.dataset.hcKind) { matched++; return }
    const hit = matchMarked(maps, el.tagName as 'EM' | 'STRONG', el.textContent ?? '')
    if (!hit) return
    matched++
    el.dataset.hcKind = hit.kind
    el.dataset.hcSym = hit.sym
    el.tabIndex = 0
    el.classList.add('hc-trigger', 'hc-prose')
  })
  return { matched, total }
}
