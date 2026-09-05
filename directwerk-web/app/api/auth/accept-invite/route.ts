import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'
import {parseAcceptInviteInput} from '@directwerk/api/validation/input'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: '/api/v1/auth/accept-invite',
    parse: parseAcceptInviteInput,
    invalidInputMessage:
        'A valid invite token and a password of at least 12 characters are required.',
    codes: {
        body: 'INVALID_REQUEST_BODY',
        invalidInput: 'INVALID_ACCEPT_INVITE_INPUT',
        upstream: 'UPSTREAM_UNAVAILABLE',
    },
})
