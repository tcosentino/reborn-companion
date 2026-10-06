import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Tile } from '../../lib/routes'
import { MARK_R, markOffset, pathRuns } from '../../lib/routes'
import './route-map.css'

const TILE = 32
const center = (v: number) => v * TILE + TILE / 2

// A marker on the map and its legend row. With `onToggle` the row is a checkbox and a `done` marker turns green.
export interface MapMark {
  key: string
  // Tile in the crop; a mark without one is a legend row only (an item the map cannot place)
  x?: number
  y?: number
  label: ReactNode
  // Extra legend text under the label (notes, tags)
  detail?: ReactNode
  // Tooltip on the label
  hint?: string
  // The stop is in front of a person, in this direction: the marker is drawn clear of their sprite
  face?: Tile
  done?: boolean
  onToggle?: () => void
}

// A game map crop, relative to the app's BASE_URL, in 32 px tiles. `path` is drawn as a walking line.
export interface MapImage { src: string; w: number; h: number; mapName: string; path?: Tile[] }

// The map crop with the optional walking path and the markers drawn as SVG on top, so it stays sharp at any size
const MapCanvas = ({ m, marks, onError }: { m: MapImage; marks: MapMark[]; onError?: () => void }) => {
  const path = m.path ?? []
  const tileRuns = pathRuns(path)
  const runs = tileRuns.map(run => run.map(([x, y]) => `${center(x)},${center(y)}`).join(' '))
  // Where the line breaks the player goes through a door or stairs: mark both ends
  const warpEnds = tileRuns.flatMap((run, i) => [...(i > 0 ? [run[0]] : []), ...(i < tileRuns.length - 1 ? [run[run.length - 1]] : [])])
  const end = path[path.length - 1]
  // Markers are drawn in map pixels; grow them on wide crops so they stay legible when the card scales the map down
  const k = Math.max(1, (m.w * TILE) / 900)
  return (
    <div className="rm-canvas" style={{ aspectRatio: `${m.w} / ${m.h}` }}>
      <img src={`${import.meta.env.BASE_URL}${m.src}`} alt={`${m.mapName} map`} loading="lazy" width={m.w * TILE} height={m.h * TILE} onError={onError} />
      <svg viewBox={`0 0 ${m.w * TILE} ${m.h * TILE}`} aria-hidden="true">
        {runs.map((points, i) => <polyline key={`c${i}`} className="rm-casing" points={points} />)}
        {runs.map((points, i) => <polyline key={`l${i}`} className="rm-line" points={points} />)}
        {runs.map((points, i) => <polyline key={`f${i}`} className="rm-flow" points={points} />)}
        {warpEnds.map(([x, y], i) => <rect key={`w${i}`} className="rm-warp" x={center(x) - 7 * k} y={center(y) - 7 * k} width={14 * k} height={14 * k} rx={3 * k} />)}
        {end && <circle className="rm-end" cx={center(end[0])} cy={center(end[1])} r={6 * k} />}
        {marks.flatMap(mk => {
          if (mk.x === undefined || mk.y === undefined) return []
          const [ox, oy] = markOffset(mk.face, k)
          return <g key={mk.key} className={`rm-mark${mk.done ? ' done' : ''}`} transform={`translate(${center(mk.x) + ox} ${center(mk.y) + oy}) scale(${k})`}>
            <circle r={MARK_R} />
            <text dy="0.36em">{mk.key}</text>
          </g>
        })}
      </svg>
    </div>
  )
}

const Legend = ({ marks }: { marks: MapMark[] }) => {
  if (!marks.some(m => m.onToggle)) {
    return <ol className="rm-legend">{marks.map(m => <li key={m.key}><span className="rm-num">{m.key}</span>{m.label}</li>)}</ol>
  }
  return (
    <ul className="rm-checklist">
      {marks.map(m => (
        <li key={m.key} className={m.done ? 'done' : ''}>
          <label>
            <span className="rm-num" aria-hidden="true">{m.key}</span>
            <span className="rm-text">
              <span className="rm-label" title={m.hint}><span className="sr-only">{`Marker ${m.key}: `}</span>{m.label}</span>
              {m.detail}
            </span>
            {m.onToggle && <input type="checkbox" checked={!!m.done} onChange={m.onToggle} />}
          </label>
        </li>
      ))}
    </ul>
  )
}

export interface MapCardProps {
  // Page anchor
  id?: string
  eyebrow: ReactNode
  title?: ReactNode
  // Right side of the header (progress ring, counts)
  aside?: ReactNode
  map: MapImage
  marks: MapMark[]
  className?: string
  // Shrink to the header row (e.g. "Hide defeated" on a finished checklist)
  collapsed?: boolean
  // A puzzle solution: the map stays covered until the reader asks to see it
  spoiler?: boolean
  // Shown instead when the render is missing (a host built without the game files); nothing by default
  fallback?: ReactNode
}

// Game map card shared by route maps and hidden-item maps: header, map with markers (click to enlarge), legend.
export const MapCard = ({ id, eyebrow, title, aside, map, marks, className, collapsed, spoiler, fallback = null }: MapCardProps) => {
  const [broken, setBroken] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(!spoiler)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // Start the enlarged view on the first marker rather than the crop's corner
      const scroller = d.querySelector('.rm-dialog-scroll')
      const first = marks.find(m => m.x !== undefined)
      const [fx, fy] = first ? [first.x ?? 0, first.y ?? 0] : map.path?.[0] ?? [0, 0]
      scroller?.scrollTo(center(fx) - scroller.clientWidth / 2, center(fy) - scroller.clientHeight / 2)
    }
    if (!open && d.open) d.close()
  }, [open, map, marks])
  if (broken) return <>{fallback}</>
  const name = typeof title === 'string' ? title : map.mapName
  return (
    <figure className={`route-map${className ? ` ${className}` : ''}${collapsed ? ' is-collapsed' : ''}`} id={id}>
      <figcaption className="rm-head">
        <span className="rm-titles">
          <span className="eyebrow">{eyebrow}</span>
          {title && <h3>{title}</h3>}
        </span>
        {aside}
      </figcaption>
      {/* The legend sits beside the map, below it on narrow screens or when there is nothing to list */}
      {!collapsed && <div className={`rm-body${revealed && marks.length ? ' rm-side' : ''}`}>
        {revealed ? (
          <button type="button" className="rm-open" onClick={() => setOpen(true)} aria-label={`Enlarge map: ${name}`}>
            <MapCanvas m={map} marks={marks} onError={() => setBroken(true)} />
          </button>
        ) : (
          <button type="button" className="rm-spoiler" onClick={() => setRevealed(true)}>Show solution</button>
        )}
        {revealed && <Legend marks={marks} />}
      </div>}
      <dialog ref={dialog} className="rm-dialog" onClose={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
        <div className="rm-dialog-bar">
          <span>{name}</span>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
        {open && (
          <div className="rm-dialog-scroll">
            <div style={{ width: map.w * TILE }}><MapCanvas m={map} marks={marks} /></div>
          </div>
        )}
      </dialog>
    </figure>
  )
}
