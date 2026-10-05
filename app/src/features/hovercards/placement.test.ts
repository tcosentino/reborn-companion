import { describe, expect, it } from 'vitest'
import { place } from './placement'

const viewport = { width: 1000, height: 800 }
const card = { width: 300, height: 200 }
const box = (left: number, top: number, w = 60, h = 20) => ({ left, top, right: left + w, bottom: top + h })

describe('place', () => {
  it('prefers below, centered on the anchor', () => {
    const p = place({ anchor: box(470, 100), card, viewport })
    expect(p.side).toBe('below')
    expect(p.top).toBe(128)
    expect(p.left).toBe(350)
    expect(p.arrowX).toBe(150)
  })
  it('flips above near the bottom edge', () => {
    const p = place({ anchor: box(470, 700), card, viewport })
    expect(p.side).toBe('above')
    expect(p.top).toBe(700 - 8 - 200)
  })
  it('clamps horizontally at the left and right edges', () => {
    const l = place({ anchor: box(0, 100), card, viewport })
    expect(l.left).toBe(8)
    expect(l.arrowX).toBeGreaterThanOrEqual(14)
    const r = place({ anchor: box(950, 100), card, viewport })
    expect(r.left).toBe(1000 - 300 - 8)
    expect(r.arrowX).toBeLessThanOrEqual(286)
  })
  it('caps height on the roomier side when neither fits', () => {
    const p = place({ anchor: box(100, 300), card: { width: 300, height: 900 }, viewport })
    expect(p.maxHeight).toBeDefined()
    expect(p.top).toBeGreaterThanOrEqual(8)
    expect(p.top + (p.maxHeight ?? 0)).toBeLessThanOrEqual(800)
  })
  it('handles a viewport narrower than the card', () => {
    const p = place({ anchor: box(10, 100), card, viewport: { width: 280, height: 800 } })
    expect(p.left).toBe(8)
  })
})
