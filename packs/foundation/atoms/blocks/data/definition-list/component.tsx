import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { listOf, safeRenderValue } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/** One term and what it means: one description, or several. */
export interface DefinitionItem {
  readonly term: string
  readonly description: string | readonly string[]
}

export interface DefinitionListProps {
  readonly items: readonly DefinitionItem[]
  /**
   * `stacked`: each description under its term (a glossary). `columns`: the
   * term beside its description (a spec sheet: "Weight 1.2 kg"); on a narrow
   * box the pairs stack.
   */
  readonly layout: 'stacked' | 'columns'
  /** A rule between the pairs. */
  readonly dividers: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const definitionListDefinition: BlockDefinition = {
  type: 'definition-list',
  name: 'Definition list',
  category: 'data',
  icon: '≔',
  defaultProps: { items: [], layout: 'stacked', dividers: false },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** The descriptions of an item, as text: a string is one, a list is several; empty ones go. */
export function descriptionsOf(item: DefinitionItem): string[] {
  const raw = (item as { description?: unknown }).description
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((d) => safeRenderValue(d).trim()).filter((d) => d !== '')
}

/**
 * Columns: a two-track grid that holds each pair on one row (`display:
 * contents` groups keep <dt>/<dd> direct grid items). Below 420px of its own
 * width the list stacks.
 */
const DL_CSS =
  '[data-pw-dl="columns"] { display: grid; grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr); column-gap: var(--pw-space-lg, 24px); }' +
  '[data-pw-dl="columns"] > div { display: contents; }' +
  '[data-pw-dl="columns"] > div > dd + dd { grid-column: 2; }' +
  '@container (max-width: 420px) { [data-pw-dl="columns"] { grid-template-columns: minmax(0, 1fr); } [data-pw-dl="columns"] > div > dd + dd { grid-column: auto; } }'

export const DefinitionListBlock: BlockComponent = ({ props, block }) => {
  const p = props as unknown as DefinitionListProps
  const items = listOf<DefinitionItem>(p.items).filter(
    (i) => typeof i === 'object' && i !== null && safeRenderValue((i as { term?: unknown }).term).trim() !== '',
  )
  const columns = p.layout === 'columns'
  const dividers = p.dividers === true
  if (items.length === 0) return null

  const rule = dividers ? '1px solid var(--pw-color-border)' : undefined
  const pad = dividers ? 'var(--pw-space-sm, 8px)' : 'var(--pw-space-xs, 4px)'
  const termStyle = (first: boolean): React.CSSProperties => ({
    margin: 0,
    paddingTop: first ? 0 : columns ? pad : `calc(${pad} * 2)`,
    paddingBottom: columns ? pad : 0,
    borderTop: first ? undefined : rule,
    fontWeight: 600,
    color: 'var(--pw-color-text)',
    overflowWrap: 'anywhere',
  })
  const descStyle = (first: boolean, firstOfPair: boolean): React.CSSProperties => ({
    margin: 0,
    paddingTop: columns ? (firstOfPair ? (first ? 0 : pad) : 0) : 'var(--pw-space-2xs, 2px)',
    paddingBottom: columns ? pad : 0,
    borderTop: columns && firstOfPair && !first ? rule : undefined,
    color: 'var(--pw-color-text-muted)',
    overflowWrap: 'anywhere',
  })

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="definition-list"
      style={{ containerType: 'inline-size', minWidth: 0, ...block.style }}
    >
      <style>{DL_CSS}</style>
      <dl data-pw-dl={columns ? 'columns' : 'stacked'} style={{ margin: 0, fontSize: 'var(--pw-font-size-base)', lineHeight: 'var(--pw-line-height-body, 1.5)' }}>
        {items.map((item, i) => {
          const descriptions = descriptionsOf(item)
          return (
            // A <div> around each pair is valid inside <dl> and keeps a pair together.
            <div key={i}>
              <dt style={termStyle(i === 0)}>{safeRenderValue(item.term)}</dt>
              {descriptions.map((d, j) => (
                <dd key={j} style={descStyle(i === 0, j === 0)}>
                  {d}
                </dd>
              ))}
            </div>
          )
        })}
      </dl>
    </div>
  )
}
