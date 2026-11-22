import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { MOTION, listOf, safeRenderValue, transitionOf } from '../../../lib/_shared-utils.js'

/** A visitor who asks for less motion gets the panel open and closed at once. */
const ACCORDION_CSS = '@media (prefers-reduced-motion: reduce) { [data-pw-accordion-panel] { transition: none !important; } }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface AccordionItem {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly disabled?: boolean
}

export interface AccordionProps {
  readonly items: readonly AccordionItem[]
  readonly allowMultiple: boolean
  readonly defaultOpen?: readonly string[]
  /**
   * Every item starts open (a FAQ read top to bottom); each can still be
   * closed, and opening one never closes another.
   */
  readonly openAll?: boolean
  readonly variant: 'default' | 'bordered' | 'separated'
}

// ============================================================
// DEFINITION
// ============================================================

export const accordionDefinition: BlockDefinition = {
  type: 'accordion',
  name: 'Accordion',
  category: 'container',
  icon: '⊟',
  defaultProps: {
    items: [],
    allowMultiple: false,
    variant: 'default',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const AccordionBlock: BlockComponent = ({ props, block }) => {
  const p = props as unknown as AccordionProps
  // Unset → [] (the manifest default): nothing drawn. "Section 1 / Section 2"
  // samples reached visitors.
  // A wrong type (an unresolved binding, one record) draws nothing.
  const items = listOf<AccordionItem>(p.items)
  const openAll = p.openAll === true
  const allowMultiple = p.allowMultiple || openAll
  // No default: a value that does not fit is left as written.
  const defaultOpen = openAll
    ? items.map((item, index) => item.id ?? String(index))
    : Array.isArray(p.defaultOpen) ? p.defaultOpen : []
  const variant = p.variant

  const [openItems, setOpenItems] = React.useState<Set<string>>(new Set(defaultOpen))

  const toggleItem = (id: string): void => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(id)
      }
      return next
    })
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: variant === 'separated' ? '8px' : '0',
    border: variant === 'bordered' ? '1px solid var(--pw-color-border)' : undefined,
    borderRadius: variant === 'bordered' ? '8px' : undefined,
    overflow: variant === 'bordered' ? 'hidden' : undefined,
  }

  const itemStyle = (isFirst: boolean): React.CSSProperties => ({
    borderTop: variant === 'default' && !isFirst ? '1px solid var(--pw-color-border)' : undefined,
    border: variant === 'separated' ? '1px solid var(--pw-color-border)' : undefined,
    borderRadius: variant === 'separated' ? '8px' : undefined,
    overflow: 'hidden',
  })

  const headerBtnStyle = (isOpen: boolean, disabled?: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: isOpen ? 'var(--pw-color-card)' : 'transparent',
    // NOT the UA button black: inherit the ambient colour when closed, card ink when open
    color: isOpen ? 'var(--pw-color-text-on-card, var(--pw-color-text))' : 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontWeight: 500,
    // The theme's BODY size: a question read at the fixed small size looked
    // like a footnote beside the page's own text.
    fontSize: 'var(--pw-font-size-base)',
    fontFamily: 'inherit',
    lineHeight: 'var(--pw-line-height-normal, 1.5)',
    gap: 'var(--pw-space-sm, 8px)',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: `background-color ${MOTION.normal}`,
  })

  // THE PANEL HAS NO HEIGHT CAP. It was a max-height of 500px, which clipped
  // a long answer. The panel is a one-row grid whose track goes 0fr -> 1fr, so
  // it opens to its content's own height, whatever that is. It opens at the
  // theme's slow pace (an entrance, not a flick); closed, it is hidden from
  // the keyboard and from screen readers once it has finished closing.
  const contentStyle = (isOpen: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateRows: isOpen ? '1fr' : '0fr',
    visibility: isOpen ? 'visible' : 'hidden',
    transition: `${transitionOf(['grid-template-rows'], MOTION.slow)}, visibility 0s linear ${isOpen ? '0s' : 'var(--pw-duration-slow, 400ms)'}`,
    fontSize: 'var(--pw-font-size-base)',
    color: 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted))',
  })

  const chevronStyle = (isOpen: boolean): React.CSSProperties => ({
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    // The chevron springs on the theme's bounce easing — a lively theme's turn.
    transition: `transform ${MOTION.spring}`,
    display: 'inline-flex',
    flex: '0 0 auto',
    color: 'var(--pw-color-text-muted, currentColor)',
  })

  return (
    <div id={block.id} data-block-id={block.id} style={{ ...containerStyle, ...block.style }} data-block-type="accordion">
      {items.length > 0 && <style>{ACCORDION_CSS}</style>}
      {items.map((item: AccordionItem, index: number) => {
        // `id` is REQUIRED by the manifest, but a receipt that omits it used to
        // produce `…-header-undefined` for every row — duplicate DOM ids, broken
        // aria-controls and a React key warning, none of which fail loudly.
        // Falling back to the index keeps the rows addressable and distinct.
        const itemId = item.id ?? String(index)
        const isOpen = openItems.has(itemId)
        const headerId = `${block.id}-header-${itemId}`
        const panelId = `${block.id}-panel-${itemId}`
        return (
          <div key={itemId} style={itemStyle(index === 0)}>
            <button
              type="button"
              id={headerId}
              style={headerBtnStyle(isOpen, item.disabled)}
              onClick={() => !item.disabled && toggleItem(itemId)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-disabled={item.disabled ?? false}
            >
              <span>{safeRenderValue(item.title)}</span>
              {/* A drawn chevron, not a text glyph: the black triangle read as
                  part of the button's name in tools that take the text content. */}
              <span style={chevronStyle(isOpen)} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              data-pw-accordion-panel=""
              style={contentStyle(isOpen)}
              inert={!isOpen}
            >
              <div style={{ minHeight: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px' }}>{safeRenderValue(item.content)}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
