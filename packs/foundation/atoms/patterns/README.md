# patterns/ — the unit of meaning

A **pattern** is a proven block composition with a knowledge brief. It is the
layer the composer reasons in: blocks are raw material, surfaces are exemplars,
patterns are what a page is *made of*. A pattern may carry **data, behaviour
and state** as well as arrangement and copy — so the composer can read all
three, instead of data hiding inside self-fetching blocks.

## File shape

| field | required | meaning |
|---|---|---|
| `name` | yes | file stem; the id the composer uses (`page-header`) |
| `role` | yes | `shell` · `weave` · `band` · `part` · `layout` — structural (see below) |
| `body` | bands, weaves, shells | `flow` · `grid` · `dense` · `split` · `any` |
| `description` | yes | one line for humans |
| `provenPattern` | yes | where it was observed or measured, never a guess |
| `knowledge` | yes | `purpose`, `useCases[]`, `composesWith[]`, `antiPatterns[]` — the four fields the composer prompt ships; English |
| `mobileCollapse` | bands, weaves, shells | what the arrangement TURNS INTO on a narrow screen (shells derive it from `chrome × body`) |
| `placeholders` | yes | every UPPERCASE `{{SLOT}}` the pattern carries — in a snippet prop OR inside a wiring field; a value is a description string or a typed declaration (see "Typed slots") |
| `usesBlocks` | yes | every block type the snippet uses, no more, no less |
| `snippet` | yes | the block tree; ids are templated (`{{ID}}-h`) |
| `layoutOnly` | layout patterns | the literal `true`: this pattern is arrangement and copy BY INTENT and carries no wiring field (see "Wired or layout-only") |
| `dataSources[]` | data patterns | contracts `dataSourceSchema`: `{id, kind:'rest'|'static'|'state'|'entity', connector?, entityType?, endpoint?, query, fallback[]}` |
| `behaviors[]` | interactive patterns | contracts `surfaceBehaviorSchema`: `{id, event, targetBlockId?, actions[]}` |
| `initialState{}` | when the snippet reads OR writes `{{state.x}}` | every state key seeded — read via `{{state.x}}`, written via a control's `stateKey`, a behavior's `setState.key` or a form binding's `statusKeys` |
| `formBindings[]` | form patterns | `{formId, sourceId, statusKeys:{loading?, success?, error?, message?}}`: the form node that submits, the source it writes, the state keys the `form` block reads (`submittingWhen`, reset) — moved into `platform/entities` config (see "What the composer receives") |
| `requires.connectors[]` | data patterns | every connector the sources name |

## Wired or layout-only — never silently neither

Most patterns carry no wiring at all. Without a declaration nothing would say
which of them are layout by intent and which are a list page waiting for its
data. So a pattern declares one of two things, and the gate
(`tools/lib/wiring-rules.mjs`) checks it:

- **Wired** — it carries at least one of `dataSources`, `behaviors`,
  `initialState`, `formBindings`. The wiring is the pattern's CONSTANT, not the
  caller's: source ids, state keys, button actions, the four status cards'
  `visibleWhen`, repeat expressions, pager and form names are fixed in the
  file. Slots carry only what differs per app — endpoint, path, field names,
  page size, copy.
- **Layout-only** — `"layoutOnly": true`. A declaration, not a defect: the
  composer treats it as a content band and expects no data from it.

Gate rules, all in `tools/check-integrity.mjs` via `wiring-rules.mjs`:

| rule | verdict |
|---|---|
| neither wired nor `layoutOnly: true` | fail |
| both wired and `layoutOnly: true` | fail |
| `layoutOnly` anything but the literal `true` | fail |
| literal `"stateKey": "x"` in the snippet, `x` not in `initialState` | fail — a state key is a pattern constant; seed it |
| slot-valued `"stateKey": "{{X_STATE_KEY}}"` | reported — the key cannot be seeded by name (a state key is never a slot) |
| behavior `setState.key` or `formBindings[].statusKeys.*` not seeded | fail |
| `formBindings[].formId` not a snippet node id · `sourceId` not a declared source · status key outside `loading|success|error|message` | fail |
| `{{SLOT}}` inside a wiring field not declared in `placeholders` | fail (same rule as a snippet slot — it prints on the wire) |

## Typed slots

A `placeholders` value is either a description string (a `text` slot) or a
declaration:

```jsonc
"placeholders": {
  "{{TITLE}}": "heading.text — e.g. Products",                       // text slot
  "{{COLLECTION}}": { "description": "REST collection URL", "type": "url" },
  "{{RETURNS}}":    { "description": "path to the rows in the response", "type": "json-path", "optional": true },
  "{{ID_FIELD}}":   { "description": "the row field that identifies a record", "type": "field" }
}
```

`type` is one of `text` · `url` · `url-template` · `json-path` · `field` ·
`state-key`. The type tells whoever fills the slot what to put there, and a
composer can print it next to the slot (`COLLECTION (url)`); it changes
nothing about substitution. A consumer that reads a placeholder value as a
plain string must read `description` from the typed form.

## Rows and field slots

