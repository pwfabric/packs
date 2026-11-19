/**
 * gallery: a caption is content — it shows under its thumbnail in the grid,
 * not only in the enlarged view (round 3.0 finding). `showCaptions: false`
 * keeps the old lightbox-only form.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { GalleryBlock } from '../atoms/blocks/media/gallery/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())
type AnyBlock = React.FC<Record<string, unknown>>
const images = [
  { src: 'a.svg', alt: 'A chair', caption: 'The 1956 lounge chair' },
  { src: 'b.svg', alt: 'A lamp' },
]
function mount(props: Record<string, unknown>) {
  const C = GalleryBlock as unknown as AnyBlock
  return render(<C props={applied('gallery', props)} block={{ id: 'g', type: 'gallery', props, layout: {} }} />)
}

describe('gallery captions', () => {
  it('draws each given caption under its thumbnail, and none for a picture without one', () => {
    mount({ images })
    const caps = [...document.querySelectorAll('figcaption')].map((c) => c.textContent)
    expect(caps).toEqual(['The 1956 lounge chair'])
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
  it('showCaptions false leaves the grid without captions', () => {
    mount({ images, showCaptions: false })
    expect(document.querySelectorAll('figcaption')).toHaveLength(0)
  })
})
