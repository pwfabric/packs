import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const DIVIDER_ORIENTATIONS = ['horizontal', 'vertical'] as const

export interface DividerProps {
  readonly orientation: (typeof DIVIDER_ORIENTATIONS)[number]
  /** 1–8 px. */
  readonly thickness: number
  readonly color?: string
  readonly spacing: number
  readonly style: 'solid' | 'dashed' | 'dotted'
}

// ============================================================
// DEFINITION
// ============================================================

export const dividerDefinition: BlockDefinition = {
  type: 'divider',
  name: 'Divider',
  category: 'control',
  icon: '─',
  defaultProps: {
    orientation: 'horizontal',
    thickness: 1,
    spacing: 16,
    style: 'solid',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const DividerBlock: BlockComponent = ({ props, block }) => {
  const p = props as unknown as DividerProps
  const isVertical = p.orientation === 'vertical'
  const thickness = p.thickness
  const color = p.color ?? 'var(--pw-color-border)'
  const spacing = cssUnit(p.spacing)
  const dividerStyle = p.style

  const style: React.CSSProperties = {
    border: 'none',
    ...(isVertical
      ? {
          borderLeft: `${thickness}px ${dividerStyle} ${color}`,
          width: 0,
          height: '100%',
          minHeight: '20px',
          margin: `0 ${spacing}`,
        }
      : {
          borderTop: `${thickness}px ${dividerStyle} ${color}`,
          height: 0,
          width: '100%',
          margin: `${spacing} 0`,
        }),
  }

  return <hr id={block.id} data-block-id={block.id} style={{ ...style, ...block.style }} data-block-type="divider" />
}
