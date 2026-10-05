import { useRef, useState } from 'react'
import { backupFilename, countTicks, createBackup, parseBackup, restoreBackup } from '../../lib/backup'
import { useAutoBackup } from '../../lib/autoBackup'

// Sidebar footer: download all saved progress as JSON, or merge a downloaded file back in
export const BackupControls = () => {
  const input = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const auto = useAutoBackup()

  const download = () => {
    try {
      const blob = new Blob([JSON.stringify(createBackup(localStorage), null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = backupFilename()
      a.click()
      URL.revokeObjectURL(a.href)
      setMsg('Backup downloaded')
    } catch (e) { setMsg(`Backup failed: ${(e as Error).message}`) }
  }

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      if (!confirm(`Restore ${countTicks(backup)} ticks from ${backup.exportedAt.slice(0, 10) || 'this file'}? Existing ticks are kept.`)) return
      restoreBackup(localStorage, backup)
      // Every checklist hook re-reads storage on mount
      location.reload()
    } catch (e) { setMsg(`Restore failed: ${(e as Error).message}`) }
  }

  return (
    <div className="backup">
      <span className="eyebrow">Progress is saved in this browser</span>
      <div className="backup-row">
        <button type="button" onClick={download}>Back up</button>
        <button type="button" onClick={() => input.current?.click()}>Restore</button>
      </div>
      <input ref={input} type="file" accept="application/json,.json" hidden
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restore(f) }} />
      {msg && <small role="status">{msg}</small>}
      {auto.state === 'ok' && auto.file && (
        <small title={`backups/${auto.file}`}>Auto-backup every 30 min · last checked {auto.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
      )}
    </div>
  )
}
