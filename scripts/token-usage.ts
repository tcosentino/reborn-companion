// Tallies Claude Code token usage and estimated cost for this project from the local session transcripts
// (~/.claude/projects/<this repo>*, which also covers subagents, agent worktrees and sessions run in upstream/).
//
// Claude Code deletes transcripts after cleanupPeriodDays (default 30), so results are merged into a committed
// ledger (usage/ledger.json): sessions still on disk are recomputed, sessions whose transcripts are gone are kept.
// usage/README.md is regenerated from the ledger. Run by the Stop hook in .claude/settings.json.
//
// CLI: node scripts/token-usage.ts [--quiet]
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER = join(ROOT, 'usage/ledger.json')
const REPORT = join(ROOT, 'usage/README.md')

/** USD per million tokens. Cache writes: 5m = 1.25x input, 1h = 2x input. */
interface Price { input: number; output: number; cacheRead: number }
export const PRICES: Record<string, Price> = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 }
}
const WEB_SEARCH_USD = 10 / 1000

export interface Tally {
  requests: number
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
  webSearches: number
  costUSD: number
}

/** One session's usage on one UTC day for one model. */
export interface Row extends Tally {
  session: string
  title: string
  source: string
  day: string
  model: string
}

export interface Ledger { updated: string; unpricedModels: string[]; rows: Row[] }

const emptyTally = (): Tally =>
  ({ requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, webSearches: 0, costUSD: 0 })

export const priceFor = (model: string): Price | undefined =>
  PRICES[model] ?? PRICES[model.replace(/-\d{8}$/, '')]

/** Cost of one API response's usage block, or undefined for an unknown model. */
export const costOf = (model: string, u: any): number | undefined => {
  const p = priceFor(model)
  if (!p) return undefined
  const fast = u.speed === 'fast' ? 2 : 1
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0
  const w5m = u.cache_creation?.ephemeral_5m_input_tokens ?? (u.cache_creation_input_tokens ?? 0) - w1h
  const tokens = (u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output +
    (u.cache_read_input_tokens ?? 0) * p.cacheRead + w5m * p.input * 1.25 + w1h * p.input * 2
  return (tokens * fast) / 1e6 + (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD
}

/** Transcript directories belonging to this repo: the repo itself, its subdirs (upstream/) and agent worktrees. */
export const transcriptDirs = (projectsDir: string, root: string): string[] => {
  const prefix = root.replace(/[^A-Za-z0-9]/g, '-')
  if (!existsSync(projectsDir)) return []
  return readdirSync(projectsDir)
    .filter(name => name === prefix || name.startsWith(`${prefix}-`))
    .map(name => join(projectsDir, name))
}

const walkJsonl = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walkJsonl(p)
    return e.name.endsWith('.jsonl') ? [p] : []
  })

const sourceOf = (dir: string, root: string): string => {
  const rest = basename(dir).slice(root.replace(/[^A-Za-z0-9]/g, '-').length)
  if (!rest) return 'main'
  if (rest.includes('-claude-worktrees-')) return 'worktree'
  return rest.replace(/^-+/, '')
}

const PROMPT_CHARS = 80

/** First line of a user message's text, or '' for tool results and harness-injected messages. */
export const promptText = (content: unknown): string => {
  const raw = typeof content === 'string' ? content
    : Array.isArray(content) ? content.find((b: any) => b?.type === 'text')?.text ?? '' : ''
  const text = raw.trim()
  if (!text || text.startsWith('<') || text.startsWith('[Request interrupted')) return ''
  const line = text.split('\n')[0].trim()
  return line.length > PROMPT_CHARS ? `${line.slice(0, PROMPT_CHARS - 1)}…` : line
}

/** Parses transcripts into ledger rows. Responses are deduped by request id across all files (streamed
 * content blocks repeat the same usage, and resumed/forked sessions copy earlier entries). */
