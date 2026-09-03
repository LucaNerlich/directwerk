import {afterEach, describe, expect, it, vi} from 'vitest'

import {deleteEpisode} from '@/lib/api/podcastApi'
import {deleteArticle} from '@/lib/api/writeApi'

vi.mock('@/lib/auth/session', () => ({
    getValidAccessToken: () => Promise.resolve('test-token'),
    refreshAccessToken: () => Promise.resolve('test-token'),
}))

vi.mock('@directwerk/api/tenant', () => ({
    getClientTenantHost: () => 'tenant.test',
}))

function emptyResponse(status: number): Response {
    return new Response(null, {status})
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {'Content-Type': 'application/json'},
    })
}

describe('publication delete requests', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('resolves deleteEpisode on 204 No Content', async () => {
        const fetchMock = vi.fn().mockResolvedValue(emptyResponse(204))
        vi.stubGlobal('fetch', fetchMock)

        await expect(deleteEpisode('tenant.test', 7)).resolves.toBeUndefined()
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/proxy/episodes/7',
            expect.objectContaining({method: 'DELETE'}),
        )
    })

    it('resolves deleteArticle on 204 No Content', async () => {
        const fetchMock = vi.fn().mockResolvedValue(emptyResponse(204))
        vi.stubGlobal('fetch', fetchMock)

        await expect(deleteArticle('tenant.test', 9)).resolves.toBeUndefined()
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/proxy/articles/9',
            expect.objectContaining({method: 'DELETE'}),
        )
    })

    it('resolves deleteEpisode on 205 Reset Content', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse(205)))

        await expect(deleteEpisode('tenant.test', 7)).resolves.toBeUndefined()
    })

    it('does not accept an empty error response as a successful deletion', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse(500)))

        await expect(deleteEpisode('tenant.test', 7)).rejects.toThrow(
            'Der Server hat eine ungültige Antwort gesendet.',
        )
    })

    it('surfaces the structured German error when the episode is missing', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                jsonResponse(404, {
                    errors: [{code: 'EPISODE_NOT_FOUND', message: 'Episode not found: 7'}],
                }),
            ),
        )

        await expect(deleteEpisode('tenant.test', 7)).rejects.toThrow(
            'Episode not found: 7',
        )
    })

    it('surfaces the structured German error when the article is missing', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                jsonResponse(404, {
                    errors: [{code: 'ARTICLE_NOT_FOUND', message: 'Article not found: 9'}],
                }),
            ),
        )

        await expect(deleteArticle('tenant.test', 9)).rejects.toThrow(
            'Article not found: 9',
        )
    })
})
