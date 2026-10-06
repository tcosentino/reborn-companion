// Shared plumbing for the build steps that draw game map crops into guide cards (apply-routes.ts,
// apply-hidden-maps.ts, apply-item-maps.ts): per-section definition files and cached PNG renders.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Chapter, GuideIndex } from '../app/src/data/types'

// <dir>/<section-id>.json files as section id -> parsed array
export const readSectionDefs = <T>(dir: string): Map<string, T[]> => new Map(existsSync(dir)
  ? readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => [f.slice(0, -5), JSON.parse(readFileSync(join(dir, f), 'utf8'))])
  : [])

// Writes <imgDir>/<file> with render() unless the stamp next to it (<file>.v) already holds the hash of `inputs`.
// Returns the hash, used as a cache-busting ?v= on the image URL.
export const renderCached = (imgDir: string, file: string, inputs: (string | Uint8Array)[], render: () => Uint8Array): string => {
  const h = createHash('sha1')
  inputs.forEach(i => h.update(i))
  const hash = h.digest('hex').slice(0, 10)
  const stamp = join(imgDir, `${file}.v`)
  if (!existsSync(join(imgDir, file)) || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== hash) {
    mkdirSync(imgDir, { recursive: true })
    writeFileSync(join(imgDir, file), render())
    writeFileSync(stamp, hash)
  }
  return hash
}

// Drops renders (and their stamps) that no card uses any more
export const pruneRenders = (imgDir: string, keep: Set<string>) => {
  if (!existsSync(imgDir)) return
  readdirSync(imgDir).filter(f => !keep.has(f.replace(/\.v$/, ''))).forEach(f => rmSync(join(imgDir, f)))
}

// Every generated chapter of a game with its file path, for read-modify-write passes over out/json/<game>/
export const loadChapters = (out: string) => {
  const guide: GuideIndex = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))
  return guide.chapters.map(c => ({ id: c.id, file: join(out, c.file), chapter: JSON.parse(readFileSync(join(out, c.file), 'utf8')) as Chapter }))
}
