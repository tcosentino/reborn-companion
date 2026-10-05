import type { ReactNode } from 'react'
import { openPalette } from '../../components/palette/CommandPalette'
import { href } from '../../lib/route'
import './guide-nav.css'

interface Link { id: string; title: string }

interface Props {
  game: string
  menuOpen: boolean
  onContents: () => void
  prev?: Link | null
  next?: Link | null
  // Center slot: "Next unbeaten" jump or "Mark beaten" on guide sections
  action?: ReactNode
}

const Arrow = ({ flip }: { flip?: boolean }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// One-handed navigation on phone widths; hidden on desktop by CSS, where the sidebar is always visible
export const BottomBar = ({ game, menuOpen, onContents, prev, next, action }: Props) => (
  <nav className="bottom-bar" aria-label="Quick navigation">
    <button type="button" className="bb-btn" onClick={onContents} aria-expanded={menuOpen}>
      {menuOpen ? 'Close' : 'Contents'}
    </button>
    {prev
      ? <a className="bb-btn bb-icon" href={href(game, prev.id)} aria-label={`Previous section: ${prev.title}`}><Arrow /></a>
      : <span className="bb-btn bb-icon" aria-hidden="true" />}
    <div className="bb-action">{action}</div>
    {next
      ? <a className="bb-btn bb-icon" href={href(game, next.id)} aria-label={`Next section: ${next.title}`}><Arrow flip /></a>
      : <span className="bb-btn bb-icon" aria-hidden="true" />}
    <button type="button" className="bb-btn" onClick={() => { if (menuOpen) onContents(); openPalette() }} aria-label="Search the guide">Search</button>
  </nav>
)
