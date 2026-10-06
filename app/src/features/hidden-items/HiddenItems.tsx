import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dex } from '../../data/types'
import { useDex, useGame } from '../../components/common'
import { hiddenEntryId, type HiddenItemsBlock } from './group'
import { useHiddenChecked } from './useHiddenChecked'
import './hidden-items.css'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const byName = new WeakMap<Dex, Map<string, string>>()
const describe = (dex: Dex, name: string) => {
  if (!byName.has(dex)) byName.set(dex, new Map(Object.values(dex.items).map(i => [norm(i.name), i.desc])))
  return byName.get(dex)?.get(norm(name))
}

const R = 15
const C = 2 * Math.PI * R

const Ring = ({ got, total }: { got: number; total: number }) => (
  <svg className="hi-ring" viewBox="0 0 36 36" aria-hidden="true">
    <circle cx="18" cy="18" r={R} className="hi-ring-bg" />
    <circle cx="18" cy="18" r={R} className="hi-ring-fg" strokeDasharray={`${(got / total) * C} ${C}`} transform="rotate(-90 18 18)" />
  </svg>
)

const Lightbox = ({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) => {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog ref={ref} className="hi-lightbox" onClose={onClose} onClick={onClose}>
      <img src={url} alt={alt} />
      <button type="button" className="hi-close" aria-label="Close map" onClick={onClose}>&times;</button>
    </dialog>
  )
}

// collapsed: "Hide defeated" is on, so a fully collected card shrinks to its header row
export const HiddenItems = ({ b, collapsed }: { b: HiddenItemsBlock; collapsed?: boolean }) => {
  const game = useGame()
  const dex = useDex()
  const { done, toggle } = useHiddenChecked(game.id)
  const [zoom, setZoom] = useState(false)
  const url = game.imageBase + b.src
  const ids = useMemo(() => b.entries.map(e => hiddenEntryId(b, e)), [b])
  const got = ids.filter(id => done[id]).length
  const complete = got === b.entries.length

  return (
    <section className={`hi-card${complete ? ' complete' : ''}${complete && collapsed ? ' is-collapsed' : ''}`} aria-label="Hidden items">
      <header className="hi-head">
        <Ring got={got} total={b.entries.length} />
        <h3>Hidden items</h3>
        <span className="hi-count mono" aria-live="polite">{got} / {b.entries.length}</span>
        {complete && <span className="all-caught">All collected</span>}
      </header>
      <div className="hi-body">
        <button type="button" className="hi-map" onClick={() => setZoom(true)} aria-label={`Zoom map ${b.file}`}>
          <img src={url} alt={`Hidden items map ${b.file}`} loading="lazy" />
          <span className="hi-zoom">Zoom</span>
        </button>
        <ul className="hi-legend">
          {b.entries.map((e, i) => {
            const checked = !!done[ids[i]]
            return (
              <li key={e.letter} className={checked ? 'checked' : ''}>
                <label>
                  <input type="checkbox" checked={checked} onChange={() => toggle(ids[i])} />
                  <span className="hi-key" aria-hidden="true">{e.letter}</span>
                  <span className="hi-text">
                    <span className="hi-name" title={describe(dex, e.name)}>
                      <span className="sr-only">{`Marker ${e.letter}: `}</span>{e.name}
                    </span>
                    {e.notHidden && <span className="hi-tag">not hidden</span>}
                    {e.note && !e.notHidden && <span className="hi-note">{e.note}</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
      {zoom && <Lightbox url={url} alt={`Hidden items map ${b.file}`} onClose={() => setZoom(false)} />}
    </section>
  )
}
