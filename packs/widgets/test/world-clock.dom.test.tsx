/**
 * world-clock: an invalid or missing time zone shows no invented time, and the
 * root carries its block id and type.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { WorldClockBlock } from '../atoms/blocks/data/world-clock/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>

function mount(props: Record<string, unknown>) {
  const Comp = WorldClockBlock as unknown as AnyBlock
  return render(<Comp props={applied('world-clock', props)} block={{ id: 'wc', type: 'world-clock', props, layout: {} }} context={{}} />)
}

describe('data.world-clock', () => {
  it('an invalid time zone shows "—", not the visitor\'s local time', () => {
    const { container } = mount({ clocks: [{ label: 'Atlantis', timezone: 'Not/AZone' }] })
    expect(container.textContent).toContain('—')
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/)
  })

  it('null clocks do not crash', () => {
    expect(() => mount({ clocks: null })).not.toThrow()
  })

  it('no clocks means no invented London clock', () => {
    const { container } = mount({})
    expect(container.textContent).not.toContain('London')
  })

  it('the root carries id, data-block-id and data-block-type', () => {
    const { container } = mount({ clocks: [] })
    const root = container.firstElementChild as HTMLElement
    expect(root.id).toBe('wc')
    expect(root.getAttribute('data-block-id')).toBe('wc')
    expect(root.getAttribute('data-block-type')).toBe('world-clock')
  })
})
