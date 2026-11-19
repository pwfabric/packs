import * as React from 'react'
import type { BlockDefinition } from '@pwfabric/core'
import type { BlockComponent } from '../../../lib/component-types.js'
import { safeRenderValue, ICON_PATHS } from '../../../lib/_kit.js'
import { SURFACE_EVENTS } from '@pwfabric/contracts'
import { useSurfaceEvents, useSurfaceId } from '../../../lib/hooks.js'

// ============================================================
// PROPS — declared in manifest.json, applied by the runtime
// ============================================================

export interface FileDropzoneProps {
  readonly name?: string
  /** Optional: unset reads "Drop files here or browse" (the app's word goes here). */
  readonly label?: string
  readonly accept: string
  readonly multiple: boolean
  readonly maxSizeMb: number
}

// ============================================================
// DEFINITION
// ============================================================

export const fileDropzoneDefinition: BlockDefinition = {
  type: 'file-dropzone',
  name: 'File Dropzone',
  category: 'form',
  icon: '⇪',
  defaultProps: {
    label: 'Drop files here or browse',
    accept: '',
    multiple: false,
    maxSizeMb: 0,
  },
  defaultLayout: { span: { xs: 4, sm: 6, md: 6, lg: 6 } },
  canHaveChildren: false,
  allowedParents: ['form', 'container'],
}

// ============================================================
// COMPONENT
// ============================================================

const ACCEPT_WORDS: Record<string, string> = {
  'image/*': 'images', 'video/*': 'videos', 'audio/*': 'audio files', 'text/*': 'text files',
  'image/jpeg': 'JPEG', 'image/jpg': 'JPEG', '.jpg': 'JPEG', '.jpeg': 'JPEG',
  'image/svg+xml': 'SVG', 'application/pdf': 'PDF', 'text/plain': 'TXT', 'text/csv': 'CSV',
  'application/msword': 'DOC', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/zip': 'ZIP', 'application/json': 'JSON',
}