Every list source — `entity` (the app's own records), `rest` (any API), a
connector — delivers an **array of row objects** under its id, with the
source's own field names. Nothing renames fields between the source and the
block: a field is read where it is placed, either in a repeat template
(`{{item.title}}`) or through a block's field-mapping prop. So:

- **Rows are objects.** A source binds whole (`"items": "{{tasks}}"`) only to
  a prop that takes objects: `repeater` (`headingField`, `textField`,
  `subtitleField`, `badgeField`, `avatarField`, `iconField`, `ctaLabelField`,
  `ctaHrefField`, or a `repeat` template), `table` (`columns[].key`),
  `list` (`textField`), `calendar-month` (`dateField`, `labelField`,
  `colorField`), `chart` (`labelField`, `valueField`), `select` and
  `combobox` (`labelKey`, `valueKey`). Display blocks name a field with
  `*Field`, option pickers with `labelKey`/`valueKey`; each default is the
  name the block always read.
- **Field names come from the bound source's rows** — a sample the person
  supplied, the entity's declared fields, or the connector's documented row
  fields. Never guess one. In an app-entity pattern each field the pattern
  reads is a `field` slot, so the spot is explicit: in a mapping prop
  (`"headingField": "{{NAME_FIELD}}"`) or nested in a binding
  (`"{{item.{{DATE_FIELD}}}}"`, filled with `startsOn` it becomes
  `{{item.startsOn}}`). A pattern bound to a fixed connector shape writes
  the connector's field names literally.
- **The stand-in has the live shape.** The rows slot (`{{ROWS}}`, `{{TASKS}}`…)
  declares the row shape — field names and types — and its fallback is rows
  of that same object shape, never `string[]` when live rows are objects.

Gate rules (`rowFindings` in `tools/lib/wiring-rules.mjs`):

| rule | verdict |
|---|---|
| `{{<sourceId>}}` of an `entity`/`rest` source bound whole to a prop whose items are only strings/numbers (read from the block's manifest) | fail `rowsToScalarProp` |
| a literal fallback of an `entity`/`rest` source holds a non-object, and not every prop the source feeds takes strings | fail `fallbackNotRows` |
| a `field` slot used outside a field position (`*Field`/`*Key` prop, `columns[].key`, `query.filter.field`/`sort[].field`, after `item.` in a binding) | fail `fieldSlotPosition` |

## Roles are structural

- **band** — a page slab; the snippet is rooted in `section`.
- **part** — goes inside a band; rooted in `container`, `card`, `accordion`, `repeater`…
- **shell** — the frame the bands sit in; carries a slot placeholder (`{{MAIN}}`, `{{RAIL}}`…).
  A shell emits the page landmarks: `header` around the bar or brand (navbar draws its own),
  `main` around the page content (`container.landmark: "main"`), `footer` around the legal line,
  which shares the content column's left edge; the nav blocks keep their `<nav>`.
- **weave** — a body arrangement (`weave-*`) with a `{{BANDS}}` slot.
- **layout** — the app's layout receipt (`layout-*`): the frame every page is drawn in, written
  once as `app/layout.receipt.json` (`{"blocks": [<snippet>]}`). It holds exactly one bare page
  slot `{ "type": "pw:page" }` (no id needed, no props), where each page's blocks go; no other role
  may hold one. Its navbar and sidebar set no `activeHref`: the engine fills it (engine 3.5).

The gate checks the equivalence both ways: section-rooted ⇔ band.

## Slots vs bindings — two grammars that share braces

- **Slots** are UPPERCASE: `{{TITLE}}`, `{{ID}}`. Filled when the pattern is
  applied (composer `use-pattern`, a gallery, an app builder) and gone from
  the surface. Declared in `placeholders`; the gate fails an undeclared one.
- **Bindings** are lowercase: `{{alerts}}`, `{{state.offset}}`,
  `{{__loading.alerts}}`, `{{__errors.alerts}}`, `{{length(alerts)}}`,
  `{{sumBy(skus,'consumed')}}`. They survive into the surface and are resolved
  by the runtime on every render. A source binds as `{{<sourceId>}}` — an
  array for list sources. Not slots; the gate's slot regex is uppercase-only.

## Data patterns

A data-bound pattern declares its sources with **fallback rows**: a gallery
renders them without a host, and `__errors.<id>` stays set so the page is
honest about it. In this pack `avatar-group` reads the app's own records
that way. A data band builds its figures from `length` / `sumBy` over the
rows, and its controls DRIVE the query:

- `segmented-control` with `stateKey` writes `state.<key>`; the source's
  `query.filter.value: "{{state.<key>}}"` re-fetches.
- `pagination` with `stateKey` + `pageSize` writes the offset;
  `query.pagination.offset: "{{state.<key>}}"` pages the list.

Row-field filters, `sort` and `pagination` are applied by the source's
result envelope (`applyEntityQuery`).

## Form patterns

`contact-form`, `band-signup-form`, `form-card` and `band-auth-card` are the
form family's exemplars. Each writes a record through a form binding
(`formBindings`), and its status keys drive what the visitor sees: the form
while it is open, a spinner while it submits, the confirmation or the reason
it failed afterwards. `band-signup-form` is a list or profile step (a letter,
a waitlist, a profile after sign-in), never an account sign-up door; its
success key (`signupSent`) swaps the form for the verification card, and a
`form:submit` behavior on the code form (`signupVerified`) swaps that for
the confirmation.

## What the composer receives

`use-pattern` expands the snippet and moves `dataSources`, `behaviors` and
`initialState` into the surface's `platform/persistence` capability config
(prefixing ids on collision) and checks `requires.connectors` against the
project's connections — missing → a finding, and the fallback renders.
`formBindings` goes to the `platform/entities` capability config.

## Adding a pattern

Observed, not invented: two real occurrences before a file, and
`provenPattern` says where.
Run `pnpm check` (or `node tools/check-packs.mjs <pack>`) — it validates the
snippet against the catalogue, the slots against `placeholders`, the data
contract against the connectors the pack and its closure declare, and the knowledge brief against
the loader's shape.
