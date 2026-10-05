import { createElement, type CSSProperties, type ReactNode } from 'react'
import type { HoverKind } from './store'

interface Props {
  kind: HoverKind
  sym: string | null | undefined
  form?: number | string | null
  as?: 'span' | 'li' | 'b'
  /** Set false when children already contain a focusable element (e.g. a link). */
  focusable?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Wraps a trigger. The behaviour (hover delay, focus, touch, Esc) lives in HoverCardHost,
 * which listens for the data attributes on the document, so a trigger costs one element.
 */
export const DexHover = ({ kind, sym, form, as = 'span', focusable = true, className, style, children }: Props) => {
  if (!sym) return <>{children}</>
  return createElement(
    as,
    {
      className: className ? `hc-trigger ${className}` : 'hc-trigger',
      style,
      'data-hc-kind': kind,
      'data-hc-sym': sym,
      'data-hc-form': form == null ? undefined : String(form),
      tabIndex: focusable ? 0 : undefined
    },
    children
  )
}
