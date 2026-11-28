import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { controlLabelStyle, PRESS_CSS } from '../../../lib/_kit.js'

// Props — declared in manifest.json, applied by the runtime.
export interface RichTextEditorProps {
  readonly name?: string
  readonly label?: string
  readonly placeholder?: string
  readonly value: string
}

export const RichTextEditorDefinition: BlockDefinition = {
  type: 'rich-text-editor',
  name: 'RichTextEditor',
  category: 'form',
  icon: 'edit',
  defaultProps: { value: '' },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

/** At phone width or on a coarse pointer each toolbar button is a REAL 44×44 box (R3); desktop keeps 28px. */
const RTE_TOUCH_CSS =
  '@media (max-width: 640px), (pointer: coarse) { [data-pw-rte-tool] { width: 44px !important; height: 44px !important; } }'

// ============================================================
// SANITIZER
// ============================================================

/** Tags the editor can produce (bold, italic, lists, paragraphs, links) plus plain structure. */
const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'div', 'span',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'h4',
])
/** Tags whose CONTENT is dropped with them, not kept as text. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'textarea', 'select', 'frame', 'frameset',
])
const VOID = new Set(['br'])

const escapeText = (t: string): string => t.replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Every `&` is escaped — no entity is passed through for the browser to decode later. */
const escapeAttr = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A link target the editor keeps: http:, https:, mailto: or a relative path —
 * nothing else.
 *
 * The browser decodes entities in an attribute and then drops tabs and
 * newlines from a URL, so `java&Tab;script:` or `jav&#x09;ascript:` reaches the
 * address bar as `javascript:`. Numeric entities are decoded here; any NAMED
 * entity left over (`&Tab;`, `&NewLine;`, `&colon;`…) refuses the link rather
 * than trying to track the HTML entity table. Control characters and spaces
 * are stripped before the scheme is read, as the URL parser would.
 */
