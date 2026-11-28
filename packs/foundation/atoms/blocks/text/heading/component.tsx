import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { safeRenderValue, gradientCSS, langOf, safeHref } from '../../../lib/_shared-utils.js'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

/** A heading's link reads as the heading; the underline comes on hover and focus. */
const HEADING_LINK_CSS =
  '[data-pw-heading-link] { color: inherit; text-decoration: none; } [data-pw-heading-link]:hover, [data-pw-heading-link]:focus-visible { text-decoration: underline; text-underline-offset: 0.15em; }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const
export type HeadingLevel = (typeof HEADING_LEVELS)[number]

export const GRADIENT_DIRECTIONS = ['to-r', 'to-l', 'to-t', 'to-b', 'to-tr', 'to-tl', 'to-br', 'to-bl'] as const

/**
 * Gradient text. Defaults to the theme primary→accent ramp so an enabled
 * gradient heading re-skins with the surface; explicit from/to override.
 */
export interface GradientConfig {
  readonly enabled: boolean
  readonly from: string
  readonly via?: string
  readonly to: string
  readonly direction: (typeof GRADIENT_DIRECTIONS)[number]
}

export interface HeadingProps {
  readonly text: string
  /** `h1`–`h6`, or the number 1–6. An empty or unknown level (a pattern's level slot left "") is h2. */
  readonly level: HeadingLevel | number
  readonly color?: string
  readonly textAlign?: 'left' | 'center' | 'right'
  readonly gradient?: GradientConfig
  /** Signature motif: a vertical accent bar to the left of the heading. Opt-in. */
  readonly accentBar: boolean
  readonly uppercase: boolean
  /**
   * Opt-in inline emphasis. When true, `text` may carry a tiny markdown
   * subset rendered as real spans: **bold**, *italic*, ~~strike~~, ==mark==.
   * No HTML is accepted; the parser only recognises the four markers above.
   */
  readonly rich: boolean
  /** Move focus here whenever this value changes after the first render (a step number, a page key). */
  readonly focusOn?: unknown
  /** A link inside the heading: an app path (`/blog/launch`), a URL or `#anchor`. */
  readonly href?: string
  /**
   * The language of the heading's text (BCP 47, `en`), written as the element's
   * `lang` so `uppercase` follows that language's case rules: an English word
   * on a Turkish page keeps its dotless I.
   */
  readonly lang?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const headingDefinition: BlockDefinition = {
  type: 'heading',
  name: 'Heading',
  category: 'text',
  icon: 'H',
  defaultProps: {
    text: '',
    level: 'h2',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** **bold** · *italic* · ~~strike~~ · ==mark== → gercek span'lar (HTML kabul etmez). */
function renderRichText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|==[^=]+==)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={i}>{part.slice(1, -1)}</em>
    if (part.startsWith('~~') && part.endsWith('~~') && part.length > 4)
      return (
        <span key={i} style={{ textDecoration: 'line-through', textDecorationColor: 'var(--pw-color-error, #dc2626)', textDecorationThickness: '0.08em' }}>
          {part.slice(2, -2)}
        </span>
      )
    if (part.startsWith('==') && part.endsWith('==') && part.length > 4)
      return (
        <mark key={i} style={{ backgroundColor: 'var(--pw-color-accent)', color: 'var(--pw-color-on-accent, var(--pw-color-text))', padding: '0 0.08em' }}>
          {part.slice(2, -2)}
        </mark>
      )
    return part
  })
}

