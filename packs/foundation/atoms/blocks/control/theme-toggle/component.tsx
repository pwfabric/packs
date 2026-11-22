import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import { useAppMessage } from '@pwfabric/runtime'
import type { BlockComponent } from '../../../lib/component-types.js'
import { ICON_PATHS } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export type ColorScheme = 'light' | 'dark' | 'system'

export interface ThemeToggleProps {
  /** Offer "System" (follow the device) beside Light and Dark. Default true. */
  readonly showSystem: boolean
  /** Write each choice's word beside its icon. false: icons only, the words stay the accessible names. */
  readonly showLabels: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const themeToggleDefinition: BlockDefinition = {
  type: 'theme-toggle',
  name: 'Theme toggle',
  category: 'control',
  icon: '◐',
  defaultProps: { showSystem: true, showLabels: true },
  defaultLayout: { span: { xs: 4, sm: 4, md: 3, lg: 3 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/** `context.colorScheme` as one of the three; anything else (an older host: nothing) is `system`. */
export function schemeOf(value: unknown): ColorScheme {
  return value === 'light' || value === 'dark' ? value : 'system'
}

const MOON: readonly string[] = ['<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>']
const CIRCLE: readonly string[] = ['<circle cx="12" cy="12" r="10"/>']

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * The radios are the real controls (arrow keys move the choice, a screen
 * reader says "radio, 1 of 3"); each label is the visible segment. The focus
 * ring is drawn on the segment of the focused radio.
 */
const TOGGLE_CSS =
  '[data-pw-scheme-option]:has(> input:focus-visible) { outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color, var(--pw-color-primary, #18181b)); outline-offset: 1px; }' +
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-scheme-option] { min-height: 44px; min-width: 44px; } }'

/**
 * Light, dark or the device's choice, for the whole app. It READS the scheme
 * from `context.colorScheme` and WRITES it with `context.setColorScheme`; the
 * host stores it and applies it before the first paint of the next page. The
 * first frame and the hydrating render always say `system` (the build knows
 * no visitor), so this block's first render never depends on the stored
 * choice; the stored one arrives in the update right after.
 */
export const ThemeToggleBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as ThemeToggleProps
  const showSystem = p.showSystem !== false
  const showLabels = p.showLabels !== false
  const current = schemeOf(context?.colorScheme)
  const inert = context?.interactionMode === 'inert'
  const groupWord = useAppMessage('ui.colorScheme', 'Colour scheme')
  const lightWord = useAppMessage('ui.colorScheme.light', 'Light')
  const darkWord = useAppMessage('ui.colorScheme.dark', 'Dark')
  const systemWord = useAppMessage('ui.colorScheme.system', 'System')
  const options: { value: ColorScheme; label: string; icon: readonly string[] }[] = [
    { value: 'light', label: lightWord, icon: ICON_PATHS.sun ?? CIRCLE },
    { value: 'dark', label: darkWord, icon: MOON },
    ...(showSystem ? [{ value: 'system' as const, label: systemWord, icon: ICON_PATHS.monitor ?? CIRCLE }] : []),
  ]
  const choose = (scheme: ColorScheme): void => {
    // In the editor the page's scheme is the editor's: the toggle shows, it does not switch.
    if (inert) return
    context?.setColorScheme?.(scheme)
  }
  const name = `${block.id}-scheme`
  return (
    <fieldset
      id={block.id}
      data-block-id={block.id}
      data-block-type="theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        gap: '2px',
        margin: 0,
        padding: '2px',
        minWidth: 0,
        border: '1px solid var(--pw-color-border)',
        borderRadius: 'var(--pw-border-radius-full, 9999px)',
        backgroundColor: 'var(--pw-color-card)',
        color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
        ...block.style,
      }}
    >
      <style>{TOGGLE_CSS}</style>
      <legend style={VISUALLY_HIDDEN}>{groupWord}</legend>
      {options.map((o) => {
        const checked = current === o.value
        return (
          <label
            key={o.value}
            data-pw-scheme-option=""
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: showLabels ? '6px 12px' : '6px 8px',
              borderRadius: 'var(--pw-border-radius-full, 9999px)',
              backgroundColor: checked ? 'var(--pw-color-primary)' : 'transparent',
              color: checked ? 'var(--pw-color-text-on-primary)' : 'inherit',
              fontSize: 'var(--pw-font-size-sm)',
              fontWeight: 500,
              cursor: inert ? 'default' : 'pointer',
            }}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => choose(o.value)}
              style={VISUALLY_HIDDEN}
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
              focusable="false"
              dangerouslySetInnerHTML={{ __html: o.icon.join('') }}
            />
            <span style={showLabels ? undefined : VISUALLY_HIDDEN}>{o.label}</span>
          </label>
        )
      })}
    </fieldset>
  )
}

// This block's width is its content: in a flex row it must not take an equal share.
Object.assign(ThemeToggleBlock, { sizing: 'intrinsic' })
