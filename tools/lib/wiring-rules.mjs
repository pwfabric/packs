// The pattern WIRING rules. Most patterns carry none of `dataSources` /
// `behaviors` / `initialState`. Without a declaration, nothing tells the
// composer, an app builder or a reader which of them are layout by intent and
// which are a list page waiting for its data; validating only the SHAPE of a
// declared source never asks about absence, so "wired pattern" would be an
// unmeasurable claim. Hence every pattern is either wired or says it is not.
//
// Each rule here is a pure function over the parsed pattern JSON — zero
// dependencies, so check-integrity.mjs imports it and tools/test/wiring-rules.test.ts
// proves every rule against a fixture that must report and one that must pass.
//
//   wired ⊕ layoutOnly     a pattern either carries wiring or declares
//                          `layoutOnly: true`; neither fails, both is a
//                          contradiction and fails everywhere
//   stateKeyConstant       a literal `"stateKey": "x"` in the snippet is a
//                          pattern constant and must be seeded in
//                          `initialState.x`; a SLOT-valued stateKey cannot be
//                          seeded by name and is reported until the key is
//                          fixed (a state key is never a slot)
//   writesSeeded           every state key a behavior writes (`setState.key`)
//                          or a form binding writes (`statusKeys.*`) is seeded
//   formBindings           `{formId, sourceId, statusKeys}`: the form is a node
//                          of the snippet, the source is one of the pattern's
//                          dataSources, the status keys are the four the
//                          `form` block reads
//   slotTypes              a placeholder may be declared as an object
//                          `{description, type, optional?}`; `type` is one of
//                          SLOT_TYPES — the kinds the kits already distinguish
//                          (url, url-template, json-path, field, state-key)
//   rows                   see `rowFindings` below: a row source binds only
//                          where objects are read, its stand-in is rows, and
//                          a `field` slot sits in a field position

export const WIRING_FIELDS = ['dataSources', 'behaviors', 'initialState', 'formBindings']

/**
 * What a slot is FOR, read by whoever fills it (composer `use-pattern`, a
 * pattern expander, a composer prompt's slot lines). `text` is the default a
 * bare string declaration means; the rest are the kinds the app kits' build
 * step tells apart.
 */
export const SLOT_TYPES = ['text', 'url', 'url-template', 'json-path', 'field', 'state-key']

/**
 * The status keys a form binding (and the `write` action) drives on engine 3.0
 * (data-protocol §4.2): loading, success, error, and on a failure the reason
 * code, the refused field names and the writer's detail. `message` is the 2.x
 * key, gone in 3.0: it binds nothing.
 */
export const STATUS_KEYS = ['loading', 'success', 'error', 'reason', 'fields', 'detail']

const UPPER_TOKEN = /\{\{([A-Z0-9_]+)\}\}/g

/** True when the pattern carries any wiring field (declared at all, even empty). */
export function isWired(p) {
  return WIRING_FIELDS.some((f) => p?.[f] !== undefined)
}

/** `{{SLOT}}` tokens found anywhere in the wiring fields (not the snippet). */
export function wiringSlotTokens(p, into = new Set()) {
  for (const f of WIRING_FIELDS) {
    if (p?.[f] === undefined) continue
    for (const m of JSON.stringify(p[f]).matchAll(UPPER_TOKEN)) into.add(m[1])
  }
  return into
}

/**
 * `placeholders` normalised: `{ TOKEN: { description, type, optional, raw } }`.
 * A bare string is a `text` slot; an object declares its kind. `raw` keeps the
 * value as written so shape errors can name it.
 */
export function slotDeclarations(p) {
  const out = {}
  for (const [k, v] of Object.entries(p?.placeholders ?? {})) {
    const token = String(k).replace(/^\{\{|\}\}$/g, '')
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[token] = { description: v.description, type: v.type ?? 'text', optional: v.optional === true, raw: v }
    } else {
      out[token] = { description: v, type: 'text', optional: false, raw: v }
    }
  }
  return out
}

