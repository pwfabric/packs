/**
 * The navbar's link elements keep their identity across a re-render and a
 * hydration: an item component defined inside the bar's render was a new
 * component type each render, so React threw away and redrew every link.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

const props = {
  logoText: 'Studio',
  links: [
    { label: 'Work', href: '/work' },
    { label: 'Services', href: '/services', items: [{ label: 'Design', href: '/services/design' }] },
    { label: 'About', href: '/about' },
  ],
  secondaryCtaLabel: 'Log in',
  secondaryCtaHref: '/login',
}

function bar(activeHref: string): React.ReactElement {
  const Comp = NavbarBlock as unknown as React.FC<Record<string, unknown>>
  const p = { ...props, activeHref }
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied('navbar', p)} block={{ id: 'nav', type: 'navbar', props: p, layout: {} }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>
  )
}

const wideLinks = (root: ParentNode): Element[] => [...root.querySelectorAll('nav[data-pw-nav-wide] a, [data-pw-nav-wide] a')]

describe('navbar: link elements keep their identity', () => {
  it('across a re-render with new props', () => {
    const { rerender, container } = render(bar('/work'))
    const before = wideLinks(container)
    expect(before.length).toBeGreaterThanOrEqual(4)
    rerender(bar('/about'))
    const after = wideLinks(container)
    expect(after).toHaveLength(before.length)
    after.forEach((a, i) => expect(a).toBe(before[i]))
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('About')
  })

  it('across hydration of the server-painted bar', async () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(bar('/work'))
    document.body.appendChild(host)
    const painted = wideLinks(host)
    const errors: unknown[] = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(host, bar('/work'), { onRecoverableError: (e) => errors.push(e) })
    })
    expect(errors).toEqual([])
    const hydrated = wideLinks(host)
    expect(hydrated).toHaveLength(painted.length)
    hydrated.forEach((a, i) => expect(a).toBe(painted[i]))
    await act(async () => root?.render(bar('/about')))
    wideLinks(host).forEach((a, i) => expect(a).toBe(painted[i]))
    await act(async () => root?.unmount())
    host.remove()
  })
})

describe('navbar: no drawer to open, no menu button', () => {
  function only(p: Record<string, unknown>): void {
    const Comp = NavbarBlock as unknown as React.FC<Record<string, unknown>>
    render(
      <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
        <Comp props={applied('navbar', p)} block={{ id: 'nav', type: 'navbar', props: p, layout: {} }} context={{ interactionMode: 'live' }} />
      </BehaviorSurfaceProvider>,
    )
  }

  it('a bar with no links and nothing else for the drawer draws neither the button nor the drawer; the account stays', () => {
    only({ logoText: 'Studio', account: { state: 'signed-in', name: 'Ada' } })
    expect(document.querySelector('button[aria-controls="nav-menu"]')).toBeNull()
    expect(document.getElementById('nav-menu')).toBeNull()
    const narrow = document.querySelector('[data-pw-nav-narrow]') as HTMLElement
    expect(narrow.querySelector('button[aria-haspopup]')).not.toBeNull()
  })

  it('links, or a tool the drawer carries (search, a CTA), bring the button back', () => {
    for (const p of [{ links: [{ label: 'Work', href: '/work' }] }, { showSearch: true, searchPlaceholder: 'Search' }, { showCTA: true, ctaLabel: 'Book', ctaHref: '/book' }]) {
      only({ logoText: 'Studio', ...p })
      expect(document.querySelector('button[aria-controls="nav-menu"]')).not.toBeNull()
      cleanup()
    }
  })
})
