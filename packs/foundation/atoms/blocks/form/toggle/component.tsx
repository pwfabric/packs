import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue } from '../../../lib/_shared-utils.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface ToggleProps {
  readonly name?: string
  readonly label?: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly size: 'sm' | 'md' | 'lg'
  /** State key the checked state (a boolean) is written to on change. */
  readonly stateKey?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const toggleDefinition: BlockDefinition = {
  type: 'toggle',
  name: 'Toggle',
  category: 'form',
  icon: '⊙',
  defaultProps: {
    checked: false,
    disabled: false,
    size: 'md',
  },
  defaultLayout: { span: { xs: 2, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * At phone width or on a coarse pointer (WCAG 2.5.8 / R3) the row is at least
 * 44px tall AND the switch itself is a real 44×44 box around its drawn track.
 * `!important`: the row's own inline minHeight (the track height) used to win
 * over this rule, so the row measured 39px on a phone.
 */
const ROW_HIT_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-row-hit] { min-height: 44px !important; }' +
  ' [data-pw-switch-touch] { min-height: 44px; min-width: 44px; } }'

export const ToggleBlock: BlockComponent = ({ props, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as ToggleProps
  const propChecked = p.checked
  const [checked, setChecked] = React.useState(propChecked)
  // A bound `checked` (`{{record.twoFactor}}`) arrives resolved after the first
  // render: a changed prop wins over the last click.
  const lastProp = React.useRef(propChecked)
  if (lastProp.current !== propChecked) {
    lastProp.current = propChecked
    setChecked(propChecked)
  }
  const label = typeof props.label === 'string' ? props.label : ''
  const disabled = p.disabled
  const size = p.size
  const name = typeof props.name === 'string' && props.name ? props.name : undefined
  const stateKey = typeof props.stateKey === 'string' && props.stateKey ? props.stateKey : undefined

  const flip = (): void => {
    if (disabled) return
    const next = !checked
    setChecked(next)
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: {
        value: next,
        inputId: block.id,
        checked: next,
        name,
        ...(stateKey ? { action: { type: 'setState', key: stateKey, value: next } } : {}),
      },
    })
  }

  const sizeMap: Record<string, { width: number; height: number; knob: number }> = {
    sm: { width: 32, height: 18, knob: 14 },
    md: { width: 44, height: 24, knob: 20 },
    lg: { width: 56, height: 30, knob: 26 },
  }
  const dims = sizeMap[size] ?? { width: 44, height: 24, knob: 20 }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    // minHeight, not height: a long label that wraps grows the row
    // instead of spilling over the content below it on a phone.
    minHeight: `${dims.height}px`,
  }

  // The button is the control's BOX (44×44 on a phone); the track is drawn
  // inside it, so the visible switch keeps its size while the target grows.
  const switchStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    // The drawn track keeps the row's left edge (it lines up with a checkbox
    // above); the 44px box grows to the right, into the gap.
    justifyContent: 'flex-start',
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    borderRadius: `${dims.height}px`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    flexShrink: 0,
  }

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: `${dims.width}px`,
    height: `${dims.height}px`,
    borderRadius: `${dims.height}px`,
    backgroundColor: checked ? 'var(--pw-color-primary)' : 'var(--pw-color-border)',
    transition: 'background-color var(--pw-duration-fast)',
    flexShrink: 0,
  }

  const knobStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${(dims.height - dims.knob) / 2}px`,
    left: checked
      ? `${dims.width - dims.knob - (dims.height - dims.knob) / 2}px`
      : `${(dims.height - dims.knob) / 2}px`,
    width: `${dims.knob}px`,
    height: `${dims.knob}px`,
    borderRadius: '50%',
    backgroundColor: 'var(--pw-color-card)',
    transition: 'left var(--pw-duration-fast)',
    boxShadow: 'var(--pw-shadow-sm, 0 1px 2px 0 rgba(0,0,0,.05))',
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="toggle"
      style={{
        // Size to content (track + gap + label) rather than clamping the whole
        // row to the track width — clamping forced the label to wrap into a
        // thin column beside the switch. `max-content` keeps the row intrinsic
        // so the label sits on one line next to the control.
        display: 'inline-flex',
        // fit-content, not max-content: a max-content row pushed its whole
        // one-line label into the PARENT's minimum width, so a long label
        // ("Post the weekly digest to …") widened the settings card to 508px
        // in a 390px phone. fit-content still sits on one line when there is
        // room and wraps when there is not.
        width: 'fit-content',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        opacity: disabled ? 0.5 : undefined,
        cursor: disabled ? 'not-allowed' : undefined,
      ...block.style }}
    >
      {/* A 44px row on a phone or a touch screen: the whole label is the target. */}
      <style>{ROW_HIT_CSS}</style>
      <label style={containerStyle} data-pw-row-hit="">
        {/* A checkbox submits "on" or nothing, so an
            unset switch was absent and a required boolean always failed. The
            hidden input carries "true"/"false", typed for form.form. */}
        {name ? <input type="hidden" name={name} value={checked ? 'true' : 'false'} data-pw-value-type="boolean" /> : null}
        {/* The track IS the control: a real button with the switch role, so it
            takes keyboard focus and the runtime's focus ring shows on it (the
            old 0×0 checkbox took focus invisibly). */}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={flip}
          style={switchStyle}
          data-pw-switch-touch=""
        >
          <span style={trackStyle} aria-hidden="true" data-pw-switch-track="">
            <span style={knobStyle} />
          </span>
        </button>
        <span
          style={{
            fontSize: 'var(--pw-font-size-sm)',
            color: 'var(--pw-color-text)',
            userSelect: 'none',
            // Short labels sit on one line beside the switch (the row is
            // width:max-content); long labels wrap within maxWidth:100% instead
            // of overflowing the surface on narrow screens.
            overflowWrap: 'anywhere',
            lineHeight: 1.3,
            minWidth: 0,
          }}
        >
          {safeRenderValue(label)}
        </span>
      </label>
    </div>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(ToggleBlock, { sizing: 'intrinsic' })
