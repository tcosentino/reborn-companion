// Dev/preview server endpoint that writes progress backups to disk. The app POSTs its backup JSON to
// /__backup every 30 minutes (src/lib/autoBackup.ts); identical or empty snapshots are skipped and only
// the newest KEEP files are kept. Not present on a static host, where the client just stops trying.
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Connect, Plugin } from 'vite'

export const KEEP = 50
const PREFIX = 'progress-'

// Sortable local-time name, e.g. progress-2026-10-05T1530.json
export const snapshotName = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${PREFIX}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}.json`
}

// Oldest first, so callers can drop from the front
export const snapshots = (files: string[]) => files.filter(f => f.startsWith(PREFIX) && f.endsWith('.json')).sort()

export const toPrune = (files: string[], keep = KEEP) => {
  const list = snapshots(files)
  return list.slice(0, Math.max(0, list.length - keep))
}

// Data only, so a new exportedAt alone does not count as a change
const dataOf = (json: string) => {
  try { return JSON.stringify(JSON.parse(json).data) } catch { return null }
}

export const isEmpty = (json: string) => {
  try { return Object.keys(JSON.parse(json).data ?? {}).length === 0 } catch { return true }
}

export const saveSnapshot = (dir: string, body: string, now = new Date()): { saved: boolean; file: string | null } => {
  if (isEmpty(body)) return { saved: false, file: null }
  mkdirSync(dir, { recursive: true })
  const list = snapshots(readdirSync(dir))
  const latest = list.at(-1)
  if (latest && dataOf(readFileSync(join(dir, latest), 'utf8')) === dataOf(body)) return { saved: false, file: latest }
  const file = snapshotName(now)
  writeFileSync(join(dir, file), body)
  toPrune(readdirSync(dir)).forEach(f => unlinkSync(join(dir, f)))
  return { saved: true, file }
}

const middleware = (dir: string): Connect.NextHandleFunction => (req, res, next) => {
  if (req.url !== '/__backup' || req.method !== 'POST') return next()
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    try {
      const result = saveSnapshot(dir, body)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (e) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: (e as Error).message }))
    }
  })
}

export const backupPlugin = (dir: string): Plugin => ({
  name: 'pokeguide-backup',
  configureServer: server => { server.middlewares.use(middleware(dir)) },
  configurePreviewServer: server => { server.middlewares.use(middleware(dir)) }
})
