/**
 * Overlays, icons and disclosure — the shared defects of the second audit.
 *
 *   modal: closed = no h2, out of the a11y tree; trigger variant; focus goes
 *          back to whatever opened it (its trigger, or a page button through state)
 *   icon: decorative = aria-hidden with no name; labelled = role img
 *   accordion: no text glyph in the button's name; body size
 *   announcement-bar: the dismiss button has a phone hit area
 *   dropdown: Esc closes and returns focus to the button
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup, fireEvent, act, screen } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ModalBlock } from '../atoms/blocks/overlay/modal/component.js'
import { IconBlock } from '../atoms/blocks/control/icon/component.js'
import { AccordionBlock } from '../atoms/blocks/container/accordion/component.js'
import { AnnouncementBarBlock } from '../atoms/blocks/layout/announcement-bar/component.js'
import { DropdownBlock } from '../atoms/blocks/control/dropdown/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

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

function mount(tree: React.ReactNode) {
  return render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => undefined}>
      {tree}
    </BehaviorSurfaceProvider>,
  )
}

describe('modal', () => {
  it('closed: no h2 in the outline, the overlay is aria-hidden', () => {
    const { container } = mount(el(ModalBlock, 'm', 'modal', { title: 'Roll the key' }, <p>Body</p>))
    expect(container.querySelector('h2')).toBeNull()
    const overlay = container.querySelector('[role="dialog"]')!.parentElement!
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Roll the key' }))
    expect(container.querySelector('h2')?.textContent).toBe('Roll the key')
    expect(overlay.getAttribute('aria-hidden')).toBeNull()
  })

  it('the trigger takes a variant', () => {
    mount(el(ModalBlock, 'm', 'modal', { title: 'Details', triggerVariant: 'outline' }))
    const trigger = screen.getByRole('button', { name: 'Details' })
    expect(trigger.style.backgroundColor).toBe('transparent')
    expect(trigger.style.color).toContain('--pw-color-primary-ink')
  })

  it('Esc returns focus to its own trigger', () => {
    mount(el(ModalBlock, 'm', 'modal', { title: 'Details' }, <input aria-label="Field" />))
    const trigger = screen.getByRole('button', { name: 'Details' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByLabelText('Field'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)
  })

  it('opened from state by a page button: Esc returns focus to that button', () => {
    function Page() {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Search
          </button>
          {el(ModalBlock, 'm', 'modal', { title: 'Search', open, stateKey: 'searchOpen' }, <input aria-label="Query" />)}
        </>
      )
    }
    mount(<Page />)
    const opener = screen.getByRole('button', { name: 'Search' })
    opener.focus()
    act(() => {
      fireEvent.click(opener)
    })
    expect(document.activeElement).toBe(screen.getByLabelText('Query'))
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(document.activeElement).toBe(opener)
  })
})

describe('icon', () => {
  it('decorative: aria-hidden, no aria-label', () => {
    const { container } = render(el(IconBlock, 'i', 'icon', { name: 'check' }))
    const span = container.querySelector('[data-block-type="icon"]')!
    expect(span.getAttribute('aria-hidden')).toBe('true')
    expect(span.hasAttribute('aria-label')).toBe(false)
    expect(span.hasAttribute('role')).toBe(false)
  })
  it('meaningful: role img with its label', () => {
    render(el(IconBlock, 'i', 'icon', { name: 'alert-triangle', label: 'Warning' }))
    const img = screen.getByRole('img', { name: 'Warning' })
    expect(img.getAttribute('aria-hidden')).toBeNull()
  })
})

describe('accordion', () => {
  it('the button is named by its question only, at the body size', () => {
    render(el(AccordionBlock, 'a', 'accordion', { items: [{ id: 'q', title: 'Can I cancel?', content: 'Yes.' }] }))
    const btn = screen.getByRole('button', { name: 'Can I cancel?' })
    expect(btn.textContent).toBe('Can I cancel?')
    expect(btn.style.fontSize).toBe('var(--pw-font-size-base)')
    expect(btn.querySelector('svg')).not.toBeNull()
  })
})

describe('announcement-bar', () => {
  it('the dismiss button carries the phone hit area', () => {
    const { container } = mount(el(AnnouncementBarBlock, 'b', 'announcement-bar', { message: 'Hello', dismissible: true }))
    const btn = screen.getByRole('button', { name: 'Dismiss announcement' })
    expect(btn.hasAttribute('data-pw-hit')).toBe(true)
    expect(container.querySelector('style')?.textContent).toContain('44px')
  })
})

describe('dropdown', () => {
  it('Esc closes the menu and returns focus to its button', () => {
    mount(el(DropdownBlock, 'd', 'dropdown', { trigger: 'Export', items: [{ id: 'csv', label: 'CSV' }] }))
    const trigger = screen.getByRole('button', { name: 'Export' })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const item = screen.getByRole('menuitem', { name: 'CSV' })
    item.focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })
})
