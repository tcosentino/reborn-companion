import { describe, expect, it } from 'vitest'
import type { EncounterMethod, EncounterRow } from '../../data/types'
import { buildEncounterGrid } from './encounterGrid'

const row = (species: string, rate: number, minLevel = 2, maxLevel = 4, extra: Partial<EncounterRow> = {}): EncounterRow => ({
  species, form: null, displayName: species[0] + species.slice(1).toLowerCase(), firstSeen: false,
  minLevel, maxLevel, levels: `${minLevel}-${maxLevel}`, rate, ...extra
})
const m = (method: string, time: string | null, rows: EncounterRow[]): EncounterMethod => ({ method, time, rows })

describe('buildEncounterGrid', () => {
  it('merges time tables into one row per Pokemon (opal-ward)', () => {
    const day = [row('RATTATA', 32), row('BIDOOF', 25), row('EKANS', 6, 3, 5)]
    const night = [row('RATTATA', 32), row('EKANS', 20, 2, 5), row('HOOTHOOT', 19, 3, 5)]
    const g = buildEncounterGrid([m('Grass', 'Morning', day), m('Grass', 'Day', day), m('Grass', 'Night', night)])
    expect(g.times).toEqual(['Morning', 'Day', 'Night'])
    expect(g.groups).toHaveLength(1)
    const rows = g.groups[0].rows
    expect(g.groups[0].timed).toBe(true)
    expect(rows.map(r => r.species)).toEqual(['RATTATA', 'BIDOOF', 'EKANS', 'HOOTHOOT'])
    expect(rows.find(r => r.species === 'EKANS')).toMatchObject({ rates: [6, 6, 20], levels: '2-5' })
    expect(rows.find(r => r.species === 'HOOTHOOT')?.rates).toEqual([null, null, 19])
  })

  it('collapses identical time tables, leaving no time columns', () => {
    const rows = [row('PIDGEY', 50)]
    const g = buildEncounterGrid([m('Grass', 'Morning', rows), m('Grass', 'Day', rows), m('Grass', 'Night', rows), m('Headbutt', null, [row('PIDGEY', 10)])])
    expect(g.times).toEqual([])
    expect(g.groups.map(x => [x.label, x.timed, x.rows[0].rates])).toEqual([['Grass', false, [50]], ['Headbutt', false, [10]]])
  })

  it('groups by method so untimed methods keep a single rate beside timed grass', () => {
    const g = buildEncounterGrid([
      m('Grass', 'Night', [row('HOOTHOOT', 40)]),
      m('Grass', 'Morning', [row('BUNEARY', 30)]),
      m('Grass', 'Day', [row('BUNEARY', 10)]),
      m('Surfing', null, [row('TENTACOOL', 100)])
    ])
    expect(g.times).toEqual(['Morning', 'Day', 'Night'])
    expect(g.groups.map(x => [x.label, x.timed, x.rows.map(r => r.rates)])).toEqual([
      ['Grass', true, [[30, 10, null], [null, null, 40]]],
      ['Surf', false, [[100]]]
    ])
  })

  it('labels fishing rods, sums duplicate entries, and keeps forms apart', () => {
    const g = buildEncounterGrid([
      m('Fishing-Old', null, [row('MAGIKARP', 70), row('MAGIKARP', 30, 5, 5)]),
      m('Surfing', null, [row('MEOWTH', 40, 5, 5, { form: 'Alolan Form', firstSeen: true }), row('MEOWTH', 60, 5, 5)])
    ])
    expect(g.groups.map(x => x.label)).toEqual(['Old Rod', 'Surf'])
    expect(g.groups[0].rows).toMatchObject([{ species: 'MAGIKARP', rates: [100], levels: '2-5' }])
    expect(g.groups[1].rows.map(r => [r.form, r.rates, r.firstSeen, r.levels])).toEqual([
      [null, [60], false, '5'],
      ['Alolan Form', [40], true, '5']
    ])
  })
})
