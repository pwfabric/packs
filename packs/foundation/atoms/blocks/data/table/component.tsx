import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, ICON_PATHS, inkOn, listOf, safeHref } from '../../../lib/_shared-utils.js'
import { useAppMessage } from '@pwfabric/runtime'

/** Stacked-card layout for a narrow table (see the render). */
const TABLE_STACK_CSS = [
  '@container (max-width: 479px) {',
  '[data-pw-table] thead { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; white-space: nowrap !important; }',
  '[data-pw-table], [data-pw-table] tbody, [data-pw-table] tr { display: block !important; width: 100% !important; }',
  '[data-pw-table] tbody tr { padding: 8px 0 !important; border-bottom: 1px solid var(--pw-color-border) !important; }',
  '[data-pw-table] tbody tr:last-child { border-bottom: 0 !important; }',
  '[data-pw-table] td { display: grid !important; grid-template-columns: minmax(88px, 38%) minmax(0, 1fr); gap: 12px; align-items: baseline; justify-items: start; width: 100% !important; box-sizing: border-box; padding: 4px 14px !important; border: 0 !important; text-align: left !important; overflow-wrap: anywhere; }',
  '[data-pw-table] td:not([data-label]), [data-pw-table] td[data-label=""] { display: block !important; }',
  '[data-pw-table] td[data-label]:not([data-label=""])::before { content: attr(data-label); color: var(--pw-color-text-muted, #71717a); font-weight: 500; }',
  // phoneLayout "rows": one compact row per record, the header kept.
  '[data-pw-table-rows] th, [data-pw-table-rows] td { padding: 6px 8px !important; }',
  '}',
].join('\n')

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** One column: see `TableColumnData` below for what each member does. */
export type TableColumn = TableColumnData

