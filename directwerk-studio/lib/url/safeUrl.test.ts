import {describe, expect, it} from 'vitest'

import {safeImageSrc, safeLinkHref} from './safeUrl'

describe('safeLinkHref', () => {
    it('allows http and https links', () => {
        expect(safeLinkHref('https://example.com/feed.xml')).toBe('https://example.com/feed.xml')
        expect(safeLinkHref('http://example.com/')).toBe('http://example.com/')
    })

    it('allows mailto and tel links', () => {
        expect(safeLinkHref('mailto:hi@example.com')).toBe('mailto:hi@example.com')
        expect(safeLinkHref('tel:+491234567')).toBe('tel:+491234567')
    })

    it('rejects script and data URLs', () => {
        expect(safeLinkHref('javascript:alert(1)')).toBeNull()
        expect(safeLinkHref('data:text/html;base64,PHNjcmlwdD4=')).toBeNull()
        expect(safeLinkHref('vbscript:msgbox(1)')).toBeNull()
    })

    it('rejects malformed values and empty input', () => {
        expect(safeLinkHref('not a url')).toBeNull()
        expect(safeLinkHref('')).toBeNull()
        expect(safeLinkHref(null)).toBeNull()
        expect(safeLinkHref(undefined)).toBeNull()
    })
})

describe('safeImageSrc', () => {
    it('allows https image URLs', () => {
        expect(safeImageSrc('https://cdn.example.com/cover.jpg')).toBe(
            'https://cdn.example.com/cover.jpg',
        )
    })

    it('rejects plain http for images', () => {
        expect(safeImageSrc('http://cdn.example.com/cover.jpg')).toBeNull()
    })

    it('rejects script and data URLs', () => {
        expect(safeImageSrc('javascript:alert(1)')).toBeNull()
        expect(safeImageSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull()
    })

    it('rejects malformed values and empty input', () => {
        expect(safeImageSrc('nope')).toBeNull()
        expect(safeImageSrc('')).toBeNull()
        expect(safeImageSrc(undefined)).toBeNull()
    })
})
