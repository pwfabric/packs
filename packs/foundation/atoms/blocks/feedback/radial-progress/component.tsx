import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface RadialProgressProps {
  readonly value: number
  readonly size: 'sm' | 'md' | 'lg'
  readonly thickness: number
  readonly showLabel: boolean
  /** Empty: the theme's strong primary. */
  readonly color: string
}

// ============================================================
// DEFINITION
// ============================================================

export const radialProgressDefinition: BlockDefinition = {
  type: 'radial-progress',
  name: 'Radial Progress',
  category: 'feedback',
  icon: '◔',
  defaultProps: {
    value: 0,
    size: 'md',
    thickness: 6,
    showLabel: true,
    color: '',
  },
  defaultLayout: { span: { xs: 2, sm: 2, md: 2, lg: 2 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const RadialProgressBlock: BlockComponent = ({ props, block }) => {
  const p = props as unknown as RadialProgressProps
  const size = p.size
  const value = Math.max(0, Math.min(100, p.value))
  const showLabel = p.showLabel
  const color = p.color || 'var(--pw-color-primary-strong, var(--pw-color-primary, #18181b))'

  const sizeMap: Record<string, number> = { sm: 48, md: 72, lg: 96 }
  const dim = sizeMap[size] ?? 72
  const thickness = Math.max(1, p.thickness || 6)
  const r = (dim - thickness) / 2
  const c = dim / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ * (1 - value / 100)

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="radial-progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: `${dim}px`,
        height: `${dim}px`,
        alignItems: 'center',
        justifyContent: 'center',
        ...block.style,
      }}
    >
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden="true">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--pw-color-border, #e4e4e7)"
          strokeWidth={thickness}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: 'stroke-dashoffset var(--pw-duration-fast, 150ms)' }}
        />
      </svg>
      {showLabel ? (
        <span
          style={{
            position: 'absolute',
            fontSize: 'var(--pw-font-size-sm, 14px)',
            fontWeight: 600,
            color: 'var(--pw-color-text, #09090b)',
          }}
        >
          {`${Math.round(value)}%`}
        </span>
      ) : null}
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(RadialProgressBlock, { sizing: 'intrinsic' })
