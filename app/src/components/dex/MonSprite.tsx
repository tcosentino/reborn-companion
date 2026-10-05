import { findSprite, spriteUrl, useSpriteManifest } from './sprites'
import './MonSprite.css'

export type MonSpriteSize = 'icon' | 'sm' | 'md' | 'lg'

interface Props {
  /** Species symbol as used in the guide JSON, e.g. 'TOGEDEMARU'. */
  species: string
  /** Form index, index string, or form name ("Alolan Form"). Defaults to the normal form. */
  form?: number | string | null
  /** icon = 40px party icon, sm = 64px, md = 96px, lg = 160px battler. Default 'sm'. */
  size?: MonSpriteSize
  /** Use the shiny front sprite when one exists. Icons are always the normal icon. */
  shiny?: boolean
  /** Which game's manifest to read. Default 'reborn'. */
  game?: string
  /** Accessible label; empty by default because the name is normally printed next to the sprite. */
  alt?: string
}

/**
 * Pixel-art Pokemon sprite from the local, gitignored sprite folder built by scripts/build-sprites.ts.
 * Crisp (nearest-neighbor), lazy loaded, and falls back to a neutral silhouette when the
 * manifest, species, or image is missing. Reusable in rows, hover cards and the Pokedex.
 */
export const MonSprite = ({ species, form, size = 'sm', shiny = false, game = 'reborn', alt = '' }: Props) => {
  const manifest = useSpriteManifest(game)
  const entry = manifest ? findSprite(manifest, species, form) : null
  const path = size === 'icon' ? entry?.icon ?? entry?.front : (shiny ? entry?.shiny : undefined) ?? entry?.front ?? entry?.icon
  return (
    <span className={`mon-sprite ${size}`} data-missing={path ? undefined : ''}>
      {path ? (
        <img src={spriteUrl(path)} alt={alt} loading="lazy" decoding="async" draggable={false}
          onError={e => { e.currentTarget.parentElement?.setAttribute('data-missing', ''); e.currentTarget.remove() }} />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h6m6 0h6" /><circle cx="12" cy="12" r="2.6" /></svg>
      )}
    </span>
  )
}
