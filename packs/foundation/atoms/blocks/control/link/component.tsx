import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, cssUnit, ICON_PATHS, safeHref, safeRenderValue } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const LINK_TARGETS = ['_self', '_blank', '_parent', '_top'] as const

export interface LinkProps {
  readonly icon?: string
  readonly ariaLabel?: string
  readonly external?: boolean
  /**
   * NO DEFAULT. A `#` default manufactured the dead anchor the gate hunts
   * for. A link without a target is a LABEL; it renders as a <span>.
   */
  readonly href?: string
  readonly text: string
  readonly target: (typeof LINK_TARGETS)[number]
  readonly color?: string
  /**
   * Underlined by default: a link told from its text by colour alone failed
   * axe link-in-text-block. "hover" underlines on hover and keyboard focus
   * only — for nav rows, where position says "link"; "none" never.
   */
  readonly underline: 'always' | 'hover' | 'none'
  /** 8–96 px. */
  readonly fontSize?: number
  readonly fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  /**
   * This link names the page in view (a nav item): it carries
   * aria-current="page" and is drawn marked. Bindable: "{{item.active}}".
   */
  readonly current?: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const linkDefinition: BlockDefinition = {
  type: 'link',
  name: 'Link',
  category: 'control',
  icon: '🔗',
  defaultProps: {
    // NO href: a link without a target starts as a label, not a dead anchor.
    text: '',
    target: '_self',
    underline: 'always',
  },
  defaultLayout: { span: { xs: 2, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * On a phone or touch screen a link is a REAL 44px-tall box (R3 measures the
 * box, so an invisible hit area alone still failed on stacked link rows); the
 * text keeps its size and stays centred on the line.
 */
const LINK_UNDERLINE_CSS =
  '[data-pw-ul="hover"] { text-decoration: none; } [data-pw-ul="hover"]:hover, [data-pw-ul="hover"]:focus-visible { text-decoration: underline; text-underline-offset: 0.15em; }'

const LINK_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-touch] { display: inline-flex; align-items: center; min-height: 44px; } }'

export const LinkBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as LinkProps
  const underline = p.underline
  // "hover" sets no inline decoration: LINK_UNDERLINE_CSS draws none at rest
  // and the underline on hover / keyboard focus (an inline "none" would beat
  // the :hover rule, which is why "hover" used to mean "never").
  const underlineStyles: Record<string, React.CSSProperties> = {
    always: { textDecoration: 'underline', textUnderlineOffset: '0.15em' },
    hover: {},
    none: { textDecoration: 'none' },
  }

  const style: React.CSSProperties = {
    // THE RIGHT TOKEN is primary-ink, not primary. Both give the same value in
    // a light theme (so the difference never showed) but they diverge in dark:
    // deriveDarkTheme KEEPS the brand hue — correct for primary as a FILL —
    // so indigo stays indigo while the surface darkens and text drops to 3.05:1.
    // primary-ink is the same primary pulled to AA against the surface.
    // Live measurement: the only element below AA in dark mode across 128 rendered blocks.
    color: p.color ?? 'var(--pw-color-link, var(--pw-color-primary-ink, #18181b))',
    fontSize: cssUnit(p.fontSize),
    fontWeight: p.fontWeight as React.CSSProperties['fontWeight'],
    ...(underlineStyles[underline] ?? underlineStyles.always),
    cursor: 'pointer',
    ...(p.current === true
      ? { fontWeight: 600, backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)' }
      : {}),
    // Honour block.style alongside the props (like card/section/etc.). Spread
    // last so an explicit style override wins, but the prop-derived color/
    // weight/size still apply when style doesn't set them.
    ...block.style,
  }

  const iconName = p.icon
  const external = p.external
  const target = external ? '_blank' : p.target
  const rel = external ? 'noopener noreferrer' : undefined
  const ariaLabel = p.ariaLabel

  // A native <a href> navigates via the browser's default action. Real
  // navigation is a SIDE-EFFECT: in inert (editor/preview) mode we cancel the
  // default and emit a `navigate` notification instead, so a preview doesn't
  // actually leave the page. In live mode the anchor behaves natively.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (context.interactionMode === 'inert') {
      e.preventDefault()
      emit({
        type: SURFACE_EVENTS.BLOCK_CLICK,
        surfaceId,
        blockId: block.id,
        payload: { href: p.href ?? null },
      })
    }
  }

  // A LINK WITHOUT A TARGET IS A LABEL. Emitting `<a>` with `#` leaves
  // something the reader can click that goes nowhere — and it is wrong for
  // accessibility too (it takes keyboard focus, a screen reader says "link").
  // The `<span>` carries the same style and id so the layout stays the same.
  const resolved = safeHref(typeof p.href === 'string' ? p.href : undefined)
  // Unset means hidden: a "Link text" placeholder reached visitors.
  const text = safeRenderValue(p.text)
  if (!text && !iconName) return null

  // THE ICON IS DRAWN BESIDE THE TEXT, NOT INSTEAD OF IT.
  // The manifest has always said so; the component rendered `icon ? svg : text`,
  // so a `tel:` link with icon "phone" showed a lone 16px glyph and the number
  // was gone — for the eye and for the screen reader alike (the anchor had no
  // name). The glyph is decoration (aria-hidden); the accessible name is the
  // visible text, or `ariaLabel` when the author gives one. An icon-only link
  // (no text) keeps working, named by `ariaLabel` or else by the icon's name.
  const iconEl = iconName ? (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: '0 0 auto' }}
      dangerouslySetInnerHTML={{
        __html: (
          ICON_PATHS[iconName] ??
          ICON_PATHS.circle ?? ['<circle cx="12" cy="12" r="10"/>']
        ).join(''),
      }}
    />
  ) : null
  const accessibleName = ariaLabel || (text ? undefined : iconName)
  if (iconEl) {
    // Icon and text sit on one line, centred, a theme xs space apart;
    // block.style still wins when it sets any of the three.
    style.display = style.display ?? 'inline-flex'
    style.alignItems = style.alignItems ?? 'center'
    style.gap = style.gap ?? 'var(--pw-space-xs, 4px)'
  }

  if (!resolved) {
    return (
      // A label is not underlined: the underline says "link".
      <span id={block.id} data-block-id={block.id} style={{ ...style, textDecoration: (block.style as React.CSSProperties | undefined)?.textDecoration ?? 'none' }} data-block-type="link" aria-label={accessibleName}>
        {iconEl}
        {text}
      </span>
    )
  }

  return (
    <>
    <style>{HIT_AREA_CSS + LINK_TOUCH_CSS + (underline === 'hover' ? LINK_UNDERLINE_CSS : '')}</style>
    <a
      id={block.id}
      data-block-id={block.id}
      data-pw-hit=""
      data-pw-touch=""
      data-pw-ul={underline === 'hover' ? 'hover' : undefined}
      href={resolved}
      target={target}
      rel={rel}
      style={style}
      data-block-type="link"
      aria-label={accessibleName}
      aria-current={p.current === true ? 'page' : undefined}
      onClick={handleClick}
    >
      {iconEl}
      {text}
    </a>
    </>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(LinkBlock, { sizing: 'intrinsic' })
