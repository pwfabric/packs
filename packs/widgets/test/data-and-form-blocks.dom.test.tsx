/**
 * Data and form blocks: checkbox, date-input, number-stepper, radio, chart,
 * table and rating. One describe per block.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { CheckboxBlock } from '../../foundation/atoms/blocks/form/checkbox/component.js'
import { DateInputBlock } from '../../foundation/atoms/blocks/form/date-input/component.js'
import { NumberStepperBlock } from '../../foundation/atoms/blocks/form/number-stepper/component.js'
import { RadioBlock } from '../../foundation/atoms/blocks/form/radio/component.js'
import { ChartBlock } from '../atoms/blocks/data/chart/component.js'
import { TableBlock } from '../../foundation/atoms/blocks/data/table/component.js'
import { RatingBlock } from '../atoms/blocks/data/rating/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
type Ev = { type: string; payload?: Record<string, unknown> }

function el(C: unknown, id: string, type: string, props: Record<string, unknown>, context: Record<string, unknown> = {}) {
  const Comp = C as AnyBlock
  return <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={context} />
}

function mount(tree: React.ReactNode): { events: Ev[]; container: HTMLElement; rerender: (t: React.ReactNode) => void } {
  const events: Ev[] = []
  const wrapIn = (t: React.ReactNode) => (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      <form data-testid="f">{t}</form>
    </BehaviorSurfaceProvider>
  )
  const r = render(wrapIn(tree))
  return { events, container: r.container, rerender: (t) => r.rerender(wrapIn(t)) }
}

const formOf = (): HTMLFormElement => screen.getByTestId('f') as HTMLFormElement
const submitted = (): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  for (const [k, v] of new FormData(formOf()).entries()) (out[k] ??= []).push(String(v))
  return out
}
const lastAction = (events: Ev[]): unknown => [...events].reverse().find((e) => e.payload?.action)?.payload?.action

// ── checkbox ────────────────────────────────────────────────

describe('checkbox', () => {
  it('submits "false" unchecked and "true" checked under its name, typed boolean', () => {
    mount(el(CheckboxBlock, 'cb', 'checkbox', { name: 'agree', label: 'I agree' }))
    expect(submitted().agree).toEqual(['false'])
    fireEvent.click(screen.getByRole('checkbox'))
    expect(submitted().agree).toEqual(['true'])
    const carrier = formOf().querySelector('input[name="agree"]') as HTMLInputElement
    expect(carrier.getAttribute('data-pw-value-type')).toBe('boolean')
  })

  it('writes a boolean to page state through stateKey', () => {
    const { events } = mount(el(CheckboxBlock, 'cb', 'checkbox', { name: 'agree', label: 'I agree', stateKey: 'agreed' }))
    fireEvent.click(screen.getByRole('checkbox'))
    expect(lastAction(events)).toEqual({ type: 'setState', key: 'agreed', value: true })
  })

  it('keeps native group semantics when an explicit value is given', () => {
    mount(el(CheckboxBlock, 'cb', 'checkbox', { name: 'tags', label: 'Red', value: 'red' }))
    expect(submitted().tags).toBeUndefined()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(submitted().tags).toEqual(['red'])
  })

  it('draws no invented "Checkbox" label', () => {
    const { container } = mount(el(CheckboxBlock, 'cb', 'checkbox', { name: 'x' }))
    expect(container.textContent).not.toContain('Checkbox')
  })

  it('a required box still blocks the form while unchecked', () => {
    mount(el(CheckboxBlock, 'cb', 'checkbox', { name: 'agree', label: 'I agree', required: true }))
    expect(formOf().checkValidity()).toBe(false)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(formOf().checkValidity()).toBe(true)
  })

  it('re-reads a bound `checked` that arrives after the first render', () => {
    const { rerender } = mount(el(CheckboxBlock, 'cb', 'checkbox', { name: 'a', label: 'A', checked: false }))
    rerender(el(CheckboxBlock, 'cb', 'checkbox', { name: 'a', label: 'A', checked: true }))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })
})

// ── date-input ──────────────────────────────────────────────

describe('date-input', () => {
  it('native mode: required is applied', () => {
    mount(el(DateInputBlock, 'd', 'date-input', { name: 'due', label: 'Due', required: true }))
    expect(formOf().checkValidity()).toBe(false)
  })

  it('calendar mode: an empty required date makes the form invalid', () => {
    mount(el(DateInputBlock, 'd', 'date-input', { name: 'due', label: 'Due', required: true, calendar: true }))
    expect(formOf().checkValidity()).toBe(false)
  })

  it('native mode: the label names the control', () => {
    mount(el(DateInputBlock, 'd', 'date-input', { name: 'due', label: 'Due date' }))
    expect(screen.getByLabelText(/Due date/)).toBeTruthy()
  })

  it('native mode: a change is emitted and written to stateKey; defaultValue fills the field', () => {
    const { events } = mount(
      el(DateInputBlock, 'd', 'date-input', { name: 'due', label: 'Due', stateKey: 'from', defaultValue: '2026-01-02' })
    )
    const input = formOf().querySelector('input[name="due"]') as HTMLInputElement
    expect(input.value).toBe('2026-01-02')
    fireEvent.change(input, { target: { value: '2026-03-04' } })
    expect(lastAction(events)).toEqual({ type: 'setState', key: 'from', value: '2026-03-04' })
  })
})

// ── number-stepper ──────────────────────────────────────────

describe('number-stepper', () => {
  const stepper = (p: Record<string, unknown> = {}) =>
    el(NumberStepperBlock, 'n', 'number-stepper', { name: 'qty', label: 'Amount', min: 0, max: 100, value: 1, ...p })

  it('is a number field with a step and a numeric type hint', () => {
    mount(stepper({ step: 0.5 }))
    const input = formOf().querySelector('input[name="qty"]') as HTMLInputElement
    expect(input.type).toBe('number')
    expect(input.getAttribute('step')).toBe('0.5')
    expect(input.getAttribute('data-pw-value-type')).toBe('number')
  })

  it('keeps decimals typed by the visitor', () => {
    const { events } = mount(stepper({ step: 'any' }))
    const input = formOf().querySelector('input[name="qty"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2.5' } })
    expect(input.value).toBe('2.5')
    expect([...events].reverse().find((e) => e.type)?.payload?.value).toBe(2.5)
  })

  it('tolerates an emptied field while typing instead of jumping to min', () => {
    mount(stepper({ min: 1, value: 5 }))
    const input = formOf().querySelector('input[name="qty"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })

  it('does not erase the focus ring and invents no "Quantity" label', () => {
    const { container } = mount(el(NumberStepperBlock, 'n', 'number-stepper', { name: 'qty' }))
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.style.outline).toBe('')
    expect(container.textContent).not.toContain('Quantity')
  })

  it('re-reads a bound value that arrives after the first render', () => {
    const { rerender } = mount(stepper({ value: 1 }))
    rerender(stepper({ value: 7 }))
    expect((formOf().querySelector('input[name="qty"]') as HTMLInputElement).value).toBe('7')
  })
})

// ── radio ─────────────────────────────────────────────────────────

describe('radio', () => {
  const opts = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ]
  it('re-selects when a bound defaultValue arrives late', () => {
    const { rerender } = mount(el(RadioBlock, 'r', 'radio', { name: 'pick', options: opts }))
    rerender(el(RadioBlock, 'r', 'radio', { name: 'pick', options: opts, defaultValue: 'b' }))
    expect(submitted().pick).toEqual(['b'])
  })
  it('the group is named by its label', () => {
    mount(el(RadioBlock, 'r', 'radio', { name: 'pick', label: 'Size', options: opts }))
    expect(screen.getByRole('radiogroup', { name: 'Size' })).toBeTruthy()
  })
})

// ── chart ──────────────────────────────────────────────────────────────

describe('chart', () => {
  it('draws no invented Mon–Sun curve when bound data is empty', () => {
    const { container } = mount(el(ChartBlock, 'c', 'chart', { data: [], showLabels: true }))
    expect(container.querySelector('path')).toBeNull()
    expect(container.textContent).not.toContain('Mon')
  })
  it('draws nothing invented when data is missing', () => {
    const { container } = mount(el(ChartBlock, 'c', 'chart', {}))
    expect(container.querySelector('path')).toBeNull()
  })
  it('still draws real data', () => {
    const { container } = mount(el(ChartBlock, 'c', 'chart', { data: [{ label: 'x', value: 1 }, { label: 'y', value: 3 }] }))
    expect(container.querySelector('path')).not.toBeNull()
  })
  it('a bar chart keeps every bar inside the plot, one centred per slot', () => {
    const data = [{ label: 'Mon', value: 4 }, { label: 'Tue', value: 9 }, { label: 'Wed', value: 2 }]
    const { container } = mount(el(ChartBlock, 'c', 'chart', { variant: 'bar', data, showLabels: true }))
    const W = Number(container.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2])
    const bars = Array.from(container.querySelectorAll('rect'))
    expect(bars).toHaveLength(3)
    for (const r of bars) {
      const x = Number(r.getAttribute('x'))
      const w = Number(r.getAttribute('width'))
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x + w).toBeLessThanOrEqual(W)
    }
    // the first and last bars are mirror images: the row is centred
    const first = Number(bars[0]!.getAttribute('x'))
    const last = Number(bars[2]!.getAttribute('x')) + Number(bars[2]!.getAttribute('width'))
    expect(Math.abs(first - (W - last))).toBeLessThan(0.05)
    // the labels sit under their bars: one equal grid column per bar
    const labels = container.querySelector('[data-chart-labels]') as HTMLElement
    expect(labels.style.display).toBe('grid')
  })
  it('shows a value scale by default: round values, each on a gridline', () => {
    const data = [{ label: 'a', value: 3 }, { label: 'b', value: 7 }, { label: 'c', value: 5 }]
    const { container } = mount(el(ChartBlock, 'c', 'chart', { variant: 'line', data }))
    const ticks = Array.from(container.querySelectorAll('[data-chart-scale] span')).map((s) => s.textContent)
    expect(ticks).toEqual(['0', '2.5', '5', '7.5'])
    expect(container.querySelectorAll('[data-chart-grid] line')).toHaveLength(4)
  })
  it('a bar chart has the scale too; showValues: false and a sparkline have none', () => {
    const data = [{ label: 'a', value: 1200 }, { label: 'b', value: 800 }]
    const bar = mount(el(ChartBlock, 'b', 'chart', { variant: 'bar', data }))
    expect(Array.from(bar.container.querySelectorAll('[data-chart-scale] span')).map((s) => s.textContent)).toEqual(['0', '500', '1K', '1.5K'])
    cleanup()
    const off = mount(el(ChartBlock, 'o', 'chart', { variant: 'area', data, showValues: false }))
    expect(off.container.querySelector('[data-chart-scale]')).toBeNull()
    cleanup()
    const spark = mount(el(ChartBlock, 's', 'chart', { variant: 'sparkline', data }))
    expect(spark.container.querySelector('[data-chart-scale]')).toBeNull()
  })
  it('a negative minimum gets a round floor; the zero line is solid', () => {
    const { container } = mount(el(ChartBlock, 'c', 'chart', { data: [{ label: 'a', value: -3 }, { label: 'b', value: 8 }] }))
    expect(Array.from(container.querySelectorAll('[data-chart-scale] span')).map((s) => s.textContent)).toEqual(['-5', '0', '5', '10'])
    const lines = Array.from(container.querySelectorAll('[data-chart-grid] line'))
    expect(lines.filter((l) => !l.getAttribute('stroke-dasharray'))).toHaveLength(1)
  })
})

describe('chart labels', () => {
  it('thins labels that would collide, and shows all when they fit', async () => {
    const { labelStride } = await import('../atoms/blocks/data/chart/component.js')
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
    // 24 five-character labels in a 300px phone plot: every 4th or so.
    const k = labelStride(hours, 300)
    expect(k).toBeGreaterThan(1)
    expect(Math.ceil(24 / k) * (5 * 7 + 12)).toBeLessThanOrEqual(300)
    expect(labelStride(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], 900)).toBe(1)
    expect(labelStride(hours, 0)).toBe(1)
  })
  it('a 0–27 series gets a 0–30 scale, not 0–50', async () => {
    const { chartScale } = await import('../atoms/blocks/data/chart/component.js')
    expect(chartScale([23, 27, 25, 21, 19])).toEqual({ min: 0, max: 30, ticks: [0, 10, 20, 30] })
  })
  it('a line chart places each label under its point', () => {
    const data = [{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 3 }]
    const { container } = mount(el(ChartBlock, 'c', 'chart', { data, showLabels: true }))
    const spans = Array.from(container.querySelectorAll('[data-chart-labels] span')) as HTMLElement[]
    expect(spans.map((s) => s.textContent)).toEqual(['a', 'b', 'c'])
    expect(parseFloat(spans[1]!.style.left)).toBeCloseTo(50, 1)
  })
  it('a negative bar hangs below the zero line', () => {
    const { container } = mount(el(ChartBlock, 'c', 'chart', { variant: 'bar', data: [{ label: 'a', value: 5 }, { label: 'b', value: -5 }] }))
    const [up, down] = Array.from(container.querySelectorAll('rect'))
    const upBottom = Number(up!.getAttribute('y')) + Number(up!.getAttribute('height'))
    expect(Number(down!.getAttribute('y'))).toBeCloseTo(upBottom, 1)
  })
})

// ── table ─────────────────────────────────────────

describe('table', () => {
  it('invents no "Column 1/2" when no columns are given', () => {
    const { container } = mount(el(TableBlock, 't', 'table', { data: [] }))
    expect(container.textContent).not.toMatch(/Column \d/)
  })
  it('shows an empty state instead of a bare header when there are no rows', () => {
    mount(el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'A' }], data: [], emptyText: 'Nothing yet' }))
    expect(screen.getByText('Nothing yet')).toBeTruthy()
  })
  it('below 480px of its own width the rows stack as label/value cards', () => {
    const { container } = mount(
      el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'Service' }, { key: 'b', header: 'Version' }], data: [{ a: 'api', b: 'v1' }] })
    )
    const cells = Array.from(container.querySelectorAll('tbody td')).map((td) => td.getAttribute('data-label'))
    expect(cells).toEqual(['Service', 'Version'])
    expect(container.querySelector('style')?.textContent).toMatch(/@container \(max-width: 479px\)/)
    expect((container.querySelector('[data-pw-table]')?.parentElement as HTMLElement).style.containerType).toBe('inline-size')
  })
  it('announces a failed fetch visibly', () => {
    mount(el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'A' }], data: [], errorWhen: 'Boom' }))
    expect(screen.getByRole('alert').textContent).toContain('Boom')
  })
  it('filter box speaks English by default and keeps the focus ring', () => {
    mount(el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'A' }], data: [{ a: 1 }], filterable: true }))
    const box = screen.getByRole('searchbox') as HTMLInputElement
    expect(box.placeholder).toBe('Filter…')
    expect(box.style.outline).toBe('')
  })
  // 'KAYIT AÇIK' / 'kayıt' stays Turkish on purpose: it exercises Turkish
  // dotted/dotless I case folding in the filter.
  it('filters case-insensitively in English and in Turkish (I, İ, ı and i all match)', () => {
    const rows = [{ a: 'Info desk' }, { a: 'KAYIT AÇIK' }, { a: 'Closed' }]
    mount(el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'A' }], data: rows, filterable: true }))
    const box = screen.getByRole('searchbox') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'info' } })
    expect(screen.queryByText('Info desk')).toBeTruthy()
    expect(screen.queryByText('Closed')).toBeNull()
    fireEvent.change(box, { target: { value: 'kayıt' } })
    expect(screen.queryByText('KAYIT AÇIK')).toBeTruthy()
    expect(screen.queryByText('Info desk')).toBeNull()
  })
  it('a sortable header is a keyboard-reachable button', () => {
    mount(el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'Name' }], data: [{ a: 1 }], sortable: true }))
    expect(screen.getByRole('button', { name: /Name/ })).toBeTruthy()
  })
})

// ── rating ──────────────────────────────────────────────────────

describe('rating', () => {
  it('interactive stars are a radiogroup of buttons; a pick is emitted, written to state and submitted', () => {
    const { events } = mount(el(RatingBlock, 'rt', 'rating', { name: 'score', stateKey: 'score', max: 5 }))
    const stars = screen.getAllByRole('radio')
    expect(stars).toHaveLength(5)
    fireEvent.click(stars[2]!)
    expect(lastAction(events)).toEqual({ type: 'setState', key: 'score', value: 3 })
    expect(submitted().score).toEqual(['3'])
  })
  it('a readonly rating is one image with a name', () => {
    mount(el(RatingBlock, 'rt', 'rating', { value: 4, max: 5, readonly: true }))
    expect(screen.getByRole('img', { name: /4/ })).toBeTruthy()
  })
  it('re-reads a bound value that arrives late', () => {
    const { rerender, container } = mount(el(RatingBlock, 'rt', 'rating', { value: 0, readonly: true, showCount: true }))
    rerender(el(RatingBlock, 'rt', 'rating', { value: 4, readonly: true, showCount: true }))
    expect(container.textContent).toContain('4/5')
  })
  it('4.5 does not draw five full stars', () => {
    const { container } = mount(el(RatingBlock, 'rt', 'rating', { value: 4.5, readonly: true }))
    expect(container.querySelectorAll('[data-fill="full"]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-fill="half"]')).toHaveLength(1)
  })
})
