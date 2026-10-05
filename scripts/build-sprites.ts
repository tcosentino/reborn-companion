// Extracts Pokemon front sprites (normal + shiny) and party icons from the Reborn zip and
// writes the sprite manifest. Sprites are local-only (gitignored); never commit them.
//
// Usage (node >= 23.6 runs .ts directly; needs `unzip`):
//   node scripts/build-sprites.ts <spritesOutDir> [zipPath] [dexJsonPath]
// Defaults: zip ~/Downloads/Reborn-19.5.0-macos.zip, dex out/json/reborn/dex.json (main checkout).
// <spritesOutDir> is e.g. /abs/main/app/public/sprites/reborn. The manifest is written next to the
// dex JSON (out/json/reborn/sprites.json) so scripts/sync-data.sh carries it into app/public/data.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { cropPng } from './png-crop.ts'
import { battlerSource, iconSource, type Dims, type SpriteSource } from '../app/src/components/dex/spriteMap.ts'

interface DexForm { name?: string }
interface DexJson { species: Record<string, { name: string; forms: Record<string, DexForm> }> }
interface ManifestForm { name?: string; front?: string; shiny?: string; icon?: string; frames?: number; w: number; h: number }

const [outArg, zipArg, dexArg] = process.argv.slice(2)
if (!outArg) {
  console.error('usage: node scripts/build-sprites.ts <spritesOutDir> [zipPath] [dexJsonPath]')
  process.exit(1)
}
const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const mainRoot = '/Users/troycosentino/Claude-Experiments/pokemon-rebor'
const outDir = resolve(outArg)
const zip = zipArg ?? join(homedir(), 'Downloads', 'Reborn-19.5.0-macos.zip')
const dexPath = dexArg ?? [join(root, 'out/json/reborn/dex.json'), join(mainRoot, 'out/json/reborn/dex.json')].find(existsSync)!
const manifestPath = join(dirname(dexPath), 'sprites.json')
const prefix = 'Reborn.app/Contents/Game/Graphics'

const scratch = mkdtempSync(join(tmpdir(), 'reborn-sprites-'))
execFileSync('unzip', ['-q', '-o', zip, `${prefix}/Battlers/*`, `${prefix}/Icons/*`, '-d', scratch])

// Width/height straight from the PNG IHDR chunk.
const pngDims = (file: string): Dims => {
  const b = readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}
const index = (dir: string): Map<string, Dims> =>
  new Map(readdirSync(dir).filter(f => f.endsWith('.png')).map(f => [f, pngDims(join(dir, f))]))

const battlerDir = join(scratch, prefix, 'Battlers')
const iconDir = join(scratch, prefix, 'Icons')
const battlers = index(battlerDir)
const icons = index(iconDir)

const emit = (srcDir: string, src: SpriteSource, dest: string): Dims => {
  mkdirSync(dirname(dest), { recursive: true })
  const from = join(srcDir, src.file)
  if (!src.crop) {
    copyFileSync(from, dest)
    return pngDims(dest)
  }
  const { x, y, w, h } = src.crop
  writeFileSync(dest, cropPng(readFileSync(from), x, y, w, h))
  return { w, h }
}

const dex = JSON.parse(readFileSync(dexPath, 'utf8')) as DexJson
rmSync(outDir, { recursive: true, force: true })
const manifest: Record<string, Record<string, ManifestForm>> = {}
const missing: string[] = []
const rel = (kind: string, sym: string, form: string) => `sprites/reborn/${kind}/${sym.toLowerCase()}_${form}.png`
const abs = (p: string) => join(outDir, p.replace('sprites/reborn/', ''))

for (const [sym, sp] of Object.entries(dex.species)) {
  for (const [formKey, form] of Object.entries(sp.forms)) {
    const idx = Number(formKey)
    const entry: ManifestForm = { name: form.name, w: 0, h: 0 }
    const front = battlerSource(sym, idx, false, battlers)
    if (front) {
      entry.front = rel('front', sym, formKey)
      const d = emit(battlerDir, front, abs(entry.front))
      entry.w = d.w
      entry.h = d.h
      const shiny = battlerSource(sym, idx, true, battlers)
      if (shiny) {
        entry.shiny = rel('shiny', sym, formKey)
        emit(battlerDir, shiny, abs(entry.shiny))
      }
    }
    const icon = iconSource(sym, idx, false, icons)
    if (icon) {
      entry.icon = rel('icon', sym, formKey)
      emit(iconDir, icon, abs(entry.icon))
    }
    if (!entry.front && !entry.icon) missing.push(`${sym}:${formKey}`)
    else (manifest[sym] ??= {})[formKey] = entry
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest))
rmSync(scratch, { recursive: true, force: true })
const noFront = Object.entries(manifest).flatMap(([s, fs]) => Object.entries(fs).filter(([, f]) => !f.front).map(([k]) => `${s}:${k}`))
console.log(`manifest: ${manifestPath} (${Object.keys(manifest).length} species)`)
console.log(`sprites:  ${outDir}`)
console.log(`no sprite at all (${missing.length}): ${missing.slice(0, 20).join(' ')}`)
console.log(`icon only (${noFront.length}): ${noFront.slice(0, 20).join(' ')}`)
