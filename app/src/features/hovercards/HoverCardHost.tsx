import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { MonSprite } from '../../components/dex/MonSprite'
import { resolveFormIndex } from '../../components/dex/spriteMap'
import { StatBars } from '../../components/dex/StatBars'
import { TypeChip, money, typeVar, useDex, useGame } from '../../components/common'
import { usePokedex } from '../../components/pokedex/context'
import type { Dex } from '../../data/types'
import { dexHref } from '../../lib/route'
import { place, type Placement } from './placement'
import {
  cancelClose, cancelOpen, closeNow, getTarget, openNow, readTarget, scheduleClose, scheduleOpen, subscribe,
  type HoverTarget
} from './store'
import './hovercards.css'

const CARD_ID = 'hc-card'
const OPEN_DELAY = 250
const SWITCH_DELAY = 80

const SpeciesCard = ({ t }: { t: HoverTarget }) => {
  const dex = useDex()
  const game = useGame()
  const pokedex = usePokedex()
  const sp = dex.species[t.sym]
  if (!sp) return <p className="hc-desc">{t.sym}</p>
  const formKey = resolveFormIndex(sp.forms, t.form)
  const form = sp.forms[formKey] ?? Object.values(sp.forms)[0]
  const num = pokedex?.dex.species[t.sym]?.num
  const where = pokedex?.dex.species[t.sym]?.locations.slice(0, 2) ?? []
  const abilities = [
    ...(form?.abilities ?? []).map(a => ({ sym: a, hidden: false })),
    ...(form?.hiddenAbility ? [{ sym: form.hiddenAbility, hidden: true }] : [])
  ]
  return (
    <>
      <header className="hc-head">
        <MonSprite species={t.sym} form={t.form} size="md" />
        <div className="hc-id">
          <b className="hc-name">{sp.name}</b>
          {num != null && <span className="mono muted">#{String(num).padStart(3, '0')}</span>}
          {form && form.name !== 'Normal Form' && <span className="mono muted">{form.name}</span>}
          <div className="hc-types">{form?.types.map(ty => <TypeChip key={ty} type={ty} small />)}</div>
        </div>
      </header>
      {form && <StatBars stats={form.baseStats} variant="full" />}
      {abilities.length > 0 && (
        <p className="hc-line">
          <span className="eyebrow">Abilities</span>
          <span>
            {abilities.map(a => (
              <span key={a.sym} className="hc-ab">{dex.abilities[a.sym]?.name ?? a.sym}{a.hidden && <i className="hc-ha">HA</i>}</span>
            ))}
          </span>
        </p>
      )}
      {where.length > 0 && (
        <p className="hc-line">
          <span className="eyebrow">Where to catch</span>
          <span>{where.map(l => `${l.place}${l.methods[0] ? ` (${l.methods[0]})` : ''}`).join('; ')}</span>
        </p>
      )}
      <a className="hc-link" href={dexHref(game.id, t.sym)}>Open in Pokedex</a>
    </>
  )
}

const MoveCard = ({ t, dex }: { t: HoverTarget; dex: Dex }) => {
  const mv = dex.moves[t.sym]
  if (!mv) return <p className="hc-desc">{t.sym}</p>
  const stat = (label: string, v: number | null) => (
    <span><span className="eyebrow">{label}</span><b className="mono">{v == null || v <= 1 ? '-' : v}</b></span>
  )
  return (
    <>
      <header className="hc-head hc-compact">
        <b className="hc-name">{mv.name}</b>
        <TypeChip type={mv.type} small />
      </header>
      <div className="hc-stats">
        <span><span className="eyebrow">Category</span><b className="mono">{mv.category}</b></span>
        {stat('Power', mv.power)}
        {stat('Acc', mv.accuracy)}
        {stat('PP', mv.pp)}
      </div>
      <p className="hc-desc">{mv.desc}</p>
    </>
  )
}

const ItemCard = ({ t, dex }: { t: HoverTarget; dex: Dex }) => {
  const it = dex.items[t.sym]
  if (!it) return <p className="hc-desc">{t.sym}</p>
  return (
    <>
      <header className="hc-head hc-compact">
        <b className="hc-name">{it.name}</b>
        {it.price != null && <span className="mono muted">{money(it.price)}</span>}
      </header>
      <p className="hc-desc">{it.desc}</p>
    </>
  )
}

const AbilityCard = ({ t, dex }: { t: HoverTarget; dex: Dex }) => {
  const ab = dex.abilities[t.sym]
  if (!ab) return <p className="hc-desc">{t.sym}</p>
  return (
    <>
      <header className="hc-head hc-compact"><b className="hc-name">{ab.name}</b><span className="eyebrow">Ability</span></header>
      <p className="hc-desc">{ab.desc}</p>
    </>
  )
}

const CardBody = ({ t }: { t: HoverTarget }) => {
  const dex = useDex()
  switch (t.kind) {
    case 'species': return <SpeciesCard t={t} />
    case 'move': return <MoveCard t={t} dex={dex} />
    case 'item': return <ItemCard t={t} dex={dex} />
    case 'ability': return <AbilityCard t={t} dex={dex} />
  }
}

// Prefer the line box under the pointer for triggers that wrap across lines
const anchorBox = (el: HTMLElement) => {
  const r = el.getBoundingClientRect()
  return r
}

const accent = (t: HoverTarget, dex: Dex) => {
  if (t.kind === 'move') return dex.moves[t.sym]?.type
  if (t.kind === 'species') {
    const sp = dex.species[t.sym]
    return sp?.forms[resolveFormIndex(sp.forms, t.form)]?.types[0]
  }
  return undefined
}

/** One shared, portaled card plus the document-level listeners that drive it. Mount once inside the dex providers. */
export const HoverCardHost = () => {
  const dex = useDex()
  const target = useSyncExternalStore(subscribe, getTarget)
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Placement | null>(null)
  const pointerType = useRef('mouse')
  const lastKey = useRef('')

  useEffect(() => {
    const cardEl = () => document.getElementById(CARD_ID)
    const inCard = (n: EventTarget | null) => !!cardEl()?.contains(n as Node)

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const t = readTarget(e.target as Element, 'hover')
      if (t) {
        cancelClose()
        const cur = getTarget()
        if (cur?.el === t.el) { cancelOpen(); return }
        scheduleOpen(t, cur ? SWITCH_DELAY : OPEN_DELAY)
      } else if (inCard(e.target)) {
        cancelClose()
      } else {
        cancelOpen()
        if (getTarget()?.via === 'hover') scheduleClose()
      }
    }
    const onDown = (e: PointerEvent) => {
      pointerType.current = e.pointerType
      const cur = getTarget()
      if (cur?.via === 'touch' && !inCard(e.target) && !cur.el.contains(e.target as Node)) closeNow()
    }
    const onClick = (e: MouseEvent) => {
      if (pointerType.current === 'mouse' || e.detail === 0) return
      const t = readTarget(e.target as Element, 'touch')
      if (!t || inCard(e.target)) return
      e.preventDefault()
      if (getTarget()?.el === t.el) closeNow()
      else openNow(t)
    }
    const onFocusIn = (e: FocusEvent) => {
      const t = readTarget(e.target as Element, 'focus')
      if (t && (e.target as HTMLElement).matches(':focus-visible')) openNow(t)
    }
    const onFocusOut = () => { if (getTarget()?.via === 'focus') closeNow() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeNow() }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKey)
    window.addEventListener('hashchange', closeNow)
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('hashchange', closeNow)
    }
  }, [])

  // aria-describedby on the open trigger
  useEffect(() => {
    if (!target) return
    const el = target.el
    const prev = el.getAttribute('aria-describedby')
    el.setAttribute('aria-describedby', CARD_ID)
    return () => { prev ? el.setAttribute('aria-describedby', prev) : el.removeAttribute('aria-describedby') }
  }, [target])

  // Measure and place; re-place on scroll/resize and when async content (pokedex, sprites) changes the size
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!target || !card) { setPos(null); return }
    const run = () => {
      if (!target.el.isConnected) { closeNow(); return }
      const next = place({
        anchor: anchorBox(target.el),
        card: { width: card.offsetWidth, height: card.scrollHeight },
        viewport: { width: document.documentElement.clientWidth, height: window.innerHeight }
      })
      const key = `${next.left}|${next.top}|${next.side}|${next.maxHeight ?? ''}`
      if (key !== lastKey.current) { lastKey.current = key; setPos(next) }
    }
    lastKey.current = ''
    run()
    const ro = new ResizeObserver(run)
    ro.observe(card)
    window.addEventListener('scroll', run, true)
    window.addEventListener('resize', run)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', run, true)
      window.removeEventListener('resize', run)
    }
  }, [target])

  if (!target) return null
  const type = accent(target, dex)
  const interactive = target.kind === 'species'
  return createPortal(
    <div
      id={CARD_ID}
      ref={cardRef}
      className={`hc-card${pos ? '' : ' hc-measuring'}`}
      role={target.via === 'touch' && interactive ? 'dialog' : 'tooltip'}
      aria-label={target.via === 'touch' && interactive ? 'Details' : undefined}
      data-side={pos?.side}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        maxHeight: pos?.maxHeight,
        ['--arrow-x' as string]: `${pos?.arrowX ?? 0}px`,
        ['--hc-accent' as string]: type ? typeVar(type) : undefined
      }}
    >
      <CardBody t={target} />
    </div>,
    document.body
  )
}
