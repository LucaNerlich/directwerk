import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {API_CONTRACT_ERROR, AUTH_REQUIRED} from './errors'
import {getPlatformData, patchPlatformData, parseApiEnvelope, parsePaginatedApiEnvelope} from './client'

vi.mock('../auth/session', () => ({
    getValidAccessToken: vi.fn(async () => 'access-token'),
    refreshAccessToken: vi.fn(async () => 'fresh-access'),
}))

const storage = new Map<string, string>()

beforeEach(() => {
    storage.clear()
    vi.stubGlobal('sessionStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
            storage.set(key, value)
        },
        removeItem: (key: string) => {
            storage.delete(key)
        },
    })
    vi.stubGlobal('window', {
        addEventListener: vi.fn(),
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('parseApiEnvelope', () => {
    it('returns a present data field', () => {
        expect(parseApiEnvelope<{id: number}>({data: {id: 42}})).toEqual({
            id: 42,
        })
    })

    it.each([null, [], {}, {data: undefined}, {data: null}])(
        'rejects an invalid API envelope: %j',
        (value) => {
            expect(() => parseApiEnvelope(value)).toThrow(API_CONTRACT_ERROR)
        }
    )
})

describe('parsePaginatedApiEnvelope', () => {
    it('returns paginated items with metadata', () => {
        expect(
            parsePaginatedApiEnvelope<{id: string}>({
                data: [{id: 'job-1'}],
                metadata: {
                    total: 42,
                    offset: 0,
                    limit: 20,
                },
            })
        ).toEqual({
            items: [{id: 'job-1'}],
            total: 42,
            offset: 0,
            limit: 20,
        })
    })

    it.each([
        null,
        [],
        {},
        {data: null},
        {data: []},
        {data: [], metadata: {total: 1, offset: 0}},
    ])('rejects an invalid paginated envelope: %j', (value) => {
        expect(() => parsePaginatedApiEnvelope(value)).toThrow(
            API_CONTRACT_ERROR
        )
    })
})

describe('patchPlatformData', () => {
    it('patchPlatformData sends a PATCH request and returns parsed data', async () => {
        let capturedInit: RequestInit | undefined

        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string, init: RequestInit) => {
                capturedInit = init
                return new Response(JSON.stringify({data: {id: 42, name: 'updated'}}), {
                    status: 200,
                    headers: {'content-type': 'application/json'},
                })
            })
        )

        const result = await patchPlatformData('/test-path', {
            id: 42,
            name: 'updated',
        })

        expect(result).toEqual({id: 42, name: 'updated'})
        expect(capturedInit?.method).toBe('PATCH')
        expect(capturedInit?.headers).toMatchObject({
            'Content-Type': 'application/json',
        })
        expect(capturedInit?.body).toBe(JSON.stringify({id: 42, name: 'updated'}))
    })
})

describe('platformRequest auth retry', () => {
    it('retries once after a 401 and returns platform data', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(
                    new Response(JSON.stringify({error: 'Unauthorized'}), {
                        status: 401,
                        headers: {'content-type': 'application/json'},
                    })
                )
                .mockResolvedValueOnce(
                    new Response(JSON.stringify({data: {content: []}}), {
                        status: 200,
                        headers: {'content-type': 'application/json'},
                    })
                )
        )

        const {refreshAccessToken} = await import('../auth/session')

        await expect(getPlatformData('tenants')).resolves.toEqual({content: []})
        expect(refreshAccessToken).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('throws AUTH_REQUIRED when retry still returns 401', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                new Response(JSON.stringify({error: 'Unauthorized'}), {
                    status: 401,
                    headers: {'content-type': 'application/json'},
                })
            )
        )

        await expect(getPlatformData('tenants')).rejects.toThrow(AUTH_REQUIRED)
    })
})
