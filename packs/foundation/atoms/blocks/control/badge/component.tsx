import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { CONTROL_BORDER, ICON_PATHS, textOf, tint } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const BADGE_VARIANTS = ['default', 'primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info'] as const
export type BadgeVariant = (typeof BADGE_VARIANTS)[number]

export interface BadgeProps {
  readonly text: string
  readonly variant: BadgeVariant
  readonly size: 'sm' | 'md' | 'lg'
  readonly rounded: boolean
  readonly icon?: string
  /** Removable filter-chip affordance: a trailing × that emits a `custom` (dismiss) event. */
  readonly dismissible: boolean
  /** The value the variant is looked up by — usually a bound record field. Unset: `text` is the key. */
  readonly status?: string | number | boolean
  /** Value → variant: exact match first, then case- and space-insensitive, then `"*"`, then `variant`. */
  readonly variantMap?: Readonly<Record<string, BadgeVariant>>
}

const VARIANTS = new Set<string>(BADGE_VARIANTS)

/** The variant a badge draws in — `variantMap` looked up by `status` (or `text`), else `variant`. */
export function resolveBadgeVariant(props: Record<string, unknown>): string {
  const fallback = typeof props.variant === 'string' && VARIANTS.has(props.variant) ? props.variant : 'default'
  const map = props.variantMap
  if (!map || typeof map !== 'object' || Array.isArray(map)) return fallback
  const entries = Object.entries(map as Record<string, unknown>).filter(
    (e): e is [string, string] => typeof e[1] === 'string' && VARIANTS.has(e[1]),
  )
  const raw = props.status ?? props.text
  const key = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
  const exact = entries.find(([k]) => k === key)
  if (exact) return exact[1]
  // Case-insensitive under the default rules AND under Turkish casing: the
  // default makes "Info" match "info" (Turkish turns I into dotless ı), and
  // Turkish makes "KAYIT AÇIK" match "Kayıt açık" (the default turns I into i).
  const forms = (s: string): [string, string] => {
    const t = s.trim().replace(/\s+/g, ' ')
    return [t.toLowerCase(), t.toLocaleLowerCase('tr')]
  }
  const keyForms = forms(key)
  const loose = key
    ? entries.find(([k]) => k !== '*' && forms(k).some((f, i) => f === keyForms[i]))
    : undefined
  if (loose) return loose[1]
  const star = entries.find(([k]) => k === '*')
  return star ? star[1] : fallback
}

// ============================================================
// DEFINITION
// ============================================================

