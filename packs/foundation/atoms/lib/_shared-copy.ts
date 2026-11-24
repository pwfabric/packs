/**
 * The copy behaviour the documentation blocks share (text.code, text.prose):
 * write a text to the clipboard, say "copied" only once the write resolved,
 * and go back to idle after a moment. A refused or missing clipboard is
 * `failed`, never "copied". `key` says which of a block's copy controls the
 * status is for (a prose block has one per code block).
 */
import * as React from 'react'

export type CopyStatus = 'idle' | 'copied' | 'failed'

/** How long "copied" stays before the control reads its copy word again. */
export const COPIED_FOR_MS = 1500

export function useClipboardCopy(): {
  readonly status: CopyStatus
  readonly key: string | null
  readonly copy: (text: string, key?: string) => Promise<void>
} {
  const [state, setState] = React.useState<{ status: CopyStatus; key: string | null }>({ status: 'idle', key: null })
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )
  const copy = React.useCallback(async (text: string, key?: string): Promise<void> => {
    if (!text) return
    let next: CopyStatus = 'copied'
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
    } catch {
      next = 'failed'
    }
    setState({ status: next, key: key ?? null })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setState({ status: 'idle', key: null }), COPIED_FOR_MS)
  }, [])
  return { status: state.status, key: state.key, copy }
}
