// PACK IDENTITY — what each pack's `pwpack.json` should say.
//
// `pwpack.json` is the pack's only manifest: there is no per-pack
// `package.json`. Most of it is derived from `pack-map.json` so the map and
// the packs cannot disagree; three keys belong to the file on disk and are
// carried over: `version` (bumped by hand when content changes), `app` and
// `packs` (an app pack's composition and pins).
//
// Validation of the result is the engine's job (`pwf validate`, `validatePack`
// in `@pwfabric/pack`); this module only decides what the file should hold.

/** Key order of the file. Members a pack does not use are left out. */
export const KEY_ORDER = Object.freeze([
  'id', 'version', 'formatVersion', 'name', 'description', 'category',
  'engines', 'requires', 'tokens', 'license', 'app', 'packs',
])

/** The pwpack folder format this repository writes. */
export const FORMAT_VERSION = '1.0'

/**
 * The `license` member for an SPDX licence: what a consumer may do with the
 * pack's atoms. Apache-2.0 allows a fork to be published; BUSL-1.1 allows
 * changing the atoms for your own apps but not publishing the fork.
 */
export function licenseFlags(spdx) {
  if (spdx === 'Apache-2.0') return { fork: true, redistribute: true }
  if (spdx === 'BUSL-1.1') return { fork: true, redistribute: false }
  throw new Error(`unknown licence ${spdx} — add its flags to tools/lib/pwpack-json.mjs`)
}

export const fullId = (id) => (id.startsWith('@pwpack/') ? id : `@pwpack/${id}`)

/** `^<major>.0.0` of a version. */
export const caretOfMajor = (version) => `^${String(version).split('.')[0]}.0.0`

/**
 * The `pwpack.json` a pack should carry.
 *
 * @param {string} id           the pack's folder name (`foundation`)
 * @param {object} spec         its entry in pack-map.json
 * @param {object} map          the whole pack map (defaults: engines, tokens)
 * @param {object} onDisk       the pack's current pwpack.json
 * @param {(id: string) => string} versionOf  a peer pack's current version
 */
export function pwpackJsonFor(id, spec, map, onDisk, versionOf) {
  const listing = spec.listing ?? {}
  const value = {
    id: fullId(id),
    version: onDisk.version ?? '1.0.0',
    formatVersion: FORMAT_VERSION,
    name: listing.name,
    description: listing.description,
    category: listing.category,
    engines: { pwfabric: spec.engines ?? map.defaults.engines },
    requires: (spec.requires ?? []).map((r) => ({ id: fullId(r), range: caretOfMajor(versionOf(r)) })),
    tokens: spec.tokens ?? map.defaults.tokens,
    license: licenseFlags(spec.license),
    app: onDisk.app,
    packs: onDisk.packs,
  }
  const out = {}
  for (const k of KEY_ORDER) {
    const v = value[k]
    if (v === undefined || (Array.isArray(v) && v.length === 0 && k === 'tokens')) continue
    out[k] = v
  }
  return out
}
