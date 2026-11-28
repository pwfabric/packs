/**
 * prose reading Markdown as a documentation site writes it: content that names
 * a tag in a code span is still Markdown, hard-wrapped lines are one paragraph,
 * heading anchors are GitHub's, code in a heading keeps the heading's size, a
 * wide table scrolls in its own box, and (opt-in) each heading links to itself.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { AppMessagesContext, BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ProseBlock, headingSlug, looksLikeHtml } from '../atoms/blocks/text/prose/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function el(props: Record<string, unknown>, context: Record<string, unknown> = {}, messages?: Record<string, string>): React.ReactElement {
  const Comp = ProseBlock as unknown as AnyBlock
  const block = (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied('prose', props)} block={{ id: 'p', type: 'prose', props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>
  )
  return messages ? <AppMessagesContext.Provider value={messages}>{block}</AppMessagesContext.Provider> : block
}
const body = (): HTMLElement => document.querySelector('#p [data-prose-id]') as HTMLElement

describe('prose: Markdown or HTML', () => {
  it('Markdown that names a tag in a code span is still Markdown', () => {
    render(el({ content: '# The `pwf` command line\n\nRun `pwf <command> --help`, or serve a <page> folder.' }))
    expect(body().querySelector('h1')?.textContent).toBe('The pwf command line')
    expect(body().querySelector('p code')?.textContent).toBe('pwf <command> --help')
    expect(body().textContent).not.toContain('# The')
  })

  it('content that starts with a tag is HTML', () => {
    expect(looksLikeHtml('<p>Hi</p>')).toBe(true)
    expect(looksLikeHtml('  \n<h2>Plans</h2>')).toBe(true)
    expect(looksLikeHtml('<!-- note --><p>x</p>')).toBe(true)
    expect(looksLikeHtml('Use `<dir>` here')).toBe(false)
    // A fragment that closes a tag outside code is HTML (a CMS body that starts with text).
    expect(looksLikeHtml('Intro <b>bold</b> word')).toBe(true)
    expect(looksLikeHtml('a <page> folder, `<dir>` and `</x>` in code')).toBe(false)
    // A void element never closes: text holding one outside code is HTML too.
    expect(looksLikeHtml('Line one<br>Line two')).toBe(true)
    expect(looksLikeHtml('See <img src="x.png" alt=""> here')).toBe(true)
    expect(looksLikeHtml('Rule <hr/> here')).toBe(true)
    expect(looksLikeHtml('Use `<br>` for a break')).toBe(false)
    // One <br> in a Markdown table, and a closing tag inside an indented fence, stay Markdown.
    expect(looksLikeHtml('| a | b |\n|---|---|\n| one<br>two | 2 |')).toBe(false)
    expect(looksLikeHtml('Text\n\n  ```html\n  <div>x</div>\n  ```')).toBe(false)
    expect(looksLikeHtml('Text\n\n```html\n<p>in a fence</p>\n```')).toBe(false)
    render(el({ content: '<h2 id="plans">Plans</h2><p>Two plans.</p>' }))
    expect(body().querySelector('h2#plans')?.textContent).toBe('Plans')
  })
})

describe('prose: paragraphs and list items run over lines', () => {
  it('hard-wrapped lines are one paragraph, up to a blank line', () => {
    render(el({ content: 'PWFabric turns a surface\ninto a live page,\nin a browser.\n\nA second paragraph.' }))
    const ps = [...body().querySelectorAll('p')].map((p) => p.textContent)
    expect(ps).toEqual(['PWFabric turns a surface into a live page, in a browser.', 'A second paragraph.'])
  })

  it('a paragraph ends where another block starts, without a blank line', () => {
    render(el({ content: 'Intro line\n## Next\nText\n- one\n- two\n```bash\npwf dev\n```\nAfter\n| a | b |\n|---|---|\n| 1 | 2 |' }))
    expect([...body().querySelectorAll('p')].map((p) => p.textContent)).toEqual(['Intro line', 'Text', 'After'])
    expect(body().querySelector('h2')?.textContent).toBe('Next')
    expect(body().querySelectorAll('li')).toHaveLength(2)
    expect(body().querySelector('pre')?.textContent).toBe('pwf dev')
    expect(body().querySelector('table')).not.toBeNull()
  })

  it('a wrapped list item carries its next lines; a nested item still nests', () => {
    render(el({ content: '- first item that\n  wraps onto a second line\n  - nested\n- second' }))
    const items = [...body().querySelectorAll(':scope > ul > li')]
    expect(items).toHaveLength(2)
    expect(items[0]?.firstChild?.textContent).toBe('first item that wraps onto a second line')
    expect(items[0]?.querySelector('ul > li')?.textContent).toBe('nested')
  })
})

describe('prose: anchors — compact by default, github on request', () => {
  it('github: punctuation is dropped and every space is a dash, runs kept', () => {
    expect(headingSlug('Track A — run an exported app', 'github')).toBe('track-a--run-an-exported-app')
    expect(headingSlug('Apache License 2.0', 'github')).toBe('apache-license-20')
    expect(headingSlug('`project.json`', 'github')).toBe('projectjson')
    expect(headingSlug('4. Fonts are the app’s own files', 'github')).toBe('4-fonts-are-the-apps-own-files')
    expect(headingSlug('Cross-origin requests (--cors)', 'github')).toBe('cross-origin-requests---cors')
    expect(headingSlug('— Intro', 'github')).toBe('intro')
    expect(headingSlug('Kurulum ve İlk Adım', 'github')).toBe('kurulum-ve-ilk-adim')
  })

  it('compact (the default) is what every app had: runs merged', () => {
    expect(headingSlug('Track A — run an exported app')).toBe('track-a-run-an-exported-app')
    expect(headingSlug('Apache License 2.0')).toBe('apache-license-2-0')
  })

  it('a repeated heading: -2, -3 by default; -1, -2 with anchors: github', () => {
    render(el({ content: '## Options\n\n## Options\n\n## Options' }))
    expect([...body().querySelectorAll('h2')].map((h) => h.id)).toEqual(['options', 'options-2', 'options-3'])
    cleanup()
    render(el({ content: '## Options\n\n## Options\n\n## Options', anchors: 'github' }))
    expect([...body().querySelectorAll('h2')].map((h) => h.id)).toEqual(['options', 'options-1', 'options-2'])
  })
})

describe('prose: what a documentation page needs', () => {
  it('code in a heading keeps the heading’s size', () => {
    render(el({ content: '# `defineBlock()`' }))
    const css = document.querySelector('#p style')?.textContent ?? ''
    expect(css).toMatch(/:is\(h1, h2, h3, h4, h5, h6\) code \{ font-size: inherit; \}/)
  })

  it('a table sits in a box that scrolls sideways', () => {
    render(el({ content: '| a | b |\n|---|---|\n| 1 | 2 |' }))
    const box = body().querySelector('[data-pw-prose-table]') as HTMLElement
    expect(box.firstElementChild?.tagName).toBe('TABLE')
    expect(document.querySelector('#p style')?.textContent).toMatch(/\[data-pw-prose-table\] \{ max-width: 100%; overflow-x: auto;/)
  })

  it('headingLinks: off by default; on, each h2–h4 links to itself through the app’s links, hidden from readers and the tab order', () => {
    render(el({ content: '## Options\n\n### Fields' }))
    expect(body().querySelector('[data-pw-prose-anchor]')).toBeNull()
    cleanup()
    const appHref = (h: string): string => (h.startsWith('#') ? `#/guide${h}` : h)
    render(el({ content: '# Title\n\n## Options\n\n### Fields', headingLinks: true }, { appHref }))
    expect(body().querySelector('h1 [data-pw-prose-anchor]')).toBeNull()
    const links = [...body().querySelectorAll('[data-pw-prose-anchor]')] as HTMLAnchorElement[]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#/guide#options', '#/guide#fields'])
    expect(links.every((a) => a.getAttribute('aria-hidden') === 'true' && a.tabIndex === -1)).toBe(true)
    expect(links[0]?.closest('h2')?.id).toBe('options')
    // The heading's accessible text is its own words, not "Options #".
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Options#')
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
