import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { CONTROL_BORDER, textOf } from '../../../lib/_shared-utils.js'

/** The one-line field is a real 44px-tall box at phone width or on a coarse pointer (R3). */
const INPUT_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-input-touch] { min-height: 44px; } }'

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
// ICON PATHS (affix slots)
// ============================================================

/**
 * Lucide-style SVG path data for the input affix icons. This mirrors the
 * canonical `ICON_PATHS` map generated into this pack's `_shared-utils.ts`
 * (which the control.icon block imports). The input affix only needs a
 * handful of glyphs and is kept self-contained for offline bundling, so that
 * subset is inlined here. Keep entries in sync with `_shared-utils.ts`.
 */
const INPUT_ICON_PATHS: Record<string, string[]> = {
  search: [
    '<path d="m21 21-4.34-4.34"/>',
    '<circle cx="11" cy="11" r="8"/>',
  ],
  check: ['<path d="M20 6 9 17l-5-5"/>'],
  x: [
    '<path d="M18 6 6 18"/>',
    '<path d="m6 6 12 12"/>',
  ],
  mail: [
    '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>',
    '<rect x="2" y="4" width="20" height="16" rx="2"/>',
  ],
  lock: [
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>',
    '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  ],
  eye: [
    '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>',
    '<circle cx="12" cy="12" r="3"/>',
  ],
  user: [
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>',
    '<circle cx="12" cy="7" r="4"/>',
  ],
  phone: ['<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>'],
  calendar: [
    '<path d="M8 2v4"/>',
    '<path d="M16 2v4"/>',
    '<rect width="18" height="18" x="3" y="4" rx="2"/>',
    '<path d="M3 10h18"/>',
  ],
  bell: [
    '<path d="M10.268 21a2 2 0 0 0 3.464 0"/>',
    '<path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  ],
  globe: [
    '<circle cx="12" cy="12" r="10"/>',
    '<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>',
    '<path d="M2 12h20"/>',
  ],
}

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const INPUT_TYPES = [
  'text',
  'email',
  'password',
  'number',
  'tel',
  'url',
  'search',
  'date',
  'time',
  'datetime-local',
  'textarea',
  // A carry field: no label, no box, nothing on screen — its value
  // (defaultValue, or a bound value) is submitted with the form.
  'hidden',
] as const
export type InputType = (typeof INPUT_TYPES)[number]

export interface InputProps {
  readonly type: InputType
  readonly name?: string
  readonly label?: string
  /** The label stays the accessible name but is not drawn. Without a label the field is named by its placeholder, else its `name`. */
  readonly hideLabel?: boolean
  /** No default: "Enter value..." reached visitors in every language. */
  readonly placeholder?: string
  readonly required: boolean
  readonly disabled: boolean
  readonly minLength?: number
  readonly maxLength?: number
  /** Numbers for type=number, ISO strings for date/time types. */
  readonly min?: number | string
  readonly max?: number | string
  /** Granularity of a number/date/time value — a number, or "any" (a price like 12.50). */
  readonly step?: number | 'any'
  readonly pattern?: string
  /** What the visitor reads when the text does not match `pattern`, in human words. */
  readonly patternMessage?: string
  /**
   * What the browser may fill in (`autocomplete`). Unset: a password field is
   * `current-password` (`new-password` inside a form that registers), an
   * e-mail field `email`, a phone field `tel`.
   */
  readonly autocomplete?: string
  readonly rows?: number
  readonly leadingIcon?: string
  readonly trailingIcon?: string
  /** Surface state key this field writes on change (a data source reading `{{state.<key>}}` re-queries). */
  readonly stateKey?: string
  /** The value page state holds for this field (`"{{state.q}}"` beside `"stateKey": "q"`). */
  readonly value?: string | number
  /** Initial value — expression-bindable; submitted with the form. */
  readonly defaultValue?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const inputDefinition: BlockDefinition = {
  type: 'input',
  name: 'Input',
  category: 'form',
  icon: '▭',
  defaultProps: {
    type: 'text',
    required: false,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 4, lg: 6 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

export const InputBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as InputProps
  const inputType: string = p.type
  const isTextarea = inputType === 'textarea'
  const label = textOf(p.label) || undefined
  const hideLabel = props.hideLabel === true
  // No label: the field is still named — by its placeholder, else its name.
  const fallbackName =
    (typeof props.placeholder === 'string' && props.placeholder.trim()) ||
    (typeof props.name === 'string' && props.name.trim()) ||
    undefined
  const required = p.required
  const disabled = p.disabled
  // Expression-bound defaultValue resolves AFTER first mount (data arrives on a
  // later render), but React ignores defaultValue changes on a mounted
  // uncontrolled input — so the inner element is KEYED by the value, forcing a
  // remount when it resolves. Untouched (undefined) → key '' → no behavioural
  // change for existing usages.
  const defaultValue = props.defaultValue as string | undefined

  // The <input>'s own id. NOT `block.id`: the runtime's block wrapper already
  // carries `id={block.id}` (it is the in-page anchor), so `htmlFor={block.id}`
  // pointed the label at the wrapper <div> and the field had no accessible
  // name. Repeated copies are unique because the runtime suffixes every cloned
  // block id (`--<index>`).
  const fieldId = `${block.id}-field`

  // `value` (bound to `{{state.<stateKey>}}`): the field follows its state key
  // without being controlled by it. Every value this field emits is remembered
  // until its echo comes back as `value`; an incoming value that is NOT one of
  // those echoes was set from outside and is written into the element. Typing
  // therefore never remounts the field nor fights the caret, and a stale echo
  // (state lagging a fast typist) is skipped rather than undoing a keystroke.
  const fieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const pendingEchoes = React.useRef<string[]>([])
  const rawValue = props.value as string | number | undefined
  // An unresolved binding ("{{state.q}}" before state exists) is not a value.
  const stateValue =
    rawValue === undefined || rawValue === null || (typeof rawValue === 'string' && rawValue.includes('{{'))
      ? undefined
      : String(rawValue)
  React.useEffect(() => {
    if (stateValue === undefined) return
    const echo = pendingEchoes.current.indexOf(stateValue)
    if (echo >= 0) {
      pendingEchoes.current.splice(0, echo + 1)
      return
    }
    pendingEchoes.current = []
    const el = fieldRef.current
    if (el && el.value !== stateValue) el.value = stateValue
  }, [stateValue])

  // Affix icons only apply to single-line inputs (a textarea has no vertical
  // center to align a glyph to). Resolve the named icon to its SVG paths;
  // unknown names render nothing rather than a fallback glyph.
  const leadingIconName = props.leadingIcon as string | undefined
  const trailingIconName = props.trailingIcon as string | undefined
  const leadingPaths = !isTextarea && leadingIconName ? INPUT_ICON_PATHS[leadingIconName] : undefined
  const trailingPaths = !isTextarea && trailingIconName ? INPUT_ICON_PATHS[trailingIconName] : undefined
  const hasLeading = Boolean(leadingPaths)
  const hasTrailing = Boolean(trailingPaths)

  const ICON_SIZE = 18
  const ICON_GUTTER = 36 // icon box + symmetric padding so text never overlaps

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    // Reserve horizontal room for any affix icon so the text/placeholder does
    // not slide under the glyph.
    ...(hasLeading ? { paddingLeft: `${ICON_GUTTER}px` } : {}),
    ...(hasTrailing ? { paddingRight: `${ICON_GUTTER}px` } : {}),
    // `--pw-border` is not a defined appearance token (only `--pw-color-border`,
    // `--pw-border-radius`, `--pw-border-width`, `--pw-border-style` exist), so
    // the old `var(--pw-border)` resolved to nothing and the field rendered with
    // no visible box. Use the same explicit border as select/textarea.
    // The CONTROL edge, not the divider colour: --pw-color-border measured
    // 1.16–1.72:1 on the ground, and this edge is the only sign of the field
    // (WCAG 1.4.11).
    border: `1px solid ${CONTROL_BORDER}`,
    borderRadius: 'var(--pw-border-radius)',
    fontSize: 'var(--pw-font-size-base)',
    // Form controls do not inherit the page font (UA sheet) — same as button.
    fontFamily: 'inherit',
    backgroundColor: 'var(--pw-color-card)',
    color: 'var(--pw-color-text)',
    // No `outline: 'none'` — it erased the runtime's focus ring, so a keyboard
    // visitor could not see which field had focus.
    // Layer 4: block-level style overrides
    ...block.style,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: 500,
    color: 'var(--pw-color-text)',
  }

  // `patternMessage`: the field's own message replaces the browser's
  // "Please match the requested format." whenever the text misses `pattern`.
  // form.form shows `validationMessage` under the field, so setting the
  // custom validity is all it takes; it is cleared and re-judged on each change.
  const patternMessage = typeof props.patternMessage === 'string' && props.patternMessage ? props.patternMessage : undefined
  const syncPatternMessage = (el: HTMLInputElement | HTMLTextAreaElement | null): void => {
    if (!el || !patternMessage || !('setCustomValidity' in el)) return
    el.setCustomValidity('')
    if (el.validity?.patternMismatch) el.setCustomValidity(patternMessage)
  }
  React.useEffect(() => {
    syncPatternMessage(fieldRef.current)
  })

  // A password field asks for the saved password, or a new one inside a form
  // that registers (form.form marks it `data-pw-auth="register"`).
  const explicitAutocomplete = typeof props.autocomplete === 'string' && props.autocomplete.trim() ? props.autocomplete.trim() : undefined
  const autocomplete =
    explicitAutocomplete ??
    (inputType === 'password' ? 'current-password' : inputType === 'email' ? 'email' : inputType === 'tel' ? 'tel' : undefined)
  React.useEffect(() => {
    const el = fieldRef.current
    if (explicitAutocomplete || inputType !== 'password' || !(el instanceof HTMLInputElement)) return
    el.autocomplete = el.form?.getAttribute('data-pw-auth') === 'register' ? 'new-password' : 'current-password'
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement
    syncPatternMessage(target)
    if (typeof props.stateKey === 'string' && props.stateKey && stateValue !== undefined) {
      pendingEchoes.current.push(target.value)
      if (pendingEchoes.current.length > 50) pendingEchoes.current.shift()
    }
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: {
        value: target.value,
        inputId: block.id,
        name: props.name,
        ...(typeof props.stateKey === 'string' && props.stateKey
          ? { action: { type: 'setState', key: props.stateKey, value: target.value } }
          : {}),
      },
    })
  }

  // An affix icon is absolutely positioned over the field, vertically centred,
  // and non-interactive so clicks fall through to the input.
  const affixStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [side]: '12px',
    width: `${ICON_SIZE}px`,
    height: `${ICON_SIZE}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--pw-color-text-muted)',
    pointerEvents: 'none',
  })

  const renderAffix = (paths: string[], side: 'left' | 'right'): React.ReactElement => (
    <span style={affixStyle(side)} aria-hidden="true" data-affix={side === 'left' ? 'leading' : 'trailing'}>
      <svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: paths.join('') }}
      />
    </span>
  )

  // A HIDDEN CARRY FIELD HIDES WHOLE. `type: "hidden"` — or the older
  // `style.display: "none"` — used to hide only the box, so its label stayed
  // on screen as an orphan ("Treatment", "Day" with nothing under them).
  if (inputType === 'hidden') {
    return (
      <div data-block-id={block.id} data-block-type="input" hidden style={{ display: 'none' }}>
        <input
          key={defaultValue ?? ''}
          ref={(el) => {
            fieldRef.current = el
          }}
          id={fieldId}
          type="hidden"
          name={props.name as string}
          defaultValue={defaultValue ?? stateValue}
        />
      </div>
    )
  }
  const wholeHidden = block.style?.display === 'none'

  return (
    <div
      data-block-id={block.id}
      style={{
        // A hidden label is absolutely positioned: it stays inside the field's box.
        position: 'relative',
        opacity: disabled ? 0.5 : undefined,
        cursor: disabled ? 'not-allowed' : undefined,
        ...(wholeHidden ? { display: 'none' } : {}),
      }}
    >
      {isTextarea ? null : <style>{INPUT_TOUCH_CSS}</style>}
      {label && (
        <label htmlFor={fieldId} style={hideLabel ? VISUALLY_HIDDEN : labelStyle}>
          {label}
          {required && <span style={{ color: 'var(--pw-color-error)' }}> *</span>}
        </label>
      )}
      {isTextarea ? (
        <textarea
          key={defaultValue ?? ''}
          ref={(el) => {
            fieldRef.current = el
          }}
          id={fieldId}
          name={props.name as string}
          defaultValue={defaultValue ?? stateValue}
          placeholder={(props.placeholder as string) || undefined}
          required={required}
          disabled={disabled}
          style={inputStyle}
          onChange={handleChange}
          data-block-type="input"
          aria-label={label ? undefined : fallbackName}
          rows={(props.rows as number) ?? 4}
        />
      ) : (
        <div style={{ position: 'relative', display: 'block' }}>
          {leadingPaths && renderAffix(leadingPaths, 'left')}
          <input
            key={defaultValue ?? ''}
            ref={(el) => {
              fieldRef.current = el
            }}
            id={fieldId}
            type={inputType}
            name={props.name as string}
            defaultValue={defaultValue ?? stateValue}
            placeholder={(props.placeholder as string) || undefined}
            required={required}
            disabled={disabled}
            style={inputStyle}
            onChange={handleChange}
            data-block-type="input"
            data-pw-input-touch=""
            aria-label={label ? undefined : fallbackName}
            minLength={props.minLength as number}
            maxLength={props.maxLength as number}
            min={props.min as number | string | undefined}
            max={props.max as number | string | undefined}
            step={props.step as number | 'any' | undefined}
            inputMode={inputType === 'number' && props.step !== undefined && props.step !== 1 ? 'decimal' : undefined}
            pattern={props.pattern as string}
            autoComplete={autocomplete}
          />
          {trailingPaths && renderAffix(trailingPaths, 'right')}
        </div>
      )}
    </div>
  )
}
