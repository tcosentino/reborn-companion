import { useMemo, useState } from 'react'
import type { Block } from '../../data/types'
import { useGame } from '../../components/common'
import { MonSprite } from '../../components/dex/MonSprite'
import { CaughtToggle, TierBadge } from '../../components/pokedex/bits'
import { usePokedex } from '../../components/pokedex/context'
import { catchHere } from '../../lib/catchHere'
import { useCaught } from '../../lib/progress'
import { dexHref } from '../../lib/route'
import './guide-nav.css'

interface Props {
  blocks: Block[]
  // Guide order of section ids and this section's position, for the "last listed here" flag
  sectionOrder?: Record<string, number>
  here?: number
}

// Header chip summarising the section's wild species; expands into a caught checklist sorted by tier
export const CatchHere = ({ blocks, sectionOrder, here }: Props) => {
  const game = useGame()
  const pokedex = usePokedex()
  const { done } = useCaught(game.id)
  const [open, setOpen] = useState(false)
  const list = useMemo(() => catchHere(blocks, {
    ranks: pokedex?.ranks,
    caught: done,
    places: pokedex ? sym => {
      const s = pokedex.dex.species[sym]
      return s ? [...s.locations, ...(s.mentions ?? [])] : undefined
    } : undefined,
    sectionOrder,
    here
  }), [blocks, pokedex, done, sectionOrder, here])

  if (list.length === 0) return null
  const missing = list.filter(s => !s.caught).length

  return (
    <div className="catch-here">
      <button type="button" className={`catch-chip${missing === 0 ? ' all' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <b>{list.length}</b> species here, <b>{missing}</b> not caught
      </button>
      {open && (
        <ul className="catch-list">
          {list.map(s => (
            <li key={s.species} className={s.caught ? 'is-caught' : undefined}>
              <CaughtToggle sym={s.species} name={s.name} />
              <MonSprite species={s.species} form={s.form} size="icon" />
              <a className="catch-name" href={dexHref(game.id, s.species)}>{s.name}{s.firstSeen && <span className="new-dot" title="First place it appears in the guide" />}</a>
              {s.lastChance && <span className="tag warn" title="No encounter table or walkthrough mention lists it after this section">Last listed here</span>}
              {pokedex?.ranks[s.species] ? <TierBadge rank={pokedex.ranks[s.species]} /> : <span />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
