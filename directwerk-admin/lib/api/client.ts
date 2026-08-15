import {clearTokens} from '../auth/tokenStore'
import {getValidAccessToken, refreshAccessToken} from '../auth/session'
import {
    API_CONTRACT_ERROR,
    AUTH_REQUIRED,
    CONFLICT,
    REQUEST_FAILED,
} from './errors'
import {JOB_STATUSES} from './types'
import type {JobListPage, JobListQuery, QueueJob} from './types'

export function parseApiEnvelope<T>(
    value: unknown,
    validator?: (data: unknown) => data is T
): T {
    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value) ||
        !Object.hasOwn(value, 'data') ||
        (value as {data?: unknown}).data === undefined ||
        (value as {data?: unknown}).data === null
    ) {
        throw new Error(API_CONTRACT_ERROR)
    }

    const data = (value as {data: unknown}).data

    if (validator && !validator(data)) {
        throw new Error(API_CONTRACT_ERROR)
    }

    return data as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseMetadataNumber(
    metadata: unknown,
    key: string
): number | null {
    if (!isRecord(metadata)) {
        return null
    }

    const value = metadata[key]
    return typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
        ? value
        : null
}

export function parsePaginatedApiEnvelope<T>(
    value: unknown,
    itemValidator?: (item: unknown) => item is T
): {items: T[]; total: number; offset: number; limit: number} {
    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value) ||
        !Object.hasOwn(value, 'data') ||
        !Array.isArray((value as {data?: unknown}).data)
    ) {
        throw new Error(API_CONTRACT_ERROR)
    }

    const envelope = value as {data: unknown[]; metadata?: unknown}
    const items = envelope.data

    if (itemValidator && items.some((item) => !itemValidator(item))) {
        throw new Error(API_CONTRACT_ERROR)
    }

    const total = parseMetadataNumber(envelope.metadata, 'total')
    const offset = parseMetadataNumber(envelope.metadata, 'offset')
    const limit = parseMetadataNumber(envelope.metadata, 'limit')

    if (total === null || offset === null || limit === null || limit < 1) {
        throw new Error(API_CONTRACT_ERROR)
    }

    return {
        items: items as T[],
        total,
        offset,
        limit,
    }
}

function isQueueJob(value: unknown): value is QueueJob {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false
    }

    const job = value as Record<string, unknown>

    return (
        typeof job.id === 'string' &&
        typeof job.queue === 'string' &&
        Object.hasOwn(job, 'payload') &&
        typeof job.priority === 'number' &&
        typeof job.status === 'string' &&
        JOB_STATUSES.includes(job.status as never) &&
        typeof job.availableAt === 'string' &&
        typeof job.attempts === 'number' &&
        typeof job.maxAttempts === 'number' &&
        (job.lockedBy === null || typeof job.lockedBy === 'string') &&
        (job.lockedUntil === null || typeof job.lockedUntil === 'string') &&
        (job.lastError === null || typeof job.lastError === 'string') &&
        typeof job.createdAt === 'string' &&
        typeof job.updatedAt === 'string'
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

export async function getPlatformData<T>(path: string): Promise<T> {
    return platformRequest<T>(path, {method: 'GET'})
}

export async function getPlatformJobList(
    query: JobListQuery
): Promise<JobListPage> {
    return platformPaginatedRequest(`queue/jobs${buildJobListQueryString(query)}`)
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

async function platformPaginatedRequest(
    path: string,
    retried = false
): Promise<JobListPage> {
    let token: string
    try {
        token = await getValidAccessToken()
    } catch {
        throw new Error(AUTH_REQUIRED)
    }

    const response = await fetch(`/api/proxy/${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (response.status === 401 && !retried) {
        try {
            await refreshAccessToken()
        } catch {
            clearTokens()
            throw new Error(AUTH_REQUIRED)
        }

        return platformPaginatedRequest(path, true)
    }

    if (response.status === 401 || response.status === 403) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    if (!response.ok) {
        throw new Error(REQUEST_FAILED)
    }

    return parsePaginatedApiEnvelope(await response.json(), isQueueJob)
}

async function platformRequest<T>(
    path: string,
    init: RequestInit,
    retried = false
): Promise<T> {
    let token: string
    try {
        token = await getValidAccessToken()
    } catch {
        throw new Error(AUTH_REQUIRED)
    }

    const response = await fetch(`/api/proxy/${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            ...init.headers,
        },
        cache: 'no-store',
    })

    if (response.status === 401 && !retried) {
        try {
            await refreshAccessToken()
        } catch {
            clearTokens()
            throw new Error(AUTH_REQUIRED)
        }

        return platformRequest<T>(path, init, true)
    }

    if (response.status === 401 || response.status === 403) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    if (!response.ok) {
        if (response.status === 409) {
            throw new Error(CONFLICT)
        }

        throw new Error(REQUEST_FAILED)
    }

    if (response.status === 204 || response.status === 205) {
        return null as T
    }

    return parseApiEnvelope<T>(await response.json())
}
