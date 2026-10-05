import type { Sym } from '../../data/types'
import { TIER_LABEL, type Rank } from '../../lib/ranking'
import { useCaught } from '../../lib/progress'
import { useGame } from '../common'

const sourceLabel = (rank: Rank) =>
  rank.source === 'estimate' ? 'Stat estimate'
    : `${rank.basis === 'community' ? 'Community pick' : 'Editorial pick'}${rank.source === 'inherited' ? ', via evolution' : ''}`

export const TierBadge = ({ rank, full }: { rank: Rank; full?: boolean }) => (
  <span className={`tier tier-${rank.tier.toLowerCase()}${rank.source === 'estimate' ? ' est' : ''}`}
    title={`${rank.tier}: ${TIER_LABEL[rank.tier]} (${sourceLabel(rank)}). ${rank.note}`}>
    {rank.tier}{rank.source === 'estimate' && <span aria-hidden>?</span>}
    {full && <span className="tier-label">{TIER_LABEL[rank.tier]}</span>}
  </span>
)

export const tierSourceLabel = sourceLabel

export const CaughtToggle = ({ sym, name, label }: { sym: Sym; name: string; label?: boolean }) => {
  const game = useGame()
  const { done, toggle } = useCaught(game.id)
  const caught = !!done[sym]
  return (
    <label className={`caught${caught ? ' is-caught' : ''}${label ? ' with-label' : ''}`} title={caught ? 'Caught' : 'Mark as caught'}>
      <input type="checkbox" checked={caught} onChange={() => toggle(sym)} aria-label={`${name} caught`} />
      {label && <span>{caught ? 'Caught' : 'Not caught'}</span>}
    </label>
  )
}