/** Every literal `"stateKey"` value in the snippet, split by whether it is a slot. */
export function stateKeysOf(snippet) {
  const text = JSON.stringify(snippet ?? {})
  const literal = []
  const slot = []
  for (const m of text.matchAll(/"stateKey"\s*:\s*"([^"]*)"/g)) {
    ;(/\{\{/.test(m[1]) ? slot : literal).push(m[1])
  }
  return { literal: [...new Set(literal)], slot: [...new Set(slot)] }
}

/**
 * The findings, each `{ rule, severity: 'fail' | 'warn', msg }`.
 */
export function wiringFindings(p) {
  const out = []
  const fail = (rule, msg) => out.push({ rule, severity: 'fail', msg })
  const warn = (rule, msg) => out.push({ rule, severity: 'warn', msg })
  const wired = isWired(p)
  const seeded = (k) => p.initialState && typeof p.initialState === 'object' && k in p.initialState

  // ── wired ⊕ layoutOnly ────────────────────────────────────────────────────
  if (p.layoutOnly !== undefined && p.layoutOnly !== true) {
    fail('layoutOnlyShape', `"layoutOnly" is ${JSON.stringify(p.layoutOnly)} — the marker is the literal true or absent; a false marker says nothing a missing one does not`)
  }
  if (p.layoutOnly === true && wired) {
    const carried = WIRING_FIELDS.filter((f) => p[f] !== undefined)
    fail('contradiction', `declares layoutOnly: true but carries ${carried.join(', ')} — a pattern is layout by intent OR it is wired; the marker exists so the composer does not expect data from a band that has none, and a wired band marked layout-only is taught wrong`)
  }
  if (p.layoutOnly !== true && !wired) {
    const msg = 'carries none of dataSources, behaviors, initialState or formBindings and does not declare layoutOnly: true — either wire it or declare it layout-only so composers stop expecting data from it'
    fail('unwired', msg)
  }

  // ── stateKeyConstant ──────────────────────────────────────────────────────
  const { literal, slot } = stateKeysOf(p.snippet)
  for (const k of literal) {
    if (!seeded(k)) fail('stateKeyUnseeded', `snippet writes stateKey "${k}" but initialState does not seed "${k}" — a control that writes a key the surface never seeded binds undefined on the first render; a stateKey is a pattern constant, seed it`)
  }
  for (const k of slot) {
    warn('stateKeySlot', `snippet writes stateKey ${k} — a state key is a pattern constant, not a slot: the key cannot be seeded by name until the slot is fixed, and every control, chip and source that reads it must agree on the name`)
  }

  // ── writesSeeded: behaviors ───────────────────────────────────────────────
  if (Array.isArray(p.behaviors)) {
    p.behaviors.forEach((b, i) => {
      for (const [j, a] of (Array.isArray(b?.actions) ? b.actions : []).entries()) {
        if (a?.type === 'setState' && typeof a.key === 'string' && !seeded(a.key)) {
          fail('writeUnseeded', `behaviors[${i}].actions[${j}] writes state "${a.key}" but initialState does not seed it — a visibleWhen reading it binds undefined until the event fires`)
        }
      }
    })
  }

  // ── formBindings ──────────────────────────────────────────────────────────
  if (p.formBindings !== undefined) {
    if (!Array.isArray(p.formBindings)) {
      fail('formBindingsShape', '"formBindings" must be an array — the composer moves it into the platform/entities capability config as a list')
    } else {
      const ids = nodeIds(p.snippet)
      const sourceIds = new Set((Array.isArray(p.dataSources) ? p.dataSources : []).map((s) => s?.id))
      p.formBindings.forEach((fb, i) => {
        const at = `formBindings[${i}]`
        if (!fb || typeof fb !== 'object') { fail('formBindingsShape', `${at} is not an object`); return }
        if (typeof fb.formId !== 'string' || !fb.formId) fail('formBindingsShape', `${at}.formId is missing — a binding names the form it submits`)
        else if (!ids.has(fb.formId)) fail('formBindingsForm', `${at}.formId "${fb.formId}" is not a node id of the snippet — the expander substitutes {{ID}} in both places, so they must match textually`)
        if (typeof fb.sourceId !== 'string' || !fb.sourceId) fail('formBindingsShape', `${at}.sourceId is missing — a binding names the source (entity or rest) the form writes`)
        else if (!sourceIds.has(fb.sourceId)) fail('formBindingsSource', `${at}.sourceId "${fb.sourceId}" is not one of this pattern's dataSources — a form's counter source IS the one the form writes`)
        if (fb.statusKeys !== undefined) {
          if (!fb.statusKeys || typeof fb.statusKeys !== 'object' || Array.isArray(fb.statusKeys)) fail('formBindingsShape', `${at}.statusKeys must be an object`)
          else {
            for (const [k, v] of Object.entries(fb.statusKeys)) {
              if (k === 'message') fail('formBindingsStatus', `${at}.statusKeys.message — the 2.x key, gone in engine 3.0: bind reason (and fields) and branch the page's own copy on it`)
              else if (!STATUS_KEYS.includes(k)) fail('formBindingsStatus', `${at}.statusKeys.${k} — a form binding drives ${STATUS_KEYS.join(' | ')} and nothing else`)
              if (typeof v !== 'string' || !v) fail('formBindingsShape', `${at}.statusKeys.${k} must be a state key name`)
              else if (!seeded(v)) fail('writeUnseeded', `${at}.statusKeys.${k} writes state "${v}" but initialState does not seed it — the form's submittingWhen and the feedback card bind undefined until the first submit`)
            }
          }
        }
      })
    }
  }

  // ── slotTypes ─────────────────────────────────────────────────────────────
  for (const [token, d] of Object.entries(slotDeclarations(p))) {
    if (d.raw && typeof d.raw === 'object' && !Array.isArray(d.raw)) {
      if (typeof d.description !== 'string' || !d.description.trim()) fail('slotTypeShape', `placeholders {{${token}}} is an object with no "description" — the composer prints the description; without it the slot is a name and nothing else`)
      if (!SLOT_TYPES.includes(d.type)) fail('slotTypeUnknown', `placeholders {{${token}}}.type "${d.type}" — expected ${SLOT_TYPES.join(' | ')}`)
      if (d.raw.optional !== undefined && typeof d.raw.optional !== 'boolean') fail('slotTypeShape', `placeholders {{${token}}}.optional must be a boolean`)
    } else if (typeof d.raw !== 'string') {
      fail('slotTypeShape', `placeholders {{${token}}} is ${JSON.stringify(d.raw)} — a slot is declared as a description string or as {description, type, optional?}`)
    }
  }
  return out
}

function nodeIds(node, into = new Set()) {
  if (!node || typeof node !== 'object') return into
  if (typeof node.id === 'string') into.add(node.id)
  ;(node.children ?? []).forEach((c) => nodeIds(c, into))
  return into
}

// ── rows ─────────────────────────────────────────────────────────────────────
//
// Every list source (`entity` — the app's own records, `rest` — any API, a
// connector) delivers an ARRAY OF ROW OBJECTS under its id, with the source's
// own field names; nothing renames fields between the source and the block. A
// field is read where it is placed: `{{item.name}}` in a repeat template, or a
// block's field-mapping prop (`headingField`, `textField`, `labelKey`,
// `columns[].key`…). So:
//
//   rowsToScalarProp    `{{<sourceId>}}` as a whole prop value lands in a prop
//                       that takes objects — a prop whose items are only
//                       strings/numbers cannot show a row (it prints JSON or
//                       nothing)
//   fallbackNotRows     a literal fallback of a row source is rows of the same
//                       shape: objects, not strings — strings only where every
//                       prop the source feeds takes strings
//   fieldSlotPosition   a `field`-typed slot sits where a field name is read:
//                       a `*Field` / `*Key` prop, `columns[].key`, a source's
//                       `query.filter.field` / `sort[].field`, or right after
//                       `item.` inside a binding (`{{item.{{TITLE_FIELD}}}}`)

/** Source kinds whose rows are objects. `static` / `state` carry whatever the pattern wrote. */
export const ROW_SOURCE_KINDS = ['entity', 'rest']

const SCALAR_TYPES = new Set(['string', 'number', 'integer', 'boolean'])

/** True when a JSON schema describes a scalar (string / number / boolean) and nothing else. */
function scalarOnly(s) {
  if (!s || typeof s !== 'object') return false
  const alts = s.anyOf ?? s.oneOf
  if (Array.isArray(alts)) return alts.length > 0 && alts.every(scalarOnly)
  if (Array.isArray(s.type)) return s.type.length > 0 && s.type.every((t) => SCALAR_TYPES.has(t))
  return SCALAR_TYPES.has(s.type)
}

/** True when a JSON schema admits a scalar among its alternatives. */
function admitsScalar(s) {
  if (!s || typeof s !== 'object') return false
  const alts = s.anyOf ?? s.oneOf
  if (Array.isArray(alts)) return alts.some(admitsScalar)
  return scalarOnly(s)
}

/**
 * What a prop does with a bound list, from its manifest jsonSchema:
 * `'rows'` it takes objects, `'scalars'` only strings/numbers (an array of
 * them, or a scalar prop), `'unknown'` the schema does not say.
 */
export function rowsReceiver(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown'
  if (schema.type === 'array') return scalarOnly(schema.items) ? 'scalars' : 'rows'
  if (scalarOnly(schema)) return 'scalars'
  return 'unknown'
}

/**
 * Every place a pattern hands a row source's list to something:
 * `{ sourceId, path, type, prop, schema }` for a whole-value prop binding
 * (`"items": "{{tasks}}"`), `{ sourceId, path, repeat: true }` for a repeat
 * template (`"repeat": "{{tasks}}"`, `"{{slice(tasks, 0, 3)}}"`).
 */
export function rowReceivers(p, schemaOf) {
  const ids = new Set(
    (Array.isArray(p?.dataSources) ? p.dataSources : []).filter((s) => ROW_SOURCE_KINDS.includes(s?.kind)).map((s) => s.id)
  )
  const out = []
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.repeat === 'string') {
      for (const id of ids) if (new RegExp(`\\b${id}\\b`).test(node.repeat)) out.push({ sourceId: id, path, repeat: true })
    }
    for (const [prop, value] of Object.entries(node.props ?? {})) {
      const m = typeof value === 'string' && value.trim().match(/^\{\{\s*([a-z][A-Za-z0-9]*)\s*\}\}$/)
      if (m && ids.has(m[1])) out.push({ sourceId: m[1], path: `${path}.props.${prop}`, type: node.type, prop, schema: schemaOf?.(node.type, prop) })
    }
    ;(node.children ?? []).forEach((c, i) => visit(c, `${path}.children[${i}]`))
  }
  visit(p?.snippet, 'snippet')
  return out
}

