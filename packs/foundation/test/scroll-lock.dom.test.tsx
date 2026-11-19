/**
 * The body scroll lock is ref-counted and shared (payments-api-docs blocker):
 * a palette result that navigated left `body.style.overflow = "hidden"` and
 * the next page could not scroll until a reload.
 *
 *   - a modal unmounted while open releases its lock
 *   - two overlays closing out of order restore the page's own overflow
 *   - the overlay-dismiss event closes the modal (and so releases the lock)
 *   - a lock whose overlay has left the document is dropped on a route change
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import * as React from 'react'
import { render, cleanup, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ModalBlock } from '../atoms/blocks/overlay/modal/component.js'
import { DrawerBlock } from '../atoms/blocks/overlay/drawer/component.js'
import { lockBodyScroll, OVERLAY_DISMISS_EVENT } from '../atoms/lib/_shared-utils.js'
import { applied } from '../../../tools/test-support/applied-props.js'

type AnyBlock = React.FC<Record<string, unknown>>
const LIVE = { interactionMode: 'live' }

function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={LIVE}>
      {children}
    </Comp>
  )
}

const wrap = (tree: React.ReactNode) => (
  <BehaviorSurfaceProvider surfaceId="t" onEvent={() => undefined}>
    {tree}
  </BehaviorSurfaceProvider>
)

beforeEach(() => {
  document.body.style.overflow = 'auto'
})
afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('body scroll lock', () => {
  it('a modal unmounted while open releases the lock', () => {
    const r = render(wrap(el(ModalBlock, 'm', 'modal', { title: 'Search', open: true }, <p>x</p>)))
    expect(document.body.style.overflow).toBe('hidden')
    r.unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('closing a bound-open modal releases the lock', () => {
    const r = render(wrap(el(ModalBlock, 'm', 'modal', { title: 'Search', open: true }, <p>x</p>)))
    expect(document.body.style.overflow).toBe('hidden')
    r.rerender(wrap(el(ModalBlock, 'm', 'modal', { title: 'Search', open: false }, <p>x</p>)))
    expect(document.body.style.overflow).toBe('auto')
  })

  it('two overlays closing out of order restore the page overflow, not "hidden"', () => {
    const tree = (modal: boolean, drawer: boolean) =>
      wrap(
        <>
          {el(ModalBlock, 'm', 'modal', { title: 'A', open: modal }, <p>a</p>)}
          {el(ModalBlock, 'm2', 'modal', { title: 'B', open: drawer }, <p>b</p>)}
        </>,
      )
    const r = render(tree(true, false))
    r.rerender(tree(true, true))
    expect(document.body.style.overflow).toBe('hidden')
    r.rerender(tree(false, true)) // the first one closes first
    expect(document.body.style.overflow).toBe('hidden')
    r.rerender(tree(false, false))
    expect(document.body.style.overflow).toBe('auto')
  })

  it('the overlay-dismiss event from inside closes the modal', () => {
    const r = render(wrap(el(ModalBlock, 'm', 'modal', { title: 'Search', open: true }, <button data-testid="in">go</button>)))
    const inside = r.getByTestId('in')
    act(() => {
      inside.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { bubbles: true }))
    })
    expect(r.queryByRole('dialog')?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('a drawer unmounted while open releases the lock', () => {
    const r = render(wrap(el(DrawerBlock, 'd', 'drawer', { title: 'B', defaultOpen: true }, <p>b</p>)))
    expect(document.body.style.overflow).toBe('hidden')
    r.unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('a lock whose overlay left the document is dropped on a route change', () => {
    vi.useFakeTimers()
    try {
      const owner = document.createElement('div')
      document.body.appendChild(owner)
      const release = lockBodyScroll(owner)
      expect(document.body.style.overflow).toBe('hidden')
      owner.remove() // the old page was replaced without its cleanup running
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      vi.advanceTimersByTime(60)
      expect(document.body.style.overflow).toBe('auto')
      release() // a late release changes nothing
      expect(document.body.style.overflow).toBe('auto')
    } finally {
      vi.useRealTimers()
    }
  })
})
