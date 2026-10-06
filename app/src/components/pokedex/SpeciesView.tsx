import './pokedex.css'
import { useEffect, useMemo, useState } from 'react'
import type { Factor, MoveSource, SetMove, Sym } from '../../data/types'
import { loadMovesets, useAsync } from '../../data/load'
import { describeEvolution, evolutionItem } from '../../lib/evolution'
import { ItemSprite } from '../dex/ItemSprite'
import { preEvolutionMap } from '../../lib/ranking'
import { dexHref, href } from '../../lib/route'
import { TypeChip, useGame } from '../common'
import { StatBars } from '../dex/StatBars'
import { CaughtToggle, CompareToggle, CompareTray, TierBadge } from './bits'
import { usePokedex } from './context'
import { SpeciesGuideLists } from './SpeciesGuideLists'

const FACTORS: [Factor, string][] = [['stats', 'Stats'], ['moves', 'Movepool'], ['bosses', 'Boss matchups'], ['availability', 'Availability'], ['abilities', 'Ability']]

const learnLabel = (m: SetMove) => {
  const how: Record<MoveSource, string> = {
    level: m.level != null ? `Lv ${m.level}` : 'Level up',
    machine: 'TM/Tutor',
    relearn: 'Relearner',
    egg: 'Egg move'
  }
  return how[m.source]
}

