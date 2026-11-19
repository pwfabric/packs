/**
 * Dates and percentages — formatted the same way by every block that prints
 * one.
 *
 * MEASURED: an English app showed "2026-10-01" in a news list, "11/17/2026"
 * in a table and "249,00 €" / "-%20" in a price, because each block picked its
 * own locale (the runtime default, or the currency's home country). The app's
 * locale is declared once, in `app/plan.json` `locale`, and the engine hands
 * it to every block as `context.locale`; a block passes it to these helpers.
 */

export { localeUses24h } from './_shared-utils.js'

/**
 * A DATE-ONLY STRING HAS NO INSTANT, AND READING IT AS ONE MOVES THE DAY.
 * `new Date('2026-10-15')` is UTC midnight, so a reader west of Greenwich saw
 * the 14th. A bare `YYYY-MM-DD` is read as that calendar day where the reader
 * is; a value with a time keeps its instant.
 */
export function parseDateValue(raw: unknown): Date | null {
  const ok = (d: Date): Date | null => (Number.isNaN(d.getTime()) ? null : d)
  if (raw instanceof Date) return ok(raw)
  if (typeof raw === 'number') return ok(new Date(raw))
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  // Only ISO-shaped strings are dates here: "Posted today" or "17 Nov" must
  // stay as written rather than being guessed at by `Date.parse`.
  if (!/^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ok(new Date(`${s}T00:00:00`))
  return ok(new Date(s))
}

export type DateStyle = 'date' | 'datetime' | 'time'

/**
 * One human date format: "17 Nov 2026" in en-GB, "Nov 17, 2026" in en-US,
 * "17 Kas 2026" in Turkish — the month as a word, never a 11/17 vs 17/11
 * puzzle.
 */
export const DATE_STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { day: 'numeric', month: 'short', year: 'numeric' },
  datetime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  time: { hour: '2-digit', minute: '2-digit' },
}

/**
 * The text of a date, or '' when the value is not one (the caller shows the
 * raw value then, so nothing is silently blanked).
 */
export function formatDate(raw: unknown, style: DateStyle = 'date', locale?: string): string {
  const d = parseDateValue(raw)
  if (!d) return ''
  const options = DATE_STYLE_OPTIONS[style] ?? DATE_STYLE_OPTIONS.date
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(d)
  }
}

/**
 * A signed percentage: "−20%" in English, "−%20" in Turkish. Intl puts the
 * sign and the percent where the locale wants them; the hyphen it uses for
 * minus is replaced with a true minus sign (U+2212).
 */
export function formatSignedPercent(pct: number, locale?: string): string {
  let text: string
  try {
    text = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(pct / 100)
  } catch {
    text = `${pct > 0 ? '+' : pct < 0 ? '-' : ''}${Math.abs(Math.round(pct))}%`
  }
  return text.replace(/-/g, '−')
}
