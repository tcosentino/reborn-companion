// Pure species -> sprite file mapping for Pokemon Reborn's Graphics folder.
// No imports on purpose: scripts/build-sprites.ts runs this under plain node.
//
// Naming scheme (from the game's Utilities.rb, pbLoadPokemonBitmapSpecies / pbPokemonIconBitmap):
//   Battlers/<species>.png      sheet 384 wide: column 0 = normal, column 1 (x=192) = shiny.
//                               Each cell is 192x192; per form, front is row form*384, back is +192.
//   Battlers/<species>[s]_<n>.png  "toobig" forms (n >= 1): one standalone front image, sized
//                               to the Pokemon, with an `s` before the underscore for shiny.
//   Icons/<species>.png         sheet 256 wide: x=0 normal (2 frames of 64), x=128 shiny.
//                               Row = form*64. Cell is 64x64 (first frame is used).
// <species> is the lowercase species symbol. Female ("f" suffix) and egg files are not used.

export interface Rect { x: number; y: number; w: number; h: number }

export interface SpriteSource {
  file: string
  // Region of `file` to extract; null means use the whole file as-is.
  crop: Rect | null
}

export interface Dims { w: number; h: number }

export const BATTLER_CELL = 192
export const ICON_CELL = 64

const base = (species: string) => species.toLowerCase()

/** Standalone "toobig" form file name, e.g. kyurem_1 / kyuremsb_1 (shiny: `s` before `_`). */
export const toobigFile = (species: string, form: number, shiny: boolean) =>
  `${base(species)}${shiny ? 's' : ''}_${form}.png`

/**
 * Where the front battler for (species, form, shiny) lives.
 * `files` maps a Battlers file name to its pixel size. Returns null when no sprite exists.
 * Shiny falls back to null (not the normal sprite) so callers can omit the field.
 */
export const battlerSource = (
  species: string,
  form: number,
  shiny: boolean,
  files: ReadonlyMap<string, Dims>
): SpriteSource | null => {
  if (form > 0) {
    const standalone = toobigFile(species, form, shiny)
    if (files.has(standalone)) return { file: standalone, crop: null }
    // A toobig form with no shiny variant must not borrow a sheet cell from another form.
    if (shiny && files.has(toobigFile(species, form, false))) return null
  }
  const sheetName = `${base(species)}.png`
  const sheet = files.get(sheetName)
  if (!sheet) return null
  const x = shiny ? BATTLER_CELL : 0
  if (sheet.w < x + BATTLER_CELL) return null
  // The game falls back to the first row when the form row is missing.
  const row = form * BATTLER_CELL * 2
  const y = sheet.h >= row + BATTLER_CELL ? row : 0
  return { file: sheetName, crop: { x, y, w: BATTLER_CELL, h: BATTLER_CELL } }
}

/** Where the party icon (first animation frame) lives. Normal only unless shiny is set. */
export const iconSource = (
  species: string,
  form: number,
  shiny: boolean,
  files: ReadonlyMap<string, Dims>
): SpriteSource | null => {
  const name = `${base(species)}.png`
  const sheet = files.get(name)
  if (!sheet) return null
  const x = shiny ? 128 : 0
  if (sheet.w < x + ICON_CELL) return null
  const y = sheet.h >= form * ICON_CELL + ICON_CELL ? form * ICON_CELL : 0
  return { file: name, crop: { x, y, w: ICON_CELL, h: ICON_CELL } }
}

/** Resolve a form given as an index, an index string, or a form name ("Alolan Form") to an index. */
export const resolveFormIndex = (
  forms: Readonly<Record<string, { name?: string }>>,
  form: number | string | null | undefined
): string => {
  if (form === null || form === undefined || form === '') return '0'
  const key = String(form)
  if (key in forms) return key
  const hit = Object.entries(forms).find(([, f]) => f.name === key)
  return hit ? hit[0] : '0'
}
