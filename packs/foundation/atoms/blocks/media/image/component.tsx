import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { MEDIA_CAPTION_GRADIENT, ON_OVERLAY_SCRIM, cssUnit, safeRenderValue, textOf } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const OBJECT_FITS = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const

export interface ImageProps {
  readonly src: string
  readonly alt: string
  readonly objectFit: (typeof OBJECT_FITS)[number]
  readonly width?: number | string
  readonly height?: number | string
  readonly aspectRatio?: string
  readonly borderRadius?: number | string
  readonly loading: 'lazy' | 'eager'
  /**
   * The page's main picture (its LCP: a hero, a product shot above the fold):
   * loaded eagerly at high fetch priority, whatever `loading` says. Default off
   * — every other image is lazy.
   */
  readonly priority?: boolean
  readonly align?: 'left' | 'center' | 'right'
  // For media-teaser cards: overlays a dark bottom-edge gradient + title/
  // subtitle ON TOP of the image. With neither set the behaviour is exactly
  // the plain image block.
  readonly overlayTitle?: string
  readonly overlaySubtitle?: string
  /**
   * An OPTIONAL image — a logo next to a text brand — draws nothing without a
   * src, in the editor too.
   */
  readonly hideWhenEmpty: boolean
}

// ============================================================
// PLATFORM PLACEHOLDER
// ============================================================

const PLACEHOLDER_MARK = /pw-placeholder:([A-Za-z0-9._-]+)/

/** A platform placeholder, read: its need key and, when the SVG states them, its size. */
export interface PlatformPlaceholder {
  key: string
  width?: number
  height?: number
}

