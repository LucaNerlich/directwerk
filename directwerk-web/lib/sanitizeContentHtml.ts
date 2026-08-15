import sanitizeHtml from 'sanitize-html'

/** Matches Directwerk HtmlSanitizer allowlist for article body / episode show notes. */
const CONTENT_HTML_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h2', 'h3'],
    allowedAttributes: {
        a: ['href'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
}

export function sanitizeContentHtml(html: string): string {
    return sanitizeHtml(html, CONTENT_HTML_OPTIONS)
}
