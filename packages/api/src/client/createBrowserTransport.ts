import type {ErrorMessageCatalog} from '../envelope'
import {
    createAuthedRequest,
    createJsonRequest,
    type AuthedRequestConfig,
    type AuthedRequestFn,
    type AuthedRequestSession,
} from './authedRequest'
import type {TransportPolicy} from './policies'

export interface BrowserTransport {
    INVALID_RESPONSE: string
    ERROR_CATALOG: ErrorMessageCatalog
    jsonRequest: (path: string, init?: RequestInit) => Promise<unknown>
    authedFetch: AuthedRequestFn
    request: (path: string, tenantHost: string | null, init?: RequestInit) => Promise<unknown>
    authenticatedRequest: (
        path: string,
        tenantHost: string | null,
        init?: RequestInit,
    ) => Promise<unknown>
    postJson: (path: string, tenantHost: string | null, body: unknown) => Promise<unknown>
    jsonInit: (method: 'POST' | 'PUT' | 'PATCH', body: unknown) => RequestInit
    proxyRequest?: <T>(
        path: string,
        tenantHost: string,
        init: RequestInit | undefined,
        parser: (value: unknown) => {data: T} | null,
        errorMessage: string,
    ) => Promise<T>
    bindTenantHost?: (getHost: () => string) => void
}

export interface CreateBrowserTransportConfig {
    policy: TransportPolicy
    session: AuthedRequestSession
    clearTokens: () => void
    resolveTenantHost: () => string
    bindableTenantHost?: boolean
    includeProxyRequest?: boolean
    jsonInitMethods?: Array<'POST' | 'PUT' | 'PATCH'>
}

export function createBrowserTransport(
    config: CreateBrowserTransportConfig,
): BrowserTransport {
    let resolveTenantHost = config.resolveTenantHost

    const INVALID_RESPONSE = config.policy.invalidResponseMessage!
    const ERROR_CATALOG = config.policy.catalog!

    function baseHeaders(): Record<string, string> {
        return {'X-Tenant-Host': resolveTenantHost()}
    }

    const jsonRequest = createJsonRequest({
        baseHeaders,
        invalidResponseMessage: INVALID_RESPONSE,
        catalog: ERROR_CATALOG,
    })

    const authedRequestConfig: AuthedRequestConfig = {
        session: config.session,
        clearTokens: config.clearTokens,
        baseHeaders,
        ...config.policy,
    }
    if (config.policy.catalog !== undefined) {
        authedRequestConfig.catalog = config.policy.catalog
    }

    const authedFetch = createAuthedRequest(authedRequestConfig)

    function request(
        path: string,
        _tenantHost: string | null,
        init?: RequestInit,
    ): Promise<unknown> {
        return jsonRequest(path, init)
    }

    function authenticatedRequest(
        path: string,
        _tenantHost: string | null,
        init?: RequestInit,
    ): Promise<unknown> {
        return authedFetch(path, init)
    }

    async function postJson(
        path: string,
        tenantHost: string | null,
        body: unknown,
    ): Promise<unknown> {
        return request(path, tenantHost, jsonInit('POST', body))
    }

    const allowedMethods = new Set(config.jsonInitMethods ?? ['POST', 'PUT'])

    function jsonInit(method: 'POST' | 'PUT' | 'PATCH', body: unknown): RequestInit {
        if (!allowedMethods.has(method)) {
            throw new Error(`Unsupported JSON method: ${method}`)
        }
        return {
            method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
        }
    }

    const transport: BrowserTransport = {
        INVALID_RESPONSE,
        ERROR_CATALOG,
        jsonRequest,
        authedFetch,
        request,
        authenticatedRequest,
        postJson,
        jsonInit,
    }

    if (config.bindableTenantHost === true) {
        transport.bindTenantHost = (getHost: () => string) => {
            resolveTenantHost = getHost
        }
    }

    if (config.includeProxyRequest === true) {
        transport.proxyRequest = async <T>(
            path: string,
            tenantHost: string,
            init: RequestInit | undefined,
            parser: (value: unknown) => {data: T} | null,
            errorMessage: string,
        ): Promise<T> => {
            const parsed = parser(await authenticatedRequest(path, tenantHost, init))
            if (parsed === null) {
                throw new Error(errorMessage)
            }
            return parsed.data
        }
    }

    return transport
}
