/**
 * Every single-line form control has ONE height, border included, so a filter
 * row of a search box and a select lines up (they measured 43px and 40px).
 * jsdom draws no layout, so the box is read from what decides it: the same
 * height value on a border-box element, with nothing that would add to it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { CONTROL_HEIGHT } from '../atoms/lib/_shared-utils.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { SelectBlock } from '../atoms/blocks/form/select/component.js'
import { DateInputBlock } from '../atoms/blocks/form/date-input/component.js'
import { NumberStepperBlock } from '../atoms/blocks/form/number-stepper/component.js'
import { ComboboxBlock } from '../../widgets/atoms/blocks/form/combobox/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

function box(C: unknown, type: string, props: Record<string, unknown>, pick: (root: HTMLElement) => HTMLElement | null): HTMLElement {
  const Comp = C as React.FC<Record<string, unknown>>
  const { container } = render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id: 'c', type, props, layout: {} }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>,
  )
  const el = pick(container)
  if (!el) throw new Error(`${type}: no control`)
  return el
}

const outer = (el: HTMLElement): string => {
  const s = getComputedStyle(el)
  // A border-box element is exactly its height: padding and border sit inside it.
  return `${el.style.height}|${s.boxSizing}`
}

describe('single-line form controls share one height', () => {
  const controls: [string, () => HTMLElement][] = [
    ['input text', () => box(InputBlock, 'input', { label: 'Name', name: 'n' }, (r) => r.querySelector('input'))],
    ['input search', () => box(InputBlock, 'input', { label: 'Search', name: 'q', type: 'search' }, (r) => r.querySelector('input'))],
    ['select', () => box(SelectBlock, 'select', { label: 'Kind', name: 'k', options: ['a', 'b'] }, (r) => r.querySelector('select'))],
    ['date-input', () => box(DateInputBlock, 'date-input', { label: 'Day', name: 'd' }, (r) => r.querySelector('input'))],
    ['number-stepper', () => box(NumberStepperBlock, 'number-stepper', { label: 'Guests', name: 'g' }, (r) => r.querySelector('[data-pw-step-field]')?.parentElement ?? null)],
    ['combobox', () => box(ComboboxBlock, 'combobox', { label: 'City', name: 'c', options: ['Oslo'] }, (r) => r.querySelector('[data-pw-combo-frame]'))],
  ]

  it.each(controls)('%s is the shared control height, border-box', (_name, get) => {
    const el = get()
    expect(el.style.height).toBe(CONTROL_HEIGHT)
    expect(getComputedStyle(el).boxSizing).toBe('border-box')
    // No vertical padding beyond what fits inside the height.
    expect(['', '0px'].includes(el.style.paddingTop)).toBe(true)
    cleanup()
  })

  it('so a search box and a select in one row have the same box', () => {
    const search = outer(controls[1]![1]())
    cleanup()
    const select = outer(controls[2]![1]())
    expect(search).toBe(select)
  })

  it('a textarea and a multi-select keep their own height (they are not one line)', () => {
    const ta = box(InputBlock, 'input', { label: 'Notes', name: 'n', type: 'textarea' }, (r) => r.querySelector('textarea'))
    expect(ta.style.height).toBe('')
    cleanup()
    const multi = box(SelectBlock, 'select', { label: 'Tags', name: 't', multiple: true, options: ['a'] }, (r) => r.querySelector('select'))
    expect(multi.style.height).toBe('')
  })
})
