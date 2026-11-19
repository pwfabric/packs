import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, listOf, safeRenderValue } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const LIST_STYLES = ['none', 'disc', 'decimal', 'check', 'arrow'] as const
export type ListStyle = (typeof LIST_STYLES)[number]

// An item is a string (shown as written) or a ROW OBJECT bound from a source
// (`{{tasks}}`): rows reach a block exactly as the source delivers them, with
// their own field names, so `textField` names the field shown. Same naming as
// data.repeater (`headingField`, `textField`) — the display family maps fields
// with `*Field`; option pickers (select, combobox) with `labelKey`/`valueKey`.
export type ListItem = string | number | Readonly<Record<string, unknown>>

export interface ListProps {
  readonly items: readonly ListItem[]
  /** Row items: the field shown (dotted path allowed, "data.title"). Without it a row shows its label, name or title. */
  readonly textField?: string
  readonly style: ListStyle
  readonly spacing: number
  /** Size in px. Omit it: the list follows the theme's small text size (--pw-font-size-sm). */
  readonly fontSize?: number
  readonly color?: string
  readonly iconColor?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const listDefinition: BlockDefinition = {
  type: 'list',
  name: 'List',
  category: 'data',
  icon: '☰',
  defaultProps: {
    items: [],
    style: 'disc',
    spacing: 8,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

function pick(rec: Record<string, unknown>, key: string | undefined): unknown {
  if (!key) return undefined
  if (key in rec) return rec[key]
  let cur: unknown = rec
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** The text one item shows: a string as written, a row's `textField` (else label, name, title). */
export function listItemText(item: unknown, textField?: string): string {
  if (item === null || item === undefined) return ''
  if (typeof item !== 'object') return safeRenderValue(item)
  const rec = item as Record<string, unknown>
  return safeRenderValue(textField ? pick(rec, textField) : (rec.label ?? rec.name ?? rec.title))
}

export const ListBlock: BlockComponent = ({ props, block }) => {
  const getMarker = (style: string): string => {
    switch (style) {
      case 'check':
        return '\u2713'
      case 'arrow':
        return '\u2192'
      default:
        return ''
    }
  }

  const p = props as unknown as ListProps
  // No items → an empty list. "Item 1..3" samples reached visitors.
  const textField = typeof p.textField === 'string' && p.textField ? p.textField : undefined
  const items = listOf<ListItem>(p.items).map((item) => listItemText(item, textField))
  const listStyle = p.style
  const isCustomMarker = listStyle === 'check' || listStyle === 'arrow' || listStyle === 'none'

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssUnit(p.spacing) ?? '8px',
    fontSize: cssUnit(p.fontSize) ?? 'var(--pw-font-size-sm)',
    color: p.color,
    listStyleType: isCustomMarker ? 'none' : listStyle,
    paddingLeft: isCustomMarker ? 0 : '1.5em',
    margin: 0,
  }

  const itemStyle: React.CSSProperties = {
    display: isCustomMarker ? 'flex' : 'list-item',
    alignItems: isCustomMarker ? 'flex-start' : undefined,
    gap: isCustomMarker ? '0.5em' : undefined,
  }

  const markerStyle: React.CSSProperties = {
    color: p.iconColor ?? p.color,
    flexShrink: 0,
  }

  const Tag = listStyle === 'decimal' ? 'ol' : 'ul'

  return (
    <Tag id={block.id} data-block-id={block.id} style={{ ...containerStyle, ...block.style }} data-block-type="list">
      {items.map((item: string, index: number) => (
        <li key={index} style={itemStyle}>
          {isCustomMarker && listStyle !== 'none' && (
            <span style={markerStyle}>{getMarker(listStyle)}</span>
          )}
          <span>{item}</span>
        </li>
      ))}
    </Tag>
  )
}
