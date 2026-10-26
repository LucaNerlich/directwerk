import {beforeEach, describe, expect, it, vi} from 'vitest'

import {withApiErrorContext} from '@directwerk/api/envelope'

const {jsonRequest} = vi.hoisted(() => ({
    jsonRequest: vi.fn(),
}))

vi.mock('@/lib/api/transport', () => ({
    jsonRequest,
    envelopeResult: () => {
        throw new Error('unexpected envelope parse')
    },
}))

const {fetchPublicEpisodeBySlug} = await import('@/lib/catalog/episodeDetail')

/**
 * The backend 404 body is `Response.error(404, "EPISODE_NOT_FOUND", ex.getMessage())`
 * with `EpisodeNotFoundException` message including the slug.
 */
function structuredNotFound(slug: string) {
    return withApiErrorContext(new Error(`Episode not found: ${slug}`), 404, {
        statusCode: 404,
        errors: [{code: 'EPISODE_NOT_FOUND', message: `Episode not found: ${slug}`}],
    })
}

describe('episode detail lookup (public by slug)', () => {
    beforeEach(() => {
        jsonRequest.mockReset()
    })

    it('maps a structured 404 to null for the public lookup', async () => {
        jsonRequest.mockRejectedValue(structuredNotFound('does-not-exist'))

        await expect(fetchPublicEpisodeBySlug('does-not-exist')).resolves.toBeNull()
    })

    it('still throws transport failures that are not 404', async () => {
        jsonRequest.mockRejectedValue(
            withApiErrorContext(new Error('Internal server error'), 500, {
                statusCode: 500,
                errors: [{code: 'INTERNAL_ERROR', message: 'Internal server error'}],
            }),
        )

        await expect(fetchPublicEpisodeBySlug('boom')).rejects.toThrow('Internal server error')
    })
})
