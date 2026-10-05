import { marked } from 'marked'
import { useMemo } from 'react'
import type { Block, BattleBlock, Section } from '../data/types'
import { battleId, href } from '../lib/route'
import { useProgress } from '../lib/progress'
import { Battle } from './blocks/Battle'
import { Encounters, Mining, Pickup, Shop, Tutor, WildHeld } from './blocks/Tables'
import { useGame } from './common'
import { blockAnchors } from './palette/anchors'

marked.setOptions({ gfm: true })

const Prose = ({ md }: { md: string }) => {
  const html = useMemo(() => marked.parse(md, { async: false }) as string, [md])
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
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

const BlockView = ({ b, id, done, toggle }: { b: Block; id?: string; done: Record<string, true>; toggle: (id: string) => void }) => {
  switch (b.type) {
    case 'prose': return <Prose md={b.markdown} />
    case 'image': return <Image src={b.src} file={b.file} />
    case 'battle': return <Battle b={b} done={!!done[battleId(b.trainers.map(t => t.teamId))]} onToggle={toggle} />
    case 'encounters': return <Encounters b={b} id={id} />
    case 'shop': return <Shop b={b} id={id} />
    case 'tutor': return <Tutor b={b} id={id} />
    case 'pickup': return <Pickup b={b} />
    case 'mining': return <Mining b={b} />
    case 'wildHeld': return <WildHeld b={b} />
    case 'html': return <div className="prose" dangerouslySetInnerHTML={{ __html: b.html }} />
  }
}

interface Props {
  section: Section
  chapterTitle: string
  prev: { id: string; title: string } | null
  next: { id: string; title: string } | null
}

export const SectionView = ({ section, chapterTitle, prev, next }: Props) => {
  const game = useGame()
  const { done, toggle } = useProgress(game.id)
  const battles = section.blocks.filter((b): b is BattleBlock => b.type === 'battle' && !b.partner)
  const beaten = battles.filter(b => done[battleId(b.trainers.map(t => t.teamId))]).length
  const nextUp = battles.find(b => !done[battleId(b.trainers.map(t => t.teamId))])
  const counts = section.blocks.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.type]: (acc[b.type] ?? 0) + 1 }), {})
  const levels = battles.flatMap(b => b.party.map(p => p.level))
  const anchors = useMemo(() => blockAnchors(section.blocks), [section.blocks])

  return (
    <article className="section">
      <header className="section-hero">
        <span className="eyebrow">{chapterTitle}</span>
        <h1>{section.title ?? chapterTitle}</h1>
        <div className="stats">
          {battles.length > 0 && <div className="stat"><b>{beaten}/{battles.length}</b><span>battles won</span></div>}
          {levels.length > 0 && <div className="stat"><b>Lv {Math.min(...levels)}&ndash;{Math.max(...levels)}</b><span>enemy range</span></div>}
          {counts.encounters && <div className="stat"><b>{counts.encounters}</b><span>encounter tables</span></div>}
          {counts.shop && <div className="stat"><b>{counts.shop}</b><span>shops</span></div>}
        </div>
        {battles.length > 0 && (
          <div className="meter" role="progressbar" aria-valuenow={Math.round((beaten / battles.length) * 100)}>
            <i style={{ width: `${(beaten / battles.length) * 100}%` }} />
          </div>
        )}
        {nextUp && (
          <a className="next-up" href={`#battle-${battleId(nextUp.trainers.map(t => t.teamId))}`}
            onClick={e => {
              e.preventDefault()
              document.getElementById(`battle-${battleId(nextUp.trainers.map(t => t.teamId))}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}>
            Next unbeaten: {nextUp.trainers.map(t => `${t.title} ${t.name}`).join(' & ')}
          </a>
        )}
      </header>

      <div className="blocks">
        {section.blocks.map((b, i) => <BlockView key={i} b={b} id={anchors[i] ?? undefined} done={done} toggle={toggle} />)}
      </div>

      <nav className="pager">
        {prev ? <a href={href(game.id, prev.id)}><span className="eyebrow">Previous</span>{prev.title}</a> : <span />}
        {next ? <a href={href(game.id, next.id)} className="right"><span className="eyebrow">Next</span>{next.title}</a> : <span />}
      </nav>
      <footer className="src">
        Walkthrough text from <a href={`${game.credit.url}#${section.id ?? ''}`} target="_blank" rel="noopener">{game.credit.label}</a>. Game data from the game's own files.
      </footer>
    </article>
  )
}
