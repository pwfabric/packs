import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { listOf, safeHref, PRESS_CSS } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** On a phone or touch screen the trigger and every item are REAL 44px-tall boxes (the trigger was 39px). */
const DROPDOWN_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-dropdown-trigger], [data-pw-dropdown-item] { min-height: 44px; } }'

export interface DropdownItem {
  readonly id: string
  readonly label: string
  readonly href?: string
  readonly icon?: string
  readonly disabled?: boolean
  readonly divider?: boolean
}

export interface DropdownProps {
  readonly trigger?: string
  readonly items: readonly DropdownItem[]
  readonly placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
  readonly triggerVariant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
}

// ============================================================
// DEFINITION
// ============================================================

export const dropdownDefinition: BlockDefinition = {
  type: 'dropdown',
  name: 'Dropdown',
  category: 'control',
  icon: '▼',
  defaultProps: {
    items: [],
    placement: 'bottom-start',
    triggerVariant: 'secondary',
  },
  defaultLayout: { span: { xs: 2, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const DropdownBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  // No invented menu: 'Menu' / 'Option 1' / 'Option 2' reached visitors.
  const p = props as unknown as DropdownProps
  const trigger = typeof p.trigger === 'string' ? p.trigger : ''
  const items = listOf<DropdownItem>(p.items)
  const placement = p.placement
  const triggerVariant = p.triggerVariant

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscapeKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // Esc closes the menu AND hands focus back to its button: the
        // menu hides with visibility, so focus left on an item fell to <body>.
        event.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return (): void => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--pw-color-primary)',
      color: 'var(--pw-color-text-on-primary)',
      border: 'none',
    },
    secondary: {
      backgroundColor: 'var(--pw-color-card)',
      color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
      border: '1px solid var(--pw-color-border)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--pw-color-primary-ink, #18181b)',
      border: '1px solid var(--pw-color-primary)',
    },
    ghost: { backgroundColor: 'transparent', color: 'var(--pw-color-primary-ink, #18181b)', border: 'none' },
  }

  const placementStyles: Record<string, React.CSSProperties> = {
    'bottom-start': { top: '100%', left: 0, marginTop: '4px' },
    'bottom-end': { top: '100%', right: 0, marginTop: '4px' },
    'top-start': { bottom: '100%', left: 0, marginBottom: '4px' },
    'top-end': { bottom: '100%', right: 0, marginBottom: '4px' },
  }

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    backgroundColor: (variantStyles[triggerVariant] ?? variantStyles['secondary'])?.backgroundColor,
    borderRadius: 'var(--pw-border-radius)',
  }

  const triggerStyle: React.CSSProperties = {
    ...(variantStyles[triggerVariant] ?? variantStyles.secondary),
    padding: '10px 16px',
    borderRadius: 'var(--pw-border-radius)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--pw-font-size-sm)',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  }

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    ...placementStyles[placement],
    minWidth: '160px',
    backgroundColor: 'var(--pw-color-card)',
    border: '1px solid var(--pw-color-border)',
    borderRadius: 'var(--pw-border-radius-lg)',
    boxShadow: 'var(--pw-shadow-lg)',
    zIndex: 'var(--pw-z-dropdown)',
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transform: isOpen ? 'translateY(0)' : 'translateY(-4px)',
    transition:
      'opacity var(--pw-duration-fast), transform var(--pw-duration-fast), visibility var(--pw-duration-fast)',
    padding: '4px',
  }

  const itemStyleFn = (disabled?: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    textAlign: 'left',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 'var(--pw-border-radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: 'var(--pw-font-size-sm)',
    color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
    textDecoration: 'none',
  })

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    backgroundColor: 'var(--pw-color-border)',
    margin: '4px 0',
  }

  const handleItemClick = (item: DropdownItem): void => {
    if (item.disabled) return
    // Real navigation is a SIDE-EFFECT — only in live mode. In inert
    // (editor/preview) we skip it and emit the select event instead so the
    // host still gets feedback (notification semantics).
    const href = safeHref(item.href)
    if (href && context.interactionMode !== 'inert' && typeof window !== 'undefined') {
      window.location.href = href
    } else {
      emit({
        type: SURFACE_EVENTS.BLOCK_CLICK,
        surfaceId,
        blockId: block.id,
        payload: { action: 'select', itemId: item.id, label: item.label },
      })
    }
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  // Arrow keys walk the items; the first item takes focus when the menu opens
  // from the keyboard (ArrowDown on the button).
  const itemButtons = (): HTMLButtonElement[] =>
    Array.from(containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])
  const onMenuKey = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const list = itemButtons()
    if (list.length === 0) return
    e.preventDefault()
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length
    list[next]?.focus()
  }
  const onTriggerKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault()
      setIsOpen(true)
      setTimeout(() => itemButtons()[0]?.focus(), 0)
    }
  }

  return (
    <div
      ref={containerRef}
      id={block.id}
      data-block-id={block.id}
      style={{ ...containerStyle, ...block.style }}
      data-block-type="dropdown"
    >
      <style>{PRESS_CSS + DROPDOWN_TOUCH_CSS}</style>
      <button data-pw-press=""
        ref={triggerRef}
        type="button"
        style={triggerStyle}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={onTriggerKey}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-pw-dropdown-trigger=""
      >
        {trigger}
        <span
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform var(--pw-duration-fast)',
          }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false" style={{ display: 'block' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <div style={menuStyle} role="menu" aria-label={trigger || undefined} onKeyDown={onMenuKey}>
        {items.map((item: DropdownItem) =>
          item.divider ? (
            <div key={item.id} style={dividerStyle} role="separator" />
          ) : (
            <button data-pw-press=""
              key={item.id}
              type="button"
              style={itemStyleFn(item.disabled)}
              onClick={() => handleItemClick(item)}
              role="menuitem"
              data-pw-dropdown-item=""
              disabled={item.disabled}
              tabIndex={isOpen ? 0 : -1}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(DropdownBlock, { sizing: 'intrinsic' })
