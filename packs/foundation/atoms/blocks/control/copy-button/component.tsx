import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, safeRenderValue, ICON_PATHS } from '../../../lib/_shared-utils.js'

/** On a phone or touch screen the button is a REAL 44px box (R3 measures the box). */
const COPY_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-touch] { min-height: 44px; min-width: 44px; } }'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface CopyButtonProps {
  readonly value: string
  readonly label: string
  /** Shown (and announced) after the value reached the clipboard. */
  readonly copiedLabel: string
  /** Shown (and announced) when the browser refused the write. */
  readonly failedLabel: string
  readonly size: 'sm' | 'md' | 'lg'
}

// ============================================================
// DEFINITION
// ============================================================

export const copyButtonDefinition: BlockDefinition = {
  type: 'copy-button',
  name: 'Copy Button',
  category: 'control',
  icon: '⧉',
  defaultProps: {
    value: '',
    label: 'Copy',
    size: 'md',
  },
  defaultLayout: { span: { xs: 2, sm: 2, md: 2, lg: 2 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

// Inline copy glyph — ICON_PATHS has no `copy` key, so the two-rectangle
// glyph is provided literally here (trusted static markup).
const COPY_ICON = ['<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>', '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>']

const SIZE_PADDING: Record<string, string> = {
  sm: '4px 8px',
  md: '6px 12px',
  lg: '8px 16px',
}

export const CopyButtonBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  // idle → copied | failed. "Copied" is only ever said after the write
  // resolved (it used to be shown for an empty value and for a refused write
  // alike).
  const [status, setStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle')
  const copied = status === 'copied'
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const p = props as unknown as CopyButtonProps
  const value = p.value
  const label = p.label
  const size = p.size
  // An empty word set on purpose still announces something.
  const copiedLabel = p.copiedLabel || 'Copied'
  const failedLabel = p.failedLabel || 'Copy failed'

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const settle = (next: 'copied' | 'failed'): void => {
    setStatus(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus('idle'), 1500)
  }

  const handleClick = async (): Promise<void> => {
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { action: 'copy' },
    })
    // Nothing to copy → nothing to confirm.
    if (!value) return
    // Real clipboard write is a side-effect — skip in inert (editor/preview).
    if (context.interactionMode === 'inert') {
      settle('copied')
      return
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(value)
      settle('copied')
    } catch {
      settle('failed')
    }
  }

  const iconPaths = copied ? (ICON_PATHS.check ?? []) : COPY_ICON

  return (
    <>
    <style>{HIT_AREA_CSS + COPY_TOUCH_CSS}</style>
    <button
      id={block.id}
      data-block-id={block.id}
      data-block-type="copy-button"
      data-pw-hit=""
      data-pw-touch=""
      type="button"
      onClick={() => {
        void handleClick()
      }}
      aria-label={label || 'Copy'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: SIZE_PADDING[size] ?? SIZE_PADDING.md,
        justifyContent: 'center',
        fontSize: 'var(--pw-font-size-sm, 14px)',
        fontWeight: 500,
        // the button paints its own CARD background → text uses the on-card chain
        color: copied ? 'var(--pw-color-success, #16a34a)' : status === 'failed' ? 'var(--pw-color-error, #dc2626)' : 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
        backgroundColor: 'var(--pw-color-card, #ffffff)',
        border: '1px solid var(--pw-color-border, #e4e4e7)',
        borderRadius: 'var(--pw-button-radius, var(--pw-border-radius, 8px))',
        cursor: 'pointer',
        lineHeight: 1.2,
        transition: 'color var(--pw-duration-fast, 150ms)',
        // The announced outcome is an absolutely positioned helper: it stays
        // inside the button, not against some far ancestor.
        position: 'relative',
        ...block.style,
      }}
    >
      <svg
        width={15}
        height={15}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: iconPaths.join('') }}
      />
      <span>{safeRenderValue(copied ? copiedLabel : status === 'failed' ? failedLabel : label)}</span>
      {/* The outcome is announced, not only painted. */}
      <span
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
      >
        {copied ? copiedLabel : status === 'failed' ? failedLabel : ''}
      </span>
    </button>
    </>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(CopyButtonBlock, { sizing: 'intrinsic' })
