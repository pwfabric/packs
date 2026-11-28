/**
 * A block's own look is its declared look tokens (manifest `definition.tokens`):
 * a theme sets them in `blocks.<block>.<token>`, the engine emits
 * --pw-<block>-<kebab-token>, and the block reads each one with its declared
 * default as the fallback. So an app that sets none draws as before, and a block
 * reads no look a theme cannot find in its manifest.
 *
 * The general looks stay theme tokens: heading ink, link ink, table edge
 * (colours), and each heading level's weight and line height
 * (typography headingWeightH1…H6 / headingLineHeightH1…H6).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { ProseBlock } from '../atoms/blocks/text/prose/component.js'
import { SidebarBlock } from '../atoms/blocks/layout/sidebar/component.js'
import { BreadcrumbBlock } from '../atoms/blocks/control/breadcrumb/component.js'
import { NavbarBlock } from '../atoms/blocks/layout/navbar/component.js'
import { TableOfContentsBlock } from '../atoms/blocks/layout/table-of-contents/component.js'
import { BackToTopBlock } from '../atoms/blocks/control/back-to-top/component.js'
import { HeadingBlock } from '../atoms/blocks/text/heading/component.js'
import { ButtonBlock } from '../atoms/blocks/control/button/component.js'
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

interface Token {
  name: string
  type: string
  default: string
  description: string
}
const BLOCKS = join(__dirname, '..', 'atoms', 'blocks')
function tokensOf(dir: string): Token[] {
  const m = JSON.parse(readFileSync(join(BLOCKS, dir, 'manifest.json'), 'utf8')) as { definition: { tokens?: Token[] } }
  return m.definition.tokens ?? []
}
const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
// React writes an inline style without the spaces a <style> keeps: compare without them.
const squash = (s: string): string => s.replace(/\s+/g, '')

const CASES: [string, string, unknown, Record<string, unknown>][] = [
  ['text/prose', 'prose', ProseBlock, { content: '# A\n\n## B\n\nText with `code`.\n\n- a\n\n| a |\n|---|\n| 1 |\n\n```ts\nconst a = 1\n```', copyButton: true, copyLabel: 'Copy' }],
  [
    'layout/sidebar',
    'sidebar',
    SidebarBlock,
    {
      navLabel: 'Docs',
      activeHref: '/guides/a/one',
      items: [
        { label: 'Intro', href: '/' },
        { label: 'Guides', children: [{ label: 'A', href: '/guides/a', match: 'prefix' }, { label: 'One', href: '/guides/a/one' }] },
      ],
    },
  ],
  ['control/breadcrumb', 'breadcrumb', BreadcrumbBlock, { items: [{ label: 'Guides', href: '/guides' }, { label: 'A' }] }],
  ['layout/navbar', 'navbar', NavbarBlock, { logoText: 'Acme', logoHref: '/' }],
  ['layout/table-of-contents', 'table-of-contents', TableOfContentsBlock, { title: 'On this page', items: [{ label: 'A', href: '#a', level: 2 }, { label: 'B', href: '#b', level: 3 }] }],
  ['control/back-to-top', 'back-to-top', BackToTopBlock, { label: 'Top' }],
  ['control/button', 'button', ButtonBlock, { label: 'Go', variant: 'primary' }],
]

describe('each block reads every look token it declares, with the declared default', () => {
  it.each(CASES)('%s', (dir, type, Comp, props) => {
    const tokens = tokensOf(dir)
    expect(tokens.length).toBeGreaterThan(0)
    const out = squash(html(Comp, type, props))
    for (const t of tokens) expect(out, t.name).toContain(squash(`var(--pw-${type}-${kebab(t.name)}, ${t.default})`))
    // And reads no --pw-<block>-* it does not declare — with or without a fallback.
    const declared = new Map(tokens.map((t) => [`--pw-${type}-${kebab(t.name)}`, squash(t.default)]))
    const reads = [...out.matchAll(new RegExp(`var\\((--pw-${type}-[a-z0-9-]+)(?![a-z0-9-])`, 'g'))]
    expect([...new Set(reads.map((m) => m[1]!))].filter((r) => !declared.has(r))).toEqual([])
    // Every read carries the declared default: none without one, none with another.
    for (const m of reads) {
      const name = m[1]!
      expect(out.slice(m.index! + m[0].length).startsWith(`,${declared.get(name)})`), `${name} read at ${m.index}`).toBe(true)
    }
  })

  it('declared tokens are unique, camelCase, of a known type, each described', () => {
    for (const [dir] of CASES) {
      const tokens = tokensOf(dir)
      expect(new Set(tokens.map((t) => t.name)).size).toBe(tokens.length)
      for (const t of tokens) {
        expect(t.name).toMatch(/^[a-z][a-zA-Z0-9]*$/)
        expect(['color', 'length', 'number', 'fontWeight', 'lineHeight']).toContain(t.type)
        expect(t.default.length).toBeGreaterThan(0)
        expect(t.description).toMatch(/\.$/)
        // A length default carries a unit (0px, not 0): a bare 0 breaks inside calc(),
        // and the engine's validator refuses it (THEME_BLOCK_TOKEN_TYPE).
        if (t.type === 'length') expect(t.default, t.name).toMatch(/^(?:-?\d*\.?\d+(?:px|rem|em|%|vw|vh|ch|lh)|(?:var|calc|min|max|clamp)\(.+\))$/)
      }
    }
  })
})

describe('the general looks stay theme tokens', () => {
  const out = html(ProseBlock, 'prose', { content: '# A\n\nText with `code` and [a link](/x).\n\n| a |\n|---|\n| 1 |' })
  it.each([
    ['heading ink', 'color: var(--pw-color-heading, var(--pw-color-text))'],
    ['h1 weight', 'font-weight: var(--pw-font-weight-h1, var(--pw-font-weight-heading))'],
    ['h3 line', 'line-height: var(--pw-line-height-h3, var(--pw-line-height-heading))'],
    ['heading tracking', 'letter-spacing: var(--pw-letter-spacing-heading, normal)'],
    ['link ink', 'color: var(--pw-color-link, var(--pw-color-primary-ink, #18181b))'],
    ['table edge', 'border: 1px solid var(--pw-color-table-border, var(--pw-color-border))'],
  ])('%s', (_name, rule) => {
    expect(out).toContain(rule)
  })

  it('the heading block draws each level with its own weight and line height, else the heading ones', () => {
    for (const level of ['h1', 'h4']) {
      const out = squash(html(HeadingBlock, 'heading', { text: 'A', level }))
      expect(out).toContain(`font-weight:var(--pw-font-weight-${level},var(--pw-font-weight-heading))`)
      expect(out).toContain(`line-height:var(--pw-line-height-${level},var(--pw-line-height-heading))`)
    }
  })
})

describe('navbar: the brand', () => {
  it('logoTagline is a quieter word inside the same brand link', () => {
    const host = document.createElement('div')
    host.innerHTML = html(NavbarBlock, 'navbar', { logoText: 'PWFabric', logoTagline: 'engine', logoHref: '/' })
    const brand = host.querySelector('[data-pw-nav-brand]') as HTMLAnchorElement
    expect(brand.textContent).toBe('PWFabricengine')
    const tag = brand.querySelector('[data-pw-nav-tagline]') as HTMLElement
    expect(tag.textContent).toBe('engine')
    expect(tag.style.opacity).toBe('0.55')
    expect(html(NavbarBlock, 'navbar', { logoText: 'Acme', logoHref: '/' })).not.toContain('data-pw-nav-tagline')
  })
})

describe('prose: behaviours are props, not tokens', () => {
  const table = '| a |\n|---|\n| 1 |'
  it('tableWidth: full by default, content as wide as its cells need', () => {
    expect(html(ProseBlock, 'prose', { content: table })).toMatch(/table \{ width: 100%;/)
    expect(html(ProseBlock, 'prose', { content: table, tableWidth: 'content' })).toMatch(/table \{ width: auto;/)
  })

  it('copyButtonReveal: always by default, or on hover and focus (always on touch)', () => {
    const code = { content: '```ts\nconst a = 1\n```', copyButton: true, copyLabel: 'Copy' }
    expect(html(ProseBlock, 'prose', code)).toContain('[data-pw-prose-copy] { opacity: 1;')
    const hover = html(ProseBlock, 'prose', { ...code, copyButtonReveal: 'hover' })
    expect(hover).toContain('[data-pw-prose-copy] { opacity: 0;')
    expect(hover).toMatch(/\[data-pw-prose-code\]:hover \[data-pw-prose-copy\][^{]*\{ opacity: 1; \}/)
    expect(hover).toMatch(/\(pointer: coarse\) \{[^}]*opacity: 1;/)
  })

  it('a cell breaks a word only when it cannot fit (break-word), not anywhere', () => {
    expect(html(ProseBlock, 'prose', { content: '| Method | Default |\n|---|---|\n| a | b |' })).toMatch(/td \{[^}]*overflow-wrap: break-word;/)
  })

  it('the code inside pre is a block, so a smaller monospace line adds no height of its own', () => {
    expect(html(ProseBlock, 'prose', { content: '```ts\nconst a = 1\n```' })).toMatch(/pre code \{ display: block;/)
  })
})
