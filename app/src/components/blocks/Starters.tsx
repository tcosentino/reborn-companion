import type { Sym } from '../../data/types'
import { natureEffect, STARTERS_ANCHOR, type StarterPick, type StartersBlock } from '../../lib/starters'
import { dexHref } from '../../lib/route'
import { MonSprite } from '../dex/MonSprite'
import { TypeChip, useDex, useGame } from '../common'
import { usePokedex, type PokedexData } from '../pokedex/context'
import { DexHover } from '../../features/hovercards/DexHover'
import './Starters.css'

// Last species down the first evolution branch (every starter line is linear)
const finalForm = (data: PokedexData | null, sym: Sym) => {
  let cur = sym
  for (let i = 0; i < 4; i++) {
    const next = data?.dex.species[cur]?.forms['0']?.evolutions?.[0]?.species
    if (!next) break
    cur = next
  }
  return cur
}

const Card = ({ p }: { p: StarterPick }) => {
  const dex = useDex()
  const data = usePokedex()
  const game = useGame()
  const species = (s: Sym) => dex.species[s] ?? data?.dex.species[s]
  const form = species(p.species)?.forms['0']
  const final = finalForm(data, p.species)
  const finalSpecies = species(final)
  const types = (finalSpecies ?? species(p.species))?.forms['0']?.types ?? []
  const tier = data?.ranks[final]?.tier
  const abilities = [...(form?.abilities ?? []).map(a => [a, false] as const), ...(form?.hiddenAbility ? [[form.hiddenAbility, true] as const] : [])]
  const name = species(p.species)?.name ?? p.species
  return (
    <li className="starter">
      <div className="st-head">
        <a href={dexHref(game.id, p.species)} className="st-sprite" title={`${name} in the Pokedex`}>
          <MonSprite species={p.species} size="sm" alt={name} />
        </a>
        <div className="st-name">
          <h4><DexHover kind="species" sym={p.species}><a href={dexHref(game.id, p.species)}>{name}</a></DexHover></h4>
          <span className="muted">
            {final !== p.species && <>Evolves into <DexHover kind="species" sym={final}><a href={dexHref(game.id, final)}>{finalSpecies?.name ?? final}</a></DexHover></>}
          </span>
          <span className="st-types">{types.map(t => <TypeChip key={t} type={t} small />)}</span>
        </div>
        {tier && <span className={`tier tier-${tier.toLowerCase()} st-tier`} title="Worth leveling tier of the final form">{tier}</span>}
      </div>
      <dl className="st-picks">
        <dt>Ability</dt>
        <dd>
          {abilities.map(([a, hidden]) => (
            <DexHover key={a} kind="ability" sym={a} className={`st-chip${p.ability === a ? ' pick' : ''}${p.ability && p.ability !== a ? ' dim' : ''}`}>
              {dex.abilities[a]?.name ?? data?.dex.abilities?.[a]?.name ?? a}{hidden && <small>HA</small>}
            </DexHover>
          ))}
          {!p.ability && <span className="st-either">either</span>}
        </dd>
        <dt>Nature</dt>
        <dd>
          {p.natures.map((n, i) => (
            <span key={n} className={`st-chip${i === 0 ? ' pick' : ''}`}>{n}<small>{natureEffect(n)}</small></span>
          ))}
        </dd>
      </dl>
      <p className="st-note">{p.note}</p>
    </li>
  )
}

const GROUP_ORDER = ['GRASS', 'FIRE', 'WATER']

// Starter picker grid grouped by type (lib/starters.ts). Replaces the guide's plain list of starter names.
export const Starters = ({ b }: { b: StartersBlock }) => {
  const dex = useDex()
  const data = usePokedex()
  const typeOf = (s: Sym) => (dex.species[s] ?? data?.dex.species[s])?.forms['0']?.types[0] ?? 'QMARKS'
  // Highest rated final form first; unrated picks keep their curated order at the end (sort is stable)
  const score = (p: StarterPick) => data?.ranks[finalForm(data, p.species)]?.score ?? -1
  const sorted = [...b.picks].sort((x, y) => score(y) - score(x))
  const groups = sorted.reduce<Map<Sym, StarterPick[]>>((m, p) => m.set(typeOf(p.species), [...(m.get(typeOf(p.species)) ?? []), p]), new Map())
  const ordered = [...groups].sort(([a], [z]) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(z) + 1 || 99))
  return (
    <section className="starters" id={STARTERS_ANCHOR}>
      <header className="st-top">
        <span className="eyebrow">{b.picks.length} starters</span>
        <h3>{b.title}</h3>
        <p className="muted">
          Sorted by the final form's rating. Highlighted chips are what to soft-reset for. Hidden abilities (HA) are as common as normal ones in Reborn.
          The summary screen shows nature and ability; the characteristic line (e.g. "Good perseverance") hints at the highest IV, not the nature.
        </p>
      </header>
      {ordered.map(([type, picks]) => (
        <div key={type} className="st-group">
          <h4 className="st-group-head"><TypeChip type={type} /></h4>
          <ul className="st-grid">{picks.map(p => <Card key={p.species} p={p} />)}</ul>
        </div>
      ))}
    </section>
  )
}
