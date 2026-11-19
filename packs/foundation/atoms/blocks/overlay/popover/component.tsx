import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** On a phone or touch screen the trigger is a REAL 44px-tall box (it was 35px). */
const POPOVER_TOUCH_CSS = '@media (max-width: 640px), (pointer: coarse) { [data-pw-popover-trigger] { min-height: 44px; } }'

export interface PopoverProps {
  readonly triggerLabel?: string
  readonly content?: string
  readonly placement: 'top' | 'bottom' | 'left' | 'right'
}

// ============================================================
// DEFINITION
// ============================================================

export const popoverDefinition: BlockDefinition = {
  type: 'popover',
  name: 'Popover',
  category: 'overlay',
  icon: '◲',
  defaultProps: {
    placement: 'bottom',
  },
  defaultLayout: { span: { xs: 2, sm: 3, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const PopoverBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  // No invented text: 'Open' / 'Popover content' reached visitors.
  const p = props as unknown as PopoverProps
  const triggerLabel = typeof p.triggerLabel === 'string' ? p.triggerLabel : ''
  const content = typeof p.content === 'string' ? p.content : ''
  const placement = p.placement
  const isInert = context?.interactionMode === 'inert'

  // Click-outside dismissal. This attaches a real `document` listener, so it is
  // guarded by interactionMode — in an inert (editor/preview) render we neither
  // bind nor navigate. Always cleaned up on unmount / when `open` flips.
  React.useEffect(() => {
    if (isInert || !open) return
    const onDocClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [isInert, open])

  const handleToggle = (): void => {
    const next = !open
    setOpen(next)
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { action: 'toggle', open: next, placement },
    })
  }

  // Panel offset per placement — the panel is absolutely positioned relative to
  // the inline-block root that wraps the trigger.
  const gap = 'var(--pw-space-xs, 4px)'
  const panelPosition: React.CSSProperties = (() => {
    switch (placement) {
      case 'top':
        return { bottom: `calc(100% + ${gap})`, left: 0 }
      case 'left':
        return { right: `calc(100% + ${gap})`, top: 0 }
      case 'right':
        return { left: `calc(100% + ${gap})`, top: 0 }
      case 'bottom':
      default:
        return { top: `calc(100% + ${gap})`, left: 0 }
    }
  })()

  const rootStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    ...block.style,
  }

  const triggerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--pw-space-xs, 4px)',
    padding: '8px 14px',
    fontSize: 'var(--pw-font-size-sm, 14px)',
    fontWeight: 500,
    color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
    backgroundColor: 'var(--pw-color-card, #ffffff)',
    border: '1px solid var(--pw-color-border, #e4e4e7)',
    borderRadius: 'var(--pw-button-radius, var(--pw-border-radius, 8px))',
    cursor: 'pointer',
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    ...panelPosition,
    zIndex: 'var(--pw-z-dropdown, 300)' as unknown as number,
    minWidth: '200px',
    maxWidth: '320px',
    padding: 'var(--pw-space-md, 16px)',
    fontSize: 'var(--pw-font-size-sm, 14px)',
    lineHeight: 1.5,
    color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
    backgroundColor: 'var(--pw-color-card, #ffffff)',
    border: '1px solid var(--pw-color-border, #e4e4e7)',
    borderRadius: 'var(--pw-border-radius-lg, 12px)',
    boxShadow: 'var(--pw-shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="popover"
      ref={rootRef}
      style={rootStyle}
    >
      <style>{POPOVER_TOUCH_CSS}</style>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-pw-popover-trigger=""
        style={triggerStyle}
      >
        {safeRenderValue(triggerLabel)}
      </button>
      {open && (
        <div role="dialog" aria-label={triggerLabel || undefined} style={panelStyle}>
          {safeRenderValue(content)}
        </div>
      )}
    </div>
  )
}
