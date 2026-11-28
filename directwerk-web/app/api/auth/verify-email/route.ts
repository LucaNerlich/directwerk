import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: '/api/v1/auth/verify-email',
    parse: (value) => {
        if (typeof value !== 'object' || value === null || !('token' in value)) {
            return null
        }
        const token = (value as {token?: unknown}).token
        if (typeof token !== 'string') {
            return null
        }
        const trimmed = token.trim()
        return trimmed.length === 0 ? null : {token: trimmed}
    },
    invalidInputMessage: 'A valid verification token is required.',
    codes: {
        body: 'INVALID_REQUEST_BODY',
        invalidInput: 'INVALID_VERIFY_EMAIL_INPUT',
        upstream: 'UPSTREAM_UNAVAILABLE',
    },
})
