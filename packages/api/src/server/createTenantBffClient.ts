import 'server-only'

import {createDirectwerkServerClient} from './upstream'
import {createServerTransport} from './transport'

export interface TenantBffClient {
    REFRESH_COOKIE: string
    directwerkFetch: ReturnType<typeof createDirectwerkServerClient>['fetch']
    getOAuthClientId: ReturnType<typeof createDirectwerkServerClient>['getOAuthClientId']
}

export interface CreateTenantBffClientOptions {
    refreshCookieName: string
    maxResponseBytes?: number
}

/** Studio/web BFF upstream client with shared transport limits. */
export function createTenantBffClient(options: CreateTenantBffClientOptions): TenantBffClient {
    const transport = createServerTransport({
        maxResponseBytes: options.maxResponseBytes ?? 16_777_216,
    })
    const directwerk = createDirectwerkServerClient({transport})

    return {
        REFRESH_COOKIE: options.refreshCookieName,
        directwerkFetch: directwerk.fetch.bind(directwerk),
        getOAuthClientId: directwerk.getOAuthClientId.bind(directwerk),
    }
}
