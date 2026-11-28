/**
 * Long-form content in prose: GitHub-style tables, nested lists, fenced code
 * with its language's tokens, and a copy button on each code block that
 * reports the copy as the code block does. The words the button shows are
 * the app's (ui.copy, ui.copied, or the copyLabel / copiedLabel props).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToString } from 'react-dom/server'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ProseBlock, highlightCode, sanitizeHtml } from '../atoms/blocks/text/prose/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const HERE = dirname(fileURLToPath(import.meta.url))

type AnyBlock = React.FC<Record<string, unknown>>
function el(props: Record<string, unknown>, context: Record<string, unknown> = {}): React.ReactElement {
  const Comp = ProseBlock as unknown as AnyBlock
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied('prose', props)} block={{ id: 'p', type: 'prose', props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>
  )
}
const root = (): HTMLElement => document.getElementById('p') as HTMLElement

describe('prose: GitHub-style tables', () => {
  it('a pipe table is a table with a header row, its cells aligned as the separator says', () => {
    render(el({ content: '| Plan | Price | Seats |\n|:-----|------:|:-----:|\n| Basic | 9 | 1 |\n| Team \\| Pro | **29** | 5 |\n\nAfter.' }))
    const table = root().querySelector('table') as HTMLTableElement
    expect([...table.querySelectorAll('thead th')].map((c) => c.textContent)).toEqual(['Plan', 'Price', 'Seats'])
    expect([...table.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent))).toEqual([
      ['Basic', '9', '1'],
      ['Team | Pro', '29', '5'],
    ])
    expect(table.querySelector('tbody strong')?.textContent).toBe('29')
    expect([...table.querySelectorAll('thead th')].map((c) => c.getAttribute('data-align'))).toEqual(['left', 'right', 'center'])
    expect(root().querySelector('[data-pw-prose-table] + p')?.textContent).toBe('After.')
  })

  it('a line of pipes with no separator under it stays a paragraph', () => {
    render(el({ content: 'a | b\nc | d' }))
    expect(root().querySelector('table')).toBeNull()
  })

  it('the sanitizer keeps only a known alignment', () => {
    expect(sanitizeHtml('<table><tr><td data-align="center">x</td><td data-align="evil">y</td></tr></table>')).toBe(
      '<table><tr><td data-align="center">x</td><td>y</td></tr></table>'
    )
  })
})

describe('prose: nested lists', () => {
  it('an indented item is a list inside the item above it, of either kind', () => {
    render(el({ content: '- One\n  - One a\n  - One b\n    1. deep\n- Two\n\n1. First\n   - inner\n2. Second' }))
    const lists = root().querySelectorAll(':scope [data-prose-id] > ul, :scope [data-prose-id] > ol')
    expect([...lists].map((l) => l.tagName)).toEqual(['UL', 'OL'])
    const one = lists[0]?.children[0] as HTMLElement
    expect(one.firstChild?.textContent).toBe('One')
    expect([...one.querySelectorAll(':scope > ul > li')].map((li) => li.firstChild?.textContent)).toEqual(['One a', 'One b'])
    expect(one.querySelector('ul > li > ol > li')?.textContent).toBe('deep')
    expect(lists[0]?.children[1]?.textContent).toBe('Two')
    expect(lists[1]?.querySelector(':scope > li > ul > li')?.textContent).toBe('inner')
    expect(lists[1]?.children).toHaveLength(2)
  })
})

describe('prose: fenced code', () => {
  it('names its language and marks its tokens, the text unchanged', () => {
    render(el({ content: '```ts\nconst n = 42 // the answer\nlet s = "a<b"\n```' }))
    const pre = root().querySelector('pre') as HTMLElement
    expect(pre.getAttribute('data-lang')).toBe('ts')
    expect(pre.textContent).toBe('const n = 42 // the answer\nlet s = "a<b"')
    const tok = (kind: string): string[] => [...pre.querySelectorAll(`[data-tok="${kind}"]`)].map((t) => t.textContent ?? '')
    expect(tok('keyword')).toEqual(['const', 'let'])
    expect(tok('number')).toEqual(['42'])
    expect(tok('comment')).toEqual(['// the answer'])
    expect(tok('string')).toEqual(['"a<b"'])
  })

  it('reads comments and strings as each language writes them', () => {
    expect(highlightCode('# note\necho "hi"', 'bash')).toBe('<span data-tok="comment"># note</span>\n<span data-tok="function">echo</span> <span data-tok="string">"hi"</span>')
    expect(highlightCode('{"a": 1}', 'json')).toBe('{<span data-tok="string">"a"</span>: <span data-tok="number">1</span>}')
    // Unknown or no language: escaped text, no tokens.
    expect(highlightCode('<b>', undefined)).toBe('&lt;b&gt;')
    expect(highlightCode('if x', 'klingon')).toBe('if x')
  })

  it('the sanitizer keeps a known token and a plain language name, nothing else', () => {
    expect(sanitizeHtml('<pre data-lang="ts"><code><span data-tok="keyword">x</span><span data-tok="evil" onclick="y">z</span></code></pre>')).toBe(
      '<pre data-lang="ts"><code><span data-tok="keyword">x</span><span>z</span></code></pre>'
    )
    expect(sanitizeHtml('<pre data-lang="a b"><code>x</code></pre>')).toBe('<pre><code>x</code></pre>')
  })

  it('token colours come from the theme', () => {
    render(el({ content: '```js\nlet a\n```' }))
    const css = root().querySelector('style')?.textContent ?? ''
    expect(css).toMatch(/\[data-tok="keyword"\][^}]*var\(--pw-color-code-keyword/)
    expect(css).toMatch(/\[data-tok="comment"\][^}]*var\(--pw-color-code-comment/)
    expect(css).not.toMatch(/\[data-tok="[a-z]+"\][^}]*#[0-9a-f]{3,6}\b/i)
  })
})

describe('prose: the copy button on a code block', () => {
  function stubClipboard(writeText: (t: string) => Promise<void>): void {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  }

  it('is drawn only when copyButton is on, with the app’s words', () => {
    render(el({ content: '```\nx\n```' }))
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    render(el({ content: '```\nx\n```', copyButton: true, copyLabel: 'Kopyala', copiedLabel: 'Kopyalandı' }))
    expect(screen.getByRole('button').textContent).toBe('Kopyala')
  })

  it('copies its own block’s code and says so, as the code block does', async () => {
    const wrote: string[] = []
    stubClipboard((t) => (wrote.push(t), Promise.resolve()))
    render(el({ content: '```sh\nfirst\n```\n\ntext\n\n```js\nlet second = 2\n```', copyButton: true, copyLabel: 'Copy', copiedLabel: 'Copied' }))
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    await act(async () => {
      fireEvent.click(buttons[1] as HTMLElement)
    })
    expect(wrote).toEqual(['let second = 2'])
    expect(screen.getByRole('status').textContent).toBe('Copied')
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Copy', 'Copied'])
  })

  it('says nothing when the clipboard refuses, and copies nothing in the editor', async () => {
    stubClipboard(() => Promise.reject(new Error('no')))
    render(el({ content: '```\nx\n```', copyButton: true, copyLabel: 'Copy', copiedLabel: 'Copied' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByRole('status').textContent).toBe('')
    cleanup()
    const wrote: string[] = []
    stubClipboard((t) => (wrote.push(t), Promise.resolve()))
    render(el({ content: '```\nx\n```', copyButton: true, copyLabel: 'Copy' }, { interactionMode: 'inert' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(wrote).toEqual([])
  })

  it('the server and the browser draw the same first frame', () => {
    const tree = el({ content: '| a |\n|---|\n| 1 |\n\n- x\n  - y\n\n```ts\nconst a = 1\n```', copyButton: true, copyLabel: 'Copy' })
    const html = renderToString(tree)
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    const { container } = render(tree)
    expect(container.querySelector('[data-prose-id]')?.innerHTML).toBe(host.querySelector('[data-prose-id]')?.innerHTML)
    host.remove()
  })

  it('declares its words, each read only while its prop is on', () => {
    const manifest = JSON.parse(readFileSync(join(HERE, '..', 'atoms', 'blocks', 'text', 'prose', 'manifest.json'), 'utf8'))
    expect(manifest.definition.messages).toEqual([
      { id: 'ui.copy', prop: 'copyLabel', when: 'copyButton' },
      { id: 'ui.copied', prop: 'copiedLabel', when: 'copyButton' },
    ])
    const copyButton = manifest.definition.props.find((p: { name: string }) => p.name === 'copyButton')
    expect(copyButton.default).toBe(false)
  })
})

describe('prose: links in the Markdown go through the app’s links', () => {
  it('an app page is routed, an in-page anchor stays on the page, an outside address is unchanged', () => {
    const appHref = (path: string): string => (path.startsWith('/') ? `#${path}` : path.startsWith('#') ? `#/guide${path}` : path)
    render(el({ content: 'See [Setup](/setup), [Options](#options) and [the spec](https://example.com/spec).\n\n## Options' }, { appHref }))
    expect(screen.getByText('Setup').getAttribute('href')).toBe('#/setup')
    expect(screen.getByText('Options', { selector: 'a' }).getAttribute('href')).toBe('#/guide#options')
    expect(screen.getByText('the spec').getAttribute('href')).toBe('https://example.com/spec')
    expect(root().querySelector('h2')?.id).toBe('options')
  })
})
