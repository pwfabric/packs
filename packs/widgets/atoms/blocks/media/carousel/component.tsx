import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { HIT_AREA_CSS, listOf, MEDIA_LETTERBOX, ON_OVERLAY_SCRIM, OVERLAY_SCRIM, safeRenderValue } from '../../../lib/_kit.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

/**
 * The 32px arrows are DRAWN 44px on a phone (HIT_AREA_CSS's invisible box did
 * not count where a visitor's thumb or a measuring tool looks: the button's
 * own box), and keep the shared hit area beside that.
 */
const ARROW_HIT_CSS = '@media (max-width: 640px), (pointer: coarse) { [data-pw-arrow] { width: 44px !important; height: 44px !important; } }'

/** A slide dot is 24px around its 8px mark; on a phone the button is a full 44px target. */
const DOT_HIT_CSS = '@media (max-width: 640px), (pointer: coarse) { [data-pw-dot] { width: 44px !important; height: 44px !important; } }'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

/**
 * Slide 1 is usually the page's largest picture (its LCP): it loads eagerly at
 * high priority. Every other slide is lazy. React 19 writes `fetchPriority` as
 * the `fetchpriority` attribute.
 */
function slideLoading(first: boolean): { loading: 'eager' | 'lazy'; fetchPriority?: 'high'; decoding: 'async' } {
  return first ? { loading: 'eager', fetchPriority: 'high', decoding: 'async' } : { loading: 'lazy', decoding: 'async' }
}

export const CAROUSEL_ASPECT_RATIOS = ['16:9', '4:3', '1:1'] as const

export type CarouselItem = CarouselItemData

export interface CarouselProps {
  readonly items: readonly CarouselItem[]
  readonly autoplay: boolean
  /** 1000–10000 ms (the manifest bounds it). */
  readonly autoplayInterval: number
  readonly showDots: boolean
  readonly showArrows: boolean
  readonly aspectRatio: (typeof CAROUSEL_ASPECT_RATIOS)[number]
  /**
   * Number of slides shown side-by-side per view (an integer 1–6). Default 1
   * (classic single-slide behavior). When > 1, the carousel renders a card strip
   * showing that many slides at once and paginates by `slidesPerView` per
   * arrow/dot step.
   */
  readonly slidesPerView: number
}

// ============================================================
// DEFINITION
// ============================================================

