// "Where to get" line for item and move hover cards, linking to the item/move page.
// Reuses the palette's cached search index (usually prefetched by the time a card opens).
import { useEffect, useState } from 'react'
import { useDex, useGame } from '../../components/common'
import { loadSearchIndex } from '../../components/palette/entries'
import type { SearchIndex } from '../../components/palette/indexTypes'
import { findItem, findMove, itemPageKey, itemPlaces, movePlaces, summarize, tmsFor } from '../../components/palette/places'
import { itemHref, moveHref } from '../../lib/route'

const useSearchIndex = () => {
  const game = useGame()
  const [idx, setIdx] = useState<SearchIndex | null>(null)
  useEffect(() => {
    let live = true
    loadSearchIndex(game.id).then(d => { if (live) setIdx(d) }, () => { /* card works without it */ })
    return () => { live = false }
  }, [game.id])
  return idx
}

const Line = ({ label, to, text }: { label: string; to: string; text: string }) => (
  <p className="hc-line">
    <span className="eyebrow">{label}</span>
    <a className="hc-where" href={to}>{text}</a>
  </p>
)

export const ItemWhere = ({ sym }: { sym: string }) => {
  const game = useGame()
  const dex = useDex()
  const idx = useSearchIndex()
  const row = idx && findItem(idx, sym)
  if (!row) return null
  const summary = summarize(itemPlaces(idx, row))
  const teaches = row[4]
  return (
    <>
      {teaches && <Line label="Teaches" to={moveHref(game.id, teaches)} text={dex.moves[teaches]?.name ?? teaches} />}
      {summary && <Line label="Where to get" to={itemHref(game.id, itemPageKey(row))} text={summary} />}
    </>
  )
}

export const MoveWhere = ({ sym }: { sym: string }) => {
  const game = useGame()
  const idx = useSearchIndex()
  if (!idx) return null
  const row = findMove(idx, sym)
  const tutors = row ? summarize(movePlaces(idx, row)) : ''
  const tms = tmsFor(idx, sym).map(t => {
    const where = summarize(itemPlaces(idx, t), 1)
    return `${t[0].split(' ')[0]}${where ? `: ${where}` : ''}`
  })
  const text = [tutors, ...tms].filter(Boolean).join('; ')
  return <Line label="Where to learn" to={moveHref(game.id, sym)} text={text || 'Who can learn it'} />
}
