import { useState, type ReactNode } from 'react'
import type { Sym } from '../../data/types'
import { dexHref, href } from '../../lib/route'
import { money, useGame } from '../common'
import { MonSprite } from '../dex/MonSprite'
import type { Place } from '../palette/places'

// Episode | place (linking to its block) | price or detail
export const PlacesTable = ({ places, empty }: { places: Place[]; empty: ReactNode }) => {
  const game = useGame()
  if (!places.length) return <p className="muted pad">{empty}</p>
  return (
    <table className="loc-table ref-places">
      <tbody>
        {places.map((p, i) => (
          <tr key={i}>
            <td className="mono muted ref-ep">{p.episode}</td>
            <td>
              <a href={href(game.id, p.section, p.anchor)}>{p.label}</a>
              {p.label !== p.title && <div className="muted small">{p.title}</div>}
            </td>
            <td className="mono ref-price">{p.price != null && p.price !== '' ? money(p.price) : p.detail ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Linked species with sprites, capped until "Show all"
export const SpeciesGrid = ({ list, cap = 48, names, note }: {
  list: { sym: Sym; extra?: string }[]
  cap?: number
  names: (sym: Sym) => string
  note?: ReactNode
}) => {
  const game = useGame()
  const [all, setAll] = useState(false)
  const shown = all ? list : list.slice(0, cap)
  return (
    <>
      <ul className="ref-mons">
        {shown.map(({ sym, extra }) => (
          <li key={sym}>
            <a href={dexHref(game.id, sym)}>
              <MonSprite species={sym} size="icon" />
              <span>{names(sym)}</span>
              {extra && <span className="mono muted small">{extra}</span>}
            </a>
          </li>
        ))}
      </ul>
      {list.length > cap && (
        <button type="button" className="ref-more" onClick={() => setAll(a => !a)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
      {note && <p className="muted small pad">{note}</p>}
    </>
  )
}
