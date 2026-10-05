import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { saveSnapshot, snapshotName, toPrune } from './backupPlugin'

const body = (data: Record<string, string>, exportedAt = '') => JSON.stringify({ app: 'pokeguide', version: 1, exportedAt, data })

describe('backupPlugin', () => {
  it('names snapshots sortably in local time', () => {
    expect(snapshotName(new Date(2026, 9, 5, 9, 7))).toBe('progress-2026-10-05T0907.json')
  })

  it('prunes the oldest beyond the limit and ignores other files', () => {
    const files = ['notes.txt', 'progress-2026-01-03T0000.json', 'progress-2026-01-01T0000.json', 'progress-2026-01-02T0000.json']
    expect(toPrune(files, 2)).toEqual(['progress-2026-01-01T0000.json'])
    expect(toPrune(files, 5)).toEqual([])
  })

  it('skips empty and unchanged snapshots, saves changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pg-backup-'))
    const a = body({ 'pokeguide:reborn:progress': '{"x":true}' }, 'one')
    expect(saveSnapshot(dir, body({}))).toEqual({ saved: false, file: null })
    expect(saveSnapshot(dir, a, new Date(2026, 0, 1, 10, 0)).saved).toBe(true)
    // Same data, new timestamp: not a change
    expect(saveSnapshot(dir, body({ 'pokeguide:reborn:progress': '{"x":true}' }, 'two'), new Date(2026, 0, 1, 10, 30)).saved).toBe(false)
    expect(saveSnapshot(dir, body({ 'pokeguide:reborn:progress': '{"x":true,"y":true}' }), new Date(2026, 0, 1, 11, 0)).saved).toBe(true)
    expect(readdirSync(dir).sort()).toEqual(['progress-2026-01-01T1000.json', 'progress-2026-01-01T1100.json'])
  })

  it('keeps only the newest snapshots', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pg-backup-'))
    for (let i = 0; i < 52; i++) writeFileSync(join(dir, `progress-2025-01-01T${String(i).padStart(4, '0')}.json`), body({ k: String(i) }))
    saveSnapshot(dir, body({ 'pokeguide:reborn:progress': '{"z":true}' }), new Date(2026, 0, 1))
    const left = readdirSync(dir).sort()
    expect(left).toHaveLength(50)
    expect(left.at(-1)).toBe('progress-2026-01-01T0000.json')
  })
})
