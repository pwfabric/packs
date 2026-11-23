/**
 * A language switch (or a theme toggle) placed in the navbar sits inside the
 * bar's band, at every width: the bar draws its children in the band, once,
 * after its own cluster. Placed beside the bar, the row drew as a band of its
 * own under it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

const HERE = dirname(fileURLToPath(import.meta.url))

const manifest = (path: string): { definition: { canHaveChildren: boolean; traits?: string[]; allowedChildTraits?: string[] } } =>
  JSON.parse(readFileSync(join(HERE, '..', 'atoms', 'blocks', ...path.split('/'), 'manifest.json'), 'utf8'))

function bar(children?: React.ReactNode): React.ReactElement {
  const Comp = NavbarBlock as unknown as React.FC<Record<string, unknown>>
  const p = { logoText: 'Studio', links: [{ label: 'Work', href: '/work' }] }
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied('navbar', p)} block={{ id: 'nav', type: 'navbar', props: p, layout: {} }} context={{ interactionMode: 'live' }}>
        {children}
      </Comp>
    </BehaviorSurfaceProvider>
  )
}

describe('navbar: children sit in the band', () => {
  it('draws a child inside the header, once, beside the bar’s own controls', () => {
    const { container } = render(bar(<nav data-testid="langs" aria-label="Language"><a href="/de/">Deutsch</a></nav>))
    const header = container.querySelector('header[data-pw-navbar]') as HTMLElement
    const placed = container.querySelectorAll('[data-testid="langs"]')
    expect(placed).toHaveLength(1)
    expect(header.contains(placed[0] as Node)).toBe(true)
    // Not in a form the other width hides: shown on a phone and on a wide screen.
    const slot = (placed[0] as HTMLElement).parentElement as HTMLElement
    expect(slot.hasAttribute('data-pw-nav-wide')).toBe(false)
    expect(slot.hasAttribute('data-pw-nav-narrow')).toBe(false)
    expect(slot.style.display).toBe('flex')
    expect(slot.style.alignItems).toBe('center')
  })

  it('draws no slot when nothing is placed in it', () => {
    const { container } = render(bar())
    expect(container.querySelector('[data-pw-nav-children]')).toBeNull()
  })

  it('takes the language switch and the theme toggle as children, and nothing else', () => {
    const nav = manifest('layout/navbar').definition
    expect(nav.canHaveChildren).toBe(true)
    expect(nav.allowedChildTraits).toEqual(['nav-utility'])
    expect(manifest('control/language-switch').definition.traits).toContain('nav-utility')
    expect(manifest('control/theme-toggle').definition.traits).toContain('nav-utility')
  })
})
