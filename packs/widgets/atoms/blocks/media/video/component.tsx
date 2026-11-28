import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { MEDIA_LETTERBOX, safeRenderValue, textOf } from '../../../lib/_kit.js'

// ============================================================
// SCHEMA
// ============================================================

/**
 * The keyboard focus ring is the THEME's ring (--pw-focus-ring-*), drawn on the
 * frame around the video, on the page ground it is contrast-checked against.
 * The browser's own outline sat inside the frame's overflow:hidden and was
 * clipped, and on a dark theme nothing showed at all. Without :has() the ring
 * is drawn inset on the video itself.
 */
const VIDEO_FOCUS_CSS =
  '[data-pw-video-frame] > video:focus-visible { outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color, var(--pw-color-primary, #18181b));' +
  ' outline-offset: calc(-1 * var(--pw-focus-ring-width, 2px)); }' +
  ' @supports selector(:has(*)) { [data-pw-video-frame]:has(> video:focus-visible) {' +
  ' outline: var(--pw-focus-ring-width, 2px) solid var(--pw-focus-ring-color, var(--pw-color-primary, #18181b));' +
  ' outline-offset: var(--pw-focus-ring-offset, 2px); } [data-pw-video-frame] > video:focus-visible { outline: none; } }'

// Props — declared in manifest.json, applied by the runtime.
export interface VideoProps {
  readonly src: string
  readonly autoplay: boolean
  readonly controls: boolean
  readonly loop: boolean
  readonly muted: boolean
  readonly poster?: string
  // CSS aspect-ratio. Accepts the legacy colon presets ('16:9'|'4:3'|'1:1') AND
  // any CSS aspect-ratio string ('16/9', '4/3', '1/1', '21/9', '3/2') or a number.
  // Colon forms are normalised to the CSS `/` form for the native aspect-ratio.
  readonly aspectRatio: number | string
  readonly caption?: string
  /**
   * How much the browser loads before play: `metadata` (the default: size,
   * length and first frame), `none` (nothing until play) or `auto`.
   */
  readonly preload: 'none' | 'metadata' | 'auto'
  /** The video's accessible name ("Product tour, 2 minutes"). */
  readonly label?: string
}

// ============================================================
// DEFINITION
// ============================================================

export const videoDefinition: BlockDefinition = {
  type: 'video',
  name: 'Video',
  category: 'media',
  icon: '▶',
  defaultProps: {
    src: '',
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
    aspectRatio: '16/9',
    preload: 'metadata',
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const VideoBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as VideoProps
  const src = textOf(p.src).trim()
  const inert = context?.interactionMode === 'inert'
  // Browsers refuse to autoplay a video with sound, so `autoplay` without
  // `muted` never started. Autoplay implies muted.
  const autoplay = p.autoplay
  const muted = autoplay || p.muted
  // Normalise the ratio to the native CSS aspect-ratio form. Legacy colon presets
  // ('16:9') and any custom string ('21/9', '3/2') or number all map to `/`.
  const rawAspect = String(p.aspectRatio)
  const aspectRatio = rawAspect.includes(':') ? rawAspect.replace(':', '/') : rawAspect
  const preload = p.preload === 'none' || p.preload === 'auto' ? p.preload : 'metadata'
  const label = textOf(p.label).trim() || undefined

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio,
    backgroundColor: MEDIA_LETTERBOX,
    borderRadius: 'var(--pw-border-radius-sm)',
    overflow: 'hidden',
  }

  const videoStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  }

  // No source: nothing in the published app. The stand-in is an editor
  // affordance — "▶ Video placeholder" reached visitors.
  if (!src && !inert) return null

  return (
    <div id={block.id} data-block-id={block.id} style={block.style as React.CSSProperties} data-block-type="video">
      {src ? <style>{VIDEO_FOCUS_CSS}</style> : null}
      <div style={wrapperStyle} data-pw-video-frame="">
        {src ? (
          <video
            src={src}
            style={videoStyle}
            controls={p.controls}
            autoPlay={autoplay}
            loop={p.loop}
            muted={muted}
            playsInline={autoplay || undefined}
            poster={typeof p.poster === 'string' ? p.poster : undefined}
            preload={preload}
            aria-label={label}
          />
        ) : (
          <div
            style={{
              ...videoStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // The placeholder FILL is UI, not letterbox: it follows the theme.
              backgroundColor: 'var(--pw-color-surface-muted, color-mix(in srgb, var(--pw-color-card) 94%, var(--pw-color-text)))',
              color: 'var(--pw-color-text-muted, #71717a)',
              fontSize: 'var(--pw-font-size-sm)',
            }}
          >
            ▶ Video placeholder
          </div>
        )}
      </div>
      {!!p.caption && (
        <p
          style={{
            fontSize: 'var(--pw-font-size-xs)',
            color: 'color-mix(in srgb, var(--pw-color-text, #09090b) 75%, transparent)',
            textAlign: 'center',
            marginTop: '8px',
          }}
        >
          {safeRenderValue(p.caption)}

        </p>
      )}
    </div>
  )
}
