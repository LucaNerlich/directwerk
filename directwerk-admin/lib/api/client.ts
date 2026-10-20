'use client'

import {createAuthedRequest} from '@directwerk/api/client/authedRequest'
import {platformAdminPolicy} from '@directwerk/api/client/policies'
import {createPlatformApiCore, parsePaginatedApiEnvelope} from '@directwerk/api/client/platformApiCore'
import type {
    EffectiveRights,
    JobListPage,
    JobListQuery,
    PlatformAdmin,
    PlatformAdminPage,
    PlatformAuditEvent,
    PlatformAuditPage,
    PlatformAuditQuery,
    PlatformOverview,
    Tenant,
    TenantListPage,
} from '@directwerk/api/types'
import {
    parseEffectiveRightsListEnvelope,
} from '@directwerk/api/validation'
import {isQueueJob} from '@directwerk/api/validation/admin'
import {isRecord} from '@directwerk/api/validation/primitives'

import {clearSessionTokens, getValidAccessToken, refreshAccessToken} from '../auth/session'

const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens: clearSessionTokens,
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

/**
 * Effective rights for several members in one request (#345). The tenant page needs a row per
 * editor; calling the single-member helper per editor cost one HTTP round trip each.
 */
export async function getMembersEffectiveRights(
    tenantId: string,
    userIds: number[],
): Promise<EffectiveRights[]> {
    if (userIds.length === 0) {
        return []
    }
    return platformApi.getEnvelope(
        `tenants/${tenantId}/users/effective-rights?userIds=${userIds.join(',')}`,
        parseEffectiveRightsListEnvelope,
        'Invalid rights response.',
    )
}

/**
 * One page of platform admins (#438). The list was previously fetched whole, so the response grew
 * without bound with the number of administrators.
 */
export async function getPlatformAdminsPage(
    page: number,
    size: number,
): Promise<PlatformAdminPage> {
    const raw = await authedFetch(`/api/proxy/admins?page=${page}&size=${size}`, {
        cache: 'no-store',
    })

    if (raw === null) {
        return {content: [], totalElements: 0, page, size}
    }

    if (!isRecord(raw) || !Array.isArray(raw.data) || !raw.data.every(isPlatformAdmin)) {
        throw new Error('Invalid platform admin response from the server.')
    }

    const metadata = isRecord(raw.metadata) ? raw.metadata : {}
    const content = raw.data

    return {
        content,
        totalElements:
            typeof metadata.totalElements === 'number' ? metadata.totalElements : content.length,
        page: typeof metadata.page === 'number' ? metadata.page : page,
        size: typeof metadata.size === 'number' ? metadata.size : size,
    }
}

/**
 * One page of tenants (#438). The endpoint returned the first 1000 tenants with no way to reach the
 * rest, so a larger estate was silently truncated.
 */
export async function getPlatformTenantsPage(
    page: number,
    size: number,
    query?: string,
): Promise<TenantListPage> {
    const trimmed = query?.trim() ?? ''
    const search = trimmed.length > 0 ? `&q=${encodeURIComponent(trimmed)}` : ''
    const raw = await authedFetch(`/api/proxy/tenants?page=${page}&size=${size}${search}`, {
        cache: 'no-store',
    })

    if (raw === null) {
        return {content: [], totalElements: 0, page, size}
    }

    if (!isRecord(raw) || !isRecord(raw.data) || !Array.isArray(raw.data.content)) {
        throw new Error('Invalid tenant list response from the server.')
    }

    const metadata = isRecord(raw.metadata) ? raw.metadata : {}
    const content = raw.data.content

    return {
        content: content as Tenant[],
        totalElements:
            typeof metadata.totalElements === 'number' ? metadata.totalElements : content.length,
        page: typeof metadata.page === 'number' ? metadata.page : page,
        size: typeof metadata.size === 'number' ? metadata.size : size,
    }
}

function isPlatformAdmin(value: unknown): value is PlatformAdmin {
    return (
        isRecord(value) &&
        typeof value.userId === 'number' &&
        typeof value.email === 'string'
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

    if (!isRecord(raw) || !Array.isArray(raw.data) || !raw.data.every(isPlatformAuditEvent)) {
        // Issue #439: silently returning an empty page made a broken API contract look like
        // "No audit events match the current filters" on a compliance surface. Throw so the
        // existing error alert and Retry path handle it.
        throw new Error('Ungültige Audit-Antwort des Servers.')
    }

    const metadata = isRecord(raw.metadata) ? raw.metadata : {}

    const content = raw.data

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
