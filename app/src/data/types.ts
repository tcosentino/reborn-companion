// Shapes of the JSON emitted by the walkthrough generator (`wt_generator.rb --json`).
// Game-agnostic: any game whose generator emits this schema can be rendered.

import type { TaskBlock } from '../lib/tasks'

export type Sym = string

export interface GuideIndex {
  game: string
  version: string
  generatedAt: string
  source: string
  chapters: ChapterRef[]
}

export interface ChapterRef {
  id: string
  title: string
  slug?: string
  file: string
  sections: { id: string | null; title: string | null }[]
}

export interface Chapter {
  id: string
  title: string
  sections: Section[]
}

export interface Section {
  id: string | null
  title: string | null
  blocks: Block[]
}

export interface ProseBlock { type: 'prose'; markdown: string }
export interface ImageBlock { type: 'image'; file: string; src: string }

export interface Trainer {
  name: string
  trainerType: string
  title: string
  teamId: [string, string, number]
}

export interface PartyMon {
  species: Sym
  form: number | string | null
  formName: string | null
  displayName: string
  nickname: string | null
  level: number
  gender: 'M' | 'F' | null
  item: Sym | null
  ability: Sym | null
  nature: Sym | null
  ivs: number[] | null
  evs: number[] | null
  moves: Sym[]
  hiddenPowerType: Sym | null
  shiny: boolean
  shadow: boolean
  ace: boolean
  owner: number
  notes: string[]
}

export interface BattleBlock {
  type: 'battle'
  heading: string
  double: boolean
  partner: boolean
  field: Sym | null
  fieldName: string | null
  showField: boolean
  trainers: Trainer[]
  items: unknown[]
  party: PartyMon[]
  notes: string[] | null
  macro?: string
}

export interface EncounterRow {
  species: Sym
  form: string | null
  displayName: string
  firstSeen: boolean
  minLevel: number
  maxLevel: number
  levels: string
  rate: number
}

export interface EncounterMethod { method: string; time: string | null; rows: EncounterRow[] }

export interface EncountersBlock {
  type: 'encounters'
  mapId: number
  name: string
  mapName: string
  methods: EncounterMethod[]
}

export interface ShopBlock {
  type: 'shop'
  title: string
  items: { name: string; price: number | string | null; highlight: boolean; item: Sym | null; quantity?: number }[]
}

export interface TutorBlock {
  type: 'tutor'
  title: string
  moves: { move: Sym | null; name: string; price: number | string | null }[]
}

export interface PickupBlock {
  type: 'pickup'
  title: string
  rows: { item: Sym; odds: { percent: number; minLevel: number; maxLevel: number }[] }[]
}

export interface MiningBlock {
  type: 'mining'
  title: string
  rows: { items: Sym[]; probability: number }[]
}

export interface WildHeldBlock {
  type: 'wildHeld'
  title: string
  rows: { item: Sym; chances: { rarity: string; percent: number; pokemon: { species: Sym; displayName: string }[] }[] }[]
}

export interface HtmlBlock { type: 'html'; macro: string; html: string }

export type Block =
  | ProseBlock | ImageBlock | BattleBlock | EncountersBlock | ShopBlock
  | TutorBlock | PickupBlock | MiningBlock | WildHeldBlock | HtmlBlock | TaskBlock

export type { TaskBlock }

export interface SpeciesForm {
  name: string
  types: Sym[]
  baseStats: number[]
  abilities: Sym[]
  hiddenAbility?: Sym | null
}

export interface Dex {
  species: Record<Sym, { name: string; forms: Record<string, SpeciesForm> }>
  moves: Record<Sym, { name: string; type: Sym; category: string; power: number | null; accuracy: number | null; pp: number | null; desc: string }>
  abilities: Record<Sym, { name: string; desc: string }>
  items: Record<Sym, { name: string; desc: string; price: number | null }>
  types: Record<Sym, { name: string; weaknesses: Sym[]; resistances: Sym[]; immunities: Sym[] }>
  fields: Record<Sym, string>
}

// pokedex.json: every species, loaded lazily for the Pokedex page and encounter badges
export interface Evolution { species: Sym; method: string; parameter: number | string | null }

export interface PokedexForm extends SpeciesForm { evolutions: Evolution[] }

export interface DexLocation {
  chapterId: string
  sectionId: string
  sectionTitle: string
  place: string
  methods: string[]
  levels: string[]
}

export interface PokedexSpecies {
  name: string
  num: number
  catchRate: number
  kind: string
  forms: Record<string, PokedexForm>
  locations: DexLocation[]
  // Guide sections whose prose bolds this species: gifts, eggs, purchases, static encounters
  mentions?: { chapterId: string; sectionId: string; sectionTitle: string }[]
}

export interface Pokedex {
  species: Record<Sym, PokedexSpecies>
  abilities: Record<Sym, { name: string; desc: string }>
  // Display names for symbol evolution parameters (items, moves, species)
  names: Record<Sym, string>
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D'

// learnsets.json: per-species, per-form move lists plus full move data (build-time input for ranks/movesets)
export interface LearnsetForm { level: [number, Sym][]; machine: Sym[]; egg: Sym[]; relearn: Sym[] }
export interface MoveData { name: string; type: Sym; category: string; power: number | null; accuracy: number | null; pp: number | null; desc: string }
export interface Learnsets { species: Record<Sym, Record<string, LearnsetForm>>; moves: Record<Sym, MoveData> }

// ranks.json and movesets.json are computed by app/scripts/build-ranks.ts from game data only
export type Factor = 'stats' | 'moves' | 'bosses' | 'availability'

export interface RankEntry {
  tier: Tier
  // 0-100, percentile of the composite score among fully evolved species
  score: number
  // Final form this rating comes from, when it is not the species itself
  via?: Sym
  // 0-100 percentiles; availability is null when the guide never lists the line
  factors: Record<Factor, number | null>
  note: string
  reasons: { good: string[]; bad: string[] }
}

export interface Ranks { generatedAt: string; method: string; species: Record<Sym, RankEntry> }

export type MoveSource = 'level' | 'relearn' | 'machine' | 'egg'

export interface SetMove {
  move: Sym
  name: string
  type: Sym
  category: string
  power: number | null
  accuracy: number | null
  source: MoveSource
  level?: number
  // Pre-evolution the move has to be learned on, when the species itself cannot learn it
  from?: Sym
}

export interface Moveset {
  role: 'Physical' | 'Special' | 'Mixed'
  nature: string
  moves: SetMove[]
  // Single types hit super-effectively by at least one move in the set
  coverage: Sym[]
  note: string
}

export interface Movesets { generatedAt: string; species: Record<Sym, Moveset> }
