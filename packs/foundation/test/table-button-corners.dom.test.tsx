/**
 * A table's button cell is a button: it reads the button corner token
 * (`--pw-button-radius`, then the theme corner), like control.button. Badge
 * cells keep the theme corner.
 */
import { it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TableBlock } from '../atoms/blocks/data/table/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>

it('table button cell reads --pw-button-radius; the badge cell does not', () => {
  const Comp = TableBlock as unknown as AnyBlock
  const props = {
    columns: [
      { key: 'x', header: '', type: 'button', buttonLabel: 'Delete' },
      { key: 'status', header: 'Status', type: 'badge' },
    ],
    data: [{ x: 1, status: 'Open' }],
  }
  const c = render(
    <BehaviorSurfaceProvider surfaceId="t">
      <Comp props={applied('table', props)} block={{ id: 't', type: 'table', props, layout: {} }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>,
  ).container
  const button = Array.from(c.querySelectorAll('button')).find((b) => b.textContent === 'Delete') as HTMLElement
  expect(button.style.borderRadius).toBe('var(--pw-button-radius, var(--pw-border-radius))')
  const badge = Array.from(c.querySelectorAll('span')).find((s) => s.textContent === 'Open') as HTMLElement
  expect(badge.style.borderRadius).not.toContain('--pw-button-radius')
})
