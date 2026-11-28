#!/usr/bin/env node
/**
 * Catalogue + pattern integrity check.
 *
 * WHY IT EXISTS. A pack is mostly JSON — manifests, patterns, surfaces — and a
 * build, typecheck or unit test says nothing about whether that JSON agrees with
 * itself. A change that adds a block, alters a block contract or writes new
 * patterns can be wrong in ways no compiler sees; this check is where those
 * mistakes surface.
 *
 * WHAT IT DOES NOT DO — on purpose. It does not render. Render-side validation
 * belongs to the consumer that assembles apps from the published pack; a
 * second, weaker copy of it here would add nothing. What a render check cannot
 * do is catch source-side drift BEFORE publish — and a pack can reach its users
 * by routes no render check ever sees.
 *
 * The defect class this catches is the silent one: an unknown block type is
 * skipped at render, an unknown prop is ignored, and a wrong `usesBlocks` misleads
 * a human or the composer without ever throwing. Nothing downstream reports it.
 *
 * Run through tools/check-packs.mjs, which passes the roots the pack map derives.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomsDir, libDir, familyDir, surfacesDir, surfaceDirs } from './lib/pack-layout.mjs'
import { resolvedThemes } from './theme-bases.mjs'
import {
  itemScopeFindings,
  formFieldFindings,
  styleParenFindings,
  inlineOutlineFindings,
} from './lib/source-rules.mjs'
import { isWired, wiringFindings, rowFindings, wiringSlotTokens, slotDeclarations, WIRING_FIELDS } from './lib/wiring-rules.mjs'

/**
 * A block's role WHEN AN APP IS COMPOSED. A composer uses it to decide whether
 * to describe a block in FULL or as a one-line index entry; so this list
 * decides which blocks a model can really use well.
 */
export const BLOCK_ROLES = ["structure", "data", "content", "widget"]

/**
 * WHICH PACK IS BEING CHECKED — and against what.
 *
 * Packs are layered: a pack's patterns may place blocks that live in another
 * pack (often the floor, `foundation`), and some packs carry patterns with no
 * blocks of their own. So the check takes its inputs as flags, derived from
 * `pack-map.json` by tools/check-packs.mjs, never guessed here:
 *   --pack <dir>              the pack under test; its patterns and surfaces
 *   --resolve-against <dirs>  extra pack roots whose blocks may be referenced
 *   --shown-by <dirs>         packs built on this one (see SHOWN_BY below)
 *
 * Only `--pack`'s own patterns/surfaces/blocks are JUDGED. The resolve-against
 * roots are read for RESOLUTION only — judging them here as well would report
 * the floor's problems under another pack's name.
 */
const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i === -1 || i + 1 >= argv.length ? null : argv[i + 1]
}
if (!flag('--pack')) {
  console.error('usage: node tools/check-integrity.mjs --pack packs/<name> [--resolve-against <dirs>] [--shown-by <dirs>]')
  console.error('       node tools/check-packs.mjs runs it for every pack with the flags the map derives')
  process.exit(2)
}
const ROOT = resolve(flag('--pack'))
// The canonical pack folder: families under atoms/, shared code under
// atoms/lib/, a demo site's pages under app/surfaces/ (see lib/pack-layout.mjs).
const ATOMS = atomsDir(ROOT)
const LIB = libDir(ROOT)
const BLOCKS = join(ATOMS, 'blocks')
const PATTERNS = join(ATOMS, 'patterns')
const SURFACES = surfacesDir(ROOT)
/** Borrowed pack roots — read for RESOLUTION only, never judged. */
const BORROWED = (flag('--resolve-against') ?? '')
  .split(',')
  .filter(Boolean)
  .map((p) => resolve(p))
/**
 * DEPENDENT pack roots — read only for the "block nobody places" coverage
 * rule, never judged.
 *
 * Once packs are layered, the pattern that places a block often lives in
 * ANOTHER pack: a floor block may be shown only by a pattern or surface in a
 * pack built on top of it. Looking only at its own patterns, the gate would
 * reject such a block as "placed by nothing" — yet it is placed, one layer up.
 * The root list is DERIVED from `pack-map.json` (every pack that carries this
 * one in its closure) and passed in by tools/check-packs.mjs; it is never
 * guessed here.
 */
const SHOWN_BY = (flag('--shown-by') ?? '')
  .split(',')
  .filter(Boolean)
  .map((p) => resolve(p))
/** The directories an atom family is read from: borrowed roots first, the pack itself last. */
const partRoots = (part) =>
  [...BORROWED.map((r) => familyDir(r, part)), familyDir(ROOT, part)].filter((d) => existsSync(d))
const BLOCK_ROOTS = partRoots('blocks')
const PATTERN_ROOTS = partRoots('patterns')

const problems = []
const warnings = []
const fail = (where, msg) => problems.push(`${where}: ${msg}`)
/** Reported, never fatal: a rule whose source is known to be incomplete. */
const warn = (where, msg) => warnings.push(`${where}: ${msg}`)
const rel = (p) => relative(ROOT, p).replace(/\\/g, '/')

const PACK_ID = basename(ROOT)
const ruleFinding = (where, msg) => fail(where, msg)


/** A component's source against the two source rules. */
function checkComponentSource(path) {
  const src = readFileSync(path, 'utf8')
  for (const f of styleParenFindings(src)) {
    ruleFinding(
      rel(path),
      `line ${f.line}: CSS string "${f.text.slice(0, 70)}" does not balance its parentheses — ` +
        `an unclosed color-mix( drops the declaration in a browser and swallows the rest of the style attribute in server rendering (use tint() from _shared-utils)`
    )
  }
  for (const f of inlineOutlineFindings(src)) {
    ruleFinding(
      rel(path),
      `line ${f.line}: inline ${f.text} — it overrides the runtime's zero-specificity focus ring, so keyboard focus disappears; remove it (draw a :focus-within ring if the box needs one)`
    )
  }
}

/** Pattern/surface trees against the two tree rules. */
function checkTreeRules(file, tree, path) {
  for (const f of itemScopeFindings(tree, path)) {
    ruleFinding(
      file,
      `${f.path} reads {{item.…}} but no ancestor carries a block-level "repeat" — without it the template renders ONCE, outside any item (one ghost row). Write "repeat": "{{source}}" on the repeater`
    )
  }
  const isField = (type) => catalogue.get(type)?.traits?.has('form-field') ?? false
  for (const f of formFieldFindings(tree, isField, path)) {
    ruleFinding(
      file,
      f.kind === 'unnamed'
        ? `${f.path} is a form field inside a form with no "name" — its value never reaches the submitted record`
        : `${f.path} reuses the name "${f.name}" inside one form — two fields fighting over a name overwrite each other (only a checkbox group may share one)`
    )
  }
}

// ── the catalogue ────────────────────────────────────────────────────────────
/** type -> { id, file, props:Set, schema:Map<name,jsonSchema>, canHaveChildren } */
const catalogue = new Map()
const seenIds = new Map()

/**
 * Every block type any pattern or surface actually places. Filled by `walk`,
 * read once at the end by the coverage gate. See the gate itself for why.
 */
const COVERED = new Set()

/**
 * The icon canon. `icons/icons.json` is the single name→path source and it
 * forbids invented names: a name outside the canon renders an empty circle with
 * NO error and NO warning — even a real Lucide name (`shield-check`) renders
 * blank if the canon does not carry it.
 */
const ICONS = (() => {
  // The canon lives in the floor (`foundation`); patterns of a pack that builds
  // on the floor are checked against it too. Reading only the pack's own
  // `atoms/icons` would leave those patterns' icon names unchecked.
  const f = partRoots('icons').map((d) => join(d, 'icons.json')).find((x) => existsSync(x)) ?? join(ATOMS, 'icons', 'icons.json')
  if (!existsSync(f)) return null
  try {
    return new Set(Object.keys(JSON.parse(readFileSync(f, 'utf8')).icons ?? {}))
  } catch {
    return null
  }
})()

function readCatalogue() {
  if (!BLOCK_ROOTS.length) {
    return fail('atoms/blocks', 'no block directory in this pack or its resolve-against roots')
  }
  for (const blocksDir of BLOCK_ROOTS) readCatalogueFrom(blocksDir, blocksDir === BLOCKS)
  // Shared component files (_shared-account-menu.tsx…, under atoms/lib/)
  // render inside blocks too, so the source rules read them as well.
  for (const dir of [BLOCKS, LIB]) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.tsx')) checkComponentSource(join(dir, f))
    }
  }
}

