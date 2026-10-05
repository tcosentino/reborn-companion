export interface Box { left: number; top: number; right: number; bottom: number }
export interface Size { width: number; height: number }

export interface PlaceInput {
  anchor: Box
  card: Size
  viewport: Size
  gap?: number
  margin?: number
}

export interface Placement {
  left: number
  top: number
  side: 'below' | 'above'
  /** Horizontal offset of the anchor centre inside the card, for the pointer notch. */
  arrowX: number
  /** Set when neither side fits the whole card; the card should scroll inside this height. */
  maxHeight?: number
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Below the anchor when the card fits there, otherwise above, otherwise whichever side has
 * more room (with a max height). Centered on the anchor and clamped inside the viewport.
 */
export const place = ({ anchor, card, viewport, gap = 8, margin = 8 }: PlaceInput): Placement => {
  const below = viewport.height - anchor.bottom - gap - margin
  const above = anchor.top - gap - margin
  const side: Placement['side'] =
    card.height <= below ? 'below' : card.height <= above ? 'above' : below >= above ? 'below' : 'above'
  const room = side === 'below' ? below : above
  const fits = card.height <= room
  const height = fits ? card.height : Math.max(room, 0)
  const top = side === 'below' ? anchor.bottom + gap : anchor.top - gap - height
  const center = (anchor.left + anchor.right) / 2
  const maxLeft = Math.max(margin, viewport.width - card.width - margin)
  const left = clamp(center - card.width / 2, margin, maxLeft)
  return {
    left,
    top: Math.max(top, margin),
    side,
    arrowX: clamp(center - left, 14, Math.max(14, card.width - 14)),
    ...(fits ? {} : { maxHeight: height })
  }
}
