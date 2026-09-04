import sanitizeHtml from 'sanitize-html'

/** Matches Directwerk HtmlSanitizer allowlist for article body / episode show notes.
 * Inline images from the media library (PUBLIC READY assets via https cdnUrl) are
 * allowed; audio/video/documents are embedded as plain links (no media tags). */
const CONTENT_HTML_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'img', 'figure', 'figcaption'],
    allowedAttributes: {
        a: ['href'],
        img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
}

export function sanitizeContentHtml(html: string): string {
    return sanitizeHtml(html, CONTENT_HTML_OPTIONS)
}