function readCatalogueFrom(BLOCKS, own) {
  for (const category of readdirSync(BLOCKS)) {
    const catDir = join(BLOCKS, category)
    if (!statSync(catDir).isDirectory()) continue
    for (const entry of readdirSync(catDir)) {
      const dir = join(catDir, entry)
      if (!statSync(dir).isDirectory()) continue

      const manifestPath = join(dir, 'manifest.json')
      const componentPath = join(dir, 'component.tsx')
      // Blocks are discovered by CONVENTION — there is no barrel file — so a
      // directory missing either half is invisible rather than broken.
      if (!existsSync(manifestPath)) { fail(rel(dir), 'no manifest.json'); continue }
      if (!existsSync(componentPath)) fail(rel(dir), 'no component.tsx')

      let m
      try {
        m = JSON.parse(readFileSync(manifestPath, 'utf8'))
      } catch (e) {
        fail(rel(manifestPath), `unparseable — ${e.message}`)
        continue
      }

      const expectedId = `${category}.${entry}`
      if (m.id !== expectedId) {
        fail(rel(manifestPath), `id is "${m.id}" but its path says "${expectedId}"`)
      }
      if (m.category !== category) {
        fail(rel(manifestPath), `category is "${m.category}" but it lives under "${category}"`)
      }
      if (m.name !== entry) {
        fail(rel(manifestPath), `name is "${m.name}" but its directory is "${entry}"`)
      }
      /**
       * ROLE — the catalogue's second axis (category = identity, role = the job
       * this block does when an app is composed). It decides how a composer
       * spends its prompt budget: a role is described in full or as one index
       * line, and a block the model only sees as one line is a block it uses
       * badly.
       *
       * IT LIVES HERE, IN THE PACK, AND AS A TAG. Two reasons. A top-level
       * `tier` key is not part of AtomFileManifestSchema, which is strict, so
       * it fails validation and nothing would consume it. And a role kept
       * anywhere else — a consumer's own by-name dictionary — drifts both
       * ways: real blocks go missing from it and are silently demoted to
       * one-liners, while entries outlive the blocks they name.
       *
       * One declaration, owned by the pack that owns the block, in a field the
       * contract allows.
       */
      const roles = (m.tags ?? []).filter((t) => String(t).startsWith('tier:'))
      const role = roles[0]?.slice('tier:'.length)
      if (roles.length !== 1 || !BLOCK_ROLES.includes(role)) {
        fail(
          rel(manifestPath),
          `tags must carry exactly one role — one of ${BLOCK_ROLES.map((r) => `tier:${r}`).join(' | ')} (found: ${roles.join(', ') || 'none'})`
        )
      }
      if ('tier' in m) {
        fail(rel(manifestPath), 'the "tier" key is not part of AtomFileManifestSchema — declare the role as a tag instead')
      }
      if (seenIds.has(m.id)) {
        fail(rel(manifestPath), `duplicate id "${m.id}" — also in ${seenIds.get(m.id)}`)
      } else {
        seenIds.set(m.id, rel(manifestPath))
      }

      // `knowledge.purpose` IS ONE LINE, AND EVERY CALL PAYS FOR IT.
      //
      // The composer prompt ships exactly four knowledge fields per block —
      // purpose, useCases, composesWith, antiPatterns — and it ships them for
      // EVERY block on EVERY call. The field's contract is "one line of
      // purpose": what the block is FOR, so the model can decide WHEN to reach
      // for it. It is not the place for the block's build spec — the composer
      // cannot change a block's internals, only place it and set its props.
      // Endpoints, HTTP verbs, request bodies, colour names and animation
      // states in `purpose` all ship on every composer call, and none of it is
      // actionable.
      //
      // This is a gate rather than a one-off cleanup because the failure is
      // structural: a generated atom tends to have its author write the
      // component, then pour the spec it just wrote into `purpose`.
      //
      // The spec has a home: `knowledge.implementation`. That field is not one
      // of the four the prose generator reads, so it costs nothing per call
      // while staying with the atom it describes.
      // 600 chars ≈ 150 tokens. Set well ABOVE the catalogue's own habit
      // (median purpose ≈ 22 tokens, typical average ≈ 31) rather than at it:
      // the point is to stop a build spec landing here, not to police a long
      // sentence. A build spec overshoots by multiples, not by a margin.
      const PURPOSE_MAX_CHARS = 600
      const purpose = m.knowledge?.purpose
      if (typeof purpose === 'string' && purpose.length > PURPOSE_MAX_CHARS) {
        fail(
          rel(manifestPath),
          `knowledge.purpose is ${purpose.length} chars (~${Math.ceil(purpose.length / 4)} tokens) — ` +
            `the field is one line of PURPOSE and ships on every composer call. ` +
            `Move build detail to "knowledge.implementation" (not sent to the model).`
        )
      }

      // Every block root declares `data-block-type`. Without it a rendered
      // block has no id to target and is invisible to any tool that walks
      // `[data-block-type]` (selection in an editor, tests, analytics).
      if (existsSync(componentPath) && !readFileSync(componentPath, 'utf8').includes('data-block-type')) {
        fail(rel(componentPath), 'root declares no data-block-type — the block renders but cannot be addressed')
      }

      // A BLOCK NEVER FETCHES. Everything a block draws must reach it through
      // props — a pattern's `dataSources` binds `{{<sourceId>}}` — so the
      // composer can see, change and re-point the data. No block owns a
      // connection; a source that needs a connector ships as a pattern beside
      // that connector, in the connector's pack.
      // Comment lines are skipped so prose quoting the rule is not a hit.
      if (existsSync(componentPath)) {
        const hit = readFileSync(componentPath, 'utf8')
          .split(String.fromCharCode(10))
          .map((line, i) => ({ line, i }))
          .filter(({ line }) => !/^\s*(\*|\/\/|\/\*)/.test(line))
          .map(({ line, i }) => ({ i, m: line.match(/useConnectorEngine\(|use[A-Z]\w*Bridge\(|\bfetch\(/) }))
          .find(({ m }) => m)
        if (hit) {
          fail(
            rel(componentPath),
            `line ${hit.i + 1} calls ${hit.m[0]}… — a block never fetches. Data reaches a block through a pattern's ` +
              `dataSources ({{sourceId}} binding); no block owns a connection.`
          )
        }
      }

      const def = m.definition ?? {}
      const traits = new Set(def.traits ?? [])

      // A FORM FIELD IS BORN WITHOUT A NAME. With a default name ("field",
      // "select", "message"), two fields left unnamed collide in the payload and
      // the last one wins, silently. The author names each field.
      if (own && traits.has('form-field') && def.defaultProps && typeof def.defaultProps.name === 'string') {
        ruleFinding(
          rel(manifestPath),
          `defaultProps.name is "${def.defaultProps.name}" — a form field is born unnamed; a default name makes two unnamed fields collide in the submitted record`
        )
      }
      if (own && existsSync(componentPath)) checkComponentSource(componentPath)

      // Keyed by the SHORT type, because that is what a surface/pattern writes.
      catalogue.set(m.name, {
        id: m.id,
        file: rel(manifestPath),
        props: new Set((def.props ?? []).map((p) => p.name)),
        schema: new Map((def.props ?? []).map((p) => [p.name, p.jsonSchema])),
        canHaveChildren: Boolean(def.canHaveChildren),
        traits,
        // Does this block belong to THIS pack, or was it borrowed for resolution
        // only? Coverage rules (orphans, shell accounting) judge own atoms only
        // — looking for a borrowed block's home is auditing the neighbour.
        own,
      })
    }
  }
}

// ── the patterns ─────────────────────────────────────────────────────────────
/**
 * Prop VALUES, not just prop names. Name-only validation would pass an
 * accordion that omits the required item `id` (duplicate DOM ids and a dead
 * aria-controls on every row) or a map that supplies `name`/`address` where the
 * block reads `label`/`lat`/`lng` — both silent at render.
 *
 * Deliberately shallow: array-item keys, enums, and the icon canon. It is not a
 * JSON Schema validator and should not become one — the shapes it checks are the
 * ones known to fail quietly.
 */
/** `{{HEADING}}` and friends are template slots, never real values. */
const isPlaceholder = (v) => typeof v === 'string' && /^\{\{.*\}\}$/.test(v.trim())

function checkValue(file, path, block, prop, value) {
  if (isPlaceholder(value)) return
  const schema = block.schema.get(prop)

  // The icon canon — by convention any prop literally named `icon`.
  if (prop === 'icon' && ICONS && typeof value === 'string' && value && !ICONS.has(value)) {
    fail(file, `${path} = "${value}" is not in the icon canon (atoms/icons/icons.json) — it renders an empty circle`)
  }
  if (!schema) return

  // WARNING, not a failure. This reads only a top-level `enum`; a union
  // (`anyOf`, e.g. control.icon's size: an enum, a string or a number) is
  // `pwf validate`'s to judge, which reads the whole prop shape. The mismatch
  // is still worth printing.
  if (Array.isArray(schema.enum) && value !== undefined && !schema.enum.includes(value)) {
    warn(file, `${path} = ${JSON.stringify(value)} is outside [${schema.enum.join(', ')}] — check whether the manifest describes the full union`)
  }

  const items = schema.type === 'array' ? schema.items : undefined
  if (!items?.properties || !Array.isArray(value)) return

  // An open item schema (`additionalProperties`) takes rows with their own
  // field names — the block maps them through its field props.
  const open = items.additionalProperties !== undefined && items.additionalProperties !== false
  const allowed = new Set(Object.keys(items.properties))
  const required = items.required ?? []
  value.forEach((element, i) => {
    if (!element || typeof element !== 'object') return
    for (const key of Object.keys(element)) {
      if (!allowed.has(key) && !open) {
        fail(file, `${path}[${i}] sets "${key}", which ${block.id} does not read — expected one of [${[...allowed].join(', ')}]`)
      }
    }
    for (const key of required) {
      if (element[key] === undefined) {
        fail(file, `${path}[${i}] omits required "${key}"`)
      }
    }
  })
}

/**
 * THE PAGE SLOT. An app layout (receipt §4) holds exactly one bare
 * `{ "type": "pw:page" }` where each page's blocks go. `pw:` types are the
 * format's own, never a block: the slot is not looked up in the catalogue and
 * not listed in `usesBlocks`; it carries `type` and at most an `id`.
 */
const PAGE_SLOT_TYPE = 'pw:page'

function countPageSlots(node) {
  if (!node || typeof node !== 'object') return 0
  return (node.type === PAGE_SLOT_TYPE ? 1 : 0) + (node.children ?? []).reduce((n, c) => n + countPageSlots(c), 0)
}

function walk(file, node, path, used) {
  if (!node || typeof node !== 'object') return
  const type = node.type
  if (!type) return fail(file, `${path} has no "type"`)
  if (type === PAGE_SLOT_TYPE) {
    const extra = Object.keys(node).filter((k) => k !== 'type' && k !== 'id')
    if (extra.length) fail(file, `${path} is the page slot and carries ${extra.join(', ')}: it carries "type" and at most an "id"`)
    return
  }
  if (String(type).startsWith('pw:')) return fail(file, `${path} uses "${type}": the pw: prefix is the format's, and its only block node is the page slot "${PAGE_SLOT_TYPE}"`)
  used.add(type)
  COVERED.add(type)

  const block = catalogue.get(type)
  if (!block) return fail(file, `${path} uses unknown block type "${type}"`)

  for (const [prop, value] of Object.entries(node.props ?? {})) {
    if (!block.props.has(prop)) {
      fail(file, `${path} sets "${prop}" but ${block.id} has no such prop — it is dropped silently`)
      continue
    }
    checkValue(file, `${path}.${prop}`, block, prop, value)
  }
  // A STYLE VALUE IS A STRING. The surface schema takes each `style` entry as
  // a CSS string or a per-breakpoint map of strings; a number (`fontWeight:
  // 600`) passes here and the page, but a host that validates the surface
  // refuses the whole page (INVALID_SCHEMA style.fontWeight).
  for (const [key, value] of Object.entries(node.style ?? {})) {
    const ok =
      typeof value === 'string' ||
      (value && typeof value === 'object' && !Array.isArray(value) &&
        Object.entries(value).every(([bp, v]) => ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(bp) && typeof v === 'string'))
    if (!ok) {
      fail(file, `${path}.style.${key} is ${JSON.stringify(value)} — a style value is a string ("600", "1rem") or a per-breakpoint map of strings`)
    }
  }
  // CHILDREN MUST BE AN ARRAY, AND SAYING SO IS THE GATE'S JOB.
  //
  // A pattern author reaching for a "slot" writes `"children": "{{FIELDS}}"`,
  // which is the wrong shape — patterns give CONCRETE children, as form-card
  // does with its one real field. Without this check the walker would call
  // `.forEach` on the string and die with a stack trace, so a malformed
  // pattern would read as a broken tool rather than as a finding.
  if (node.children !== undefined && !Array.isArray(node.children)) {
    fail(
      file,
      `${path}.children is ${typeof node.children}, not an array — a pattern gives concrete children, ` +
        `not a placeholder slot (see form-card, which ships one real field)`
    )
    return
  }
  if (node.children?.length && !block.canHaveChildren) {
    fail(file, `${path} gives children to ${block.id}, which cannot have them — they never render`)
  }
  ;(node.children ?? []).forEach((child, i) => walk(file, child, `${path}.children[${i}]`, used))
}

const PATTERN_ROLES = ['shell', 'weave', 'band', 'part', 'layout']

/**
 * A SLOT is where content lands — the empty `children` array a shell or weave
 * leaves for bands. It is declared in `placeholders` and DELIBERATELY absent
 * from the snippet, which is why two rules read the same list: `checkRole`
 * requires it to exist, `checkPlaceholders` exempts it from the stale-line
 * warning.
 */
const SLOT_NAME = /MAIN|RAIL|ASIDE|BODY|CONTENT|BANDS|SLOT/i

/**
 * A page is described by a SHELL (chrome) and a BODY — two independent axes.
 * The chrome carries navigation, the body arranges content. A single list of
 * named page frames would not be a taxonomy: frames that share primitives get
 * different names, and legitimate combinations get none.
 *
 * `any` is deliberate and narrow: `notice`-class bands and generic parts
 * genuinely fit every body. Everything else must choose, because an unclaimed
 * band is one the composer offers in EVERY context, which is how a pricing band
 * lands on a dashboard.
 */
const CHROME = ['topbar', 'rail', 'bottombar', 'composite', 'none']
const BODY = ['flow', 'grid', 'dense', 'split', 'any']

/**
 * A pattern's `role` says where it sits in a composition, and the rule is
 * STRUCTURAL rather than a matter of naming:
 *
 *   band  — a full-width page slab. Rooted in `section`, which is what makes it
 *           able to stand in the page flow on its own.
 *   part  — a sub-component that goes INSIDE a band. Rooted in card, container,
 *           accordion, repeater — none of which brings its own slab.
 *   shell — the container the bands sit in. Must carry a slot placeholder,
 *           because a shell that takes no bands is not a shell.
 *
 * WHY STRUCTURE AND NOT INTENT. A pattern called a hero may read like a band
 * and still be container-rooted: dropped into a page it has no slab of its own
 * and the composer would have to wrap it. Labelling it `band` on the strength
 * of its name would hand the model an atom that does not do what the label
 * promises. It becomes a band by gaining a `section` root; until then the
 * honest answer is `part`.
 *
 * So the band rule is an equivalence, checked both ways: section-rooted must be
 * band, and band must be section-rooted.
 */
function checkRole(file, p) {
  if (!p.role) {
    fail(file, 'no "role" — a pattern must say whether it is a shell, a band or a part')
    return
  }
  if (!PATTERN_ROLES.includes(p.role)) {
    fail(file, `role is "${p.role}" — expected one of ${PATTERN_ROLES.join(' | ')}`)
    return
  }

  const root = p.snippet?.type
  if (p.role === 'band' && root !== 'section') {
    fail(file, `role is "band" but the snippet is rooted in "${root}" — a band is a page slab and only a section root provides one`)
  }
  if (p.role === 'part' && root === 'section') {
    fail(file, 'role is "part" but the snippet is rooted in "section" — a section IS a page slab, so this is a band')
  }
  // layout — the app's layout receipt (receipt §4): the frame every page is
  //          drawn in. Its slot is not a placeholder but the one page slot
  //          { "type": "pw:page" }, exactly once, and nowhere else.
  const pageSlots = countPageSlots(p.snippet)
  if (p.role === 'layout' && pageSlots !== 1) {
    fail(file, `role is "layout" but the snippet holds ${pageSlots} page slots — a layout holds exactly one { "type": "${PAGE_SLOT_TYPE}" }`)
  }
  if (p.role !== 'layout' && pageSlots > 0) {
    fail(file, `the snippet holds the page slot "${PAGE_SLOT_TYPE}" but its role is "${p.role}" — only a layout pattern has a page slot`)
  }
  if (p.role === 'shell') {
    const slots = Object.keys(p.placeholders ?? {}).filter((k) => SLOT_NAME.test(k))
    if (slots.length === 0) {
      fail(file, 'role is "shell" but no slot placeholder ({{MAIN}}, {{RAIL}}, {{ASIDE}}…) — a shell that takes no bands is not a shell')
    }
  }
}

/**
 * The knowledge brief, checked against the shape the CONSUMER demands.
 *
 * A pattern can carry `role`, `description` and `usesBlocks` and still reach
 * the composer as nothing at all. The host's knowledge loader accepts an atom
 * only when its manifest carries
 * `knowledge{purpose, useCases, composesWith, antiPatterns}`; anything else is
 * skipped with a console warning nobody reads. A pattern with a beautiful
 * description and no brief is invisible, which is the worst of both states:
 * the authoring cost is paid and the delivery never happens.
 *
 * So this checks the loader's four fields exactly, not a looser "has some
 * documentation" rule. The shape IS the contract — loosening it here would
 * restore the silent skip.
 *
 * `antiPatterns` is required non-empty on purpose: it is the only field that
 * carries a compositional rule (one primary action, no repeated hero, alt text
 * on media). A brief without it teaches the model what a pattern is but not
 * when it is being misused.
 */
const KNOWLEDGE_FIELDS = ['purpose', 'useCases', 'composesWith', 'antiPatterns']

function checkKnowledge(file, p) {
  const k = p.knowledge
  if (!k || typeof k !== 'object') {
    fail(file, 'no "knowledge" brief — the knowledge loader skips it, so the composer never sees this pattern')
    return
  }
  if (typeof k.purpose !== 'string' || k.purpose.trim() === '') {
    fail(file, 'knowledge.purpose is missing or empty — the loader requires a string')
  }
  for (const field of KNOWLEDGE_FIELDS.slice(1)) {
    if (!Array.isArray(k[field])) {
      fail(file, `knowledge.${field} is not an array — the loader requires one, and rejects the whole brief without it`)
    } else if (k[field].length === 0) {
      fail(file, `knowledge.${field} is empty — an empty ${field} passes the loader and teaches the model nothing`)
    }
  }
}

// ── the composition rules ────────────────────────────────────────────────────
/**
 * The rules the PLATFORM already enforces on a tenant's surface, turned on our
 * own source.
 *
 * WHY. The platform's surface validator rates a hardcoded colour an ERROR and a
 * missing alt an ERROR — for surfaces a customer authors. The patterns and
 * surfaces a pack ships are the reference those customers copy, so they are
 * held to the same rules: a pinned colour does not re-theme, and a pack's
 * content must re-theme.
 *
 * TWO DELIBERATE DIVERGENCES FROM THE PLATFORM RULE:
 *
 * 1. WE LOOK DEEPER. The platform scans top-level string props only
 *    (`typeof value !== 'string' → continue`), so a colour nested inside an
 *    object prop is invisible to it — e.g.
 *    `gradient: { from: '#4f46e5', to: '#7c3aed' }`. We recurse.
 *
 * 2. WE SKIP CONTENT. Scanning every string also flags a `code` block whose
 *    displayed source happens to contain `#64748b` — a CSS sample, rendered as
 *    text, styling nothing. The platform would call that an error; it is a
 *    false positive, and a check that cries wolf on documentation teaches
 *    people to skip the report. Props that carry prose or source are exempt.
 */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
const RAW_COLOR_CAP = 8
const RAW_COLOR_ALL = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g

/** Raw colour VALUES across a block tree: style values + non-content props. */
function countRawColours(nodes) {
  let n = 0
  const scan = (value) => {
    if (value === null || value === undefined) return
    if (typeof value === 'string') { n += (value.match(RAW_COLOR_ALL) ?? []).length; return }
    if (Array.isArray(value)) { value.forEach(scan); return }
    if (typeof value === 'object') Object.values(value).forEach(scan)
  }
  const walkNode = (node) => {
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node.props ?? {})) {
      if (!CONTENT_PROPS.has(key)) scan(value)
    }
    scan(node.style ?? {})
    ;(node.children ?? []).forEach(walkNode)
  }
  ;(Array.isArray(nodes) ? nodes : [nodes]).forEach(walkNode)
  return n
}

/** Props whose value is CONTENT — prose or source shown to a reader, not styling. */
const CONTENT_PROPS = new Set([
  'code', 'text', 'content', 'body', 'markdown', 'html', 'prose',
  'description', 'caption', 'label', 'title', 'placeholder', 'alt',
])

function scanColor(file, path, key, value) {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanColor(file, `${path}[${i}]`, key, v))
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (CONTENT_PROPS.has(k)) continue
      scanColor(file, `${path}.${k}`, k, v)
    }
    return
  }
  if (typeof value !== 'string') return
  if (isPlaceholder(value)) return
  if (RAW_COLOR.test(value)) {
    fail(file, `${path} pins the raw colour "${value}" — it will not re-theme. Use a var(--pw-color-*) token.`)
  }
}

