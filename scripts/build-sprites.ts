// Extracts Pokemon front sprites (normal + shiny), party icons and item icons from a game's download zip and
// writes the sprite manifests (sprites.json, item-sprites.json). Sprites are local-only (gitignored); never commit them.
//
// Usage (node >= 23.6 runs .ts directly; needs `unzip`):
//   node scripts/build-sprites.ts <game> [spritesOutDir] [zipPath] [dexJsonPath]
// Defaults: sprites to app/public/sprites/<game>, zip and Graphics folder from build.sprites in games/<game>.json,
// dex from out/json/<game>/dex.json (falling back to the main checkout inside a worktree). The manifest is written
// next to the dex JSON (out/json/<game>/sprites.json) so scripts/sync-data.sh carries it into app/public/data.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { alphaBounds, cropPng, type Box } from './png-crop.ts'
import { loadGame, ROOT } from './game.ts'
import { battlerSource, iconSource, type Dims, type SpriteSource } from '../app/src/components/dex/spriteMap.ts'
import { itemIconSource, parseRubyHash } from '../app/src/components/dex/itemSpriteMap.ts'

interface DexForm { name?: string }
interface DexJson { species: Record<string, { name: string; forms: Record<string, DexForm> }> }
interface ManifestForm { name?: string; front?: string; shiny?: string; icon?: string; frames?: number; w: number; h: number }

const [gameId, outArg, zipArg, dexArg] = process.argv.slice(2)
if (!gameId) {
  console.error('usage: node scripts/build-sprites.ts <game> [spritesOutDir] [zipPath] [dexJsonPath]')
  process.exit(1)
}
const game = loadGame(gameId)
if (!game.build.sprites) {
  console.error(`games/${gameId}.json has no build.sprites; nothing to extract`)
  process.exit(1)
}
// Inside a git worktree the gitignored out/ lives in the main checkout (same rule as build-fields.rb)
const mainRoot = process.env.POKEMON_REBOR_ROOT ?? resolve(ROOT, '../../..')
const expandHome = (p: string) => p.replace(/^~(?=\/|$)/, homedir())
const outDir = resolve(outArg ?? join(ROOT, 'app/public/sprites', gameId))
const zip = expandHome(zipArg ?? game.build.sprites.zip)
const dexRel = join('out/json', gameId, 'dex.json')
const dexPath = dexArg ?? [join(ROOT, dexRel), join(mainRoot, dexRel)].find(existsSync)
if (!dexPath) {
  console.error(`${dexRel} not found; run scripts/build-json.sh ${gameId} first`)
  process.exit(1)
}
const manifestPath = join(dirname(dexPath), 'sprites.json')
const itemManifestPath = join(dirname(dexPath), 'item-sprites.json')
const prefix = game.build.sprites.graphics
const scriptsDir = game.build.sprites.scripts
const itemScripts = scriptsDir ? [`${scriptsDir}/itemtext.rb`, `${scriptsDir}/movetext.rb`] : []

const scratch = mkdtempSync(join(tmpdir(), `${gameId}-sprites-`))
execFileSync('unzip', ['-q', '-o', zip, `${prefix}/Battlers/*`, `${prefix}/Icons/*`, ...itemScripts, '-d', scratch])

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

// Battler cells are 192px with the Pokemon small at the bottom; trim to the visible pixels.
// Normal and shiny share one box (their union) so both versions sit identically.
const cellOf = (srcDir: string, src: SpriteSource): Box => src.crop ?? { x: 0, y: 0, ...pngDims(join(srcDir, src.file)) }
const visibleBox = (srcDir: string, src: SpriteSource): Box | null =>
  alphaBounds(readFileSync(join(srcDir, src.file)), cellOf(srcDir, src))
