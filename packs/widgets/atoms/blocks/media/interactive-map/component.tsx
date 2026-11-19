import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, listOf, safeRenderValue } from '../../../lib/_kit.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

/** On a phone a location chip is DRAWN 44px tall (plus the shared hit area). */
const PIN_HIT_CSS = '@media (max-width: 640px), (pointer: coarse) { [data-pw-pin] { min-height: 44px; } }'

/**
 * THE APP'S OWN MAP. The block draws the picture the app gives it (an SVG or
 * image in the app's own media) and puts a marker on it for every location
 * that has a position on that picture. Nothing is fetched from anywhere else:
 * map tiles from a tile server showed a real place under a fictional venue and
 * sent each visit to a third party.
 *
 * The box takes the picture's proportions (`imageWidth` × `imageHeight`)
 * before the picture arrives, so nothing moves when it does.
 */
const DEFAULT_RATIO = { w: 4, h: 3 }

// Props — declared in manifest.json, applied by the runtime.
export interface MapLocation {
  readonly label: string
  readonly address?: string
  /** Where on the picture, in % of its width from the left (0–100). */
  readonly x?: number
  /** Where on the picture, in % of its height from the top (0–100). */
  readonly y?: number
}

export interface InteractiveMapProps {
  readonly title?: string
  /** The map picture: a file in the app's own media (`pwpack/media/venue-map.svg`). */
  readonly image?: string
  /** What the picture shows, in the app's words: the map's accessible name. */
  readonly imageAlt?: string
  readonly imageWidth?: number
  readonly imageHeight?: number
  readonly locations: readonly MapLocation[]
}

export const InteractiveMapDefinition: BlockDefinition = {
  type: 'interactive-map',
  name: 'InteractiveMap',
  category: 'media',
  icon: 'map-pin',
  defaultProps: { locations: [] },
  canHaveChildren: false,
}

/**
 * The picture's address, when it is the app's own: a relative path (its media
 * folder). An absolute URL, another origin or a scheme is refused — the map
 * makes no request off the app's origin.
 */
export function ownImage(src: unknown): string | undefined {
  if (typeof src !== 'string') return undefined
  const t = src.trim()
  if (t === '' || /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//')) return undefined
  if (t.split(/[/\\]/).some((seg) => seg === '..')) return undefined
  return t
}

const percent = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : undefined

const positive = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined)

type Pinned = { index: number; label: string; x: number; y: number }

export const InteractiveMapBlock: BlockComponent = ({ props, block }) => {
  // Anything but a list (a binding that has not resolved) reads as no locations.
  const p = props as unknown as InteractiveMapProps
  const title = safeRenderValue(p.title)
  const locations = listOf<MapLocation>(p.locations)
  const image = ownImage(p.image)
  const imageAlt = safeRenderValue(p.imageAlt)
  const ratioW = positive(p.imageWidth) ?? DEFAULT_RATIO.w
  const ratioH = positive(p.imageHeight) ?? DEFAULT_RATIO.h
  const messages = useAppMessages()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const active = locations[activeIndex]

  // EVERY location with a position is a marker; the chosen one is highlighted.
  const pinned: Pinned[] = locations.flatMap((loc, index) => {
    const x = percent(loc?.x)
    const y = percent(loc?.y)
    return x !== undefined && y !== undefined ? [{ index, label: safeRenderValue(loc.label), x, y }] : []
  })
  const activeLabel = active ? safeRenderValue(active.label) : ''
  const activeIsPinned = pinned.some((m) => m.index === activeIndex)
  // The map's name is the app's description of its picture; with several
  // markers it also says which one is highlighted (`ui.map.highlighted`).
  const mapLabel =
    pinned.length > 1 && activeIsPinned && imageAlt
      ? messageOf(messages, 'ui.map.highlighted', '', { map: imageAlt, place: activeLabel })
      : imageAlt

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="interactive-map"
      className="pw-interactive-map"
      style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, ...block.style }}
    >
      {title && <h3 style={{ margin: 0, fontSize: 'var(--pw-font-size-base, 16px)', fontWeight: 700 }}>{title}</h3>}
      {locations.length > 1 && (
        <div
          role="group"
          aria-label={title || messageOf(messages, 'ui.map.locations', '')}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          <style>{HIT_AREA_CSS + PIN_HIT_CSS}</style>
          {locations.map((loc, i) => (
            <button
              key={`${loc.label}-${i}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              // The chip shown on the map says so — to a screen reader as well
              // as by its fill.
              aria-pressed={i === activeIndex}
              data-pw-hit=""
              data-pw-pin=""
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${i === activeIndex ? 'var(--pw-color-primary, #18181b)' : 'var(--pw-color-border, #e4e4e7)'}`,
                background: i === activeIndex ? 'var(--pw-color-primary, #18181b)' : 'transparent',
                color:
                  i === activeIndex
                    ? 'var(--pw-color-text-on-primary, #fafafa)'
                    : 'var(--pw-color-text, #09090b)',
                fontSize: 'var(--pw-font-size-xs, 12px)',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {safeRenderValue(loc.label)}
            </button>
          ))}
        </div>
      )}
      <div style={{ width: '100%', minWidth: 0 }}>
        {image ? (
          <div
            role="img"
            aria-label={mapLabel || undefined}
            data-pw-map=""
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${ratioW} / ${ratioH}`,
              overflow: 'hidden',
              border: '1px solid var(--pw-color-border, #e4e4e7)',
              borderRadius: 8,
              background: 'var(--pw-color-surface, var(--pw-color-card, #f4f4f5))',
            }}
          >
            <img
              src={image}
              alt=""
              width={ratioW}
              height={ratioH}
              decoding="async"
              draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
            />
            {pinned.map((m) => {
              const on = m.index === activeIndex
              const size = on ? 22 : 16
              return (
                <span
                  key={`m-${m.index}`}
                  data-pw-map-marker={on ? 'active' : ''}
                  title={m.label}
                  // A pointer convenience only: the chips above are the control.
                  onClick={() => setActiveIndex(m.index)}
                  style={{
                    position: 'absolute',
                    left: `${m.x}%`,
                    top: `${m.y}%`,
                    width: size,
                    height: size,
                    transform: 'translate(-50%, -50%)',
                    boxSizing: 'border-box',
                    borderRadius: '50%',
                    background: on ? 'var(--pw-color-primary, #18181b)' : 'var(--pw-color-card, #ffffff)',
                    border: `3px solid ${on ? 'var(--pw-color-card, #ffffff)' : 'var(--pw-color-primary, #18181b)'}`,
                    boxShadow: on
                      ? '0 0 0 3px var(--pw-color-primary, #18181b), 0 2px 6px rgba(0,0,0,0.35)'
                      : '0 1px 4px rgba(0,0,0,0.35)',
                    zIndex: on ? 2 : 1,
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </div>
        ) : active?.address ? (
          // No picture: the chosen location's address, written out.
          <div
            style={{
              width: '100%',
              minHeight: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--pw-color-border, #e4e4e7)',
              borderRadius: 8,
              color: 'var(--pw-color-text-muted, #71717a)',
              fontSize: 'var(--pw-font-size-sm, 14px)',
              textAlign: 'center',
              padding: 16,
              boxSizing: 'border-box',
            }}
          >
            {safeRenderValue(active.address)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
