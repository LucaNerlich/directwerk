import type {LoginCredentials} from './validation'

export interface DirectwerkEnvironment {
    apiUrl: string
    clientId: string
    clientSecret: string
}

interface DirectwerkRequest {
    url: string
    init: RequestInit
}

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_.-]+$/
const SAFE_QUEUE_NAME = /^[A-Za-z0-9_-]+$/
const BEARER_TOKEN = /^Bearer [A-Za-z0-9\-._~+/]+=*$/
const MAX_AUTHORIZATION_LENGTH = 8192
const MAX_QUEUE_NAME_LENGTH = 100
const JOB_STATUSES = new Set([
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
])
const ASSET_STATUSES = new Set([
    'PENDING',
    'READY',
    'PENDING_DELETE',
    'ARCHIVED',
])
const ASSET_TYPES = new Set(['AUDIO', 'IMAGE', 'VIDEO', 'DOCUMENT'])
const ALLOWED_QUERY_PARAMS = new Set([
    'queue',
    'status',
    'assetType',
    'updatedAfter',
    'updatedBefore',
    'offset',
    'limit',
])
const ISO_INSTANT =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/

function normalizeApiUrl(rawApiUrl: string): string {
    const apiUrl = new URL(rawApiUrl)
    const isLocalHttp =
        apiUrl.protocol === 'http:' &&
        (apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1')

    if (
        (apiUrl.protocol !== 'https:' && !isLocalHttp) ||
        apiUrl.username ||
        apiUrl.password ||
        apiUrl.search ||
        apiUrl.hash ||
        (apiUrl.pathname !== '/' && apiUrl.pathname !== '')
    ) {
        throw new Error('Invalid Directwerk API URL.')
    }

    return apiUrl.origin
}

export function buildPlatformApiPath(segments: string[]): string {
    if (
        segments.length === 0 ||
        segments.some(
            (segment) =>
                !segment ||
                segment === '.' ||
                segment === '..' ||
                !SAFE_PATH_SEGMENT.test(segment)
        )
    ) {
        throw new Error('Invalid platform API path.')
    }

    return `/api/v1/platform/${segments.join('/')}`
}

/** Tenant-scoped paths under `/api/v1/...` (never `/platform/...`). */
export function buildTenantApiPath(segments: string[]): string {
    if (
        segments.length === 0 ||
        segments[0] === 'platform' ||
        segments.some(
            (segment) =>
                !segment ||
                segment === '.' ||
                segment === '..' ||
                !SAFE_PATH_SEGMENT.test(segment)
        )
    ) {
        throw new Error('Invalid tenant API path.')
    }

    return `/api/v1/${segments.join('/')}`
}

export function normalizeDirectwerkApiUrl(rawApiUrl: string): string {
    return normalizeApiUrl(rawApiUrl)
}

/**
 * Determines whether a queue name meets the allowed format and length requirements.
 *
 * @param value - The queue name to validate
 * @returns `true` if the queue name is valid, `false` otherwise
 */
function isSafeQueueName(value: string): boolean {
    return (
        value.length > 0 &&
        value.length <= MAX_QUEUE_NAME_LENGTH &&
        value !== '.' &&
        value !== '..' &&
        SAFE_QUEUE_NAME.test(value)
    )
}

function isSafeInstant(value: string): boolean {
    if (!ISO_INSTANT.test(value)) {
        return false
    }

    return !Number.isNaN(Date.parse(value))
}

function isSafeOffset(value: string): boolean {
    if (!/^\d+$/.test(value)) {
        return false
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isSafeInteger(parsed) && parsed >= 0
}

function isSafeLimit(value: string): boolean {
    if (!/^\d+$/.test(value)) {
        return false
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 100
}

export function buildSafePlatformQueryString(
    searchParams: URLSearchParams
): string {
    const safeParams = new URLSearchParams()

    for (const [name, value] of searchParams.entries()) {
        if (!ALLOWED_QUERY_PARAMS.has(name)) {
            throw new Error('Invalid platform API query.')
        }

        if (value.length === 0) {
            throw new Error('Invalid platform API query.')
        }

        switch (name) {
            case 'queue':
                if (!isSafeQueueName(value)) {
                    throw new Error('Invalid platform API query.')
                }
                break
            case 'status':
                if (!JOB_STATUSES.has(value) && !ASSET_STATUSES.has(value)) {
                    throw new Error('Invalid platform API query.')
                }
                break
            case 'assetType':
                if (!ASSET_TYPES.has(value)) {
                    throw new Error('Invalid platform API query.')
                }
                break
            case 'updatedAfter':
            case 'updatedBefore':
                if (!isSafeInstant(value)) {
                    throw new Error('Invalid platform API query.')
                }
                break
            case 'offset':
                if (!isSafeOffset(value)) {
                    throw new Error('Invalid platform API query.')
                }
                break
            case 'limit':
                if (!isSafeLimit(value)) {
                    throw new Error('Invalid platform API query.')
                }
                break
            default:
                throw new Error('Invalid platform API query.')
        }

        safeParams.append(name, value)
    }

    const queryString = safeParams.toString()
    return queryString.length > 0 ? `?${queryString}` : ''
}

export function parseBearerAuthorization(
    authorization: string | null
): string | null {
    if (
        !authorization ||
        authorization.length > MAX_AUTHORIZATION_LENGTH ||
        !BEARER_TOKEN.test(authorization)
    ) {
        return null
    }

    return authorization
}

export function createPlatformTokenRequest(
    credentials: LoginCredentials,
    environment: DirectwerkEnvironment
): DirectwerkRequest {
    const apiUrl = normalizeApiUrl(environment.apiUrl)
    const body = new URLSearchParams({
        grant_type: 'password',
        username: credentials.email,
        password: credentials.password,
        client_id: environment.clientId,
    })
    const basicCredentials = Buffer.from(
        `${environment.clientId}:${environment.clientSecret}`,
        'utf8'
    ).toString('base64')

    return {
        url: `${apiUrl}/oauth2/token`,
        init: {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Basic ${basicCredentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
            cache: 'no-store',
            redirect: 'manual',
        },
    }
}

export function createPlatformRefreshRequest(
    refreshToken: string,
    environment: DirectwerkEnvironment
): DirectwerkRequest {
    const apiUrl = normalizeApiUrl(environment.apiUrl)
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: environment.clientId,
    })
    const basicCredentials = Buffer.from(
        `${environment.clientId}:${environment.clientSecret}`,
        'utf8'
    ).toString('base64')

    return {
        url: `${apiUrl}/oauth2/token`,
        init: {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Basic ${basicCredentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
            cache: 'no-store',
            redirect: 'manual',
        },
    }
}

export function createPlatformApiRequest(
    segments: string[],
    request: Request,
    authorization: string,
    environment: DirectwerkEnvironment
): DirectwerkRequest {
    const apiUrl = normalizeApiUrl(environment.apiUrl)
    const headers = new Headers({
        Accept: 'application/json',
        Authorization: authorization,
    })
    const contentType = request.headers.get('content-type')

    if (contentType?.includes('application/json')) {
        headers.set('Content-Type', 'application/json')
    }

    let queryString = ''

    if (request.method === 'GET' || request.method === 'HEAD') {
        queryString = buildSafePlatformQueryString(
            new URL(request.url).searchParams
        )
    }

    return {
        url: `${apiUrl}${buildPlatformApiPath(segments)}${queryString}`,
        init: {
            method: request.method,
            headers,
            body:
                request.method === 'GET' || request.method === 'HEAD'
                    ? undefined
                    : request.body,
            cache: 'no-store',
            redirect: 'manual',
            duplex: request.body ? 'half' : undefined,
        } as RequestInit,
    }
}

export const NO_STORE_HEADERS = {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
}

export function jsonError(message: string, status: number): Response {
    return Response.json({error: message}, {status, headers: NO_STORE_HEADERS})
}

export async function safeUpstreamResponse(
    upstream: Response,
    method?: string
): Promise<Response> {
    if (!upstream.ok) {
        const message =
            upstream.status === 401
                ? 'Authentication failed.'
                : 'Directwerk request failed.'

        return Response.json(
            {error: message},
            {
                status: normalizeUpstreamStatus(upstream.status),
                headers: NO_STORE_HEADERS,
            }
        )
    }

    if (
        method === 'HEAD' ||
        upstream.status === 204 ||
        upstream.status === 205
    ) {
        const headers = new Headers(upstream.headers)
        headers.set('Cache-Control', 'no-store')
        headers.set('Pragma', 'no-cache')
        return new Response(null, {
            status: upstream.status,
            headers,
        })
    }

    if (!upstream.headers.get('content-type')?.includes('application/json')) {
        return Response.json(
            {error: 'Invalid response from Directwerk.'},
            {status: 502, headers: NO_STORE_HEADERS}
        )
    }

    try {
        return Response.json(await upstream.json(), {
            status: upstream.status,
            headers: NO_STORE_HEADERS,
        })
    } catch {
        return Response.json(
            {error: 'Invalid response from Directwerk.'},
            {status: 502, headers: NO_STORE_HEADERS}
        )
    }
}

function normalizeUpstreamStatus(status: number): number {
    return status >= 400 && status <= 599 ? status : 502
}
