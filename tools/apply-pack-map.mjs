#!/usr/bin/env node
/**
 * APPLY THE PACK MAP — write what `pack-map.json` derives into the packs.
 *
 * Two kinds of file are generated, never edited by hand:
 *
 * 1. VENDORED SOURCE. A pack's archive carries only its own files, so a block
 *    that uses a helper from the floor's shared code cannot import it across
 *    packs. The map's `vendors` names the floor files a pack gets a copy of,
 *    and `kit` names single symbols from `atoms/lib/_shared-utils.ts` that are
 *    collected into the pack's `atoms/lib/_kit.ts`. Generated copies cannot
 *    drift; `check-integrity` also compares them with their source.
 *
 * 2. `pwpack.json`. Identity, listing, engine range, requirements and licence
 *    come from the map (tools/lib/pwpack-json.mjs); `version`, `app` and
 *    `packs` are kept from the file on disk.
 *
 * Usage: node tools/apply-pack-map.mjs [--check]
 *   --check   write nothing; report every generated file that differs from
 *             what the map says (CI runs this)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { atomsDir, libDir } from './lib/pack-layout.mjs'
import { REPO, map, FLOOR, PACK_IDS, packDir, versionOf } from './lib/pack-map.mjs'
import { licenseFor, vendoredNoticeFor } from './lib/licence-files.mjs'
import { pwpackJsonFor } from './lib/pwpack-json.mjs'

const CHECK = process.argv.includes('--check')
const GENERATED = '// GENERATED'
const findings = []
const log = []
const rel = (abs) => relative(REPO, abs).split(sep).join('/')

/** Write a generated file, or in --check mode report that it differs. */
function writeOrCompare(abs, body) {
  if (!CHECK) {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, body, 'utf8')
    return
  }
  if (!existsSync(abs) || readFileSync(abs, 'utf8') !== body) {
    findings.push(`${rel(abs)} differs from the map — run node tools/apply-pack-map.mjs`)
  }
}

// ── 1. Vendored source ───────────────────────────────────────────────────────

const floorAtoms = atomsDir(packDir(FLOOR))

/**
 * The symbols a pack's `_kit.ts` needs, cut from the floor's shared utilities.
 * A function ends at a closing brace in column 0, a const at a blank line or
 * the end of the file, a type alias at the end of its line. Line endings may
 * be CRLF.
 */
function buildKit(symbols) {
  const src = readFileSync(join(libDir(packDir(FLOOR)), '_shared-utils.ts'), 'utf8')
  const parts = []
  for (const sym of symbols) {
    const m =
      src.match(new RegExp(`\\nexport function ${sym}\\b[\\s\\S]*?\\n\\}\\r?\\n`)) ??
      src.match(new RegExp(`\\nexport const ${sym}\\b[\\s\\S]*?(?:\\r?\\n\\r?\\n|\\r?\\n?$)`)) ??
      src.match(new RegExp(`\\nexport type ${sym}\\b[^\\n]*\\r?\\n`))
    if (!m) {
      findings.push(`kit symbol not found in the floor: ${sym}`)
      continue
    }
    parts.push(m[0].trim())
  }
  return (
    `${GENERATED} — do not edit. Source: ${FLOOR}/atoms/lib/_shared-utils.ts\n` +
    `//\n` +
    `// The only shared helpers this pack's blocks use. A published archive does\n` +
    `// not carry another pack's files, so they are copied here; check-integrity\n` +
    `// verifies the copy matches its source.\n` +
    `//\n` +
    `// Regenerate: node tools/apply-pack-map.mjs\n\n` +
    parts.join('\n\n') + '\n'
  )
}

/** What a vendored file must contain. `_kit.ts` replaces `_shared-utils`. */
function vendoredBody(spec, relPath) {
  if (relPath.endsWith('_kit.ts')) return buildKit(spec.kit ?? [])
  let text = readFileSync(join(floorAtoms, relPath), 'utf8')
  if ((spec.vendors ?? []).some((v) => v.endsWith('_kit.ts'))) {
    text = text.replace(/(from\s+')\.\/_shared-utils\.js'/g, "$1./_kit.js'")
  }
  return `${GENERATED} — do not edit. Source: ${FLOOR}/atoms/${relPath}\n// Regenerate: node tools/apply-pack-map.mjs\n\n` + text
}

for (const id of PACK_IDS) {
  const spec = map.packs[id]
  for (const relPath of spec.vendors ?? []) {
    writeOrCompare(join(atomsDir(packDir(id)), relPath), vendoredBody(spec, relPath))
    log.push(`vendor ${id}/atoms/${relPath}`)
  }
  // A generated file the map no longer declares is removed, so no copy rots.
  const vendorDir = libDir(packDir(id))
  if (id === FLOOR || !existsSync(vendorDir)) continue
  for (const f of readdirSync(vendorDir)) {
    if (!/\.tsx?$/.test(f) || (spec.vendors ?? []).includes(`lib/${f}`)) continue
    const abs = join(vendorDir, f)
    if (!readFileSync(abs, 'utf8').startsWith(GENERATED)) continue
    if (CHECK) findings.push(`${rel(abs)} is generated but no longer declared — run node tools/apply-pack-map.mjs`)
    else rmSync(abs)
  }
}

// ── 2. pwpack.json ───────────────────────────────────────────────────────────

for (const id of PACK_IDS) {
  const f = join(packDir(id), 'pwpack.json')
  if (!existsSync(f)) {
    findings.push(`packs/${id}/pwpack.json is missing`)
    continue
  }
  const onDisk = JSON.parse(readFileSync(f, 'utf8'))
  const next = pwpackJsonFor(id, map.packs[id], map, onDisk, versionOf)
  writeOrCompare(f, JSON.stringify(next, null, 2) + '\n')
  log.push(`pwpack.json ${id} ${next.version}`)
}

// ── 3. LICENSE and NOTICE ────────────────────────────────────────────────────
// Each pack's LICENSE follows its licence in the map; a pack that vendors floor
// source carries the floor's NOTICE too (tools/lib/licence-files.mjs).

for (const id of PACK_IDS) {
  writeOrCompare(join(packDir(id), 'LICENSE'), licenseFor(id, map.packs[id].license))
  log.push(`LICENSE ${id} ${map.packs[id].license}`)
  if (id !== FLOOR && (map.packs[id].vendors ?? []).length) {
    writeOrCompare(join(packDir(id), 'NOTICE'), vendoredNoticeFor(id, map.packs[id].listing.name))
    log.push(`NOTICE ${id}`)
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (process.argv.includes('--verbose')) for (const l of log) console.log('  ' + l)
if (findings.length) {
  console.log(`apply-pack-map: ${findings.length} finding(s)`)
  for (const f of findings) console.log('  x ' + f)
  process.exit(1)
}
console.log(`apply-pack-map: ${CHECK ? 'checked' : 'applied'} · ${PACK_IDS.length} packs`)