export interface TableProps {
  readonly columns: readonly TableColumn[]
  /** 'data' derives the columns from the first row's keys when `columns` is empty. */
  readonly columnsFrom?: 'data'
  readonly data: readonly Readonly<Record<string, unknown>>[]
  readonly striped: boolean
  readonly bordered: boolean
  readonly hoverable: boolean
  readonly compact: boolean
  /** Header row background colour. Defaults to the card token. */
  readonly headerColor?: string
  /** Header row text colour. Defaults to inheriting the surrounding text. */
  readonly headerTextColor?: string
  /** A `data` field whose value is a colour: a left-edge stripe on the row, not shown as a column. */
  readonly rowAccentKey?: string
  /** Render a leading checkbox column with select-all + per-row selection. */
  readonly selectable: boolean
  /** Bind to `"{{__loading.<sourceId>}}"`; truthy + zero rows renders skeleton rows. */
  readonly loadingWhen?: boolean
  /**
   * How many skeleton rows the loading state draws (default 3, at most 50).
   * Give it the number of rows the source usually holds — 24 hours, 10 deploys —
   * so the table does not grow when the rows land (layout shift).
   */
  readonly loadingRows?: number
  /** Bind to `"{{__errors.<sourceId>}}"`; truthy + zero rows renders a quiet error row. */
  readonly errorWhen?: string | boolean
  /** Click a column header to cycle asc → desc → none. Client-side, numeric-aware. */
  readonly sortable: boolean
  /** A text input above the table that filters rows by substring across all column values. */
  readonly filterable: boolean
  /** The filter input's placeholder. Unset: "Filter…" (write it in the app language). */
  readonly filterPlaceholder?: string
  /** Shown in the body when there are no rows (nothing loading, nothing failed). Empty = no message. */
  readonly emptyText?: string
  /** The human message shown when `errorWhen` is truthy. Without it the bound error message itself is shown. */
  readonly errorText?: string
  /** Announced (to assistive technology) while `loadingWhen` shows the skeleton rows. */
  readonly loadingText?: string
  /**
   * Below 480px of its own width: `cards` turns each row into a label/value
   * card; `rows` keeps one compact row per record and scrolls sideways.
   */
  readonly phoneLayout: 'cards' | 'rows'
  /** `table-layout: fixed`: the columns take their `width`s, so tables with the same columns line up. */
  readonly fixedLayout: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const tableDefinition: BlockDefinition = {
  type: 'table',
  name: 'Table',
  category: 'data',
  icon: '▦',
  defaultProps: {
    columns: [],
    data: [],
    striped: false,
    bordered: true,
    hoverable: true,
    compact: false,
    selectable: false,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

interface TableColumnData {
  key: string
  header: string
  width?: number | string
  align?: 'left' | 'center' | 'right'
  type?: 'text' | 'number' | 'badge' | 'link' | 'avatar' | 'image' | 'button' | 'icon' | 'date'
  decimals?: number
  dateFormat?: 'short' | 'long' | 'datetime' | 'time'
  dateLocale?: string
  badgeColorKey?: string
  badgeColor?: string
  badgeColorMap?: Record<string, string>
  badgeLabelMap?: Record<string, string>
  hrefKey?: string
  hrefTemplate?: string
  /**
   * `link`: open in a new tab. The link is marked as such — an external-link
   * glyph and the words "opens in a new tab" for a screen reader — and gets
   * `rel="noopener noreferrer"`. An in-app link is written by
   * `context.appHref`, so the new tab opens the page, not the app's root.
   */
  newTab?: boolean
  avatarKey?: string
  /** `image`: the field holding the picture's text alternative (else `alt`, else decorative). */
  altKey?: string
  /** `image`: a fixed text alternative for every row's picture. */
  alt?: string
  /** `image`: the picture's box, in px (square; default 32). */
  imageSize?: number
  nameKey?: string
  showName?: boolean
  buttonLabel?: string
  buttonVariant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  icon?: string
  iconColor?: string
}

function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  if (!key.includes('.')) return obj[key]
  return key
    .split('.')
    .reduce<unknown>(
      (curr, k) =>
        curr != null && typeof curr === 'object' ? (curr as Record<string, unknown>)[k] : undefined,
      obj
    )
}

// Object cell values (SharePoint person/lookup fields resolve to
// { LookupValue, LookupId, … }) must never surface as "[object Object]" —
// pick the conventional display field; arrays join; opaque objects go blank.
const DISPLAY_KEYS = ['LookupValue', 'Title', 'DisplayName', 'Name', 'label', 'text', 'value']
function displayValue(raw: unknown): string {
  if (raw == null) return ''
  if (Array.isArray(raw)) return raw.map(displayValue).filter(Boolean).join(', ')
  if (typeof raw === 'object') {
    for (const k of DISPLAY_KEYS) {
      const v = (raw as Record<string, unknown>)[k]
      if (typeof v === 'string' && v) return v
      if (typeof v === 'number') return String(v)
    }
    return ''
  }
  return String(raw)
}

/**
 * A DATE-ONLY STRING HAS NO INSTANT, AND READING IT AS ONE MOVES THE DAY.
 *
 * `new Date('2026-10-15')` is UTC midnight by spec, so every reader west of
 * Greenwich renders "14 Ekim" for a value that says the 15th. Appending a
 * bare time makes it that calendar day WHERE THE READER IS, which is what a
 * date-only field means. Values that DO carry an instant (`…T21:00:00Z`, the
 * shape SharePoint returns) keep instant semantics and are rendered in the
 * reader's zone — that is how `2026-10-14T21:00:00Z` reads back as 15.10.2026
 * in Istanbul, matching SharePoint's own rendering of the same row.
 */
function parseDateValue(raw: unknown): Date | null {
  const ok = (d: Date): Date | null => (Number.isNaN(d.getTime()) ? null : d)
  if (raw instanceof Date) return ok(raw)
  if (typeof raw === 'number') return ok(new Date(raw))
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ok(new Date(`${s}T00:00:00`))
  return ok(new Date(s))
}

const DATE_FORMAT_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  // One human format from the app locale ("17 Nov 2026"), not 11/17/2026.
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  datetime: {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
  time: { hour: '2-digit', minute: '2-digit' },
}

/**
 * PURE. The locale to format in: the column's `dateLocale`, else `appLocale`
 * (the render context's `locale`; undefined = the visitor's formats), and the
 * app locale too when the column names one this runtime cannot honour.
 *
 * A TRY/CATCH AROUND `Intl.DateTimeFormat` DOES NOT CATCH THIS, measured: an
 * unsupported-but-well-formed tag (`zzz-BOZUK`) does not throw — Intl silently
 * resolves to the RUNTIME's default locale, so the cell rendered 10/15/2026 on
 * a US-defaulted machine while the code claimed it had fallen back to Turkish.
 * Only a malformed tag throws. Both cases have to be checked, and they are
 * checked here rather than at the format call so the intent survives.
 */
function resolveDateLocale(tag: string | undefined, appLocale: string | undefined): string | undefined {
  if (!tag) return appLocale
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(tag).length > 0 ? tag : appLocale
  } catch {
    return appLocale
  }
}

/**
 * PURE. The rendered text of a `type: 'date'` cell, or '' when the value is
 * not a date. Returning '' (rather than the raw text) lets callers decide the
 * fallback: the cell falls back to the raw string so an unparseable value is
 * never silently blanked.
 */
function formatDateCell(raw: unknown, col: TableColumnData, appLocale: string | undefined): string {
  const d = parseDateValue(raw)
  if (!d) return ''
  const options = DATE_FORMAT_OPTIONS[col.dateFormat ?? 'short'] ?? DATE_FORMAT_OPTIONS.short
  return new Intl.DateTimeFormat(resolveDateLocale(col.dateLocale, appLocale), options).format(d)
}

/**
 * PURE. What the reader actually SEES in a cell — used by the filter so that
 * typing "15.10.2026" matches a column that displays 15.10.2026. The raw text
 * is kept alongside it, so the underlying "2026-10-15" still matches too.
 *
 * DELIBERATELY NOT USED BY SORT. Sorting compares `displayValue(raw)`, and for
 * an ISO timestamp that string order IS chronological order. Sorting the
 * formatted text instead would order 15.10.2026 by its leading day number —
 * every December before every January.
 */
function filterText(raw: unknown, col: TableColumnData, appLocale: string | undefined): string {
  const text = displayValue(raw)
  if ((col.type ?? 'text') !== 'date') return text
  const formatted = formatDateCell(raw, col, appLocale)
  return formatted ? `${formatted} ${text}` : text
}

/**
 * PURE. A `type: 'number'` cell: grouped by `locale` (the render context's
 * app locale; undefined = the visitor's), at most `decimals` places. A value
 * that is not a number keeps its text.
 */
export function formatNumberCell(raw: unknown, decimals: number, locale: string | undefined): string {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return displayValue(raw)
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(n).replace(/-/g, '−')
  } catch {
    return String(n)
  }
}

