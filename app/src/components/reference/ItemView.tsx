import './reference.css'
import { useEffect } from 'react'
import { useAsync } from '../../data/load'
import { moveHref } from '../../lib/route'
import { TypeChip, money, useDex, useGame } from '../common'
import { ItemSprite } from '../dex/ItemSprite'
import { loadSearchIndex } from '../palette/entries'
import { findItem, findMove, itemPlaces, movePlaces } from '../palette/places'
import { PlacesTable } from './bits'

// #/<game>/item/<key>: every shop that sells an item and every section where it is found
export const ItemView = ({ itemKey }: { itemKey: string }) => {
  const game = useGame()
  const dex = useDex()
  const idx = useAsync(() => loadSearchIndex(game.id), [game.id])
  const row = idx.data ? findItem(idx.data, itemKey) : undefined
  const info = dex.items[row?.[1] || itemKey]
  const name = row?.[0] ?? info?.name ?? itemKey
  useEffect(() => { document.title = `${name} · ${game.name} · PokeGuide` }, [name, game.name])

  if (idx.error) return <div className="state">Could not load the search index. {idx.error}</div>
  if (!idx.data) return <div className="state">Loading&hellip;</div>
  if (!row && !info) return <div className="state">Unknown item {itemKey}.</div>

  const places = row ? itemPlaces(idx.data, row) : []
  const shops = places.filter(p => p.kind === 'shop')
  const found = places.filter(p => p.kind === 'found')
  const teaches = row?.[4]
  const mv = teaches ? dex.moves[teaches] : undefined
  const tutorRow = teaches ? findMove(idx.data, teaches) : undefined
  const tutors = tutorRow ? movePlaces(idx.data, tutorRow) : []

  return (
    <article className="section dex-species ref-page">
      <header className="section-hero">
        <span className="eyebrow">{teaches ? 'TM' : 'Item'}</span>
        <h1 className="ref-item-title"><ItemSprite sym={row?.[1] || itemKey} name={name} size="lg" />{name}</h1>
        {info?.price != null && info.price > 0 && <span className="mono muted">Base price {money(info.price)}</span>}
        {info?.desc && <p className="lede ref-desc">{info.desc}</p>}
      </header>

      <div className="dex-grid">
        {teaches && (
          <section className="panel wide">
            <div className="block-head"><h3>Teaches</h3></div>
            <p className="pad ref-teach">
              <a href={moveHref(game.id, teaches)}>{mv?.name ?? teaches}</a>
              {mv && <>
                <TypeChip type={mv.type} small />
                <span className="mono muted small">{mv.category}{mv.power && mv.power > 1 ? ` · ${mv.power} pow` : ''}</span>
              </>}
            </p>
          </section>
        )}
        <section className="panel wide">
          <div className="block-head"><h3>Where to buy</h3><span className="eyebrow">{shops.length} {shops.length === 1 ? 'shop' : 'shops'}</span></div>
          <PlacesTable places={shops} empty="Not sold in any shop the guide lists." />
        </section>
        <section className="panel wide">
          <div className="block-head"><h3>Where to find</h3><span className="eyebrow">{found.length} {found.length === 1 ? 'section' : 'sections'}</span></div>
          <PlacesTable places={found} empty="The walkthrough never mentions picking it up." />
          {found.length > 0 && <p className="muted small pad">Sections whose walkthrough text names this item as a pickup or reward.</p>}
        </section>
        {tutors.length > 0 && (
          <section className="panel wide">
            <div className="block-head"><h3>Move tutors</h3><span className="eyebrow">Also teach {mv?.name ?? teaches}</span></div>
            <PlacesTable places={tutors} empty="" />
          </section>
        )}
      </div>
    </article>
  )
}
