import { describe, expect, it } from 'vitest'
import type { Dex } from '../../data/types'
import { linkProse, matchMarked, nameMaps, normalizeName } from './names'

const dex = {
  species: { PIKACHU: { name: 'Pikachu', forms: {} }, FARFETCHD: { name: "Farfetch'd", forms: {} } },
  items: { POKEBALL: { name: 'Poké Ball', desc: '', price: 200 }, ORANBERRY: { name: 'Oran Berry', desc: '', price: 20 } }
} as unknown as Dex

describe('normalizeName', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeName('  Oran   Berry ')).toBe('oran berry')
  })
  it('unifies curly and straight apostrophes', () => {
    expect(normalizeName('Farfetch’d')).toBe(normalizeName("Farfetch'd"))
  })
  it('treats Poke and Poké alike', () => {
    expect(normalizeName('Poké Ball')).toBe(normalizeName('poke ball'))
  })
})

describe('matchMarked', () => {
  const maps = nameMaps(dex)
  it('matches bold to species and italic to items', () => {
    expect(matchMarked(maps, 'STRONG', 'pikachu')).toEqual({ kind: 'species', sym: 'PIKACHU' })
    expect(matchMarked(maps, 'EM', 'Poke Ball')).toEqual({ kind: 'item', sym: 'POKEBALL' })
    expect(matchMarked(maps, 'STRONG', 'Farfetch’d')?.sym).toBe('FARFETCHD')
  })
  it('does not cross conventions or match partial names', () => {
    expect(matchMarked(maps, 'EM', 'Pikachu')).toBeNull()
    expect(matchMarked(maps, 'STRONG', 'Pika')).toBeNull()
    expect(matchMarked(maps, 'STRONG', '')).toBeNull()
  })
  it('builds the maps once per dex', () => {
    expect(nameMaps(dex)).toBe(nameMaps(dex))
  })
})

describe('linkProse', () => {
  // Minimal stand-in for a DOM element (no jsdom in this project)
  const fake = (tagName: string, textContent: string) => ({
    tagName, textContent, dataset: {} as Record<string, string>, tabIndex: -1, classList: { add: () => {} }
  })
  it('annotates matches and leaves the rest alone', () => {
    const els = [fake('STRONG', 'Pikachu'), fake('STRONG', 'Nobody'), fake('EM', 'oran berry')]
    const root = { querySelectorAll: () => ({ forEach: (f: (e: unknown) => void) => els.forEach(f) }) }
    expect(linkProse(root as never, nameMaps(dex))).toEqual({ matched: 2, total: 3 })
    expect(els[0].dataset.hcSym).toBe('PIKACHU')
    expect(els[1].dataset.hcKind).toBeUndefined()
    expect(els[2].dataset.hcKind).toBe('item')
  })
})