const svgNumber = (tag: string, attr: string): number | undefined => {
  // Unitless only: `width="100%"` (or em, px…) says nothing about the picture's
  // ratio, so it falls through to the viewBox.
  const m = new RegExp(String.raw`\s${attr}=["']?([0-9]+(?:\.[0-9]+)?)(?![0-9.%a-z])`, 'i').exec(tag)
  const n = m ? Number(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Reads a platform placeholder src, or null for any other value.
 *
 * The platform placeholder is a `data:image/svg+xml` URI whose SVG carries
 * `pw-placeholder:<key>` (a host may write one into every declared image
 * slot and later replace it with the real picture). Deliberately local —
 * a block does not import contracts — and deliberately small: URL-encoded,
 * base64 and raw bodies are read; anything else is a real image. The size is
 * the root <svg>'s width/height (or its viewBox), so the slot can hold the
 * picture's ratio and the layout does not shift when the picture arrives.
 */
export function readPlaceholder(src: string): PlatformPlaceholder | null {
  const value = src.trim()
  const head = /^data:image\/svg\+xml(;[^,]*)?,/i.exec(value)
  if (!head) return null
  const body = value.slice(head[0].length)
  let text = body
  try {
    text = /;base64/i.test(head[1] ?? '')
      ? typeof atob === 'function'
        ? atob(body)
        : ''
      : decodeURIComponent(body)
  } catch {
    text = body
  }
  const key = PLACEHOLDER_MARK.exec(text)?.[1]
  if (!key) return null
  const tag = /<svg\s[^>]*>/i.exec(text)?.[0] ?? ''
  let width = svgNumber(tag, 'width')
  let height = svgNumber(tag, 'height')
  if (width === undefined || height === undefined) {
    const vb = /\sviewBox=["']?\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i.exec(tag)
    const w = vb ? Number(vb[1]) : NaN
    const h = vb ? Number(vb[2]) : NaN
    if (w > 0 && h > 0) {
      width = w
      height = h
    }
  }
  return width !== undefined && height !== undefined ? { key, width, height } : { key }
}

/** The need key of a platform placeholder src, or null for any other value. */
export function placeholderKey(src: string): string | null {
  return readPlaceholder(src)?.key ?? null
}

// ============================================================
// DEFINITION
// ============================================================

export const imageDefinition: BlockDefinition = {
  type: 'image',
  name: 'Image',
  category: 'media',
  icon: '⊟',
  defaultProps: {
    src: '',
    alt: '',
    objectFit: 'cover',
  },
  defaultLayout: { span: { xs: 4, sm: 4, md: 4, lg: 4 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * The width/height ATTRIBUTES that reserve the picture's box before it loads
 * (the browser maps them to an aspect ratio), so the layout does not shift.
 *
 * They are the picture's proportions, not its drawn size — CSS sizes the
 * image (an inline `width`/`height`, even `auto`, wins over the attributes) —
 * so they are written whatever the CSS size is:
 *
 * - a pixel width AND height (`320`, `"320px"`) as given;
 * - one pixel side and `aspectRatio` ("16/9", "4:3", "1.5"): the other side
 *   from the ratio;
 * - `aspectRatio` alone: a 1000px-wide box of that ratio;
 * - nothing when neither is known (a `100%` width is a layout size, not a
 *   proportion).
 */
export function reservedSize(width: unknown, height: unknown, aspectRatio: unknown): { width?: number; height?: number } {
  const num = (v: unknown): number | undefined => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d+(\.\d+)?(px)?\s*$/.test(v) ? parseFloat(v) : NaN
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const w = num(width)
  const h = num(height)
  if (w !== undefined && h !== undefined) return { width: Math.round(w), height: Math.round(h) }
  if (typeof aspectRatio === 'string' || typeof aspectRatio === 'number') {
    const parts = String(aspectRatio).split(/[/:]/).map((x) => parseFloat(x.trim()))
    const ratio = parts.length === 2 ? (parts[0] ?? NaN) / (parts[1] ?? NaN) : parts[0] ?? NaN
    if (Number.isFinite(ratio) && ratio > 0) {
      if (w !== undefined) return { width: Math.round(w), height: Math.round(w / ratio) }
      if (h !== undefined) return { width: Math.round(h * ratio), height: Math.round(h) }
      return { width: 1000, height: Math.round(1000 / ratio) }
    }
  }
  return {}
}

export const ImageBlock: BlockComponent = ({ props, block, context }) => {
  // A src that fails to load is treated like no src at all.
  const p = props as unknown as ImageProps
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const inert = context?.interactionMode === 'inert'
  const align = p.align
  const wrapperStyle: React.CSSProperties = align
    ? {
        display: 'flex',
        justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        width: '100%',
      }
    : {}

  const rawSrc = textOf(p.src).trim()
  const src = rawSrc && rawSrc !== failedSrc ? rawSrc : ''
  const aspectRatio = p.aspectRatio

  // F1 — graceful placeholder when no src. A real design's image SLOT matters for
  // layout; the asset itself can be filled later. Instead of a broken <img>
  // (the old `/placeholder.png` 404), render a themeable skeleton that preserves
  // the slot's dimensions (width/height/aspectRatio) so the layout reads as 1:1
  // even without a hosted asset. Tokens → follows the theme.
  //
  // EMPTY, BROKEN OR PLACEHOLDER SRC KEEPS THE LAYOUT (4.1.0). A src that fails
  // to load is empty, so it too shows the quiet slot live — the layout
  // holds; `hideWhenEmpty` removes it. Until 4.0.4 a live empty
  // image rendered nothing (visitors saw "⊟ Image"), and the band it
  // sat in collapsed. A host may write the platform placeholder into every
  // declared image slot and swap the real picture in later, so
  // an unfilled slot is a normal live state, not an authoring leftover. Live,
  // the slot keeps its box — same ground and border as the editor skeleton —
  // but QUIET: no "⊟ label" text reaches a visitor. `hideWhenEmpty` still means
  // "draw nothing" (a logo beside a text brand), live and in the editor — and a
  // placeholder src counts as empty there: an optional logo has no slot to keep.
  //
  // A PLATFORM PLACEHOLDER IS NOT A PICTURE. Its neutral grey SVG ignores the
  // theme; the block draws the themeable skeleton instead and exposes the need
  // key as `data-pw-placeholder` for the canvas (click to replace) and gates.
  const platform = src ? readPlaceholder(src) : null
  const placeholderNeed = platform?.key ?? null
  const empty = !src || platform !== null
  if (empty && p.hideWhenEmpty) return null
  if (empty) {
    const alt = textOf(p.alt).trim()
    // With no declared ratio or height, a platform placeholder lends the slot
    // the picture's own ratio (its SVG size), so nothing moves when it arrives.
    const heightProp = cssUnit(p.height)
    const slotRatio =
      aspectRatio ??
      (heightProp === undefined && platform?.width && platform.height ? `${platform.width}/${platform.height}` : undefined)
    const placeholderStyle: React.CSSProperties = {
      width: cssUnit(p.width) ?? '100%',
      maxWidth: '100%',
      height: heightProp ?? (slotRatio ? 'auto' : '200px'),
      aspectRatio: slotRatio,
      borderRadius: cssUnit(p.borderRadius) ?? 'var(--pw-border-radius)',
      backgroundColor: 'var(--pw-color-card)',
      border: '1px dashed var(--pw-color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--pw-color-text-muted)',
      fontSize: 'var(--pw-font-size-sm)',
      boxSizing: 'border-box',
      ...block.style,
    }
    // The alt stays for screen readers: a described slot is an image whose
    // picture has not arrived. A slot with no alt is decorative and hidden.
    const a11y: Record<string, string> = alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': 'true' }
    const placeholder = (
      <div
        id={block.id}
        data-block-id={block.id}
        style={placeholderStyle}
        data-block-type="image"
        data-image-placeholder=""
        {...(placeholderNeed !== null ? { 'data-pw-placeholder': placeholderNeed } : {})}
        {...a11y}
      >
        {inert ? <span aria-hidden="true">⊟ {alt || 'Image'}</span> : null}
      </div>
    )
    return align ? <div style={wrapperStyle}>{placeholder}</div> : placeholder
  }

  const style: React.CSSProperties = {
    width: cssUnit(p.width) ?? '100%',
    // A numeric width is a preferred size, never wider than the column: a
    // 600px image in a 360px phone column overflowed the page.
    maxWidth: '100%',
    display: 'block',
    height: cssUnit(p.height) ?? 'auto',
    objectFit: p.objectFit,
    aspectRatio,
    borderRadius: cssUnit(p.borderRadius) ?? 'var(--pw-border-radius)',
    // Layer 4: block-level style overrides
    ...block.style,
  }

  const priority = p.priority === true
  const img = (
    <img
      id={block.id}
      data-block-id={block.id}
      src={src}
      alt={textOf(p.alt)}
      style={style}
      // The proportions, always: the inline style above sizes the picture.
      {...reservedSize(p.width, p.height, aspectRatio)}
      loading={priority ? 'eager' : p.loading}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      decoding="async"
      data-block-type="image"
      onError={() => setFailedSrc(rawSrc)}
    />
  )

  // Overlay variant — image with a bottom dark gradient carrying title/subtitle.
  const overlayTitle = p.overlayTitle
  const overlaySubtitle = p.overlaySubtitle
  if (overlayTitle || overlaySubtitle) {
    const frame: React.CSSProperties = {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: cssUnit(p.borderRadius) ?? 'var(--pw-border-radius)',
      width: cssUnit(p.width) ?? '100%',
      maxWidth: '100%',
      lineHeight: 0,
    }
    const scrim: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      gap: '2px',
      padding: '14px 16px',
      background: MEDIA_CAPTION_GRADIENT,
      lineHeight: 1.35,
    }
    const overlaid = (
      <div style={frame} data-block-type="image-overlay">
        {img}
        <div style={scrim}>
          {overlayTitle ? (
            <span style={{ color: ON_OVERLAY_SCRIM, fontWeight: 700, fontSize: 'var(--pw-font-size-lg)', fontFamily: 'var(--pw-font-family-heading)' }}>
              {safeRenderValue(overlayTitle)}
            </span>
          ) : null}
          {overlaySubtitle ? (
            <span style={{ color: ON_OVERLAY_SCRIM, fontWeight: 500, fontSize: 'var(--pw-font-size-sm)' }}>
              {safeRenderValue(overlaySubtitle)}
            </span>
          ) : null}
        </div>
      </div>
    )
    return align ? <div style={wrapperStyle}>{overlaid}</div> : overlaid
  }

  return align ? <div style={wrapperStyle}>{img}</div> : img
}
