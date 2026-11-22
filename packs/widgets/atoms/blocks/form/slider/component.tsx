import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { CONTROL_LABEL_GAP, CONTROL_LABEL_STYLE, safeRenderValue } from '../../../lib/_kit.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

/**
 * At phone width or on a coarse pointer the range input is a REAL 44px-tall box:
 * the thumb is found anywhere in that band (R3), the drawn track stays thin.
 */
const SLIDER_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-range-touch] { height: 44px; margin: 0; } }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface SliderProps {
  readonly name?: string
  readonly label?: string
  readonly min: number
  readonly max: number
  readonly step: number
  /** Unset: the slider starts at `min` (no fixed default: it follows min). */
  readonly value?: number
  readonly showValue: boolean
  readonly disabled: boolean
  /** State key the number is written to on change — `{{state.<key>}}` then reads it (a price filter). */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const sliderDefinition: BlockDefinition = {
  type: 'slider',
  name: 'Slider',
  category: 'form',
  icon: '▭',
  defaultProps: {
    min: 0,
    max: 100,
    step: 1,
    value: 50,
    showValue: true,
    disabled: false,
  },
  defaultLayout: { span: { xs: 4, sm: 6, md: 6, lg: 6 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

export const SliderBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const p = props as unknown as SliderProps
  const label = typeof p.label === 'string' ? p.label : ''
  const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const min = num(p.min, 0)
  const max = num(p.max, 100)
  const step = num(p.step, 1)
  const { showValue, disabled } = p
  const name = typeof p.name === 'string' && p.name ? p.name : undefined
  const stateKey = typeof p.stateKey === 'string' && p.stateKey ? p.stateKey : undefined

  const initial = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : min

  const [value, setValue] = React.useState<number>(initial)
  // A bound value that arrives after the first render re-selects.
  const lastInitial = React.useRef(initial)
  if (lastInitial.current !== initial) {
    lastInitial.current = initial
    setValue(initial)
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="slider"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pw-space-xs, 4px)',
        width: '100%',
        opacity: disabled ? 0.5 : undefined,
        ...block.style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--pw-space-sm, 8px)',
          // The head row (label + value) stands where every control's label
          // does: CONTROL_LABEL_GAP above the track, the column's gap taken back.
          marginBottom: `calc(${CONTROL_LABEL_GAP} - var(--pw-space-xs, 4px))`,
        }}
      >
        {label ? (
          <span style={{ ...CONTROL_LABEL_STYLE, marginBottom: 0 }}>
            {safeRenderValue(label)}
          </span>
        ) : (
          <span />
        )}
        {showValue && (
          <span
            style={{
              fontSize: 'var(--pw-font-size-sm, 14px)',
              color: 'var(--pw-color-text-muted, #71717a)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
        )}
      </div>
      <style>{SLIDER_TOUCH_CSS}</style>
      <input
        type="range"
        data-pw-range-touch=""
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        data-pw-value-type="number"
        aria-label={label || undefined}
        style={{
          width: '100%',
          accentColor: 'var(--pw-color-primary, #18181b)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onChange={(e) => {
          const next = Number(e.target.value)
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
        }}
      />
    </div>
  )
}
