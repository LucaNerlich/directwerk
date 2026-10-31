import {marked} from 'marked'

import {sanitizeContentHtml} from './sanitizeContentHtml'

/** Tags the shared content allowlist (and TipTap) actually emit. */
const CONTENT_HTML_TAG_RE =
    /<\/?(?:p|br|strong|em|s|a|ul|ol|li|h[1-6]|blockquote|hr|img|figure|figcaption)\b/i

/**
 * OWASP `HtmlSanitizer` escapes Markdown when writers (MCP, bulk import) send
 * raw MD instead of TipTap HTML — e.g. `&gt;` for blockquotes, `&amp;` for `&`.
 * Decode only on the Markdown path before parsing.
 */
function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
            String.fromCodePoint(Number.parseInt(hex, 16)),
        )
        .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
        .replace(/&amp;/g, '&')
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

export function looksLikeContentHtml(value: string): boolean {
    return CONTENT_HTML_TAG_RE.test(value)
}

/**
 * Turn stored article/episode body into safe HTML for `dangerouslySetInnerHTML`.
 *
 * Contract: Studio TipTap and the Java `HtmlSanitizer` treat `body` as HTML.
 * MCP / Markdown imports often store CommonMark (sometimes entity-escaped).
 * HTML bodies are sanitized as-is; Markdown is converted, then sanitized.
 */
export function renderContentHtml(body: string): string {
    if (body.length === 0) {
        return ''
    }

    if (looksLikeContentHtml(body)) {
        return sanitizeContentHtml(body)
    }

    const markdown = decodeHtmlEntities(body)
    const html = marked.parse(markdown, {async: false}) as string
    return sanitizeContentHtml(normalizeHeadingLevels(html))
}
