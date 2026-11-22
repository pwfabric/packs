/**
 * Two blocks for long-form sites: the sidebar (a navigation tree held in its
 * own props) and the definition list (a real <dl>).
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { SidebarBlock, sidebarTrail } from '../atoms/blocks/layout/sidebar/component.js'
import { DefinitionListBlock } from '../atoms/blocks/data/definition-list/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }
const hashHref = (path: string): string => (path.startsWith('/') && !path.startsWith('//') ? `#${path}` : path)

function mount(C: unknown, id: string, type: string, props: Record<string, unknown>, context: Record<string, unknown> = {}): Ev[] {
  const Comp = C as React.FC<Record<string, unknown>>
  const events: Ev[] = []
  render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>,
  )
  return events
}

const DOCS = [
  { label: 'Introduction', href: '/' },
  {
    label: 'Guides',
    children: [
      { label: 'Install', href: '/guides/install' },
      { label: 'Deploy', href: '/guides/deploy', children: [{ label: 'Cloudflare', href: '/guides/deploy/cloudflare' }] },
    ],
  },
  { label: 'Reference', href: '/reference', children: [{ label: 'CLI', href: '/reference/cli' }] },
]

describe('sidebar', () => {
  it('is a named navigation landmark of nested lists; links go through appHref', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { title: 'Documentation', items: DOCS }, { appHref: hashHref })
    const nav = screen.getByRole('navigation', { name: 'Documentation' })
    expect(nav.id).toBe('sb')
    expect(within(nav).getByRole('link', { name: 'Introduction' }).getAttribute('href')).toBe('#/')
    expect(nav.querySelectorAll('ul ul').length).toBeGreaterThan(0)
  })

  it('marks the page in view and opens every group above it', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: DOCS, activeHref: '/guides/deploy/cloudflare' })
    const current = screen.getByRole('link', { name: 'Cloudflare' })
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    // The groups above it are open; the unrelated group is closed.
    expect(screen.getByRole('button', { name: 'Guides' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Expand Reference' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: 'CLI' })).toBeNull()
    expect(sidebarTrail(DOCS, '/guides/deploy/cloudflare')).toEqual(['1', '1.1'])
  })

  it('a group toggles with its button: aria-expanded, aria-controls, hidden entries', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: DOCS })
    const guides = screen.getByRole('button', { name: 'Guides' })
    expect(guides.getAttribute('type')).toBe('button')
    expect(guides.getAttribute('aria-expanded')).toBe('false')
    const list = document.getElementById(guides.getAttribute('aria-controls') ?? '') as HTMLElement
    expect(list.tagName).toBe('UL')
    expect(list.hidden).toBe(true)
    fireEvent.click(guides)
    expect(guides.getAttribute('aria-expanded')).toBe('true')
    expect(list.hidden).toBe(false)
    expect(screen.getByRole('link', { name: 'Install' })).toBeTruthy()
    // A group that is also a page: its link, and a toggle beside it named in the app's words.
    const reference = screen.getByRole('link', { name: 'Reference' })
    const toggle = screen.getByRole('button', { name: 'Expand Reference' })
    expect(reference.parentElement).toBe(toggle.parentElement)
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Collapse Reference' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('open: true starts a group open; collapsible: false shows every group with no toggle', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: [{ ...DOCS[1], open: true }] })
    expect(screen.getByRole('button', { name: 'Guides' }).getAttribute('aria-expanded')).toBe('true')
    cleanup()
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: DOCS, collapsible: false })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Cloudflare' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'CLI' })).toBeTruthy()
  })

  it('drops unsafe links and deeper levels that are not entries; in the editor a click reports the page', () => {
    const items = [{ label: 'Bad', href: 'javascript:alert(1)' }, { label: 'Odd', children: ['x', 3, null] }, { label: 'Home', href: '/' }]
    const events = mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items }, { interactionMode: 'inert' })
    expect(screen.queryByRole('link', { name: 'Bad' })).toBeNull()
    expect(screen.getByText('Bad')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Odd' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Home' }))
    expect(events).toContainEqual(expect.objectContaining({ type: 'block:click', blockId: 'sb', payload: { href: '/' } }))
  })
})

describe('definition list', () => {
  const items = [
    { term: 'Weight', description: '1.2 kg' },
    { term: 'Colours', description: ['Black', 'Sand'] },
    { term: '', description: 'no term' },
  ]

  it('is a <dl> of terms and descriptions; several descriptions are several <dd>', () => {
    mount(DefinitionListBlock, 'dl', 'definition-list', { items })
    const dl = document.querySelector('#dl dl') as HTMLElement
    expect([...dl.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Weight', 'Colours'])
    expect([...dl.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['1.2 kg', 'Black', 'Sand'])
    // Each pair is a <div> child of the <dl> (the only wrapper <dl> allows).
    expect([...dl.children].every((c) => c.tagName === 'DIV')).toBe(true)
    expect(dl.getAttribute('data-pw-dl')).toBe('stacked')
  })

  it('columns puts the term beside its description and stacks on a narrow box', () => {
    mount(DefinitionListBlock, 'dl', 'definition-list', { items, layout: 'columns', dividers: true })
    expect(document.querySelector('#dl dl')?.getAttribute('data-pw-dl')).toBe('columns')
    const css = document.querySelector('#dl style')?.textContent ?? ''
    expect(css).toContain('grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr)')
    expect(css).toContain('@container (max-width: 420px)')
    expect((document.getElementById('dl') as HTMLElement).style.containerType).toBe('inline-size')
    const second = document.querySelectorAll('#dl dt')[1] as HTMLElement
    expect(second.style.borderTop).toContain('1px solid')
  })

  it('draws nothing with no items', () => {
    mount(DefinitionListBlock, 'dl', 'definition-list', { items: [] })
    expect(document.getElementById('dl')).toBeNull()
  })
})

