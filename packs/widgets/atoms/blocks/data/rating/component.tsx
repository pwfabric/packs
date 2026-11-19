import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { safeRenderValue } from '../../../lib/_kit.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const RATING_SHAPES = ['star', 'heart', 'circle'] as const

export interface RatingProps {
  readonly value: number
  readonly max: number
  readonly readonly: boolean
  readonly size: 'sm' | 'md' | 'lg'
  readonly color?: string
  readonly shape: (typeof RATING_SHAPES)[number]
  readonly showCount: boolean
  /** Form field name: inside a form the picked value is submitted under it (typed number). */
  readonly name?: string
  /** State key the picked value is written to — `{{state.<key>}}` then reads it. */
  readonly stateKey?: string
  /** What is being rated — names the control for screen readers, e.g. "Your rating". */
  readonly label?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const ratingDefinition: BlockDefinition = {
  type: 'rating',
  name: 'Rating',
  category: 'data',
  icon: '★',
  defaultProps: {
    value: 0,
    max: 5,
    readonly: false,
    size: 'md',
    shape: 'star',
    showCount: false,
  },
  defaultLayout: { span: { xs: 4, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const RatingBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as RatingProps
  const readonly = p.readonly
  // The manifest bounds max to 1–10 and value to 0–10; a rounded max and a
  // value clamped to it stay in code (the shape cannot tie one prop to another).
  const max = Math.max(1, Math.round(Number(p.max) || 5))
  const clampValue = (n: number): number => Math.min(max, Math.max(0, n))
  const propValue = clampValue(Number(p.value) || 0)
  const [value, setValue] = React.useState(propValue)
  const lastPropValue = React.useRef(propValue)
  if (lastPropValue.current !== propValue) {
    // A bound value (`{{product.rating}}`) resolves after the first render;
    // it used to be ignored for good.
    lastPropValue.current = propValue
    setValue(propValue)
  }
  const name = typeof props.name === 'string' && props.name ? props.name : undefined
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined
  const label = safeRenderValue(props.label)
  const inert = context?.interactionMode === 'inert'
  // Filled symbols follow the theme accent by default (ratings read as a
  // highlight), so a themed surface re-skins them. Explicit `color` overrides.
  const color = p.color ?? 'color-mix(in srgb, var(--pw-color-warning, #d97706) 60%, var(--pw-color-text))'
  const emptyColor = 'color-mix(in srgb, var(--pw-color-text) 45%, transparent)'
  const shape = p.shape
  const size = p.size
  const showCount = p.showCount

  const sizeMap: Record<string, string> = { sm: '1rem', md: '1.5rem', lg: '2rem' }
  const fontSize = sizeMap[size] ?? '1.5rem'

  const shapeChar = (filled: boolean): string => {
    if (shape === 'heart') return filled ? '♥' : '♡'
    if (shape === 'circle') return filled ? '●' : '○'
    return filled ? '★' : '☆'
  }
  // Whole symbols up to the value, one half symbol for a .25–.75 remainder:
  // 4.5 used to draw five full stars.
  const fillOf = (i: number): 'full' | 'half' | 'empty' => {
    const rest = value - i
    if (rest >= 0.75) return 'full'
    if (rest >= 0.25) return 'half'
    return 'empty'
  }

  const pick = (next: number): void => {
    if (inert) return
    setValue(next)
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: {
        value: next,
        inputId: block.id,
        name,
        ...(stateKey ? { action: { type: 'setState', key: stateKey, value: next } } : {}),
      },
    })
  }

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    fontSize,
    ...block.style,
  }

  const glyph = (i: number): React.ReactNode => {
    const fill = fillOf(i)
    if (fill === 'half') {
      return (
        <span data-fill="half" aria-hidden="true" style={{ position: 'relative', display: 'inline-block', lineHeight: 1, color: emptyColor }}>
          {shapeChar(false)}
          <span style={{ position: 'absolute', inset: 0, width: '50%', overflow: 'hidden', color }}>{shapeChar(true)}</span>
        </span>
      )
    }
    return (
      <span data-fill={fill} aria-hidden="true" style={{ lineHeight: 1, color: fill === 'full' ? color : emptyColor }}>
        {shapeChar(fill === 'full')}
      </span>
    )
  }

  const count = showCount ? (
    <span
      style={{
        fontSize: 'var(--pw-font-size-sm)',
        color: 'var(--pw-color-text-muted)',
        marginLeft: '4px',
      }}
    >
      {value}/{max}
    </span>
  ) : null
  const carrier = name ? <input type="hidden" name={name} value={value ? String(value) : ''} data-pw-value-type="number" /> : null

  if (readonly) {
    // Display only: one image with a name, not N silent symbols.
    return (
      <div id={block.id} data-block-id={block.id} style={containerStyle} data-block-type="rating">
        <span role="img" aria-label={`${label ? `${label}: ` : ''}${value} / ${max}`} style={{ display: 'inline-flex', gap: '2px', fontSize }}>
          {Array.from({ length: max }).map((_, i) => (
            <React.Fragment key={i}>{glyph(i)}</React.Fragment>
          ))}
        </span>
        {count}
        {carrier}
      </div>
    )
  }

  // Interactive: a radio group of real buttons — reachable by Tab,
  // arrows move the choice, each option has a name.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const current = Math.round(value)
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      pick(Math.min(max, current + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      pick(Math.max(1, current - 1))
    }
  }
  const focusIndex = Math.max(0, Math.round(value) - 1)
  return (
    <div id={block.id} data-block-id={block.id} style={containerStyle} data-block-type="rating">
      <div role="radiogroup" aria-label={label || undefined} onKeyDown={onKeyDown} style={{ display: 'inline-flex', gap: '2px' }}>
        {Array.from({ length: max }).map((_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={Math.round(value) === i + 1}
            aria-label={`${i + 1} / ${max}`}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => pick(i + 1)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              font: 'inherit',
              fontSize,
              lineHeight: 1,
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            {glyph(i)}
          </button>
        ))}
      </div>
      {count}
      {carrier}
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(RatingBlock, { sizing: 'intrinsic' })
