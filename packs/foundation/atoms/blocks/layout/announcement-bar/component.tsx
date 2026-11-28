import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, safeRenderValue, safeHref, ICON_PATHS, PRESS_CSS } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// SCHEMA
// ============================================================

/**
 * On a phone or touch screen the action link and the dismiss button are REAL
 * 44px boxes (R3 measures the box: they were 22px tall and 28x28).
 */
const ANNOUNCE_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) {' +
  ' [data-pw-announce-link] { min-height: 44px; }' +
  ' [data-pw-announce-x] { width: 44px !important; height: 44px !important; } }'

export interface AnnouncementBarProps {
  readonly message: string
  readonly variant: 'primary' | 'accent' | 'neutral'
  readonly dismissible: boolean
  readonly actionLabel?: string
  readonly actionHref?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const announcementBarDefinition: BlockDefinition = {
  type: 'announcement-bar',
  name: 'Announcement Bar',
  category: 'layout',
  icon: '▔',
  defaultProps: {
    message: '',
    variant: 'primary',
    dismissible: true,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 12, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const AnnouncementBarBlock: BlockComponent = ({ props, block, context }) => {
  const appWords = useAppMessages()
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const [visible, setVisible] = React.useState(true)

  const p = props as unknown as AnnouncementBarProps
  const message = p.message
  const variant = p.variant
  const dismissible = p.dismissible
  const actionLabel = p.actionLabel
  const actionHref = p.actionHref
  const isInert = context?.interactionMode === 'inert'

  // Neutral is a tinted surface with a border; primary/accent are solid brand
  // fills with on-primary text. Hex values are fallbacks only.
  const isSolid = variant === 'primary' || variant === 'accent'
  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--pw-space-md, 16px)',
    flexWrap: 'wrap',
    width: '100%',
    boxSizing: 'border-box',
    padding: 'var(--pw-space-sm, 8px) var(--pw-space-lg, 24px)',
    fontSize: 'var(--pw-font-size-sm, 14px)',
    backgroundColor: isSolid
      ? variant === 'accent'
        ? 'var(--pw-color-accent, #f4f4f5)'
        : 'var(--pw-color-primary, #18181b)'
      : 'var(--pw-color-card, #ffffff)',
    // Text token matches the SURFACE it sits on: primary → text-on-primary;
    // accent → on-accent (theme-defined styleVariable) falling back to the
    // page text token — an accent fill is typically a muted page-adjacent
    // tone (a pale neutral grey), so page text is the safe default. The old
    // text-on-primary pairing on accent only read by coincidence per theme.
    color: isSolid
      ? variant === 'accent'
        ? 'var(--pw-color-on-accent, var(--pw-color-text, #09090b))'
        : 'var(--pw-color-text-on-primary, #fafafa)'
      : 'var(--pw-color-text, #09090b)',
    borderBottom: isSolid ? 'none' : '1px solid var(--pw-color-border, #e4e4e7)',
    ...block.style,
  }

  const handleAction = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    // Inert-safe: in an editor/preview render, never navigate.
    if (isInert || !actionHref) {
      e.preventDefault()
    }
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { action: 'action', href: actionHref, label: actionLabel },
    })
  }

  const handleDismiss = (): void => {
    setVisible(false)
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { action: 'dismiss' },
    })
  }

  // Unset means hidden: "We just shipped something new." reached visitors.
  if (!visible || !message) {
    // Keep an inert, identifiable placeholder so the block still has a root
    // element in the tree after dismissal.
    return (
      <div
        id={block.id}
        data-block-id={block.id}
        data-block-type="announcement-bar"
        hidden
        style={{ display: 'none' }}
      />
    )
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="announcement-bar"
      role="region"
      aria-label={messageOf(appWords, 'ui.announcement', '')}
      style={barStyle}
    >
      {actionLabel || dismissible ? <style>{PRESS_CSS + HIT_AREA_CSS + ANNOUNCE_TOUCH_CSS}</style> : null}
      <span style={{ textAlign: 'center' }}>{safeRenderValue(message)}</span>

      {actionLabel && (
        <a
          href={safeHref(actionHref) ?? '#'}
          onClick={handleAction}
          data-pw-hit=""
          data-pw-announce-link=""
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--pw-space-xs, 4px)',
            fontWeight: 600,
            color: 'inherit',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {safeRenderValue(actionLabel)}
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: (ICON_PATHS['arrow-right'] ?? []).join('') }}
          />
        </a>
      )}

      {dismissible && (
        <button data-pw-press=""
          type="button"
          aria-label={messageOf(appWords, 'ui.announcement.dismiss', '')}
          onClick={handleDismiss}
          data-pw-hit=""
          data-pw-announce-x=""
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 'auto',
            padding: 0,
            // 28px drawn on a desktop; a REAL 44px box on a phone (ANNOUNCE_TOUCH_CSS).
            width: '28px',
            height: '28px',
            flex: '0 0 auto',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            borderRadius: 'var(--pw-border-radius-full, 9999px)',
            lineHeight: 0,
            opacity: 0.8,
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: (ICON_PATHS.x ?? []).join('') }}
          />
        </button>
      )}
    </div>
  )
}
