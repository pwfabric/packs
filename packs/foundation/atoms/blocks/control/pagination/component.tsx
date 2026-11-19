import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'

/** Page buttons: 36px on a desktop, a real 44×44px touch target on a phone or touch screen. */
const PAGINATION_CSS =
  '[data-pw-pagination] { gap: 4px; }' +
  ' [data-pw-pagination] > [data-pw-hit] { min-width: 36px; height: 36px; box-sizing: border-box; }' +
  ' @media (max-width: 640px), (pointer: coarse) {' +
  ' [data-pw-pagination] { gap: 8px; }' +
  ' [data-pw-pagination] > [data-pw-hit] { min-width: 44px; height: 44px; } }'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'
import { messageOf, useAppMessages } from '@pwfabric/runtime'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface PaginationProps {
  /** State key the page offset is written to — `state[stateKey] = (page-1)*pageSize`; makes the control drive a data source. */
  readonly stateKey?: string
  /** Rows per page, used with `stateKey` to compute the offset. */
  readonly pageSize: number
  readonly totalPages: number
  readonly currentPage: number
  readonly showFirstLast: boolean
  /** 3–10. */
  readonly maxVisible: number
}

// ============================================================
// DEFINITION
// ============================================================

export const paginationDefinition: BlockDefinition = {
  type: 'pagination',
  name: 'Pagination',
  category: 'control',
  icon: '⋯',
  defaultProps: {
    totalPages: 10,
    currentPage: 1,
    showFirstLast: true,
    maxVisible: 5,
  },
  defaultLayout: { span: { xs: 4, sm: 8, md: 8, lg: 12 } },
  canHaveChildren: false,
}

// ============================================================
// COMPONENT
// ============================================================

export const PaginationBlock: BlockComponent = ({ props, block }) => {
  const appWords = useAppMessages()
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()
  const p = props as unknown as PaginationProps
  // Bounds are the manifest's: a value outside them renders the default.
  const totalPages = p.totalPages
  const [currentPage, setCurrentPage] = React.useState(Math.min(p.currentPage, totalPages))
  const showFirstLast = p.showFirstLast
  const maxVisible = p.maxVisible

  // `stateKey` makes the control DRIVE A QUERY: the click carries a declarative
  // `setState` action (the same shape a form's `onSubmitAction` uses), the
  // renderer writes `state[stateKey] = (page - 1) * pageSize`, and a data
  // source whose query reads `{{state.<stateKey>}}` re-fetches. Without it the
  // block only reports the page — measured, that made every
  // pagination on every surface cosmetic.
  const stateKey = typeof p.stateKey === 'string' && p.stateKey ? p.stateKey : undefined
  const pageSize = p.pageSize
  const handlePage = (page: number): void => {
    if (page < 1 || page > totalPages || page === currentPage) return
    setCurrentPage(page)
    emit({
      type: SURFACE_EVENTS.BLOCK_CLICK,
      surfaceId,
      blockId: block.id,
      payload: {
        page,
        pageChange: true,
        ...(stateKey ? { action: { type: 'setState', key: stateKey, value: (page - 1) * pageSize } } : { action: 'pageChange' }),
      },
    })
  }

  const getPages = (): (number | '...')[] => {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const half = Math.floor(maxVisible / 2)
    let start = Math.max(1, currentPage - half)
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1)
    }
    const pages: (number | '...')[] = []
    if (start > 1) {
      pages.push(1)
      if (start > 2) pages.push('...')
    }
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  // Size lives in PAGINATION_CSS, not inline: on a phone every page button is
  // a real 44×44 box with 8px between neighbours (36px boxes 4px apart were
  // measured too small, and their 44px hit areas overlapped).
  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: '1px solid var(--pw-color-border)',
    backgroundColor: 'var(--pw-color-card)',
    color: 'var(--pw-color-text-on-card, var(--pw-color-text))',
    fontSize: 'var(--pw-font-size-sm)',
    cursor: 'pointer',
    padding: '0 8px',
    fontWeight: 400,
  }

  const activeBtnStyle: React.CSSProperties = {
    ...btnBase,
    backgroundColor: 'var(--pw-color-primary)',
    borderColor: 'var(--pw-color-primary)',
    color: 'var(--pw-color-text-on-primary)',
    fontWeight: 600,
  }

  const disabledBtnStyle: React.CSSProperties = {
    ...btnBase,
    opacity: 0.4,
    cursor: 'not-allowed',
  }

  return (
    <nav
      id={block.id}
      data-block-id={block.id}
      data-block-type="pagination"
      aria-label={messageOf(appWords, 'ui.pagination.label', '')}
      data-pw-pagination=""
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' , ...block.style }}
    >
      <style>{PAGINATION_CSS}</style>
      {showFirstLast && (
        <button
          data-pw-hit=""
          style={currentPage === 1 ? disabledBtnStyle : btnBase}
          onClick={() => handlePage(1)}
          disabled={currentPage === 1}
          aria-label={messageOf(appWords, 'ui.pagination.first', '')}
        >
          «
        </button>
      )}
      <button
        data-pw-hit=""
        style={currentPage === 1 ? disabledBtnStyle : btnBase}
        onClick={() => handlePage(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label={messageOf(appWords, 'ui.pagination.previous', '')}
      >
        ‹
      </button>
      {getPages().map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} data-pw-hit="" aria-hidden="true" style={{ ...btnBase, cursor: 'default', border: 'none' }}>
            ⋯
          </span>
        ) : (
          <button
            key={page}
            data-pw-hit=""
            style={page === currentPage ? activeBtnStyle : btnBase}
            onClick={() => handlePage(page as number)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}
      <button
        data-pw-hit=""
        style={currentPage === totalPages ? disabledBtnStyle : btnBase}
        onClick={() => handlePage(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label={messageOf(appWords, 'ui.pagination.next', '')}
      >
        ›
      </button>
      {showFirstLast && (
        <button
          data-pw-hit=""
          style={currentPage === totalPages ? disabledBtnStyle : btnBase}
          onClick={() => handlePage(totalPages)}
          disabled={currentPage === totalPages}
          aria-label={messageOf(appWords, 'ui.pagination.last', '')}
        >
          »
        </button>
      )}
    </nav>
  )
}

// This block's width is its content: in a flex row it must not take an equal
// share. Declared here, applied by the runtime (>= 4.3).
// `Object.assign` rather than a property assignment so the pack compiles against
// runtime type versions that predate `BlockComponent.sizing`.
Object.assign(PaginationBlock, { sizing: 'intrinsic' })
