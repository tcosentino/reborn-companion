import { useEffect, useRef, useState } from 'react'
import { flashAnchor } from '../../components/palette/anchorScroll'
import type { PageItem, PageKind } from '../../lib/guideNav'
import './guide-nav.css'

const KIND_LABEL: Record<PageKind, string> = { battle: 'VS', encounters: 'Wild', shop: 'Shop', tutor: 'Tutor' }

// Sticky "On this page" dropdown: jump to any battle, encounter table, shop or tutor in the section
export const OnThisPage = ({ items, current }: { items: PageItem[]; current: string | null }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('pointerdown', onDown)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('pointerdown', onDown)
      removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length < 2) return null
  const here = items.find(i => i.id === current)
  const battles = items.filter(i => i.beaten !== undefined)

  return (
    <div className="otp" ref={ref}>
      <button type="button" className="otp-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="otp-list">
        <span className="eyebrow">On this page</span>
        <span className="otp-here">{here?.label ?? `${items.length} blocks`}</span>
        {battles.length > 0 && <span className="otp-count mono">{battles.filter(b => b.beaten).length}/{battles.length}</span>}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <ol className="otp-list" id="otp-list">
          {items.map(i => (
            <li key={i.id}>
              <a href={`#${i.id}`} aria-current={i.id === current ? 'location' : undefined}
                className={i.beaten ? 'is-beaten' : undefined}
                onClick={e => { e.preventDefault(); setOpen(false); flashAnchor(i.id) }}>
                <span className={`otp-kind k-${i.kind}`}>{KIND_LABEL[i.kind]}</span>
                <span className="otp-label">{i.label}</span>
                {i.beaten !== undefined && <span className="otp-tick" aria-label={i.beaten ? 'Beaten' : 'Not beaten'}>{i.beaten ? '✓' : ''}</span>}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
