import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, safeHref, type CSSUnit } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface FormProps {
  readonly action: string
  readonly method: HttpMethod
  /** No default text. Unset → the browser's own submit button, labelled in the visitor's language. */
  readonly submitLabel?: string
  readonly resetLabel?: string
  readonly showReset: boolean
  readonly gap: number | string
  /** One declarative surface action dispatched on submit (`{ type:'setState', key:'submitted', value:true }`). */
  readonly onSubmitAction?: { readonly type: string; readonly [key: string]: unknown }
  /** In-flight submit lock — bind to the form-entity bridge's loading key (`"{{state.scLoading}}"`). */
  readonly submittingWhen?: boolean
  /** Whether the form renders its own submit button (`"{{state.step == 3}}"`). Unset → shown. */
  readonly showSubmit?: boolean | string
  /** Clears the fields when this turns true (the false → true edge). */
  readonly resetWhen?: boolean | string
  /** A second, quieter control beside submit ("Back", "Cancel"). Unset → none. */
  readonly secondaryLabel?: string
  /** Where the secondary control goes: it renders a link in the secondary look. Wins over secondaryAction. */
  readonly secondaryHref?: string
  /** What the secondary control does when pressed (one surface action, the button's shapes). It never submits. */
  readonly secondaryAction?: { readonly type: string; readonly [key: string]: unknown }
}

// ============================================================
// DEFINITION
// ============================================================

export const formDefinition: BlockDefinition = {
  type: 'form',
  name: 'Form',
  category: 'form',
  icon: '☐',
  defaultProps: {
    action: '',
    method: 'POST',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 8 } },
  canHaveChildren: true,
  allowedChildren: ['input', 'button', 'text', 'heading', 'container'],
}

// ============================================================
// PAYLOAD
// ============================================================

type Named = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

// A `file` input IS part of the payload: a picked file goes to the engine as
// the File itself, and the engine refuses a write whose record has no file
// field before sending (a `validation` failure naming the field) — the visitor
// is told, instead of the file vanishing from a save that says it succeeded.
const NOT_SUBMITTED = new Set(['submit', 'reset', 'button', 'image'])

/** A checkbox answering yes/no: no explicit value (the UA's "on"), "true", or declared boolean. */
function isBooleanCheckbox(el: HTMLInputElement): boolean {
  if (el.dataset.pwValueType === 'boolean') return true
  const v = el.value
  return v === 'on' || v === 'true'
}

/** "true"/"false"/"on" as booleans; every other value unchanged. */
function booleanize(v: unknown): unknown {
  if (v === 'true' || v === 'on') return true
  if (v === 'false') return false
  return v
}

/**
 * THE FORM PAYLOAD, BUILT FROM THE FORM'S OWN ELEMENTS.
 *
 * `Object.fromEntries(new FormData(form))` kept one value per name and dropped
 * whatever FormData leaves out. Three classes of field broke on it:
 *
 *   - a name carried by several controls (a checkbox group, a multi-select, a
 *     repeated hidden field) kept only its LAST value;
 *   - an unchecked checkbox sent nothing at all, so a required boolean always
 *     failed validation on the server;
 *   - a radio group with nothing picked vanished from the record.
 *
 * Now every NAMED, enabled control is accounted for:
 *
 *   single checkbox          → true / false (its value when it carries a real one)
 *   hidden + one checkbox    → the checkbox's answer, else the hidden fallback
 *   checkbox group           → array of the checked values ([] when none)
 *   select multiple          → array of the selected values
 *   radio group              → the picked value, "" when none
 *   hidden, marked boolean   → true / false ("" when nothing is chosen)
 *   file                     → the picked File (an array when `multiple`);
 *                              nothing when none is picked
 *   anything else            → its value; several controls → array
 *
 * Numbers stay strings — the backend coerces by field type. Disabled
 * controls and buttons are left out, which is the HTML contract, not a drop.
 */