export const SpeciesView = ({ sym }: { sym: Sym }) => {
  const game = useGame()
  const data = usePokedex()
  const [form, setForm] = useState('0')
  const movesets = useAsync(() => loadMovesets(game.id), [game.id])
  useEffect(() => setForm('0'), [sym])
  const pre = useMemo(() => data ? preEvolutionMap(data.dex) : {}, [data])

  if (!data) return <div className="state">Loading Pokedex&hellip;</div>
  const s = data.dex.species[sym]
  if (!s) return <div className="state">Unknown Pokemon {sym}. <a href={dexHref(game.id)}>Back to the Pokedex</a></div>

  const f = s.forms[form] ?? s.forms['0']
  const rank = data.ranks[sym]
  const set = movesets.data?.species[sym]
  const total = f.baseStats.reduce((a, b) => a + b, 0)
  const abilityName = (a: Sym) => data.dex.abilities[a]?.name ?? a
  const from = (pre[sym] ?? []).flatMap(p => {
    const ps = data.dex.species[p]
    return Object.values(ps.forms).flatMap(pf => pf.evolutions.filter(e => e.species === sym).map(e => ({ sym: p, how: describeEvolution(data.dex, e), item: evolutionItem(e) })))
  })
  const into = f.evolutions.map(e => ({ sym: e.species, how: describeEvolution(data.dex, e), item: evolutionItem(e) }))
  // Same target can appear twice (e.g. Leafeon by stone and by location)
  const uniq = (list: { sym: Sym; how: string; item: string | null }[]) =>
    list.filter((x, i) => list.findIndex(y => y.sym === x.sym && y.how === x.how) === i)

  return (
    <article className="section dex-species">
      <header className="section-hero">
        <a className="eyebrow back" href={dexHref(game.id)}>Pokedex</a>
        <h1>{s.name} <span className="muted mono num">#{String(s.num).padStart(3, '0')}</span></h1>
        <div className="types">{f.types.map(t => <TypeChip key={t} type={t} />)}<span className="muted kind">{s.kind} Pokemon</span></div>
        <div className="hero-actions">
          <CaughtToggle sym={sym} name={s.name} label />
          <CompareToggle sym={sym} name={s.name} />
        </div>
      </header>

      {Object.keys(s.forms).length > 1 && (
        <div className="tags form-tabs" role="tablist">
          {Object.entries(s.forms).map(([k, v]) => (
            <button key={k} role="tab" aria-selected={k === form} className={`tag${k === form ? ' accent' : ''}`} onClick={() => setForm(k)}>
              {v.name}
            </button>
          ))}
        </div>
      )}

      <div className="dex-grid">
        {rank && (
          <section className="panel verdict">
            <div className="block-head"><h3>Worth leveling?</h3></div>
            <div className="verdict-body">
              <TierBadge rank={rank} full />
              <p>{rank.note}</p>
              {rank.via && (
                <p className="muted">Rated as its final form <a href={dexHref(game.id, rank.via)}>{data.dex.species[rank.via]?.name ?? rank.via}</a>.</p>
              )}
              <div className="factors">
                {FACTORS.map(([k, label]) => {
                  const v = rank.factors[k]
                  return (
                    <div className="factor" key={k}>
                      <span className="factor-name">{label}</span>
                      <span className="factor-bar" role="img" aria-label={v == null ? 'unknown' : `${Math.round(v)} out of 100`}>
                        {v != null && <i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />}
                      </span>
                      <span className="factor-val mono">{v == null ? 'unknown' : Math.round(v)}</span>
                    </div>
                  )
                })}
              </div>
              {(rank.reasons.good.length > 0 || rank.reasons.bad.length > 0) && (
                <ul className="reasons">
                  {rank.reasons.good.map((r, i) => <li key={`g${i}`} className="good"><b aria-hidden>+</b> {r}</li>)}
                  {rank.reasons.bad.map((r, i) => <li key={`b${i}`} className="bad"><b aria-hidden>&ndash;</b> {r}</li>)}
                </ul>
              )}
            </div>
          </section>
        )}

        <section className="panel moveset">
          <div className="block-head"><h3>Recommended moveset</h3>{set && <span className="eyebrow">{set.role}</span>}</div>
          {movesets.error ? <p className="muted pad">Moveset data is unavailable.</p>
            : !movesets.data ? <p className="muted pad">Loading&hellip;</p>
              : !set ? <p className="muted pad">No recommendation for this Pokemon.</p>
                : (
                  <div className="verdict-body">
                    <p className="muted small">{set.role} attacker, {set.nature} nature</p>
                    <ul className="set-moves">
                      {set.moves.map(m => {
                        const pre = m.from ? data.dex.species[m.from]?.name ?? m.from : null
                        return (
                          <li key={m.move}>
                            <TypeChip type={m.type} small />
                            <span className="set-name">{m.name}</span>
                            <span className="mono muted small">{m.category === 'status' ? 'Status' : `${m.power ?? '\u2013'} pow · ${m.accuracy || '\u2013'}%`}</span>
                            <span className="muted small set-how">{learnLabel(m)}{pre && ` (as ${pre})`}</span>
                          </li>
                        )
                      })}
                    </ul>
                    {set.coverage.length > 0 && (
                      <div className="set-coverage"><span className="muted small">Hits super-effectively:</span> {set.coverage.map(t => <TypeChip key={t} type={t} small />)}</div>
                    )}
                    <p>{set.note}</p>
                  </div>
                )}
          <p className="muted small pad">Computed from the game&rsquo;s learnsets and move data.</p>
        </section>

        <section className="panel">
          <div className="block-head"><h3>Base stats</h3><span className="eyebrow">Total {total}</span></div>
          <StatBars stats={f.baseStats} variant="full" />
        </section>

        <section className="panel">
          <div className="block-head"><h3>Abilities</h3></div>
          <dl className="abilities">
            {f.abilities.map(a => (
              <div key={a}><dt>{abilityName(a)}</dt><dd>{data.dex.abilities[a]?.desc}</dd></div>
            ))}
            {f.hiddenAbility && !f.abilities.includes(f.hiddenAbility) && (
              <div><dt>{abilityName(f.hiddenAbility)} <span className="tag">Hidden</span></dt><dd>{data.dex.abilities[f.hiddenAbility]?.desc}</dd></div>
            )}
          </dl>
          <p className="muted small pad">Catch rate {s.catchRate}</p>
        </section>

        {(from.length > 0 || into.length > 0) && (
          <section className="panel">
            <div className="block-head"><h3>Evolution</h3></div>
            <ul className="evo">
              {uniq(from).map((e, i) => (
                <li key={`f${i}`}><span className="eyebrow">From</span><a href={dexHref(game.id, e.sym)}>{data.dex.species[e.sym]?.name}</a><span className="muted"><ItemSprite sym={e.item} />{e.how}</span></li>
              ))}
              {uniq(into).map((e, i) => (
                <li key={`t${i}`}><span className="eyebrow">Into</span><a href={dexHref(game.id, e.sym)}>{data.dex.species[e.sym]?.name}</a><span className="muted"><ItemSprite sym={e.item} />{e.how}</span></li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel wide">
          <div className="block-head"><h3>Where to find</h3><span className="eyebrow">{s.locations.length} places</span></div>
          {s.locations.length === 0
            ? <p className="muted pad">Not in any wild encounter table or shop in the guide. It may be a gift, egg, evolution-only or unobtainable.</p>
            : (
              <table className="loc-table">
                <tbody>
                  {s.locations.map((l, i) => (
                    <tr key={i}>
                      <td><a href={href(game.id, l.sectionId)}>{l.sectionTitle}</a>{l.place !== l.sectionTitle && <div className="muted small">{l.place}</div>}</td>
                      <td className="muted">{l.methods.join(', ')}</td>
                      <td className="mono">{l.levels.length ? `Lv ${l.levels.join(', ')}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>
        <SpeciesGuideLists key={sym} sym={sym} species={s} />
      </div>
      <CompareTray />
    </article>
  )
}
