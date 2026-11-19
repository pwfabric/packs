import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { listOf, localeUses24h, safeRenderValue, textOf } from '../../../lib/_kit.js'

// Props — declared in manifest.json, applied by the runtime.
export interface WorldClock {
  readonly label: string
  /** An IANA zone, e.g. Europe/Istanbul. */
  readonly timezone: string
}

export interface WorldClockProps {
  readonly title?: string
  readonly clocks: readonly WorldClock[]
  /**
   * 12-hour (true) or 24-hour (false) clock. Unset: the app's locale decides
   * (`context.locale`): en-GB and most of Europe read 24-hour, en-US 12-hour.
   */
  readonly hour12?: boolean
  /** Show the seconds ticking (default false — a wall of clocks reads hours and minutes). */
  readonly showSeconds?: boolean
  /**
   * The moment the clocks show (an ISO date-time with its offset), instead of
   * now. For an app whose day is a fixed one: the clocks then agree with the
   * date the page states, and stand still.
   */
  readonly at?: string
}

export const WorldClockDefinition: BlockDefinition = {
  type: 'world-clock',
  name: 'WorldClock',
  category: 'data',
  icon: 'clock',
  defaultProps: { clocks: [] },
  canHaveChildren: false,
}

function formatTime(timezone: string, now: Date, locale: string | undefined, hour12: boolean, seconds: boolean): string {
  try {
    // The APP's locale (`context.locale`), not the visitor's machine: an en-GB
    // intranet showed "09:41:07 PM" beside its own 24-hour copy.
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      ...(seconds ? { second: '2-digit' as const } : {}),
      hour12,
    }).format(now)
  } catch {
    // An unknown zone has no time to show. The visitor's own local time
    // under another city's label was a wrong answer that looked right.
    return '—'
  }
}

export const WorldClockBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as WorldClockProps
  // Anything but a list (a binding not yet resolved) reads as no clocks; no
  // invented London clock stands in for it.
  const { title } = p
  const clocks = listOf<WorldClock>(p.clocks).filter((c) => !!c && typeof c === 'object')
  const locale = context.locale
  const hour12 = typeof p.hour12 === 'boolean' ? p.hour12 : !localeUses24h(locale)
  const showSeconds = p.showSeconds === true
  // "Now" is read after mount, never in render: a pre-rendered page and its
  // first browser frame must agree. Until then each tile shows a neutral
  // placeholder in place of the time.
  const fixed = typeof p.at === 'string' && p.at.trim() !== '' && !Number.isNaN(Date.parse(p.at)) ? new Date(p.at) : null
  const [now, setNow] = React.useState<Date | null>(null)
  const live = fixed === null

  React.useEffect(() => {
    if (!live) return
    setNow(new Date())
    // Without seconds a tick per second is wasted work; every 15 s keeps the
    // minute right within a quarter minute.
    const id = setInterval(() => setNow(new Date()), showSeconds ? 1000 : 15000)
    return () => clearInterval(id)
  }, [showSeconds, live])

  return (
    <div id={block.id} data-block-id={block.id} data-block-type="world-clock" className="pw-world-clock" style={block.style}>
      {title && <h3 style={{ margin: '0 0 10px', fontSize: 'var(--pw-font-size-lg)', fontWeight: 700 }}>{safeRenderValue(title)}</h3>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {clocks.map((c, i) => (
          <div
            key={`${c.timezone}-${i}`}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid var(--pw-color-border, #e4e4e7)',
              // The tiles share the row: two clocks fill it instead of leaving
              // a ragged gap at the end.
              flex: '1 1 120px',
              minWidth: 120,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 'var(--pw-font-size-xl)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {(fixed ?? now) ? formatTime(textOf(c.timezone), (fixed ?? now) as Date, locale, hour12, showSeconds) : ' '}

            </div>
            <div style={{ fontSize: 'var(--pw-font-size-xs)', color: 'var(--pw-color-text-muted, #71717a)', marginTop: 2 }}>{safeRenderValue(c.label)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
