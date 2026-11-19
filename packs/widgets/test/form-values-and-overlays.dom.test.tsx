/**
 * Interactive form controls and overlays. One
 * describe per behaviour.
 *
 * The form family's contract is the one `form.form` reads: `new FormData(form)`
 * at submit. A control whose value never reaches a NAMED form element is not
 * submitted, whatever it shows (otp-input, tag-input, combobox,
 * rich-text-editor, file-dropzone, toggle).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import * as React from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { OtpInputBlock } from '../../foundation/atoms/blocks/form/otp-input/component.js'
import { TagInputBlock } from '../atoms/blocks/form/tag-input/component.js'
import { ComboboxBlock } from '../atoms/blocks/form/combobox/component.js'
import { RichTextEditorBlock, sanitizeRichText } from '../atoms/blocks/form/rich-text-editor/component.js'
import { FileDropzoneBlock } from '../atoms/blocks/form/file-dropzone/component.js'
import { ToggleBlock } from '../../foundation/atoms/blocks/form/toggle/component.js'
import { SliderBlock } from '../atoms/blocks/form/slider/component.js'
import { LikeButtonBlock } from '../atoms/blocks/control/like-button/component.js'
import { DrawerBlock } from '../../foundation/atoms/blocks/overlay/drawer/component.js'
import { ModalBlock } from '../../foundation/atoms/blocks/overlay/modal/component.js'
import { CommandPaletteBlock } from '../atoms/blocks/overlay/command-palette/component.js'
import { DropdownBlock } from '../../foundation/atoms/blocks/control/dropdown/component.js'
import { PopoverBlock } from '../../foundation/atoms/blocks/overlay/popover/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * jsdom has no DataTransfer, and its file input accepts only a GENUINE FileList.
 * The stub below is what a browser provides: `new DataTransfer()`, `items.add`,
 * and `.files` as a real FileList (built through jsdom's own FileList impl).
 */
