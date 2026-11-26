import {createPublicContentParsers} from '@directwerk/api/validation/public'

import {renderContentHtml} from '@/lib/renderContentHtml'

export function createWebPublicParsers() {
    return createPublicContentParsers({
        // HTML from TipTap is sanitized; CommonMark (MCP/import) is converted
        // then sanitized so catalog/detail/JSON-LD always see safe HTML.
        sanitizeHtml: renderContentHtml,
    })
}
