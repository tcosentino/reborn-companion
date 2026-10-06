import { useMemo } from 'react'
import { useGame } from '../../components/common'
import { itemCardAnchor, itemCheckId, type ItemCardBlock } from '../../lib/itemMaps'
import { MapCard, type MapMark } from '../route-map/MapCard'
import { ItemLabel, Ring } from './HiddenItems'
import { useHiddenChecked } from './useHiddenChecked'
import './hidden-items.css'

// Item map card (lib/itemMaps.ts): items the guide lists in prose, numbered on the game map as a checklist.
// Ticks share the hidden-items checklist (`item:<section>/<card>/<event>`); like hidden items they are not counted
// in the section and sidebar totals. collapsed: "Hide defeated" is on, so a finished card shrinks to its header.
export const ItemMapCard = ({ b, collapsed }: { b: ItemCardBlock; collapsed?: boolean }) => {
  const game = useGame()
  const { done, toggle } = useHiddenChecked(game.id)
  const ids = useMemo(() => b.marks.map(m => itemCheckId(b.section, b.id, m.event)), [b])
  const got = ids.filter(id => done[id]).length
  const complete = got === ids.length
  const marks: MapMark[] = b.marks.map((m, i) => ({
    key: m.key,
    x: m.x,
    y: m.y,
    label: <ItemLabel sym={m.item} name={m.label} />,
    detail: m.hidden ? undefined : <span className="hi-tag">not hidden</span>,
    done: !!done[ids[i]],
    onToggle: () => toggle(ids[i])
  }))
  const shot = b.shot && <a href={game.imageBase + b.shot.src} target="_blank" rel="noopener">Guide screenshot ({b.shot.file})</a>
  return (
    <MapCard
      id={itemCardAnchor(b.id)}
      className={`hi-mapcard${complete ? ' complete' : ''}`}
      eyebrow={`Items · ${b.mapName}`}
      title={b.title}
      aside={<>
        {complete && <span className="all-caught">All collected</span>}
        <span className="hi-count mono" aria-live="polite">{got} / {ids.length}</span>
        <Ring got={got} total={ids.length} />
      </>}
      map={b}
      marks={marks}
      collapsed={complete && collapsed}
      keepLegend
      footer={shot}
    />
  )
}