/** Field-position keys: a block's field-mapping prop (`*Field`, `*Key`), `columns[].key`, a filter/sort `field`. */
const NOT_A_FIELD_KEY = new Set(['stateKey', 'selectionKey'])
const isFieldKey = (k) => typeof k === 'string' && !NOT_A_FIELD_KEY.has(k) && (/[a-z](Field|Key)$/.test(k) || k === 'key' || k === 'field')

/**
 * The findings, each `{ rule, severity, msg }`. `schemaOf(type, prop)` returns
 * the receiving block prop's manifest jsonSchema (undefined when unknown).
 */
export function rowFindings(p, schemaOf) {
  const out = []
  const fail = (rule, msg) => out.push({ rule, severity: 'fail', msg })
  const receivers = rowReceivers(p, schemaOf)

  // ── rowsToScalarProp ──────────────────────────────────────────────────────
  for (const r of receivers) {
    if (r.repeat) continue
    if (rowsReceiver(r.schema) === 'scalars') {
      fail('rowsToScalarProp', `${r.path} binds {{${r.sourceId}}}, whose rows are objects, to ${r.type}.${r.prop}, which takes only strings or numbers — a row cannot show there; use a block that maps row fields (list.textField, repeater *Field, table columns[].key, select/combobox labelKey) or a repeat template reading {{item.<field>}}`)
    }
  }

  // ── fallbackNotRows ───────────────────────────────────────────────────────
  for (const [i, src] of (Array.isArray(p?.dataSources) ? p.dataSources : []).entries()) {
    if (!ROW_SOURCE_KINDS.includes(src?.kind) || !Array.isArray(src.fallback)) continue
    const bad = src.fallback.findIndex((e) => !e || typeof e !== 'object' || Array.isArray(e))
    if (bad === -1) continue
    const mine = receivers.filter((r) => r.sourceId === src.id)
    const scalarsOk = mine.length > 0 && mine.every((r) => !r.repeat && admitsScalar(r.schema?.items ?? r.schema))
    if (!scalarsOk) {
      fail('fallbackNotRows', `dataSources[${i}].fallback[${bad}] is ${JSON.stringify(src.fallback[bad])} — "${src.id}" is a ${src.kind} source, its live rows are objects, so its stand-in is rows of the same shape; a string stand-in renders differently from the data it stands for`)
    }
  }

  // ── fieldSlotPosition ─────────────────────────────────────────────────────
  const fieldSlots = Object.entries(slotDeclarations(p)).filter(([, d]) => d.type === 'field').map(([t]) => t)
  if (fieldSlots.length) {
    const misplaced = new Map(fieldSlots.map((t) => [t, []]))
    const scan = (v, key, path) => {
      if (typeof v === 'string') {
        for (const t of fieldSlots) {
          const token = `{{${t}}}`
          const total = v.split(token).length - 1
          if (!total) continue
          const ok = isFieldKey(key) && v.trim() === token
            ? total
            : (v.match(new RegExp(`item(?:\\.[A-Za-z0-9_]+)*\\.\\{\\{${t}\\}\\}|item\\[['"]\\{\\{${t}\\}\\}['"]\\]`, 'g')) ?? []).length
          if (total > ok) misplaced.get(t).push(path)
        }
      } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, key, `${path}[${i}]`))
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, k, `${path}.${k}`)
    }
    scan(p.snippet, undefined, 'snippet')
    for (const f of WIRING_FIELDS) if (p[f] !== undefined) scan(p[f], undefined, f)
    for (const [t, paths] of misplaced) {
      for (const path of paths) {
        fail('fieldSlotPosition', `{{${t}}} is a field slot but ${path} uses it outside a field position — a field name goes in a *Field / *Key prop, columns[].key, a query filter/sort field, or after item. in a binding ({{item.{{${t}}}}}); anywhere else the name prints as text`)
      }
    }
  }
  return out
}
