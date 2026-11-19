/**
 * Form patterns on engine 3.0: a failed write's reason (statusKeys.reason)
 * picks the page's own words, held in page state, with the generic failure
 * copy as the fallback. Nothing is spliced into an expression, so copy with an
 * apostrophe or a brace is safe.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBlockExpressions } from '@pwfabric/runtime'

type Node = { id: string; type: string; visibleWhen?: string; props?: Record<string, unknown>; children?: Node[] }
type Pattern = {
  placeholders: Record<string, unknown>
  snippet: Node
  initialState?: Record<string, unknown>
  formBindings?: { statusKeys?: Record<string, string> }[]
}

const PACKS = join(__dirname, '..', '..')
const load = (pack: string, name: string): Pattern =>
  JSON.parse(readFileSync(join(PACKS, pack, 'atoms', 'patterns', `${name}.json`), 'utf8'))

/** The composer's substitution (pattern-format §4): a whole token is replaced by its value, an optional slot left out is "". */
function compose(p: Pattern, slots: Record<string, unknown>): { snippet: Node; state: Record<string, unknown> } {
  const all: Record<string, unknown> = { ...slots, ID: 'x' }
  for (const [tok, d] of Object.entries(p.placeholders)) {
    const k = tok.slice(2, -2)
    if (!(k in all) && d && typeof d === 'object' && (d as { optional?: boolean }).optional) all[k] = ''
  }
  const sub = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const whole = /^\{\{([A-Z0-9_]+)\}\}$/.exec(v)
      if (whole && whole[1]! in all) return all[whole[1]!]
      return v.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k: string) => (k in all ? String(all[k]) : m))
    }
    if (Array.isArray(v)) return v.map(sub)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]))
    return v
  }
  return { snippet: sub(p.snippet) as Node, state: sub(p.initialState ?? {}) as Record<string, unknown> }
}

function find(n: Node | undefined, id: string): Node | undefined {
  if (!n) return undefined
  if (n.id === id) return n
  for (const c of n.children ?? []) {
    const r = find(c, id)
    if (r) return r
  }
  return undefined
}

/** A page whose sources all read fine (no error, not loading, no rows). */
const SETTLED = { __errors: {}, __errorCodes: {}, __loading: {}, replies: [], accountStep: [], settingsRecord: [] }
const render = (snippet: Node, state: Record<string, unknown>, data: Record<string, unknown> = {}) =>
  resolveBlockExpressions([snippet as never], { ...SETTLED, state, ...data })[0] as unknown as Node

const FORMS: [pack: string, name: string, errId: string, prop: 'title' | 'message', reasonKey: string][] = [
  ['foundation', 'contact-form', 'x-err', 'title', 'contactReason'],
  ['foundation', 'band-signup-form', 'x-err', 'title', 'signupReason'],
  ['foundation', 'form-card', 'x-err', 'title', 'failReason'],
  ['foundation', 'band-auth-card', 'x-err', 'title', 'submitReason'],
]

describe('form patterns branch their failure copy on the write reason', () => {
  for (const [pack, name, errId, prop, reasonKey] of FORMS) {
    const p = load(pack, name)
    it(`${name}: binds reason and fields, never the 2.x message`, () => {
      const sk = p.formBindings?.[0]?.statusKeys ?? {}
      expect(sk['message']).toBeUndefined()
      expect(sk['reason']).toBe(reasonKey)
      expect(typeof sk['fields']).toBe('string')
      for (const r of ['VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'CONFLICT', 'NETWORK', 'SERVER']) {
        expect(p.placeholders[`{{FAILED_${r}}}`]).toMatchObject({ optional: true })
      }
    })
    it(`${name}: a conflict says the app's conflict words; an unnamed reason the generic copy`, () => {
      const generic = "It didn't arrive — try again"
      const conflict = "You're already on the list"
      const required = Object.fromEntries(
        Object.entries(p.placeholders)
          .filter(([, d]) => !(d && typeof d === 'object' && (d as { optional?: boolean }).optional))
          .map(([t]) => [t.slice(2, -2), 'v']),
      )
      const { snippet, state } = compose(p, { ...required, FAILED_TEXT: generic, FAILED_CONFLICT: conflict, SAVED_TEXT: 'Saved' })
      const failedKey = p.formBindings![0]!.statusKeys!['error']!
      const at = (reason: string) => {
        const tree = render(snippet, { ...state, [failedKey]: true, [reasonKey]: reason })
        return find(tree, errId)?.props?.[prop]
      }
      expect(at('conflict')).toBe(conflict)
      expect(at('network')).toBe(generic)
      expect(at('error')).toBe(generic)
      expect(find(render(snippet, { ...state, [failedKey]: true, [reasonKey]: 'conflict' }), errId)?.props?.['focusOnShow']).toBe(true)
    })
  }
})
