/**
 * Media and overlay widgets — the shared defects of the second audit.
 *
 *   gallery: the lightbox is a named dialog; Esc and the labelled close
 *            button close it; focus returns to the thumbnail
 *   command-palette inside a modal: Esc clears the search first, then closes
 *            the modal and focus returns to the trigger
 *   interactive-map: the location chips say which one is shown (aria-pressed)
 *   carousel: the arrows are drawn 44px on a phone
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { GalleryBlock } from '../atoms/blocks/media/gallery/component.js'
import { InteractiveMapBlock } from '../atoms/blocks/media/interactive-map/component.js'
import { CarouselBlock } from '../atoms/blocks/media/carousel/component.js'
import { CommandPaletteBlock } from '../atoms/blocks/overlay/command-palette/component.js'
import { ModalBlock } from '../../foundation/atoms/blocks/overlay/modal/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
const LIVE = { interactionMode: 'live' }
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={LIVE}>
      {children}
    </Comp>
  )
}
function mount(tree: React.ReactNode) {
  return render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => undefined}>
      {tree}
    </BehaviorSurfaceProvider>,
  )
}

const IMAGES = [
  { src: '/media/a.svg', alt: 'A reading room', caption: 'The reading room' },
  { src: '/media/b.svg', alt: 'A staircase' },
]

describe('gallery lightbox', () => {
  it('is a named dialog; Esc closes it and focus returns to the thumbnail', () => {
    render(el(GalleryBlock, 'g', 'gallery', { images: IMAGES }))
    const thumb = screen.getByRole('button', { name: 'Enlarge: A staircase' })
    thumb.focus()
    act(() => {
      fireEvent.click(thumb)
    })
    const dialog = screen.getByRole('dialog', { name: 'A staircase' })
    expect(dialog).toBeTruthy()
    const close = screen.getByRole('button', { name: 'Close picture' })
    expect(document.activeElement).toBe(close)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(thumb)
  })
  it('the close button closes it too', () => {
    render(el(GalleryBlock, 'g', 'gallery', { images: IMAGES }))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Enlarge: The reading room' }))
    })
    expect(screen.getByRole('dialog', { name: 'The reading room' })).toBeTruthy()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close picture' }))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('command-palette inside a modal', () => {
  it('Esc clears the search, a second Esc closes the modal and focus returns to the trigger', () => {
    mount(
      el(
        ModalBlock,
        'm',
        'modal',
        { title: 'Search the docs' },
        el(CommandPaletteBlock, 'p', 'command-palette', { placeholder: 'Search', items: [{ label: 'Create a payment' }] }),
      ),
    )
    const trigger = screen.getByRole('button', { name: 'Search the docs' })
    trigger.focus()
    act(() => {
      fireEvent.click(trigger)
    })
    const box = screen.getByRole('combobox', { name: 'Search' }) as HTMLInputElement
    expect(document.activeElement).toBe(box)
    fireEvent.change(box, { target: { value: 'pay' } })
    act(() => {
      fireEvent.keyDown(box, { key: 'Escape' })
    })
    expect(box.value).toBe('')
    expect(screen.getByRole('heading', { name: 'Search the docs' })).toBeTruthy()
    act(() => {
      fireEvent.keyDown(box, { key: 'Escape' })
    })
    expect(screen.queryByRole('heading', { name: 'Search the docs' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('a result that navigates closes the modal first and releases the scroll lock', () => {
    document.body.style.overflow = 'auto'
    mount(
      el(
        ModalBlock,
        'm',
        'modal',
        { title: 'Search the docs' },
        el(CommandPaletteBlock, 'p', 'command-palette', { placeholder: 'Search', items: [{ label: 'Webhooks', href: '#/webhooks' }] }),
      ),
    )
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Search the docs' }))
    })
    expect(document.body.style.overflow).toBe('hidden')
    act(() => {
      fireEvent.click(screen.getByRole('option', { name: /Webhooks/ }))
    })
    expect(window.location.hash).toBe('#/webhooks')
    expect(screen.queryByRole('heading', { name: 'Search the docs' })).toBeNull()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })
})

describe('interactive-map', () => {
  it('the chip of the shown location is pressed', () => {
    render(
      el(InteractiveMapBlock, 'map', 'interactive-map', {
        locations: [
          { label: 'Hall A', address: 'Ground floor' },
          { label: 'Hall B', address: 'First floor' },
        ],
      }),
    )
    const a = screen.getByRole('button', { name: 'Hall A' })
    const b = screen.getByRole('button', { name: 'Hall B' })
    expect(a.getAttribute('aria-pressed')).toBe('true')
    expect(b.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(b)
    expect(a.getAttribute('aria-pressed')).toBe('false')
    expect(b.getAttribute('aria-pressed')).toBe('true')
    expect(b.hasAttribute('data-pw-hit')).toBe(true)
  })

  it("draws the app's own map picture with a marker per placed location, and fetches nothing else", () => {
    const { container } = render(
      el(InteractiveMapBlock, 'map', 'interactive-map', {
        image: 'pwpack/media/venue-map.svg',
        imageAlt: 'Map of the hall',
        imageWidth: 640,
        imageHeight: 400,
        locations: [
          { label: 'Hall A', x: 20, y: 30 },
          { label: 'Hall B', x: 80, y: 70 },
          { label: 'Hall C', address: 'No position' },
        ],
      }),
    )
    expect(container.querySelector('iframe')).toBeNull()
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['pwpack/media/venue-map.svg'])
    const box = container.querySelector('[data-pw-map]') as HTMLElement
    expect(box.style.aspectRatio).toBe('640 / 400')
    const markers = container.querySelectorAll('[data-pw-map-marker]')
    expect(markers.length).toBe(2)
    expect((markers[1] as HTMLElement).style.left).toBe('80%')
    expect(container.querySelectorAll('[data-pw-map-marker="active"]').length).toBe(1)
    expect(screen.getByRole('img', { name: 'Map of the hall; Hall A is highlighted' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hall B' }))
    expect((markers[1] as HTMLElement).getAttribute('data-pw-map-marker')).toBe('active')
  })

  it('refuses a picture from another origin', () => {
    const { container } = render(
      el(InteractiveMapBlock, 'map', 'interactive-map', {
        image: 'https://tile.openstreetmap.org/1/0/0.png',
        locations: [{ label: 'Hall A', address: 'Ground floor', x: 1, y: 1 }],
      }),
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('Ground floor')
  })
})

describe('carousel', () => {
  it('the arrows are drawn 44px on a phone', () => {
    const { container } = mount(
      el(CarouselBlock, 'c', 'carousel', {
        items: [
          { src: '/media/a.svg', alt: 'A' },
          { src: '/media/b.svg', alt: 'B' },
        ],
        showArrows: true,
      }),
    )
    const prev = screen.getByRole('button', { name: 'Previous slide' })
    expect(prev.hasAttribute('data-pw-arrow')).toBe(true)
    const css = [...container.querySelectorAll('style')].map((s) => s.textContent).join(' ')
    expect(css).toContain('[data-pw-arrow] { width: 44px')
  })
})
