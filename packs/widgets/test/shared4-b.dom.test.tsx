/**
 * Shared pass 4 (B) — tree-view's heading level, nav landmark and the app's
 * words; the command palette named in the app's words and focused when its
 * modal opens; a like button without a count.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { AppMessagesContext, BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TreeViewBlock } from '../atoms/blocks/container/tree-view/component.js'
import { CommandPaletteBlock } from '../atoms/blocks/overlay/command-palette/component.js'
import { LikeButtonBlock } from '../atoms/blocks/control/like-button/component.js'
import { ModalBlock } from '../../foundation/atoms/blocks/overlay/modal/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'


afterEach(() => cleanup())

type AnyBlock = React.FC<Record<string, unknown>>
function el(C: unknown, id: string, type: string, props: Record<string, unknown>, children?: React.ReactNode) {
  const Comp = C as AnyBlock
  return (
    <BehaviorSurfaceProvider surfaceId="t" onEvent={() => {}}>
      <Comp props={applied(type, props)} block={{ id, type, props, layout: {} }} context={{ interactionMode: 'live' }}>
        {children}
      </Comp>
    </BehaviorSurfaceProvider>
  )
}
const words = (messages: Record<string, string>, node: React.ReactElement) => (
  <AppMessagesContext.Provider value={messages}>{node}</AppMessagesContext.Provider>
)

const NODES = [{ id: 'g', label: 'Guides', children: [{ id: 'q', label: 'Quickstart', href: '/quickstart' }] }]

describe('tree-view', () => {
  it('the title takes titleLevel (default h3)', () => {
    render(el(TreeViewBlock, 'tv', 'tree-view', { title: 'Docs', nodes: NODES }))
    expect(screen.getByRole('heading', { level: 3, name: 'Docs' })).toBeTruthy()
    cleanup()
    render(el(TreeViewBlock, 'tv', 'tree-view', { title: 'Docs', titleLevel: 'h2', nodes: NODES }))
    expect(screen.getByRole('heading', { level: 2, name: 'Docs' })).toBeTruthy()
  })

  it('nav: a navigation landmark named by the title, or by navLabel', () => {
    render(el(TreeViewBlock, 'tv', 'tree-view', { nodes: NODES }))
    expect(screen.queryByRole('navigation')).toBeNull()
    cleanup()
    render(el(TreeViewBlock, 'tv', 'tree-view', { title: 'Docs', nav: true, nodes: NODES }))
    expect(screen.getByRole('navigation', { name: 'Docs' })).toBeTruthy()
    cleanup()
    render(el(TreeViewBlock, 'tv', 'tree-view', { nav: true, navLabel: 'Documentation', nodes: NODES }))
    expect(screen.getByRole('navigation', { name: 'Documentation' })).toBeTruthy()
  })

  it('the toggle is named in the app’s words (ui.tree.expand / ui.tree.collapse)', () => {
    render(words({ 'ui.tree.expand': '{label} aufklappen', 'ui.tree.collapse': '{label} zuklappen' }, el(TreeViewBlock, 'tv', 'tree-view', { nodes: NODES })))
    const toggle = screen.getByRole('button', { name: 'Guides aufklappen' })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-label')).toBe('Guides zuklappen')
  })

  it('without an app word the pack writes none of its own (engine 3.0.1: no default words)', () => {
    render(words({}, el(TreeViewBlock, 'tv', 'tree-view', { nodes: NODES })))
    expect(document.querySelector('[aria-label^="Expand"]')).toBeNull()
  })
})

describe('command-palette', () => {
  it('its dialog and search are named in the app’s words', () => {
    render(words({ 'ui.commandPalette.label': 'Befehle', 'ui.commandPalette.search': 'Befehle suchen' }, el(CommandPaletteBlock, 'cp', 'command-palette', { placeholder: '' })))
    expect(screen.getByRole('dialog', { name: 'Befehle' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Befehle suchen' })).toBeTruthy()
  })

  it('opening the modal that holds it focuses its search', () => {
    render(
      el(ModalBlock, 'md', 'modal', { title: 'Search the docs', triggerLabel: 'Search' },
        el(CommandPaletteBlock, 'cp', 'command-palette', { placeholder: 'Search pages', items: [{ label: 'Overview', href: '/overview' }] }))
    )
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Search pages' }))
  })
})

describe('like-button', () => {
  it('showCount false draws no count', () => {
    render(el(LikeButtonBlock, 'lk', 'like-button', { label: 'Like', count: 12 }))
    expect(screen.getByRole('button').textContent).toContain('12')
    cleanup()
    render(el(LikeButtonBlock, 'lk', 'like-button', { label: 'Like', count: 12, showCount: false }))
    expect(screen.getByRole('button').textContent).toBe('Like')
  })
})
