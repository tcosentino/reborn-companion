import { useEffect, useState } from 'react'
import { anchorAt } from '../../lib/guideNav'

export interface InView {
  // Block being read: the last anchor whose top is above the reading line (kept after scrolling past it)
  current: string | null
  // `current`, but only while some of it is still on screen
  visible: string | null
}

// Tracks which anchored block is being read. Measured at most once per frame on scroll and resize,
// and again whenever `layoutKey` changes (cards collapsing moves blocks without a scroll event).
export const useAnchorInView = (ids: string[], layoutKey = ''): InView => {
  const [state, setState] = useState<InView>({ current: null, visible: null })
  const key = ids.join('|')

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const rects = ids.flatMap(id => {
        const el = document.getElementById(id)
        return el ? [[id, el.getBoundingClientRect()] as const] : []
      })
      const current = anchorAt(rects.map(([id, r]) => [id, r.top]), innerHeight * 0.35)
      const rect = rects.find(([id]) => id === current)?.[1]
      const visible = rect && rect.bottom > 80 ? current : null
      setState(s => s.current === current && s.visible === visible ? s : { current, visible })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    schedule()
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('scroll', schedule)
      removeEventListener('resize', schedule)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, layoutKey])

  return state
}
