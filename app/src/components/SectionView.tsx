import { marked } from 'marked'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { BattleBlock, Section, TaskBlock } from '../data/types'
import { battleId, href } from '../lib/route'
import { useCaught, usePrefs, useProgress, writeLastSection } from '../lib/progress'
import { pageItems } from '../lib/guideNav'
import { taskAnchor } from '../lib/tasks'
import { Battle } from './blocks/Battle'
import { Task } from './blocks/Task'
import { Starters } from './blocks/Starters'
import { Encounters, Mining, Pickup, Shop, Tutor, WildHeld } from './blocks/Tables'
import { useDex, useGame } from './common'
import { linkProse, nameMaps } from '../features/hovercards/names'
import { HiddenItems } from '../features/hidden-items/HiddenItems'
import { RouteMap } from '../features/route-map/RouteMap'
import { groupHiddenItems, type RenderBlock } from '../features/hidden-items/group'
import { blockAnchors } from './palette/anchors'
import { useAnchorInView } from '../features/guide-nav/useAnchorInView'
import { OnThisPage } from '../features/guide-nav/OnThisPage'
import { CatchHere } from '../features/guide-nav/CatchHere'
import { BottomBar } from '../features/guide-nav/BottomBar'

marked.setOptions({ gfm: true })

const Prose = ({ md }: { md: string }) => {
  const html = useMemo(() => marked.parse(md, { async: false }) as string, [md])
  const dex = useDex()
  const ref = useRef<HTMLDivElement>(null)
  // Items (*italic*) and Pokemon (**bold**) that match the dex become hover triggers
  useEffect(() => { if (ref.current) linkProse(ref.current, nameMaps(dex)) }, [html, dex])
  return <div className="prose" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}

const Image = ({ src, file }: { src: string; file: string }) => {
  const game = useGame()
  const url = game.imageBase + src
  return (
    <figure>
      <a href={url} target="_blank" rel="noopener"><img src={url} alt={file} loading="lazy" /></a>
    </figure>
  )
}

const BlockView = ({ b, id, done, toggle, onTask, hideDefeated }: {
  b: RenderBlock; id?: string; done: Record<string, true>; toggle: (id: string) => void; onTask: (b: TaskBlock) => void; hideDefeated: boolean
}) => {
  switch (b.type) {
    case 'prose': return <Prose md={b.markdown} />
    case 'image': return <Image src={b.src} file={b.file} />
    case 'battle': return <Battle b={b} done={!!done[battleId(b.trainers.map(t => t.teamId))]} onToggle={toggle} collapsed={hideDefeated} />
    case 'encounters': return <Encounters b={b} id={id} collapsed={hideDefeated} />
    case 'shop': return <Shop b={b} id={id} />
    case 'tutor': return <Tutor b={b} id={id} />
    case 'pickup': return <Pickup b={b} />
    case 'mining': return <Mining b={b} />
    case 'wildHeld': return <WildHeld b={b} />
    case 'hiddenItems': return <HiddenItems b={b} collapsed={hideDefeated} />
    case 'html': return <div className="prose" dangerouslySetInnerHTML={{ __html: b.html }} />
    case 'route': return <RouteMap b={b} />
    case 'starters': return <Starters b={b} />
    case 'task': return <Task b={b} done={!!done[b.id]} onToggle={onTask} collapsed={hideDefeated}><Prose md={b.markdown} /></Task>
  }
}

interface Props {
  section: Section
  // Route id of the section (the chapter id for intros)
  sectionKey: string
  chapterTitle: string
  prev: { id: string; title: string } | null
  next: { id: string; title: string } | null
  // Guide order of section ids, for the "last listed here" flag in Catch here
  sectionOrder?: Record<string, number>
  // Record the block in view as the resume spot (off on the game root, which only previews the first section)
  track: boolean
  menuOpen: boolean
  onContents: () => void
}

const label = (b: BattleBlock) => b.trainers.map(t => `${t.title} ${t.name}`).join(' & ')