/**
 * An image is either content or decoration, and `alt` is where it says which.
 *
 * `alt=""` is the CORRECT marking for a decorative image and the platform's own
 * suggestion says so, which is why an empty alt cannot simply be a failure. But
 * an image whose `src` is a template slot is one the author fills with real
 * content — a news thumbnail, a logo, a product shot. Marking THAT decorative
 * hides it from a screen reader for every page the pattern is ever used on.
 * So the rule is not "alt must be non-empty", it is "a slot-driven image must
 * not claim to be decoration".
 */
function checkImage(file, path, node) {
  const props = node.props ?? {}
  if (!('alt' in props)) {
    fail(file, `${path} is an image with no alt prop — add a description, or alt="" if it is purely decorative`)
    return
  }
  const alt = props['alt']
  if (typeof alt === 'string' && alt.trim() === '' && isPlaceholder(props['src'])) {
    fail(
      file,
      `${path} fills its src from a slot but declares alt="" — a slot-driven image carries content, and marking it decorative hides it from screen readers on every page built from this`
    )
  }
}

/**
 * Heading order, as a WARNING to match the platform's own severity.
 *
 * A skipped level does not break the page, it breaks the outline a screen
 * reader announces — and unlike the colour rule there are honest reasons to
 * start a fragment at h2. Recorded, not blocked.
 */
function checkHeading(file, path, node, state) {
  const level = node.props?.level
  const n = typeof level === 'number' ? level : typeof level === 'string' ? Number(level.replace(/^h/i, '')) : NaN
  if (!Number.isInteger(n) || n < 1 || n > 6) return
  if (state.prevHeading !== null && n > state.prevHeading + 1) {
    warn(file, `${path} jumps from h${state.prevHeading} to h${n} — the announced outline skips a level`)
  }
  state.prevHeading = n
}

/** Walk a block tree applying every composition rule. */
function checkComposition(file, node, path, state) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((n, i) => checkComposition(file, n, `${path}[${i}]`, state))
    return
  }
  if (typeof node.type === 'string') {
    state.nodes++
    if (node.type === 'image') checkImage(file, path, node)
    if (node.type === 'heading') checkHeading(file, path, node, state)
    // An EXEMPLAR paints its own ground — that is its thesis (Mondrian's red
    // is not a token, it is the artwork). The raw-colour law stands for every
    // template and inventory surface and for every pattern; the exemption is
    // per-surface and declared by role, never inferred.
    if (!state.allowRawColor) {
      for (const [key, value] of Object.entries(node.props ?? {})) {
        if (CONTENT_PROPS.has(key)) continue
        scanColor(file, `${path}.props.${key}`, key, value)
      }
      scanColor(file, `${path}.style`, 'style', node.style ?? {})
    }
  }
  for (const child of node.children ?? []) {
    checkComposition(file, child, `${path}.children`, state)
  }
}

/**
 * Theme contrast, checked with the same pairs and the same 4.5:1 line the
 * platform uses — and with the severity split it computes but never acts on.
 *
 * The platform labels anything under 3:1 "severe" and still files it as a
 * warning, so a theme that renders text almost invisible ships. Our own
 * reference material gets the stricter reading: under 3:1 is a failure, between
 * 3 and 4.5 is a warning. Reference material is the one place where "close
 * enough" is not, because every page copied from it inherits the miss.
 */
const CONTRAST_PAIRS = [
  ['text', 'card'],
  ['textMuted', 'card'],
  ['textOnPrimary', 'primary'],
]

