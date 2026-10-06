import { useGame } from '../common'
import { findSprite, spriteUrl, useSpriteManifest } from './sprites'
import './MonSprite.css'

// Trimmed sprites at or above this many source pixels fill the box; smaller ones scale down proportionally
const SMALL_SPRITE = 110

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
  /** Accessible label; empty by default because the name is normally printed next to the sprite. */
  alt?: string
}

/**
 * Pixel-art Pokemon sprite from the local, gitignored sprite folder built by scripts/build-sprites.ts.
 * Crisp (nearest-neighbor), lazy loaded, and falls back to a neutral silhouette when the
 * manifest, species, or image is missing. Reusable in rows, hover cards and the Pokedex.
 */
export const MonSprite = ({ species, form, size = 'sm', shiny = false, alt = '' }: Props) => {
  const manifest = useSpriteManifest(useGame().id)
  const entry = manifest ? findSprite(manifest, species, form) : null
  const path = size === 'icon' ? entry?.icon ?? entry?.front : (shiny ? entry?.shiny : undefined) ?? entry?.front ?? entry?.icon
  // Battlers are trimmed to their visible pixels; don't blow small Pokemon up to the full box,
  // so a Joltik still reads smaller than a Wailord
  const usesFront = size !== 'icon' && path === (shiny ? entry?.shiny ?? entry?.front : entry?.front)
  const longest = entry ? Math.max(entry.w, entry.h) : 0
  const fill = usesFront && longest > 0 ? Math.min(1, longest / SMALL_SPRITE) : 1
  return (
    <span className={`mon-sprite ${size}`} data-missing={path ? undefined : ''}>
      {path ? (
        <img src={spriteUrl(path)} alt={alt} style={fill < 1 ? { width: `${fill * 100}%`, height: `${fill * 100}%` } : undefined} loading="lazy" decoding="async" draggable={false}
          onError={e => { e.currentTarget.parentElement?.setAttribute('data-missing', ''); e.currentTarget.remove() }} />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h6m6 0h6" /><circle cx="12" cy="12" r="2.6" /></svg>
      )}
    </span>
  )
}
