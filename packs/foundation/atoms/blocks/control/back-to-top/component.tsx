import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import { messageOf, useAppMessages } from '@pwfabric/runtime'
import type { BlockComponent } from '../../../lib/component-types.js'

export interface BackToTopProps {
  /** The button's word. Unset: the app's ui.backToTop. */
  readonly label?: string
  /** Shown once the page has scrolled this many px (default 400). */
  readonly showAfter?: number
}

export const backToTopDefinition: BlockDefinition = {
  type: 'back-to-top',
  name: 'Back to top',
  category: 'control',
  icon: '↑',
  defaultProps: { showAfter: 400 },
  defaultLayout: { span: { xs: 2, sm: 2, md: 2, lg: 2 } },
  canHaveChildren: false,
}

/** Whether the button shows at `scrollY` for a threshold (a missing or odd threshold is 400). */
export function backToTopShown(scrollY: number, showAfter: unknown): boolean {
  const at = typeof showAfter === 'number' && Number.isFinite(showAfter) && showAfter >= 0 ? showAfter : 400
  return scrollY > at
}

const CSS =
  '[data-pw-back-to-top] { transition: opacity var(--pw-duration-fast, 150ms); }' +
  '[data-pw-back-to-top]:hover { color: var(--pw-back-to-top-hover-ink, var(--pw-color-text)); }' +
  '[data-pw-back-to-top]:focus-visible { outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color, var(--pw-color-primary, #18181b)); outline-offset: 2px; border-radius: 2px; }' +
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-back-to-top] { min-height: 44px; } }' +
  '@media (prefers-reduced-motion: reduce) { [data-pw-back-to-top] { transition: none; } }'

/**
 * "Back to top": a button that appears once the page has scrolled past
 * showAfter px and takes the visitor to the top. Hidden (and out of the tab
 * order) until then, so it never sits on a page that has nowhere to return
 * from; the first frame draws it hidden.
 */
export const BackToTopBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as BackToTopProps
  const appWords = useAppMessages()
  const label = (typeof p.label === 'string' && p.label) || messageOf(appWords, 'ui.backToTop', '')
  const inert = context?.interactionMode === 'inert'
  const [shown, setShown] = React.useState(false)

  React.useEffect(() => {
    if (inert || typeof window === 'undefined') return
    const update = (): void => setShown(backToTopShown(window.scrollY, p.showAfter))
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [inert, p.showAfter])

  const toTop = (): void => {
    if (inert || typeof window === 'undefined') return
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      id={block.id}
      data-block-id={block.id}
      data-block-type="back-to-top"
      data-pw-back-to-top=""
      onClick={toTop}
      aria-hidden={shown ? undefined : true}
      tabIndex={shown ? undefined : -1}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 'var(--pw-font-size-xs)',
        fontWeight: 500,
        lineHeight: '16px',
        color: 'var(--pw-back-to-top-ink, var(--pw-color-text-muted))',
        opacity: shown ? 1 : 0,
        pointerEvents: shown ? undefined : 'none',
        ...block.style,
      }}
    >
      <style>{CSS}</style>
      {label}
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  )
}

Object.assign(BackToTopBlock, { sizing: 'intrinsic' })
