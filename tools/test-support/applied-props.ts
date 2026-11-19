/**
 * Props as the runtime hands them to a block (engine 3.0).
 *
 * A block's props are declared once, in its `manifest.json`
 * (`definition.props`); the runtime applies them before the block renders —
 * defaults filled in, values coerced to their shape (`applyBlockProps`,
 * @pwfabric/contracts). A test that renders a block component directly does
 * the same here, so the block sees what it sees on a page.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyBlockProps, type BlockPropDescriptor } from '@pwfabric/contracts'

const PACKS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'packs')

let byType: Map<string, readonly BlockPropDescriptor[]> | undefined

function load(): Map<string, readonly BlockPropDescriptor[]> {
  const out = new Map<string, readonly BlockPropDescriptor[]>()
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else if (name === 'manifest.json') {
        const m = JSON.parse(readFileSync(abs, 'utf8')) as { kind?: string; id?: string; name?: string; definition?: { props?: BlockPropDescriptor[] } }
        if (m.kind !== 'block' || !m.definition?.props) continue
        if (m.name) out.set(m.name, m.definition.props)
        if (m.id) out.set(m.id, m.definition.props)
      }
    }
  }
  for (const pack of readdirSync(PACKS)) {
    const blocks = join(PACKS, pack, 'atoms', 'blocks')
    try {
      if (statSync(blocks).isDirectory()) walk(blocks)
    } catch {
      // a pack without blocks
    }
  }
  return out
}

/** The descriptors of a block type (`badge`, `control.badge`). */
export function propsOf(type: string): readonly BlockPropDescriptor[] {
  byType ??= load()
  const d = byType.get(type)
  if (!d) throw new Error(`applied-props: no block manifest for "${type}"`)
  return d
}

/** `props` with the block's manifest applied, as the runtime renders them. */
export function applied(type: string, props: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  byType ??= load()
  const d = byType.get(type)
  return d ? { ...applyBlockProps(props, d) } : { ...props }
}
