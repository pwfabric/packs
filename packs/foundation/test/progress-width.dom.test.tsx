/**
 * progress: the bar takes the width it is given. With an auto width it shrank
 * to 0 inside a centred column (a 7-day range row) and the track vanished.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { ProgressBlock } from '../atoms/blocks/data/progress/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
const P = ProgressBlock as unknown as AnyBlock

function mount(props: Record<string, unknown>, style?: Record<string, unknown>): HTMLElement {
  const { container } = render(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <P props={applied('progress', props)} block={{ id: 'p', type: 'progress', props, layout: {}, style }} context={{}} />
    </div>,
  )
  return container.querySelector('[data-block-type="progress"]') as HTMLElement
}

describe('progress', () => {
  it('fills its parent and may shrink, so a centred column cannot collapse it', () => {
    const root = mount({ value: 40 })
    expect(root.style.width).toBe('100%')
    expect(['0', '0px']).toContain(root.style.minWidth)
    const fill = root.querySelector('[role="progressbar"] > div') as HTMLElement
    expect(fill.style.width).toBe('40%')
  })
  it('declares fill sizing, so the renderer wrapper takes the line', () => {
    expect((ProgressBlock as unknown as { sizing?: string }).sizing).toBe('fill')
  })
  it('a page style still wins', () => {
    const root = mount({ value: 40 }, { width: '50%' })
    expect(root.style.width).toBe('50%')
  })
})
