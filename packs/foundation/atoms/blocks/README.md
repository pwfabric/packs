# blocks/ — custom block atoms (SOURCE)

A block is `blocks/<family>/<name>/component.tsx` + a sibling `manifest.json`
(`AtomFileManifest`, defined in `@pwfabric/contracts`). Blocks are discovered
by convention: the directory IS the id (`<family>.<name>`), and
`tools/check-integrity.mjs` fails a manifest whose `id` / `category` / `name`
disagree with its path.

## The block law

**A block is a primitive. It never fetches and never knows a domain.**
Everything a block draws reaches it through props — a pattern's
`dataSources` binds `{{<sourceId>}}` — and everything it does leaves as a
surface event. This keeps the data visible to the composer, which can see,
change and re-point it. The gate fails any component that calls
`useConnectorEngine(`, `use*Bridge(` or `fetch(`.

A read-only view of remote data is therefore a data-bound pattern, not a
block; a control such as `like-button` is pure UI state (`liked`, `count` in,
`block:click {liked, itemId}` out).

## Families — by SHAPE, not by domain

The families across the catalogue (foundation carries most of them; heavier
blocks live in `widgets`):

| family | what it is | members |
|---|---|---|
| `text` | reading | heading, text, prose, alert, code |
| `media` | pictures and sound | image, gallery, video, embed, carousel, interactive-map |
| `layout` | arrangement | container, grid, section, split-view, navbar, app-rail, bottom-bar, announcement-bar, sidebar |
| `control` | one action | button, link, icon, badge, avatar, breadcrumb, divider, dropdown, pagination, copy-button, like-button, theme-toggle, language-switch |
| `form` | input | form, input, textarea, select, combobox, checkbox, radio, toggle, slider, date-input, number-stepper, otp-input, tag-input, file-dropzone, rich-text-editor, segmented-control |
| `data` | data made visible | table, repeater, list, definition-list, chart, progress, rating, skeleton, calendar-month, world-clock |
| `feedback` | status | toast, spinner, radial-progress |
| `overlay` | above the page | modal, drawer, popover, tooltip, command-palette |
| `container` | holds children with a grammar | card, accordion, tabs, tree-view |

A family groups blocks by what they ARE: a card, a modal and a calendar view
are three different things and live in three families. Older knowledge text
may still say `panel.<name>`; the integrity check resolves that prefix to the
current family.

Every block is placed by some pattern or surface; the coverage rule exempts
none.

## Controls that drive data

Two controls carry a declarative `setState` action in their event payload when
given a `stateKey`, so a pattern's data source can read the value back:

- `pagination` — `stateKey` + `pageSize`: writes `(page-1) × pageSize`; a
  source's `query.pagination.offset: "{{state.<key>}}"` pages the list.
- `segmented-control` — `stateKey`: writes the selected value; a source's
  `query.filter.value: "{{state.<key>}}"` filters it.

