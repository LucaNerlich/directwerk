import 'server-only'

import {
    createDirectwerkServerClient,
    createServerTransport,
} from '@directwerk/api/server'

/**
 * Studio BFF upstream configuration.
 *
 * The 16 MiB response cap matches the backend's unpaginated list endpoints:
 * episode descriptions and article bodies can be up to 512 KB each, so a
 * growing catalog easily exceeds a 1 MiB cap and would permanently break
 * list pages.
 */
const transport = createServerTransport({maxResponseBytes: 16_777_216})

export const REFRESH_COOKIE = 'dw_studio_refresh'

const directwerk = createDirectwerkServerClient({transport})
export const directwerkFetch = directwerk.fetch.bind(directwerk)
export const getOAuthClientId = directwerk.getOAuthClientId.bind(directwerk)
