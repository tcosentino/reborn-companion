import { describe, expect, it } from 'vitest'
import type { Block } from '../../data/types'
import { groupHiddenItems, hiddenEntryId, type HiddenItemsBlock } from './group'

const img = (n: string): Block => ({ type: 'image', file: `hidden${n}.png`, src: `/assets/images/reborn/hidden${n}.png` })
const prose = (markdown: string): Block => ({ type: 'prose', markdown })
const battle = { type: 'battle' } as unknown as Block

const hidden = (blocks: ReturnType<typeof groupHiddenItems>) => blocks.filter((b): b is HiddenItemsBlock => b.type === 'hiddenItems')
const letters = (b: HiddenItemsBlock) => b.entries.map(e => `${e.letter}:${e.name}`)

describe('groupHiddenItems', () => {
  it('folds a plain list after the image and removes it from the prose (opal-ward)', () => {
    const out = groupHiddenItems([
      prose('There are also some hidden items on the bridge:'),
      img('002'),
      prose('- (A): *Awakening*\n- (B): *Blue Shard*\n- (C): *Antidote*\n\nIn the top right, you\'ll find three bullies.')
    ], 'opal-ward')
    expect(out.map(b => b.type)).toEqual(['prose', 'hiddenItems', 'prose'])
    expect(letters(hidden(out)[0])).toEqual(['A:Awakening', 'B:Blue Shard', 'C:Antidote'])
    expect((out[2] as { markdown: string }).markdown).toBe('In the top right, you\'ll find three bullies.')
    expect(hiddenEntryId(hidden(out)[0], hidden(out)[0].entries[1])).toBe('opal-ward:hidden002.png:B')
  })

  it('drops a prose block that was only list lines', () => {
    const out = groupHiddenItems([img('013'), prose('- (B): *Great Ball*\n- (C): *PokeSnax*\n- (D): *Red Shard*')])
    expect(out.map(b => b.type)).toEqual(['hiddenItems'])
    expect(letters(hidden(out)[0])).toEqual(['B:Great Ball', 'C:PokeSnax', 'D:Red Shard'])
  })

  it('keeps an inline mention in the prose and also lists it, with the list that follows (grand-hall)', () => {
    const text = 'Immediately down from your starting position, in a rock you\'ll find a hidden *Normal Gem* (A). There are tons of hidden items.\n\n- (B): *Poke Ball*\n- (C): *Red Shard*'
    const out = groupHiddenItems([img('001'), prose(text)])
    expect(letters(hidden(out)[0])).toEqual(['A:Normal Gem', 'B:Poke Ball', 'C:Red Shard'])
    expect((out[1] as { markdown: string }).markdown).toContain('*Normal Gem* (A)')
    expect((out[1] as { markdown: string }).markdown).not.toContain('Poke Ball')
  })

  it('keeps a letter whose name and marker are separated by a few words (lower-peridot-ward)', () => {
    const out = groupHiddenItems([
      img('003'),
      prose('- (D): *Purple Shard*\n- (E): *Exp. Candy XS*\n- (F): *Common Candy*\nOn the left side of the Pokemon Center, you can find a hidden *Poison Gem* in some trash paper (G). In a house below, a guy will give you the *Old Rod*!')
    ])
    expect(letters(hidden(out)[0])).toEqual(['D:Purple Shard', 'E:Exp. Candy XS', 'F:Common Candy', 'G:Poison Gem'])
  })

  it('collects entries split across blocks with battles in between (obsidia-ward)', () => {
    const out = groupHiddenItems([
      img('011'),
      prose('- (A): *PokeSnax*\n- (B): *PokeSnax*'),
      battle,
      prose('Grab the hidden *Potion* (C), then proceed into South Obsidia Ward.'),
      battle,
      img('012'),
      prose('- (A): *Dire Hit*\n- (B): *Blue Shard*')
    ])
    const [a, b] = hidden(out)
    expect(letters(a)).toEqual(['A:PokeSnax', 'B:PokeSnax', 'C:Potion'])
    expect(letters(b)).toEqual(['A:Dire Hit', 'B:Blue Shard'])
    expect(out.map(x => x.type)).toEqual(['hiddenItems', 'battle', 'prose', 'battle', 'hiddenItems'])
  })

  it('attaches entries that appear before the next image to the nearest preceding image (peridot-ward)', () => {
    const out = groupHiddenItems([
      img('006'),
      prose('- (A): *Poke Ball*\n- (B): *Oran Berry*\n- (C): *Ability Capsule*'),
      battle,
      prose('Also, another few hidden items:\n\n- (D): *Burn Heal*\n- (E): *Red Shard*\n\nThe in-game trade is nearby.'),
      img('007'),
      prose('- (A): *Blue Shard*\n- (B): *Paralyze Heal*')
    ])
    const [a, b] = hidden(out)
    expect(letters(a)).toEqual(['A:Poke Ball', 'B:Oran Berry', 'C:Ability Capsule', 'D:Burn Heal', 'E:Red Shard'])
    expect(letters(b)).toEqual(['A:Blue Shard', 'B:Paralyze Heal'])
    expect((out[2] as { markdown: string }).markdown).toBe('Also, another few hidden items:\n\nThe in-game trade is nearby.')
  })

  it('handles several inline markers in one paragraph and consecutive images (obsidia-park)', () => {
    const out = groupHiddenItems([
      img('024'),
      prose('You can start by grabbing a hidden *Oran Berry* (A) in the third bush to the left.'),
      battle,
      prose('- (B): *Poke Ball*, not hidden\n- (C): *Chesto Berry*'),
      img('025'),
      prose('Pick up the *Leppa Berry* (D) then cut wiggly tree #3.'),
      img('026'),
      prose('Grab a *Pecha Berry* (E) in a bush.'),
      img('027'),
      battle,
      prose('Straight down is a hidden *Super Potion* (F). Grab the hidden *Green Shard* (G).')
    ])
    const [a, b, c, d] = hidden(out)
    expect(letters(a)).toEqual(['A:Oran Berry', 'B:Poke Ball', 'C:Chesto Berry'])
    expect(a.entries[1].notHidden).toBe(true)
    expect(letters(b)).toEqual(['D:Leppa Berry'])
    expect(letters(c)).toEqual(['E:Pecha Berry'])
    expect(letters(d)).toEqual(['F:Super Potion', 'G:Green Shard'])
  })

  it('keeps trailing notes on list lines', () => {
    const out = groupHiddenItems([
      img('016'),
      prose('- (A): *Moon Stone*. You need to be up against the bottom fence to hop across to reach this one.\n- (B): *Exp. Candy XS*')
    ])
    expect(hidden(out)[0].entries[0]).toMatchObject({ name: 'Moon Stone', note: 'You need to be up against the bottom fence to hop across to reach this one.', notHidden: false })
  })

  it('attaches entries before the first image to that image', () => {
    const out = groupHiddenItems([prose('Hidden:\n\n- (A): *Potion*'), img('099')])
    expect(letters(hidden(out)[0])).toEqual(['A:Potion'])
  })

  it('leaves non-hidden images and lettered prose without a hidden map untouched', () => {
    const blocks: Block[] = [
      { type: 'image', file: 'zcell_03.jpg', src: '/x/zcell_03.jpg' },
      prose('Pull the lever (A) then use the *Honey* tree (B).')
    ]
    expect(groupHiddenItems(blocks)).toBe(blocks)
  })

  it('leaves a hidden map with no entries as a plain image', () => {
    const out = groupHiddenItems([img('050'), prose('Nothing to see.')])
    expect(out.map(b => b.type)).toEqual(['image', 'prose'])
  })
})
