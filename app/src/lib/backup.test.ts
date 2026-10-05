import { describe, expect, it } from 'vitest'
import { backupFilename, countTicks, createBackup, parseBackup, restoreBackup } from './backup'

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    dump: () => Object.fromEntries(m)
  }
}

describe('backup', () => {
  it('exports only pokeguide keys', () => {
    const store = memory({ 'pokeguide:reborn:progress': '{"a":true}', 'other:key': 'x' })
    const b = createBackup(store, new Date('2026-10-05T00:00:00Z'))
    expect(b.data).toEqual({ 'pokeguide:reborn:progress': '{"a":true}' })
    expect(b.exportedAt).toBe('2026-10-05T00:00:00.000Z')
  })

  it('round-trips through JSON into an empty store', () => {
    const src = memory({ 'pokeguide:reborn:progress': '{"a":true}', 'pokeguide:reborn:lastSection': 'obsidia-ward' })
    const dst = memory()
    restoreBackup(dst, parseBackup(JSON.stringify(createBackup(src))))
    expect(dst.dump()).toEqual(src.dump())
  })

  it('unions checklists so restoring never unticks', () => {
    const dst = memory({ 'pokeguide:reborn:caught': '{"PIKACHU":true}', 'pokeguide:reborn:prefs': '{"hideDefeated":true}' })
    const backup = parseBackup(JSON.stringify({
      app: 'pokeguide', version: 1, exportedAt: '',
      data: { 'pokeguide:reborn:caught': '{"EEVEE":true}', 'pokeguide:reborn:prefs': '{}' }
    }))
    restoreBackup(dst, backup)
    expect(JSON.parse(dst.getItem('pokeguide:reborn:caught')!)).toEqual({ PIKACHU: true, EEVEE: true })
    expect(dst.getItem('pokeguide:reborn:prefs')).toBe('{}')
    expect(countTicks(backup)).toBe(1)
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow('Not a PokeGuide backup')
    expect(() => parseBackup('{"app":"pokeguide","version":1,"data":{"evil":"x"}}')).toThrow('Unexpected entry')
    expect(() => parseBackup('not json')).toThrow()
  })

  it('names files by date', () => {
    expect(backupFilename(new Date('2026-10-05T12:00:00Z'))).toBe('pokeguide-progress-2026-10-05.json')
  })
})
