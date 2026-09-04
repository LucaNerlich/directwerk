import sanitizeHtml from 'sanitize-html'

/** Matches Directwerk HtmlSanitizer's allowlist for public content HTML. */
const CONTENT_HTML_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'img', 'figure', 'figcaption'],
    allowedAttributes: {
        a: ['href'],
        img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
        img: ['https'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
}

export function sanitizeContentHtml(html: string): string {
    return sanitizeHtml(html, CONTENT_HTML_OPTIONS)
}
