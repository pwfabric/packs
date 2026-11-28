import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { HIT_AREA_CSS, OVERLAY_DISMISS_EVENT, OVERLAY_SCRIM, lockBodyScroll, PRESS_CSS } from '../../../lib/_shared-utils.js'
import { useAppMessage } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** On a phone or touch screen the trigger and the close button are REAL 44px boxes. */
const MODAL_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-modal-touch] { min-height: 44px; min-width: 44px; } }'

export const MODAL_SIZES = ['sm', 'md', 'lg', 'xl', 'full'] as const

export interface ModalProps {
  readonly title?: string
  /** Text of the button that opens the dialog. Falls back to the title; no button without either. */
  readonly triggerLabel?: string
  readonly size: (typeof MODAL_SIZES)[number]
  readonly defaultOpen: boolean
  readonly closeOnOverlayClick: boolean
  readonly closeOnEscape: boolean
  readonly showCloseButton: boolean
  /** Look of the built-in trigger button — the same variants as control.button. */
  readonly triggerVariant: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'destructive'
  /**
   * Open state from the page: bind `"open": "{{state.<key>}}"` and a button
   * elsewhere opens the dialog with `{type:'setState', key, value:true}`; a
   * form's success can close it by writing false. A changed `open` wins over
   * the last click, like toggle's `checked`. A string ("true", "", an
   * unresolved binding) is read here.
   */
  readonly open?: boolean | string
  /** State key the open state is written to on open and close — `{{state.<key>}}` then reads it. */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const modalDefinition: BlockDefinition = {
  type: 'modal',
  name: 'Modal',
  category: 'overlay',
  icon: '◻',
  defaultProps: {
    size: 'md',
    closeOnOverlayClick: true,
    closeOnEscape: true,
    showCloseButton: true,
    triggerVariant: 'primary',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: true,
}

// ============================================================
// COMPONENT
// ============================================================

export const ModalBlock: BlockComponent = ({ props, children, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  // THE OPEN STATE WAS PRIVATE: no
  // action on the page could open the dialog or close it after a save. A bound
  // `open` now drives it; `stateKey` reports the modal's own open/close back.
  const p = props as unknown as ModalProps
  const boundOpen = p.open === undefined || p.open === null || p.open === '' ? undefined : p.open === true || p.open === 'true'
  const [isOpen, setIsOpen] = React.useState(boundOpen ?? p.defaultOpen)
  const lastBoundOpen = React.useRef(boundOpen)
  if (lastBoundOpen.current !== boundOpen) {
    lastBoundOpen.current = boundOpen
    if (boundOpen !== undefined) setIsOpen(boundOpen)
  }
  const stateKey = typeof p.stateKey === 'string' && p.stateKey ? p.stateKey : undefined
  const isInert = context?.interactionMode === 'inert'

  const title = typeof p.title === 'string' && p.title ? p.title : undefined
  // A modal opened from state (a bound `open`) is opened by a button elsewhere,
  // so its title does not also become a trigger — only an explicit triggerLabel.
  const triggerLabel =
    typeof p.triggerLabel === 'string' && p.triggerLabel ? p.triggerLabel : boundOpen === undefined ? title : undefined
  const dialogRef = React.useRef<HTMLDivElement | null>(null)
  const returnFocusRef = React.useRef<HTMLElement | null>(null)
  const size = p.size
  const closeOnOverlayClick = p.closeOnOverlayClick
  const closeOnEscape = p.closeOnEscape
  const showCloseButton = p.showCloseButton
  // The close button's name is the app's word (ui.close).
  const closeName = useAppMessage('ui.close', '')

  const sizeMap: Record<string, string> = {
    sm: '400px',
    md: '500px',
    lg: '700px',
    xl: '900px',
    full: '100%',
  }

  const openModal = (): void => {
    returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? null
    setIsOpen(true)
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { state: 'open', action: stateKey ? { type: 'setState', key: stateKey, value: true } : 'open' },
    })
  }

  const closeModal = React.useCallback((): void => {
    setIsOpen(false)
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { state: 'close', action: stateKey ? { type: 'setState', key: stateKey, value: false } : 'close' },
    })
    // Focus goes back where it was when the dialog opened.
    // (restored by the open-state effect below, whichever way the dialog closes)
  }, [emit, surfaceId, block.id, stateKey])

  // FOCUS GOES BACK TO WHAT OPENED THE DIALOG — however it opened (its own
  // trigger, or a button elsewhere writing `open` through state) and however
  // it closed (Esc, the close button, the scrim, a state write). It returned
  // only when the modal's own trigger had opened it, so Esc from a modal opened
  // by a page button (or holding a command-palette) left focus on <body>.
  const wasOpen = React.useRef(isOpen)
  React.useEffect(() => {
    if (isOpen && !wasOpen.current && !returnFocusRef.current && typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body && !dialogRef.current?.contains(active)) returnFocusRef.current = active
    }
    if (!isOpen && wasOpen.current) {
      const back = returnFocusRef.current
      returnFocusRef.current = null
      if (back && typeof back.focus === 'function' && back.isConnected) back.focus()
    }
    wasOpen.current = isOpen
  }, [isOpen])

  /**
   * The manifest promised "traps focus" and
   * nothing did — focus stayed behind the scrim, Tab walked the page under it,
   * and Escape closed without the 'close' event a behavior listens for. Now:
   * focus moves into the dialog, Tab cycles inside it, Escape goes through
   * closeModal, and body scrolling is locked through the shared ref-counted lockBodyScroll.
   */
  React.useLayoutEffect(() => {
    if (!isOpen || isInert) return
    if (!returnFocusRef.current && typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body && !dialogRef.current?.contains(active)) returnFocusRef.current = active
    }
    const dialog = dialogRef.current
    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
    const items = (): HTMLElement[] => (dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)) : [])
    // Initial focus: the first control in the content, else the close button, else the dialog.
    const list = items()
    // The close button is known by its own marker, never by its (app-worded) name.
    const firstContent = list.find((el) => !el.hasAttribute('data-pw-modal-close'))
    ;(firstContent ?? list[0] ?? dialog)?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        closeModal()
        return
      }
      if (event.key === 'Tab' && dialog) {
        const all = items()
        if (all.length === 0) {
          event.preventDefault()
          dialog.focus()
          return
        }
        const first = all[0]!
        const last = all[all.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // A block inside (a command-palette result that navigates) asks to close.
    const onDismiss = (): void => closeModal()
    dialog?.addEventListener(OVERLAY_DISMISS_EVENT, onDismiss)
    // Ref-counted and shared: released on close AND on unmount, and dropped on
    // a route change when the dialog has left the document.
    const unlock = lockBodyScroll(dialog)
    return (): void => {
      document.removeEventListener('keydown', onKey)
      dialog?.removeEventListener(OVERLAY_DISMISS_EVENT, onDismiss)
      unlock()
    }
  }, [isOpen, isInert, closeOnEscape, closeModal])

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      closeModal()
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: OVERLAY_SCRIM,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 'var(--pw-z-modal)',
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    // Opening, visibility turns on AT ONCE: a visibility transition starts at
    // "hidden", and focus() on a hidden control is ignored — the first control
    // (a command palette's search) did not get focus on open. Closing, it
    // waits for the fade.
    transition: isOpen ? 'opacity var(--pw-duration-fast)' : 'opacity var(--pw-duration-fast), visibility var(--pw-duration-fast)',
  }

  const dialogStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: sizeMap[size] ?? sizeMap.md,
    maxHeight: size === 'full' ? '100%' : '90vh',
    backgroundColor: 'var(--pw-color-card)',
    borderRadius: size === 'full' ? '0' : 'var(--pw-border-radius-2xl, 16px)',
    boxShadow: 'var(--pw-shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transform: isOpen ? 'scale(1)' : 'scale(0.95)',
    transition: 'transform var(--pw-duration-normal) var(--pw-easing-bounce)',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--pw-color-border)',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--pw-font-size-lg, 18px)',
    fontWeight: 600,
    margin: 0,
  }

  const closeButtonStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--pw-color-text-muted)',
    borderRadius: 'var(--pw-border-radius-sm)',
  }

  const contentStyle: React.CSSProperties = {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  }

  // The trigger speaks control.button's variants.
  const TRIGGER_VARIANTS: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: 'var(--pw-color-primary)', color: 'var(--pw-color-text-on-primary)', border: 'none' },
    secondary: { backgroundColor: 'var(--pw-color-card)', color: 'var(--pw-color-text)', border: '1px solid var(--pw-color-border)' },
    accent: { backgroundColor: 'var(--pw-color-accent)', color: 'var(--pw-color-on-accent, var(--pw-color-text-on-primary))', border: 'none' },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--pw-color-primary-ink, #18181b)',
      border: 'var(--pw-border-width, 1px) var(--pw-border-style, solid) var(--pw-color-primary)',
    },
    ghost: { backgroundColor: 'transparent', color: 'var(--pw-color-primary-ink, #18181b)', border: 'none' },
    destructive: { backgroundColor: 'var(--pw-color-error)', color: 'var(--pw-color-on-error, #ffffff)', border: 'none' },
  }
  const triggerVariant = TRIGGER_VARIANTS[p.triggerVariant] ? p.triggerVariant : 'primary'
  const triggerBtnStyle: React.CSSProperties = {
    padding: '10px 16px',
    ...TRIGGER_VARIANTS[triggerVariant],
    borderRadius: 'var(--pw-border-radius, 6px)',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
    fontSize: 'var(--pw-font-size-sm)',
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="modal"
      style={{ maxWidth: sizeMap[size] ?? sizeMap['md'], width: '100%', ...block.style }}
    >
      <style>{PRESS_CSS + (showCloseButton ? HIT_AREA_CSS : '') + MODAL_TOUCH_CSS}</style>
      {triggerLabel ? (
        <button data-pw-press=""
          type="button"
          style={triggerBtnStyle}
          onClick={openModal}
          aria-haspopup="dialog"
          data-block-type="modal-trigger"
          data-pw-modal-touch=""
        >
          {triggerLabel}
        </button>
      ) : null}
      {isInert && children && (
        <div
          style={{
            marginTop: '8px',
            padding: '16px',
            border: '1px dashed var(--pw-color-border)',
            borderRadius: 'var(--pw-border-radius-lg)',
          }}
        >
          {children}
        </div>
      )}
      {/* Closed: out of the accessibility tree AND out of the heading outline —
          the title renders only while open, so a closed modal leaves no empty h2. */}
      <div style={overlayStyle} onClick={handleOverlayClick} aria-hidden={isOpen ? undefined : true} {...(isOpen ? {} : { inert: true })}>
        <div
          ref={dialogRef}
          style={dialogStyle}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          {...(title ? { 'aria-labelledby': `${block.id}-title` } : triggerLabel ? { 'aria-label': triggerLabel } : {})}
        >
          {isOpen && (title || showCloseButton) && (
            <div style={headerStyle}>
              {title && (
                <h2 id={`${block.id}-title`} style={titleStyle}>
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button data-pw-press="" type="button" style={closeButtonStyle} onClick={closeModal} aria-label={closeName} data-pw-modal-close="" data-pw-hit="" data-pw-modal-touch="">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div style={contentStyle}>{children}</div>
        </div>
      </div>
    </div>
  )
}
