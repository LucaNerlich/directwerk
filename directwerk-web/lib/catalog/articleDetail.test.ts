import {beforeEach, describe, expect, it, vi} from 'vitest'

import {withApiErrorContext} from '@directwerk/api/envelope'

const {jsonRequest, authedFetch} = vi.hoisted(() => ({
    jsonRequest: vi.fn(),
    authedFetch: vi.fn(),
}))

vi.mock('@/lib/api/transport', () => ({
    jsonRequest,
    authedFetch,
    envelopeResult: () => {
        throw new Error('unexpected envelope parse')
    },
}))

const {fetchEntitledArticleBySlug, fetchPublicArticleBySlug} = await import(
    '@/lib/catalog/articleDetail'
)

/**
 * The backend 404 body is `Response.error(404, "ARTICLE_NOT_FOUND", ex.getMessage())`
 * with `ArticleNotFoundException` message `"Article not found: " + slug`, so the
 * status is only knowable from the structured error — never from the message text.
 */
function structuredNotFound(slug: string) {
    return withApiErrorContext(new Error(`Article not found: ${slug}`), 404, {
        statusCode: 404,
        errors: [{code: 'ARTICLE_NOT_FOUND', message: `Article not found: ${slug}`}],
    })
}

describe('article detail lookup (#529)', () => {
    beforeEach(() => {
        jsonRequest.mockReset()
        authedFetch.mockReset()
    })

    it('maps a structured 404 to null for the public lookup', async () => {
        jsonRequest.mockRejectedValue(structuredNotFound('does-not-exist'))

        await expect(fetchPublicArticleBySlug('does-not-exist')).resolves.toBeNull()
    })

    it('maps a structured 404 to null for the entitled lookup', async () => {
        authedFetch.mockRejectedValue(structuredNotFound('paid-article'))

        await expect(fetchEntitledArticleBySlug('paid-article')).resolves.toBeNull()
    })

    it('still throws transport failures that are not 404', async () => {
        jsonRequest.mockRejectedValue(
            withApiErrorContext(new Error('Internal server error'), 500, {
                statusCode: 500,
                errors: [{code: 'INTERNAL_ERROR', message: 'Internal server error'}],
            }),
        )
        authedFetch.mockRejectedValue(
            withApiErrorContext(new Error('Forbidden'), 403, {
                statusCode: 403,
                errors: [{code: 'FORBIDDEN', message: 'Forbidden'}],
            }),
        )

        await expect(fetchPublicArticleBySlug('boom')).rejects.toThrow('Internal server error')
        await expect(fetchEntitledArticleBySlug('boom')).rejects.toThrow('Forbidden')
    })
})
