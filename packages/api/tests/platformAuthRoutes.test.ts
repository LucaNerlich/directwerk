import {afterEach, describe, expect, it, vi} from 'vitest'

import {
    createPlatformFetchUpstream,
    createPlatformRefreshRoute,
    createPlatformTokenRoute,
} from '../src/server/authRoutes'
import {readAuthJsonBody} from '../src/server/authBody'
import type {DirectwerkRequest} from '../src/server/platform'

function tokenRequest(body?: string, headers?: Record<string, string>): Request {
    return new Request('http://local/api/auth/login', {
        method: 'POST',
        headers: {'content-type': 'application/json', ...headers},
        ...(body === undefined ? {} : {body}),
    })
}

function upstreamTokenResponse(): Response {
    return Response.json(
        {access_token: 'access', refresh_token: 'refresh'},
        {status: 200, headers: {'content-type': 'application/json'}},
    )
}

function stubUpstream(response: () => Response): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () => response())
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

afterEach(() => {
    vi.unstubAllGlobals()
})

const validLogin = (value: unknown) => {
    if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as {email?: unknown}).email === 'string' &&
        typeof (value as {password?: unknown}).password === 'string'
    ) {
        return {
            success: true as const,
            data: value as {email: string; password: string},
        }
    }
    return {success: false as const, error: 'Enter a valid email address and password.'}
}

function directwerkRequest(): DirectwerkRequest {
    return {
        url: 'http://upstream/oauth2/token',
        init: {method: 'POST', headers: {Accept: 'application/json'}},
    }
}

describe('createPlatformTokenRoute', () => {
    it('rejects a non-JSON Content-Type with 415 and the configured message', async () => {
        const POST = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(directwerkRequest),
        })

        const response = await POST(
            new Request('http://local/', {method: 'POST', body: '{}'}),
        )

        expect(response.status).toBe(415)
        expect(await response.json()).toEqual({
            error: 'Content-Type must be application/json.',
        })
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('pragma')).toBe('no-cache')
    })

    it('rejects an oversized streamed body with 413', async () => {
        const POST = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(directwerkRequest),
        })

        const response = await POST(tokenRequest('x'.repeat(20_000)))

        expect(response.status).toBe(413)
        expect(await response.json()).toEqual({error: 'Request body is too large.'})
    })

    it('rejects a lying Content-Length above the cap with 413', async () => {
        const response = await readAuthJsonBody(
            {
                headers: new Headers({
                    'content-type': 'application/json',
                    'content-length': String(16 * 1024 + 1),
                }),
                body: null,
            } as unknown as Request,
            {
                jsonBodyLimit: 16 * 1024,
                messages: {
                    contentType: 'ct',
                    tooLarge: 'too large',
                    invalidJson: 'invalid json',
                },
            },
        )

        expect(response.ok).toBe(false)
        if (!response.ok) {
            expect(response.response.status).toBe(413)
            expect(await response.response.json()).toEqual({error: 'too large'})
        }
    })

    it('rejects unparseable JSON with 400', async () => {
        const POST = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(directwerkRequest),
        })

        const response = await POST(tokenRequest('{not json'))

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({error: 'Invalid JSON request.'})
    })

    it('reports an absent body as missing only when configured', async () => {
        const withMissing = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(directwerkRequest),
            messages: {missingBody: 'Invalid request body.'},
        })
        const missing = await withMissing(tokenRequest())
        expect(missing.status).toBe(400)
        expect(await missing.json()).toEqual({error: 'Invalid request body.'})

        const withoutMissing = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(directwerkRequest),
        })
        const fallback = await withoutMissing(tokenRequest())
        expect(fallback.status).toBe(400)
        expect(await fallback.json()).toEqual({error: 'Invalid JSON request.'})
    })

    it('returns the validation error message with 400', async () => {
        const POST = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(directwerkRequest),
        })

        const response = await POST(tokenRequest(JSON.stringify({email: 'a@b.c'})))

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'Enter a valid email address and password.',
        })
    })

    it('seals the refresh token, preserves status and applies no-store on success', async () => {
        const fetchMock = stubUpstream(upstreamTokenResponse)
        const builderSpy = vi.fn(directwerkRequest)
        const POST = createPlatformTokenRoute({
            refreshCookie: 'dw_admin_refresh',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(builderSpy),
        })

        const response = await POST(
            tokenRequest(JSON.stringify({email: 'a@b.c', password: 'pw'})),
        )

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({access_token: 'access'})
        expect(response.headers.get('set-cookie')).toContain('dw_admin_refresh=refresh')
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get('pragma')).toBe('no-cache')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(builderSpy).toHaveBeenCalledWith({
            email: 'a@b.c',
            password: 'pw',
        })
    })

    it('maps a throwing upstream builder (unconfigured) to 502', async () => {
        const POST = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: () => {
                throw new Error('Directwerk server configuration is incomplete.')
            },
        })

        const response = await POST(
            tokenRequest(JSON.stringify({email: 'a@b.c', password: 'pw'})),
        )

        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
            error: 'Authentication service is unavailable.',
        })
    })

    it('short-circuits on the gate without calling upstream', async () => {
        const upstreamSpy = vi.fn(() => upstreamTokenResponse())
        const POST = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate: validLogin,
            upstream: upstreamSpy,
            gate: async () => ({ok: false, status: 401}),
        })

        const response = await POST(tokenRequest('{}'))

        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({
            error: 'A platform admin session is required.',
        })
        expect(upstreamSpy).not.toHaveBeenCalled()
    })

    it('short-circuits on preflight before validation', async () => {
        const validate = vi.fn(validLogin)
        const POST = createPlatformTokenRoute({
            refreshCookie: 'cookie',
            validate,
            upstream: createPlatformFetchUpstream(directwerkRequest),
            preflight: () =>
                Response.json({error: 'A valid tenant host is required.'}, {
                    status: 400,
                }),
        })

        const response = await POST(tokenRequest('{}'))

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'A valid tenant host is required.',
        })
        expect(validate).not.toHaveBeenCalled()
    })

    it('runs finalize after sealing and keeps both cookies', async () => {
        stubUpstream(upstreamTokenResponse)
        const POST = createPlatformTokenRoute({
            refreshCookie: 'dw_admin_tenant_refresh',
            validate: validLogin,
            upstream: createPlatformFetchUpstream(directwerkRequest),
            finalize: (response) => {
                const headers = new Headers(response.headers)
                headers.append('Set-Cookie', 'dw_admin_tenant_host=studio.example.com')
                return new Response(response.body, {
                    status: response.status,
                    headers,
                })
            },
        })

        const response = await POST(
            tokenRequest(JSON.stringify({email: 'a@b.c', password: 'pw'})),
        )

        const setCookie = response.headers.get('set-cookie')
        expect(setCookie).toContain('dw_admin_tenant_refresh=refresh')
        expect(setCookie).toContain('dw_admin_tenant_host=studio.example.com')
        expect(response.headers.get('cache-control')).toBe('no-store')
    })
})

