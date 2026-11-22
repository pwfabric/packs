import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { MOTION, cssUnit, safeHref, transitionOf } from '../../../lib/_shared-utils.js'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

/**
 * A linked card is one link (the stretched-link pattern): a cover anchor fills
 * the card, so a click anywhere opens it and the keyboard stops on it once.
 * A control placed inside the card (a button, its own link) is lifted above
 * the cover and still works on its own.
 */
const CARD_LINK_CSS =
  '[data-pw-card-link] :is(a, button, input, select, textarea, summary, [tabindex]):not([data-pw-card-cover]) { position: relative; z-index: 1; }' +
  '[data-pw-card-cover]:focus-visible { outline: 2px solid var(--pw-color-focus, var(--pw-color-primary)); outline-offset: 2px; }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface CardProps {
  readonly padding: number
  readonly gap: number
  readonly backgroundColor?: string
  readonly borderRadius?: number | string
  /** 0–10 px. */
  readonly borderWidth: number
  readonly borderColor?: string
  /**
   * 'theme' = the theme's --pw-shadow-card decision (baseline: a whisper
   * shadow; a theme that wants tonal layering sets --pw-shadow-card: none —
   * the veto belongs to the theme, not the block).
   */
  readonly shadow: 'none' | 'theme' | 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Frosted-glass effect (backdrop-blur). The translucent fill is a
   * `color-mix` of the card token + transparent, so it follows a theme recolour.
   */
  readonly glass: 'none' | 'sm' | 'md' | 'lg'
  /**
   * CSS aspect-ratio for the card box ('16/9', '4/3', or a number): the card
   * grows to its ratio against its column width.
   */
  readonly aspectRatio?: number | string
  readonly align?: 'start' | 'center' | 'end' | 'stretch'
  readonly textAlign?: 'left' | 'center' | 'right'
  /** Where the whole card goes: an app path (`/menu`), a URL or `#anchor`. */
  readonly href?: string
  /**
   * The link's accessible name. Unset, the card's first heading names it (and
   * with no heading, the card's own text).
   */
  readonly hrefLabel?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const cardDefinition: BlockDefinition = {
  type: 'card',
  name: 'Card',
  category: 'container',
  icon: '▭',
  defaultProps: {
    padding: 16,
    gap: 16,
    // Depth ships as boundary (border) + the THEME's card-shadow decision —
    // tonal-layering themes set --pw-shadow-card: none (veto), a neutral baseline
    // gives a whisper of shadow.
    borderWidth: 1,
    shadow: 'theme',
  },
  defaultLayout: { span: { xs: 4, sm: 4, md: 4, lg: 6 } },
  canHaveChildren: true,
}

// ============================================================
// COMPONENT
// ============================================================

