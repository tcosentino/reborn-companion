import { describe, expect, it } from 'vitest'
import { DEFAULT_CAPS, normalize, score, search, type Entry, type Kind } from './search'

const e = (kind: Kind, ref: number, ...terms: string[]): Entry => ({ kind, ref, terms: terms.map(normalize) })

describe('score', () => {
  it('returns 0 when nothing matches', () => {
    expect(score('zzz', 'pikachu')).toBe(0)
    expect(score('', 'pikachu')).toBe(0)
  })

  it('orders exact > prefix > word boundary > all-words > substring > subsequence', () => {
    const exact = score('rock', 'rock')
    const prefix = score('rock', 'rock slide')
    const word = score('rock', 'stealth rock')
    const words = score('ste ro', 'stealth rock')
    const sub = score('ock', 'stealth rock')
    const subseq = score('stlrk', 'stealth rock')
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(word)
    expect(word).toBeGreaterThan(words)
    expect(words).toBeGreaterThan(sub)
    expect(sub).toBeGreaterThan(subseq)
    expect(subseq).toBeGreaterThan(0)
  })

  it('prefers shorter terms within a tier', () => {
    expect(score('pid', 'pidgey')).toBeGreaterThan(score('pid', 'pidgeotto'))
  })

  it('rewards contiguous subsequences over scattered ones', () => {
    expect(score('grnt', 'meteor grunt')).toBeGreaterThan(score('grnt', 'great ball nest timer'))
  })

  it('rejects very scattered subsequences and single letters', () => {
    expect(score('az', 'a very long name ending in z')).toBe(0)
    expect(score('steel', 'street rat franklin')).toBe(0)
    expect(score('q', 'aqua')).toBeGreaterThan(0) // substring still matches
    expect(score('x', 'abc')).toBe(0)
  })

  it('normalizes accents and case', () => {
    expect(score(normalize('poke ball'), normalize('Poké Ball'))).toBe(1000)
  })
})

describe('search', () => {
  const entries = [
    e('section', 0, 'Obsidia Ward', 'Episode 2'),
    e('section', 1, 'Obsidia Slums'),
    e('trainer', 0, 'Street Rat Franklin', 'Franklin'),
    e('trainer', 1, 'Meteor Grunt Grant & Janis', 'Grant & Janis'),
    e('species', 0, 'Klink'),
    e('species', 1, 'Klang'),
    e('item', 0, 'Steel Gem'),
    e('move', 0, 'Steel Wing')
  ]

  it('groups results by kind and puts the best group first', () => {
    const groups = search(entries, 'obsid')
    expect(groups.map(g => g.kind)).toEqual(['section'])
    expect(groups[0].hits.map(h => h.entry.ref)).toEqual([0, 1])
  })

  it('matches secondary terms such as a bare trainer name', () => {
    const groups = search(entries, 'franklin')
    expect(groups[0].kind).toBe('trainer')
    expect(groups[0].hits[0].score).toBe(1000)
  })

  it('ranks prefix hits above word-boundary hits across groups', () => {
    const groups = search(entries, 'steel')
    expect(groups.map(g => g.kind)).toEqual(['item', 'move'])
  })

  it('caps each group and reports the total', () => {
    const many = Array.from({ length: 40 }, (_, i) => e('species', i, `Pidgey ${i}`))
    const [g] = search(many, 'pidgey')
    expect(g.hits).toHaveLength(DEFAULT_CAPS.species)
    expect(g.total).toBe(40)
    // ties keep guide order
    expect(g.hits[0].entry.ref).toBe(0)
  })

  it('returns nothing for an empty query', () => {
    expect(search(entries, '   ')).toEqual([])
  })

  it('applies boosts as tie-breakers', () => {
    const boosted = [e('species', 0, 'Zubat'), { ...e('species', 1, 'Zubat'), boost: 5 }]
    expect(search(boosted, 'zubat')[0].hits[0].entry.ref).toBe(1)
  })

  it('stays fast on 10k entries', () => {
    const words = ['ace', 'trainer', 'grunt', 'ward', 'cave', 'ball', 'berry', 'gem', 'shard', 'tower']
    const big = Array.from({ length: 10_000 }, (_, i) =>
      e((['section', 'trainer', 'species', 'item', 'move'] as Kind[])[i % 5], i,
        `${words[i % 10]} ${words[(i * 7) % 10]} ${i}`, `name${i}`))
    const t0 = performance.now()
    for (const q of ['a', 'ac', 'ace', 'ace t', 'ace tr', 'grnt', 'xyz']) search(big, q)
    const per = (performance.now() - t0) / 7
    expect(per).toBeLessThan(30)
  })
})