/** Semantic badge tones → theme tokens (see `badgeColorMap`). */
const BADGE_TONES: Record<string, string> = {
  danger: 'var(--pw-color-error)',
  error: 'var(--pw-color-error)',
  warning: 'var(--pw-color-warning)',
  success: 'var(--pw-color-success)',
  info: 'var(--pw-color-info)',
  primary: 'var(--pw-color-primary)',
  muted: 'var(--pw-color-text-muted)',
}

export const TableBlock: BlockComponent = ({ props, block, context }) => {
  // The table's own words are the app's (ui.table.*).
  const filterWord = useAppMessage('ui.table.filter', '')
  const selectAllWord = useAppMessage('ui.table.selectAll', '')
  const selectWord = useAppMessage('ui.table.select', '')
  const newTabWord = useAppMessage('ui.table.newTab', '')
  const selectRowTemplate = useAppMessage('ui.table.selectRow', '', { n: '{n}' }) // filled per row below
  // No invented "Column 1/2": a table without columns shows none.
  const p = props as unknown as TableProps
  const defaultColumns: TableColumnData[] = []
  const rawData = listOf<Record<string, unknown>>(p.data)
  // `columnsFrom: 'data'` — derive the columns from the first row's keys. For
  // sources whose shape is only known at runtime (a workbook range whose header
  // row IS the schema) a fixed `columns` list cannot be written in advance.
  // Private keys (`__rowIndex`) are skipped; `columns` still wins when given.
  const derivedColumns = React.useMemo<TableColumnData[] | null>(() => {
    if (p.columnsFrom !== 'data') return null
    const first = rawData[0]
    if (!first) return []
    // A column whose every filled value is a number is a number column:
    // grouped by the app locale and right-aligned, like a written one.
    const isNumberColumn = (key: string): boolean => {
      let seen = false
      for (const row of rawData) {
        const v = row?.[key]
        if (v === null || v === undefined || v === '') continue
        if (typeof v !== 'number' || !Number.isFinite(v)) return false
        seen = true
      }
      return seen
    }
    return Object.keys(first)
      .filter((k) => !k.startsWith('__') && k !== 'id')
      .map((key) =>
        isNumberColumn(key)
          ? { key, header: key, align: 'right' as const, type: 'number' as const }
          : { key, header: key, align: 'left' as const }
      )
  }, [p.columnsFrom, rawData])
  const columns =
    listOf(p.columns).length > 0
      ? listOf<TableColumnData>(p.columns)
      : derivedColumns ?? defaultColumns
  const sortable = p.sortable
  const filterable = p.filterable
  const [sort, setSort] = React.useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [filter, setFilter] = React.useState('')

  // Displayed rows: first the global filter (a case-insensitive substring over
  // every column value), then sorting (numeric-aware, Turkish locale — "2" <
  // "10", dotted/dotless I handled). Column keys resolve through the same
  // getNestedValue path as the cells. With both features off, rawData passes
  // through unchanged.
  const data = React.useMemo(() => {
    let rows = rawData
    if (filterable && filter.trim()) {
      const q = filter.trim().toLocaleLowerCase('tr').replace(/ı/g, 'i')
      rows = rows.filter((row) =>
        columns.some((col) => filterText(getNestedValue(row, col.key), col, context.locale).toLocaleLowerCase('tr').replace(/ı/g, 'i').includes(q))
      )
    }
    if (sortable && sort) {
      const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' })
      rows = [...rows].sort((a, b) => {
        // RAW, NOT `filterText` — see its note. ISO string order is already
        // chronological order; the formatted text is not.
        const cmp = collator.compare(
          displayValue(getNestedValue(a, sort.key)),
          displayValue(getNestedValue(b, sort.key))
        )
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [rawData, filterable, filter, sortable, sort, columns, context.locale])

  const cycleSort = (key: string): void => {
    if (!sortable) return
    setSort((prev) =>
      prev?.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null
    )
  }

  const bordered = p.bordered
  const compact = p.compact
  const striped = p.striped
  const hoverable = p.hoverable
  const selectable = p.selectable
  const headerColor = typeof p.headerColor === 'string' ? p.headerColor : undefined
  const headerTextColor =
    typeof p.headerTextColor === 'string' ? p.headerTextColor : undefined
  const rowAccentKey = typeof p.rowAccentKey === 'string' ? p.rowAccentKey : undefined

  // Render unification: real side-effects (selection mutation, link
  // navigation) are suppressed in `inert` (editor/preview) renders. Defaults
  // to live.
  const inert = context?.interactionMode === 'inert'

  const [hoveredRow, setHoveredRow] = React.useState<number | null>(null)
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set())

  const allSelected = data.length > 0 && selected.size === data.length
  const someSelected = selected.size > 0 && !allSelected

  const toggleRow = (rowIndex: number): void => {
    if (inert) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rowIndex)) next.delete(rowIndex)
      else next.add(rowIndex)
      return next
    })
  }

  const toggleAll = (): void => {
    if (inert) return
    setSelected((prev) => (prev.size === data.length ? new Set() : new Set(data.map((_, i) => i))))
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--pw-font-size-sm)',
    ...(p.fixedLayout ? { tableLayout: 'fixed' as const } : {}),
  }

  const cellStyle = (align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties => ({
    padding: compact
      ? '8px 12px'
      : '12px 16px',
    textAlign: align,
    borderBottom: bordered ? '1px solid var(--pw-color-border)' : undefined,
    borderLeft: bordered ? '1px solid var(--pw-color-border)' : undefined,
    borderRight: bordered ? '1px solid var(--pw-color-border)' : undefined,
  })

  const headerStyle = (align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties => ({
    ...cellStyle(align),
    backgroundColor: headerColor ?? 'var(--pw-color-card)',
    color: headerTextColor ?? 'var(--pw-color-text-on-card, var(--pw-color-text))',
    fontWeight: 600,
    borderTop: bordered ? '1px solid var(--pw-color-border)' : undefined,
  })

  // The checkbox column has no associated data column, so it gets a plain
  // header/cell padding without column alignment.
  const selectCellStyle: React.CSSProperties = {
    ...cellStyle('center'),
    width: '1%',
    whiteSpace: 'nowrap',
  }
  const selectHeaderStyle: React.CSSProperties = {
    ...headerStyle('center'),
    width: '1%',
    whiteSpace: 'nowrap',
  }

  // Initials from a display name, mirroring the avatar control block.
  const getInitials = (nameStr: string): string =>
    nameStr
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const buttonVariantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--pw-color-primary)',
      color: 'var(--pw-color-text-on-primary)',
      border: 'none',
    },
    secondary: {
      backgroundColor: 'var(--pw-color-card)',
      color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
      border: '1px solid var(--pw-color-border)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--pw-color-primary-ink, #18181b)',
      border: '1px solid var(--pw-color-primary)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--pw-color-primary-ink, #18181b)',
      border: 'none',
    },
    destructive: {
      backgroundColor: 'var(--pw-color-error)',
      // Ink by its ground, as foundation's button (P2).
      color: inkOn('var(--pw-color-error)', '--pw-color-on-error'),
      border: 'none',
    },
  }

  const renderCell = (
    col: TableColumnData,
    row: Record<string, unknown>,
    rowIndex: number
  ): React.ReactNode => {
    const raw = getNestedValue(row, col.key)
    const text = displayValue(raw)
    const type = col.type ?? 'text'

    if (type === 'number') return formatNumberCell(raw, col.decimals ?? 2, context.locale)

    if (type === 'date') {
      // An unparseable value keeps its raw text: a cell that silently empties
      // reads as "no data" when the truth is "unexpected shape".
      return formatDateCell(raw, col, context.locale) || text
    }

    if (type === 'badge') {
      const fromKey =
        col.badgeColorKey != null ? getNestedValue(row, col.badgeColorKey) : undefined
      const mapped = col.badgeColorMap ? col.badgeColorMap[String(raw ?? '')] : undefined
      // A boolean/code column prints a word, not `true` or `ACT_2`. The lookup
      // is on the RAW value so `false` and `0` map as readily as `high`.
      const label = col.badgeLabelMap ? col.badgeLabelMap[String(raw ?? '')] : undefined
      const pillColor =
        (mapped !== undefined ? (BADGE_TONES[mapped] ?? mapped) : undefined) ??
        (typeof fromKey === 'string' ? fromKey : undefined) ??
        col.badgeColor ??
        'var(--pw-color-text-muted)'
      return (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            // The theme's corner, not a fixed pill: a square theme
            // got round status pills in every table.
            borderRadius: 'var(--pw-border-radius, 999px)',
            fontSize: 'var(--pw-font-size-xs)',
            fontWeight: 600,
            lineHeight: 1.6,
            backgroundColor: pillColor,
            // Ink by the pill's own fill (P4a): text-on-primary is the BRAND's
            // ink, white on a warning yellow.
            color: inkOn(pillColor),
            whiteSpace: 'nowrap',
          }}
        >
          {label ?? text}
        </span>
      )
    }

    if (type === 'link') {
      const hrefRaw =
        col.hrefTemplate != null
          ? col.hrefTemplate.replace(/\{([\w.]+)\}/g, (_m, field: string) => {
              const v = getNestedValue(row, field)
              return v == null ? '' : encodeURIComponent(String(v))
            })
          : col.hrefKey != null
            ? getNestedValue(row, col.hrefKey)
            : raw
      // A numeric id is a valid href value too — it used to fall back to '#'.
      const hrefStr = typeof hrefRaw === 'string' ? hrefRaw : typeof hrefRaw === 'number' ? String(hrefRaw) : '#'
      // A link the block builds itself is written for the router
      // (`context.appHref`): `/product?id=7` is `#/product?id=7` on a
      // hash-routed host, so it works opened in a new tab or copied. Absolute
      // URLs, fragments and media links come back as given.
      const safe = safeHref(hrefStr)
      const href = safe !== undefined ? (context?.appHref ? context.appHref(safe) : safe) : '#'
      const newTab = col.newTab === true
      return (
        <a
          href={href}
          data-pw-hit=""
          {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          style={{
            color: 'var(--pw-color-primary-ink, #18181b)',
            textDecoration: 'underline',
            ...(newTab ? { display: 'inline-flex', alignItems: 'center', gap: 4 } : {}),
          }}
          // In inert (editor/preview) renders, suppress real navigation so the
          // surface never leaves the page.
          onClick={inert ? (e) => e.preventDefault() : undefined}
        >
          {text}
          {newTab && (
            <>
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flex: '0 0 auto' }}
                dangerouslySetInnerHTML={{ __html: (ICON_PATHS['external-link'] ?? []).join('') }}
              />
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
                {` (${newTabWord})`}
              </span>
            </>
          )}
        </a>
      )
    }

    if (type === 'avatar') {
      const imgRaw = col.avatarKey != null ? getNestedValue(row, col.avatarKey) : undefined
      const imgSrc = typeof imgRaw === 'string' && imgRaw.length > 0 ? imgRaw : undefined
      const nameRaw = col.nameKey != null ? getNestedValue(row, col.nameKey) : raw
      const name = typeof nameRaw === 'string' && nameRaw.length > 0 ? nameRaw : text
      const showName = col.showName !== false
      const size = 28
      // The name beside it already says who: the picture is then decorative
      // (an alt repeating the name was read twice). Alone, it is named by the name.
      const decorative = showName && Boolean(name)
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span
            aria-hidden={decorative || !name ? 'true' : undefined}
            role={!decorative && name && !imgSrc ? 'img' : undefined}
            aria-label={!decorative && name && !imgSrc ? name : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
              width: size,
              height: size,
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: 'var(--pw-color-primary)',
              color: 'var(--pw-color-text-on-primary)',
              fontSize: 'var(--pw-font-size-xs)',
              fontWeight: 600,
            }}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={decorative ? '' : name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              getInitials(name)
            )}
          </span>
          {showName && name ? <span>{name}</span> : null}
        </span>
      )
    }

    // A picture drawn as itself (a weather icon, a product thumbnail): no
    // circle, no brand fill, the whole picture inside its box.
    if (type === 'image') {
      const src = typeof raw === 'string' && raw.trim() ? safeHref(raw.trim()) : undefined
      if (!src) return null
      const altRaw = col.altKey != null ? getNestedValue(row, col.altKey) : col.alt
      const alt = typeof altRaw === 'string' ? altRaw : ''
      const box = typeof col.imageSize === 'number' && col.imageSize > 0 ? col.imageSize : 32
      return (
        <img
          src={src}
          alt={alt}
          width={box}
          height={box}
          loading="lazy"
          style={{ display: 'block', width: box, height: box, objectFit: 'contain', flex: '0 0 auto' }}
        />
      )
    }

    if (type === 'button') {
      const label = col.buttonLabel ?? text
      if (!label) return null
      const variant = col.buttonVariant ?? 'secondary'
      const handleClick = (e: React.MouseEvent): void => {
        // Inert-safe: no real navigation here; emit a notification so the host
        // gets feedback (same posture as the link cell / control.button block).
        e.stopPropagation()
        context?.onEvent?.({
          type: 'click',
          blockId: block.id,
          payload: { column: col.key, rowIndex },
          originalEvent: e.nativeEvent,
        })
      }
      return (
        <button
          type="button"
          data-pw-hit=""
          onClick={handleClick}
          style={{
            ...(buttonVariantStyles[variant] ?? buttonVariantStyles.secondary),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 12px',
            borderRadius: 'var(--pw-button-radius, var(--pw-border-radius))',
            fontSize: 'var(--pw-font-size-xs)',
            fontWeight: 600,
            lineHeight: 1.6,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </button>
      )
    }

    if (type === 'icon') {
      const iconName = col.icon ?? (text.length > 0 ? text : 'circle')
      const paths =
        ICON_PATHS[iconName] ?? ICON_PATHS.circle ?? ['<circle cx="12" cy="12" r="10"/>']
      const size = 18
      return (
        <span
          aria-label={iconName}
          role="img"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            color: col.iconColor,
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: paths.join('') }}
          />
        </span>
      )
    }

    return text
  }

  const loading = p.loadingWhen === true
  const failed = Boolean(p.errorWhen) && !loading && data.length === 0
  const emptyText = typeof p.emptyText === 'string' ? p.emptyText.trim() : ''
  const errorText = typeof p.errorText === 'string' ? p.errorText.trim() : ''
  const loadingText = typeof p.loadingText === 'string' ? p.loadingText.trim() : ''
  const phoneRows = p.phoneLayout === 'rows'
  const filterPlaceholder =
    typeof p.filterPlaceholder === 'string' && p.filterPlaceholder ? p.filterPlaceholder : filterWord
  const skeletonRows =
    typeof p.loadingRows === 'number' && Number.isFinite(p.loadingRows) ? Math.min(50, Math.max(1, Math.round(p.loadingRows))) : 3
  const bodyColSpan = columns.length + (selectable ? 1 : 0) || 1

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      style={{
        width: '100%',
        // minWidth:0 lets the box shrink below the table's min-content width when
        // it's a flex/grid child (default min-width:auto would otherwise refuse to
        // shrink → the wide table pushes the parent past the viewport). (gym finding)
        minWidth: 0,
        maxWidth: '100%',
        border: bordered ? '1px solid var(--pw-color-border)' : undefined,
        ...block.style,
      }}
      data-block-type="table"
    >
      {filterable && (
        <div style={{ padding: '10px 12px', borderBottom: bordered ? '1px solid var(--pw-color-border)' : undefined }}>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
            style={{
              width: '100%',
              maxWidth: 320,
              padding: '7px 12px',
              fontSize: 'var(--pw-font-size-sm)',
              fontFamily: 'inherit',
              color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
              backgroundColor: 'var(--pw-color-card)',
              border: '1px solid var(--pw-color-border)',
              borderRadius: 'var(--pw-border-radius-sm, 6px)',
            }}
          />
        </div>
      )}
      {/* The scroll box is its own element: block.style used to land on
          the scroller itself, so a flex parent could widen it and the
          surface's overflow clip cut the right-hand columns on a phone. */}
      {/* Phone: below 480px of its own width the table becomes a stack of
          label/value cards (one per row) — columns were clipped at 390px.
          The box is a size container so the rule follows the table's real
          width (a narrow aside stacks too), not the viewport. Inline cell
          styles are overridden with !important on purpose. */}
      <style>{TABLE_STACK_CSS + HIT_AREA_CSS}</style>
      <div style={{ overflowX: 'auto', width: '100%', minWidth: 0, maxWidth: '100%', containerType: 'inline-size' }}>
      <table
        style={tableStyle}
        {...(phoneRows ? { 'data-pw-table-rows': '' } : { 'data-pw-table': '' })}
        aria-busy={loading && data.length === 0 ? true : undefined}
      >
        {loading && data.length === 0 && loadingText ? (
          <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
            {loadingText}
          </caption>
        ) : null}
        <thead>
          <tr>
            {selectable && (
              <th style={selectHeaderStyle}>
                <input
                  type="checkbox"
                  aria-label={selectAllWord}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  disabled={inert}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((col: TableColumnData) => (
              <th
                key={col.key}
                scope="col"
                style={{ ...headerStyle(col.align), ...(col.width !== undefined ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : {}) }}
                aria-sort={
                  sortable
                    ? sort?.key === col.key
                      ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                    : undefined
                }
              >
                {sortable ? (
                  // A real button: a clickable <th> had no keyboard
                  // access and no role; the arrow is decoration only.
                  <button
                    type="button"
                    onClick={() => cycleSort(col.key)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      font: 'inherit',
                      color: 'inherit',
                      textAlign: 'inherit',
                    }}
                  >
                    {col.header}
                    <span aria-hidden="true" style={{ marginLeft: 6, opacity: sort?.key === col.key ? 1 : 0.3, fontSize: 'var(--pw-font-size-xs)' }}>
                      {sort?.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Fetch FAILED (errorWhen = "{{__errors.<sourceId>}}" message string):
              an error row instead of a false empty body. The message is shown
              and announced — a tooltip reached nobody. */}
          {failed ? (
            <tr data-source-error>
              <td colSpan={bodyColSpan} style={cellStyle('left')}>
                <div
                  role="alert"
                  style={{
                    minHeight: 24,
                    padding: '6px 10px',
                    borderRadius: 'var(--pw-border-radius-sm, 6px)',
                    border: '1px solid var(--pw-color-error, #dc2626)',
                    color: 'var(--pw-color-error, #dc2626)',
                    background: 'color-mix(in srgb, var(--pw-color-error, #dc2626) 8%, transparent)',
                  }}
                >
                  {errorText || (typeof p.errorWhen === 'string' ? p.errorWhen : null)}
                </div>
              </td>
            </tr>
          ) : null}
          {!failed && !loading && data.length === 0 && emptyText ? (
            <tr data-empty>
              <td
                colSpan={bodyColSpan}
                style={{ ...cellStyle('center'), color: 'var(--pw-color-text-muted, #71717a)' }}
              >
                {emptyText}
              </td>
            </tr>
          ) : null}
          {/* Loading skeleton (loadingStrategy:"immediate" renderer mode):
              receipt binds `"loadingWhen": "{{__loading.<sourceId>}}"` — while
              the source is in flight and no rows have landed, shimmer bars
              render instead of an empty body. Unbound → identical to before. */}
          {loading && data.length === 0
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={`skeleton-${i}`} aria-busy="true">
                  {selectable && <td style={selectCellStyle} />}
                  {/* Columns taken from the data (columnsFrom) are not known before
                      the rows arrive: the frame is then one full-width bar per row,
                      so the table still holds its rows' height while it loads. */}
                  {(columns.length > 0 ? columns : [{ key: '__loading', header: '', align: undefined } as unknown as (typeof columns)[number]]).map((col, colIndex) => (
                    // data-label: on a phone a skeleton row is a card of the
                    // same shape as a loaded one.
                    <td key={col.key} style={cellStyle(col.align)} data-label={col.header}>
                      {i === 0 && colIndex === 0 && (
                        <style>
                          {'@keyframes pw-skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}
                        </style>
                      )}
                      {/* A line of text tall (the no-break space), so a skeleton row
                          is as tall as a loaded one; the bar sits in it. */}
                      <div
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          verticalAlign: 'middle',
                          width: `${55 + ((i * 17) % 30)}%`,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: 'color-mix(in srgb, var(--pw-color-text) 7%, transparent)',
                          backgroundImage:
                            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--pw-color-text) 14%, transparent), transparent)',
                          backgroundSize: '200% 100%',
                          animation: 'pw-skeleton-shimmer 1.5s infinite',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {data.map((row: Record<string, unknown>, rowIndex: number) => {
            const accentRaw = rowAccentKey ? getNestedValue(row, rowAccentKey) : undefined
            const accent = typeof accentRaw === 'string' ? accentRaw : undefined
            const isSelected = selected.has(rowIndex)
            return (
              <tr
                key={rowIndex}
                style={{
                  // Tints mixed from the text/primary tokens: the card
                  // colour itself was invisible inside a card.
                  backgroundColor:
                    selectable && isSelected
                      ? 'color-mix(in srgb, var(--pw-color-primary) 10%, transparent)'
                      : hoverable && hoveredRow === rowIndex
                        ? 'color-mix(in srgb, var(--pw-color-text) 5%, transparent)'
                        : striped && rowIndex % 2 === 1
                          ? 'color-mix(in srgb, var(--pw-color-text) 3%, transparent)'
                          : undefined,
                  // Per-row left-edge accent / status stripe.
                  boxShadow: accent ? `inset 4px 0 0 0 ${accent}` : undefined,
                  cursor: hoverable ? 'pointer' : undefined,
                  transition: hoverable ? 'background-color 0.1s' : undefined,
                }}
                onMouseEnter={hoverable ? () => setHoveredRow(rowIndex) : undefined}
                onMouseLeave={hoverable ? () => setHoveredRow(null) : undefined}
              >
                {selectable && (
                  <td style={selectCellStyle} data-label={selectWord}>
                    <input
                      type="checkbox"
                      aria-label={selectRowTemplate.replace('{n}', String(rowIndex + 1))}
                      checked={isSelected}
                      disabled={inert}
                      onChange={() => toggleRow(rowIndex)}
                      // Don't trigger row hover styling churn on the checkbox.
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {columns.map((col: TableColumnData) => (
                  <td key={col.key} style={cellStyle(col.align)} data-label={col.header}>
                    {renderCell(col, row, rowIndex)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
