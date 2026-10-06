import { useEffect, useRef, useState } from 'react'
import type { RouteBlock } from '../../lib/routes'
import { MARK_R, markOffset, pathRuns, routeAnchor } from '../../lib/routes'
import './route-map.css'

const TILE = 32
const center = (v: number) => v * TILE + TILE / 2

// The map crop with the walking path and numbered stops drawn as SVG on top, so it stays sharp at any size
const RouteCanvas = ({ b, onError }: { b: RouteBlock; onError?: () => void }) => {
  const tileRuns = pathRuns(b.path)
  const runs = tileRuns.map(run => run.map(([x, y]) => `${center(x)},${center(y)}`).join(' '))
  // Where the line breaks the player goes through a door or stairs: mark both ends
  const warpEnds = tileRuns.flatMap((run, i) => [...(i > 0 ? [run[0]] : []), ...(i < tileRuns.length - 1 ? [run[run.length - 1]] : [])])
  const end = b.path[b.path.length - 1]
  // Markers are drawn in map pixels; grow them on wide crops so they stay legible when the card scales the map down
  const k = Math.max(1, (b.w * TILE) / 900)
  return (
    <div className="rm-canvas" style={{ aspectRatio: `${b.w} / ${b.h}` }}>
      <img src={`${import.meta.env.BASE_URL}${b.src}`} alt={`${b.mapName} map`} loading="lazy" width={b.w * TILE} height={b.h * TILE} onError={onError} />
      <svg viewBox={`0 0 ${b.w * TILE} ${b.h * TILE}`} aria-hidden="true">
        {runs.map((points, i) => <polyline key={`c${i}`} className="rm-casing" points={points} />)}
        {runs.map((points, i) => <polyline key={`l${i}`} className="rm-line" points={points} />)}
        {runs.map((points, i) => <polyline key={`f${i}`} className="rm-flow" points={points} />)}
        {warpEnds.map(([x, y], i) => <rect key={`w${i}`} className="rm-warp" x={center(x) - 7 * k} y={center(y) - 7 * k} width={14 * k} height={14 * k} rx={3 * k} />)}
        {end && <circle className="rm-end" cx={center(end[0])} cy={center(end[1])} r={6 * k} />}
        {b.marks.map(m => {
          const [ox, oy] = markOffset(m.face, k)
          return <g key={m.n} className="rm-mark" transform={`translate(${center(m.x) + ox} ${center(m.y) + oy}) scale(${k})`}>
            <circle r={MARK_R} />
            <text dy="0.36em">{m.n}</text>
          </g>
        })}
      </svg>
    </div>
  )
}

// Route map block (lib/routes.ts): where to walk for the paragraph above, on the game's own map.
// Hidden when its render is missing, e.g. a host built without the game files.
export const RouteMap = ({ b }: { b: RouteBlock }) => {
  const [broken, setBroken] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(!b.spoiler)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // Start the enlarged view on the first stop rather than the crop's corner
      const scroller = d.querySelector('.rm-dialog-scroll')
      const first = b.marks[0] ?? { x: b.path[0]?.[0] ?? 0, y: b.path[0]?.[1] ?? 0 }
      scroller?.scrollTo(center(first.x) - scroller.clientWidth / 2, center(first.y) - scroller.clientHeight / 2)
    }
    if (!open && d.open) d.close()
  }, [open, b])
  if (broken) return null
  return (
    <figure className="route-map" id={routeAnchor(b.id)}>
      <figcaption className="rm-head">
        <span className="eyebrow">Route · {b.mapName}</span>
        {b.title && <h3>{b.title}</h3>}
      </figcaption>
      {revealed ? (
        <button type="button" className="rm-open" onClick={() => setOpen(true)} aria-label={`Enlarge map: ${b.title ?? b.mapName}`}>
          <RouteCanvas b={b} onError={() => setBroken(true)} />
        </button>
      ) : (
        <button type="button" className="rm-spoiler" onClick={() => setRevealed(true)}>Show solution</button>
      )}
      {revealed && <ol className="rm-legend">
        {b.marks.map(m => <li key={m.n}><span className="rm-num">{m.n}</span>{m.label}</li>)}
      </ol>}
      <dialog ref={dialog} className="rm-dialog" onClose={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
        <div className="rm-dialog-bar">
          <span>{b.title ?? b.mapName}</span>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
        {open && (
          <div className="rm-dialog-scroll">
            <div style={{ width: b.w * TILE }}><RouteCanvas b={b} /></div>
          </div>
        )}
      </dialog>
    </figure>
  )
}
