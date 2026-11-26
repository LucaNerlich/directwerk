import {createPublicContentParsers} from '@directwerk/api/validation/public'

/**
 * Catalog/list payloads use an identity sanitizer so these fetchers do not pull the
 * HTML pipeline into the client bundle; every render still goes through
 * `renderContentHtml` (#1069).
 */
export function createWebCatalogParsers() {
    return createPublicContentParsers({sanitizeHtml: (html: string) => html})
}
