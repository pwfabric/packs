/**
 * Every button a widget draws answers the pointer and the keyboard (PRESS_CSS),
 * and no widget writes a corner or a shadow a theme cannot reach — the same
 * guards foundation keeps over its own blocks.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PRESS_CSS } from '../atoms/lib/_kit.js'
import { PRESS_CSS as FOUNDATION_PRESS_CSS } from '../../foundation/atoms/lib/_shared-utils.js'

const root = join(__dirname, '..', 'atoms', 'blocks')
const blocks = readdirSync(root).flatMap((c) => (statSync(join(root, c)).isDirectory() ? readdirSync(join(root, c)).map((b) => `${c}/${b}`) : []))
// latin1: a widget may hold a control character in a string; the guards read ASCII only.
const source = (b: string): string => readFileSync(join(root, b, 'component.tsx'), 'latin1').replace(/^\s*(\/\/|\*).*$/gm, '')
const withButtons = blocks.filter((b) => existsSync(join(root, b, 'component.tsx')) && /<button[\s>]/.test(source(b)))

describe('every button a widget draws answers the pointer', () => {
  it('carries foundation’s rule (pack-map `kit` copies it into _kit.ts)', () => {
    expect(PRESS_CSS).toBe(FOUNDATION_PRESS_CSS)
  })
  it('finds the widgets that draw buttons', () => {
    expect(withButtons.length).toBeGreaterThanOrEqual(8)
  })
  it.each(withButtons)('%s marks each button and carries PRESS_CSS', (b) => {
    const src = source(b)
    expect([...src.matchAll(/<button(?![^>]*data-pw-press)[\s\S]*?>/g)].map((m) => m[0].slice(0, 60))).toEqual([])
    expect(src).toContain('PRESS_CSS')
  })
})

describe('no widget writes a corner or a shadow a theme cannot reach', () => {
  it.each(blocks.filter((b) => existsSync(join(root, b, 'component.tsx'))))('%s', (b) => {
    // Written as text ('4px') or as a number (8, 999): both are fixed.
    const fixed = [...source(b).matchAll(/(borderRadius|boxShadow):\s*(?:'([^']*)'|(\d+(?:\.\d+)?))/g)]
      .map((m) => (m[2] ?? m[3])!.trim())
      .filter((v) => !/var\(|^0(px)?$|^none$|^50%$|^inherit$/.test(v))
    expect(fixed).toEqual([])
  })
})

describe('the press rule is drawn with the buttons, not only in some branch', () => {
  it('a gallery whose lightbox is closed still answers on its thumbnails', async () => {
    const React = await import('react')
    const { renderToString } = await import('react-dom/server')
    const { BehaviorSurfaceProvider } = await import('@pwfabric/runtime')
    const { GalleryBlock } = await import('../atoms/blocks/media/gallery/component.js')
    const props = { columns: 2, images: [{ src: 'a.svg', alt: 'A' }, { src: 'b.svg', alt: 'B' }] }
    const out = renderToString(
      React.createElement(BehaviorSurfaceProvider, { surfaceId: 't', onEvent: () => {} } as never,
        React.createElement(GalleryBlock as never, { props, block: { id: 'g', type: 'gallery', props, layout: {} }, context: { interactionMode: 'live' } } as never)),
    )
    expect(out).toContain('data-pw-press')
    expect(out).toContain('[data-pw-press="sink"]')
  })
})
