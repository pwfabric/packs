import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { CONTROL_BORDER, textOf } from '../../../lib/_shared-utils.js'

/** The closed select is a real 44px-tall box at phone width or on a coarse pointer (R3). */
const SELECT_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-select-touch] { min-height: 44px; } }'

/** `hideLabel`: off screen, still the accessible name. */
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface SelectOption {
  readonly value: string
  readonly label: string
}

export interface SelectProps {
  readonly name?: string
  readonly label?: string
  /** The label stays the accessible name but is not drawn. Without a label the select is named by its placeholder, else its `name`. */
  readonly hideLabel?: boolean
  /** No default: "Select an option..." reached visitors in every language. */
  readonly placeholder?: string
  /** `{label, value}` objects, plain strings or numbers, or rows whose keys `labelKey`/`valueKey` name. */
  readonly options: readonly unknown[]
  /** The field of each bound row holding the label / the value (a dotted path reaches a nested field). */
  readonly labelKey?: string
  readonly valueKey?: string
  /** form.radio's names for `valueKey` / `labelKey` — both work. */
  readonly optionValueField?: string
  readonly optionLabelField?: string
  /** The option selected when the field mounts. A multi-select takes an array or a comma-separated string. */
  readonly defaultValue?: string | number | readonly (string | number)[]
  readonly required: boolean
  readonly disabled: boolean
  readonly multiple: boolean
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const selectDefinition: BlockDefinition = {
  type: 'select',
  name: 'Select',
  category: 'form',
  icon: '▼',
  defaultProps: {
    options: [],
    required: false,
    disabled: false,
    multiple: false,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 4, lg: 6 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

const asText = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''

/** A field by name, or by a dotted path into nested objects ("data.name"). */
function pick(rec: Record<string, unknown>, key: string | undefined): unknown {
  if (!key) return undefined
  if (key in rec) return rec[key]
  let cur: unknown = rec
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/**
 * Every accepted option shape as `{value,label}`. `["A","B"]` used to render as
 * empty options — a silently wrong shape.
 *
 * A row bound straight from a source rarely has both `value` and `label`: the
 * value falls back to `id`, the label to `name` then `title`, and each side
 * to the other — an option `{label:"Red"}` submits "Red", not "".
 */
export function normaliseOptions(
  raw: unknown,
  valueField?: string,
  labelField?: string
): { value: string; label: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { value: string; label: string }[] = []
  for (const o of raw) {
    if (typeof o === 'string' || typeof o === 'number' || typeof o === 'boolean') {
      out.push({ value: asText(o), label: asText(o) })
      continue
    }
    if (o === null || typeof o !== 'object') continue
    const rec = o as Record<string, unknown>
    const rawValue = asText(pick(rec, valueField) ?? rec.value ?? rec.id)
    const rawLabel = asText(pick(rec, labelField) ?? rec.label ?? rec.name ?? rec.title)
    const value = rawValue || rawLabel
    const label = rawLabel || value
    if (value === '' && label === '') continue
    out.push({ value, label })
  }
  return out
}

function selectDefault(raw: unknown, multiple: boolean): string | string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (multiple) {
    const list = Array.isArray(raw) ? raw : asText(raw).split(',')
    return list.map((v) => asText(v).trim()).filter((v) => v !== '')
  }
  return Array.isArray(raw) ? asText(raw[0]) : asText(raw)
}

export const SelectBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as SelectProps
  const label = textOf(p.label) || undefined
  const hideLabel = props.hideLabel === true
  const placeholder = typeof props.placeholder === 'string' ? props.placeholder : ''
  const options = normaliseOptions(
    props.options,
    ((props.optionValueField ?? props.valueKey) as string | undefined) || undefined,
    ((props.optionLabelField ?? props.labelKey) as string | undefined) || undefined
  )
  const required = p.required
  const disabled = p.disabled
  const multiple = p.multiple
  const name = props.name as string | undefined
  // No label: the select is still named — by its placeholder, else its name.
  const fallbackName = placeholder.trim() || (typeof name === 'string' ? name.trim() : '') || undefined
  // Keyed remount, same as form.input: a bound defaultValue resolves after the
  // first render and React ignores defaultValue changes on a mounted select.
  const defaultValue = selectDefault(props.defaultValue, multiple)
  // THE EMPTY OPTION is drawn only when it means something: a placeholder to
  // read ("Choose a kit"), or nothing chosen yet (no default among the
  // options — without it the browser would silently pick the first option).
  // A select with a chosen value and no placeholder lists only its options.
  const chosen = typeof defaultValue === 'string' && defaultValue !== '' && options.some((o) => o.value === defaultValue)
  const showEmpty = !multiple && (placeholder.trim() !== '' || !chosen)
  // The key also counts how much of the default the options hold: a bound
  // value that resolves BEFORE its bound options mounted a select with no
  // matching option (the browser picked another), and options arriving later
  // did not change the key, so the choice was lost. It remounts once more when
  // the options come to contain the value, and never on options that only
  // re-arrive, so a visitor's own choice stays.
  const wanted = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : []
  const present = wanted.filter((v) => options.some((o) => o.value === v)).length
  const remountKey = `${Array.isArray(defaultValue) ? defaultValue.join('\u0000') : (defaultValue ?? '')}\u0001${present}`

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: 500,
    color: 'var(--pw-color-text)',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: multiple ? '8px 12px' : '8px 36px 8px 12px',
    // The control edge and the theme radius.
    border: `1px solid ${CONTROL_BORDER}`,
    borderRadius: 'var(--pw-border-radius)',
    fontSize: 'var(--pw-font-size-sm)',
    fontFamily: 'inherit',
    color: 'var(--pw-color-text)',
    backgroundColor: 'var(--pw-color-card)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    // The native arrow is removed for a consistent look — and a chevron is drawn
    // in its place (below). Without it the select read as a text box.
    appearance: 'none',
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="select"
      style={{
        display: 'flex',
        flexDirection: 'column',
        opacity: disabled ? 0.5 : undefined,
        cursor: disabled ? 'not-allowed' : undefined,
      ...block.style }}
    >
      {label && (
        <label htmlFor={block.id + '-select'} style={hideLabel ? VISUALLY_HIDDEN : labelStyle}>
          {label}
          {required && <span style={{ color: 'var(--pw-color-error)', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      <style>{SELECT_TOUCH_CSS}</style>
      <div style={{ position: 'relative' }}>
      <select
        data-pw-select-touch=""
        aria-label={label ? undefined : fallbackName}
        key={remountKey}
        id={block.id + '-select'}
        defaultValue={defaultValue}
        name={name}
        style={selectStyle}
        required={required}
        disabled={disabled}
        multiple={multiple}
        onChange={(e) => {
          // `stateKey` mirrors form.segmented-control exactly: the change
          // carries a declarative `setState`, so a data source whose query
          // reads `{{state.<stateKey>}}` re-fetches. Without it a dropdown
          // could only ever be a form field — measured, which is
          // why no pattern could bind a sort control to its own results.
          const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined
          // A multi-select changes a SET of values; `e.target.value` is only the first.
          const changed = multiple
            ? Array.from(e.target.selectedOptions, (o) => o.value)
            : e.target.value
          emit({
            type: SURFACE_EVENTS.INPUT_CHANGE,
            surfaceId,
            blockId: block.id,
            payload: {
              value: changed,
              inputId: block.id,
              name,
              ...(stateKey ? { action: { type: 'setState', key: stateKey, value: changed } } : {}),
            },
          })
        }}
      >
        {showEmpty && <option value="">{placeholder}</option>}
        {options.map((opt, i) => (
          <option key={`${opt.value}-${i}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {multiple ? null : (
        <svg
          aria-hidden="true"
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--pw-color-text-muted)',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
      </div>
    </div>
  )
}
