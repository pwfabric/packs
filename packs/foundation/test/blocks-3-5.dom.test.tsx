/**
 * Block behaviour for engine 3.5: heading anchors in prose, helpers that stay
 * inside their scroll box, whole-card and heading links, the definition list,
 * an accordion opened in full, intrinsic image sizes, and the `lang` prop.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ProseBlock, sanitizeHtml, headingSlug } from '../atoms/blocks/text/prose/component.js'
import { TableBlock } from '../atoms/blocks/data/table/component.js'
import { CopyButtonBlock } from '../atoms/blocks/control/copy-button/component.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { CardBlock } from '../atoms/blocks/container/card/component.js'
import { HeadingBlock } from '../atoms/blocks/text/heading/component.js'
import { ImageBlock, reservedSize } from '../atoms/blocks/media/image/component.js'
import { AccordionBlock } from '../atoms/blocks/container/accordion/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }

/**
 * A path-mode router's `context.appHref`. An `href` prop reaches a block
 * already rewritten by the host (`/app/menu`), so a block that ran it through
 * appHref again would write `/app/app/menu`.
 */
const pathHref = (path: string): string => (path.startsWith('/') && !path.startsWith('//') ? `/app${path}` : path)

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

/** The nearest ancestor an absolutely positioned element is placed against (inline styles). */
function containingBox(node: HTMLElement): HTMLElement | null {
  for (let p = node.parentElement; p; p = p.parentElement) {
    if (p.style.position && p.style.position !== 'static') return p
  }
  return null
}

describe('a visually hidden helper stays inside its own box', () => {
  it('table: the loading caption and the new-tab word are placed against the scroller', () => {
    mount(el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'A' }], data: [], loadingWhen: true, loadingText: 'Loading rows' }))
    const caption = screen.getByText('Loading rows')
    expect(caption.style.position).toBe('absolute')
    const box = containingBox(caption)
    expect(box?.style.overflowX).toBe('auto')
    cleanup()
    mount(
      el(TableBlock, 't2', 'table', {
        columns: [{ key: 'url', header: 'Link', type: 'link', newTab: true }],
        data: [{ url: 'https://example.com' }],
      }),
    )
    const hidden = [...document.querySelectorAll<HTMLElement>('#t2 span')].find((s) => s.style.position === 'absolute')
    expect(hidden).toBeTruthy()
    expect(document.getElementById('t2')?.contains(containingBox(hidden!))).toBe(true)
  })

  it('copy-button: the announced outcome is placed against the button', () => {
    mount(el(CopyButtonBlock, 'cb', 'copy-button', { value: 'x', label: 'Copy' }))
    const status = screen.getByRole('status')
    expect(containingBox(status)?.id).toBe('cb')
  })

  it('input: a hidden label is placed against the field', () => {
    mount(el(InputBlock, 'in', 'input', { label: 'Email', hideLabel: true }))
    const label = screen.getByText('Email')
    expect(label.style.position).toBe('absolute')
    expect(containingBox(label)?.getAttribute('data-block-id')).toBe('in')
  })
})

describe('card href: the whole card is one link', () => {
  const title = <h3 id="card-title">Seasonal menu</h3>

  it('a cover link fills the card, named by its first heading, its href as the host wrote it', async () => {
    mount(el(CardBlock, 'c', 'card', { href: '/app/menu' }, { appHref: pathHref }, <>{title}<p>Spring dishes</p></>))
    const card = document.getElementById('c') as HTMLElement
    expect(card.style.position).toBe('relative')
    const links = card.querySelectorAll('a')
    expect(links).toHaveLength(1)
    const cover = links[0] as HTMLAnchorElement
    expect(cover.getAttribute('href')).toBe('/app/menu')
    expect(cover.style.position).toBe('absolute')
    expect(cover.style.inset).toMatch(/^0(px)?$/)
    expect(screen.getByRole('link', { name: 'Seasonal menu' })).toBe(cover)
  })

  it('hrefLabel names it; a control inside is lifted above the cover', () => {
    mount(el(CardBlock, 'c', 'card', { href: 'https://example.com', hrefLabel: 'Open the menu' }, {}, <button type="button">Save</button>))
    expect(screen.getByRole('link', { name: 'Open the menu' }).getAttribute('href')).toBe('https://example.com')
    expect(document.querySelector('#c style')?.textContent).toContain(':not([data-pw-card-cover]) { position: relative; z-index: 1; }')
  })

  it('no href (or a bare #, or an unsafe one) draws no link', () => {
    for (const href of [undefined, '#', 'javascript:alert(1)']) {
      mount(el(CardBlock, 'c', 'card', href === undefined ? {} : { href }, {}, title))
      expect(document.querySelector('#c a')).toBeNull()
      expect((document.getElementById('c') as HTMLElement).style.position).toBe('')
      cleanup()
    }
  })

  it('in the editor a click reports the destination and stays', () => {
    const { events } = mount(el(CardBlock, 'c', 'card', { href: '/menu' }, { interactionMode: 'inert' }, title))
    const cover = document.querySelector('#c a') as HTMLAnchorElement
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    cover.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(events).toContainEqual(expect.objectContaining({ type: 'block:click', blockId: 'c', payload: { href: '/menu' } }))
  })
})

