import * as React from 'react'
import { useAppMessage } from '@pwfabric/runtime'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, ICON_PATHS, listOf, safeHref, safeRenderValue } from '../../../lib/_kit.js'
import { sameRoute } from '../../../lib/_shared-account-menu.js'

/**
 * A node of the tree. The manifest shapes the first two levels (`nodes` items
 * and their `children` items as objects); deeper levels are not shaped there —
 * a prop shape has no recursion — so the renderer guards each level itself.
 */
export interface TreeNode {
  readonly id: string
  readonly label: string
  readonly icon?: string | undefined
  readonly href?: string | undefined
  readonly children?: readonly TreeNode[] | undefined
}

// Props — declared in manifest.json, applied by the runtime.
export interface TreeViewProps {
  readonly title?: string
  /** The heading level of the title (default h3). */
  readonly titleLevel?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  /** The tree is a navigation landmark, named by the title or `navLabel`. */
  readonly nav?: boolean
  readonly navLabel?: string
  readonly nodes: readonly TreeNode[]
  readonly defaultExpandedIds: readonly string[]
  /**
   * The page in view. Its node is marked (aria-current="page", primary ink)
   * and its branch opens.
   */
  readonly activeHref?: string
}

export const TreeViewDefinition: BlockDefinition = {
  type: 'tree-view',
  name: 'TreeView',
  category: 'container',
  icon: 'layers',
  defaultProps: { nodes: [], defaultExpandedIds: [] },
  canHaveChildren: false,
}

/**
 * `ICON_PATHS` is keyed by `string`, so every lookup is `readonly string[] |
 * undefined` — chaining to another key of the same table (`ICON_PATHS.circle`)
 * proved nothing, because that read is equally indefinite. The last resort is
 * a named value: the same geometry the generated `circle` entry carries, so a
 * name that is absent from the table still renders a glyph rather than
 * throwing on `.join`.
 */
const FALLBACK_ICON_PATHS: readonly string[] = ['<circle cx="12" cy="12" r="10"/>']

function TreeIcon({ name }: { name: string }) {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.circle ?? FALLBACK_ICON_PATHS
  return (
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
      dangerouslySetInnerHTML={{ __html: paths.join('') }}
    />
  )
}

/**
 * A node's children. The manifest shapes the top two levels only (a prop
 * shape has no recursion), so below them a level may hold anything: a
 * `children` that is not a list, or an item that is not an object, is
 * skipped, never rendered (the in-code recursion guard).
 */
export function childrenOf(node: TreeNode): readonly TreeNode[] {
  const list = (node as { children?: unknown }).children
  if (!Array.isArray(list)) return []
  return list.filter((c): c is TreeNode => typeof c === 'object' && c !== null && !Array.isArray(c))
}

/** The ids of the nodes above the one whose href is `activeHref` (empty when none matches). */
export function activeTrail(nodes: readonly TreeNode[], activeHref: string | undefined): string[] {
  if (!activeHref) return []
  const visit = (list: readonly TreeNode[], trail: string[]): string[] | null => {
    for (const n of list) {
      if (sameRoute(n.href, activeHref)) return trail
      const children = childrenOf(n)
      if (children.length) {
        const hit = visit(children, [...trail, n.id])
        if (hit) return hit
      }
    }
    return null
  }
  return visit(nodes, []) ?? []
}

/**
 * On a phone every row is a 44px target: the row grows to 44px, the chevron
 * button is a 44x44 box (it was 36 wide) and the link fills the rest of the row (a 20px line
 * of text was the only thing to hit).
 */
const TREE_PHONE_CSS =
  '@media (max-width: 640px), (pointer: coarse) {' +
  ' [data-pw-tree-row] { min-height: 44px; padding-top: 0 !important; padding-bottom: 0 !important; }' +
  ' [data-pw-tree-row] > button { height: 44px !important; width: 44px !important; }' +
  ' [data-pw-tree-row] > [data-pw-tree-spacer] { width: 44px !important; }' +
  ' [data-pw-tree-row] > a { flex: 1 1 0; min-width: 0; align-self: stretch; display: flex; align-items: center; }' +
  ' }'

