import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, CONTROL_BORDER, ICON_PATHS, MOTION, safeRenderValue, safeHref, cssUnit, type CSSUnit } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================
//
// The one native gap this block fills: DataBoundSurfaceRenderer's
// {{sourceId}} expression binding can hand a WHOLE resolved array to a
// block's prop (confirmed in resolve-expressions.ts — arrays pass through
// resolveValue unchanged), but nothing in the platform turns that array into
// N sibling blocks — no repeater/map primitive exists at the surface level.
// This block is the fix: it receives the array as `items` and maps it
// internally, so a single `{"type":"repeater","props":{"items":"{{sourceId}}"}}`
// declaration replaces what would otherwise need N hand-authored blocks.
//
// `layout: "row"` adds a second, horizontal rendering mode for the
// SAME items[] input — avatar/icon left, heading+subtitle middle, badge/CTA
// trailing right. This is a straight extension of the existing block (not a
// new one): the static, hand-composed version of this row shape is the
// row layout; this mode draws it for data-bound
// (variable-length) arrays, where static per-item authoring isn't possible.
// `layout` defaults to "card" (the original behavior), so existing usage is
// unaffected.

export const REPEATER_LAYOUTS = ['card', 'row', 'inline'] as const
export const REPEATER_CTA_VARIANTS = ['solid', 'outline', 'ghost'] as const

export interface RepeaterProps {
  /** The rows. A single record (an object, not a list) is a list of one. */
  readonly items: readonly Readonly<Record<string, unknown>>[] | Readonly<Record<string, unknown>>
  readonly maxItems: number
  readonly columns: number
  /** Gap between items in px. Unset: the theme's spacing token for the layout. */
  readonly gap?: number
  /**
   * `inline`: the items WRAP as chips on as many lines as they need —
   * tags, categories, a filter row. With template children (`repeat`) the
   * clones are laid out the same way, so a repeated badge becomes a chip row.
   */
  readonly layout: (typeof REPEATER_LAYOUTS)[number]
  /**
   * Card layout only — minimum grid cell width in px. A NARROW column that
   * wants a real N-across tile grid sets a smaller value (e.g. 90).
   */
  readonly minCellWidth: number
  /** Card layout only — app-launcher tile treatment: centered icon over a small label. */
  readonly compact: boolean
  // Real field internal names on the bound data source — never guessed,
  // always the exact keys present on each item.
  readonly headingField: string
  readonly textField?: string
  readonly iconField?: string
  readonly iconMap?: Readonly<Record<string, string>>
  readonly iconDefault: string
  /** layout:"row" only — avatar image field; an item without one shows the initials of its heading. */
  readonly avatarField?: string
  /** layout:"row" only — secondary text line under the heading. */
  readonly subtitleField?: string
  /** layout:"row" only — trailing small numeric badge (e.g. like/comment count). */
  readonly badgeField?: string
  /** layout:"row" only — per-item CTA label field; wins over the static `ctaLabel`. */
  readonly ctaLabelField?: string
  readonly ctaLabel?: string
  readonly ctaHrefField?: string
  readonly ctaVariant: (typeof REPEATER_CTA_VARIANTS)[number]
  /** No default: the page owns its empty state. Unset → an empty list renders nothing. */
  readonly emptyText?: string
  /**
   * Bind to `"{{__loading.<sourceId>}}"`. While truthy AND no items have landed
   * yet, placeholder skeleton rows/cells render instead of emptyText.
   */
  readonly loadingWhen?: boolean
  /**
   * The loading frame at the loaded size: how many items the list holds once
   * loaded, and each item's height (px, or a CSS length). Both set: that many
   * frames of that height, laid out exactly as the items will be, so nothing
   * under the list moves when they arrive. Unset: a few generic rows/cells.
   */
  readonly loadingCount?: number
  readonly loadingHeight?: number | string
  /**
   * Bind to `"{{__errors.<sourceId>}}"` (the error MESSAGE string, or null when
   * healthy). Truthy + zero items renders a quiet error-tinted shape; the
   * message only surfaces as a title tooltip.
   */
  readonly errorWhen?: string | boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const repeaterDefinition: BlockDefinition = {
  type: 'repeater',
  name: 'Repeater',
  category: 'data',
  icon: '▦',
  defaultProps: {
    items: [],
    maxItems: 10,
    columns: 1,
    gap: 16,
    layout: 'card',
    headingField: 'heading',
    iconDefault: 'star',
    ctaVariant: 'outline',
  },
  // Item-template mode (the runtime's `repeat` expansion): the block carries a
  // block-level `"repeat": "{{source}}"` + a children TEMPLATE; the runtime
  // clones the children per item with an {{item.*}} scope and this block only
  // renders the clones as a layout wrapper. canHaveChildren is true for this —
  // use without children (field-mapping props) is unchanged.
  canHaveChildren: true,
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
}

// ============================================================
// SHARED
// ============================================================

/**
 * Local text-color override for this item's own painted background — see
 * panel/card/component.tsx for the full rationale. Falls through unchanged
 * for themes that never define the on-card variants.
 */
const ON_CARD_TEXT_VARS: React.CSSProperties = {
  ['--pw-color-text' as string]: 'var(--pw-color-text-on-card, var(--pw-color-text))',
  ['--pw-color-text-muted' as string]: 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted))',
}

