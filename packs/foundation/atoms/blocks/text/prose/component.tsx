import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, textOf } from '../../../lib/_shared-utils.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface ProseProps {
  /**
   * Long-form body content. Accepts either a Markdown string (preferred — h2/##,
   * lists, **bold**, links) OR a raw HTML fragment. Bindable so the content can
   * be driven from a data source (CMS article body, etc.).
   */
  readonly content: string
  /**
   * Constrain the reading column for comfortable line length (~65ch is ideal).
   * Numbers → px; strings (e.g. '65ch', '720px') pass through.
   */
  readonly maxWidth?: number | string
}

// ============================================================
// DEFINITION
// ============================================================

export const proseDefinition: BlockDefinition = {
  type: 'prose',
  name: 'Prose',
  category: 'text',
  icon: '¶',
  defaultProps: {
    content: '',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 8 } },
  canHaveChildren: false,
}

// ============================================================
// SANITIZER (conservative allowlist — no external deps)
// ============================================================

// Block-level + inline tags we allow in rendered prose. Everything else is
// stripped. We never allow <script>, <style>, <iframe>, <object>, <embed>,
// event-handler attributes, or javascript:/data: URLs.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'strong', 'em', 'b', 'i', 'u', 's', 'del', 'mark', 'small', 'sub', 'sup',
  'a', 'span',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption',
])

// Per-tag attribute allowlist. href/src are sanitized for protocol separately.
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
}

/**
 * Decode the character references a browser would decode inside an attribute
 * before it reads the scheme: `jav&#x61;script:` and `javascript&colon;` are
 * `javascript:` to the browser, so they must be to this check too.
 */
function decodeRefs(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16) || 0))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCodePoint(Number(d) || 0))
    .replace(/&colon;/gi, ':')
    .replace(/&(tab|newline);/gi, '')
    .replace(/&amp;/gi, '&')
}

/** Escape a value for a double-quoted HTML attribute. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The URL a link or image may carry: http(s), mailto, tel, an anchor, a query
 * or a relative path. Every other scheme (javascript:, data:, vbscript:,
 * file:…) is refused — including one hidden behind character references or
 * control characters, which browsers strip before reading the scheme.
 */
export function safeUrl(value: string): string | null {
  // eslint-disable-next-line no-control-regex
  const v = decodeRefs(value).replace(/[\u0000-\u001F\u007F]/g, '').trim()
  // A named reference this decoder does not know could still hide a scheme
  // character — refuse rather than guess.
  if (/&[a-z][a-z0-9]*;/i.test(v)) return null
  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/|\?)/i.test(v)) return v
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return v // schemeless (relative path)
  return null
}

/** Elements whose content is raw text: everything up to their end tag goes with them. */
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext'])

/** Elements with no content and no end tag. */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

/** One attribute of a start tag: a name, then optionally `=` and a quoted or bare value. */
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

