import { describe, expect, it } from 'vitest'
import { matchFieldName, resolveField } from './fieldMatch'

const names = {
  CORROSIVE: { name: 'Corrosive Field' },
  CORROSIVEMIST: { name: 'Corrosive Mist Field' },
  CRYSTALCAVERN: { name: 'Crystal Cavern' },
  FAIRYTALE: { name: 'Fairy Tale Field' },
  FOREST: { name: 'Forest Field' },
  MISTY: { name: 'Misty Terrain' },
  MURKWATERSURFACE: { name: 'Murkwater Surface' },
  MOUNTAIN: { name: 'Mountain' },
  SNOWYMOUNTAIN: { name: 'Snowy Mountain' },
  RAINBOW: { name: 'Rainbow Field' },
  ROCKY: { name: 'Rocky Field' },
  STARLIGHT: { name: 'Starlight Arena' },
  FLOWERGARDEN1: { name: 'Flower Garden Field' },
  FLOWERGARDEN2: { name: 'Flower Garden Field' }
}

describe('matchFieldName', () => {
  it('ignores suffix words and case', () => {
    expect(matchFieldName('Fairy Tale Arena', names)).toBe('FAIRYTALE')
    expect(matchFieldName('crystal cavern field', names)).toBe('CRYSTALCAVERN')
    expect(matchFieldName('Misty Terrain', names)).toBe('MISTY')
  })

  it('prefers an exact match over a longer name', () => {
    expect(matchFieldName('Mountain', names)).toBe('MOUNTAIN')
    expect(matchFieldName('Corrosive Field', names)).toBe('CORROSIVE')
  })

  it('matches abbreviated names by unique prefix', () => {
    expect(matchFieldName('Murkwater Field', names)).toBe('MURKWATERSURFACE')
  })

  it('does not guess when a prefix is ambiguous or unknown', () => {
    expect(matchFieldName('Flower', names)).toBeNull()
    expect(matchFieldName('Volcano Field', names)).toBeNull()
  })

  it('gives shared names to the first symbol', () => {
    expect(matchFieldName('Flower Garden Field', names)).toBe('FLOWERGARDEN1')
  })
})

describe('resolveField', () => {
  it('uses the symbol when present', () => {
    expect(resolveField('FOREST', 'Forest Field', names)).toEqual({ symbols: ['FOREST'], relation: 'single', unmatched: [] })
  })

  it('returns null with neither symbol nor name', () => {
    expect(resolveField(null, null, names)).toBeNull()
  })

  it('splits layered fields, top layer first', () => {
    expect(resolveField(null, 'Rainbow Field atop Rocky Field', names)).toEqual({
      symbols: ['RAINBOW', 'ROCKY'], relation: 'layered', unmatched: []
    })
    expect(resolveField(null, 'Rainbow Field upon Crystal Cavern Field', names)?.symbols).toEqual(['RAINBOW', 'CRYSTALCAVERN'])
    expect(resolveField(null, 'Corrosive Mist Field atop Corrosive Field', names)?.symbols).toEqual(['CORROSIVEMIST', 'CORROSIVE'])
    expect(resolveField(null, 'Misty Terrain atop Fairy Tale Field', names)?.symbols).toEqual(['MISTY', 'FAIRYTALE'])
  })

  it('treats "No Field" as nothing underneath', () => {
    expect(resolveField(null, 'Rainbow Field atop No Field', names)).toEqual({
      symbols: ['RAINBOW'], relation: 'single', unmatched: []
    })
  })

  it('handles either-or fields', () => {
    expect(resolveField(null, 'Fairy Tale Arena OR Starlight Arena', names)).toEqual({
      symbols: ['FAIRYTALE', 'STARLIGHT'], relation: 'either', unmatched: []
    })
  })

  it('reports unmatched pieces', () => {
    expect(resolveField(null, 'Rainbow Field atop Volcano Field', names)).toEqual({
      symbols: ['RAINBOW'], relation: 'single', unmatched: ['Volcano Field']
    })
  })
})
