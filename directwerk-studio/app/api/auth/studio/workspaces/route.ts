import {createTenantPassthroughAuthRoute} from '@directwerk/api/server'
import {parseLoginInput} from '@directwerk/api/validation/input'

import {directwerkFetch} from '@/lib/server/api'

export const POST = createTenantPassthroughAuthRoute({
    directwerkFetch,
    path: '/api/v1/auth/studio/workspaces',
    parse: parseLoginInput,
    invalidInputMessage: 'A valid email and password are required.',
    toUpstreamBody: (input) => ({email: input.email, password: input.password}),
})
