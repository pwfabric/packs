import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { CONTROL_BORDER, CONTROL_HEIGHT, CONTROL_LABEL_STYLE, safeRenderValue, PRESS_CSS } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { useAppMessage, useAppMessages, messageOf } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface DateInputProps {
  readonly name?: string
  readonly label?: string
  readonly mode: 'date' | 'time' | 'datetime'
  readonly required: boolean
  readonly disabled: boolean
  readonly placeholder?: string
  readonly minDate?: string
  readonly maxDate?: string
  /**
   * Calendar picker — opt-in popover month calendar (mode:"date" only). The
   * pick is carried to FormData by a hidden input (ISO yyyy-MM-dd) under
   * `name`. Default false = the native browser input.
   */
  readonly calendar: boolean
  /** Initial value (ISO: yyyy-MM-dd, HH:mm or yyyy-MM-ddTHH:mm). Bindable; a late-resolving binding re-seeds the field. */
  readonly defaultValue?: string
  /** The value page state holds (`"{{state.<stateKey>}}"`). Wins over `defaultValue`. An unresolved binding is ignored. */
  readonly value?: string
  /** State key the value is written to on change. */
  readonly stateKey?: string
  /** Weekdays that cannot be picked: 0 = Sunday … 6 = Saturday (numbers, numeric strings, or "0,6"). */
  readonly disabledWeekdays?: readonly (number | string)[] | string
}

// ============================================================
// DEFINITION
// ============================================================

export const dateInputDefinition: BlockDefinition = {
  type: 'date-input',
  name: 'Date Input',
  category: 'form',
  icon: '📅',
  defaultProps: {
    mode: 'date',
    required: false,
    disabled: false,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 4, lg: 6 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// CALENDAR HELPERS (mode:"date" + calendar:true popover)
// ============================================================

/** The calendar's month before it first opens: a fixed date, never "now" in render. */
const NEUTRAL_VIEW = new Date(2000, 0, 1)

const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Weekday names from Intl (Monday-first) in the APP's locale (`context.locale`,
// the app's declared locale) — not the browser's: an en-GB app showed its
// calendar in whatever language the visitor's machine spoke.
const weekdays = (locale: string | undefined): readonly string[] =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i))
  )

/**
 * Phone / touch: every day cell and month arrow is a 44px target (R3), and the
 * popover widens to hold seven of them (7 × 44 + gaps + padding).
 */
const CALENDAR_HIT_CSS =
  '@media (max-width: 640px), (pointer: coarse) {' +
  ' [data-pw-cal] { width: min(344px, calc(100vw - 32px)) !important; }' +
  ' [data-pw-cal-day] { height: 44px !important; }' +
  ' [data-pw-cal-nav] { width: 44px !important; height: 44px !important; }' +
  ' }'

/**
 * The field itself is a real 44px-tall box at phone width or on a coarse
 * pointer (R3): it measured 38px.
 */
const DATE_FIELD_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-date-field] { min-height: 44px; } }'

/** `disabledWeekdays` as a set of 0–6 (Sunday = 0); anything else is dropped. */
export function weekdaySet(raw: unknown): Set<number> {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const out = new Set<number>()
  for (const v of list) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : NaN
    if (Number.isInteger(n) && n >= 0 && n <= 6) out.add(n)
  }
  return out
}

const isoDate = (iso: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d: Date, n: number): Date => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))
}

function monthGrid(view: Date): (Date | null)[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7 // Monday=0
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), day))
  }
  return cells
}

// ============================================================
// COMPONENT
// ============================================================

