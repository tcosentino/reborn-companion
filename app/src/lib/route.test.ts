import { describe, expect, it } from 'vitest'
import { href, itemHref, moveHref, parseHash } from './route'

describe('item and move routes', () => {
  it('parses item and move pages as reference pages', () => {
    expect(parseHash(itemHref('reborn', 'RARECANDY'))).toEqual({
      game: 'reborn', section: null, pokedex: true, species: null, compare: null, item: 'RARECANDY'
    })
    expect(parseHash(moveHref('reborn', 'IRONDEFENSE'))).toMatchObject({ pokedex: true, move: 'IRONDEFENSE' })
  })

  it('round-trips keys that need encoding', () => {
    expect(parseHash(itemHref('reborn', 'a b/c')).item).toBe('a b/c')
  })

  it('treats a bare item or move segment without a key as a section', () => {
    expect(parseHash('#/reborn/item')).toMatchObject({ section: 'item', pokedex: false })
  })

  it('leaves section links alone', () => {
    expect(parseHash(href('reborn', 'opal-ward', 'shop-x'))).toMatchObject({ section: 'opal-ward', anchor: 'shop-x' })
    expect(parseHash('#/reborn/opal-ward').item).toBeUndefined()
  })
})
