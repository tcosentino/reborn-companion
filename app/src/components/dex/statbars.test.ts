import { describe, expect, it } from 'vitest'
import { getStatBand, statToPercent } from './statBarsHelpers'

describe('statBarsHelpers', () => {
  describe('getStatBand', () => {
    it('classifies stats below 50 as red', () => {
      expect(getStatBand(0)).toBe('red')
      expect(getStatBand(25)).toBe('red')
      expect(getStatBand(49)).toBe('red')
    })

    it('classifies stats 50-79 as orange', () => {
      expect(getStatBand(50)).toBe('orange')
      expect(getStatBand(65)).toBe('orange')
      expect(getStatBand(79)).toBe('orange')
    })

    it('classifies stats 80-99 as yellow', () => {
      expect(getStatBand(80)).toBe('yellow')
      expect(getStatBand(90)).toBe('yellow')
      expect(getStatBand(99)).toBe('yellow')
    })

    it('classifies stats 100-119 as green', () => {
      expect(getStatBand(100)).toBe('green')
      expect(getStatBand(110)).toBe('green')
      expect(getStatBand(119)).toBe('green')
    })

    it('classifies stats 120+ as teal', () => {
      expect(getStatBand(120)).toBe('teal')
      expect(getStatBand(150)).toBe('teal')
      expect(getStatBand(255)).toBe('teal')
    })
  })

  describe('statToPercent', () => {
    it('converts stat 0 to 0%', () => {
      expect(statToPercent(0)).toBe(0)
    })

    it('converts stat 255 to 100% (capped)', () => {
      expect(statToPercent(255)).toBe(100)
    })

    it('converts mid-range stats proportionally', () => {
      expect(statToPercent(127.5)).toBeCloseTo(50, 1)
      expect(statToPercent(128)).toBeCloseTo(50.2, 1)
    })

    it('clamps values above 255 to 100%', () => {
      expect(statToPercent(300)).toBe(100)
      expect(statToPercent(500)).toBe(100)
    })

    it('handles common base stat values', () => {
      // Typical low stat
      expect(statToPercent(45)).toBeCloseTo(17.6, 1)
      // Typical average stat
      expect(statToPercent(100)).toBeCloseTo(39.2, 1)
      // Typical high stat
      expect(statToPercent(150)).toBeCloseTo(58.8, 1)
    })
  })
})