function hexToRgb(hex) {
  let h = String(hex).replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance([r, g, b]) {
  const f = (v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrastRatio(a, b) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  if (!A || !B) return null
  const la = relativeLuminance(A)
  const lb = relativeLuminance(B)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function checkContrast(file, theme) {
  const colors = { ...(theme?.colors ?? {}) }
  // `card` is the container colour's one name (the engine's theme schema
  // refuses `colors.surface`).
  if (Object.prototype.hasOwnProperty.call(colors, 'surface')) {
    fail(file, 'theme.colors.surface is not a theme colour — use colors.card')
  }

  for (const [fg, bg] of CONTRAST_PAIRS) {
    const ratio = contrastRatio(colors[fg], colors[bg])
    if (ratio === null) continue
    if (ratio < 3) {
      fail(file, `theme.colors: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 — below 3:1, the text is barely visible`)
    } else if (ratio < 4.5) {
      warn(file, `theme.colors: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 — below WCAG AA 4.5:1`)
    }
  }
}

/**
 * A shell declares its frame: one `chrome` and one concrete `body`.
 *
 * Asked of shells only. A `band` declares just its body (`checkBandBody`), and
 * a `part` sits inside a band and inherits its frame.
 */
function checkShell(file, p) {
  if (p.role !== 'shell') return
  if (!CHROME.includes(p.chrome)) {
    fail(file, `chrome is "${p.chrome}" — expected one of ${CHROME.join(' | ')}`)
  }
  if (!BODY.includes(p.body) || p.body === 'any') {
    fail(file, `body is "${p.body}" — expected one of ${BODY.filter((x) => x !== 'any').join(' | ')}`)
  }
  // Four combinations rule themselves out, and not arbitrarily: with no chrome
  // a grid has no way out, a dense surface has nothing to interact with, and a
  // split contradicts itself — making a selection already is navigation.
  if (p.chrome === 'none' && p.body !== 'flow') {
    fail(file, `chrome "none" allows only body "flow" — "${p.body}" is not reachable`)
  }
}

/**
 * The declaration must match what the snippet ACTUALLY builds.
 *
 * A shell that declares `rail` while its snippet carries a navbar AND a rail
 * is really a composite. A declaration nothing checks is a comment: everything
 * downstream (the mobile rule, the gate, an editor canvas) trusts "rail" and
 * adapts the wrong chrome.
 *
 * Detection is structural, not by name: a navbar-family block at the shell's
 * top level means a top bar; a rail-family block means a rail. Both means
 * composite; neither means none.
 */
const TOPBAR_TYPES = ['navbar', 'announcement-bar']
const RAIL_TYPES = ['tree-view', 'sidebar', 'app-rail']
/**
 * A bottom bar is detected like the others: `layout.bottom-bar` expresses it,
 * so a shell declaring `bottombar` is held to carrying one.
 */
const BOTTOMBAR_TYPES = ['bottom-bar']

function chromeOfSnippet(snippet) {
  const seen = new Set()
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    if (typeof n.type === 'string') {
      if (TOPBAR_TYPES.includes(n.type)) seen.add('top')
      if (RAIL_TYPES.includes(n.type)) seen.add('rail')
      if (BOTTOMBAR_TYPES.includes(n.type)) seen.add('bottom')
    }
    for (const c of n.children ?? []) walk(c)
  }
  walk(snippet)
  // The model names exactly one composite — a top bar AND a rail. A bottom bar
  // paired with either is a shape the vocabulary cannot say, so it is reported
  // as itself rather than silently folded into `composite`.
  if (seen.has('bottom') && (seen.has('top') || seen.has('rail'))) {
    return `bottombar + ${seen.has('top') ? 'topbar' : ''}${seen.has('top') && seen.has('rail') ? ' + ' : ''}${seen.has('rail') ? 'rail' : ''}`
  }
  if (seen.has('top') && seen.has('rail')) return 'composite'
  if (seen.has('rail')) return 'rail'
  if (seen.has('top')) return 'topbar'
  if (seen.has('bottom')) return 'bottombar'
  return 'none'
}

function checkShellShape(file, p) {
  if (p.role !== 'shell' || !p.snippet) return
  const actual = chromeOfSnippet(p.snippet)
  if (actual !== p.chrome) {
    fail(file, `declares chrome "${p.chrome}" but the snippet builds "${actual}" — a declaration nothing checks is a comment`)
  }
}

/**
 * The declaration must match what the snippet builds on the BODY side too.
 *
 * Same defect class as `checkShellShape`, other half of the model. A shell
 * declaring `body: "grid"` whose slot is a plain column container promises the
 * composer a tile field and hands it a stack; declaring `split` without a
 * split block promises a selectable list and hands it nothing to select. Both
 * are silent — the page renders, it is simply not the page that was declared.
 *
 * Detection is structural and narrow on purpose: only the two bodies that a
 * block ACTUALLY expresses are inferable. `flow` and `dense` differ by density
 * of content, not by block type, so no structure distinguishes them and this
 * check does not pretend otherwise.
 */
const GRID_TYPES = ['grid']
const SPLIT_TYPES = ['split-view']

function bodyOfSnippet(snippet) {
  const seen = new Set()
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    if (typeof n.type === 'string') {
      if (GRID_TYPES.includes(n.type)) seen.add('grid')
      if (SPLIT_TYPES.includes(n.type)) seen.add('split')
    }
    for (const c of n.children ?? []) walk(c)
  }
  walk(snippet)
  if (seen.has('split')) return 'split'
  if (seen.has('grid')) return 'grid'
  return null // flow / dense — not structurally distinguishable
}

function checkBodyShape(file, p) {
  if (p.role !== 'shell' || !p.snippet) return
  const actual = bodyOfSnippet(p.snippet)
  if (actual === null) {
    if (p.body === 'grid' || p.body === 'split') {
      fail(file, `declares body "${p.body}" but the snippet builds neither a grid nor a split — the slot is a plain flow`)
    }
    return
  }
  if (actual !== p.body) {
    fail(file, `declares body "${p.body}" but the snippet builds "${actual}"`)
  }
}

/**
 * A shell's detail sub-mode, checked against the block that carries it.
 *
 * `split` divides into two genuinely different pages — a document detail and
 * a stream detail — and the difference is load-bearing: the stream opens at the
 * BOTTOM and forbids a footer, the document does neither. The pattern declares
 * which one it is in `detail`, and this makes the declaration answerable.
 */
const DETAIL_MODES = { doc: 'document', stream: 'stream' }

function checkDetailMode(file, p) {
  if (p.role !== 'shell' || !p.snippet) return
  const split = (() => {
    let hit = null
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (!n || typeof n !== 'object') return
      if (SPLIT_TYPES.includes(n.type)) hit = n
      for (const c of n.children ?? []) walk(c)
    }
    walk(p.snippet)
    return hit
  })()

  if (p.body !== 'split') {
    if (p.detail !== undefined) {
      fail(file, `declares detail "${p.detail}" but body is "${p.body}" — only a split body has a detail sub-mode`)
    }
    return
  }
  if (!Object.hasOwn(DETAIL_MODES, p.detail ?? '')) {
    fail(file, `body is "split" but detail is "${p.detail}" — expected one of ${Object.keys(DETAIL_MODES).join(' | ')}`)
    return
  }
  const expected = DETAIL_MODES[p.detail]
  const actual = split?.props?.detailMode ?? 'document'
  if (actual !== expected) {
    fail(file, `declares detail "${p.detail}" (${expected}) but split-view sets detailMode "${actual}"`)
  }
  // A stream detail forbids a footer. The mobile rule states it in prose; this
  // enforces it, because a rule stated only in prose drifts.
  if (p.detail === 'stream') {
    const hasFooter = JSON.stringify(p.snippet).includes('"footer"')
    if (hasFooter) {
      fail(file, 'detail is "stream" but the snippet carries a footer — nothing sits below a composer')
    }
  }
}

/**
 * A band declares which BODY it belongs to — not which shell.
 *
 * A band is a slab of content; what decides whether it fits is how the page
 * organises content, not how it carries navigation. `kpi-row` belongs to a
 * dense body whether the shell is a rail or a top bar.
 */
function checkBandBody(file, p) {
  if (p.role !== 'band') return
  if (!p.body) {
    fail(file, 'no "body" — an unclaimed band is offered in every context, including the ones it ruins')
    return
  }
  if (!BODY.includes(p.body)) {
    fail(file, `body is "${p.body}" — expected one of ${BODY.join(' | ')}`)
  }
}

/**
 * What does this become on a narrow screen?
 *
 * Required of bands, weaves and shells — the three that own layout. "It
 * shrinks" is not an answer and the field is not asking for one: it asks what
 * the arrangement TURNS INTO. A rail does not thin, it becomes a bottom bar; a
 * grid does not just stack, its tile order becomes a decision. An arrangement
 * that has not answered this is defined for one viewport only. (Enforced by
 * `checkMobile` below.)
 */
/**
 * Every slot the snippet CARRIES must be declared in `placeholders`.
 *
 * WHY. Anything that fills a pattern FROM ITS DECLARATION leaves an undeclared
 * token unfilled, and an unfilled token is not blank: the literal string
 * `{{TITLE}}` is printed on the page. A consumer that has to re-derive the
 * token list from the snippet is proof the declaration is not usable.
 *
 * `{{ID}}` IS NOT A SLOT. It is the node identity the pattern expander supplies
 * on every call, so it is exempt. Any OTHER token — in a prop, a style or an
 * `id` — is a slot and must be declared (see the `id` note in `slotTokensOf`).
 *
 * The reverse direction is a WARNING, not a failure. A declared-but-unused slot
 * is a stale line in a document — worth printing, but blocking on it would
 * punish a pattern for over-documenting itself.
 */
const TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g

/** Tokens sitting in `props`/`style` — the authoring slots. */
function slotTokensOf(node, into = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((n) => slotTokensOf(n, into))
    return into
  }
  if (!node || typeof node !== 'object') return into
  const scan = (v) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(TOKEN_RE)) into.add(m[1])
    } else if (Array.isArray(v)) v.forEach(scan)
    else if (v && typeof v === 'object') Object.values(v).forEach(scan)
  }
  scan(node.props ?? {})
  scan(node.style ?? {})
  /**
   * THE `id` FIELD COUNTS TOO.
   *
   * The pattern expander substitutes `{{ID}}` and nothing else in an id
   * position. An id written as `{{BAND_ID}}` or `{{ROW_ID}}` and never
   * declared ships as a literal id, and two calls of the same pattern then
   * collide. So id tokens are scanned like props and style.
   *
   * An id is not decoration: the renderer prints it as the DOM id and links
   * anchor to it, so a token there is a broken page, not a cosmetic slip.
   */
  if (typeof node.id === 'string') scan(node.id)
  for (const c of node.children ?? []) slotTokensOf(c, into)
  return into
}

function checkPlaceholders(file, p) {
  if (!p.snippet) return
  const carried = slotTokensOf(p.snippet)
  // THE WIRING FIELDS CARRY SLOTS TOO. A wired pattern writes its endpoint,
  // its `returns` path and its filter field as slots INSIDE `dataSources`
  // (`"endpoint": "{{COLLECTION}}?limit={{PAGE_SIZE}}"`). The expander
  // substitutes inside those strings as well, and a slot undeclared there
  // prints on the wire exactly as one undeclared in a prop prints on the page.
  wiringSlotTokens(p, carried)
  carried.delete('ID')
  const declared = new Set(Object.keys(slotDeclarations(p)))
  for (const token of carried) {
    if (!declared.has(token)) {
      fail(file, `pattern carries {{${token}}} (snippet or a wiring field) but "placeholders" does not declare it — anything filling from the declaration prints the token on the page or on the wire`)
    }
  }
  // The reverse direction compares against EVERY token in the snippet, identity
  // positions included: declaring `{{ID}}` is redundant, not wrong, and warning
  // about it would bury the case worth seeing — a declared slot that appears
  // nowhere at all.
  const anywhere = new Set(
    [...JSON.stringify(p.snippet).matchAll(TOKEN_RE)].map((m) => m[1])
  )
  wiringSlotTokens(p, anywhere)
  for (const token of declared) {
    if (anywhere.has(token)) continue
    // A shell's or weave's SLOT is declared precisely BECAUSE it is absent from
    // the snippet: the slot is the empty `children` array where bands land, and
    // `checkRole` requires the declaration. Warning about it would be telling
    // the pattern off for obeying the other rule.
    if ((p.role === 'shell' || p.role === 'weave') && SLOT_NAME.test(token)) continue
    // The same holds for a BAND that takes bands (a backdrop with paint
    // layers): its region is an empty `children` array, so its slot token is
    // absent from the snippet by construction.
    if (SLOT_NAME.test(token) && hasEmptyRegion(p.snippet)) continue
    warn(file, `placeholders declares {{${token}}}, which the snippet never uses`)
  }
}

/** Whether a snippet has a region: a node whose `children` is an empty array (bands land there). */
function hasEmptyRegion(node) {
  if (Array.isArray(node)) return node.some(hasEmptyRegion)
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node.children) && node.children.length === 0) return true
  return hasEmptyRegion(node.children)
}

/**
 * A snippet's block ids must be unique.
 *
 * WHY. The renderer writes a block's id straight into the DOM `id` attribute,
 * so two nodes carrying the same template (say `{{ID}}-c` twice) give every
 * page built from the pattern duplicate DOM ids: an in-page anchor lands on
 * whichever comes first, and a link checker silently agrees because the id
 * EXISTS.
 *
 * A check on a generated app would find the duplicates in the OUTPUT and fix
 * them there, leaving the pattern that produces them untouched. Fixing output
 * instead of source is how a defect becomes recurring, so the rule belongs
 * here: an app check measures an app, this measures the thing apps are built
 * from.
 */
function checkIdUniqueness(file, p) {
  if (!p.snippet) return
  const counts = new Map()
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    if (typeof n.id === 'string' && n.id) counts.set(n.id, (counts.get(n.id) ?? 0) + 1)
    for (const c of n.children ?? []) walk(c)
  }
  walk(p.snippet)
  for (const [id, n] of counts) {
    if (n > 1) {
      fail(file, `snippet uses the id "${id}" ${n}× — the renderer writes it to the DOM id, so an anchor to it is ambiguous`)
    }
  }
}

function checkMobile(file, p) {
  if (p.role !== 'band' && p.role !== 'weave' && p.role !== 'shell') return
  if (typeof p.mobileCollapse !== 'string' || p.mobileCollapse.trim() === '') {
    fail(file, 'no "mobileCollapse" — an arrangement undefined at narrow width is undefined')
  }
}

/**
 * CHROME MUST DECLARE ITS OWN WIDTH SCOPE.
 *
 * The engine knows two words on the width axis (`container` | `viewport`), and
 * which block falls under which is the PACK's vocabulary — and a mechanism no
 * shell declares is a rule published but unapplied. At 375px wide, an
 * undeclared rail next to its work area renders like this:
 *
 *     app-rail#shell-rail   w=164  flex=1 1 0px    ← chrome, stretched into an equal column
 *     container#shell-work  w=164  flex=1 1 0px
 *
 * Undeclared chrome is stretched like one of two equal columns in the row; the
 * rail crushes the content and the row overflows on a narrow screen.
 *
 * This gate does not measure overflow — a render-time viewport audit does.
 * What is measured here is that the DECLARATION EXISTS: the source, not the output.
 */
const CHROME_TYPES = new Set([
  'app-rail',
  'navbar',
  'bottom-bar',
  'announcement-bar',
  'tree-view',
  'side-nav',
])

