/**
 * Carousel and announcement-bar behaviour. One describe per behaviour:
 *
 *   non-submit buttons are type="button"
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


describe('a carousel inside a form does not submit it', () => {
  it('carousel buttons are type="button"', async () => {
    const { events } = mount(
      el(FormBlock, 'f', 'form', { submitLabel: 'Send' }, [
        el(CarouselBlock, 'car', 'carousel', { items: [{ src: 'https://x/1.jpg' }, { src: 'https://x/2.jpg' }] }),
      ])
    )
    const buttons = Array.from((document.getElementById('f') as HTMLElement).querySelectorAll('button')).filter((b) => b.textContent !== 'Send')
    expect(buttons.length).toBeGreaterThan(1)
    for (const b of buttons) expect(b.getAttribute('type')).toBe('button')
    await act(async () => {
      for (const b of buttons) fireEvent.click(b)
    })
    expect(submits(events)).toHaveLength(0)
  })
})

describe('unset text shows nothing to a visitor (landing)', () => {
  for (const [name, C, type] of [['announcement-bar', AnnouncementBarBlock, 'announcement-bar'], ['carousel', CarouselBlock, 'carousel']] as const) {
    it(`${name} prints no placeholder text`, () => {
      const { container } = mount(el(C as never, `b-${name}`, type, {}))
      expect(container.textContent).toBe('')
    })
  }
})
