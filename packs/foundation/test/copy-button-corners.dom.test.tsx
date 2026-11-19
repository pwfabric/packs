/**
 * The copy button reads the button corner token (`--pw-button-radius`, then
 * the theme corner), like control.button.
 */
import { it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { CopyButtonBlock } from '../atoms/blocks/control/copy-button/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>

it('copy button reads --pw-button-radius', () => {
  const Comp = CopyButtonBlock as unknown as AnyBlock
  const props = { text: 'npm i', label: 'Copy' }
  const c = render(
    <BehaviorSurfaceProvider surfaceId="t">
      <Comp props={applied('copy-button', props)} block={{ id: 'c', type: 'copy-button', props, layout: {} }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>,
  ).container
  const b = c.querySelector('button') as HTMLElement
  expect(b.style.borderRadius).toBe('var(--pw-button-radius, var(--pw-border-radius, 8px))')
})