export function collectFormValues(form: HTMLFormElement): Record<string, unknown> {
  const groups = new Map<string, Named[]>()
  for (const node of Array.from(form.elements)) {
    const el = node as Named
    const name = (el as { name?: unknown }).name
    if (typeof name !== 'string' || name === '') continue
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue
    if (el.disabled) continue
    if (el instanceof HTMLInputElement && NOT_SUBMITTED.has(el.type)) continue
    const list = groups.get(name)
    if (list) list.push(el)
    else groups.set(name, [el])
  }

  const values: Record<string, unknown> = {}
  for (const [name, els] of groups) {
    const inputs = els.filter((e): e is HTMLInputElement => e instanceof HTMLInputElement)
    // Files: what was picked, as File objects; an empty picker sends nothing.
    const files = inputs.filter((e) => e.type === 'file')
    if (files.length > 0 && files.length === els.length) {
      const picked = files.flatMap((f) => Array.from(f.files ?? []))
      if (picked.length === 0) continue
      values[name] = files.some((f) => f.multiple) || picked.length > 1 ? picked : picked[0]
      continue
    }
    const checkboxes = inputs.filter((e) => e.type === 'checkbox')
    const radios = inputs.filter((e) => e.type === 'radio')
    const multiple = els.some((e) => (e instanceof HTMLSelectElement && e.multiple) || (e as HTMLElement).dataset?.pwMultiple === 'true')

    // One checkbox: a yes/no question.
    if (els.length === 1 && checkboxes.length === 1) {
      const cb = checkboxes[0]!
      values[name] = isBooleanCheckbox(cb) ? cb.checked : cb.checked ? cb.value : false
      continue
    }
    // The hidden-fallback idiom: <input type=hidden value=false> + one checkbox.
    if (checkboxes.length === 1 && !multiple && els.every((e) => e === checkboxes[0] || (e instanceof HTMLInputElement && e.type === 'hidden'))) {
      const cb = checkboxes[0]!
      const hidden = els.find((e) => e !== cb) as HTMLInputElement | undefined
      values[name] = cb.checked ? booleanize(cb.value) : booleanize(hidden?.value ?? false)
      continue
    }
    // A control in boolean mode (segmented-control with true/false options)
    // carries its answer in one hidden input marked boolean: "true"/"false"
    // arrive as booleans, "" (nothing chosen) stays "".
    const only = els.length === 1 ? els[0] : undefined
    if (only instanceof HTMLInputElement && only.type === 'hidden' && only.dataset.pwValueType === 'boolean') {
      values[name] = booleanize(only.value)
      continue
    }
    // A radio group: one answer or none.
    if (radios.length === els.length) {
      values[name] = radios.find((r) => r.checked)?.value ?? ''
      continue
    }

    const parts: unknown[] = []
    for (const el of els) {
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        if (el.checked) parts.push(el.value)
      } else if (el instanceof HTMLSelectElement && el.multiple) {
        for (const o of Array.from(el.selectedOptions)) parts.push(o.value)
      } else {
        parts.push(el.value)
      }
    }
    if (multiple || checkboxes.length > 1) values[name] = parts
    else values[name] = parts.length === 1 ? parts[0] : parts.length === 0 ? '' : parts
  }
  return values
}

// ============================================================
// VALIDATION
// ============================================================

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/** Hidden by an ancestor inside the form — a wizard step off screen. */
function isHiddenInForm(el: Element, form: HTMLFormElement): boolean {
  for (let node: Element | null = el; node && node !== form; node = node.parentElement) {
    if ((node as HTMLElement).hidden) return true
    if (node.ownerDocument.defaultView?.getComputedStyle(node).display === 'none') return true
  }
  return false
}

/** The words a visitor knows the field by: its label, else its name. */
function fieldLabel(el: Field): string {
  const clean = (t: string | null | undefined): string => (t ?? '').replace(/\s*\*\s*$/, '').trim()
  const own = clean(el.labels?.[0]?.textContent)
  if (own) return own
  const aria = clean(el.getAttribute('aria-label'))
  if (aria) return aria
  const blockLabel = clean(el.closest('[data-block-id]')?.querySelector('label')?.textContent)
  if (blockLabel) return blockLabel
  return clean((el as HTMLInputElement).placeholder) || el.name
}

