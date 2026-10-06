import { describe, expect, it } from 'vitest'
import type { Chapter, GuideIndex, RankEntry } from '../data/types'
import { anchorAt, caughtTally, furthestBeaten, sectionSpecies, mySpot, nextUnbeaten, pageItems, progressRefs, sumTallies, tally } from './guideNav'
import { battleRefs, buildSectionBattles, type BattleRef } from './sectionBattles'
import { catchHere } from './catchHere'
import { parseSpot } from './progress'

const tr = (name: string, title = 'Youngster', n = 0) => ({ name, title, trainerType: title.toUpperCase(), teamId: [name, title.toUpperCase(), n] as [string, string, number] })

describe('sectionBattles', () => {
  it('lists non-partner battles with checklist ids and labels', () => {
    const refs = battleRefs([
      { type: 'prose' },
      { type: 'battle', partner: false, trainers: [tr('Joey')] },
      { type: 'battle', partner: true, trainers: [tr('Ally', 'Partner')] },
      { type: 'battle', partner: false, trainers: [tr('Grant', 'Grunt', 1), tr('Janis', 'Grunt', 2)] }
    ])
    expect(refs).toEqual([
      ['Joey:YOUNGSTER:0', 'Youngster Joey'],
      ['Grant:GRUNT:1+Janis:GRUNT:2', 'Grunt Grant & Grunt Janis']
    ])
  })

  it('keys intro sections by chapter id and skips sections without battles', () => {
    const index = { chapters: [{ id: 'ep1', title: 'Ep 1', file: 'ep1.json', sections: [] }] } as unknown as GuideIndex
    const ch = { id: 'ep1', title: 'Ep 1', sections: [
      { id: null, title: null, blocks: [{ type: 'battle', partner: false, trainers: [tr('Cain')] }] },
      { id: 'quiet', title: 'Quiet', blocks: [{ type: 'prose', markdown: '' }] }
    ] } as unknown as Chapter
    expect(buildSectionBattles(index, new Map([['ep1.json', ch]]))).toEqual({ v: 1, s: { ep1: [['Cain:YOUNGSTER:0', 'Youngster Cain']] }, t: {} })
  })

  it('lists walkthrough tasks per section next to battles', () => {
    const index = { chapters: [{ id: 'ep1', title: 'Ep 1', file: 'ep1.json', sections: [] }] } as unknown as GuideIndex
    const ch = { id: 'ep1', title: 'Ep 1', sections: [
      { id: 'yard', title: 'Yard', blocks: [{ type: 'task', id: 'task:yard/gulpin', slug: 'gulpin', kind: 'catch', title: 'Catch Gulpin', markdown: '' }] }
    ] } as unknown as Chapter
    expect(buildSectionBattles(index, new Map([['ep1.json', ch]]))).toEqual({ v: 1, s: {}, t: { yard: [['task:yard/gulpin', 'Catch Gulpin']] } })
  })
})

describe('progress helpers', () => {
  const battles: Record<string, BattleRef[]> = {
    a: [['a1', 'A1'], ['a2', 'A2']],
    c: [['c1', 'C1']],
    d: [['d1', 'D1']]
  }
  const order = ['a', 'b', 'c', 'd']

  it('tallies beaten battles per section and in total', () => {
    const done = { a1: true, c1: true } as Record<string, true>
    expect(tally(battles.a, done)).toEqual({ beaten: 1, total: 2 })
    expect(tally(undefined, done)).toEqual({ beaten: 0, total: 0 })
    expect(sumTallies(order.map(id => tally(battles[id], done)))).toEqual({ beaten: 2, total: 4 })
    expect(nextUnbeaten(battles.a, done)).toEqual(['a2', 'A2'])
  })

  it('counts tasks with battles for a section tally', () => {
    const tasks: Record<string, BattleRef[]> = { a: [['task:a/x', 'X']], b: [['task:b/y', 'Y']] }
    expect(progressRefs(battles, tasks, 'a')).toEqual([['a1', 'A1'], ['a2', 'A2'], ['task:a/x', 'X']])
    expect(progressRefs(battles, tasks, 'b')).toEqual([['task:b/y', 'Y']])
    expect(progressRefs(battles, undefined, 'c')).toEqual([['c1', 'C1']])
    expect(tally(progressRefs(battles, tasks, 'a'), { 'task:a/x': true })).toEqual({ beaten: 1, total: 3 })
  })

  it('finds the furthest section with progress and the next battle from there', () => {
    expect(furthestBeaten(order, battles, {})).toBe(-1)
    expect(mySpot(order, battles, {})).toBeNull()
    // An earlier gap (a2) does not pull the spot back
    expect(mySpot(order, battles, { a1: true, c1: true })).toEqual({ section: 'd', anchor: 'battle-d1', label: 'D1' })
    expect(mySpot(order, battles, { a1: true })).toEqual({ section: 'a', anchor: 'battle-a2', label: 'A2' })
    expect(mySpot(order, battles, { d1: true })).toEqual({ section: 'd', anchor: null, label: null })
  })

  it('picks the last block whose top passed the reading line', () => {
    const tops: [string, number][] = [['x', -400], ['y', 80], ['z', 600]]
    expect(anchorAt(tops, 200)).toBe('y')
    expect(anchorAt(tops, 50)).toBe('x')
    expect(anchorAt([['x', 300]], 200)).toBeNull()
  })

  it('reads the saved spot, ignoring anchors from another section or bad JSON', () => {
    expect(parseSpot(null, null)).toBeNull()
    expect(parseSpot('opal-ward', null)).toEqual({ section: 'opal-ward', anchor: null })
    expect(parseSpot('opal-ward', '{"section":"opal-ward","anchor":"battle-x"}')).toEqual({ section: 'opal-ward', anchor: 'battle-x' })
    expect(parseSpot('opal-ward', '{"section":"grand-hall","anchor":"battle-x"}')).toEqual({ section: 'opal-ward', anchor: null })
    expect(parseSpot('opal-ward', '{oops')).toEqual({ section: 'opal-ward', anchor: null })
  })
})

