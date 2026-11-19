/**
 * control.chip takes an `action` the way control.button does.
 *
 * A chip had no `action`, so a removable filter chip had to be faked with a
 * pill-shaped button. The chip now declares button's action (same shape, so a
 * composer writes it the same way) and the runtime runs it on the chip's press;
 * a removable chip's × is part of that press.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider, DataBoundSurfaceRenderer } from '@pwfabric/runtime'
import { ChipBlock } from '../atoms/blocks/control/chip/component.js'
import { TextBlock } from '../atoms/blocks/text/text/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const HERE = dirname(fileURLToPath(import.meta.url))
type Prop = { name: string; bindable?: boolean; jsonSchema?: Record<string, unknown> }
const propsOf = (block: string): Prop[] =>
  JSON.parse(readFileSync(join(HERE, '..', 'atoms', 'blocks', 'control', block, 'manifest.json'), 'utf8')).definition.props

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }

describe('chip — action like a button', () => {
  it('declares action with the same schema as button, bindable', () => {
    const chip = propsOf('chip').find((p) => p.name === 'action')
    const button = propsOf('button').find((p) => p.name === 'action')
    expect(chip).toBeTruthy()
    expect(chip?.bindable).not.toBe(false)
    const { description: _d, ...chipSchema } = chip?.jsonSchema ?? {}
    const { description: _b, ...buttonSchema } = button?.jsonSchema ?? {}
    expect(chipSchema).toEqual(buttonSchema)
  })

  it('a press emits exactly one block:click; the × carries removed: true', () => {
    const events: Ev[] = []
    const props = { label: 'Blue', value: 'blue', removable: true }
    render(
      <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
        <ChipBlock
          props={applied('chip', props) as never}
          block={{ id: 'c', type: 'chip', props, layout: {} } as never}
          context={{ interactionMode: 'live' } as never}
        />
      </BehaviorSurfaceProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove Blue' }))
    const clicks = events.filter((e) => e.type === 'block:click')
    expect(clicks).toHaveLength(1)
    expect(clicks[0]?.payload).toMatchObject({ removed: true, value: 'blue' })
  })

  it('the runtime runs the chip action on its press', () => {
    const surface = {
      id: 's',
      blocks: [
        { id: 'c', type: 'chip', props: { label: 'Weekend', action: { type: 'setState', key: 'picked', value: 'weekend' } } },
        { id: 't', type: 'text', props: { content: 'Picked: {{state.picked}}' } },
      ],
      capabilities: [{ capability: 'platform/persistence', config: { initialState: { picked: 'none' } } }],
    }
    render(<DataBoundSurfaceRenderer surface={surface as never} components={{ chip: ChipBlock, text: TextBlock } as never} />)
    expect(screen.getByText('Picked: none')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Weekend' }))
    expect(screen.getByText('Picked: weekend')).toBeTruthy()
  })
})

describe('chip — a status pill is not a button', () => {
  it('no action, not removable, no selection → a span with no button role', () => {
    const props = { label: 'Paid', tone: 'success' }
    const { container } = render(
      <ChipBlock props={applied('chip', props) as never} block={{ id: 'p', type: 'chip', props, layout: {} } as never} context={{ interactionMode: 'live' } as never} />
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('span[data-block-type="chip"]')?.textContent).toBe('Paid')
  })
  it('a chip with an action stays a button with a phone hit area', () => {
    const props = { label: 'Weekend', action: { type: 'setState', key: 'k', value: 'v' } }
    render(<ChipBlock props={applied('chip', props) as never} block={{ id: 'w', type: 'chip', props, layout: {} } as never} context={{ interactionMode: 'live' } as never} />)
    expect(screen.getByRole('button', { name: 'Weekend' }).hasAttribute('data-pw-hit')).toBe(true)
  })
})