function checkChromeScope(file, p) {
  if (p.role !== 'shell') return
  const missing = []
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (CHROME_TYPES.has(n.type)) {
      const scope = n.layout?.widthScope
      if (!scope || typeof scope !== 'object' || Object.keys(scope).length === 0) {
        missing.push(`${n.type}#${n.id ?? '?'}`)
      }
    }
    for (const c of n.children ?? []) walk(c)
  }
  walk(p.snippet)
  for (const m of missing) {
    fail(
      file,
      `${m} is persistent chrome but does not declare "layout.widthScope" — undeclared chrome is stretched like a content column in the row`
    )
  }
}

// ── the data contract of a pattern ───────────────────────────────────────────
/**
 * A PATTERN IS THE UNIT OF MEANING. Data must not live inside blocks (a block
 * never fetches) and behaviour must not live in a database the composer cannot
 * see: neither is a place the composer can read or change. So a pattern may
 * declare, at its top level:
 *
 *   dataSources[]   — contracts `dataSourceSchema`: {id, kind:'entity',
 *                     connector, entityType, query, fallback[]}. The runtime
 *                     binds the list as `{{<id>}}`, flags as `{{__loading.<id>}}`
 *                     and `{{__errors.<id>}}`; `{{state.x}}` inside `query`
 *                     resolves against surface state (pagination / filters).
 *   behaviors[]     — contracts `surfaceBehaviorSchema`: {id, event,
 *                     targetBlockId?, actions[]} — event → setState / refresh /
 *                     showBlock / hideBlock / navigate.
 *   initialState{}  — the state keys the pattern reads.
 *   requires        — { connectors: [...] } every connector the sources name.
 *
 * The composer's `use-pattern` moves all four into the surface's
 * `platform/persistence` capability config, prefixing ids on collision.
 *
 * BINDINGS ARE NOT SLOTS. Authoring slots are UPPERCASE `{{TITLE}}` (TOKEN_RE);
 * runtime bindings are lowercase `{{alerts}}`, `{{state.offset}}`,
 * `{{__errors.alerts}}`, `{{length(alerts)}}`. The two grammars share braces
 * and nothing else: a slot is filled at authoring time and vanishes, a binding
 * survives into the surface and is resolved on every render.
 *
 * WHAT IS CHECKED, AND AGAINST WHAT. A named connector must be one the pack
 * or a pack it stands on declares: the `connection` of a
 * `connectors/*.knowledge.json` file.
 */
/** Every connection a connector of this pack or of a pack it stands on declares. */
const KNOWN_CONNECTORS = (() => {
  const known = new Set()
  for (const root of [ATOMS, ...BORROWED.map((r) => atomsDir(r))]) {
    const dir = join(root, 'connectors')
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.knowledge.json'))) {
      try {
        const c = JSON.parse(readFileSync(join(dir, f), 'utf8')).connection
        if (typeof c === 'string') known.add(c)
      } catch { /* judged where the file lives */ }
    }
  }
  return known
})()
const SOURCE_KINDS = new Set(['rest', 'static', 'state', 'entity'])
const EVENT_NAMES = new Set(['block:click', 'input:change', 'form:submit', 'surface:load'])
const ACTION_TYPES = new Set(['setState', 'refresh', 'refreshAll', 'showBlock', 'hideBlock', 'navigate', 'write', 'auth:signIn', 'auth:register', 'auth:signOut'])
const FILTER_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'startsWith'])

function filterLeaves(node, into = []) {
  if (!node || typeof node !== 'object') return into
  if (node.field !== undefined || node.operator !== undefined) into.push(node)
  for (const k of ['and', 'or']) (node[k] ?? []).forEach((c) => filterLeaves(c, into))
  return into
}
function nodeIds(node, into = new Set()) {
  if (!node || typeof node !== 'object') return into
  if (typeof node.id === 'string') into.add(node.id)
  ;(node.children ?? []).forEach((c) => nodeIds(c, into))
  return into
}

