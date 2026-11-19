/**
 * split-view: an address naming an id that is not in the list selects NOTHING
 * (round 3.0 finding: it fell back to items[0], so a stale link opened the
 * wrong record and the page could not say the record was not there).
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { SplitViewBlock } from '../atoms/blocks/layout/split-view/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

type AnyBlock = React.FC<Record<string, unknown>>
const records = [
  { id: 'a', title: 'Alice Brown', meta: 'Accounting', body: 'Ext. 204' },
  { id: 'b', title: 'Mark Jones', meta: 'Sales', body: 'Ext. 311' },
]
function mount(props: Record<string, unknown>) {
  const Comp = SplitViewBlock as unknown as AnyBlock
  return render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied('split-view', props)} block={{ id: 'dir', type: 'split-view', props, layout: {} }} />
    </BehaviorSurfaceProvider>
  )
}

describe('split-view: an unknown selection is none', () => {
  it('a known id in the address opens that row', () => {
    window.history.replaceState(null, '', '/?sec=b')
    mount({ items: records, titleLevel: 'h1' })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mark Jones')
  })

  it('an unknown id opens no row and shows the empty label, even with auto-selection on', () => {
    window.history.replaceState(null, '', '/?sec=zzz')
    mount({ items: records, titleLevel: 'h1', emptyLabel: 'That person is not in the directory', autoSelect: true })
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.getByText('That person is not in the directory')).toBeTruthy()
  })

  it('an unknown id with no empty label draws no detail at all, never the first row', () => {
    window.history.replaceState(null, '', '/?sec=zzz')
    mount({ items: records, titleLevel: 'h1' })
    expect(screen.queryByText('Alice Brown', { selector: 'h1' })).toBeNull()
  })

  it('an address that names nothing still auto-selects the first row', () => {
    mount({ items: records, titleLevel: 'h1' })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Alice Brown')
  })
})
