import type { EncounterMethod, EncountersBlock, MiningBlock, PickupBlock, ShopBlock, TutorBlock, WildHeldBlock } from '../../data/types'
import { dexHref } from '../../lib/route'
import { TypeChip, itemName, money, typeVar, useDex, useGame } from '../common'
import { MonSprite } from '../dex/MonSprite'
import { CaughtToggle, TierBadge } from '../pokedex/bits'
import { usePokedex } from '../pokedex/context'

// Morning/Day/Night tables are often identical; collapse them into one "All day" table
const collapseTimes = (methods: EncounterMethod[]): EncounterMethod[] => {
  const out: EncounterMethod[] = []
  for (const m of methods) {
    const sibs = methods.filter(x => x.method === m.method)
    const same = sibs.length > 1 && sibs.every(s => JSON.stringify(s.rows) === JSON.stringify(sibs[0].rows))
    if (same) {
      if (!out.some(o => o.method === m.method)) out.push({ ...m, time: 'All day' })
    } else out.push(m)
  }
  return out
}

export const Encounters = ({ b }: { b: EncountersBlock }) => {
  const dex = useDex()
  const game = useGame()
  const pokedex = usePokedex()
  return (
    <section className="enc">
      <div className="block-head"><h3>{b.name}</h3><span className="eyebrow">Wild encounters</span></div>
      <div className="enc-methods">
        {collapseTimes(b.methods).map((m, i) => (
          <div className="enc-method" key={i}>
            <div className="tags"><span className="tag accent">{m.method}</span>{m.time && <span className="tag">{m.time}</span>}</div>
            {[...m.rows].sort((a, z) => z.rate - a.rate).map((r, j) => {
              const types = dex.species[r.species]?.forms['0']?.types ?? []
              return (
                <div className={`enc-row${r.firstSeen ? ' new' : ''}${pokedex ? ' with-dex' : ''}`} key={j}>
                  {pokedex && <CaughtToggle sym={r.species} name={r.displayName} />}
                  <div className="name">
                    <MonSprite species={r.species} form={r.form} size="icon" />
                    <div>
                      <span className="name-line">
                        <a href={dexHref(game.id, r.species)}><b>{r.displayName}</b></a>
                        {pokedex?.ranks[r.species] && <TierBadge rank={pokedex.ranks[r.species]} />}
                      </span>
                      <small>Lv {r.levels}{r.form && r.form !== 'Normal Form' ? ` · ${r.form}` : ''}</small>
                    </div>
                  </div>
                  <div className="bar" role="img" aria-label={`${r.rate}% encounter rate`}>
                    <i style={{ width: `${r.rate}%`, ['--tc' as string]: typeVar(types[0] ?? 'NORMAL') }} />
                  </div>
                  <div className="pct">{r.rate}%</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="legend-note"><span className="new-dot" /> First place this Pokemon appears in the guide{pokedex && <>. Tick the box when caught; the letter is how worth leveling it is (S best, D skip).</>}</p>
    </section>
  )
}

export const Shop = ({ b }: { b: ShopBlock }) => {
  const dex = useDex()
  return (
    <section className="shop">
      <div className="block-head"><h3>{b.title}</h3><span className="eyebrow">Shop</span></div>
      <table>
        <tbody>
          {b.items.map((it, i) => (
            <tr key={i} className={it.highlight ? 'pick' : ''} title={it.item ? dex.items[it.item]?.desc : undefined}>
              <td>{it.name}</td>
              <td className="price">{money(it.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export const Tutor = ({ b }: { b: TutorBlock }) => {
  const dex = useDex()
  return (
    <section className="shop">
      <div className="block-head"><h3>{b.title}</h3><span className="eyebrow">Move tutor</span></div>
      <table>
        <tbody>
          {b.moves.map((m, i) => {
            const mv = m.move ? dex.moves[m.move] : null
            return (
              <tr key={i} title={mv?.desc}>
                <td>{m.name}</td>
                <td>{mv && <TypeChip type={mv.type} small />}</td>
                <td className="mono muted">{mv ? `${mv.category}${mv.power ? ` · ${mv.power}` : ''}` : ''}</td>
                <td className="price">{money(m.price)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export const Pickup = ({ b }: { b: PickupBlock }) => {
  const dex = useDex()
  return (
    <section className="shop">
      <div className="block-head"><h3>{b.title}</h3></div>
      <table>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>
              <td>{itemName(dex, r.item)}</td>
              <td className="mono muted">{r.odds.map(o => `${o.percent}% @ Lv ${o.minLevel}-${o.maxLevel}`).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export const Mining = ({ b }: { b: MiningBlock }) => {
  const dex = useDex()
  return (
    <section className="shop">
      <div className="block-head"><h3>{b.title}</h3></div>
      <table>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>
              <td>{r.items.map(s => itemName(dex, s)).join(', ')}</td>
              <td className="price">{r.probability}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export const WildHeld = ({ b }: { b: WildHeldBlock }) => {
  const dex = useDex()
  return (
    <section className="shop">
      <div className="block-head"><h3>{b.title}</h3></div>
      <table>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>
              <td>{itemName(dex, r.item)}</td>
              <td className="muted">{r.chances.map(c => `${c.percent}%: ${c.pokemon.map(p => p.displayName).join(', ')}`).join(' / ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