function TreeItem({
  node,
  depth,
  expanded,
  toggle,
  activeHref,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  toggle: (id: string) => void
  activeHref: string | undefined
}) {
  const children = childrenOf(node)
  const hasChildren = children.length > 0
  const isOpen = expanded.has(node.id)
  const href = safeHref(node.href)
  const active = Boolean(href) && sameRoute(node.href, activeHref)
  // The toggle's name is the app's word (ui.tree.expand / ui.tree.collapse).
  const label = safeRenderValue(node.label)
  const expandName = useAppMessage('ui.tree.expand', '', { label })
  const collapseName = useAppMessage('ui.tree.collapse', '', { label })

  return (
    <li
      style={{ listStyle: 'none' }}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? isOpen : undefined}
    >
      <div data-pw-tree-row="" style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: depth * 16, paddingTop: 4, paddingBottom: 4 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={isOpen}
            // The chevron alone names nothing, and a 16px target is too small to
            // hit on a phone.
            aria-label={isOpen ? collapseName : expandName}
            data-pw-hit=""
            style={{
              width: 24,
              height: 24,
              padding: 0,
              justifyContent: 'center',
              flexShrink: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--pw-color-text-muted, #71717a)',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ) : (
          <span data-pw-tree-spacer="" style={{ width: 24, flexShrink: 0 }} />
        )}
        {node.icon && <TreeIcon name={node.icon} />}
        {href ? (
          <a
            href={href}
            aria-current={active ? 'page' : undefined}
            style={{
              fontSize: 'var(--pw-font-size-sm, 14px)',
              textDecoration: 'none',
              // Ink, not the brand fill — the same AA rule as app-rail.
              color: active ? 'var(--pw-color-primary-ink, var(--pw-color-primary, #18181b))' : 'var(--pw-color-text, #09090b)',
              fontWeight: active ? 600 : undefined,
              ...(active
                ? {
                    background: 'var(--pw-color-accent-subtle, color-mix(in srgb, var(--pw-color-primary) 10%, transparent))',
                    borderRadius: 'var(--pw-border-radius-sm, 6px)',
                    padding: '2px 6px',
                    margin: '-2px -6px',
                  }
                : {}),
            }}
          >
            {safeRenderValue(node.label)}
          </a>
        ) : (
          <span style={{ fontSize: 'var(--pw-font-size-sm, 14px)' }}>{safeRenderValue(node.label)}</span>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul role="group" style={{ margin: 0, padding: 0 }}>
          {children.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} activeHref={activeHref} />
          ))}
        </ul>
      )}
    </li>
  )
}

export const TreeViewBlock: BlockComponent = ({ props, block }) => {
  const p = props as unknown as TreeViewProps
  // A defaulted prop can still arrive as another type (a binding that has
  // not resolved): anything but a list reads as empty.
  const { title } = p
  const TitleTag = (['h2', 'h3', 'h4', 'h5', 'h6'] as const).includes(p.titleLevel as 'h3') ? (p.titleLevel as 'h3') : 'h3'
  const navLabel = typeof p.navLabel === 'string' && p.navLabel ? p.navLabel : undefined
  const isNav = p.nav === true
  const nodes = listOf<TreeNode>(p.nodes)
  const defaultExpandedIds = listOf<string>(p.defaultExpandedIds)
  const activeHref = typeof p.activeHref === 'string' && p.activeHref ? p.activeHref : undefined
  const trail = activeTrail(nodes, activeHref)
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set([...defaultExpandedIds, ...trail])

  )
  // A bound activeHref or nodes that resolve after the first render still open
  // the branch that holds the current page.
  const trailKey = trail.join(' ')
  React.useEffect(() => {
    if (trail.length === 0) return
    setExpanded((prev) => (trail.every((id) => prev.has(id)) ? prev : new Set([...prev, ...trail])))
  }, [trailKey])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // A navigation tree is a landmark: named by navLabel, else by its title.
  const Root = isNav ? 'nav' : 'div'
  const landmarkName = isNav
    ? navLabel
      ? { 'aria-label': navLabel }
      : title
        ? { 'aria-labelledby': `${block.id}-title` }
        : {}
    : {}
  return (
    <Root id={block.id} data-block-id={block.id} data-block-type="tree-view" className="pw-tree-view" style={block.style} {...landmarkName}>
      {title && (
        <TitleTag id={`${block.id}-title`} style={{ margin: '0 0 8px', fontSize: 'var(--pw-font-size-base, 16px)', fontWeight: 700 }}>
          {safeRenderValue(title)}
        </TitleTag>
      )}
      <style>{TREE_PHONE_CSS + HIT_AREA_CSS}</style>
      <ul role="tree" aria-labelledby={title ? `${block.id}-title` : undefined} style={{ margin: 0, padding: 0 }}>
        {nodes.map((node) => (
          <TreeItem key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} activeHref={activeHref} />
        ))}
      </ul>
    </Root>
  )
}
