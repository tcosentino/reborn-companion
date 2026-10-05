import { useMemo, useState } from 'react'
import type { GuideIndex, Tier } from '../../data/types'
import { useCaught } from '../../lib/progress'
import { TIERS, TIER_LABEL, bst } from '../../lib/ranking'
import { dexHref, href } from '../../lib/route'
import { TypeChip, useGame } from '../common'
import { CaughtToggle, CompareToggle, CompareTray, TierBadge } from './bits'
import { firstChapter, usePokedex } from './context'

type CaughtFilter = 'all' | 'caught' | 'missing'
type Sort = 'num' | 'tier' | 'first'

interface Props { idx: GuideIndex; defaultChapter: string | null }

export const PokedexView = ({ idx, defaultChapter }: Props) => {
  const game = useGame()
  const data = usePokedex()
  const { done } = useCaught(game.id)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [tier, setTier] = useState<Tier | ''>('')
  const [caught, setCaught] = useState<CaughtFilter>('all')
  // '' = every species, including ones the guide's encounter tables never list
  const [upTo, setUpTo] = useState(defaultChapter ?? '')
  const [sort, setSort] = useState<Sort>('num')

  const rows = useMemo(() => {
    if (!data) return []
    return Object.entries(data.dex.species).map(([sym, s]) => ({
      sym, s, rank: data.ranks[sym], first: firstChapter(data, sym), total: bst(s)
    }))
  }, [data])

  const allTypes = useMemo(
    () => [...new Set(rows.flatMap(r => Object.values(r.s.forms).flatMap(f => f.types)))].sort(),
    [rows]
  )

  if (!data) return <div className="state">Loading Pokedex&hellip;</div>

  const limit = upTo ? data.chapterOrder[upTo] ?? Infinity : Infinity
  const needle = q.trim().toLowerCase()
  const shown = rows
    .filter(r => !upTo || r.first <= limit)
    .filter(r => !needle || r.s.name.toLowerCase().includes(needle) || String(r.s.num) === needle)
    .filter(r => !type || Object.values(r.s.forms).some(f => f.types.includes(type)))
    .filter(r => !tier || r.rank?.tier === tier)
    .filter(r => caught === 'all' || (caught === 'caught') === !!done[r.sym])
    .sort((a, b) =>
      sort === 'tier' ? TIERS.indexOf(a.rank.tier) - TIERS.indexOf(b.rank.tier) || b.rank.score - a.rank.score || b.total - a.total
        : sort === 'first' ? a.first - b.first || a.s.num - b.s.num
          : a.s.num - b.s.num)

  const pool = rows.filter(r => !upTo || r.first <= limit)
  const caughtInPool = pool.filter(r => done[r.sym]).length
  const caughtTotal = rows.filter(r => done[r.sym]).length
  const chapterTitle = idx.chapters.find(c => c.id === upTo)?.title

  return (
    <article className="section dex">
      <header className="section-hero">
        <span className="eyebrow">{game.name}</span>
        <h1>Pokedex</h1>
        <div className="stats">
          <div className="stat"><b>{caughtTotal}/{rows.length}</b><span>caught</span></div>
          {upTo && <div className="stat"><b>{caughtInPool}/{pool.length}</b><span>available so far</span></div>}
        </div>
        <div className="meter" role="progressbar" aria-valuenow={Math.round((caughtInPool / Math.max(pool.length, 1)) * 100)}>
          <i style={{ width: `${(caughtInPool / Math.max(pool.length, 1)) * 100}%` }} />
        </div>
      </header>

      <div className="dex-controls">
        <input type="search" className="search" placeholder="Name or number" value={q} onChange={e => setQ(e.target.value)} aria-label="Search Pokemon" />
        <select value={upTo} onChange={e => setUpTo(e.target.value)} aria-label="Available by">
          <option value="">All species</option>
          {idx.chapters.map(c => <option key={c.id} value={c.id}>Found by {c.title}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Type">
          <option value="">Any type</option>
          {allTypes.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={tier} onChange={e => setTier(e.target.value as Tier | '')} aria-label="Tier">
          <option value="">Any tier</option>
          {TIERS.map(t => <option key={t} value={t}>{t}: {TIER_LABEL[t]}</option>)}
        </select>
        <select value={caught} onChange={e => setCaught(e.target.value as CaughtFilter)} aria-label="Caught">
          <option value="all">Caught or not</option>
          <option value="missing">Not caught</option>
          <option value="caught">Caught</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="num">Sort: Dex number</option>
          <option value="tier">Sort: Best first</option>
          <option value="first">Sort: Earliest available</option>
        </select>
      </div>
      <p className="dex-note">
        {upTo
          ? <>Species found in wild encounter tables or shops up to <b>{chapterTitle}</b>. Starters, gifts and eggs only show under &ldquo;All species&rdquo;.</>
          : <>Every species in the game, including ones only obtainable as gifts, eggs or not at all.</>}
        {' '}Tiers are computed from base stats, movepool, matchups against the guide's boss battles and how early the Pokemon is catchable.
      </p>

      <ol className="dex-list">
        {shown.map(({ sym, s, rank }) => {
          const loc = s.locations[0]
          return (
            <li key={sym} className={done[sym] ? 'is-caught' : ''}>
              <CaughtToggle sym={sym} name={s.name} />
              <span className="mono muted num">#{String(s.num).padStart(3, '0')}</span>
              <a className="dex-name" href={dexHref(game.id, sym)}>{s.name}</a>
              <span className="types">{s.forms['0'].types.map(t => <TypeChip key={t} type={t} small />)}</span>
              {rank && <TierBadge rank={rank} />}
              <span className="dex-where">
                {loc ? <a href={href(game.id, loc.sectionId)}>{loc.sectionTitle}</a> : <span className="muted">Not in encounter tables</span>}
                {s.locations.length > 1 && <span className="muted"> +{s.locations.length - 1}</span>}
              </span>
              <CompareToggle sym={sym} name={s.name} />
            </li>
          )
        })}
      </ol>
      {shown.length === 0 && <p className="state">No Pokemon match these filters.</p>}
      <CompareTray />
    </article>
  )
}
