'use client'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {MediaAsset} from '@/lib/api/types'
import {getValidAccessToken} from '@/lib/auth/session'
import {clearTokens} from '@/lib/auth/tokenStore'

function errorMessage(value: unknown, status: number): string {
    if (
        typeof value === 'object' &&
        value !== null &&
        'error' in value &&
        typeof value.error === 'string' &&
        value.error.length > 0 &&
        value.error.length <= 255
    ) {
        return value.error
    }

    return `Upload fehlgeschlagen (${status}).`
}

/**
 * Upload a media file via the studio BFF (upload-url → S3 PUT → confirm).
 * Browser cannot PUT Bunny S3 directly (no storage CORS).
 */
export async function uploadMediaFile(
    tenantHost: string,
    file: File,
    options?: {
        assetType?: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
        visibility?: 'PUBLIC' | 'PRIVATE'
        episodeId?: number
    },
): Promise<MediaAsset> {
    let accessToken: string
    try {
        accessToken = await getValidAccessToken()
    } catch {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    const body = new FormData()
    body.set('file', file)
    body.set('visibility', options?.visibility ?? 'PRIVATE')
    if (options?.assetType !== undefined) {
        body.set('assetType', options.assetType)
    }
    if (options?.episodeId !== undefined) {
        body.set('episodeId', String(options.episodeId))
    }

    const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Tenant-Host': tenantHost,
        },
        body,
    })

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error('Der Server hat eine ungültige Upload-Antwort gesendet.')
    }

    const value: unknown = await response.json()
    if (response.status === 401) {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }
    if (!response.ok) {
        throw new Error(errorMessage(value, response.status))
    }

    const data =
        typeof value === 'object' &&
        value !== null &&
        'data' in value
            ? (value as {data: unknown}).data
            : value

    if (
        typeof data !== 'object' ||
        data === null ||
        !('id' in data) ||
        typeof (data as {id: unknown}).id !== 'number'
    ) {
        throw new Error('Der Server hat ein ungültiges Medium gesendet.')
    }

    const asset = data as {
        id: number
        status?: string
        assetType?: string
        mimeType?: string | null
        originalFilename?: string | null
        sizeBytes?: number | null
    }

    return {
        id: asset.id,
        status: typeof asset.status === 'string' ? asset.status : 'READY',
        assetType: typeof asset.assetType === 'string' ? asset.assetType : 'AUDIO',
        mimeType: asset.mimeType ?? null,
        originalFilename: asset.originalFilename ?? null,
        sizeBytes: typeof asset.sizeBytes === 'number' ? asset.sizeBytes : null,
    }
}