/** The accept list in plain words for the visitor: "image/png,image/jpeg" → "PNG or JPEG". */
function describeAccept(accept: string): string {
  const words: string[] = []
  for (const raw of accept.split(',')) {
    const t = raw.trim().toLowerCase()
    if (!t) continue
    const sub = (t.split('/')[1] ?? t).replace(/^x-/, '').split(/[+.-]/)[0] ?? ''
    const w = ACCEPT_WORDS[t] ?? (t.startsWith('.') ? t.slice(1) : sub).toUpperCase()
    if (w && !words.includes(w)) words.push(w)
  }
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`
}

/**
 * A FORM WRITE CARRIES NO FILES. A record write sends the record's declared
 * fields as JSON (data-protocol §4.1) and a File serialises to `{}`, so the
 * foundation form leaves file inputs out of its payload. A dropzone inside a
 * form still lets the visitor pick (and the page can show the names it
 * emits), but nothing reaches the record — the developer is told once, in the
 * console, instead of a silent `{}` in the stored row.
 */
let warnedInForm = false
export const FILE_IN_FORM_WARNING =
  'file-dropzone: a file inside a form goes with the write — a record with no file field refuses it before sending (a validation failure naming this field), so the save fails rather than drop the file. Keep the dropzone out of forms whose record has no file field.'

export const FileDropzoneBlock: BlockComponent = ({ props, block, context }) => {
  const { emit } = useSurfaceEvents()
  const surfaceId = useSurfaceId()

  const p = props as unknown as FileDropzoneProps
  const label = p.label ?? 'Drop files here or browse'
  const { accept, multiple, maxSizeMb } = p
  const name = typeof p.name === 'string' ? p.name : undefined

  const inert = context.interactionMode === 'inert'

  const [dragOver, setDragOver] = React.useState(false)
  const [fileNames, setFileNames] = React.useState<string[]>([])
  const [rejected, setRejected] = React.useState<string[]>([])
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    // A dropzone with no name sends nothing with the write, so there is nothing to warn about.
    if (warnedInForm || inert || !(inputRef.current?.name ?? '')) return
    if (inputRef.current?.closest('form')) {
      warnedInForm = true
      console.warn(FILE_IN_FORM_WARNING)
    }
  }, [inert])

  /** Does the file match the `accept` list (".png", "image/*", "image/png")? */
  const accepts = (f: File): boolean => {
    const tokens = accept.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    if (tokens.length === 0) return true
    const type = (f.type || '').toLowerCase()
    const fname = f.name.toLowerCase()
    return tokens.some((t) =>
      t.startsWith('.') ? fname.endsWith(t) : t.endsWith('/*') ? type.startsWith(t.slice(0, -1)) : type === t
    )
  }

  /**
   * Put the accepted files INTO the named file input.
   * A drop never reached the input, so a dragged file was shown and then not
   * submitted; the form gathers `new FormData(form)`, which only reads the
   * input. `DataTransfer` is how a script builds a FileList; where a browser
   * lacks it the dropped files can be shown but not attached, and the picker
   * still works.
   */
  const attach = (files: File[]): void => {
    const input = inputRef.current
    if (!input) return
    try {
      if (typeof DataTransfer !== 'function') return
      const dt = new DataTransfer()
      for (const f of files) dt.items.add(f)
      input.files = dt.files
    } catch {
      /* an old engine: the names still show, the files are not attached */
    }
  }

  const handleFiles = (list: FileList | File[] | null): void => {
    if (inert || !list) return
    let files = Array.from(list as ArrayLike<File>)
    if (!multiple) files = files.slice(0, 1)
    const bad: string[] = []
    const good = files.filter((f) => {
      const tooBig = maxSizeMb > 0 && f.size > maxSizeMb * 1024 * 1024
      const ok = accepts(f) && !tooBig
      if (!ok) bad.push(tooBig ? `${f.name}: larger than ${maxSizeMb} MB` : `${f.name}: file type not accepted`)
      return ok
    })
    attach(good)
    setRejected(bad)
    const names = good.map((f) => f.name)
    setFileNames(names)
    emit({
      type: SURFACE_EVENTS.INPUT_CHANGE,
      surfaceId,
      blockId: block.id,
      payload: { value: names, names, inputId: block.id, name },
    })
  }

  const openPicker = (): void => {
    if (inert) return
    inputRef.current?.click()
  }

  const iconPaths = ICON_PATHS.image ?? ICON_PATHS['file-text'] ?? []

  return (
    <div
      id={block.id}
      data-block-id={block.id}
      data-block-type="file-dropzone"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pw-space-xs, 4px)',
        width: '100%',
        ...block.style,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!inert) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles((e.dataTransfer?.files as FileList | File[] | undefined) ?? null)
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--pw-space-sm, 8px)',
          textAlign: 'center',
          padding: 'var(--pw-space-xl, 32px) var(--pw-space-lg, 24px)',
          borderRadius: 'var(--pw-border-radius-lg, 12px)',
          border: dragOver
            ? '2px dashed var(--pw-color-primary, #18181b)'
            : '2px dashed var(--pw-color-border, #e4e4e7)',
          background: dragOver
            ? 'var(--pw-color-primary-subtle, color-mix(in srgb, var(--pw-color-primary, #18181b) 8%, var(--pw-color-card, #ffffff)))'
            : 'var(--pw-color-card, #ffffff)',
          color: 'var(--pw-color-text-muted-on-card, var(--pw-color-text-muted, #71717a))',
          cursor: inert ? 'default' : 'pointer',
          transition: 'border-color var(--pw-duration-fast, 150ms), background var(--pw-duration-fast, 150ms)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--pw-border-radius-full, 9999px)',
            background: 'var(--pw-color-primary-subtle, color-mix(in srgb, var(--pw-color-primary, #18181b) 10%, var(--pw-color-card, #ffffff)))',
            color: 'var(--pw-color-primary-ink, #18181b)',
          }}
          aria-hidden="true"
        >
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: iconPaths.join('') }}
          />
        </span>
        <span
          style={{
            fontSize: 'var(--pw-font-size-sm, 14px)',
            color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
            fontWeight: 500,
          }}
        >
          {safeRenderValue(label)}
        </span>
        {maxSizeMb > 0 && (
          <span style={{ fontSize: 'var(--pw-font-size-xs, 12px)' }}>
            {`Max ${maxSizeMb} MB`}
            {accept ? ` · ${describeAccept(accept)}` : ''}
          </span>
        )}
        {rejected.length > 0 && (
          <span
            role="alert"
            style={{ fontSize: 'var(--pw-font-size-xs, 12px)', color: 'var(--pw-color-error, #b91c1c)' }}
          >
            {rejected.join(' · ')}
          </span>
        )}
        {fileNames.length > 0 && (
          <span
            style={{
              fontSize: 'var(--pw-font-size-xs, 12px)',
              color: 'var(--pw-color-text-on-card, var(--pw-color-text, #09090b))',
            }}
          >
            {fileNames.join(', ')}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept || undefined}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  )
}
