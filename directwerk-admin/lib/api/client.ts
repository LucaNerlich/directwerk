'use client'

import {createAuthedRequest} from '@directwerk/api/client/authedRequest'
import {platformAdminPolicy} from '@directwerk/api/client/policies'
import {createPlatformApiCore, parsePaginatedApiEnvelope} from '@directwerk/api/client/platformApiCore'
import type {
    EffectiveRights,
    JobListPage,
    JobListQuery,
    PlatformAuditEvent,
    PlatformAuditPage,
    PlatformAuditQuery,
    PlatformOverview,
} from '@directwerk/api/types'
import {parseEffectiveRightsEnvelope} from '@directwerk/api/validation'
import {isQueueJob} from '@directwerk/api/validation/admin'
import {isRecord} from '@directwerk/api/validation/primitives'

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

export async function deletePlatformData<T>(path: string): Promise<T> {
    return platformApi.delete<T>(path)
}

export async function getMemberEffectiveRights(
    tenantId: string,
    userId: number,
): Promise<EffectiveRights> {
    return platformApi.getEnvelope(
        `tenants/${tenantId}/users/${userId}/effective-rights`,
        parseEffectiveRightsEnvelope,
        'Invalid rights response.',
    )
}

function isPlatformAuditEvent(value: unknown): value is PlatformAuditEvent {
    return (
        isRecord(value) &&
        typeof value.id === 'number' &&
        typeof value.action === 'string' &&
        typeof value.createdAt === 'string'
    )
}

function buildAuditQueryString(query: PlatformAuditQuery): string {
    const params = new URLSearchParams()

    if (query.page !== undefined) {
        params.set('page', String(query.page))
    }

    if (query.size !== undefined) {
        params.set('size', String(query.size))
    }

    if (query.tenantId !== undefined) {
        params.set('tenantId', String(query.tenantId))
    }

    if (query.action !== undefined && query.action.length > 0) {
        params.set('action', query.action)
    }

    if (query.actorEmail !== undefined && query.actorEmail.length > 0) {
        params.set('actorEmail', query.actorEmail)
    }

    const queryString = params.toString()
    return queryString.length > 0 ? `?${queryString}` : ''
}

export async function getPlatformAuditPage(
    query: PlatformAuditQuery,
): Promise<PlatformAuditPage> {
    const raw = await authedFetch(
        `/api/proxy/audit${buildAuditQueryString(query)}`,
        {cache: 'no-store'},
    )

    if (raw === null) {
        return {content: [], totalElements: 0, page: 0, size: query.size ?? 50}
    }

    if (!isRecord(raw) || !Array.isArray(raw.data)) {
        return {content: [], totalElements: 0, page: 0, size: query.size ?? 50}
    }

    const metadata = isRecord(raw.metadata) ? raw.metadata : {}

    const content = raw.data.filter(isPlatformAuditEvent)

    return {
        content,
        totalElements:
            typeof metadata.totalElements === 'number'
                ? metadata.totalElements
                : content.length,
        page: typeof metadata.page === 'number' ? metadata.page : query.page ?? 0,
        size: typeof metadata.size === 'number' ? metadata.size : query.size ?? 50,
    }
}

export async function getPlatformOverview(
    recentAuditLimit = 10,
): Promise<PlatformOverview> {
    return getPlatformData<PlatformOverview>(
        `overview?recentAuditLimit=${recentAuditLimit}`,
    )
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