function checkPatternData(file, p) {
  const text = JSON.stringify(p.snippet ?? {})
  const sources = p.dataSources
  const usedConnectors = new Set()
  if (sources !== undefined) {
    if (!Array.isArray(sources)) { fail(file, '"dataSources" must be an array'); return }
    const seen = new Set()
    for (const [i, src] of sources.entries()) {
      const at = `dataSources[${i}]`
      if (!src || typeof src !== 'object') { fail(file, `${at} is not an object`); continue }
      if (typeof src.id !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(src.id)) fail(file, `${at}.id "${src.id}" — a source id is a lowercase identifier (it becomes the {{binding}} name)`)
      if (seen.has(src.id)) fail(file, `${at}.id "${src.id}" is declared twice`)
      seen.add(src.id)
      if (!SOURCE_KINDS.has(src.kind)) fail(file, `${at}.kind "${src.kind}" — expected ${[...SOURCE_KINDS].join(' | ')}`)
      if (src.kind === 'entity') {
        if (src.connector === undefined) {
          // No connector: the app's own records of `entityType` (the engine's
          // data protocol). The host that keeps the app's records serves them; without
          // one the source draws its fallback. The entity type is the app's
          // choice, so it may be a slot the composer fills.
          if (typeof src.entityType !== 'string' || !src.entityType) fail(file, `${at} reads the app's own records but names no "entityType"`)
        } else if (typeof src.connector !== 'string') fail(file, `${at}.connector must be a string`)
        else if (!KNOWN_CONNECTORS.has(src.connector)) fail(file, `${at}.connector "${src.connector}" is not a connector this pack registers (${[...KNOWN_CONNECTORS].join(', ') || 'none'})`)
        else usedConnectors.add(src.connector)
        const fallbackIsSlot = typeof src.fallback === 'string' && /^\{\{[A-Z][A-Z0-9_]*\}\}$/.test(src.fallback)
        if (src.fallback !== undefined && !Array.isArray(src.fallback) && !fallbackIsSlot) fail(file, `${at}.fallback must be an array or a slot the composer fills with one — a list source binds as a list, and so must its stand-in`)
        if (src.connector === undefined && src.fallback === undefined) fail(file, `${at} reads the app's own records and has no fallback — a host without the app's records would render nothing`)
        else if (src.fallback === undefined) warn(file, `${at} ("${src.id}") has no fallback — without a connection this pattern renders an empty list; a preview or the pack gallery will show nothing`)
      }
      if (typeof src.id === 'string' && !text.includes(`{{${src.id}}}`) && !text.includes(`(${src.id}`) && !text.includes(`${src.id}.`) && !text.includes(`${src.id})`)) {
        warn(file, `${at} ("${src.id}") is declared but the snippet never binds it`)
      }
    }
  }
  const behaviors = p.behaviors
  if (behaviors !== undefined) {
    if (!Array.isArray(behaviors)) { fail(file, '"behaviors" must be an array'); return }
    const ids = nodeIds(p.snippet)
    for (const [i, b] of behaviors.entries()) {
      const at = `behaviors[${i}]`
      if (!b || typeof b !== 'object') { fail(file, `${at} is not an object`); continue }
      if (typeof b.id !== 'string' || !b.id) fail(file, `${at} has no id`)
      if (!EVENT_NAMES.has(b.event)) fail(file, `${at}.event "${b.event}" — expected a canonical bus event: ${[...EVENT_NAMES].join(' | ')}`)
      if (b.targetBlockId !== undefined && !ids.has(b.targetBlockId)) fail(file, `${at}.targetBlockId "${b.targetBlockId}" is not a node id of the snippet — the expander substitutes {{ID}} in both places, so they must match textually`)
      if (!Array.isArray(b.actions) || b.actions.length === 0) fail(file, `${at}.actions is empty — a behavior with no action is a listener for nothing`)
      else for (const [j, a] of b.actions.entries()) {
        if (!a || !ACTION_TYPES.has(a.type)) fail(file, `${at}.actions[${j}].type "${a?.type}" — expected ${[...ACTION_TYPES].join(' | ')}`)
        if (a?.type === 'setState' && typeof a.key !== 'string') fail(file, `${at}.actions[${j}] setState needs a string "key"`)
        if (a?.type === 'refresh' && !(p.dataSources ?? []).some((sr) => sr.id === a.sourceId)) fail(file, `${at}.actions[${j}] refreshes "${a.sourceId}", which is not one of this pattern's dataSources`)
        if (a?.type === 'write' && (!(p.dataSources ?? []).some((sr) => sr.id === a.sourceId) || !['create', 'update', 'delete'].includes(a.op))) fail(file, `${at}.actions[${j}] writes "${a.sourceId}" (op "${a.op}") — it must name one of this pattern's dataSources and an op: create | update | delete`)
        if ((a?.type === 'showBlock' || a?.type === 'hideBlock') && !ids.has(a.blockId)) fail(file, `${at}.actions[${j}] targets block "${a.blockId}", which the snippet does not contain`)
      }
    }
  }
  if (p.initialState !== undefined && (typeof p.initialState !== 'object' || Array.isArray(p.initialState))) fail(file, '"initialState" must be an object')
  const declaredConnectors = new Set(p.requires?.connectors ?? [])
  for (const c of usedConnectors) if (!declaredConnectors.has(c)) fail(file, `dataSources use connector "${c}" but requires.connectors does not declare it — the composer reads the declaration, not the sources, to know what a project must have connected`)
  for (const c of declaredConnectors) if (!KNOWN_CONNECTORS.has(c)) fail(file, `requires.connectors names "${c}", which this pack does not register`)
  // state keys read anywhere must be seeded, or the first render binds undefined
  const everything = JSON.stringify({ s: p.snippet, d: p.dataSources, b: p.behaviors })
  const stateKeys = new Set([...everything.matchAll(/\{\{\s*state\.([A-Za-z_]\w*)/g)].map((m) => m[1]))
  for (const k of stateKeys) if (!(k in (p.initialState ?? {}))) fail(file, `reads {{state.${k}}} but initialState does not seed "${k}" — the first render binds undefined`)
}

/**
 * Wired, or layout by intent — never silently neither.
 *
 * The rules themselves live in tools/lib/wiring-rules.mjs and are proven both
 * ways in tools/test/wiring-rules.test.ts; this only routes their findings to fail/warn
 * and keeps the census the summary prints.
 */
const wiringCensus = { wired: 0, layoutOnly: 0, neither: 0 }
function checkWiring(file, p) {
  if (p.layoutOnly === true) wiringCensus.layoutOnly++
  else if (isWired(p)) wiringCensus.wired++
  else wiringCensus.neither++
  // Rows: where a row source may land, what its stand-in is, where a field
  // slot sits — read against the receiving block's manifest props.
  const schemaOf = (type, prop) => catalogue.get(type)?.schema.get(prop)
  for (const f of [...wiringFindings(p), ...rowFindings(p, schemaOf)]) {
    if (f.severity === 'fail') fail(file, f.msg)
    else warn(file, f.msg)
  }
}

function readPatterns() {
  if (!existsSync(PATTERNS)) return 0
  const files = readdirSync(PATTERNS).filter((f) => f.endsWith('.json'))
  for (const f of files) {
    const file = `atoms/patterns/${f}`
    let p
    try {
      p = JSON.parse(readFileSync(join(PATTERNS, f), 'utf8'))
    } catch (e) {
      fail(file, `unparseable — ${e.message}`)
      continue
    }
    if (!p.snippet) { fail(file, 'no snippet'); continue }

    checkRole(file, p)
    checkKnowledge(file, p)
    checkBandBody(file, p)
    checkShellShape(file, p)
    checkBodyShape(file, p)
    checkDetailMode(file, p)
    checkShell(file, p)
    checkPlaceholders(file, p)
    checkPatternData(file, p)
    checkWiring(file, p)
    checkIdUniqueness(file, p)
    checkMobile(file, p)
    checkChromeScope(file, p)
    checkComposition(file, p.snippet, 'snippet', { nodes: 0, prevHeading: null })

    const used = new Set()
    walk(file, p.snippet, 'snippet', used)
    checkTreeRules(file, p.snippet, 'snippet')

    // `usesBlocks` is the pattern's own claim about itself. Both directions are
    // checked: a missing entry hides a dependency, a stale one names a block the
    // snippet stopped using — and neither shows up at render.
    const declared = new Set(p.usesBlocks ?? [])
    for (const u of used) {
      if (!declared.has(u)) fail(file, `snippet uses "${u}" but usesBlocks omits it`)
    }
    for (const d of declared) {
      if (!used.has(d)) fail(file, `usesBlocks declares "${d}" but the snippet never uses it`)
    }
  }
  return files.length
}

/**
 * The surface contract. Surfaces get the same treatment as patterns: a surface
 * is a page somebody can open, so a block it names wrongly is more visible than
 * a bad pattern, not less.
 *
 * Every surface is the EXEMPLAR of exactly one layout language — there is no
 * second kind, so a surface carries no `role`. It binds to a pack theme by
 * `appearance.use`, states its thesis (`knowledge.purpose`) and the
 * composition laws it demonstrates (`knowledge.laws`), and may paint raw
 * colour within a cap: the colour can be part of the thesis (Mondrian's red is
 * not a token). A page that is only a copy of another page's skeleton, or
 * that teaches no composition, does not belong in the pack.
 */

function readSurfaces() {
  if (!existsSync(SURFACES)) return 0
  const files = readdirSync(SURFACES).filter((f) => f.endsWith('.json'))
  // A theme is an atom of the floor (`foundation`); a pack that carries surfaces may
  // borrow it. A surface in a pack with no `atoms/appearance` of its own must
  // still bind a pack theme — one that comes from a pack in its closure.
  const themes = partRoots('appearance').flatMap((dir) =>
    readdirSync(dir).filter((d) => existsSync(join(dir, d, 'manifest.json')))
  )
  const wornThemes = new Set()
  for (const f of files) {
    const file = rel(join(SURFACES, f))
    let s
    try {
      s = JSON.parse(readFileSync(join(SURFACES, f), 'utf8'))
    } catch (e) {
      fail(file, `unparseable — ${e.message}`)
      continue
    }
    if (s.role !== undefined) {
      fail(file, `"role" is not a surface field — every surface is the exemplar of one layout language; state it in knowledge.purpose`)
    }
    // FIELD NAME: `appearance.use`, not `appearanceRef`. `appearanceRef` is in
    // no contract; the schema'd field is AppearanceBindingSchema.use. A theme
    // declared under the wrong name is validated by nothing, and every consumer
    // that reads `appearance.use` sees a surface with no theme.
    if (s.appearanceRef !== undefined) {
      fail(file, `"appearanceRef" is not the theme field — bind the theme with appearance.use (the contract's field)`)
    }
    if (!s.appearance?.use) {
      fail(file, `no appearance.use — a surface wears a pack theme, it does not invent a palette`)
    } else if (!themes.includes(s.appearance.use)) {
      fail(file, `appearance.use "${s.appearance.use}" resolves to no atom under atoms/appearance/`)
    } else {
      wornThemes.add(s.appearance.use)
    }
    // NO INLINE PALETTE. An inline `theme` object adds no field the pack
    // theme does not already carry — it is pure value variation, no new
    // structure — so values vary in an appearance atom. Technique (keyframes)
    // lives in `appearance.config`.
    if (s.theme !== undefined) {
      fail(file, `inline "theme" is not allowed — it adds no field outside the pack theme's own shape; vary values in an appearance atom, keep technique in appearance.config`)
    }
    if (!s.knowledge?.purpose || !s.knowledge?.laws?.length) {
      fail(file, `a surface exists to prove one layout language — knowledge.purpose and knowledge.laws are required`)
    }
    // A SURFACE WEARS PATTERNS. A surface often contains pattern twins — a
    // subtree shaped exactly like a pattern — without declaring them.
    // An exemplar that names no pattern teaches the composer a layout language
    // with no vocabulary to build it from. Two is the floor: one pattern is a
    // showcase of that pattern, two is a composition.
    const worn = s.knowledge?.patternsExercised ?? []
    if (worn.length < 2) {
      fail(file, `knowledge.patternsExercised names ${worn.length} pattern(s) — a surface wears at least two (it is a composition, not a single pattern's demo); scan the tree for pattern twins and declare them, or place a part`)
    }
    const used = new Set()
    ;(s.blocks ?? []).forEach((node, i) => walk(file, node, `blocks[${i}]`, used))
    checkTreeRules(file, s.blocks ?? [], 'blocks')

    // The composition rules see BOTH halves of a surface. `blocks` holds the
    // authored nodes and `layout` the tree that arranges them; walking only the
    // first misses findings that live in the layout. The catalogue walk above
    // reads `blocks` only, on purpose: block-type agreement lives there.
    const state = { nodes: 0, prevHeading: null, allowRawColor: true }
    checkComposition(file, s.blocks ?? [], 'blocks', state)
    checkComposition(file, s.layout ?? {}, 'layout', state)
    checkContrast(file, s.theme)
    // RAW-COLOUR CAP. A surface may paint its own thesis, but a surface built
    // from raw colours with no tokens is one no theme can change a single
    // declaration of. An exemplar the theme cannot repaint teaches the
    // composer a look, not a layout. So: at most RAW_COLOR_CAP raw colour
    // values in `blocks` (style + non-content props) unless the surface
    // declares `themeIndependent: true` — then it is reported as a warning and
    // does not count toward the theme rhythm.
    const rawHits = countRawColours(s.blocks ?? [])
    if (s.themeIndependent === true) {
      warn(file, `themeIndependent — ${rawHits} raw colour value(s); the surface does not count toward the theme rhythm`)
    } else if (rawHits > RAW_COLOR_CAP) {
      fail(file, `${rawHits} raw colour value(s) in blocks (cap ${RAW_COLOR_CAP}) — bind them to tokens or color-mix() derivations, or declare themeIndependent: true with the thesis that needs it`)
    }
  }
  // A SURFACE MUST WEAR A THEME — but not every theme needs a surface.
  //
  // The pack themes are STRUCTURALLY IDENTICAL — the same fields and groups;
  // only values differ. Wearing each of them proves no additional technique,
  // and requiring it would turn the exemplar set into a swatch book instead
  // of an app. One theme carries the technique, the others are variation: a
  // pack proves itself with a coherent product, not a colour carousel.
  //
  // What each surface must prove is enforced above: one layout language,
  // knowledge.purpose + laws, patterns exercised, raw-colour cap.
  if (wornThemes.size === 0 && files.length) {
    fail(rel(SURFACES), `no surface declares appearance.use — the exemplars must wear the pack's theme`)
  }
  return files.length
}

// ── composesWith resolves ────────────────────────────────────────────────────
/**
 * `knowledge.composesWith` is what the composer reads to pair things. When a
 * block is retired or renamed, the names pointing at it go stale, and a typo
 * names an id that never existed (`nav.navbar`, `layout.app-shell`). The
 * `usesBlocks` check keeps the snippets honest; this keeps the pairing advice
 * honest too, because a name that resolves to nothing pairs with a ghost.
 */
function checkComposesWith() {
  const blockIds = new Set(catalogue.values().map ? [...catalogue.values()].map((b) => b.id) : [])
  const bare = new Set([...blockIds].map((id) => id.split('.')[1]))
  // The pattern-name universe INCLUDES the borrowed roots. A pack's pattern
  // naming the floor's `footer` is not a ghost but the right direction of
  // dependency: the pack cannot install without the floor anyway. The
  // reverse — the floor naming a pattern of a pack above it — is still
  // caught, because the floor is checked with no borrowed roots.
  const patternNames = new Set(
    PATTERN_ROOTS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))
  )
  // capabilities are legitimate pairing targets too (`platform/entities` …)
  // …from the pack and its closure: `platform/entities` lives in foundation,
  // and a block in another pack that pairs with it names a real atom, not a
  // ghost.
  const capIds = new Set(
    partRoots('capabilities').flatMap((CAPS) =>
      readdirSync(CAPS).flatMap((d) => {
        const mf = join(CAPS, d, 'manifest.json')
        if (!existsSync(mf)) return []
        try { return [JSON.parse(readFileSync(mf, 'utf8')).id] } catch { return [] }
      })
    )
  )
  const ok = (ref) => blockIds.has(ref) || bare.has(ref) || patternNames.has(ref) || capIds.has(ref)
  // OWN blocks only: borrowed roots' manifests are checked in their own packs.
  // A pattern-only pack has no such directory at all.
  if (existsSync(BLOCKS)) for (const category of readdirSync(BLOCKS)) {
    const catDir = join(BLOCKS, category)
    if (!statSync(catDir).isDirectory()) continue
    for (const entry of readdirSync(catDir)) {
      const mf = join(catDir, entry, 'manifest.json')
      if (!existsSync(mf)) continue
      let m; try { m = JSON.parse(readFileSync(mf, 'utf8')) } catch { continue }
      for (const c of m.knowledge?.composesWith ?? []) {
        if (!ok(c)) fail(rel(mf), `knowledge.composesWith names "${c}", which is neither a block nor a pattern — the composer would pair with a ghost`)
      }
    }
  }
  if (existsSync(PATTERNS)) for (const f of readdirSync(PATTERNS).filter((f) => f.endsWith('.json'))) {
    let p; try { p = JSON.parse(readFileSync(join(PATTERNS, f), 'utf8')) } catch { continue }
    for (const c of p.knowledge?.composesWith ?? []) {
      if (!ok(c)) fail(`atoms/patterns/${f}`, `knowledge.composesWith names "${c}", which is neither a block nor a pattern`)
    }
  }
  if (existsSync(SURFACES)) for (const f of readdirSync(SURFACES).filter((f) => f.endsWith('.json'))) {
    let s; try { s = JSON.parse(readFileSync(join(SURFACES, f), 'utf8')) } catch { continue }
    for (const c of s.knowledge?.patternsExercised ?? []) {
      if (!patternNames.has(c)) fail(rel(join(SURFACES, f)), `knowledge.patternsExercised names "${c}", which is not a pattern`)
    }
  }
}

// ── the declaration law ──────────────────────────────────────────────────────
/**
 * A thing an atom REQUIRES is declared as a FIELD. Prose is not a declaration.
 *
 * WHAT THIS IS FOR. A connector's delegated permissions written as a sentence
 * in its knowledge brief ("needs delegated Bookings.Read.All") are
 * machine-unreadable: a host cannot seed a consent screen from them and falls
 * back to a hardcoded table, which drifts — and a scope missing from consent
 * fails at sign-in (Entra `AADSTS650053`).
 *
 * TWO DIRECTIONS, BOTH LOAD-BEARING:
 *
 *   1. Every scope the engine's own `scope:` constants declare must appear in
 *      the manifest. The `.ts` is the truth; the manifest is what SHIPS. A
 *      manifest that under-declares asks for too little and the panel 403s.
 *   2. A scope NAMED IN PROSE but absent from the declaration is REPORTED, not
 *      blocked — see below.
 *
 * WHY (2) IS A WARNING AND (1) IS NOT. Most prose mentions are deliberate
 * NON-requirements, so as a blocker this rule would be wrong, not the atoms.
 * `bookings` notes that writing will LATER need
 * BookingsAppointment.ReadWrite.All — it is read-only today, so the scope is
 * not declared; `workbook` defers `Files.Read.All` to a separate change;
 * `sites` notes `Sites.ReadWrite.All` is already consented AT THE TENANT, which
 * is a fact about the tenant, not a need of the atom. Forcing those into the
 * declaration would make the consent screen ask for permissions we chose not to
 * take — the exact inversion of this law.
 *
 * A text scan cannot tell "requires" from "deliberately does not take", so it
 * belongs in the channel this file reserves for a rule whose SOURCE is
 * known-incomplete. It still earns its place: it is the only thing that would
 * catch a REAL requirement living only in a sentence.
 *
 * The eventual fix is another field — a declared list of deliberate exclusions,
 * so "we do not take Mail.Send" stops being prose too. That widens the atom
 * contract, so it is a follow-up of its own, not a thing to smuggle in here.
 */
const PROVIDER_DIRS = [
  join(ATOMS, 'connectors'),
  ...(existsSync(join(ATOMS, 'providers')) ? readdirSync(join(ATOMS, 'providers')).map((p) => join(ATOMS, 'providers', p, 'entities')) : []),
]

/** Scope-shaped names appearing in free text: `Sites.Read.All`, `offline_access`. */
const SCOPE_IN_PROSE = /\b(?:[A-Z][A-Za-z]+(?:\.[A-Za-z]+){1,3}|offline_access)\b/g

/** Dotted names that look like scopes but are not — file paths, types, code. */
const NOT_A_SCOPE = /^(?:[A-Z][a-z]+\.(?:tsx?|json|mjs|md))$/

function declaredScopesOf(tsSource) {
  const found = new Set()
  for (const m of tsSource.matchAll(/scope:\s*'([^']+)'/g)) found.add(m[1])
  for (const m of tsSource.matchAll(/scope:\s*\[([^\]]+)\]/g)) {
    for (const raw of m[1].split(',')) {
      const s = raw.trim().replace(/'/g, '')
      if (s) found.add(s)
    }
  }
  return found
}

