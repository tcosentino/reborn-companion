import type { Block } from '../../data/types'

// Folds a "hiddenNNN.png" map image and its lettered item entries into one synthetic block.
//
// The walkthrough writes entries three ways, all keyed by a letter printed on the map:
//   list line     "- (A): *Dire Hit*" (optionally followed by a note, e.g. ", not hidden")
//   inline        "a hidden *Normal Gem* (A)"  (the item is the last emphasised text before the letter)
//   split         the list/inline entries can sit several blocks after the image, past battles
// Entries attach to the nearest preceding hidden-map image in the section, or to the first
// following one when nothing precedes them. Only list lines are removed from the prose.

export interface HiddenEntry {
  letter: string
  name: string
  note: string
  notHidden: boolean
}

export interface HiddenItemsBlock {
  type: 'hiddenItems'
  file: string
  src: string
  // Stable checkbox id prefix: `<scope>:<file>`; the entry id is `<prefix>:<letter>`
  idPrefix: string
  entries: HiddenEntry[]
}

export type RenderBlock = Block | HiddenItemsBlock

export const hiddenEntryId = (b: HiddenItemsBlock, e: HiddenEntry) => `${b.idPrefix}:${e.letter}`

const isHiddenMap = (b: Block): b is Extract<Block, { type: 'image' }> =>
  b.type === 'image' && /^hidden\d+\./.test(b.file)

const LIST_LINE = /^\s*[-*]\s*\(([A-Z])\)\s*:?\s*(.*)$/
const INLINE = /\*([^*\n]+)\*([^*().\n]{0,40}?)\(([A-Z])\)/g

const parseListRest = (rest: string): Pick<HiddenEntry, 'name' | 'note'> => {
  const m = rest.match(/^\*([^*]+)\*(.*)$/)
  const name = (m ? m[1] : rest).trim()
  const note = (m ? m[2] : '').replace(/^[\s,.:;-]+/, '').trim()
  return { name, note }
}

const withFlag = (e: Omit<HiddenEntry, 'notHidden'>): HiddenEntry => ({ ...e, notHidden: /not hidden/i.test(e.note) })

interface Found { blockIndex: number; entry: HiddenEntry; absorbed: boolean }

const scanProse = (markdown: string, blockIndex: number): { found: Found[]; kept: string[] } => {
  const found: Found[] = []
  const kept: string[] = []
  for (const line of markdown.split('\n')) {
    const list = line.match(LIST_LINE)
    if (list) {
      const { name, note } = parseListRest(list[2])
      if (name) {
        found.push({ blockIndex, entry: withFlag({ letter: list[1], name, note }), absorbed: true })
        continue
      }
    }
    for (const m of line.matchAll(INLINE)) {
      found.push({ blockIndex, entry: withFlag({ letter: m[3], name: m[1].trim(), note: '' }), absorbed: false })
    }
    kept.push(line)
  }
  return { found, kept }
}

const tidy = (lines: string[]) => lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()

export const groupHiddenItems = (blocks: Block[], scope = ''): RenderBlock[] => {
  const imageIdx = blocks.flatMap((b, i) => (isHiddenMap(b) ? [i] : []))
  if (imageIdx.length === 0) return blocks

  const entriesByImage = new Map<number, HiddenEntry[]>(imageIdx.map(i => [i, []]))
  const rewritten = new Map<number, string>()

  blocks.forEach((b, i) => {
    if (b.type !== 'prose') return
    const { found, kept } = scanProse(b.markdown, i)
    if (found.length === 0) return
    const target = [...imageIdx].reverse().find(k => k < i) ?? imageIdx.find(k => k > i)
    if (target === undefined) return
    const list = entriesByImage.get(target) as HiddenEntry[]
    found.forEach(f => {
      const dup = list.find(e => e.letter === f.entry.letter)
      if (!dup) list.push(f.entry)
      else if (f.absorbed) Object.assign(dup, f.entry)
    })
    if (found.some(f => f.absorbed)) rewritten.set(i, tidy(kept))
  })

  return blocks.flatMap<RenderBlock>((b, i) => {
    if (isHiddenMap(b)) {
      const entries = [...(entriesByImage.get(i) ?? [])].sort((x, y) => x.letter.localeCompare(y.letter))
      if (entries.length === 0) return [b]
      return [{ type: 'hiddenItems', file: b.file, src: b.src, idPrefix: `${scope}:${b.file}`, entries }]
    }
    if (b.type === 'prose' && rewritten.has(i)) {
      const markdown = rewritten.get(i) as string
      return markdown ? [{ ...b, markdown }] : []
    }
    return [b]
  })
}
