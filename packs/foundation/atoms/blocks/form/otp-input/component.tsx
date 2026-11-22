import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { controlLabelStyle, safeRenderValue } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { messageOf, useAppMessage, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface OtpInputProps {
  readonly name?: string
  /** The group's accessible name. Unset: "Verification code". */
  readonly label?: string
  readonly length: number
  readonly inputMode: 'numeric' | 'text'
  readonly masked: boolean
  readonly required: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const otpInputDefinition: BlockDefinition = {
  type: 'otp-input',
  name: 'OTP Input',
  category: 'form',
  icon: '▦',
  defaultProps: {
    label: 'Verification code',
    length: 6,
    inputMode: 'numeric',
    masked: false,
    required: false,
  },
  defaultLayout: { span: { xs: 4, sm: 6, md: 5, lg: 5 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

export const OtpInputBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const p = props as unknown as OtpInputProps
  const label = p.label ?? 'Verification code'
  const length = Math.min(12, Math.max(1, Math.floor(p.length)))
  const inputMode = p.inputMode
  const masked = p.masked
  const name = p.name
  const required = p.required

  const [digits, setDigits] = React.useState<string[]>(() => Array.from({ length }, () => ''))
  const refs = React.useRef<Array<HTMLInputElement | null>>([])
  const code = digits.join('')
  const complete = digits.every((d) => d !== '')

  // A required code that is not complete is invalid ON THE FIRST CELL — the
  // hidden input that carries the value takes no part in validation, and the
  // form's own check (form.form `invalidFields`) reads the visible controls.
  // The words are the app's (`ui.form.code`, with {label} and {n}; each cell's name is `ui.otp.cell`).
  const appWords = useAppMessages()
  // {n} is a number, so a plural message ({n, plural, one {# digit} other {# digits}}) picks its words.
  const unfinished = useAppMessage('ui.form.code', '', { label, n: length })
  React.useEffect(() => {
    const first = refs.current[0]
    if (!first) return
    first.setCustomValidity(required && !complete ? unfinished : '')
  }, [required, complete, unfinished])

  // Keep the digit array length in sync if `length` changes.
  React.useEffect(() => {
    setDigits((prev) => {
      if (prev.length === length) return prev
      const next = Array.from({ length }, (_, i) => prev[i] ?? '')
      return next
    })
  }, [length])

  const commit = (next: string[]): void => {
    setDigits(next)
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: { value: next.join(''), inputId: block.id, name },
    })
  }

  const handleChange = (index: number, raw: string): void => {
    const cleaned =
      inputMode === 'numeric' ? raw.replace(/[^0-9]/g, '') : raw.replace(/\s/g, '')
    if (cleaned === '') {
      const next = [...digits]
      next[index] = ''
      commit(next)
      return
    }
    // Take the last typed character; support paste by spreading across cells.
    const chars = cleaned.split('')
    const next = [...digits]
    let cursor = index
    for (const ch of chars) {
      if (cursor >= length) break
      next[cursor] = ch
      cursor += 1
    }
    commit(next)
    const focusTarget = Math.min(cursor, length - 1)
    refs.current[focusTarget]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        commit(next)
      } else if (index > 0) {
        refs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="otp-input"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pw-space-sm, 8px)',
        // The boxes are sized from the container: a 390px card wrapped the
        // 6th box onto a new line. Up to 44px each, never wider than the box.
        width: '100%',
        maxWidth: `calc(${length} * 44px + ${Math.max(length - 1, 0)} * var(--pw-space-xs, 4px))`,
        ...block.style,
      }}
    >
      <span style={controlLabelStyle('var(--pw-space-sm, 8px)')}>
        {safeRenderValue(label)}
      </span>
      {/* ONE named value: the cells used to carry
          `${name}-0…` names, so FormData held verificationCode-0…-5 and never
          `verificationCode`. The cells are unnamed; this input carries the code. */}
      {name ? <input type="hidden" name={name} value={code} /> : null}
      <div
        role="group"
        aria-label={label}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))`, gap: 'var(--pw-space-xs, 4px)' }}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            type={masked ? 'password' : 'text'}
            inputMode={inputMode === 'numeric' ? 'numeric' : 'text'}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            required={required && i === 0 ? true : undefined}
            aria-label={messageOf(appWords, 'ui.otp.cell', '', { label, n: String(i + 1) })}
            value={digit}
            maxLength={1}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--pw-color-primary, #18181b)'
              e.currentTarget.style.boxShadow =
                '0 0 0 3px var(--pw-focus-ring-color, color-mix(in srgb, var(--pw-color-primary, #18181b) 25%, transparent))'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--pw-color-border, #e4e4e7)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            style={{
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              padding: 0,
              height: '50px',
              textAlign: 'center',
              fontSize: 'var(--pw-font-size-lg, 18px)',
              fontFamily: 'var(--pw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
              color: 'var(--pw-color-text, #09090b)',
              background: 'var(--pw-color-card, #ffffff)',
              border: '1px solid var(--pw-color-border, #e4e4e7)',
              borderRadius: 'var(--pw-border-radius, 8px)',
              transition: 'border-color var(--pw-duration-fast, 150ms), box-shadow var(--pw-duration-fast, 150ms)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