/** Every string in the brief, flattened — prose hides in nested arrays too. */
function proseOf(manifest) {
  const out = []
  const walkValue = (v) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walkValue)
    else if (v && typeof v === 'object') Object.values(v).forEach(walkValue)
  }
  walkValue(manifest.knowledge)
  walkValue(manifest._comment)
  return out.join('\n')
}

function readScopeDeclarations() {
  let checked = 0
  for (const dir of PROVIDER_DIRS) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.knowledge.json'))) {
      const file = `${relative(ROOT, dir).replace(/\\/g, '/')}/${f}`
      let manifest
      try {
        manifest = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      } catch (e) {
        fail(file, `unparseable — ${e.message}`)
        continue
      }
      if (manifest.kind !== 'connector' && manifest.kind !== 'provider') continue
      checked++

      // 0 — a connector states the row fields it serves. An empty list is a
      // statement too: "no fixed fields, the person's own" (a REST API, a
      // SharePoint list) — a composer then asks for a sample instead of guessing.
      if (manifest.kind === 'connector' && !Array.isArray(manifest.entities)) {
        fail(file, 'a connector declares `entities` — the entity types it serves with their row fields, or [] when the fields are the person\'s own (connector-manifest §4)')
      }

      const declared = new Set((manifest.scopes ?? []).map((s) => s?.name).filter(Boolean))
      for (const s of manifest.scopes ?? []) {
        if (typeof s?.name !== 'string' || s.name === '') {
          fail(file, 'a scope declaration has no name — {name, adminConsent?, reason?} is the shape')
        }
      }

      // 1 — the engine's own constants must be declared
      const sibling = join(dir, f.replace('.knowledge.json', '.ts'))
      if (existsSync(sibling)) {
        const needed = declaredScopesOf(readFileSync(sibling, 'utf8'))
        for (const s of needed) {
          if (!declared.has(s)) {
            fail(file, `engine declares scope '${s}' but the manifest does not — the manifest is what ships, so the consent screen would ask for too little`)
          }
        }
      }

      // 2 — prose may not name a scope the declaration omits
      if (declared.size > 0 || manifest.scopes) {
        const named = new Set(
          [...proseOf(manifest).matchAll(SCOPE_IN_PROSE)]
            .map((m) => m[0])
            .filter((s) => !NOT_A_SCOPE.test(s))
        )
        for (const s of named) {
          if (!declared.has(s)) {
            warn(file, `prose names scope '${s}', absent from the "scopes" declaration — if the atom REQUIRES it, declare it; if it is a deliberate exclusion or a note about the tenant, this line is the reminder that the distinction still lives in a sentence`)
          }
        }
      }
    }
  }
  return checked
}

// ── run ──────────────────────────────────────────────────────────────────────
readCatalogue()
const patternCount = readPatterns()
const surfaceCount = readSurfaces()
checkComposesWith()
const scopeAtomCount = readScopeDeclarations()

// ── coverage: a block nothing shows is a block nobody can check ──────────────
/**
 * SHIPPED IS NOT SHOWN. Everything above this line asks "does what the packs
 * ship AGREE with itself" — every type resolves, every prop exists, every
 * required item key is present. None of it asks the prior question: is this
 * block placed ANYWHERE? A block in the catalogue that no pattern and no
 * surface ever renders is shipped, typechecked, published — and never once
 * looked at. It cannot regress visibly, because there is nothing to look at.
 *
 * A catalogue grows quietly: without a check that counts, unplaced blocks
 * accumulate and nobody notices, because nothing is looking.
 *
 * There is no exemption: every block renders from its props alone (a block
 * never fetches), so every block can be placed, and must be.
 */

/**
 * A DEPENDENT'S PLACEMENT COUNTS. The patterns that show a floor block often
 * live in a pack built on the floor. Those blocks are shown — one layer up. Read-only: a dependent's patterns and
 * surfaces are judged in their own pack; here only the TYPES they place are
 * collected, and only for coverage.
 */
const SHOWN_ELSEWHERE = new Set()
{
  const collect = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(collect)
    if (typeof node.type === 'string') SHOWN_ELSEWHERE.add(node.type)
    for (const c of Array.isArray(node.children) ? node.children : []) collect(c)
  }
  for (const root of SHOWN_BY) {
    const pd = familyDir(root, 'patterns')
    if (existsSync(pd)) for (const f of readdirSync(pd).filter((x) => x.endsWith('.json'))) {
      try { collect(JSON.parse(readFileSync(join(pd, f), 'utf8')).snippet) } catch { /* judged in its own pack */ }
    }
    for (const sd of surfaceDirs(root)) for (const f of readdirSync(sd).filter((x) => x.endsWith('.json'))) {
      try { collect(JSON.parse(readFileSync(join(sd, f), 'utf8')).blocks) } catch { /* judged in its own pack */ }
    }
  }
  for (const t of SHOWN_ELSEWHERE) if (catalogue.get(t)?.own) COVERED.add(t)
}

/**
 * A DOM TEST IS A SHOWING. A block that no pattern places can still be seen:
 * a DOM test of its own pack (`test/**\/*.test.ts(x)`) that imports its
 * component renders it and asserts on the result. That counts, so a block a
 * pack ships for apps to place (widgets has no patterns of its own) is not
 * shipped unseen.
 */
{
  const tests = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.test\.tsx?$/.test(e.name)) tests.push(readFileSync(p, 'utf8'))
    }
  }
  if (existsSync(join(ROOT, 'test'))) walk(join(ROOT, 'test'))
  const text = tests.join('\n')
  for (const [name, block] of catalogue) {
    if (!block.own || COVERED.has(name)) continue
    if (text.includes(`${block.file.replace(/\/manifest\.json$/, '')}/component`)) COVERED.add(name)
  }
}

const shown =[...catalogue.keys()].filter((n) => COVERED.has(n))
for (const [name, block] of catalogue) {
  if (COVERED.has(name) || !block.own) continue
  fail(
    block.file,
    `${block.id} is shipped but no pattern, no surface and no DOM test of this pack renders it — nothing can see it break. ` +
      `Give it a home in a pattern, or a DOM test under test/ that imports its component.`
  )
}

console.log(`catalogue : ${catalogue.size} block(s) · ${ICONS ? ICONS.size : '?'} icon(s)`)
console.log(`patterns  : ${patternCount} file(s)`)
if (patternCount) {
  console.log(
    `wiring    : ${wiringCensus.wired} wired (${WIRING_FIELDS.join('|')}) · ${wiringCensus.layoutOnly} layoutOnly · ${wiringCensus.neither} neither`
  )
}
console.log(`surfaces  : ${surfaceCount} file(s)`)
console.log(`scopes    : ${scopeAtomCount} connector/provider manifest(s)`)
console.log(
  `coverage  : ${shown.length}/${catalogue.size} block(s) placed by a pattern or surface, or rendered by a DOM test`
)

// ── theme atoms clear WCAG AA, in light AND in the derived dark mode ─────────
//
// The contrast check above (`checkContrast`) sees only a surface's inline
// `theme`, which surfaces do not carry — so the theme ATOMS are checked
// here. A preset can easily ship white button ink under AA on a mid-tone
// primary, or a stock indigo focus ring that vanishes on a dark ground.
//
// A theme is also worn in DARK. Runtime and publish derive a dark variant for
// every themed surface (`deriveDarkTheme`, @media prefers-color-scheme:dark),
// and that derivation passes `textOnPrimary` and `focus.ringColor` through
// untouched. So those two are checked in both modes and fail in both: the pack
// is the only place their value comes from. The dark NEUTRALS (text, textMuted,
// background, card) are computed by the cascade, not written here — a miss
// there is reported as a warning naming the cascade, because no manifest value
// can fix it.
//
// The derivation is the platform's own (`deriveDarkTheme` from contracts),
// imported rather than restated: a second copy is how the dark mode in the
// editor and the dark mode on the published page came to disagree.
const THEME_TEXT_PAIRS = [
  ['text', 'background'],
  ['text', 'card'],
  ['textMuted', 'background'],
  ['textMuted', 'card'],
  ['textOnPrimary', 'primary'],
  // `error` is TEXT: the form's missing-field message and the required-field
  // asterisk paint with it, so it holds the 4.5:1 text line on its own
  // ground. The derived dark mode passes the hue through untouched, so a
  // dark-mode miss is the cascade's and only warns.
  ['error', 'background'],
  ['error', 'card'],
]

/**
 * The edge a form control draws (`CONTROL_BORDER` in atoms/lib/_shared-utils.ts):
 * `controlBorder` when a theme declares one, else 80% of textMuted mixed into
 * border — the same srgb mix the browser computes for the color-mix(). A
 * divider colour alone typically sits well under 3:1 on the ground, and an
 * input's edge is the only thing that shows where the field is.
 */
const CONTROL_BORDER_MIX = 0.8
function controlBorderOf(c) {
  if (c.controlBorder) return c.controlBorder
  const m = hexToRgb(c.textMuted)
  const b = hexToRgb(c.border)
  if (!m || !b) return null
  return '#' + m.map((v, i) => Math.round(v * CONTROL_BORDER_MIX + b[i] * (1 - CONTROL_BORDER_MIX)).toString(16).padStart(2, '0')).join('')
}
/** Pairs whose value the pack alone decides, in either mode. */
const PACK_OWNED = new Set(['textOnPrimary'])
const THEME_TEXT_MIN = 4.5
const THEME_UI_MIN = 3

