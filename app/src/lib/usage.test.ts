import { describe, expect, it } from 'vitest'
import { chats, days, modelLabel, totals, usd, type UsageRow } from './usage'

const row = (session: string, day: string, model: string, costUSD: number, title = ''): UsageRow => ({
  session, title, source: 'main', day, model, requests: 2, input: 1, output: 10, cacheRead: 100,
  cacheWrite5m: 0, cacheWrite1h: 5, webSearches: 0, costUSD
})

const rows = [
  row('a', '2026-10-05', 'claude-opus-5-5', 2, 'Map work'),
  row('a', '2026-10-06', 'claude-haiku-4-5-20251001', 0.5, 'Map work'),
  row('b', '2026-10-05', 'claude-sonnet-5-5', 1)
]

describe('usage', () => {
  it('labels models', () => {
    expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelLabel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(modelLabel('claude-opus-5')).toBe('Opus 5')
    expect(modelLabel('other')).toBe('other')
  })

  it('groups rows into chats with per-model cost and day span', () => {
    const a = chats(rows).find(c => c.session === 'a')!
    expect(a).toMatchObject({ title: 'Map work', firstDay: '2026-10-05', lastDay: '2026-10-06', costUSD: 2.5, requests: 4, tokens: 232 })
    expect(a.models).toEqual([['Opus 5.5', 2], ['Haiku 4.5', 0.5]])
  })

  it('sums days with a running total', () => {
    expect(days(rows)).toEqual([
      { day: '2026-10-05', costUSD: 3, cumulativeUSD: 3 },
      { day: '2026-10-06', costUSD: 0.5, cumulativeUSD: 3.5 }
    ])
  })

  it('totals and formats', () => {
    expect(totals(rows)).toMatchObject({ costUSD: 3.5, chats: 2, output: 30 })
    expect(usd(3.456)).toBe('$3.46')
    expect(usd(104.08)).toBe('$104')
  })
})
