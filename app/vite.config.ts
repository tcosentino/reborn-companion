import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { backupPlugin } from './backupPlugin'

export default defineConfig({
  // Auto-backups of saved progress land in backups/ at the repo root (gitignored)
  plugins: [react(), backupPlugin(fileURLToPath(new URL('../backups', import.meta.url)))],
  // Progress lives in localStorage, which is per origin: never drift to another port (dev and preview share
  // one origin so both see the same progress). Game manifests live in /games at the repo root, shared with
  // the build scripts (paths resolve against app/); /usage holds the token ledger shown at #/usage.
  server: { port: 5174, strictPort: true, fs: { allow: ['.', '../games', '../usage'] } },
  preview: { port: 5174, strictPort: true }
})