describe('pageItems', () => {
  it('lists anchored battles, tables, shops and tutors with beaten state', () => {
    const blocks = [
      { type: 'prose' },
      { type: 'battle', partner: false, trainers: [tr('Joey')] },
      { type: 'battle', partner: true, trainers: [tr('Ally', 'Partner')] },
      { type: 'encounters', name: 'Route 1' },
      { type: 'shop', title: 'Mart' },
      { type: 'tutor', title: 'Tutor' },
      { type: 'task', id: 'task:s/gulpin', title: 'Catch Gulpin' }
    ]
    const anchors = [null, 'battle-Joey:YOUNGSTER:0', 'battle-Ally:PARTNER:0', 'enc-route-1', 'shop-mart', 'tutor-tutor', 'task-gulpin']
    expect(pageItems(blocks, anchors, { 'Joey:YOUNGSTER:0': true, 'task:s/gulpin': true })).toEqual([
      { id: 'battle-Joey:YOUNGSTER:0', kind: 'battle', label: 'Youngster Joey', beaten: true },
      { id: 'battle-Ally:PARTNER:0', kind: 'battle', label: 'Partner: Partner Ally', beaten: undefined },
      { id: 'enc-route-1', kind: 'encounters', label: 'Route 1' },
      { id: 'shop-mart', kind: 'shop', label: 'Mart' },
      { id: 'tutor-tutor', kind: 'tutor', label: 'Tutor' },
      { id: 'task-gulpin', kind: 'task', label: 'Catch Gulpin', beaten: true }
    ])
  })
})

describe('catchHere', () => {
  const row = (species: string, firstSeen = false) => ({ species, form: null, displayName: species[0] + species.slice(1).toLowerCase(), firstSeen })
  const blocks = [
    { type: 'encounters', methods: [{ rows: [row('RATTATA'), row('ZUBAT', true)] }, { rows: [row('RATTATA', true)] }] },
    { type: 'shop' },
    { type: 'encounters', methods: [{ rows: [row('ABRA'), row('GASTLY', true), row('ODDISH')] }] }
  ]
  const rank = (tier: RankEntry['tier']) => ({ tier } as RankEntry)

  it('dedupes across tables and sorts by tier, then new-to-dex, then name', () => {
    const list = catchHere(blocks, { ranks: { ABRA: rank('A'), GASTLY: rank('A'), ZUBAT: rank('C'), RATTATA: rank('C') }, caught: { ZUBAT: true } })
    expect(list.map(s => s.species)).toEqual(['GASTLY', 'ABRA', 'RATTATA', 'ZUBAT', 'ODDISH'])
    // firstSeen from any table counts
    expect(list.find(s => s.species === 'RATTATA')?.firstSeen).toBe(true)
    expect(list.find(s => s.species === 'ZUBAT')?.caught).toBe(true)
    expect(list.every(s => !s.lastChance)).toBe(true)
  })

  it('flags species with no listing after this section', () => {
    const places: Record<string, { sectionId: string }[]> = {
      ABRA: [{ sectionId: 'here' }],
      GASTLY: [{ sectionId: 'here' }, { sectionId: 'later' }],
      ODDISH: [{ sectionId: 'here' }, { sectionId: 'unknown' }]
    }
    const list = catchHere(blocks, { caught: {}, places: s => places[s], sectionOrder: { early: 0, here: 1, later: 2 }, here: 1 })
    expect(list.filter(s => s.lastChance).map(s => s.species)).toEqual(['ABRA'])
  })
})

describe('sectionSpecies', () => {
  const species = {
    ABRA: { locations: [{ sectionId: 'a' }, { sectionId: 'b' }, { sectionId: 'a' }] },
    ZUBAT: { locations: [{ sectionId: 'a' }] },
    MEW: { locations: [] }
  }

  it('groups species by section without duplicates', () => {
    const map = sectionSpecies(species)
    expect(map.a.sort()).toEqual(['ABRA', 'ZUBAT'])
    expect(map.b).toEqual(['ABRA'])
    expect(Object.keys(map).sort()).toEqual(['a', 'b'])
  })

  it('counts each species once across sections', () => {
    const map = sectionSpecies(species)
    expect(caughtTally([map.a, map.b, map.missing], { ABRA: true })).toEqual({ beaten: 1, total: 2 })
    expect(caughtTally([undefined], {})).toEqual({ beaten: 0, total: 0 })
  })
})
