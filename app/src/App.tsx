import { useEffect, useMemo, useState } from 'react'
import { DexContext, GameContext } from './components/common'
import { SectionView } from './components/SectionView'
import { useAnchorScroll } from './components/palette/anchorScroll'
import { CommandPalette, PaletteButton } from './components/palette/CommandPalette'
import { HoverCardHost } from './features/hovercards/HoverCardHost'
import { PokedexContext, type PokedexData } from './components/pokedex/context'
import { PokedexView } from './components/pokedex/PokedexView'
import { SpeciesView } from './components/pokedex/SpeciesView'
import { CompareView } from './components/pokedex/CompareView'
import { ItemView } from './components/reference/ItemView'
import { MoveView } from './components/reference/MoveView'
import { loadChapter, loadDex, loadIndex, loadPokedex, loadRanks, useAsync } from './data/load'
import type { GuideIndex } from './data/types'
import { GAMES, gameById, type GameConfig } from './games'
import { readLastSection, readLastSpot, useCaught, useProgress, writeLastSection } from './lib/progress'
import { loadBattles } from './data/load'
import { caughtTally, furthestBeaten, mySpot, sectionSpecies, sumTallies, tally } from './lib/guideNav'
import type { BattleRef } from './lib/sectionBattles'
import { flashAnchor } from './components/palette/anchorScroll'
import { BottomBar } from './features/guide-nav/BottomBar'
import { ResumeCard } from './features/guide-nav/ResumeCard'
import { BackupControls } from './features/guide-nav/BackupControls'
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

const Count = ({ beaten, total, caught }: { beaten: number; total: number; caught?: boolean }) => total > 0
  ? <span className={`side-count${caught ? ' caught' : ''}${beaten === total ? ' full' : ''}`}
      title={caught ? 'Pokemon caught' : 'Battles won'} aria-label={`${beaten} of ${total} ${caught ? 'Pokemon caught' : 'battles won'}`}>{beaten}/{total}</span>
  : null

// Battles won and Pokemon caught, side by side; the slots keep columns aligned when one is missing
const Counts = ({ battles, caught }: { battles?: { beaten: number; total: number }; caught?: { beaten: number; total: number } }) => (
  <span className="side-counts">
    <span className="side-slot">{battles && <Count {...battles} />}</span>
    <span className="side-slot">{caught && <Count {...caught} caught />}</span>
  </span>
)

