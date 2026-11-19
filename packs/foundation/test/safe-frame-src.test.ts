/**
 * safeFrameSrc: an iframe may load an absolute http(s) URL or the app's own
 * PDF or text document, and nothing else — no same-origin HTML (it would run
 * script with the app's privileges), no encoded or normalised path escape.
 */
import { describe, it, expect } from 'vitest'
import { safeFrameSrc } from '../atoms/lib/_shared-utils.js'

describe('safeFrameSrc', () => {
  it.each([
    ['pwpack/media/issue-12.pdf', 'pwpack/media/issue-12.pdf'],
    ['./pwpack/media/notes/a.txt', 'pwpack/media/notes/a.txt'],
    ['/pwpack/media/x.pdf', 'pwpack/media/x.pdf'],
    ['https://www.example.com/player', 'https://www.example.com/player'],
  ])('accepts %s', (src, out) => expect(safeFrameSrc(src)).toBe(out))

  it.each([
    'pwpack/media/x.html',
    'pwpack/media/x.htm',
    'pwpack/media/%2e%2e/x.pdf',
    'pwpack/media/../index.pdf',
    'pwpack/media/a\b.pdf',
    'pwpack/media//x.pdf',
    'pwpack/media/.hidden.pdf',
    '/index.html',
    'javascript:alert(1)',
    '//evil.example/x',
    'data:text/html,x',
  ])('refuses %s', (src) => expect(safeFrameSrc(src)).toBeUndefined())
})
