/**
 * Shared pass 5 — the visitor reads the app's words, never the browser's or
 * the pack's: the form's field messages per rule (P-1), the date field's
 * placeholder and calendar names (P-2), the password field's autocomplete
 * (P-4), and the account avatar's initials (P-5).
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { AppMessagesContext, BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { CheckboxBlock } from '../atoms/blocks/form/checkbox/component.js'
import { SelectBlock } from '../atoms/blocks/form/select/component.js'
import { DateInputBlock } from '../atoms/blocks/form/date-input/component.js'
import { OtpInputBlock } from '../atoms/blocks/form/otp-input/component.js'
import { AccountAvatar, accountInitials } from '../atoms/lib/_shared-account-menu.js'
import { SplitViewBlock } from '../atoms/blocks/layout/split-view/component.js'
import { BreadcrumbBlock } from '../atoms/blocks/control/breadcrumb/component.js'
import { SEGMENT_TOUCH_CSS } from '../atoms/blocks/form/segmented-control/component.js'
import { TableBlock } from '../atoms/blocks/data/table/component.js'
import { RepeaterBlock } from '../atoms/blocks/data/repeater/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function node(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', locale: 'en-GB' }}>
      {children}
    </Comp>
  )
}
function mount(tree: React.ReactNode, messages?: Record<string, string>) {
  const inner = (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      {tree}
    </BehaviorSurfaceProvider>
  )
  return render(messages ? <AppMessagesContext.Provider value={messages}>{inner}</AppMessagesContext.Provider> : inner)
}

const WORDS = {
  'ui.form.required': 'Fill in {label}.',
  'ui.form.email': 'Write an e-mail address, like name@example.com.',
  'ui.form.checkbox': 'Tick this to go on.',
  'ui.form.select': 'Pick one of these.',
  'ui.form.min': '{label}: at least {min}.',
  'ui.form.max': '{label}: at most {max}.',
  'ui.form.pattern': 'Use the format shown.',
  'ui.form.hidden': 'Step 1 — {label}: {message}',
}

const errors = () => [...document.querySelectorAll('[data-pw-field-error]')].map((n) => n.textContent)
const submit = () => fireEvent.submit(document.querySelector('form')!)

describe("P-1: the form's field messages are the app's", () => {
  it('names each rule in the app words — required, e-mail, box, select, range', () => {
    mount(
      node(FormBlock, 'f', 'form', { submitLabel: 'Send' }, [
        node(InputBlock, 'name', 'input', { name: 'name', label: 'Your name', required: true }),
        node(InputBlock, 'mail', 'input', { name: 'email', type: 'email', label: 'E-mail', defaultValue: 'not-an-email' }),
        node(InputBlock, 'amt', 'input', { name: 'amount', type: 'number', label: 'Amount', min: 50, max: 900, defaultValue: '10' }),
        node(CheckboxBlock, 'ok', 'checkbox', { name: 'terms', label: 'I agree', required: true }),
        node(SelectBlock, 'size', 'select', { name: 'size', label: 'Size', required: true, placeholder: 'Choose', options: [{ label: 'S', value: 's' }] }),
      ]),
      WORDS,
    )
    submit()
    expect(errors()).toEqual([
      'Fill in Your name.',
      'Write an e-mail address, like name@example.com.',
      'Amount: at least 50.',
      'Tick this to go on.',
      'Pick one of these.',
    ])
    // Not one browser sentence.
    expect(document.body.textContent).not.toMatch(/Please|Constraints not satisfied/)
  })

  it("an input's own patternMessage wins over ui.form.pattern; the message goes once the field is valid", () => {
    mount(
      node(FormBlock, 'f', 'form', {}, [
        node(InputBlock, 'pc', 'input', { name: 'pc', label: 'Postcode', pattern: '[A-Z]{2}[0-9]', patternMessage: 'Like XX1', defaultValue: 'x' }),
        node(InputBlock, 'cd', 'input', { name: 'cd', label: 'Code', pattern: '[0-9]{3}', defaultValue: 'x' }),
      ]),
      WORDS,
    )
    submit()
    expect(errors()).toEqual(['Like XX1', 'Use the format shown.'])
    const cd = document.querySelector('input[name=cd]') as HTMLInputElement
    fireEvent.input(cd, { target: { value: '123' } })
    expect(errors()).toEqual(['Like XX1'])
  })

  it('a field in a hidden step is named in the alert with ui.form.hidden', () => {
    mount(
      node(FormBlock, 'f', 'form', {}, [
        <div key="step" style={{ display: 'none' }}>
          {node(InputBlock, 'name', 'input', { name: 'name', label: 'Your name', required: true })}
        </div>,
      ]),
      WORDS,
    )
    submit()
    expect(screen.getByRole('alert').textContent).toBe('Step 1 — Your name: Fill in Your name.')
  })

  it("an unfinished code reads the app's ui.form.code", () => {
    mount(
      node(FormBlock, 'f', 'form', {}, [node(OtpInputBlock, 'otp', 'otp-input', { name: 'code', label: '6-digit code', length: 6, required: true })]),
      { 'ui.form.code': '{label}: type all {n} figures' },
    )
    submit()
    expect(errors()).toEqual(['6-digit code: type all 6 figures'])
  })
})

describe('P-2: the date field reads its words from the app', () => {
  it('placeholder, calendar arrows and the closed-day message', () => {
    mount(
      node(FormBlock, 'f', 'form', {}, [
        node(DateInputBlock, 'd', 'date-input', { name: 'day', label: 'Day', calendar: true, disabledWeekdays: [0], defaultValue: '2026-11-22' }),
      ]),
      {
        'ui.date.placeholder': 'Choose a day',
        'ui.date.previousMonth': 'Month before',
        'ui.date.nextMonth': 'Month after',
        'ui.date.unavailable': 'We are closed on {day}s.',
      },
    )
    const field = document.querySelector('input[name=day], input[data-pw-date-field], input') as HTMLInputElement
    expect(document.body.innerHTML).not.toContain('Pick a date')
    submit()
    expect(errors()).toEqual(['We are closed on Sundays.'])
    void field
  })
})

describe('P-4: the password field says which password the browser may fill', () => {
  it('current-password when signing in, new-password in a form that registers', async () => {
    mount(
      node(FormBlock, 'f', 'form', { onSubmitAction: { type: 'auth:signIn', method: 'password' } }, [
        node(InputBlock, 'p', 'input', { name: 'password', type: 'password', label: 'Password' }),
        node(InputBlock, 'e', 'input', { name: 'email', type: 'email', label: 'E-mail' }),
      ]),
    )
    expect((document.querySelector('input[name=password]') as HTMLInputElement).autocomplete).toBe('current-password')
    expect((document.querySelector('input[name=email]') as HTMLInputElement).autocomplete).toBe('email')
    cleanup()
    mount(
      node(FormBlock, 'f', 'form', { onSubmitAction: { type: 'auth:register', method: 'password' } }, [
        node(InputBlock, 'p', 'input', { name: 'password', type: 'password', label: 'Password' }),
      ]),
    )
    await act(async () => {})
    expect((document.querySelector('input[name=password]') as HTMLInputElement).autocomplete).toBe('new-password')
  })
})

describe('P-5: account initials', () => {
  it('are at least 12px, and come from the part of an address before the @', () => {
    render(<AccountAvatar account={{ name: 'Dana Lee' }} size={22} />)
    expect((document.querySelector('span[aria-hidden]') as HTMLElement).style.fontSize).toBe('12px')
    expect(accountInitials({ name: 'Dana Lee' })).toBe('DL')
    // No display name, or an address as the name: the neutral glyph, not letters from the address.
    expect(accountInitials({ name: 'stranger@example.com' })).toBe('')
    expect(accountInitials({ email: 'jo.lee@example.com' })).toBe('')
    cleanup()
    render(<AccountAvatar account={{ email: 'jo.lee@example.com' }} size={22} />)
    const face = document.querySelector('span[aria-hidden]') as HTMLElement
    expect(face.textContent).toBe('')
    expect(face.querySelector('svg')).not.toBeNull()
  })
})

describe('layout that holds from the first frame', () => {
  it('split-view is stacked by a container query from its first paint, before it measures itself', () => {
    const { container } = mount(node(SplitViewBlock, 'thread', 'split-view', { items: [{ id: 'a', title: 'Alerts' }], listWidth: 280 }))
    const box = container.querySelector('[data-pw-split-box]') as HTMLElement
    expect(box.style.containerType).toBe('inline-size')
    const css = box.querySelector('style')!.textContent!
    expect(css).toContain('@container (max-width: 559.98px)')
    expect(css).toContain('[data-pw-split-root="thread"]{flex-direction:column!important')
    expect(container.querySelector('[data-pw-split-root="thread"] > [data-pw-split-list]')).not.toBeNull()
  })

  it("the breadcrumb keeps to one line; the record's long title ends in an ellipsis", () => {
    mount(node(BreadcrumbBlock, 'crumb', 'breadcrumb', { items: [{ label: 'Programme', href: '/programme' }, { label: 'A very long session title that would wrap' }] }))
    const ol = document.querySelector('ol') as HTMLElement
    expect(ol.style.flexWrap).toBe('nowrap')
    const last = screen.getByText('A very long session title that would wrap')
    expect(last.style.textOverflow).toBe('ellipsis')
    expect(last.getAttribute('title')).toBe('A very long session title that would wrap')
  })

  it('a segmented pill is at least 44px wide on a phone', () => {
    expect(SEGMENT_TOUCH_CSS).toContain('min-width: 44px')
  })

  it('a table whose columns come from its data still holds its rows while it loads', () => {
    mount(node(TableBlock, 'range', 'table', { columnsFrom: 'data', data: [], loadingWhen: true }))
    const rows = document.querySelectorAll('tbody tr[aria-busy]')
    expect(rows.length).toBe(3)
    expect(rows[0]!.querySelectorAll('td').length).toBe(1)
  })

  it('a repeater given loadingCount and loadingHeight draws that many frames of that height while it loads', () => {
    mount(node(RepeaterBlock, 'cards', 'repeater', { items: [], layout: 'card', columns: 3, loadingWhen: true, loadingCount: 12, loadingHeight: 315 }))
    const frames = document.querySelectorAll('[data-pw-repeater-frame]')
    expect(frames.length).toBe(12)
    expect((frames[0] as HTMLElement).style.height).toBe('315px')
  })
})
