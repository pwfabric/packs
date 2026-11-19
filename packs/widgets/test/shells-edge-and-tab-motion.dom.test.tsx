/**
 * The tree's current page, and tab motion.
 *
 *   tree-view honours activeHref, so a handbook marks where the reader is.
 *   tabs move at the theme's normal pace.
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { render, cleanup, screen } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import { TabsBlock } from '../../foundation/atoms/blocks/container/tabs/component.js'
import { TreeViewBlock } from '../atoms/blocks/container/tree-view/component.js'
import { applied } from '../../../tools/test-support/applied-props.js'

afterEach(() => cleanup())

describe('tree-view marks the current page', () => {
  it('filled, the tree marks that page (tree-view honours activeHref)', () => {
    const nodes = [
      { id: 'a', label: 'Introduction', href: '/introduction' },
      { id: 'b', label: 'Rules', href: '/rules' },
    ]
    render(
      <BehaviorSurfaceProvider surfaceId="t">
        <TreeViewBlock props={applied('tree-view', { nodes, activeHref: '/rules' })} block={{ id: 'tv', type: 'tree-view', props: {}, layout: {} }} context={{}} />
      </BehaviorSurfaceProvider>,
    )
    const current = screen.getByText('Rules').closest('[aria-current]')
    expect(current?.getAttribute('aria-current')).toBe('page')
  })
})

describe('tabs move at the theme normal pace', () => {
  it('the tab transition reads --pw-duration-normal', () => {
    const { container } = render(
      <BehaviorSurfaceProvider surfaceId="t">
        <TabsBlock
          props={applied('tabs', { tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })}
          block={{ id: 't', type: 'tabs', props: {}, layout: {} }}
          context={{}}
        />
      </BehaviorSurfaceProvider>,
    )
    const tab = container.querySelector('[role="tab"]') as HTMLElement
    expect(tab.style.transition).toContain('var(--pw-duration-normal')
  })
})
