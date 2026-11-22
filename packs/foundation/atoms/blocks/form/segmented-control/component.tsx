import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, CONTROL_BORDER, MOTION, controlLabelStyle, safeRenderValue, listOf } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

/** A pill is a real 44px-tall box at phone width or on a coarse pointer (R3). */
export const SEGMENT_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-seg-touch] { min-height: 44px; min-width: 44px; } }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface SegmentedControlOption {
  readonly label: string
  /** Text, or a real boolean/number: `{label:"Yes", value:true}`. */
  readonly value: string | number | boolean
  /** Optional colour swatch dot before the label (dial/strap/theme pickers). */
  readonly color?: string
}

export interface SegmentedControlProps {
  readonly name?: string
  /**
   * The question the pills answer: the radiogroup's accessible name. With no
   * label the group has no name — never the made-up "Segmented control".
   */
  readonly label: string
  /** Keep the label as the accessible name but do not show it. */
  readonly hideLabel?: boolean
  /** No sample options: with no options the control draws nothing. */
  readonly options: readonly SegmentedControlOption[]
  /** The selected value. `null` with `allowNone` (or a one-option control) means nothing selected. */
  readonly value?: string | number | boolean | null
  /** `text`: the option value as text. `boolean`: real booleans. Unset: `boolean` when every option value is one. */
  readonly valueType?: 'text' | 'boolean'
  /** Nothing selected until the visitor picks. Unset: on for a ONE-option control, off otherwise. */
  readonly allowNone?: boolean
  readonly size: 'sm' | 'md'
  /** Narrow screens: the pills wrap (default); `false` keeps one row that scrolls. */
  readonly wrap: boolean
  /** State key the selected value is written to. */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const segmentedControlDefinition: BlockDefinition = {
  type: 'segmented-control',
  name: 'Segmented Control',
  category: 'form',
  icon: '▤',
  defaultProps: {
    label: '',
    options: [],
    size: 'md',
  },
  defaultLayout: { span: { xs: 4, sm: 6, md: 4, lg: 4 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

/** The chosen pill: badge-primary's language — filled, on-primary ink, 2px ink edge. */
export const SEGMENT_SELECTED: React.CSSProperties = {
  background: 'var(--pw-color-primary, #18181b)',
  color: 'var(--pw-color-text-on-primary, #ffffff)',
  boxShadow: 'inset 0 0 0 2px var(--pw-color-primary-ink, var(--pw-color-primary, #18181b))',
}
/** The other pills: the track shows through, muted ink. */
export const SEGMENT_IDLE: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--pw-color-text-muted, #71717a)',
  boxShadow: 'none',
}

interface Option {
  label: string
  value: string
  color?: string
}

/** A value as the text a form field carries: `true` → "true", 2 → "2", null → "". */
function asText(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

/** "true" / "false" as booleans; any other text stays text. */
function asBoolean(v: string): boolean | string {
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

export const SegmentedControlBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const p = props as unknown as SegmentedControlProps
  const label = p.label
  const hideLabel = p.hideLabel === true
  const labelId = `${block.id}-label`
  const size = p.size
  const name = p.name
  // Option values are compared as TEXT. A composed app often writes a yes/no
  // control as `{value: true}` / `value: false` — booleans that never equalled
  // anything, so no pill looked selected.
  const rawOptions = listOf<Option & { value: unknown }>(p.options)
  const options: Option[] = rawOptions.map((o) => ({ ...o, value: asText(o.value) }))
  const booleanMode =
    props.valueType === 'boolean' ||
    (props.valueType !== 'text' && rawOptions.length > 0 && rawOptions.every((o) => typeof o.value === 'boolean'))
  const allowNone = typeof props.allowNone === 'boolean' ? props.allowNone : options.length === 1
  /** The value as it leaves the control: text, a real boolean, or "nothing". */
  const outward = (v: string | null): string | boolean | null =>
    v === null ? (booleanMode ? null : '') : booleanMode ? asBoolean(v) : v

  /**
   * THE SELECTED VALUE IS ALWAYS ONE OF THE OPTIONS — the one the visitor sees.
   *
   * A value that matches no option (the LABEL written as the value, "Yes"
   * for `{label:"Yes", value:"true"}`) lit no pill, yet was submitted as it
   * stood. A value given as a binding (`{{state.x}}`) arrives resolved AFTER
   * the first render; it was ignored because the local state was seeded once.
   * Now: match by value, then by label; nothing matches → the first option
   * (or NOTHING, with `allowNone`); and a new `value` prop re-selects.
   */
  const resolveValue = (raw: unknown): string | null => {
    const text = asText(raw)
    const given = raw !== undefined && raw !== null
    const byValue = given ? options.find((o) => o.value === text) : undefined
    if (byValue) return byValue.value
    const byLabel = text ? options.find((o) => asText(o.label) === text) : undefined
    if (byLabel) return byLabel.value
    if (allowNone) return null
    return options[0]?.value ?? text
  }
  // An unresolved binding ("{{state.day}}" before it resolves) is NOT a value:
  // it matched no option, so the control showed — and SEEDED — the first
  // option, overwriting the answer page state already held (a wizard step
  // hidden and shown again lost the visitor's choice).
  const unresolved = typeof props.value === 'string' && props.value.includes('{{')
  const propValue = resolveValue(unresolved ? undefined : props.value)
  const [value, setValue] = React.useState<string | null>(propValue)
  const lastPropValue = React.useRef(propValue)
  if (lastPropValue.current !== propValue) {
    // A changed prop wins over the last click — setState during render is
    // React's documented "adjust state when a prop changes" pattern.
    lastPropValue.current = propValue
    setValue(propValue)
  }

  // `stateKey`: the change carries a declarative `setState` action, so a data
  // source whose query filter reads `{{state.<stateKey>}}` re-fetches. The
  // control becomes the filter of a list, not a pill row that remembers a click.
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined
  const report = (selected: string | null, seed: boolean): void => {
    const next = outward(selected)
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: {
        value: next,
        inputId: block.id,
        name,
        ...(seed ? { seed: true } : {}),
        ...(stateKey ? { action: { type: 'setState', key: stateKey, value: next } } : {}),
      },
    })
  }
  const select = (picked: string): void => {
    // With allowNone, the lit pill clicked again clears the answer.
    const next = allowNone && picked === value ? null : picked
    setValue(next)
    report(next, false)
  }

  // THE PRESELECTED VALUE SEEDS STATE. A list filtered by `{{state.<key>}}`
  // read an unset key until the first click, while the control already showed
  // a lit pill — the filter and the pill disagreed. On
  // mount, and whenever the resolved initial value changes, the value the
  // visitor sees is written to the state key. `seed: true` marks it.
  React.useEffect(() => {
    if (!stateKey || options.length === 0 || unresolved) return
    report(propValue, true)
  }, [stateKey, propValue, options.length, unresolved])

  // A form reset (form.resetWhen, or a reset button) returns the control to
  // its initial value — its hidden input is React-owned, so the native reset
  // alone would leave the pill and the submitted value on the old choice.
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const initialRef = React.useRef(propValue)
  initialRef.current = propValue
  React.useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return
    const onReset = (): void => {
      setValue(initialRef.current)
      if (stateKey) report(initialRef.current, true)
    }
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [stateKey])

  const wrap = p.wrap
  const buttonsRef = React.useRef<Array<HTMLButtonElement | null>>([])
  if (options.length === 0) return null

  // RADIOGROUP KEYBOARD (WAI-ARIA radio group): one Tab stop — the lit pill,
  // or the first when nothing is lit — and the arrows, Home and End move the
  // choice and the focus together.
  const activeIndex = options.findIndex((o) => o.value === value)
  const tabStop = activeIndex >= 0 ? activeIndex : 0
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const from = activeIndex >= 0 ? activeIndex : 0
    let to: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (from + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (from - 1 + options.length) % options.length
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = options.length - 1
    if (to === null) return
    e.preventDefault()
    const picked = options[to]!.value
    if (picked !== value) {
      setValue(picked)
      report(picked, false)
    }
    buttonsRef.current[to]?.focus()
  }

  // On a phone or a touch screen each pill is a REAL 44px-tall box
  // (SEGMENT_TOUCH_CSS): auditors measure the box, and the invisible ::after hit
  // area alone did not count. A fine-pointer desktop keeps the compact pill.
  const pad = size === 'sm' ? '4px 10px' : '6px 14px'
  const fontSize = size === 'sm' ? 'var(--pw-font-size-xs, 12px)' : 'var(--pw-font-size-sm, 14px)'
  const hidden: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      ref={rootRef}
      id={block.id}
      data-block-id={block.id}
      data-block-type="segmented-control"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pw-space-xs, 4px)',
        width: 'max-content',
        // Narrow screens: the pill row keeps its labels and scrolls inside
        // itself instead of pushing the row wider than the viewport (measured on
        // density-dashboard at 390px: "Storm" clipped). The block
        // is intrinsic, so the wrapper only shrinks when the author lets it
        // (style.flex '0 1 auto' / minWidth 0); with that hint this scroll is
        // what the visitor sees.
        // NEVER WIDER THAN ITS COLUMN. The runtime keeps an intrinsic block
        // in a row at its content width (flex 0 0 auto), so `100%` of that
        // wrapper constrained nothing: four device states measured 431px in a
        // 358px phone column and "Unknown" was clipped. The viewport cap holds
        // whatever the wrapper does; the pills wrap inside it.
        maxWidth: 'min(100%, calc(100vw - 2 * var(--pw-space-md, 16px)))',
        minWidth: 0,
        boxSizing: 'border-box',
        ...(wrap ? {} : { overflowX: 'auto' as const }),
        ...block.style,
      }}
    >
      {/* A form gathers its values with `new FormData(form)`, and the pills are
          buttons, so a named control inside a form was never submitted — the
          RSVP yes/no answer was lost and the "coming" counter stayed at 0.
          The hidden input carries the value the visitor
          SEES, touched or not. Same pattern as form.date-input. */}
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value ?? ''}
          {...(booleanMode ? { 'data-pw-value-type': 'boolean' } : {})}
        />
      ) : null}
      {label && (
        <span
          id={labelId}
          // The one label of every form control (it was an inline span, 2px off a text field's).
          style={hideLabel ? hidden : controlLabelStyle('var(--pw-space-xs, 4px)')}
        >
          {safeRenderValue(label)}
        </span>
      )}
      <style>{HIT_AREA_CSS + SEGMENT_TOUCH_CSS}</style>
      <div
        role="radiogroup"
        {...(label ? { 'aria-labelledby': labelId } : {})}
        onKeyDown={onKeyDown}
        style={{
          display: 'inline-flex',
          maxWidth: '100%',
          boxSizing: 'border-box',
          flexWrap: wrap ? 'wrap' : 'nowrap',
          alignItems: 'center',
          gap: '2px',
          padding: '3px',
          background: 'var(--pw-color-background, #ffffff)',
          // The control edge, not the divider colour.
          border: `1px solid ${CONTROL_BORDER}`,
          borderRadius: 'var(--pw-border-radius, 8px)',
        }}
      >
        {options.map((opt, i) => {
          const active = opt.value === value
          return (
            <button
              key={`${opt.value}-${i}`}
              ref={(el) => {
                buttonsRef.current[i] = el
              }}
              type="button"
              data-pw-hit=""
              data-pw-seg-touch=""
              role="radio"
              aria-checked={active}
              tabIndex={i === tabStop ? 0 : -1}
              onClick={() => select(opt.value)}
              style={{
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: pad,
                fontSize,
                // Pills are <button>s: without this they draw in the UA font.
                fontFamily: 'inherit',
                fontWeight: 500,
                borderRadius: 'var(--pw-border-radius-sm, 6px)',
                whiteSpace: 'nowrap',
                // THE SELECTED PILL IS FILLED. It was an accent-subtle
                // wash with a primary-ink label: 1.10/1.19:1 from its neighbours,
                // and the label fell to 4.22:1 in the derived dark mode. Now it
                // speaks badge-primary: the brand fill with the theme's
                // on-primary ink and a 2px primary-ink edge (≥ 4.5:1 against the
                // ground by the cascade), so the shape clears 3:1 against the
                // track and the unselected pills in every preset, light and dark.
                ...(active ? SEGMENT_SELECTED : SEGMENT_IDLE),
                transition: `background-color ${MOTION.normal}, color ${MOTION.normal}, box-shadow ${MOTION.normal}`,
                outlineColor: 'var(--pw-focus-ring-color, var(--pw-color-primary, #18181b))',
              }}
            >
              {opt.color ? (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '999px',
                    backgroundColor: opt.color,
                    border: '1px solid var(--pw-color-border, #e4e4e7)',
                    marginRight: '6px',
                    verticalAlign: 'middle',
                  }}
                />
              ) : null}
              {safeRenderValue(opt.label)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(SegmentedControlBlock, { sizing: 'intrinsic' })
