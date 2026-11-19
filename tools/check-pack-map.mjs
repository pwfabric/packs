#!/usr/bin/env node
/**
 * PACK MAP GATE — the invariant rules between packs.
 *
 * `check-integrity` checks a pack from INSIDE: does every type resolve, does
 * every prop exist. Its resolution roots come from the pack map, so that gate
 * TRUSTS the map. This script checks the map itself — the relations between
 * packs, from where no single pack can see them:
 *
 *   (a) CLOSURE — every pattern's `usesBlocks` (and the types its body really
 *       places) is a subset of its own pack's blocks plus the blocks of its
 *       `requires` closure.
 *   (b) DECLARATION — every `requires` entry names an existing pack; no cycles.
 *   (c) COUNTS — block, pattern and surface counts match `expect` exactly, so
 *       an atom that silently moves between packs shows up here first.
 *   (d) CAP — every pack stays under `atomCap`.
 *   (e) NO GHOSTS — no manifest names an atom outside its closure:
 *       composesWith, a `category.name` reference or hyphenated pattern name in
 *       knowledge text, a surface's block tree, patternsExercised.
 *
 * Also: a short name (block or pattern) cannot live in two packs — assembly
 * could not resolve it; and `pwpack.json`'s `requires` matches the map
 * (id, range = the peer's current major).
 *
 * Zero dependencies. Usage: node tools/check-pack-map.mjs [--json]
 * Exits 1 when there are findings.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { atomsDir, surfaceDirs } from './lib/pack-layout.mjs'
import { versionOf } from './lib/pack-map.mjs'
import { caretOfMajor } from './lib/pwpack-json.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const PACKS_ROOT = join(REPO, 'packs')
const map = JSON.parse(readFileSync(join(REPO, 'pack-map.json'), 'utf8'))
const PACKS = Object.keys(map.packs)
const CAP = map.atomCap ?? 100

const findings = []
const add = (rule, pack, where, msg) => findings.push({ rule, pack, where, msg })
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'))
const isDir = (p) => existsSync(p) && statSync(p).isDirectory()

// ── inventory ────────────────────────────────────────────────────────────────
/** @type {Map<string, {blocks: Map<string,{id:string,file:string,json:any}>, patterns: Map<string,{file:string,json:any}>, surfaces: Map<string,{file:string,json:any}>, caps: Set<string>, atoms: number}>} */
const inv = new Map()
for (const id of PACKS) {
  // The canonical pack folder: families under atoms/; a demo site's
  // pages under app/surfaces/ count as the pack's surfaces all the same.
  const src = atomsDir(join(PACKS_ROOT, id))
  const blocks = new Map()
  const patterns = new Map()
  const surfaces = new Map()
  const caps = new Set()
  let extra = 0
  const bd = join(src, 'blocks')
  if (isDir(bd)) for (const cat of readdirSync(bd)) {
    if (!isDir(join(bd, cat))) continue
    for (const name of readdirSync(join(bd, cat))) {
      const f = join(bd, cat, name, 'manifest.json')
      if (existsSync(f)) blocks.set(name, { id: `${cat}.${name}`, file: `${id}/atoms/blocks/${cat}/${name}/manifest.json`, json: readJson(f) })
    }
  }
  const pd = join(src, 'patterns')
  if (isDir(pd)) for (const f of readdirSync(pd).filter((x) => x.endsWith('.json'))) {
    patterns.set(f.slice(0, -5), { file: `${id}/atoms/patterns/${f}`, json: readJson(join(pd, f)) })
  }
  for (const sd of surfaceDirs(join(PACKS_ROOT, id))) {
    const at = relative(join(PACKS_ROOT, id), sd).split(sep).join('/')
    for (const f of readdirSync(sd).filter((x) => x.endsWith('.receipt.json'))) {
      surfaces.set(f.replace(/\.receipt\.json$/, ''), { file: `${id}/${at}/${f}`, json: readJson(join(sd, f)) })
    }
  }
  const cd = join(src, 'capabilities')
  /** Non-block, non-pattern atoms whose knowledge can still name a block. */
  const others = []
  if (isDir(cd)) for (const d of readdirSync(cd)) {
    const f = join(cd, d, 'manifest.json')
    if (existsSync(f)) {
      const json = readJson(f)
      caps.add(json.id); extra++
      others.push({ file: `${id}/atoms/capabilities/${d}/manifest.json`, json })
    }
  }
  const ad = join(src, 'appearance')
  if (isDir(ad)) extra += readdirSync(ad).filter((d) => existsSync(join(ad, d, 'manifest.json'))).length
  // The icon dictionary is one atom (`icon-set`) to the canonical builder.
  if (existsSync(join(src, 'icons', 'icons.json'))) extra++
  // Connector, provider and identity-method atoms carry `*.knowledge.json`.
  const countKnowledge = (dir) => {
    if (!isDir(dir)) return 0
    let n = 0
    for (const e of readdirSync(dir)) {
      const abs = join(dir, e)
      if (isDir(abs)) n += countKnowledge(abs)
      else if (e.endsWith('.knowledge.json')) {
        n++
        others.push({ file: `${id}/${abs.slice(join(PACKS_ROOT, id).length + 1).replace(/\\/g, '/')}`, json: readJson(abs) })
      }
    }
    return n
  }
  for (const part of ['connectors', 'providers', 'auth']) extra += countKnowledge(join(src, part))
  inv.set(id, { blocks, patterns, surfaces, caps, others, atoms: blocks.size + patterns.size + surfaces.size + extra })
}

