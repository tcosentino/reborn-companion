import './reference.css'
import { useEffect, useMemo } from 'react'
import { loadLearnsets, useAsync } from '../../data/load'
import { itemHref } from '../../lib/route'
import { TypeChip, useDex, useGame } from '../common'
import { usePokedex } from '../pokedex/context'
import { loadSearchIndex } from '../palette/entries'
import { findMove, itemPageKey, itemPlaces, movePlaces, summarize, tmsFor } from '../palette/places'
import { PlacesTable, SpeciesGrid } from './bits'
import { learnersOf } from './learners'

const stat = (v: number | null | undefined) => v == null || v <= 1 ? '–' : String(v)

// #/<game>/move/<SYM>: type, power and category, where to learn it (tutors, TMs) and who can learn it
export const MoveView = ({ sym }: { sym: string }) => {
  const game = useGame()
  const dex = useDex()
  const pokedex = usePokedex()
  const idx = useAsync(() => loadSearchIndex(game.id), [game.id])
  const ls = useAsync(() => loadLearnsets(game.id), [game.id])
  const mv = dex.moves[sym] ?? ls.data?.moves[sym]
  const name = mv?.name ?? sym
  useEffect(() => { document.title = `${name} · ${game.name} · PokeGuide` }, [name, game.name])
  const learners = useMemo(() => ls.data ? learnersOf(ls.data, sym) : null, [ls.data, sym])

  if (idx.error) return <div className="state">Could not load the search index. {idx.error}</div>
  if (!idx.data || (!mv && !ls.data && !ls.error)) return <div className="state">Loading&hellip;</div>
  if (!mv) return <div className="state">Unknown move {sym}.</div>

  const row = findMove(idx.data, sym)
  const tutors = row ? movePlaces(idx.data, row) : []
  const tms = tmsFor(idx.data, sym)
  const speciesName = (s: string) => pokedex?.dex.species[s]?.name ?? dex.species[s]?.name ?? s
  const formNote = (s: string, forms: string[]) =>
    forms.map(f => pokedex?.dex.species[s]?.forms[f]?.name ?? dex.species[s]?.forms[f]?.name ?? `Form ${f}`).join(', ')

  return (
    <article className="section dex-species ref-page">
      <header className="section-hero">
        <span className="eyebrow">Move</span>
        <h1>{mv.name}</h1>
        <div className="types"><TypeChip type={mv.type} /><span className="muted kind">{mv.category} move</span></div>
        <dl className="ref-stats">
          <div><dt className="eyebrow">Power</dt><dd className="mono">{stat(mv.power)}</dd></div>
          <div><dt className="eyebrow">Accuracy</dt><dd className="mono">{stat(mv.accuracy)}</dd></div>
          <div><dt className="eyebrow">PP</dt><dd className="mono">{stat(mv.pp)}</dd></div>
        </dl>
        {mv.desc && <p className="lede ref-desc">{mv.desc}</p>}
      </header>

      <div className="dex-grid">
        {tms.length > 0 && (
          <section className="panel wide">
            <div className="block-head"><h3>TM</h3></div>
            <table className="loc-table">
              <tbody>
                {tms.map(t => (
                  <tr key={t[1] || t[0]}>
                    <td><a href={itemHref(game.id, itemPageKey(t))}>{t[0]}</a></td>
                    <td className="muted">{summarize(itemPlaces(idx.data!, t), 3) || 'Not listed in the walkthrough'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <section className="panel wide">
          <div className="block-head"><h3>Move tutors</h3><span className="eyebrow">{tutors.length}</span></div>
          <PlacesTable places={tutors} empty="No move tutor in the guide teaches it." />
        </section>
        <section className="panel wide">
          <div className="block-head"><h3>Learned via TM or tutor</h3>{learners && <span className="eyebrow">{learners.machine.length} Pokemon</span>}</div>
          {ls.error ? <p className="muted pad">Learnset data is unavailable.</p>
            : !learners ? <p className="muted pad">Loading&hellip;</p>
              : learners.machine.length === 0 ? <p className="muted pad">No Pokemon learns it from a TM or tutor.</p>
                : <SpeciesGrid list={learners.machine.map(l => ({ sym: l.sym, extra: l.forms.length ? formNote(l.sym, l.forms) : undefined }))} names={speciesName} />}
        </section>
        {learners && learners.level.length > 0 && (
          <section className="panel wide">
            <div className="block-head"><h3>Learned by level up</h3><span className="eyebrow">{learners.level.length} Pokemon</span></div>
            <SpeciesGrid
              list={learners.level.map(l => ({ sym: l.sym, extra: `Lv ${l.level}${l.forms.length ? ` · ${formNote(l.sym, l.forms)}` : ''}` }))}
              names={speciesName} />
          </section>
        )}
      </div>
    </article>
  )
}
