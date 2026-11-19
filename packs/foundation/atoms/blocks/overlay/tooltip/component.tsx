import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const TOOLTIP_PLACEMENTS = ['top', 'bottom', 'left', 'right'] as const

export interface TooltipProps {
  readonly content?: string
  readonly placement: (typeof TOOLTIP_PLACEMENTS)[number]
  readonly delay: number
  readonly maxWidth?: number | string
}

// ============================================================
// DEFINITION
// ============================================================

export const tooltipDefinition: BlockDefinition = {
  type: 'tooltip',
  name: 'Tooltip',
  category: 'overlay',
  icon: '💬',
  defaultProps: {
    placement: 'top',
    delay: 200,
  },
  defaultLayout: { span: { xs: 2, sm: 2, md: 2, lg: 2 } },
  canHaveChildren: true,
  allowedChildren: ['text', 'button', 'icon', 'badge', 'link'],
}

// ============================================================
// COMPONENT
// ============================================================

export const TooltipBlock: BlockComponent = ({ props, children, block }) => {
  const [visible, setVisible] = React.useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  const p = props as unknown as TooltipProps
  const content = typeof p.content === 'string' ? p.content : ''
  const placement = p.placement
  const delay = p.delay
  const maxWidth = cssUnit(p.maxWidth) ?? 'min(200px, 90vw)'
  const tooltipId = `${block.id}-tooltip`

  const showTooltip = (): void => {
    if (typeof window !== 'undefined') {
      timeoutRef.current = window.setTimeout(() => {
        setVisible(true)
      }, delay)
    }
  }

  const hideTooltip = (): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setVisible(false)
  }

  const placementStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' },
  }

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  }

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    ...placementStyles[placement],
    // INVERSE SURFACE: the tooltip must stand apart from the page. Instead of
    // a fixed slate it uses the theme's own inverse pair — a dark bubble with
    // light text in a light theme, the reverse in a dark one. Both values are
    // among the 21 colour tokens the cascade sets.
    backgroundColor: 'var(--pw-color-text, #09090b)',
    color: 'var(--pw-color-background, #ffffff)',
    padding: '6px 10px',
    borderRadius: 'var(--pw-border-radius-sm, 4px)',
    fontSize: 'var(--pw-font-size-xs)',
    // `nowrap` overrode maxWidth and a long hint ran off the screen.
    whiteSpace: 'normal',
    width: 'max-content',
    maxWidth,
    zIndex: 'var(--pw-z-dropdown)',
    pointerEvents: 'none',
    // Hidden tooltips must leave the layout entirely (display:none) — an absolutely
    // positioned popup kept at opacity:0 still extends document scrollWidth and can
    // push the page past the mobile viewport (gym overflow finding).
    display: visible ? undefined : 'none',
    opacity: visible ? 1 : 0,
    visibility: visible ? 'visible' : 'hidden',
    transition: 'opacity var(--pw-duration-fast) var(--pw-easing)',
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      // block.style belongs on the root the author places, not on the
      // hidden balloon.
      style={{ ...containerStyle, ...block.style }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hideTooltip()
      }}
      data-block-type="tooltip"
      aria-describedby={visible ? tooltipId : undefined}
    >
      {children}
      {content ? (
        <div id={tooltipId} style={tooltipStyle} role="tooltip">
          {content}
        </div>
      ) : null}
    </div>
  )
}
