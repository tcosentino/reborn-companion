import { useEffect, useState } from 'react'
import { useGame } from '../common'
import { spriteUrl } from './sprites'
import './ItemSprite.css'

export interface ItemSpriteEntry { name?: string; icon: string }
export type ItemSpriteManifest = Record<string, ItemSpriteEntry>

const cache = new Map<string, Promise<ItemSpriteManifest>>()
const byName = new WeakMap<ItemSpriteManifest, Map<string, string>>()

// A missing manifest (sprites not built) resolves to an empty one so the UI shows placeholders.
export const loadItemSprites = (game: string): Promise<ItemSpriteManifest> => {
  if (!cache.has(game)) {
    cache.set(game, fetch(spriteUrl(`data/${game}/item-sprites.json`))
      .then(r => (r.ok ? (r.json() as Promise<ItemSpriteManifest>) : {}))
      .catch(() => ({})))
  }
  return cache.get(game)!
}

export const normItemName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Item symbol for a free-text name ("Rare Candy" -> RARECANDY), or the name itself when it already is one. */
export const findItemSprite = (manifest: ItemSpriteManifest, sym?: string | null, name?: string | null): ItemSpriteEntry | null => {
  if (sym && manifest[sym]) return manifest[sym]
  if (!name) return null
  if (!byName.has(manifest)) byName.set(manifest, new Map(Object.entries(manifest).map(([s, e]) => [normItemName(e.name ?? s), s])))
  const hit = byName.get(manifest)!.get(normItemName(name))
  return hit ? manifest[hit] : null
}

export const useItemSpriteManifest = (game: string): ItemSpriteManifest | undefined => {
  const [manifest, setManifest] = useState<ItemSpriteManifest>()
  useEffect(() => {
    let live = true
    loadItemSprites(game).then(m => live && setManifest(m))
    return () => { live = false }
  }, [game])
  return manifest
}

export type ItemSpriteSize = 'sm' | 'md' | 'lg'

interface Props {
  /** Item symbol, e.g. 'LEFTOVERS'. */
  sym?: string | null
  /** Display name, used to find the icon when there is no symbol (hidden item lists). */
  name?: string | null
  /** sm = 24px inline with text, md = 32px, lg = 48px (native size). Default 'sm'. */
  size?: ItemSpriteSize
}

/**
 * Bag icon for an item from the local, gitignored sprite folder built by scripts/build-sprites.ts.
 * Decorative (the name is always printed next to it); renders nothing until an icon is known.
 */
export const ItemSprite = ({ sym, name, size = 'sm' }: Props) => {
  const manifest = useItemSpriteManifest(useGame().id)
  const entry = manifest ? findItemSprite(manifest, sym, name) : null
  const [broken, setBroken] = useState(false)
  if (!entry || broken) return null
  return (
    <span className={`item-sprite ${size}`} aria-hidden="true">
      <img src={spriteUrl(entry.icon)} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />
    </span>
  )
}
