import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue } from '../../../lib/_kit.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

// A point is a ROW OBJECT, delivered with the source's own field names
// (`{{sales}}`): `labelField` / `valueField` name the fields read. Defaults
// are the names the block always read (`label`, `value`), so a receipt
// written against them renders unchanged. Same naming as data.repeater — the
// display family maps fields with `*Field`.

// Editor preview series. Drawn ONLY in an inert (editor/preview) render, so an
// empty chart can still be placed and styled. A live chart with no data — a
// bound source that legitimately returned [] — shows an empty state: visitors
// were shown this invented Mon–Sun curve as if it were their data.
const SAMPLE_DATA: Array<{ label: string; value: number }> = [
  { label: 'Mon', value: 32 },
  { label: 'Tue', value: 40 },
  { label: 'Wed', value: 36 },
  { label: 'Thu', value: 52 },
  { label: 'Fri', value: 48 },
  { label: 'Sat', value: 61 },
  { label: 'Sun', value: 68 },
]

export const CHART_VARIANTS = ['line', 'area', 'bar', 'sparkline'] as const

export interface ChartProps {
  readonly variant: (typeof CHART_VARIANTS)[number]
  readonly data: readonly Readonly<Record<string, unknown>>[]
  /** The row field naming each point (an axis label). */
  readonly labelField: string
  /** The row field holding each point's number; a numeric string counts, anything else is 0. */
  readonly valueField: string
  /** Shown in place of the chart when there is no data. Empty = the box stays quiet. */
  readonly emptyText?: string
  readonly color: string
  readonly height: number
  readonly showAxis: boolean
  readonly showLabels: boolean
  /**
   * The value scale of a line, area or bar chart: 3–5 round values printed
   * at the left (bottom to top), each on a faint gridline. On by default: a
   * trend with no numbers cannot be read. A sparkline never shows one.
   */
  readonly showValues: boolean
  readonly strokeWidth: number
}

// ============================================================
// DEFINITION
// ============================================================