const req = createRequire(import.meta.url)
const idl = req('jsdom/lib/jsdom/living/generated/utils.js')
function realFileList(files: File[]): FileList {
  const probe = document.createElement('input')
  probe.type = 'file'
  const wrapper = probe.files as FileList
  const impl = idl.implForWrapper(wrapper)
  for (const f of files) impl.push(idl.implForWrapper(f))
  return wrapper
}
class BrowserDataTransfer {
  private list: File[] = []
  items = { add: (f: File) => void this.list.push(f) }
  get files(): FileList {
    return realFileList(this.list)
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }
type AnyBlock = React.FC<Record<string, unknown>>

function el(
  C: unknown,
  id: string,
  type: string,
  props: Record<string, unknown>,
  children?: React.ReactNode,
  context: Record<string, unknown> = {},
) {
  const Comp = C as AnyBlock
  return (
    <Comp key={id} props={applied(type, props)} block={{ id, type, props, layout: {} }} context={context}>
      {children}
    </Comp>
  )
}

function mount(tree: React.ReactNode): { events: Ev[]; rerender: (t: React.ReactNode) => void } {
  const events: Ev[] = []
  const wrapIn = (t: React.ReactNode) => (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      {t}
    </BehaviorSurfaceProvider>
  )
  const r = render(wrapIn(tree))
  return { events, rerender: (t) => r.rerender(wrapIn(t)) }
}

/** What `form.form` would submit: FormData of the nearest (only) form. */
function formValues(): Record<string, FormDataEntryValue[]> {
  const form = document.querySelector('form') as HTMLFormElement
  const out: Record<string, FormDataEntryValue[]> = {}
  for (const [k, v] of new FormData(form).entries()) (out[k] ??= []).push(v)
  return out
}

const inForm = (...children: React.ReactNode[]) => <form>{children}</form>

// ── otp-input ────────────────────────────────────────────────────────────

describe('otp-input submits ONE named value', () => {
  it('the digits arrive joined under `name`, not as name-0…name-5', () => {
    mount(inForm(el(OtpInputBlock, 'otp', 'otp-input', { name: 'verificationCode', label: 'Code', length: 4 })))
    const cells = screen.getAllByRole('textbox')
    '4821'.split('').forEach((d, i) => fireEvent.change(cells[i]!, { target: { value: d } }))
    const v = formValues()
    expect(v.verificationCode).toEqual(['4821'])
    expect(Object.keys(v).filter((k) => k.startsWith('verificationCode-'))).toEqual([])
  })

  it('an incomplete required code is invalid, a complete one is valid', () => {
    mount(inForm(el(OtpInputBlock, 'otp', 'otp-input', { name: 'code', label: 'Code', length: 3, required: true })))
    const form = document.querySelector('form') as HTMLFormElement
    expect(form.checkValidity()).toBe(false)
    const cells = screen.getAllByRole('textbox')
    '123'.split('').forEach((d, i) => fireEvent.change(cells[i]!, { target: { value: d } }))
    expect(form.checkValidity()).toBe(true)
  })
})

// ── tag-input ────────────────────────────────────────────────────────

describe('tag-input submits its tags', () => {
  it('added tags reach FormData (comma-joined under `name`) and emit the array', () => {
    const { events } = mount(inForm(el(TagInputBlock, 'tags', 'tag-input', { name: 'skills', label: 'Skills', stateKey: 'skills' })))
    const box = screen.getByRole('textbox')
    fireEvent.change(box, { target: { value: 'Go' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.change(box, { target: { value: 'Rust' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(formValues().skills).toEqual(['Go,Rust'])
    const last = events.filter((e) => e.type === 'input:change').pop()
    expect(last?.payload?.value).toEqual(['Go', 'Rust'])
    expect(last?.payload?.action).toEqual({ type: 'setState', key: 'skills', value: ['Go', 'Rust'] })
  })

  it('no invented tags: without `tags` the field starts empty', () => {
    mount(inForm(el(TagInputBlock, 'tags', 'tag-input', { name: 'skills' })))
    expect(screen.queryByText('React')).toBeNull()
    expect(screen.queryByText('TypeScript')).toBeNull()
  })

  it('a tag is removed by a real, named button', () => {
    mount(inForm(el(TagInputBlock, 'tags', 'tag-input', { name: 'skills', tags: ['Go', 'Rust'] })))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Go' }))
    expect(formValues().skills).toEqual(['Rust'])
  })

  it('required with no tags is invalid', () => {
    mount(inForm(el(TagInputBlock, 'tags', 'tag-input', { name: 'skills', required: true })))
    expect((document.querySelector('form') as HTMLFormElement).checkValidity()).toBe(false)
  })

  it('the tag chip background is a balanced color-mix', () => {
    mount(inForm(el(TagInputBlock, 'tags', 'tag-input', { name: 'skills', tags: ['Go'] })))
    const chip = screen.getByText('Go').closest('span') as HTMLElement
    const src = readFileSync(join(here, '../atoms/blocks/form/tag-input/component.tsx'), 'utf8')
    for (const m of src.matchAll(/'(color-mix\([^']*)'/g)) {
      const s = m[1]!
      expect(s.split('(').length, s).toBe(s.split(')').length)
    }
    expect(chip).toBeTruthy()
  })
})

// ── combobox ─────────────────────────────────────────────────────────

describe('combobox submits the value, not the label', () => {
  const options = [
    { label: 'London', value: 'lon' },
    { label: 'Paris', value: 'par' },
  ]

  it('choosing "London" submits "lon"', () => {
    const { events } = mount(inForm(el(ComboboxBlock, 'cb', 'combobox', { name: 'city', label: 'City', options, stateKey: 'city' })))
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.mouseDown(screen.getByRole('option', { name: 'London' }))
    expect(formValues().city).toEqual(['lon'])
    const last = events.filter((e) => e.type === 'input:change').pop()
    expect(last?.payload?.action).toEqual({ type: 'setState', key: 'city', value: 'lon' })
  })

  it('defaultValue preselects, required without a choice is invalid', () => {
    mount(inForm(el(ComboboxBlock, 'cb', 'combobox', { name: 'city', label: 'City', options, defaultValue: 'par' })))
    expect(formValues().city).toEqual(['par'])
    cleanup()
    mount(inForm(el(ComboboxBlock, 'cb2', 'combobox', { name: 'city', label: 'City', options, required: true })))
    expect((document.querySelector('form') as HTMLFormElement).checkValidity()).toBe(false)
  })

  it('no invented options or label; the active option is announced', () => {
    mount(inForm(el(ComboboxBlock, 'cb', 'combobox', { name: 'city' })))
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.queryByText('Alpha')).toBeNull()
    expect(screen.queryByText('Select')).toBeNull()
    cleanup()
    mount(inForm(el(ComboboxBlock, 'cb', 'combobox', { name: 'city', label: 'City', options })))
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    const listbox = screen.getByRole('listbox')
    expect(input.getAttribute('aria-controls')).toBe(listbox.id)
    const active = input.getAttribute('aria-activedescendant')
    expect(active && document.getElementById(active)?.textContent).toContain('London')
  })
})

// ── rich-text-editor ─────────────────────────────────────────────────

describe('rich-text-editor submits sanitized HTML', () => {
  it('the typed HTML reaches FormData under `name` and the bus hears input:change', () => {
    const { events } = mount(inForm(el(RichTextEditorBlock, 'rte', 'rich-text-editor', { name: 'bio', label: 'Bio' })))
    const editor = screen.getByRole('textbox', { name: 'Bio' })
    editor.innerHTML = '<b>Hi</b>'
    fireEvent.input(editor)
    expect(formValues().bio).toEqual(['<b>Hi</b>'])
    expect(events.some((e) => e.type === 'input:change' && e.payload?.value === '<b>Hi</b>')).toBe(true)
    expect(document.querySelector('[data-block-id="rte"]')).not.toBeNull()
  })

  it('a bound value cannot carry script: handlers, script tags and javascript: links are stripped', () => {
    const evil =
      '<p onclick="steal()">x<script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">l</a><iframe src="https://e.x"></iframe></p>'
    mount(inForm(el(RichTextEditorBlock, 'rte', 'rich-text-editor', { name: 'bio', label: 'Bio', value: evil })))
    const html = screen.getByRole('textbox', { name: 'Bio' }).innerHTML
    expect(html).not.toMatch(/onclick|onerror|<script|javascript:|<iframe/i)
    expect(sanitizeRichText('<a href="https://ok.example" style="x">ok</a>')).toBe('<a href="https://ok.example">ok</a>')
  })

  it.each([
    ['java&Tab;script:alert(1)'],
    ['java&Tab script:alert(1)'],
    ['java&nbspscript:alert(1)'],
    ['jav&#x09;ascript:alert(1)'],
    ['&#106;avascript:alert(1)'],
    ['JAVASCRIPT:alert(1)'],
    [' javascript:alert(1)'],
    ['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['java&NewLine;script:alert(1)'],
    ['javascript&colon;alert(1)'],
    ['vbscript:msgbox(1)'],
  ])('an obfuscated unsafe href is refused: %s', (href) => {
    const out = sanitizeRichText(`<a href="${href}">x</a>`)
    expect(out).toBe('<a>x</a>')
  })

  it('safe hrefs survive, and every & in them is escaped', () => {
    expect(sanitizeRichText('<a href="https://ok.example/?a=1&b=2">x</a>')).toBe('<a href="https://ok.example/?a=1&amp;b=2">x</a>')
    expect(sanitizeRichText('<a href="mailto:hi@ok.example">x</a>')).toBe('<a href="mailto:hi@ok.example">x</a>')
    expect(sanitizeRichText('<a href="/docs#top">x</a>')).toBe('<a href="/docs#top">x</a>')
  })

  it('the toolbar buttons are named', () => {
    mount(inForm(el(RichTextEditorBlock, 'rte', 'rich-text-editor', { name: 'bio', label: 'Bio' })))
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bulleted list' })).toBeTruthy()
  })
})

// ── file-dropzone ────────────────────────────────────────────────────────

describe('file-dropzone includes dropped files', () => {
  beforeEach(() => vi.stubGlobal('DataTransfer', BrowserDataTransfer))
  it('a dropped file lands in the named file input and is announced', () => {
    const { events } = mount(inForm(el(FileDropzoneBlock, 'fd', 'file-dropzone', { name: 'avatar', label: 'Avatar' })))
    const file = new File(['x'], 'me.png', { type: 'image/png' })
    const zone = screen.getByRole('button', { name: 'Avatar' })
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ['Files'] } })
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    expect(input.files?.[0]?.name).toBe('me.png')
    expect(events.some((e) => e.type === 'input:change' && (e.payload?.names as string[])?.includes('me.png'))).toBe(true)
  })

  it('a file over maxSizeMb or of the wrong type is refused with a visible message', () => {
    mount(inForm(el(FileDropzoneBlock, 'fd', 'file-dropzone', { name: 'avatar', label: 'Avatar', accept: 'image/png', maxSizeMb: 1 })))
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    fireEvent.drop(screen.getByRole('button', { name: 'Avatar' }), { dataTransfer: { files: [big] } })
    expect(screen.getByRole('alert').textContent).toMatch(/big\.png/)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    expect(input.files?.length ?? 0).toBe(0)
    expect(formValues().avatar ?? []).not.toContainEqual(expect.objectContaining({ name: 'big.png' }))
    const pdf = new File(['x'], 'cv.pdf', { type: 'application/pdf' })
    fireEvent.drop(screen.getByRole('button', { name: 'Avatar' }), { dataTransfer: { files: [pdf] } })
    expect(screen.getByRole('alert').textContent).toMatch(/cv\.pdf/)
  })
  it('names the accepted types in plain words, never the raw accept string', () => {
    mount(inForm(el(FileDropzoneBlock, 'fd', 'file-dropzone', { name: 'avatar', label: 'Avatar', accept: 'image/png,image/jpeg', maxSizeMb: 5 })))
    const zone = screen.getByRole('button', { name: 'Avatar' })
    expect(zone.textContent).toContain('PNG or JPEG')
    expect(zone.textContent).not.toContain('image/')
  })
})

// ── toggle ───────────────────────────────────────────────────────────

describe('toggle submits a boolean', () => {
  it('off submits "false", on submits "true", typed as boolean; stateKey carries the boolean', () => {
    const { events } = mount(inForm(el(ToggleBlock, 'tg', 'toggle', { name: 'twoFactor', label: '2FA', stateKey: 'twoFactor' })))
    expect(formValues().twoFactor).toEqual(['false'])
    const sw = screen.getByRole('switch', { name: '2FA' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(formValues().twoFactor).toEqual(['true'])
    expect(document.querySelector('input[type=hidden][name=twoFactor]')?.getAttribute('data-pw-value-type')).toBe('boolean')
    const last = events.filter((e) => e.type === 'input:change').pop()
    expect(last?.payload?.action).toEqual({ type: 'setState', key: 'twoFactor', value: true })
  })

  it('a bound `checked` that arrives later re-selects; the label row grows', () => {
    const { rerender } = mount(inForm(el(ToggleBlock, 'tg', 'toggle', { name: 't', label: 'x', checked: false })))
    rerender(inForm(el(ToggleBlock, 'tg', 'toggle', { name: 't', label: 'x', checked: true })))
    expect(formValues().t).toEqual(['true'])
    const row = document.querySelector('[data-block-id="tg"] label') as HTMLElement
    expect(row.style.height).toBe('')
  })

  it('no "Toggle" fallback label', () => {
    mount(inForm(el(ToggleBlock, 'tg', 'toggle', { name: 't' })))
    expect(screen.queryByText('Toggle')).toBeNull()
  })
})

// ── slider ───────────────────────────────────────────────────────────────

describe('slider', () => {
  it('stateKey, no "Value" fallback, number-typed, bound value re-selects', () => {
    const { events, rerender } = mount(inForm(el(SliderBlock, 'sl', 'slider', { name: 'vol', stateKey: 'vol', value: 10 })))
    expect(screen.queryByText('Value')).toBeNull()
    const range = document.querySelector('input[type=range]') as HTMLInputElement
    expect(range.getAttribute('data-pw-value-type')).toBe('number')
    fireEvent.change(range, { target: { value: '40' } })
    const last = events.filter((e) => e.type === 'input:change').pop()
    expect(last?.payload?.action).toEqual({ type: 'setState', key: 'vol', value: 40 })
    rerender(inForm(el(SliderBlock, 'sl', 'slider', { name: 'vol', value: 70 })))
    expect(formValues().vol).toEqual(['70'])
  })
})

// ── like-button ─────────────────────────────────────────────────────────

describe('like-button dispatches once per click', () => {
  it('bus + context.onEvent together see exactly one event', () => {
    const onEvent = vi.fn()
    const { events } = mount(el(LikeButtonBlock, 'lk', 'like-button', { label: 'Like', count: 1 }, undefined, { onEvent }))
    fireEvent.click(screen.getByRole('button'))
    expect(events.filter((e) => e.blockId === 'lk').length + onEvent.mock.calls.length).toBe(1)
  })
})

// ── drawer ─────────────────────────────────────────────────────────

describe('drawer is a real overlay', () => {
  it('opens as a fixed side sheet with a backdrop, a dialog role and a close button; Escape closes', () => {
    mount(el(DrawerBlock, 'dr', 'drawer', { triggerLabel: 'Filters', placement: 'left' }, <p>panel body</p>))
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.style.position).toBe('fixed')
    expect(dialog.style.left).toBe('0px')
    expect(screen.queryByText(/Drawer \(/)).toBeNull()
    expect(document.querySelector('[data-pw-drawer-backdrop]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ── modal ──────────────────────────────────────────────────────────

describe('modal', () => {
  it('uses triggerLabel (no "Open Modal"), moves focus in, Escape closes via closeModal and returns focus', () => {
    const { events } = mount(el(ModalBlock, 'md', 'modal', { title: 'Delete', triggerLabel: 'Delete project' }, <button>Confirm</button>))
    expect(screen.queryByText('Open Modal')).toBeNull()
    const trigger = screen.getByRole('button', { name: 'Delete project' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(events.some((e) => e.payload?.action === 'close')).toBe(true)
    expect(document.activeElement).toBe(trigger)
  })

  it('a modal with no triggerLabel and no title draws no invented text', () => {
    mount(el(ModalBlock, 'md', 'modal', {}))
    expect(screen.queryByText('Open Modal')).toBeNull()
  })
})

// ── command-palette ────────────────────────────────────────────────

describe('command-palette', () => {
  it('no platform-internal sample commands; "No results" is not an option', () => {
    mount(el(CommandPaletteBlock, 'cp', 'command-palette', {}))
    expect(screen.queryByText('New surface')).toBeNull()
    expect(screen.queryByText('Invite teammate')).toBeNull()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('an item with an id runs with it', () => {
    const { events } = mount(el(CommandPaletteBlock, 'cp', 'command-palette', { items: [{ id: 'new-order', label: 'New order' }] }))
    fireEvent.click(screen.getByRole('option', { name: 'New order' }))
    expect(events.some((e) => e.payload?.action === 'run' && e.payload?.id === 'new-order')).toBe(true)
  })

  it('its search field has an accessible name, an id and a name', () => {
    mount(el(CommandPaletteBlock, 'cp', 'command-palette', { placeholder: 'Search commands' }))
    const search = screen.getByRole('combobox', { name: 'Search commands' })
    expect(search.id).toBe('cp-search')
    expect(search.getAttribute('name')).toBe('cp-search')
  })
})

// ── fallback text ────────────────────────────────────────────────

describe('no invented dropdown/popover text', () => {
  it('dropdown without items shows no "Option 1"; popover without content shows no "Popover content"', () => {
    mount(el(DropdownBlock, 'dd', 'dropdown', { trigger: 'Actions' }))
    fireEvent.click(screen.getByRole('button', { name: /Actions/ }))
    expect(screen.queryByText('Option 1')).toBeNull()
    cleanup()
    mount(el(PopoverBlock, 'pp', 'popover', { triggerLabel: 'Info' }))
    fireEvent.click(screen.getByRole('button', { name: /Info/ }))
    expect(screen.queryByText('Popover content')).toBeNull()
  })
})

// ── Focus rings ──────────────────────────────────────────────────────────────

describe('focus rings are not erased inline', () => {
  it("no interactive block sets outline:'none'", () => {
    // The blocks that came from `interactive`, now split between foundation and widgets.
    const roots = [
      ...['form/otp-input', 'form/toggle', 'overlay/drawer', 'overlay/modal', 'overlay/popover', 'control/dropdown'].map((b) => join(here, '../../foundation/atoms/blocks', b)),
      ...['form/tag-input', 'form/combobox', 'form/rich-text-editor', 'form/file-dropzone', 'form/slider', 'control/like-button', 'overlay/command-palette'].map((b) => join(here, '../atoms/blocks', b)),
    ]
    const offenders: string[] = []
    const walk = (d: string): void => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, f.name)
        if (f.isDirectory()) walk(p)
        else if (f.name.endsWith('.tsx') && /outline:\s*'none'/.test(readFileSync(p, 'utf8'))) offenders.push(p)
      }
    }
    for (const r of roots) walk(r)
    expect(offenders).toEqual([])
  })
})

// An "add" dialog must open from a button elsewhere on the page and close after
// the save, so its open state is bindable rather than private.

describe('the modal opens and closes from state (open + stateKey)', () => {
  const visible = () => (screen.getByRole('dialog', { hidden: true }).parentElement as HTMLElement).style.visibility

  it('a bound `open` opens and closes it without its own trigger', () => {
    const props = (open: unknown) => ({ title: 'New record', open, stateKey: 'addOpen' })
    const { rerender } = mount(el(ModalBlock, 'md', 'modal', props(false), <p>form</p>))
    expect(visible()).toBe('hidden')
    rerender(el(ModalBlock, 'md', 'modal', props(true), <p>form</p>))
    expect(visible()).toBe('visible')
    rerender(el(ModalBlock, 'md', 'modal', props(false), <p>form</p>))
    expect(visible()).toBe('hidden')
    // Opened from elsewhere: the title does not become a second trigger button.
    expect(screen.queryByRole('button', { name: 'New record' })).toBeNull()
  })

  it('an interpolated "true" string opens it too', () => {
    mount(el(ModalBlock, 'md', 'modal', { title: 'x', open: 'true', stateKey: 'addOpen' }))
    expect(visible()).toBe('visible')
  })

  it('closing writes false to the state key, opening writes true', () => {
    const { events } = mount(el(ModalBlock, 'md', 'modal', { title: 'New', triggerLabel: 'Add', stateKey: 'addOpen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    const writes = events
      .map((e) => e.payload?.action as { type?: string; key?: string; value?: unknown } | undefined)
      .filter((a) => a?.type === 'setState')
    expect(writes).toEqual([
      { type: 'setState', key: 'addOpen', value: true },
      { type: 'setState', key: 'addOpen', value: false },
    ])
    expect(events.filter((e) => e.payload?.state).map((e) => e.payload?.state)).toEqual(['open', 'close'])
  })

  it('without a stateKey the events keep their old shape', () => {
    const { events } = mount(el(ModalBlock, 'md', 'modal', { title: 'New', triggerLabel: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(events.some((e) => e.payload?.action === 'open')).toBe(true)
  })

  it('the manifest declares open (bindable) and stateKey', () => {
    const m = JSON.parse(readFileSync(join(here, '../../foundation/atoms/blocks/overlay/modal/manifest.json'), 'utf8')) as {
      definition: { props: { name: string; bindable: boolean }[] }
    }
    const byName = Object.fromEntries(m.definition.props.map((p) => [p.name, p]))
    expect(byName.open?.bindable).toBe(true)
    expect(byName.stateKey).toBeTruthy()
  })
})

describe('a picked file goes with the form (the engine refuses it when the record has no file field)', () => {
  it('collectFormValues sends the File under the field name', async () => {
    const { collectFormValues } = await import('../../foundation/atoms/blocks/form/form/component.js')
    const form = document.createElement('form')
    const file = document.createElement('input')
    file.type = 'file'
    file.name = 'logo'
    const picked = new File(['x'], 'logo.png', { type: 'image/png' })
    Object.defineProperty(file, 'files', { value: realFileList([picked]) })
    form.appendChild(file)
    document.body.appendChild(form)
    const values = collectFormValues(form)
    expect(values.logo).toBeInstanceOf(File)
    expect((values.logo as File).name).toBe('logo.png')
  })
})
