import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, safeRenderValue } from '../../../lib/_shared-utils.js'
import { formatDate } from '../../../lib/_shared-format.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface TextProps {
  readonly content: string
  // No default size: a fixed 14 overrode the theme's body size in
  // 12/12 apps, so an 18px-body theme still printed 14px paragraphs. Unset →
  // the theme's --pw-font-size-base.
  readonly fontSize?: number
  readonly fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  readonly color?: string
  readonly textAlign?: 'left' | 'center' | 'right' | 'justify'
  readonly lineHeight?: number
  readonly maxLines?: number
  /**
   * A plain value, not an expression: when it is non-empty the text is not
   * drawn. A brand name beside the shell logo is `hideWhenSet: "{{LOGO}}"`.
   * An unfilled `{{SLOT}}` counts as empty.
   */
  readonly hideWhenSet?: string
  /**
   * The content is a date (bound from a record: "2026-10-01"): print it in
   * the app's locale, "1 Oct 2026". A value that is not an ISO date is shown
   * as written.
   */
  readonly format?: 'date' | 'datetime' | 'time'
  /** The text is a QUOTATION: drawn as a <blockquote>, announced as a quote. */
  readonly quote?: boolean
  /** Read by a screen reader, not drawn (visually hidden). Never for text a sighted reader needs. */
  readonly srOnly?: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const textDefinition: BlockDefinition = {
  type: 'text',
  name: 'Text',
  category: 'text',
  icon: 'T',
  defaultProps: {
    content: '',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 4, lg: 6 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** Set = a non-empty value that is not an unfilled `{{SLOT}}` template. */
function isSet(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const t = value.trim()
  return t !== '' && !/^\{\{[^{}]*\}\}$/.test(t)
}

export const TextBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as TextProps
  if (isSet(p.hideWhenSet)) return null
  const maxLines = p.maxLines
  const fontWeightMap: Record<string, number> = {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  }
  const rawFW: unknown = p.fontWeight
  const normalizedFontWeight =
    typeof rawFW === 'string' && rawFW in fontWeightMap
      ? fontWeightMap[rawFW]
      : (rawFW as React.CSSProperties['fontWeight'])
  const style: React.CSSProperties = {
    margin: 0,
    fontSize: cssUnit(p.fontSize) ?? 'var(--pw-font-size-base)',
    fontWeight: normalizedFontWeight ?? 'var(--pw-font-weight-body, 400)',
    letterSpacing: 'var(--pw-letter-spacing-body, 0em)',
    color: p.color ?? 'var(--pw-color-text)',
    textAlign: p.textAlign,
    lineHeight: p.lineHeight,
    overflow: maxLines ? 'hidden' : undefined,
    display: maxLines ? '-webkit-box' : undefined,
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: maxLines ? 'vertical' : undefined,
    // A `\n` in the content is a line break, not a space: a summary written as
    // "Name: …\nGuests: …" rendered as one run-on paragraph.
    // pre-line keeps breaks and still collapses runs of spaces.
    whiteSpace: 'pre-line',
    // A long unbroken word or URL breaks rather than overflowing a narrow
    // viewport, the same rule as heading.
    overflowWrap: 'anywhere',
    minWidth: 0,
    // Layer 4: block-level style overrides
    ...block.style,
    // Visually hidden, still read (the clip pattern): wins over block.style.
    ...(p.srOnly === true
      ? {
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
          border: 0,
        }
      : {}),
  }

  const Tag = (p.quote === true ? 'blockquote' : 'p') as 'p'
  return (
    <Tag
      id={block.id}
      data-block-id={block.id}
      style={style}
      data-block-type="text"
    >
      {/* Unset means empty — "Add your text here" reached visitors. */}
      {p.format
        ? formatDate(p.content, p.format, context.locale) || safeRenderValue(p.content)
        : safeRenderValue(p.content)}
    </Tag>
  )
}
