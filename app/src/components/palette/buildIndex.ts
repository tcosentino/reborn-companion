// Pure builder for the palette search index. Used by scripts/build-search.ts.
// Only type-erasable TS and explicit .ts specifiers: it runs under Node's native type stripping.
import type { BattleBlock, Chapter, Dex, EncountersBlock, GuideIndex, ShopBlock, TutorBlock } from '../../data/types'
import { blockAnchors } from './anchors.ts'
import type { CatchRef, ItemRow, MoveRow, PlaceRef, SearchIndex, SpeciesRow, TrainerRow } from './indexTypes'

// Loose key for matching prose mentions and shop names to dex names: "Poké Ball" == "poke balls"
export const itemKey = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Emphasized single-star text, not **bold**
const EMPH = /(?<![*\w])\*([^*\n]{2,40}?)\*(?![*\w])/g

export const proseItemMentions = (md: string, lookup: (key: string) => string | undefined): string[] => {
  const found: string[] = []
  for (const m of md.matchAll(EMPH)) {
    const raw = m[1].trim().replace(/^\d+\s*x\s+/i, '').replace(/^x\d+\s+/i, '')
    const key = itemKey(raw)
    const tm = /^(tm|tr|hm)\d+/.exec(key)?.[0]
    const sym = lookup(key) ?? (key.endsWith('s') ? lookup(key.slice(0, -1)) : undefined) ?? (tm ? lookup(tm) : undefined)
    if (sym && !found.includes(sym)) found.push(sym)
  }
  return found
}

// 'TM57 Charge Beam', 'TM57' or the key 'tm57chargebeam' -> { code: 'TM57', rest: 'Charge Beam' }
export const tmParts = (s: string) => {
  const m = /^(tm|hm|tr)\s*(\d+)\s*(.*)$/i.exec(s.trim())
  return m ? { code: `${m[1].toUpperCase()}${m[2]}`, rest: m[3].trim() } : null
}

const table = () => {
  const list: string[] = []
  const pos = new Map<string, number>()
  const id = (s: string) => {
    let i = pos.get(s)
    if (i === undefined) { i = list.length; list.push(s); pos.set(s, i) }
    return i
  }
  return { list, id }
}

const pushUnique = (xs: number[], x: number) => { if (!xs.includes(x)) xs.push(x) }