`table` reads `badgeColorMap` (`{ high: 'danger', medium: 'warning' }` → theme
tones) and `columnsFrom: 'data'` (derive columns from the first row — a
spreadsheet range's header row is its schema).

## Shell blocks carry the account

`navbar`, `bottom-bar` and `app-rail` accept an `account` prop that the
published-app runner injects (`{state: 'signed-in' | 'signed-out', name?,
email?, avatarSrc?, profileHref?, profileLabel?, links?, signInLabel?, signOutLabel?}`) —
never authored in a pattern or receipt. All three render it through ONE
component, `_shared-account-menu.tsx` (WAI-ARIA menu button; popover in the
navbar and rail, bottom sheet in bar shapes), and emit
`payload.action {type: 'auth:signIn' | 'auth:signOut'}` for the runner to
handle. In a bar the account is always the last of ≤ 5 targets: an item
routing to `profileHref` (trailing slash / query ignored) is folded into it,
otherwise it takes the 5th slot. The menu's Profile entry is labelled by the
folded tab's own label if there is one, then `profileLabel`, then "Profile".
A fixed bottom bar publishes
`--pw-bottom-bar-height` on the document root while mounted. The gate checks
the manifests declare the prop and the components use the shared menu.

## Role — the catalogue's second axis

Every manifest carries exactly one role tag, `tier:<role>` in `tags`:
**structure**, **data**, **content** or **widget**. A composer uses it to
decide whether to describe a block in full or as a one-line index entry. The
gate requires it.

## Engine defaults and block declarations

- `sizing: 'intrinsic'` — compact controls (avatar, badge, icon, button, link,
  like/copy-button, dropdown, pagination, toggle, checkbox, radio,
  number-stepper, segmented-control, rating, spinner, radial-progress) declare
  it statically on the component, and the runtime gives them `flex: 0 0 auto`
  in a row. The engine memorises no block names.
- `container` padding — a container that paints a ground (colour / border /
  gradient) defaults to 16, a pure arrangement container to 0; an explicit
  `padding` always wins.
- Theme tokens — every emitted `--pw-*` variable has a consumer in this
  directory (see `../appearance/README.md`).

## Block or pattern?

A thing is a **block** only if it has runtime behaviour, render logic JSON
cannot express (array→N, cell types, a chart, a ticking clock), or an
a11y/theme contract that must live in one place. Pure
arrangement is a **pattern** (`../patterns/`). The catalogue carries 70
blocks: 53 in foundation and 17 in widgets (`pack-map.json`).

## Label weight follows the theme voice

`badge` and `button` read `var(--pw-font-weight-heading, 600)` instead of a
fixed weight: a fixed weight makes every theme's controls look alike, while a
theme's heading weight ranges from 400 to 800.

## Unfilled slots keep the layout

A host may write a placeholder image (`data:image/svg+xml` carrying
`pw-placeholder:<key>`) into a declared image slot and swap the real picture
in later — so an unfilled slot is a normal LIVE state. `image` draws its
themeable slot live too (quiet: no text) for an empty or placeholder src,
exposes the key as `data-pw-placeholder`, and — with no `aspectRatio` or
`height` — takes the placeholder SVG's own ratio so nothing moves when the
picture arrives. A broken src shows the quiet slot live as well (the layout
holds); `hideWhenEmpty` removes the slot in every case.

## Selected states, shells, motion and theme sizes

- **Selected is a change of kind.** `badge` `primary` is filled — brand fill,
  `--pw-color-text-on-primary` label, a 2px inset edge in
  `--pw-color-primary-ink` — and `default` is empty (transparent, control
  edge, muted ink). The chosen `segmented-control` pill speaks the same
  language. In every preset, light and derived dark, the selected shape
  clears 3:1 against the ground and the unselected neighbour, and the label
  4.5:1. `badge` takes `status` + `variantMap` so a badge bound to data picks
  its variant per value.
- **segmented-control.** Boolean options (`value: true/false`, or
  `valueType: "boolean"`) write real booleans to state and submit them through
  `form.form` (a hidden input marked `data-pw-value-type="boolean"`, which the
  form honours — `toggle` does the same). `allowNone` (default for a
  one-option control) starts with nothing lit, and a second click clears the
  answer.
- **Destructive ink.** `inkOn()` (`lib/_shared-utils.ts`) picks black or
  white by the ground's own luminance in CSS (relative colour, srgb-linear),
  after `--pw-color-on-error` when a theme sets it: ≥ 4.58:1 on any fill.
- **Shells.** Every shell root carries `widthScope: viewport`, so the runtime
  lifts the whole frame out of the padded 1280px measure box: the navbar meets
  the top edge at full width, the bottom bar, the rail and the footer span the
  screen. Content sits in `{{ID}}-content` (rail and composite shells: the
  work area) — theme max width, centred, inline gutter
  `max(16px, --pw-layout-surface-padding)`. The slot is `{{ID}}-main`.
- **Theme sizes.** `text` has no 14px default (the theme body size applies);
  `card` takes `--pw-border-radius-lg`; badge corners and sizes come from the
  theme scale.
- **Motion.** `MOTION` tokens: state changes at `--pw-duration-normal`,
  panels and entrances at `--pw-duration-slow`, presses, chevrons and the
  toast entrance on `--pw-easing-bounce`. Zero durations mean no motion; the
  runtime's reduced-motion gate still applies.
- **split-view** reads records through `idKey` / `titleKey` / `metaKey`
  / `excerptKey` / `bodyKey` / `entriesKey`; `autoSelect` (off when an
  `emptyLabel` is given) stops it forcing the first row.
- **repeater** `layout: "inline"` wraps items (or repeated template
  children) as chips.

## Narrow-viewport text

Checked on a 390px-wide viewport.

- **A badge label is one line.** `badge` renders `white-space: nowrap` and
  `flex-shrink: 0`, so a long label such as "1 · Personal details" never
  breaks onto several lines outside the pill. A narrow row wraps whole badges
  instead — give the row container `wrap: true`, as the `stepper` part does.
- **A long word breaks instead of overflowing.** `heading`, `text` and
  `prose` carry `overflow-wrap: anywhere` and `min-width: 0`, so one long word
  at a large type step cannot push the content box wider than the viewport.
  The word breaks only when it cannot fit on its own line; font sizes are
  unchanged.
