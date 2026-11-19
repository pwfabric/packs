import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { ICON_PATHS, listOf, safeHref, safeRenderValue } from '../../../lib/_kit.js'

/** foundation's OVERLAY_DISMISS_EVENT: a host modal or drawer closes on it. */
const OVERLAY_DISMISS_EVENT = 'pw:overlay-dismiss'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useAppMessage } from '@pwfabric/runtime'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface CommandItem {
  /** Echoed in the run event so a behavior can tell commands apart. */
  readonly id?: string
  readonly label: string
  readonly hint?: string
  readonly icon?: string
  /** Where the command goes. Navigates in a live render; the run event fires either way. */
  readonly href?: string
}

export interface CommandPaletteProps {
  /** Optional: unset reads "Type a command…" (the app's word goes here). */
  readonly placeholder?: string
  readonly items: readonly CommandItem[]
  /** Shortcut shown in the search row. Ctrl+K / ⌘K focuses the search when it is set. */
  readonly hotkeyLabel?: string
  /** Shown when the search matches nothing. Nothing is shown when omitted. */
  readonly emptyText?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const commandPaletteDefinition: BlockDefinition = {
  type: 'command-palette',
  name: 'Command Palette',
  category: 'overlay',
  icon: '⌘',
  defaultProps: {
    placeholder: 'Type a command…',
    items: [],
  },
  defaultLayout: { span: { xs: 4, sm: 6, md: 6, lg: 6 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

const renderIcon = (name: string | undefined): React.ReactNode => {
  const paths = (name && ICON_PATHS[name]) || ICON_PATHS.circle
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: (paths ?? []).join('') }}
    />
  )
}

export const CommandPaletteBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const p = props as unknown as CommandPaletteProps
  const placeholder = p.placeholder ?? 'Type a command…'
  const hotkeyLabel = typeof props.hotkeyLabel === 'string' ? props.hotkeyLabel : ''
  const emptyText = typeof props.emptyText === 'string' ? props.emptyText : ''
  // The palette's own names are the app's words (ui.commandPalette.*).
  const dialogName = useAppMessage('ui.commandPalette.label', '')
  const searchName = useAppMessage('ui.commandPalette.search', '')
  const listName = useAppMessage('ui.commandPalette.list', '')
  // No invented commands: the defaults were the platform's own editor
  // actions ("New surface", "Invite teammate") and reached visitors.
  const items = listOf<CommandItem>(p.items).filter(

    (it) => it && typeof it === 'object' && safeRenderValue(it.label)
  )
  const inert = context?.interactionMode === 'inert'
  const listId = `${block.id}-list`
  const optionId = (i: number): string => `${block.id}-cmd-${i}`
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => String(it?.label ?? '').toLowerCase().includes(q))
  }, [items, query])

  // Keep the active index in range as the filtered list changes.
  React.useEffect(() => {
    setActiveIndex((i) => (filtered.length === 0 ? 0 : Math.min(i, filtered.length - 1)))
  }, [filtered.length])

  // The shortcut the badge advertises: it used to be a label only.
  React.useEffect(() => {
    if (!hotkeyLabel || inert) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hotkeyLabel, inert])

  const runItem = (item: CommandItem | undefined): void => {
    if (!item) return
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { action: 'run', value: item.label, ...(item.id ? { id: item.id } : {}), ...(item.href ? { href: item.href } : {}) },
    })
    const href = safeHref(item.href)
    if (href && !inert && typeof window !== 'undefined') {
      // Close the host overlay (a modal or a drawer) FIRST: it releases the
      // body scroll lock through its own close path. Navigating with it open
      // left the next page unable to scroll until a reload.
      rootRef.current?.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { bubbles: true }))
      window.location.assign(href)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runItem(filtered[activeIndex])
    } else if (e.key === 'Escape') {
      // Esc first clears the search; with nothing typed it is left to the
      // surrounding overlay (a modal closes and returns focus to its trigger).
      // It was swallowed every time, and a palette inside a modal left the
      // dialog open on Esc only when the search held text.
      if (query) {
        e.preventDefault()
        e.stopPropagation()
        setQuery('')
      }
    }
  }

  const rootStyle: React.CSSProperties = {
    zIndex: 'var(--pw-z-modal, 500)' as unknown as number,
    width: '100%',
    maxWidth: '520px',
    margin: '0 auto',
    backgroundColor: 'var(--pw-color-card, #ffffff)',
    border: '1px solid var(--pw-color-border, #e4e4e7)',
    borderRadius: 'var(--pw-border-radius-xl, 16px)',
    boxShadow: 'var(--pw-shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
    overflow: 'hidden',
    ...block.style,
  }

  const searchRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--pw-space-sm, 8px)',
    padding: 'var(--pw-space-md, 16px)',
    borderBottom: '1px solid var(--pw-color-border, #e4e4e7)',
    color: 'color-mix(in srgb, var(--pw-color-text-on-card, var(--pw-color-text, #09090b)) 68%, transparent)',
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    fontSize: 'var(--pw-font-size-base, 16px)',
    color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
  }

  const hotkeyChipStyle: React.CSSProperties = {
    flexShrink: 0,
    padding: '2px 8px',
    fontSize: 'var(--pw-font-size-xs, 12px)',
    fontFamily: 'var(--pw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
    color: 'color-mix(in srgb, var(--pw-color-text-on-card, var(--pw-color-text, #09090b)) 68%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--pw-color-text-on-card, var(--pw-color-text)) 6%, transparent)',
    border: '1px solid var(--pw-color-border, #e4e4e7)',
    borderRadius: 'var(--pw-border-radius-sm, 6px)',
  }

  const listStyle: React.CSSProperties = {
    listStyle: 'none',
    margin: 0,
    padding: 'var(--pw-space-xs, 4px)',
    maxHeight: '320px',
    overflowY: 'auto',
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      ref={rootRef}
      data-block-type="command-palette"
      role="dialog"
      aria-label={dialogName}
      aria-modal="false"
      style={rootStyle}
    >
      <div style={searchRowStyle}>
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted, #71717a))' }}>
          {renderIcon('search')}
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={filtered[activeIndex] ? optionId(activeIndex) : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={placeholder || searchName}
          style={inputStyle}
        />
        {hotkeyLabel ? <kbd style={hotkeyChipStyle}>{hotkeyLabel}</kbd> : null}
      </div>

      {filtered.length === 0 && emptyText ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: 'var(--pw-space-md, 16px)',
            textAlign: 'center',
            color: 'color-mix(in srgb, var(--pw-color-text-on-card, var(--pw-color-text, #09090b)) 68%, transparent)',
            fontSize: 'var(--pw-font-size-sm, 14px)',
          }}
        >
          {emptyText}
        </p>
      ) : null}
      <ul id={listId} role="listbox" aria-label={listName} style={listStyle}>
        {filtered.map((item, idx) => {
          const active = idx === activeIndex
          return (
            <li
              key={`${item?.id ?? item?.label ?? 'item'}-${idx}`}
              id={optionId(idx)}
              role="option"
              aria-selected={active}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => runItem(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--pw-space-sm, 8px)',
                padding: '10px 12px',
                borderRadius: 'var(--pw-border-radius, 8px)',
                cursor: 'pointer',
                color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
                backgroundColor: active
                  ? 'color-mix(in srgb, var(--pw-color-primary) 14%, var(--pw-color-card, #ffffff))'
                  : 'transparent',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  color: active ? 'var(--pw-color-primary-ink, #18181b)' : 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted, #71717a))',
                }}
              >
                {renderIcon(item?.icon)}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--pw-font-size-sm, 14px)' }}>
                {safeRenderValue(item?.label)}
              </span>
              {item?.hint && (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 'var(--pw-font-size-xs, 12px)',
                    color: 'color-mix(in srgb, var(--pw-color-text-on-card, var(--pw-color-text, #09090b)) 68%, transparent)',
                  }}
                >
                  {safeRenderValue(item.hint)}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