export const SectionView = ({ section, sectionKey, chapterTitle, prev, next, sectionOrder, track, menuOpen, onContents }: Props) => {
  const game = useGame()
  const { done, toggle } = useProgress(game.id)
  const { done: prefs, toggle: togglePref } = usePrefs(game.id)
  const hideDefeated = !!prefs.hideDefeated
  const battles = section.blocks.filter((b): b is BattleBlock => b.type === 'battle' && !b.partner)
  const beaten = battles.filter(b => done[battleId(b.trainers.map(t => t.teamId))]).length
  const tasks = section.blocks.filter((b): b is TaskBlock => b.type === 'task')
  const tasksDone = tasks.filter(b => done[b.id]).length
  const nextUp = battles.find(b => !done[battleId(b.trainers.map(t => t.teamId))])
  const counts = section.blocks.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.type]: (acc[b.type] ?? 0) + 1 }), {})
  const blocks = useMemo(() => groupHiddenItems(section.blocks, section.id ?? ''), [section])
  const levels = battles.flatMap(b => b.party.map(p => p.level))
  // Anchors only depend on battle/encounter/shop/tutor blocks, which grouping leaves untouched
  const anchors = useMemo(() => blockAnchors(blocks), [blocks])
  const ids = useMemo(() => anchors.filter((a): a is string => !!a), [anchors])
  const inView = useAnchorInView(ids, `${beaten}|${tasksDone}|${hideDefeated}`)
  const items = pageItems(blocks, anchors, done)

  useEffect(() => {
    if (track && inView.current) writeLastSection(game.id, sectionKey, inView.current)
  }, [track, inView.current, game.id, sectionKey])

  // Ticking a battle also makes it the resume spot
  const onToggle = useCallback((id: string) => {
    toggle(id)
    if (track) writeLastSection(game.id, sectionKey, `battle-${id}`)
  }, [toggle, track, game.id, sectionKey])

  // Ticking a catch task also marks its species caught; unticking leaves the caught list alone
  const { done: caught, toggle: toggleCaught } = useCaught(game.id)
  const onTask = useCallback((b: TaskBlock) => {
    if (!done[b.id] && b.kind === 'catch') (b.species ?? []).filter(s => !caught[s]).forEach(toggleCaught)
    toggle(b.id)
    if (track) writeLastSection(game.id, sectionKey, taskAnchor(b.slug))
  }, [done, caught, toggle, toggleCaught, track, game.id, sectionKey])

  const nextId = nextUp && battleId(nextUp.trainers.map(t => t.teamId))
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const action = nextUp && nextId
    ? inView.visible === `battle-${nextId}`
      ? <button type="button" className="bb-main mark" onClick={() => onToggle(nextId)}>Mark beaten<small>{label(nextUp)}</small></button>
      : <button type="button" className="bb-main" onClick={() => jump(`battle-${nextId}`)}>Next unbeaten<small>{label(nextUp)}</small></button>
    : battles.length > 0 ? <span className="bb-main done">All {battles.length} beaten</span> : null

  return (
    <article className="section">
      <header className="section-hero">
        <span className="eyebrow">{chapterTitle}</span>
        <h1>{section.title ?? chapterTitle}</h1>
        <div className="stats">
          {battles.length > 0 && <div className="stat"><b>{beaten}/{battles.length}</b><span>battles won</span></div>}
          {tasks.length > 0 && <div className="stat"><b>{tasksDone}/{tasks.length}</b><span>tasks done</span></div>}
          {levels.length > 0 && <div className="stat"><b>Lv {Math.min(...levels)}&ndash;{Math.max(...levels)}</b><span>enemy range</span></div>}
          {counts.encounters && <div className="stat"><b>{counts.encounters}</b><span>encounter tables</span></div>}
          {counts.shop && <div className="stat"><b>{counts.shop}</b><span>shops</span></div>}
        </div>
        <CatchHere blocks={section.blocks} sectionOrder={sectionOrder} here={sectionOrder?.[sectionKey]} />
        {battles.length > 0 && (
          <div className="meter" role="progressbar" aria-label="Battles won in this section"
            aria-valuemin={0} aria-valuemax={battles.length} aria-valuenow={beaten} aria-valuetext={`${beaten} of ${battles.length} battles won`}>
            <i style={{ width: `${(beaten / battles.length) * 100}%` }} />
          </div>
        )}
        {(battles.length > 0 || tasks.length > 0) && (
          <div className="hero-row">
            {nextUp && nextId && (
              <a className="next-up" href={`#battle-${nextId}`} onClick={e => { e.preventDefault(); jump(`battle-${nextId}`) }}>
                Next unbeaten: {label(nextUp)}
              </a>
            )}
            <label className="hide-done">
              <input type="checkbox" checked={hideDefeated} onChange={() => togglePref('hideDefeated')} /> Hide defeated
            </label>
          </div>
        )}
      </header>

      <OnThisPage items={items} current={inView.current} />

      <div className="blocks">
        {blocks.map((b, i) => <BlockView key={i} b={b} id={anchors[i] ?? undefined} done={done} toggle={onToggle} onTask={onTask} hideDefeated={hideDefeated} />)}
      </div>

      <nav className="pager">
        {prev ? <a href={href(game.id, prev.id)}><span className="eyebrow">Previous</span>{prev.title}</a> : <span />}
        {next ? <a href={href(game.id, next.id)} className="right"><span className="eyebrow">Next</span>{next.title}</a> : <span />}
      </nav>
      <footer className="src">
        Walkthrough text from <a href={`${game.credit.url}#${section.id ?? ''}`} target="_blank" rel="noopener">{game.credit.label}</a>. Game data from the game's own files.
      </footer>
      <BottomBar game={game.id} menuOpen={menuOpen} onContents={onContents} prev={prev} next={next} action={action} />
    </article>
  )
}
