/**
 * Two binding fixes from the example apps: a select whose bound value
 * arrives before its bound options keeps the choice, and a table's column
 * headers can be bound (translated with t()).
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { SelectBlock } from '../atoms/blocks/form/select/component.js'
import { TableBlock } from '../atoms/blocks/data/table/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

function view(C: unknown, id: string, type: string, props: Record<string, unknown>): React.ReactElement {
  const Comp = C as React.FC<Record<string, unknown>>
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>
  )
}

describe('select: a bound value that arrives before its options', () => {
  it('is kept until the options contain it, then shown', () => {
    const { rerender } = render(view(SelectBlock, 's', 'select', { name: 'clinic', defaultValue: '', options: [] }))
    // The value resolves first…
    rerender(view(SelectBlock, 's', 'select', { name: 'clinic', defaultValue: 'north', options: [] }))
    // …then the options.
    rerender(view(SelectBlock, 's', 'select', { name: 'clinic', defaultValue: 'north', options: [{ value: 'south', label: 'South' }, { value: 'north', label: 'North' }] }))
    expect((document.getElementById('s-select') as HTMLSelectElement).value).toBe('north')
  })

  it('a multi-select keeps its bound set the same way', () => {
    const { rerender } = render(view(SelectBlock, 'm', 'select', { name: 'm', multiple: true, defaultValue: 'a,c', options: [] }))
    rerender(view(SelectBlock, 'm', 'select', { name: 'm', multiple: true, defaultValue: 'a,c', options: ['a', 'b', 'c'] }))
    const sel = document.getElementById('m-select') as HTMLSelectElement
    expect(Array.from(sel.selectedOptions, (o) => o.value)).toEqual(['a', 'c'])
  })

  it("the visitor's own choice survives options that re-arrive unchanged", () => {
    const opts = ['a', 'b', 'c']
    const { rerender } = render(view(SelectBlock, 's', 'select', { name: 's', defaultValue: 'a', options: opts }))
    const sel = document.getElementById('s-select') as HTMLSelectElement
    fireEvent.change(sel, { target: { value: 'c' } })
    rerender(view(SelectBlock, 's', 'select', { name: 's', defaultValue: 'a', options: [...opts] }))
    expect((document.getElementById('s-select') as HTMLSelectElement).value).toBe('c')
  })
})

describe('table: column headers can be bound', () => {
  it('the manifest declares columns bindable', () => {
    const m = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'atoms', 'blocks', 'data', 'table', 'manifest.json'), 'utf8'))
    expect(m.definition.props.find((p: { name: string }) => p.name === 'columns').bindable).toBe(true)
  })

  it('a resolved header is drawn as text, in the header row and the phone row labels; a non-text one does not break the table', () => {
    render(
      view(TableBlock, 't', 'table', {
        columns: [{ key: 'name', header: 'Hasta' }, { key: 'n', header: 7 }, { key: 'x', header: { bad: true } }],
        data: [{ name: 'Ada', n: 1, x: 2 }],
      }),
    )
    const heads = [...document.querySelectorAll('#t th')].map((th) => th.textContent)
    expect(heads).toEqual(['Hasta', '7', ''])
    expect([...document.querySelectorAll('#t td')].map((td) => td.getAttribute('data-label'))).toEqual(['Hasta', '7', ''])
  })
})
