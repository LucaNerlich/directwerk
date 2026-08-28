import {createPublicContentParsers} from '@directwerk/api/validation'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'

export function createWebPublicParsers() {
    return createPublicContentParsers({
        sanitizeHtml: sanitizeContentHtml,
    })
}
