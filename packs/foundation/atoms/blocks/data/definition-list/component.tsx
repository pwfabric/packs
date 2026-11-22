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
 * All spacing and rules are here, not inline, so the narrow query can take
 * them back. Columns: a two-track grid that holds each pair on one row
 * (`display: contents` pairs keep <dt>/<dd> direct grid items); a rule runs
 * across the row above each pair after the first. Below 420px of the list's
 * own width the pairs stack, and the rule is only above the term — never
 * between a term and its description.
 */
const RULE = '1px solid var(--pw-color-border)'
const DL_CSS =
  '[data-pw-dl] { margin: 0; }' +
  '[data-pw-dl] dt { margin: 0; font-weight: 600; color: var(--pw-color-text); overflow-wrap: anywhere; }' +
  '[data-pw-dl] dd { margin: 0; padding-top: var(--pw-space-2xs, 2px); color: var(--pw-color-text-muted); overflow-wrap: anywhere; }' +
  '[data-pw-dl] > div + div > dt { padding-top: calc(var(--pw-dl-gap) * 2); }' +
  `[data-pw-dl][data-pw-dl-rules] > div + div > dt { border-top: ${RULE}; }` +
  '[data-pw-dl="columns"] { display: grid; grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr); column-gap: var(--pw-space-lg, 24px); }' +
  '[data-pw-dl="columns"] > div { display: contents; }' +
  '[data-pw-dl="columns"] > div > dt, [data-pw-dl="columns"] > div > dd { padding-top: var(--pw-dl-gap); padding-bottom: var(--pw-dl-gap); }' +
  '[data-pw-dl="columns"] > div > dd + dd { grid-column: 2; padding-top: 0; }' +
  '[data-pw-dl="columns"] > div:first-child > dt, [data-pw-dl="columns"] > div:first-child > dt + dd { padding-top: 0; }' +
  `[data-pw-dl="columns"][data-pw-dl-rules] > div + div > dt + dd { border-top: ${RULE}; }` +
  '@container (max-width: 420px) {' +
  ' [data-pw-dl="columns"] { grid-template-columns: minmax(0, 1fr); }' +
  ' [data-pw-dl="columns"] > div > dd + dd { grid-column: auto; }' +
  ' [data-pw-dl="columns"] > div > dt { padding-bottom: 0; }' +
  ' [data-pw-dl="columns"] > div > dd, [data-pw-dl="columns"] > div:first-child > dt + dd { padding-top: var(--pw-space-2xs, 2px); padding-bottom: 0; }' +
  ' [data-pw-dl="columns"] > div + div > dt { padding-top: calc(var(--pw-dl-gap) * 2); }' +
  ' [data-pw-dl="columns"][data-pw-dl-rules] > div + div > dt + dd { border-top: 0; }' +
  ' }'

export const DefinitionListBlock: BlockComponent = ({ props, block }) => {
  const p = props as unknown as DefinitionListProps
  const items = listOf<DefinitionItem>(p.items).filter(
    (i) => typeof i === 'object' && i !== null && safeRenderValue((i as { term?: unknown }).term).trim() !== '',
  )
  const columns = p.layout === 'columns'
  const dividers = p.dividers === true
  if (items.length === 0) return null

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="definition-list"
      // Full width, and NO size containment on the block itself: an
      // inline-size container takes no width from its content, so in a parent
      // that does not stretch it the list collapsed to almost nothing.
      style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', ...block.style }}
    >
      <style>{DL_CSS}</style>
      {/* The query container: a full-width inner box the narrow rule measures. */}
      <div data-pw-dl-box="" style={{ width: '100%', containerType: 'inline-size' }}>
        <dl
          data-pw-dl={columns ? 'columns' : 'stacked'}
          data-pw-dl-rules={dividers ? '' : undefined}
          style={{
            ['--pw-dl-gap' as string]: dividers ? 'var(--pw-space-sm, 8px)' : 'var(--pw-space-xs, 4px)',
            fontSize: 'var(--pw-font-size-base)',
            lineHeight: 'var(--pw-line-height-body, 1.5)',
          }}
        >
          {items.map((item, i) => (
            // A <div> around each pair is valid inside <dl> and keeps a pair together.
            <div key={i}>
              <dt>{safeRenderValue(item.term)}</dt>
              {descriptionsOf(item).map((d, j) => (
                <dd key={j}>{d}</dd>
              ))}
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
