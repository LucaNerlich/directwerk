import type {PublicArticle} from '@directwerk/api/types'

import {authedFetch, envelopeResult, jsonRequest} from '@/lib/api/transport'
import {createWebPublicParsers} from '@/lib/publicContent/parsers'

const {parsePublicArticleEnvelope} = createWebPublicParsers()

const NOT_FOUND_PATTERN = /(status 404|\(404\))/

/** True when a transport error message carries an HTTP 404 status. */
export function isNotFoundError(error: unknown): boolean {
    return error instanceof Error && NOT_FOUND_PATTERN.test(error.message)
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
 * Returns `null` when the subscriber is not entitled (HTTP 404/403 surface as
 * errors here — only 404 maps to `null`); throws otherwise, including
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