export const buildSearchIndex = (index: GuideIndex, dex: Dex, chapters: Map<string, Chapter>): SearchIndex => {
  const anchors = table()
  const anchorLabels: string[] = []
  const methods = table()
  const fields = table()
  const sections: [string, string, number][] = []

  const speciesSyms = Object.keys(dex.species)
  const speciesPos = new Map(speciesSyms.map((s, i) => [s, i]))
  const species: SpeciesRow[] = speciesSyms.map(s => [s, [], 0, null])
  const spIdx = (sym: string) => {
    let i = speciesPos.get(sym)
    if (i === undefined) { i = species.length; species.push([sym, [], 0, null]); speciesPos.set(sym, i) }
    return i
  }

  const trainers = new Map<string, TrainerRow>()
  const trainerSpecies = new Map<number, Set<string>>()

  const itemByKey = new Map(Object.entries(dex.items).map(([sym, it]) => [itemKey(it.name), sym]))
  const moveByKey = new Map(Object.entries(dex.moves).map(([sym, mv]) => [itemKey(mv.name), sym]))
  // TM code -> move it teaches, learned from shop names ('TM64 Explosion') and prose
  const tmMove = new Map<string, string>()
  const noteTm = (text: string) => {
    const t = tmParts(text)
    const mv = t?.rest ? moveByKey.get(itemKey(t.rest)) : undefined
    if (t && mv && !tmMove.has(t.code)) tmMove.set(t.code, mv)
    return t?.code
  }
  const items = new Map<string, ItemRow>()
  const item = (name: string, sym: string | null) => {
    const resolved = sym ?? itemByKey.get(itemKey(name)) ?? noteTm(name) ?? ''
    const key = resolved || `name:${itemKey(name)}`
    let row = items.get(key)
    if (!row) { row = [resolved ? dex.items[resolved]?.name ?? name : name, resolved, [], []]; items.set(key, row) }
    return row
  }

  const moves = new Map<string, MoveRow>()
  const move = (name: string, sym: string | null) => {
    const key = sym ?? `name:${itemKey(name)}`
    let row = moves.get(key)
    if (!row) { row = [sym ? dex.moves[sym]?.name ?? name : name, sym ?? '', []]; moves.set(key, row) }
    return row
  }

  index.chapters.forEach((ref, chIdx) => {
    const chapter = chapters.get(ref.file)
    if (!chapter) return
    for (const sec of chapter.sections) {
      const sIdx = sections.length
      sections.push([sec.id ?? chapter.id, sec.title ?? 'Introduction', chIdx])
      const ids = blockAnchors(sec.blocks)
      sec.blocks.forEach((b, bi) => {
        const aIdx = ids[bi] ? anchors.id(ids[bi] as string) : -1
        if (aIdx >= 0 && anchorLabels[aIdx] === undefined) {
          const named = b as { title?: string; name?: string }
          anchorLabels[aIdx] = b.type === 'battle' ? '' : named.title ?? named.name ?? ''
        }
        if (b.type === 'battle') {
          const bb = b as BattleBlock
          bb.party.forEach(p => {
            const row = species[spIdx(p.species)]
            if (!row[3]) row[3] = [sIdx, aIdx]
          })
          if (bb.partner) return
          const key = ids[bi] as string
          let row = trainers.get(key)
          if (!row) {
            const lvs = bb.party.map(p => p.level)
            const field = bb.showField && bb.fieldName ? fields.id(bb.fieldName) : -1
            const party = [...new Set(bb.party.map(p => spIdx(p.species)))]
            row = [
              bb.trainers.map(t => t.name).join(' & '),
              [...new Set(bb.trainers.map(t => t.title))].join(' & '),
              [], aIdx, lvs.length ? Math.min(...lvs) : 0, lvs.length ? Math.max(...lvs) : 0,
              field, party, bb.double ? 1 : 0
            ]
            trainers.set(key, row)
          }
          pushUnique(row[2], sIdx)
          bb.party.forEach(p => {
            const set = trainerSpecies.get(spIdx(p.species)) ?? new Set<string>()
            set.add(key)
            trainerSpecies.set(spIdx(p.species), set)
          })
        } else if (b.type === 'encounters') {
          const eb = b as EncountersBlock
          for (const m of eb.methods) {
            const mIdx = methods.id(m.method)
            for (const r of m.rows) {
              const row = species[spIdx(r.species)]
              if (!row[3]) row[3] = [sIdx, aIdx]
              const prev = row[1].find(c => c[0] === sIdx && c[1] === aIdx && c[2] === mIdx)
              if (prev) {
                prev[3] = Math.min(prev[3], r.minLevel)
                prev[4] = Math.max(prev[4], r.maxLevel)
              } else row[1].push([sIdx, aIdx, mIdx, r.minLevel, r.maxLevel] as CatchRef)
            }
          }
        } else if (b.type === 'shop') {
          for (const it of (b as ShopBlock).items) {
            noteTm(it.name)
            const row = item(it.name, it.item)
            if (!row[2].some(p => p[0] === sIdx && p[1] === aIdx)) row[2].push([sIdx, aIdx, it.price] as PlaceRef)
          }
        } else if (b.type === 'tutor') {
          for (const mv of (b as TutorBlock).moves) {
            const row = move(mv.name, mv.move)
            if (!row[2].some(p => p[0] === sIdx && p[1] === aIdx)) row[2].push([sIdx, aIdx, mv.price] as PlaceRef)
          }
        } else if (b.type === 'prose') {
          for (const sym of proseItemMentions(b.markdown, k => itemByKey.get(k) ?? noteTm(k))) pushUnique(item('', sym)[3], sIdx)
        }
      })
    }
  })

  trainerSpecies.forEach((set, i) => { species[i][2] = set.size })
  for (const row of items.values()) {
    const t = tmParts(row[1])
    if (!t || t.rest) continue
    const mv = tmMove.get(t.code)
    row[0] = mv ? `${t.code} ${dex.moves[mv]?.name ?? mv}` : row[0] || t.code
    if (mv) row[4] = mv
  }

  return {
    v: 1,
    ch: index.chapters.map(c => c.title),
    s: sections,
    a: anchors.list,
    al: anchors.list.map((_, i) => anchorLabels[i] ?? ''),
    m: methods.list,
    f: fields.list,
    t: [...trainers.values()],
    p: species,
    i: [...items.values()],
    mv: [...moves.values()]
  }
}
