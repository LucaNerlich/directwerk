import {cleanup} from '@testing-library/react'
import {afterEach} from 'vitest'

import '@testing-library/jest-dom/vitest'

if (typeof globalThis.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
        readonly pointerId: number

        constructor(type: string, params: PointerEventInit = {}) {
            super(type, params)
            this.pointerId = params.pointerId ?? 0
        }
    }

    globalThis.PointerEvent = PointerEventPolyfill as typeof PointerEvent
}

afterEach(() => {
    cleanup()
})

if (typeof Element !== 'undefined' && Element.prototype.scrollIntoView === undefined) {
    Element.prototype.scrollIntoView = () => undefined
} else if (typeof Element !== 'undefined') {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (...args: unknown[]) {
        try {
            return (originalScrollIntoView as (...a: unknown[]) => void).apply(this, args)
        } catch {
            return undefined
        }
    }
}

// ProseMirror/TipTap call layout APIs (getClientRects, scrollToSelection) that
// jsdom does not implement. Polyfill them so editor commands like setImage
// don't throw unhandled errors in tests.
if (typeof Range !== 'undefined') {
    if (Range.prototype.getClientRects === undefined) {
        Range.prototype.getClientRects = () => [] as unknown as DOMRectList
    }
    if (Range.prototype.getBoundingClientRect === undefined) {
        Range.prototype.getBoundingClientRect = () =>
            ({x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0}) as DOMRect
    }
}
if (typeof Element !== 'undefined' && Element.prototype.getClientRects === undefined) {
    Element.prototype.getClientRects = () => [] as unknown as DOMRectList
}
if (typeof Node !== 'undefined' && (Node.prototype as unknown as Record<string, unknown>).getClientRects === undefined) {
    ;(Node.prototype as unknown as Record<string, unknown>).getClientRects = () =>
        [] as unknown as DOMRectList
}

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
    }),
})

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
    }),
})
