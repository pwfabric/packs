/**
 * The active destination survives the runner's hash rewrite.
 *
 * In hash mode the runner rewrites every link prop — `href` and every `*Href`,
 * `activeHref` included — from `/dashboard` to `#/dashboard`. `normalizeHref`
 * cut at the first `#`, so both sides normalised to nothing and no rail item,
 * bottom-bar tab or navbar link was ever marked active in a published app.
 *
 * Also: the rail's 76px default cut a one-word label ("Dashboard" → "Dashboa").
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { normalizeHref, sameRoute } from '../atoms/lib/_shared-account-menu.js'
import { AppRailBlock } from '../atoms/blocks/layout/app-rail/component.js'
import { BottomBarBlock } from '../atoms/blocks/layout/bottom-bar/component.js'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>

function mount(C: unknown, type: string, props: Record<string, unknown>, context: Record<string, unknown> = {}) {
  const Comp = C as AnyBlock
  return render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id: 'b', type, props, layout: {} }} context={context} />
    </BehaviorSurfaceProvider>,
  )
}

const HASH_ITEMS = [
  { label: 'Dashboard', href: '#/dashboard', icon: 'home' },
  { label: 'Reports', href: '#/reports', icon: 'file-text' },
]

describe('normalizeHref reads a hash route as the route', () => {
  it('a #/page route is the page', () => {
    expect(normalizeHref('#/dashboard')).toBe('/dashboard')
    expect(normalizeHref('/#/dashboard/')).toBe('/dashboard')
    expect(normalizeHref('#/dashboard?tab=2')).toBe('/dashboard')
    expect(normalizeHref('#/')).toBe('/')
  })
  it('an in-page anchor is still cut', () => {
    expect(normalizeHref('/dashboard#totals')).toBe('/dashboard')
    expect(normalizeHref('#totals')).toBeUndefined()
  })
  it('the rewritten and the written form are the same route', () => {
    expect(sameRoute('#/dashboard', '/dashboard')).toBe(true)
    expect(sameRoute('#/dashboard', '#/dashboard')).toBe(true)
    expect(sameRoute('#/dashboard', '#/reports')).toBe(false)
    expect(sameRoute('#totals', '#totals')).toBe(false)
  })
})

describe('the shells mark the active item after the hash rewrite', () => {
  it('app-rail', () => {
    mount(AppRailBlock, 'app-rail', { items: HASH_ITEMS, activeHref: '#/dashboard' })
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Reports' }).getAttribute('aria-current')).toBeNull()
  })
  it('app-rail as a bottom bar on xs', () => {
    mount(AppRailBlock, 'app-rail', { items: HASH_ITEMS, activeHref: '#/reports' }, { viewport: 'xs' })
    expect(screen.getByRole('link', { name: 'Reports' }).getAttribute('aria-current')).toBe('page')
  })
  it('bottom-bar', () => {
    mount(BottomBarBlock, 'bottom-bar', { items: HASH_ITEMS, activeHref: '#/dashboard' })
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page')
  })
  it('navbar', () => {
    mount(NavbarBlock, 'navbar', {
      logoText: 'Example',
      links: [
        { label: 'Dashboard', href: '#/dashboard' },
        { label: 'Reports', href: '#/reports' },
      ],
      activeHref: '#/reports',
    })
    const reports = screen.getAllByRole('link', { name: 'Reports' })[0]!
    expect(reports.getAttribute('aria-current')).toBe('page')
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]!.getAttribute('aria-current')).toBeNull()
  })
  it('navbar without activeHref marks nothing', () => {
    mount(NavbarBlock, 'navbar', { logoText: 'Example', links: [{ label: 'Dashboard', href: '#/dashboard' }] })
    expect(document.querySelector('[aria-current="page"]')).toBeNull()
  })
})

describe('the rail label is not clipped', () => {
  it('defaults to 88px and lets a label wrap instead of cutting it', () => {
    const { container } = mount(AppRailBlock, 'app-rail', { items: HASH_ITEMS })
    const rail = container.querySelector('[data-block-type="app-rail"]') as HTMLElement
    expect(rail.style.width).toBe('88px')
    const label = screen.getByText('Dashboard') as HTMLElement
    expect(label.style.overflowWrap).toBe('anywhere')
    expect(label.style.textOverflow).toBe('')
  })
})
