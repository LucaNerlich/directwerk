import {describe, expect, it, vi} from 'vitest'

import {AUTH_REQUIRED, AUTH_TRANSIENT} from '../src/constants'
import {parseTokenResponse} from '../src/validation'
import {createAuthSession} from '../src/auth/session'
import {createSessionTokenStore} from '../src/auth/tokenStore'

function memoryStore() {
    const backing = new Map<string, string>()
    return createSessionTokenStore({
        accessTokenKey: 'test_access',
        accessTokenExpiresAtKey: 'test_expires',
    })
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })
    return {promise, resolve}
}

describe('createAuthSession', () => {
    it('shares one in-flight refresh between concurrent callers', async () => {
        const store = memoryStore()
        let refreshCalls = 0
        const gate = deferred<Response>()

        const session = createAuthSession({
            store,
            refreshPath: '/api/auth/refresh',
            parseTokens: parseTokenResponse,
        })

        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(() => {
                refreshCalls++
                return gate.promise as Promise<Response>
            })

        const first = session.refreshAccessToken()
        const second = session.refreshAccessToken()
        gate.resolve(
            new Response(
                JSON.stringify({
                    access_token: 'token-1',
                    token_type: 'Bearer',
                    expires_in: 900,
                }),
                {status: 200},
            ),
        )

        const [a, b] = await Promise.all([first, second])
        expect(refreshCalls).toBe(1)
        expect(a).toBe('token-1')
        expect(b).toBe('token-1')
        expect(store.getAccessToken()).toBe('token-1')

        fetchMock.mockRestore()
    })

    it('discards an in-flight refresh when the session generation advances', async () => {
        const store = memoryStore()
        const gate = deferred<Response>()

        const session = createAuthSession({
            store,
            refreshPath: '/api/auth/refresh',
            parseTokens: parseTokenResponse,
        })

        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(() => gate.promise as Promise<Response>)

        store.setTokens({access_token: 'old'})
        const pending = session.refreshAccessToken()
        session.invalidatePendingRefresh()

        gate.resolve(
            new Response(
                JSON.stringify({access_token: 'stale-write', token_type: 'Bearer'}),
                {status: 200},
            ),
        )

        await expect(pending).rejects.toThrow(AUTH_REQUIRED)
        // The stale refresh must not overwrite the fresh session state.
        expect(store.getAccessToken()).toBe(null)

        fetchMock.mockRestore()
    })

    it('treats abort timeouts as transient and keeps tokens', async () => {
        const store = memoryStore()
        store.setTokens({access_token: 'keep-me'})

        const session = createAuthSession({
            store,
            refreshPath: '/api/auth/refresh',
            parseTokens: parseTokenResponse,
            timeoutMs: 10,
        })

        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(
                (_input, init) =>
                    new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () => {
                            const error = new Error('aborted')
                            error.name = 'AbortError'
                            reject(error)
                        })
                    }),
            )

        await expect(session.refreshAccessToken()).rejects.toThrow(AUTH_TRANSIENT)
        expect(store.getAccessToken()).toBe('keep-me')

        fetchMock.mockRestore()
    })

    it('clears tokens only on definitive auth failures', async () => {
        const store = memoryStore()
        store.setTokens({access_token: 'dying'})

        const session = createAuthSession({
            store,
            refreshPath: '/api/auth/refresh',
            parseTokens: parseTokenResponse,
        })

        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({error: 'invalid_grant'}), {status: 401}),
        )

        await expect(session.refreshAccessToken()).rejects.toThrow(AUTH_REQUIRED)
        expect(store.getAccessToken()).toBe(null)

        fetchMock.mockRestore()
    })
})
