/**
 * Shared-pass fixes found by ten independent re-audits of the example apps:
 *
 * - chip: a SELECTED chip is filled (primary), not a faint ring; an actionable
 *   chip is a real 44px box on a phone;
 * - link: underlined by default (axe link-in-text-block); "hover" really
 *   underlines on hover; a link with no address (a label) is not underlined;
 * - progress: always has an accessible name (axe aria-progressbar-name);
 * - avatar initials and the md badge sit on the theme's type scale;
 * - container `current` → aria-current (the stepper's current step);
 * - text `srOnly` is read, not drawn;
 * - heading: an empty level (an optional slot left "") is an h2;
 * - button: "#" is no address — it stays a <button>;
 * - app-rail: the panel fills its row's height.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ChipBlock } from '../atoms/blocks/control/chip/component.js'
import { LinkBlock } from '../atoms/blocks/control/link/component.js'
import { ProgressBlock } from '../atoms/blocks/data/progress/component.js'
import { AvatarBlock } from '../atoms/blocks/control/avatar/component.js'
import { BadgeBlock } from '../atoms/blocks/control/badge/component.js'
import { ContainerBlock } from '../atoms/blocks/layout/container/component.js'
import { TextBlock } from '../atoms/blocks/text/text/component.js'
import { HeadingBlock } from '../atoms/blocks/text/heading/component.js'
import { ButtonBlock } from '../atoms/blocks/control/button/component.js'
import { AppRailBlock } from '../atoms/blocks/layout/app-rail/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live' }}>
        {children}
      </Comp>
    </BehaviorSurfaceProvider>
  )
}
const styles = (): string => [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')

describe('chip', () => {
  it('a selected chip is filled with the primary colour and its ink', () => {
    render(el(ChipBlock, 'c', 'chip', { label: 'Vegan', selected: true }))
    const b = screen.getByRole('button', { name: 'Vegan' })
    expect(b.getAttribute('aria-pressed')).toBe('true')
    expect(b.style.backgroundColor).toBe('var(--pw-color-primary)')
    expect(b.style.color).toBe('var(--pw-color-text-on-primary)')
  })
  it('an unselected chip keeps its tone wash', () => {
    render(el(ChipBlock, 'c', 'chip', { label: 'Vegan', selected: false }))
    expect(screen.getByRole('button', { name: 'Vegan' }).style.backgroundColor).not.toBe('var(--pw-color-primary)')
  })
  it('button and link chips are 44px boxes on a phone', () => {
    render(el(ChipBlock, 'c', 'chip', { label: 'Vegan', selected: false }))
    expect(screen.getByRole('button').hasAttribute('data-pw-chip-touch')).toBe(true)
    expect(styles()).toContain('[data-pw-chip-touch] { min-height: 44px; }')
    cleanup()
    render(el(ChipBlock, 'c', 'chip', { label: 'Track A', href: '/track/a' }))
    expect(screen.getByRole('link').hasAttribute('data-pw-chip-touch')).toBe(true)
  })
})

describe('link underline', () => {
  it('is underlined by default', () => {
    render(el(LinkBlock, 'l', 'link', { text: 'Read the news', href: '/news' }))
    expect(screen.getByRole('link').style.textDecoration).toBe('underline')
  })
  it('"hover" underlines on hover and focus only', () => {
    render(el(LinkBlock, 'l', 'link', { text: 'Pricing', href: '/pricing', underline: 'hover' }))
    const a = screen.getByRole('link')
    expect(a.style.textDecoration).toBe('')
    expect(a.getAttribute('data-pw-ul')).toBe('hover')
    expect(styles()).toContain('[data-pw-ul="hover"]:hover')
  })
  it('"none" is never underlined; a label (no href) is not underlined', () => {
    render(el(LinkBlock, 'l', 'link', { text: 'Brand', href: '/', underline: 'none' }))
    expect(screen.getByRole('link').style.textDecoration).toBe('none')
    cleanup()
    const { container } = render(el(LinkBlock, 'l', 'link', { text: 'Just a label' }))
    expect((container.querySelector('span[data-block-type="link"]') as HTMLElement).style.textDecoration).toBe('none')
  })
})

describe('progress name', () => {
  it('label names the bar', () => {
    render(el(ProgressBlock, 'p', 'progress', { value: 64, label: 'Sprint points done' }))
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-label')).toBe('Sprint points done')
    expect(bar.getAttribute('aria-valuetext')).toBe('64%')
  })
  it('labelledBy wins over label', () => {
    render(el(ProgressBlock, 'p', 'progress', { value: 3, max: 10, label: 'x', labelledBy: 'seats-label' }))
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-labelledby')).toBe('seats-label')
    expect(bar.hasAttribute('aria-label')).toBe(false)
  })
  it('an unnamed bar still has a name', () => {
    render(el(ProgressBlock, 'p', 'progress', { value: 10 }))
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Progress')
  })
})

describe('type on the theme scale', () => {
  it('avatar initials use font-size tokens', () => {
    for (const [size, token] of [['md', '--pw-font-size-sm'], ['lg', '--pw-font-size-base'], ['xs', '--pw-font-size-xs']] as const) {
      const { container } = render(el(AvatarBlock, 'a', 'avatar', { name: 'Max Doe', size }))
      const html = container.innerHTML
      expect(html).toContain(`font-size: var(${token}`)
      cleanup()
    }
  })
  it('the md badge is the sm step, not a midpoint', () => {
    const { container } = render(el(BadgeBlock, 'b', 'badge', { text: 'New' }))
    expect(container.innerHTML).toContain('font-size: var(--pw-font-size-sm')
    expect(container.innerHTML).not.toContain('calc((var(--pw-font-size-xs')
  })
})

describe('stepper support', () => {
  it('container current renders aria-current=step (bindable "true" too)', () => {
    const { container } = render(el(ContainerBlock, 's', 'container', { current: true }))
    expect(container.querySelector('[data-block-type="container"]')!.getAttribute('aria-current')).toBe('step')
    cleanup()
    const r2 = render(el(ContainerBlock, 's', 'container', { current: 'true', currentKind: 'page' }))
    expect(r2.container.querySelector('[data-block-type="container"]')!.getAttribute('aria-current')).toBe('page')
    cleanup()
    const r3 = render(el(ContainerBlock, 's', 'container', { current: false }))
    expect(r3.container.querySelector('[data-block-type="container"]')!.hasAttribute('aria-current')).toBe(false)
  })
  it('text srOnly is in the DOM but visually hidden', () => {
    render(el(TextBlock, 't', 'text', { content: 'Step 2 of 4', srOnly: true }))
    const p = screen.getByText('Step 2 of 4')
    expect(p.style.position).toBe('absolute')
    expect(p.style.width).toBe('1px')
    expect(p.style.overflow).toBe('hidden')
  })
})

describe('heading level fallback', () => {
  it('"" and an unknown level render an h2', () => {
    render(el(HeadingBlock, 'h', 'heading', { text: 'Your details', level: '' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Your details' })).toBeTruthy()
    cleanup()
    render(el(HeadingBlock, 'h', 'heading', { text: 'Card', level: 'h3' }))
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy()
  })
})

describe('button "#" is no address', () => {
  it('stays a <button>', () => {
    const { container } = render(el(ButtonBlock, 'b', 'button', { label: 'Clear filters', href: '#' }))
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('button')).not.toBeNull()
  })
})

describe('app-rail fills its row', () => {
  it('the rail box is 100% of its stretched wrapper', () => {
    const { container } = render(
      el(AppRailBlock, 'r', 'app-rail', { items: [{ label: 'Settings', href: '/settings', icon: 'settings' }] }),
    )
    const rail = container.querySelector('[data-block-type="app-rail"]') as HTMLElement
    expect(rail.style.height).toBe('100%')
  })
})
