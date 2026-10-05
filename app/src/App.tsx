import { useEffect, useMemo, useState } from 'react'
import { DexContext, GameContext } from './components/common'
import { SectionView } from './components/SectionView'
import { loadChapter, loadDex, loadIndex, useAsync } from './data/load'
import type { GuideIndex } from './data/types'
import { GAMES, gameById, type GameConfig } from './games'
import { href, useRoute } from './lib/route'

interface FlatSection { id: string; title: string; chapterId: string; chapterTitle: string; file: string; index: number }

// Sections with a null id are chapter intros; they are addressed by the chapter id
const flatten = (idx: GuideIndex): FlatSection[] =>
  idx.chapters.flatMap(c => c.sections.map(s => ({
    id: s.id ?? c.id, title: s.title ?? 'Introduction', chapterId: c.id, chapterTitle: c.title, file: c.file
  }))).map((s, index) => ({ ...s, index }))

const GamePicker = () => (
  <main className="picker">
    <h1>PokeGuide</h1>
    <p className="lede">Walkthroughs rebuilt from game data.</p>
    <div className="picker-grid">
      {GAMES.map(g => (
        <a key={g.id} className="picker-card" href={href(g.id)}>
          <b>{g.name}</b><span>{g.tagline}</span>
        </a>
      ))}
    </div>
  </main>
)

const Sidebar = ({ game, idx, current, open, onClose }: {
  game: GameConfig; idx: GuideIndex; current: FlatSection; open: boolean; onClose: () => void
}) => {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(current.chapterId)
  useEffect(() => setExpanded(current.chapterId), [current.chapterId])
  const needle = q.trim().toLowerCase()

  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="Guide contents">
      <div className="side-head">
        <a href="#/" className="brand">PokeGuide</a>
        <span className="eyebrow">{game.name} {idx.version}</span>
      </div>
      <input id="section-search" className="search" type="search" placeholder="Find a location" value={q} onChange={e => setQ(e.target.value)} />
      <ol className="chapters">
        {idx.chapters.map(c => {
          const sections = c.sections
            .map(s => ({ id: s.id ?? c.id, title: s.title ?? 'Introduction' }))
            .filter(s => !needle || s.title.toLowerCase().includes(needle) || c.title.toLowerCase().includes(needle))
          if (needle && sections.length === 0) return null
          const isOpen = needle ? true : expanded === c.id
          return (
            <li key={c.id} className={c.id === current.chapterId ? 'current' : ''}>
              <button className="chapter-btn" onClick={() => setExpanded(isOpen ? null : c.id)} aria-expanded={isOpen}>
                {c.title}
              </button>
              {isOpen && (
                <ol className="sections">
                  {sections.map(s => (
                    <li key={s.id}>
                      <a href={href(game.id, s.id)} onClick={onClose} aria-current={s.id === current.id ? 'page' : undefined}>{s.title}</a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

const GuideView = ({ game, section }: { game: GameConfig; section: string | null }) => {
  const idx = useAsync(() => loadIndex(game.id), [game.id])
  const dex = useAsync(() => loadDex(game.id), [game.id])
  const flat = useMemo(() => idx.data ? flatten(idx.data) : [], [idx.data])
  const current = flat.find(s => s.id === section) ?? flat[0]
  const chapter = useAsync(() => current ? loadChapter(game.id, current.file) : Promise.resolve(undefined), [game.id, current?.file])
  const [menu, setMenu] = useState(false)

  useEffect(() => { scrollTo(0, 0) }, [current?.id])
  useEffect(() => {
    if (current) document.title = `${current.title} · ${game.name} · PokeGuide`
  }, [current, game.name])

  const err = idx.error ?? dex.error ?? chapter.error
  if (err) return <main className="state">Could not load the guide. {err}. Run scripts/sync-data.sh to copy the generated data into the app.</main>
  if (!idx.data || !dex.data || !current) return <main className="state">Loading guide&hellip;</main>

  const sectionData = chapter.data?.sections.find(s => (s.id ?? chapter.data?.id) === current.id)
  const prev = flat[current.index - 1] ?? null
  const next = flat[current.index + 1] ?? null

  return (
    <GameContext.Provider value={game}>
      <DexContext.Provider value={dex.data}>
        <div className="shell">
          <button className="menu-btn" onClick={() => setMenu(m => !m)} aria-expanded={menu}>{menu ? 'Close' : 'Contents'}</button>
          <Sidebar game={game} idx={idx.data} current={current} open={menu} onClose={() => setMenu(false)} />
          <main className="content">
            {sectionData
              ? <SectionView key={current.id} section={sectionData} chapterTitle={current.chapterTitle} prev={prev} next={next} />
              : <div className="state">Loading {current.title}&hellip;</div>}
          </main>
        </div>
      </DexContext.Provider>
    </GameContext.Provider>
  )
}

export const App = () => {
  const route = useRoute()
  const game = route.game ? gameById(route.game) : undefined
  if (!game) return <GamePicker />
  return <GuideView game={game} section={route.section} />
}