function hrefOf(attrs: string): string | undefined {
  const m = attrs.match(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i)
  if (!m) return undefined
  const raw = m[1] ?? m[2] ?? m[3] ?? ''
  const decoded = raw
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16) || 0xfffd))
    .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Number(d) || 0xfffd))
  // Entity-shaped leftovers refuse the link. Belt and braces: the output
  // escapes every `&`, so the browser sees exactly the string checked here.
  // An `&` followed by a letter (with or without `;`) in the part that can
  // still spell a scheme — everything before the first / ? # — refuses the
  // link. A query string's `&b=2` stays allowed.
  const schemePart = decoded.split(/[/?#]/)[0] ?? ''
  if (/&[a-z]/i.test(schemePart) || /&[a-z][a-z0-9]*;/i.test(decoded)) return undefined
  const url = decoded.replace(/[\x00-\x20\x7f-\x9f]/g, '')
  if (url === '') return undefined
  if (/^(\/|#|\?|\.\/|\.\.\/)/.test(url)) return url.startsWith('//') ? undefined : url
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i)
  if (scheme) return ['http', 'https', 'mailto'].includes(scheme[1]!.toLowerCase()) ? url : undefined
  // No scheme: a relative path only if no ':' comes before the first / ? #.
  const head = url.split(/[/?#]/)[0] ?? ''
  return head.includes(':') ? undefined : url
}

/**
 * Allow-list sanitizer for the editor's HTML.
 *
 * `value` may be bound from a stored record (an edit form), so it is untrusted:
 * rendered unsanitized it is stored XSS. Only the tags above survive; every
 * attribute is dropped except a safe `href` on `<a>` (no `on…`, no `style`, no
 * `javascript:`/`data:` URL). A regex tokenizer rather than DOMParser so the
 * server render and the browser produce the same string (no hydration drift);
 * any `<`/`>` left in text is escaped, so a malformed tag can only become text.
 */
export function sanitizeRichText(html: unknown): string {
  if (typeof html !== 'string' || html === '') return ''
  const src = html.replace(/<!--[\s\S]*?-->/g, '')
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
  let out = ''
  let last = 0
  let dropping: string | null = null
  let depth = 0
  for (let m = tagRe.exec(src); m; m = tagRe.exec(src)) {
    const text = src.slice(last, m.index)
    last = tagRe.lastIndex
    const tag = m[1]!.toLowerCase()
    const closing = m[0].startsWith('</')
    if (dropping) {
      if (tag === dropping) depth += closing ? -1 : m[0].endsWith('/>') ? 0 : 1
      if (depth === 0) dropping = null
      continue
    }
    out += escapeText(text)
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !m[0].endsWith('/>')) {
        dropping = tag
        depth = 1
      }
      continue
    }
    if (!ALLOWED_TAGS.has(tag)) continue
    if (closing) {
      if (!VOID.has(tag)) out += `</${tag}>`
      continue
    }
    if (tag === 'a') {
      const href = hrefOf(m[2] ?? '')
      out += href ? `<a href="${escapeAttr(href)}">` : '<a>'
    } else {
      out += `<${tag}>`
    }
  }
  if (!dropping) out += escapeText(src.slice(last))
  return out
}

// ============================================================
// COMPONENT
// ============================================================

const TOOLBAR: { command: string; label: string; aria: string; italic?: boolean }[] = [
  { command: 'bold', label: 'B', aria: 'Bold' },
  { command: 'italic', label: 'I', aria: 'Italic', italic: true },
  { command: 'insertUnorderedList', label: '•', aria: 'Bulleted list' },
]

export const RichTextEditorBlock: BlockComponent = ({ props, context, block }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const name = typeof props.name === 'string' && props.name ? props.name : undefined
  const label = typeof props.label === 'string' ? props.label : ''
  const placeholder = typeof props.placeholder === 'string' ? props.placeholder : ''
  const p = props as unknown as RichTextEditorProps
  const initial = React.useMemo(() => sanitizeRichText(p.value), [p.value])

  const editorRef = React.useRef<HTMLDivElement>(null)
  const interactive = context?.interactionMode !== 'inert'
  const [html, setHtml] = React.useState(initial)
  const [empty, setEmpty] = React.useState(!initial)
  const [pressed, setPressed] = React.useState<Record<string, boolean>>({})
  // A bound value arriving after the first render replaces the content.
  const lastInitial = React.useRef(initial)
  if (lastInitial.current !== initial) {
    lastInitial.current = initial
    setHtml(initial)
    setEmpty(!initial)
  }
  const labelId = `${block.id}-label`

  const refreshPressed = (): void => {
    if (typeof document.queryCommandState !== 'function') return
    const next: Record<string, boolean> = {}
    for (const t of TOOLBAR) {
      try {
        next[t.command] = document.queryCommandState(t.command)
      } catch {
        next[t.command] = false
      }
    }
    setPressed(next)
  }

  const publish = (): void => {
    const el = editorRef.current
    const next = sanitizeRichText(el?.innerHTML ?? '')
    setEmpty(!(el?.textContent ?? '').trim())
    setHtml(next)
    // Through the surface bus, as every form control does — the old
    // `context.onEvent({type:'change'})` never reached a stateKey or behavior.
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: { value: next, inputId: block.id, name },
    })
  }

  const applyCommand = (command: string): void => {
    if (!interactive) return
    editorRef.current?.focus()
    if (typeof document.execCommand === 'function') document.execCommand(command)
    refreshPressed()
    publish()
  }

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="rich-text-editor"
      className="pw-rich-text-editor"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pw-space-xs, 4px)', ...block.style }}
    >
      {label && (
        <span
          id={labelId}
          // The one label of every form control.
          style={controlLabelStyle('var(--pw-space-xs, 4px)')}
        >
          {label}
        </span>
      )}
      {/* A contentEditable is not a form control, so
          FormData never saw the text although the manifest promised a FormData
          key. This input carries the sanitized HTML. */}
      {name ? <input type="hidden" name={name} value={html} /> : null}
      <style>{PRESS_CSS + RTE_TOUCH_CSS}</style>
      <div
        role="toolbar"
        aria-label={label ? `${label} formatting` : 'Formatting'}
        style={{
          display: 'flex',
          gap: 2,
          padding: 4,
          border: '1px solid var(--pw-color-border, #e4e4e7)',
          borderBottom: 'none',
          borderRadius: 'var(--pw-border-radius, 6px) var(--pw-border-radius, 6px) 0 0',
          background: 'var(--pw-color-card, #fafafa)',
        }}
      >
        {TOOLBAR.map((tool) => (
          <button data-pw-press=""
            key={tool.command}
            type="button"
            aria-label={tool.aria}
            aria-pressed={pressed[tool.command] === true}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyCommand(tool.command)}
            disabled={!interactive}
            data-pw-rte-tool=""
            style={{
              width: 28,
              height: 28,
              border: '1px solid transparent',
              borderRadius: 'var(--pw-border-radius-sm, 4px)',
              background: pressed[tool.command]
                ? 'color-mix(in srgb, var(--pw-color-primary, #18181b) 14%, transparent)'
                : 'transparent',
              // Not the UA button black; the ON-CARD chain (colour rule 1):
              // the toolbar paints a surface background — in a theme with a
              // dark ambient and a light surface, plain text would be light on
              // light (a 1.12 contrast ratio).
              color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
              fontWeight: 700,
              fontStyle: tool.italic ? 'italic' : 'normal',
              fontFamily: 'inherit',
              cursor: interactive ? 'pointer' : 'default',
            }}
          >
            <span aria-hidden="true">{tool.label}</span>
          </button>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        {empty && placeholder && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              color: 'var(--pw-color-text-muted, #71717a)',
              fontSize: 'var(--pw-font-size-sm, 14px)',
              pointerEvents: 'none',
            }}
          >
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          {...(label ? { 'aria-labelledby': labelId } : {})}
          {...(placeholder ? { 'aria-placeholder': placeholder } : {})}
          tabIndex={interactive ? 0 : -1}
          contentEditable={interactive}
          suppressContentEditableWarning
          onInput={publish}
          // Pasted HTML never enters the live editor (an `<img onerror>` pasted
          // into a contentEditable can run before anything sanitizes it): paste
          // arrives as plain text.
          onPaste={(e) => {
            const text = e.clipboardData?.getData('text/plain')
            if (typeof text !== 'string') return
            e.preventDefault()
            if (typeof document.execCommand === 'function') document.execCommand('insertText', false, text)
            publish()
          }}
          onKeyUp={refreshPressed}
          onMouseUp={refreshPressed}
          dangerouslySetInnerHTML={{ __html: initial }}
          style={{
            minHeight: 120,
            padding: '10px 12px',
            border: '1px solid var(--pw-color-border, #e4e4e7)',
            borderRadius: '0 0 var(--pw-border-radius, 6px) var(--pw-border-radius, 6px)',
            fontSize: 'var(--pw-font-size-sm, 14px)',
            lineHeight: 1.6,
            background: 'var(--pw-color-card, #ffffff)',
            color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
          }}
        />
      </div>
    </div>
  )
}
