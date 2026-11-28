import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import { SURFACE_EVENTS } from '@pwfabric/runtime'
import type { BlockComponent } from '../../../lib/component-types.js'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { HIT_AREA_CSS, safeHref, textOf, tint, PRESS_CSS } from '../../../lib/_shared-utils.js'

/**
 * An actionable chip (a button or a link) is a REAL 44px-tall box on a phone or
 * a touch screen — R3 measures the box, and the shared invisible hit area alone
 * left every filter strip at 29px. The label keeps its size, centred.
 */
const CHIP_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-chip-touch] { min-height: 44px; } }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const CHIP_TONES = ['neutral', 'primary', 'accent', 'success', 'warning', 'error'] as const

export interface ChipProps {
  readonly label: string
  /** Carried in the event payload so a strip can tell its chips apart. */
  readonly value?: string
  readonly href?: string
  readonly tone: (typeof CHIP_TONES)[number]
  readonly size: 'sm' | 'md'
  readonly selected: boolean
  readonly removable: boolean
  readonly count?: number
  /** A runtime action (setState, navigate, …) the chip runs when pressed. */
  readonly action?: unknown
}

// ============================================================
// DEFINITION
// ============================================================

export const chipDefinition: BlockDefinition = {
  type: 'chip',
  name: 'Chip',
  category: 'control',
  icon: '◗',
  defaultProps: { label: '', tone: 'neutral', size: 'md', selected: false, removable: false },
  defaultLayout: { span: { xs: 2, sm: 2, md: 2, lg: 2 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * A small labelled token the reader can act on.
 *
 * NOT `control.badge`, which states a STATUS and is not actionable, and not
 * `form.tag-input`, which is an input that produces tokens. This is the third
 * thing both of those were being stretched to cover: a token that carries a
 * value and can be chosen, followed or dismissed — a facet value, a filter in
 * force, a tag on a card, a session track.
 *
 * Tones mirror `control.badge` exactly, including its measured reasoning: the
 * fill is a `color-mix` wash of the SAME token that drives the label, so a chip
 * re-skins with the theme and stays legible inside a card, where
 * `--pw-color-text` is overridden but `--pw-color-border` is not.
 */
export const ChipBlock: BlockComponent = ({ props, context, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const interactive = context.interactionMode !== 'inert'

  // Unset means NOTHING shown — a "Chip" placeholder reached visitors.
  const p = props as unknown as ChipProps
  const label = textOf(p.label)
  const value = p.value == null ? label : String(p.value)
  const href = safeHref(typeof p.href === 'string' ? p.href : undefined)
  const selected = p.selected
  const removable = p.removable
  const count = typeof p.count === 'number' && Number.isFinite(p.count) ? p.count : null
  if (!label) return null

  const tones: Record<string, React.CSSProperties> = {
    neutral: {
      backgroundColor: 'color-mix(in srgb, var(--pw-color-text) 14%, transparent)',
      color: 'var(--pw-color-text)',
    },
    primary: {
      backgroundColor: tint('var(--pw-color-primary)'),
      color: 'color-mix(in srgb, var(--pw-color-primary) 45%, var(--pw-color-text-on-card, var(--pw-color-text)))',
    },
    accent: {
      backgroundColor: tint('var(--pw-color-accent)'),
      color: 'color-mix(in srgb, var(--pw-color-accent) 45%, var(--pw-color-text-on-card, var(--pw-color-text)))',
    },
    success: {
      backgroundColor: tint('var(--pw-color-success)'),
      color: 'color-mix(in srgb, var(--pw-color-success) 45%, var(--pw-color-text-on-card, var(--pw-color-text)))',
    },
    warning: {
      backgroundColor: tint('var(--pw-color-warning)'),
      color: 'color-mix(in srgb, var(--pw-color-warning) 45%, var(--pw-color-text-on-card, var(--pw-color-text)))',
    },
    error: {
      backgroundColor: tint('var(--pw-color-error)'),
      color: 'color-mix(in srgb, var(--pw-color-error) 45%, var(--pw-color-text-on-card, var(--pw-color-text)))',
    },
  }

  const sm = p.size === 'sm'
  const base: React.CSSProperties = {
    ...(tones[p.tone] ?? tones.neutral),
    display: 'inline-flex',
    alignItems: 'center',
    gap: sm ? '4px' : '6px',
    padding: sm ? '2px 8px' : '4px 12px',
    borderRadius: 'var(--pw-border-radius-full)',
    // sm sits beside 14px row titles and must read smaller than them; md is
    // the size of small body copy.
    fontSize: sm ? 'var(--pw-font-size-xs)' : 'var(--pw-font-size-sm)',
    fontWeight: selected ? 600 : 500,
    lineHeight: 1.4,
    maxWidth: '100%',
    minWidth: 0,
    textDecoration: 'none',
    boxShadow: 'none',
    // SELECTED IS FILLED. A thin ring on the same wash was measured too faint
    // to tell a chosen filter from the others (re-audit, several apps): the
    // chosen chip takes the primary fill and its paired ink, plus the 600
    // weight above, so the state never rests on one faint cue.
    ...(selected
      ? { backgroundColor: 'var(--pw-color-primary)', color: 'var(--pw-color-text-on-primary)' }
      : {}),
  }

  // Every press is ONE block:click — the runtime runs the chip's `action` on
  // it, as it does a button's. (It also went to context.onEvent, which the
  // renderer bridges to the same handler: every press ran the action twice.)
  const press = (payload: Record<string, unknown>): void => {
    if (!interactive) return
    emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload })
  }

  const dismiss = (e: React.MouseEvent | React.KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    press({ removed: true, value })
  }

  const cross = (interactiveCross: boolean) =>
    removable ? (
      <span
        // On a link chip the × is its own control (the label follows the
        // link). On a button chip the whole chip IS the removal, so the × is
        // only its mark — a button inside a button is not a control a screen
        // reader can reach.
        {...(interactiveCross
          ? {
              role: 'button',
              tabIndex: interactive ? 0 : -1,
              'aria-label': `Remove ${label}`,
              onClick: dismiss,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') dismiss(e)
              },
            }
          : { 'aria-hidden': true })}
        style={{ cursor: interactive ? 'pointer' : 'default', opacity: 0.75, fontSize: sm ? 'var(--pw-font-size-sm)' : 'var(--pw-font-size-base)', lineHeight: 1 }}
      >
        ×
      </span>
    ) : null

  const body = (interactiveCross: boolean) => (
    <>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{label}</span>
      {count != null && Number.isFinite(count) ? (
        <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      ) : null}
      {cross(interactiveCross)}
    </>
  )

  // An address makes it a link; no address and it is a button, so a chip is
  // never a div that merely looks clickable.
  if (href) {
    return (
      <>
        <style>{PRESS_CSS + HIT_AREA_CSS + CHIP_TOUCH_CSS}</style>
        <a id={block.id} data-block-id={block.id} data-block-type="chip" href={href} style={base} data-pw-hit="" data-pw-chip-touch="">
          {body(true)}
        </a>
      </>
    )
  }

  // A chip with nothing to do — a status pill — is text, not a button: a
  // <button> that does nothing was announced as a control and took focus.
  // It acts when it has an action, can be removed, or carries a selection.
  // Read off the authored block too: a validated props object may have its
  // defaults filled in and its action taken by the runtime.
  const authored = ((block as { props?: Record<string, unknown> }).props ?? {}) as Record<string, unknown>
  const actionable =
    p.action != null || authored.action != null || removable || authored.selected !== undefined
  if (!actionable) {
    return (
      <span id={block.id} data-block-id={block.id} data-block-type="chip" style={base}>
        {body(false)}
      </span>
    )
  }

  // A removable chip is a filter in force: pressing it — label or × — removes
  // it, and it says so to a screen reader. Otherwise a press chooses it.
  return (
    <>
    <style>{PRESS_CSS + HIT_AREA_CSS + CHIP_TOUCH_CSS}</style>
    <button data-pw-press=""
      id={block.id}
      data-block-id={block.id}
      data-block-type="chip"
      data-pw-hit=""
      data-pw-chip-touch=""
      type="button"
      {...(removable ? { 'aria-label': `Remove ${label}` } : { 'aria-pressed': selected })}
      onClick={() => press(removable ? { removed: true, value } : { selected: !selected, value })}
      // `fontFamily`, NOT the `font` shorthand: `font: inherit` also reset the
      // size, weight and line height set in `base`, so an sm chip drew at the
      // page's 16px — larger than the 14px row title beside it.
      style={{ ...base, border: 'none', cursor: interactive ? 'pointer' : 'default', fontFamily: 'inherit' }}
    >
      {body(false)}
    </button>
    </>
  )
}

export default ChipBlock

// A chip's width is its label, like a badge's: in a flex row it must not take
// an equal share (two suggestion chips were spread to the two ends of the row).
// Declared here, applied by the runtime.
Object.assign(ChipBlock, { sizing: 'intrinsic' })
