import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, alignToCSS, justifyToCSS, type CSSUnit } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface ContainerProps {
  readonly wrap?: boolean
  /**
   * Stacking law: on `xs` a `direction: 'row'` container with two or more
   * non-intrinsic children is drawn as a column. `keepRow: true` opts a row
   * out (ratio compositions). Applied by the runtime.
   */
  readonly keepRow?: boolean
  readonly direction: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  /** Unset → the theme's base spacing (`--pw-spacing-base`). */
  readonly gap?: number | string
  /** No default on purpose: a PAINTED container (ground or border) defaults to 16, a pure layout container to 0. */
  readonly padding?: number
  readonly align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  readonly justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  readonly backgroundColor?: string
  readonly borderRadius?: number | string
  readonly minHeight?: number | string
  readonly maxWidth?: number | string
  /** CSS aspect-ratio ('16/9', '4/3', or a number). */
  readonly aspectRatio?: number | string
  readonly backgroundGradient?: string
  readonly borderColor?: string
  readonly borderWidth?: number
  /** The landmark this box IS (`header`, `main`, `footer`, `aside`, `nav`). Unset: a plain <div>. */
  readonly landmark?: 'header' | 'main' | 'footer' | 'aside' | 'nav'
  /** The landmark's accessible name (aria-label). Only with `landmark`. */
  readonly label?: string
  /** This box is the CURRENT item of a sequence: renders aria-current (= `currentKind`, default "step"). */
  readonly current?: boolean
  readonly currentKind?: 'step' | 'page' | 'location' | 'true'
}

// ============================================================
// DEFINITION
// ============================================================

export const containerDefinition: BlockDefinition = {
  type: 'container',
  name: 'Container',
  category: 'layout',
  icon: '▢',
  defaultProps: {
    direction: 'column',
    gap: 16,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: true,
}

// ============================================================
// COMPONENT
// ============================================================

export const ContainerBlock: BlockComponent = ({ props, children, block }) => {
  const p = props as unknown as ContainerProps
  const direction = p.direction
  const isRowLike = direction === 'row' || direction === 'row-reverse'
  const maxWidth = cssUnit(props.maxWidth as CSSUnit)
  // A `maxWidth` prop with no explicit margin reads as "this is the page's
  // centered content column" (the single most common use of maxWidth on a
  // container) — without an auto margin it hugs the section's left edge
  // instead, leaving a dead gap on the right. block.style below can still
  // override with an explicit margin/marginLeft/marginRight.
  const autoCenter = maxWidth !== undefined ? { margin: '0 auto' } : {}
  const bgColor = props.backgroundColor as string | undefined
  // A container only paints a card/surface-toned background when a receipt
  // explicitly sets one (most containers are transparent layout scaffolding
  // sitting directly on the page canvas, where text must stay in the
  // page-level tokens) — so the on-card override (see panel/card/component.tsx)
  // only applies when the receipt actually opted into a card-toned background.
  const paintsGround =
    bgColor != null ||
    props.borderWidth != null ||
    props.borderColor != null ||
    props.backgroundGradient != null
  const paintsCardSurface = typeof bgColor === 'string' && bgColor.includes('--pw-color-card')
  const style: React.CSSProperties = {
    ...(paintsCardSurface
      ? {
          ['--pw-color-text' as string]: 'var(--pw-color-text-on-card, var(--pw-color-text))',
          ['--pw-color-text-muted' as string]: 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted))',
        }
      : {}),
    display: 'flex',
    flexDirection: direction,
    flexWrap: isRowLike ? ((props.wrap as boolean) === true ? 'wrap' : 'nowrap') : undefined,
    gap: cssUnit(props.gap as CSSUnit) ?? 'var(--pw-spacing-base)',
    // Measured: a fixed padding-16 default ate 32px at
    // EVERY level of a pure-layout chain (306 -> 274 -> 220 -> 188px) and forced
    // 65 `padding: 0` overrides into 14 receipts. A container that paints a
    // ground or a border is a box and keeps 16; one that only arranges is
    // geometry and gets 0. An explicit `padding` always wins.
    padding:
      props.padding != null
        ? cssUnit(props.padding as CSSUnit)
        : paintsGround
          ? 'var(--pw-spacing-base)'
          : 0,
    alignItems: alignToCSS(props.align as string),
    justifyContent: justifyToCSS(props.justify as string),
    backgroundColor: bgColor,
    ...(typeof props.backgroundGradient === 'string' && props.backgroundGradient.trim()
      ? { backgroundImage: props.backgroundGradient }
      : {}),
    ...(props.borderWidth != null || props.borderColor != null
      ? {
          borderWidth: cssUnit((props.borderWidth ?? 1) as CSSUnit),
          borderStyle: 'solid',
          borderColor: (props.borderColor as string | undefined) ?? 'var(--pw-color-border)',
        }
      : {}),
    // Padding and border stay inside the width.
    boxSizing: 'border-box',
    borderRadius: cssUnit(props.borderRadius as CSSUnit) ?? 'var(--pw-border-radius)',
    minHeight: cssUnit(props.minHeight as CSSUnit),
    maxWidth,
    ...autoCenter,
    ...(props.aspectRatio != null ? { aspectRatio: String(props.aspectRatio) } : {}),
    // Allow the container to shrink below its content's natural width when it is
    // itself a flex child — without this (default min-width:auto) a wide inner child
    // (e.g. a fixed-column data-grid) forces the container past the viewport instead
    // of letting the child's own overflow-x:auto scroll.
    minWidth: 0,
    // Layer 4: block-level style overrides
    ...block.style,
  }

  const landmark = props.landmark as string | undefined
  const Tag = (
    landmark === 'header' || landmark === 'main' || landmark === 'footer' || landmark === 'aside' || landmark === 'nav'
      ? landmark
      : 'div'
  ) as 'div'
  const label = Tag !== 'div' && typeof props.label === 'string' && props.label.trim() ? props.label : undefined
  return (
    <Tag
      id={block.id}
      data-block-id={block.id}
      style={style}
      data-block-type="container"
      aria-label={label}
      aria-current={
        props.current === true || (props.current as unknown) === 'true'
          ? ((props.currentKind as 'step' | 'page' | 'location' | 'true' | undefined) ?? 'step')
          : undefined
      }
    >
      {children}
    </Tag>
  )
}
