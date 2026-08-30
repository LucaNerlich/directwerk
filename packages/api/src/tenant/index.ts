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
    serializeClearTenantHostCookie,
    serializeTenantHostCookie,
    TENANT_HOST_COOKIE,
} from './tenantHostCookie'
