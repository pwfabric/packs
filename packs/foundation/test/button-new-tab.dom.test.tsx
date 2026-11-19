/**
 * A button with an address is a LINK in the button's look.
 *
 * `control.button` navigated with `window.location.href` from a <button>, so an
 * external address replaced the app in the same tab, the browser offered no
 * "open in new tab", and a screen reader announced a button. Now a button with
 * an `href` renders `<a href>`: unset `target`, an external absolute http(s)
 * address opens in a new tab (noopener noreferrer), everything else stays. A
 * button without an address (or disabled) stays a `<button>` whose click is
 * emitted for its behaviours.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import * as React from 'react'
import { render, cleanup, fireEvent, createEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ButtonBlock } from '../atoms/blocks/control/button/component.js'
import { checkPropValue } from '@pwfabric/contracts'
import manifest from '../atoms/blocks/control/button/manifest.json'
import { applied } from '../../../tools/test-support/applied-props.js'

type AnyBlock = React.FC<Record<string, unknown>>
const realLocation = window.location

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: 'http://localhost:3000/', origin: 'http://localhost:3000' },
  })
})
afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

function mount(props: Record<string, unknown>, mode = 'live') {
  const Comp = ButtonBlock as unknown as AnyBlock
  const p = { label: 'Go', ...props }
  const block = { id: 'b', type: 'button', props: p, layout: {} }
  return render(
    <BehaviorSurfaceProvider surfaceId="t">
      <Comp props={applied(block.type, p)} block={block} context={{ interactionMode: mode }} />
    </BehaviorSurfaceProvider>,
  )
}
const anchor = (props: Record<string, unknown>, mode = 'live') => mount(props, mode).container.querySelector('a')

describe('button with href renders a link', () => {
  it('renders <a href> with the button look, no <button>', () => {
    const { container } = mount({ href: '/pricing' })
    const a = container.querySelector('a')!
    expect(a).not.toBeNull()
    expect(container.querySelector('button')).toBeNull()
    expect(a.getAttribute('href')).toBe('/pricing')
    expect(a.getAttribute('data-block-type')).toBe('button')
    expect(a.style.display).toBe('inline-flex')
    expect(a.style.textDecoration).toBe('none')
    expect(a.hasAttribute('data-pw-btn-touch')).toBe(true)
  })

  it('an external https address opens in a new tab with noopener noreferrer', () => {
    const a = anchor({ href: 'https://example.com' })!
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('a relative address, #, a query, mailto: and tel: stay in this tab', () => {
    for (const href of ['/pricing', '#top', '?a=1', './x', 'mailto:a@b.co', 'tel:+902125550000']) {
      const a = anchor({ href })!
      expect(a.getAttribute('href')).toBe(href)
      expect(a.hasAttribute('target')).toBe(false)
      cleanup()
    }
  })

  it('a same-origin absolute address stays in this tab', () => {
    expect(anchor({ href: 'http://localhost:3000/pricing' })!.hasAttribute('target')).toBe(false)
  })

  it('target _self keeps an external address in this tab; _blank opens an internal one in a new tab', () => {
    expect(anchor({ href: 'https://example.com', target: '_self' })!.hasAttribute('target')).toBe(false)
    cleanup()
    expect(anchor({ href: '/pricing', target: '_blank' })!.getAttribute('target')).toBe('_blank')
  })

  it('inert mode cancels the navigation', () => {
    const a = anchor({ href: 'https://example.com' }, 'inert')!
    const ev = createEvent.click(a)
    fireEvent(a, ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('live mode leaves the navigation to the browser', () => {
    const a = anchor({ href: '/pricing' })!
    let prevented: boolean | undefined
    // Read the verdict after the block's handler, then stop jsdom navigating.
    const spy = (e: Event) => { prevented = e.defaultPrevented; e.preventDefault() }
    window.addEventListener('click', spy)
    fireEvent.click(a)
    window.removeEventListener('click', spy)
    expect(prevented).toBe(false)
  })

  it('an unsafe address is no link: a <button>', () => {
    const { container } = mount({ href: 'javascript:alert(1)' })
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('button')).not.toBeNull()
  })

  it('a disabled button with an address stays a disabled <button>', () => {
    const { container } = mount({ href: '/pricing', disabled: true })
    expect(container.querySelector('a')).toBeNull()
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('a button without href stays a <button type=button> and emits its click', () => {
    const seen: string[] = []
    const Comp = ButtonBlock as unknown as AnyBlock
    const p = { label: 'Save' }
    const { container } = render(
      <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => seen.push((e as { type: string }).type)}>
        <Comp props={applied('button', p)} block={{ id: 'b', type: 'button', props: p, layout: {} }} context={{ interactionMode: 'live' }} />
      </BehaviorSurfaceProvider>,
    )
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('type')).toBe('button')
    fireEvent.click(btn)
    expect(seen).toContain('block:click')
  })

  it('target is declared in the manifest, _blank and _self only', () => {
    const props = (manifest as { definition: { props: { name: string; jsonSchema?: Record<string, unknown> }[] } }).definition.props
    const target = props.find((p) => p.name === 'target')
    expect(target).toBeDefined()
    expect(checkPropValue('_blank', target!.jsonSchema, 'target')).toEqual([])
    expect(checkPropValue('_top', target!.jsonSchema, 'target')).not.toEqual([])
  })
})
