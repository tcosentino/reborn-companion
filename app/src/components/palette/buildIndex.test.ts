import { describe, expect, it } from 'vitest'
import type { Chapter, Dex, GuideIndex } from '../../data/types'
import { blockAnchors } from './anchors'
import { buildSearchIndex, proseItemMentions, tmParts } from './buildIndex'

describe('blockAnchors', () => {
  it('ids battles by team and dedupes repeated titles', () => {
    const ids = blockAnchors([
      { type: 'prose' },
      { type: 'battle', trainers: [{ teamId: ['Grant', 'MeteorGrunt', 1] }, { teamId: ['Janis', 'MeteorGrunt_090', 1] }] },
      { type: 'encounters', name: 'Underground Railnet (Obsidia Side)' },
      { type: 'shop', title: 'Poké Mart' },
      { type: 'shop', title: 'Poké Mart' }
    ])
    expect(ids).toEqual([
      null,
      'battle-Grant:MeteorGrunt:1+Janis:MeteorGrunt_090:1',
      'enc-underground-railnet-obsidia-side',
      'shop-poke-mart',
      'shop-poke-mart-2'
    ])
  })
})

describe('proseItemMentions', () => {
  const lookup = (k: string) => ({ pokeball: 'POKEBALL', steelgem: 'STEELGEM', tm22: 'TM22' } as Record<string, string>)[k]
  it('finds emphasized item names, ignoring bold and unknown text', () => {
    const md = 'Grab a hidden *Steel Gem*, two *Poké Balls* and *TM22 Solar Beam*. **Klink** is *great*.'
    expect(proseItemMentions(md, lookup)).toEqual(['STEELGEM', 'POKEBALL', 'TM22'])
  })
})

describe('buildSearchIndex', () => {
  const dex = {
    species: { KLINK: { name: 'Klink', forms: {} }, PIDGEY: { name: 'Pidgey', forms: {} } },
    items: { POTION: { name: 'Potion', desc: '', price: 300 } },
    moves: { IRONDEFENSE: { name: 'Iron Defense' } },
    abilities: {}, types: {}, fields: {}
  } as unknown as Dex
  const index = { chapters: [{ id: 'ep1', title: 'Episode 1', file: 'ep1.json', sections: [] }] } as unknown as GuideIndex
  const chapter = {
    id: 'ep1', title: 'Episode 1',
    sections: [{
      id: 'ward', title: 'Ward',
      blocks: [
        { type: 'prose', markdown: 'A hidden *Potion* here.' },
        { type: 'battle', partner: false, double: false, showField: true, fieldName: 'Factory', trainers: [{ name: 'Wayne', title: 'Street Rat', teamId: ['Wayne', 'StreetRat', 0] }], party: [{ species: 'PIDGEY', level: 16 }, { species: 'KLINK', level: 18 }] },
        { type: 'encounters', name: 'Cave', methods: [{ method: 'Cave', time: 'Day', rows: [{ species: 'KLINK', minLevel: 12, maxLevel: 18 }] }, { method: 'Cave', time: 'Night', rows: [{ species: 'KLINK', minLevel: 10, maxLevel: 17 }] }] },
        { type: 'shop', title: 'Mart', items: [{ name: 'Potion', item: 'POTION', price: 300 }] },
        { type: 'tutor', title: 'Tutor', moves: [{ name: 'Iron Defense', move: 'IRONDEFENSE', price: 1000 }] }
      ]
    }]
  } as unknown as Chapter
  const idx = buildSearchIndex(index, dex, new Map([['ep1.json', chapter]]))
  const anchor = (i: number) => idx.a[i]

  it('records trainers with anchor, levels, field and party', () => {
    const [t] = idx.t
    expect(t.slice(0, 2)).toEqual(['Wayne', 'Street Rat'])
    expect(anchor(t[3])).toBe('battle-Wayne:StreetRat:0')
    expect(t.slice(4, 6)).toEqual([16, 18])
    expect(idx.f[t[6]]).toBe('Factory')
    expect(t[7].map(i => idx.p[i][0])).toEqual(['PIDGEY', 'KLINK'])
  })

  it('merges encounter times and counts trainer usage', () => {
    const klink = idx.p.find(p => p[0] === 'KLINK')!
    expect(klink[1]).toHaveLength(1)
    expect(klink[1][0].slice(3)).toEqual([10, 18])
    expect(anchor(klink[1][0][1])).toBe('enc-cave')
    expect(klink[2]).toBe(1)
  })

  it('records shops, hidden mentions and tutors', () => {
    const [potion] = idx.i
    expect(potion[0]).toBe('Potion')
    expect(potion[2][0][2]).toBe(300)
    expect(anchor(potion[2][0][1])).toBe('shop-mart')
    expect(potion[3]).toEqual([0])
    expect(anchor(idx.mv[0][2][0][1])).toBe('tutor-tutor')
  })

  it('labels shop and tutor anchors with their block titles', () => {
    expect(idx.al?.[idx.a.indexOf('shop-mart')]).toBe('Mart')
    expect(idx.al?.[idx.a.indexOf('battle-Wayne:StreetRat:0')]).toBe('')
  })
})

describe('TMs', () => {
  it('splits TM names', () => {
    expect(tmParts('TM57 Charge Beam')).toEqual({ code: 'TM57', rest: 'Charge Beam' })
    expect(tmParts('tm57chargebeam')).toEqual({ code: 'TM57', rest: 'chargebeam' })
    expect(tmParts('HM01')).toEqual({ code: 'HM01', rest: '' })
    expect(tmParts('Trick Room')).toBeNull()
  })

  it('merges shop and prose TMs by number and names them after their move', () => {
    const dex = {
      species: {},
      items: { TM64: { name: 'TM64', desc: '', price: 7500 } },
      moves: { EXPLOSION: { name: 'Explosion' }, CHARGEBEAM: { name: 'Charge Beam' } },
      abilities: {}, types: {}, fields: {}
    } as unknown as Dex
    const index = { chapters: [{ id: 'ep1', title: 'Episode 1', file: 'ep1.json', sections: [] }] } as unknown as GuideIndex
    const chapter = {
      id: 'ep1', title: 'Episode 1',
      sections: [{
        id: 'ward', title: 'Ward',
        blocks: [
          { type: 'prose', markdown: 'Pick up *TM57 Charge Beam* and *TM64*.' },
          { type: 'shop', title: 'Mart', items: [{ name: 'TM64 Explosion', item: 'TM64', price: 7500 }] }
        ]
      }]
    } as unknown as Chapter
    const idx = buildSearchIndex(index, dex, new Map([['ep1.json', chapter]]))
    const rows = Object.fromEntries(idx.i.map(r => [r[1], r]))
    expect(rows.TM57.slice(0, 1).concat(rows.TM57[4] ?? '')).toEqual(['TM57 Charge Beam', 'CHARGEBEAM'])
    expect(rows.TM64[0]).toBe('TM64 Explosion')
    expect(rows.TM64[2]).toHaveLength(1)
    expect(rows.TM64[3]).toEqual([0])
    expect(rows.TM64[4]).toBe('EXPLOSION')
  })
})
