import type { RouteBlock } from '../../lib/routes'
import { routeAnchor } from '../../lib/routes'
import { MapCard } from './MapCard'

// Route map block (lib/routes.ts): where to walk for the paragraph above, on the game's own map.
// Hidden when its render is missing, e.g. a host built without the game files.
export const RouteMap = ({ b }: { b: RouteBlock }) => (
  <MapCard
    id={routeAnchor(b.id)}
    eyebrow={`Route · ${b.mapName}`}
    title={b.title}
    spoiler={b.spoiler}
    map={{ src: b.src, w: b.w, h: b.h, mapName: b.mapName, path: b.path }}
    marks={b.marks.map(m => ({ key: String(m.n), x: m.x, y: m.y, label: m.label, face: m.face }))}
  />
)