export const HeadingBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as HeadingProps
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  // FOCUS ON CHANGE (`focusOn`): a wizard's step heading takes focus when the
  // step changes, so a keyboard or screen-reader visitor lands on the new
  // step's title instead of on a button that no longer exists. The first
  // render never moves focus; only a later change of the bound value does.
  const ref = React.useRef<HTMLHeadingElement | null>(null)
  const focusKey = p.focusOn === undefined || p.focusOn === null ? undefined : JSON.stringify(p.focusOn)
  const lastFocusKey = React.useRef(focusKey)
  React.useEffect(() => {
    if (focusKey === lastFocusKey.current) return
    lastFocusKey.current = focusKey
    if (focusKey !== undefined) ref.current?.focus()
  }, [focusKey])
  // Unset means hidden: a "Heading" placeholder reached visitors,
  // and an empty <h2> is an empty landmark for a screen reader.
  if (safeRenderValue(p.text) === '') return null
  const rawLevel: unknown = p.level
  const asked = typeof rawLevel === 'number' ? `h${rawLevel}` : String(rawLevel ?? '').trim().toLowerCase()
  // An empty or unknown level (a pattern's optional level slot left "") is
  // an h2, never an invalid tag.
  const level = /^h[1-6]$/.test(asked) ? asked : 'h2'
  const Tag = level as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

  // Inline sizes override a host reset stylesheet's `font-size: inherit; font-weight: inherit`
  // so h1–h6 always render with visible hierarchy regardless of global CSS reset.
  // fontWeight, lineHeight, and letterSpacing reference CSS vars from surface theme.
  // Weight and line height per level (typography headingWeightH1…H6, headingLineHeightH1…H6),
  // each falling back to the heading weight / line height a theme sets for every level.
  const PW_FONT_WEIGHT = `var(--pw-font-weight-${level}, var(--pw-font-weight-heading))` as React.CSSProperties['fontWeight']
  const PW_LINE_HEIGHT = `var(--pw-line-height-${level}, var(--pw-line-height-heading))`
  const PW_LETTER_SPACING = 'var(--pw-letter-spacing-heading)'
  const headingSizeMap: Record<string, React.CSSProperties> = {
    // The type scale is tokenised — the fallbacks equal the OLD hardcoded
    // values (a visually neutral change); a theme can drive the h1-h5 scale
    // with --pw-font-size-h*.
    h1: {
      fontSize: 'var(--pw-font-size-h1, var(--pw-font-size-4xl, 36px))',
      fontWeight: PW_FONT_WEIGHT,
      lineHeight: PW_LINE_HEIGHT,
      letterSpacing: PW_LETTER_SPACING,
    },
    h2: {
      fontSize: 'var(--pw-font-size-h2, var(--pw-font-size-3xl, 30px))',
      fontWeight: PW_FONT_WEIGHT,
      lineHeight: PW_LINE_HEIGHT,
      letterSpacing: PW_LETTER_SPACING,
    },
    h3: {
      fontSize: 'var(--pw-font-size-h3, var(--pw-font-size-2xl, 24px))',
      fontWeight: PW_FONT_WEIGHT,
      lineHeight: PW_LINE_HEIGHT,
      letterSpacing: PW_LETTER_SPACING,
    },
    h4: {
      fontSize: 'var(--pw-font-size-h4, var(--pw-font-size-xl, 20px))',
      fontWeight: PW_FONT_WEIGHT,
      lineHeight: PW_LINE_HEIGHT,
      letterSpacing: PW_LETTER_SPACING,
    },
    h5: {
      fontSize: 'var(--pw-font-size-h5, var(--pw-font-size-lg, 18px))',
      fontWeight: PW_FONT_WEIGHT,
      lineHeight: PW_LINE_HEIGHT,
      letterSpacing: PW_LETTER_SPACING,
    },
    h6: {
      fontSize: 'var(--pw-font-size-sm)',
      fontWeight: PW_FONT_WEIGHT,
      lineHeight: PW_LINE_HEIGHT,
      letterSpacing: PW_LETTER_SPACING,
    },
  }

  const uppercase = p.uppercase
  const baseStyle: React.CSSProperties = {
    // Headings consume the theme heading font — previously only
    // weight/lineHeight/letterSpacing referenced theme vars, so --pw-font-family-heading
    // was dead and headings fell back to the UA serif.
    fontFamily: 'var(--pw-font-family-heading)',
    color: p.color ?? 'var(--pw-color-heading, var(--pw-color-text))',
    textAlign: p.textAlign,
    margin: 0,
    // A long single word must not push past the viewport: at the theme's 4xl
    // step "Mahallenizin" did not fit 358px and the content box grew to 416px
    // at 390px. Break inside the word only when it cannot
    // fit on its own line; min-width 0 lets a heading in a flex row (the
    // accent bar) shrink so the break can happen. Font sizes are unchanged.
    overflowWrap: 'anywhere',
    minWidth: 0,
    ...(uppercase ? { textTransform: 'uppercase', letterSpacing: '0.04em' } : {}),
  }

  const gradientStyle = gradientCSS(p.gradient)
  // Merge order: headingSizeMap → baseStyle → gradientStyle → block.style (block overrides win)
  const style: React.CSSProperties = {
    ...(headingSizeMap[level] ?? {}),
    ...baseStyle,
    ...(gradientStyle ?? {}),
    // Layer 4: block-level style overrides
    ...block.style,
  }

  const content = p.rich ? renderRichText(p.text) : safeRenderValue(p.text)
  const safe = safeHref(typeof p.href === 'string' && p.href.trim() ? p.href.trim() : undefined)
  const target = safe && safe !== '#' ? safe : undefined
  // An `href` prop reaches the block already in the router's form: the host
  // rewrites every href prop (and the href of an object in a list prop) before
  // the block renders, so it is written as given, never through appHref twice.
  const href = target
  const onLinkClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (context?.interactionMode !== 'inert') return
    e.preventDefault()
    emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href: target ?? null } })
  }
  const headingEl = (
    <Tag
      id={block.id}
      data-block-id={block.id}
      style={style}
      data-block-type="heading"
      lang={langOf(p.lang)}
      {...(p.focusOn !== undefined ? { ref, tabIndex: -1 } : {})}
    >
      {href ? (
        <a href={href} data-pw-heading-link="" onClick={onLinkClick}>
          {content}
        </a>
      ) : (
        content
      )}
    </Tag>
  )

  // The link's look is a sibling style, not inside the heading (phrasing content only).
  const linkCss = href ? <style>{HEADING_LINK_CSS}</style> : null
  if (!p.accentBar) return linkCss ? <>{linkCss}{headingEl}</> : headingEl

  // Signature motif: gold vertical bar, pinned to the reference's secondary-
  // container token (not --pw-color-primary) so the motif's color stays fixed
  // even if the primary brand color is rebranded later.
  return (
    <div
      data-block-id={block.id}
      data-block-type="heading"
      style={{ display: 'flex', alignItems: 'stretch', gap: '12px' }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '3px',
          minHeight: '1em',
          alignSelf: 'stretch',
          borderRadius: 'var(--pw-border-radius-full, 9999px)',
          backgroundColor: 'var(--pw-color-secondary, #f4f4f5)',
          flexShrink: 0,
        }}
      />
      {linkCss}
      {React.cloneElement(headingEl, { id: undefined })}
    </div>
  )
}
