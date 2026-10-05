import { useChecklist } from '../../lib/progress'

// Hidden-item checkboxes, stored under pokeguide:<game>:hidden
export const useHiddenChecked = (game: string) => useChecklist(game, 'hidden')
