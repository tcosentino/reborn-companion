import type { EncountersBlock, MiningBlock, PickupBlock, ShopBlock, TutorBlock, WildHeldBlock } from '../../data/types'
import { dexHref } from '../../lib/route'
import { TypeChip, itemName, money, typeVar, useDex, useGame } from '../common'
import { MonSprite } from '../dex/MonSprite'
import { CaughtToggle, TierBadge } from '../pokedex/bits'
import { usePokedex } from '../pokedex/context'
import { DexHover } from '../../features/hovercards/DexHover'
import { buildEncounterGrid } from './encounterGrid'

const Ring = ({ rate, color }: { rate: number; color: string }) => {
  const r = 7, c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r={r} className="track" />
      <circle cx="9" cy="9" r={r} className="fill" style={{ stroke: color }} strokeDasharray={`${(c * Math.min(rate, 100)) / 100} ${c}`} />
    </svg>
  )
}

const RateCell = ({ rate, color, span }: { rate: number | null; color: string; span?: number }) => (
  <td className="rate" colSpan={span}>
    {rate == null
      ? <span className="none" aria-label="Not found here">-</span>
      : <span className="cell" aria-label={`${rate}% encounter rate`}><Ring rate={rate} color={color} />{rate}%</span>}
  </td>
)

export const Encounters = ({ b, id }: { b: EncountersBlock; id?: string }) => {
  const dex = useDex()
  const game = useGame()
  const pokedex = usePokedex()
  const { times, groups } = buildEncounterGrid(b.methods)
  const width = Math.max(times.length, 1)
  const lead = pokedex ? 2 : 1
  return (
    <section className="enc" id={id}>
      <div className="block-head"><h3>{b.name}</h3><span className="eyebrow">Wild encounters</span></div>
      <div className="enc-scroll">
        <table className="enc-grid">
          <thead>
            <tr>
              <th className="mon" colSpan={lead}>Pokemon</th>
              {times.length ? times.map(t => <th className="rate" key={t}>{t}</th>) : <th className="rate">Rate</th>}
            </tr>
          </thead>
          {groups.map(g => (
            <tbody key={g.method}>
              <tr className="method"><th colSpan={lead + width}><span className="tag accent">{g.label}</span></th></tr>
              {g.rows.map(r => {
                const color = typeVar(dex.species[r.species]?.forms['0']?.types[0] ?? 'NORMAL')
                return (
                  <tr className={r.firstSeen ? 'new' : ''} key={`${r.species}|${r.form ?? ''}`}>
                    {pokedex && <td className="chk"><CaughtToggle sym={r.species} name={r.displayName} /></td>}
                    <td className="mon">
                      <div className="name">
                        <DexHover kind="species" sym={r.species} form={r.form} focusable={false} className="hc-sprite"><MonSprite species={r.species} form={r.form} size="icon" /></DexHover>
                        <span className="name-line">
                          <DexHover kind="species" sym={r.species} form={r.form} focusable={false}><a href={dexHref(game.id, r.species)}><b>{r.displayName}</b></a></DexHover>
                          {pokedex?.ranks[r.species] && <TierBadge rank={pokedex.ranks[r.species]} />}
                          <small>Lv {r.levels}{r.form && r.form !== 'Normal Form' ? ` · ${r.form}` : ''}</small>
                        </span>
                      </div>
                    </td>
                    {g.timed
                      ? r.rates.map((rate, i) => <RateCell key={i} rate={rate} color={color} />)
                      : <RateCell rate={r.rates[0]} color={color} span={width} />}
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="legend-note"><span className="new-dot" /> First place this Pokemon appears in the guide{pokedex && <>. Tick the box when caught; the letter is how worth leveling it is (S best, D skip).</>}</p>
    </section>
  )
}

export const Shop = ({ b, id }: { b: ShopBlock; id?: string }) => {
  return (
    <section className="shop" id={id}>
      <div className="block-head"><h3>{b.title}</h3><span className="eyebrow">Shop</span></div>
      <table>
        <tbody>
          {b.items.map((it, i) => (
            <tr key={i} className={it.highlight ? 'pick' : ''}>
              <td><DexHover kind="item" sym={it.item}>{it.name}</DexHover></td>
              <td className="price">{money(it.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export const Tutor = ({ b, id }: { b: TutorBlock; id?: string }) => {
  const dex = useDex()
  return (
    <section className="shop" id={id}>
      <div className="block-head"><h3>{b.title}</h3><span className="eyebrow">Move tutor</span></div>
      <table>
        <tbody>
          {b.moves.map((m, i) => {
            const mv = m.move ? dex.moves[m.move] : null
            return (
              <tr key={i}>
                <td><DexHover kind="move" sym={m.move}>{m.name}</DexHover></td>
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
