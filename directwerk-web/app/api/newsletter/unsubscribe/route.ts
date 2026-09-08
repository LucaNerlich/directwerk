import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'
import {parseNewsletterTokenInput} from '@directwerk/api/validation/input'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: '/api/v1/public/newsletter/unsubscribe',
    parse: parseNewsletterTokenInput,
    invalidInputMessage: 'A valid unsubscribe token is required.',
    requireTenantHost: true,
})