/**
 * The fields the browser would refuse, split by whether the visitor can see
 * them. `willValidate` excludes hidden inputs, disabled fields and buttons.
 */
function invalidFields(form: HTMLFormElement): { visible: Field[]; hidden: Field[] } {
  const visible: Field[] = []
  const hidden: Field[] = []
  for (const el of Array.from(form.elements)) {
    const field = el as Field
    if (!('willValidate' in field) || !field.willValidate || field.validity.valid) continue
    ;(isHiddenInForm(field, form) ? hidden : visible).push(field)
  }
  return { visible, hidden }
}

/**
 * Inline field messages. On a refused submit every visible invalid field gets
 * its message right under it (`data-pw-field-error`, linked by
 * aria-describedby) and aria-invalid; the first one takes focus. The browser's
 * bubble named only the first field and vanished on the next click. A message
 * goes away as soon as its field becomes valid.
 */
const FIELD_ERROR = 'data-pw-field-error'

function fieldHost(field: Field, form: HTMLFormElement): HTMLElement {
  const host = field.closest('[data-block-id]') as HTMLElement | null
  return host && host !== form && form.contains(host) ? host : (field.parentElement ?? form)
}

type Messages = Readonly<Record<string, string>> | null

/**
 * THE FIELD'S MESSAGE, IN THE APP'S WORDS — never the browser's.
 *
 * `validationMessage` is the browser's sentence in the browser's language
 * ("Please fill out this field."), so the form names the rule that failed and
 * reads the app's message for it (`plan.json` `messages`):
 *
 *   ui.form.required   an empty required field          {label}
 *   ui.form.checkbox   a required box left unticked     {label}
 *   ui.form.select     a required select / radio group  {label}
 *   ui.form.email      not an e-mail address            {label}
 *   ui.form.url        not a web address                {label}
 *   ui.form.type       any other wrong kind of value    {label}
 *   ui.form.pattern    the field's format (an input's own `patternMessage` wins)
 *   ui.form.min / ui.form.max                           {label} {min} / {max}
 *   ui.form.step                                        {label} {step}
 *   ui.form.minLength / ui.form.maxLength               {label} {minLength} / {maxLength}
 *   ui.form.badInput   a value the control cannot read  {label}
 *
 * A block that judges its own value (a date on a closed day, an unfinished
 * code) sets its message with `setCustomValidity` from the app's words, and
 * that message is shown as it is.
 */
export function fieldMessage(field: Field, messages: Messages): string {
  const v = field.validity
  const label = fieldLabel(field)
  const say = (id: string, fallback: string, vars: Record<string, string> = {}): string =>
    messageOf(messages, id, fallback, { label, ...vars })
  if (v.valueMissing) {
    if (field instanceof HTMLInputElement && field.type === 'checkbox') return say('ui.form.checkbox', '')
    if (field instanceof HTMLSelectElement || (field instanceof HTMLInputElement && field.type === 'radio')) {
      return say('ui.form.select', '')
    }
    if (!v.customError) return say('ui.form.required', '')
  }
  if (v.customError && field.validationMessage) return field.validationMessage
  if (v.typeMismatch) {
    const type = (field as HTMLInputElement).type
    if (type === 'email') return say('ui.form.email', '')
    if (type === 'url') return say('ui.form.url', '')
    return say('ui.form.type', '')
  }
  if (v.patternMismatch) return say('ui.form.pattern', '')
  const attr = (name: string): string => field.getAttribute(name) ?? ''
  if (v.tooShort) return say('ui.form.minLength', '', { minLength: attr('minlength') })
  if (v.tooLong) return say('ui.form.maxLength', '', { maxLength: attr('maxlength') })
  if (v.rangeUnderflow) return say('ui.form.min', '', { min: attr('min') })
  if (v.rangeOverflow) return say('ui.form.max', '', { max: attr('max') })
  if (v.stepMismatch) return say('ui.form.step', '', { step: attr('step') || '1' })
  if (v.badInput) return say('ui.form.badInput', '')
  return say('ui.form.required', '')
}

