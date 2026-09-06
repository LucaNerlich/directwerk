/**
 * Unified BFF proxy policy table (CONTEXT.md Wave 8 item #68).
 *
 * Single source of truth for per-app JSON body limits, empty-body
 * tolerance, and HEAD support. Route wrappers spread their row into the
 * factory config (e.g. `createTenantProxyRouteHandler({fetchUpstream,
 * ...PROXY_POLICIES.studioTenant})`).
 *
 * Query-validator mapping (unchanged, stays with the handlers):
 * - tenant rows (`studioTenant`, `webTenant`) use `buildSafeProxyQuery`
 *   in `routeHandler.ts` (feed-builder preview + media-library allowlists,
 *   blanket rejection everywhere else);
 * - platform rows (`platform`, `adminTenant`) use
 *   `buildSafePlatformQueryString` in `platformRouteHandler.ts`.
 */
export type ProxyPolicyRow = {
    name: string
    jsonBodyLimit: number
    allowMissingBody: boolean
    allowHead: boolean
}

export const PROXY_POLICIES: Record<
    'studioTenant' | 'webTenant' | 'platform' | 'adminTenant',
    ProxyPolicyRow
> = {
    studioTenant: {
        name: 'studioTenant',
        jsonBodyLimit: 1_048_576,
        allowMissingBody: true,
        allowHead: true,
    },
    webTenant: {
        name: 'webTenant',
        jsonBodyLimit: 16_384,
        allowMissingBody: false,
        allowHead: true,
    },
    platform: {
        name: 'platform',
        jsonBodyLimit: 65_536,
        allowMissingBody: false,
        allowHead: true,
    },
    adminTenant: {
        name: 'adminTenant',
        jsonBodyLimit: 65_536,
        allowMissingBody: false,
        allowHead: true,
    },
}
