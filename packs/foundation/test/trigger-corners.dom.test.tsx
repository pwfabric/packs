/**
 * The drawer and popover triggers are buttons, so they read the button corner
 * token (`--pw-button-radius`, then the theme corner), like control.button.
 * A theme without the token is unchanged.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { DrawerBlock } from '../atoms/blocks/overlay/drawer/component.js'
import { PopoverBlock } from '../atoms/blocks/overlay/popover/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function trigger(C: unknown, type: string, props: Record<string, unknown>): HTMLElement {
  const Comp = C as AnyBlock
  const c = render(
    <BehaviorSurfaceProvider surfaceId="t">
      <Comp props={applied(type, props)} block={{ id: 'b', type, props, layout: {} }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>,
  ).container
  return Array.from(c.querySelectorAll('button')).find((b) => b.textContent === props.triggerLabel) as HTMLElement
}

describe('trigger corner token', () => {
  it('drawer trigger', () => {
    expect(trigger(DrawerBlock, 'drawer', { triggerLabel: 'Open' }).style.borderRadius).toBe('var(--pw-button-radius, var(--pw-border-radius, 6px))')
  })
  it('popover trigger', () => {
    expect(trigger(PopoverBlock, 'popover', { triggerLabel: 'Info', content: 'x' }).style.borderRadius).toBe('var(--pw-button-radius, var(--pw-border-radius, 8px))')
  })
})
