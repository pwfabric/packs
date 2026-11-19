import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { listOf, safeHref, safeRenderValue } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
}

export interface BreadcrumbProps {
  readonly items: readonly BreadcrumbItem[]
  readonly separator: '/' | '›' | '>'
}

// ============================================================
// DEFINITION
// ============================================================

export const breadcrumbDefinition: BlockDefinition = {
  type: 'breadcrumb',
  name: 'Breadcrumb',
  category: 'control',
  icon: '›',
  defaultProps: {
    items: [],
    separator: '/',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * A crumb link is a REAL 44px-tall box on a phone or touch screen (R3 measures
 * the box): the text keeps its size, the link grows around it.
 */
const CRUMB_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-crumb] { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; } }'

export const BreadcrumbBlock: BlockComponent = ({ props, block, context }) => {
  const appWords = useAppMessages()
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as BreadcrumbProps
  const items = listOf<BreadcrumbItem>(p.items)
  const separator = p.separator

  // Native <a href> anchors navigate via the browser default. Real navigation
  // is a SIDE-EFFECT: in inert (editor/preview) mode cancel it and emit a
  // `navigate` notification instead, so a preview doesn't leave the page.
  const handleNavClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (context?.interactionMode === 'inert') {
      e.preventDefault()
      emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href } })
    }
  }

  // No crumbs, no breadcrumb: an empty `items` (a shell's `CRUMBS: []`, or an
  // unresolved binding) drew an empty <nav aria-label="breadcrumb"> landmark.
  if (items.length === 0) return null

  const navStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
  }

  const olStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    // ONE LINE. A record's title as the last crumb wrapped the trail onto a
    // second line when the record arrived, and the whole page moved down
    // (conference session, CLS 0.08 at 390). The crumbs keep to one line and
    // the long one ends in an ellipsis; its full text is its title.
    flexWrap: 'nowrap',
    minWidth: 0,
    maxWidth: '100%',
  }
  const fit: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }

  const separatorStyle: React.CSSProperties = {
    color: 'var(--pw-color-text-muted)',
    fontSize: 'var(--pw-font-size-sm)',
    userSelect: 'none',
  }

  return (
    <nav aria-label={messageOf(appWords, 'ui.breadcrumb', '')} data-block-type="breadcrumb" style={{ ...navStyle, ...block.style }}>
      <style>{CRUMB_TOUCH_CSS}</style>
      <ol id={block.id} data-block-id={block.id} style={olStyle}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          // Two separate facts decide whether a crumb is a link: the href is
          // present at all, and `safeHref` accepts it (it rejects javascript:,
          // data: and friends). Hoisting both lets the anchor branch keep the
          // RAW href for the click handler — the emitted `navigate` payload has
          // always carried the author's value, not the trimmed copy.
          const rawHref = item.href
          const href = safeHref(rawHref)
          return (
            // The separator sits INSIDE the crumb's <li>: an <ol> holds only
            // <li> children (a bare <span> between them broke the list).
            <li
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: isLast ? '0 1 auto' : '0 0 auto' }}
              aria-current={isLast ? 'page' : undefined}
            >
              {isLast || rawHref === undefined || !href ? (
                <span
                  title={isLast ? safeRenderValue(item.label) || undefined : undefined}
                  style={{
                    ...fit,
                    fontSize: 'var(--pw-font-size-sm)',
                    color: isLast ? 'var(--pw-color-text)' : 'var(--pw-color-text-muted)',
                    fontWeight: isLast ? 500 : 400,
                  }}
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={href}
                  onClick={handleNavClick(rawHref)}
                  data-pw-crumb=""
                  style={{
                    fontSize: 'var(--pw-font-size-sm)',
                    color: 'var(--pw-color-primary-ink, #18181b)',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </a>
              )}
              {!isLast && (
                <span style={separatorStyle} aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
