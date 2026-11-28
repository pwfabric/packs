import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface ProgressProps {
  readonly value: number
  readonly max: number
  readonly showLabel: boolean
  readonly labelFormat: 'percent' | 'value' | 'fraction' | 'none'
  readonly size: 'sm' | 'md' | 'lg'
  readonly color?: string
  readonly animated: boolean
  /**
   * The bar's accessible name ("Sprint 42 points done"). A progressbar with no
   * name failed axe aria-progressbar-name. Not drawn — the page's own text
   * says it; use `labelledBy` to point at that text instead.
   */
  readonly label?: string
  /** The id of the block whose text names the bar (aria-labelledby). Wins over `label`. */
  readonly labelledBy?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const progressDefinition: BlockDefinition = {
  type: 'progress',
  name: 'Progress',
  category: 'data',
  icon: '▬',
  defaultProps: {
    value: 50,
    max: 100,
    showLabel: false,
    labelFormat: 'percent',
    size: 'md',
    animated: false,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const ProgressBlock: BlockComponent = ({ props, block }) => {
  const appWords = useAppMessages()
  const p = props as unknown as ProgressProps
  const max = p.max
  const value = Math.min(Math.max(p.value, 0), max)
  const pct = max > 0 ? (value / max) * 100 : 0

  const sizeMap: Record<string, string> = { sm: '6px', md: '10px', lg: '16px' }
  const colorMap: Record<string, string> = {
    primary: 'var(--pw-color-primary)',
    accent: 'var(--pw-color-accent)',
    success: 'var(--pw-color-success)',
    warning: 'var(--pw-color-warning)',
    error: 'var(--pw-color-error)',
  }
  const trackStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 'var(--pw-border-radius-full)',
    overflow: 'hidden',
    backgroundColor: 'var(--pw-color-border)',
    height: sizeMap[p.size] ?? '10px',
  }
  const fillStyle: React.CSSProperties = {
    height: '100%',
    borderRadius: 'var(--pw-border-radius-full)',
    width: `${pct}%`,
    transition: p.animated ? 'width var(--pw-duration-slow) var(--pw-easing)' : undefined,
    backgroundColor: colorMap[p.color ?? 'primary'] ?? colorMap['primary'],
  }
  const label =
    p.labelFormat === 'value'
      ? `${value}/${max}`
      : p.labelFormat === 'none'
        ? undefined
        : `${Math.round(pct)}%`

  const name = typeof props.label === 'string' ? props.label.trim() : ''
  const labelledBy = typeof props.labelledBy === 'string' ? props.labelledBy.trim() : ''

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      // The bar fills the box it is given and may shrink; the renderer's
      // wrapper fills the line because the block declares `sizing: 'fill'`.
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        ...block.style,
      }}
      data-block-type="progress"
    >
      {p.showLabel && label && (
        <div
          style={{
            fontSize: 'var(--pw-font-size-xs)',
            fontWeight: 500,
            color: 'var(--pw-color-text)',
            textAlign: 'right',
          }}
        >
          {label}
        </div>
      )}
      <div
        role="progressbar"
        // Always named: labelledBy, else label, else a plain "Progress" so the
        // bar is never an unnamed control (axe aria-progressbar-name).
        aria-labelledby={labelledBy || undefined}
        aria-label={labelledBy ? undefined : name || messageOf(appWords, 'ui.progress', '')}
        aria-valuetext={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        style={trackStyle}
      >
        <div style={fillStyle} />
      </div>
    </div>
  )
}

// A bar has no content width of its own: the renderer's wrapper fills the
// line (engine 2.2 block sizing), so a centred column cannot collapse it.
Object.assign(ProgressBlock, { sizing: 'fill' as const })
