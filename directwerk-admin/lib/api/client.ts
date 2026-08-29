'use client'

import {createAuthedRequest} from '@directwerk/api/client/authedRequest'
import {
    createPlatformApiCore,
    parsePaginatedApiEnvelope,
} from '@directwerk/api/client/platformApiCore'
import {platformAdminPolicy} from '@directwerk/api/client/policies'
import type {JobListPage, JobListQuery, PlatformAuditEvent} from '@directwerk/api/types'
import {isQueueJob} from '@directwerk/api/validation/admin'

import {clearTokens} from '../auth/tokenStore'
import {getValidAccessToken, refreshAccessToken} from '../auth/session'

const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens,
    ...platformAdminPolicy,
})

const platformApi = createPlatformApiCore(authedFetch)

export async function getPlatformData<T>(path: string): Promise<T> {
    return platformApi.get<T>(path)
}

export async function postPlatformData<T>(
    path: string,
    body: object,
): Promise<T> {
    return platformApi.post<T>(path, body)
}

<<<<<<< HEAD
=======
export async function patchPlatformData<T>(
    path: string,
    body: object,
): Promise<T> {
    return platformApi.patch<T>(path, body)
}

>>>>>>> cleanup/5-weak-types
export async function deletePlatformData<T>(path: string): Promise<T> {
    return platformApi.delete<T>(path)
}

export async function getPlatformAuditLog(limit = 50): Promise<PlatformAuditEvent[]> {
    return getPlatformData(`audit?limit=${limit}`)
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
    query: JobListQuery,
): Promise<JobListPage> {
    const raw = await authedFetch(
        `/api/proxy/queue/jobs${buildJobListQueryString(query)}`,
        {cache: 'no-store'},
    )

    return parsePaginatedApiEnvelope(raw, isQueueJob)
}
