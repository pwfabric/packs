/**
 * Block behaviour for engine 3.5: heading anchors in prose, helpers that stay
 * inside their scroll box, whole-card and heading links, the definition list,
 * an accordion opened in full, intrinsic image sizes, and the `lang` prop.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ProseBlock, sanitizeHtml, headingSlug } from '../atoms/blocks/text/prose/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }

/** The runner's hash rule, as `context.appHref` gives it. */
const hashHref = (path: string): string =>
  path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/pwpack/media/') ? `#${path}` : path

function el(
  C: unknown,
  id: string,
  type: string,
  props: Record<string, unknown>,
  context: Record<string, unknown> = {},
  children?: React.ReactNode,
): React.ReactElement {
  const Comp = C as AnyBlock
  return (
    <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...context }}>
      {children}
    </Comp>
  )
}

function mount(tree: React.ReactElement): { events: Ev[]; container: HTMLElement } {
  const events: Ev[] = []
  const { container } = render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      {tree}
    </BehaviorSurfaceProvider>,
  )
  return { events, container }
}

describe('prose: headings carry anchor ids', () => {
  it('a Markdown heading gets a slug id, unique within the block', () => {
    mount(el(ProseBlock, 'p', 'prose', { content: '## Getting started\n\ntext\n\n## Options\n\n### Options\n\n## Options-2\n\n## Kurulum ve İlk Adım\n\n## `pwf` **build**' }))
    const ids = [...document.querySelectorAll('#p h2, #p h3')].map((h) => h.id)
    expect(ids).toEqual(['getting-started', 'options', 'options-2', 'options-2-2', 'kurulum-ve-ilk-adim', 'pwf-build'])
  })

  it('a heading with no letter or digit is still an anchor', () => {
    expect(headingSlug('—')).toBe('section')
    expect(headingSlug('Şehir ışıkları')).toBe('sehir-isiklari')
  })

  it('the sanitizer keeps a plain heading id and drops anything else', () => {
    expect(sanitizeHtml('<h2 id="api-reference">API</h2>')).toBe('<h2 id="api-reference">API</h2>')
    expect(sanitizeHtml('<h3 id="a b">x</h3>')).toBe('<h3>x</h3>')
    expect(sanitizeHtml('<h3 id="x&quot; onclick=&quot;y">x</h3>')).toBe('<h3>x</h3>')
    expect(sanitizeHtml('<h4 id="">x</h4>')).toBe('<h4>x</h4>')
    expect(sanitizeHtml(`<h2 id="${'a'.repeat(101)}">x</h2>`)).toBe('<h2>x</h2>')
    // Only headings: an id elsewhere is still dropped.
    expect(sanitizeHtml('<p id="x">y</p>')).toBe('<p>y</p>')
  })
})
