import { useEffect, useState } from 'react'
import { createBackup } from './backup'

// Every 30 minutes (and shortly after load) send all saved progress to the local server's /__backup
// endpoint (backupPlugin.ts), which writes it to backups/ at the repo root. On a static host the
// endpoint is missing, so after the first failure auto-backup turns itself off.
export const INTERVAL_MS = 30 * 60 * 1000
const FIRST_MS = 10 * 1000

export type AutoBackupStatus =
  | { state: 'idle' }
  | { state: 'ok'; at: Date; file: string | null; saved: boolean }
  | { state: 'off' }

let status: AutoBackupStatus = { state: 'idle' }
const listeners = new Set<(s: AutoBackupStatus) => void>()
const set = (s: AutoBackupStatus) => { status = s; listeners.forEach(l => l(s)) }

export const runAutoBackup = async () => {
  try {
    const res = await fetch('/__backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createBackup(localStorage)) })
    // The SPA fallback answers unknown paths with index.html, so require JSON
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error(`HTTP ${res.status}`)
    const { saved, file } = await res.json() as { saved: boolean; file: string | null }
    set({ state: 'ok', at: new Date(), file, saved })
  } catch { set({ state: 'off' }) }
}

let started = false
export const startAutoBackup = () => {
  if (started) return
  started = true
  setTimeout(async () => {
    await runAutoBackup()
    if (status.state === 'off') return
    const id = setInterval(async () => {
      await runAutoBackup()
      if (status.state === 'off') clearInterval(id)
    }, INTERVAL_MS)
  }, FIRST_MS)
}

export const useAutoBackup = () => {
  const [s, setS] = useState(status)
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS) } }, [])
  return s
}
