import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { CONTROL_HEIGHT, CONTROL_LABEL_STYLE, safeRenderValue, ICON_PATHS, PRESS_CSS } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface NumberStepperProps {
  readonly name?: string
  readonly label?: string
  readonly min: number
  readonly max: number
  /** Increment of the +/- buttons and the field's `step`. `"any"` accepts every decimal (the buttons then move by 1). */
  readonly step: number | 'any'
  readonly value: number
  readonly disabled: boolean
  /** State key the value is written to on change. */
  readonly stateKey?: string
  /** Accessible names of the two buttons — the visitor's language, not ours. */
  readonly decreaseLabel?: string
  readonly increaseLabel?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const numberStepperDefinition: BlockDefinition = {
  type: 'number-stepper',
  name: 'Number Stepper',
  category: 'form',
  icon: '⊞',
  defaultProps: {
    min: 0,
    max: 100,
    step: 1,
    value: 1,
    disabled: false,
  },
  defaultLayout: { span: { xs: 3, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

const IconGlyph: React.FC<{ name: string }> = ({ name }) => (
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
    dangerouslySetInnerHTML={{ __html: (ICON_PATHS[name] ?? []).join('') }}
  />
)

export const NumberStepperBlock: BlockComponent = ({ props, block }) => {
  const appWords = useAppMessages()
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const p = props as unknown as NumberStepperProps
  const label = safeRenderValue(p.label)
  // A number that is not one (an unresolved binding) falls back, never NaN.
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const min = num(p.min, 0)
  const max = num(p.max, 100)
  const stepAttr: number | 'any' = p.step
  const step = stepAttr === 'any' ? 1 : stepAttr
  const disabled = p.disabled
  const name = p.name
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined
  const decreaseLabel = safeRenderValue(p.decreaseLabel) || messageOf(appWords, 'ui.stepper.decrease', '')
  const increaseLabel = safeRenderValue(p.increaseLabel) || messageOf(appWords, 'ui.stepper.increase', '')

  const clamp = (n: number): number => Math.min(max, Math.max(min, n))
  // Button arithmetic in decimals (0.1 + 0.2) must not print 0.30000000000000004.
  const decimals = (n: number): number => (String(n).split('.')[1] ?? '').length
  const tidy = (n: number): number => Number(n.toFixed(Math.min(10, Math.max(decimals(step), decimals(n)))))
  const propValue = clamp(num(p.value, 1))
  const [value, setValue] = React.useState<number>(propValue)
  // What the field shows while the visitor types: "", "-" or "2." are
  // legitimate half-way states, so they are kept as text and not forced to a
  // number (emptying the field used to jump to `min`).
  const [draft, setDraft] = React.useState<string>(String(propValue))
  const lastPropValue = React.useRef(propValue)
  if (lastPropValue.current !== propValue) {
    // A bound value (`{{record.qty}}`) resolves after the first render.
    lastPropValue.current = propValue
    setValue(propValue)
    setDraft(String(propValue))
  }

  const announce = (next: number): void => {
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

  const commit = (next: number): void => {
    const clamped = tidy(clamp(next))
    setValue(clamped)
    setDraft(String(clamped))
    announce(clamped)
  }

  // At phone width or on a coarse pointer the −/+ buttons and the field are
  // a real 44px box (R3); a fine-pointer desktop keeps the 36px stepper.
  const STEPPER_TOUCH_CSS =
    '@media (max-width: 640px), (pointer: coarse) {' +
    ' [data-pw-step-btn] { width: 44px !important; height: 44px !important; }' +
    ' [data-pw-step-field] { height: 44px !important; } }'

  const btnStyle = (edgeDisabled: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--pw-color-text, #09090b)',
    cursor: edgeDisabled ? 'not-allowed' : 'pointer',
    opacity: edgeDisabled ? 0.4 : 1,
    flexShrink: 0,
  })

  const atMin = disabled || value <= min
  const atMax = disabled || value >= max

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="number-stepper"
      style={{
        display: 'flex',
        flexDirection: 'column',
        // No gap of its own: the label's CONTROL_LABEL_STYLE spaces it from the field.
        width: 'max-content',
        maxWidth: '100%',
        opacity: disabled ? 0.5 : undefined,
        ...block.style,
      }}
    >
      {label ? (
        <span style={CONTROL_LABEL_STYLE}>
          {label}
        </span>
      ) : null}
      <style>{PRESS_CSS + STEPPER_TOUCH_CSS}</style>
      <div
        role="group"
        aria-label={label || undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: '1px solid var(--pw-color-border, #e4e4e7)',
          borderRadius: 'var(--pw-border-radius, 8px)',
          background: 'var(--pw-color-card, #ffffff)',
          overflow: 'hidden',
          // The shared control height, border included; the buttons and the
          // field fill it.
          height: CONTROL_HEIGHT,
          boxSizing: 'border-box',
        }}
      >
        <button data-pw-press=""
          type="button"
          aria-label={decreaseLabel}
          disabled={atMin}
          onClick={() => commit(value - step)}
          style={btnStyle(atMin)}
          data-pw-step-btn=""
        >
          <IconGlyph name="minus" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          name={name}
          data-pw-value-type="number"
          value={draft}
          min={min}
          max={max}
          step={stepAttr}
          disabled={disabled}
          aria-label={label || undefined}
          data-pw-step-field=""
          onChange={(e) => {
            const text = e.target.value
            setDraft(text)
            if (text.trim() === '') return
            const parsed = Number(text)
            if (!Number.isFinite(parsed)) return
            // Not clamped while typing — "1" on the way to "15" with min 10
            // must not jump. The field's own min/max still validate, and blur
            // pulls the value back into range.
            setValue(parsed)
            announce(parsed)
          }}
          onBlur={() => {
            if (draft.trim() === '' || !Number.isFinite(Number(draft))) setDraft(String(value))
            else if (clamp(value) !== value) commit(value)
          }}
          style={{
            width: '48px',
            height: '100%',
            border: 'none',
            borderLeft: '1px solid var(--pw-color-border, #e4e4e7)',
            borderRight: '1px solid var(--pw-color-border, #e4e4e7)',
            background: 'transparent',
            textAlign: 'center',
            fontSize: 'var(--pw-font-size-sm, 14px)',
            color: 'var(--pw-color-text, #09090b)',
            fontVariantNumeric: 'tabular-nums',
            MozAppearance: 'textfield',
          }}
        />
        <button data-pw-press=""
          type="button"
          aria-label={increaseLabel}
          disabled={atMax}
          onClick={() => commit(value + step)}
          style={btnStyle(atMax)}
          data-pw-step-btn=""
        >
          <IconGlyph name="plus" />
        </button>
      </div>
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(NumberStepperBlock, { sizing: 'intrinsic' })
