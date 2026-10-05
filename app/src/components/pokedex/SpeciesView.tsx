import { useEffect, useMemo, useState } from 'react'
import type { Sym } from '../../data/types'
import { describeEvolution } from '../../lib/evolution'
import { TIER_LABEL, preEvolutionMap } from '../../lib/ranking'
import { dexHref, href } from '../../lib/route'
import { TypeChip, useGame } from '../common'
import { CaughtToggle, TierBadge, tierSourceLabel } from './bits'
import { usePokedex } from './context'

const STAT_NAMES = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

export const SpeciesView = ({ sym }: { sym: Sym }) => {
  const game = useGame()
  const data = usePokedex()
  const [form, setForm] = useState('0')
  useEffect(() => setForm('0'), [sym])
  const pre = useMemo(() => data ? preEvolutionMap(data.dex) : {}, [data])

  if (!data) return <div className="state">Loading Pokedex&hellip;</div>
  const s = data.dex.species[sym]
  if (!s) return <div className="state">Unknown Pokemon {sym}. <a href={dexHref(game.id)}>Back to the Pokedex</a></div>

  const f = s.forms[form] ?? s.forms['0']
  const rank = data.ranks[sym]
  const total = f.baseStats.reduce((a, b) => a + b, 0)
  const abilityName = (a: Sym) => data.dex.abilities[a]?.name ?? a
  const from = (pre[sym] ?? []).flatMap(p => {
    const ps = data.dex.species[p]
    return Object.values(ps.forms).flatMap(pf => pf.evolutions.filter(e => e.species === sym).map(e => ({ sym: p, how: describeEvolution(data.dex, e) })))
  })
  const into = f.evolutions.map(e => ({ sym: e.species, how: describeEvolution(data.dex, e) }))
  // Same target can appear twice (e.g. Leafeon by stone and by location)
  const uniq = (list: { sym: Sym; how: string }[]) =>
    list.filter((x, i) => list.findIndex(y => y.sym === x.sym && y.how === x.how) === i)

  return (
    <article className="section dex-species">
      <header className="section-hero">
        <a className="eyebrow back" href={dexHref(game.id)}>Pokedex</a>
        <h1>{s.name} <span className="muted mono num">#{String(s.num).padStart(3, '0')}</span></h1>
        <div className="types">{f.types.map(t => <TypeChip key={t} type={t} />)}<span className="muted kind">{s.kind} Pokemon</span></div>
        <CaughtToggle sym={sym} name={s.name} label />
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
            <div className="block-head"><h3>Worth leveling?</h3><span className="eyebrow">{tierSourceLabel(rank)}</span></div>
            <div className="verdict-body">
              <TierBadge rank={rank} full />
              <p>{rank.note}</p>
              {rank.via && rank.source !== 'curated' && (
                <p className="muted">See <a href={dexHref(game.id, rank.via)}>{data.dex.species[rank.via]?.name}</a>.</p>
              )}
              <p className="muted small">Tier {rank.tier}: {TIER_LABEL[rank.tier]}.</p>
            </div>
          </section>
        )}

        <section className="panel">
          <div className="block-head"><h3>Base stats</h3><span className="eyebrow">Total {total}</span></div>
          <table className="stat-table">
            <tbody>
              {f.baseStats.map((v, i) => (
                <tr key={i}>
                  <th>{STAT_NAMES[i]}</th>
                  <td className="mono">{v}</td>
                  <td className="stat-bar"><i style={{ width: `${Math.min(100, (v / 200) * 100)}%` }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <li key={`f${i}`}><span className="eyebrow">From</span><a href={dexHref(game.id, e.sym)}>{data.dex.species[e.sym]?.name}</a><span className="muted">{e.how}</span></li>
              ))}
              {uniq(into).map((e, i) => (
                <li key={`t${i}`}><span className="eyebrow">Into</span><a href={dexHref(game.id, e.sym)}>{data.dex.species[e.sym]?.name}</a><span className="muted">{e.how}</span></li>
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
      </div>
    </article>
  )
}
