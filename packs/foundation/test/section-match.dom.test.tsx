/**
 * A navigation item with `match: "prefix"` marks its SECTION on every page
 * below it ("/guides" on "/guides/records"), so one shared layout marks where
 * the visitor is on nested pages. aria-current="page" stays on the exact page;
 * the section has its own, lighter mark (`data-pw-current="section"`).
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { routeState } from '../atoms/lib/_shared-account-menu.js'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { AppRailBlock } from '../atoms/blocks/layout/app-rail/component.js'
import { BottomBarBlock } from '../atoms/blocks/layout/bottom-bar/component.js'
import { SidebarBlock } from '../atoms/blocks/layout/sidebar/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

function mount(C: unknown, id: string, type: string, props: Record<string, unknown>, context: Record<string, unknown> = {}): void {
  const Comp = C as React.FC<Record<string, unknown>>
  render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>,
  )
}

describe('routeState', () => {
  it('exact by default; prefix marks pages below, never siblings or the root', () => {
    expect(routeState('/guides', '/guides')).toBe('page')
    expect(routeState('/guides', '/guides/records')).toBeNull()
    expect(routeState('/guides', '/guides/records', 'prefix')).toBe('section')
    expect(routeState('/guides/', '#/guides/records/x', 'prefix')).toBe('section')
    expect(routeState('/guides', '/guidesextra', 'prefix')).toBeNull()
    expect(routeState('/', '/guides', 'prefix')).toBeNull()
    expect(routeState('/guides', '/guides', 'prefix')).toBe('page')
  })
})

const LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Guides', href: '/guides', match: 'prefix' },
  { label: 'Blog', href: '/blog' },
]

describe('navbar', () => {
  it('a prefix link marks its section, without aria-current, in the bar and the drawer', () => {
    mount(NavbarBlock, 'nav', 'navbar', { links: LINKS, activeHref: '/guides/records' })
    const marked = [...document.querySelectorAll('[data-pw-current]')]
    expect(marked.length).toBeGreaterThan(0)
    expect(marked.every((a) => a.textContent === 'Guides' && a.getAttribute('data-pw-current') === 'section')).toBe(true)
    expect(document.querySelector('[aria-current="page"]')).toBeNull()
    const bar = document.querySelector('nav[data-pw-nav-wide] [data-pw-current="section"]') as HTMLElement
    expect(bar.style.textDecorationThickness).toBe('1px')
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(document.querySelector('#nav-menu [data-pw-current="section"]')?.textContent).toBe('Guides')
  })

  it('on its own page the link is the page: aria-current and the full mark', () => {
    mount(NavbarBlock, 'nav', 'navbar', { links: LINKS, activeHref: '/guides' })
    const page = document.querySelector('nav[data-pw-nav-wide] [aria-current="page"]') as HTMLElement
    expect(page.textContent).toBe('Guides')
    expect(page.style.textDecorationThickness).toBe('2px')
  })

  it('an exact link (the default) marks nothing on a nested page', () => {
    mount(NavbarBlock, 'nav', 'navbar', { links: LINKS, activeHref: '/blog/launch' })
    expect(document.querySelector('[data-pw-current]')).toBeNull()
  })
})

describe('app-rail and bottom-bar', () => {
  const items = [
    { label: 'Home', href: '/', icon: 'home' },
    { label: 'Records', href: '/records', icon: 'file', match: 'prefix' },
  ]
  it.each([
    ['app-rail', AppRailBlock],
    ['bottom-bar', BottomBarBlock],
  ])('%s marks the section of a nested page, aria-current only on the exact page', (type, C) => {
    mount(C, type, type, { items, activeHref: '/records/42' })
    const records = screen.getAllByRole('link', { name: 'Records' })[0]!
    expect(records.getAttribute('data-pw-current')).toBe('section')
    expect(records.getAttribute('aria-current')).toBeNull()
    expect(records.style.fontWeight).toBe('500')
    cleanup()
    mount(C, type, type, { items, activeHref: '/records' })
    const exact = screen.getAllByRole('link', { name: 'Records' })[0]!
    expect(exact.getAttribute('aria-current')).toBe('page')
    expect(exact.style.fontWeight).toBe('600')
  })
})

describe('sidebar', () => {
  it('a prefix entry marks its section and opens its group; the exact page keeps aria-current', () => {
    const items = [{ label: 'Guides', children: [{ label: 'Records', href: '/guides/records', match: 'prefix' }] }]
    mount(SidebarBlock, 'sb', 'sidebar', { navLabel: 'Docs', items, activeHref: '/guides/records/import' })
    const records = screen.getByRole('link', { name: 'Records' })
    expect(records.getAttribute('data-pw-current')).toBe('section')
    expect(records.getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('button', { name: 'Guides' }).getAttribute('aria-expanded')).toBe('true')
  })
})
