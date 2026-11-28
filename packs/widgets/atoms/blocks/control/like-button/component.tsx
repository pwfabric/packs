import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue, PRESS_CSS } from '../../../lib/_kit.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

/**
 * like-button — a social "like" affordance with a count. PURE UI STATE.
 *
 * This block once also read and wrote a SharePoint `UserLikes`
 * list through the connector bridge when `listName`+`itemId` were set — the
 * only control-family block that fetched. The block layer's law is that a
 * block never fetches: the count and the initial state arrive as props (a
 * pattern's dataSource binds them), and the click leaves as a surface event
 * whose payload names the block, the item and the new state. Persisting the
 * like is a behavior / capability decision made where the data lives, not
 * inside the button.
 */
export interface LikeButtonProps {
  readonly liked: boolean
  readonly count: number
  /** false: no count is drawn (the button is the like alone). Default true. */
  readonly showCount?: boolean
  /** Optional: unset reads "Like" (the app's word goes here). */
  readonly label?: string
  /** Optional identity of the thing being liked — echoed in the click payload. */
  readonly itemId?: string | number
}

export const LikeButtonDefinition: BlockDefinition = {
  type: 'like-button',
  name: 'LikeButton',
  category: 'control',
  icon: 'thumbs-up',
  defaultProps: { liked: false, count: 0, label: 'Like' },
  canHaveChildren: false,
}

const HEART_PATH =
  'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'

export const LikeButtonBlock: BlockComponent = ({ props, context, block }) => {
  const p = props as unknown as LikeButtonProps
  const { liked: initialLiked, count: initialCount } = p
  const label = p.label ?? 'Like'
  const showCount = p.showCount !== false
  const itemIdRaw = p.itemId
  const itemId = typeof itemIdRaw === 'string' || typeof itemIdRaw === 'number' ? String(itemIdRaw) : undefined
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const [liked, setLiked] = React.useState(initialLiked === true)
  const [count, setCount] = React.useState(Number(initialCount) || 0)
  const interactive = context?.interactionMode !== 'inert'

  // Props are the source of truth when they change (a bound count re-renders
  // the block with fresh numbers); the local state only carries the optimistic
  // toggle between two renders.
  React.useEffect(() => {
    setLiked(initialLiked === true)
  }, [initialLiked])
  React.useEffect(() => {
    setCount(Number(initialCount) || 0)
  }, [initialCount])

  const handleClick = (): void => {
    if (!interactive) return
    const next = !liked
    setLiked(next)
    setCount((c) => Math.max(0, c + (next ? 1 : -1)))
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: { liked: next, ...(itemId !== undefined ? { itemId } : {}) },
    })
    // ONE dispatch: `context.onEvent` reaches the same
    // renderer handler as the bus, so calling both processed every click twice
    // and a toggle behavior flipped the like back.
  }

  return (
    <>
    <style>{PRESS_CSS}</style>
    <button data-pw-press=""
      type="button"
      className="pw-like-button"
      data-block-type="like-button"
      data-block-id={block.id}
      onClick={handleClick}
      aria-pressed={liked}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        // A real 44px touch target (R3): 6px padding around a 16px heart measured 33px.
        minHeight: 44,
        boxSizing: 'border-box',
        padding: '6px 14px',
        borderRadius: 'var(--pw-border-radius-full)',
        border: `1px solid ${liked ? 'var(--pw-color-primary, #18181b)' : 'var(--pw-color-border, #e4e4e7)'}`,
        background: liked ? 'var(--pw-color-primary, #18181b)' : 'transparent',
        color: liked ? 'var(--pw-color-text-on-primary, #fafafa)' : 'var(--pw-color-text, #09090b)',
        fontSize: 'var(--pw-font-size-sm)',
        fontWeight: 600,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background var(--pw-duration-fast, 150ms) var(--pw-easing, cubic-bezier(0.4, 0, 0.2, 1))',
        ...block.style,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={HEART_PATH} />
      </svg>
      <span>{safeRenderValue(label)}</span>
      {showCount ? (
        <span aria-hidden="true" style={{ opacity: 0.85 }}>
          {count}
        </span>
      ) : null}
    </button>
    </>
  )
}

Object.assign(LikeButtonBlock, { sizing: 'intrinsic' })
