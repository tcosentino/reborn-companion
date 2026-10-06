import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyStarters, NATURES, natureEffect, unapplyStarters, validateStarters, type StartersDef } from './starters'

const prose = (markdown: string) => ({ type: 'prose', markdown })
const def: StartersDef = {
  match: '- The Grass types:',
  picks: [{ species: 'TORCHIC', ability: 'SPEEDBOOST', natures: ['Adamant'], note: 'Fast.' }]
}
const md = 'Pick one.\n\n- The Grass types: **Bulbasaur**\n- The Fire types: **Torchic**\n\nResetting is F12.'

describe('applyStarters', () => {
  it('swaps the matched paragraph for a starters block', () => {
    const r = applyStarters<{ type: string; markdown?: string }>([prose(md), { type: 'battle' }], def)
    expect(r.found).toBe(true)
    expect(r.blocks.map(b => b.type)).toEqual(['prose', 'starters', 'prose', 'battle'])
    expect(r.blocks[0].markdown).toBe('Pick one.')
    expect(r.blocks[1]).toMatchObject({ title: 'Starters', markdown: '- The Grass types: **Bulbasaur**\n- The Fire types: **Torchic**' })
    expect(r.blocks[2].markdown).toBe('Resetting is F12.')
  })

  it('is idempotent and undoes cleanly', () => {
    const once = applyStarters([prose(md)], def).blocks
    expect(applyStarters(once, def).blocks).toEqual(once)
    expect(unapplyStarters(once)).toEqual([prose(md)])
  })

  it('reports a missing paragraph', () => {
    expect(applyStarters([prose('Nothing here.')], def).found).toBe(false)
  })
})

describe('validateStarters', () => {
  const species = { TORCHIC: { forms: { '0': { abilities: ['BLAZE'], hiddenAbility: 'SPEEDBOOST' } } } }

  it('accepts a valid pick, including a null ability', () => {
    expect(validateStarters(def, species)).toEqual([])
    expect(validateStarters({ ...def, picks: [{ ...def.picks[0], ability: null }] }, species)).toEqual([])
  })

  it('flags unknown species, abilities and natures', () => {
    const bad: StartersDef = { match: 'x', picks: [
      { species: 'TORCHIC', ability: 'INTIMIDATE', natures: ['Spicy'], note: 'n' },
      { species: 'MISSINGNO', ability: null, natures: ['Adamant'], note: 'n' }
    ] }
    expect(validateStarters(bad, species)).toEqual([
      'TORCHIC: ability INTIMIDATE is not one of BLAZE, SPEEDBOOST',
      'TORCHIC: unknown nature "Spicy"',
      'MISSINGNO: not in the dex'
    ])
  })
})

describe('natures', () => {
  it('has all 25, with five neutral', () => {
    expect(Object.keys(NATURES)).toHaveLength(25)
    expect(Object.values(NATURES).filter(n => !n)).toHaveLength(5)
    expect(natureEffect('Adamant')).toBe('+Atk −SpA')
    expect(natureEffect('Bashful')).toBe('neutral')
  })

  it('every raised/lowered pair is unique', () => {
    const pairs = Object.values(NATURES).filter(Boolean).map(n => n!.join('>'))
    expect(new Set(pairs).size).toBe(20)
  })
})

describe('starters/reborn/grand-hall.json', () => {
  it('lists all 21 starters and validates against the pokedex', () => {
    const file = JSON.parse(readFileSync(new URL('../../../starters/reborn/grand-hall.json', import.meta.url), 'utf8'))
    expect(file.picks).toHaveLength(21)
    let pokedex: { species: Record<string, never> } | null = null
    try { pokedex = JSON.parse(readFileSync(new URL('../../public/data/reborn/pokedex.json', import.meta.url), 'utf8')) } catch { /* data not built */ }
    if (pokedex) expect(validateStarters(file, pokedex.species)).toEqual([])
  })
})
