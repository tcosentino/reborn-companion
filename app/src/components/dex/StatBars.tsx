import './StatBars.css'
import { getStatBand, statToPercent } from './statBarsHelpers'

const STAT_LABELS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe']

/**
 * Displays Pokémon base stats as bars.
 *
 * API: `<StatBars stats={[hp, atk, def, spa, spd, spe]} variant?: 'compact' | 'full' />`
 *
 * - 'full': Six rows of label | number (tabular mono) | bar, plus a total BST row.
 *   Bar width = stat / 255 (capped at 100%). Colors by value band.
 *
 * - 'compact': Single strip of six thin vertical bars (~60px × 22px),
 *   heights proportional to stat / 255. Suitable for trainer rows or hover cards.
 *   Includes a title attribute with exact numbers.
 *
 * Note: This component is reused by the Pokédex page and hover cards.
 * Accessible: role="img" with aria-label.
 */
export const StatBars = ({
  stats,
  variant = 'full'
}: {
  stats: number[]
  variant?: 'compact' | 'full'
}) => {
  if (stats.length !== 6) return null

  const bst = stats.reduce((a, b) => a + b, 0)
  const label = `Stats: ${STAT_LABELS.map((label, i) => `${label} ${stats[i]}`).join(' / ')}`

  if (variant === 'compact') {
    return (
      <div className="stat-bars compact" role="img" aria-label={label} title={label}>
        {stats.map((stat, i) => {
          const percent = statToPercent(stat)
          const band = getStatBand(stat)
          return (
            <div
              key={i}
              className={`bar ${band}`}
              style={{ height: `${percent}%` }}
              title={`${STAT_LABELS[i]} ${stat}`}
            />
          )
        })}
      </div>
    )
  }

  // Full variant
  return (
    <div className="stat-bars full" role="img" aria-label={label}>
      {stats.map((stat, i) => {
        const percent = statToPercent(stat)
        const band = getStatBand(stat)
        return (
          <div key={i} className="stat-row">
            <div className="label">{STAT_LABELS[i]}</div>
            <div className="number">{stat}</div>
            <div className="bar-container">
              <div className={`bar-fill ${band}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        )
      })}
      <div className="stat-row total">
        <div className="label">BST</div>
        <div className="number">{bst}</div>
        <div className="bar-container">
          <div className="bar-fill" style={{ width: `${(bst / (255 * 6)) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
