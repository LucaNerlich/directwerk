import 'server-only'

import {
    createDirectwerkServerClient,
    createServerTransport,
} from '@directwerk/api/server'

/**
 * Web BFF upstream configuration.
 *
 * 16 MiB response cap: public list endpoints return full article/episode bodies
 * (up to 512 KB each) and the backend has no pagination yet.
 */
const transport = createServerTransport({maxResponseBytes: 16_777_216})

export const REFRESH_COOKIE = 'dw_web_refresh'

const directwerk = createDirectwerkServerClient({transport})
export const directwerkFetch = directwerk.fetch.bind(directwerk)
export const getOAuthClientId = directwerk.getOAuthClientId.bind(directwerk)
