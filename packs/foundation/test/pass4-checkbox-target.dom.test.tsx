/**
 * A required checkbox refused on submit: its message is linked by an id of
 * its own (two boxes never share a generic "field-error"), and on a phone the
 * box is a 24px target inside a 44px row.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { CheckboxBlock } from '../atoms/blocks/form/checkbox/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }}>
      {children}
    </Comp>
  )
}

describe('checkbox in a form', () => {
  it('two refused boxes get two different message ids, each naming its own box', async () => {
    render(
      <BehaviorSurfaceProvider surfaceId="s" onEvent={() => {}}>
        {el(FormBlock, 'f', 'form', { submitLabel: 'Join' }, [
          el(CheckboxBlock, 'terms', 'checkbox', { name: 'terms', label: 'I agree to the terms', required: true }),
          el(CheckboxBlock, 'age', 'checkbox', { name: 'age', label: 'I am over 16', required: true }),
        ])}
      </BehaviorSurfaceProvider>
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    })
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const ids = boxes.map((b) => b.getAttribute('aria-describedby'))
    expect(ids).toEqual(['terms-box-error', 'age-box-error'])
    expect(document.getElementById('terms-box-error')?.hasAttribute('data-pw-field-error')).toBe(true)
  })

  it('the phone rule grows the box to 24px', () => {
    render(
      <BehaviorSurfaceProvider surfaceId="s" onEvent={() => {}}>
        {el(CheckboxBlock, 'c', 'checkbox', { name: 'c', label: 'News' })}
      </BehaviorSurfaceProvider>
    )
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('')
    expect(css).toContain('[data-pw-check-box] { width: 24px !important; height: 24px !important; }')
  })
})