// ── (b) declaration + closure ───────────────────────────────────────────────────────
for (const id of PACKS) {
  const spec = map.packs[id]
  if (!Array.isArray(spec.requires)) { add('b', id, 'pack-map.json', 'requires is not a list — every pack declares it, the floor with []'); continue }
  for (const r of spec.requires) {
    if (!map.packs[r]) add('b', id, 'pack-map.json', `requires '${r}', which is not a pack`)
  }
}
function closureOf(id, seen = new Set(), stack = []) {
  for (const r of map.packs[id]?.requires ?? []) {
    if (stack.includes(r) || r === id) { add('b', id, 'pack-map.json', `requires cycle: ${[...stack, id, r].join(' → ')}`); continue }
    if (seen.has(r)) continue
    seen.add(r)
    closureOf(r, seen, [...stack, id])
  }
  return seen
}
const CLOSURE = new Map(PACKS.map((id) => [id, closureOf(id)]))
const reach = (id) => new Set([id, ...CLOSURE.get(id)])

// ── name universe: each short name in ONE pack ───────────────────────────────
const blockHome = new Map() // bare name → pack
const blockIdHome = new Map() // cat.name → pack
const patternHome = new Map()
for (const [id, v] of inv) {
  for (const [name, b] of v.blocks) {
    if (blockHome.has(name)) add('e', id, b.file, `block '${name}' also lives in '${blockHome.get(name)}' — a short name must resolve to one pack`)
    blockHome.set(name, id)
    blockIdHome.set(b.id, id)
  }
  for (const [name, p] of v.patterns) {
    if (patternHome.has(name)) add('e', id, p.file, `pattern '${name}' also lives in '${patternHome.get(name)}'`)
    patternHome.set(name, id)
  }
}
const capHome = new Map()
for (const [id, v] of inv) for (const c of v.caps) capHome.set(c, id)

/** Where an atom reference lives, or undefined when it names nothing known. */
function homeOf(ref) {
  if (capHome.has(ref)) return capHome.get(ref)
  if (blockIdHome.has(ref)) return blockIdHome.get(ref)
  if (patternHome.has(ref)) return patternHome.get(ref)
  if (!ref.includes('.') && blockHome.has(ref)) return blockHome.get(ref)
  return undefined
}

/** Every block type a node tree places. */
function typesOf(node, into = new Set()) {
  if (!node || typeof node !== 'object') return into
  if (Array.isArray(node)) { node.forEach((n) => typesOf(n, into)); return into }
  if (typeof node.type === 'string') into.add(node.type)
  for (const c of Array.isArray(node.children) ? node.children : []) typesOf(c, into)
  return into
}

