// Stable DOM anchor ids for guide blocks. Shared by the app (SectionView) and
// scripts/build-search.ts so deep links in the search index match the rendered ids.
// Battles keep their existing `battle-<battleId>` ids, walkthrough tasks use `task-<slug>`; encounter, shop and tutor
// blocks get `enc-`, `shop-` and `tutor-` ids derived from their titles, with a
// numeric suffix when the same title repeats within one section.
// Only type-erasable TS here: the build script runs under Node's native type stripping.

interface AnchorBlock {
  type: string
  name?: string
  title?: string
  slug?: string
  trainers?: { teamId: [string, string, number] }[]
}

export const slug = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'

export const battleAnchor = (teamIds: [string, string, number][]) =>
  `battle-${teamIds.map(t => t.join(':')).join('+')}`

const PREFIX: Record<string, string> = { encounters: 'enc', shop: 'shop', tutor: 'tutor' }

// One id (or null) per block, in block order
export const blockAnchors = (blocks: AnchorBlock[]): (string | null)[] => {
  const seen = new Map<string, number>()
  return blocks.map(b => {
    if (b.type === 'battle' && b.trainers) return battleAnchor(b.trainers.map(t => t.teamId))
    if (b.type === 'task' && b.slug) return `task-${b.slug}`
    const prefix = PREFIX[b.type]
    if (!prefix) return null
    const base = `${prefix}-${slug(b.name ?? b.title ?? '')}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  })
}
