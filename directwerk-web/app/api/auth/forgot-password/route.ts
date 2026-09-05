import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'
import {parseForgotPasswordInput} from '@directwerk/api/validation/input'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: '/api/v1/auth/forgot-password',
    parse: parseForgotPasswordInput,
    invalidInputMessage: 'A valid email is required.',
})
