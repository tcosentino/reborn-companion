import { useId, useMemo, useState } from 'react'
import type { BattleBlock, Dex } from '../../data/types'
import { TypeChip, typeVar, useDex, useGame } from '../common'
import { type FieldInfo, type FieldMap, useFields } from './fieldData'
import { resolveField } from './fieldMatch'
import './FieldBanner.css'

// Procedural background pattern per field (drawn in CSS, see FieldBanner.css)
const PATTERNS: Record<string, string> = {
  FACTORY: 'stripes', SHORTCIRCUIT: 'bolts', ELECTERRAIN: 'bolts',
  CORROSIVE: 'bubbles', CORROSIVEMIST: 'bubbles', MURKWATERSURFACE: 'bubbles', SWAMP: 'bubbles', WASTELAND: 'bubbles',
  BURNING: 'embers', SUPERHEATED: 'embers', DRAGONSDEN: 'embers',
  GRASSY: 'blades', FOREST: 'blades', FLOWERGARDEN1: 'blades', FLOWERGARDEN2: 'blades', FLOWERGARDEN3: 'blades',
  FLOWERGARDEN4: 'blades', FLOWERGARDEN5: 'blades', BIGTOP: 'blades',
  ICY: 'frost', SNOWYMOUNTAIN: 'frost', MISTY: 'frost',
  WATERSURFACE: 'waves', UNDERWATER: 'waves', ASHENBEACH: 'waves',
  CHESS: 'grid', MIRROR: 'grid', GLITCH: 'grid', INVERSE: 'grid',
  STARLIGHT: 'stars', NEWWORLD: 'stars', HOLY: 'stars', FAIRYTALE: 'stars', PSYTERRAIN: 'stars', DARKCRYSTALCAVERN: 'stars',
  DESERT: 'dunes',
  ROCKY: 'rock', CAVE: 'rock', MOUNTAIN: 'rock', CRYSTALCAVERN: 'rock',
  RAINBOW: 'rainbow'
}

const mult = (m: number) => `${m}x`

interface Chip { type: string; multiplier: number; title: string; direct: boolean }

// Top boosts as type chips: direct type boosts first, then the types of specifically boosted moves.
export const topBoosts = (info: FieldInfo, dex: Dex, limit = 4): Chip[] => {
  const best = new Map<string, Chip>()
  const add = (type: string, multiplier: number, title: string, direct: boolean) => {
    const cur = best.get(type)
    if (!cur || (direct && !cur.direct) || (direct === cur.direct && multiplier > cur.multiplier)) best.set(type, { type, multiplier, title, direct })
  }
  info.boosts.types.forEach(b => add(b.type, b.multiplier, `${dex.types[b.type]?.name ?? b.type} moves${b.condition ? ` (${b.condition})` : ''}`, true))
  info.boosts.moves.forEach(b => {
    const t = dex.moves[b.move]?.type
    if (t) add(t, b.multiplier, `Boosts specific ${dex.types[t]?.name ?? t} moves`, false)
  })
  return [...best.values()].sort((a, b) => Number(b.direct) - Number(a.direct) || b.multiplier - a.multiplier).slice(0, limit)
}

const Details = ({ info }: { info: FieldInfo }) => {
  const dex = useDex()
  const moveName = (sym: string) => dex.moves[sym]?.name ?? sym
  const section = (label: string, rows: { key: string; label: string; x: number; note?: string }[]) =>
    rows.length > 0 && (
      <div className="fb-sec">
        <span className="eyebrow">{label}</span>
        <ul>
          {rows.map(r => (
            <li key={r.key} title={r.note}>
              <span>{r.label}</span><b className="mono">{mult(r.x)}</b>
            </li>
          ))}
        </ul>
      </div>
    )
  const typeRows = (list: FieldInfo['boosts']['types']) =>
    list.map(t => ({ key: t.type, label: `${dex.types[t.type]?.name ?? t.type}${t.condition ? ` (${t.condition})` : ''}`, x: t.multiplier }))
  const moveRows = (list: FieldInfo['boosts']['moves']) =>
    list.map(m => ({ key: m.move, label: moveName(m.move), x: m.multiplier, note: m.note }))
  return (
    <div className="fb-detail">
      <p className="fb-summary"><b>{info.name}.</b> {info.summary}</p>
      <div className="fb-cols">
        {section('Boosted types', typeRows(info.boosts.types))}
        {section('Boosted moves', moveRows(info.boosts.moves))}
        {section('Weakened types', typeRows(info.weakened.types))}
        {section('Weakened moves', moveRows(info.weakened.moves))}
      </div>
      {info.changes.length > 0 && (
        <div className="fb-sec">
          <span className="eyebrow">Changes</span>
          <ul className="fb-changes">{info.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export const FieldBanner = ({ b }: { b: BattleBlock }) => {
  const dex = useDex()
  const game = useGame()
  const fields: FieldMap | null = useFields(game.id)
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const names = useMemo(() => {
    const fromDex = Object.fromEntries(Object.entries(dex.fields ?? {}).map(([k, name]) => [k, { name }]))
    return { ...fromDex, ...(fields ?? {}) }
  }, [dex, fields])
  const resolved = resolveField(b.field, b.fieldName, names)
  if (!resolved) return null

  const infos = resolved.symbols.flatMap(s => (fields?.[s] ? [{ sym: s, info: fields[s] }] : []))
  const primarySym = resolved.symbols[0]
  const primary = resolved.relation === 'either' ? undefined : fields?.[primarySym]
  const label = b.fieldName ?? primary?.name ?? names[primarySym]?.name ?? primarySym
  const chips = primary ? topBoosts(primary, dex) : []
  const tint = primary?.color ? typeVar(primary.color) : 'var(--accent)'
  const pattern = resolved.relation === 'either' ? 'stars' : PATTERNS[primarySym] ?? 'plain'
  const expandable = infos.length > 0
  const note = resolved.relation === 'layered' ? 'Layered fields' : resolved.relation === 'either' ? 'One of these fields' : null

  return (
    <div className="fb" data-pattern={pattern} style={{ ['--fc' as string]: tint }}>
      <div className="fb-bar">
        <div className="fb-title">
          <span className="eyebrow">Field effect{note ? ` · ${note}` : ''}</span>
          <h4>{label}</h4>
        </div>
        {chips.length > 0 && (
          <div className="fb-chips" aria-label="Top boosts">
            {chips.map(c => (
              <span key={c.type} title={c.title}><TypeChip type={c.type} small suffix={mult(c.multiplier)} /></span>
            ))}
          </div>
        )}
        {expandable && (
          <button type="button" className="fb-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(o => !o)}>
            {open ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {expandable && open && (
        <div id={panelId} className="fb-panel">
          {infos.map(({ sym, info }, i) => (
            <div key={sym}>
              {infos.length > 1 && <span className="eyebrow">{resolved.relation === 'layered' ? (i === 0 ? 'Top layer' : 'Underneath') : `Option ${i + 1}`}</span>}
              <Details info={info} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
