/**
 * The pattern wiring rules (tools/lib/wiring-rules.mjs),
 * each proven both ways: the defective shape must be reported, the
 * fixed shape must pass. The same rules run inside tools/check-integrity.mjs
 * on every pack.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — a zero-dependency .mjs with no type declarations
import { wiringFindings, rowFindings, rowsReceiver, isWired, wiringSlotTokens, slotDeclarations, stateKeysOf, SLOT_TYPES } from '../lib/wiring-rules.mjs'

type Finding = { rule: string; severity: 'fail' | 'warn'; msg: string }
const rules = (p: unknown) => (wiringFindings(p) as Finding[]).map((f) => `${f.severity}:${f.rule}`)

const section = (children: unknown[] = []) => ({ id: '{{ID}}', type: 'section', props: {}, children })

// A static band with neither a wiring field nor the marker.
const hero = { name: 'hero', role: 'band', placeholders: { '{{HEADLINE}}': 'main heading' }, snippet: section([{ id: '{{ID}}-h', type: 'heading', props: { text: '{{HEADLINE}}' } }]) }

describe('wired ⊕ layoutOnly', () => {
  it('fails a pattern that is neither', () => {
    expect(rules(hero)).toEqual(['fail:unwired'])
  })
  it('passes the marker, and passes wiring', () => {
    expect(rules({ ...hero, layoutOnly: true })).toEqual([])
    expect(rules({ ...hero, initialState: {} })).toEqual([])
    expect(isWired({ ...hero, initialState: {} })).toBe(true)
    expect(isWired(hero)).toBe(false)
  })
  it('fails the contradiction and a non-literal marker', () => {
    expect(rules({ ...hero, layoutOnly: true, dataSources: [] })).toEqual(['fail:contradiction'])
    expect(rules({ ...hero, layoutOnly: false })).toEqual(['fail:layoutOnlyShape', 'fail:unwired'])
  })
})

describe('stateKey is a pattern constant', () => {
  // A settings form: segmented-control stateKey "density", initialState {submitting:false}.
  const form = (initialState: Record<string, unknown>) => ({
    ...hero,
    initialState,
    snippet: section([{ id: '{{ID}}-d', type: 'segmented-control', props: { name: 'density', stateKey: 'density' } }]),
  })
  it('fails a literal stateKey the pattern never seeds', () => {
    expect(rules(form({ submitting: false }))).toEqual(['fail:stateKeyUnseeded'])
  })
  it('passes once initialState seeds it', () => {
    expect(rules(form({ submitting: false, density: '' }))).toEqual([])
  })
  it('reports a slot-valued stateKey (cannot be seeded by name) without failing', () => {
    const p = { ...hero, initialState: {}, placeholders: { '{{SEARCH_STATE_KEY}}': 'state key' }, snippet: section([{ id: '{{ID}}-s', type: 'input', props: { stateKey: '{{SEARCH_STATE_KEY}}' } }]) }
    expect(rules(p)).toEqual(['warn:stateKeySlot'])
    expect(stateKeysOf(p.snippet)).toEqual({ literal: [], slot: ['{{SEARCH_STATE_KEY}}'] })
  })
})

describe('every written key is seeded', () => {
  const withBehavior = (initialState: Record<string, unknown>) => ({
    ...hero,
    initialState,
    behaviors: [{ id: '{{ID}}-on-save', event: 'form:submit', targetBlockId: '{{ID}}-form', actions: [{ type: 'setState', key: 'submitted', value: true }] }],
  })
  it('fails a behavior writing an unseeded key, passes a seeded one', () => {
    expect(rules(withBehavior({}))).toEqual(['fail:writeUnseeded'])
    expect(rules(withBehavior({ submitted: false }))).toEqual([])
  })
})

describe('formBindings — the shape a form binding takes', () => {
  const ladder = (fb: Record<string, unknown>, initialState: Record<string, unknown> = { sendLoading: false, sendSuccess: false, sendError: false, sendReason: '', sendFields: [] }) => ({
    ...hero,
    initialState,
    dataSources: [{ id: 'records', kind: 'entity', entityType: '{{ENTITY}}' }],
    formBindings: [fb],
    placeholders: { ...hero.placeholders, '{{ENTITY}}': 'entity type' },
    snippet: section([{ id: '{{ID}}-form', type: 'form', props: {}, children: [] }]),
  })
  const good = { formId: '{{ID}}-form', sourceId: 'records', statusKeys: { loading: 'sendLoading', success: 'sendSuccess', error: 'sendError', reason: 'sendReason', fields: 'sendFields' } }

  it('passes the kit binding', () => {
    expect(rules(ladder(good))).toEqual([])
  })
  it('fails a form the snippet does not contain', () => {
    expect(rules(ladder({ ...good, formId: '{{ID}}-other' }))).toEqual(['fail:formBindingsForm'])
  })
  it('fails a source the pattern does not declare', () => {
    expect(rules(ladder({ ...good, sourceId: 'items' }))).toEqual(['fail:formBindingsSource'])
  })
  it('fails a status key the form block does not read, and an unseeded one', () => {
    expect(rules(ladder({ ...good, statusKeys: { busy: 'sendLoading' } }))).toEqual(['fail:formBindingsStatus'])
    // the 2.x message key binds nothing on 3.0
    expect(rules(ladder({ ...good, statusKeys: { ...good.statusKeys, message: 'sendMessage' } }, { sendLoading: false, sendSuccess: false, sendError: false, sendReason: '', sendFields: [], sendMessage: '' }))).toEqual(['fail:formBindingsStatus'])
    expect(rules(ladder(good, { sendLoading: false }))).toEqual(['fail:writeUnseeded', 'fail:writeUnseeded', 'fail:writeUnseeded', 'fail:writeUnseeded'])
  })
  it('fails a non-array', () => {
    expect(rules({ ...hero, formBindings: {} })).toEqual(['fail:formBindingsShape'])
  })
})

describe('typed slots', () => {
  it('a bare string is a text slot; an object declares its kind', () => {
    const d = slotDeclarations({ placeholders: { '{{TITLE}}': 'heading', '{{COLLECTION}}': { description: 'REST collection URL', type: 'url' }, '{{RETURNS}}': { description: 'rows path', type: 'json-path', optional: true } } })
    expect(d.TITLE).toMatchObject({ description: 'heading', type: 'text', optional: false })
    expect(d.COLLECTION).toMatchObject({ type: 'url', optional: false })
    expect(d.RETURNS).toMatchObject({ type: 'json-path', optional: true })
  })
  it('passes every declared kind, fails an unknown one and a missing description', () => {
    for (const type of SLOT_TYPES as string[]) {
      expect(rules({ ...hero, layoutOnly: true, placeholders: { '{{X}}': { description: 'x', type } } })).toEqual([])
    }
    expect(rules({ ...hero, layoutOnly: true, placeholders: { '{{X}}': { description: 'x', type: 'colour' } } })).toEqual(['fail:slotTypeUnknown'])
    expect(rules({ ...hero, layoutOnly: true, placeholders: { '{{X}}': { type: 'url' } } })).toEqual(['fail:slotTypeShape'])
    expect(rules({ ...hero, layoutOnly: true, placeholders: { '{{X}}': 3 } })).toEqual(['fail:slotTypeShape'])
  })
})

describe('slots inside wiring fields', () => {
  it('finds the uppercase tokens a source carries', () => {
    const p = { dataSources: [{ id: 'items', kind: 'rest', endpoint: '{{COLLECTION}}?limit={{PAGE_SIZE}}&skip={{state.skip}}', returns: '{{RETURNS}}' }], initialState: { skip: 0 } }
    expect([...wiringSlotTokens(p)].sort()).toEqual(['COLLECTION', 'PAGE_SIZE', 'RETURNS'])
    expect([...wiringSlotTokens({ snippet: { props: { x: '{{NOT_SCANNED}}' } } })]).toEqual([])
  })
})

describe('rows — a row source lands where objects are read', () => {
  // The receiving props, as their manifests describe them.
  const SCHEMAS: Record<string, Record<string, unknown>> = {
    'list-strings': { items: { type: 'array', items: { type: 'string' } } },
    list: { items: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'object', additionalProperties: {} }] } } },
    repeater: { items: { type: 'array', items: { type: 'object', additionalProperties: {} } } },
    text: { content: { type: 'string' } },
  }
  const schemaOf = (type: string, prop: string) => SCHEMAS[type]?.[prop]
  const rowRules = (p: unknown) => (rowFindings(p, schemaOf) as Finding[]).map((f) => `${f.severity}:${f.rule}`)
  const tasks = (node: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    ...hero,
    dataSources: [{ id: 'tasks', kind: 'entity', entityType: '{{ENTITY}}', fallback: '{{TASKS}}' }],
    snippet: section([node]),
    ...extra,
  })

  it('reads the receiving prop from its schema', () => {
    expect(rowsReceiver(SCHEMAS['list-strings'].items)).toBe('scalars')
    expect(rowsReceiver(SCHEMAS.list.items)).toBe('rows')
    expect(rowsReceiver(SCHEMAS.text.content)).toBe('scalars')
    expect(rowsReceiver(undefined)).toBe('unknown')
  })

  it('rowsToScalarProp: fails rows bound to a string-only list, passes a prop that takes objects', () => {
    expect(rowRules(tasks({ id: '{{ID}}-l', type: 'list-strings', props: { items: '{{tasks}}' } }))).toEqual(['fail:rowsToScalarProp'])
    expect(rowRules(tasks({ id: '{{ID}}-l', type: 'text', props: { content: '{{tasks}}' } }))).toEqual(['fail:rowsToScalarProp'])
    expect(rowRules(tasks({ id: '{{ID}}-l', type: 'list', props: { items: '{{tasks}}', textField: 'title' } }))).toEqual([])
    expect(rowRules(tasks({ id: '{{ID}}-l', type: 'repeater', repeat: '{{tasks}}', props: { items: '{{tasks}}' }, children: [] }))).toEqual([])
  })

  it('rowsToScalarProp: a static source carries data the pattern wrote and is not judged', () => {
    const p = tasks({ id: '{{ID}}-l', type: 'list-strings', props: { items: '{{tasks}}' } })
    expect(rowRules({ ...p, dataSources: [{ id: 'tasks', kind: 'static', fallback: ['a'] }] })).toEqual([])
  })

  it('fallbackNotRows: fails a string stand-in for object rows, passes object rows', () => {
    const repeat = { id: '{{ID}}-l', type: 'repeater', repeat: '{{tasks}}', props: { items: '{{tasks}}' }, children: [] }
    const withFallback = (fallback: unknown[]) => ({ ...tasks(repeat), dataSources: [{ id: 'tasks', kind: 'rest', endpoint: '{{URL}}', fallback }] })
    expect(rowRules(withFallback(['Ship it', 'Write notes']))).toEqual(['fail:fallbackNotRows'])
    expect(rowRules(withFallback([{ title: 'Ship it' }]))).toEqual([])
  })

  it('fallbackNotRows: strings pass only where every receiving prop takes strings', () => {
    const intoList = { ...tasks({ id: '{{ID}}-l', type: 'list', props: { items: '{{tasks}}' } }), dataSources: [{ id: 'tasks', kind: 'entity', entityType: 'Task', fallback: ['Ship it'] }] }
    expect(rowRules(intoList)).toEqual([])
    const unbound = { ...intoList, snippet: section([]) }
    expect(rowRules(unbound)).toEqual(['fail:fallbackNotRows'])
  })

  it('fieldSlotPosition: a field slot sits in a *Field prop, after item., or in a filter field', () => {
    const slots = { '{{TITLE_FIELD}}': { description: 'the row field holding the title', type: 'field' } }
    const ok = tasks(
      {
        id: '{{ID}}-l', type: 'repeater', repeat: '{{tasks}}', props: { items: '{{tasks}}', headingField: '{{TITLE_FIELD}}' },
        children: [{ id: '{{ID}}-t', type: 'text', props: { content: '{{item.{{TITLE_FIELD}}}} · {{item.data.{{TITLE_FIELD}}}}' } }],
      },
      { placeholders: slots }
    )
    expect(rowRules(ok)).toEqual([])
    const filtered = { ...ok, dataSources: [{ id: 'tasks', kind: 'entity', entityType: 'Task', fallback: [], query: { filter: { field: '{{TITLE_FIELD}}', operator: 'eq', value: 'x' } } }] }
    expect(rowRules(filtered)).toEqual([])
  })

  it('fieldSlotPosition: fails a field slot printed as text, or inside a non-field prop', () => {
    const slots = { '{{TITLE_FIELD}}': { description: 'the row field holding the title', type: 'field' } }
    const asText = tasks({ id: '{{ID}}-t', type: 'text', props: { content: 'Sorted by {{TITLE_FIELD}}' } }, { placeholders: slots })
    expect(rowRules(asText)).toEqual(['fail:fieldSlotPosition'])
    const asState = tasks({ id: '{{ID}}-t', type: 'input', props: { stateKey: '{{TITLE_FIELD}}' } }, { placeholders: slots })
    expect(rowRules(asState)).toEqual(['fail:fieldSlotPosition'])
    // A text slot is free to sit anywhere.
    expect(rowRules({ ...asText, placeholders: { '{{TITLE_FIELD}}': 'title' } })).toEqual([])
  })
})