function renderIcon(icon: string): React.ReactElement {
  const paths = ICON_PATHS[icon] ?? ICON_PATHS.circle ?? ['<circle cx="12" cy="12" r="10"/>']
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: paths.join('') }}
    />
  )
}

// ============================================================
// CARD LAYOUT (original)
// ============================================================

/**
 * Card visual matches panel.feature-card deliberately — this block can't
 * import that block's component directly (each block compiles standalone via
 * bundleAtom, no cross-block imports), so the same style tokens are repeated
 * here rather than introducing a third, diverging card look.
 */
/** One item of `layout: "inline"`: a chip in the theme's full radius, a link when it has an href. */
function RepeaterChip({ label, href }: { label: string; href?: string | undefined }): React.ReactElement | null {
  if (!label) return null
  const safe = safeHref(href)
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: 'var(--pw-border-radius-full, 9999px)',
    boxShadow: `inset 0 0 0 1px ${CONTROL_BORDER}`,
    color: 'var(--pw-color-text)',
    fontSize: 'var(--pw-font-size-sm, 14px)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    transition: `box-shadow ${MOTION.normal}, background-color ${MOTION.normal}`,
  }
  return safe ? (
    <a href={safe} style={style} data-repeater-chip="">
      {label}
    </a>
  ) : (
    <span style={style} data-repeater-chip="">
      {label}
    </span>
  )
}

