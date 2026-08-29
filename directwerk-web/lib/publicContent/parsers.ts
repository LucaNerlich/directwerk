import {createPublicContentParsers} from '@directwerk/api/validation/public'

import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'

export function createWebPublicParsers() {
    return createPublicContentParsers({
        sanitizeHtml: sanitizeContentHtml,
    })
}