let themeAtomCount = 0
{
  const APPEARANCE = join(ATOMS, 'appearance')
  const themeFiles = existsSync(APPEARANCE)
    ? readdirSync(APPEARANCE)
        .filter((d) => existsSync(join(APPEARANCE, d, 'manifest.json')))
        .map((d) => join(APPEARANCE, d, 'manifest.json'))
    : []

  // The engine derives the dark theme; the check uses the engine's own code.
  const contracts = await import('@pwfabric/contracts')

  const colorsOf = (theme) => {
    const c = { ...(theme?.colors ?? {}) }
    if (c.card && !c.surface) c.surface = c.card
    if (c.surface && !c.card) c.card = c.surface
    return c
  }

  const judge = (file, mode, theme) => {
    const c = colorsOf(theme)
    for (const [fg, bg] of THEME_TEXT_PAIRS) {
      const ratio = contrastRatio(c[fg], c[bg])
      if (ratio === null) continue
      if (ratio >= THEME_TEXT_MIN) continue
      const msg = `${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 — below WCAG AA ${THEME_TEXT_MIN}:1 for text`
      if (mode !== 'derived dark' || PACK_OWNED.has(fg)) fail(file, msg)
      else warn(file, `${msg} (derived by the cascade's deriveDarkTheme, not by this manifest)`)
    }
    const edge = controlBorderOf(c)
    for (const bg of ['background', 'card']) {
      const ratio = contrastRatio(edge, c[bg])
      if (ratio === null || ratio >= THEME_UI_MIN) continue
      const msg = `${mode}: the form-control edge ${edge} on ${bg} is ${ratio.toFixed(2)}:1 — below the ${THEME_UI_MIN}:1 floor for a component boundary (WCAG 1.4.11)`
      if (mode !== 'derived dark') fail(file, msg)
      else warn(file, `${msg} (derived by the cascade's deriveDarkTheme, not by this manifest)`)
    }
    // THE PRIMARY IS A COMPONENT BOUNDARY. A primary button, a selected chip and
    // a link-coloured icon are told apart from the page by the primary alone,
    // so it holds the same 3:1 floor as a control edge. A theme can pass every
    // text pair and still fail this one — a bright green primary on a pale
    // green ground, for example.
    for (const bg of ['background', 'card']) {
      const ratio = contrastRatio(c.primary, c[bg])
      if (ratio === null || ratio >= THEME_UI_MIN) continue
      const msg = `${mode}: primary ${c.primary} on ${bg} is ${ratio.toFixed(2)}:1 — below the ${THEME_UI_MIN}:1 floor for a component (WCAG 1.4.11)`
      if (mode !== 'derived dark') fail(file, msg)
      else warn(file, `${msg} (derived by the cascade's deriveDarkTheme, not by this manifest)`)
    }
    const ring = theme?.focus?.ringColor
    for (const bg of ['background', 'card']) {
      const ratio = contrastRatio(ring, c[bg])
      if (ratio === null) continue
      if (ratio < THEME_UI_MIN) {
        fail(file, `${mode}: focus.ringColor ${ring} on ${bg} is ${ratio.toFixed(2)}:1 — below the ${THEME_UI_MIN}:1 floor for a focus indicator (WCAG 1.4.11 / 2.4.11)`)
      }
    }
  }

  for (const path of themeFiles) {
    const file = rel(path)
    let atom
    try {
      atom = JSON.parse(readFileSync(path, 'utf8'))
    } catch (e) {
      fail(file, `unparseable — ${e.message}`)
      continue
    }
    // A theme that extends another is judged as it is drawn: over its base (appearance §3.5).
    if (atom.kind === 'ui-appearance' && atom.extends) {
      try {
        const hit = resolvedThemes(dirname(dirname(path))).find((t) => t.id === atom.id)
        atom = { ...atom, theme: hit.theme, ...(hit.darkTheme ? { darkTheme: hit.darkTheme } : {}) }
      } catch (e) {
        fail(file, e.message)
        continue
      }
    }
    if (atom.kind !== 'ui-appearance' || !atom.theme) continue
    themeAtomCount++
    if (!atom.theme.focus?.ringColor) {
      fail(file, 'theme.focus.ringColor is missing — the platform default ring is not this palette')
    }
    judge(file, 'light', atom.theme)
    {
      // Merge over the platform baseline exactly as the runtime does before it
      // derives: each theme group laid over the default group.
      const d = contracts.DEFAULT_APPEARANCE_THEME
      const merged = {}
      for (const k of new Set([...Object.keys(d), ...Object.keys(atom.theme)])) {
        merged[k] = { ...(d[k] ?? {}), ...(atom.theme[k] ?? {}) }
      }
      // A theme that ships its own `darkTheme` is judged on THAT: the dark it
      // wears is the derivation with the theme's overrides on top
      // (resolveDarkTheme, as the cascade renders it). Judging only the bare
      // derivation failed a theme for a dark it never shows.
      if (atom.darkTheme && typeof atom.darkTheme === 'object') {
        judge(file, 'own dark', contracts.resolveDarkTheme(merged, atom.darkTheme))
      } else {
        judge(file, 'derived dark', contracts.deriveDarkTheme(merged))
      }
    }
  }
  if (themeAtomCount) {
    console.log(`themes    : ${themeAtomCount} appearance atom(s) · light + own or derived dark · text + error ≥${THEME_TEXT_MIN}:1, focus ring + control edge ≥${THEME_UI_MIN}:1`)
  }
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s) — reported, not blocking:`)
  for (const w of warnings) console.log('  ! ' + w)
}

// `mobileCollapse` is DERIVED from the chrome × body tables.
// A hand-written stamp is not a stamp — the texts are the cartesian product
// of the tables, and hand-kept copies drift unnoticed. Drift fails.
{
  const { execFileSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const { dirname, join } = await import('node:path')
  const here = dirname(fileURLToPath(import.meta.url))
  try {
    // Shells can live in more than one pack: the derivation checks the
    // patterns of the pack under test, not the floor's.
    execFileSync('node', [join(here, 'generators', 'derive-mobile-collapse.mjs'), '--check', '--pack', ROOT], { stdio: 'inherit' })
  } catch {
    problems.push('mobileCollapse has drifted from the derivation — see the list above')
  }
}

// ── the shell blocks carry the account control ───────────────────────────────
//
// Sign-in, the session pill and sign-out belong to the app's own shell, themed
// like everything around it. Drawn by the runner as DOM overlays on top of the
// app, a fixed pill covers the bottom bar's last tab, and an avatar with no
// menu offers no way out.
//
// The contract is shared with the runner (it injects `account` into whichever
// shell block the app declares) and the composer/validator (they read the
// manifest). So three things are checked, not one:
//   1. each shell block DECLARES `account` in its manifest, with the agreed
//      shape — a prop the manifest omits is dropped by the validator silently;
//   2. each shell block renders it through the ONE shared menu — three private
//      copies are three places for the keyboard/ARIA behaviour to drift;
//   3. the shared menu emits exactly the two action types the runner handles.
{
  const ACCOUNT_SHELLS = ['navbar', 'bottom-bar', 'app-rail']
  const ACCOUNT_FIELDS = ['state', 'name', 'email', 'avatarSrc', 'profileHref', 'profileLabel', 'links', 'signInLabel', 'signOutLabel']
  const SHARED_MENU = join(LIB, '_shared-account-menu.tsx')
  for (const type of ACCOUNT_SHELLS) {
    const block = catalogue.get(type)
    // SHELL BLOCKS CAN SPAN PACKS: a shell block may live in the floor or in
    // a pack built on it. A pack without app-rail in its closure never sees
    // it, and that is not a gap; a shell block really going missing is caught
    // by the gate that tracks per-pack counts.
    if (!block) continue
    // A shell block is accounted for by its OWNER, not by a pack that borrows it.
    if (!block.own) continue
    const schema = block.schema.get('account')
    if (!schema) {
      fail(block.file, `${block.id} declares no "account" prop — the runner injects it into every shell block, and an undeclared prop is dropped`)
    } else {
      const props = schema.properties ?? {}
      const missing = ACCOUNT_FIELDS.filter((f) => !(f in props))
      if (schema.type !== 'object' || missing.length) {
        fail(block.file, `${block.id} "account" schema is not the agreed shape — missing [${missing.join(', ')}]`)
      }
      const states = props.state?.enum ?? []
      if (states.join('|') !== 'signed-in|signed-out' || !(schema.required ?? []).includes('state')) {
        fail(block.file, `${block.id} "account.state" must be a required enum of signed-in | signed-out`)
      }
    }
    const component = join(BLOCKS, 'layout', type, 'component.tsx')
    if (existsSync(component) && !readFileSync(component, 'utf8').includes("from '../../../lib/_shared-account-menu.js'")) {
      fail(rel(component), `${block.id} does not render the shared account menu (_shared-account-menu.tsx)`)
    }
  }
  // The shared menu is a common part of the shell blocks; demanding it from a
  // pack that ships no shells would hold it to account for something it does not own.
  if (!existsSync(SHARED_MENU)) {
    if (catalogue.get('navbar')?.own) fail('atoms/lib/_shared-account-menu.tsx', 'the shared account menu is missing')
  } else {
    const src = readFileSync(SHARED_MENU, 'utf8')
    for (const action of ['auth:signIn', 'auth:signOut']) {
      if (!src.includes(`'${action}'`)) fail(rel(SHARED_MENU), `never emits the "${action}" action the runner handles`)
    }
  }
}

// ── a component must not hardcode a dead link ────────────────────────────────
//
// A block that renders, say, its brand as a link to `#` puts a link to nowhere
// into every published app. A publish-time link check cannot name it: it walks
// a surface's PROPS, and this address lives in the component, so nothing
// downstream can see it.
//
// Checked HERE because this is the only place that reads component SOURCE, and
// checked across ALL blocks on purpose — any block can carry it.
//
// An `href={expression}` is untouched: a value that flows from props is a
// surface's business and the publish-time check does see those. Only a literal
// address written into the markup is refused. The pack's own answer to "no
// destination" is next door in `breadcrumb` — render a span, not a link.
{
  const DEAD = /href=("#"|'#')/
  const walkTsx = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walkTsx(full)
      else if (entry.name.endsWith('.tsx')) {
        readFileSync(full, 'utf8')
          .split(String.fromCharCode(10))
          .forEach((line, i) => {
            // Comment lines are skipped: prose that QUOTES the banned pattern
            // (including the note above) is not an occurrence of it.
            const t = line.trim()
            if (t.startsWith('*') || t.startsWith('//')) return
            if (DEAD.test(line)) {
              fail(
                rel(full),
                'line ' + (i + 1) + ' hardcodes a link to "#" — an address with no destination. ' +
                  'Render a <span> when there is nowhere to go (see blocks/control/breadcrumb), ' +
                  'or take the address as a prop.'
              )
            }
          })
      }
    }
  }
  // Own source only — a borrowed root's components are its own pack's to answer
  // for, and a patterns-only pack has no component source at all.
  for (const dir of [BLOCKS, LIB]) if (existsSync(dir)) walkTsx(dir)
}

// ── a relative import must resolve INSIDE its own pack ───────────────────────
//
// A block in one pack that imports `../../_shared-utils.js` from the floor
// builds and passes every other check in this monorepo — the file is right
// there on disk — and ships a tgz whose block cannot compile. The other checks
// cannot see it: the catalogue check reads manifests, the composition checks
// read patterns and surfaces, and the dead-link check reads component source
// only for `href="#"`.
//
// This is not a style rule, it is the PUBLISH contract. A published tgz carries
// only the pack's OWN files (the engine's `pwf pack`, run by tools/pack-all.mjs,
// walks `atoms/<part>` and `atoms/lib`), so a specifier that climbs out of the
// pack resolves on this disk and nowhere else. The answer is `vendors`/`kit` in
// pack-map.json, which GENERATES the needed symbols into the pack and verifies
// they still match the floor.
//
// Own source only, and `--resolve-against` roots are deliberately exempt: a
// borrowed root is its own pack's to answer for.
{
  // `.d.ts` COUNTS AS RESOLVED. A declaration file is erased at build, so it
  // never needs to travel in the tgz.
  const CANDIDATES = (p) => [
    p,
    p.replace(/\.js$/, '.ts'), p.replace(/\.js$/, '.tsx'), p.replace(/\.js$/, '.d.ts'),
    p + '.ts', p + '.tsx', p + '.d.ts',
    join(p, 'index.ts'), join(p, 'index.tsx'),
  ]
  const walkSrc = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walkSrc(full); continue }
      // WHAT THE PACKAGER SKIPS, THIS SKIPS. The packager leaves tests out of
      // the tgz: a .test.ts that reaches a tenant is dead weight whose imports
      // — a sibling pack's bridge, a fixture — do not exist on the other side.
      // A file that never ships cannot break the publish contract, so reaching
      // across the boundary is exactly what a test is allowed to do.
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue
      // Comment lines are skipped, exactly as the dead-link check above does:
      // `connectors/registry.ts` DOCUMENTS this very failure in prose, and a
      // scanner that reads its own explanation as an occurrence reports the
      // file that warns about the bug as the bug.
      const text = readFileSync(full, 'utf8')
        .split(String.fromCharCode(10))
        .filter((l) => { const t = l.trim(); return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*') })
        .join(String.fromCharCode(10))
      for (const m of text.matchAll(/\bfrom\s+'(\.[^']*)'/g)) {
        const target = resolve(dirname(full), m[1])
        // Outside the pack entirely — the clearest form of the defect.
        if (!target.startsWith(ATOMS)) {
          fail(rel(full), `imports '${m[1]}', which resolves OUTSIDE this pack. A published tgz carries only this pack's files — declare it under "vendors" in pack-map.json.`)
          continue
        }
        if (CANDIDATES(target).some((c) => existsSync(c))) continue
        // A DECLARED DEPENDENCY MAY ANSWER — BUT NOT FOR A BLOCK. A pack can
        // require another, and non-atom source that glues engines together is
        // read from the ONE catalogue tree those packs are mounted into, never
        // bundled on its own. Such an import resolves when a `--resolve-against` root — every
        // one of which the pack declares — carries the file at the SAME path.
        // A block is different: the server bundles each block atom by itself
        // (esbuild), so its imports must stay inside its own pack — that is
        // the defect this gate exists for, and it stays shut.
        const inPack = relative(ATOMS, target)
        const isBlock = relative(ATOMS, full).split(/[\\/]/)[0] === 'blocks'
        if (!isBlock && BORROWED.some((r) => CANDIDATES(join(atomsDir(r), inPack)).some((c) => existsSync(c)))) continue
        fail(rel(full), `imports '${m[1]}', which does not exist in this pack${isBlock ? '' : ' or at the same path in a declared dependency'}. Declare it under "vendors" in pack-map.json and re-run tools/apply-pack-map.mjs.`)
      }
    }
  }
  if (existsSync(ATOMS)) walkSrc(ATOMS)
}

if (problems.length === 0) {
  console.log('\nPASS — every block resolves, and every pattern and surface agrees with the catalogue')
  process.exit(0)
}

console.log(`\nFAIL — ${problems.length} problem(s):`)
for (const p of problems) console.log('  x ' + p)
process.exit(1)
