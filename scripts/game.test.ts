import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadGame, pick, ROOT, validateGame } from './game.ts'

const base = {
  id: 'demo', name: 'Demo', tagline: 't', credit: { label: 'l', url: 'https://x' }, imageBase: 'https://x',
  build: { generator: 'demo', rawDir: 'raw/demo' }
}

test('pick reads dotted keys and returns undefined for missing ones', () => {
  assert.equal(pick(base, 'build.generator'), 'demo')
  assert.equal(pick(base, 'build.fieldsScript'), undefined)
  assert.equal(pick(base, 'nope.deeper'), undefined)
})

test('validateGame accepts a minimal manifest', () => {
  assert.equal(validateGame('demo', base).id, 'demo')
})

test('validateGame names missing required keys', () => {
  const { rawDir: _, ...build } = base.build
  assert.throws(() => validateGame('demo', { ...base, build, tagline: undefined }), /missing: tagline, build\.rawDir/)
})

test('validateGame requires the id to match the file name', () => {
  assert.throws(() => validateGame('other', base), /must match the file name/)
})

test('every checked-in manifest is valid', () => {
  const ids = readdirSync(join(ROOT, 'games')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
  assert.ok(ids.includes('reborn'))
  for (const id of ids) {
    const game = loadGame(id)
    assert.match(game.build.rawDir, /^[^/~]/, `${id}: rawDir must be relative to the repo root`)
    if (game.build.fieldsScript) assert.match(game.build.fieldsScript, /^[^/~]/, `${id}: fieldsScript must be relative`)
  }
})

test('every overrides/<game> folder has a manifest', () => {
  for (const id of readdirSync(join(ROOT, 'overrides'))) {
    assert.ok(existsSync(join(ROOT, 'games', `${id}.json`)), `overrides/${id} has no games/${id}.json`)
  }
})
