import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { startAutoBackup } from './lib/autoBackup'

// Ask the browser not to evict saved progress under storage pressure (best effort, silently ignored if refused)
navigator.storage?.persist?.().catch(() => {})
startAutoBackup()

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
