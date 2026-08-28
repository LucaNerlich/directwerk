import 'server-only'

import {headers} from 'next/headers'

import {
    resolveTenantHostFromHeaders,
    type ResolveTenantHostFromHeadersOptions,
} from './resolveTenantHost'

export function createGetTenantHost(
    options: ResolveTenantHostFromHeadersOptions = {},
): () => Promise<string> {
    return async function getTenantHost(): Promise<string> {
        const headerStore = await headers()
        return resolveTenantHostFromHeaders(headerStore, options)
    }
}
