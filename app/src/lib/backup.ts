// Progress backup: every `pokeguide:` localStorage key exported to a JSON file and restored from one.
// localStorage is per origin, so a backup is the only way progress survives a new host or port,
// a cleared browser, or a different device.
type Store = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>

export const PREFIX = 'pokeguide:'

export interface Backup {
  app: 'pokeguide'
  version: 1
  exportedAt: string
  data: Record<string, string>
}

// Checklists that only ever gain entries on restore, so restoring an old file never unticks anything
const MERGED = /^pokeguide:[^:]+:(progress|caught|hidden)$/

const keys = (store: Store) =>
  Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => !!k?.startsWith(PREFIX))

export const createBackup = (store: Store, now = new Date()): Backup => ({
  app: 'pokeguide',
  version: 1,
  exportedAt: now.toISOString(),
  data: Object.fromEntries(keys(store).map(k => [k, store.getItem(k) ?? '']))
})

export const parseBackup = (text: string): Backup => {
  const b = JSON.parse(text) as Partial<Backup>
  if (b?.app !== 'pokeguide' || b.version !== 1 || typeof b.data !== 'object' || !b.data) throw new Error('Not a PokeGuide backup file')
  const bad = Object.entries(b.data).find(([k, v]) => !k.startsWith(PREFIX) || typeof v !== 'string')
  if (bad) throw new Error(`Unexpected entry in backup: ${bad[0]}`)
  return b as Backup
}

const asSet = (json: string | null): Record<string, true> => {
  try {
    const v = JSON.parse(json ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

// Checklists are unioned with what is already saved; everything else (prefs, resume spot) takes the backup's value.
// Returns how many keys were written.
export const restoreBackup = (store: Store, backup: Backup): number => {
  const entries = Object.entries(backup.data)
  entries.forEach(([k, v]) => {
    store.setItem(k, MERGED.test(k) ? JSON.stringify({ ...asSet(store.getItem(k)), ...asSet(v) }) : v)
  })
  return entries.length
}

// Total ticked battles, catches and hidden items in a backup
export const countTicks = (backup: Backup) =>
  Object.entries(backup.data).filter(([k]) => MERGED.test(k)).reduce((n, [, v]) => n + Object.keys(asSet(v)).length, 0)

export const backupFilename = (now = new Date()) => `pokeguide-progress-${now.toISOString().slice(0, 10)}.json`
