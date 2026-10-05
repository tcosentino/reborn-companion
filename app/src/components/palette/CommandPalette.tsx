// Cmd/Ctrl+K command palette: fuzzy search over sections, trainers, Pokemon, items and moves,
// with deep links that land on the exact block (#/<game>/<section>/<anchor>).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { dexHref, href } from '../../lib/route'
import { TypeChip, money, useDex, useGame } from '../common'
import { flashAnchor } from './anchorScroll'
import { OPEN_IN_POKEDEX, buildEntries, chapterShort, entryKey, loadSearchIndex, speciesName, targetOf } from './entries'
import type { SearchIndex } from './indexTypes'
import { KIND_LABEL, search, type Entry, type Hit } from './search'
import './CommandPalette.css'

const OPEN_EVENT = 'pokeguide:palette-open'
export const openPalette = () => dispatchEvent(new Event(OPEN_EVENT))

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

// Recent searches: per-viewer convenience, so storage failures are ignored
const RECENT_MAX = 6
const recentKey = (game: string) => `pokeguide:${game}:palette-recent`
const readRecent = (game: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(game)) ?? '[]')
    return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch { return [] }
}
const writeRecent = (game: string, list: string[]) => {
  try { localStorage.setItem(recentKey(game), JSON.stringify(list)) } catch { /* private mode */ }
}

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