function showFieldError(field: Field, form: HTMLFormElement, messages: Messages): void {
  const host = fieldHost(field, form)
  const id = `${field.id || field.name || 'field'}-error`
  let note = host.querySelector(`[${FIELD_ERROR}]`) as HTMLElement | null
  if (!note) {
    note = document.createElement('p')
    note.setAttribute(FIELD_ERROR, '')
    note.style.cssText =
      'margin:6px 0 0;color:var(--pw-color-error, #b91c1c);font-size:var(--pw-font-size-sm, 14px);line-height:1.4'
    host.appendChild(note)
  }
  note.id = id
  note.textContent = fieldMessage(field, messages)
  field.setAttribute('aria-invalid', 'true')
  field.setAttribute('aria-describedby', id)
}

function clearFieldError(field: Field, form: HTMLFormElement): void {
  if (field.getAttribute('aria-invalid') !== 'true') return
  fieldHost(field, form).querySelector(`[${FIELD_ERROR}]`)?.remove()
  field.removeAttribute('aria-invalid')
  field.removeAttribute('aria-describedby')
}

function clearAllFieldErrors(form: HTMLFormElement): void {
  form.querySelectorAll(`[${FIELD_ERROR}]`).forEach((n) => n.remove())
  form.querySelectorAll('[aria-invalid="true"]').forEach((n) => {
    n.removeAttribute('aria-invalid')
    n.removeAttribute('aria-describedby')
  })
}

// ============================================================
// COMPONENT
// ============================================================

