import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { formatSignedPercent } from '../../../lib/_shared-format.js'
import { textOf } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface MoneyProps {
  readonly amount: number
  readonly currency: string
  /** `amount` is in the currency's smallest unit (kuruş, cent). */
  readonly minorUnits: boolean
  readonly locale?: string
  /** Trailing qualifier: "/mo", "per seat", "+ VAT". */
  readonly period?: string
  /** The price this one replaces — rendered struck through when it is higher. Absent or null: none. */
  readonly compareAt?: number | null
  /**
   * Whole currency units, no decimals: "€249", not "€249.00" — for prices set
   * in whole units (a kit, a ticket). A fraction is rounded to the nearest unit.
   */
  readonly whole: boolean
  readonly showSave: boolean
  readonly size: 'sm' | 'md' | 'lg' | 'xl'
  readonly emphasis: 'normal' | 'strong'
  readonly align: 'start' | 'center' | 'end'
}

// ============================================================
// DEFINITION
// ============================================================

export const moneyDefinition: BlockDefinition = {
  type: 'money',
  name: 'Money',
  category: 'data',
  icon: '¤',
  defaultProps: {
    amount: 0,
    currency: 'TRY',
    minorUnits: false,
    showSave: false,
    size: 'md',
    emphasis: 'strong',
    align: 'start',
  },
  defaultLayout: { span: { xs: 4, sm: 4, md: 4, lg: 4 } },
  canHaveChildren: false,
}

// ============================================================
// FORMATTING
// ============================================================

/**
 * A currency's minor-unit exponent, asked of `Intl` rather than tabulated.
 *
 * Hardcoding 100 is wrong for JPY (0) and KWD (3), and a table would drift.
 * `formatToParts` on a known input is the cheapest honest answer available in
 * the runtime, and it degrades to 2 if the environment cannot answer.
 */
function minorExponent(currency: string, locale?: string): number {
  try {
    const opts = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
    return opts.maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function format(amount: number, currency: string, minor: boolean, locale?: string, whole = false): string {
  const value = minor ? amount / 10 ** minorExponent(currency, locale) : amount
  const digits = whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}
  try {
    // narrowSymbol: an English page prints "$376.92", not "US$376.92".
    // A true minus sign (U+2212), not the hyphen Intl prints: "−$24.00".
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...digits }).format(value).replace(/-/g, '−')
  } catch {
    // An unknown currency code must not blank the price: show the number and
    // the code the author asked for, which is still more than nothing.
    return `${value.toLocaleString(locale, digits)} ${currency}`
  }
}

/**
 * The locale a currency is at home in. A price with no locale was formatted by
 * the runtime's default (en-US in a headless browser): "TRY 95.00" on a Turkish
 * page. The currency is the best signal a price carries
 * about its reader, so it picks the locale when nothing more specific does.
 */
const CURRENCY_HOME: Record<string, string> = {
  TRY: 'tr-TR',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CHF: 'de-CH',
  AED: 'ar-AE',
  SAR: 'ar-SA',
  AZN: 'az-AZ',
}

/** Whether Intl reads `tag` as a locale: a bad one must fall back, not throw. */
function isLocale(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length > 0
  } catch {
    return false
  }
}

/**
 * Which locale prints this price: the block's own `locale` prop, then the
 * app's locale (the render context's `locale`), then the currency's home
 * locale, and otherwise the runtime default (undefined).
 *
 * The app comes before the currency: an English shop selling in euros showed
 * "249,00 €" because EUR's home is Germany. A reader reads numbers the way
 * their app is written.
 */
export function moneyLocale(prop: unknown, appLocale: string | undefined, currency: string): string | undefined {
  if (typeof prop === 'string' && prop.trim() && isLocale(prop.trim())) return prop.trim()
  if (typeof appLocale === 'string' && appLocale.trim()) return appLocale.trim()
  return CURRENCY_HOME[currency.toUpperCase()]
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * A price, printed once and printed properly.
 *
 * Without it a price is a string pasted into a heading — no currency, no
 * locale, no separators, nothing bindable — or three separate text blocks for
 * price, compare-at and the saving, free to contradict each other.
 *
 * So the point of this block is not that it renders a number: it is that the
 * amount is a NUMBER (bindable from data), the currency is declared, the minor
 * unit is explicit, and the saving is DERIVED from the two prices rather than
 * typed next to them.
 */
export const MoneyBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as MoneyProps
  // An empty code is a string the shape accepts; Intl cannot print it.
  const currency = textOf(p.currency) || 'TRY'
  const locale = moneyLocale(p.locale, context.locale, currency)
  const minor = p.minorUnits
  const amount = p.amount
  // No default: a value the shape refused (an empty string) arrives as written.
  const compareAt = p.compareAt == null || (p.compareAt as unknown) === '' ? null : Number(p.compareAt)
  const whole = p.whole

  // The theme's type scale, not raw px (22px and 40px were off every scale).
  const sizeMap: Record<string, string> = {
    sm: 'var(--pw-font-size-base, 1rem)',
    md: 'var(--pw-font-size-xl, 1.25rem)',
    lg: 'var(--pw-font-size-3xl, 1.875rem)',
    xl: 'var(--pw-font-size-4xl, 2.25rem)',
  }
  const size = sizeMap[p.size] ?? sizeMap.md
  const align = p.align

  // A saving is only real when the earlier price was HIGHER. A negative
  // "saving" is a data defect, and printing it would launder that defect into
  // a claim the page makes to a customer.
  const saves = compareAt != null && Number.isFinite(compareAt) && compareAt > amount
  const savedPct = saves ? Math.round(((compareAt - amount) / compareAt) * 100) : 0

  return (
    <div
      id={block?.id}
      data-block-id={block?.id}
      data-block-type="money"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start',
        gap: '8px',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: size,
          lineHeight: 1.1,
          fontWeight: p.emphasis === 'normal' ? 500 : 700,
          color: 'var(--pw-color-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {format(amount, currency, minor, locale, whole)}
      </span>

      {p.period ? (
        <span style={{ fontSize: 'var(--pw-font-size-sm)', color: 'var(--pw-color-text-muted)' }}>{String(p.period)}</span>
      ) : null}

      {saves ? (
        <span
          style={{
            fontSize: 'var(--pw-font-size-sm)',
            color: 'var(--pw-color-text-muted)',
            textDecoration: 'line-through',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {format(compareAt as number, currency, minor, locale, whole)}
        </span>
      ) : null}

      {saves && p.showSave ? (
        <span
          style={{
            fontSize: 'var(--pw-font-size-xs)',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--pw-border-radius-full)',
            background: 'var(--pw-color-success-surface, var(--pw-color-surface-raised))',
            color: 'var(--pw-color-success-on-surface, var(--pw-color-text))',
          }}
        >
          {formatSignedPercent(-savedPct, locale)}
        </span>
      ) : null}
    </div>
  )
}

export default MoneyBlock
