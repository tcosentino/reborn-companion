// Resolves a battle's field to field symbols. Most battles carry a symbol directly; a few
// (about a dozen) only carry free text such as "Rainbow Field atop Rocky Field".

export type FieldRelation = 'single' | 'layered' | 'either'

export interface ResolvedField {
  // Symbols in display order. For 'layered' the first is the top layer (the active one).
  symbols: string[]
  relation: FieldRelation
  // Pieces of the free text we could not match to a symbol (ignoring "No Field")
  unmatched: string[]
}

type NameMap = Record<string, { name: string }>

const normalize = (s: string) =>
  s.toLowerCase().replace(/['’]/g, '').replace(/\b(field|terrain|arena|the)\b/g, ' ').replace(/[^a-z0-9]+/g, '')

const NONE = /^(no|none)(\s+field)?$/i

export const matchFieldName = (text: string, names: NameMap): string | null => {
  const q = normalize(text)
  if (!q) return null
  const entries = Object.entries(names).map(([sym, f]) => [sym, normalize(f.name)] as const)
  // First entry wins when several symbols share a name (the Flower Garden stages)
  const exact = entries.find(([, n]) => n === q)
  if (exact) return exact[0]
  // Abbreviated names, e.g. "Murkwater Field" for "Murkwater Surface"
  if (q.length >= 4) {
    const prefixed = entries.filter(([, n]) => n.startsWith(q))
    if (prefixed.length === 1) return prefixed[0][0]
  }
  return null
}

const matchAll = (parts: string[], names: NameMap) => {
  const symbols: string[] = []
  const unmatched: string[] = []
  for (const part of parts.map(p => p.trim()).filter(Boolean)) {
    if (NONE.test(part)) continue
    const sym = matchFieldName(part, names)
    if (sym) { if (!symbols.includes(sym)) symbols.push(sym) } else unmatched.push(part)
  }
  return { symbols, unmatched }
}

export const resolveField = (
  field: string | null,
  fieldName: string | null,
  names: NameMap
): ResolvedField | null => {
  if (field) return { symbols: [field], relation: 'single', unmatched: [] }
  if (!fieldName) return null
  const either = fieldName.split(/\s+OR\s+/)
  if (either.length > 1) return { ...matchAll(either, names), relation: 'either' }
  const layers = fieldName.split(/\s+(?:atop|upon|on top of)\s+/i)
  if (layers.length > 1) {
    const { symbols, unmatched } = matchAll(layers, names)
    return { symbols, unmatched, relation: symbols.length > 1 ? 'layered' : 'single' }
  }
  return { ...matchAll([fieldName], names), relation: 'single' }
}
