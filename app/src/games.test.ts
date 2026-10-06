import { describe, expect, it } from 'vitest'
import { GAMES, gameById } from './games'

describe('game registry', () => {
  it('loads every manifest in /games', () => {
    expect(GAMES.length).toBeGreaterThan(0)
    expect(gameById('reborn')?.name).toBe('Pokemon Reborn')
  })

  it('exposes only app-facing fields', () => {
    for (const g of GAMES) {
      expect(Object.keys(g).sort()).toEqual(['credit', 'id', 'imageBase', 'name', 'tagline'])
      expect(g.credit.url).toMatch(/^https?:\/\//)
    }
  })

  it('has unique ids', () => {
    expect(new Set(GAMES.map(g => g.id)).size).toBe(GAMES.length)
  })
})
