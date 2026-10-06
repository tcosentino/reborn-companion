import { describe, expect, it } from 'vitest'
import { applyTasks, taskRefs, unapplyTasks, type TaskDef } from './tasks'

const prose = (markdown: string) => ({ type: 'prose', markdown })
const battle = { type: 'battle' }

const def = (over: Partial<TaskDef> = {}): TaskDef => ({
  id: 'gulpin', kind: 'catch', title: 'Catch Gulpin', match: 'With the PokeSnax', species: ['GULPIN'], ...over
})

describe('applyTasks', () => {
  it('lifts the matched paragraph into a task block, keeping prose on both sides', () => {
    const blocks = [prose('Intro.\n\nWith the PokeSnax in our bag, talk to the dumpster.\n\nOutro.'), battle]
    const r = applyTasks(blocks, 'lower-peridot', [def()])
    expect(r.missing).toEqual([])
    expect(r.blocks).toEqual([
      prose('Intro.'),
      { type: 'task', id: 'task:lower-peridot/gulpin', slug: 'gulpin', kind: 'catch', title: 'Catch Gulpin',
        markdown: 'With the PokeSnax in our bag, talk to the dumpster.', species: ['GULPIN'] },
      prose('Outro.'),
      battle
    ])
  })

  it('reports definitions that match no paragraph', () => {
    const r = applyTasks([prose('Nothing here.')], 's', [def()])
    expect(r.missing.map(d => d.id)).toEqual(['gulpin'])
    expect(r.blocks).toEqual([prose('Nothing here.')])
  })

  it('is idempotent: reapplying gives the same blocks', () => {
    const blocks = [prose('A.\n\nWith the PokeSnax here.\n\nB.')]
    const once = applyTasks(blocks, 's', [def()]).blocks
    expect(applyTasks(once, 's', [def()]).blocks).toEqual(once)
  })

  it('reverts cleanly when a definition is removed', () => {
    const once = applyTasks([prose('A.\n\nWith the PokeSnax here.\n\nB.')], 's', [def()]).blocks
    expect(applyTasks(once, 's', []).blocks).toEqual([prose('A.\n\nWith the PokeSnax here.\n\nB.')])
  })

  it('omits species for non-catch tasks and flags overlapping matches', () => {
    const r = applyTasks([prose('Pay the man.')], 's', [def({ id: 'a', kind: 'quest', match: 'Pay', species: undefined }), def({ id: 'b', match: 'Pay the' })])
    expect(r.blocks[0]).not.toHaveProperty('species')
    expect(r.ambiguous.map(d => d.id)).toEqual(['a', 'b'])
  })

  it('groups tasks with the identical match on one paragraph, text on the first', () => {
    const md = 'Pay the man, then grab the Spoink and Happiny.'
    const r = applyTasks([prose(md)], 's', [def({ id: 'spoink', match: 'Pay the man' }), def({ id: 'happiny', match: 'Pay the man' })])
    expect(r.ambiguous).toEqual([])
    expect(r.blocks.map(b => [b.type, (b as { slug?: string }).slug, b.markdown])).toEqual([['task', 'spoink', md], ['task', 'happiny', '']])
    expect(applyTasks(r.blocks, 's', []).blocks).toEqual([prose(md)])
  })
})

describe('unapplyTasks', () => {
  it('joins adjacent prose and task blocks back into one prose block', () => {
    const blocks = [prose('A.'), { type: 'task', id: 'task:s/x', slug: 'x', kind: 'quest', title: 'X', markdown: 'B.' } as const, battle]
    expect(unapplyTasks(blocks)).toEqual([prose('A.\n\nB.'), battle])
  })
})

describe('taskRefs', () => {
  it('lists progress keys and titles in order', () => {
    const { blocks } = applyTasks([prose('With the PokeSnax.\n\nPay the man.')], 's', [def(), def({ id: 'pay', kind: 'quest', title: 'Pay', match: 'Pay' })])
    expect(taskRefs(blocks)).toEqual([['task:s/gulpin', 'Catch Gulpin'], ['task:s/pay', 'Pay']])
  })
})
