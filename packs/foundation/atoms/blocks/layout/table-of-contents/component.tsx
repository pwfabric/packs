import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import { messageOf, useAppMessages } from '@pwfabric/runtime'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeHref } from '../../../lib/_shared-utils.js'

// ============================================================
// TYPES
// ============================================================

export interface TocItem {
  readonly label: string
  /** The section's anchor on this page (`#options`), as the content renders it. */
  readonly href: string
  /** 2 (default) or 3: a level-3 entry sits under the level-2 one above it. */
  readonly level?: number
}

export interface TableOfContentsProps {
  /** The heading over the list ("On This Page"). Unset: the app's ui.toc. */
  readonly title?: string
  readonly items: readonly TocItem[]
  /** Mark the section being read as the visitor scrolls. Default true. */
  readonly trackScroll?: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const tableOfContentsDefinition: BlockDefinition = {
  type: 'table-of-contents',
  name: 'Table of contents',
  category: 'layout',
  icon: '☰',
  defaultProps: { items: [], trackScroll: true },
  defaultLayout: { span: { xs: 4, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// HELPERS
// ============================================================

/** The id a `#anchor` href names (the part after the last #), or undefined. */
export function anchorOf(href: string): string | undefined {
  const at = href.lastIndexOf('#')
  const raw = at < 0 ? '' : href.slice(at + 1)
  let id = raw
  try {
    id = decodeURIComponent(raw)
  } catch {
    // A malformed %-escape: the id as written.
  }
  return id || undefined
}

/**
 * The section being read: the last of `tops` (each heading's distance from the
 * top of the viewport, in the list's order) that has scrolled to within `line`
 * px of the top; none (-1) while the page is still above its first section.
 */
export function currentSection(tops: readonly (number | undefined)[], line: number): number {
  let current = -1
  tops.forEach((top, i) => {
    if (top !== undefined && top <= line) current = i
  })
  return current
}

// Every look is a declared token (manifest definition.tokens): --pw-table-of-contents-*.
const TOC_CSS =
  '[data-pw-toc] a { color: var(--pw-table-of-contents-ink, var(--pw-color-text-muted)); text-decoration: none; display: block; line-height: var(--pw-table-of-contents-line-height, 20px); font-size: var(--pw-font-size-sm); }' +
  '[data-pw-toc] a:hover { color: var(--pw-table-of-contents-hover-ink, var(--pw-color-text)); }' +
  '[data-pw-toc] a[data-pw-level="2"] { font-weight: var(--pw-table-of-contents-entry-weight, 500); }' +
  '[data-pw-toc] a[data-pw-level="3"] { margin-inline-start: var(--pw-table-of-contents-depth-indent, 12px); font-weight: var(--pw-table-of-contents-sub-entry-weight, 400); }' +
  '[data-pw-toc] a[aria-current] { color: var(--pw-table-of-contents-current-ink, var(--pw-color-primary-ink, var(--pw-color-text))); }' +
  '[data-pw-toc] a:focus-visible { outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color, var(--pw-color-primary, #18181b)); outline-offset: 2px; border-radius: 2px; }' +
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-toc] a { min-height: 44px; display: flex; align-items: center; } }'

// ============================================================
// COMPONENT
// ============================================================

/**
 * A page's own table of contents: its sections as links to their anchors, an
 * h3 under the h2 above it. While the visitor scrolls, the section being read
 * carries aria-current="location" (trackScroll). The items are the page's
 * headings as the app lists them; the block never reads the page to find them,
 * so the first frame already draws them.
 */
export const TableOfContentsBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as TableOfContentsProps
  const appWords = useAppMessages()
  // Items may come from data: each href passes the same check the other navigation blocks use
  // (a javascript: or otherwise unsafe address drops the item).
  const items = (Array.isArray(p.items) ? p.items : [])
    .filter((i) => i && typeof i.label === 'string' && typeof i.href === 'string')
    .map((i) => ({ ...i, href: safeHref(i.href) }))
    .filter((i): i is TocItem => typeof i.href === 'string' && i.href !== '')
  const title = (typeof p.title === 'string' && p.title) || messageOf(appWords, 'ui.toc', '')
  const track = p.trackScroll !== false && context?.interactionMode !== 'inert'
  const [current, setCurrent] = React.useState(-1)
  const ids = items.map((i) => anchorOf(i.href))
  const idsKey = ids.join('|')

  React.useEffect(() => {
    if (!track || typeof window === 'undefined' || typeof document === 'undefined') return
    const sectionIds = idsKey.split('|')
    let frame = 0
    const update = (): void => {
      frame = 0
      // A sticky bar covers the top (the navbar publishes its height): a section counts
      // as reached once it has passed a little under it.
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw-sticky-top-offset')) || 64
      const line = bar + 32
      const tops = sectionIds.map((id) => {
        const el = id ? document.getElementById(id) : null
        return el ? el.getBoundingClientRect().top : undefined
      })
      setCurrent(currentSection(tops, line))
    }
    const onScroll = (): void => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [track, idsKey])

  if (items.length === 0) return null
  const titleId = `${block.id}-title`
  return (
    <nav
      id={block.id}
      data-block-id={block.id}
      data-block-type="table-of-contents"
      data-pw-toc=""
      aria-labelledby={title ? titleId : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pw-table-of-contents-row-gap, 8px)', minWidth: 0, ...block.style }}
    >
      <style>{TOC_CSS}</style>
      {title ? (
        <p
          id={titleId}
          style={{
            margin: '0 0 var(--pw-table-of-contents-title-space-below, 8px)',
            fontSize: 'var(--pw-font-size-sm)',
            lineHeight: 'var(--pw-table-of-contents-line-height, 20px)',
            fontWeight: 'var(--pw-table-of-contents-title-weight, 600)' as React.CSSProperties['fontWeight'],
            letterSpacing: 'var(--pw-table-of-contents-title-letter-spacing, 0px)',
            color: 'var(--pw-table-of-contents-title-ink, var(--pw-color-text))',
          }}
        >
          {title}
        </p>
      ) : null}
      {items.map((item, n) => {
        const level = item.level === 3 ? 3 : 2
        return (
          <a key={`${n}-${item.href}`} href={item.href} data-pw-level={String(level)} aria-current={n === current ? 'location' : undefined}>
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}

Object.assign(TableOfContentsBlock, { sizing: 'intrinsic' })
