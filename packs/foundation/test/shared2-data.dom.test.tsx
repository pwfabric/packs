/**
 * Shared pass 2 — data, text and control blocks:
 * table states, number grouping and phone rows; money whole
 * amounts and an absent compareAt; split-view headings, ARIA and growth;
 * prose code spans; code surface tokens; link with a relative media href;
 * real 44px phone boxes; an empty breadcrumb draws nothing.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TableBlock, formatNumberCell } from '../atoms/blocks/data/table/component.js'
import { MoneyBlock } from '../atoms/blocks/data/money/component.js'
import { SplitViewBlock, bodyParagraphs } from '../atoms/blocks/layout/split-view/component.js'
import { ProseBlock } from '../atoms/blocks/text/prose/component.js'
import { CodeBlock } from '../atoms/blocks/text/code/component.js'
import { LinkBlock } from '../atoms/blocks/control/link/component.js'
import { ButtonBlock } from '../atoms/blocks/control/button/component.js'
import { CopyButtonBlock } from '../atoms/blocks/control/copy-button/component.js'
import { BreadcrumbBlock } from '../atoms/blocks/control/breadcrumb/component.js'
import { PaginationBlock } from '../atoms/blocks/control/pagination/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

const here = dirname(fileURLToPath(import.meta.url))
const atoms = join(here, '..', 'atoms')

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode, locale?: string) {
  const Comp = C as AnyBlock
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...(locale ? { locale } : {}) }}>
        {children}
      </Comp>
    </BehaviorSurfaceProvider>
  )
}
const styles = (): string => [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')

describe('table: empty, loading and error words; numbers grouped; compact phone rows', () => {
  const columns = [{ key: 'hour', header: 'Hour' }, { key: 'reach', header: 'Reach', type: 'number', align: 'right' }]

  it('a number column groups thousands by the app locale', () => {
    expect(formatNumberCell(12480, 2, 'en-GB')).toBe('12,480')
    expect(formatNumberCell(12480.456, 1, 'de-DE')).toBe('12.480,5')
    expect(formatNumberCell('n/a', 2, 'en-GB')).toBe('n/a')
    render(el(TableBlock, 't', 'table', { columns, data: [{ hour: '09:00', reach: 1284000 }] }, undefined, 'en-GB'))
    expect(document.body.textContent).toContain('1,284,000')
  })

  it('errorText is the visible message, not the raw error', () => {
    render(el(TableBlock, 't', 'table', { columns, data: [], errorWhen: 'HTTP 500 at /records', errorText: 'The readings could not be loaded.' }))
    expect(screen.getByRole('alert').textContent).toBe('The readings could not be loaded.')
  })

  it('emptyText shows with no rows; loadingText is announced while loading', () => {
    render(el(TableBlock, 't', 'table', { columns, data: [], emptyText: 'No readings yet.' }))
    expect(document.body.textContent).toContain('No readings yet.')
    cleanup()
    render(el(TableBlock, 't', 'table', { columns, data: [], loadingWhen: true, loadingText: 'Loading readings…', emptyText: 'No readings yet.' }))
    expect(document.querySelector('table')!.getAttribute('aria-busy')).toBe('true')
    expect(document.querySelector('caption')!.textContent).toBe('Loading readings…')
    expect(document.body.textContent).not.toContain('No readings yet.')
  })

  it('phoneLayout "rows" opts out of the stacked cards', () => {
    render(el(TableBlock, 't', 'table', { columns, data: [{ hour: '09:00', reach: 1 }], phoneLayout: 'rows' }))
    const table = document.querySelector('table')!
    expect(table.hasAttribute('data-pw-table')).toBe(false)
    expect(table.hasAttribute('data-pw-table-rows')).toBe(true)
    cleanup()
    render(el(TableBlock, 't', 'table', { columns, data: [{ hour: '09:00', reach: 1 }] }))
    expect(document.querySelector('table')!.hasAttribute('data-pw-table')).toBe(true)
  })

  it('fixedLayout fixes the table layout and column widths reach the header cells', () => {
    render(el(TableBlock, 't', 'table', { columns: [{ key: 'a', header: 'A', width: '34%' }], data: [], fixedLayout: true }))
    expect(document.querySelector('table')!.style.tableLayout).toBe('fixed')
    expect((document.querySelector('th') as HTMLElement).style.width).toBe('34%')
  })
})

describe('money: whole amounts and an absent compareAt', () => {
  it('whole prints "€249", not "€249.00"', () => {
    render(el(MoneyBlock, 'm', 'money', { amount: 249, currency: 'EUR', locale: 'en-GB', whole: true }))
    expect(document.body.textContent).toBe('€249')
  })

  it('compareAt may be null or absent', () => {
    // Applying the manifest keeps the amount and leaves compareAt absent.
    expect(applied('money', { amount: 1, compareAt: null }).amount).toBe(1)
    expect(applied('money', { amount: 1, compareAt: null }).compareAt ?? undefined).toBeUndefined()
    expect(applied('money', { amount: 1 }).amount).toBe(1)
    render(el(MoneyBlock, 'm', 'money', { amount: 249, currency: 'EUR', locale: 'en-GB', compareAt: null }))
    expect(document.body.textContent).toBe('€249.00')
  })

  it('sizes come from the theme type scale', () => {
    render(el(MoneyBlock, 'm', 'money', { amount: 1, currency: 'EUR', size: 'md' }))
    expect((document.querySelector('[data-block-type="money"] span') as HTMLElement).style.fontSize).toContain('--pw-font-size-')
  })
})

describe('split-view: the page owns the h1, the listbox holds only options, the body keeps its breaks', () => {
  const items = [
    { id: 'a', title: 'Create a payment', body: 'First line.\nSecond line.\n\nA new paragraph.' },
    { id: 'b', title: 'Refund a payment', body: 'Refunds.' },
  ]

  it('no heading before the detail title; the list title labels the listbox from outside', () => {
    render(el(SplitViewBlock, 'ref', 'split-view', { items, listTitle: 'Endpoints' }))
    const headings = screen.getAllByRole('heading')
    expect(headings.map((h) => h.tagName)).toEqual(['H2'])
    const box = screen.getByRole('listbox')
    expect(box.getAttribute('aria-labelledby')).toBe('ref-list-title')
    expect(box.querySelector('h1,h2,h3,p')).toBeNull()
    for (const child of [...box.children]) expect(child.getAttribute('role')).toBe('option')
  })

  it('titleLevel h1 is available where the split view is the whole page', () => {
    render(el(SplitViewBlock, 'ref', 'split-view', { items, titleLevel: 'h1' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Create a payment' })).toBeTruthy()
  })

  it('the body keeps line breaks and paragraphs', () => {
    expect(bodyParagraphs('One.\nTwo.\n\nThree.')).toEqual(['One.\nTwo.', 'Three.'])
    render(el(SplitViewBlock, 'ref', 'split-view', { items }))
    const ps = document.querySelectorAll('[data-pw-split-detail] p')
    expect(ps.length).toBe(2)
    expect((ps[0] as HTMLElement).style.whiteSpace).toBe('pre-line')
  })

  it('a document detail is not a fixed-height box', () => {
    render(el(SplitViewBlock, 'ref', 'split-view', { items, height: '600px' }))
    const root = document.querySelector('[data-block-type="split-view"]') as HTMLElement
    expect(root.style.height).toBe('auto')
    expect((document.querySelector('[data-pw-split-detail]') as HTMLElement).style.overflowY).toBe('')
  })

  it('listbox keyboard: roving tabindex, ArrowDown / End / Home select', async () => {
    render(el(SplitViewBlock, 'ref', 'split-view', { items }))
    const opts = screen.getAllByRole('option')
    expect(opts.map((o) => o.tabIndex)).toEqual([0, -1])
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'End' })
    })
    expect(screen.getByRole('heading', { name: 'Refund a payment' })).toBeTruthy()
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Home' })
    })
    expect(screen.getByRole('heading', { name: 'Create a payment' })).toBeTruthy()
  })
})

describe('prose: `_` inside inline code is not emphasis', () => {
  it('snake_case in a code span and in plain words stays as written', () => {
    render(el(ProseBlock, 'p', 'prose', { content: 'Send `pm_card_example_test` as payment_method, or _really_ not.' }))
    const code = document.querySelector('code')!
    expect(code.textContent).toBe('pm_card_example_test')
    expect(code.querySelector('em')).toBeNull()
    expect(document.body.textContent).toContain('payment_method')
    expect(document.querySelectorAll('em').length).toBe(1)
    expect(document.querySelector('em')!.textContent).toBe('really')
  })

  it('a code span is escaped once ("a<b", not "a&lt;b")', () => {
    render(el(ProseBlock, 'p', 'prose', { content: 'Compare `a<b` here.' }))
    expect(document.querySelector('code')!.textContent).toBe('a<b')
  })
})

describe('code: its surface is a token, and a dark tone exists', () => {
  it('reads --pw-color-code-surface first; tone dark sets the code tokens', () => {
    render(el(CodeBlock, 'c', 'code', { code: 'x', tone: 'dark' }))
    const root = document.querySelector('[data-block-type="code"]') as HTMLElement
    expect(root.style.backgroundColor).toContain('--pw-color-code-surface')
    expect(root.style.getPropertyValue('--pw-color-code-surface')).toBe('#0f172a')
  })
})

describe('link: a relative media path is a link', () => {
  it('pwpack/media/receipt.pdf renders an <a>, not a <span>', () => {
    render(el(LinkBlock, 'l', 'link', { text: 'Receipt (PDF)', href: 'pwpack/media/receipt.pdf' }))
    expect(screen.getByRole('link', { name: 'Receipt (PDF)' }).getAttribute('href')).toBe('pwpack/media/receipt.pdf')
  })
})

describe('touch targets: real 44px boxes on a phone', () => {
  it('button sm/md, copy-button, link and breadcrumb links carry the phone min-height rule', () => {
    render(el(ButtonBlock, 'b', 'button', { label: 'Save', size: 'small' }))
    expect(document.querySelector('button')!.hasAttribute('data-pw-btn-touch')).toBe(true)
    expect(styles()).toMatch(/max-width: 640px\), \(pointer: coarse\) \{ \[data-pw-btn-touch\] \{ min-height: 44px/)
    cleanup()
    render(el(CopyButtonBlock, 'cb', 'copy-button', { value: 'x', label: 'Copy' }))
    expect(document.querySelector('button')!.hasAttribute('data-pw-touch')).toBe(true)
    cleanup()
    render(el(LinkBlock, 'l', 'link', { text: 'Docs', href: '/docs' }))
    expect(screen.getByRole('link').hasAttribute('data-pw-touch')).toBe(true)
    cleanup()
    render(el(BreadcrumbBlock, 'bc', 'breadcrumb', { items: [{ label: 'Guides', href: '/guides' }, { label: 'Webhooks' }] }))
    expect(screen.getByRole('link', { name: 'Guides' }).hasAttribute('data-pw-crumb')).toBe(true)
    expect(styles()).toContain('[data-pw-crumb] { display: inline-flex; align-items: center; min-height: 44px')
  })

  it('pagination buttons become 44×44 with 8px between them on a phone', () => {
    render(el(PaginationBlock, 'pg', 'pagination', { totalPages: 3, currentPage: 1 }))
    expect(styles()).toContain('[data-pw-pagination] > [data-pw-hit] { min-width: 44px; height: 44px; }')
    expect(styles()).toContain('[data-pw-pagination] { gap: 8px; }')
  })

  it('a current button carries aria-current="page"', () => {
    render(el(ButtonBlock, 'b', 'button', { label: 'Overview', current: true }))
    expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
  })
})

describe('breadcrumb: no crumbs, no landmark; list children are list items', () => {
  it('items [] or missing renders nothing', () => {
    const { container } = render(el(BreadcrumbBlock, 'bc', 'breadcrumb', { items: [] }))
    expect(container.querySelector('nav')).toBeNull()
    cleanup()
    const r2 = render(el(BreadcrumbBlock, 'bc', 'breadcrumb', {}))
    expect(r2.container.querySelector('nav')).toBeNull()
  })

  it('every child of the <ol> is an <li> (the separator sits inside)', () => {
    render(el(BreadcrumbBlock, 'bc', 'breadcrumb', { items: [{ label: 'Guides', href: '/guides' }, { label: 'Webhooks' }] }))
    const ol = document.querySelector('ol')!
    for (const c of [...ol.children]) expect(c.tagName).toBe('LI')
  })
})

// The manifest declares every prop the schemas gained.
describe('manifests carry the new props', () => {
  const props = (rel: string): string[] => JSON.parse(readFileSync(join(atoms, 'blocks', rel, 'manifest.json'), 'utf8')).definition.props.map((p: { name: string }) => p.name)
  it('table, money, split-view, code, button', () => {
    expect(props('data/table')).toEqual(expect.arrayContaining(['errorText', 'loadingText', 'phoneLayout', 'fixedLayout']))
    expect(props('data/money')).toEqual(expect.arrayContaining(['whole', 'compareAt']))
    expect(props('layout/split-view')).toContain('titleLevel')
    expect(props('text/code')).toContain('tone')
    expect(props('control/button')).toContain('current')
  })
})
