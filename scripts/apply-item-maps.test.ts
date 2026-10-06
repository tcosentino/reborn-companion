import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemEventInfo, type ItemCardDef } from '../app/src/lib/itemMaps.ts'
import { cardBox } from './apply-item-maps.ts'
import type { GameMap } from './rmxp.ts'

const map = {
  id: 7, name: 'Jungle', tileset: 1, width: 40, height: 30, layers: 3, data: [],
  events: [
    { id: 3, name: 'item', x: 10, y: 5, pages: [{ cond: false, through: false, trigger: 0, item: 'POTION' }] },
    { id: 4, name: 'ball', x: 12, y: 9, pages: [{ cond: false, through: false, trigger: 0, char: 'itemball', item: 'GREATBALL' }] }
  ]
} as unknown as GameMap
const events = new Map(map.events.map(e => [e.id, itemEventInfo(e)]))
const def: ItemCardDef = { id: 'north', match: 'Head up.', map: 7, items: [{ event: 3 }, { event: 4 }] }

test('cardBox pads the card events by 3 tiles and keeps at least 12x8 inside the map', () => {
  assert.deepEqual(cardBox(def, map, events), { x: 5, y: 2, w: 12, h: 11 })
})

test('cardBox honours pad', () => {
  assert.deepEqual(cardBox({ ...def, pad: 0 }, map, events), { x: 5, y: 3, w: 12, h: 8 })
})