export const badgeDefinition: BlockDefinition = {
  type: 'badge',
  name: 'Badge',
  category: 'control',
  icon: '⬡',
  defaultProps: {
    text: '',
    variant: 'default',
    size: 'md',
    rounded: false,
  },
  defaultLayout: { span: { xs: 2, sm: 2, md: 2, lg: 2 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** A 1px edge drawn inside the box, so variants never differ in size. */
const edge = (width: number, color: string): string => `inset 0 0 0 ${width}px ${color}`
/** A soft status/brand variant: a tint of its token, an ink of it, and an edge in the ink. */
const soft = (token: string): React.CSSProperties => {
  const ink = `color-mix(in srgb, ${token} 45%, var(--pw-color-text-on-card, var(--pw-color-text)))`
  return { backgroundColor: tint(token), color: ink, boxShadow: edge(1, ink) }
}

/**
 * THE SELECTED STATE MUST BE SEEN.
 *
 * `primary` was a 14% tint of the brand with a darker brand label, and
 * `default` a 14% wash of the text colour: in the render the two fills sat
 * 1.14–1.40:1 apart and 1.02–1.33:1 in the token matrix, so a stepper's active
 * step and a filter's chosen chip looked like the others (24/24 cells).
 *
 * Now the step is a change of KIND, not of shade:
 *   - `primary` is FILLED: the brand fill with the theme's own on-primary ink,
 *     plus a 2px edge in `--pw-color-primary-ink` — the brand pushed to 4.5:1
 *     against the card by the cascade — so the shape clears 3:1 against the
 *     ground and against an unselected badge even where the fill itself does
 *     not (a light brand on a light card);
 *   - `default` is EMPTY: transparent, a control edge, muted ink;
 *   - status and brand-soft variants keep their tint and gain an edge in their ink.
 * Edges are inset shadows so the variants keep one size.
 */
export const BADGE_VARIANT_STYLES: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: 'transparent',
    color: 'var(--pw-color-text-muted)',
    boxShadow: edge(1, CONTROL_BORDER),
  },
  primary: {
    backgroundColor: 'var(--pw-color-primary)',
    color: 'var(--pw-color-text-on-primary)',
    boxShadow: edge(2, 'var(--pw-color-primary-ink, var(--pw-color-primary))'),
  },
  secondary: soft('var(--pw-color-secondary)'),
  accent: soft('var(--pw-color-accent)'),
  success: soft('var(--pw-color-success)'),
  warning: soft('var(--pw-color-warning)'),
  error: soft('var(--pw-color-error)'),
  info: soft('var(--pw-color-info)'),
}

export const BadgeBlock: BlockComponent = ({ props, block }) => {
  const appWords = useAppMessages()
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const variantStyles = BADGE_VARIANT_STYLES

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '2px 8px', fontSize: 'var(--pw-font-size-xs, 12px)' },
    // ON the theme scale: the midpoint of xs and sm (13–13.5px) was measured
    // off-scale on every page with a badge. md is the sm step; the size
    // difference from lg is the padding.
    md: { padding: '4px 10px', fontSize: 'var(--pw-font-size-sm, 14px)' },
    lg: { padding: '6px 12px', fontSize: 'var(--pw-font-size-sm, 14px)' },
  }

  const p = props as unknown as BadgeProps
  const variant = resolveBadgeVariant(props as Record<string, unknown>)
  const size = p.size
  const iconName = p.icon
  const dismissible = p.dismissible
  // Unset means nothing shown: a "Badge" placeholder reached visitors.
  const text = textOf(p.text)
  if (!text && !iconName) return null

  const style: React.CSSProperties = {
    ...(variantStyles[variant] ?? variantStyles.default),
    ...(sizeStyles[size] ?? sizeStyles.md),
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    // A badge label is one line. In a row of step badges at 390px a
    // flex item shrank to 68px and "1 · Personal details" broke onto three
    // lines outside the pill. The badge keeps its width; a narrow row wraps
    // whole badges (container `wrap`) instead of breaking one inside.
    whiteSpace: 'nowrap',
    flexShrink: 0,
    borderRadius: p.rounded ? 'var(--pw-border-radius-full, 9999px)' : 'var(--pw-border-radius-sm, 4px)',
    // Label weight follows the theme's heading voice: a fixed 500
    // ignored `headingWeight` 400–800 and made every theme's controls look alike.
    fontWeight: 'var(--pw-font-weight-heading, 600)',
    ...block.style,
  }

  // Inert-safe dismiss: emit a `custom` (dismiss) notification. Real removal is
  // a side-effect owned by the host; a static preview keeps the chip in place.
  const handleDismiss = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation()
    emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { action: 'dismiss' } })
  }

  return (
    <span id={block.id} data-block-id={block.id} style={style} data-block-type="badge">
      {iconName && (
        // The decorative leading icon is drawn with appearance.css's mask token
        // instead of inline SVG — adding/changing an icon no longer rebuilds
        // this block, and an atom can ship its own set. An unknown name falls
        // back to circle (the icon-canon check catches it before use); with no
        // css at all there is no .pw-icon class either → the icon simply
        // disappears instead of breaking.
        <span
          className="pw-icon"
          aria-hidden="true"
          style={{ width: '12px', height: '12px', ['--pw-icon' as never]: `var(--pw-icon-${iconName}, var(--pw-icon-circle))` }}
        />
      )}
      {text}
      {dismissible && (
        <button
          type="button"
          aria-label={messageOf(appWords, 'ui.remove', '', { name: textOf(text) })}
          onClick={handleDismiss}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '2px',
            marginRight: '-2px',
            padding: 0,
            width: '14px',
            height: '14px',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            borderRadius: '9999px',
            lineHeight: 0,
          }}
        >
          <svg
            width={10}
            height={10}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: (ICON_PATHS.x ?? []).join('') }}
          />
        </button>
      )}
    </span>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(BadgeBlock, { sizing: 'intrinsic' })