export const FormBlock: BlockComponent = ({ props, children, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const messages = useAppMessages()
  const submitType = (props as unknown as FormProps).onSubmitAction?.type
  const authIntent = submitType === 'auth:register' ? 'register' : submitType === 'auth:signIn' ? 'sign-in' : undefined
  // Truthy-tolerant: the {{state.x}} binding resolves to a real boolean, but
  // interpolated contexts can yield the string "true".
  const submitting = props.submittingWhen === true || props.submittingWhen === 'true'
  const submitHidden = props.showSubmit === false || props.showSubmit === 'false' || props.showSubmit === '' || props.showSubmit === 0
  // Synchronous re-entry lock: the submitting PROP only updates after React
  // re-renders, so several same-tick submits (rapid double-click, double
  // Enter) all pass a prop-only guard. Worse, presence of the binding can't
  // gate this — an unresolved `"{{state.scLoading}}"` resolves to undefined
  // (identical to no binding at all) until the bridge first writes the key.
  // So the ref lock ALWAYS engages on submit and releases by whichever signal
  // arrives: the bound loading state completing its true→false round-trip,
  // a short 600ms window if no loading signal ever shows up (form without a
  // bridge — keeps mock forms re-submittable), or the 8s backstop (so a
  // stuck binding can't brick the form).
  // Fields the browser refused but the visitor cannot see (see below).
  const [missing, setMissing] = React.useState<readonly string[]>([])
  const formRef = React.useRef<HTMLFormElement | null>(null)
  const resetSignal = props.resetWhen === true || props.resetWhen === 'true'
  const lastResetRef = React.useRef(resetSignal)
  React.useEffect(() => {
    if (resetSignal && !lastResetRef.current) {
      // Native reset: every field returns to its default, and controls that
      // keep their own state (segmented-control) listen for the 'reset' event.
      formRef.current?.reset()
      if (formRef.current) clearAllFieldErrors(formRef.current)
      setMissing([])
    }
    lastResetRef.current = resetSignal
  }, [resetSignal])
  const inFlightRef = React.useRef(false)
  const sawLoadingRef = React.useRef(false)
  React.useEffect(() => {
    if (submitting) {
      sawLoadingRef.current = true
    } else if (sawLoadingRef.current) {
      inFlightRef.current = false
      sawLoadingRef.current = false
    }
  }, [submitting])

  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssUnit((props as unknown as FormProps).gap as CSSUnit) ?? '16px',
  }
  const submitLabel = typeof props.submitLabel === 'string' ? props.submitLabel.trim() : ''
  const resetLabel = typeof props.resetLabel === 'string' ? props.resetLabel.trim() : ''
  const submitStyle: React.CSSProperties = {
    // A real 44px box everywhere (R3): 10px padding plus one line measured
    // 41–43px, under the touch minimum on a phone.
    minHeight: '44px',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: 'var(--pw-color-primary)',
    color: 'var(--pw-color-text-on-primary)',
    border: 'none',
    borderRadius: 'var(--pw-button-radius, var(--pw-border-radius))',
    cursor: submitting ? 'wait' : 'pointer',
    opacity: submitting ? 0.65 : undefined,
    fontWeight: 500,
    fontFamily: 'inherit',
    fontSize: 'inherit',
  }
  const resetStyle: React.CSSProperties = {
    minHeight: '44px',
    boxSizing: 'border-box',
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: 'var(--pw-color-text-muted)',
    // `--pw-border` is not a defined appearance token, so the reset button
    // rendered with no visible outline. Use the explicit border-color token.
    border: '1px solid var(--pw-color-border)',
    borderRadius: 'var(--pw-button-radius, var(--pw-border-radius))',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  }

  // THE SECONDARY CONTROL ("Back" on a step, "Cancel"): beside submit, in the
  // secondary look, never a submit. With an address it is a link; else a
  // <button type=button> whose press emits block:click from
  // `<form id>-secondary`, carrying `secondaryAction` for the runtime to run
  // (a page may also wire a behavior on that id).
  const secondaryLabel = typeof props.secondaryLabel === 'string' ? props.secondaryLabel.trim() : ''
  const secondaryHref = (() => {
    const h = safeHref(typeof props.secondaryHref === 'string' && props.secondaryHref.trim() !== '' ? props.secondaryHref : undefined)
    return h === '#' ? undefined : h
  })()
  const secondaryAction = props.secondaryAction && typeof props.secondaryAction === 'object' && !Array.isArray(props.secondaryAction)
    ? (props.secondaryAction as FormProps['secondaryAction'])
    : undefined
  const secondaryId = `${block.id}-secondary`
  const secondaryStyle: React.CSSProperties = {
    minHeight: '44px',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: 'var(--pw-color-text)',
    border: '1px solid var(--pw-color-control-border, var(--pw-color-border))',
    borderRadius: 'var(--pw-button-radius, var(--pw-border-radius))',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    textDecoration: 'none',
  }
  const pressSecondary = (): void => {
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: secondaryId,
      ...(secondaryAction ? { payload: { action: secondaryAction } } : {}),
    })
  }
  const secondaryEl = secondaryLabel === '' ? null : secondaryHref ? (
    <a
      id={secondaryId}
      href={secondaryHref}
      style={secondaryStyle}
      onClick={(e) => {
        if (context?.interactionMode === 'inert') {
          e.preventDefault()
          emit({ type: SURFACE_EVENTS.BLOCK_CLICK, surfaceId, blockId: secondaryId, payload: { href: secondaryHref } })
        }
      }}
    >
      {secondaryLabel}
    </a>
  ) : (
    <button id={secondaryId} type="button" style={secondaryStyle} disabled={submitting} onClick={pressSecondary}>
      {secondaryLabel}
    </button>
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (submitting || inFlightRef.current) return
    // The form validates itself (`noValidate`). Since pwfabric 4.10 a wizard
    // step hidden by visibleWhen stays mounted with display:none so its values
    // are submitted — and the browser's own validation then refused a required
    // field there that it could not focus: no message, the submit did nothing.
    // A visible field gets its message under it, in the app's words
    // (fieldMessage); a hidden one is named in an alert next to the submit
    // button (`ui.form.hidden`).
    const form = e.currentTarget
    const { visible, hidden } = invalidFields(form)
    clearAllFieldErrors(form)
    if (visible.length > 0) {
      setMissing([])
      for (const field of visible) showFieldError(field, form, messages)
      visible[0]?.focus()
      return
    }
    if (hidden.length > 0) {
      setMissing(hidden.map((f) => messageOf(messages, 'ui.form.hidden', '', { label: fieldLabel(f), message: fieldMessage(f, messages) })))
      return
    }
    setMissing([])
    inFlightRef.current = true
    window.setTimeout(() => {
      if (!sawLoadingRef.current) inFlightRef.current = false
    }, 600)
    window.setTimeout(() => {
      inFlightRef.current = false
      sawLoadingRef.current = false
    }, 8000)
    // Collect the form's field values (by input `name`) so the platform/entities
    // bridge can persist them — it reads `descriptor.payload.values`. Without this
    // the bridge received `{}` and the entity write was empty (and failed required
    // fields), so submissions silently produced no record.
    // The payload is built from the form's elements, not from FormData — see
    // collectFormValues for what FormData lost.
    const values = collectFormValues(e.currentTarget)
    // Emit a structured form event via SurfaceEventBus.
    // payload matches SURFACE_EVENT_PAYLOAD_SCHEMAS['form:submit'] ({values, formId, timestamp}).
    emit({
      type: SURFACE_EVENTS.FORM_SUBMIT,
      surfaceId,
      blockId: block.id,
      payload: {
        values,
        formId: block.id,
        timestamp: Date.now(),
        // Declarative submit→state action (optional) — the renderer dispatches it.
        ...(props.onSubmitAction !== undefined ? { action: props.onSubmitAction } : {}),
      },
    })
  }

  return (
    <form
      ref={formRef}
      id={block.id}
      data-block-id={block.id}
      action={(props as unknown as FormProps).action || undefined}
      method={(props as unknown as FormProps).method}
      style={{ ...style, ...block.style }}
      onSubmit={handleSubmit}
      // A field's message goes as soon as the field is valid again.
      onInput={(e) => {
        const t = e.target as unknown as Field
        if ('validity' in t && t.validity.valid) clearFieldError(t, e.currentTarget)
      }}
      onChange={(e) => {
        const t = e.target as unknown as Field
        if ('validity' in t && t.validity.valid) clearFieldError(t, e.currentTarget)
      }}
      noValidate
      data-block-type="form"
      // The password fields inside read this: a form that registers asks for
      // a new password (form.input `autocomplete`).
      data-pw-auth={authIntent}
    >
      {children}
      {missing.length > 0 ? (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            border: '1px solid var(--pw-color-error)',
            borderRadius: 'var(--pw-border-radius)',
            color: 'var(--pw-color-error)',
            fontSize: 'var(--pw-font-size-sm)',
          }}
        >
          {missing.length === 1 ? (
            missing[0]
          ) : (
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {submitHidden ? (secondaryEl ? <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>{secondaryEl}</div> : null) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
        {secondaryEl}
        {submitLabel === '' ? (
          // No label written: the browser's own submit button, labelled in the
          // visitor's language ("Gönder", "Submit", "Senden").
          <input type="submit" disabled={submitting} aria-busy={submitting || undefined} style={submitStyle} />
        ) : (
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
          style={submitStyle}
        >
          {submitting && (
            <>
              <style>{'@keyframes pw-form-submit-spin{to{transform:rotate(360deg)}}'}</style>
              <span
                aria-hidden="true"
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '2px solid color-mix(in srgb, currentColor 35%, transparent)',
                  borderTopColor: 'currentColor',
                  animation: 'pw-form-submit-spin 0.8s linear infinite',
                }}
              />
            </>
          )}
          {submitLabel}
        </button>
        )}
        {(props as unknown as FormProps).showReset &&
          (resetLabel === '' ? (
            // Same as submit: unset → the browser's own, localised reset button.
            <input type="reset" style={resetStyle} />
          ) : (
            <button type="reset" style={resetStyle}>
              {resetLabel}
            </button>
          ))}
      </div>
      )}
    </form>
  )
}
