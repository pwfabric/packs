import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'
import { cssUnit, textOf } from '../../../lib/_shared-utils.js'
import { useClipboardCopy } from '../../../lib/_shared-copy.js'

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
  /** A copy button on each code block. Off by default. */
  readonly copyButton?: boolean
  /** The copy button's word. Unset: the app's ui.copy. */
  readonly copyLabel?: string
  /** Shown and announced once the code reached the clipboard. Unset: the app's ui.copied. */
  readonly copiedLabel?: string
  /** How wide a table runs: full (default) the column's width, content as wide as its cells need. */
  readonly tableWidth?: 'full' | 'content'
  /** When the copy button shows: always (default), or on hover and focus (always on a touch screen). */
  readonly copyButtonReveal?: 'always' | 'hover'
  /** A `#` link to itself after each h2–h4, shown on hover: a pointer affordance, hidden from screen readers and the tab order. Off by default. */
  readonly headingLinks?: boolean
  /**
   * How a heading's anchor is written. compact (default): runs of other characters are one
   * `-` and a repeat is -2 ("Track A — run" → track-a-run). github: as GitHub and most docs
   * tools write it, so links made for them still land ("Track A — run" → track-a--run, a repeat -1).
   */
  readonly anchors?: AnchorStyle
}

/** compact (default) or github — see ProseProps.anchors. */
export type AnchorStyle = 'compact' | 'github'

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
// A heading keeps an `id` (an in-page anchor: `#getting-started`) when it is a
// plain name, see HEADING_ID.
const HEADING_ATTRS: ReadonlySet<string> = new Set(['id'])
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
  h1: HEADING_ATTRS,
  h2: HEADING_ATTRS,
  h3: HEADING_ATTRS,
  h4: HEADING_ATTRS,
  h5: HEADING_ATTRS,
  h6: HEADING_ATTRS,
  a: new Set(['href', 'title', 'rel', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  td: new Set(['colspan', 'rowspan', 'data-align']),
  th: new Set(['colspan', 'rowspan', 'scope', 'data-align']),
  pre: new Set(['data-lang']),
  span: new Set(['data-tok']),
}

/**
 * The values a data attribute the sanitizer keeps may hold: a cell's
 * alignment, a code token's kind, a code block's language (a plain name).
 */
const DATA_VALUES: Record<string, (v: string) => boolean> = {
  'data-align': (v) => v === 'left' || v === 'center' || v === 'right',
  'data-tok': (v) => (CODE_TOKENS as readonly string[]).includes(v),
  'data-lang': (v) => /^[a-z0-9][a-z0-9+#-]{0,19}$/i.test(v),
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

/**
 * A heading id the sanitizer keeps: letters, digits, `-` and `_`, starting
 * with a letter or digit, at most 100 characters. Nothing that could be a
 * selector, a URL or markup, and never empty.
 */
const HEADING_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/

/**
 * The anchor name of a heading's text. Both styles lower-case it and drop
 * accents (`ş` → `s`, the dotless `ı` → `i`; "Kurulum ve İlk Adım" is
 * `kurulum-ve-ilk-adim`). compact: every other run of characters is one `-`
 * ("Track A — run it" → `track-a-run-it`). github: as github-slugger writes it,
 * so a link made for GitHub or a docs tool still lands — characters that are not a
 * letter, digit, space, `-` or `_` dropped, each space one `-`, runs kept
 * ("Track A — run it" → `track-a--run-it`, "Apache License 2.0" →
 * `apache-license-20`); unlike GitHub, a non-ASCII letter is spelled in ASCII (an
 * anchor is a plain name here, HEADING_ID). Text with no letter or digit is `section`.
 */
export function headingSlug(text: string, style: AnchorStyle = 'compact'): string {
  const ascii = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ß/g, 'ss')
  const slug =
    style === 'github'
      ? ascii
          .replace(/[^a-z0-9 _-]/g, '')
          .trim()
          .replace(/ /g, '-')
          .replace(/^[-_]+/, '')
          .slice(0, 100)
      : ascii
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80)
          .replace(/-+$/, '')
  return slug || 'section'
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
      if (name === 'id' && v !== null && !HEADING_ID.test(v)) v = null
      if (v !== null && DATA_VALUES[name] && !DATA_VALUES[name](v)) v = null
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

// HTML is a fragment that starts with a tag, or that closes one (`</b>`) outside
// code, or holds a void one (`<br>`, `<img …>`, which never close) and no Markdown
// structure; anything else is Markdown. Searching the whole string for any tag read
// Markdown that names one — `pwf <command>` in a code span, "a <page> folder" — as
// HTML, and none of it was converted; and one `<br>` inside a Markdown table must
// not turn the whole document into raw HTML.
export function looksLikeHtml(s: string): boolean {
  if (/^\s*<[a-z!]/i.test(s)) return true
  // Fences, including indented ones, and code spans are code, not markup.
  const outsideCode = s.replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, '').replace(/`[^`\n]*`/g, '')
  if (/<\/[a-z][a-z0-9-]*\s*>/i.test(outsideCode)) return true
  const markdown = /^[ \t]*(?:#{1,6}\s|\||[-*+]\s|>\s?|\d+[.)]\s|```)/m.test(s)
  return !markdown && /<(?:br|hr|img|wbr)(?:\s[^<>]*)?\/?>/i.test(outsideCode)
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


// ============================================================
// CODE TOKENS — a small reader per language family, no dependency
// ============================================================

/** The kinds of token a code block marks; each is coloured from the theme. */
export const CODE_TOKENS = ['keyword', 'string', 'comment', 'number', 'function', 'parameter'] as const

const C_KEYWORDS = 'as async await break case catch class const continue default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while yield'
const LANGS: Record<string, { readonly keywords: string; readonly line: readonly string[]; readonly block?: readonly [string, string]; readonly quotes: string }> = {
  js: { keywords: C_KEYWORDS, line: ['//'], block: ['/*', '*/'], quotes: `"'\`` },
  json: { keywords: 'true false null', line: [], quotes: '"' },
  css: { keywords: 'important inherit initial none auto', line: [], block: ['/*', '*/'], quotes: `"'` },
  sh: { keywords: 'if then else elif fi for while do done case esac in function return', line: ['#'], quotes: `"'` },
  py: { keywords: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield', line: ['#'], quotes: `"'` },
  go: { keywords: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false', line: ['//'], block: ['/*', '*/'], quotes: `"'\`` },
  rust: { keywords: 'as async await break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while', line: ['//'], block: ['/*', '*/'], quotes: `"'` },
  sql: { keywords: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as null is in', line: ['--'], quotes: `'"` },
}
const LANG_NAMES: Record<string, string> = {
  js: 'js', javascript: 'js', jsx: 'js', mjs: 'js', cjs: 'js', ts: 'js', typescript: 'js', tsx: 'js',
  json: 'json', css: 'css', sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh',
  py: 'py', python: 'py', go: 'go', rs: 'rust', rust: 'rust', sql: 'sql',
}

/**
 * A code block's text as HTML, its tokens marked `<span data-tok="…">` for
 * a language this reader knows (the JavaScript family, JSON, CSS, shell,
 * Python, Go, Rust, SQL) and escaped as plain text for any other. The text
 * itself never changes: only spans are added around it.
 */
export function highlightCode(code: string, lang: string | undefined): string {
  const family = lang ? LANG_NAMES[lang.toLowerCase()] : undefined
  const spec = family ? LANGS[family] : undefined
  if (!spec) return escapeHtml(code)
  const keywords = new Set(spec.keywords.split(' '))
  const caseless = family === 'sql'
  const out: string[] = []
  const mark = (kind: (typeof CODE_TOKENS)[number], text: string): void => {
    out.push(`<span data-tok="${kind}">${escapeHtml(text)}</span>`)
  }
  let i = 0
  let plain = ''
  const flush = (): void => {
    if (plain) out.push(escapeHtml(plain))
    plain = ''
  }
  // Shell: the next word is a command (line start, after ; | & ( or a $ prompt).
  const shell = family === 'sh'
  let atCommand = true
  while (i < code.length) {
    const rest = code.slice(i)
    if (shell) {
      const c0 = code[i] as string
      if (c0 === '\n' || c0 === ';' || c0 === '|' || c0 === '&' || c0 === '(') atCommand = true
      // A prompt at the start of a line: "$ npm install" — the prompt is plain, the command follows.
      if (atCommand && c0 === '$' && code[i + 1] === ' ' && (i === 0 || code[i - 1] === '\n')) {
        plain += '$ '
        i += 2
        continue
      }
      // A flag: -g, --pack, --router=path (the value after = stays plain).
      const flag = /^--?[A-Za-z0-9][A-Za-z0-9-]*/.exec(rest)
      if (flag && /\s/.test(code[i - 1] ?? ' ')) {
        flush()
        mark('parameter', flag[0])
        i += flag[0].length
        continue
      }
    }
    const line = spec.line.find((l) => rest.startsWith(l))
    if (line) {
      const end = code.indexOf('\n', i)
      flush()
      mark('comment', code.slice(i, end < 0 ? code.length : end))
      i = end < 0 ? code.length : end
      continue
    }
    if (spec.block && rest.startsWith(spec.block[0])) {
      const end = code.indexOf(spec.block[1], i + spec.block[0].length)
      const stop = end < 0 ? code.length : end + spec.block[1].length
      flush()
      mark('comment', code.slice(i, stop))
      i = stop
      continue
    }
    const ch = code[i] as string
    if (spec.quotes.includes(ch)) {
      let j = i + 1
      while (j < code.length && code[j] !== ch && !(ch !== '`' && code[j] === '\n')) j += code[j] === '\\' ? 2 : 1
      const stop = Math.min(j + 1, code.length)
      flush()
      mark('string', code.slice(i, stop))
      i = stop
      continue
    }
    const num = /^(?:0x[0-9a-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i.exec(rest)
    const before = code[i - 1] ?? ''
    const inWord = /[A-Za-z0-9_$.@/]/.test(before) || (before === '-' && /[A-Za-z0-9_]/.test(code[i - 2] ?? ''))
    const tail = num ? code.slice(i + num[0].length) : ''
    if (num && !inWord && !/^[A-Za-z_$@/]|^\.[A-Za-z0-9]|^-[A-Za-z]/.test(tail)) {
      flush()
      mark('number', num[0])
      i += num[0].length
      continue
    }
    const word = /^[A-Za-z_$][A-Za-z0-9_$-]*/.exec(rest)
    if (word && !/[A-Za-z0-9_$]/.test(code[i - 1] ?? '')) {
      const w = family === 'css' || family === 'sh' ? word[0] : word[0].replace(/-.*$/, '')
      if (keywords.has(caseless ? w.toLowerCase() : w)) {
        flush()
        mark('keyword', w)
      } else if (shell && atCommand) {
        flush()
        mark('function', w)
      } else plain += w
      if (shell) atCommand = false
      i += w.length
      continue
    }
    plain += ch
    i++
  }
  flush()
  return out.join('')
}

/** A GitHub-style table's separator row: `|:---|---:|:-:|`. */
const TABLE_RULE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/

/** The cells of a table row: split on `|` (not `\|`), the outer pipes dropped, each trimmed. */
function tableCells(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '')
  return body.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}

/** A list item line: its indent, its kind and its text. */
const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s+(.*)$/

/**
 * Whether `line` opens a block of its own (`next` is the line after it, for a
 * table): a blank line, a fence, a heading, a rule, a quote, a list item or a
 * table's head row. Anything else continues the paragraph or list item above it.
 */
function startsBlock(line: string | undefined, next: string | undefined): boolean {
  if (line === undefined) return true
  const t = line.trim()
  if (t === '' || /^```/.test(t) || /^#{1,6}\s/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t) || /^>\s?/.test(t)) return true
  if (LIST_ITEM.test(line) && /^[-*+]|^\d+\./.test(t)) return true
  return t.includes('|') && next !== undefined && TABLE_RULE.test(next.trim()) && next.includes('-')
}

function markdownToHtml(md: string, anchors: AnchorStyle = 'compact'): string {
  const inline = (t: string): string => inlineMd(t)
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  // Every heading gets an anchor id from its text, unique within the block:
  // a second "Options" is `options-2` (compact) or `options-1` (github, as GitHub numbers them).
  const used = new Set<string>()
  const headingId = (text: string): string => {
    const plain = text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`*_]/g, '')
    const base = headingSlug(plain, anchors)
    let id = base
    for (let n = anchors === 'github' ? 1 : 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    return id
  }
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
    // Fenced code block, its language named after the fence (```ts)
    if (/^```/.test(trimmed)) {
      closeList()
      const lang = /^```\s*([A-Za-z0-9][A-Za-z0-9+#-]{0,19})?/.exec(trimmed)?.[1]
      const buf: string[] = []
      i++
      for (;;) {
        const fenced = lines[i]
        if (fenced === undefined || /^```/.test(fenced.trim())) break
        buf.push(fenced)
        i++
      }
      i++ // consume closing fence
      out.push(`<pre${lang ? ` data-lang="${escapeAttr(lang.toLowerCase())}"` : ''}><code>${highlightCode(buf.join('\n'), lang)}</code></pre>`)
      continue
    }
    // GitHub-style table: a row of cells, then a separator row
    const rule = lines[i + 1]
    if (trimmed.includes('|') && rule !== undefined && TABLE_RULE.test(rule.trim()) && rule.includes('-')) {
      closeList()
      const head = tableCells(trimmed)
      const align = tableCells(rule).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''))
      const cell = (tag: 'th' | 'td', text: string, n: number): string => {
        const a = align[n]
        return `<${tag}${a ? ` data-align="${a}"` : ''}>${inline(escapeHtml(text))}</${tag}>`
      }
      const rows: string[] = []
      i += 2
      for (;;) {
        const row = lines[i]
        if (row === undefined || row.trim() === '' || !row.includes('|')) break
        const cells = tableCells(row)
        rows.push(`<tr>${head.map((_h, n) => cell('td', cells[n] ?? '', n)).join('')}</tr>`)
        i++
      }
      out.push(`<table><thead><tr>${head.map((h, n) => cell('th', h, n)).join('')}</tr></thead>${rows.length ? `<tbody>${rows.join('')}</tbody>` : ''}</table>`)
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
      const text = h[2] ?? ''
      out.push(`<h${level} id="${headingId(text)}">${inline(escapeHtml(text))}</h${level}>`)
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
        buf.push(inline(escapeHtml(quotedTrimmed.replace(/^>\s?/, ''))))
        i++
      }
      out.push(`<blockquote>${buf.join('<br />')}</blockquote>`)
      continue
    }
    // A list: its items, an item indented under another a list inside it
    if (LIST_ITEM.test(line) && /^[-*+]|^\d+\./.test(trimmed)) {
      closeList()
      // Each open list: its kind and the indent of its items.
      const stack: { tag: 'ul' | 'ol'; indent: number }[] = []
      // One piece, no line breaks inside: an item's text is its text.
      const parts: string[] = []
      const closeTo = (depth: number): void => {
        while (stack.length > depth) parts.push(`</li></${(stack.pop() as { tag: string }).tag}>`)
      }
      for (;;) {
        const item = lines[i]
        const m = item === undefined ? null : LIST_ITEM.exec(item)
        if (!m) break
        const indent = (m[1] ?? '').replace(/\t/g, '    ').length
        const tag: 'ul' | 'ol' = /^\d/.test(m[2] ?? '') ? 'ol' : 'ul'
        // A wrapped item: the lines under it that open no block are its text.
        let itemText = m[3] ?? ''
        while (!startsBlock(lines[i + 1], lines[i + 2])) itemText += ' ' + (lines[++i] as string).trim()
        const text = inline(escapeHtml(itemText))
        // Close the lists this item is not inside.
        while (stack.length > 0 && indent < (stack[stack.length - 1] as { indent: number }).indent) closeTo(stack.length - 1)
        const top = stack[stack.length - 1]
        if (!top || indent > top.indent) {
          stack.push({ tag, indent })
          parts.push(`<${tag}><li>${text}`)
        } else if (top.tag !== tag) {
          closeTo(stack.length - 1)
          stack.push({ tag, indent })
          parts.push(`<${tag}><li>${text}`)
        } else parts.push(`</li><li>${text}`)
        i++
      }
      closeTo(0)
      out.push(parts.join(''))
      continue
    }
    // Paragraph: this line and the ones under it, up to a blank line or the
    // start of another block — one <p>, not one per source line.
    closeList()
    let paragraph = trimmed
    while (!startsBlock(lines[i + 1], lines[i + 2])) paragraph += ' ' + (lines[++i] as string).trim()
    out.push(`<p>${inline(escapeHtml(paragraph))}</p>`)
    i++
  }
  closeList()
  return out.join('\n')
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * A copy button before each code block of sanitized prose: written after the
 * sanitizer, so it is the block's own markup, never the content's. Each
 * button names its code block by number (`data-pw-prose-copy="0"`).
 */
function withCopyButtons(html: string, label: (n: number) => string): string {
  let n = 0
  return html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, (pre) => {
    const at = n++
    return `<div data-pw-prose-code=""><button type="button" data-pw-prose-copy="${at}">${escapeHtml(label(at))}</button>${pre}</div>`
  })
}

/** Each table in a box of its own that scrolls sideways, so a wide one never widens the page. */
function withTableScroll(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/g, (table) => `<div data-pw-prose-table="">${table}</div>`)
}

/**
 * A link to itself after each h2–h4 that has an id — a pointer affordance for copying a
 * section's address. aria-hidden and out of the tab order: a screen reader already lists
 * the headings, and llms-full.txt (which skips aria-hidden) keeps the heading clean. Its
 * address goes through the app's links as the content's own `#anchor` does.
 */
function withHeadingLinks(html: string, appHref: ((href: string) => string) | undefined): string {
  return html.replace(/<h([234]) id="([^"]+)">([\s\S]*?)<\/h\1>/g, (_m, level: string, id: string, inner: string) => {
    const href = appHref ? appHref(`#${id}`) : `#${id}`
    return `<h${level} id="${id}">${inner}<a href="${escapeAttr(href)}" data-pw-prose-anchor="" aria-hidden="true" tabindex="-1">#</a></h${level}>`
  })
}

export const ProseBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as ProseProps
  const appWords = useAppMessages()
  const { status, key, copy } = useClipboardCopy()
  const raw = textOf(p.content)
  // Markdown vs HTML detection, then sanitize the resulting HTML in both paths.
  const html = looksLikeHtml(raw) ? raw : markdownToHtml(raw, p.anchors === 'github' ? 'github' : 'compact')
  const copyButton = p.copyButton === true
  // Behaviours, not looks: how wide a table runs and when the copy button shows.
  const tableWidth = p.tableWidth === 'content' ? 'auto' : '100%'
  const copyRestOpacity = p.copyButtonReveal === 'hover' ? 0 : 1
  // The app's words: the props when set, else its ui.copy / ui.copied.
  const copyLabel = textOf(p.copyLabel) || messageOf(appWords, 'ui.copy', '')
  const copiedLabel = textOf(p.copiedLabel) || messageOf(appWords, 'ui.copied', '')
  const copied = status === 'copied' ? key : null
  // Written after the sanitizer: the block's own markup, never the content's.
  const clean = withTableScroll(sanitizeHtml(html, context?.appHref))
  const linked = p.headingLinks === true ? withHeadingLinks(clean, context?.appHref) : clean
  const sanitized = copyButton ? withCopyButtons(linked, (n) => (copied === String(n) ? copiedLabel : copyLabel)) : linked
  // One listener for every button: the content is markup, not elements of ours.
  const onClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const button = (e.target as Element | null)?.closest?.('[data-pw-prose-copy]')
    if (!button || context?.interactionMode === 'inert') return
    const code = button.parentElement?.querySelector('pre')?.textContent ?? ''
    void copy(code, button.getAttribute('data-pw-prose-copy') ?? undefined)
  }

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
[data-prose-id="${proseId}"] h1 { font-size: var(--pw-font-size-h1, var(--pw-font-size-4xl)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-h1, var(--pw-font-weight-heading)); line-height: var(--pw-line-height-h1, var(--pw-line-height-heading)); letter-spacing: var(--pw-letter-spacing-heading, normal); color: var(--pw-color-heading, var(--pw-color-text)); margin: var(--pw-prose-h1-space-above, var(--pw-space-xl)) 0 var(--pw-prose-h1-space-below, var(--pw-space-md)); }
[data-prose-id="${proseId}"] h2 { font-size: var(--pw-font-size-h2, var(--pw-font-size-2xl)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-h2, var(--pw-font-weight-heading)); line-height: var(--pw-line-height-h2, var(--pw-line-height-heading)); letter-spacing: var(--pw-letter-spacing-heading, normal); color: var(--pw-color-heading, var(--pw-color-text)); margin: var(--pw-prose-h2-space-above, var(--pw-space-xl)) 0 var(--pw-prose-h2-space-below, var(--pw-space-sm)); padding-bottom: var(--pw-prose-h2-rule-gap, 0px); border-bottom: var(--pw-prose-h2-rule-width, 0px) solid var(--pw-prose-h2-rule-color, var(--pw-color-border)); }
[data-prose-id="${proseId}"] h3 { font-size: var(--pw-font-size-h3, var(--pw-font-size-xl)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-h3, var(--pw-font-weight-heading)); line-height: var(--pw-line-height-h3, var(--pw-line-height-heading)); letter-spacing: var(--pw-letter-spacing-heading, normal); color: var(--pw-color-heading, var(--pw-color-text)); margin: var(--pw-prose-h3-space-above, var(--pw-space-lg)) 0 var(--pw-prose-h3-space-below, var(--pw-space-sm)); }
[data-prose-id="${proseId}"] h4 { font-size: var(--pw-font-size-h4, var(--pw-font-size-lg)); font-family: var(--pw-font-family-heading); font-weight: var(--pw-font-weight-h4, var(--pw-font-weight-heading)); line-height: var(--pw-line-height-h4, var(--pw-line-height-heading)); letter-spacing: var(--pw-letter-spacing-heading, normal); color: var(--pw-color-heading, var(--pw-color-text)); margin: var(--pw-prose-h4-space-above, var(--pw-space-lg)) 0 var(--pw-prose-h4-space-below, var(--pw-space-xs)); }
[data-prose-id="${proseId}"] p { line-height: var(--pw-line-height-body); color: var(--pw-color-text); margin: var(--pw-prose-paragraph-space-above, 0px) 0 var(--pw-prose-paragraph-space-below, var(--pw-space-md)); }
[data-prose-id="${proseId}"] ul, [data-prose-id="${proseId}"] ol { margin: var(--pw-prose-list-space-above, 0px) 0 var(--pw-prose-list-space-below, var(--pw-space-md)); padding-inline-start: var(--pw-prose-list-indent, var(--pw-space-xl)); color: var(--pw-color-text); }
[data-prose-id="${proseId}"] li { margin: var(--pw-prose-list-item-space-above, 0px) 0 var(--pw-prose-list-item-space-below, var(--pw-space-xs)); line-height: var(--pw-prose-list-line-height, var(--pw-line-height-body)); }
[data-prose-id="${proseId}"] blockquote { border-left: 3px solid var(--pw-color-border); margin: 0 0 var(--pw-space-md); padding: var(--pw-space-xs) 0 var(--pw-space-xs) var(--pw-space-md); color: var(--pw-color-text-muted); font-style: italic; }
[data-prose-id="${proseId}"] code { font-family: var(--pw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: var(--pw-prose-inline-code-font-size, var(--pw-font-size-sm)); background: var(--pw-prose-inline-code-surface, var(--pw-color-code-surface, var(--pw-color-card))); color: var(--pw-color-code-text, var(--pw-color-text)); padding: var(--pw-prose-inline-code-padding-block, 0.15em) var(--pw-prose-inline-code-padding-inline, 0.4em); border-radius: var(--pw-prose-inline-code-radius, var(--pw-border-radius-sm)); border: var(--pw-prose-inline-code-border-width, 0px) solid var(--pw-prose-inline-code-border-color, transparent); }
[data-prose-id="${proseId}"] pre { background: var(--pw-color-code-surface, var(--pw-color-card)); color: var(--pw-color-code-text, var(--pw-color-text)); padding: var(--pw-space-md); border-radius: var(--pw-prose-code-block-radius, var(--pw-border-radius-lg)); overflow-x: auto; margin: var(--pw-prose-code-block-space-above, 0px) 0 var(--pw-prose-code-block-space-below, var(--pw-space-md)); line-height: var(--pw-prose-code-block-line-height, inherit); border: 1px solid var(--pw-color-code-border, var(--pw-color-border)); }
[data-prose-id="${proseId}"] pre code { display: block; background: none; padding: 0; border: none; border-radius: 0; font-size: var(--pw-font-size-sm); line-height: var(--pw-prose-code-block-line-height, inherit); }
[data-prose-id="${proseId}"] :is(h1, h2, h3, h4, h5, h6) code { font-size: inherit; }
[data-prose-id="${proseId}"] [data-pw-prose-table] { max-width: 100%; overflow-x: auto; margin: 0 0 var(--pw-space-md); }
[data-prose-id="${proseId}"] [data-pw-prose-table] > table { margin: 0; }
[data-prose-id="${proseId}"] [data-pw-prose-anchor] { margin-inline-start: 0.4em; color: var(--pw-color-text-muted); text-decoration: none; opacity: 0; }
[data-prose-id="${proseId}"] :is(h2, h3, h4):hover > [data-pw-prose-anchor], [data-prose-id="${proseId}"] [data-pw-prose-anchor]:focus-visible { opacity: 1; }
[data-prose-id="${proseId}"] a { color: var(--pw-color-link, var(--pw-color-primary-ink, #18181b)); text-decoration: underline; }
[data-prose-id="${proseId}"] strong, [data-prose-id="${proseId}"] b { font-weight: var(--pw-font-weight-heading); color: var(--pw-color-text); }
[data-prose-id="${proseId}"] em, [data-prose-id="${proseId}"] i { font-style: italic; }
[data-prose-id="${proseId}"] hr { border: none; border-top: 1px solid var(--pw-color-border); margin: var(--pw-space-xl) 0; }
[data-prose-id="${proseId}"] img { max-width: 100%; height: auto; border-radius: var(--pw-border-radius-lg); }
[data-prose-id="${proseId}"] table { width: ${tableWidth}; border-collapse: collapse; margin: 0 0 var(--pw-space-md); line-height: var(--pw-prose-table-line-height, inherit); }
[data-prose-id="${proseId}"] th, [data-prose-id="${proseId}"] td { border: 1px solid var(--pw-color-table-border, var(--pw-color-border)); padding: var(--pw-prose-table-cell-padding-block, var(--pw-space-xs)) var(--pw-prose-table-cell-padding-inline, var(--pw-space-sm)); text-align: left; overflow-wrap: break-word; }
[data-prose-id="${proseId}"] th { color: var(--pw-color-text); font-weight: var(--pw-font-weight-heading); }
[data-prose-id="${proseId}"] [data-align="center"] { text-align: center; }
[data-prose-id="${proseId}"] [data-align="right"] { text-align: right; }
[data-prose-id="${proseId}"] li > ul, [data-prose-id="${proseId}"] li > ol { margin: var(--pw-space-xs) 0 0; }
[data-prose-id="${proseId}"] [data-tok="keyword"] { color: var(--pw-color-code-keyword, var(--pw-color-primary-ink, inherit)); font-weight: var(--pw-font-weight-heading); }
[data-prose-id="${proseId}"] [data-tok="string"] { color: var(--pw-color-code-string, inherit); }
[data-prose-id="${proseId}"] [data-tok="function"] { color: var(--pw-color-code-function, inherit); }
[data-prose-id="${proseId}"] [data-tok="parameter"] { color: var(--pw-color-code-parameter, inherit); }
[data-prose-id="${proseId}"] [data-tok="number"] { color: var(--pw-color-code-number, var(--pw-color-primary-ink, inherit)); }
[data-prose-id="${proseId}"] [data-tok="comment"] { color: var(--pw-color-code-comment, var(--pw-color-code-muted, var(--pw-color-text-muted))); font-style: italic; }
[data-prose-id="${proseId}"] [data-pw-prose-code] { position: relative; }
[data-prose-id="${proseId}"] [data-pw-prose-copy] { opacity: ${copyRestOpacity}; transition: opacity var(--pw-duration-fast, 150ms); }
[data-prose-id="${proseId}"] [data-pw-prose-code]:hover [data-pw-prose-copy], [data-prose-id="${proseId}"] [data-pw-prose-copy]:focus-visible { opacity: 1; }
[data-prose-id="${proseId}"] [data-pw-prose-copy] { position: absolute; top: var(--pw-space-xs); right: var(--pw-space-xs); background: transparent; border: none; cursor: pointer; color: var(--pw-color-code-muted, var(--pw-color-text-muted)); font-size: var(--pw-font-size-xs); font-family: inherit; min-height: 32px; padding: 0 var(--pw-space-sm); }
@media (max-width: 640px), (pointer: coarse) { [data-prose-id="${proseId}"] [data-pw-prose-copy] { min-height: 44px; min-width: 44px; opacity: 1; } [data-prose-id="${proseId}"] [data-pw-prose-code] > pre { padding-top: calc(var(--pw-space-md) + 40px); } }
`.trim()

  return (
    <div id={block.id} data-block-id={block.id} style={wrapStyle} data-block-type="prose">
      <style>{css}</style>
      <div data-prose-id={proseId} onClick={copyButton ? onClick : undefined} dangerouslySetInnerHTML={{ __html: sanitized }} />
      {copyButton ? (
        // The copy is announced, not silent.
        <span
          role="status"
          aria-live="polite"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
        >
          {copied !== null ? copiedLabel : ''}
        </span>
      ) : null}
    </div>
  )
}
