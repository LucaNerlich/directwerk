import {describe, expect, it} from 'vitest'

import {sanitizeContentHtml} from './sanitizeContentHtml'

describe('sanitizeContentHtml', () => {
    it('preserves allowed article markup', () => {
        const html =
            '<h2>Intro</h2><p>Hello <strong>friend</strong> and <em>world</em>.</p>' +
            '<ul><li>One</li></ul><p><a href="https://example.test/x">Link</a></p>'
        expect(sanitizeContentHtml(html)).toContain('<h2>Intro</h2>')
        expect(sanitizeContentHtml(html)).toContain('<strong>friend</strong>')
        expect(sanitizeContentHtml(html)).toContain(
            '<a href="https://example.test/x">Link</a>',
        )
    })

    it('strips scripts, event handlers, and active SVG', () => {
        expect(
            sanitizeContentHtml('<p onclick="alert(1)">x</p><script>alert(2)</script>'),
        ).toBe('<p>x</p>')
        expect(
            sanitizeContentHtml(
                '<svg onload="alert(1)"><script>alert(2)</script></svg><p>ok</p>',
            ),
        ).toBe('<p>ok</p>')
    })

    it('blocks javascript: URLs on anchors', () => {
        expect(
            sanitizeContentHtml('<p><a href="javascript:alert(1)">bad</a></p>'),
        ).toBe('<p><a>bad</a></p>')
    })

    it('preserves tel: links', () => {
        expect(
            sanitizeContentHtml('<p><a href="tel:+491234567890">call</a></p>'),
        ).toBe('<p><a href="tel:+491234567890">call</a></p>')
    })
})
