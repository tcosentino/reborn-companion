import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compactJson } from './json-format.ts'

test('compactJson puts each point on one line and hide inline', () => {
  const defs = [{ id: 'a', match: 'x', map: 1, points: [{ at: [40, 10], label: "Danielle's apartment" }, { at: [1, 2], via: true }], hide: [3, 4] }]
  const out = compactJson(defs)
  assert.equal(out, `[
  {
    "id": "a",
    "match": "x",
    "map": 1,
    "points": [
      { "at": [40, 10], "label": "Danielle's apartment" },
      { "at": [1, 2], "via": true }
    ],
    "hide": [3, 4]
  }
]
`)
  assert.deepEqual(JSON.parse(out), defs)
})

test('compactJson handles an empty file', () => {
  assert.equal(compactJson([]), '[]\n')
})
