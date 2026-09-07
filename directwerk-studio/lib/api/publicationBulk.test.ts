import {afterEach, describe, expect, it, vi} from 'vitest'

import {bulkDeleteEpisodes, bulkPublishEpisodes, bulkUnpublishEpisodes} from '@/lib/api/podcastApi'
import {bulkDeleteArticles, bulkPublishArticles, bulkUnpublishArticles} from '@/lib/api/writeApi'

vi.mock('@/lib/auth/session', () => ({
    getValidAccessToken: () => Promise.resolve('test-token'),
    refreshAccessToken: () => Promise.resolve('test-token'),
}))

vi.mock('@directwerk/api/tenant', () => ({
    getClientTenantHost: () => 'tenant.test',
}))

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {'Content-Type': 'application/json'},
    })
}

function bulkPublishEnvelope(items: unknown[]): unknown {
    return {statusCode: 200, statusMessage: 'OK', data: items, errors: [], metadata: {}}
}

describe('bulk publication requests', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('posts episode ids to the bulk publish endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, bulkPublishEnvelope([])))
        vi.stubGlobal('fetch', fetchMock)

        await bulkPublishEpisodes('tenant.test', {ids: [7, 8]})

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/proxy/episodes/bulk/publish',
            expect.objectContaining({method: 'POST'}),
        )
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(JSON.parse(init.body as string)).toEqual({ids: [7, 8]})
    })

    it('posts episode ids to the bulk unpublish endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, bulkPublishEnvelope([])))
        vi.stubGlobal('fetch', fetchMock)

        await bulkUnpublishEpisodes('tenant.test', [7])

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/proxy/episodes/bulk/unpublish',
            expect.objectContaining({method: 'POST'}),
        )
    })

    it('returns deleted episode ids from the bulk delete endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse(200, {
                statusCode: 200,
                statusMessage: 'OK',
                data: {deletedIds: [7, 8]},
                errors: [],
                metadata: {},
            }),
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(bulkDeleteEpisodes('tenant.test', [7, 8])).resolves.toEqual([7, 8])
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/proxy/episodes/bulk/delete',
            expect.objectContaining({method: 'POST'}),
        )
    })

    it('posts article ids to the bulk endpoints', async () => {
        const fetchMock = vi.fn(async () => jsonResponse(200, bulkPublishEnvelope([])))
        vi.stubGlobal('fetch', fetchMock)

        await bulkPublishArticles('tenant.test', {ids: [9]})
        await bulkUnpublishArticles('tenant.test', [9])

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/proxy/articles/bulk/publish',
            expect.objectContaining({method: 'POST'}),
        )
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/proxy/articles/bulk/unpublish',
            expect.objectContaining({method: 'POST'}),
        )
    })

    it('returns deleted article ids from the bulk delete endpoint', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse(200, {
                statusCode: 200,
                statusMessage: 'OK',
                data: {deletedIds: [9]},
                errors: [],
                metadata: {},
            }),
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(bulkDeleteArticles('tenant.test', [9])).resolves.toEqual([9])
    })
})
