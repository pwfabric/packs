import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { CONTROL_HEIGHT, CONTROL_LABEL_STYLE, safeRenderValue, ICON_PATHS } from '../../../lib/_kit.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { useAppMessage } from '@pwfabric/runtime'

/**
 * At phone width or on a coarse pointer the text box ITSELF is a real 44px-tall
 * box (R3 measured the input, 19px tall inside its 40px frame); the frame grows
 * around it. A fine-pointer desktop keeps the 40px frame.
 */
const COMBO_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) {' +
  ' [data-pw-combo-frame] { height: auto !important; min-height: 46px; }' +
  ' [data-pw-combo-input] { min-height: 44px; } }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface ComboboxOption {
  readonly label: string
  readonly value: string
}

export interface ComboboxProps {
  readonly name?: string
  readonly label?: string
  // `{label, value}` objects, plain strings (value = label), or ROWS bound from
  // a source (`{{customers}}`) with their own field names, which
  // `labelKey`/`valueKey` name — the same props form.select reads, so the two
  // option pickers map rows the same way.
  readonly options: readonly (ComboboxOption | string | number | Readonly<Record<string, unknown>>)[]
  /** Bound rows: the field shown as each option's label (dotted path allowed). Default `label`, then name, then title. */
  readonly labelKey?: string
  /** Bound rows: the field submitted as each option's value. Default `value`, then id. */
  readonly valueKey?: string
  readonly placeholder?: string
  readonly searchable: boolean
  /** The option value selected before the visitor chooses (an edit form's stored value). */
  readonly defaultValue?: string
  readonly required: boolean
  /** Shown when the search matches nothing. Nothing is shown when omitted. */
  readonly emptyText?: string
  /** State key the chosen VALUE is written to — `{{state.<key>}}` then reads it. */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const comboboxDefinition: BlockDefinition = {
  type: 'combobox',
  name: 'Combobox',
  category: 'form',
  icon: '▾',
  defaultProps: {
    options: [],
    searchable: true,
    required: false,
  },
  defaultLayout: { span: { xs: 4, sm: 6, md: 5, lg: 5 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

interface Option {
  label: string
  value: string
}

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

/**
 * Every accepted option shape as `{value,label}` — the rule form.select's
 * normaliseOptions follows: the named keys first, then value → id and
 * label → name → title, and each side falls back to the other.
 */
export function comboboxOptions(raw: unknown, labelKey?: string, valueKey?: string): Option[] {
  if (!Array.isArray(raw)) return []
  const out: Option[] = []
  for (const o of raw) {
    if (o === null || o === undefined) continue
    if (typeof o !== 'object') {
      out.push({ label: safeRenderValue(o), value: safeRenderValue(o) })
      continue
    }
    const rec = o as Record<string, unknown>
    const rawValue = safeRenderValue(pick(rec, valueKey) ?? rec.value ?? rec.id)
    const rawLabel = safeRenderValue(pick(rec, labelKey) ?? rec.label ?? rec.name ?? rec.title)
    const value = rawValue || rawLabel
    const label = rawLabel || value
    if (value === '' && label === '') continue
    out.push({ label, value })
  }
  return out
}

export const ComboboxBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const label = typeof props.label === 'string' ? props.label : ''
  const placeholder = typeof props.placeholder === 'string' ? props.placeholder : ''
  const emptyText = typeof props.emptyText === 'string' ? props.emptyText : ''
  const p = props as unknown as ComboboxProps
  const { searchable, required } = p
  const name = typeof props.name === 'string' && props.name ? props.name : undefined
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined
  const keyOf = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
  const options: Option[] = comboboxOptions(p.options, keyOf(p.labelKey), keyOf(p.valueKey))

  const listId = `${block.id}-listbox`
  const optionId = (i: number): string => `${block.id}-opt-${i}`

  const findOption = (v: unknown): Option | null =>
    v === undefined || v === null || v === '' ? null : (options.find((o) => o.value === String(v)) ?? null)

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<Option | null>(() => findOption(props.defaultValue))
  // A bound `defaultValue` (`{{record.city}}`) arrives resolved after the first
  // render: a new value re-selects, like form.segmented-control.
  const lastDefault = React.useRef(props.defaultValue)
  if (lastDefault.current !== props.defaultValue) {
    lastDefault.current = props.defaultValue
    setSelected(findOption(props.defaultValue))
  }
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  // The words are the app's: the same `ui.form.select` a required select reads.
  const unchosen = useAppMessage('ui.form.select', '', { label })
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(required && !selected ? unchosen : '')
  }, [required, selected, unchosen])
  const [activeIndex, setActiveIndex] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const filtered = React.useMemo<Option[]>(() => {
    if (!searchable || query.trim() === '') return options
    const q = query.trim().toLowerCase()
    // The array itself is guarded, the ITEM shape is not: the schema requires
    // `label`, but the schema does not run on the render path, so an item
    // without a label would crash here.
    return options.filter((o) => String(o?.label ?? '').toLowerCase().includes(q))
  }, [options, query, searchable])

  // Close on outside click. Listener is attached only while open; cleaned up on
  // unmount / close. Purely visual state — safe in both live and inert modes.
  React.useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const choose = (opt: Option): void => {
    setSelected(opt)
    setQuery('')
    setOpen(false)
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: {
        value: opt.value,
        inputId: block.id,
        name,
        ...(stateKey ? { action: { type: 'setState', key: stateKey, value: opt.value } } : {}),
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (open && opt) choose(opt)
      else setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const displayValue = open ? query : selected?.label ?? query

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="combobox"
      style={{
        display: 'flex',
        flexDirection: 'column',
        // No gap of its own: the label's CONTROL_LABEL_STYLE spaces it from the field.
        width: '100%',
        ...block.style,
      }}
    >
      {label && (
        <span style={CONTROL_LABEL_STYLE}>
          {safeRenderValue(label)}
        </span>
      )}
      <style>{COMBO_TOUCH_CSS}</style>
      <div ref={rootRef} style={{ position: 'relative', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
        <div
          data-pw-combo-frame=""
          style={{
            boxSizing: 'border-box',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--pw-space-xs, 4px)',
            padding: '0 10px',
            // The shared single-line control height (foundation's input and select).
            height: CONTROL_HEIGHT,
            background: 'var(--pw-color-card, #ffffff)',
            border: '1px solid var(--pw-color-border, #e4e4e7)',
            borderRadius: 'var(--pw-border-radius, 8px)',
          }}
        >
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
            style={{ color: 'var(--pw-color-text-muted, #71717a)', flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: (ICON_PATHS.search ?? []).join('') }}
          />
          {/* The visible box carried `name` and showed the
              LABEL, so FormData submitted "İstanbul" for the option "ist". The box
              is unnamed; this input carries the selected option's VALUE. */}
          {name ? <input type="hidden" name={name} value={selected?.value ?? ''} /> : null}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            data-pw-combo-input=""
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete={searchable ? 'list' : 'none'}
            aria-activedescendant={open && filtered[activeIndex] ? optionId(activeIndex) : undefined}
            aria-label={label || undefined}
            aria-required={required || undefined}
            readOnly={!searchable}
            value={displayValue}
            placeholder={selected ? selected.label : placeholder || undefined}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              alignSelf: 'stretch',
              padding: 0,
              border: 'none',
              background: 'transparent',
              fontSize: 'var(--pw-font-size-sm, 14px)',
              color: 'var(--pw-color-text, #09090b)',
              cursor: searchable ? 'text' : 'pointer',
            }}
          />
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
            style={{
              color: 'var(--pw-color-text-muted, #71717a)',
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--pw-duration-fast, 150ms)',
            }}
            dangerouslySetInnerHTML={{ __html: (ICON_PATHS['chevron-down'] ?? []).join('') }}
          />
        </div>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label || undefined}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 'var(--pw-z-dropdown, 300)' as unknown as number,
              margin: 0,
              padding: '4px',
              listStyle: 'none',
              maxHeight: '240px',
              overflowY: 'auto',
              background: 'var(--pw-color-card, #ffffff)',
              border: '1px solid var(--pw-color-border, #e4e4e7)',
              borderRadius: 'var(--pw-border-radius, 8px)',
              boxShadow: 'var(--pw-shadow-lg, 0 10px 24px rgba(0,0,0,0.12))',
            }}
          >
            {filtered.length === 0 && emptyText && (
              <li
                role="presentation"
                style={{
                  padding: '8px 10px',
                  fontSize: 'var(--pw-font-size-sm, 14px)',
                  color: 'var(--pw-color-text-muted, #71717a)',
                }}
              >
                {emptyText}
              </li>
            )}
            {filtered.map((opt, i) => {
              const active = i === activeIndex
              const isSelected = selected?.value === opt.value
              return (
                <li
                  key={`${opt.value}-${i}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(opt)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--pw-space-sm, 8px)',
                    padding: '8px 10px',
                    borderRadius: 'var(--pw-border-radius-sm, 6px)',
                    cursor: 'pointer',
                    fontSize: 'var(--pw-font-size-sm, 14px)',
                    color: 'var(--pw-color-text, #09090b)',
                    background: active
                      ? 'var(--pw-color-primary-subtle, color-mix(in srgb, var(--pw-color-primary, #18181b) 10%, var(--pw-color-card, #ffffff)))'
                      : 'transparent',
                  }}
                >
                  <span>{safeRenderValue(opt.label)}</span>
                  {isSelected && (
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ color: 'var(--pw-color-primary-ink, #18181b)', flexShrink: 0 }}
                      dangerouslySetInnerHTML={{ __html: (ICON_PATHS.check ?? []).join('') }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
