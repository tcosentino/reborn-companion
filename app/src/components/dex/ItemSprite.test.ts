import { describe, expect, it } from 'vitest'
import { findItemSprite } from './ItemSprite'
import { evolutionItem } from '../../lib/evolution'

const manifest = {
  RARECANDY: { name: 'Rare Candy', icon: 'sprites/reborn/item/rarecandy.png' },
  POKEBALL: { name: 'Poké Ball', icon: 'sprites/reborn/item/pokeball.png' }
}

describe('findItemSprite', () => {
  it('finds by symbol', () => expect(findItemSprite(manifest, 'RARECANDY')?.icon).toContain('rarecandy'))
  it('falls back to the name, ignoring case and accents', () => {
    expect(findItemSprite(manifest, null, 'rare candy')?.icon).toContain('rarecandy')
    expect(findItemSprite(manifest, 'NOPE', 'Poke Ball')?.icon).toContain('pokeball')
  })
  it('returns null for unknown items', () => expect(findItemSprite(manifest, null, 'Nothing')).toBeNull())
})

describe('evolutionItem', () => {
  it('returns the stone or held item', () => {
    expect(evolutionItem({ method: 'Item', parameter: 'WATERSTONE' } as never)).toBe('WATERSTONE')
    expect(evolutionItem({ method: 'TradeItem', parameter: 'METALCOAT' } as never)).toBe('METALCOAT')
  })
  it('ignores non-item methods', () => expect(evolutionItem({ method: 'HasMove', parameter: 'ROLLOUT' } as never)).toBeNull())
})
