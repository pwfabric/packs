/**
 * The form family in a browser, built from a model-generated multi-step
 * invitation RSVP form:
 *
 *   form{showSubmit:"{{state.step == 3}}"}
 *     section step-1  input name (required), input email (required)
 *     section step-2  segmented-control attending {value:"true", Yes/No, stateKey}
 *                     input partySize (required), select menuChoice (required),
 *                     input note (required by the model — the brief calls it optional)
 *     section step-3  summary + submit
 *
 * A hidden step inside a form stays mounted with `display: none` on its block
 * wrapper. The wrappers below are exactly that.
 *
 * Radio and number-stepper write page state.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { SegmentedControlBlock } from '../atoms/blocks/form/segmented-control/component.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { SelectBlock } from '../atoms/blocks/form/select/component.js'
import { RadioBlock } from '../atoms/blocks/form/radio/component.js'
import { NumberStepperBlock } from '../atoms/blocks/form/number-stepper/component.js'
import { TextareaBlock } from '../atoms/blocks/form/textarea/component.js'
import { TextBlock } from '../atoms/blocks/text/text/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }
type AnyBlock = React.FC<Record<string, unknown>>

/** Render a block component the way the runtime does: props + its block. */
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }}>
      {children}
    </Comp>
  )
}

/** The runtime's block wrapper; `hidden` is how a hidden in-form step renders. */
const wrap = (id: string, hidden: boolean, children: React.ReactNode) => (
  <div key={id} data-block-wrapper={id} style={hidden ? { display: 'none' } : {}}>
    {children}
  </div>
)

function mount(tree: React.ReactNode): Ev[] {
  const events: Ev[] = []
  render(
    <BehaviorSurfaceProvider surfaceId="invitation" onEvent={(e) => events.push(e as Ev)}>
      {tree}
    </BehaviorSurfaceProvider>
  )
  return events
}

const submits = (events: Ev[]) => events.filter((e) => e.type === 'form:submit')
const clickSubmit = async (label = 'Confirm my attendance') => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }))
  })
}

const attending = {
  name: 'attending',
  size: 'md',
  label: 'Are you coming?',
  value: 'true',
  options: [
    { label: 'Yes', value: 'true' },
    { label: 'No', value: '' },
  ],
  stateKey: 'attending',
}

/** The generated RSVP form, standing on step 3 (steps 1 and 2 hidden, still mounted). */
function rsvp(opts: { step: 1 | 2 | 3; noteRequired?: boolean }) {
  const { step } = opts
  return el(FormBlock, 'rsvp-form', 'form', { gap: 20, action: '', method: 'POST', submitLabel: 'Confirm my attendance' }, [
    wrap('step-1', step !== 1, [
      el(InputBlock, 'field-name', 'input', { name: 'name', type: 'text', label: 'Full name', required: true, stateKey: 'name' }),
      el(InputBlock, 'field-email', 'input', { name: 'email', type: 'email', label: 'Email', required: true, stateKey: 'email' }),
    ]),
    wrap('step-2', step !== 2, [
      el(SegmentedControlBlock, 'field-attending', 'segmented-control', attending),
      el(InputBlock, 'field-party-size', 'input', { min: 1, name: 'partySize', type: 'number', label: 'How many people?', required: true, stateKey: 'partySize' }),
      el(SelectBlock, 'field-menu-choice', 'select', {
        name: 'menuChoice',
        label: 'Menu choice',
        required: true,
        stateKey: 'menuChoice',
        placeholder: 'Pick one',
        options: [
          { label: 'Meat', value: 'meat' },
          { label: 'Vegan', value: 'vegan' },
        ],
      }),
      el(InputBlock, 'field-note', 'input', { name: 'note', type: 'text', label: 'Note', required: opts.noteRequired !== false, stateKey: 'note' }),
    ]),
    wrap('step-3', step !== 3, [el(TextBlock, 'summary', 'text', { content: 'Summary' })]),
  ])
}

const fill = (id: string, value: string) => fireEvent.change(document.getElementById(`${id}-field`) as HTMLElement, { target: { value } })
const fillAll = (exceptNote = false) => {
  fill('field-name', 'Alice Smith')
  fill('field-email', 'alice@example.com')
  fill('field-party-size', '2')
  fireEvent.change(document.getElementById('field-menu-choice-select') as HTMLElement, { target: { value: 'vegan' } })
  if (!exceptNote) fill('field-note', 'We are coming')
}


describe('radio and number-stepper write page state', () => {
  const actionOf = (events: Ev[]) =>
    events.filter((e) => e.type === 'input:change').map((e) => e.payload?.action)

  it('radio', async () => {
    const events = mount(
      el(RadioBlock, 'menu', 'radio', { name: 'menu', stateKey: 'menu', options: [{ value: 'meat', label: 'Meat' }, { value: 'vegan', label: 'Vegan' }] })
    )
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Vegan'))
    })
    expect(actionOf(events)).toContainEqual({ type: 'setState', key: 'menu', value: 'vegan' })
  })

  it('number-stepper', async () => {
    const events = mount(el(NumberStepperBlock, 'guests', 'number-stepper', { name: 'guests', label: 'Guests', value: 1, stateKey: 'guests' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase' }))
    })
    expect(actionOf(events)).toContainEqual({ type: 'setState', key: 'guests', value: 2 })
  })

})
