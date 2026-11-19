/**
 * Shared pass 3: the widgets form family on a phone (tag-input ×, the
 * rich-text toolbar, the slider are real 44px boxes) and the file-dropzone
 * inside a form (left out of the payload until engine 3.0, the developer is
 * warned once).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TagInputBlock } from '../atoms/blocks/form/tag-input/component.js'
import { RichTextEditorBlock } from '../atoms/blocks/form/rich-text-editor/component.js'
import { SliderBlock } from '../atoms/blocks/form/slider/component.js'
import { FileDropzoneBlock, FILE_IN_FORM_WARNING } from '../atoms/blocks/form/file-dropzone/component.js'
import { FormBlock, collectFormValues } from '../../foundation/atoms/blocks/form/form/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type AnyBlock = React.FC<Record<string, unknown>>
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live' }}>
      {children}
    </Comp>
  )
}
const mount = (tree: React.ReactNode) =>
  render(
    <BehaviorSurfaceProvider surfaceId="s" onEvent={() => undefined}>
      {tree}
    </BehaviorSurfaceProvider>,
  )
const css = (): string => [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n')
const phoneRule = (attr: string): boolean =>
  new RegExp(`@media \\(max-width: 640px\\), \\(pointer: coarse\\) \\{[^@]*\\[${attr}\\][^}]*height: 44px`).test(css())

describe('real 44px boxes on a phone', () => {
  it('tag-input remove ×, rich-text toolbar, slider', () => {
    mount(
      <>
        {el(TagInputBlock, 't', 'tag-input', { label: 'Tags', tags: ['One'] })}
        {el(RichTextEditorBlock, 'r', 'rich-text-editor', { label: 'Body' })}
        {el(SliderBlock, 's', 'slider', { label: 'Level' })}
      </>,
    )
    expect(screen.getByRole('button', { name: 'Remove One' }).hasAttribute('data-pw-tag-x')).toBe(true)
    expect(phoneRule('data-pw-tag-x')).toBe(true)
    const tools = screen.getByRole('toolbar').querySelectorAll('button')
    expect(tools.length).toBeGreaterThan(0)
    for (const b of tools) expect(b.hasAttribute('data-pw-rte-tool')).toBe(true)
    expect(phoneRule('data-pw-rte-tool')).toBe(true)
    expect(screen.getByRole('slider').hasAttribute('data-pw-range-touch')).toBe(true)
    expect(phoneRule('data-pw-range-touch')).toBe(true)
  })
})

describe('file-dropzone inside a form', () => {
  it('is left out of the payload and warns the developer once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mount(
      el(FormBlock, 'f', 'form', { submitLabel: 'Save' }, [
        el(FileDropzoneBlock, 'a', 'file-dropzone', { name: 'logo', label: 'Logo' }),
        el(FileDropzoneBlock, 'b', 'file-dropzone', { name: 'cover', label: 'Cover' }),
      ]),
    )
    const form = document.querySelector('form') as HTMLFormElement
    expect(form.querySelectorAll('input[type=file]').length).toBe(2)
    expect(collectFormValues(form)).toEqual({})
    const calls = warn.mock.calls.filter((c) => c[0] === FILE_IN_FORM_WARNING)
    expect(calls.length).toBe(1)
  })
})
