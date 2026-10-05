import { useEffect, useState } from 'react'
import { resolveFormIndex } from './spriteMap'

export interface SpriteEntry {
  name?: string
  front?: string
  shiny?: string
  icon?: string
  frames?: number
  w: number
  h: number
}
export type SpriteManifest = Record<string, Record<string, SpriteEntry>>

const cache = new Map<string, Promise<SpriteManifest>>()

const publicUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`

// A missing manifest (sprites not built) resolves to an empty one so the UI shows placeholders.
export const loadSprites = (game: string): Promise<SpriteManifest> => {
  if (!cache.has(game)) {
    cache.set(game, fetch(publicUrl(`data/${game}/sprites.json`))
      .then(r => (r.ok ? (r.json() as Promise<SpriteManifest>) : {}))
      .catch(() => ({})))
  }
  return cache.get(game)!
}

export const spriteUrl = (path: string) => publicUrl(path)

/** Look up the entry for a species symbol and a form index, form name, or null (-> form 0). */
export const findSprite = (manifest: SpriteManifest, species: string, form?: number | string | null): SpriteEntry | null => {
  const forms = manifest[species]
  if (!forms) return null
  return forms[resolveFormIndex(forms, form)] ?? forms['0'] ?? null
}

/** undefined while loading, then the manifest (possibly empty). */
export const useSpriteManifest = (game: string): SpriteManifest | undefined => {
  const [manifest, setManifest] = useState<SpriteManifest>()
  useEffect(() => {
    let live = true
    loadSprites(game).then(m => live && setManifest(m))
    return () => { live = false }
  }, [game])
  return manifest
}
