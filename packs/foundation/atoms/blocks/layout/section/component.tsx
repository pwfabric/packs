import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, type CSSUnit } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** A themeable gradient: colour stops are theme ROLES (primary/accent/…) → `var(--pw-color-*)`; raw values pass through. */
export interface SectionGradient {
  readonly from: string
  readonly to: string
  readonly via?: string
  readonly direction?: string
  /** 'linear' (default), 'radial' (centered orb/glow), or 'conic' (angular sweep). */
  readonly type?: 'linear' | 'radial' | 'conic'
  /** Radial/conic focal point, e.g. '50% 40%' (default center). */
  readonly at?: string
  /** Conic start angle in degrees (default 0). */
  readonly angle?: number
}

export interface SectionProps {
  /**
   * Asymmetric padding; numbers → px. Unset → the theme's fluid section
   * tokens. `padding` is a uniform alias for both axes.
   */
  readonly paddingY?: number | string
  readonly paddingX?: number | string
  readonly padding?: number | string
  readonly gap: number
  readonly backgroundColor?: string
  readonly backgroundGradient?: SectionGradient
  /** Frosted-glass blur for the band: sm/md/lg → blur(4px|10px|20px). */
  readonly backdropBlur?: 'none' | 'sm' | 'md' | 'lg'
  readonly textAlign?: 'left' | 'center' | 'right'
  readonly maxWidth?: number | string
  readonly minHeight?: number | string
  /** CSS aspect-ratio ('16/9', '4/3', or a number). */
  readonly aspectRatio?: number | string
  /** The landmark this band IS: `header`, `main`, `footer` or `aside`. Unset: a <section>. */
  readonly landmark?: 'header' | 'main' | 'footer' | 'aside'
}

// Theme colour roles → `var(--pw-color-*)`. A gradient built from roles follows a
// theme recolour; anything else (an existing token or raw value) passes through.
const COLOR_ROLES: ReadonlySet<string> = new Set([
  'primary', 'secondary', 'accent', 'background', 'card',
  'text', 'textMuted', 'border', 'error', 'success', 'warning', 'info', 'textOnPrimary',
])
function gradientStop(v: string): string {
  const t = v.trim()
  if (!COLOR_ROLES.has(t)) return t
  const kebab = t.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
  // Assemble via concatenation (not a `var(--pw-color-…)` template literal) so the
  // static token linter, which scans this source, doesn't mis-read the dynamic
  // role as a bare undefined `--pw-color-` token.
  const prop = '--pw-color-' + kebab
  return 'var(' + prop + ')'
}
function themeGradient(g: NonNullable<SectionProps['backgroundGradient']>): string {
  const stops = [gradientStop(g.from), ...(g.via ? [gradientStop(g.via)] : []), gradientStop(g.to)]
  if (g.type === 'radial') {
    const at = (g.at ?? '').trim() || '50% 50%'
    return `radial-gradient(circle at ${at}, ${stops.join(', ')})`
  }
  if (g.type === 'conic') {
    const at = (g.at ?? '').trim() || '50% 50%'
    const from = g.angle ?? 0
    return `conic-gradient(from ${from}deg at ${at}, ${stops.join(', ')})`
  }
  const dir = (g.direction ?? '').trim() || '135deg'
  return `linear-gradient(${dir}, ${stops.join(', ')})`
}

// ============================================================
// DEFINITION
// ============================================================

export const sectionDefinition: BlockDefinition = {
  type: 'section',
  name: 'Section',
  category: 'layout',
  icon: '▬',
  defaultProps: {
    // padding intentionally omitted → sections default to the theme's fluid
    // section tokens (responsive). Authors/composer set paddingY/paddingX/padding
    // to override. gap is the inner child rhythm.
    gap: 16,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: true,
}

// ============================================================
// COMPONENT
// ============================================================

export const SectionBlock: BlockComponent = ({ props, children, block }) => {
  // Outer wrapper is always full-bleed: its backgroundColor spans the full
  // window width. maxWidth is applied to the INNER wrapper only, so a colored
  // section keeps a full-width background while its content sits in a centered
  // max-width column. textAlign defaults to 'left' (it inline-inherits to all
  // descendants); heroes/CTAs opt into centering explicitly.
  // Vertical/horizontal padding: explicit paddingY/paddingX win, else the uniform
  // `padding` alias, else the theme's fluid section tokens. The CSS var carries an
  // inline clamp() fallback so the fluid padding renders even if the theme/runtime
  // hasn't set the var (older runtime, themeless render) — and it keeps the token
  // self-defining (no "undefined --pw-* without fallback" lint hit).
  const padY = cssUnit((props.paddingY ?? props.padding) as CSSUnit) ?? 'var(--pw-space-section-y)'
  // One left edge per page: a shell's content column is already inset and sets
  // `--pw-section-inset: 0px`, so a plain section inside it adds no second
  // inset (headings sat at 40px while lists sat at 16px). A section that paints
  // a background keeps its inset — its text must not touch its own edge.
  const own = (block.style ?? {}) as Record<string, unknown>
  // Only a gradient with both stops is one (a binding can resolve to anything).
  const g = props.backgroundGradient as Partial<SectionGradient> | null | undefined
  const gradient = g && typeof g === 'object' && typeof g.from === 'string' && typeof g.to === 'string' ? (g as SectionGradient) : undefined
  const painted = Boolean(gradient) ||
    (typeof props.backgroundColor === 'string' && props.backgroundColor !== '' && props.backgroundColor !== 'transparent') ||
    Boolean(own.background || own.backgroundColor || own.backgroundImage || own.border || own.borderLeft)
  const padX = cssUnit((props.paddingX ?? props.padding) as CSSUnit) ??
    (painted ? 'var(--pw-space-section-x)' : 'var(--pw-section-inset, var(--pw-space-section-x))')
  // backdrop-blur presets (mirrors card's glass blur). 'none'/unset → no blur.
  const blurMap: Record<string, string> = { sm: 'blur(4px)', md: 'blur(10px)', lg: 'blur(20px)' }
  const backdropBlur = blurMap[(props.backdropBlur as string) ?? '']
  const style: React.CSSProperties = {
    width: '100%',
    // width:100% plus inline padding overflowed the page wherever no global
    // box-sizing reset applies: the padding stays inside the width.
    boxSizing: 'border-box',
    paddingBlock: padY,
    paddingInline: padX,
    backgroundColor: (props.backgroundColor as string) ?? 'transparent',
    ...(gradient
      ? { backgroundImage: themeGradient(gradient) }
      : {}),
    ...(backdropBlur ? { backdropFilter: backdropBlur, WebkitBackdropFilter: backdropBlur } : {}),
    textAlign: (props.textAlign as React.CSSProperties['textAlign']) ?? 'left',
    ...(props.minHeight ? { minHeight: cssUnit(props.minHeight as CSSUnit) } : {}),
    ...(props.aspectRatio != null ? { aspectRatio: String(props.aspectRatio) } : {}),
    ...block.style,
  }
  const innerStyle: React.CSSProperties = {
    boxSizing: 'border-box',
    maxWidth: cssUnit(props.maxWidth as CSSUnit) ?? 'var(--pw-layout-container-max-width)',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: cssUnit((props as unknown as SectionProps).gap),
  }
  const landmark = props.landmark as string | undefined
  const Tag = (landmark === 'header' || landmark === 'main' || landmark === 'footer' || landmark === 'aside'
    ? landmark
    : 'section') as 'section'
  return (
    <Tag id={block.id} data-block-id={block.id} style={style} data-block-type="section">
      <div style={innerStyle}>{children}</div>
    </Tag>
  )
}
