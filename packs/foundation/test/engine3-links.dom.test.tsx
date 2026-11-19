/**
 * Engine 3.0 adoption — links a block builds itself are written by
 * `context.appHref`, a table link can open in a new tab, and the account
 * menu's ids come from React.useId (the build and the browser agree).
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TableBlock } from '../atoms/blocks/data/table/component.js'
import { ProseBlock, sanitizeHtml } from '../atoms/blocks/text/prose/component.js'
import { AccountControl } from '../atoms/lib/_shared-account-menu.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

/** The runner's hash rule, as `context.appHref` gives it. */
const hashHref = (path: string): string =>
  path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/pwpack/media/') ? `#${path}` : path

type AnyBlock = React.FC<Record<string, unknown>>
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, context: Record<string, unknown> = {}) {
  const Comp = C as AnyBlock
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>
  )
}

describe('prose: a markdown or HTML link to an app page is written by appHref', () => {
  it('rewrites an in-app path; leaves absolute URLs, fragments and media links', () => {
    render(el(ProseBlock, 'p', 'prose', { content: '[Webhooks](/webhooks?x=1) and [Stripe](https://stripe.com) and [Up](#top) and [PDF](pwpack/media/menu.pdf)' }, { appHref: hashHref }))
    expect(screen.getByText('Webhooks').getAttribute('href')).toBe('#/webhooks?x=1')
    expect(screen.getByText('Stripe').getAttribute('href')).toBe('https://stripe.com')
    expect(screen.getByText('Up').getAttribute('href')).toBe('#top')
    expect(screen.getByText('PDF').getAttribute('href')).toBe('pwpack/media/menu.pdf')
    expect(sanitizeHtml('<a href="/reference">Ref</a>', hashHref)).toBe('<a href="#/reference">Ref</a>')
  })

  it('without appHref (outside a runtime) writes the path as given', () => {
    render(el(ProseBlock, 'p', 'prose', { content: '[Webhooks](/webhooks)' }))
    expect(screen.getByText('Webhooks').getAttribute('href')).toBe('/webhooks')
  })

  it('appHref never sees an unsafe link: it is dropped first', () => {
    const seen: string[] = []
    const spy = (p: string): string => (seen.push(p), p)
    sanitizeHtml('<a href="javascript:alert(1)">x</a>', spy)
    expect(seen).toEqual([])
  })
})

describe('table: link cells through appHref, and a new-tab column', () => {
  const data = [{ id: 7, subject: 'Quarterly numbers', url: 'https://outlook.office.com/mail/7' }]

  it('a hrefTemplate cell is the router form of the page', () => {
    render(
      el(TableBlock, 't', 'table', { columns: [{ key: 'subject', header: 'Subject', type: 'link', hrefTemplate: '/mail?id={id}' }], data }, { appHref: hashHref })
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('#/mail?id=7')
    expect(screen.getByRole('link').getAttribute('target')).toBeNull()
  })

  it('newTab opens in a new tab, says so, and an absolute URL is kept', () => {
    render(
      el(
        TableBlock,
        't',
        'table',
        { columns: [{ key: 'subject', header: 'Subject', type: 'link', hrefKey: 'url', newTab: true }], data },
        { appHref: hashHref }
      )
    )
    const link = screen.getByRole('link', { name: /Quarterly numbers.*opens in a new tab/ })
    expect(link.getAttribute('href')).toBe('https://outlook.office.com/mail/7')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('an in-app new-tab link carries the router form, so the new tab opens that page', () => {
    render(
      el(TableBlock, 't', 'table', { columns: [{ key: 'subject', header: 'Subject', type: 'link', hrefTemplate: '/mail?id={id}', newTab: true }], data }, { appHref: hashHref })
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('#/mail?id=7')
  })
})

describe('account menu: ids from useId', () => {
  const account = { state: 'signed-in' as const, name: 'Ada Lovelace', email: 'ada@example.com' }
  const tree = () => (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <AccountControl
        account={account}
        blockId="nav"
        inert={false}
        presentation="popover"
        renderTrigger={(t) => <button {...t}>open</button>}
      />
    </BehaviorSurfaceProvider>
  )

  it('the same id on every render of the same tree (build and hydration agree)', () => {
    const a = renderToString(tree())
    const b = renderToString(tree())
    expect(a).toBe(b)
  })

  it('aria-labelledby names the trigger', () => {
    render(tree())
    const trigger = screen.getByRole('button', { name: /account menu/ })
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu')
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id)
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id)
  })
})