export const carouselDefinition: BlockDefinition = {
  type: 'carousel',
  name: 'Carousel',
  category: 'media',
  icon: '◫',
  defaultProps: {
    items: [],
    autoplay: false,
    autoplayInterval: 3000,
    showDots: true,
    showArrows: true,
    aspectRatio: '16:9',
    slidesPerView: 1,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  // Children turn the carousel into a wrapper: any row of blocks (cards, stats,
  // testimonials) becomes a paginated strip. `items` stays the image-only path.
  canHaveChildren: true,
}

// ============================================================
// COMPONENT
// ============================================================

interface CarouselItemData {
  src: string
  alt?: string
  caption?: string
}

export const CarouselBlock: BlockComponent = ({ props, block, children, context }) => {
  // Children take precedence over `items`: when the carousel is used as a
  // wrapper around a row of blocks, each child is one slide and the image
  // letterbox does not apply (children bring their own height).
  const childSlides = React.Children.toArray(children).filter(Boolean)
  const p = props as unknown as CarouselProps
  const items = listOf<CarouselItemData>(p.items)
  const { showDots, showArrows, aspectRatio, autoplay, autoplayInterval } = p
  // `slidesPerView` > 1 switches to a multi-up card strip. Clamp to [1, slideCount]
  // (kept by hand: the manifest cannot tie it to the number of slides).
  const slideCount = childSlides.length > 0 ? childSlides.length : items.length
  const slidesPerView = Math.max(1, Math.min(p.slidesPerView, Math.max(slideCount, 1)))

  const isMulti = slidesPerView > 1
  // Respect interactionMode: autoplay is an active behavior, so freeze it in inert
  // (editor/preview) renders.
  const inert = context?.interactionMode === 'inert'

  const aspectMap: Record<string, string> = {
    '16:9': '56.25%',
    '4:3': '75%',
    '1:1': '100%',
  }

  // -----------------------------------------------------------------
  // Wrapper mode: children are the slides
  // -----------------------------------------------------------------
  // Always the strip renderer, even at slidesPerView 1 — the single-slide
  // renderer letterboxes into a fixed aspect box, which would clip a card.
  // Nothing to show: the published app renders nothing. The "◫ No items" stand-in
  // below is an editor affordance only — it reached visitors.
  if (childSlides.length === 0 && items.length === 0 && !inert) return null

  if (childSlides.length > 0) {
    return (
      <CarouselStrip
        block={block}
        slides={childSlides}
        slidesPerView={slidesPerView}
        showDots={showDots}
        showArrows={showArrows}
        autoplay={autoplay && !inert}
        autoplayInterval={autoplayInterval}
        arrowPlacement="gutter"
      />
    )
  }

  // -----------------------------------------------------------------
  // Multi-up card strip (slidesPerView > 1)
  // -----------------------------------------------------------------
  if (isMulti) {
    return (
      <CarouselStrip
        block={block}
        slides={items.map((item, i) => (
          <ImageSlide key={i} item={item} first={i === 0} aspectPad={aspectMap[aspectRatio] ?? '56.25%'} />
        ))}
        slidesPerView={slidesPerView}
        showDots={showDots}
        showArrows={showArrows}
        autoplay={autoplay && !inert}
        autoplayInterval={autoplayInterval}
      />
    )
  }

  // -----------------------------------------------------------------
  // Classic single-slide behavior (slidesPerView <= 1 / unset)
  // -----------------------------------------------------------------
  return (
    <CarouselSingle
      block={block}
      items={items}
      showDots={showDots}
      showArrows={showArrows}
      aspectPad={aspectMap[aspectRatio] ?? '56.25%'}
      autoplay={autoplay && !inert}
      autoplayInterval={autoplayInterval}
    />
  )
}

// ============================================================
// SINGLE-SLIDE VARIANT (unchanged behavior)
// ============================================================

interface SingleProps {
  block: { id: string; style?: React.CSSProperties }
  items: CarouselItemData[]
  showDots: boolean
  showArrows: boolean
  aspectPad: string
  autoplay: boolean
  autoplayInterval: number
}

const CarouselSingle: React.FC<SingleProps> = ({
  block,
  items,
  showDots,
  showArrows,
  aspectPad,
  autoplay,
  autoplayInterval,
}) => {
  const appWords = useAppMessages()
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    if (!autoplay || items.length <= 1) return
    const timer = window.setInterval(() => {
      setActiveIndex((i) => (i === items.length - 1 ? 0 : i + 1))
    }, autoplayInterval)
    return (): void => {
      window.clearInterval(timer)
    }
  }, [autoplay, autoplayInterval, items.length])

  const handlePrev = (): void => {
    setActiveIndex((i) => (i === 0 ? Math.max(items.length - 1, 0) : i - 1))
  }

  const handleNext = (): void => {
    setActiveIndex((i) => (i === items.length - 1 ? 0 : i + 1))
  }

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    paddingBottom: aspectPad,
    backgroundColor: MEDIA_LETTERBOX,
    borderRadius: '4px',
    overflow: 'hidden',
  }

  const slideStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const current = items[activeIndex]

  return (
    <div id={block.id} data-block-id={block.id} style={block.style as React.CSSProperties} data-block-type="carousel">
      <div style={containerStyle}>
        <div style={slideStyle}>
          {current ? (
            <img
              src={current.src}
              alt={current.alt ?? ''}
              {...slideLoading(activeIndex === 0)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{ color: 'var(--pw-color-text-muted)', fontSize: 'var(--pw-font-size-sm)' }}
            >
              ◫ No items
            </div>
          )}
        </div>
        {showArrows && items.length > 1 && (
          <>
            <style>{HIT_AREA_CSS + ARROW_HIT_CSS}</style>
            <button
              type="button"
              data-pw-hit=""
              data-pw-arrow=""
              onClick={handlePrev}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: OVERLAY_SCRIM,
                color: ON_OVERLAY_SCRIM,
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: 'var(--pw-font-size-base, 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={messageOf(appWords, 'ui.carousel.previous', '')}
            >
              ‹
            </button>
            <button
              type="button"
              data-pw-hit=""
              data-pw-arrow=""
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: OVERLAY_SCRIM,
                color: ON_OVERLAY_SCRIM,
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: 'var(--pw-font-size-base, 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={messageOf(appWords, 'ui.carousel.next', '')}
            >
              ›
            </button>
          </>
        )}
      </div>
      {showDots && items.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '4px',
          }}
        >
          <style>{DOT_HIT_CSS}</style>
          {items.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setActiveIndex(i)}
              data-pw-dot=""
              style={{
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label={`Go to slide ${i + 1}`}
            >
              <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: i === activeIndex ? 'var(--pw-color-primary)' : 'var(--pw-color-border)' }} />
            </button>
          ))}
        </div>
      )}
      {current?.caption && (
        <p
          style={{
            fontSize: 'var(--pw-font-size-xs)',
            color: 'var(--pw-color-text-muted)',
            textAlign: 'center',
            marginTop: '4px',
          }}
        >
          {safeRenderValue(current.caption)}
        </p>
      )}
    </div>
  )
}

// ============================================================
// MULTI-UP CARD STRIP VARIANT (slidesPerView > 1)
// ============================================================

/**
 * One image slide — the letterboxed aspect box plus optional caption. Extracted
 * so the image path and the children path feed the SAME strip renderer instead
 * of each carrying its own copy of the pagination machinery.
 */
