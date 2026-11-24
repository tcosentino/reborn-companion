// Project backlog: one Markdown file per item in backlog/ (open or blocked) and backlog/done/ (closed).
// Agents add items they find but should not fix now; see backlog/README.md for the format.
//
// CLI: node scripts/backlog.ts [list] [--all]                 open items by priority (--all includes done)
//      node scripts/backlog.ts add "<title>" [--area a] [--priority p]   create backlog/<slug>.md, print its path
//      node scripts/backlog.ts done <slug>                     mark done and move to backlog/done/
//      node scripts/backlog.ts check                           validate every item's frontmatter
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'backlog')
const DONE = join(DIR, 'done')

export const STATUSES = ['open', 'blocked', 'done'] as const
export const PRIORITIES = ['high', 'normal', 'low'] as const
const REQUIRED = ['title', 'status', 'priority', 'area', 'created'] as const

export type Item = { slug: string; meta: Record<string, string>; body: string; done: boolean }

export const slugify = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '')

export const parse = (text: string): { meta: Record<string, string>; body: string } => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: text }
  const meta = Object.fromEntries(m[1].split('\n')
    .map(line => line.match(/^([a-z-]+):\s*(.*)$/))
    .filter((x): x is RegExpMatchArray => x !== null)
    .map(([, k, v]) => [k, v.trim()]))
  return { meta, body: m[2] }
}

export const serialize = (meta: Record<string, string>, body: string): string =>
  `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}`

export const problems = (item: Item): string[] => [
  ...REQUIRED.filter(k => !item.meta[k]).map(k => `missing ${k}`),
  ...(item.meta.status && !STATUSES.includes(item.meta.status as never) ? [`bad status ${item.meta.status}`] : []),
  ...(item.meta.priority && !PRIORITIES.includes(item.meta.priority as never) ? [`bad priority ${item.meta.priority}`] : []),
  ...(item.meta.created && !/^\d{4}-\d{2}-\d{2}$/.test(item.meta.created) ? ['created is not YYYY-MM-DD'] : []),
  ...(item.done !== (item.meta.status === 'done') ? [item.done ? 'in done/ but status is not done' : 'status done but not in done/'] : [])
].map(p => `${item.done ? 'done/' : ''}${item.slug}.md: ${p}`)

const rank = (item: Item) => PRIORITIES.indexOf(item.meta.priority as never) * 2 + (item.meta.status === 'blocked' ? 1 : 0)

export const sortItems = (items: Item[]): Item[] =>
  [...items].sort((a, b) => rank(a) - rank(b) || a.meta.created.localeCompare(b.meta.created) || a.slug.localeCompare(b.slug))

const readDir = (dir: string, done: boolean): Item[] =>
  existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md')
      .map(f => ({ slug: f.slice(0, -3), done, ...parse(readFileSync(join(dir, f), 'utf8')) }))
    : []

const today = () => new Date().toISOString().slice(0, 10)

const flag = (args: string[], name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const list = (all: boolean) => {
  const items = sortItems([...readDir(DIR, false), ...(all ? readDir(DONE, true) : [])])
  if (!items.length) return console.log('backlog is empty')
  for (const { slug, meta } of items) {
    const tag = meta.status === 'open' ? meta.priority : `${meta.priority}, ${meta.status}`
    console.log(`[${tag}] ${slug}  (${meta.area}) ${meta.title}`)
  }
}

const add = (title: string, area = 'misc', priority = 'normal') => {
  if (!PRIORITIES.includes(priority as never)) throw new Error(`priority must be one of ${PRIORITIES.join(', ')}`)
  const slug = slugify(title)
  const path = join(DIR, `${slug}.md`)
  if (existsSync(path) || existsSync(join(DONE, `${slug}.md`))) throw new Error(`backlog/${slug}.md already exists`)
  const meta = { title, status: 'open', priority, area, created: today() }
  writeFileSync(path, serialize(meta, '\n## Context\n\nTODO: what you saw, where (file:line, section id), why it matters.\n\n## Done when\n\nTODO\n'))
  console.log(`backlog/${slug}.md`)
}

const done = (slug: string) => {
  const from = join(DIR, `${slug}.md`)
  if (!existsSync(from)) throw new Error(`backlog/${slug}.md not found`)
  const { meta, body } = parse(readFileSync(from, 'utf8'))
  const to = join(DONE, `${slug}.md`)
  mkdirSync(DONE, { recursive: true })
  renameSync(from, to)
  writeFileSync(to, serialize({ ...meta, status: 'done', closed: today() }, body))
  console.log(`backlog/done/${slug}.md`)
}

const check = () => {
  const errors = [...readDir(DIR, false), ...readDir(DONE, true)].flatMap(problems)
  errors.forEach(e => console.error(e))
  if (errors.length) process.exit(1)
  console.log('backlog ok')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd = 'list', ...args] = process.argv.slice(2)
  if (cmd === 'list' || cmd === '--all') list(cmd === '--all' || args.includes('--all'))
  else if (cmd === 'add' && args[0]) add(args[0], flag(args, 'area'), flag(args, 'priority'))
  else if (cmd === 'done' && args[0]) done(args[0])
  else if (cmd === 'check') check()
  else {
    console.error('usage: node scripts/backlog.ts [list [--all] | add "<title>" [--area a] [--priority p] | done <slug> | check]')
    process.exit(1)
  }
}