export const chartDefinition: BlockDefinition = {
  type: 'chart',
  name: 'Chart',
  category: 'data',
  icon: '📈',
  defaultProps: {
    variant: 'line',
    height: 160,
    showAxis: false,
    showLabels: false,
    showValues: true,
    strokeWidth: 2,
  },
  defaultLayout: { span: { xs: 4, sm: 6, md: 6, lg: 6 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

type Point = { label: string; value: number }

function pick(rec: Record<string, unknown>, key: string): unknown {
  if (key in rec) return rec[key]
  let cur: unknown = rec
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** Rows → points, read through the field props. */
export function chartPoints(rows: unknown[], labelField = 'label', valueField = 'value'): Point[] {
  return rows.map((row) => {
    const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    return { label: safeRenderValue(pick(rec, labelField)), value: Number(pick(rec, valueField)) || 0 }
  })
}

/** The smallest "round" number (1, 2, 2.5, 5 × 10ⁿ) at or above `v`. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 0
  const exp = Math.floor(Math.log10(v))
  const base = 10 ** exp
  for (const m of [1, 2, 2.5, 5]) if (m * base >= v - 1e-9) return m * base
  return 10 * base
}

/**
 * The value scale: zero (or a round floor under a negative minimum) up to a
 * round top, in 2–4 equal round steps — whichever count reaches the top
 * closest to the data (0–27 → 0, 10, 20, 30; not 0–50). Zero stays in the
 * scale, as the plot always kept it: a chart of 8–14 that starts at 8
 * overstates the change.
 */
export function chartScale(values: number[]): { min: number; max: number; ticks: number[] } {
  const hi = Math.max(...values, 0)
  const lo = Math.min(...values, 0)
  if (hi === lo) return { min: lo, max: lo + 1, ticks: [lo, lo + 1] }
  let best: { min: number; max: number; ticks: number[] } | null = null
  for (const steps of [2, 3, 4]) {
    const step = niceCeil((hi - lo) / steps)
    const min = Math.floor(lo / step + 1e-9) * step
    const max = Math.ceil(hi / step - 1e-9) * step
    const count = Math.round((max - min) / step)
    if (count > 4) continue
    if (!best || max - min < best.max - best.min - 1e-9) {
      best = { min, max, ticks: Array.from({ length: count + 1 }, (_, k) => min + k * step) }
    }
  }
  return best ?? { min: lo, max: hi, ticks: [lo, hi] }
}

/** A scale number, short, in `locale` (the app's; absent, the visitor's): 1200 → "1.2K", 2.5 → "2.5". */
export function formatTick(v: number, locale: string | undefined): string {
  const r = Math.round(v * 100) / 100
  try {
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(r)
  } catch {
    return String(r)
  }
}

/**
 * Show every k-th axis label (indices 0, k, 2k, …) so neighbours never touch.
 * `width` is the plot's width in px; 0 (not measured yet) shows them all.
 */
export function labelStride(labels: string[], width: number): number {
  if (!(width > 0) || labels.length <= 1) return 1
  const longest = Math.max(...labels.map((l) => l.length), 1)
  // ~7px per character at the 12px label size, plus a gap between labels.
  const need = longest * 7 + 12
  const fit = Math.max(1, Math.floor(width / need))
  return Math.max(1, Math.ceil(labels.length / fit))
}

/**
 * Label thinning without measuring. The first frame of a pre-rendered page
 * must not depend on the plot's width (a width read after mount made the
 * labels jump on hydration), so the thinning is CSS: the label row is an
 * inline-size container, and for each width band one rule hides the labels
 * `labelStride` would drop at that width. Each label lists the strides that
 * keep it (`data-pw-on="s1 s2 s4"`). Returns the strides (for the labels'
 * tokens) and the rules, scoped to `scope` (an attribute selector).
 */
export function labelThinning(labels: string[], scope: string): { strides: number[]; css: string } {
  const n = labels.length
  if (n <= 1) return { strides: [1], css: '' }
  const longest = Math.max(...labels.map((l) => l.length), 1)
  const need = longest * 7 + 12
  const bands: { lo: number; hi: number; stride: number }[] = []
  for (let fit = 1; fit < n; fit++) {
    const stride = labelStride(labels, fit * need)
    const lo = fit === 1 ? 0 : fit * need
    const hi = (fit + 1) * need
    const last = bands[bands.length - 1]
    if (last && last.stride === stride) last.hi = hi
    else bands.push({ lo, hi, stride })
  }
  const css = bands
    .filter((b) => b.stride > 1)
    .map((b) => {
      const range = `${b.lo > 0 ? `(min-width: ${b.lo}px) and ` : ''}(max-width: ${(b.hi - 0.02).toFixed(2)}px)`
      return `@container ${range} { ${scope} [data-pw-on]:not([data-pw-on~="s${b.stride}"]) { visibility: hidden; } }`
    })
    .join('\n')
  return { strides: [1, ...bands.map((b) => b.stride).filter((s) => s > 1)], css }
}

const MUTED = 'var(--pw-color-text-muted, #71717a)'
const SMALL = 'var(--pw-font-size-xs, 12px)'

export const ChartBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as ChartProps
  const variant = p.variant
  const inert = context?.interactionMode === 'inert'
  const given = p.data as readonly unknown[]
  if (given.length === 0 && !inert) {
    const emptyText = safeRenderValue(p.emptyText)
    return (
      <div
        id={block.id}
        data-block-id={block.id}
        data-block-type="chart"
        data-empty=""
        role={emptyText ? 'status' : undefined}
        style={{
          width: '100%',
          minHeight: p.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: MUTED,
          fontSize: 'var(--pw-font-size-sm, 14px)',
          ...block.style,
        }}
      >
        {emptyText || null}
      </div>
    )
  }
  // An empty field name reads the block's own name (kept by hand: a default
  // covers a missing prop, not an empty one).
  const data: Point[] = given.length ? chartPoints([...given], p.labelField || 'label', p.valueField || 'value') : SAMPLE_DATA
  const color = p.color || 'var(--pw-color-primary, #18181b)'
  const height = p.height
  const showLabels = p.showLabels
  // The value scale is on unless turned off; a sparkline is too small for one.
  const scale = variant !== 'sparkline' && p.showValues ? chartScale(data.map((d) => d.value)) : null
  const showAxis = p.showAxis && !scale
  const strokeWidth = p.strokeWidth

  // Geometry in a fixed viewBox; SVG scales responsively to the container width.
  const W = 300
  const H = 100
  const padX = 4
  const padY = 8
  const values = data.map((d) => d.value)
  const max = scale ? scale.max : Math.max(...values, 0)
  const min = scale ? scale.min : Math.min(...values, 0)
  const span = max - min || 1
  const n = data.length
  // The end-cap dot sits on the last point. An empty `data` never reaches here
  // (live: empty state above; inert: the preview series) — naming the point
  // still drops the dot instead of reading `.value` off `undefined`.
  const lastPoint = data[n - 1]
  const x = (i: number): number => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - padX * 2))
  const y = (v: number): number => H - padY - ((v - min) / span) * (H - padY * 2)
  // Bars: n equal slots across the plot width, one bar centred in each.
  const slot = (W - padX * 2) / Math.max(n, 1)
  const barCenter = (i: number): number => padX + slot * (i + 0.5)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(d.value).toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${x(n - 1).toFixed(2)},${y(Math.max(min, 0)).toFixed(2)} L${x(0).toFixed(2)},${y(Math.max(min, 0)).toFixed(2)} Z`

  const gridId = `pw-chart-grad-${String(block.id).replace(/[^a-zA-Z0-9_-]/g, '')}`
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const ariaLabel = `${variant} chart, ${n} points, values ${lo} to ${hi}`

  const labels = data.map((d) => safeRenderValue(d.label))
  const thinKey = gridId.slice('pw-chart-grad-'.length) || 'chart'
  const thinning = labelThinning(labels, `[data-pw-chart-thin="${thinKey}"]`)
  const tickText = scale ? scale.ticks.map((t) => formatTick(t, context.locale)) : []
  const tickChars = Math.max(0, ...tickText.map((t) => t.length))
  const pct = (v: number, of: number): string => `${((v / of) * 100).toFixed(2)}%`

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="chart"
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', ...block.style }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: scale ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
          columnGap: 'var(--pw-space-xs, 6px)',
        }}
      >
        {scale && (
          // The value scale: one number per gridline, right-aligned beside it.
          <div
            data-chart-scale=""
            aria-hidden="true"
            style={{
              position: 'relative',
              height,
              width: `${tickChars + 0.5}ch`,
              fontSize: SMALL,
              color: MUTED,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {scale.ticks.map((t, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: pct(y(t), H),
                  transform: 'translateY(-50%)',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {tickText[i]}
              </span>
            ))}
          </div>
        )}
        <div data-chart-plot="" style={{ minWidth: 0 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            width="100%"
            height={height}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id={gridId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {scale && (
              <g data-chart-grid="" stroke="var(--pw-color-border, #e4e4e7)" strokeWidth="1">
                {scale.ticks.map((t, i) => (
                  <line
                    key={i}
                    x1={0}
                    y1={y(t).toFixed(2)}
                    x2={W}
                    y2={y(t).toFixed(2)}
                    strokeDasharray={t === 0 ? undefined : '3 4'}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            )}

            {showAxis && (
              <g stroke="var(--pw-color-border, #e4e4e7)" strokeWidth="0.5">
                <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} />
                <line x1={padX} y1={H / 2} x2={W - padX} y2={H / 2} strokeDasharray="2 3" />
              </g>
            )}

            {variant === 'bar' &&
              data.map((d, i) => {
                // A bar sits in the MIDDLE of its own slot. Centred on the line
                // chart's x (the first point on the left edge), half of the first
                // bar fell outside the plot, past the card's left edge.
                const bw = slot * 0.6
                const bx = barCenter(i) - bw / 2
                // From the zero line, so a negative value hangs below it.
                const top = y(Math.max(d.value, 0))
                const bottom = y(Math.min(d.value, 0))
                return (
                  <rect
                    key={i}
                    x={bx.toFixed(2)}
                    y={top.toFixed(2)}
                    width={bw.toFixed(2)}
                    height={Math.max(0, bottom - top).toFixed(2)}
                    rx="1.5"
                    fill={color}
                  />
                )
              })}

            {variant === 'area' && <path d={areaPath} fill={`url(#${gridId})`} stroke="none" />}

            {(variant === 'line' || variant === 'area' || variant === 'sparkline') && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth={variant === 'sparkline' ? Math.max(1.5, strokeWidth - 0.5) : strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {variant !== 'sparkline' && variant !== 'bar' && lastPoint && (
              <circle cx={x(n - 1).toFixed(2)} cy={y(lastPoint.value).toFixed(2)} r="2.5" fill={color} vectorEffect="non-scaling-stroke" />
            )}
          </svg>
        </div>

        {showLabels && scale && <div />}
        {showLabels && (
          <div
            data-chart-labels=""
            data-pw-chart-thin={thinKey}
            style={{
              // The row is the container the thinning rules measure.
              containerType: 'inline-size',
              // Bar labels sit under their bars (one equal column per slot);
              // line labels sit under their points. Labels that would touch
              // are thinned: every `stride`-th one is shown.
              ...(variant === 'bar'
                ? {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0, 1fr))`,
                    textAlign: 'center' as const,
                    paddingInline: pct(padX, W),
                  }
                : { position: 'relative' as const, height: '1.5em' }),
              marginTop: 'var(--pw-space-xs, 4px)',
              fontSize: SMALL,
              color: MUTED,
              whiteSpace: 'nowrap',
            }}
          >
            {thinning.css && <style>{thinning.css}</style>}
            {labels.map((text, i) => {
              const on = thinning.strides.filter((s) => i % s === 0).map((s) => `s${s}`).join(' ')
              if (variant === 'bar') return <span key={i} data-pw-on={on}>{text}</span>
              const edge = n <= 1 ? '-50%' : i === 0 ? '0' : i === n - 1 ? '-100%' : '-50%'
              return (
                <span key={i} data-pw-on={on} style={{ position: 'absolute', left: pct(x(i), W), transform: `translateX(${edge})` }}>
                  {text}
                </span>
              )
            })}

          </div>
        )}
      </div>
    </div>
  )
}
