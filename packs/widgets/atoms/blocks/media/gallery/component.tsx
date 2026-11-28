import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, listOf, ON_OVERLAY_SCRIM, OVERLAY_SCRIM_STRONG, safeRenderValue, PRESS_CSS } from '../../../lib/_kit.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// Props — declared in manifest.json, applied by the runtime.
export interface GalleryImage {
  readonly src: string
  readonly alt?: string
  readonly caption?: string
}

export interface GalleryProps {
  readonly title?: string
  readonly images: readonly GalleryImage[]
  readonly columns: number
  /** Each picture's caption under its thumbnail. Default on: a caption is content, not lightbox-only. */
  readonly showCaptions?: boolean
}

export const GalleryDefinition: BlockDefinition = {
  type: 'gallery',
  name: 'Gallery',
  category: 'media',
  icon: 'image',
  defaultProps: { images: [], columns: 3 },
  canHaveChildren: false,
}

export const GalleryBlock: BlockComponent = ({ props, block }) => {
  const appWords = useAppMessages()
  // Anything but a list (a binding that has not resolved) reads as no images.
  const p = props as unknown as GalleryProps
  const { title, columns } = p
  const showCaptions = p.showCaptions !== false
  const images = listOf<GalleryImage>(p.images)

  const [openIndex, setOpenIndex] = React.useState<number | null>(null)
  const open = openIndex !== null ? images[openIndex] : undefined
  // THE LIGHTBOX IS A REAL DIALOG: Esc closes it, a labelled close button
  // takes focus, the dialog has a name, and focus goes back to the thumbnail
  // that opened it. It used to be a click-anywhere scrim with no name, no Esc
  // and no way back for a keyboard visitor.
  const thumbRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const closeRef = React.useRef<HTMLButtonElement | null>(null)
  const lastOpened = React.useRef<number | null>(null)
  const close = React.useCallback((): void => setOpenIndex(null), [])
  React.useEffect(() => {
    if (openIndex === null) {
      if (lastOpened.current !== null) {
        thumbRefs.current[lastOpened.current]?.focus()
        lastOpened.current = null
      }
      return
    }
    lastOpened.current = openIndex
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'Tab') {
        // The close button is the dialog's one control: focus stays on it.
        e.preventDefault()
        closeRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openIndex, close])
  const nameOf = (img: { alt?: string | undefined; caption?: string | undefined }, i: number): string =>
    safeRenderValue(img.caption) || safeRenderValue(img.alt) || `Picture ${i + 1} of ${images.length}`

  return (
    <div className="pw-gallery" id={block.id} data-block-id={block.id} style={block.style as React.CSSProperties} data-block-type="gallery">
      <style>{PRESS_CSS}</style>
      {title && <h3 style={{ margin: '0 0 10px', fontSize: 'var(--pw-font-size-lg, 18px)', fontWeight: 700, color: 'var(--pw-color-text, #09090b)' }}>{safeRenderValue(title)}</h3>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10 }}>
        {images.map((img, i) => (
          <figure key={`${img.src}-${i}`} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <button data-pw-press=""
            type="button"
            ref={(el) => {
              thumbRefs.current[i] = el
            }}
            onClick={() => setOpenIndex(i)}
            aria-haspopup="dialog"
            aria-label={messageOf(appWords, 'ui.gallery.enlarge', '', { name: nameOf(img, i) })}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: 'var(--pw-border-radius-lg)',
              overflow: 'hidden',
              aspectRatio: '4/3',
            }}
          >
            <img src={img.src} alt={img.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
          {/* The caption is CONTENT: it shows in the grid, not only once a
              picture is enlarged (round 3.0 finding). */}
          {showCaptions && safeRenderValue(img.caption) ? (
            <figcaption
              style={{
                fontSize: 'var(--pw-font-size-sm, 14px)',
                lineHeight: 1.45,
                color: 'var(--pw-color-text-muted, #71717a)',
                overflowWrap: 'anywhere',
              }}
            >
              {safeRenderValue(img.caption)}
            </figcaption>
          ) : null}
          </figure>
        ))}
      </div>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={nameOf(open, openIndex ?? 0)}
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: OVERLAY_SCRIM_STRONG,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 1000,
            padding: 24,
          }}
        >
          <style>{PRESS_CSS + HIT_AREA_CSS}</style>
          <button data-pw-press=""
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={messageOf(appWords, 'ui.gallery.close', '')}
            data-pw-hit=""
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 36,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: `1px solid ${ON_OVERLAY_SCRIM}`,
              borderRadius: 'var(--pw-border-radius-full, 9999px)',
              background: 'transparent',
              color: ON_OVERLAY_SCRIM,
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img src={open.src} alt={open.alt ?? ''} onClick={close} style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 'var(--pw-border-radius-lg)' }} />
          {open.caption && <p style={{ color: ON_OVERLAY_SCRIM, fontSize: 'var(--pw-font-size-sm, 14px)' }}>{safeRenderValue(open.caption)}</p>}
        </div>
      )}
    </div>
  )
}
