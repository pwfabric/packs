import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { messageOf, useAppMessages } from '@pwfabric/runtime'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, listOf, safeHref, safeRenderValue } from '../../../lib/_shared-utils.js'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { sameRoute } from '../../../lib/_shared-account-menu.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/**
 * One entry of the sidebar: a link (`href`), a group (`children`), or both —
 * a page that also holds sub-pages. The manifest shapes two levels; deeper
 * levels are read the same way, each guarded here (a prop shape has no
 * recursion).
 */
export interface SidebarItem {
  readonly label: string
  readonly href?: string
  readonly children?: readonly SidebarItem[]
  /** A group that starts open. The group holding the current page always does. */
  readonly open?: boolean
}

export interface SidebarProps {
  /** The tree: links, groups and their nested entries. */
  readonly items: readonly SidebarItem[]
  /** A heading over the tree ("Documentation"). It names the navigation landmark too. */
  readonly title?: string
  /** The landmark's name when there is no title, or a different one. */
  readonly navLabel?: string
  /** The page in view: its link carries aria-current="page" and its groups open. */
  readonly activeHref?: string
  /** Groups open and close (default). false: every group is shown open, with no toggle. */
  readonly collapsible: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const sidebarDefinition: BlockDefinition = {
  type: 'sidebar',
  name: 'Sidebar',
  category: 'layout',
  icon: '☰',
  defaultProps: { items: [], collapsible: true },
  defaultLayout: { span: { xs: 4, sm: 8, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** The entries under an item: a list of objects, anything else is no entries. */
export function sidebarChildren(item: SidebarItem): readonly SidebarItem[] {
  const list = (item as { children?: unknown }).children
  if (!Array.isArray(list)) return []
  return list.filter((c): c is SidebarItem => typeof c === 'object' && c !== null && !Array.isArray(c))
}

/** The keys of the groups above the item that routes to `activeHref` (empty when none does). */
export function sidebarTrail(items: readonly SidebarItem[], activeHref: string | undefined): string[] {
  if (!activeHref) return []
  const visit = (list: readonly SidebarItem[], prefix: string, trail: string[]): string[] | null => {
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as SidebarItem
      const key = `${prefix}${i}`
      if (item.href && sameRoute(item.href, activeHref)) return trail
      const children = sidebarChildren(item)
      if (children.length) {
        const hit = visit(children, `${key}.`, [...trail, key])
        if (hit) return hit
      }
    }
    return null
  }
  return visit(items, '', []) ?? []
}

/** Groups authored `open: true`, by key. */
function initiallyOpen(items: readonly SidebarItem[], prefix = ''): string[] {
  return items.flatMap((item, i) => {
    const key = `${prefix}${i}`
    const children = sidebarChildren(item)
    if (!children.length) return []
    return [...(item.open === true ? [key] : []), ...initiallyOpen(children, `${key}.`)]
  })
}

/** A phone or touch row is a 44px target. */
const SIDEBAR_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-sidebar-row] { min-height: 44px; } }' +
  '[data-pw-sidebar-link]:hover { background: color-mix(in srgb, var(--pw-color-text, #09090b) 6%, transparent); }' +
  '[data-pw-sidebar-link]:focus-visible, [data-pw-sidebar-toggle]:focus-visible { outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color, var(--pw-color-primary, #18181b)); outline-offset: -2px; }'

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    style={{ flex: '0 0 auto', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export const SidebarBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as SidebarProps
  const items = listOf<SidebarItem>(p.items).filter((i) => typeof i === 'object' && i !== null)
  const title = typeof p.title === 'string' && p.title.trim() ? p.title.trim() : undefined
  const navLabel = typeof p.navLabel === 'string' && p.navLabel.trim() ? p.navLabel.trim() : undefined
  const activeHref = typeof p.activeHref === 'string' && p.activeHref ? p.activeHref : undefined
  const collapsible = p.collapsible !== false
  const inert = context?.interactionMode === 'inert'
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  // The toggle beside a group's own link is named in the app's words
  // (ui.tree.expand / ui.tree.collapse, with the group's label).
  const messages = useAppMessages()

  const trail = sidebarTrail(items, activeHref)
  const [open, setOpen] = React.useState<Set<string>>(() => new Set([...initiallyOpen(items), ...trail]))
  // A bound activeHref or items that arrive after the first render still open
  // the groups that hold the current page.
  const trailKey = trail.join(' ')
  React.useEffect(() => {
    if (trail.length === 0) return
    setOpen((prev) => (trail.every((k) => prev.has(k)) ? prev : new Set([...prev, ...trail])))
  }, [trailKey])
  const toggle = (key: string): void =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const onLinkClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (!inert) return
    e.preventDefault()
    emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: block.id, payload: { href } })
  }

  const rowStyle = (depth: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    paddingLeft: `${depth * 12}px`,
  })
  const linkStyle = (current: boolean, group: boolean): React.CSSProperties => ({
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'stretch',
    padding: '6px 10px',
    borderRadius: 'var(--pw-border-radius-sm, 6px)',
    borderLeft: current ? '3px solid var(--pw-color-primary)' : '3px solid transparent',
    backgroundColor: current ? 'color-mix(in srgb, var(--pw-color-primary) 10%, transparent)' : undefined,
    color: 'var(--pw-color-text)',
    textDecoration: 'none',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: current || group ? 600 : 400,
    overflowWrap: 'anywhere',
  })
  const toggleStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    minWidth: '32px',
    minHeight: '32px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--pw-color-text-muted)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    borderRadius: 'var(--pw-border-radius-sm, 6px)',
  }

  const renderList = (list: readonly SidebarItem[], depth: number, prefix: string, id?: string, hidden?: boolean): React.ReactElement => (
    <ul id={id} hidden={hidden} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {list.map((item, i) => {
        const key = `${prefix}${i}`
        const label = safeRenderValue(item.label)
        const children = sidebarChildren(item)
        const isGroup = children.length > 0
        const isOpen = !collapsible || open.has(key)
        const safe = safeHref(typeof item.href === 'string' && item.href.trim() ? item.href.trim() : undefined)
        const target = safe && safe !== '#' ? safe : undefined
        const href = target && context?.appHref ? context.appHref(target) : target
        const current = Boolean(target) && sameRoute(item.href, activeHref)
        const listId = `${block.id}-group-${key.replace(/\./g, '-')}`
        const link = href ? (
          <a
            href={href}
            data-pw-sidebar-link=""
            data-pw-hit=""
            aria-current={current ? 'page' : undefined}
            onClick={onLinkClick(target as string)}
            style={linkStyle(current, false)}
          >
            {label}
          </a>
        ) : null
        if (!isGroup) {
          return (
            <li key={key}>
              <div data-pw-sidebar-row="" style={rowStyle(depth)}>
                {link ?? <span style={{ ...linkStyle(false, false), color: 'var(--pw-color-text-muted)' }}>{label}</span>}
              </div>
            </li>
          )
        }
        // A group: its label is the toggle (or the link, with a toggle beside
        // it, when the group is also a page); its entries are a nested list.
        let head: React.ReactNode
        if (!collapsible) {
          head = link ?? (
            <span style={{ ...linkStyle(false, true), textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'var(--pw-font-size-xs)', color: 'var(--pw-color-text-muted)' }}>
              {label}
            </span>
          )
        } else if (link) {
          head = (
            <>
              {link}
              <button
                type="button"
                data-pw-sidebar-toggle=""
                data-pw-hit=""
                aria-expanded={isOpen}
                aria-controls={listId}
                aria-label={messageOf(messages, isOpen ? 'ui.tree.collapse' : 'ui.tree.expand', '', { label }) || undefined}
                onClick={() => toggle(key)}
                style={toggleStyle}
              >
                <Chevron open={isOpen} />
              </button>
            </>
          )
        } else {
          head = (
            <button
              type="button"
              data-pw-sidebar-toggle=""
              aria-expanded={isOpen}
              aria-controls={listId}
              onClick={() => toggle(key)}
              style={{ ...toggleStyle, ...linkStyle(false, true), justifyContent: 'space-between', width: '100%', textAlign: 'left' }}
            >
              <span>{label}</span>
              <Chevron open={isOpen} />
            </button>
          )
        }
        return (
          <li key={key}>
            <div data-pw-sidebar-row="" style={rowStyle(depth)}>
              {head}
            </div>
            {renderList(children, depth + 1, `${key}.`, listId, !isOpen)}
          </li>
        )
      })}
    </ul>
  )

  const titleId = `${block.id}-title`
  const name = navLabel ? { 'aria-label': navLabel } : title ? { 'aria-labelledby': titleId } : {}
  return (
    <nav
      id={block.id}
      data-block-id={block.id}
      data-block-type="sidebar"
      {...name}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, ...block.style }}
    >
      <style>{SIDEBAR_CSS + HIT_AREA_CSS}</style>
      {title && (
        <p id={titleId} style={{ margin: 0, padding: '0 10px', fontSize: 'var(--pw-font-size-sm)', fontWeight: 700, color: 'var(--pw-color-text)' }}>
          {title}
        </p>
      )}
      {renderList(items, 0, '')}
    </nav>
  )
}