/** Knowledge prose, composesWith excluded (it is checked as structure). */
function proseOf(...values) {
  const out = []
  const walk = (v, key) => {
    if (key === 'composesWith' || key === 'patternsExercised') return
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach((x) => walk(x))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  values.forEach((v) => walk(v))
  return out.join('\n')
}
const HYPHENATED = [...patternHome.keys()].filter((n) => n.includes('-'))
const CATEGORY_WORDS = new Set([
  ...[...blockIdHome.keys()].map((k) => k.split('.')[0]),
  'panel', // retired category — knowledge text still says panel.modal, panel.tabs
])
function ghostsInProse(id, where, text) {
  const r = reach(id)
  for (const m of text.matchAll(/\b([a-z]+)\.([a-z][a-z-]*[a-z])\b/g)) {
    // A stale category still names the block: older knowledge says
    // `panel.modal` / `panel.tabs` for what is now overlay.modal /
    // container.tabs. The composer reads the short name, so the prefix is
    // matched loosely when it is one of the category words.
    const home =
      blockIdHome.get(`${m[1]}.${m[2]}`) ??
      (CATEGORY_WORDS.has(m[1]) ? blockHome.get(m[2]) : undefined)
    if (home && !r.has(home)) add('e', id, where, `knowledge text names block ${m[0]} (${home}), outside this pack's closure`)
  }
  for (const n of HYPHENATED) {
    if (!new RegExp(`(^|[^a-z0-9-])${n}([^a-z0-9-]|$)`).test(text)) continue
    const home = patternHome.get(n)
    if (!r.has(home)) add('e', id, where, `knowledge text names pattern '${n}' (${home}), outside this pack's closure`)
  }
}

// ── (a) + (e) ────────────────────────────────────────────────────────────────
for (const [id, v] of inv) {
  const r = reach(id)
  const reachable = (type) => blockHome.has(type) && r.has(blockHome.get(type))
  for (const [name, p] of v.patterns) {
    const declared = p.json.usesBlocks ?? []
    for (const b of declared) {
      if (!blockHome.has(b)) add('a', id, p.file, `usesBlocks names '${b}', which is no block in any pack`)
      else if (!reachable(b)) add('a', id, p.file, `usesBlocks names '${b}' (${blockHome.get(b)}), outside the closure of '${id}' (${[...r].join(', ')})`)
    }
    for (const t of typesOf(p.json.snippet)) {
      if (blockHome.has(t) && !reachable(t)) add('a', id, p.file, `snippet places '${t}' (${blockHome.get(t)}), outside the closure of '${id}'`)
    }
    for (const c of p.json.knowledge?.composesWith ?? []) {
      const home = homeOf(c)
      if (home && !r.has(home)) add('e', id, p.file, `composesWith names '${c}' (${home}), outside the closure`)
    }
    ghostsInProse(id, p.file, proseOf(p.json.knowledge, p.json.description))
  }
  for (const [, b] of v.blocks) {
    for (const c of b.json.knowledge?.composesWith ?? []) {
      const home = homeOf(c)
      if (home && !r.has(home)) add('e', id, b.file, `composesWith names '${c}' (${home}), outside the closure`)
    }
    ghostsInProse(id, b.file, proseOf(b.json.knowledge))
  }
  // Capabilities, connectors, providers and identity methods carry knowledge
  // too — the composer reads their composesWith exactly like a block's. A
  // capability that recommends a block the pack no longer ships is the same
  // ghost as a pattern doing it.
  for (const o of v.others) {
    const k = o.json.knowledge ?? o.json
    for (const c of k?.composesWith ?? []) {
      const home = typeof c === 'string' ? homeOf(c) : undefined
      if (home && !r.has(home)) add('e', id, o.file, `composesWith names '${c}' (${home}), outside the closure`)
    }
    ghostsInProse(id, o.file, proseOf(k))
  }
  for (const [, s] of v.surfaces) {
    for (const t of typesOf(s.json.blocks)) {
      if (blockHome.has(t) && !reachable(t)) add('e', id, s.file, `surface places '${t}' (${blockHome.get(t)}), outside the closure`)
    }
    for (const pe of s.json.knowledge?.patternsExercised ?? []) {
      const home = patternHome.get(pe)
      if (home && !r.has(home)) add('e', id, s.file, `patternsExercised names '${pe}' (${home}), outside the closure`)
    }
    ghostsInProse(id, s.file, proseOf(s.json.knowledge, s.json.description))
  }
}

// ── (c) counts + (d) cap ─────────────────────────────────────────────────────
for (const [id, v] of inv) {
  const exp = map.packs[id].expect ?? {}
  const want = { blocks: exp.blocks, patterns: exp.patterns, surfaces: exp.surfaces ?? 0 }
  const have = { blocks: v.blocks.size, patterns: v.patterns.size, surfaces: v.surfaces.size }
  for (const k of Object.keys(want)) {
    if (typeof want[k] !== 'number') add('c', id, 'pack-map.json', `expect.${k} is not declared`)
    else if (want[k] !== have[k]) add('c', id, `${id}/atoms/${k}`, `carries ${have[k]} ${k}, pack-map expects ${want[k]}`)
  }
  if (v.atoms >= CAP) add('d', id, `${id}/atoms`, `${v.atoms} atoms — at or over the cap of ${CAP}`)
}
// The catalogue-wide total. Per-pack counts can all agree with a map that was
// itself edited to hide a lost atom; the total is stated separately
// (`expectTotal`) and catches that.
for (const [k, want] of Object.entries(map.expectTotal ?? {})) {
  const have = [...inv.values()].reduce((n, v) => n + (v[k]?.size ?? 0), 0)
  if (have !== want) add('c', '*', 'pack-map.json', `the catalogue carries ${have} ${k} in total, expectTotal says ${want}`)
}

// ── pwpack.json ↔ map ────────────────────────────────────────────────────────
// A pack's requires must be what the map declares, at each peer's current
// major. (tools/apply-pack-map.mjs --check compares the whole file; this rule
// is stated on its own so a failure names it.)
for (const id of PACKS) {
  const f = join(PACKS_ROOT, id, 'pwpack.json')
  if (!existsSync(f)) { add('b', id, `packs/${id}/pwpack.json`, 'the pack has no pwpack.json'); continue }
  const ident = readJson(f)
  if (ident.id !== `@pwpack/${id}`) add('b', id, `packs/${id}/pwpack.json`, `id is '${ident.id}', expected '@pwpack/${id}'`)
  const got = JSON.stringify(ident.requires ?? [])
  const want = JSON.stringify(map.packs[id].requires.map((r) => ({ id: `@pwpack/${r}`, range: caretOfMajor(versionOf(r)) })))
  if (got !== want) add('b', id, `packs/${id}/pwpack.json`, `requires is ${got}, the map says ${want} — run node tools/apply-pack-map.mjs`)
}
for (const e of readdirSync(PACKS_ROOT)) {
  if (e.startsWith('.') || !isDir(join(PACKS_ROOT, e))) continue
  if (!map.packs[e]) add('b', e, `packs/${e}`, `'${e}' is a folder under packs/ but not in pack-map.json`)
}

// ── report ───────────────────────────────────────────────────────────────────
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ findings, packs: Object.fromEntries([...inv].map(([id, v]) => [id, { blocks: v.blocks.size, patterns: v.patterns.size, surfaces: v.surfaces.size, atoms: v.atoms }])) }, null, 2))
  process.exit(findings.length ? 1 : 0)
}
const pad = (s, n) => String(s).padEnd(n)
console.log(`${pad('pack', 20)}${pad('blocks', 8)}${pad('patterns', 10)}${pad('surfaces', 10)}${pad('atoms', 7)}requires`)
let tb = 0, tp = 0, ts = 0
for (const id of PACKS) {
  const v = inv.get(id)
  tb += v.blocks.size; tp += v.patterns.size; ts += v.surfaces.size
  console.log(`${pad(id, 20)}${pad(v.blocks.size, 8)}${pad(v.patterns.size, 10)}${pad(v.surfaces.size, 10)}${pad(v.atoms, 7)}${map.packs[id].requires.join(', ') || '—'}`)
}
console.log(`${pad('total', 20)}${pad(tb, 8)}${pad(tp, 10)}${pad(ts, 10)}`)
const RULES = { a: 'closure', b: 'declaration', c: 'counts', d: 'atom cap', e: 'ghost reference' }
if (findings.length) {
  console.log(`\ncheck-pack-map: FAIL — ${findings.length} finding(s)`)
  for (const f of findings) console.log(`  x (${f.rule}) ${RULES[f.rule]} · ${f.where}: ${f.msg}`)
  process.exit(1)
}
console.log('\ncheck-pack-map: PASS — (a) closure · (b) declarations · (c) counts · (d) atom cap · (e) no ghost references')
