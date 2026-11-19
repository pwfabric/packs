/**
 * Three defects found while rebuilding the example apps:
 *
 * - form.input: the visible label pointed at `block.id`, which the runtime's
 *   block wrapper also carries — so the label named the wrapper <div> and the
 *   <input> had no accessible name. And with `stateKey` the field wrote state
 *   but never followed it: a suggestion chip that set `q` left the box stale.
 * - control.chip: a button chip spread `font: inherit` over its size, so an
 *   "sm" chip drew at the page's 16px, larger than the 14px row title beside it.
 * - data.repeater (layout row): a person with no picture showed a generic icon
 *   instead of their initials.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { ChipBlock } from '../atoms/blocks/control/chip/component.js'
import { RepeaterBlock, rowInitials } from '../atoms/blocks/data/repeater/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
type Ev = { type: string; payload?: Record<string, unknown> }

function el(C: unknown, id: string, type: string, props: Record<string, unknown>) {
  const Comp = C as AnyBlock
  return <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{}} />
}

/** The runtime wraps every block in a div that carries `id={block.id}`. */
function wrapped(id: string, node: React.ReactNode) {
  return (
    <div id={id} data-block-id={id} data-block-wrapper={id}>
      {node}
    </div>
  )
}

function mount(tree: React.ReactNode) {
  const events: Ev[] = []
  const wrap = (t: React.ReactNode) => (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      {t}
    </BehaviorSurfaceProvider>
  )
  const r = render(wrap(tree))
  return { events, rerender: (t: React.ReactNode) => r.rerender(wrap(t)) }
}

describe('form.input — the label names the field', () => {
  it('the visible label is the input\'s accessible name, even inside the runtime wrapper', () => {
    mount(wrapped('email', el(InputBlock, 'email', 'input', { name: 'email', type: 'email', label: 'Work email' })))
    const field = screen.getByLabelText('Work email')
    expect(field.tagName).toBe('INPUT')
    expect(field.id).not.toBe('email')
  })

  it('a textarea-typed input is named by its label too', () => {
    mount(wrapped('note', el(InputBlock, 'note', 'input', { name: 'note', type: 'textarea', label: 'Note' })))
    expect(screen.getByLabelText('Note').tagName).toBe('TEXTAREA')
  })

  it('repeated copies (runtime-suffixed ids) each get their own label target', () => {
    mount(
      <>
        {wrapped('qty--0', el(InputBlock, 'qty--0', 'input', { name: 'qty', label: 'Quantity A' }))}
        {wrapped('qty--1', el(InputBlock, 'qty--1', 'input', { name: 'qty', label: 'Quantity B' }))}
      </>
    )
    const a = screen.getByLabelText('Quantity A')
    const b = screen.getByLabelText('Quantity B')
    expect(a).not.toBe(b)
    expect(a.id).not.toBe(b.id)
  })
})

describe('form.input — value follows its state key', () => {
  const props = (value: string) => ({ name: 'q', type: 'search', label: 'Search', stateKey: 'q', value })

  it('shows a value set from outside (a suggestion chip writes q)', () => {
    const { rerender } = mount(el(InputBlock, 'q', 'input', props('')))
    const field = screen.getByLabelText('Search') as HTMLInputElement
    expect(field.value).toBe('')
    rerender(el(InputBlock, 'q', 'input', props('noise')))
    expect(screen.getByLabelText('Search')).toBe(field) // not remounted
    expect(field.value).toBe('noise')
  })

  it('typing is not undone by its own echo, nor by a stale one, and the field is not remounted', () => {
    const { events, rerender } = mount(el(InputBlock, 'q', 'input', props('')))
    const field = screen.getByLabelText('Search') as HTMLInputElement
    fireEvent.change(field, { target: { value: 'b' } })
    fireEvent.change(field, { target: { value: 'bu' } })
    // the state store lags: the echo of "b" arrives after "bu" was typed
    rerender(el(InputBlock, 'q', 'input', props('b')))
    expect(field.value).toBe('bu')
    rerender(el(InputBlock, 'q', 'input', props('bu')))
    expect(screen.getByLabelText('Search')).toBe(field)
    expect(field.value).toBe('bu')
    const actions = events.map((e) => e.payload?.action).filter(Boolean)
    expect(actions.at(-1)).toEqual({ type: 'setState', key: 'q', value: 'bu' })
    // then something clears the key
    rerender(el(InputBlock, 'q', 'input', props('')))
    expect(field.value).toBe('')
  })

  it('an unresolved binding is not a value', () => {
    mount(el(InputBlock, 'q', 'input', props('{{state.q}}')))
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('')
  })
})

describe('control.chip — sizes', () => {
  it('a button chip keeps its own size: sm xs, md sm on the theme scale (no `font: inherit`)', () => {
    mount(
      <>
        {el(ChipBlock, 'a', 'chip', { label: 'In stock', size: 'sm', selected: false })}
        {el(ChipBlock, 'b', 'chip', { label: 'In stock', size: 'md', selected: false })}
      </>
    )
    const sm = document.getElementById('a') as HTMLElement
    const md = document.getElementById('b') as HTMLElement
    expect(sm.tagName).toBe('BUTTON')
    expect(sm.style.fontSize).toBe('var(--pw-font-size-xs)')
    expect(md.style.fontSize).toBe('var(--pw-font-size-sm)')
    expect(sm.style.fontFamily).toBe('inherit')
  })
})

describe('data.repeater — a person row without a picture shows initials', () => {
  it('rowInitials takes up to two initials', () => {
    expect(rowInitials('Jane Doe')).toBe('JD')
    expect(rowInitials('  ada  ')).toBe('A')
    expect(rowInitials('Mary Ann Example')).toBe('MA')
    expect(rowInitials('')).toBe('')
  })

  it('an empty avatarField value draws the initials of the heading; a picture stays a picture', () => {
    const { container } = render(
      el(RepeaterBlock, 'people', 'repeater', {
        layout: 'row',
        headingField: 'name',
        avatarField: 'photo',
        items: [
          { id: '1', name: 'Jane Doe', photo: '' },
          { id: '2', name: 'John Example', photo: 'https://example.com/john.jpg' },
        ],
      })
    )
    const initials = container.querySelectorAll('[data-avatar="initials"]')
    expect(initials).toHaveLength(1)
    expect(initials[0]?.textContent).toBe('JD')
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('without avatarField the row keeps its icon', () => {
    const { container } = render(
      el(RepeaterBlock, 'links', 'repeater', { layout: 'row', headingField: 'name', items: [{ id: '1', name: 'Handbook' }] })
    )
    expect(container.querySelector('[data-avatar="initials"]')).toBeNull()
  })
})

describe('data.repeater — the page owns the empty state', () => {
  it('with no emptyText an empty list renders nothing', () => {
    const { container } = render(el(RepeaterBlock, 'r', 'repeater', { layout: 'row', headingField: 'name', items: [] }))
    expect(container.textContent).toBe('')
  })
  it('a given emptyText is shown', () => {
    const { container } = render(el(RepeaterBlock, 'r', 'repeater', { layout: 'row', headingField: 'name', items: [], emptyText: 'No posts yet.' }))
    expect(container.textContent).toBe('No posts yet.')
  })
})
