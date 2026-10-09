import { useCallback, useMemo } from 'react'
import { loadBattles, useAsync } from '../../data/load'
import { expandLinked, linkIndex, linkedIds } from '../../lib/itemMaps'
import { useChecklist } from '../../lib/progress'

// Hidden-item and item-map checkboxes, stored under pokeguide:<game>:hidden.
// The same game item can sit on several checklists (battles.json `l`, lib/itemMaps.ts): `done` shows an id as
// checked when any linked id is, and `toggle` sets or clears the whole group. Stored keys and values are unchanged.
export const useHiddenChecked = (game: string) => {
  const { done: stored, setMany } = useChecklist(game, 'hidden')
  const groups = useAsync(() => loadBattles(game), [game]).data?.l
  const index = useMemo(() => linkIndex(groups ?? []), [groups])
  const done = useMemo(() => expandLinked(stored, groups ?? []), [stored, groups])
  const toggle = useCallback((id: string) => setMany(linkedIds(index, id), !done[id]), [index, done, setMany])
  return { done, toggle }
}
