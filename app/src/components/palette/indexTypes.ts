// Compact search index (search.json) written by scripts/build-search.ts.
// Rows are positional tuples to keep the file small; numbers that point at
// `s` (sections) or `a` (anchors) are indexes into those string tables.

export type Price = number | string | null
// [sectionIdx, anchorIdx (-1 = section top), price]
export type PlaceRef = [number, number, Price]

// [names, trainer classes, sectionIdxs, anchorIdx, minLv, maxLv, fieldIdx (-1 none), speciesIdxs (into p), double]
export type TrainerRow = [string, string, number[], number, number, number, number, number[], 0 | 1]

// [sectionIdx, anchorIdx, methodIdx, minLv, maxLv]
export type CatchRef = [number, number, number, number, number]
// [species SYM, catches, trainers using it, first appearance [sectionIdx, anchorIdx] or null]
export type SpeciesRow = [string, CatchRef[], number, [number, number] | null]

// [display name, item SYM or '', shops, sectionIdxs where it is found in the field]
export type ItemRow = [string, string, PlaceRef[], number[]]

// [display name, move SYM or '', tutors]
export type MoveRow = [string, string, PlaceRef[]]

export interface SearchIndex {
  v: 1
  ch: string[]
  s: [string, string, number][]
  a: string[]
  m: string[]
  f: string[]
  t: TrainerRow[]
  p: SpeciesRow[]
  i: ItemRow[]
  mv: MoveRow[]
}
