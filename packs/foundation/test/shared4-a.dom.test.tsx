/**
 * Shared pass 4 (engine 3.0 app round), part A:
 *  - button and chip take every action the engine dispatches: write and auth:*;
 *  - select draws its empty option only when it means something;
 *  - skeleton width and height take one unit rule (number px, string CSS);
 *  - form has a secondary control beside submit (Back, Cancel);
 *  - heading `focusOn` and alert `focusOnShow` move focus where a step or a
 *    result appears.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { checkPropValue } from '@pwfabric/contracts'
import { BehaviorSurfaceProvider, DataBoundSurfaceRenderer } from '@pwfabric/runtime'
import { SelectBlock } from '../atoms/blocks/form/select/component.js'
import { SkeletonBlock } from '../atoms/blocks/data/skeleton/component.js'
import { FormBlock } from '../atoms/blocks/form/form/component.js'
import { HeadingBlock } from '../atoms/blocks/text/heading/component.js'
import { AlertBlock } from '../atoms/blocks/text/alert/component.js'
import { ButtonBlock } from '../atoms/blocks/control/button/component.js'
import { TextBlock } from '../atoms/blocks/text/text/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const HERE = dirname(fileURLToPath(import.meta.url))
type Prop = { name: string; bindable?: boolean; jsonSchema?: Record<string, unknown> }
const propsOf = (path: string): Prop[] =>
  JSON.parse(readFileSync(join(HERE, '..', 'atoms', 'blocks', path, 'manifest.json'), 'utf8')).definition.props
const live = { interactionMode: 'live' } as never
const node = (id: string, type: string, props: Record<string, unknown>) => ({ id, type, props, layout: {} }) as never

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }

const ENGINE_ACTIONS = [
  { type: 'write', sourceId: 'cart', op: 'delete', id: '{{item.id}}', statusKeys: { loading: 'removing', error: 'removeFailed', reason: 'why' } },
  { type: 'write', sourceId: 'cart', op: 'create', values: { sku: 'x', qty: 1 } },
  { type: 'auth:signIn', method: 'password' },
  { type: 'auth:signIn' },
  { type: 'auth:register', method: 'password' },
  { type: 'auth:signOut' },
  { type: 'setState', key: 'k', value: 1 },
  { type: 'navigate', url: '/x' },
]

describe('button and chip — every engine action fits the action shape', () => {
  for (const block of ['control/button', 'control/chip']) {
    const shape = propsOf(block).find((p) => p.name === 'action')?.jsonSchema
    for (const a of ENGINE_ACTIONS) {
      it(`${block} takes ${a.type}${'op' in a ? ' ' + a.op : ''}`, () => {
        expect(checkPropValue(a, shape as never, 'action')).toEqual([])
        expect(checkPropValue([a, { type: 'refreshAll' }], shape as never, 'action')).toEqual([])
      })
    }
    it(`${block} still refuses an unknown action and a write without op`, () => {
      expect(checkPropValue({ type: 'teleport' }, shape as never, 'action').length).toBeGreaterThan(0)
      expect(checkPropValue({ type: 'write', sourceId: 'cart' }, shape as never, 'action').length).toBeGreaterThan(0)
    })
  }

  it('a button runs its auth:signIn action through the host', () => {
    const asked: unknown[] = []
    const surface = { id: 's', blocks: [{ id: 'in', type: 'button', props: { label: 'Sign in', action: { type: 'auth:signIn', method: 'password' } } }] }
    render(
      <DataBoundSurfaceRenderer
        surface={surface as never}
        components={{ button: ButtonBlock } as never}
        identity={{ state: { signedIn: false, user: null }, onAction: (a: unknown) => asked.push(a) } as never}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(asked).toEqual([{ type: 'auth:signIn', method: 'password' }])
  })
})

describe('select — the empty option only when it means something', () => {
  const opts = [{ label: 'Home', value: 'home' }, { label: 'Studio', value: 'studio' }]
  const optionTexts = (c: HTMLElement) => [...c.querySelectorAll('option')].map((o) => o.value)
  it('a chosen value and no placeholder: only the options', () => {
    const props = { label: 'Kit', options: opts, defaultValue: 'studio' }
    const { container } = render(<SelectBlock props={applied('select', props) as never} block={node('s', 'select', props)} context={live} />)
    expect(optionTexts(container)).toEqual(['home', 'studio'])
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('studio')
  })
  it('a placeholder: the empty option leads, with its text', () => {
    const props = { label: 'Kit', options: opts, placeholder: 'Choose a kit' }
    const { container } = render(<SelectBlock props={applied('select', props) as never} block={node('s', 'select', props)} context={live} />)
    expect(optionTexts(container)).toEqual(['', 'home', 'studio'])
    expect(container.querySelector('option')?.textContent).toBe('Choose a kit')
  })
  it('nothing chosen and no placeholder: an empty option, so nothing is picked silently', () => {
    const props = { label: 'Kit', options: opts }
    const { container } = render(<SelectBlock props={applied('select', props) as never} block={node('s', 'select', props)} context={live} />)
    expect(optionTexts(container)).toEqual(['', 'home', 'studio'])
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('')
  })
})

describe('skeleton — one unit rule for width and height', () => {
  const frame = (props: Record<string, unknown>) => {
    const { container } = render(<SkeletonBlock props={applied('skeleton', props) as never} block={node('k', 'skeleton', props)} context={live} />)
    return container.querySelector('[data-block-type="skeleton"] > div') as HTMLElement
  }
  it('numbers are px on both sides', () => {
    const f = frame({ variant: 'rectangle', width: 240, height: 56 })
    expect(f.style.width).toBe('240px')
    expect(f.style.height).toBe('56px')
  })
  it('strings are CSS lengths on both sides', () => {
    const f = frame({ variant: 'card', width: '100%', height: '12rem' })
    expect(f.style.width).toBe('100%')
    expect(f.style.height).toBe('12rem')
  })
  it('width left out fills the row; height left out is the variant’s own', () => {
    const f = frame({ variant: 'rectangle' })
    expect(f.style.width).toBe('100%')
    expect(f.style.height).toBe('20px')
  })
})

describe('form — a secondary control beside submit', () => {
  it('draws Back as a button that never submits, and emits its action', () => {
    const events: Ev[] = []
    const submits: Ev[] = []
    const props = { submitLabel: 'Next', secondaryLabel: 'Back', secondaryAction: { type: 'setState', key: 'step', value: 1 } }
    render(
      <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => (e as Ev).type === 'form:submit' ? submits.push(e as Ev) : events.push(e as Ev)}>
        <FormBlock props={applied('form', props) as never} block={node('f', 'form', props)} context={live} />
      </BehaviorSurfaceProvider>
    )
    const back = screen.getByRole('button', { name: 'Back' })
    expect(back.getAttribute('type')).toBe('button')
    // drawn before the submit button, in the same row
    expect(back.nextElementSibling?.textContent).toBe('Next')
    fireEvent.click(back)
    expect(submits).toHaveLength(0)
    const click = events.find((e) => e.type === 'block:click')
    expect(click?.blockId).toBe('f-secondary')
    expect(click?.payload).toEqual({ action: { type: 'setState', key: 'step', value: 1 } })
  })
  it('with an address it is a link', () => {
    const props = { submitLabel: 'Save', secondaryLabel: 'Cancel', secondaryHref: '/settings' }
    render(<FormBlock props={applied('form', props) as never} block={node('f', 'form', props)} context={live} />)
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/settings')
  })
  it('no label: no secondary control', () => {
    const props = { submitLabel: 'Save' }
    render(<FormBlock props={applied('form', props) as never} block={node('f', 'form', props)} context={live} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
  it('the runtime runs the secondary action', () => {
    const surface = {
      id: 's',
      blocks: [
        { id: 'f', type: 'form', props: { submitLabel: 'Next', secondaryLabel: 'Back', secondaryAction: { type: 'setState', key: 'step', value: 1 } } },
        { id: 't', type: 'text', props: { content: 'Step {{state.step}}' } },
      ],
      capabilities: [{ capability: 'platform/persistence', config: { initialState: { step: 2 } } }],
    }
    render(<DataBoundSurfaceRenderer surface={surface as never} components={{ form: FormBlock, text: TextBlock } as never} />)
    expect(screen.getByText('Step 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Step 1')).toBeTruthy()
  })
})

describe('focus — a step heading and a result alert', () => {
  it('heading focusOn: no focus on the first render, focus when the value changes', () => {
    const at = (step: number) => {
      const props = { text: `Step ${step}`, level: 'h2', focusOn: step }
      return <HeadingBlock props={applied('heading', props) as never} block={node('h', 'heading', props)} context={live} />
    }
    const { rerender } = render(at(1))
    const h = screen.getByRole('heading')
    expect(h.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).not.toBe(h)
    rerender(at(2))
    expect(document.activeElement).toBe(screen.getByRole('heading'))
  })
  it('heading without focusOn is not focusable', () => {
    const props = { text: 'Title', level: 'h2' }
    render(<HeadingBlock props={applied('heading', props) as never} block={node('h', 'heading', props)} context={live} />)
    expect(screen.getByRole('heading').hasAttribute('tabindex')).toBe(false)
  })
  it('alert focusOnShow takes focus when it appears', () => {
    const props = { title: 'Your message did not arrive', variant: 'error', focusOnShow: true }
    render(<AlertBlock props={applied('alert', props) as never} block={node('a', 'alert', props)} context={live} />)
    expect(document.activeElement).toBe(screen.getByRole('alert'))
  })
  it('alert without focusOnShow leaves focus alone; an editor preview never moves it', () => {
    const props = { title: 'Sent', variant: 'success' }
    render(<AlertBlock props={applied('alert', props) as never} block={node('a', 'alert', props)} context={live} />)
    expect(document.activeElement).toBe(document.body)
    cleanup()
    const p2 = { title: 'Sent', variant: 'success', focusOnShow: true }
    render(<AlertBlock props={applied('alert', p2) as never} block={node('a', 'alert', p2)} context={{ interactionMode: 'inert' } as never} />)
    expect(document.activeElement).toBe(document.body)
  })
})
