// Species page panels built from the guide: "Gift / special" (prose mentions) and "Faced in battle"
import '../reference/reference.css'
import { useState } from 'react'
import type { PokedexSpecies, Sym } from '../../data/types'
import { useAsync } from '../../data/load'
import { href } from '../../lib/route'
import { useGame } from '../common'
import { loadSearchIndex } from '../palette/entries'
import { episodeOf, groupRuns, opponentsOf, specialMentions } from './speciesExtras'

const FOES_CAP = 10
const lvRange = (a: number, b: number) => a === b ? `Lv ${a}` : `Lv ${a}–${b}`

export const SpeciesGuideLists = ({ sym, species }: { sym: Sym; species: PokedexSpecies }) => {
  const game = useGame()
  const idx = useAsync(() => loadSearchIndex(game.id), [game.id])
  const [all, setAll] = useState(false)
  const mentions = specialMentions(species)
  const foes = idx.data ? opponentsOf(idx.data, sym) : []
  const shown = all ? foes : foes.slice(0, FOES_CAP)

  return (
    <>
      {mentions.length > 0 && (
        <section className="panel wide">
          <div className="block-head"><h3>Gift / special</h3><span className="eyebrow">{mentions.length} {mentions.length === 1 ? 'section' : 'sections'}</span></div>
          <table className="loc-table ref-places">
            <tbody>
              {mentions.map(m => (
                <tr key={m.sectionId}>
                  <td className="mono muted ref-ep">{episodeOf(idx.data, m.sectionId) ?? ''}</td>
                  <td><a href={href(game.id, m.sectionId)}>{m.sectionTitle}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small pad">Sections whose walkthrough text highlights this Pokemon outside an encounter table: gifts, eggs, static encounters, trades and purchases.</p>
        </section>
      )}

      {foes.length > 0 && (
        <section className="panel wide">
          <div className="block-head"><h3>Faced in battle</h3><span className="eyebrow">{foes.length} {foes.length === 1 ? 'trainer' : 'trainers'}</span></div>
          <ul className="ref-foes">
            {groupRuns(shown, f => f.episode).map(([ep, list], gi) => (
              <li key={`${ep}-${gi}`}>
                <div className="eyebrow ref-ep-head">{ep}</div>
                <ul className="ref-foes">
                  {list.map((f, i) => (
                    <li key={`${f.anchor}-${i}`}>
                      <a href={href(game.id, f.section, f.anchor)}>
                        <span><span className="ref-cls">{f.cls}</span> <b>{f.names}</b></span>
                        <span className="mono muted small">{lvRange(f.minLv, f.maxLv)}</span>
                        <span className="ref-where">{f.sectionTitle}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {foes.length > FOES_CAP && (
            <button type="button" className="ref-more" onClick={() => setAll(a => !a)} aria-expanded={all}>
              {all ? 'Show fewer' : `Show all ${foes.length}`}
            </button>
          )}
          <p className="muted small pad">Levels are the trainer&rsquo;s whole party range.</p>
        </section>
      )}
    </>
  )
}
