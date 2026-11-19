import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface CheckboxProps {
  readonly name?: string
  readonly label?: string
  readonly checked: boolean
  readonly required: boolean
  readonly disabled: boolean
  /**
   * Omitted (or 'on'): a BOOLEAN field — the form receives "true"/"false"
   * under `name`. Given: a checkbox GROUP member — `value` is submitted only
   * while checked (several boxes may share one `name`).
   */
  readonly value?: string
  /** State key the checked state (a boolean) is written to on change. */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const checkboxDefinition: BlockDefinition = {
  type: 'checkbox',
  name: 'Checkbox',
  category: 'form',
  icon: '☑',
  defaultProps: {
    checked: false,
    required: false,
    disabled: false,
  },
  defaultLayout: { span: { xs: 4, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * At phone width or on a coarse pointer (WCAG 2.5.8 / R3) the whole row — box
 * and label, one <label> — is at least 44px tall, so the target is the row and
 * not the 16px box; the box itself grows to 24px (WCAG 2.5.8's minimum target)
 * so it is easy to see and hit.
 */
const ROW_HIT_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-row-hit] { min-height: 44px !important; }' +
  ' [data-pw-check-box] { width: 24px !important; height: 24px !important; } }'

export const CheckboxBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as CheckboxProps
  const propChecked = p.checked
  const [checked, setChecked] = React.useState(propChecked)
  const lastPropChecked = React.useRef(propChecked)
  if (lastPropChecked.current !== propChecked) {
    // A bound `checked` resolves after the first render: a changed prop wins
    // over the last click (React's "adjust state when a prop changes").
    lastPropChecked.current = propChecked
    setChecked(propChecked)
  }
  const label = safeRenderValue(props.label)
  const required = p.required
  const disabled = p.disabled
  const name = typeof props.name === 'string' && props.name ? props.name : undefined
  const rawValue = typeof props.value === 'string' ? props.value : undefined
  // Boolean field unless an explicit group value is given: `"on"` or
  // nothing reached the backend, and a required boolean always failed.
  const booleanMode = rawValue === undefined || rawValue === '' || rawValue === 'on'
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--pw-font-size-sm)',
    color: 'var(--pw-color-text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    userSelect: 'none',
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="checkbox"
      style={{ opacity: disabled ? 0.5 : undefined, cursor: disabled ? 'not-allowed' : undefined , ...block.style }}
    >
      {booleanMode && name ? (
        <input type="hidden" name={name} value={checked ? 'true' : 'false'} data-pw-value-type="boolean" disabled={disabled} />
      ) : null}
      {/* A 44px row on a phone or a touch screen: the whole label is the target. */}
      <style>{ROW_HIT_CSS}</style>
      <label style={containerStyle} data-pw-row-hit="">
        <input
          type="checkbox"
          // Its own id: a refused submit links the field's message by
          // `<id>-error`, so two boxes never share one generic "field-error".
          id={`${block.id}-box`}
          name={booleanMode ? undefined : name}
          value={booleanMode ? undefined : rawValue}
          checked={checked}
          required={required}
          disabled={disabled}
          data-pw-check-box=""
          style={{
            flexShrink: 0,
            margin: 0,
            width: '16px',
            height: '16px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            // Drive the native checked fill from the theme primary token so the
            // control re-skins with the surface (falls back to the UA accent).
            accentColor: 'var(--pw-color-primary)',
          }}
          onChange={(e) => {
            const next = e.target.checked
            setChecked(next)
            emit({
              type: SURFACE_EVENTS.INPUT_CHANGE,
              surfaceId,
              blockId: block.id,
              payload: {
                value: next,
                inputId: block.id,
                checked: next,
                name,
                ...(booleanMode ? {} : { controlValue: rawValue }),
                ...(stateKey ? { action: { type: 'setState', key: stateKey, value: next } } : {}),
              },
            })
          }}
        />
        {label ? (
          <span style={labelStyle}>
            {label}
            {/* The same required mark the text fields carry. */}
            {required ? <span style={{ color: 'var(--pw-color-error)' }} aria-hidden="true"> *</span> : null}
          </span>
        ) : null}
      </label>
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(CheckboxBlock, { sizing: 'intrinsic' })
