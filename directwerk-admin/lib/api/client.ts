import {createAuthedRequest} from '@directwerk/api/client'
import {platformAdminPolicy} from '@directwerk/api/client/policies'
import {
    parseApiEnvelope,
    parsePaginatedApiEnvelope,
} from '@directwerk/api/envelope'
import type {JobListPage, JobListQuery, PlatformAuditEvent} from '@directwerk/api/types'
import {isQueueJob} from '@directwerk/api/validation'
import {clearTokens} from '../auth/tokenStore'
import {getValidAccessToken, refreshAccessToken} from '../auth/session'

const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens,
    ...platformAdminPolicy,
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
