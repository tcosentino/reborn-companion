/**
 * Pure helpers for stat bar classification and percentage clamping.
 * Used by StatBars component and its tests.
 */

/**
 * Classify a stat value into a color band based on threshold ranges.
 * Bands: <50 red, 50-79 orange, 80-99 yellow, 100-119 green, 120+ teal
 */
export const getStatBand = (stat: number): 'red' | 'orange' | 'yellow' | 'green' | 'teal' => {
  if (stat < 50) return 'red'
  if (stat < 80) return 'orange'
  if (stat < 100) return 'yellow'
  if (stat < 120) return 'green'
  return 'teal'
}

/**
 * Convert a stat value (0-255) to a percentage (0-100), capped at 100%.
 */
export const statToPercent = (stat: number): number => {
  return Math.min(100, (stat / 255) * 100)
}
