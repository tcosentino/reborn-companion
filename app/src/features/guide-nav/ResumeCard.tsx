import { mySpot, nextUnbeaten } from '../../lib/guideNav'
import type { BattleRef } from '../../lib/sectionBattles'
import { useProgress, type Spot } from '../../lib/progress'
import { href } from '../../lib/route'
import './guide-nav.css'

interface Props {
  game: string
  spot: Spot
  // Section ids in guide order and their titles
  order: string[]
  titles: Record<string, string>
  battles?: Record<string, BattleRef[]>
}

// Shown on the game root (#/<game>) when there is a saved spot to go back to
export const ResumeCard = ({ game, spot, order, titles, battles }: Props) => {
  const { done } = useProgress(game)
  const title = titles[spot.section]
  if (!title) return null
  const next = battles && nextUnbeaten(battles[spot.section], done)
  const furthest = battles && mySpot(order, battles, done)
  const showFurthest = furthest && furthest.section !== spot.section
  return (
    <aside className="resume" aria-label="Resume">
      <span className="eyebrow">Pick up where you left off</span>
      <a className="resume-main" href={href(game, spot.section, spot.anchor)}>Continue: {title}</a>
      {next && <a className="resume-sub" href={href(game, spot.section, `battle-${next[0]}`)}>Next unbeaten: {next[1]}</a>}
      {showFurthest && (
        <a className="resume-sub" href={href(game, furthest.section, furthest.anchor)}>
          Furthest progress: {titles[furthest.section]}{furthest.label ? ` · ${furthest.label}` : ''}
        </a>
      )}
    </aside>
  )
}
