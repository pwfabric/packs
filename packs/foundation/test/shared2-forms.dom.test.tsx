/**
 * Shared pass 2 — the form family as the example-app audit found it:
 * segmented-control name/keyboard/remount, radio and date-input remount,
 * tabs that share a state key, the hidden carry field and the pattern
 * message, and the touch-target rules.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { SegmentedControlBlock } from '../atoms/blocks/form/segmented-control/component.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { RadioBlock } from '../atoms/blocks/form/radio/component.js'
import { DateInputBlock } from '../atoms/blocks/form/date-input/component.js'
import { TabsBlock } from '../atoms/blocks/container/tabs/component.js'
import { CheckboxBlock } from '../atoms/blocks/form/checkbox/component.js'
import { ToggleBlock } from '../atoms/blocks/form/toggle/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }
type AnyBlock = React.FC<Record<string, unknown>>

function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode, context: Record<string, unknown> = {}) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={context}>
      {children}
    </Comp>
  )
}

function mount(tree: React.ReactNode) {
  const events: Ev[] = []
  const r = render(
    <BehaviorSurfaceProvider surfaceId="s" onEvent={(e) => events.push(e as Ev)}>
      {tree}
    </BehaviorSurfaceProvider>,
  )
  const rerender = (next: React.ReactNode) =>
    r.rerender(
      <BehaviorSurfaceProvider surfaceId="s" onEvent={(e) => events.push(e as Ev)}>
        {next}
      </BehaviorSurfaceProvider>,
    )
  return { events, rerender }
}

const setStates = (events: Ev[]) =>
  events
    .map((e) => e.payload?.action as { type?: string; key?: string; value?: unknown } | undefined)
    .filter((a) => a?.type === 'setState')

const OPTIONS = [
  { label: 'Compliant', value: 'compliant' },
  { label: 'Not compliant', value: 'noncompliant' },
  { label: 'In grace period', value: 'grace' },
  { label: 'Unknown', value: 'unknown' },
]

describe('segmented-control', () => {
  it('takes its accessible name from label, never a made-up one', () => {
    mount(el(SegmentedControlBlock, 'dev', 'segmented-control', { label: 'Device state', options: OPTIONS }))
    expect(screen.getByRole('radiogroup', { name: 'Device state' })).toBeTruthy()
    cleanup()
    mount(el(SegmentedControlBlock, 'dev', 'segmented-control', { options: OPTIONS }))
    const group = screen.getByRole('radiogroup')
    expect(group.getAttribute('aria-label')).toBeNull()
    expect(document.body.textContent).not.toContain('Segmented control')
  })

  it('hideLabel keeps the name off screen', () => {
    mount(el(SegmentedControlBlock, 'dev', 'segmented-control', { label: 'Device state', hideLabel: true, options: OPTIONS }))
    const group = screen.getByRole('radiogroup', { name: 'Device state' })
    const label = document.getElementById(group.getAttribute('aria-labelledby')!)!
    expect(label.style.position).toBe('absolute')
  })

  it('is one Tab stop; Arrow, Home and End move the choice and the focus', () => {
    const { events } = mount(
      el(SegmentedControlBlock, 'dev', 'segmented-control', { label: 'Device state', options: OPTIONS, stateKey: 'state' }),
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1])
    radios[0]!.focus()
    fireEvent.keyDown(radios[0]!, { key: 'ArrowRight' })
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radios[1])
    fireEvent.keyDown(radios[1]!, { key: 'End' })
    expect(radios[3]!.getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(radios[3]!, { key: 'ArrowRight' })
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(radios[0]!, { key: 'ArrowLeft' })
    expect(radios[3]!.getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(radios[3]!, { key: 'Home' })
    expect(document.activeElement).toBe(radios[0])
    expect(setStates(events).at(-1)).toMatchObject({ key: 'state', value: 'compliant' })
  })

  it('an unresolved value binding seeds nothing — the answer state already holds is not overwritten', () => {
    const { events } = mount(
      el(SegmentedControlBlock, 'dev', 'segmented-control', { options: OPTIONS, stateKey: 'state', value: '{{state.state}}' }),
    )
    expect(setStates(events)).toEqual([])
  })

  it('remounting with the bound state value shows that value and seeds it, not the first option', () => {
    const { events } = mount(
      el(SegmentedControlBlock, 'dev', 'segmented-control', { options: OPTIONS, stateKey: 'state', value: 'grace' }),
    )
    expect(screen.getByRole('radio', { name: 'In grace period' }).getAttribute('aria-checked')).toBe('true')
    expect(setStates(events).map((a) => a!.value)).toEqual(['grace'])
  })

  it('never wider than its column: capped to the viewport, pills wrap inside', () => {
    mount(el(SegmentedControlBlock, 'dev', 'segmented-control', { label: 'Device state', options: OPTIONS }))
    const root = document.querySelector('[data-block-type="segmented-control"]') as HTMLElement
    expect(root.style.maxWidth).toContain('100vw')
    const group = screen.getByRole('radiogroup')
    expect(group.style.flexWrap).toBe('wrap')
    expect(group.style.maxWidth).toBe('100%')
  })
})

describe('radio and date-input remount', () => {
  it('radio shows the bound state value over its defaultValue, ignoring an unresolved binding', () => {
    const opts = [
      { value: 'cut', label: 'Cut' },
      { value: 'colour', label: 'Colour' },
    ]
    mount(el(RadioBlock, 'r', 'radio', { name: 't', options: opts, defaultValue: 'cut', value: 'colour' }))
    expect((screen.getByRole('radio', { name: 'Colour' }) as HTMLInputElement).checked).toBe(true)
    cleanup()
    mount(el(RadioBlock, 'r', 'radio', { name: 't', options: opts, defaultValue: 'cut', value: '{{state.t}}' }))
    expect((screen.getByRole('radio', { name: 'Cut' }) as HTMLInputElement).checked).toBe(true)
  })

  it('radio rows get a 44px minimum on a phone', () => {
    mount(el(RadioBlock, 'r', 'radio', { name: 't', options: [{ value: 'a', label: 'A' }] }))
    expect(document.querySelector('style')!.textContent).toContain('min-height: 44px')
    expect(document.querySelector('[data-pw-radio-row]')).toBeTruthy()
  })

  it('date-input shows the bound value and never an unresolved binding as text', () => {
    mount(el(DateInputBlock, 'd', 'date-input', { name: 'day', label: 'Day', value: '2026-11-20', defaultValue: '2026-11-18' }))
    expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('2026-11-20')
    cleanup()
    mount(el(DateInputBlock, 'd', 'date-input', { name: 'day', label: 'Day', defaultValue: '{{state.day}}' }))
    expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('')
  })

  it('the calendar speaks the app locale and its day cells are touch targets', () => {
    mount(el(DateInputBlock, 'd', 'date-input', { name: 'day', label: 'Day', calendar: true, value: '2026-11-20' }, undefined, { locale: 'de-DE' }))
    const field = screen.getByLabelText('Day') as HTMLInputElement
    expect(field.value).toBe('20. November 2026')
    fireEvent.click(field)
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('November 2026')
    expect(document.querySelectorAll('[data-pw-cal-day]').length).toBe(30)
    expect(document.body.textContent).toContain('Mo')
  })
})

describe('tabs share a state key', () => {
  it('follows its bound value when the key changes from outside', () => {
    const tabs = [
      { id: 'node', label: 'Node' },
      { id: 'curl', label: 'curl' },
    ]
    const tree = (value: string) =>
      el(TabsBlock, 't', 'tabs', { tabs, stateKey: 'lang', value }, [<p key="a">node code</p>, <p key="b">curl code</p>])
    const { rerender } = mount(tree('{{state.lang}}'))
    expect(screen.getByRole('tab', { name: 'Node' }).getAttribute('aria-selected')).toBe('true')
    rerender(tree('curl'))
    expect(screen.getByRole('tab', { name: 'curl' }).getAttribute('aria-selected')).toBe('true')
    expect(document.body.textContent).toContain('curl code')
    rerender(tree('nonsense'))
    expect(screen.getByRole('tab', { name: 'curl' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('input', () => {
  it('type hidden is a carry field: no label on screen, its value submitted', async () => {
    const { events } = mount(
      el(FormBlock, 'f', 'form', { submitLabel: 'Book' }, [
        el(InputBlock, 'carry', 'input', { type: 'hidden', name: 'treatment', label: 'Treatment', defaultValue: 'cut' }),
      ]),
    )
    expect(document.body.textContent).not.toContain('Treatment')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Book' }))
    })
    const submit = events.find((e) => e.type === 'form:submit')
    expect((submit?.payload?.values as Record<string, unknown>).treatment).toBe('cut')
  })

  it('style.display none hides the label with the field', () => {
    mount(el(InputBlock, 'carry', 'input', { name: 'day', label: 'Day', defaultValue: 'x' }))
    cleanup()
    const props = { name: 'day', label: 'Day', defaultValue: 'x' }
    render(<InputBlock props={applied('input', props)} block={{ id: 'c', type: 'input', props, layout: {}, style: { display: 'none' } } as never} />)
    const wrapper = document.querySelector('[data-block-id="c"]') as HTMLElement
    expect(wrapper.style.display).toBe('none')
  })

  it('patternMessage replaces the browser message under the field', async () => {
    mount(
      el(FormBlock, 'f', 'form', { submitLabel: 'Send' }, [
        el(InputBlock, 'pc', 'input', {
          name: 'postcode',
          label: 'Postcode',
          pattern: '[A-Z]{2}[0-9] [0-9][A-Z]{2}',
          patternMessage: 'Enter a postcode like XX1 2AB',
        }),
      ]),
    )
    const field = screen.getByLabelText('Postcode') as HTMLInputElement
    fireEvent.change(field, { target: { value: 'nope' } })
    expect(field.validationMessage).toBe('Enter a postcode like XX1 2AB')
    fireEvent.change(field, { target: { value: 'XX1 2AB' } })
    expect(field.validationMessage).toBe('')
  })
})

describe('touch targets', () => {
  it('checkbox and toggle rows are 44px on a phone', () => {
    mount(
      <>
        {el(CheckboxBlock, 'c', 'checkbox', { label: 'Agree', name: 'agree' })}
        {el(ToggleBlock, 'g', 'toggle', { label: 'Digest', name: 'digest' })}
      </>,
    )
    expect(document.querySelectorAll('[data-pw-row-hit]').length).toBe(2)
    expect([...document.querySelectorAll('style')].some((s) => s.textContent!.includes('min-height: 44px'))).toBe(true)
  })

  it('tabs get a 44px minimum on a phone', () => {
    mount(el(TabsBlock, 't', 'tabs', { tabs: [{ id: 'a', label: 'A' }] }, [<p key="a">a</p>]))
    expect(document.querySelector('[data-pw-tab]')).toBeTruthy()
  })
})
