import {apiErrorStatus} from '@directwerk/api/envelope'
import type {PublicArticle} from '@directwerk/api/types'

import {authedFetch, envelopeResult, jsonRequest} from '@/lib/api/transport'
import {createWebPublicParsers} from '@/lib/publicContent/parsers'

const {parsePublicArticleEnvelope} = createWebPublicParsers()

/** True when a transport error carries an HTTP 404 status. */
function isNotFoundError(error: unknown): boolean {
    return apiErrorStatus(error) === 404
}

/**
 * Single public article by slug (`GET /api/v1/public/articles/{slug}`).
 * Returns `null` for unknown / paid slugs (HTTP 404); throws for transport or
 * validation failures so callers can show the error state with retry.
 */
export async function fetchPublicArticleBySlug(
    slug: string,
): Promise<PublicArticle | null> {
    try {
        return envelopeResult(
            parsePublicArticleEnvelope,
            await jsonRequest(`/api/proxy/public/articles/${encodeURIComponent(slug)}`),
            'Der Server hat eine ungültige Artikel-Antwort geliefert.',
        ).data
    } catch (error: unknown) {
        if (isNotFoundError(error)) {
            return null
        }
        throw error
    }
}

/**
 * Single entitled article by slug (`GET /api/v1/me/articles/{slug}`).
 * Returns `null` for an unknown slug or a subscriber who is not entitled — any
 * HTTP 404, whatever the error body says — and throws otherwise, including
 * `AUTH_REQUIRED` on an expired session.
 */
export async function fetchEntitledArticleBySlug(
    slug: string,
): Promise<PublicArticle | null> {
    try {
        return envelopeResult(
            parsePublicArticleEnvelope,
            await authedFetch(`/api/proxy/me/articles/${encodeURIComponent(slug)}`),
            'Der Server hat eine ungültige Artikel-Antwort geliefert.',
        ).data
    } catch (error: unknown) {
        if (isNotFoundError(error)) {
            return null
        }
        throw error
    }
}
