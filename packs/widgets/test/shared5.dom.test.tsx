/**
 * Shared pass 5 (widgets) — a fixed day's clocks, the like button's touch
 * target, and a nameless dropzone in a form.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { WorldClockBlock } from '../atoms/blocks/data/world-clock/component.js'
import { LikeButtonBlock } from '../atoms/blocks/control/like-button/component.js'
import { FileDropzoneBlock, FILE_IN_FORM_WARNING } from '../atoms/blocks/form/file-dropzone/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type AnyBlock = React.FC<Record<string, unknown>>
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, context: Record<string, unknown> = {}) {
  const Comp = C as AnyBlock
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>
  )
}

describe('world-clock: an app whose day is fixed', () => {
  it('`at` shows that moment in each zone from the first render, and the tiles share the row', () => {
    const { container } = render(
      el(
        WorldClockBlock,
        'wc',
        'world-clock',
        {
          at: '2026-11-17T09:05:00Z',
          hour12: false,
          clocks: [
            { label: 'Head office', timezone: 'Europe/London' },
            { label: 'East coast office', timezone: 'America/New_York' },
          ],
        },
        { locale: 'en-GB' }
      )
    )
    expect(container.textContent).toContain('09:05')
    expect(container.textContent).toContain('04:05')
    const tile = screen.getByText('Head office').parentElement as HTMLElement
    expect(tile.style.flex).toBe('1 1 120px')
  })
})

describe('like-button', () => {
  it('is a 44px touch target', () => {
    render(el(LikeButtonBlock, 'like', 'like-button', { label: 'Like' }))
    const b = screen.getByRole('button', { name: /Like/ })
    expect(b.style.minHeight).toBe('44px')
  })
})

describe('file-dropzone', () => {
  it('a dropzone with no name sends nothing, so it does not warn inside a form', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <form>
        {el(FileDropzoneBlock, 'dz', 'file-dropzone', { name: '', label: '' })}
      </form>
    )
    expect(warn.mock.calls.filter((c) => c[0] === FILE_IN_FORM_WARNING).length).toBe(0)
  })
})