describe('heading href and lang', () => {
  it('the heading holds a link to the page, its href as the host wrote it', () => {
    mount(el(HeadingBlock, 'h', 'heading', { text: 'Launch notes', level: 'h2', href: '/app/blog/launch' }, { appHref: pathHref }))
    const h = document.getElementById('h') as HTMLElement
    expect(h.tagName).toBe('H2')
    const a = h.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/app/blog/launch')
    expect(a.textContent).toBe('Launch notes')
    expect(screen.getByRole('heading', { name: 'Launch notes' })).toBe(h)
    // The link's look is not inside the heading.
    expect(h.querySelector('style')).toBeNull()
  })

  it('an editor click reports the destination', () => {
    const { events } = mount(el(HeadingBlock, 'h', 'heading', { text: 'Launch', href: '/blog' }, { interactionMode: 'inert' }))
    fireEvent.click(screen.getByRole('link', { name: 'Launch' }))
    expect(events).toContainEqual(expect.objectContaining({ type: 'block:click', payload: { href: '/blog' } }))
  })

  it('lang is set on the heading element so uppercase follows it', () => {
    mount(el(HeadingBlock, 'h', 'heading', { text: 'Discover', uppercase: true, lang: 'en' }))
    const h = document.getElementById('h') as HTMLElement
    expect(h.getAttribute('lang')).toBe('en')
    expect(h.style.textTransform).toBe('uppercase')
    cleanup()
    mount(el(HeadingBlock, 'h', 'heading', { text: 'Discover', lang: '<x>' }))
    expect(document.getElementById('h')?.hasAttribute('lang')).toBe(false)
  })
})

describe('image: width and height attributes are the picture\'s proportions, whatever its CSS size', () => {
  const attrs = (props: Record<string, unknown>): [string | null, string | null, string] => {
    mount(el(ImageBlock, 'i', 'image', { src: 'https://example.com/a.jpg', alt: 'A', ...props }))
    const img = document.getElementById('i') as HTMLImageElement
    const out: [string | null, string | null, string] = [img.getAttribute('width'), img.getAttribute('height'), img.style.width]
    cleanup()
    return out
  }

  it('from the author\'s pixel width and height', () => {
    expect(attrs({ width: 320, height: 200 })).toEqual(['320', '200', '320px'])
  })

  it('from aspectRatio when the CSS width is a layout size', () => {
    expect(attrs({ width: '100%', aspectRatio: '16/9' })).toEqual(['1000', '563', '100%'])
  })

  it('from aspectRatio when the CSS size is auto (a logo at its natural size)', () => {
    const [w, h, css] = attrs({ width: 'auto', height: 'auto', aspectRatio: '4/1' })
    expect([w, h]).toEqual(['1000', '250'])
    // The inline auto still sizes the picture; the attributes give the ratio only.
    expect(css).toBe('auto')
  })

  it('one pixel side and a ratio give the other side', () => {
    expect(reservedSize(400, undefined, '4:3')).toEqual({ width: 400, height: 300 })
    expect(reservedSize('100%', '240px', '3/2')).toEqual({ width: 360, height: 240 })
    expect(reservedSize('100%', undefined, undefined)).toEqual({})
  })
})

describe('accordion openAll: a FAQ read top to bottom', () => {
  const items = [
    { id: 'a', title: 'Do you deliver?', content: 'Within the city.' },
    { id: 'b', title: 'Can I pay by card?', content: 'Yes.' },
  ]

  it('every item starts open, and closing one leaves the others', () => {
    mount(el(AccordionBlock, 'acc', 'accordion', { items, openAll: true }))
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true'])
    expect(screen.getByText('Within the city.')).toBeTruthy()
    fireEvent.click(buttons[0]!)
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'true'])
    fireEvent.click(buttons[0]!)
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true'])
  })

  it('without it, defaultOpen still decides', () => {
    mount(el(AccordionBlock, 'acc', 'accordion', { items, defaultOpen: ['b'] }))
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'true'])
  })

  it('an open panel has no height cap: it opens to its content, a long answer is not clipped', () => {
    const long = 'A long answer. '.repeat(400)
    mount(el(AccordionBlock, 'acc', 'accordion', { items: [{ id: 'a', title: 'Long', content: long }], openAll: true }))
    const panel = document.getElementById('acc-panel-a') as HTMLElement
    expect(panel.style.maxHeight).toBe('')
    expect(panel.style.display).toBe('grid')
    expect(panel.style.gridTemplateRows).toBe('1fr')
    expect(panel.style.transition).toContain('grid-template-rows var(--pw-duration-slow')
    expect(panel.hasAttribute('inert')).toBe(false)
    expect(panel.textContent).toBe(long)
    // Nothing inside caps it either.
    expect([...panel.querySelectorAll<HTMLElement>('*')].every((n) => n.style.maxHeight === '')).toBe(true)
  })

  it('closed, the panel folds to 0fr and leaves the keyboard and the accessibility tree', () => {
    mount(el(AccordionBlock, 'acc', 'accordion', { items }))
    const panel = document.getElementById('acc-panel-a') as HTMLElement
    expect(panel.style.gridTemplateRows).toBe('0fr')
    expect(panel.style.visibility).toBe('hidden')
    expect(panel.hasAttribute('inert')).toBe(true)
    fireEvent.click(screen.getAllByRole('button')[0]!)
    expect(panel.style.gridTemplateRows).toBe('1fr')
    expect(panel.style.visibility).toBe('visible')
    expect(panel.hasAttribute('inert')).toBe(false)
  })

  it('a visitor who asks for less motion gets no transition', () => {
    mount(el(AccordionBlock, 'acc', 'accordion', { items }))
    expect(document.querySelector('#acc style')?.textContent).toBe(
      '@media (prefers-reduced-motion: reduce) { [data-pw-accordion-panel] { transition: none !important; } }',
    )
  })
})