const SearchIcon = () => (
  <svg className="pal-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
    <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const PaletteButton = ({ className, onOpen }: { className?: string; onOpen?: () => void }) => (
  <button type="button" className={`palette-trigger${className ? ` ${className}` : ''}`} onClick={() => { onOpen?.(); openPalette() }}
    aria-haspopup="dialog" aria-keyshortcuts={isMac ? 'Meta+K /' : 'Control+K /'}>
    <SearchIcon /><span>Search the guide</span><kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
  </button>
)

const EXAMPLES = ['Julia', 'Klink', 'Rare Candy', 'Iron Defense', 'Obsidia Ward']

type Option = { id: string; hit: Hit } | { id: string; recent: string }

const place = (idx: SearchIndex, sIdx: number) => `${chapterShort(idx.ch[idx.s[sIdx][2]])} · ${idx.s[sIdx][1]}`
const more = (n: number) => n > 1 ? ` +${n - 1}` : ''
const lvRange = (a: number, b: number) => a === b ? `Lv ${a}` : `Lv ${a}–${b}`

const Row = ({ e, idx }: { e: Entry; idx: SearchIndex }) => {
  const dex = useDex()
  switch (e.kind) {
    case 'section': {
      const [, title, ch] = idx.s[e.ref]
      return (
        <>
          <span className="pal-title">{title}</span>
          <span className="pal-meta">{idx.ch[ch]}</span>
        </>
      )
    }
    case 'trainer': {
      const [names, cls, secs, , min, max, field, party, double] = idx.t[e.ref]
      return (
        <>
          <span className="pal-title"><span className="pal-cls">{cls}</span> {names}</span>
          <span className="pal-tags">
            <span className="tag">{lvRange(min, max)}</span>
            {field >= 0 && <span className="tag field">{idx.f[field]}</span>}
            {double === 1 && <span className="tag accent">Double</span>}
            <span className="pal-where">{place(idx, secs[0])}{more(secs.length)}</span>
          </span>
          <span className="pal-meta">{party.slice(0, 6).map(p => speciesName(dex, idx.p[p][0])).join(' · ')}{party.length > 6 ? ' …' : ''}</span>
        </>
      )
    }
    case 'species': {
      const [sym, catches, users, first] = idx.p[e.ref]
      const types = dex.species[sym]?.forms['0']?.types ?? Object.values(dex.species[sym]?.forms ?? {})[0]?.types ?? []
      const c = catches[0]
      return (
        <>
          <span className="pal-title">{speciesName(dex, sym)}<span className="types">{types.map(t => <TypeChip key={t} type={t} small />)}</span></span>
          <span className="pal-meta">
            {c
              ? <>Caught in {place(idx, c[0])} ({idx.m[c[2]]}, {lvRange(c[3], c[4])}){more(catches.length)}</>
              : first ? <>First seen in {place(idx, first[0])}</> : <>Not in the walkthrough</>}
            {users > 0 && <> · Used by {users} trainer{users === 1 ? '' : 's'}</>}
          </span>
        </>
      )
    }
    case 'item': {
      const [name, sym, shops, hidden] = idx.i[e.ref]
      const price = shops[0]?.[2] ?? (sym ? dex.items[sym]?.price : null)
      return (
        <>
          <span className="pal-title">{name}{price != null && price !== 0 && <span className="pal-price">{money(price)}</span>}</span>
          <span className="pal-meta">
            {shops.length > 0 && <>Buy in {place(idx, shops[0][0])}{more(shops.length)}</>}
            {shops.length > 0 && hidden.length > 0 && ' · '}
            {hidden.length > 0 && <>Found in {place(idx, hidden[0])}{more(hidden.length)}</>}
          </span>
        </>
      )
    }
    case 'move': {
      const [name, sym, tutors] = idx.mv[e.ref]
      const mv = sym ? dex.moves[sym] : null
      return (
        <>
          <span className="pal-title">{name}{mv && <span className="types"><TypeChip type={mv.type} small /></span>}</span>
          <span className="pal-meta">
            {tutors.length > 0 && <>Tutor in {place(idx, tutors[0][0])}{tutors[0][2] != null && ` · ${money(tutors[0][2])}`}{more(tutors.length)}</>}
          </span>
        </>
      )
    }
  }
}

export const CommandPalette = () => {
  const game = useGame()
  const dex = useDex()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [idx, setIdx] = useState<SearchIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<string[]>(() => readRecent(game.id))
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const searchMs = useRef(0)

  const close = () => setOpen(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    addEventListener('keydown', onKey)
    addEventListener(OPEN_EVENT, onOpen)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  // Fetch the index when the palette first opens, or prefetch it once the page has settled
  useEffect(() => {
    if (idx) return
    let live = true
    const load = () => loadSearchIndex(game.id).then(d => live && setIdx(d), e => live && setError(String(e?.message ?? e)))
    if (open) load()
    const t = open ? 0 : setTimeout(load, 2500)
    return () => { live = false; clearTimeout(t) }
  }, [open, idx, game.id])

  // Focus management and scroll lock while open
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const root = document.documentElement
    const prevOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    inputRef.current?.focus()
    inputRef.current?.select()
    return () => {
      root.style.overflow = prevOverflow
      restoreRef.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  const entries = useMemo(() => idx ? buildEntries(idx, dex) : [], [idx, dex])
  const groups = useMemo(() => {
    const t0 = performance.now()
    const g = search(entries, query)
    searchMs.current = performance.now() - t0
    return g
  }, [entries, query])

  const options: Option[] = useMemo(() => query.trim()
    ? groups.flatMap(g => g.hits.map(hit => ({ id: `pal-${entryKey(hit.entry)}`, hit })))
    : recent.map((r, i) => ({ id: `pal-recent-${i}`, recent: r })), [groups, recent, query])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    const el = options[active] && document.getElementById(options[active].id)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, options])

  const remember = (q: string) => {
    const v = q.trim()
    if (!v) return
    const next = [v, ...recent.filter(r => r.toLowerCase() !== v.toLowerCase())].slice(0, RECENT_MAX)
    setRecent(next)
    writeRecent(game.id, next)
  }

  const go = (hash: string, anchor: string | null) => {
    setOpen(false)
    if (location.hash === hash) {
      if (anchor) flashAnchor(anchor)
      else scrollTo(0, 0)
    } else {
      location.hash = hash
      if (!anchor) scrollTo(0, 0)
    }
  }

  const choose = (opt: Option | undefined, toDex = false) => {
    if (!opt) return
    if ('recent' in opt) {
      setQuery(opt.recent)
      inputRef.current?.focus()
      return
    }
    if (!idx) return
    const e = opt.hit.entry
    const target = targetOf(idx, e)
    remember(query)
    if (e.kind === 'species' && OPEN_IN_POKEDEX && (toDex || !target)) return go(dexHref(game.id, idx.p[e.ref][0]), null)
    if (target) go(href(game.id, target.section, target.anchor), target.anchor)
  }

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const n = options.length
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault()
      if (n) setActive(a => (a + 1) % n)
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault()
      if (n) setActive(a => (a - 1 + n) % n)
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      choose(options[active], e.shiftKey)
    }
  }

  // Esc closes; Tab cycles inside the dialog
  const onDialogKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusables = [...dialogRef.current.querySelectorAll<HTMLElement>('input, button:not([tabindex="-1"]), a[href]')]
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const activeOpt = options[active]
  const activeIsSpecies = !!activeOpt && 'hit' in activeOpt && activeOpt.hit.entry.kind === 'species'
  let optIndex = -1

  const option = (opt: Option, body: ReactNode, extra?: ReactNode) => {
    const i = ++optIndex
    return (
      <div key={opt.id} id={opt.id} role="option" aria-selected={i === active}
        className={`pal-opt${i === active ? ' active' : ''}`}
        onMouseMove={() => i !== active && setActive(i)} onClick={() => choose(opt)}>
        <span className="pal-row">{body}</span>
        {extra}
      </div>
    )
  }

  const tips = (
    <div className="pal-tips">
      <p>Search trainers, Pokemon, items, moves and places across the whole guide.</p>
      <div className="pal-examples">
        {EXAMPLES.map(x => <button type="button" key={x} className="tag" onClick={() => { setQuery(x); inputRef.current?.focus() }}>{x}</button>)}
      </div>
      <p className="pal-keys"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open{OPEN_IN_POKEDEX && <> · <kbd>Shift</kbd>+<kbd>Enter</kbd> Pokemon in Pokedex</>} · <kbd>Esc</kbd> close</p>
    </div>
  )

  let body: ReactNode
  if (error) body = <p className="pal-state">Search is unavailable: {error}. Run scripts/sync-data.sh to build search.json.</p>
  else if (!idx) body = <p className="pal-state">Loading the search index&hellip;</p>
  else if (!query.trim()) {
    body = (
      <>
        {recent.length > 0 && (
          <div role="listbox" id="pal-list" aria-label="Recent searches">
            <div role="group" aria-labelledby="pal-g-recent">
              <div className="pal-group" id="pal-g-recent">Recent searches
                <button type="button" className="pal-clear" onClick={() => { setRecent([]); writeRecent(game.id, []) }}>Clear</button>
              </div>
              {options.map(opt => option(opt, <span className="pal-title">{'recent' in opt ? opt.recent : ''}</span>))}
            </div>
          </div>
        )}
        {tips}
      </>
    )
  } else if (!groups.length) {
    body = <><p className="pal-state">No matches for &ldquo;{query.trim()}&rdquo;.</p>{tips}</>
  } else {
    body = (
      <div role="listbox" id="pal-list" aria-label="Search results" data-search-ms={searchMs.current.toFixed(2)}>
        {groups.map(g => (
          <div role="group" key={g.kind} aria-labelledby={`pal-g-${g.kind}`}>
            <div className="pal-group" id={`pal-g-${g.kind}`}>
              {KIND_LABEL[g.kind]}{g.total > g.hits.length && <span>{g.hits.length} of {g.total}</span>}
            </div>
            {g.hits.map(hit => option(
              { id: `pal-${entryKey(hit.entry)}`, hit },
              <Row e={hit.entry} idx={idx} />,
              hit.entry.kind === 'species' && OPEN_IN_POKEDEX && (
                <button type="button" tabIndex={-1} className="pal-dex" aria-label="Open in Pokedex"
                  onClick={ev => { ev.stopPropagation(); choose({ id: '', hit }, true) }}>Dex</button>
              )
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <button type="button" className="pal-fab" onClick={openPalette} aria-label="Search the guide"><SearchIcon /></button>
      {open && (
        <div className="pal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
          <div className="pal" role="dialog" aria-modal="true" aria-label="Search the guide" ref={dialogRef} onKeyDown={onDialogKey}>
            <div className="pal-head">
              <SearchIcon />
              <input ref={inputRef} type="text" role="combobox" aria-expanded={options.length > 0} aria-controls="pal-list"
                aria-autocomplete="list" aria-activedescendant={activeOpt?.id}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go"
                placeholder="Trainers, Pokemon, items, moves, places" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onInputKey} />
              <button type="button" className="pal-esc" onClick={close} aria-label="Close search">Esc</button>
            </div>
            <div className="pal-body">{body}</div>
            {options.length > 0 && query.trim() && (
              <div className="pal-foot">
                <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
                <span><kbd>Enter</kbd> {activeIsSpecies ? 'guide' : 'open'}</span>
                {activeIsSpecies && <span><kbd>Shift</kbd>+<kbd>Enter</kbd> Pokedex</span>}
                <span><kbd>Esc</kbd> close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
