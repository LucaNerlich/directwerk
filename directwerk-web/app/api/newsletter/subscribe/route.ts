import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'
import {parseNewsletterSubscribeInput} from '@directwerk/api/validation/input'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: (input) =>
        `/api/v1/public/newsletter-lists/${encodeURIComponent(input.listSlug)}/subscribe`,
    parse: parseNewsletterSubscribeInput,
    toUpstreamBody: (input) => ({email: input.email}),
    invalidInputMessage: 'A valid list slug and email are required.',
    requireTenantHost: true,
})
