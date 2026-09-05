import {describe, expect, it, vi} from 'vitest'

import {createTenantPassthroughAuthRoute} from '../src/server/authRoutes'
import type {DirectwerkFetchRequest} from '../src/server/upstream'
import {parseAcceptInviteInput, parseForgotPasswordInput} from '../src/validation/input'

function jsonUpstream(body: unknown): Response {
    return Response.json(body, {
        status: 200,
        headers: {'content-type': 'application/json'},
    })
}

function postRequest(body: string, headers?: Record<string, string>): Request {
    return new Request('http://local/api/auth/register', {
        method: 'POST',
        headers: {'content-type': 'application/json', ...headers},
        body,
    })
}

describe('createTenantPassthroughAuthRoute', () => {
    it('rejects unreadable bodies without calling upstream', async () => {
        const directwerkFetch = vi.fn(
            async (_request: DirectwerkFetchRequest) => jsonUpstream({ok: true}),
        )
        const POST = createTenantPassthroughAuthRoute({
            directwerkFetch,
            path: '/api/v1/auth/accept-invite',
            parse: parseAcceptInviteInput,
            invalidInputMessage: 'A valid invite token is required.',
            codes: {body: 'INVALID_REQUEST_BODY'},
        })

        const response = await POST(
            new Request('http://local/', {method: 'POST', body: 'x'.repeat(20_000)}),
        )

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'The request body is invalid.',
            code: 'INVALID_REQUEST_BODY',
        })
        expect(directwerkFetch).not.toHaveBeenCalled()
    })

    it('rejects invalid input with the caller message and code', async () => {
        const directwerkFetch = vi.fn(
            async (_request: DirectwerkFetchRequest) => jsonUpstream({ok: true}),
        )
        const POST = createTenantPassthroughAuthRoute({
            directwerkFetch,
            path: '/api/v1/auth/accept-invite',
            parse: parseAcceptInviteInput,
            invalidInputMessage: 'A valid invite token is required.',
            codes: {invalidInput: 'INVALID_ACCEPT_INVITE_INPUT'},
        })

        const response = await POST(postRequest(JSON.stringify({token: 'short'})))

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'A valid invite token is required.',
            code: 'INVALID_ACCEPT_INVITE_INPUT',
        })
        expect(directwerkFetch).not.toHaveBeenCalled()
    })

    it('requires a tenant host only when configured', async () => {
        const directwerkFetch = vi.fn(
            async (_request: DirectwerkFetchRequest) => jsonUpstream({ok: true}),
        )
        const POST = createTenantPassthroughAuthRoute({
            directwerkFetch,
            path: '/api/v1/auth/register',
            parse: (value: unknown) => value,
            invalidInputMessage: 'never',
            requireTenantHost: true,
        })

        const response = await POST(postRequest(JSON.stringify({a: 1})))

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({error: 'A valid tenant is required.'})
        expect(directwerkFetch).not.toHaveBeenCalled()
    })

    it('forwards validated input upstream without a tenant host by default', async () => {
        const seen: DirectwerkFetchRequest[] = []
        const POST = createTenantPassthroughAuthRoute({
            directwerkFetch: async (request: DirectwerkFetchRequest) => {
                seen.push(request)
                return jsonUpstream({ok: true})
            },
            path: '/api/v1/auth/reset-password',
            parse: (value: unknown) => value,
            invalidInputMessage: 'never',
        })

        const response = await POST(postRequest(JSON.stringify({token: 'abc'})))

        expect(response.status).toBe(200)
        expect(seen).toEqual([
            {
                path: '/api/v1/auth/reset-password',
                method: 'POST',
                body: JSON.stringify({token: 'abc'}),
                contentType: 'application/json',
            },
        ])
    })

    it('forwards the tenant host and maps the upstream body when configured', async () => {
        const seen: DirectwerkFetchRequest[] = []
        const POST = createTenantPassthroughAuthRoute<{email: string; password: string}>({
            directwerkFetch: async (request: DirectwerkFetchRequest) => {
                seen.push(request)
                return jsonUpstream({ok: true})
            },
            path: '/api/v1/auth/studio/workspaces',
            parse: (value: unknown) =>
                value as {email: string; password: string} | null,
            invalidInputMessage: 'A valid email and password are required.',
            requireTenantHost: true,
            toUpstreamBody: (input) => ({email: input.email, password: input.password}),
        })

        const response = await POST(
            postRequest(JSON.stringify({email: 'a@b.c', password: 'x', extra: 1}), {
                'x-tenant-host': 'studio.example.com',
            }),
        )

        expect(response.status).toBe(200)
        expect(seen).toEqual([
            {
                path: '/api/v1/auth/studio/workspaces',
                tenantHost: 'studio.example.com',
                method: 'POST',
                body: JSON.stringify({email: 'a@b.c', password: 'x'}),
                contentType: 'application/json',
            },
        ])
    })

    it('normalizes upstream failures with the configured code', async () => {
        const POST = createTenantPassthroughAuthRoute({
            directwerkFetch: async (_request: DirectwerkFetchRequest) => {
                throw new Error('down')
            },
            path: '/api/v1/auth/accept-invite',
            parse: parseAcceptInviteInput,
            invalidInputMessage: 'A valid invite token is required.',
            codes: {upstream: 'UPSTREAM_UNAVAILABLE'},
        })

        const response = await POST(
            postRequest(JSON.stringify({token: 't'.repeat(32), password: 'long-enough-pw'})),
        )

        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
            error: 'The upstream service is unavailable.',
            code: 'UPSTREAM_UNAVAILABLE',
        })
    })

    it('omits structured codes when none are configured', async () => {
        const failing = createTenantPassthroughAuthRoute({
            directwerkFetch: async (_request: DirectwerkFetchRequest) => {
                throw new Error('down')
            },
            path: '/api/v1/auth/forgot-password',
            parse: parseForgotPasswordInput,
            invalidInputMessage: 'A valid email is required.',
        })

        const invalid = await failing(postRequest(JSON.stringify({})))
        expect(await invalid.json()).toEqual({error: 'A valid email is required.'})

        const unavailable = await failing(
            postRequest(JSON.stringify({email: 'a@b.c'})),
        )
        expect(await unavailable.json()).toEqual({
            error: 'The upstream service is unavailable.',
        })
    })
})
