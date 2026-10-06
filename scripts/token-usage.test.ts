import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { costOf, costParts, merge, report, scan, transcriptDirs, type Row } from './token-usage.ts'

const ROOT = '/Users/me/repo'
const S1 = '11111111-1111-1111-1111-111111111111'
const S2 = '22222222-2222-2222-2222-222222222222'

const assistant = (session: string, requestId: string, usage: object, model = 'claude-opus-5-5') =>
  JSON.stringify({ type: 'assistant', sessionId: session, requestId, timestamp: '2026-10-05T01:00:00Z', message: { id: requestId, model, usage } })

test('costOf matches Claude Code for an Opus 5.5 session (1h cache writes)', () => {
  const u = { input_tokens: 1598, output_tokens: 27615, cache_read_input_tokens: 4995910,
    cache_creation_input_tokens: 104077, cache_creation: { ephemeral_1h_input_tokens: 104077, ephemeral_5m_input_tokens: 0 } }
  assert.equal(costOf('claude-opus-5-5', u)!.toFixed(4), '2.3905')
})

test('costOf strips date suffixes, doubles fast mode and returns undefined for unknown models', () => {
  assert.equal(costOf('claude-haiku-4-5-20251001', { input_tokens: 1e6 }), 1)
  assert.equal(costOf('claude-opus-5-5', { output_tokens: 1e6, speed: 'fast' }), 40)
  assert.equal(costOf('claude-mystery', { input_tokens: 1 }), undefined)
})

test('costParts splits a response into output, cache read and cache write cost', () => {
  const c = costParts('claude-opus-5-5', { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6,
    cache_creation_input_tokens: 2e6, cache_creation: { ephemeral_1h_input_tokens: 1e6, ephemeral_5m_input_tokens: 1e6 } })!
  const rounded = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v.toFixed(6))]))
  assert.deepEqual(rounded, { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 13, web: 0 })
})

test('transcriptDirs picks the repo, its subdirs and worktrees but not sibling repos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'usage-'))
  for (const name of ['-Users-me-repo', '-Users-me-repo-upstream', '-Users-me-repo--claude-worktrees-agent-x', '-Users-me-repository'])
    mkdirSync(join(dir, name))
  assert.deepEqual(transcriptDirs(dir, ROOT).map(p => p.slice(dir.length + 1)).sort(),
    ['-Users-me-repo', '-Users-me-repo--claude-worktrees-agent-x', '-Users-me-repo-upstream'])
})

test('scan dedupes repeated request ids, bills subagents to the parent and reads titles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'usage-'))
  const proj = join(dir, '-Users-me-repo')
  mkdirSync(join(proj, S1, 'subagents'), { recursive: true })
  const u = { input_tokens: 10, output_tokens: 100 }
  writeFileSync(join(proj, `${S1}.jsonl`), [
    assistant(S1, 'req_a', u), assistant(S1, 'req_a', u), assistant(S1, 'req_b', u),
    JSON.stringify({ type: 'custom-title', sessionId: S1, customTitle: 'Do things' })
  ].join('\n'))
  writeFileSync(join(proj, S1, 'subagents', 'agent-x.jsonl'), assistant('other', 'req_c', u, 'claude-haiku-4-5-20251001'))
  const { rows, unpriced } = scan([proj], ROOT)
  assert.equal(unpriced.size, 0)
  const opus = rows.find(r => r.model === 'claude-opus-5-5')!
  assert.equal(opus.requests, 2)
  assert.equal(opus.output, 200)
  assert.equal(opus.title, 'Do things')
  assert.equal(opus.subagent, undefined)
  assert.equal(opus.costOutput.toFixed(4), '0.0040')
  const haiku = rows.find(r => r.model.startsWith('claude-haiku'))!
  assert.equal(haiku.session, S1)
  assert.equal(haiku.source, 'main')
  assert.equal(haiku.subagent, true)
})

const row = (session: string, costUSD: number, title = ''): Row => ({
  session, title, source: 'main', day: '2026-10-05', model: 'claude-opus-5-5', requests: 1, input: 0, output: 0,
  cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, webSearches: 0, costUSD, costOutput: costUSD, costCacheRead: 0, costCacheWrite: 0
})

test('merge keeps sessions whose transcripts are gone and replaces live ones', () => {
  const merged = merge([row(S1, 1, 'Old'), row(S2, 5)], [row(S2, 7)])
  assert.deepEqual(merged.map(r => [r.session, r.costUSD]), [[S1, 1], [S2, 7]])
  assert.equal(merge([row(S1, 1, 'Kept')], [row(S1, 2)])[0].title, 'Kept')
})

test('report totals and running cost', () => {
  const md = report({ updated: 'now', unpricedModels: [], rows: [row(S1, 1.5), { ...row(S2, 2), day: '2026-10-06' }] })
  assert.match(md, /\*\*\$3\.50\*\* across \*\*2\*\* sessions/)
  assert.match(md, /\| 2026-10-06 \| \$2\.00 \| \$3\.50 \|/)
  assert.match(md, /\| Output \| \$3\.50 \| 100% \|/)
  assert.match(md, /\| main thread \|/)
})
