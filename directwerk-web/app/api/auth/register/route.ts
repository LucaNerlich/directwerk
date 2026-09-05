import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'
import {parseRegisterInput} from '@directwerk/api/validation/input'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: '/api/v1/auth/register',
    parse: parseRegisterInput,
    invalidInputMessage: 'Valid email, password, and optional name are required.',
    requireTenantHost: true,
})
