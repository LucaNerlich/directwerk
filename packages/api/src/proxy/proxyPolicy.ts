/**
 * Unified BFF proxy policy table (CONTEXT.md Wave 8 item #68).
 *
 * Single source of truth for per-app JSON body limits. Tenant rows also carry the
 * empty-body tolerance the tenant handler reads; platform rows carry the limit only —
 * the platform handlers derive bodyless-DELETE tolerance from the method itself
 * (issue #591; the old `allowHead` flag had no reader anywhere).
 *
 * Query-validator mapping (unchanged, stays with the handlers):
 * - tenant rows (`studioTenant`, `webTenant`) use `buildSafeProxyQuery`
 *   in `routeHandler.ts` (feed-builder preview + media-library allowlists,
 *   blanket rejection everywhere else);
 * - platform rows (`platform`, `adminTenant`) use
 *   `buildSafePlatformQueryString` in `platformRouteHandler.ts`.
 */
export type TenantProxyPolicyRow = {
    jsonBodyLimit: number
    allowMissingBody: boolean
}

export type PlatformProxyPolicyRow = {
    jsonBodyLimit: number
}

export const PROXY_POLICIES: {
    studioTenant: TenantProxyPolicyRow
    webTenant: TenantProxyPolicyRow
    platform: PlatformProxyPolicyRow
    adminTenant: PlatformProxyPolicyRow
} = {
    studioTenant: {
        jsonBodyLimit: 1_048_576,
        allowMissingBody: true,
    },
    webTenant: {
        jsonBodyLimit: 16_384,
        allowMissingBody: false,
    },
    platform: {
        jsonBodyLimit: 65_536,
    },
    adminTenant: {
        jsonBodyLimit: 65_536,
    },
}
