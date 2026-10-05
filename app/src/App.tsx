import { useEffect, useMemo, useState } from 'react'
import { DexContext, GameContext } from './components/common'
import { SectionView } from './components/SectionView'
import { PokedexContext, type PokedexData } from './components/pokedex/context'
import { PokedexView } from './components/pokedex/PokedexView'
import { SpeciesView } from './components/pokedex/SpeciesView'
import { loadChapter, loadDex, loadIndex, loadPokedex, useAsync } from './data/load'
import { tierList } from './data/tiers'
import type { GuideIndex } from './data/types'
import { GAMES, gameById, type GameConfig } from './games'
import { readLastSection, writeLastSection } from './lib/progress'
import { rankAll } from './lib/ranking'
import { dexHref, href, useRoute, type Route } from './lib/route'

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

const Sidebar = ({ game, idx, current, open, onClose, inDex }: {
  game: GameConfig; idx: GuideIndex; current: FlatSection; open: boolean; onClose: () => void; inDex: boolean
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
      <a className={`dex-link${inDex ? ' active' : ''}`} href={dexHref(game.id)} onClick={onClose}>Pokedex</a>
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
                      <a href={href(game.id, s.id)} onClick={onClose} aria-current={!inDex && s.id === current.id ? 'page' : undefined}>{s.title}</a>
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

const GuideView = ({ game, route }: { game: GameConfig; route: Route }) => {
  const idx = useAsync(() => loadIndex(game.id), [game.id])
  const dex = useAsync(() => loadDex(game.id), [game.id])
  // Loaded in the background: the guide renders without dex extras (caught/tier badges) until it arrives
  const pokedex = useAsync(() => loadPokedex(game.id), [game.id])
  const flat = useMemo(() => idx.data ? flatten(idx.data) : [], [idx.data])
  const section = route.pokedex ? readLastSection(game.id) : route.section
  const current = flat.find(s => s.id === section) ?? flat[0]
  const dexData = useMemo<PokedexData | null>(() => {
    if (!pokedex.data || !idx.data) return null
    return {
      dex: pokedex.data,
      tiers: tierList(game.id),
      ranks: rankAll(pokedex.data, tierList(game.id)),
      chapterOrder: Object.fromEntries(idx.data.chapters.map((c, i) => [c.id, i]))
    }
  }, [pokedex.data, idx.data, game.id])
  const chapter = useAsync(() => current ? loadChapter(game.id, current.file) : Promise.resolve(undefined), [game.id, current?.file])
  const [menu, setMenu] = useState(false)

  useEffect(() => { scrollTo(0, 0) }, [current?.id, route.pokedex, route.species])
  useEffect(() => {
    if (current && !route.pokedex) writeLastSection(game.id, current.id)
  }, [current, route.pokedex, game.id])
  useEffect(() => {
    const species = route.species && dexData?.dex.species[route.species]?.name
    const title = route.pokedex ? species || 'Pokedex' : current?.title
    if (title) document.title = `${title} · ${game.name} · PokeGuide`
  }, [current, route.pokedex, route.species, dexData, game.name])

  const err = idx.error ?? dex.error ?? chapter.error
  if (err) return <main className="state">Could not load the guide. {err}. Run scripts/sync-data.sh to copy the generated data into the app.</main>
  if (!idx.data || !dex.data || !current) return <main className="state">Loading guide&hellip;</main>

  const sectionData = chapter.data?.sections.find(s => (s.id ?? chapter.data?.id) === current.id)
  const prev = flat[current.index - 1] ?? null
  const next = flat[current.index + 1] ?? null

  return (
    <GameContext.Provider value={game}>
      <DexContext.Provider value={dex.data}>
        <PokedexContext.Provider value={dexData}>
          <div className="shell">
            <button className="menu-btn" onClick={() => setMenu(m => !m)} aria-expanded={menu}>{menu ? 'Close' : 'Contents'}</button>
            <Sidebar game={game} idx={idx.data} current={current} open={menu} onClose={() => setMenu(false)} inDex={route.pokedex} />
            <main className="content">
              {route.pokedex
                ? pokedex.error
                  ? <div className="state">Could not load the Pokedex. {pokedex.error}</div>
                  : route.species
                    ? <SpeciesView sym={route.species} />
                    : <PokedexView idx={idx.data} defaultChapter={readLastSection(game.id) ? current.chapterId : null} />
                : sectionData
                  ? <SectionView key={current.id} section={sectionData} chapterTitle={current.chapterTitle} prev={prev} next={next} />
                  : <div className="state">Loading {current.title}&hellip;</div>}
            </main>
          </div>
        </PokedexContext.Provider>
      </DexContext.Provider>
    </GameContext.Provider>
  )
}

export const App = () => {
  const route = useRoute()
  const game = route.game ? gameById(route.game) : undefined
  if (!game) return <GamePicker />
  return <GuideView game={game} route={route} />
}