function RepeaterCard({
  id,
  heading,
  text,
  icon,
  avatarSrc,
  linkHref,
  compact,
}: {
  id: string
  heading: string
  text: string | undefined
  icon: string
  avatarSrc: string | undefined
  linkHref: string | undefined
  compact: boolean
}): React.ReactElement {
  const cardStyle: React.CSSProperties = {
    ...ON_CARD_TEXT_VARS,
    display: 'flex',
    flexDirection: 'column',
    alignItems: compact ? 'center' : 'flex-start',
    ...(compact ? { justifyContent: 'center', textAlign: 'center' as const } : {}),
    gap: compact ? '6px' : 'var(--pw-space-sm)',
    padding: compact ? '14px 8px' : 'var(--pw-space-lg)',
    backgroundColor: 'var(--pw-color-card)',
    borderRadius: compact ? 'var(--pw-border-radius)' : 'var(--pw-border-radius-lg)',
    border: '1px solid var(--pw-color-border)',
    boxShadow: compact ? 'none' : 'var(--pw-shadow-sm)',
    height: '100%',
  }
  const iconChipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: compact ? 34 : 44,
    height: compact ? 34 : 44,
    borderRadius: 'var(--pw-border-radius)',
    backgroundColor: 'color-mix(in srgb, var(--pw-color-primary) 12%, transparent)',
    color: 'var(--pw-color-primary-ink, #18181b)',
  }
  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: compact ? 'var(--pw-font-size-xs)' : 'var(--pw-font-size-lg)',
    fontFamily: 'var(--pw-font-family-heading)',
    fontWeight: compact ? 600 : ('var(--pw-font-weight-heading)' as React.CSSProperties['fontWeight']),
    lineHeight: compact ? 1.3 : 'var(--pw-line-height-heading)',
    color: 'var(--pw-color-text)',
    ...(compact ? { overflowWrap: 'anywhere' as const } : {}),
  }
  const textStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--pw-font-size-base)',
    lineHeight: 'var(--pw-line-height-body)',
    color: 'var(--pw-color-text-muted)',
  }

  const avatarImgStyle: React.CSSProperties = { width: compact ? 34 : 44, height: compact ? 34 : 44, borderRadius: 'var(--pw-border-radius)', objectFit: 'contain' }
  const linkWrapStyle: React.CSSProperties = { textDecoration: 'none', color: 'inherit', display: 'contents' }
  const href = safeHref(linkHref)

  const content = (
    <>
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarSrc} alt="" style={avatarImgStyle} />
      ) : (
        <span style={iconChipStyle} data-icon-name={icon} aria-hidden="true">
          {renderIcon(icon)}
        </span>
      )}
      <h3 style={headingStyle}>{safeRenderValue(heading, '')}</h3>
      {text ? <p style={textStyle}>{safeRenderValue(text)}</p> : null}
    </>
  )

  return (
    <div key={id} data-block-type="repeater-card" style={cardStyle}>
      {href ? (
        <a href={href} style={linkWrapStyle}>
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  )
}

// ============================================================
// ROW LAYOUT
// this reproduces for a data-bound array.
// ============================================================

/** Up to two initials of a name, as control.avatar draws them ("Jane Doe" → "JD"). */
export function rowInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function RepeaterRow({
  id,
  heading,
  subtitle,
  icon,
  avatarSrc,
  personRow,
  badge,
  ctaLabel,
  ctaHref,
  ctaVariant,
}: {
  id: string
  heading: string
  subtitle: string | undefined
  icon: string
  avatarSrc: string | undefined
  /** The row names an `avatarField`: it is a person, so a missing picture shows initials. */
  personRow: boolean
  badge: string | undefined
  ctaLabel: string | undefined
  ctaHref: string | undefined
  ctaVariant: 'solid' | 'outline' | 'ghost'
}): React.ReactElement {
  const rowStyle: React.CSSProperties = {
    ...ON_CARD_TEXT_VARS,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--pw-space-sm)',
    padding: '10px',
    backgroundColor: 'var(--pw-color-card)',
    borderRadius: 'var(--pw-border-radius)',
  }
  const avatarStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 'var(--pw-border-radius-full)',
    flexShrink: 0,
    objectFit: 'cover',
    backgroundColor: 'color-mix(in srgb, var(--pw-color-primary) 12%, transparent)',
    color: 'var(--pw-color-primary-ink, #18181b)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  const bodyStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, flex: 1 }
  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: 600,
    color: 'var(--pw-color-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const subtitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 'var(--pw-font-size-xs)',
    color: 'var(--pw-color-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const badgeStyle: React.CSSProperties = {
    fontSize: 'var(--pw-font-size-xs)',
    color: 'var(--pw-color-text-muted)',
    flexShrink: 0,
  }
  const ctaBase: React.CSSProperties = {
    flexShrink: 0,
    fontSize: 'var(--pw-font-size-xs)',
    padding: '6px 10px',
    borderRadius: 'var(--pw-border-radius-sm)',
    textDecoration: 'none',
    fontWeight: 600,
    cursor: 'pointer',
  }
  const ctaStyle: React.CSSProperties =
    ctaVariant === 'solid'
      ? { ...ctaBase, backgroundColor: 'var(--pw-color-primary)', color: 'var(--pw-color-text-on-primary)' }
      : ctaVariant === 'outline'
        ? { ...ctaBase, border: '1px solid var(--pw-color-border)', color: 'var(--pw-color-text)' }
        : { ...ctaBase, color: 'var(--pw-color-primary-ink, #18181b)' }

  const href = safeHref(ctaHref)

  return (
    <div key={id} data-block-type="repeater-row" style={rowStyle}>
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarSrc} alt="" style={avatarStyle} />
      ) : personRow && rowInitials(heading) ? (
        // A person without a picture shows their initials — as control.avatar
        // does — not a generic icon that says nothing about who it is.
        <span style={{ ...avatarStyle, fontSize: 'var(--pw-font-size-sm)', fontWeight: 600 }} aria-hidden="true" data-avatar="initials">
          {rowInitials(heading)}
        </span>
      ) : (
        <span style={avatarStyle} aria-hidden="true">
          {renderIcon(icon)}
        </span>
      )}
      <div style={bodyStyle}>
        <p style={headingStyle}>{safeRenderValue(heading, '')}</p>
        {subtitle ? <p style={subtitleStyle}>{safeRenderValue(subtitle)}</p> : null}
      </div>
      {badge ? <span style={badgeStyle}>{safeRenderValue(badge)}</span> : null}
      {ctaLabel ? (
        href ? (
          <a href={href} style={ctaStyle} data-pw-hit="">
            {safeRenderValue(ctaLabel)}
          </a>
        ) : (
          // No address → nothing to do: a label, not a fake button.
          <span style={ctaStyle}>
            {safeRenderValue(ctaLabel)}
          </span>
        )
      ) : null}
    </div>
  )
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * SharePoint rich-text columns (e.g. FAQ.Body) arrive as raw HTML strings —
 * rendered verbatim they show literal `<p><ol><li>` markup. The repeater is a
 * plain-text summary view, so tag-bearing strings are flattened to text:
 * tags stripped, numeric entities + the common named ones decoded, whitespace
 * collapsed. Plain strings pass through untouched.
 */
