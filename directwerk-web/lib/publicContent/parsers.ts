import {createPublicContentParsers} from '@directwerk/api/validation/public'

import {renderContentHtml} from '@/lib/renderContentHtml'

export function createWebPublicParsers() {
    return createPublicContentParsers({
        // HTML from TipTap is sanitized; CommonMark (MCP/import) is converted
        // then sanitized so catalog/detail/JSON-LD always see safe HTML.
        sanitizeHtml: renderContentHtml,
    })
}

/**
 * Catalog/list payloads carry no rendered HTML (only detail fetchers do), so they must not
 * pull marked/sanitize-html/postcss into the client bundle (#1069). The two
 * `dangerouslySetInnerHTML` sinks on the detail pages still render through
 * `renderContentHtml`.
 */
export function createWebCatalogParsers() {
    return createPublicContentParsers({sanitizeHtml: (html: string) => html})
}
