import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue } from '../../../lib/_kit.js'

/// An event is a ROW OBJECT, delivered with the source's own field names
// (`{{meetings}}`): `dateField` / `labelField` / `colorField` name the fields
// read. Defaults are the names the block always read (`date`, `label`,
// `color`), so a receipt written against them renders unchanged. Same naming
// as data.repeater — the display family maps fields with `*Field`.
// Props — declared in manifest.json, applied by the runtime.
export interface CalendarMonthProps {
  readonly title?: string
  readonly year?: number
  /** 1–12 (the manifest bounds it). */
  readonly month?: number
  readonly events: readonly Readonly<Record<string, unknown>>[]
  /** The row field holding the day — "YYYY-MM-DD", or an ISO date-time whose first ten characters are the day. */
  readonly dateField: string
  /** The row field shown on the day. */
  readonly labelField: string
  /** The row field holding the event's colour (a CSS colour or var(--pw-color-…)); rows without it use the primary colour. */
  readonly colorField: string
}

export const CalendarMonthDefinition: BlockDefinition = {
  type: 'calendar-month',
  name: 'CalendarMonth',
  category: 'data',
  icon: 'calendar',
  defaultProps: { events: [] },
  canHaveChildren: false,
}

// Month and weekday names come from Intl in the app's locale (`context.locale`;
// absent, the visitor's) — no hard-coded list in any one language (EN-default
// rule). Monday-first. The dates are fixed, so these are not "now".
const monthName = (month: number, locale: string | undefined): string =>
  new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month - 1, 1))
const weekdays = (locale: string | undefined): readonly string[] =>
  Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + i))
  )

function pick(rec: Record<string, unknown>, key: string): unknown {
  if (key in rec) return rec[key]
  let cur: unknown = rec
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

interface DayEvent {
  date: string
  label: string
  color?: string | undefined
}

/** Rows → the events the grid draws, read through the field props. A row with no day is dropped. */
export function calendarEvents(rows: unknown, dateField = 'date', labelField = 'label', colorField = 'color'): DayEvent[] {
  if (!Array.isArray(rows)) return []
  const out: DayEvent[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const date = String(pick(rec, dateField) ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const color = pick(rec, colorField)
    out.push({ date, label: safeRenderValue(pick(rec, labelField)), color: typeof color === 'string' && color ? color : undefined })
  }
  return out
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Weeks drawn by the neutral first frame of a calendar that waits for "now". */
const PLACEHOLDER_WEEKS = 5

export const CalendarMonthBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as CalendarMonthProps
  const { title, events } = p
  // An empty field name reads the block's own name (kept by hand: a default
  // covers a missing prop, not an empty one).
  const dateField = p.dateField || 'date'
  const labelField = p.labelField || 'label'
  const colorField = p.colorField || 'color'

  // No year/month set → the month the visitor is in now. "Now" is read after
  // mount, never in render: a pre-rendered page and its first browser frame
  // must agree, so until then the block draws a neutral frame of the grid.
  const [now, setNow] = React.useState<{ year: number; month: number } | null>(null)
  const needsNow = typeof p.year !== 'number' || typeof p.month !== 'number'
  React.useEffect(() => {
    if (!needsNow) return
    const d = new Date()
    setNow({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }, [needsNow])
  const year = typeof p.year === 'number' ? p.year : now?.year
  const month = typeof p.month === 'number' ? p.month : now?.month

  // calendarEvents reads only an array of rows.
  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, DayEvent[]>()
    for (const ev of calendarEvents(events, dateField, labelField, colorField)) {
      const list = map.get(ev.date) ?? []
      list.push(ev)
      map.set(ev.date, list)
    }
    return map
  }, [events, dateField, labelField, colorField])

  const ready = year !== undefined && month !== undefined
  const cells: (number | null)[] = []
  if (ready) {
    const firstOfMonth = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7
    cells.push(...Array.from({ length: leadingBlanks }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1))
    while (cells.length % 7 !== 0) cells.push(null)
  } else {
    cells.push(...Array.from({ length: PLACEHOLDER_WEEKS * 7 }, () => null))
  }

  return (
    <div id={block.id} data-block-id={block.id} data-block-type="calendar-month" className="pw-calendar-month" style={block.style}>
      <h3 style={{ margin: '0 0 12px', fontSize: 'var(--pw-font-size-base)', fontWeight: 700 }}>
        {title ? safeRenderValue(title) : ready ? `${monthName(month, context.locale)} ${year}` : ' '}
      </h3>
      {/* minmax(0, 1fr): a bare 1fr track has an `auto` minimum, so a long label or
          weekday name widens its column and pushes Sunday off a phone screen. */}
      <div data-pw-calendar-grid="" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {weekdays(context.locale).map((d) => (
          <div
            key={d}
            style={{
              fontSize: 'var(--pw-font-size-xs)',
              fontWeight: 700,
              color: 'var(--pw-color-text-muted, #71717a)',
              textAlign: 'center',
              padding: '4px 0',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null || !ready) return <div key={`blank-${i}`} style={ready ? { minWidth: 0 } : { minWidth: 0, minHeight: 56 }} />
          const dateKey = `${year}-${pad(month)}-${pad(day)}`

          const dayEvents = eventsByDate.get(dateKey) ?? []
          return (
            <div
              key={dateKey}
              style={{
                minHeight: 56,
                minWidth: 0,
                overflow: 'hidden',
                padding: 4,
                border: '1px solid var(--pw-color-border, #e4e4e7)',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 'var(--pw-font-size-xs)', fontWeight: 600 }}>{day}</span>
              {dayEvents.slice(0, 2).map((ev, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: 'var(--pw-font-size-xs)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: `color-mix(in srgb, ${ev.color ?? 'var(--pw-color-primary, #18181b)'} 22%, transparent)`,
                    color: `color-mix(in srgb, ${ev.color ?? 'var(--pw-color-primary, #18181b)'} 45%, var(--pw-color-text, #09090b))`,
                    fontWeight: 600,
                    minWidth: 0,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {safeRenderValue(ev.label)}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
