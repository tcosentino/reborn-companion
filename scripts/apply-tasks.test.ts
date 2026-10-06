import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateDefs } from './apply-tasks.ts'

test('validateDefs accepts a well-formed task', () => {
  assert.deepEqual(validateDefs('s', [{ id: 'gulpin', kind: 'catch', title: 'Catch Gulpin', match: 'With' }]), [])
})

test('validateDefs rejects bad ids, duplicates, kinds and empty fields', () => {
  const errors = validateDefs('s', [
    { id: 'Bad Id', kind: 'catch', title: 'T', match: 'M' },
    { id: 'dup', kind: 'quest', title: 'T', match: 'M' },
    { id: 'dup', kind: 'nope' as 'quest', title: ' ', match: '' }
  ])
  assert.equal(errors.length, 5)
})