/** A start tag, an end tag, a comment or a declaration at the head of the input. */
const TAG = /^<(?:!--[\s\S]*?(?:-->|$)|![^>]*>?|\?[^>]*>?|\/\s*([a-zA-Z][a-zA-Z0-9-]*)[^>]*>?|([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>)/

/**
 * An attribute value as the browser reads it: the references HTML itself
 * writes for markup characters (`&quot;` from an escaped value) decoded, then
 * the scheme-hiding ones `decodeRefs` knows. `&amp;` last, so `&amp;quot;`
 * stays the text `&quot;`.
 */
function decodeAttr(value: string): string {
  return decodeRefs(value.replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'))
}

/** The attributes of a start tag's attribute text, in order. */
function parseAttrs(text: string): [string, string][] {
  const out: [string, string][] = []
  ATTR.lastIndex = 0
  for (let m = ATTR.exec(text); m; m = ATTR.exec(text)) {
    out.push([(m[1] ?? '').toLowerCase(), m[2] ?? m[3] ?? m[4] ?? ''])
  }
  return out
}

/**
 * THE ONE SANITIZER — the same string walk on the server and in the browser.
 *
 * It used to parse with `DOMParser` where a DOM existed and fall back to a
 * regex strip on the server: two readings of one input, so a page painted at
 * build time did not match what the browser drew on hydration. This walk is
 * pure and is what both run, with the allowlist the DOM path had:
 *
 * - a tag outside ALLOWED_TAGS goes with everything inside it (a raw-text
 *   element — script, style, textarea… — up to its end tag); comments and
 *   declarations go;
 * - an allowed tag keeps only the attributes ALLOWED_ATTRS names for it
 *   (never an `on*` handler), each re-quoted and escaped; href/src keep only
 *   a URL `safeUrl` accepts; a link opening a new tab gets `rel="noopener noreferrer"`;
 * - end tags close what is open (stray ones are dropped), and whatever is still
 *   open at the end is closed;
 * - text passes through, with a `<` that opens no tag escaped;
 * - a link's href, once safe, is written by `appHref` when one is given: the
 *   block's `context.appHref`, so `[Webhooks](/webhooks)` is the router's
 *   `#/webhooks` and works opened in a new tab. Absolute URLs, fragments and
 *   media links come back from it as given.
 */
export function sanitizeHtml(html: string, appHref?: (path: string) => string): string {
  const out: string[] = []
  const open: string[] = []
  let rest = html
  while (rest.length > 0) {
    const lt = rest.indexOf('<')
    if (lt < 0) {
      out.push(rest)
      break
    }
    if (lt > 0) out.push(rest.slice(0, lt))
    rest = rest.slice(lt)
    const m = TAG.exec(rest)
    if (!m) {
      out.push('&lt;')
      rest = rest.slice(1)
      continue
    }
    rest = rest.slice(m[0].length)
    const endName = m[1]?.toLowerCase()
    const startName = m[2]?.toLowerCase()
    if (endName) {
      const at = open.lastIndexOf(endName)
      if (at >= 0) {
        while (open.length > at) out.push(`</${open.pop()}>`)
      }
      continue
    }
    if (!startName) continue // a comment or a declaration
    const attrText = m[3] ?? ''
    const selfClosing = /\/\s*$/.test(attrText)
    if (!ALLOWED_TAGS.has(startName)) {
      if (VOID.has(startName) || selfClosing) continue
      // Drop the element and its content: up to its end tag, counting nested
      // elements of the same name (raw-text content holds no elements).
      const lower = rest.toLowerCase()
      const close = new RegExp(String.raw`<\/\s*${startName}\b[^>]*>?`, 'g')
      if (RAW_TEXT.has(startName)) {
        const c = close.exec(lower)
        rest = c ? rest.slice(c.index + c[0].length) : ''
        continue
      }
      const any = new RegExp(String.raw`<(\/?)\s*${startName}\b((?:[^>"']|"[^"]*"|'[^']*')*)>?`, 'g')
      let depth = 1
      let end = rest.length
      for (let t = any.exec(lower); t; t = any.exec(lower)) {
        if (t[1]) depth--
        else if (!/\/\s*>?$/.test(t[0])) depth++
        if (depth === 0) {
          end = t.index + t[0].length
          break
        }
      }
      rest = rest.slice(end)
      continue
    }
    const allowed = ALLOWED_ATTRS[startName] ?? new Set<string>()
    const kept: string[] = []
    let blank = false
    for (const [name, value] of parseAttrs(attrText.replace(/\/\s*$/, ''))) {
      if (name.startsWith('on') || !allowed.has(name) || kept.some((k) => k.startsWith(`${name}=`))) continue
      let v: string | null = decodeAttr(value)
      if (name === 'href' || name === 'src') v = safeUrl(v)
      if (v == null) continue
      if (name === 'href' && startName === 'a' && appHref) v = appHref(v)
      if (name === 'target' && v === '_blank') blank = true
      if (name === 'rel' && startName === 'a') continue
      kept.push(`${name}="${escapeAttr(v)}"`)
    }
    if (startName === 'a' && blank) kept.push('rel="noopener noreferrer"')
    else if (startName === 'a') {
      const rel = parseAttrs(attrText).find(([n]) => n === 'rel')
      if (rel) kept.push(`rel="${escapeAttr(decodeAttr(rel[1]))}"`)
    }
    out.push(`<${startName}${kept.length ? ' ' + kept.join(' ') : ''}>`)
    if (!VOID.has(startName) && !selfClosing) open.push(startName)
  }
  while (open.length > 0) out.push(`</${open.pop()}>`)
  return out.join('')
}

/**
 * The server-side strip's old name. There is one sanitizer now
 * ({@link sanitizeHtml}); the name stays for callers that import it.
 */
export const regexStrip = sanitizeHtml

// ============================================================
// MINIMAL MARKDOWN → HTML
// ============================================================

// Heuristic: if the content has no angle-bracket tags but has markdown markers,
// treat it as Markdown. A string with HTML tags is treated as HTML.
function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** A character Markdown text never holds: the placeholder marker. */
const PARK = String.fromCharCode(0)
const PARKED = new RegExp(PARK + '([0-9]+)' + PARK, 'g')

function inlineMd(s: string): string {
  // Code spans, image tags and link openers are PARKED behind placeholders
  // before emphasis runs, then put back. Converting a code span first was not
  // enough: its HTML stayed in the string, so `` `order_id_x` `` came out as
  // `order<em>id</em>x` inside the <code>, and a `_` in a link URL did the same
  // to the href. The text arrives already HTML-escaped (every caller escapes
  // first), so a code span is not escaped twice ("a<b" printed "a&lt;b").
  const parked: string[] = []
  const park = (html: string): string => `${PARK}${parked.push(html) - 1}${PARK}`
  const out = s
    .replace(/`([^`]+)`/g, (_m, c: string) => park(`<code>${c}</code>`))
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => {
      const u = safeUrl(url)
      return u ? park(`<img src="${escapeAttr(u)}" alt="${escapeAttr(alt)}" />`) : escapeHtml(alt)
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
      // Quoted and escaped: a `"` in the URL closed the attribute and the rest
      // became attributes of the link.
      const u = safeUrl(url)
      return u ? `${park(`<a href="${escapeAttr(u)}">`)}${text}</a>` : text
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    // `_` emphasis only at word edges: snake_case words stay as written.
    .replace(/(^|[^\p{L}\p{N}_])_([^_]+)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>')

  return out.replace(PARKED, (_m, n: string) => parked[Number(n)] ?? '')
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  let listType: 'ul' | 'ol' | null = null
  const closeList = (): void => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }
  // The scanner walks by index, and `lines[i]` is `string | undefined` to the
  // type system even under an `i < lines.length` test. Each read is taken once
  // into a local that carries the narrowing, so the loop conditions and the
  // bodies agree on the same value instead of re-indexing.
  for (;;) {
    const line = lines[i]
    if (line === undefined) break
    const trimmed = line.trim()
    // Fenced code block
    if (/^```/.test(trimmed)) {
      closeList()
      const buf: string[] = []
      i++
      for (;;) {
        const fenced = lines[i]
        if (fenced === undefined || /^```/.test(fenced.trim())) break
        buf.push(escapeHtml(fenced))
        i++
      }
      i++ // consume closing fence
      out.push(`<pre><code>${buf.join('\n')}</code></pre>`)
      continue
    }
    // Blank line
    if (trimmed === '') {
      closeList()
      i++
      continue
    }
    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (h) {
      closeList()
      // Both groups are mandatory in the pattern, so a match always carries
      // them — the fallbacks exist only because an indexed match read is typed
      // `string | undefined`, and they cannot be reached.
      const hashes = h[1] ?? '#'
      const level = hashes.length
      out.push(`<h${level}>${inlineMd(escapeHtml(h[2] ?? ''))}</h${level}>`)
      i++
      continue
    }
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList()
      out.push('<hr />')
      i++
      continue
    }
    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      closeList()
      const buf: string[] = []
      for (;;) {
        const quoted = lines[i]
        if (quoted === undefined) break
        const quotedTrimmed = quoted.trim()
        if (!/^>\s?/.test(quotedTrimmed)) break
        buf.push(inlineMd(escapeHtml(quotedTrimmed.replace(/^>\s?/, ''))))
        i++
      }
      out.push(`<blockquote>${buf.join('<br />')}</blockquote>`)
      continue
    }
    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      if (listType !== 'ul') {
        closeList()
        out.push('<ul>')
        listType = 'ul'
      }
      out.push(`<li>${inlineMd(escapeHtml(trimmed.replace(/^[-*+]\s+/, '')))}</li>`)
      i++
      continue
    }
    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== 'ol') {
        closeList()
        out.push('<ol>')
        listType = 'ol'
      }
      out.push(`<li>${inlineMd(escapeHtml(trimmed.replace(/^\d+\.\s+/, '')))}</li>`)
      i++
      continue
    }
    // Paragraph
    closeList()
    out.push(`<p>${inlineMd(escapeHtml(trimmed))}</p>`)
    i++
  }
  closeList()
  return out.join('\n')
}

