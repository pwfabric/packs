/**
 * money: the amount is printed in a locale that fits the currency or the
 * context (never a bare "TRY 95.00").
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ImageBlock } from '../atoms/blocks/media/image/component.js'
import { ButtonBlock } from '../atoms/blocks/control/button/component.js'
import { SelectBlock, normaliseOptions } from '../atoms/blocks/form/select/component.js'
import { GridBlock } from '../atoms/blocks/layout/grid/component.js'
import { MoneyBlock, moneyLocale } from '../atoms/blocks/data/money/component.js'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { InputBlock } from '../atoms/blocks/form/input/component.js'
import { SegmentedControlBlock } from '../atoms/blocks/form/segmented-control/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, '..', 'atoms')
const readJson = (rel: string) => JSON.parse(readFileSync(join(src, rel), 'utf8'))

afterEach(() => cleanup())

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }
type AnyBlock = React.FC<Record<string, unknown>>
const LIVE = { interactionMode: 'live' }
const INERT = { interactionMode: 'inert' }

function el(
  C: unknown,
  id: string,
  type: string,
  props: Record<string, unknown>,
  children?: React.ReactNode,
  context: Record<string, unknown> = LIVE,
  blockExtra: Record<string, unknown> = {}
) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {}, ...blockExtra }} context={context}>
      {children}
    </Comp>
  )
}

function withBus(tree: React.ReactNode, events: Ev[]) {
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      {tree}
    </BehaviorSurfaceProvider>
  )
}

type Node = { id?: string; type?: string; props?: Record<string, unknown>; children?: Node[] }
const walk = (n: Node, out: Node[] = []): Node[] => {
  out.push(n)
  for (const c of n.children ?? []) walk(c, out)
  return out
}



describe('money is printed in a locale that fits the currency', () => {
  it('TRY without a locale prints as Turkish lira ("₺95,00"), not "TRY 95.00"', () => {
    const { container } = render(el(MoneyBlock, 'm', 'money', { amount: 95, currency: 'TRY' }))
    expect(container.textContent).toContain('₺95,00')
    expect(container.textContent).not.toContain('TRY')
  })

  it('a locale from the render context wins over the currency default', () => {
    expect(moneyLocale(undefined, 'en-GB', 'TRY')).toBe('en-GB')
  })

  it('an explicit locale prop wins over everything', () => {
    expect(moneyLocale('de-DE', 'en-GB', 'TRY')).toBe('de-DE')
  })

  it('a currency without a known home locale falls back to the runtime default', () => {
    expect(moneyLocale(undefined, undefined, 'XYZ')).toBeUndefined()
    expect(moneyLocale(undefined, undefined, 'EUR')).toBe('de-DE')
  })
})

describe('money and dates follow the app\'s declared locale (context.locale)', () => {
  const GB = { ...LIVE, locale: 'en-GB' }
  afterEach(() => document.documentElement.removeAttribute('lang'))

  it('the app locale wins over the currency home: EUR in an en-GB app is "€249.00", not "249,00 €"', () => {
    const { container } = render(el(MoneyBlock, 'm', 'money', { amount: 249, currency: 'EUR' }, undefined, GB))
    expect(container.textContent).toBe('€249.00')
  })

  it('the document is never read: <html lang> without a context locale leaves EUR at home', () => {
    document.documentElement.setAttribute('lang', 'en-GB')
    const { container } = render(el(MoneyBlock, 'm', 'money', { amount: 249, currency: 'EUR' }))
    expect(container.textContent).toBe('249,00 €')
  })

  it('USD in an en-GB app prints "$", and the saving reads "−20%" with a true minus', () => {
    const { container } = render(el(MoneyBlock, 'm', 'money', { amount: 40, compareAt: 50, showSave: true, currency: 'USD' }, undefined, GB))
    expect(container.textContent).toContain('$40.00')
    expect(container.textContent).not.toContain('US$')
    expect(container.textContent).toContain('−20%')
    expect(container.textContent).not.toContain('-%')
  })

  it('a negative amount uses a true minus sign', () => {
    const { container } = render(el(MoneyBlock, 'm', 'money', { amount: -24, currency: 'USD' }, undefined, GB))
    expect(container.textContent).toBe('−$24.00')
  })

  it('text with format "date" prints an ISO date in the app locale; other text as written', async () => {
    const { TextBlock } = await import('../atoms/blocks/text/text/component.js')
    const a = render(el(TextBlock, 't1', 'text', { content: '2026-11-17', format: 'date' }, undefined, GB))
    expect(a.container.textContent).toBe('17 Nov 2026')
    const b = render(el(TextBlock, 't2', 'text', { content: 'Posted today', format: 'date' }, undefined, GB))
    expect(b.container.textContent).toBe('Posted today')
  })
})
