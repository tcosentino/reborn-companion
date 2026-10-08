import { describe, expect, it } from 'vitest'
import { defaultFilters, parseFilters } from './dexFilters'

const defaults = defaultFilters('ch3')
const chapters = ['ch1', 'ch2', 'ch3']

describe('parseFilters', () => {
  it('returns defaults when nothing is saved or the value is garbage', () => {
    expect(parseFilters(null, defaults, chapters)).toEqual(defaults)
    expect(parseFilters('not json', defaults, chapters)).toEqual(defaults)
    expect(parseFilters('[1,2]', defaults, chapters)).toEqual(defaults)
  })

  it('restores saved filters', () => {
    const saved = { q: 'pika', type: 'ELECTRIC', tier: 'A', caught: 'missing', upTo: '', sort: 'tier' }
    expect(parseFilters(JSON.stringify(saved), defaults, chapters)).toEqual(saved)
  })

  it('drops invalid fields one by one', () => {
    const saved = { q: 3, type: 'FIRE', tier: 'Z', caught: 'maybe', upTo: 'gone', sort: 'name' }
    expect(parseFilters(JSON.stringify(saved), defaults, chapters)).toEqual({ ...defaults, type: 'FIRE' })
  })

  it('keeps a saved chapter that still exists', () => {
    expect(parseFilters(JSON.stringify({ upTo: 'ch1' }), defaults, chapters).upTo).toBe('ch1')
  })
})
