// Loads a game manifest from games/<id>.json. The app reads the same files (app/src/games.ts).
//
// CLI (for the bash build scripts): node scripts/game.ts <id> [dotted.key]
// Prints the value at the key (objects as JSON, missing keys as an empty line), or validates the manifest when no key is given.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface GameBuild {
  /** Game argument passed to upstream/wt_generator.rb (reborn | rejuv | deso). */
  generator: string
  /** Raw walkthrough markdown, relative to the repo root. */
  rawDir: string
  /** fieldtext.rb relative to the repo root. Omit for games without field effects; fields.json is then skipped. */
  fieldsScript?: string
  /** Where scripts/build-sprites.ts finds the game's Graphics folder. Omit to skip sprites.
   *  `scripts` is the in-zip folder holding itemtext.rb and movetext.rb; omit to skip item icons. */
  sprites?: { zip: string; graphics: string; scripts?: string }
  /** Where scripts/build-maps.sh finds the RPG Maker game folder (Data/, Graphics/). Omit to skip route maps. */
  maps?: { zip: string; game: string }
}

export interface GameManifest {
  id: string
  name: string
  tagline: string
  credit: { label: string; url: string }
  imageBase: string
  build: GameBuild
}

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED = ['id', 'name', 'tagline', 'credit', 'imageBase', 'build', 'build.generator', 'build.rawDir'] as const

export const pick = (obj: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)

export const validateGame = (id: string, raw: unknown): GameManifest => {
  const missing = REQUIRED.filter(k => pick(raw, k) === undefined)
  if (missing.length) throw new Error(`games/${id}.json is missing: ${missing.join(', ')}`)
  if (pick(raw, 'id') !== id) throw new Error(`games/${id}.json has id "${String(pick(raw, 'id'))}"; it must match the file name`)
  return raw as GameManifest
}

export const loadGame = (id: string): GameManifest => {
  const file = join(ROOT, 'games', `${id}.json`)
  if (!existsSync(file)) throw new Error(`no manifest at games/${id}.json`)
  return validateGame(id, JSON.parse(readFileSync(file, 'utf8')))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [id, key] = process.argv.slice(2)
  if (!id) {
    console.error('usage: node scripts/game.ts <id> [dotted.key]')
    process.exit(1)
  }
  try {
    const game = loadGame(id)
    const value = key ? pick(game, key) : undefined
    console.log(value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value))
  } catch (e) {
    console.error((e as Error).message)
    process.exit(1)
  }
}
