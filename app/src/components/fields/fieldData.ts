import { useEffect, useState } from 'react'

export interface TypeBoost { type: string; multiplier: number; condition?: string }
export interface MoveBoost { move: string; multiplier: number; note?: string }
export interface FieldEffects { types: TypeBoost[]; moves: MoveBoost[] }

export interface FieldInfo {
  name: string
  summary: string
  boosts: FieldEffects
  weakened: FieldEffects
  changes: string[]
  // Type symbol (e.g. POISON) of the field's dominant type, used for tinting. May be empty.
  color: string
}

export type FieldMap = Record<string, FieldInfo>

const cache = new Map<string, Promise<FieldMap>>()

// fields.json is optional: guides generated before it existed simply get unstyled banners.
export const loadFields = (game: string): Promise<FieldMap> => {
  if (!cache.has(game)) {
    cache.set(game, fetch(`${import.meta.env.BASE_URL}data/${game}/fields.json`)
      .then(r => (r.ok ? (r.json() as Promise<FieldMap>) : {}))
      .catch(() => ({})))
  }
  return cache.get(game) as Promise<FieldMap>
}

export const useFields = (game: string): FieldMap | null => {
  const [fields, setFields] = useState<FieldMap | null>(null)
  useEffect(() => {
    let live = true
    loadFields(game).then(f => live && setFields(f))
    return () => { live = false }
  }, [game])
  return fields
}