describe('createPlatformRefreshRoute', () => {
    it('rejects a request without a refresh cookie with 401', async () => {
        const POST = createPlatformRefreshRoute({
            refreshCookie: 'dw_admin_refresh',
            upstream: createPlatformFetchUpstream(directwerkRequest),
        })

        const response = await POST(new Request('http://local/', {method: 'POST'}))

        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({
            error: 'A valid refresh token is required.',
        })
    })

    it('seals the refreshed token and applies no-store', async () => {
        const fetchMock = stubUpstream(upstreamTokenResponse)
        const builderSpy = vi.fn(directwerkRequest)
        const POST = createPlatformRefreshRoute({
            refreshCookie: 'dw_admin_refresh',
            upstream: createPlatformFetchUpstream(builderSpy),
        })

        const response = await POST(
            new Request('http://local/', {
                method: 'POST',
                headers: {cookie: 'dw_admin_refresh=refresh-token'},
            }),
        )

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({access_token: 'access'})
        expect(response.headers.get('set-cookie')).toContain('dw_admin_refresh=refresh')
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(builderSpy).toHaveBeenCalledWith('refresh-token')
    })

    it('honours gate and preflight short-circuits', async () => {
        const gated = createPlatformRefreshRoute({
            refreshCookie: 'cookie',
            upstream: createPlatformFetchUpstream(directwerkRequest),
            gate: async () => ({ok: false, status: 502}),
        })
        const gatedResponse = await gated(new Request('http://local/', {method: 'POST'}))
        expect(gatedResponse.status).toBe(502)
        expect(await gatedResponse.json()).toEqual({
            error: 'A platform admin session is required.',
        })

        const preflighted = createPlatformRefreshRoute({
            refreshCookie: 'cookie',
            upstream: createPlatformFetchUpstream(directwerkRequest),
            preflight: () =>
                Response.json({error: 'Tenant session does not match this host.'}, {
                    status: 401,
                }),
        })
        const preflightResponse = await preflighted(
            new Request('http://local/', {method: 'POST'}),
        )
        expect(preflightResponse.status).toBe(401)
        expect(await preflightResponse.json()).toEqual({
            error: 'Tenant session does not match this host.',
        })
    })

    it('maps a throwing upstream to 502', async () => {
        const POST = createPlatformRefreshRoute({
            refreshCookie: 'cookie',
            upstream: () => {
                throw new Error('Directwerk server configuration is incomplete.')
            },
        })

        const response = await POST(
            new Request('http://local/', {
                method: 'POST',
                headers: {cookie: 'cookie=refresh'},
            }),
        )

        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
            error: 'Authentication service is unavailable.',
        })
    })
})
