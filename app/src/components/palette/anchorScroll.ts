import { useEffect } from 'react'
import './anchor.css'

const FLASH = 'palette-flash'

// Scroll a block into view and pulse a highlight around it. Returns false if it is not rendered yet.
export const flashAnchor = (id: string): boolean => {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ block: 'start' })
  el.classList.remove(FLASH)
  void el.offsetWidth // restart the animation when re-flashing the same block
  el.classList.add(FLASH)
  setTimeout(() => el.classList.remove(FLASH), 1800)
  // Content above may still shift (fonts, images); settle once more if it moved
  const top = el.getBoundingClientRect().top
  setTimeout(() => {
    if (Math.abs(el.getBoundingClientRect().top - top) > 40) el.scrollIntoView({ block: 'start' })
  }, 350)
  return true
}

// After navigating to #/<game>/<section>/<anchor>, wait for the section to render, then jump to the block
export const useAnchorScroll = (anchor: string | null | undefined, sectionKey: string | undefined) => {
  useEffect(() => {
    if (!anchor) return
    let frame = 0
    let tries = 0
    const tick = () => {
      if (flashAnchor(anchor) || ++tries > 180) return
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [anchor, sectionKey])
}
