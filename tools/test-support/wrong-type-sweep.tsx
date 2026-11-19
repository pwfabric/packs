/**
 * A block does not crash on a prop of the wrong type (engine 3.0).
 *
 * The runtime applies a block's manifest before it renders, but a value that
 * does not fit its shape is KEPT (coerced as far as possible) and reported as a
 * developer warning — it is not swapped for the default. A binding that has
 * not resolved (`"{{source}}"`) or resolves to the wrong kind of value reaches
 * the block as written. A block may draw such a value badly; it must not throw.
 *
 * `sweepWrongTypes(blocks)` renders every block once per declared prop, with
 * that prop set to a value of another JSON type, and returns each crash.
 */
import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { BehaviorSurfaceProvider } from '@pwfabric/runtime'
import type { BlockPropDescriptor, PropShape } from '@pwfabric/contracts'
import { applied, propsOf } from './applied-props.js'

export interface SweptBlock {
  readonly type: string
  readonly component: unknown
}

const typesOf = (s: PropShape | undefined): string[] => {
  if (!s) return []
  if (s.type !== undefined) return typeof s.type === 'string' ? [s.type] : [...s.type]
  const br = s.anyOf ?? s.oneOf
  return br ? br.flatMap(typesOf) : s.enum ? [...new Set(s.enum.map((e) => (Array.isArray(e) ? 'array' : e === null ? 'null' : typeof e)))] : []
}

/** Values of other JSON types than the shape takes (an unresolved binding first). */
function wrongValues(d: BlockPropDescriptor): unknown[] {
  const t = new Set(typesOf(d.jsonSchema).map((x) => (x === 'integer' ? 'number' : x)))
  const out: unknown[] = []
  if (!t.has('string')) out.push('{{source}}')
  if (!t.has('number')) out.push(42)
  if (!t.has('boolean')) out.push(true)
  if (!t.has('array')) out.push(['x'])
  if (!t.has('object')) out.push({ x: 1 })
  return out
}

class Boundary extends React.Component<{ onError: (e: unknown) => void; children: React.ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  override componentDidCatch(error: unknown): void {
    this.props.onError(error)
  }
  override render(): React.ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

export function sweepWrongTypes(blocks: readonly SweptBlock[]): string[] {
  const crashes: string[] = []
  const quiet = console.error
  console.error = () => {}
  try {
    for (const { type, component } of blocks) {
      const Comp = component as React.FC<Record<string, unknown>>
      for (const d of propsOf(type)) {
        for (const wrong of wrongValues(d)) {
          const raw = { [d.name]: wrong }
          const props = applied(type, raw)
          let error: unknown
          try {
            render(
              <BehaviorSurfaceProvider surfaceId="sweep" onEvent={() => {}}>
                <Boundary onError={(e) => (error = e)}>
                  <Comp props={props} block={{ id: 'b', type, props: raw, layout: {} }} context={{ interactionMode: 'live' }} />
                </Boundary>
              </BehaviorSurfaceProvider>
            )
          } catch (e) {
            error = e
          }
          cleanup()
          if (error) crashes.push(`${type}.${d.name} = ${JSON.stringify(wrong)}: ${String((error as Error)?.message ?? error).split('\n')[0]}`)
        }
      }
    }
  } finally {
    console.error = quiet
  }
  return crashes
}
