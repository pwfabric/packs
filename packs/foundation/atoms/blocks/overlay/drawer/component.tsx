import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { OVERLAY_DISMISS_EVENT, OVERLAY_SCRIM, lockBodyScroll } from '../../../lib/_shared-utils.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** On a phone or touch screen the trigger and the close button are REAL 44px boxes (the trigger was 39px). */
const DRAWER_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-drawer-touch] { min-height: 44px; min-width: 44px; } }'

export interface DrawerProps {
  /** Text of the button that opens the sheet. No button is drawn without it. */
  readonly triggerLabel?: string
  /** Heading of the open sheet; also its accessible name. */
  readonly title?: string
  readonly defaultOpen: boolean
  readonly placement: 'left' | 'right' | 'top' | 'bottom'
  readonly size: 'sm' | 'md' | 'lg' | 'full'
  readonly closeOnOverlayClick: boolean
  readonly closeOnEscape: boolean
  readonly showCloseButton: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const drawerDefinition: BlockDefinition = {
  type: 'drawer',
  name: 'Drawer',
  category: 'overlay',
  icon: '◧',
  defaultProps: {
    defaultOpen: false,
    placement: 'right',
    size: 'md',
    closeOnOverlayClick: true,
    closeOnEscape: true,
    showCloseButton: true,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: true,
}

// ============================================================
// COMPONENT
// ============================================================

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

/**
 * A real off-canvas sheet. It used to open as a
 * dashed box INSIDE the page flow with a "Drawer (right)" debug badge and a
 * `<span>` for a close button — left and right looked the same. Live, it is
 * now a fixed sheet on the chosen edge above a backdrop, a modal dialog that
 * takes focus, closes on Escape or the backdrop, and hands focus back. In the
 * editor (inert) the open panel still previews inline so its children can be
 * edited where they sit.
 */
export const DrawerBlock: BlockComponent = ({ props, children, block, context }) => {
  const appWords = useAppMessages()
  const p = props as unknown as DrawerProps
  const triggerLabel = typeof p.triggerLabel === 'string' ? p.triggerLabel : ''
  const title = typeof p.title === 'string' ? p.title : ''
  const placement = p.placement
  const size = p.size
  const showCloseButton = p.showCloseButton
  const closeOnOverlayClick = p.closeOnOverlayClick
  const closeOnEscape = p.closeOnEscape
  const inert = context?.interactionMode === 'inert'
  const [isOpen, setIsOpen] = React.useState(p.defaultOpen)
  const panelRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const titleId = `${block.id}-title`

  const close = React.useCallback((): void => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  React.useEffect(() => {
    if (!isOpen || inert) return
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    if (first) first.focus()
    else panel?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (items.length === 0) {
          e.preventDefault()
          panel.focus()
          return
        }
        const firstEl = items[0]!
        const lastEl = items[items.length - 1]!
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // A block inside (a command-palette result that navigates) asks to close.
    const onDismiss = (): void => close()
    panel?.addEventListener(OVERLAY_DISMISS_EVENT, onDismiss)
    // The shared ref-counted lock (see modal): overlays closing out of order no
    // longer restore each other's "hidden", and an unmount always releases it.
    const unlock = lockBodyScroll(panel)
    return () => {
      document.removeEventListener('keydown', onKey)
      panel?.removeEventListener(OVERLAY_DISMISS_EVENT, onDismiss)
      unlock()
    }
  }, [isOpen, inert, closeOnEscape, close])

  const sizeMap: Record<string, string> = { sm: '280px', md: '360px', lg: '480px', full: '100%' }
  const drawerSize = sizeMap[size] ?? '360px'
  const isVertical = placement === 'left' || placement === 'right'

  const triggerStyle: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: 'var(--pw-color-primary)',
    color: 'var(--pw-color-text-on-primary)',
    border: 'none',
    borderRadius: 'var(--pw-button-radius, var(--pw-border-radius, 6px))',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
    fontSize: 'var(--pw-font-size-sm)',
  }
  const edge: React.CSSProperties = isVertical
    ? { top: 0, bottom: 0, [placement]: 0, width: `min(${drawerSize}, 100vw)` }
    : { left: 0, right: 0, [placement]: 0, height: `min(${drawerSize}, 100vh)` }
  const panelStyle: React.CSSProperties = inert
    ? {
        position: 'relative',
        marginTop: '8px',
        width: isVertical ? `min(${drawerSize}, 100%)` : '100%',
        maxWidth: '100%',
        minHeight: '200px',
        boxSizing: 'border-box',
        border: '1px dashed var(--pw-color-border)',
        borderRadius: 'var(--pw-border-radius-sm, 4px)',
        backgroundColor: 'var(--pw-color-card)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        ...(placement === 'right' ? { marginLeft: 'auto' } : {}),
      }
    : {
        position: 'fixed',
        ...edge,
        maxWidth: '100vw',
        maxHeight: '100vh',
        boxSizing: 'border-box',
        overflowY: 'auto',
        backgroundColor: 'var(--pw-color-card)',
        color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
        boxShadow: 'var(--pw-shadow-xl, 0 20px 40px rgba(0,0,0,0.2))',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        zIndex: 'var(--pw-z-drawer, 400)' as unknown as number,
      }
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--pw-color-border)',
  }

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={inert ? undefined : 'true'}
      {...(title ? { 'aria-labelledby': titleId } : triggerLabel ? { 'aria-label': triggerLabel } : {})}
      tabIndex={-1}
      style={{ ...panelStyle, ...block.style }}
    >
      {(title || showCloseButton) && (
        <div style={headerStyle}>
          {title ? (
            <h2 id={titleId} style={{ margin: 0, fontSize: 'var(--pw-font-size-lg, 18px)', fontWeight: 600 }}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {showCloseButton && (
            <button
              type="button"
              aria-label={messageOf(appWords, 'ui.close', '')}
              onClick={close}
              data-pw-drawer-touch=""
              style={{
                cursor: 'pointer',
                color: 'var(--pw-color-text-muted)',
                fontSize: 'var(--pw-font-size-xl)',
                lineHeight: 1,
                padding: '4px 8px',
                border: 'none',
                background: 'transparent',
                borderRadius: 'var(--pw-border-radius-sm, 4px)',
                fontFamily: 'inherit',
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  )

  return (
    <div id={block.id} data-block-id={block.id} data-block-type="drawer">
      <style>{DRAWER_TOUCH_CSS}</style>
      {triggerLabel ? (
        <button
          ref={triggerRef}
          type="button"
          style={triggerStyle}
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          data-pw-drawer-touch=""
        >
          {triggerLabel}
        </button>
      ) : null}
      {isOpen &&
        (inert ? (
          panel
        ) : (
          <>
            <div
              data-pw-drawer-backdrop=""
              aria-hidden="true"
              onClick={() => {
                if (closeOnOverlayClick) close()
              }}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: OVERLAY_SCRIM,
                zIndex: 'var(--pw-z-drawer, 400)' as unknown as number,
              }}
            />
            {panel}
          </>
        ))}
    </div>
  )
}
