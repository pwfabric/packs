import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue, tint } from '../../../lib/_shared-utils.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface AlertProps {
  readonly title?: string
  readonly message: string
  readonly variant: 'info' | 'success' | 'warning' | 'error'
  readonly closeable: boolean
  readonly showIcon: boolean
  /** Take focus when the alert appears (a form's result after submit). */
  readonly focusOnShow?: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const alertDefinition: BlockDefinition = {
  type: 'alert',
  name: 'Alert',
  category: 'text',
  icon: '⚠',
  defaultProps: {
    message: '',
    variant: 'info',
    closeable: false,
    showIcon: true,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const AlertBlock: BlockComponent = ({ props, block, context }) => {
  const appWords = useAppMessages()
  const p = props as unknown as AlertProps
  const [dismissed, setDismissed] = React.useState(false)
  // Unset means hidden: "This is an alert." reached visitors.
  const message = safeRenderValue(p.message)
  const shown = !dismissed && !!(message || p.title)
  // FOCUS ON SHOW (`focusOnShow`): the result of a submit — sent, or why it
  // failed — takes focus when it appears, so the visitor hears it and the
  // next Tab starts from it. An alert is usually shown by visibleWhen (it
  // mounts then); one that is mounted with nothing to say focuses when its
  // words arrive. Never in an editor preview.
  const ref = React.useRef<HTMLDivElement | null>(null)
  const focusOnShow = p.focusOnShow === true || (p.focusOnShow as unknown) === 'true'
  const inert = context?.interactionMode === 'inert'
  React.useEffect(() => {
    if (shown && focusOnShow && !inert) ref.current?.focus()
  }, [shown, focusOnShow, inert])
  if (!shown) return null

  // Each variant derives its fill/border from the matching semantic theme
  // token (via color-mix) so alerts re-skin when the theme changes; the hex
  // literals are fallbacks for runtimes without the token defined.
  const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    info: {
      bg: tint('var(--pw-color-info)', 10),
      border: tint('var(--pw-color-info)', 30),
      text: 'color-mix(in srgb, var(--pw-color-info) 55%, var(--pw-color-text-on-card, var(--pw-color-text)))',
      icon: 'ℹ',
    },
    success: {
      bg: tint('var(--pw-color-success)', 10),
      border: tint('var(--pw-color-success)', 30),
      text: 'color-mix(in srgb, var(--pw-color-success) 55%, var(--pw-color-text-on-card, var(--pw-color-text)))',
      icon: '✓',
    },
    warning: {
      bg: tint('var(--pw-color-warning)', 12),
      border: tint('var(--pw-color-warning)', 32),
      text: 'color-mix(in srgb, var(--pw-color-warning) 55%, var(--pw-color-text-on-card, var(--pw-color-text)))',
      icon: '⚠',
    },
    error: {
      bg: tint('var(--pw-color-error)', 10),
      border: tint('var(--pw-color-error)', 30),
      text: 'color-mix(in srgb, var(--pw-color-error) 55%, var(--pw-color-text-on-card, var(--pw-color-text)))',
      icon: '✕',
    },
  }
  const variant = p.variant
  const c = colorMap[variant] ?? colorMap['info']!
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '6px',
    backgroundColor: c.bg,
    border: `1px solid ${c.border}`,
    color: c.text,
    ...block.style,
  }
  return (
    <div
      id={block.id}
      data-block-id={block.id}
      role="alert"
      style={style}
      data-block-type="alert"
      {...(focusOnShow ? { ref, tabIndex: -1 } : {})}
    >
      {p.showIcon && <span style={{ fontSize: 'var(--pw-font-size-base)', flexShrink: 0 }}>{c.icon}</span>}
      <div style={{ flex: 1 }}>
        {!!p.title && (
          <div style={{ fontWeight: 600, marginBottom: '2px' }}>{safeRenderValue(p.title)}</div>
        )}
        {message ? <div>{message}</div> : null}
      </div>
      {p.closeable && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: c.text,
            fontSize: 'var(--pw-font-size-base)',
            lineHeight: 1,
          }}
          aria-label={messageOf(appWords, 'ui.dismiss', '')}
        >
          ×
        </button>
      )}
    </div>
  )
}