const union = (a: Box | null, b: Box | null): Box | null => {
  if (!a || !b) return a ?? b
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}
// Shift a box found in one cell onto another cell of the same size (normal -> shiny column)
const relativeTo = (box: Box, from: Box, to: Box): Box => ({ ...box, x: box.x - from.x + to.x, y: box.y - from.y + to.y })
const trimmed = (src: SpriteSource, cell: Box, box: Box | null): SpriteSource =>
  box ? { ...src, crop: relativeTo(box, cell, cellOf(battlerDir, src)) } : src

const dex = JSON.parse(readFileSync(dexPath, 'utf8')) as DexJson
rmSync(outDir, { recursive: true, force: true })
const manifest: Record<string, Record<string, ManifestForm>> = {}
const missing: string[] = []
const spritePrefix = `sprites/${gameId}/`
const rel = (kind: string, sym: string, form: string) => `${spritePrefix}${kind}/${sym.toLowerCase()}_${form}.png`
const abs = (p: string) => join(outDir, p.slice(spritePrefix.length))

for (const [sym, sp] of Object.entries(dex.species)) {
  for (const [formKey, form] of Object.entries(sp.forms)) {
    const idx = Number(formKey)
    const entry: ManifestForm = { name: form.name, w: 0, h: 0 }
    const front = battlerSource(sym, idx, false, battlers)
    if (front) {
      const shiny = battlerSource(sym, idx, true, battlers)
      const frontCell = cellOf(battlerDir, front)
      const sameSheet = shiny && shiny.file === front.file
      // Union only works when both live in same-sized cells of one sheet; standalone files trim alone
      const frontBox = sameSheet
        ? union(visibleBox(battlerDir, front), (() => {
            const b = visibleBox(battlerDir, shiny)
            return b && relativeTo(b, cellOf(battlerDir, shiny), frontCell)
          })())
        : visibleBox(battlerDir, front)
      entry.front = rel('front', sym, formKey)
      const d = emit(battlerDir, trimmed(front, frontCell, frontBox), abs(entry.front))
      entry.w = d.w
      entry.h = d.h
      if (shiny) {
        entry.shiny = rel('shiny', sym, formKey)
        const shinyBox = sameSheet ? frontBox : visibleBox(battlerDir, shiny)
        emit(battlerDir, trimmed(shiny, sameSheet ? frontCell : cellOf(battlerDir, shiny), shinyBox), abs(entry.shiny))
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

// Item icons: { SYM: { name, icon } } for every item in the game's ITEMHASH (48x48, copied as is)
const itemManifest: Record<string, { name?: string; icon: string }> = {}
const noItemIcon: string[] = []
if (scriptsDir) {
  const ruby = (f: string) => parseRubyHash(readFileSync(join(scratch, scriptsDir, f), 'utf8'))
  const items = ruby('itemtext.rb')
  const moves = ruby('movetext.rb')
  const iconFiles = new Map([...icons.keys()].map(f => [f.toLowerCase(), f]))
  for (const [sym, item] of Object.entries(items)) {
    const file = itemIconSource(sym, item, moves, iconFiles)
    if (!file) { noItemIcon.push(sym); continue }
    const path = `${spritePrefix}item/${sym.toLowerCase()}.png`
    emit(iconDir, { file, crop: null }, abs(path))
    itemManifest[sym] = { name: item.name, icon: path }
  }
}
writeFileSync(itemManifestPath, JSON.stringify(itemManifest))
rmSync(scratch, { recursive: true, force: true })
const noFront = Object.entries(manifest).flatMap(([s, fs]) => Object.entries(fs).filter(([, f]) => !f.front).map(([k]) => `${s}:${k}`))
console.log(`manifest: ${manifestPath} (${Object.keys(manifest).length} species)`)
console.log(`sprites:  ${outDir}`)
console.log(`no sprite at all (${missing.length}): ${missing.slice(0, 20).join(' ')}`)
console.log(`icon only (${noFront.length}): ${noFront.slice(0, 20).join(' ')}`)
console.log(`items:    ${itemManifestPath} (${Object.keys(itemManifest).length} icons, ${noItemIcon.length} missing: ${noItemIcon.slice(0, 20).join(' ')})`)