export const DateInputBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as DateInputProps
  const mode = p.mode
  const inputType = mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date'
  const label = safeRenderValue(props.label)
  const disabled = p.disabled
  const name = p.name
  const useCalendar = p.calendar && mode === 'date'
  const minISO = safeRenderValue(props.minDate) || undefined
  const maxISO = safeRenderValue(props.maxDate) || undefined

  const required = p.required
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined
  const locale = context.locale
  // `value` (bound to state) wins over `defaultValue`. An unresolved binding
  // ("{{state.day}}") is not a date — it used to land in the field as text.
  // Only text is a date; another kind of value (a binding that resolved to a
  // list or a number) is no value.
  const given = (v: unknown): string | undefined =>
    typeof v !== 'string' || v.includes('{{') ? undefined : v
  const propValue = given(props.value) ?? given(props.defaultValue) ?? ''
  const [value, setValue] = React.useState(propValue) // ISO
  const lastPropValue = React.useRef(propValue)
  if (lastPropValue.current !== propValue) {
    // A bound defaultValue (`{{record.due}}`) resolves after the first render.
    lastPropValue.current = propValue
    setValue(propValue)
  }
  const controlId = `${block.id}-input`
  const change = (next: string): void => {
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
  const [open, setOpen] = React.useState(false)
  // Render is pure (a pre-rendered page hydrates without a mismatch): no
  // "now" in render. The month on view is set when the calendar opens; today
  // is learned after mount, so the first frame marks no day as today.
  const [view, setView] = React.useState(() => NEUTRAL_VIEW)
  const [todayISO, setTodayISO] = React.useState<string | null>(null)
  React.useEffect(() => setTodayISO(toISO(new Date())), [])
  // The day that holds the grid's single tab stop (roving tabindex).
  const [focusISO, setFocusISO] = React.useState<string | null>(null)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const fieldRef = React.useRef<HTMLInputElement | null>(null)
  const gridRef = React.useRef<HTMLDivElement | null>(null)
  // Set when the roving day should take DOM focus after the next render.
  const focusPending = React.useRef(false)
  const offDays = weekdaySet(props.disabledWeekdays)

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    // No gap of its own: the label's CONTROL_LABEL_STYLE spaces it from the field.
    position: 'relative',
    opacity: disabled ? 0.5 : undefined,
    cursor: disabled ? 'not-allowed' : undefined,
    ...block.style,
  }
  // The one label style of every form control.
  const labelStyle: React.CSSProperties = CONTROL_LABEL_STYLE
  const inputStyle: React.CSSProperties = {
    // The shared control height, so the date lines up with a text field and a select.
    display: 'block',
    height: CONTROL_HEIGHT,
    padding: '0 12px',
    // The same control edge as a text input (P4a): the divider colour measured
    // 1.16–1.72:1, so the date field looked fainter than the name field above it.
    border: `1px solid ${CONTROL_BORDER}`,
    borderRadius: 'var(--pw-border-radius, 6px)',
    fontSize: 'var(--pw-font-size-sm)',
    fontFamily: 'inherit',
    color: 'var(--pw-color-text)',
    backgroundColor: 'var(--pw-color-card)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  const close = (refocus: boolean): void => {
    setOpen(false)
    if (refocus) fieldRef.current?.focus()
  }
  const pick = (d: Date): void => {
    change(toISO(d))
    close(true)
  }
  const inRange = (d: Date): boolean => {
    const iso = toISO(d)
    if (minISO && iso < minISO) return false
    if (maxISO && iso > maxISO) return false
    return true
  }
  const pickable = (d: Date): boolean => inRange(d) && !offDays.has(d.getDay()) && !disabled

  // A date on a weekday that cannot be picked is refused by the form, in
  // either mode (a bound or typed value can still land on one).
  const valueDate = mode === 'date' ? isoDate(value) : null
  // The words are the app's: `ui.date.unavailable` ({day}), the calendar's
  // `ui.date.previousMonth` / `ui.date.nextMonth`, and `ui.date.placeholder`.
  const messages = useAppMessages()
  const offMessage =
    valueDate && offDays.has(valueDate.getDay())
      ? messageOf(messages, 'ui.date.unavailable', '', {
          day: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(valueDate),
        })
      : ''
  const previousMonthWord = useAppMessage('ui.date.previousMonth', '')
  const nextMonthWord = useAppMessage('ui.date.nextMonth', '')
  const placeholderWord = useAppMessage('ui.date.placeholder', '')
  React.useEffect(() => {
    fieldRef.current?.setCustomValidity(offMessage)
  }, [offMessage])

  const openCalendar = (): void => {
    if (disabled) return
    const start = isoDate(value) ?? new Date()
    setView(new Date(start.getFullYear(), start.getMonth(), 1))
    // The tab stop: the picked day, else today, else the first pickable day.
    let focus = start
    if (!pickable(focus)) {
      const days = monthGrid(start).filter((c): c is Date => c !== null)
      focus = days.find(pickable) ?? start
    }
    setFocusISO(toISO(focus))
    focusPending.current = true
    setOpen(true)
  }

  // Esc and a press outside close the calendar wherever focus is — inside the
  // dialog too. The field's own key handler missed Esc once a day button had
  // focus, and the old fixed backdrop sat under other stacking contexts.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
      }
    }
    const onDown = (e: Event): void => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('mousedown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Move DOM focus to the roving day once it is rendered (on open, on an arrow).
  React.useEffect(() => {
    if (!open || !focusISO || !focusPending.current) return
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusISO}"]`)
    if (btn) {
      focusPending.current = false
      btn.focus()
    }
  }, [open, focusISO, view])

  const moveFocus = (target: Date): void => {
    let to = target
    if (minISO && toISO(to) < minISO) to = isoDate(minISO) ?? to
    if (maxISO && toISO(to) > maxISO) to = isoDate(maxISO) ?? to
    if (to.getMonth() !== view.getMonth() || to.getFullYear() !== view.getFullYear()) {
      setView(new Date(to.getFullYear(), to.getMonth(), 1))
    }
    focusPending.current = true
    setFocusISO(toISO(to))
  }
  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const from = (focusISO && isoDate(focusISO)) || new Date()
    const weekPos = (from.getDay() + 6) % 7 // Monday = 0
    const next: Record<string, () => Date> = {
      ArrowLeft: () => addDays(from, -1),
      ArrowRight: () => addDays(from, 1),
      ArrowUp: () => addDays(from, -7),
      ArrowDown: () => addDays(from, 7),
      Home: () => addDays(from, -weekPos),
      End: () => addDays(from, 6 - weekPos),
      PageUp: () => addMonths(from, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(from, e.shiftKey ? 12 : 1),
    }
    const go = next[e.key]
    if (!go) return
    e.preventDefault()
    moveFocus(go())
  }
  const dayName = (d: Date): string =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  const shiftView = (months: number): void => {
    setView(new Date(view.getFullYear(), view.getMonth() + months, 1))
    if (focusISO) setFocusISO(toISO(addMonths(isoDate(focusISO) ?? view, months)))
  }
  const displayDate = value ? new Date(`${value}T00:00:00`) : null
  const display =
    displayDate && !Number.isNaN(displayDate.getTime())
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(displayDate)
      : value
  const monthTitle = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view)

  const navBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--pw-color-border)',
    borderRadius: 'var(--pw-border-radius)',
    background: 'transparent',
    color: 'var(--pw-color-text)',
    cursor: 'pointer',
    padding: 0,
  }

  return (
    <div ref={rootRef} id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="date-input">
      <style>{PRESS_CSS + DATE_FIELD_TOUCH_CSS}</style>
      {label && (
        <label htmlFor={controlId} style={labelStyle}>
          {label}
          {required && <span style={{ color: 'var(--pw-color-error)', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      {useCalendar ? (
        <>
          {/* The visible trigger shows the locale-formatted date; the ISO value
              reaches FormData through the hidden input. The trigger is NOT
              readOnly: a readonly (or hidden) input is barred from constraint
              validation, so `required` was never enforced here. Typing is
              swallowed instead — the value only changes through the calendar. */}
          <input
            ref={fieldRef}
            data-pw-date-field=""
            id={controlId}
            type="text"
            inputMode="none"
            autoComplete="off"
            value={display}
            onChange={() => undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault()
                if (!open) openCalendar()
              } else if (e.key === 'Escape') {
                setOpen(false)
              } else if (e.key !== 'Tab') {
                e.preventDefault()
              }
            }}
            placeholder={safeRenderValue(props.placeholder, placeholderWord)}
            disabled={disabled}
            required={required}
            onClick={() => {
              if (disabled) return
              if (open) setOpen(false)
              else openCalendar()
            }}
            style={inputStyle}
            aria-haspopup="dialog"
            aria-expanded={open}
          />
          {name ? <input type="hidden" name={name} value={value} /> : null}
          {open && (
            <>
              <style>{CALENDAR_HIT_CSS}</style>
              <div
                role="dialog"
                data-pw-cal=""
                aria-label={monthTitle}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  zIndex: 'calc(var(--pw-z-dropdown, 300) + 1)' as never,
                  backgroundColor: 'var(--pw-color-card)',
                  color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
                  border: '1px solid var(--pw-color-border)',
                  borderRadius: 'var(--pw-border-radius, 8px)',
                  boxShadow: 'var(--pw-shadow-md, 0 4px 6px -1px rgba(0,0,0,.1))',
                  padding: 12,
                  width: 268,
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <button data-pw-press="" type="button" aria-label={previousMonthWord} data-pw-cal-nav="" style={navBtnStyle} onClick={() => shiftView(-1)}>‹</button>
                  <span aria-live="polite" style={{ fontSize: 'var(--pw-font-size-sm)', fontWeight: 600, textTransform: 'capitalize' }}>{monthTitle}</span>
                  <button data-pw-press="" type="button" aria-label={nextMonthWord} data-pw-cal-nav="" style={navBtnStyle} onClick={() => shiftView(1)}>›</button>
                </div>
                <div ref={gridRef} onKeyDown={onGridKey} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                  {weekdays(locale).map((w) => (
                    <div key={w} aria-hidden="true" style={{ textAlign: 'center', fontSize: 'var(--pw-font-size-xs)', color: 'var(--pw-color-text-muted)', padding: '2px 0' }}>{w}</div>
                  ))}
                  {(() => {
                    const cells = monthGrid(view)
                    const focusInView = cells.some((c) => c !== null && toISO(c) === focusISO)
                    return cells.map((d, i) => {
                    if (!d) return <div key={`pad-${i}`} />
                    const iso = toISO(d)
                    const selected = iso === value
                    const today = iso === todayISO
                    const enabled = pickable(d)
                    // One tab stop in the grid; the arrows move it.
                    const tabStop = focusInView ? iso === focusISO : d.getDate() === 1
                    return (
                      <button data-pw-press=""
                        key={iso}
                        type="button"
                        // aria-disabled, not disabled: a greyed day stays
                        // reachable by the arrows, it just cannot be picked.
                        aria-disabled={enabled ? undefined : true}
                        onClick={() => {
                          if (enabled) pick(d)
                        }}
                        aria-pressed={selected}
                        aria-current={today ? 'date' : undefined}
                        aria-label={dayName(d)}
                        tabIndex={tabStop ? 0 : -1}
                        data-iso={iso}
                        data-pw-cal-day=""
                        style={{
                          height: 32,
                          border: 'none',
                          borderRadius: 'var(--pw-border-radius)',
                          fontSize: 'var(--pw-font-size-sm)',
                          fontFamily: 'inherit',
                          cursor: enabled ? 'pointer' : 'not-allowed',
                          opacity: enabled ? 1 : 0.35,
                          backgroundColor: selected ? 'var(--pw-color-primary)' : 'transparent',
                          color: selected
                            ? 'var(--pw-color-text-on-primary)'
                            : 'var(--pw-color-text-on-card, var(--pw-color-text))',
                          boxShadow: today && !selected ? 'inset 0 0 0 1px var(--pw-color-border)' : undefined,
                        }}
                      >
                        {d.getDate()}
                      </button>
                    )
                  })
                  })()}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <input
          ref={fieldRef}
          data-pw-date-field=""
          id={controlId}
          type={inputType}
          name={name}
          value={value}
          onChange={(e) => change(e.target.value)}
          placeholder={safeRenderValue(props.placeholder) || undefined}
          disabled={disabled}
          required={required}
          min={minISO}
          max={maxISO}
          // A time picks hours and minutes, never seconds.
          {...(inputType !== 'date' ? { step: 60 } : {})}
          lang={locale}
          style={inputStyle}
        />
      )}
    </div>
  )
}
