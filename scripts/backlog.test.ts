import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse, problems, serialize, slugify, sortItems, type Item } from './backlog.ts'

const item = (slug: string, meta: Record<string, string>, done = false): Item =>
  ({ slug, done, body: '', meta: { title: 'T', status: 'open', priority: 'normal', area: 'app', created: '2026-10-09', ...meta } })

test('slugify makes short kebab-case names', () => {
  assert.equal(slugify('Fix 50 dead #anchor links!'), 'fix-50-dead-anchor-links')
  assert.ok(slugify('x'.repeat(100)).length <= 60)
})

test('parse and serialize round-trip frontmatter and body', () => {
  const text = serialize({ title: 'A: b', status: 'open' }, '\n## Context\n\nhi\n')
  const { meta, body } = parse(text)
  assert.deepEqual(meta, { title: 'A: b', status: 'open' })
  assert.equal(body, '\n## Context\n\nhi\n')
})

test('problems flags missing fields, bad values and status/folder mismatch', () => {
  assert.deepEqual(problems(item('ok', {})), [])
  assert.deepEqual(problems(item('a', { area: '' })), ['a.md: missing area'])
  assert.deepEqual(problems(item('b', { priority: 'urgent' })), ['b.md: bad priority urgent'])
  assert.deepEqual(problems(item('c', { status: 'done' })), ['c.md: status done but not in done/'])
  assert.deepEqual(problems(item('d', {}, true)), ['done/d.md: in done/ but status is not done'])
  assert.deepEqual(problems(item('e', { created: 'today' })), ['e.md: created is not YYYY-MM-DD'])
})

test('sortItems orders by priority, blocked after open, then oldest first', () => {
  const sorted = sortItems([
    item('low', { priority: 'low' }),
    item('new', { created: '2026-10-10' }),
    item('blocked', { priority: 'high', status: 'blocked' }),
    item('old', { created: '2026-10-01' }),
    item('high', { priority: 'high' })
  ])
  assert.deepEqual(sorted.map(i => i.slug), ['high', 'blocked', 'old', 'new', 'low'])
})
