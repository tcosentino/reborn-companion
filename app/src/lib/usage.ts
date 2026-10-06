// Claude Code token usage for building this project, read from usage/ledger.json (written by scripts/token-usage.ts).

export interface UsageRow {
  session: string
  title: string
  source: string
  day: string
  model: string
  requests: number
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
  webSearches: number
  costUSD: number
  /** costUSD split by component; absent on rows written before the split was recorded */
  costOutput?: number
  costCacheRead?: number
  costCacheWrite?: number
  /** Tallied from subagent transcripts, billed to the parent session */
  subagent?: true
}

export interface UsageLedger { updated: string; unpricedModels: string[]; rows: UsageRow[] }

export interface ChatUsage {
  session: string
  title: string
  source: string
  firstDay: string
  lastDay: string
  costUSD: number
  tokens: number
  output: number
  requests: number
  /** Cost of subagents launched from this chat */
  subagentUSD: number
  /** Average tokens sent per main-thread request (input + cache read + cache write) */
  avgContext: number
  /** Cost per model, most expensive first */
  models: [string, number][]
}

export interface CostSplit { cacheRead: number; cacheWrite: number; output: number; other: number }

export interface ThreadUsage { costUSD: number; requests: number; avgContext: number }

export interface DayUsage { day: string; costUSD: number; cumulativeUSD: number }

const tokensOf = (r: UsageRow) => r.input + r.output + r.cacheRead + r.cacheWrite5m + r.cacheWrite1h
/** Tokens the model read for these requests: everything but output */
const contextOf = (r: UsageRow) => r.input + r.cacheRead + r.cacheWrite5m + r.cacheWrite1h

const thread = (rows: UsageRow[]): ThreadUsage => {
  const requests = rows.reduce((s, r) => s + r.requests, 0)
  return {
    costUSD: rows.reduce((s, r) => s + r.costUSD, 0),
    requests,
    avgContext: requests ? rows.reduce((s, r) => s + contextOf(r), 0) / requests : 0
  }
}

/** Main thread vs subagents: cost, requests and average context per request */
export const threads = (rows: UsageRow[]) => ({
  main: thread(rows.filter(r => !r.subagent)),
  subagents: thread(rows.filter(r => r.subagent))
})

/** Where the cost went. Rows without a recorded split land in other, along with input and web search. */
export const costSplit = (rows: UsageRow[]): CostSplit => {
  const sum = (f: (r: UsageRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const cacheRead = sum(r => r.costCacheRead ?? 0)
  const cacheWrite = sum(r => r.costCacheWrite ?? 0)
  const output = sum(r => r.costOutput ?? 0)
  return { cacheRead, cacheWrite, output, other: Math.max(0, sum(r => r.costUSD) - cacheRead - cacheWrite - output) }
}

/** Short model label: claude-opus-5-5 -> Opus 5.5, claude-haiku-4-5-20251001 -> Haiku 4.5 */
export const modelLabel = (model: string): string => {
  const m = model.match(/^claude-([a-z]+)-(\d+)(?:-(\d))?(?:-\d{8})?$/)
  if (!m) return model
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}`
}

export const chats = (rows: UsageRow[]): ChatUsage[] => {
  type Acc = ChatUsage & { modelCost: Map<string, number>; mainContext: number; mainRequests: number }
  const by = new Map<string, Acc>()
  for (const r of rows) {
    const c: Acc = by.get(r.session) ?? {
      session: r.session, title: r.title, source: r.source, firstDay: r.day, lastDay: r.day,
      costUSD: 0, tokens: 0, output: 0, requests: 0, subagentUSD: 0, avgContext: 0, models: [], modelCost: new Map(),
      mainContext: 0, mainRequests: 0
    }
    c.title ||= r.title
    if (r.day < c.firstDay) c.firstDay = r.day
    if (r.day > c.lastDay) c.lastDay = r.day
    c.costUSD += r.costUSD
    c.tokens += tokensOf(r)
    c.output += r.output
    c.requests += r.requests
    if (r.subagent) c.subagentUSD += r.costUSD
    else {
      c.mainContext += contextOf(r)
      c.mainRequests += r.requests
    }
    const label = modelLabel(r.model)
    c.modelCost.set(label, (c.modelCost.get(label) ?? 0) + r.costUSD)
    by.set(r.session, c)
  }
  return [...by.values()].map(({ modelCost, mainContext, mainRequests, ...c }) => ({
    ...c,
    avgContext: mainRequests ? mainContext / mainRequests : 0,
    models: [...modelCost].sort((a, b) => b[1] - a[1])
  }))
}

export const days = (rows: UsageRow[]): DayUsage[] => {
  const by = new Map<string, number>()
  for (const r of rows) by.set(r.day, (by.get(r.day) ?? 0) + r.costUSD)
  let running = 0
  return [...by].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, costUSD]) => ({ day, costUSD, cumulativeUSD: running += costUSD }))
}

export const totals = (rows: UsageRow[]) => ({
  costUSD: rows.reduce((s, r) => s + r.costUSD, 0),
  tokens: rows.reduce((s, r) => s + tokensOf(r), 0),
  output: rows.reduce((s, r) => s + r.output, 0),
  chats: new Set(rows.map(r => r.session)).size
})

export const usd = (x: number) => x >= 100 ? `$${x.toFixed(0)}` : `$${x.toFixed(2)}`

export const compact = (x: number): string =>
  x >= 1e9 ? `${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}K` : String(x)
