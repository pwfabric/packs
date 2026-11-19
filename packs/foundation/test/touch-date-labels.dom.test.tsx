/**
 * Shared pass 3 — what ten re-audits measured on the form family:
 * real 44px boxes on a phone (select, input, date field, form submit/reset,
 * toast Dismiss, checkbox/toggle rows and the switch, segmented pills, the
 * number stepper), the date-input calendar (Esc / outside press from inside the
 * dialog, arrow-key grid, full day names, disabledWeekdays), select/input
 * hideLabel + accessible-name fallback, and file fields left out of a form.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { FormBlock, collectFormValues } from '../atoms/blocks/form/form/component.js'
import { SelectBlock } from '../atoms/blocks/form/select/component.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { DateInputBlock, weekdaySet } from '../atoms/blocks/form/date-input/component.js'
import { CheckboxBlock } from '../atoms/blocks/form/checkbox/component.js'
import { ToggleBlock } from '../atoms/blocks/form/toggle/component.js'
import { SegmentedControlBlock } from '../atoms/blocks/form/segmented-control/component.js'
import { NumberStepperBlock } from '../atoms/blocks/form/number-stepper/component.js'
import { ToastBlock } from '../atoms/blocks/feedback/toast/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
type Ev = { type: string; payload?: Record<string, unknown> }

function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode, locale?: string) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...(locale ? { locale } : {}) }}>
      {children}
    </Comp>
  )
}

function mount(tree: React.ReactNode) {
  const events: Ev[] = []
  render(
    <BehaviorSurfaceProvider surfaceId="s" onEvent={(e) => events.push(e as Ev)}>
      {tree}
    </BehaviorSurfaceProvider>,
  )
  return { events }
}

const css = (): string => [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
/** The phone rule that gives `attr` a 44px box. */
const phoneRule = (attr: string): boolean =>
  new RegExp(`@media \\(max-width: 640px\\), \\(pointer: coarse\\) \\{[^@]*\\[${attr}\\][^}]*(min-height|height): 44px`).test(css())

