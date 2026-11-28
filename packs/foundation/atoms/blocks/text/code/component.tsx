import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { textOf, PRESS_CSS } from '../../../lib/_shared-utils.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'
import { useClipboardCopy } from '../../../lib/_shared-copy.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const CODE_LANGUAGES = [
  'plaintext',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'html',
  'css',
  'bash',
  'python',
  'go',
  'rust',
] as const
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

export interface CodeProps {
  readonly code: string
  /** Unset: no language label (the header shows the filename, or nothing). */
  readonly language?: CodeLanguage
  readonly showLineNumbers: boolean
  readonly highlightLines?: readonly number[]
  readonly filename?: string
  readonly copyButton: boolean
  /** Header copy button label. Unset: "Copy" (write it in the app language). */
  readonly copyLabel?: string
  /** Shown and announced after the code reached the clipboard. Unset: "Copied". */
  readonly copiedLabel?: string
  /**
   * The code surface. `default`: the theme's code tokens
   * (`--pw-color-code-surface`, `--pw-color-code-text`, `--pw-color-code-muted`,
   * `--pw-color-code-border`), else the muted card ground. `dark`: a dark
   * surface with light ink whatever the page theme is (a docs app that shows
   * code on dark).
   */
  readonly tone: 'default' | 'dark'
}

// ============================================================
// DEFINITION
// ============================================================

/**
 * The Copy button is a REAL 44x44px box on a phone or touch screen (R3 measures
 * the box; it was 38x16). Negative margins eat into the header's padding so
 * the header does not grow by the full difference.
 */
const CODE_COPY_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-code-copy] { display: inline-flex; align-items: center;' +
  ' justify-content: center; min-height: 44px; min-width: 44px; margin: -8px -8px -8px 0; padding: 0 8px; } }'

export const codeDefinition: BlockDefinition = {
  type: 'code',
  name: 'Code',
  category: 'text',
  icon: '⌨',
  defaultProps: {
    code: '',
    language: 'typescript',
    showLineNumbers: true,
    copyButton: true,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const CodeBlock: BlockComponent = ({ props, block }) => {
  const appWords = useAppMessages()
  const p = props as unknown as CodeProps
  const { status: copyStatus, copy } = useClipboardCopy()
  // THE CODE SURFACE IS ITS OWN TOKEN. Code drew on the muted card ground with
  // no way for a theme to give it the dark surface docs apps use. Every colour
  // reads a `--pw-color-code-*` token first; `tone: "dark"` sets them locally.
  const dark = p.tone === 'dark'
  const tokens: Record<string, string> = dark
    ? {
        '--pw-color-code-surface': '#0f172a',
        '--pw-color-code-header': '#1e293b',
        '--pw-color-code-text': '#e2e8f0',
        '--pw-color-code-muted': '#94a3b8',
        '--pw-color-code-border': '#334155',
      }
    : {}
  const SURFACE = 'var(--pw-color-code-surface, var(--pw-color-surface-muted, color-mix(in srgb, var(--pw-color-card) 94%, var(--pw-color-text))))'
  const HEADER = 'var(--pw-color-code-header, var(--pw-color-card, #ffffff))'
  const INK = 'var(--pw-color-code-text, var(--pw-color-text, #09090b))'
  const MUTED = 'var(--pw-color-code-muted, var(--pw-color-text-muted, #71717a))'
  const EDGE = 'var(--pw-color-code-border, var(--pw-color-border, #e4e4e7))'
  const containerStyle: React.CSSProperties = {
    ...(tokens as React.CSSProperties),
    backgroundColor: SURFACE,
    color: INK,
    borderRadius: 'var(--pw-border-radius-lg)',
    overflow: 'hidden',
    fontFamily: 'var(--pw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
    fontSize: 'var(--pw-font-size-sm)',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: HEADER,
    borderBottom: `1px solid ${EDGE}`,
  }

  const filenameStyle: React.CSSProperties = {
    color: MUTED,
    fontSize: 'var(--pw-font-size-xs)',
  }

  const preStyle: React.CSSProperties = {
    margin: 0,
    padding: '16px',
    overflow: 'auto',
    color: INK,
  }

  // No invented placeholder; a bound number/boolean arrives as text (the
  // runtime coerces it to the declared string).
  const code = textOf(p.code)
  // Unset or empty: the neutral word (no manifest default: the app writes its words).
  const copyLabel = textOf(p.copyLabel) || messageOf(appWords, 'ui.copy', '')
  const copiedLabel = textOf(p.copiedLabel) || messageOf(appWords, 'ui.copied', '')
  const lines = code.split('\n')
  const filename = p.filename === undefined ? undefined : textOf(p.filename)
  const language: string | undefined = p.language === undefined ? undefined : textOf(p.language)
  const showLineNumbers = p.showLineNumbers
  const copyButton = p.copyButton
  const highlightLines = Array.isArray(p.highlightLines) ? p.highlightLines : []

  const handleCopy = (): Promise<void> => copy(code)

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      // block.style belongs to the root; it used to reach only the header
      // and was dropped with it.
      style={{ ...containerStyle, ...block.style }}
      data-block-type="code"
      data-language={language}
      data-tone={dark ? 'dark' : undefined}
    >
      {copyButton ? <style>{PRESS_CSS + CODE_COPY_CSS}</style> : null}
      {(filename || (!filename && copyButton)) && (
        <div style={headerStyle}>
          <span style={filenameStyle}>{filename ?? language ?? ''}</span>
          {copyButton && (
            <button data-pw-press=""
              type="button"
              data-pw-code-copy=""
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: MUTED,
                cursor: 'pointer',
                fontSize: 'var(--pw-font-size-xs)',
              }}
              onClick={() => {
                void handleCopy()
              }}
            >
              {copyStatus === 'copied' ? copiedLabel : copyLabel}
            </button>
          )}
        </div>
      )}
      {/* The copy is announced, not silent. */}
      <span
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
      >
        {copyStatus === 'copied' ? copiedLabel : ''}
      </span>
      {/* A keyboard user can scroll a long line into view. */}
      <pre style={preStyle} tabIndex={0}>
        <code>
          {showLineNumbers
            ? lines.map((line: string, i: number) => {
                const lineNum = i + 1
                const isHighlighted = highlightLines.includes(lineNum)
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      backgroundColor: isHighlighted ? 'color-mix(in srgb, var(--pw-color-warning, #d97706) 10%, transparent)' : undefined,
                      marginLeft: isHighlighted ? '-16px' : undefined,
                      paddingLeft: isHighlighted ? '16px' : undefined,
                      marginRight: isHighlighted ? '-16px' : undefined,
                      borderLeft: isHighlighted ? '2px solid var(--pw-color-warning, #d97706)' : undefined,
                    }}
                  >
                    <span
                      data-line-number=""
                      aria-hidden="true"
                      style={{
                        userSelect: 'none',
                        color: MUTED,
                        width: '3em',
                        flexShrink: 0,
                        textAlign: 'right',
                        marginRight: '1em',
                      }}
                    >
                      {lineNum}
                    </span>
                    <span>{line}</span>
                  </div>
                )
              })
            : code}
        </code>
      </pre>
    </div>
  )
}