export const CardBlock: BlockComponent = ({ props, children, block, context }) => {
  const p = props as unknown as CardProps
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const safe = safeHref(typeof p.href === 'string' && p.href.trim() ? p.href.trim() : undefined)
  // A bare `#` is a placeholder, not a destination.
  const target = safe && safe !== '#' ? safe : undefined
  // An `href` prop reaches the block already in the router's form: the host
  // rewrites every href prop (and the href of an object in a list prop) before
  // the block renders, so it is written as given, never through appHref twice.
  const href = target
  const hrefLabel = typeof p.hrefLabel === 'string' && p.hrefLabel.trim() ? p.hrefLabel.trim() : undefined
  // Unnamed, the link takes the first heading's name once it is on the page.
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const [labelledBy, setLabelledBy] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    if (!href || hrefLabel) return
    const heading = rootRef.current?.querySelector<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
    setLabelledBy(heading?.id || undefined)
  })
  // Elevation ramp from the theme (--pw-shadow-*) with the prior literals as
  // fallbacks so cards re-skin elevation in one place.
  const shadowMap: Record<string, string> = {
    none: 'none',
    theme: 'var(--pw-shadow-card, 0 1px 2px 0 rgba(0,0,0,.05))',
    sm: 'var(--pw-shadow-sm)',
    md: 'var(--pw-shadow-md)',
    lg: 'var(--pw-shadow-lg)',
    xl: 'var(--pw-shadow-xl)',
  }
  const alignMap: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  }
  const align = p.align
  const textAlign = p.textAlign
  const blurMap: Record<string, string> = { none: '', sm: 'blur(8px)', md: 'blur(16px)', lg: 'blur(24px)' }
  const glass = p.glass
  const glassBlur = blurMap[glass] ?? ''
  const baseBg = p.backgroundColor ?? 'var(--pw-color-card)'
  const style: React.CSSProperties = {
    // Local text-color override for this card's subtree — falls through to the
    // page-level tokens unchanged when a theme doesn't define the on-card
    // variants (e.g. midnight-gold, where card and page bg are both dark).
    // Themes whose card surface diverges from the page background (e.g. a
    // white card on a black page) define --pw-color-text(-muted)-on-card so
    // descendant text/heading/link blocks stay legible without per-block awareness.
    ['--pw-color-text' as string]: 'var(--pw-color-text-on-card, var(--pw-color-text))',
    ['--pw-color-text-muted' as string]: 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted))',
    ['--pw-color-link' as string]: 'var(--pw-color-link-on-card, var(--pw-color-primary-ink))',
    // The var overrides above only help blocks that SET color themselves.
    // Blocks that never set color (comment-thread body text, plain spans)
    // inherit the COMPUTED color from the page body — the page-level light
    // text — and go invisible on a white card. Setting color here re-computes
    // it against this card's own overridden token, so every descendant
    // inherits legible on-card text by default.
    color: 'var(--pw-color-text)',
    display: 'flex',
    flexDirection: 'column',
    gap: cssUnit(p.gap),
    padding: cssUnit(p.padding),
    // Glass: a color-mix of the (themeable) card fill + transparent so the frost
    // tint tracks the theme; otherwise the solid fill. Blur via backdrop-filter.
    backgroundColor: glassBlur ? `color-mix(in srgb, ${baseBg} 60%, transparent)` : baseBg,
    ...(glassBlur ? { backdropFilter: glassBlur, WebkitBackdropFilter: glassBlur } : {}),
    // The theme's large corner: a fixed 8px ignored a 1.5rem theme.
    borderRadius: cssUnit(p.borderRadius) ?? 'var(--pw-border-radius-lg, 8px)',
    borderWidth: cssUnit(p.borderWidth),
    borderStyle: 'solid',
    borderColor: p.borderColor ?? 'var(--pw-color-border)',
    boxShadow: shadowMap[p.shadow] ?? shadowMap['md'],
    ...(p.aspectRatio != null ? { aspectRatio: String(p.aspectRatio) } : {}),
    alignItems: align ? alignMap[align] : undefined,
    textAlign,
    // Motion tokens: a hover lift or shadow change (from the host or a
    // linked card) follows the theme's pace and springs on its bounce easing.
    transition: `${transitionOf(['box-shadow', 'border-color', 'background-color'], MOTION.normal)}, transform ${MOTION.spring}`,
    ...(href ? { position: 'relative' as const } : {}),
    ...block.style,
  }
  if (!href) {
    return (
      <div id={block.id} data-block-id={block.id} style={style} data-block-type="card">
        {children}
      </div>
    )
  }
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    // In the editor a click reports the destination instead of leaving the page.
    if (context?.interactionMode !== 'inert') return
    e.preventDefault()
    emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href: target ?? null } })
  }
  return (
    <div ref={rootRef} id={block.id} data-block-id={block.id} style={style} data-block-type="card" data-pw-card-link="">
      <style>{CARD_LINK_CSS}</style>
      <a
        href={href}
        data-pw-card-cover=""
        aria-label={hrefLabel}
        aria-labelledby={hrefLabel ? undefined : (labelledBy ?? block.id)}
        onClick={onClick}
        style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
      />
      {children}
    </div>
  )
}
