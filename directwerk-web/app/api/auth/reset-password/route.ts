import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'
import {parseResetPasswordInput} from '@directwerk/api/validation/input'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: '/api/v1/auth/reset-password',
    parse: parseResetPasswordInput,
    invalidInputMessage:
        'A valid reset token and a password of at least 12 characters are required.',
})
