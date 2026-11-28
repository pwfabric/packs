/**
 * A button and a plain (no-underline) link answer the pointer and the keyboard:
 * hover and press tint them with their own ink, a press sinks the button, keyboard
 * focus draws the theme's ring, and a disabled button does none of it.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ButtonBlock, BUTTON_STATE_CSS } from '../atoms/blocks/control/button/component.js'
import { LinkBlock } from '../atoms/blocks/control/link/component.js'
import { ChipBlock } from '../atoms/blocks/control/chip/component.js'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { PRESS_CSS } from '../atoms/lib/_shared-utils.js'
import { applied } from '../../../tools/test-support/applied-props.js'

type AnyBlock = React.FC<Record<string, unknown>>
function html(Comp: unknown, type: string, props: Record<string, unknown>): string {
  const C = Comp as AnyBlock
  return renderToString(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <C props={applied(type, props)} block={{ id: 'b', type, props, layout: {} }} context={{ interactionMode: 'live' }} />
    </BehaviorSurfaceProvider>,
  )
}

describe('the press rule is drawn with the buttons, not only in some branch', () => {
  const RULE = '[data-pw-press="sink"]'
  it.each([
    ['an idle form (submit, secondary, reset)', FormBlock, 'form', { submitLabel: 'Send', secondaryLabel: 'Back', resetLabel: 'Clear' }],
    ['a chip that is a button', ChipBlock, 'chip', { label: 'Open', removable: true }],
  ] as const)('%s', (_name, Comp, type, props) => {
    const out = html(Comp, type, props)
    expect(out).toContain('data-pw-press')
    expect(out).toContain(RULE)
    expect(PRESS_CSS).toContain(RULE)
  })
})

describe('a button behaves like one', () => {
  it('hover and press tint it with its own ink; a press sinks it; focus draws the ring', () => {
    expect(BUTTON_STATE_CSS).toMatch(/:not\(\[disabled\]\):hover \{ background-image: linear-gradient\(color-mix\(in srgb, currentColor 12%/)
    expect(BUTTON_STATE_CSS).toMatch(/:not\(\[disabled\]\):active \{[^}]*transform: translateY\(1px\)/)
    expect(BUTTON_STATE_CSS).toContain(':focus-visible { outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color')
    expect(BUTTON_STATE_CSS).toMatch(/prefers-reduced-motion: reduce\) \{ \[data-pw-btn-touch\]:active \{ transform: none; \}/)
  })

  it('both renders carry the states: a <button> and a button with an address (<a>)', () => {
    for (const props of [{ label: 'Save', variant: 'primary' }, { label: 'Go', variant: 'outline', href: '/plans' }]) {
      const out = html(ButtonBlock, 'button', props)
      expect(out).toContain('data-pw-btn-touch')
      expect(out).toContain(':not([disabled]):hover')
    }
  })

  it('its corner is its declared look token', () => {
    expect(html(ButtonBlock, 'button', { label: 'Save' })).toContain('border-radius:var(--pw-button-radius, var(--pw-border-radius))')
  })
})

describe('a plain link answers the pointer', () => {
  it('underline "none" gets the hover tint; the other underlines keep theirs', () => {
    const plain = html(LinkBlock, 'link', { text: 'Kits', href: '/plans', underline: 'none' })
    expect(plain).toContain('data-pw-ul="none"')
    expect(plain).toMatch(/\[data-pw-ul="none"\]:hover \{ background-image/)
    expect(html(LinkBlock, 'link', { text: 'Kits', href: '/plans', underline: 'always' })).not.toContain('data-pw-ul="none"')
  })
})

describe('every button a block draws answers the pointer (a guard over the sources)', () => {
  // Blocks that answer with rules of their own: the button block (BUTTON_STATE_CSS),
  // back-to-top, navbar, sidebar and prose (their own :hover rules).
  const OWN = new Set(['control/button', 'control/back-to-top', 'layout/navbar', 'layout/sidebar', 'text/prose'])
  const root = join(__dirname, '..', 'atoms', 'blocks')
  const blocks = readdirSync(root).flatMap((c) => (statSync(join(root, c)).isDirectory() ? readdirSync(join(root, c)).map((b) => `${c}/${b}`) : []))
  const withButtons = blocks.filter((b) => {
    const f = join(root, b, 'component.tsx')
    return existsSync(f) && /<button\s|<input type="submit"|<input data-pw-press/.test(readFileSync(f, 'utf8'))
  })
  it('finds the blocks that draw buttons', () => {
    expect(withButtons.length).toBeGreaterThan(20)
  })
  it.each(withButtons.filter((b) => !OWN.has(b)))('%s marks each button and carries PRESS_CSS', (b) => {
    const src = readFileSync(join(root, b, 'component.tsx'), 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '')
    const unmarked = [...src.matchAll(/<button(?![^>]*data-pw-press)[\s\S]*?>/g)].map((m) => m[0].slice(0, 60))
    expect(unmarked).toEqual([])
    expect(src).toContain('PRESS_CSS')
  })
})

describe('no block writes a corner or a shadow a theme cannot reach', () => {
  const root = join(__dirname, '..', 'atoms', 'blocks')
  const all = readdirSync(root).flatMap((c) => (statSync(join(root, c)).isDirectory() ? readdirSync(join(root, c)).map((b) => `${c}/${b}`) : []))
  it.each(all.filter((b) => existsSync(join(root, b, 'component.tsx'))))('%s', (b) => {
    const src = readFileSync(join(root, b, 'component.tsx'), 'latin1').replace(/^\s*(\/\/|\*).*$/gm, '')
    // Written as text ('6px') or as a number (8, 999): both are fixed. A circle (50%), zero and none are shapes.
    const fixed = [...src.matchAll(/(borderRadius|boxShadow):\s*(?:'([^']*)'|(\d+(?:\.\d+)?))/g)]
      .map((m) => (m[2] ?? m[3])!.trim())
      .filter((v) => !/var\(|^0(px)?$|^none$|^50%$|^inherit$/.test(v))
    expect(fixed).toEqual([])
  })
})

describe('no pattern writes a corner or a shadow a theme cannot reach', () => {
  const dir = join(__dirname, '..', 'atoms', 'patterns')
  it.each(readdirSync(dir).filter((f) => f.endsWith('.json')))('%s', (f) => {
    const src = readFileSync(join(dir, f), 'utf8')
    const fixed = [...src.matchAll(/"(borderRadius|boxShadow)"\s*:\s*(?:"([^"]*)"|(\d+(?:\.\d+)?))/g)]
      .map((m) => (m[2] ?? m[3])!.trim())
      .filter((v) => !/var\(|^0(px)?$|^none$|^50%$|^inherit$/.test(v))
    expect(fixed).toEqual([])
  })
})
