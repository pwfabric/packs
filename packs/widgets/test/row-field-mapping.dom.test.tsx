/**
 * Rows reach a block as the source delivers them — objects with the source's
 * own field names. Each block that takes rows names the fields it reads
 * through props (list.textField, calendar-month.dateField/labelField/colorField,
 * chart.labelField/valueField, combobox.labelKey/valueKey), and its defaults are
 * the names it always read, so an existing receipt renders unchanged.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ListBlock } from '../../foundation/atoms/blocks/data/list/component.js'
import { CalendarMonthBlock } from '../atoms/blocks/data/calendar-month/component.js'
import { ChartBlock } from '../atoms/blocks/data/chart/component.js'
import { ComboboxBlock } from '../atoms/blocks/form/combobox/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>

function mount(C: unknown, type: string, props: Record<string, unknown>) {
  const Comp = C as AnyBlock
  return render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <form data-testid="f">
        <Comp props={applied(type, props)} block={{ id: 'b', type, props, layout: {} }} context={{}} />
      </form>
    </BehaviorSurfaceProvider>
  )
}

const texts = (container: HTMLElement, sel: string) => [...container.querySelectorAll(sel)].map((n) => n.textContent)

describe('list', () => {
  it('renders rows through textField, with a dotted path', () => {
    const rows = [{ id: 1, subject: 'Ship the release', meta: { owner: 'Jane' } }, { id: 2, subject: 'Write notes', meta: { owner: 'Lin' } }]
    const { container } = mount(ListBlock, 'list', { items: rows, textField: 'subject', style: 'none' })
    expect(texts(container, 'li')).toEqual(['Ship the release', 'Write notes'])
    cleanup()
    const r2 = mount(ListBlock, 'list', { items: rows, textField: 'meta.owner', style: 'none' })
    expect(texts(r2.container, 'li')).toEqual(['Jane', 'Lin'])
  })

  it('keeps plain strings as written, and a row without textField shows its name', () => {
    const { container } = mount(ListBlock, 'list', { items: ['One', 'Two'], style: 'none' })
    expect(texts(container, 'li')).toEqual(['One', 'Two'])
    cleanup()
    const r2 = mount(ListBlock, 'list', { items: [{ name: 'Row name', other: 'x' }], style: 'none' })
    expect(texts(r2.container, 'li')).toEqual(['Row name'])
  })
})

describe('calendar-month', () => {
  it('places rows on their day through dateField/labelField/colorField', () => {
    const rows = [
      { startsOn: '2026-03-04T09:30:00Z', subject: 'Planning', tone: 'var(--pw-color-success)' },
      { startsOn: '2026-03-18', subject: 'Review' },
      { subject: 'No day — dropped' },
    ]
    const { container } = mount(CalendarMonthBlock, 'calendar-month', { year: 2026, month: 3, events: rows, dateField: 'startsOn', labelField: 'subject', colorField: 'tone' })
    expect(screen.getByText('Planning')).toBeTruthy()
    expect(screen.getByText('Review')).toBeTruthy()
    expect(screen.queryByText('No day — dropped')).toBeNull()
    expect((screen.getByText('Planning') as HTMLElement).style.background).toContain('var(--pw-color-success)')
    expect(container.textContent).toContain('4Planning')
  })

  it('reads date/label/color when no field props are given', () => {
    mount(CalendarMonthBlock, 'calendar-month', { year: 2026, month: 3, events: [{ date: '2026-03-10', label: 'Old shape' }] })
    expect(screen.getByText('Old shape')).toBeTruthy()
  })

  // A bare `1fr` track has an `auto` minimum: a long event label or weekday name
  // widened its column, and on a 390px phone Sunday was pushed off the screen.
  it('keeps seven equal columns that a long label cannot widen', () => {
    const { container } = mount(CalendarMonthBlock, 'calendar-month', {
      year: 2026,
      month: 3,
      events: [{ date: '2026-03-04', label: 'A very long event label that would not fit in one day' }],
    })
    const grid = container.querySelector('[data-pw-calendar-grid]') as HTMLElement
    expect(grid.style.gridTemplateColumns).toBe('repeat(7, minmax(0, 1fr))')
    for (const cell of [...grid.children] as HTMLElement[]) expect(['0', '0px']).toContain(cell.style.minWidth)
    const label = screen.getByText(/A very long event label/) as HTMLElement
    expect(label.style.overflow).toBe('hidden')
    expect(label.style.textOverflow).toBe('ellipsis')
  })
})

describe('chart', () => {
  it('reads labels and values through labelField/valueField', () => {
    const rows = [{ month: 'Jan', total: 4 }, { month: 'Feb', total: '9' }]
    const { container } = mount(ChartBlock, 'chart', { data: rows, labelField: 'month', valueField: 'total', showLabels: true })
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('line chart, 2 points, values 4 to 9')
    expect(container.textContent).toContain('Jan')
    expect(container.textContent).toContain('Feb')
  })

  it('reads label/value when no field props are given', () => {
    const { container } = mount(ChartBlock, 'chart', { data: [{ label: 'x', value: 1 }, { label: 'y', value: 3 }] })
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('line chart, 2 points, values 1 to 3')
  })
})

describe('combobox', () => {
  it('shows labelKey and submits valueKey of bound rows', () => {
    const rows = [{ customerId: 'c1', fullName: 'Jane Doe' }, { customerId: 'c2', fullName: 'Lin Wei' }]
    const { container } = mount(ComboboxBlock, 'combobox', { name: 'customer', options: rows, labelKey: 'fullName', valueKey: 'customerId' })
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Lin Wei' }))
    const hidden = container.querySelector('input[name="customer"]') as HTMLInputElement
    expect(hidden.value).toBe('c2')
  })

  it('keeps {label, value} options and plain strings', () => {
    mount(ComboboxBlock, 'combobox', { name: 'x', options: [{ label: 'Red', value: 'r' }, 'Blue'] })
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: 'Red' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Blue' })).toBeTruthy()
  })
})
