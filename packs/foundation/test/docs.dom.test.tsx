/**
 * Documentation blocks: copy-button and text.code.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { CopyButtonBlock } from '../atoms/blocks/control/copy-button/component.js'
import { CodeBlock } from '../atoms/blocks/text/code/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

type AnyBlock = React.FC<Record<string, unknown>>

function mount(C: unknown, props: Record<string, unknown>, style: Record<string, unknown> = {}) {
  const type = C === CodeBlock ? 'code' : 'copy-button'
  const Comp = C as AnyBlock
  return render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id: 'b1', type, props, layout: {}, style }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>,
  )
}

function stubClipboard(writeText: (t: string) => Promise<void>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
}

describe('copy-button tells the truth about the clipboard', () => {
  it('says "Copied" only after the write resolved', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubClipboard(writeText)
    mount(CopyButtonBlock, { value: 'npm i x', label: 'Copy' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(writeText).toHaveBeenCalledWith('npm i x')
    expect(screen.getByRole('button').textContent).toContain('Copied')
  })

  it('does not say "Copied" when the write is refused', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    mount(CopyButtonBlock, { value: 'npm i x', label: 'Copy', failedLabel: 'Copy failed' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByRole('button').textContent).not.toContain('Copied')
    expect(screen.getByRole('button').textContent).toContain('Copy failed')
  })

  it('does not say "Copied" for an empty value', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubClipboard(writeText)
    mount(CopyButtonBlock, { value: '', label: 'Copy' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(writeText).not.toHaveBeenCalled()
    expect(screen.getByRole('button').textContent).not.toContain('Copied')
  })

  it('announces the result in a live region', async () => {
    stubClipboard(() => Promise.resolve())
    mount(CopyButtonBlock, { value: 'x', label: 'Copy', copiedLabel: 'Copied to clipboard' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByRole('status').textContent).toBe('Copied to clipboard')
  })
})

describe('text.code', () => {
  it('prints no "// Your code here" when code is missing', () => {
    const { container } = mount(CodeBlock, { showLineNumbers: false, copyButton: false })
    expect(container.textContent).not.toContain('Your code here')
  })

  it('a non-string code does not crash the block', () => {
    const { container } = mount(CodeBlock, { code: 42, showLineNumbers: true, copyButton: false })
    expect(container.textContent).toContain('42')
  })

  it('block.style reaches the root even without a header', () => {
    const { container } = mount(CodeBlock, { code: 'a', copyButton: false }, { marginTop: '24px' })
    const root = container.querySelector('[data-block-type="code"]') as HTMLElement
    expect(root.style.marginTop).toBe('24px')
  })

  it('line numbers are not selectable and the scroller is focusable', () => {
    const { container } = mount(CodeBlock, { code: 'a\nb', copyButton: false })
    const pre = container.querySelector('pre') as HTMLElement
    expect(pre.tabIndex).toBe(0)
    const num = container.querySelector('[data-line-number]') as HTMLElement
    expect(num).not.toBeNull()
    expect(num.style.userSelect).toBe('none')
  })

  it('the header copy button reports the copy', async () => {
    stubClipboard(() => Promise.resolve())
    mount(CodeBlock, { code: 'a', filename: 'x.ts' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByRole('status').textContent).toBe('Copied')
  })
})
