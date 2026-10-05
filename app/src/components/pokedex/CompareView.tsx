import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Sym } from '../../data/types'
import { leaders, matchupRows, multLabel } from '../../lib/compare'
import { describeEvolution } from '../../lib/evolution'
import { useChecklist } from '../../lib/progress'
import { MAX_COMPARE, compareHref, dexHref, href } from '../../lib/route'
import { TypeChip, useDex, useGame } from '../common'
import { CaughtToggle, TierBadge } from './bits'
import { usePokedex } from './context'

const STAT_NAMES = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed']

// Side-by-side comparison of up to MAX_COMPARE species. The URL is the source of truth;
// the compare tray mirrors it so the selection survives navigating away.
export const CompareView = ({ syms }: { syms: Sym[] }) => {
  const game = useGame()
  const dex = useDex()
  const data = usePokedex()
  const tray = useChecklist(game.id, 'compare')
  const [pick, setPick] = useState('')

  const valid = data ? syms.filter(s => data.dex.species[s]) : []
  const go = (list: Sym[]) => { location.hash = compareHref(game.id, list) }

  // Empty URL: restore the tray; otherwise keep the tray in step with the URL
  const trayList = Object.keys(tray.done)
  useEffect(() => {
    if (!data) return
    if (syms.length === 0 && trayList.length > 0) go(trayList)
    else if (syms.join() !== trayList.join()) tray.replace(valid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, syms.join()])

  const byName = useMemo(() => {
    if (!data) return new Map<string, Sym>()
    return new Map(Object.entries(data.dex.species).map(([sym, s]) => [s.name.toLowerCase(), sym]))
  }, [data])

  if (!data) return <div className="state">Loading Pokedex&hellip;</div>

  const add = (name: string) => {
    const sym = byName.get(name.trim().toLowerCase())
    if (sym && !valid.includes(sym) && valid.length < MAX_COMPARE) go([...valid, sym])
    setPick('')
  }

  const mons = valid.map(sym => {
    const s = data.dex.species[sym]
    const f = s.forms['0']
    return { sym, s, f, total: f.baseStats.reduce((a, b) => a + b, 0) }
  })
  const totalLeaders = leaders(mons.map(m => m.total))
  const matchups = matchupRows(dex, mons.map(m => m.f.types))
  const abilityName = (a: Sym) => data.dex.abilities[a]?.name ?? a

  const Row = ({ label, children }: { label: ReactNode; children: ReactNode[] }) => (
    <tr><th scope="row">{label}</th>{children.map((c, i) => <td key={i}>{c}</td>)}</tr>
  )

  return (
    <article className="section dex-compare">
      <header className="section-hero">
        <a className="eyebrow back" href={dexHref(game.id)}>Pokedex</a>
        <h1>Compare</h1>
        <form className="compare-pick" onSubmit={e => { e.preventDefault(); add(pick) }}>
          <input className="search" list="compare-species" value={pick} onChange={e => setPick(e.target.value)}
            placeholder={valid.length >= MAX_COMPARE ? `Up to ${MAX_COMPARE} Pokemon` : 'Add a Pokemon'}
            disabled={valid.length >= MAX_COMPARE} aria-label="Add a Pokemon to compare" />
          <datalist id="compare-species">
            {Object.values(data.dex.species).map(s => <option key={s.num + s.name} value={s.name} />)}
          </datalist>
          <button type="submit" className="btn" disabled={!pick || valid.length >= MAX_COMPARE}>Add</button>
          {valid.length > 0 && <button type="button" className="btn ghost" onClick={() => go([])}>Clear</button>}
        </form>
      </header>

      {mons.length === 0
        ? <p className="state">Add up to {MAX_COMPARE} Pokemon to compare them side by side. You can also use the Compare buttons in the Pokedex.</p>
        : (
          <div className="compare-wrap">
            <table className="compare" style={{ ['--cols' as string]: mons.length }}>
              <thead>
                <tr>
                  <th />
                  {mons.map(({ sym, s, f }) => (
                    <th key={sym} scope="col">
                      <div className="compare-head">
                        <a href={dexHref(game.id, sym)} className="dex-name">{s.name}</a>
                        <button className="remove" onClick={() => go(valid.filter(v => v !== sym))} aria-label={`Remove ${s.name}`}>&times;</button>
                      </div>
                      <div className="types">{f.types.map(t => <TypeChip key={t} type={t} small />)}</div>
                      <CaughtToggle sym={sym} name={s.name} label />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Worth leveling">
                  {mons.map(({ sym }) => {
                    const r = data.ranks[sym]
                    return r ? <div className="compare-tier"><TierBadge rank={r} full /><p>{r.note}</p></div> : null
                  })}
                </Row>
                {STAT_NAMES.map((name, i) => {
                  const top = leaders(mons.map(m => m.f.baseStats[i]))
                  return (
                    <Row key={name} label={name}>
                      {mons.map((m, j) => (
                        <div className={`compare-stat${top.includes(j) ? ' lead' : ''}`}>
                          <span className="mono">{m.f.baseStats[i]}</span>
                          <i style={{ width: `${Math.min(100, (m.f.baseStats[i] / 200) * 100)}%` }} />
                        </div>
                      ))}
                    </Row>
                  )
                })}
                <Row label="Total">
                  {mons.map((m, j) => <b className={`mono${totalLeaders.includes(j) ? ' lead' : ''}`}>{m.total}</b>)}
                </Row>
                <Row label="Abilities">
                  {mons.map(({ f }) => (
                    <ul className="plain">
                      {f.abilities.map(a => <li key={a} title={data.dex.abilities[a]?.desc}>{abilityName(a)}</li>)}
                      {f.hiddenAbility && !f.abilities.includes(f.hiddenAbility) && (
                        <li title={data.dex.abilities[f.hiddenAbility]?.desc}>{abilityName(f.hiddenAbility)} <span className="muted small">(hidden)</span></li>
                      )}
                    </ul>
                  ))}
                </Row>
                <Row label="Evolves">
                  {mons.map(({ f }) => f.evolutions.length === 0
                    ? <span className="muted">Final form</span>
                    : (
                      <ul className="plain">
                        {f.evolutions.slice(0, 3).map((e, i) => (
                          <li key={i}><a href={dexHref(game.id, e.species)}>{data.dex.species[e.species]?.name}</a> <span className="muted small">{describeEvolution(data.dex, e)}</span></li>
                        ))}
                        {f.evolutions.length > 3 && <li className="muted small">+{f.evolutions.length - 3} more</li>}
                      </ul>
                    ))}
                </Row>
                <Row label="First found">
                  {mons.map(({ s }) => s.locations[0]
                    ? <a href={href(game.id, s.locations[0].sectionId)}>{s.locations[0].sectionTitle}</a>
                    : <span className="muted">Not in encounter tables</span>)}
                </Row>
                <Row label="Catch rate">{mons.map(({ s }) => <span className="mono">{s.catchRate}</span>)}</Row>
              </tbody>
            </table>

            {matchups.length > 0 && (
              <table className="compare matchups" style={{ ['--cols' as string]: mons.length }}>
                <caption>Damage taken by attack type</caption>
                <thead>
                  <tr><th />{mons.map(m => <th key={m.sym} scope="col">{m.s.name}</th>)}</tr>
                </thead>
                <tbody>
                  {matchups.map(({ type, mults }) => (
                    <tr key={type}>
                      <th scope="row"><TypeChip type={type} small /></th>
                      {mults.map((m, i) => (
                        <td key={i} className={`mult ${m > 1 ? 'weak' : m < 1 ? 'resist' : ''}`}>{m === 1 ? '' : multLabel(m)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
    </article>
  )
}
