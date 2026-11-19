import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { cssUnit, safeFrameSrc, type CSSUnit } from '../../../lib/_kit.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export const EMBED_ASPECT_RATIOS = ['16:9', '4:3', '1:1', 'custom'] as const

export interface EmbedProps {
  readonly src: string
  /** Optional: unset reads "Embedded content" (the app's word goes here). */
  readonly title?: string
  readonly aspectRatio: (typeof EMBED_ASPECT_RATIOS)[number]
  /** 100–2000 px (the manifest bounds it); read when aspectRatio is "custom". */
  readonly height?: number
  readonly allowFullscreen: boolean
}

// ============================================================
// DEFINITION
// ============================================================

export const embedDefinition: BlockDefinition = {
  type: 'embed',
  name: 'Embed',
  category: 'media',
  icon: '⬡',
  defaultProps: {
    src: '',
    title: 'Embedded content',
    aspectRatio: '16:9',
    allowFullscreen: true,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

/**
 * What the framed page may do. Scripts and its OWN origin are allowed (a video
 * player, a map, a booking form need them); top-level navigation of the app is
 * not — the frame cannot replace the page it sits in.
 */
export const EMBED_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation'

export const EmbedBlock: BlockComponent = ({ props, block, context }) => {
  const p = props as unknown as EmbedProps
  const aspectRatio = p.aspectRatio
  // Only an absolute http(s) URL is framed: the raw prop went straight into the
  // iframe, so a `javascript:` URL ran in the app's own origin.
  const src = safeFrameSrc(p.src) ?? ''
  // The app's own PDF or text document (safeFrameSrc admits only those two
  // inert types from pwpack/media/) is framed WITHOUT a sandbox: Chrome refuses
  // to show a PDF in any sandboxed frame, and neither type runs script in the
  // app's origin. Every third-party src keeps EMBED_SANDBOX.
  const ownDocument = src.startsWith('pwpack/media/')
  const inert = context?.interactionMode === 'inert'
  const title = p.title ?? 'Embedded content'
  const isCustom = aspectRatio === 'custom'

  const aspectMap: Record<string, string> = {
    '16:9': '56.25%',
    '4:3': '75%',
    '1:1': '100%',
  }

  const wrapperStyle: React.CSSProperties = isCustom
    ? {
        width: '100%',
        height: cssUnit(p.height as CSSUnit) ?? '400px',
        borderRadius: '4px',
        overflow: 'hidden',
      }
    : {
        position: 'relative',
        width: '100%',
        paddingBottom: aspectMap[aspectRatio] ?? '56.25%',
        borderRadius: '4px',
        overflow: 'hidden',
      }

  const iframeStyle: React.CSSProperties = isCustom
    ? { width: '100%', height: '100%', border: 'none' }
    : { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }

  // Nothing to frame: the published app shows nothing. The dashed stand-in is an
  // editor affordance only — "⬡ Embed placeholder" reached visitors.
  if (!src && !inert) return null

  return (
    <div id={block.id} data-block-id={block.id} style={{ ...wrapperStyle, ...block.style }} data-block-type="embed">
      {src ? (
        <iframe
          src={src}
          title={title}
          style={iframeStyle}
          allowFullScreen={p.allowFullscreen}

          sandbox={ownDocument ? undefined : EMBED_SANDBOX}
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      ) : (
        <div
          style={{
            ...iframeStyle,
            position: isCustom ? undefined : 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--pw-color-card)',
            color: 'var(--pw-color-text-muted)',
            fontSize: 'var(--pw-font-size-sm)',
          }}
        >
          ⬡ Embed placeholder
        </div>
      )}
    </div>
  )
}
