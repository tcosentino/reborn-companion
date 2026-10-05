import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyOverride, parseOverride } from './overrides.ts'

const doc = [
  '# Episode 1',
  '',
  '## All Aboard!',
  '',
  'Old intro.',
  '',
  '### Sub heading',
  'Old sub text.',
  '',
  '## Grand Hall',
  '',
  'Keep me.',
].join('\n')

const override = (heading: string, body = 'New body.') =>
  parseOverride('test.md', `---\nfile: main_ep_01.md\nheading: ${heading}\n---\n\n${body}\n`)

test('parseOverride reads frontmatter and trims body', () => {
  assert.deepEqual(override('All Aboard!'), {
    source: 'test.md', file: 'main_ep_01.md', heading: 'All Aboard!', body: 'New body.',
  })
})

test('parseOverride rejects missing frontmatter fields', () => {
  assert.throws(() => parseOverride('bad.md', 'no frontmatter'), /missing frontmatter/)
  assert.throws(() => parseOverride('bad.md', '---\nfile: x.md\n---\nbody'), /file and heading/)
})

test('applyOverride replaces the section body including subsections', () => {
  const out = applyOverride(doc, override('All Aboard!'))
  assert.equal(out, ['# Episode 1', '', '## All Aboard!', '', 'New body.', '', '## Grand Hall', '', 'Keep me.'].join('\n'))
})

test('applyOverride handles the last section in a file', () => {
  const out = applyOverride(doc, override('Grand Hall', 'Replaced.'))
  assert.ok(out.endsWith('## Grand Hall\n\nReplaced.'))
  assert.ok(out.includes('Old intro.'))
})

test('applyOverride fails when the heading is missing or duplicated', () => {
  assert.throws(() => applyOverride(doc, override('Nope')), /found 0/)
  assert.throws(() => applyOverride(`${doc}\n## Grand Hall\n`, override('Grand Hall')), /found 2/)
})