const stripHtml = (v: string | undefined): string | undefined => {
  if (typeof v !== 'string' || !v.includes('<')) return v
  return v
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * THE TEMPLATE CONTRACT.
 *
 * Children are a PER-ITEM TEMPLATE only when the block carries a block-level
 * `"repeat": "{{source}}"`. The runtime expands that before this component
 * runs: every template child is cloned per item, `{{item.*}}` resolved in the
 * clone, and the clone's id suffixed `--<index>`. That suffix is how this block
 * tells an expanded template from children that were never expanded.
 *
 * `items` + `{{item.*}}` children WITHOUT `repeat` is the ghost-row shape: the runtime
 * renders the template once, outside any item scope, and the visitor sees one
 * ghost row. Thirteen pack patterns shipped exactly that. This block cannot
 * expand a template itself (expansion is the runtime's), so it refuses the
 * ghost: live, nothing is drawn and a console warning names the fix; in the
 * editor (inert) the template is shown under a visible notice. The pack gate
 * rejects the shape at source (`{{item.` needs an ancestor with `repeat`).
 */
export function isExpandedTemplate(block: { children?: ReadonlyArray<{ id?: unknown }> }): boolean {
  const kids = block.children ?? []
  return kids.length > 0 && kids.every((k) => /--\d+$/.test(String(k.id ?? '')))
}

/** A single record is a list of one — `items` bound to one object printed "No records". */
export function asItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((v) => v !== null && typeof v === 'object') as Record<string, unknown>[]
  if (value !== null && typeof value === 'object') return [value as Record<string, unknown>]
  return []
}

const warnedN42 = new Set<string>()

export const RepeaterBlock: BlockComponent = ({ props, block, children, context }) => {
  // Item-template mode: if the block carried a block-level `repeat` + a
  // children template, the runtime has already produced the clones and the
  // renderer passed them here as rendered React children — this block is only
  // the layout wrapper. The field-mapping path (the items prop) works exactly
  // as before when there are no children.
  const templateChildren = React.Children.count(children) > 0 ? children : null

  const p = props as unknown as RepeaterProps
  const items = asItems(p.items)
  const maxItems = p.maxItems
  const columns = p.columns
  const layout = p.layout
  const headingField = p.headingField
  const textField = p.textField
  const iconField = p.iconField
  const iconMap = p.iconMap ?? {}
  const iconDefault = p.iconDefault
  const avatarField = p.avatarField
  const subtitleField = p.subtitleField
  const badgeField = p.badgeField
  const ctaLabelField = p.ctaLabelField
  const staticCtaLabel = p.ctaLabel
  const ctaHrefField = p.ctaHrefField
  const ctaVariant = p.ctaVariant
  const emptyText = typeof p.emptyText === 'string' ? p.emptyText.trim() : ''
  const minCellWidth = p.minCellWidth
  const compact = p.compact

  const wrapperStyle: React.CSSProperties =
    layout === 'inline'
      ? {
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: cssUnit(p.gap) ?? 'var(--pw-space-sm, 8px)',
          width: '100%',
          ...block.style,
        }
      : layout === 'row'
      ? {
          display: 'flex',
          flexDirection: 'column',
          gap: cssUnit(p.gap) ?? 'var(--pw-space-sm)',
          width: '100%',
          ...block.style,
        }
      : {
          display: 'grid',
          // auto-fill, not auto-fit: the empty cells keep their place, so one
          // item (or the last of an uneven count) keeps its cell's width.
          gridTemplateColumns: `repeat(auto-fill, minmax(min(${columns <= 1 ? '100%' : `${minCellWidth}px`}, 100%), 1fr))`,
          gap: cssUnit(p.gap) ?? 'var(--pw-layout-grid-gap)',
          width: '100%',
          ...block.style,
        }

  const visible = items.slice(0, maxItems)

  // Item-template mode: render the runtime's clones in the layout wrapper;
  // return early only when there are clones, so that when empty (binding not
  // loaded / 0 items) the loadingWhen skeleton runs from the shared branches below.
  // Children that were never expanded while `items` carries records: the
  // ghost-row shape (see isExpandedTemplate above).
  const unexpandedTemplate =
    templateChildren !== null && items.length > 0 && !isExpandedTemplate(block as { children?: ReadonlyArray<{ id?: unknown }> })
  if (unexpandedTemplate) {
    if (context?.interactionMode !== 'inert') {
      if (!warnedN42.has(block.id) && typeof console !== 'undefined') {
        warnedN42.add(block.id)
        console.warn(
          `[repeater ${block.id}] children with {{item.*}} need a block-level "repeat": "{{source}}" — without it the template renders once, outside any item. Nothing drawn.`
        )
      }
      return <div id={block.id} data-block-id={block.id} data-block-type="repeater" data-template-unexpanded="" hidden />
    }
    return (
      <div id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="repeater" data-template-unexpanded="">
        <p
          role="note"
          style={{
            margin: 0,
            padding: '8px 12px',
            border: '1px dashed var(--pw-color-warning)',
            borderRadius: 'var(--pw-border-radius)',
            color: 'var(--pw-color-text)',
            fontSize: 'var(--pw-font-size-sm)',
          }}
        >
          Template children need a block-level repeat — visitors see nothing until it is set.
        </p>
        {templateChildren}
      </div>
    )
  }

  if (templateChildren) {
    return (
      <div id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="repeater">
        {templateChildren}
      </div>
    )
  }

  // Truthy-tolerant: the {{__loading.x}} binding resolves to a real boolean,
  // but interpolated contexts can yield the string "true".
  const isLoading = p.loadingWhen === true
  // errorWhen resolves to the error MESSAGE string ({{__errors.x}}) — truthy
  // check and tooltip content in one binding.
  const errorMessage =
    typeof p.errorWhen === 'string' && p.errorWhen ? p.errorWhen : p.errorWhen === true ? ' ' : null

  if (errorMessage && !isLoading && visible.length === 0) {
    return (
      <div id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="repeater">
        <div
          data-source-error
          title={errorMessage.trim() || undefined}
          style={{
            minHeight: 40,
            borderRadius: 8,
            border: '2px dashed var(--pw-color-error, #dc2626)',
            background: 'color-mix(in srgb, var(--pw-color-error, #dc2626) 8%, transparent)',
          }}
        />
      </div>
    )
  }

  if (isLoading && visible.length === 0) {
    // Same shimmer language as the standalone skeleton block (identical
    // keyframe name — duplicate @keyframes definitions are idempotent).
    const bar = (w: string, h = 12): React.CSSProperties => ({
      width: w,
      height: h,
      borderRadius: 6,
      backgroundColor: 'color-mix(in srgb, var(--pw-color-text) 7%, transparent)',
      backgroundImage:
        'linear-gradient(90deg, transparent, color-mix(in srgb, var(--pw-color-text) 14%, transparent), transparent)',
      backgroundSize: '200% 100%',
      animation: 'pw-skeleton-shimmer 1.5s infinite',
    })
    const placeholderCount = layout === 'row' ? 3 : layout === 'inline' ? 4 : Math.min(4, Math.max(2, columns))
    const frameCount = typeof p.loadingCount === 'number' && Number.isFinite(p.loadingCount) ? Math.min(60, Math.max(1, Math.round(p.loadingCount))) : 0
    const frameHeight = cssUnit(p.loadingHeight as CSSUnit)
    if (frameCount > 0 && frameHeight) {
      return (
        <div id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="repeater" aria-busy="true">
          <style>{'@keyframes pw-skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
          {Array.from({ length: frameCount }, (_, i) => (
            <div key={i} data-pw-repeater-frame="" style={{ ...bar('100%'), height: frameHeight, boxSizing: 'border-box', borderRadius: 'var(--pw-border-radius, 8px)' }} />
          ))}
        </div>
      )
    }
    return (
      <div id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="repeater" aria-busy="true">
        <style>{'@keyframes pw-skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
        {Array.from({ length: placeholderCount }, (_, i) =>
          layout === 'inline' ? (
            <div key={i} style={{ ...bar(`${56 + (i % 3) * 16}px`, 28), borderRadius: 'var(--pw-border-radius-full, 9999px)' }} />
          ) : layout === 'row' ? (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
              <div style={{ ...bar('36px', 36), borderRadius: 10, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <div style={bar('45%')} />
                <div style={bar('70%', 10)} />
              </div>
            </div>
          ) : (
            <div
              key={i}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 12px' }}
            >
              <div style={{ ...bar('40px', 40), borderRadius: 12 }} />
              <div style={bar('60%')} />
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="repeater">
      {layout === 'row' && visible.length > 0 ? <style>{HIT_AREA_CSS}</style> : null}
      {visible.length === 0 ? (
        emptyText ? <p style={{ margin: 0, color: 'var(--pw-color-text-muted)' }}>{safeRenderValue(emptyText)}</p> : null
      ) : (
        visible.map((item, index) => {
          const heading = stripHtml((item[headingField] as string) ?? '') ?? ''
          const text = textField ? stripHtml(item[textField] as string) : undefined
          const iconFieldValue = iconField ? (item[iconField] as string) : undefined
          const icon = (iconFieldValue && iconMap[iconFieldValue]) ?? iconDefault
          const id = (item.id as string) ?? String(index)

          if (layout === 'inline') {
            return (
              <RepeaterChip
                key={id}
                label={heading}
                href={ctaHrefField ? (item[ctaHrefField] as string) : undefined}
              />
            )
          }
          if (layout === 'row') {
            return (
              <RepeaterRow
                key={id}
                id={id}
                heading={heading}
                subtitle={subtitleField ? stripHtml(item[subtitleField] as string) : undefined}
                icon={icon}
                avatarSrc={avatarField ? (item[avatarField] as string) : undefined}
                personRow={Boolean(avatarField)}
                badge={badgeField ? (item[badgeField] as string) : undefined}
                ctaLabel={ctaLabelField ? (item[ctaLabelField] as string) : staticCtaLabel}
                ctaHref={ctaHrefField ? (item[ctaHrefField] as string) : undefined}
                ctaVariant={ctaVariant}
              />
            )
          }
          return (
            <RepeaterCard
              key={id}
              id={id}
              heading={heading}
              text={text}
              icon={icon}
              avatarSrc={avatarField ? (item[avatarField] as string) : undefined}
              linkHref={ctaHrefField ? (item[ctaHrefField] as string) : undefined}
              compact={compact}
            />
          )
        })
      )}
    </div>
  )
}
