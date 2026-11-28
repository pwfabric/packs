/**
 * The navbar's buttons and search box, and the tabs, have corners of their own.
 *
 * They read the theme's general corner (`--pw-border-radius`), so a theme
 * could not give the navbar pill buttons, or the tabs square pills, without
 * changing every card and input. Each now reads a declared look token first
 * (`blocks.navbar.buttonRadius` / `searchRadius`, `blocks.tabs.radius` /
 * `verticalRadius`) and falls back to the corner it read before, so a theme
 * that sets none draws exactly as before.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { TabsBlock } from '../atoms/blocks/container/tabs/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
const LIVE = { interactionMode: 'live' }

function mount(C: unknown, type: string, props: Record<string, unknown>, children?: React.ReactNode): HTMLElement {
  const Comp = C as AnyBlock
  return render(
    <BehaviorSurfaceProvider surfaceId="t">
      <Comp props={applied(type, props)} block={{ id: 'b', type, props, layout: {} }} context={LIVE}>
        {children}
      </Comp>
    </BehaviorSurfaceProvider>,
  ).container
}

interface Token {
  name: string
  default: string
}
const tokensOf = (dir: string): Token[] =>
  (JSON.parse(readFileSync(join(__dirname, '..', 'atoms', 'blocks', dir, 'manifest.json'), 'utf8')) as { definition: { tokens?: Token[] } })
    .definition.tokens ?? []
const declared = (dir: string, name: string): string => {
  const t = tokensOf(dir).find((x) => x.name === name)
  expect(t, name).toBeDefined()
  return t!.default
}

describe('navbar corners', () => {
  const props = { logoText: 'Acme', logoHref: '/', showCTA: true, ctaLabel: 'Start', ctaHref: '/start', secondaryCtaLabel: 'Sign in', secondaryCtaHref: '/in', showSearch: true, searchPlaceholder: 'Search' }

  it('both call-to-action buttons read buttonRadius, then the theme corner', () => {
    expect(declared('layout/navbar', 'buttonRadius')).toBe('var(--pw-border-radius)')
    const c = mount(NavbarBlock, 'navbar', props)
    const ctas = [...c.querySelectorAll('a')].filter((a) => a.textContent === 'Start' || a.textContent === 'Sign in')
    expect(ctas.length).toBeGreaterThanOrEqual(2)
    for (const a of ctas) expect(a.style.borderRadius).toBe('var(--pw-navbar-button-radius, var(--pw-border-radius))')
  })

  it('the search box reads searchRadius, then the theme corner', () => {
    expect(declared('layout/navbar', 'searchRadius')).toBe('var(--pw-border-radius)')
    const boxes = [...mount(NavbarBlock, 'navbar', props).querySelectorAll('form[role="search"]')] as HTMLElement[]
    expect(boxes.length).toBeGreaterThan(0)
    for (const f of boxes) expect(f.style.borderRadius).toBe('var(--pw-navbar-search-radius, var(--pw-border-radius))')
  })
})

describe('tabs corners', () => {
  const tabs = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
  const panels = [<p key="a">a</p>, <p key="b">b</p>]
  const tabButtons = (c: HTMLElement): HTMLElement[] => [...c.querySelectorAll('[role="tab"]')] as HTMLElement[]

  it('a pill reads radius, then the theme corner', () => {
    expect(declared('container/tabs', 'radius')).toBe('var(--pw-border-radius)')
    const buttons = tabButtons(mount(TabsBlock, 'tabs', { tabs, variant: 'pills' }, panels))
    expect(buttons).toHaveLength(2)
    for (const b of buttons) expect(b.style.borderRadius).toBe('var(--pw-tabs-radius, var(--pw-border-radius))')
  })

  it('a vertical tab rounds its open side with verticalRadius, then the small corner', () => {
    const d = declared('container/tabs', 'verticalRadius')
    expect(d).toBe('var(--pw-border-radius-sm)')
    const v = `var(--pw-tabs-vertical-radius, ${d})`
    for (const b of tabButtons(mount(TabsBlock, 'tabs', { tabs, orientation: 'vertical' }, panels))) {
      expect(b.style.borderRadius).toBe(`0 ${v} ${v} 0`)
    }
  })

  it('the underline style has no corner to set (guard)', () => {
    for (const b of tabButtons(mount(TabsBlock, 'tabs', { tabs, variant: 'underline' }, panels))) expect(b.style.borderRadius).toBe('')
  })
})
