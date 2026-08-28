import 'server-only'

import {
    createDirectwerkServerClient,
    createServerTransport,
} from '@directwerk/api/server'

/**
 * Web BFF upstream configuration.
 *
 * FIX: the response cap was raised from 1 MiB to 16 MiB to match
 * directwerk-studio. List endpoints return full detail rows (episode
 * descriptions and article bodies can be up to 512 KB each), so a growing
 * catalog easily exceeds a 1 MiB cap and would permanently break list pages.
 * The backend has no pagination yet.
 */
const transport = createServerTransport({maxResponseBytes: 16_777_216})

export const REFRESH_COOKIE = 'dw_web_refresh'

const directwerk = createDirectwerkServerClient({transport})
export const directwerkFetch = directwerk.fetch.bind(directwerk)
export const getOAuthClientId = directwerk.getOAuthClientId.bind(directwerk)
