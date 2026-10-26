import {apiErrorStatus} from '@directwerk/api/envelope'
import type {PublicEpisode} from '@directwerk/api/types'

import {envelopeResult, jsonRequest} from '@/lib/api/transport'
import {createWebPublicParsers} from '@/lib/publicContent/parsers'

const {parsePublicEpisodeEnvelope} = createWebPublicParsers()

/** True when a transport error carries an HTTP 404 status. */
function isNotFoundError(error: unknown): boolean {
    return apiErrorStatus(error) === 404
}

/**
 * Single public episode by slug (`GET /api/v1/public/episodes/{slug}`).
 * Returns `null` for unknown / unpublished slugs (HTTP 404); throws for
 * transport or validation failures so callers can show the error state with retry.
 * PAID published episodes return 200 with `audioCdnUrl: null` (not 404).
 */
export async function fetchPublicEpisodeBySlug(
    slug: string,
): Promise<PublicEpisode | null> {
    try {
        return envelopeResult(
            parsePublicEpisodeEnvelope,
            await jsonRequest(`/api/proxy/public/episodes/${encodeURIComponent(slug)}`),
            'Der Server hat eine ungültige Episode-Antwort geliefert.',
        ).data
    } catch (error: unknown) {
        if (isNotFoundError(error)) {
            return null
        }
        throw error
    }
}
