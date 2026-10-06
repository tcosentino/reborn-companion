// Walkthrough tasks: optional catches, side quests and notable NPC items that the guide only mentions in prose.
// Curated definitions live in tasks/<game>/<section-id>.json; scripts/apply-tasks.ts lifts each matched paragraph
// out of its prose block into a `task` block so it renders as a checkable card and counts toward progress.
// Only type-erasable TS here: the build script runs under Node's native type stripping.

export type TaskKind = 'catch' | 'quest' | 'item'

// One entry in tasks/<game>/<section-id>.json
export interface TaskDef {
  // Kebab slug, unique within the section. Part of the saved progress key, so never rename it.
  id: string
  kind: TaskKind
  title: string
  // Verbatim start of the paragraph the task covers (whitespace-trimmed)
  match: string
  species?: string[]
}

export interface TaskBlock {
  type: 'task'
  // Progress checklist key, `task:<section>/<slug>`
  id: string
  slug: string
  kind: TaskKind
  title: string
  // The original paragraph, kept verbatim so the build can undo the split.
  // Empty on the second and later tasks that share one paragraph (same `match`); the first one carries the text.
  markdown: string
  species?: string[]
}

interface BlockLike { type: string; markdown?: string }

export const taskKey = (section: string, slug: string) => `task:${section}/${slug}`
export const taskAnchor = (slug: string) => `task-${slug}`

const paragraphs = (md: string) => md.split('\n\n').map(p => p.trim()).filter(Boolean)

// Undo earlier splits: task blocks go back into prose, and adjacent prose blocks are joined
export const unapplyTasks = <B extends BlockLike>(blocks: (B | TaskBlock)[]): B[] => {
  const out: B[] = []
  for (const b of blocks) {
    if (b.type === 'task' && !b.markdown) continue
    const md = b.type === 'task' || b.type === 'prose' ? b.markdown as string : null
    const prev = out[out.length - 1]
    if (md != null && prev?.type === 'prose') prev.markdown = `${prev.markdown}\n\n${md}`
    else if (md != null) out.push({ type: 'prose', markdown: md } as B)
    else out.push(b as B)
  }
  return out
}

// Splits each matched paragraph out of its prose block. Returns the new blocks and the defs that matched nothing.
export const applyTasks = <B extends BlockLike>(blocks: B[], section: string, defs: TaskDef[]) => {
  const base = unapplyTasks(blocks)
  const used = new Set<TaskDef>()
  const ambiguous: TaskDef[] = []
  const out: (B | TaskBlock)[] = []
  for (const b of base) {
    if (b.type !== 'prose') { out.push(b); continue }
    let pending: string[] = []
    const flush = () => {
      if (pending.length) out.push({ ...b, markdown: pending.join('\n\n') })
      pending = []
    }
    for (const p of paragraphs(b.markdown as string)) {
      const hits = defs.filter(d => !used.has(d) && p.startsWith(d.match.trim()))
      if (!hits.length) { pending.push(p); continue }
      // Several tasks may share a paragraph by using the identical match; different overlapping matches are an error
      const group = hits.filter(d => d.match.trim() === hits[0].match.trim())
      if (group.length < hits.length) ambiguous.push(...hits)
      flush()
      group.forEach((def, i) => {
        used.add(def)
        out.push({
          type: 'task', id: taskKey(section, def.id), slug: def.id, kind: def.kind, title: def.title, markdown: i === 0 ? p : '',
          ...(def.species?.length ? { species: def.species } : {})
        })
      })
    }
    flush()
  }
  return { blocks: out, missing: defs.filter(d => !used.has(d)), ambiguous }
}

// [progress key, title] per task block, in guide order
export type TaskRef = [string, string]
export const taskRefs = (blocks: BlockLike[]): TaskRef[] =>
  blocks.flatMap(b => b.type === 'task' ? [[(b as TaskBlock).id, (b as TaskBlock).title] as TaskRef] : [])
