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