const ImageSlide: React.FC<{ item: CarouselItemData; aspectPad: string; first?: boolean }> = ({
  item,
  aspectPad,
  first,
}) => (
  <>
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: aspectPad,
        backgroundColor: MEDIA_LETTERBOX,
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <img
        src={item.src}
        alt={item.alt ?? ''}
        {...slideLoading(first === true)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
    {item.caption && (
      <p
        style={{
          fontSize: 'var(--pw-font-size-xs)',
          color: 'var(--pw-color-text-muted)',
          textAlign: 'center',
          marginTop: '4px',
        }}
      >
        {safeRenderValue(item.caption)}
      </p>
    )}
  </>
)

interface StripProps {
  block: { id: string; style?: React.CSSProperties }
  slides: React.ReactNode[]
  slidesPerView: number
  showDots: boolean
  showArrows: boolean
  autoplay: boolean
  autoplayInterval: number
  /**
   * Where the arrows sit. Over an image, an overlaid arrow is the established
   * look and covers only picture. Over a child block it covers TEXT, so the
   * children path reserves a gutter beside the track instead.
   */
  arrowPlacement?: 'overlay' | 'gutter'
}

const ARROW_GUTTER = 40

const CarouselStrip: React.FC<StripProps> = ({
  block,
  slides,
  slidesPerView,
  showDots,
  showArrows,
  autoplay,
  autoplayInterval,
  arrowPlacement = 'overlay',
}) => {
  const appWords = useAppMessages()
  const gutter = showArrows && arrowPlacement === 'gutter' ? ARROW_GUTTER : 0
  const gap = 12 // px between cards
  // Pagination is page-based: each step advances by a full page of `slidesPerView`.
  const pageCount = Math.max(1, Math.ceil(slides.length / slidesPerView))
  const [page, setPage] = React.useState(0)
  const safePage = Math.min(page, pageCount - 1)

  React.useEffect(() => {
    if (!autoplay || pageCount <= 1) return
    const timer = window.setInterval(() => {
      setPage((p) => (p >= pageCount - 1 ? 0 : p + 1))
    }, autoplayInterval)
    return (): void => {
      window.clearInterval(timer)
    }
  }, [autoplay, autoplayInterval, pageCount])

  const handlePrev = (): void => {
    setPage((p) => (p <= 0 ? pageCount - 1 : p - 1))
  }
  const handleNext = (): void => {
    setPage((p) => (p >= pageCount - 1 ? 0 : p + 1))
  }

  // Each card occupies an equal fraction of the row, accounting for the gaps.
  const cardBasis = `calc((100% - ${(slidesPerView - 1) * gap}px) / ${slidesPerView})`
  // Translate the track by whole pages.
  const trackOffset = `calc(-${safePage * 100}% - ${safePage * gap}px)`

  // The gutter is padding on a WRAPPER, never on the clipping box: `overflow`
  // clips at the padding edge, so padding the viewport itself would let the next
  // slide show through the gutter instead of being cut off.
  const gutterStyle: React.CSSProperties = {
    paddingInline: gutter ? `${gutter}px` : undefined,
  }

  const viewportStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  }

  const trackStyle: React.CSSProperties = {
    display: 'flex',
    gap: `${gap}px`,
    transform: `translateX(${trackOffset})`,
    transition: 'transform 0.3s ease',
  }

  return (
    <div id={block.id} data-block-id={block.id} data-block-type="carousel">
      <div style={{ position: 'relative' }}>
        <div style={gutterStyle}>
          <div style={viewportStyle}>
            <div style={trackStyle}>
            {slides.length === 0 ? (
              <div
                style={{
                  color: 'var(--pw-color-text-muted)',
                  fontSize: 'var(--pw-font-size-sm)',
                  padding: '24px',
                }}
              >
                ◫ No items
              </div>
            ) : (
              slides.map((slide, i) => (
                <div
                  key={i}
                  data-slide-index={i}
                  style={{
                    flex: `0 0 ${cardBasis}`,
                    maxWidth: cardBasis,
                    minWidth: 0,
                  }}
                >
                  {slide}
                </div>
              ))
            )}
            </div>
          </div>
        </div>
        {showArrows && pageCount > 1 && (
          <>
            <style>{HIT_AREA_CSS + ARROW_HIT_CSS}</style>
            <button
              type="button"
              data-pw-hit=""
              data-pw-arrow=""
              onClick={handlePrev}
              style={{
                position: 'absolute',
                left: gutter ? '4px' : '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: OVERLAY_SCRIM,
                color: ON_OVERLAY_SCRIM,
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: 'var(--pw-font-size-base, 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
              aria-label={messageOf(appWords, 'ui.carousel.previous', '')}
            >
              ‹
            </button>
            <button
              type="button"
              data-pw-hit=""
              data-pw-arrow=""
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: gutter ? '4px' : '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: OVERLAY_SCRIM,
                color: ON_OVERLAY_SCRIM,
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: 'var(--pw-font-size-base, 16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
              aria-label={messageOf(appWords, 'ui.carousel.next', '')}
            >
              ›
            </button>
          </>
        )}
      </div>
      {showDots && pageCount > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '4px',
          }}
        >
          <style>{DOT_HIT_CSS}</style>
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setPage(i)}
              data-pw-dot=""
              style={{
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label={`Go to slide group ${i + 1}`}
            >
              <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: i === safePage ? 'var(--pw-color-primary)' : 'var(--pw-color-border)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
