import {createAuthedRequest} from '@directwerk/api/client'
import {
    parseApiEnvelope,
    parsePaginatedApiEnvelope,
} from '@directwerk/api/envelope'
import {FORBIDDEN, REQUEST_FAILED, CONFLICT, AUTH_REQUIRED} from '@directwerk/api/constants'
import {isQueueJob} from '@directwerk/api/validation'
import type {JobListPage, JobListQuery, PlatformAuditEvent} from '@directwerk/api/types'
import {clearTokens} from '../auth/tokenStore'
import {getValidAccessToken, refreshAccessToken} from '../auth/session'

const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens,
    authFailureMode: 'auth-required',
    finalUnauthorized: 'clear-and-auth-required',
    fixedErrorMessagesOnly: true,
    fixedErrorMessage: REQUEST_FAILED,
    statusErrors: {
        // Authorization denied with a valid token — the session is fine.
        '403': FORBIDDEN,
        '409': CONFLICT,
    },
    nullForEmptyResponses: true,
})

async function platformRequest<T>(
    path: string,
    init: RequestInit,
): Promise<T> {
    const raw = await authedFetch(`/api/proxy/${path}`, {
        ...init,
        cache: 'no-store',
    })

    if (raw === null) {
        return null as T
    }

    return parseApiEnvelope<T>(raw)
}

export async function getPlatformData<T>(path: string): Promise<T> {
    return platformRequest<T>(path, {method: 'GET'})
}

/**
 * Sends a JSON-encoded POST request to the platform API.
 *
 * @param path - The platform API path
 * @param body - The request payload
 * @returns The parsed API response
 */
export async function postPlatformData<T>(
    path: string,
    body: unknown
): Promise<T> {
    return platformRequest<T>(path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}

export async function getPlatformAuditLog(limit = 50): Promise<PlatformAuditEvent[]> {
    return getPlatformData(`audit?limit=${limit}`)
}

/**
 * Sends a JSON-encoded partial update request to the platform API.
 *
 * @param path - The platform API path
 * @param body - The request payload
 * @returns The parsed response data
 */
export async function patchPlatformData<T>(
    path: string,
    body: unknown
): Promise<T> {
    return platformRequest<T>(path, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}

/**
 * Deletes platform data at the specified path.
 *
 * @param path - The platform API path
 * @returns The parsed API response
 */
export async function deletePlatformData<T>(path: string): Promise<T> {
    return platformRequest<T>(path, {method: 'DELETE'})
}

function buildJobListQueryString(query: JobListQuery): string {
    const params = new URLSearchParams()

    if (query.queue !== undefined) {
        params.set('queue', query.queue)
    }

    if (query.status !== undefined) {
        params.set('status', query.status)
    }

    if (query.updatedAfter !== undefined) {
        params.set('updatedAfter', query.updatedAfter)
    }

    if (query.updatedBefore !== undefined) {
        params.set('updatedBefore', query.updatedBefore)
    }

    if (query.offset !== undefined) {
        params.set('offset', String(query.offset))
    }

    if (query.limit !== undefined) {
        params.set('limit', String(query.limit))
    }

    const queryString = params.toString()
    return queryString.length > 0 ? `?${queryString}` : ''
}

export async function getPlatformJobList(
    query: JobListQuery
): Promise<JobListPage> {
    const raw = await authedFetch(
        `/api/proxy/queue/jobs${buildJobListQueryString(query)}`,
        {cache: 'no-store'},
    )

    return parsePaginatedApiEnvelope(raw, isQueueJob)
}

// Re-export for callers that validate envelopes directly (unchanged surface).
export {parseApiEnvelope}
