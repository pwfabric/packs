/**
 * Shared pass 2 — world-clock follows the app locale (24-hour for en-GB, no
 * seconds unless asked), and the tag-input remove × is a touch target.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { WorldClockBlock } from '../atoms/blocks/data/world-clock/component.js'
import { TagInputBlock } from '../atoms/blocks/form/tag-input/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>

function clock(props: Record<string, unknown>, locale: string) {
  const Comp = WorldClockBlock as unknown as AnyBlock
  return render(<Comp props={applied('world-clock', props)} block={{ id: 'wc', type: 'world-clock', props, layout: {} }} context={{ locale }} />)
}
const LONDON = [{ label: 'London', timezone: 'Europe/London' }]

describe('data.world-clock locale', () => {
  it('en-GB: 24-hour, hours and minutes only', () => {
    const { container } = clock({ clocks: LONDON }, 'en-GB')
    const time = container.textContent!.replace('London', '')
    expect(time).toMatch(/^\d{2}:\d{2}$/)
  })

  it('en-US: 12-hour with a day period', () => {
    const { container } = clock({ clocks: LONDON }, 'en-US')
    expect(container.textContent).toMatch(/AM|PM/)
  })

  it('hour12 and showSeconds override the locale', () => {
    const { container } = clock({ clocks: LONDON, hour12: true, showSeconds: true }, 'en-GB')
    expect(container.textContent).toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(container.textContent).toMatch(/am|pm/i)
  })
})

describe('form.tag-input touch target', () => {
  it('the remove × carries the 44px hit area', () => {
    const props = { name: 'tags', label: 'Tags', tags: ['Go'] }
    const Comp = TagInputBlock as unknown as AnyBlock
    render(
      <BehaviorSurfaceProvider surfaceId="s" onEvent={() => undefined}>
        <Comp props={applied('tag-input', props)} block={{ id: 't', type: 'tag-input', props, layout: {} }} />
      </BehaviorSurfaceProvider>,
    )
    const remove = document.querySelector('button[aria-label="Remove Go"]')!
    expect(remove.hasAttribute('data-pw-hit')).toBe(true)
    expect(document.querySelector('style')!.textContent).toContain('44px')
  })
})
