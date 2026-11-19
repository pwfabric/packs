import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, safeRenderValue } from '../../../lib/_kit.js'

/**
 * At phone width or on a coarse pointer the remove × is a REAL 44×44 box (R3
 * measures the box; the invisible hit area alone measured 8×13) and the field
 * is 44px tall. The × eats the chip's right padding so the chip stays tidy.
 */
const TAG_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) {' +
  ' [data-pw-tag-x] { display: inline-flex !important; align-items: center; justify-content: center;' +
  ' width: 44px; height: 44px; margin-right: -8px !important; }' +
  ' [data-pw-tag-field] { min-height: 46px !important; padding-top: 0 !important; padding-bottom: 0 !important; }' +
  ' [data-pw-tag-text] { min-height: 44px; } }'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { useAppMessage, messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const TAG_DELIMITERS = ['enter', 'comma', 'space'] as const

export interface TagInputProps {
  readonly name?: string
  readonly label?: string
  readonly placeholder?: string
  readonly tags?: readonly string[]
  /** An integer ≥ 1 (the manifest bounds it). */
  readonly maxTags?: number
  readonly allowCreate: boolean
  readonly required: boolean
  readonly disabled: boolean
  readonly delimiter: (typeof TAG_DELIMITERS)[number]
  /** State key the tag list is written to on change — `{{state.<key>}}` then reads it. */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const tagInputDefinition: BlockDefinition = {
  type: 'tag-input',
  name: 'Tag Input',
  category: 'form',
  icon: '⊞',
  defaultProps: {
    allowCreate: true,
    required: false,
    disabled: false,
    delimiter: 'enter',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 6, lg: 6 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

export const TagInputBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as TagInputProps
  const label = safeRenderValue(props.label)
  const placeholder = safeRenderValue(props.placeholder)
  // No invented tags: without `tags` the field starts empty.
  const initialTags = Array.isArray(props.tags) ? (props.tags as unknown[]).map((t) => safeRenderValue(t)).filter(Boolean) : []
  const [tags, setTagsState] = React.useState<string[]>(initialTags)
  const [inputValue, setInputValue] = React.useState('')
  const { disabled, required, allowCreate, delimiter } = p
  const maxTags = p.maxTags

  const atMax = typeof maxTags === 'number' && tags.length >= maxTags
  const name = typeof props.name === 'string' && props.name ? props.name : undefined
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined
  const inputId = `${block.id}-input`
  const textRef = React.useRef<HTMLInputElement | null>(null)

  // The tag list leaves as ONE named value, comma-joined.
  // The text box used to be the named control, so FormData held
  // whatever was half-typed — "" once a tag was added — and never the tags.
  // Comma-joined rather than a repeated name because form.form gathers with
  // `Object.fromEntries(new FormData())`, where a repeated name keeps only the
  // last value. A tag therefore cannot contain a comma; one typed is split.
  const setTags = (next: string[]): void => {
    setTagsState(next)
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: {
        value: next,
        inputId: block.id,
        name,
        ...(stateKey ? { action: { type: 'setState', key: stateKey, value: next } } : {}),
      },
    })
  }

  // Required with no tags is invalid on the visible text box — the hidden
  // input that carries the value takes no part in validation.
  // The words are the app's: `ui.form.tags` ({label}) and `ui.remove` ({name}).
  const messages = useAppMessages()
  const noTags = useAppMessage('ui.form.tags', '', { label })
  React.useEffect(() => {
    textRef.current?.setCustomValidity(required && tags.length === 0 ? noTags : '')
  }, [required, tags.length, noTags])

  const addTag = (raw: string): void => {
    const parts = raw.split(',').map((t) => t.trim()).filter(Boolean)
    if (parts.length === 0 || !allowCreate) return
    const next = [...tags]
    for (const value of parts) {
      if (typeof maxTags === 'number' && next.length >= maxTags) break
      if (!next.includes(value)) next.push(value)
    }
    setInputValue('')
    if (next.length !== tags.length) setTags(next)
  }

  const removeTag = (index: number): void => {
    if (disabled) return
    setTags(tags.filter((_, i) => i !== index))
  }

  const delimiterKeys: Record<string, string> = { enter: 'Enter', comma: ',', space: ' ' }
  const delimiterKey = delimiterKeys[delimiter] ?? 'Enter'

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === delimiterKey || (delimiterKey !== 'Enter' && e.key === 'Enter')) {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    opacity: disabled ? 0.5 : undefined,
    cursor: disabled ? 'not-allowed' : undefined,
    ...block.style,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: 500,
    color: 'var(--pw-color-text)',
  }
  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    padding: '8px 12px',
    border: '1px solid var(--pw-color-border)',
    borderRadius: 'var(--pw-border-radius, 6px)',
    backgroundColor: 'var(--pw-color-card)',
    minHeight: '42px',
    alignItems: 'center',
    cursor: disabled ? 'not-allowed' : 'text',
  }
  const tagStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: 'color-mix(in srgb, var(--pw-color-primary) 14%, var(--pw-color-card))',
    color: 'color-mix(in srgb, var(--pw-color-primary) 45%, var(--pw-color-text-on-card, var(--pw-color-text)))',
    borderRadius: '4px',
    fontSize: 'var(--pw-font-size-sm)',
    fontWeight: 500,
  }
  const inputFieldStyle: React.CSSProperties = {
    flex: '1 1 80px',
    minWidth: '80px',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: 0,
    border: 'none',
    background: 'transparent',
    font: 'inherit',
    color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
    fontSize: 'var(--pw-font-size-sm)',
  }

  return (
    <div id={block.id} data-block-id={block.id} style={wrapperStyle} data-block-type="tag-input">
      {label && (
        <label style={labelStyle} htmlFor={inputId}>
          {label}
          {required && <span style={{ color: 'var(--pw-color-error)', marginLeft: '2px' }}>*</span>}
        </label>
      )}
      {name ? <input type="hidden" name={name} value={tags.join(',')} /> : null}
      {/* The remove × is a real 44px box on a phone or a touch screen. */}
      <style>{HIT_AREA_CSS + TAG_TOUCH_CSS}</style>
      <div style={fieldStyle} data-pw-tag-field="" onClick={() => textRef.current?.focus()}>
        {tags.map((tag, i) => (
          <span key={`${tag}-${i}`} style={tagStyle}>
            {tag}
            {!disabled && (
              <button
                type="button"
                aria-label={messageOf(messages, 'ui.remove', '', { name: tag })}
                data-pw-hit=""
                data-pw-tag-x=""
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(i)
                }}
                style={{
                  cursor: 'pointer',
                  opacity: 0.7,
                  marginLeft: '2px',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && allowCreate && (
          <input
            ref={textRef}
            id={inputId}
            type="text"
            value={inputValue}
            readOnly={atMax}
            aria-required={required || undefined}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(inputValue)}
            placeholder={tags.length === 0 && placeholder ? placeholder : undefined}
            data-pw-tag-text=""
            style={inputFieldStyle}
          />
        )}
      </div>
    </div>
  )
}