// ============================================================
// COMPONENT
// ============================================================

export const ProseBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as ProseProps
  const raw = textOf(p.content)
  // Markdown vs HTML detection, then sanitize the resulting HTML in both paths.
  const html = looksLikeHtml(raw) ? raw : markdownToHtml(raw)
  const sanitized = sanitizeHtml(html, context?.appHref)

  // Stable per-instance id so the scoped <style> only targets THIS block's
  // descendants. pwpack blocks ship no CSS file, so we inline a scoped style tag.
  const proseId = `pw-prose-${block.id}`

  const wrapStyle: React.CSSProperties = {
    maxWidth: cssUnit(p.maxWidth) ?? 'var(--pw-layout-container-max-width, 1440px)',
    marginInline: '0',
    color: 'var(--pw-color-text)',
    fontFamily: 'var(--pw-font-family, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
    fontSize: 'var(--pw-font-size-base)',
    lineHeight: 'var(--pw-line-height-body)',
    // Inherited by every paragraph and heading inside: a long word or URL
    // breaks rather than overflowing a narrow viewport.
    overflowWrap: 'anywhere',
    minWidth: 0,
    ...block.style,
  }

  // Descendant rules are scoped by [data-prose-id="…"] so they never leak. Every
  // value is a theme token → the article re-themes with the surface.
  const css = `
[data-prose-id="${proseId}"] > :first-child { margin-top: 0; }
[data-prose-id="${proseId}"] > :last-child { margin-bottom: 0; }
[data-prose-id="${proseId}"] h1 { font-size: var(--pw-font-size-h1, var(--pw-font-size-4xl)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-heading); line-height: var(--pw-line-height-heading); color: var(--pw-color-text); margin: var(--pw-space-xl) 0 var(--pw-space-md); }
[data-prose-id="${proseId}"] h2 { font-size: var(--pw-font-size-h2, var(--pw-font-size-2xl)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-heading); line-height: var(--pw-line-height-heading); color: var(--pw-color-text); margin: var(--pw-space-xl) 0 var(--pw-space-sm); }
[data-prose-id="${proseId}"] h3 { font-size: var(--pw-font-size-h3, var(--pw-font-size-xl)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-heading); line-height: var(--pw-line-height-heading); color: var(--pw-color-text); margin: var(--pw-space-lg) 0 var(--pw-space-sm); }
[data-prose-id="${proseId}"] h4 { font-size: var(--pw-font-size-h4, var(--pw-font-size-lg)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-heading); line-height: var(--pw-line-height-heading); color: var(--pw-color-text); margin: var(--pw-space-lg) 0 var(--pw-space-xs); }
[data-prose-id="${proseId}"] p { line-height: var(--pw-line-height-body); color: var(--pw-color-text); margin: 0 0 var(--pw-space-md); }
[data-prose-id="${proseId}"] ul, [data-prose-id="${proseId}"] ol { margin: 0 0 var(--pw-space-md); padding-inline-start: var(--pw-space-xl); color: var(--pw-color-text); }
[data-prose-id="${proseId}"] li { margin: 0 0 var(--pw-space-xs); line-height: var(--pw-line-height-body); }
[data-prose-id="${proseId}"] blockquote { border-left: 3px solid var(--pw-color-border); margin: 0 0 var(--pw-space-md); padding: var(--pw-space-xs) 0 var(--pw-space-xs) var(--pw-space-md); color: var(--pw-color-text-muted); font-style: italic; }
[data-prose-id="${proseId}"] code { font-family: var(--pw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: var(--pw-font-size-sm); background: var(--pw-color-code-surface, var(--pw-color-card)); color: var(--pw-color-code-text, var(--pw-color-text)); padding: 0.15em 0.4em; border-radius: var(--pw-border-radius-sm); }
[data-prose-id="${proseId}"] pre { background: var(--pw-color-code-surface, var(--pw-color-card)); color: var(--pw-color-code-text, var(--pw-color-text)); padding: var(--pw-space-md); border-radius: var(--pw-border-radius-lg); overflow-x: auto; margin: 0 0 var(--pw-space-md); border: 1px solid var(--pw-color-code-border, var(--pw-color-border)); }
[data-prose-id="${proseId}"] pre code { background: none; padding: 0; font-size: var(--pw-font-size-sm); }
[data-prose-id="${proseId}"] a { color: var(--pw-color-primary-ink, #18181b); text-decoration: underline; }
[data-prose-id="${proseId}"] strong, [data-prose-id="${proseId}"] b { font-weight: var(--pw-font-weight-heading); color: var(--pw-color-text); }
[data-prose-id="${proseId}"] em, [data-prose-id="${proseId}"] i { font-style: italic; }
[data-prose-id="${proseId}"] hr { border: none; border-top: 1px solid var(--pw-color-border); margin: var(--pw-space-xl) 0; }
[data-prose-id="${proseId}"] img { max-width: 100%; height: auto; border-radius: var(--pw-border-radius-lg); }
[data-prose-id="${proseId}"] table { width: 100%; border-collapse: collapse; margin: 0 0 var(--pw-space-md); }
[data-prose-id="${proseId}"] th, [data-prose-id="${proseId}"] td { border: 1px solid var(--pw-color-border); padding: var(--pw-space-xs) var(--pw-space-sm); text-align: left; }
[data-prose-id="${proseId}"] th { color: var(--pw-color-text); font-weight: var(--pw-font-weight-heading); }
`.trim()

  return (
    <div id={block.id} data-block-id={block.id} style={wrapStyle} data-block-type="prose">
      <style>{css}</style>
      <div data-prose-id={proseId} dangerouslySetInnerHTML={{ __html: sanitized }} />
    </div>
  )
}
