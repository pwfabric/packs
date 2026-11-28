import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface SkeletonProps {
  readonly variant: 'text' | 'circle' | 'rectangle' | 'card'
  readonly lines: number
  readonly animated: boolean
  readonly width?: number | string
  readonly height?: number | string
  readonly count: number
}

// ============================================================
// DEFINITION
// ============================================================

export const skeletonDefinition: BlockDefinition = {
  type: 'skeleton',
  name: 'Skeleton',
  category: 'data',
  icon: '▭',
  defaultProps: {
    variant: 'text',
    lines: 3,
    animated: true,
    count: 1,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** A number is px; a non-empty string is a CSS length as written; else none. */
function cssLength(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return `${v}px`
  if (typeof v === 'string' && v.trim() !== '') return /^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v.trim()
  return undefined
}

export const SkeletonBlock: BlockComponent = ({ props, block }) => {
  const p = props as unknown as SkeletonProps
  const variant = p.variant
  const animated = p.animated
  const lines = Math.max(1, p.lines)
  // ONE UNIT RULE for both sides: a number is px, a string is a CSS length
  // ("100%", "12rem"). Width left out fills the row; height left out is the
  // variant's own (a text line 16px, a card 120px, a rectangle 20px).
  const width = cssLength(p.width) ?? '100%'
  const height = cssLength(p.height)
  const count = Math.max(1, p.count)

  const shimmerStyle: React.CSSProperties = animated
    ? {
        background:
          'linear-gradient(90deg, var(--pw-color-secondary, #f4f4f5) 25%, var(--pw-color-border, #e4e4e7) 50%, var(--pw-color-secondary, #f4f4f5) 75%)',
        backgroundSize: '200% 100%',
        animation: 'pw-skeleton-shimmer 1.5s infinite',
      }
    : { backgroundColor: 'var(--pw-color-border, #e4e4e7)' }

  const baseStyle: React.CSSProperties = {
    borderRadius: variant === 'circle' ? '50%' : '4px',
    ...shimmerStyle,
    ...block.style,
  }

  const renderSingle = (key?: number): React.ReactElement => {
    const keyProp = key !== undefined ? { key } : {}
    if (variant === 'text') {
      return (
        <div {...keyProp} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              style={{
                ...baseStyle,
                height: '16px',
                width: i === lines - 1 ? `calc(${width} * 0.6)` : width,
              }}
            />
          ))}
        </div>
      )
    }
    if (variant === 'circle') {
      const size = height ?? cssLength(p.width) ?? '48px'
      return (
        <div
          {...keyProp}
          style={{ ...baseStyle, width: size, height: size, flexShrink: 0 }}
        />
      )
    }
    if (variant === 'card') {
      return (
        <div
          {...keyProp}
          style={{
            ...baseStyle,
            width,
            height: height ?? '120px',
            borderRadius: 'var(--pw-border-radius-lg)',
          }}
        />
      )
    }
    // rectangle (default)
    return (
      <div {...keyProp} style={{ ...baseStyle, width, height: height ?? '20px' }} />
    )
  }

  const rootBorderRadius = variant === 'circle' ? '50%' : variant === 'card' ? '8px' : '4px'

  if (animated) {
    const styleTag = (
      <style key="pw-skeleton-style">{`@keyframes pw-skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    )
    return (
      <div
        id={block.id}
        data-block-id={block.id}
        data-block-type="skeleton"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          borderRadius: rootBorderRadius,
        }}
      >
        {styleTag}
        {count === 1
          ? renderSingle()
          : Array.from({ length: count }).map((_, i) => renderSingle(i))}
      </div>
    )
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="skeleton"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderRadius: rootBorderRadius,
      }}
    >
      {count === 1 ? renderSingle() : Array.from({ length: count }).map((_, i) => renderSingle(i))}
    </div>
  )
}
