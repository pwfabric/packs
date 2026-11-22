/**
 * The visitor's two app-wide choices (engine 3.5): the colour scheme
 * (`context.colorScheme` / `setColorScheme`) and the language
 * (`context.locale` / `locales` / `alternates`).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { BehaviorSurfaceProvider, AppMessagesContext } from '@pwfabric/runtime'
import { ThemeToggleBlock, schemeOf } from '../atoms/blocks/control/theme-toggle/component.js'
import { LanguageSwitchBlock, autonym, switchEntries } from '../atoms/blocks/control/language-switch/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

type Ev = { type: string; blockId?: string; payload?: Record<string, unknown> }

function tree(C: unknown, id: string, type: string, props: Record<string, unknown>, context: Record<string, unknown>, events: Ev[] = []): React.ReactElement {
  const Comp = C as React.FC<Record<string, unknown>>
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={(e) => events.push(e as Ev)}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live', ...context }} />
    </BehaviorSurfaceProvider>
  )
}

describe('theme-toggle', () => {
  it('a radio group named in the app words, English when the app sets none', () => {
    render(tree(ThemeToggleBlock, 'tt', 'theme-toggle', {}, { colorScheme: 'system' }))
    const group = screen.getByRole('group', { name: 'Colour scheme' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Light', 'Dark', 'System'])
    expect((screen.getByRole('radio', { name: 'System' }) as HTMLInputElement).checked).toBe(true)
  })

  it('the app words win', () => {
    const words = { 'ui.colorScheme': 'Görünüm', 'ui.colorScheme.light': 'Açık', 'ui.colorScheme.dark': 'Koyu', 'ui.colorScheme.system': 'Sistem' }
    render(<AppMessagesContext.Provider value={words}>{tree(ThemeToggleBlock, 'tt', 'theme-toggle', {}, { colorScheme: 'dark' })}</AppMessagesContext.Provider>)
    expect(screen.getByRole('group', { name: 'Görünüm' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Koyu' }) as HTMLInputElement).checked).toBe(true)
  })

  it('choosing calls context.setColorScheme; the block draws what the context says', () => {
    const setColorScheme = vi.fn()
    render(tree(ThemeToggleBlock, 'tt', 'theme-toggle', {}, { colorScheme: 'light', setColorScheme }))
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(setColorScheme).toHaveBeenCalledWith('dark')
    // The host answers with the new context; until then the drawn choice is the context's.
    expect((screen.getByRole('radio', { name: 'Light' }) as HTMLInputElement).checked).toBe(true)
  })

  it('the first frame does not depend on a stored choice: no context value is system', () => {
    try {
      localStorage.setItem('pw-color-scheme', 'dark')
    } catch {
      // storage may be unavailable; the block never reads it either way
    }
    const html = renderToString(tree(ThemeToggleBlock, 'tt', 'theme-toggle', {}, {}))
    const checked = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]).filter((i) => i.includes('checked'))
    expect(checked).toHaveLength(1)
    expect(checked[0]).toContain('value="system"')
    expect(schemeOf(undefined)).toBe('system')
    expect(schemeOf('sepia')).toBe('system')
  })

  it('showSystem: false leaves two choices; showLabels: false keeps the words as names', () => {
    render(tree(ThemeToggleBlock, 'tt', 'theme-toggle', { showSystem: false, showLabels: false }, { colorScheme: 'light' }))
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeTruthy()
    expect((screen.getByText('Dark') as HTMLElement).style.position).toBe('absolute')
  })

  it('in the editor it shows the scheme and does not switch', () => {
    const setColorScheme = vi.fn()
    render(tree(ThemeToggleBlock, 'tt', 'theme-toggle', {}, { interactionMode: 'inert', colorScheme: 'light', setColorScheme }))
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(setColorScheme).not.toHaveBeenCalled()
  })
})

describe('language-switch', () => {
  const alternates = { en: '/pricing/', de: '/de/preise/', tr: '/tr/fiyatlar/' }

  it('links to this page in every locale, in the app order, each hreflang and lang of its language', () => {
    render(tree(LanguageSwitchBlock, 'ls', 'language-switch', {}, { locale: 'de', locales: ['en', 'de', 'tr'], alternates }))
    const nav = screen.getByRole('navigation', { name: 'Language' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/pricing/', '/de/preise/', '/tr/fiyatlar/'])
    expect(links.map((a) => a.getAttribute('hreflang'))).toEqual(['en', 'de', 'tr'])
    expect(links.map((a) => a.getAttribute('lang'))).toEqual(['en', 'de', 'tr'])
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, 'page', null])
  })

  it('each language is named in itself unless labels names it', () => {
    render(tree(LanguageSwitchBlock, 'ls', 'language-switch', { labels: { en: 'EN' } }, { locale: 'en', locales: ['en', 'de', 'tr'], alternates }))
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['EN', autonym('de'), autonym('tr')])
    expect(autonym('de')).toBe('Deutsch')
    expect(autonym('tr')).toBe('Türkçe')
  })

  it('the links take the colour around them (a dark bar), or the color prop', () => {
    const ctx = { locale: 'en', locales: ['en', 'de'], alternates }
    render(tree(LanguageSwitchBlock, 'ls', 'language-switch', {}, ctx))
    expect(screen.getAllByRole('link').map((a) => a.style.color)).toEqual(['inherit', 'inherit'])
    cleanup()
    render(tree(LanguageSwitchBlock, 'ls', 'language-switch', { color: 'var(--pw-color-text-on-primary)' }, ctx))
    expect(screen.getAllByRole('link').every((a) => a.style.color === 'var(--pw-color-text-on-primary)')).toBe(true)
  })

  it('one locale, or no alternates: nothing to switch to, nothing drawn', () => {
    const { container } = render(tree(LanguageSwitchBlock, 'ls', 'language-switch', {}, { locale: 'en', locales: ['en'], alternates: { en: '/' } }))
    expect(container.textContent).toBe('')
    expect(document.getElementById('ls')).toBeNull()
    cleanup()
    render(tree(LanguageSwitchBlock, 'ls', 'language-switch', {}, { locale: 'en' }))
    expect(document.getElementById('ls')).toBeNull()
  })

  it('a locale with no address for this page, or an unsafe one, is left out', () => {
    expect(switchEntries(['en', 'de', 'fr'], { en: '/', de: 'javascript:alert(1)' })).toEqual([{ lang: 'en', href: '/' }])
    expect(switchEntries(['en', 'de'], { en: '/', de: '/de/' })).toHaveLength(2)
  })

  it('in the editor a click reports the address and stays', () => {
    const events: Ev[] = []
    render(tree(LanguageSwitchBlock, 'ls', 'language-switch', {}, { interactionMode: 'inert', locale: 'en', locales: ['en', 'de'], alternates }, events))
    const de = screen.getByRole('link', { name: 'Deutsch' })
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    de.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(events).toContainEqual(expect.objectContaining({ type: 'block:click', blockId: 'ls', payload: { href: '/de/preise/' } }))
  })
})
