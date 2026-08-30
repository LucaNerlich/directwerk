export {
    resolveTenantHost,
    resolveTenantHostFromHeaders,
    type ResolveTenantHostFromHeadersOptions,
    type ResolveTenantHostOptions,
    type TenantHostHeaderReader,
} from './resolveTenantHost'
export {getClientTenantHost} from './getClientTenantHost'
export {
    clearTenantHostCookieInDocument,
    readTenantHostCookieFromDocument,
    TENANT_HOST_COOKIE,
} from './tenantHostCookie'
