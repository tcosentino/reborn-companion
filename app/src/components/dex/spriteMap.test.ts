import { describe, expect, it } from 'vitest'
import { battlerSource, iconSource, resolveFormIndex, toobigFile } from './spriteMap'

const files = new Map([
  ['togedemaru.png', { w: 384, h: 384 }],
  ['tangrowth.png', { w: 384, h: 1536 }],
  ['tangrowth_1.png', { w: 246, h: 214 }],
  ['kyurem.png', { w: 384, h: 384 }],
  ['kyurem_1.png', { w: 300, h: 300 }],
  ['kyuremb_1.png', { w: 300, h: 300 }],
  ['solo.png', { w: 192, h: 384 }]
])

describe('battlerSource', () => {
  it('crops the normal front cell for form 0', () => {
    expect(battlerSource('TOGEDEMARU', 0, false, files)).toEqual({
      file: 'togedemaru.png', crop: { x: 0, y: 0, w: 192, h: 192 }
    })
  })
  it('uses column 1 for shiny', () => {
    expect(battlerSource('TOGEDEMARU', 0, true, files)?.crop).toMatchObject({ x: 192, y: 0 })
  })
  it('steps 384px per form row on sheets', () => {
    expect(battlerSource('TANGROWTH', 2, false, files)?.crop).toMatchObject({ x: 0, y: 768 })
  })
  it('prefers a standalone toobig file for forms above 0', () => {
    expect(battlerSource('KYUREM', 1, false, files)).toEqual({ file: 'kyurem_1.png', crop: null })
    expect(battlerSource('TANGROWTH', 1, false, files)).toEqual({ file: 'tangrowth_1.png', crop: null })
  })
  it('does not fall back to the normal sprite for a missing toobig shiny', () => {
    expect(battlerSource('KYUREM', 1, true, files)).toBeNull()
  })
  it('falls back to the first row when the form row is missing', () => {
    expect(battlerSource('KYUREM', 3, false, files)?.crop).toMatchObject({ y: 0 })
  })
  it('returns null for unknown species and sheets without a shiny column', () => {
    expect(battlerSource('MISSINGNO', 0, false, files)).toBeNull()
    expect(battlerSource('SOLO', 0, true, files)).toBeNull()
  })
})

describe('iconSource', () => {
  const icons = new Map([['pikachu.png', { w: 256, h: 128 }], ['plain.png', { w: 128, h: 64 }]])
  it('takes the first 64px frame, row per form', () => {
    expect(iconSource('PIKACHU', 0, false, icons)?.crop).toEqual({ x: 0, y: 0, w: 64, h: 64 })
    expect(iconSource('PIKACHU', 1, true, icons)?.crop).toEqual({ x: 128, y: 64, w: 64, h: 64 })
  })
  it('falls back to row 0 and rejects missing shiny columns', () => {
    expect(iconSource('PIKACHU', 5, false, icons)?.crop).toMatchObject({ y: 0 })
    expect(iconSource('PLAIN', 0, true, icons)).toBeNull()
    expect(iconSource('NOPE', 0, false, icons)).toBeNull()
  })
})

describe('naming helpers', () => {
  it('builds toobig names with the shiny tag before the form', () => {
    expect(toobigFile('EXEGGUTOR', 1, true)).toBe('exeggutors_1.png')
  })
  it('resolves form indexes and names', () => {
    const forms = { 0: { name: 'Normal Form' }, 1: { name: 'Alolan Form' } }
    expect(resolveFormIndex(forms, 1)).toBe('1')
    expect(resolveFormIndex(forms, 'Alolan Form')).toBe('1')
    expect(resolveFormIndex(forms, 'Weird')).toBe('0')
    expect(resolveFormIndex(forms, null)).toBe('0')
  })
})
