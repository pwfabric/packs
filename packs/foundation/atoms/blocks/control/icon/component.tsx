import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { ICON_PATHS, cssUnit } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const ICON_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const

export interface IconProps {
  readonly name: string
  /**
   * A named token (xs..xl) maps to a fixed px scale; a raw CSS size (number →
   * px, or a string like "4rem"/"48px") is also accepted.
   */
  readonly size: (typeof ICON_SIZES)[number] | string | number
  readonly color?: string
  /** 0.5–4. */
  readonly strokeWidth: number
  /**
   * What the icon MEANS, when it carries meaning on its own (a status glyph
   * with no text beside it): the icon becomes `role="img"` with this name.
   * Without it the icon is decorative — `aria-hidden`, no name.
   */
  readonly label?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const iconDefinition: BlockDefinition = {
  type: 'icon',
  name: 'Icon',
  category: 'control',
  icon: '◈',
  defaultProps: {
    name: 'circle',
    size: 'md',
    strokeWidth: 2,
  },
  defaultLayout: { span: { xs: 1, sm: 1, md: 1, lg: 1 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const IconBlock: BlockComponent = ({ props, block }) => {
  const sizeMap: Record<string, number> = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  }

  const p = props as unknown as IconProps
  const sizeProp = p.size
  // Named token (xs..xl) → fixed px scale. Anything else (a raw number or a
  // CSS-unit string like "4rem") passes through cssUnit so an explicit author
  // size is honoured instead of silently collapsing to the 20px default.
  const size =
    typeof sizeProp === 'string' && sizeProp in sizeMap
      ? sizeMap[sizeProp]!
      : (cssUnit(sizeProp) ?? 20)

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    color: p.color,
  }

  const iconName = p.name
  const strokeWidth = p.strokeWidth
  const label = typeof p.label === 'string' && p.label.trim() ? p.label.trim() : undefined
  const paths = ICON_PATHS[iconName] ?? ICON_PATHS.circle ?? ['<circle cx="12" cy="12" r="10"/>']

  return (
    <span
      id={block.id}
      data-block-id={block.id}
      style={{ ...style, ...block.style }}
      data-block-type="icon"
      data-icon-name={iconName}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: paths.join('') }}
      />
    </span>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(IconBlock, { sizing: 'intrinsic' })
