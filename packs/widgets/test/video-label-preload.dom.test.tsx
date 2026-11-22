/**
 * The video says how much to load before play, and has an accessible name.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { VideoBlock } from '../atoms/blocks/media/video/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

function video(props: Record<string, unknown>): HTMLVideoElement {
  const Comp = VideoBlock as unknown as React.FC<Record<string, unknown>>
  render(<Comp props={applied('video', props)} block={{ id: 'v', type: 'video', props, layout: {} }} context={{ interactionMode: 'live' }} />)
  return document.querySelector('#v video') as HTMLVideoElement
}

describe('video: preload and label', () => {
  it('loads only its metadata by default', () => {
    expect(video({ src: 'https://example.com/tour.mp4' }).getAttribute('preload')).toBe('metadata')
  })

  it('preload none and auto are written; anything else is metadata', () => {
    expect(video({ src: 'https://example.com/a.mp4', preload: 'none' }).getAttribute('preload')).toBe('none')
    cleanup()
    expect(video({ src: 'https://example.com/a.mp4', preload: 'auto' }).getAttribute('preload')).toBe('auto')
    cleanup()
    expect(video({ src: 'https://example.com/a.mp4', preload: 'everything' }).getAttribute('preload')).toBe('metadata')
  })

  it('label is the video\'s accessible name; unset, it has none of its own', () => {
    expect(video({ src: 'https://example.com/a.mp4', label: 'Product tour, 2 minutes' }).getAttribute('aria-label')).toBe('Product tour, 2 minutes')
    cleanup()
    expect(video({ src: 'https://example.com/a.mp4' }).hasAttribute('aria-label')).toBe(false)
  })
})
