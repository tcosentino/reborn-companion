import type { BattleBlock, Dex, PartyMon } from '../../data/types'
import { battleId } from '../../lib/route'
import { teamCoverage, weaknesses } from '../../lib/typechart'
import { FieldBanner } from '../fields/FieldBanner'
import { TypeChip, itemName, typeVar, useDex } from '../common'
import { MonSprite } from '../dex/MonSprite'
import { StatBars } from '../dex/StatBars'
import { DexHover } from '../../features/hovercards/DexHover'

const STAT_LABELS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

const monTypes = (dex: Dex, m: PartyMon) => {
  const sp = dex.species[m.species]
  if (!sp) return []
  const form = sp.forms[String(m.form ?? 0)] ?? Object.values(sp.forms)[0]
  return form?.types ?? []
}

const spread = (vals: number[] | null) => {
  if (!vals) return null
  return vals.every(v => v === vals[0]) ? `all ${vals[0]}` : vals.map((v, i) => `${v} ${STAT_LABELS[i]}`).filter(s => !s.startsWith('0 ')).join(' / ')
}

const Move = ({ sym }: { sym: string }) => {
  const dex = useDex()
  const mv = dex.moves[sym]
  if (!mv) return <li>{sym}</li>
  return (
    <DexHover as="li" kind="move" sym={sym} style={{ ['--mc' as string]: typeVar(mv.type) }}>
      {mv.name}
      {mv.power && mv.power > 1 ? <span className="bp">{mv.power}</span> : mv.category === 'status' ? <span className="bp">st</span> : null}
    </DexHover>
  )
}

const titleCase = (s: string | null) => s ? s.charAt(0) + s.slice(1).toLowerCase() : ''

const MonRow = ({ m, owner, showSpread }: { m: PartyMon; owner?: string; showSpread: boolean }) => {
  const dex = useDex()
  const types = monTypes(dex, m)
  const ability = m.ability ? dex.abilities[m.ability] : null
  const baseStats = dex.species[m.species]?.forms[String(m.form ?? 0)]?.baseStats ?? Object.values(dex.species[m.species]?.forms ?? {})[0]?.baseStats
  return (
    <div className="mon-row">
      <div className="mon-lead">
      <MonSprite species={m.species} form={m.form} shiny={m.shiny} size="sm" />
      <div className="mon-id">
        <div className="mon-top">
          <DexHover kind="species" sym={m.species} form={m.form}><b>{m.nickname ?? dex.species[m.species]?.name ?? m.displayName}</b></DexHover>
          <span className="mono">Lv {m.level}</span>
          {m.gender && <span className="mono muted">{m.gender === 'M' ? '♂' : '♀'}</span>}
          {owner && <span className="eyebrow">{owner}'s</span>}
        </div>
        {ability && <span className="ability"><DexHover kind="ability" sym={m.ability!}><b>{ability.name}</b></DexHover></span>}
        {m.item && <span className="ability">@ <DexHover kind="item" sym={m.item}><b>{itemName(dex, m.item)}</b></DexHover></span>}
      </div>
      </div>
      <div className="types">
        {types.map(t => <TypeChip key={t} type={t} />)}
        {m.formName && m.form !== 0 && <span className="tag">{m.formName}</span>}
        {m.shiny && <span className="tag warn">Shiny</span>}
        {m.shadow && <span className="tag">Shadow</span>}
      </div>
      <div className="mon-stats">{baseStats && <StatBars stats={baseStats} variant="compact" />}</div>
      <div className="mon-kit">
        <ul className="moves">{m.moves.map((mv, i) => <Move key={i} sym={mv} />)}</ul>
        {showSpread && (
          <span className="spread mono">
            {titleCase(m.nature)}{m.evs && ` · EVs ${spread(m.evs)}`}{m.ivs && ` · IVs ${spread(m.ivs)}`}
          </span>
        )}
      </div>
      <div className="weak">
        <span className="eyebrow">Weak to</span>
        {weaknesses(dex, types).map(([t, x]) => <TypeChip key={t} type={t} small suffix={x > 2 ? '4x' : undefined} />)}
      </div>
    </div>
  )
}

export const Battle = ({ b, done, onToggle }: { b: BattleBlock; done: boolean; onToggle: (id: string) => void }) => {
  const dex = useDex()
  const id = battleId(b.trainers.map(t => t.teamId))
  const lvs = b.party.map(p => p.level)
  const lv = Math.min(...lvs) === Math.max(...lvs) ? `Lv ${lvs[0]}` : `Lv ${Math.min(...lvs)}–${Math.max(...lvs)}`
  const sig = (p: PartyMon) => `${p.nature}|${spread(p.ivs)}|${spread(p.evs)}`
  const uniform = new Set(b.party.map(sig)).size === 1
  const first = b.party[0]
  const coverage = teamCoverage(dex, b.party.map(p => monTypes(dex, p))).slice(0, 4)
  const names = b.trainers.map(t => t.name).join(' & ')
  const classes = [...new Set(b.trainers.map(t => t.title))].join(' & ')

  return (
    <article className={`trainer${done ? ' is-done' : ''}`} id={`battle-${id}`}>
      <FieldBanner b={b} />
      <div className="tr-head">
        <div className="tr-name">
          <span className="eyebrow">{b.partner ? 'Partner' : 'VS'} · {classes}</span>
          <h3>{names}</h3>
        </div>
        <div className="tags">
          {b.double && <span className="tag accent">Double battle</span>}
          <span className="tag">{b.party.length} Pokemon</span>
          <span className="tag">{lv}</span>
          {b.showField && !b.field && !b.fieldName && <span className="tag">No field</span>}
        </div>
        {!b.partner && (
          <label className="beat">
            <input type="checkbox" checked={done} onChange={() => onToggle(id)} /> Defeated
          </label>
        )}
      </div>
      {!b.partner && coverage.length > 0 && (
        <div className="coverage">
          <span className="eyebrow">Hits most of this team</span>
          {coverage.map(c => <TypeChip key={c.type} type={c.type} small suffix={`${c.hits}/${b.party.length}`} />)}
        </div>
      )}
      <div className="party">
        <div className="party-cols eyebrow"><span>Pokemon / ability</span><span>Type</span><span>Stats</span><span>Moves</span><span>Weak to</span></div>
        {b.party.map((m, i) => (
          <MonRow key={i} m={m} showSpread={!uniform} owner={b.double && b.trainers.length > 1 ? b.trainers[m.owner]?.name : undefined} />
        ))}
      </div>
      <div className="tr-foot">
        {uniform && first?.nature && <span>Nature: {titleCase(first.nature)}</span>}
        {uniform && first?.ivs && <span>IVs: {spread(first.ivs)}</span>}
        {uniform && first?.evs && <span>EVs: {spread(first.evs)}</span>}
        {!uniform && <span>Natures and spreads differ per Pokemon</span>}
        {b.notes?.map((n, i) => <span key={i}>{n}</span>)}
      </div>
    </article>
  )
}
