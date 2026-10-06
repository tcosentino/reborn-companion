import { describe, expect, it } from 'vitest'
import { itemIconSource, parseRubyHash } from './itemSpriteMap'

const items = parseRubyHash(`ITEMHASH = {
  :REPEL => {
    :ID => 1,
    :name => "Repel",
    :price => 350,
  },

  :TM01 => {
    :ID => 288,
    :name => "TM01",
    :tm => :WORKUP,
  },

  :WAREHOUSEKEY => {
    :ID => 515,
    :name => "Warehouse Key",
    :image => "warehousekey",
    :keyitem => true,
  },
}`)
const moves = parseRubyHash(`MOVEHASH = {
  :WORKUP => {
    :ID => 1,
    :type => :NORMAL,
  },
}`)
const files = new Map(['repel.png', 'tm - normal.png', 'warehousekey.png'].map(f => [f, f === 'tm - normal.png' ? 'TM - Normal.png' : f]))

describe('parseRubyHash', () => {
  it('reads names, TM moves, images and types', () => {
    expect(items.REPEL).toEqual({ name: 'Repel' })
    expect(items.TM01).toEqual({ name: 'TM01', tm: 'WORKUP' })
    expect(items.WAREHOUSEKEY).toEqual({ name: 'Warehouse Key', image: 'warehousekey' })
    expect(moves.WORKUP).toEqual({ type: 'NORMAL' })
  })
})

describe('itemIconSource', () => {
  it('uses the lowercase symbol file', () => {
    expect(itemIconSource('REPEL', items.REPEL, moves, files)).toBe('repel.png')
  })
  it('uses the type icon for TMs', () => {
    expect(itemIconSource('TM01', items.TM01, moves, files)).toBe('TM - Normal.png')
  })
  it('uses the :image override', () => {
    expect(itemIconSource('WAREHOUSEKEY', items.WAREHOUSEKEY, moves, files)).toBe('warehousekey.png')
  })
  it('returns null when nothing matches', () => {
    expect(itemIconSource('NOPE', {}, moves, files)).toBeNull()
  })
})
