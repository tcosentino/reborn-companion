import { test } from 'node:test'
import assert from 'node:assert/strict'
import { battleIds, missingIds } from './check-progress-ids.ts'

test('battleIds dedupes and sorts across sections', () => {
  const ids = battleIds({ s: { a: [['B:X:0', 'B'], ['A:X:0', 'A']], b: [['A:X:0', 'A']] } })
  assert.deepEqual(ids, ['A:X:0', 'B:X:0'])
})

test('missingIds reports baseline ids no longer shipped, ignores new ones', () => {
  assert.deepEqual(missingIds(['A', 'B'], ['A', 'C']), ['B'])
  assert.deepEqual(missingIds([], ['A']), [])
})

test('battleIds includes walkthrough task ids', () => {
  assert.deepEqual(battleIds({ s: { a: [['A:X:0', 'A']] }, t: { a: [['task:a/x', 'X']] } }), ['A:X:0', 'task:a/x'])
})

test('battleIds includes item map ids', () => {
  assert.deepEqual(battleIds({ s: {}, i: { a: ['item:a/x/3', 'item:a/x/1'] } }), ['item:a/x/1', 'item:a/x/3'])
})

test('missingIds skips item map ids when the build had no map dump', () => {
  assert.deepEqual(missingIds(['A', 'item:a/x/1'], [], false), ['A'])
  assert.deepEqual(missingIds(['A', 'item:a/x/1'], [], true), ['A', 'item:a/x/1'])
})
