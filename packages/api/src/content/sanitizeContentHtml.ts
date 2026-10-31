import sanitizeHtml from 'sanitize-html'

/** Absolute http(s) leave the site; relative / mailto / tel stay same-tab. */
function isExternalHref(href: string | undefined): boolean {
    if (href === undefined || href.length === 0) {
        return false
    }
    const trimmed = href.trim().toLowerCase()
    return trimmed.startsWith('https://') || trimmed.startsWith('http://')
}

/**
 * Matches Directwerk HtmlSanitizer's allowlist for public content HTML, plus
 * forced `target`/`rel` on external anchors for public render / Studio preview.
 */
const CONTENT_HTML_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'p',
        'br',
        'strong',
        'em',
        's',
        'a',
        'ul',
        'ol',
        'li',
        'h2',
        'h3',
        'blockquote',
        'hr',
        'img',
        'figure',
        'figcaption',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
    ],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'title'],
        th: ['align'],
        td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
        img: ['https'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    transformTags: {
        a: (_tagName, attribs) => {
            const {target: _target, rel: _rel, ...rest} = attribs
            if (isExternalHref(rest.href)) {
                return {
                    tagName: 'a',
                    attribs: {
                        ...rest,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                    },
                }
            }
            return {tagName: 'a', attribs: rest}
        },
    },
}

export function sanitizeContentHtml(html: string): string {
    return sanitizeHtml(html, CONTENT_HTML_OPTIONS)
}
