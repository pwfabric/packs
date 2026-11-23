import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, alignToCSS, type CSSUnit } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface GridProps {
  readonly columns: number
  /** Columns on a phone (640px and below). Unset → one column. */
  readonly columnsXs?: number
  /** Unset → the theme's grid gap (`--pw-layout-grid-gap`). */
  readonly gap?: number | string
  readonly rowGap?: number | string
  readonly columnGap?: number | string
  readonly minChildWidth?: number | string
  readonly rows?: number
  readonly alignItems?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
}

// ============================================================
// DEFINITION
// ============================================================

export const gridDefinition: BlockDefinition = {
  type: 'grid',
  name: 'Grid',
  category: 'layout',
  icon: '⊞',
  defaultProps: {
    columns: 2,
    gap: 16,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: true,
  allowedChildren: ['container', 'text', 'heading', 'button', 'image'],
}

// ============================================================
// COMPONENT
// ============================================================

export const GridBlock: BlockComponent = ({ props, children, block }) => {
  const p = props as unknown as GridProps
  const columns = p.columns
  // minChildWidth may be a number (coerced to px) or a string with an explicit
  // unit. Run it through cssUnit so a bare number like 240 becomes "240px";
  // a unitless value would otherwise produce invalid CSS (min(240, 100%)),
  // causing the browser to drop grid-template-columns and collapse to 1 column.
  const explicitMin = cssUnit(props.minChildWidth as CSSUnit)
  // TWO MODES (measured: `columns:12` produced no 12
  // tracks and child spans overflowed the page):
  //  - minChildWidth given → RESPONSIVE: auto-fill minmax. Not auto-fit: that
  //    collapses the empty trailing tracks, and a lone card on a row (one
  //    item, or the last of an uneven count) stretched across the whole row.
  //  - minChildWidth absent → HONEST: exactly `columns` tracks, minmax(0,1fr)
  //    so nowrap content cannot widen a track past its share. This is what
  //    makes child layout.span deterministic.
  //  - both given → RESPONSIVE with a CEILING: `columns` is the most tracks a
  //    wide row holds (each track is at least its share of the row), and
  //    minChildWidth still drops tracks as the row narrows. Without the
  //    ceiling a wide row grew a fourth and fifth track past `columns`.
  //    Only an AUTHORED `columns` sets it (the manifest default is not a wish).
  const authoredColumns = Number((block.props as Record<string, unknown> | undefined)?.columns)
  const ceiling = explicitMin && Number.isInteger(authoredColumns) && authoredColumns >= 1 ? authoredColumns : undefined
  const trackGap = cssUnit((props.columnGap ?? props.gap) as CSSUnit) ?? 'var(--pw-layout-grid-gap)'
  const gridTemplateColumns = explicitMin
    ? ceiling
      ? `repeat(auto-fill, minmax(max(min(${explicitMin}, 100%), calc((100% - ${ceiling - 1} * ${trackGap}) / ${ceiling})), 1fr))`
      : `repeat(auto-fill, minmax(min(${explicitMin}, 100%), 1fr))`
    : `repeat(${columns}, minmax(0, 1fr))`
  const rows = props.rows as number | undefined
  // HONEST-mode mobile safety (a sweep found 46 existing grids that declare
  // `columns` without `minChildWidth` and without any child span — under honest
  // tracks they would stay N columns wide on a phone, which auto-fit used to
  // collapse). A child that declares layout.span is the author taking
  // responsibility for every breakpoint, so span-less honest grids — and only
  // those — get a scoped media rule collapsing them to one column on xs.
  const anyChildDeclaresSpan = (block.children ?? []).some(
    (c) => (c as { layout?: { span?: unknown } }).layout?.span !== undefined
  )
  const collapseOnMobile = !explicitMin && !anyChildDeclaresSpan && columns > 1
  // `columnsXs` is the author naming the phone count, so it applies in either
  // mode (an auto-fill grid would otherwise fall to one column by its minimum).
  const rawXs = Number(props.columnsXs)
  const columnsXs = Number.isInteger(rawXs) && rawXs >= 1 ? Math.min(rawXs, 6) : undefined
  const phoneRule = collapseOnMobile || (columnsXs !== undefined && !anyChildDeclaresSpan)
  const phoneTracks = columnsXs && columnsXs > 1 ? `repeat(${columnsXs},minmax(0,1fr))` : '1fr'
  // A tablet step: three or four honest tracks on a 700–1024px
  // screen squeezed every card into a sliver. Between 641 and 1024px a grid of
  // three or more columns drops to two (or to the phone count when that is
  // larger); at 640px and below, to `columnsXs` or one.
  const tabletTracks = Math.max(2, columnsXs ?? 1)
  const tabletStep = collapseOnMobile && columns > tabletTracks
  const sel = `[data-block-id="${block.id}"][data-block-type="grid"]`
  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns,
    ...(rows ? { gridTemplateRows: `repeat(${rows}, minmax(0, auto))` } : {}),
    gap: cssUnit(props.gap as CSSUnit) ?? 'var(--pw-layout-grid-gap)',
    // rowGap/columnGap were IN THE SCHEMA BUT NOT RENDERED: the manifest declares
    // both, the component read only `gap` — so every app asking for separate
    // row/column gaps quietly got equal gaps (a "stale prop"). When
    // given, they override `gap`.
    ...(props.rowGap != null ? { rowGap: cssUnit(props.rowGap as CSSUnit) } : {}),
    ...(props.columnGap != null ? { columnGap: cssUnit(props.columnGap as CSSUnit) } : {}),
    alignItems: alignToCSS(props.alignItems as string),
    minWidth: 0,
    width: '100%',
    // Padding and border stay inside the 100% width — without it a padded grid
    // is wider than its column.
    boxSizing: 'border-box',
    ...block.style,
  }

  return (
    <div id={block.id} data-block-id={block.id} style={style} data-block-type="grid">
      {phoneRule ? (
        <style>
          {(tabletStep ? `@media (min-width: 641px) and (max-width: 1024px){${sel}{grid-template-columns:repeat(${tabletTracks},minmax(0,1fr)) !important}}` : '') +
            `@media (max-width: 640px){${sel}{grid-template-columns:${phoneTracks} !important}}`}
        </style>
      ) : null}
      {children}
    </div>
  )
}
