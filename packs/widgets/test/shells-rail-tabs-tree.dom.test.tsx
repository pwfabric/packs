/**
 * app-rail, tabs and tree-view. One describe per behaviour:
 *
 *   app-rail paints the active label as ink, not --pw-color-primary (about 2:1 on
 *     a mid-lightness brand)
 *   app-rail names a destination without href when labels are hidden
 *   tabs draw no "Tab 1 / Tab 2" when `tabs` is not an array
 *   the tablist wraps or scrolls
 *   the default variant's border sits under the tablist, not the whole block
 *   arrow keys move focus with the selected tab
 *   tabs write the active tab to a stateKey
 *   tree-view toggle is named and big enough; the root has an id
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { AppRailBlock } from '../../foundation/atoms/blocks/layout/app-rail/component.js'
import { TabsBlock } from '../../foundation/atoms/blocks/container/tabs/component.js'
import { TreeViewBlock } from '../atoms/blocks/container/tree-view/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

const here = dirname(fileURLToPath(import.meta.url))

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
type Ev = { type: string; payload?: Record<string, unknown> }

function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode, context: Record<string, unknown> = {}) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={context}>
      {children}
    </Comp>
  )
}

function mount(tree: React.ReactNode): { events: Ev[] } {
  const events: Ev[] = []
  render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      {tree}
    </BehaviorSurfaceProvider>,
  )
  return { events }
}

// ── app-rail ──────────────────────────────────────────────────────────────────

describe('app-rail active destination reads as ink, not as the brand fill', () => {
  it('uses --pw-color-primary-ink for the active label', () => {
    mount(el(AppRailBlock, 'r', 'app-rail', { items: [{ label: 'Home', href: '/home', icon: 'home' }, { label: 'Tasks', href: '/tasks' }], activeHref: '/home' }))
    const active = screen.getByRole('link', { name: 'Home' })
    expect(active.getAttribute('style')).toContain('--pw-color-primary-ink')
    expect(active.getAttribute('style')).toContain('color-mix')
  })
})

describe('app-rail names a destination without href when labels are hidden', () => {
  it('keeps the label for assistive technology', () => {
    const { container } = render(el(AppRailBlock, 'r', 'app-rail', { items: [{ label: 'Inbox', icon: 'inbox' }], showLabels: false }))
    expect(container.textContent).toContain('Inbox')
  })
  it('survives a missing context', () => {
    const Comp = AppRailBlock as unknown as AnyBlock
    expect(() => render(<Comp props={applied('app-rail', { items: [] })} block={{ id: 'r', type: 'app-rail', props: {}, layout: {} }} />)).not.toThrow()
  })
})

// ── tabs ──────────────────────────────────────────────────────────────────────

describe('tabs invent no labels', () => {
  it('draws no "Tab 1" when tabs is not an array', () => {
    mount(el(TabsBlock, 't', 'tabs', { tabs: '{{source}}' }))
    expect(screen.queryByText('Tab 1')).toBeNull()
    expect(screen.queryByText('Tab 2')).toBeNull()
  })
})

describe('the tablist scrolls and carries its own border', () => {
  it('overflowX auto on the tablist; no border on the block root', () => {
    const { container } = render(
      el(TabsBlock, 't', 'tabs', { tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, [<p key="1">one</p>, <p key="2">two</p>]),
    )
    const list = screen.getByRole('tablist')
    expect(list.style.overflowX).toBe('auto')
    expect(list.style.borderBottom).toContain('solid')
    const root = container.querySelector('[data-block-type="tabs"]') as HTMLElement
    expect(root.style.borderBottom).toBe('')
  })
})

describe('arrow keys move focus with the selection', () => {
  it('focus follows ArrowRight; tablist declares its orientation', () => {
    mount(el(TabsBlock, 't', 'tabs', { tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }, [<p key="1">one</p>, <p key="2">two</p>]))
    const a = screen.getByRole('tab', { name: 'A' })
    a.focus()
    fireEvent.keyDown(a, { key: 'ArrowRight' })
    const b = screen.getByRole('tab', { name: 'B' })
    expect(b.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(b)
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal')
  })
})

describe('tabs write the active tab to page state', () => {
  it('stateKey → setState action on change', () => {
    const { events } = mount(
      el(TabsBlock, 't', 'tabs', { tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], stateKey: 'view' }, [<p key="1">one</p>, <p key="2">two</p>]),
    )
    fireEvent.click(screen.getByRole('tab', { name: 'B' }))
    const withAction = events.find((e) => (e.payload?.action as { type?: string } | undefined)?.type === 'setState')
    expect(withAction?.payload?.action).toEqual({ type: 'setState', key: 'view', value: 'b' })
  })
})

// ── tree-view ─────────────────────────────────────────────────────────────────

describe('tree-view toggle is named and big enough; root is addressable', () => {
  it('named ≥24px toggle, root id + data-block-id', () => {
    const { container } = render(
      el(TreeViewBlock, 'tv', 'tree-view', { nodes: [{ id: 'n1', label: 'Docs', children: [{ id: 'n2', label: 'Guide' }] }] }),
    )
    const root = container.querySelector('#tv') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-block-id')).toBe('tv')
    expect(root.getAttribute('data-block-type')).toBe('tree-view')
    const toggle = screen.getByRole('button', { name: /Docs/ })
    expect(parseInt(toggle.style.width, 10)).toBeGreaterThanOrEqual(24)
    expect(screen.getByRole('tree')).toBeTruthy()
    fireEvent.click(toggle)
    expect(screen.getByText('Guide')).toBeTruthy()
  })
})

describe('tree-view marks the current page', () => {
  const nodes = [
    { id: 'g', label: 'Handbook', children: [
      { id: 'a', label: 'Introduction', href: '/handbook/introduction' },
      { id: 'b', label: 'Rules', href: '/handbook/rules' },
    ] },
    { id: 'c', label: 'Contact', href: '/contact' },
  ]

  it('the node whose href is activeHref carries aria-current="page", and its branch opens', () => {
    render(el(TreeViewBlock, 't', 'tree-view', { nodes, activeHref: '/handbook/rules' }))
    const current = screen.getByRole('link', { name: 'Rules' })
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.getAttribute('style')).toContain('--pw-color-primary-ink')
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('aria-current')).toBeNull()
  })

  it('without activeHref nothing is marked', () => {
    render(el(TreeViewBlock, 't', 'tree-view', { nodes, defaultExpandedIds: ['g'] }))
    expect(document.querySelector('[aria-current]')).toBeNull()
  })

  it('the manifest declares activeHref', () => {
    const m = JSON.parse(readFileSync(join(here, '..', 'atoms', 'blocks', 'container', 'tree-view', 'manifest.json'), 'utf8')) as {
      definition: { props: { name: string }[] }
    }
    expect(m.definition.props.map((p) => p.name)).toContain('activeHref')
  })
})
