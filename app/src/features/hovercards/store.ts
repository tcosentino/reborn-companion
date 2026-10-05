export type HoverKind = 'species' | 'move' | 'item' | 'ability'
export type OpenVia = 'hover' | 'focus' | 'touch'

export interface HoverTarget {
  el: HTMLElement
  kind: HoverKind
  sym: string
  form: string | null
  via: OpenVia
}

type Listener = () => void

// One shared card: a tiny module-level store so every trigger (React or prose DOM) drives it.
let current: HoverTarget | null = null
const listeners = new Set<Listener>()
let openTimer: number | undefined
let closeTimer: number | undefined

const emit = () => listeners.forEach(l => l())

export const subscribe = (l: Listener) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
export const getTarget = () => current

export const cancelOpen = () => { window.clearTimeout(openTimer); openTimer = undefined }
export const cancelClose = () => { window.clearTimeout(closeTimer); closeTimer = undefined }

export const openNow = (t: HoverTarget) => {
  cancelOpen()
  cancelClose()
  if (current && current.el === t.el && current.via === t.via) return
  current = t
  emit()
}

export const scheduleOpen = (t: HoverTarget, delay: number) => {
  cancelClose()
  cancelOpen()
  openTimer = window.setTimeout(() => openNow(t), delay)
}

export const closeNow = () => {
  cancelOpen()
  cancelClose()
  if (!current) return
  current = null
  emit()
}

export const scheduleClose = (delay = 140) => {
  cancelClose()
  if (!current) return
  closeTimer = window.setTimeout(closeNow, delay)
}

export const readTarget = (el: Element | null, via: OpenVia): HoverTarget | null => {
  const t = el?.closest<HTMLElement>('[data-hc-kind]')
  if (!t) return null
  const { hcKind, hcSym, hcForm } = t.dataset
  if (!hcKind || !hcSym) return null
  return { el: t, kind: hcKind as HoverKind, sym: hcSym, form: hcForm ?? null, via }
}
