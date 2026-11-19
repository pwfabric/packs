#!/usr/bin/env node
/**
 * Write each pack's `.pwpack` archive with the engine's writer (`writePwpack`
 * from `@pwfabric/pack`, the same code `pwf pack` runs) into `dist/`, with its
 * sha256 and content hash beside it.
 *
 * Usage: node tools/pack-all.mjs [pack …]
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFolder, packContent, validatePack, writePwpack, hashPack } from '@pwfabric/pack'
import { REPO, PACK_IDS, packDir } from './lib/pack-map.mjs'

const DIST = join(REPO, 'dist')
mkdirSync(DIST, { recursive: true })
const wanted = process.argv.slice(2)

for (const id of wanted.length ? wanted : PACK_IDS) {
  const folder = await readFolder(packDir(id))
  const report = validatePack(folder)
  if (!report.ok) {
    console.error(`pack-all: ${id} does not validate — run node tools/validate-packs.mjs ${id}`)
    process.exit(1)
  }
  const version = report.identity.version
  const archive = await writePwpack(packContent(folder))
  const name = `${id}-${version}.pwpack`
  const sha256 = createHash('sha256').update(archive).digest('hex')
  writeFileSync(join(DIST, name), archive)
  writeFileSync(join(DIST, `${name}.sha256`), `${sha256}  ${name}\n`)
  console.log(`${name.padEnd(36)} ${hashPack(folder)}  sha256:${sha256}`)
}
