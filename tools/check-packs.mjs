#!/usr/bin/env node
/**
 * Run the per-pack integrity check for every pack (or the ones named), with
 * the roots the pack map derives:
 *
 *   --resolve-against  the pack's closure — every pack whose blocks its
 *                      patterns and surfaces may place
 *   --shown-by         the packs that depend on it — their patterns and
 *                      surfaces count when asking whether a block is shown
 *
 * Usage: node tools/check-packs.mjs [pack …]
 */
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PACK_IDS, packDir, orderedClosure, dependentsOf } from './lib/pack-map.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const wanted = process.argv.slice(2)
for (const w of wanted) {
  if (!PACK_IDS.includes(w)) {
    console.error(`check-packs: '${w}' is not a pack in pack-map.json`)
    process.exit(2)
  }
}
const packs = wanted.length ? wanted : PACK_IDS
const failed = []

for (const id of packs) {
  const args = [join(HERE, 'check-integrity.mjs'), '--pack', packDir(id)]
  const against = orderedClosure(id).map(packDir)
  const shownBy = dependentsOf(id).map(packDir)
  if (against.length) args.push('--resolve-against', against.join(','))
  if (shownBy.length) args.push('--shown-by', shownBy.join(','))
  console.log(`\n── ${id} ──`)
  try {
    execFileSync(process.execPath, args, { stdio: 'inherit' })
  } catch {
    failed.push(id)
  }
}

if (failed.length) {
  console.error(`\ncheck-packs: ${failed.length} failed — ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`\ncheck-packs: ${packs.length} pack(s) pass`)
