import './compare.css'
import type { Sym } from '../../data/types'
import { TIER_LABEL, type Rank } from '../../lib/ranking'
import { useCaught, useChecklist } from '../../lib/progress'
import { MAX_COMPARE, compareHref } from '../../lib/route'
import { usePokedex } from './context'
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

// Adds/removes a species from the compare tray (max MAX_COMPARE)
export const CompareToggle = ({ sym, name }: { sym: Sym; name: string }) => {
  const game = useGame()
  const { done, toggle } = useChecklist(game.id, 'compare')
  const on = !!done[sym]
  const full = !on && Object.keys(done).length >= MAX_COMPARE
  return (
    <button className={`cmp-toggle${on ? ' on' : ''}`} onClick={() => toggle(sym)} disabled={full} aria-pressed={on}
      title={full ? `Compare holds up to ${MAX_COMPARE}` : on ? `Remove ${name} from compare` : `Add ${name} to compare`}>
      {on ? 'Comparing' : 'Compare'}
    </button>
  )
}

// Floating bar listing the compare tray, shown on Pokedex pages while it holds anything
export const CompareTray = () => {
  const game = useGame()
  const data = usePokedex()
  const { done, toggle, replace } = useChecklist(game.id, 'compare')
  const list = Object.keys(done)
  if (list.length === 0) return null
  return (
    <div className="cmp-tray" role="region" aria-label="Compare tray">
      <ul>
        {list.map(sym => (
          <li key={sym}>
            {data?.dex.species[sym]?.name ?? sym}
            <button onClick={() => toggle(sym)} aria-label={`Remove ${data?.dex.species[sym]?.name ?? sym}`}>&times;</button>
          </li>
        ))}
      </ul>
      <a className="btn" href={compareHref(game.id, list)}>Compare {list.length}</a>
      <button className="btn ghost" onClick={() => replace([])}>Clear</button>
    </div>
  )
}
