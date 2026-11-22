/**
 * Shared pass 4 (B) — a block's own words come from the app (ui.*), the
 * modal's first focus, and the table's loading frame, image column and
 * derived number columns.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { AppMessagesContext, BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TableBlock } from '../atoms/blocks/data/table/component.js'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { ModalBlock } from '../atoms/blocks/overlay/modal/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function el(
  C: unknown,
  id: string,
  type: string,
  props: Record<string, unknown>,
  opts: { children?: React.ReactNode; context?: Record<string, unknown>; messages?: Record<string, string> } = {}
) {
  const Comp = C as AnyBlock
  const block = (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...(opts.context ?? {}) }}>
        {opts.children}
      </Comp>
    </BehaviorSurfaceProvider>
  )
  return opts.messages ? <AppMessagesContext.Provider value={opts.messages}>{block}</AppMessagesContext.Provider> : block
}

describe('table: loading frame, image column, derived numbers, the app’s words', () => {
  const columns = [{ key: 'label', header: 'Time' }, { key: 'temp', header: 'Temperature' }]

  it('draws loadingRows skeleton rows (default 3), each a line of text tall', () => {
    render(el(TableBlock, 't', 'table', { columns, data: [], loadingWhen: true }))
    expect(document.querySelectorAll('tbody tr[aria-busy]').length).toBe(3)
    cleanup()
    render(el(TableBlock, 't', 'table', { columns, data: [], loadingWhen: true, loadingRows: 24 }))
    const rows = document.querySelectorAll('tbody tr[aria-busy]')
    expect(rows.length).toBe(24)
    // The bar is inline in the cell, so the row takes the line height a loaded row has.
    const bar = rows[0]!.querySelector('td div') as HTMLElement
    expect(bar.style.display).toBe('inline-block')
    // A phone card of the same shape as a loaded one.
    expect(rows[0]!.querySelector('td')!.getAttribute('data-label')).toBe('Time')
  })

  it('an image column draws the picture itself, named by altKey, with no circle', () => {
    render(
      el(TableBlock, 't', 'table', {
        columns: [{ key: 'icon', header: 'Sky', type: 'image', altKey: 'sky', imageSize: 40 }, { key: 'sky', header: 'Conditions' }],
        data: [{ icon: 'pwpack/media/sun.svg', sky: 'Sunny' }],
      })
    )
    const img = screen.getByRole('img', { name: 'Sunny' }) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('pwpack/media/sun.svg')
    expect(img.style.objectFit).toBe('contain')
    expect(img.style.borderRadius).toBe('')
    expect(img.getAttribute('width')).toBe('40')
  })

  it('an avatar beside its name is decorative; the name is not read twice', () => {
    render(
      el(TableBlock, 't', 'table', {
        columns: [{ key: 'name', header: 'Name', type: 'avatar', avatarKey: 'photo' }],
        data: [{ name: 'Ada Lovelace', photo: 'pwpack/media/ada.svg' }],
      })
    )
    expect(document.querySelector('img')!.getAttribute('alt')).toBe('')
    expect(document.body.textContent).not.toContain('Avatar for')
  })

  it('derived columns type a numeric column as a number: grouped and right-aligned', () => {
    render(
      el(TableBlock, 't', 'table', { columnsFrom: 'data', data: [{ Region: 'North', Revenue: 1284000 }, { Region: 'South', Revenue: 2500 }] }, { context: { locale: 'en-GB' } })
    )
    expect(document.body.textContent).toContain('1,284,000')
    const th = [...document.querySelectorAll('th')].find((t) => t.textContent === 'Revenue')!
    expect(th.style.textAlign).toBe('right')
  })

  it('its own words are the app’s (ui.table.*)', () => {
    render(
      el(TableBlock, 't', 'table', { columns, data: [{ label: '09:00', temp: 4 }], selectable: true, filterable: true }, {
        messages: { 'ui.table.selectAll': 'Alle Zeilen wählen', 'ui.table.selectRow': 'Zeile {n} wählen', 'ui.table.filter': 'Filtern…' },
      })
    )
    expect(screen.getByRole('checkbox', { name: 'Alle Zeilen wählen' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Zeile 1 wählen' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Filtern…')).toBeTruthy()
  })

  it('without an app word the pack writes none of its own (engine 3.0.1: no default words)', () => {
    render(el(TableBlock, 't', 'table', { columns, data: [{ label: '09:00', temp: 4 }], selectable: true }, { messages: {} }))
    expect(document.body.textContent).not.toContain('Select row')
    expect(document.querySelector('[aria-label="Select row 1"]')).toBeNull()
  })
})

describe('navbar: the menu button and the bar landmark are named in the app’s words', () => {
  it('ui.menu.open / ui.menu.close / ui.nav.main', async () => {
    render(
      el(NavbarBlock, 'nav', 'navbar', { logoText: 'Beispiel', links: [{ label: 'Über uns', href: '#about' }] }, {
        context: { viewport: 'xs' },
        messages: { 'ui.menu.open': 'Menü öffnen', 'ui.menu.close': 'Menü schließen', 'ui.nav.main': 'Haupt' },
      })
    )
    const button = screen.getByRole('button', { name: 'Menü öffnen' })
    await act(async () => fireEvent.click(button))
    expect(button.getAttribute('aria-label')).toBe('Menü schließen')
    expect(screen.getAllByRole('navigation', { name: 'Haupt' }).length).toBeGreaterThan(0)
  })

  it('the signed-in account trigger is named by ui.account.menu', () => {
    render(
      el(NavbarBlock, 'nav', 'navbar', { logoText: 'Beispiel', account: { state: 'signed-in', name: 'Ada' } }, {
        messages: { 'ui.account.menu': 'Konto von {name}' },
      })
    )
    // One trigger per form of the bar (wide and narrow); CSS shows one.
    expect(screen.getAllByRole('button', { name: 'Konto von Ada' }).length).toBeGreaterThan(0)
  })
})

describe('modal: first focus does not read the close button’s name', () => {
  it('a close button named in another language is still skipped for the first content control', () => {
    render(
      el(ModalBlock, 'md', 'modal', { title: 'Suche', triggerLabel: 'Suchen' }, {
        children: <input aria-label="Suchbegriff" />,
        messages: { 'ui.close': 'Schließen' },
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }))
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Suchbegriff' }))
  })

  it('opening turns visibility on at once (a visibility transition starts hidden and focus() is ignored)', () => {
    render(el(ModalBlock, 'md', 'modal', { title: 'Search', triggerLabel: 'Search' }, { children: <input aria-label="Query" /> }))
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    const overlay = screen.getByRole('dialog').parentElement as HTMLElement
    expect(overlay.style.visibility).toBe('visible')
    expect(overlay.style.transition).not.toContain('visibility')
  })
})
