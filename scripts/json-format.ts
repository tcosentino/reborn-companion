// Compact house style for routes/<game>/*.json and item-maps/<game>/*.json: 2-space indent, scalars and short arrays
// inline, each point / item object on one line (used by `maps.ts fmt`).
const inline = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(inline).join(', ')}]`
  : v && typeof v === 'object' ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }`
  : JSON.stringify(v)

const card = (d: Record<string, unknown>) => `  {\n${Object.entries(d).map(([k, v]) =>
  Array.isArray(v) && v.some(x => x && typeof x === 'object' && !Array.isArray(x))
    ? `    ${JSON.stringify(k)}: [\n${v.map(x => `      ${inline(x)}`).join(',\n')}\n    ]`
    : `    ${JSON.stringify(k)}: ${inline(v)}`).join(',\n')}\n  }`

export const compactJson = (defs: Record<string, unknown>[]): string =>
  defs.length ? `[\n${defs.map(card).join(',\n')}\n]\n` : '[]\n'