describe('real 44px boxes on a phone', () => {
  it('select, input, date field', () => {
    mount(
      <>
        {el(SelectBlock, 's', 'select', { label: 'Sort', options: ['A', 'B'] })}
        {el(InputBlock, 'i', 'input', { label: 'Name', name: 'n' })}
        {el(DateInputBlock, 'd', 'date-input', { label: 'Day', name: 'day' })}
        {el(DateInputBlock, 'dc', 'date-input', { label: 'Day', name: 'day2', calendar: true })}
      </>,
    )
    expect(screen.getByLabelText('Sort').hasAttribute('data-pw-select-touch')).toBe(true)
    expect(screen.getByLabelText('Name').hasAttribute('data-pw-input-touch')).toBe(true)
    expect(document.querySelectorAll('[data-pw-date-field]').length).toBe(2)
    for (const a of ['data-pw-select-touch', 'data-pw-input-touch', 'data-pw-date-field']) expect(phoneRule(a)).toBe(true)
  })

  it('the form submit and reset are at least 44px tall everywhere', () => {
    mount(el(FormBlock, 'f', 'form', { submitLabel: 'Save', showReset: true, resetLabel: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Save' }).style.minHeight).toBe('44px')
    expect(screen.getByRole('button', { name: 'Clear' }).style.minHeight).toBe('44px')
  })

  it('toast Dismiss, switch, checkbox row, segmented pills and stepper buttons', () => {
    mount(
      <>
        {el(ToastBlock, 't', 'toast', { message: 'Saved' })}
        {el(ToggleBlock, 'g', 'toggle', { label: 'Digest', size: 'sm' })}
        {el(CheckboxBlock, 'c', 'checkbox', { label: 'Agree' })}
        {el(SegmentedControlBlock, 'sc', 'segmented-control', { label: 'View', options: ['List', 'Grid'] })}
        {el(NumberStepperBlock, 'n', 'number-stepper', { label: 'Guests' })}
      </>,
    )
    expect(screen.getByRole('button', { name: 'Dismiss' }).hasAttribute('data-pw-toast-x')).toBe(true)
    expect(phoneRule('data-pw-toast-x')).toBe(true)
    // The switch is the box; the drawn track sits inside it.
    const sw = screen.getByRole('switch', { name: 'Digest' })
    expect(sw.hasAttribute('data-pw-switch-touch')).toBe(true)
    expect(sw.querySelector('[data-pw-switch-track]')).toBeTruthy()
    expect(phoneRule('data-pw-switch-touch')).toBe(true)
    // The row rule beats the row's own inline minHeight.
    expect(css()).toContain('[data-pw-row-hit] { min-height: 44px !important; }')
    for (const pill of screen.getAllByRole('radio')) expect(pill.hasAttribute('data-pw-seg-touch')).toBe(true)
    expect(phoneRule('data-pw-seg-touch')).toBe(true)
    expect(document.querySelectorAll('[data-pw-step-btn]').length).toBe(2)
    expect(phoneRule('data-pw-step-btn')).toBe(true)
  })
})

describe('select and input: hideLabel and a name without a label', () => {
  it('hideLabel keeps the label as the accessible name, off screen', () => {
    mount(
      <>
        {el(SelectBlock, 's', 'select', { label: 'Sort by', hideLabel: true, options: ['A'] })}
        {el(InputBlock, 'i', 'input', { label: 'Search', hideLabel: true })}
      </>,
    )
    const sel = screen.getByLabelText('Sort by')
    const label = document.querySelector(`label[for="${sel.id}"]`) as HTMLElement
    expect(label.style.position).toBe('absolute')
    expect(label.style.overflow).toBe('hidden')
    const input = screen.getByLabelText('Search')
    expect((document.querySelector(`label[for="${input.id}"]`) as HTMLElement).style.position).toBe('absolute')
  })

  it('no label: named by the placeholder, else by name', () => {
    mount(
      <>
        {el(SelectBlock, 's1', 'select', { placeholder: 'Any department', options: ['A'] })}
        {el(SelectBlock, 's2', 'select', { name: 'region', options: ['A'] })}
        {el(InputBlock, 'i1', 'input', { placeholder: 'Search people' })}
        {el(InputBlock, 'i2', 'input', { name: 'email' })}
      </>,
    )
    expect(screen.getByRole('combobox', { name: 'Any department' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'region' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Search people' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'email' })).toBeTruthy()
  })

  it('a label wins over the fallback (no aria-label)', () => {
    mount(el(SelectBlock, 's', 'select', { label: 'Sort', placeholder: 'Pick', options: ['A'] }))
    expect(screen.getByLabelText('Sort').getAttribute('aria-label')).toBeNull()
  })
})

describe('date-input calendar', () => {
  const open = (locale?: string) => {
    mount(el(DateInputBlock, 'd', 'date-input', { label: 'Day', name: 'day', calendar: true, value: '2026-11-18' }, undefined, locale))
    fireEvent.click(screen.getByLabelText('Day'))
    return screen.getByRole('dialog')
  }

  it('names every day in full and puts the tab stop on the picked day', () => {
    open('en-GB')
    const day = screen.getByRole('button', { name: /^Wednesday,? 18 November 2026$/ })
    expect(day.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(day)
    expect(document.querySelectorAll('[data-pw-cal-day][tabindex="0"]').length).toBe(1)
  })

  it('arrows move a day / a week, Home/End the week, PageDown a month; Enter picks', () => {
    const { events } = (() => {
      const r = mount(el(DateInputBlock, 'd', 'date-input', { label: 'Day', name: 'day', calendar: true, value: '2026-11-18', stateKey: 'day' }))
      fireEvent.click(screen.getByLabelText('Day'))
      return r
    })()
    const focused = () => (document.activeElement as HTMLElement).getAttribute('data-iso')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(focused()).toBe('2026-11-19')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(focused()).toBe('2026-11-26')
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(focused()).toBe('2026-11-23')
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(focused()).toBe('2026-11-29')
    fireEvent.keyDown(document.activeElement!, { key: 'PageDown' })
    expect(focused()).toBe('2026-12-29')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(focused()).toBe('2026-12-28')
    fireEvent.click(document.activeElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByLabelText('Day'))
    const last = events.map((e) => e.payload?.action as { value?: unknown } | undefined).filter(Boolean).pop()
    expect(last?.value).toBe('2026-12-28')
  })

  it('Esc from a day button closes it and returns focus to the field', () => {
    open()
    expect((document.activeElement as HTMLElement).hasAttribute('data-pw-cal-day')).toBe(true)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByLabelText('Day'))
  })

  it('a press outside closes it', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    open()
    fireEvent.pointerDown(outside)
    expect(screen.queryByRole('dialog')).toBeNull()
    outside.remove()
  })

  it('a press inside does not close it', () => {
    const dialog = open()
    fireEvent.pointerDown(dialog)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('date-input disabledWeekdays', () => {
  it('reads numbers, numeric strings and a comma list', () => {
    expect([...weekdaySet([0, '6'])].sort()).toEqual([0, 6])
    expect([...weekdaySet('0, 6')].sort()).toEqual([0, 6])
    expect([...weekdaySet(['x', 9, 1.5])]).toEqual([])
  })

  it('greys Sundays out in the grid: reachable, never pickable', () => {
    const { events } = mount(el(DateInputBlock, 'd', 'date-input', { label: 'Day', calendar: true, value: '2026-11-18', disabledWeekdays: [0], stateKey: 'day' }, undefined, 'en-GB'))
    fireEvent.click(screen.getByLabelText('Day'))
    const sunday = screen.getByRole('button', { name: /^Sunday,? 22 November 2026$/ })
    expect(sunday.getAttribute('aria-disabled')).toBe('true')
    const before = events.length
    fireEvent.click(sunday)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(events.length).toBe(before)
    expect(screen.getByRole('button', { name: /^Monday,? 23 November 2026$/ }).getAttribute('aria-disabled')).toBeNull()
  })

  it('a form refuses a Sunday in either mode', () => {
    mount(
      el(FormBlock, 'f', 'form', { submitLabel: 'Book' }, [
        el(DateInputBlock, 'd1', 'date-input', { label: 'Native', name: 'a', value: '2026-11-22', disabledWeekdays: '0' }),
      ]),
    )
    const form = document.querySelector('form') as HTMLFormElement
    expect(form.checkValidity()).toBe(false)
    cleanup()
    mount(
      el(FormBlock, 'f', 'form', { submitLabel: 'Book' }, [
        el(DateInputBlock, 'd2', 'date-input', { label: 'Cal', name: 'b', calendar: true, value: '2026-11-23', disabledWeekdays: [0] }),
      ]),
    )
    expect((document.querySelector('form') as HTMLFormElement).checkValidity()).toBe(true)
  })
})

describe('a file field with nothing picked sends nothing', () => {
  it('collectFormValues sends no value for an empty file picker', async () => {
    mount(
      el(FormBlock, 'f', 'form', { submitLabel: 'Save' }, [
        el(InputBlock, 'n', 'input', { name: 'title', label: 'Title', defaultValue: 'Hi' }),
      ]),
    )
    const form = document.querySelector('form') as HTMLFormElement
    const file = document.createElement('input')
    file.type = 'file'
    file.name = 'logo'
    form.appendChild(file)
    await act(async () => undefined)
    const values = collectFormValues(form)
    expect(values).toEqual({ title: 'Hi' })
  })
})