export const scan = (dirs: string[], root: string): { rows: Row[]; unpriced: Set<string> } => {
  const seen = new Set<string>()
  const unpriced = new Set<string>()
  const buckets = new Map<string, Row>()
  const titles = new Map<string, string>()
  const prompts = new Map<string, string>()
  const files = dirs.flatMap(dir => walkJsonl(dir).map(file => ({ file, dir })))
    .sort((a, b) => statSync(a.file).mtimeMs - statSync(b.file).mtimeMs)
  for (const { file, dir } of files) {
    // Subagent transcripts live in <session>/subagents/; bill them to the parent session.
    const sub = file.match(/([0-9a-f-]{36})\/subagents\//)
    const fileSession = sub ? sub[1] : basename(file, '.jsonl')
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('"usage"') && !line.includes('"custom-title"') && !(line.includes('"user"') && !prompts.has(fileSession))) continue
      let e: any
      try { e = JSON.parse(line) } catch { continue }
      if (e.type === 'custom-title' && e.customTitle) titles.set(e.sessionId ?? fileSession, e.customTitle)
      // Untitled sessions (headless runs, agents) fall back to their first real prompt
      if (e.type === 'user' && !sub && !e.isMeta && !prompts.has(fileSession)) {
        const text = promptText(e.message?.content)
        if (text) prompts.set(fileSession, text)
      }
      const u = e.message?.usage
      if (e.type !== 'assistant' || !u || !e.message.model || e.message.model === '<synthetic>') continue
      const key = e.requestId ?? e.message.id
      if (!key || seen.has(key)) continue
      seen.add(key)
      const session = sub ? fileSession : (e.sessionId ?? fileSession)
      const model = e.message.model
      const day = (e.timestamp ?? '').slice(0, 10)
      const id = `${session}|${day}|${model}`
      const row = buckets.get(id) ??
        { session, title: '', source: sourceOf(dir, root), day, model, ...emptyTally() }
      const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0
      row.requests++
      row.input += u.input_tokens ?? 0
      row.output += u.output_tokens ?? 0
      row.cacheRead += u.cache_read_input_tokens ?? 0
      row.cacheWrite1h += w1h
      row.cacheWrite5m += (u.cache_creation_input_tokens ?? 0) - w1h
      row.webSearches += u.server_tool_use?.web_search_requests ?? 0
      const cost = costOf(model, u)
      if (cost === undefined) unpriced.add(model)
      else row.costUSD += cost
      buckets.set(id, row)
    }
  }
  const rows = [...buckets.values()].map(r => ({ ...r, title: titles.get(r.session) ?? prompts.get(r.session) ?? r.title }))
  return { rows, unpriced }
}

/** Replaces every ledger row for sessions present in the new scan; keeps rows for sessions no longer on disk. */
export const merge = (prev: Row[], next: Row[]): Row[] => {
  const live = new Set(next.map(r => r.session))
  const prevTitles = new Map(prev.map(r => [r.session, r.title]))
  return [
    ...prev.filter(r => !live.has(r.session)),
    ...next.map(r => ({ ...r, title: r.title || prevTitles.get(r.session) || '' }))
  ].sort((a, b) => a.day.localeCompare(b.day) || a.session.localeCompare(b.session) || a.model.localeCompare(b.model))
}

const add = (a: Tally, b: Tally): Tally => ({
  requests: a.requests + b.requests, input: a.input + b.input, output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead, cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
  cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h, webSearches: a.webSearches + b.webSearches,
  costUSD: a.costUSD + b.costUSD
})

const groupBy = (rows: Row[], key: (r: Row) => string): [string, Tally][] => {
  const m = new Map<string, Tally>()
  for (const r of rows) m.set(key(r), add(m.get(key(r)) ?? emptyTally(), r))
  return [...m.entries()]
}

