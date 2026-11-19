import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, ICON_PATHS, MOTION, inkOn, safeHref, safeRenderValue, transitionOf } from '../../../lib/_shared-utils.js'

/**
 * Buttons are 30–43px tall (large measured 41–43 with a short line height). On
 * a phone or touch screen every size grows to a REAL 44px box (WCAG 2.5.5 / R3 measures the box, not an invisible
 * hit area); the label stays centred. An instance's own minHeight still wins.
 */
const BUTTON_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-btn-touch] { min-height: 44px; } }'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents } from '../../../lib/hooks.js'
import { useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const BUTTON_VARIANTS = ['primary', 'secondary', 'accent', 'outline', 'ghost', 'destructive'] as const
export const BUTTON_SIZES = ['small', 'medium', 'large'] as const

export interface ButtonProps {
  readonly label: string
  readonly variant: (typeof BUTTON_VARIANTS)[number]
  readonly size: (typeof BUTTON_SIZES)[number]
  /** An address: absolute, relative (`/menu`, `#/dish`), `mailto:`/`tel:`, or "" for none. */
  readonly href?: string
  /**
   * This button names the page the visitor is on (a pill nav item): it
   * carries aria-current="page". No visual change — the variant draws it.
   */
  readonly current?: boolean
  /**
   * Same rule as the link: unset, an external absolute http(s) address opens in
   * a new tab; internal addresses, `#`, mailto: and tel: stay in this one.
   */
  readonly target?: '_self' | '_blank'
  readonly disabled: boolean
  readonly fullWidth: boolean
  readonly icon?: string
  readonly iconPosition?: 'left' | 'right'
}

// ============================================================
// DEFINITION
// ============================================================

export const buttonDefinition: BlockDefinition = {
  type: 'button',
  name: 'Button',
  category: 'control',
  icon: '⊡',
  defaultProps: {
    label: '',
    variant: 'primary',
    size: 'medium',
  },
  defaultLayout: { span: { xs: 2, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * Where a button's `href` opens. An explicit `target` wins. Unset, an
 * absolute http(s) address on ANOTHER origin opens in a new tab — the same
 * rule the link block applies to external addresses; a relative address, `#`,
 * a same-origin address, `mailto:` and `tel:` stay in this tab.
 */
export function buttonOpensNewTab(href: string, target?: string): boolean {
  if (target === '_blank') return true
  if (target === '_self') return false
  if (!/^https?:\/\//i.test(href.trim())) return false
  try {
    return new URL(href.trim()).origin !== window.location.origin
  } catch {
    return false
  }
}

/** The destructive label: the theme's on-error ink, else black/white by the error fill. */
export const DESTRUCTIVE_INK = inkOn('var(--pw-color-error)', '--pw-color-on-error')

export const ButtonBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  // Button variants use CSS custom properties instead of dark/light hardcoded values
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--pw-color-primary)',
      color: 'var(--pw-color-text-on-primary)',
      border: 'none',
      boxShadow: 'var(--pw-shadow-button, none)',
    },
    secondary: {
      backgroundColor: 'var(--pw-color-card)',
      color: 'var(--pw-color-text)',
      border: '1px solid var(--pw-color-border)',
    },
    accent: {
      backgroundColor: 'var(--pw-color-accent)',
      // The ink on an ACCENT fill is the accent's own pair. contracts derives
      // --pw-color-on-accent (and a host may set it via styleVariables);
      // text-on-primary is paired with the primary fill and only read on the
      // accent by coincidence. Same chain as avatar's accent tone.
      color: 'var(--pw-color-on-accent, var(--pw-color-text-on-primary))',
      border: 'none',
      boxShadow: 'var(--pw-shadow-button, none)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--pw-color-primary-ink, #18181b)',
      border: 'var(--pw-border-width) var(--pw-border-style) var(--pw-color-primary)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--pw-color-primary-ink, #18181b)',
      border: 'none',
    },
    destructive: {
      backgroundColor: 'var(--pw-color-error)',
      // Ink by ITS ground, not the brand's: text-on-primary is chosen
      // for the brand and can fall under 3:1 on a mid-tone error red. `--pw-color-on-error` wins when a theme sets it; otherwise
      // black or white by the error colour's own luminance (≥ 4.58:1).
      color: DESTRUCTIVE_INK,
      border: 'none',
    },
  }

  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { padding: '6px 12px', fontSize: 'var(--pw-font-size-sm)' },
    medium: { padding: '10px 16px', fontSize: 'var(--pw-font-size-sm)' },
    large: { padding: '12px 24px', fontSize: 'var(--pw-font-size-base)' },
  }

  const p = props as unknown as ButtonProps
  const variant = p.variant
  const size = p.size
  const disabled = p.disabled
  const iconName = p.icon
  const iconPosition = p.iconPosition ?? 'left'
  const target = p.target

  const style: React.CSSProperties = {
    ...(variantStyles[variant] ?? variantStyles.primary),
    ...(sizeStyles[size] ?? sizeStyles.medium),
    borderRadius: 'var(--pw-button-radius, var(--pw-border-radius))',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    width: p.fullWidth ? '100%' : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    // Label weight follows the theme's heading voice: a fixed 500
    // ignored `headingWeight` 400–800 and made every theme's controls look alike.
    fontWeight: 'var(--pw-font-weight-heading, 600)',
    // A <button> does not inherit the page font: the UA sheet gives it its own
    // (Arial on Windows), so a serif theme drew serif headings and Arial
    // buttons. bottom-bar and navbar already did this.
    fontFamily: 'inherit',
    // A short label never breaks ("Save" / "changes" on two lines in a
    // narrow row). A full-width button has the room and may wrap a long one.
    whiteSpace: p.fullWidth ? undefined : 'nowrap',
    // Motion tokens: colour changes at the theme's normal pace, a press
    // or lift springs on its bounce easing — a lively theme moves like one, and
    // a theme with zero durations does not move at all.
    transition: `${transitionOf(['background-color', 'color', 'border-color', 'box-shadow', 'opacity'], MOTION.normal)}, transform ${MOTION.spring}`,
    // Layer 4: block-level style overrides
    ...block.style,
  }

  // "" and a bare "#" are NO address: a CTA left without a route (an empty
  // state's button wired by a behavior) stays a <button> that navigates
  // nowhere — "#" would jump to the app's first page in a hash-routed app.
  const ownHref = ((): string | undefined => {
    const h = safeHref(typeof p.href === 'string' ? p.href : undefined)
    return h === '#' ? undefined : h
  })()
  const resolvedHref = disabled ? undefined : ownHref

  // Whether the address opens in a new tab compares it with the page's own
  // origin, which only a browser knows: render is pure (a pre-rendered page
  // hydrates without a mismatch), so the first frame takes the explicit
  // `target` alone and the origin check runs after mount.
  const [newTab, setNewTab] = React.useState(target === '_blank')
  React.useEffect(() => {
    setNewTab(resolvedHref ? buttonOpensNewTab(resolvedHref, target) : false)
  }, [resolvedHref, target])

  const handleClick = (): void => {
    if (disabled) return
    const href = ownHref
    // Real navigation is a SIDE-EFFECT: only perform it in live mode. In inert
    // (editor/preview) renders we skip it so the surface doesn't actually
    // navigate — but we STILL emit the click event below so the host gets
    // feedback (notification semantics).
    if (href && context.interactionMode !== 'inert' && typeof window !== 'undefined') {
      if (buttonOpensNewTab(href, target)) {
        window.open(href, '_blank', 'noopener,noreferrer')
      } else {
        window.location.href = href
      }
      return
    }
    // Canonical path: emit structured block event via SurfaceEventBus.
    emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id })
  }

  // Unset means hidden: a "Button" placeholder reached visitors.
  const label = safeRenderValue(p.label)
  if (!label && !iconName) return null

  const iconEl = iconName ? (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: (
          ICON_PATHS[iconName] ??
          ICON_PATHS.circle ?? ['<circle cx="12" cy="12" r="10"/>']
        ).join(''),
      }}
    />
  ) : null

  const ariaCurrent = p.current === true || (p.current as unknown) === 'true' ? 'page' : undefined

  // A BUTTON WITH AN ADDRESS IS A LINK. It renders <a href> in the button's
  // look, so the browser offers "open in new tab", middle-click and the link
  // context menu, and a screen reader announces a link — a <button> that
  // navigated by script was none of these. Live mode navigates natively; the
  // inert (editor/preview) render cancels the navigation and still emits the
  // click, as before. Without an address (or disabled — an <a> cannot be) it
  // stays a <button>, and its click still runs the block's behaviours.
  if (resolvedHref) {
    return (
      <>
      <style>{HIT_AREA_CSS + BUTTON_TOUCH_CSS}</style>
      <a
        data-pw-hit=""
        data-pw-btn-touch=""
        id={block.id}
        data-block-id={block.id}
        data-block-type="button"
        href={resolvedHref}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        style={{ textDecoration: 'none', boxSizing: 'border-box', ...style }}
        onClick={(e) => {
          if (context.interactionMode === 'inert') {
            e.preventDefault()
            emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href: resolvedHref } })
          }
        }}
        aria-current={ariaCurrent}
      >
        {iconEl && iconPosition !== 'right' && iconEl}
        {label}
        {iconEl && iconPosition === 'right' && iconEl}
      </a>
      </>
    )
  }

  return (
    <>
    <style>{HIT_AREA_CSS + BUTTON_TOUCH_CSS}</style>
    <button
      data-pw-hit=""
      data-pw-btn-touch=""
      // Explicit: inside a <form> a <button> without a type SUBMITS it. A step
      // "Next" button (action: setState step) placed inside a multi-step form
      // would post the record on every step.
      type="button"
      id={block.id}
      data-block-id={block.id}
      style={style}
      disabled={disabled}
      onClick={handleClick}
      data-block-type="button"
      aria-current={ariaCurrent}
    >
      {iconEl && iconPosition !== 'right' && iconEl}
      {label}
      {iconEl && iconPosition === 'right' && iconEl}
    </button>
    </>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(ButtonBlock, { sizing: 'intrinsic' })
