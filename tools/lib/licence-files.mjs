// LICENCE AND NOTICE FILES — the `LICENSE` and `NOTICE` each pack carries,
// derived from its licence in pack-map.json, so the file a reader opens and the
// map cannot disagree.
//
//   LICENSE  Apache-2.0: the Apache License text, the same file as the
//            repository's own LICENSE.
//   NOTICE   the floor's NOTICE, for every pack that vendors floor source
//            (`vendors` in the map): the copied helpers carry the floor's
//            third-party icon artwork, so they carry its attribution too.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPO, FLOOR, packDir, map } from './pack-map.mjs'

const APACHE = () => readFileSync(join(REPO, 'LICENSE'), 'utf8')

/**
 * The LICENSE a pack should carry.
 *
 * @param {string} id     the pack's folder name
 * @param {string} spdx   its licence in pack-map.json
 */
export function licenseFor(id, spdx) {
  if (spdx === 'Apache-2.0') return APACHE()
  throw new Error(`${id}: unknown licence ${spdx} — add its LICENSE to tools/lib/licence-files.mjs`)
}

/**
 * The NOTICE a pack that vendors floor source should carry: the floor's own,
 * naming this pack where the floor names itself.
 *
 * @param {string} id        the pack's folder name
 * @param {string} name      its listing name (`Widgets`)
 */
export function vendoredNoticeFor(id, name) {
  const floor = readFileSync(join(packDir(FLOOR), 'NOTICE'), 'utf8')
  const floorName = map.packs[FLOOR].listing.name
  return floor
    .replace(`PWFabric ${floorName}\n`, `PWFabric ${name}\n`)
    .replace(`PWFabric ${floorName} (the @pwpack/${FLOOR} pack)`, `PWFabric ${name} (the @pwpack/${id} pack)`)
    .replace('The SVG path data in atoms/icons/icons.json comes from Lucide', `The SVG path data in atoms/lib/_kit.ts (copied from the ${FLOOR} pack's\natoms/icons/icons.json) comes from Lucide`)
}
