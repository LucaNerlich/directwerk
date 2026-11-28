import {marked} from 'marked'

import {sanitizeContentHtml} from './sanitizeContentHtml'

const TIPTAP_TAGS = 'p|h[1-6]|ul|ol|li|blockquote|pre|hr|table|thead|tbody|tr|td|th|figure|figcaption|img|a|strong|em|s|code|br'
const LEADING_TAG = new RegExp(`^\\s*<(?:${TIPTAP_TAGS})\\b[^>]*>`, 'i')

/**
 * TipTap documents start with one of the tags its schema emits. A CommonMark body may
 * start with an autolink (`<https://…>`) or a raw block such as `<div>`, which must
 * still go through Markdown conversion.
 */
export function looksLikeTipTapHtml(value: string): boolean {
    return LEADING_TAG.test(value)
}

/**
 * OWASP `HtmlSanitizer` escapes Markdown when writers (MCP, bulk import) send
 * raw MD instead of TipTap HTML — e.g. `&gt;` for blockquotes, `&amp;` for `&`.
 * Decode only on the Markdown path before parsing. Invalid code points are left
 * as the original entity (never throw).
 */
function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-f]+);/gi, (original, hex: string) => {
            const codePoint = Number.parseInt(hex, 16)
            return codePointToString(codePoint, original)
        })
        .replace(/&#(\d+);/g, (original, dec: string) => {
            const codePoint = Number(dec)
            return codePointToString(codePoint, original)
        })
        .replace(/&amp;/g, '&')
}

function codePointToString(codePoint: number, original: string): string {
    if (
        !Number.isFinite(codePoint) ||
        !Number.isInteger(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10_ffff
    ) {
        return original
    }
    try {
        return String.fromCodePoint(codePoint)
    } catch {
        return original
    }
}

/**
 * Studio TipTap only offers h2/h3; Markdown `#` becomes h1. Remap so sanitize
 * keep headings instead of stripping unknown levels.
 */
function normalizeHeadingLevels(html: string): string {
    return html
        .replace(/<h1(\s|>)/gi, '<h2$1')
        .replace(/<\/h1>/gi, '</h2>')
        .replace(/<h([4-6])(\s|>)/gi, '<h3$2')
        .replace(/<\/h[4-6]>/gi, '</h3>')
}

marked.setOptions({
    gfm: true,
    breaks: false,
})

/**
 * Turn stored article/episode body into safe HTML for `dangerouslySetInnerHTML`.
 *
 * Contract: Studio TipTap and the Java `HtmlSanitizer` treat `body` as HTML.
 * MCP / Markdown imports often store CommonMark (sometimes entity-escaped).
 * TipTap-shaped HTML bodies are sanitized as-is; Markdown is converted, then sanitized.
 */
export function renderContentHtml(body: string): string {
    if (body.length === 0) {
        return ''
    }

    if (looksLikeTipTapHtml(body)) {
        return sanitizeContentHtml(body)
    }

    const markdown = decodeHtmlEntities(body)
    const html = marked.parse(markdown, {async: false}) as string
    return sanitizeContentHtml(normalizeHeadingLevels(html))
}