const Sidebar = ({ game, idx, flat, current, open, onClose, inDex, battles, catchable }: {
  game: GameConfig; idx: GuideIndex; flat: FlatSection[]; current: FlatSection; open: boolean; onClose: () => void; inDex: boolean
  battles?: Record<string, BattleRef[]>; catchable?: Record<string, string[]>
}) => {
  const { done } = useProgress(game.id)
  const { done: caught } = useCaught(game.id)
  const order = useMemo(() => flat.map(s => s.id), [flat])
  const furthest = battles ? flat[furthestBeaten(order, battles, done)] : undefined
  const spot = battles ? mySpot(order, battles, done) : null

  // The current chapter and the one holding your furthest progress start open
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([current.chapterId]))
  useEffect(() => setExpanded(new Set([current.chapterId, ...(furthest ? [furthest.chapterId] : [])])), [current.chapterId, furthest?.chapterId])
  const toggleChapter = (id: string) => setExpanded(s => {
    const next = new Set(s)
    if (!next.delete(id)) next.add(id)
    return next
  })
  const spotHref = spot ? href(game.id, spot.section, spot.anchor) : null

  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="Guide contents">
      <div className="side-head">
        <a href="#/" className="brand">PokeGuide</a>
        <span className="eyebrow">{game.name} {idx.version}</span>
      </div>
      <a className={`dex-link${inDex ? ' active' : ''}`} href={dexHref(game.id)} onClick={onClose}>Pokedex</a>
      <PaletteButton className="search" onOpen={onClose} />
      {spot && spotHref && (
        <a className="my-spot" href={spotHref} onClick={e => {
          onClose()
          // Same hash would not re-trigger the anchor scroll
          if (location.hash === spotHref && spot.anchor) { e.preventDefault(); flashAnchor(spot.anchor) }
        }}>
          <span>Jump to my spot</span>
          <small>{flat.find(s => s.id === spot.section)?.title}{spot.label ? ` · ${spot.label}` : ''}</small>
        </a>
      )}
      <ol className="chapters">
        {idx.chapters.map(c => {
          const sections = c.sections.map(s => ({ id: s.id ?? c.id, title: s.title ?? 'Introduction' }))
          const isOpen = expanded.has(c.id)
          const ct = battles ? sumTallies(sections.map(s => tally(battles[s.id], done))) : undefined
          const cc = catchable ? caughtTally(sections.map(s => catchable[s.id]), caught) : undefined
          return (
            <li key={c.id} className={c.id === current.chapterId ? 'current' : ''}>
              <button className="chapter-btn" onClick={() => toggleChapter(c.id)} aria-expanded={isOpen}>
                <span>{c.title}</span>
                <Counts battles={ct} caught={cc} />
              </button>
              {isOpen && (
                <ol className="sections">
                  {sections.map(s => (
                    <li key={s.id}>
                      <a href={href(game.id, s.id)} onClick={onClose} aria-current={!inDex && s.id === current.id ? 'page' : undefined}
                        className={s.id === furthest?.id ? 'furthest' : undefined} title={s.id === furthest?.id ? 'Furthest section with a battle won' : undefined}>
                        <span>{s.title}</span>
                        <Counts battles={battles && tally(battles[s.id], done)} caught={catchable && caughtTally([catchable[s.id]], caught)} />
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          )
        })}
      </ol>
      <BackupControls />
    </nav>
  )
}

const GuideView = ({ game, route }: { game: GameConfig; route: Route }) => {
  const idx = useAsync(() => loadIndex(game.id), [game.id])
  const dex = useAsync(() => loadDex(game.id), [game.id])
  // Loaded in the background: the guide renders without dex extras (caught/tier badges) until it arrives
  const pokedex = useAsync(() => loadPokedex(game.id), [game.id])
  const ranks = useAsync(() => loadRanks(game.id), [game.id])
  const flat = useMemo(() => idx.data ? flatten(idx.data) : [], [idx.data])
  const section = route.pokedex ? readLastSection(game.id) : route.section
  const current = flat.find(s => s.id === section) ?? flat[0]
  const dexData = useMemo<PokedexData | null>(() => {
    if (!pokedex.data || !ranks.data || !idx.data) return null
    return {
      dex: pokedex.data,
      ranks: ranks.data.species,
      chapterOrder: Object.fromEntries(idx.data.chapters.map((c, i) => [c.id, i]))
    }
  }, [pokedex.data, ranks.data, idx.data])
  const chapter = useAsync(() => current ? loadChapter(game.id, current.file) : Promise.resolve(undefined), [game.id, current?.file])
  const [menu, setMenu] = useState(false)
  // Per-section battle ids for whole-guide progress; the sidebar shows counts once it arrives
  const battles = useAsync(() => loadBattles(game.id), [game.id])
  const catchable = useMemo(() => pokedex.data ? sectionSpecies(pokedex.data.species) : undefined, [pokedex.data])
  const order = useMemo(() => Object.fromEntries(flat.map(s => [s.id, s.index])), [flat])
  const titles = useMemo(() => Object.fromEntries(flat.map(s => [s.id, s.title])), [flat])
  // Spot saved by the previous visit: reopening that section without an anchor returns to the saved block
  const [boot, setBoot] = useState(() => readLastSpot(game.id))
  useEffect(() => {
    if (route.section && route.section !== boot?.section) setBoot(null)
  }, [route.section, boot?.section])
  const resumeAnchor = !route.pokedex && route.section && route.section === boot?.section ? boot.anchor : null
  useAnchorScroll(route.pokedex ? null : route.anchor ?? resumeAnchor, chapter.data ? current?.id : undefined)

  useEffect(() => { scrollTo(0, 0) }, [current?.id, route.pokedex, route.species, route.item, route.move])
  // The game root previews the first section; it must not replace the saved spot
  useEffect(() => {
    if (current && !route.pokedex && route.section) writeLastSection(game.id, current.id)
  }, [current, route.pokedex, route.section, game.id])
  useEffect(() => {
    // Item and move pages set their own title once the search index loads
    if (route.item || route.move) return
    const species = route.species && dexData?.dex.species[route.species]?.name
    const title = route.pokedex ? species || (route.compare ? 'Compare' : 'Pokedex') : current?.title
    if (title) document.title = `${title} · ${game.name} · PokeGuide`
  }, [current, route.pokedex, route.species, route.compare, route.item, route.move, dexData, game.name])

  const err = idx.error ?? dex.error ?? chapter.error
  if (err) return <main className="state">Could not load the guide. {err}. Run scripts/sync-data.sh to copy the generated data into the app.</main>
  if (!idx.data || !dex.data || !current) return <main className="state">Loading guide&hellip;</main>

  const sectionData = chapter.data?.sections.find(s => (s.id ?? chapter.data?.id) === current.id)
  const prev = flat[current.index - 1] ?? null
  const next = flat[current.index + 1] ?? null
  // "Back to <section>" on Pokedex pages returns to the last section and block read
  const lastSpot = route.pokedex ? readLastSpot(game.id) : null

  return (
    <GameContext.Provider value={game}>
      <DexContext.Provider value={dex.data}>
        <PokedexContext.Provider value={dexData}>
          <div className="shell">
            <CommandPalette />
            <Sidebar game={game} idx={idx.data} flat={flat} current={current} open={menu} onClose={() => setMenu(false)} inDex={route.pokedex} battles={battles.data?.s} catchable={catchable} />
            <main className="content">
              {route.pokedex && lastSpot && titles[lastSpot.section] && (
                <div className="guide-return">
                  <a href={href(game.id, lastSpot.section, lastSpot.anchor)}>
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Back to {titles[lastSpot.section]}
                  </a>
                </div>
              )}
              {!route.pokedex && !route.section && boot && (
                <ResumeCard game={game.id} spot={boot} order={flat.map(s => s.id)} titles={titles} battles={battles.data?.s} />
              )}
              {route.pokedex
                ? pokedex.error
                  ? <div className="state">Could not load the Pokedex. {pokedex.error}</div>
                  : route.item ? <ItemView itemKey={route.item} />
                  : route.move ? <MoveView sym={route.move} />
                  : route.compare
                    ? <CompareView syms={route.compare} />
                    : route.species
                      ? <SpeciesView sym={route.species} />
                      : <PokedexView idx={idx.data} defaultChapter={readLastSection(game.id) ? current.chapterId : null} />
                : sectionData
                  ? <SectionView key={current.id} section={sectionData} sectionKey={current.id} chapterTitle={current.chapterTitle} prev={prev} next={next}
                      sectionOrder={order} track={!!route.section} menuOpen={menu} onContents={() => setMenu(m => !m)} />
                  : <div className="state">Loading {current.title}&hellip;</div>}
              {(route.pokedex || !sectionData) && <BottomBar game={game.id} menuOpen={menu} onContents={() => setMenu(m => !m)} />}
            </main>
          </div>
          <HoverCardHost />
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
