#!/usr/bin/env node
/**
 * Validate every pack (or the ones named) with the engine's own reader —
 * `validatePack` from `@pwfabric/pack`, the same code `pwf validate` runs.
 * The format is the engine's to define; this repository does not carry a
 * second reader of it.
 *
 * Errors and warnings fail. `info` (e.g. DOC_FILE) is printed, not counted.
 *
 * Usage: node tools/validate-packs.mjs [pack …]
 */
import { readFolder, validatePack } from '@pwfabric/pack'
import { PACK_IDS, packDir } from './lib/pack-map.mjs'

const wanted = process.argv.slice(2)
const packs = wanted.length ? wanted : PACK_IDS
let bad = 0

for (const id of packs) {
  const report = validatePack(await readFolder(packDir(id)))
  const counted = report.issues.filter((i) => i.severity !== 'info')
  bad += counted.length
  const status = counted.length ? 'FAIL' : 'ok'
  console.log(`${status.padEnd(4)} ${id.padEnd(20)} ${report.atoms.length} atoms · ${report.layout}`)
  for (const i of report.issues) {
    if (i.severity === 'info' && i.code === 'DOC_FILE') continue
    console.log(`     ${i.severity.padEnd(7)} ${i.code}${i.path ? ` ${i.path}` : ''} — ${i.message}`)
  }
}

if (bad) {
  console.error(`validate-packs: ${bad} error/warning(s)`)
  process.exit(1)
}
console.log(`validate-packs: ${packs.length} pack(s) valid`)
