/**
 * A documentation page's furniture: its table of contents (the section being
 * read marked as the visitor scrolls) and "back to top" (shown only once the page
 * has scrolled).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { AppMessagesContext, BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TableOfContentsBlock, anchorOf, currentSection } from '../atoms/blocks/layout/table-of-contents/component.js'
import { BackToTopBlock, backToTopShown } from '../atoms/blocks/control/back-to-top/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

type AnyBlock = React.FC<Record<string, unknown>>
function el(Comp: unknown, type: string, props: Record<string, unknown>, messages?: Record<string, string>, context: Record<string, unknown> = {}): React.ReactElement {
  const C = Comp as AnyBlock
  const tree = (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <C props={applied(type, props)} block={{ id: 'b', type, props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>
  )
  return messages ? <AppMessagesContext.Provider value={messages}>{tree}</AppMessagesContext.Provider> : tree
}

const ITEMS = [
  { label: 'Signature', href: '#signature', level: 2 },
  { label: 'Optional fields', href: '#optional-fields', level: 3 },
  { label: 'Props', href: '/authoring/define-block/#props', level: 2 },
]

describe('table-of-contents', () => {
  it('a navigation named by its title, a link per section, h3 under h2 — in the first frame', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(el(TableOfContentsBlock, 'table-of-contents', { title: 'On This Page', items: ITEMS }))
    const nav = host.querySelector('nav') as HTMLElement
    expect(nav.getAttribute('aria-labelledby')).toBe('b-title')
    expect(host.querySelector('#b-title')?.textContent).toBe('On This Page')
    expect([...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('data-pw-level')])).toEqual([
      ['Signature', '#signature', '2'],
      ['Optional fields', '#optional-fields', '3'],
      ['Props', '/authoring/define-block/#props', '2'],
    ])
  })

  it('the title falls back to the app word; no items draws nothing', () => {
    render(el(TableOfContentsBlock, 'table-of-contents', { items: ITEMS }, { 'ui.toc': 'Contents' }))
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeTruthy()
    cleanup()
    const { container } = render(el(TableOfContentsBlock, 'table-of-contents', { items: [] }))
    expect(container.querySelector('nav')).toBeNull()
  })

  it('the section being read is the last heading that passed the line', () => {
    expect(anchorOf('/a/#props')).toBe('props')
    expect(anchorOf('#x%20y')).toBe('x y')
    expect(anchorOf('/a/')).toBeUndefined()
    // A malformed %-escape is the id as written, never a thrown render.
    expect(anchorOf('#bad%E0%A4%A')).toBe('bad%E0%A4%A')
    expect(currentSection([300, 900, 1500], 96)).toBe(-1) // none passed yet: none is marked
    expect(currentSection([-400, 40, 700], 96)).toBe(1)
    expect(currentSection([-900, -300, -10], 96)).toBe(2)
    expect(currentSection([undefined, 50, 700], 96)).toBe(1)
  })

  it('marks the section in view with aria-current="location"', () => {
    for (const [id, top] of [['signature', -200], ['optional-fields', 40], ['props', 800]] as const) {
      const h = document.createElement('h2')
      h.id = id
      h.getBoundingClientRect = () => ({ top, bottom: top + 30, left: 0, right: 0, width: 0, height: 30, x: 0, y: top, toJSON: () => ({}) })
      document.body.appendChild(h)
    }
    render(el(TableOfContentsBlock, 'table-of-contents', { title: 'On This Page', items: ITEMS }))
    expect(screen.getByRole('link', { name: 'Optional fields' }).getAttribute('aria-current')).toBe('location')
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(1)
    document.querySelectorAll('h2').forEach((h) => h.remove())
  })
})

describe('back-to-top', () => {
  it('hidden and out of the tab order until the page has scrolled past showAfter', () => {
    expect(backToTopShown(0, 400)).toBe(false)
    expect(backToTopShown(401, 400)).toBe(true)
    expect(backToTopShown(500, undefined)).toBe(true)
    expect(backToTopShown(100, 50)).toBe(true)
    render(el(BackToTopBlock, 'back-to-top', { label: 'Scroll to top' }))
    const button = document.querySelector('[data-pw-back-to-top]') as HTMLButtonElement
    expect(button.getAttribute('aria-hidden')).toBe('true')
    expect(button.tabIndex).toBe(-1)
    expect(button.style.opacity).toBe('0')
  })

  it('once scrolled it shows, named by its label, and goes to the top', () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true })
    render(el(BackToTopBlock, 'back-to-top', {}, { 'ui.backToTop': 'Back to top' }))
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    const button = screen.getByRole('button', { name: 'Back to top' })
    expect(button.style.opacity).toBe('1')
    fireEvent.click(button)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })
})

describe('table-of-contents: unsafe addresses', () => {
  it('an item whose href is a script address is dropped', () => {
    render(el(TableOfContentsBlock, 'table-of-contents', { title: 'T', items: [{ label: 'Bad', href: 'javascript:alert(1)' }, { label: 'Good', href: '#good' }] }))
    expect([...document.querySelectorAll('#b a')].map((a) => a.getAttribute('href'))).toEqual(['#good'])
  })
})
