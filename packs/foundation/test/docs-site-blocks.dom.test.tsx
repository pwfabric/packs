/**
 * What a documentation site needed from the foundation blocks, beyond tokens:
 * shell commands and flags coloured, numbers only as whole tokens, typographic
 * quotes in prose, a link on a line of its own, a compact theme switch, a bar
 * whose contents keep to the page width, and a phone menu carrying the page tree.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { AppMessagesContext, BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { highlightCode } from '../atoms/blocks/text/prose/component.js'
import { LinkBlock } from '../atoms/blocks/control/link/component.js'
import { ThemeToggleBlock } from '../atoms/blocks/control/theme-toggle/component.js'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function el(Comp: unknown, type: string, props: Record<string, unknown>, context: Record<string, unknown> = {}): React.ReactElement {
  const C = Comp as AnyBlock
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <C props={applied(type, props)} block={{ id: 'b', type, props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>
  )
}

describe('highlighter: shell and numbers', () => {
  it('a command and its flags are marked; the arguments stay plain', () => {
    expect(highlightCode('pwf create --pack my-blocks -g', 'bash')).toBe(
      '<span data-tok="function">pwf</span> create <span data-tok="parameter">--pack</span> my-blocks <span data-tok="parameter">-g</span>',
    )
  })

  it('each command of a line is one: after a newline, ;, |, && and a $ prompt', () => {
    const html = highlightCode('cd my-blocks && pwf validate\n$ npm install | tee log', 'sh')
    const fns = [...html.matchAll(/data-tok="function">([^<]+)</g)].map((m) => m[1])
    expect(fns).toEqual(['cd', 'pwf', 'npm', 'tee'])
    expect(html).toContain('$ <span data-tok="function">npm</span>')
  })

  it('control words stay keywords', () => {
    expect(highlightCode('if true; then echo x; fi', 'sh')).toContain('<span data-tok="keyword">if</span>')
  })

  it('a number inside a word, a version in a file name or a path is not a number', () => {
    for (const code of ['foundation-1.0.0.pwpack', 'v2', 'a/1.5/b', 'x@3.6.0', 'node22']) {
      expect(highlightCode(code, 'bash')).not.toContain('data-tok="number"')
    }
    expect(highlightCode('const a = 1.5', 'ts')).toContain('<span data-tok="number">1.5</span>')
    expect(highlightCode('port: 4710,', 'js')).toContain('<span data-tok="number">4710</span>')
  })
})

describe('link: display', () => {
  it('block puts the link on a line of its own; inline is the default', () => {
    const block = renderToString(el(LinkBlock, 'link', { text: 'A', href: '/a', display: 'block' }))
    expect(block).toMatch(/style="[^"]*display:block/)
    expect(renderToString(el(LinkBlock, 'link', { text: 'A', href: '/a' }))).not.toMatch(/display:block/)
  })

  it('with an icon, a block link is a flex row', () => {
    expect(renderToString(el(LinkBlock, 'link', { text: 'A', href: '/a', icon: 'github', display: 'block' }))).toMatch(/display:flex/)
  })
})

describe('theme-toggle: select', () => {
  it('shows the current choice and offers the others in a list, named by the app’s word', () => {
    let chosen = ''
    render(el(ThemeToggleBlock, 'theme-toggle', { variant: 'select' }, { colorScheme: 'system', setColorScheme: (s: string) => { chosen = s } }))
    const select = screen.getByRole('combobox', { name: 'Colour scheme' }) as HTMLSelectElement
    expect(select.value).toBe('system')
    expect([...select.options].map((o) => o.value)).toEqual(['light', 'dark', 'system'])
    fireEvent.change(select, { target: { value: 'dark' } })
    expect(chosen).toBe('dark')
  })
})

describe('navbar: contentMaxWidth and drawerLinks', () => {
  it('contentMaxWidth centres the contents in that width; an unsafe value is ignored', () => {
    const wide = renderToString(el(NavbarBlock, 'navbar', { logoText: 'A', contentMaxWidth: 1440 }))
    expect(wide).toContain('padding-inline:max(var(--pw-navbar-padding-inline, 24px), calc((100% - 1440px) / 2 + var(--pw-navbar-padding-inline, 24px)))')
    expect(wide.match(/padding-inline:/g)).toHaveLength(1)
    expect(renderToString(el(NavbarBlock, 'navbar', { logoText: 'A', contentMaxWidth: '90rem' }))).toContain('calc((100% - 90rem) / 2')
    const unsafe = renderToString(el(NavbarBlock, 'navbar', { logoText: 'A', contentMaxWidth: '1px; color: red' }))
    expect(unsafe).not.toContain('calc((100%')
    expect(unsafe).toContain('padding-inline:var(--pw-navbar-padding-inline, 24px)')
  })

  it('drawerLinks are listed in the phone drawer only, with their pages under them', () => {
    const tree = [
      { label: 'Overview', href: '/' },
      { label: 'Authoring', href: '/authoring', items: [{ label: 'defineBlock()', href: '/authoring/define-block' }] },
    ]
    render(el(NavbarBlock, 'navbar', { logoText: 'A', drawerLinks: tree }))
    // Not in the wide bar.
    expect(document.querySelector('[data-pw-nav-wide] a[href="/authoring"]')).toBeNull()
    // The drawer opens (the menu button exists only because of drawerLinks) and lists the tree.
    fireEvent.click(document.querySelector('[data-pw-nav-narrow] button') as HTMLButtonElement)
    const drawer = document.getElementById('b-menu') as HTMLElement
    expect([...drawer.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Overview', 'Authoring', 'defineBlock()'])
  })
})

describe('navbar: the right-hand cluster', () => {
  it('keeps to the right edge when something is placed in the bar and there are no links', () => {
    const html = renderToString(
      <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
        {React.createElement(NavbarBlock as unknown as AnyBlock, {
          props: applied('navbar', { logoText: 'A', socialLinks: [{ icon: 'github', href: 'https://example.com' }] }),
          block: { id: 'b', type: 'navbar', props: {}, layout: {} },
          context: { interactionMode: 'live' },
          children: <span>placed</span>,
        })}
      </BehaviorSurfaceProvider>,
    )
    expect(html).toMatch(/data-pw-nav-wide="" style="[^"]*margin-inline-start:auto/)
  })
})

describe('navbar: anchors, skip link, social names', () => {
  const nav = (props: Record<string, unknown>, style?: Record<string, unknown>, words?: Record<string, string>): string => {
    const tree = (
      <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
        {React.createElement(NavbarBlock as unknown as AnyBlock, {
          props: applied('navbar', props),
          block: { id: 'b', type: 'navbar', props, layout: {}, ...(style ? { style } : {}) },
          context: { interactionMode: 'live' },
        })}
      </BehaviorSurfaceProvider>
    )
    return renderToString(words ? <AppMessagesContext.Provider value={words}>{tree}</AppMessagesContext.Provider> : tree)
  }

  it('the anchor offset of a sticky bar is in the first frame (a page opened at #section lands below it)', () => {
    // CSS that finds a sticky wrapper (or a sticky bar) itself, in the first frame.
    // The engine names a pinned wrapper (data-pw-position, engine 3.7); the bar never guesses from style text.
    const css = nav({ logoText: 'A' })
    expect(css).toContain(':root:has([data-pw-position] > [data-pw-navbar]) { scroll-padding-top: var(--pw-sticky-top-offset, 64px); }')
    expect(css).not.toContain('[style*=')
  })

  it('skipTo draws a skip link to the main content, first, in the app’s word', () => {
    const host = document.createElement('div')
    host.innerHTML = nav({ logoText: 'A', skipTo: 'article' }, undefined, { 'ui.skipToContent': 'Skip to Content' })
    const link = host.querySelector('[data-pw-skip-link]') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('#article')
    expect(link.textContent).toBe('Skip to Content')
    expect(host.querySelector('header')?.querySelector('a')).toBe(link)
    expect(nav({ logoText: 'A', skipTo: 'bad id"' }, undefined, { 'ui.skipToContent': 'Skip' })).not.toMatch(/<a[^>]*data-pw-skip-link/)
  })

  it('a social link is named by its label, else its icon', () => {
    const html = nav({ logoText: 'A', socialLinks: [{ icon: 'github', href: 'https://github.com/x', label: 'GitHub' }, { icon: 'globe', href: 'https://x.test' }] })
    expect(html).toContain('aria-label="GitHub"')
    expect(html).toContain('aria-label="globe"')
  })
})
