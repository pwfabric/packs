/**
 * Two blocks for long-form sites: the sidebar (a navigation tree held in its
 * own props) and the definition list (a real <dl>).
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { SidebarBlock, sidebarTrail } from '../atoms/blocks/layout/sidebar/component.js'
import { DefinitionListBlock } from '../atoms/blocks/data/definition-list/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }
/** A path-mode router: the host has already written each entry's href in this form. */
const pathHref = (path: string): string => (path.startsWith('/') && !path.startsWith('//') ? `/app${path}` : path)

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
  it('is a named navigation landmark of nested lists; hrefs are written as the host gave them', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { title: 'Documentation', items: DOCS }, { appHref: pathHref })
    const nav = screen.getByRole('navigation', { name: 'Documentation' })
    expect(nav.id).toBe('sb')
    expect(within(nav).getByRole('link', { name: 'Introduction' }).getAttribute('href')).toBe('/')
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

  it('a group that matches by prefix still opens over the page in view', () => {
    const tree = [
      { label: 'Overview', href: '/' },
      { label: 'Authoring', href: '/authoring', match: 'prefix', children: [{ label: 'defineBlock()', href: '/authoring/define-block' }] },
    ]
    expect(sidebarTrail(tree, '/authoring/define-block')).toEqual(['1'])
    expect(sidebarTrail(tree, '/authoring')).toEqual([])
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: tree, activeHref: '/authoring/define-block' })
    expect(screen.getByRole('link', { name: 'defineBlock()' }).getAttribute('aria-current')).toBe('page')
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
    // Only the phone fold's button: no group toggles.
    expect(screen.queryAllByRole('button').filter((b) => !b.hasAttribute('data-pw-sidebar-fold'))).toHaveLength(0)
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

describe('sidebar: a closed group is not drawn', () => {
  it('its list is hidden and carries no inline display that would undo hidden', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: DOCS })
    const guides = screen.getByRole('button', { name: 'Guides' })
    const list = document.getElementById(guides.getAttribute('aria-controls') ?? '') as HTMLElement
    expect(list.hidden).toBe(true)
    expect(list.style.display).toBe('')
    expect(getComputedStyle(list).display).toBe('none')
    expect(screen.queryByRole('link', { name: 'Install' })).toBeNull()
    fireEvent.click(guides)
    expect(getComputedStyle(list).display).not.toBe('none')
    expect(screen.getByRole('link', { name: 'Install' })).toBeTruthy()
  })

  it('in the static first frame too: every closed list is hidden, none sets display inline', () => {
    const Comp = SidebarBlock as unknown as React.FC<Record<string, unknown>>
    const html = renderToString(
      <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
        <Comp props={applied('sidebar', { navLabel: 'Docs', items: DOCS })} block={{ id: 'sb', type: 'sidebar', props: {}, layout: {} }} context={{ interactionMode: 'live' }} />
      </BehaviorSurfaceProvider>,
    )
    const lists = [...html.matchAll(/<ul[^>]*>/g)].map((m) => m[0])
    const closed = lists.filter((u) => /\shidden=""/.test(u))
    expect(closed.length).toBe(3)
    expect(closed.every((u) => !/display/.test(u))).toBe(true)
    expect(html).toContain('[data-pw-sidebar-tree] ul[hidden] { display: none !important; }')
  })
})

describe('sidebar on a phone: one button folds the tree, CSS decides', () => {
  it('a folded tree behind a named button with aria-expanded and aria-controls', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { title: 'Documentation', items: DOCS })
    const fold = screen.getByRole('button', { name: 'Documentation' })
    expect(fold.getAttribute('type')).toBe('button')
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    const tree = document.getElementById(fold.getAttribute('aria-controls') ?? '') as HTMLElement
    expect(tree.hasAttribute('data-pw-sidebar-tree')).toBe(true)
    expect(tree.hasAttribute('data-pw-folded')).toBe(true)
    fireEvent.click(fold)
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(tree.hasAttribute('data-pw-folded')).toBe(false)
    // Choosing a page folds it again (a layout's sidebar stays mounted).
    fireEvent.click(within(tree).getByRole('link', { name: 'Introduction' }))
    expect(tree.hasAttribute('data-pw-folded')).toBe(true)
  })

  it('the fold is CSS only: hidden under 768px when folded, the button gone from 768px', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: DOCS })
    const css = document.querySelector('#sb style')?.textContent ?? ''
    expect(css).toContain('@media (max-width: 767.98px) { [data-pw-sidebar-tree][data-pw-folded] { display: none !important; }')
    expect(css).toContain('@media (min-width: 768px) { [data-pw-sidebar-fold] { display: none !important; } }')
    // No title: the button is named by the app's word, English when unset.
    expect(screen.getByRole('button', { name: 'Menu' }).hasAttribute('data-pw-sidebar-fold')).toBe(true)
  })

  it('foldOnPhone: false draws no fold', () => {
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items: DOCS, foldOnPhone: false })
    expect(document.querySelector('[data-pw-sidebar-fold]')).toBeNull()
    expect(document.querySelector('[data-pw-folded]')).toBeNull()
    expect(document.querySelector('#sb style')?.textContent).not.toContain('767.98px')
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
    expect((document.querySelector('#dl [data-pw-dl-box]') as HTMLElement).style.containerType).toBe('inline-size')
    expect(css).toContain('[data-pw-dl][data-pw-dl-rules] > div + div > dt { border-top: 1px solid var(--pw-color-border); }')
  })

  it('below 420px columns stack with no rule between a term and its description', () => {
    mount(DefinitionListBlock, 'dl', 'definition-list', { items, layout: 'columns', dividers: true })
    // The rules and spacing are CSS, so the narrow query can take them back; nothing inline fights it.
    const cells = [...document.querySelectorAll<HTMLElement>('#dl dt, #dl dd')]
    expect(cells.every((c) => c.style.borderTop === '' && c.style.paddingTop === '')).toBe(true)
    const css = document.querySelector('#dl style')?.textContent ?? ''
    expect(css).toContain('[data-pw-dl="columns"][data-pw-dl-rules] > div + div > dt + dd { border-top: 1px solid var(--pw-color-border); }')
    const narrow = css.slice(css.indexOf('@container (max-width: 420px)'))
    expect(narrow).toContain('[data-pw-dl="columns"][data-pw-dl-rules] > div + div > dt + dd { border-top: 0; }')
    expect(document.querySelector('#dl dl')?.hasAttribute('data-pw-dl-rules')).toBe(true)
  })

  it('the size container is an inner full-width box, so the block does not collapse in a parent that does not stretch it', () => {
    mount(DefinitionListBlock, 'dl', 'definition-list', { items, layout: 'columns' })
    const root = document.getElementById('dl') as HTMLElement
    expect(root.style.containerType).toBe('')
    expect(root.style.width).toBe('100%')
    const box = root.querySelector('[data-pw-dl-box]') as HTMLElement
    expect(box.style.containerType).toBe('inline-size')
    expect(box.style.width).toBe('100%')
    expect(box.querySelector('dl')).not.toBeNull()
  })

  it('draws nothing with no items', () => {
    mount(DefinitionListBlock, 'dl', 'definition-list', { items: [] })
    expect(document.getElementById('dl')).toBeNull()
  })
})

