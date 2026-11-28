/**
 * The link's icon is drawn beside its text, not instead of it.
 *
 * `control.link` used to render `icon ? <svg/> : text`, so a
 * `tel:` link with icon "phone" showed only a 16px glyph — the number was
 * invisible and the anchor had no accessible name. The manifest has always
 * said the icon is "drawn beside the text". The icon now sits before the text
 * (aria-hidden), and the name is the visible text, or `ariaLabel` if given.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { LinkBlock } from '../atoms/blocks/control/link/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
const LIVE = { interactionMode: 'live' }

function mount(props: Record<string, unknown>): HTMLElement {
  const Comp = LinkBlock as unknown as AnyBlock
  const block = { id: 'b', type: 'link', props, layout: {} }
  return render(
    <BehaviorSurfaceProvider surfaceId="t">
      <Comp props={applied(block.type, props)} block={block} context={LIVE} />
    </BehaviorSurfaceProvider>,
  ).container
}

describe('link icon beside the text', () => {
  it('a tel: link with an icon shows the icon AND the number', () => {
    const c = mount({ href: 'tel:+902125550000', text: '+90 212 555 00 00', icon: 'phone' })
    const a = c.querySelector('a')!
    expect(a).not.toBeNull()
    expect(a.querySelector('svg')).not.toBeNull()
    expect(a.textContent).toBe('+90 212 555 00 00')
    // icon first, then the text
    expect(a.firstChild?.nodeName.toLowerCase()).toBe('svg')
    expect(a.style.display).toBe('inline-flex')
    expect(a.style.gap).not.toBe('')
  })

  it('the icon is decoration; the accessible name is the text', () => {
    const c = mount({ href: 'tel:+902125550000', text: '+90 212 555 00 00', icon: 'phone' })
    const a = c.querySelector('a')!
    expect(a.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    // no aria-label overriding the visible text
    expect(a.getAttribute('aria-label')).toBeNull()
  })

  it('ariaLabel wins when the author gives one', () => {
    const c = mount({ href: 'tel:+902125550000', text: '+90 212 555 00 00', icon: 'phone', ariaLabel: 'Call us' })
    expect(c.querySelector('a')!.getAttribute('aria-label')).toBe('Call us')
  })

  it('icon-only link (no text) is still named', () => {
    const c = mount({ href: 'tel:+902125550000', icon: 'phone' })
    const a = c.querySelector('a')!
    expect(a.querySelector('svg')).not.toBeNull()
    expect(a.getAttribute('aria-label')).toBe('phone')
  })

  it('a target-less link with an icon is a label that also keeps both', () => {
    const c = mount({ text: 'Support', icon: 'phone' })
    const span = c.querySelector('span[data-block-type="link"]')!
    expect(span.querySelector('svg')).not.toBeNull()
    expect(span.textContent).toBe('Support')
  })

  it('without an icon the link draws its text as before (guard)', () => {
    const c = mount({ href: '/help', text: 'Help' })
    const a = c.querySelector('a')!
    expect(a.textContent).toBe('Help')
    expect(a.querySelector('svg')).toBeNull()
    expect(a.style.display).toBe('')
  })

  it('no text and no icon renders nothing (guard)', () => {
    const c = mount({ href: '/help' })
    expect(c.querySelector('a')).toBeNull()
  })
})

describe('link fontWeight', () => {
  it('each weight name is drawn as its CSS number (semibold is not CSS)', () => {
    const weights: Record<string, string> = { normal: '400', medium: '500', semibold: '600', bold: '700' }
    for (const [name, css] of Object.entries(weights)) {
      const a = mount({ href: '/x', text: name, fontWeight: name }).querySelector('a') as HTMLAnchorElement
      expect(a.style.fontWeight).toBe(css)
      cleanup()
    }
    const plain = mount({ href: '/x', text: 'plain' }).querySelector('a') as HTMLAnchorElement
    expect(plain.style.fontWeight).toBe('')
  })
})
