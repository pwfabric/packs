import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { listOf, PRESS_CSS } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface TabItem {
  readonly id: string
  readonly label: string
  readonly disabled?: boolean
}

export interface TabsProps {
  readonly tabs: readonly TabItem[]
  readonly defaultTab?: string
  readonly variant: 'default' | 'pills' | 'underline'
  readonly fullWidth: boolean
  /**
   * Sidebar tab-switcher: the tablist stacks in a column and the active
   * indicator moves to the left edge. "horizontal" is the original behavior.
   */
  readonly orientation: 'horizontal' | 'vertical'
  /** State key the active tab id is written to — `{{state.<key>}}` then reads it (a filter, a heading). */
  readonly stateKey?: string
  /**
   * The active tab id page state holds — bind it to the key the tabs write
   * (`"value": "{{state.<stateKey>}}"`). When the key changes from outside
   * this strip follows. An unresolved binding or an id that names no tab is ignored.
   */
  readonly value?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const tabsDefinition: BlockDefinition = {
  type: 'tabs',
  name: 'Tabs',
  category: 'container',
  icon: '⊞',
  defaultProps: {
    tabs: [],
    variant: 'default',
    fullWidth: false,
    orientation: 'horizontal',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: true,
}

// ============================================================
// COMPONENT
// ============================================================

/** Each tab is at least 44px tall at phone width or on a coarse pointer (R3). */
const TAB_HIT_CSS = '@media (max-width: 640px), (pointer: coarse) { [data-pw-tab] { min-height: 44px; } }'

export const TabsBlock: BlockComponent = ({ props, children, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as TabsProps
  // Unset or a wrong shape → [] (the manifest default): no tabs. Inventing
  // "Tab 1 / Tab 2" showed the visitor labels nobody wrote.
  const tabs = listOf<TabItem>(p.tabs)
  const defaultTab = (typeof p.defaultTab === 'string' ? p.defaultTab : undefined) ?? tabs[0]?.id
  const variant = p.variant
  const fullWidth = p.fullWidth
  const orientation = p.orientation
  // A 180px label column beside the panel leaves a phone nothing to read, so
  // on xs a vertical tab strip becomes horizontal.
  const isVertical = orientation === 'vertical' && context?.viewport !== 'xs'
  const stateKey = typeof p.stateKey === 'string' && p.stateKey ? p.stateKey : undefined

  // `value` (bound to the state key) wins over `defaultTab` and re-selects
  // when it changes — the "adjust state when a prop changes" pattern.
  const rawValue: unknown = p.value
  const boundTab =
    typeof rawValue === 'string' && !rawValue.includes('{{') && tabs.some((t) => t.id === rawValue) ? rawValue : undefined
  const [activeTab, setActiveTab] = React.useState(boundTab ?? defaultTab)
  const lastBound = React.useRef(boundTab)
  if (lastBound.current !== boundTab) {
    lastBound.current = boundTab
    if (boundTab !== undefined && boundTab !== activeTab) setActiveTab(boundTab)
  }

  // Each child maps to the tab at the same index; render only the active one.
  const childArray = React.Children.toArray(children)
  const activeIndex = tabs.findIndex((t) => t.id === activeTab)
  const activePanel = activeIndex >= 0 ? childArray[activeIndex] : childArray[0]

  const containerStyle: React.CSSProperties = isVertical
    ? { display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'flex-start' }
    : {
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderRadius: variant === 'pills' ? '24px' : undefined,
      }

  const tabListStyle: React.CSSProperties = isVertical
    ? {
        display: 'flex',
        flexDirection: 'column',
        gap: variant === 'pills' ? '8px' : '2px',
        flexShrink: 0,
        minWidth: '180px',
      }
    : {
        display: 'flex',
        gap: variant === 'pills' ? '8px' : '0',
        // The rule under the tabs belongs to the tab strip, not to the whole
        // block — it used to run under the panel content.
        borderBottom: variant === 'pills' ? undefined : '2px solid var(--pw-color-border)',
        marginBottom: '16px',
        // More tabs than the width: the strip scrolls inside itself instead of
        // being clipped by the page on a phone.
        overflowX: 'auto',
        maxWidth: '100%',
        minWidth: 0,
        scrollbarWidth: 'thin',
      }

  const tabStyle = (isActive: boolean, disabled?: boolean): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '10px 16px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontWeight: 500,
      fontSize: 'var(--pw-font-size-sm)',
      // The tab indicator moves at the theme's normal pace (P6).
      transition: 'all var(--pw-duration-normal, 250ms) var(--pw-easing, ease)',
      flex: fullWidth && !isVertical ? 1 : undefined,
      textAlign: isVertical ? 'left' : 'center',
      border: 'none',
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      flexShrink: fullWidth && !isVertical ? 1 : 0,
    }

    if (isVertical) {
      return {
        ...base,
        borderLeft: isActive ? '2px solid var(--pw-color-primary)' : '2px solid transparent',
        backgroundColor: isActive ? 'color-mix(in srgb, var(--pw-color-primary) 10%, transparent)' : 'transparent',
        color: isActive ? 'var(--pw-color-primary-ink, #18181b)' : 'var(--pw-color-text-muted)',
        borderRadius: '0 var(--pw-tabs-vertical-radius, var(--pw-border-radius-sm)) var(--pw-tabs-vertical-radius, var(--pw-border-radius-sm)) 0',
      }
    }

    if (variant === 'default') {
      return {
        ...base,
        borderBottom: isActive ? '2px solid var(--pw-color-primary)' : '2px solid transparent',
        color: isActive ? 'var(--pw-color-primary-ink, #18181b)' : 'var(--pw-color-text-muted)',
        marginBottom: '-2px',
      }
    }

    if (variant === 'pills') {
      return {
        ...base,
        borderRadius: 'var(--pw-tabs-radius, var(--pw-border-radius))',
        backgroundColor: isActive ? 'var(--pw-color-primary)' : 'var(--pw-color-card)',
        color: isActive ? 'var(--pw-color-text-on-primary)' : 'var(--pw-color-text-muted)',
      }
    }

    if (variant === 'underline') {
      return {
        ...base,
        borderBottom: isActive ? '2px solid var(--pw-color-primary)' : '2px solid transparent',
        color: isActive ? 'var(--pw-color-primary-ink, #18181b)' : 'var(--pw-color-text-muted)',
        marginBottom: '-2px',
      }
    }

    return base
  }

  const handleTabClick = (tabId: string): void => {
    setActiveTab(tabId)
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { action: 'tabChange', tabId },
    })
    if (stateKey) {
      emit({
        type: SURFACE_EVENTS.INPUT_CHANGE,
        surfaceId,
        blockId: block.id,
        payload: { value: tabId, inputId: block.id, action: { type: 'setState', key: stateKey, value: tabId } },
      })
    }
  }

  const handleTabKeyDown = (e: React.KeyboardEvent): void => {
    const enabledTabs = tabs.filter((t) => !t.disabled)
    const currentIndex = enabledTabs.findIndex((t) => t.id === activeTab)

    let nextIndex = -1

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % enabledTabs.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = enabledTabs.length - 1
    }

    if (nextIndex >= 0) {
      const nextTab = enabledTabs[nextIndex]
      if (nextTab) {
        handleTabClick(nextTab.id)
        // Roving tabindex: the selected tab is the only focusable one, so
        // focus must follow it — it used to stay on a button that had just
        // become tabIndex=-1.
        document.getElementById(`${block.id}-tab-${nextTab.id}`)?.focus()
      }
    }
  }

  return (
    <div id={block.id} data-block-id={block.id} style={{ ...containerStyle, ...block.style }} data-block-type="tabs">
      <style>{PRESS_CSS + TAB_HIT_CSS}</style>
      <div style={tabListStyle} role="tablist" aria-orientation={isVertical ? 'vertical' : 'horizontal'} onKeyDown={handleTabKeyDown}>
        {tabs.map((tab: TabItem) => {
          const tabElementId = `${block.id}-tab-${tab.id}`
          const panelElementId = `${block.id}-panel-${tab.id}`
          return (
            <button data-pw-press=""
              key={tab.id}
              type="button"
              id={tabElementId}
              data-pw-tab=""
              style={tabStyle(activeTab === tab.id, tab.disabled)}
              onClick={() => !tab.disabled && handleTabClick(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              // Only the active panel is rendered, so only its tab may point at it.
              aria-controls={activeTab === tab.id ? panelElementId : undefined}
              tabIndex={activeTab === tab.id ? 0 : -1}
              disabled={tab.disabled}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        id={`${block.id}-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`${block.id}-tab-${activeTab}`}
        data-active-tab={activeTab}
        tabIndex={0}
        style={isVertical ? { flex: 1, minWidth: 0 } : undefined}
      >
        {activePanel}
      </div>
    </div>
  )
}
