import { describe, expect, it } from 'vitest'
import type { PokedexSpecies } from '../../data/types'
import type { SearchIndex } from '../palette/indexTypes'
import { episodeOf, groupRuns, opponentsOf, specialMentions } from './speciesExtras'

const idx = {
  v: 1,
  ch: ['Episode 1: Start', 'Episode 2: Reap'],
  s: [['grand-hall', 'Grand Hall', 0], ['opal-ward', 'Opal Ward', 1], ['railnet', 'Railnet', 1]],
  a: ['battle-A', 'battle-B', 'battle-C'],
  m: [], f: [],
  t: [
    ['Cain', 'Pretty Boy', [0], 0, 5, 5, -1, [0, 1], 0],
    ['Julia', 'Leader', [1, 2], 1, 20, 24, -1, [1], 0],
    ['Fern', 'Rival', [2], 2, 22, 22, -1, [0], 0]
  ],
  p: [['PIKACHU', [], 2, null], ['VOLTORB', [], 1, null]],
  i: [], mv: []
} as unknown as SearchIndex

describe('specialMentions', () => {
  it('drops sections already listed as locations and duplicates', () => {
    const s = {
      locations: [{ sectionId: 'opal-ward' }],
      mentions: [
        { chapterId: 'c', sectionId: 'grand-hall', sectionTitle: 'Grand Hall' },
        { chapterId: 'c', sectionId: 'opal-ward', sectionTitle: 'Opal Ward' },
        { chapterId: 'c', sectionId: 'grand-hall', sectionTitle: 'Grand Hall' }
      ]
    } as unknown as PokedexSpecies
    expect(specialMentions(s).map(m => m.sectionId)).toEqual(['grand-hall'])
    expect(specialMentions({ locations: [] } as unknown as PokedexSpecies)).toEqual([])
  })
})

describe('opponentsOf', () => {
  it('lists trainers using the species in guide order with their first section and episode', () => {
    expect(opponentsOf(idx, 'PIKACHU').map(o => [o.names, o.section, o.anchor, o.episode])).toEqual([
      ['Cain', 'grand-hall', 'battle-A', 'Ep 1'],
      ['Fern', 'railnet', 'battle-C', 'Ep 2']
    ])
    expect(opponentsOf(idx, 'MEW')).toEqual([])
  })

  it('groups consecutive opponents by episode', () => {
    const groups = groupRuns(opponentsOf(idx, 'PIKACHU'), o => o.episode)
    expect(groups.map(([k, xs]) => [k, xs.length])).toEqual([['Ep 1', 1], ['Ep 2', 1]])
  })
})

describe('episodeOf', () => {
  it('labels a section with its episode', () => {
    expect(episodeOf(idx, 'railnet')).toBe('Ep 2')
    expect(episodeOf(idx, 'nowhere')).toBeNull()
    expect(episodeOf(null, 'railnet')).toBeNull()
  })
})