const n = (x: number): string => {
  if (x >= 1e9) return `${(x / 1e9).toFixed(2)}B`
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)}M`
  if (x >= 1e3) return `${(x / 1e3).toFixed(1)}K`
  return String(x)
}
const usd = (x: number): string => `$${x.toFixed(2)}`
const totalTokens = (t: Tally): number => t.input + t.output + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h

const table = (head: string, rows: [string, Tally][]): string => [
  `| ${head} | Requests | Input | Output | Cache read | Cache write | Total tokens | Est. cost |`,
  '|---|--:|--:|--:|--:|--:|--:|--:|',
  ...rows.map(([k, t]) =>
    `| ${k} | ${n(t.requests)} | ${n(t.input)} | ${n(t.output)} | ${n(t.cacheRead)} | ` +
    `${n(t.cacheWrite5m + t.cacheWrite1h)} | ${n(totalTokens(t))} | ${usd(t.costUSD)} |`)
].join('\n')

export const report = (ledger: Ledger): string => {
  const { rows } = ledger
  const total = rows.reduce<Tally>(add, emptyTally())
  const sessions = new Set(rows.map(r => r.session)).size
  const days = groupBy(rows, r => r.day).sort((a, b) => a[0].localeCompare(b[0]))
  const models = groupBy(rows, r => r.model).sort((a, b) => b[1].costUSD - a[1].costUSD)
  const sources = groupBy(rows, r => r.source).sort((a, b) => b[1].costUSD - a[1].costUSD)
  const titleOf = new Map(rows.map(r => [r.session, r.title]))
  const dayOf = new Map<string, string>()
  for (const r of rows) if (!dayOf.has(r.session)) dayOf.set(r.session, r.day)
  const bySession = groupBy(rows, r => r.session).sort((a, b) => b[1].costUSD - a[1].costUSD)
    .map(([s, t]): [string, Tally] => [`${dayOf.get(s)} ${titleOf.get(s) || s.slice(0, 8)}`.replace(/\|/g, '/'), t])
  let running = 0
  const cumulative = days.map(([d, t]) => `| ${d} | ${usd(t.costUSD)} | ${usd(running += t.costUSD)} |`)
  return [
    '# Claude Code token usage',
    '',
    'Generated by `scripts/token-usage.ts` from local Claude Code transcripts (main repo, `upstream/`, agent worktrees, subagents).',
    'Costs are estimates at API list prices; a subscription plan bills differently. Updated automatically by the Stop hook in `.claude/settings.json`.',
    '',
    `Last updated: ${ledger.updated}`,
    '',
    `**${usd(total.costUSD)}** across **${sessions}** sessions, **${n(total.requests)}** API requests, **${n(totalTokens(total))}** tokens ` +
      `(${n(total.output)} output, ${n(total.cacheRead)} cache reads).`,
    ...(ledger.unpricedModels.length ? ['', `Unpriced models (tokens counted, cost excluded): ${ledger.unpricedModels.join(', ')}`] : []),
    '',
    '## By model',
    '',
    table('Model', models),
    '',
    '## By source',
    '',
    table('Source', sources),
    '',
    '## By day',
    '',
    table('Day (UTC)', days),
    '',
    '## Cumulative cost',
    '',
    '| Day (UTC) | Cost | Running total |',
    '|---|--:|--:|',
    ...cumulative,
    '',
    '## By session',
    '',
    table('Session', bySession),
    ''
  ].join('\n')
}

const main = () => {
  const dirs = transcriptDirs(join(homedir(), '.claude/projects'), ROOT)
  const { rows, unpriced } = scan(dirs, ROOT)
  const prev: Ledger | undefined = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : undefined
  const ledger: Ledger = {
    updated: new Date().toISOString(),
    unpricedModels: [...new Set([...(prev?.unpricedModels ?? []), ...unpriced])].sort(),
    rows: merge(prev?.rows ?? [], rows)
  }
  mkdirSync(dirname(LEDGER), { recursive: true })
  writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 1)}\n`)
  writeFileSync(REPORT, report(ledger))
  if (!process.argv.includes('--quiet')) {
    const cost = ledger.rows.reduce((s, r) => s + r.costUSD, 0)
    console.log(`${ledger.rows.length} rows, ${usd(cost)} total -> ${REPORT}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
