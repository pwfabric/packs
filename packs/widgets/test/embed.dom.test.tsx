/**
 * Embed behaviour. One describe per behaviour:
 *
 *   embed src is sanitised
 *   unset text shows nothing to a visitor
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { tint, safeFrameSrc, safeHref, CONTROL_BORDER } from '../../foundation/atoms/lib/_shared-utils.js'
import { FormBlock, collectFormValues } from '../../foundation/atoms/blocks/form/form/component.js'
import { InputBlock } from '../../foundation/atoms/blocks/form/input/component.js'
import { SelectBlock, normaliseOptions } from '../../foundation/atoms/blocks/form/select/component.js'
import { TextareaBlock } from '../../foundation/atoms/blocks/form/textarea/component.js'
import { SegmentedControlBlock } from '../../foundation/atoms/blocks/form/segmented-control/component.js'
import { AlertBlock } from '../../foundation/atoms/blocks/text/alert/component.js'
import { BadgeBlock } from '../../foundation/atoms/blocks/control/badge/component.js'
import { ChipBlock } from '../../foundation/atoms/blocks/control/chip/component.js'
import { ButtonBlock } from '../../foundation/atoms/blocks/control/button/component.js'
import { LinkBlock } from '../../foundation/atoms/blocks/control/link/component.js'
import { TextBlock } from '../../foundation/atoms/blocks/text/text/component.js'
import { HeadingBlock } from '../../foundation/atoms/blocks/text/heading/component.js'
import { ProseBlock, safeUrl, regexStrip } from '../../foundation/atoms/blocks/text/prose/component.js'
import { ToastBlock } from '../../foundation/atoms/blocks/feedback/toast/component.js'
import { AnnouncementBarBlock } from '../../foundation/atoms/blocks/layout/announcement-bar/component.js'
import { ListBlock } from '../../foundation/atoms/blocks/data/list/component.js'
import { AccordionBlock } from '../../foundation/atoms/blocks/container/accordion/component.js'
import { RepeaterBlock, asItems } from '../../foundation/atoms/blocks/data/repeater/component.js'
import { EmbedBlock, EMBED_SANDBOX } from '../atoms/blocks/media/embed/component.js'
import { ImageBlock } from '../../foundation/atoms/blocks/media/image/component.js'
import { VideoBlock } from '../atoms/blocks/media/video/component.js'
import { CarouselBlock } from '../atoms/blocks/media/carousel/component.js'
import { NavbarBlock } from '../../foundation/atoms/blocks/layout/navbar/component.js'
import { GridBlock } from '../../foundation/atoms/blocks/layout/grid/component.js'
import { ContainerBlock } from '../../foundation/atoms/blocks/layout/container/component.js'
import { SectionBlock } from '../../foundation/atoms/blocks/layout/section/component.js'
import { BottomBarBlock } from '../../foundation/atoms/blocks/layout/bottom-bar/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }
type AnyBlock = React.FC<Record<string, unknown>>
const LIVE = { interactionMode: 'live' }
const INERT = { interactionMode: 'inert' }

function el(
  C: unknown,
  id: string,
  type: string,
  props: Record<string, unknown>,
  children?: React.ReactNode,
  context: Record<string, unknown> = LIVE,
  blockExtra: Record<string, unknown> = {}
) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {}, ...blockExtra }} context={context}>
      {children}
    </Comp>
  )
}

function mount(tree: React.ReactNode): { events: Ev[]; container: HTMLElement } {
  const events: Ev[] = []
  const { container } = render(
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      {tree}
    </BehaviorSurfaceProvider>
  )
  return { events, container }
}
const submits = (events: Ev[]) => events.filter((e) => e.type === 'form:submit')


// Values a URL guard must refuse.
const HOSTILE = [
  'javascript:alert(1)',
  'JAVASCRIPT:alert(1)',
  '  javascript:alert(1)',
  'java\tscript:alert(1)',
  'java&Tab;script:alert(1)',
  '&#106;avascript:alert(1)',
  'jav&#x61;script:alert(1)',
  'javascript&colon;alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
]

describe('embed frames only an absolute http(s) URL, sandboxed', () => {
  it('safeFrameSrc refuses every hostile or relative value', () => {
    for (const v of [...HOSTILE, '/admin', '//evil.example', 'blob:https://x/1', '']) expect(safeFrameSrc(v)).toBeUndefined()
    expect(safeFrameSrc(' HTTPS://www.youtube.com/embed/x ')).toBe('https://www.youtube.com/embed/x')
  })

  it('renders a sandboxed, lazy iframe for a safe URL', () => {
    mount(el(EmbedBlock, 'e', 'embed', { src: 'https://maps.example.com/embed?q=1', title: 'Map' }))
    const frame = document.querySelector('iframe') as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toBe(EMBED_SANDBOX)
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation')
    expect(frame.getAttribute('loading')).toBe('lazy')
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
  })

  it("frames the app's own PDF without a sandbox (Chrome refuses a PDF in a sandboxed frame)", () => {
    mount(el(EmbedBlock, 'e', 'embed', { src: 'pwpack/media/print-issue-12.pdf', title: 'Issue 12 in print' }))
    const frame = document.querySelector('iframe') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe('pwpack/media/print-issue-12.pdf')
    expect(frame.hasAttribute('sandbox')).toBe(false)
    cleanup()
    // same-origin HTML is never framed at all
    const html = mount(el(EmbedBlock, 'e2', 'embed', { src: 'pwpack/media/page.html' }))
    expect(html.container.querySelector('iframe')).toBeNull()
  })

  it('a hostile src draws no frame; live it draws nothing, in the editor a stand-in', () => {
    const live = mount(el(EmbedBlock, 'e1', 'embed', { src: 'javascript:alert(1)' }))
    expect(live.container.innerHTML).toBe('')
    cleanup()
    mount(el(EmbedBlock, 'e2', 'embed', { src: 'javascript:alert(1)' }, undefined, INERT))
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.body.textContent).toContain('Embed placeholder')
  })
})

describe('unset text shows nothing to a visitor (embed)', () => {
  it('embed prints no placeholder text', () => {
    const { container } = mount(el(EmbedBlock, 'b-embed', 'embed', {}))
    expect(container.textContent).toBe('')
  })
})
