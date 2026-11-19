import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { listOf, textOf } from '../../../lib/_shared-utils.js'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface RadioOption {
  readonly value: string
  readonly label: string
}

export interface RadioProps {
  readonly name?: string
  readonly label?: string
  /** `{value, label}` items, or data-bound rows read through `optionValueField` / `optionLabelField`. */
  readonly options: readonly Readonly<Record<string, unknown>>[]
  readonly defaultValue?: string
  /**
   * The value page state holds (`"{{state.<stateKey>}}"`). Wins over
   * `defaultValue`. An unresolved binding is ignored.
   */
  readonly value?: string
  readonly required: boolean
  readonly disabled: boolean
  readonly orientation: 'vertical' | 'horizontal'
  /** Text colour for the group label and option labels. Unset: the surface text token. */
  readonly labelColor?: string
  /** Data-bound options: which keys of a row hold the value and the label. */
  readonly optionValueField: string
  readonly optionLabelField: string
  /** State key the value is written to on change. */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const radioDefinition: BlockDefinition = {
  type: 'radio',
  name: 'Radio',
  category: 'form',
  icon: '◉',
  defaultProps: {
    options: [],
    required: false,
    disabled: false,
    orientation: 'vertical',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 6, lg: 6 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

/** Each option row is at least 44px tall at phone width or on a coarse pointer (WCAG 2.5.8 / R3). */
const RADIO_ROW_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-radio-row] { min-height: 44px; } }'

export const RadioBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  // `value` (bound to state) wins over `defaultValue`; an unresolved binding
  // ("{{state.x}}" before it resolves) is not a value.
  const given = (v: unknown): string | undefined =>
    v === undefined || v === null || (typeof v === 'string' && v.includes('{{')) ? undefined : String(v)
  const p = props as unknown as RadioProps
  const propSelected = given(props.value) ?? given(props.defaultValue) ?? ''
  const [selected, setSelected] = React.useState(propSelected)
  const lastPropSelected = React.useRef(propSelected)
  if (lastPropSelected.current !== propSelected) {
    // A bound defaultValue (`{{record.size}}`) resolves after the first
    // render; a changed prop wins over the last click.
    lastPropSelected.current = propSelected
    setSelected(propSelected)
  }
  const labelId = `${block.id}-label`
  const groupLabel = textOf(p.label) || undefined
  const valueField = p.optionValueField
  const labelField = p.optionLabelField
  const options = listOf<Record<string, unknown>>(p.options).map(
    (o) => ({ value: String(o[valueField] ?? ''), label: String(o[labelField] ?? '') })
  )
  const required = p.required
  const disabled = p.disabled
  const name = p.name ?? block.id + '-radio'
  const orientation = p.orientation
  // Themeable label colour; defaults to the surface text token so the legacy
  // behaviour (hardcoded `var(--pw-color-text)`) is preserved when unset.
  const labelColor = (props.labelColor as string) ?? 'var(--pw-color-text)'
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined

  const groupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: 500,
    color: labelColor,
  }

  const optionsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: orientation === 'horizontal' ? 'row' : 'column',
    gap: orientation === 'horizontal' ? '16px' : '8px',
    flexWrap: 'wrap',
  }

  const optionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    // Options are answers the visitor reads: body size, like the text around them.
    fontSize: 'var(--pw-font-size-base)',
    color: labelColor,
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="radio"
      style={{
        ...groupStyle,
        opacity: disabled ? 0.5 : undefined,
        cursor: disabled ? 'not-allowed' : undefined,
      ...block.style }}
      role="radiogroup"
      aria-labelledby={groupLabel ? labelId : undefined}
      aria-required={required || undefined}
    >
      {groupLabel && <span id={labelId} style={labelStyle}>{groupLabel}</span>}
      {/* A 44px row on a phone or a touch screen: the whole label is the target. */}
      <style>{RADIO_ROW_CSS}</style>
      <div style={optionsStyle}>
        {options.map((opt) => (
          <label key={opt.value} style={optionStyle} data-pw-radio-row="">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected === opt.value}
              required={required}
              disabled={disabled}
              style={{
                width: '16px',
                height: '16px',
                // Checked fill follows the theme primary token (re-skins with
                // the surface; falls back to the UA accent).
                accentColor: 'var(--pw-color-primary)',
                // Tie the unchecked control outline to the label colour so the
                // radio dot stays visible on a dark surface. Defaults to the
                // text token, matching the prior (UA-default) appearance.
                borderColor: labelColor,
                color: labelColor,
              }}
              onChange={() => {
                setSelected(opt.value)
                emit({
                  type: SURFACE_EVENTS.INPUT_CHANGE,
                  surfaceId,
                  blockId: block.id,
                  payload: {
                    value: opt.value,
                    inputId: block.id,
                    name,
                    ...(stateKey ? { action: { type: 'setState', key: stateKey, value: opt.value } } : {}),
                  },
                })
              }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(RadioBlock, { sizing: 'intrinsic' })
