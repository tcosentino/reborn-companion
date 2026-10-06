// Per-section battle lists for whole-guide progress (battles.json), written by scripts/build-search.ts.
// Chapter JSON is lazy-loaded, so the sidebar and resume card read this compact file instead.
// Only type-erasable TS here: the build script runs under Node's native type stripping.
import type { Chapter, GuideIndex } from '../data/types'
import { taskRefs, type TaskRef } from './tasks.ts'

// [battle id (same key as the progress checklist), "Class Name" label]
export type BattleRef = [string, string]

export interface SectionBattles {
  v: 1
  // Section id (chapter id for intros) -> its non-partner battles in guide order
  s: Record<string, BattleRef[]>
  // Section id -> its walkthrough tasks (lib/tasks.ts), same [progress key, label] shape. Absent in older files.
  t?: Record<string, TaskRef[]>
}

interface BattleLike {
  type: string
  partner?: boolean
  trainers?: { name: string; title: string; teamId: [string, string, number] }[]
}

export const battleKey = (teamIds: [string, string, number][]) =>
  teamIds.map(t => t.join(':')).join('+')

export const battleLabel = (trainers: { name: string; title: string }[]) =>
  trainers.map(t => `${t.title} ${t.name}`).join(' & ')

// Partner battles are not checklist items, matching SectionView's counts
export const battleRefs = (blocks: BattleLike[]): BattleRef[] =>
  blocks.flatMap(b => b.type === 'battle' && !b.partner && b.trainers
    ? [[battleKey(b.trainers.map(t => t.teamId)), battleLabel(b.trainers)] as BattleRef]
    : [])

// Sections without battles are left out to keep the file small
export const buildSectionBattles = (index: GuideIndex, chapters: Map<string, Chapter>): SectionBattles => {
  const s: Record<string, BattleRef[]> = {}
  const t: Record<string, TaskRef[]> = {}
  for (const c of index.chapters) {
    for (const sec of chapters.get(c.file)?.sections ?? []) {
      const refs = battleRefs(sec.blocks as BattleLike[])
      if (refs.length) s[sec.id ?? c.id] = refs
      const tasks = taskRefs(sec.blocks)
      if (tasks.length) t[sec.id ?? c.id] = tasks
    }
  }
  return { v: 1, s, t }
}
