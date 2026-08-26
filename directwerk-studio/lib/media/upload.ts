'use client'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {AssetType, MediaAsset} from '@directwerk/api/types'
import {confirmUpload} from '@/lib/api/tenantApi'
import {getValidAccessToken} from '@/lib/auth/session'
import {clearTokens} from '@/lib/auth/tokenStore'
import {exceedsMediaLimit, mediaLimitLabel} from '@/lib/media/limits'

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

function parseAssetBody(body: unknown): MediaAsset {
    const data =
        typeof body === 'object' && body !== null && 'data' in body
            ? (body as {data: unknown}).data
            : body

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
        s3Key?: string
        status?: string
        assetType?: string
        visibility?: string
        scope?: string
        mimeType?: string | null
        originalFilename?: string | null
        sizeBytes?: number | null
        episodeId?: number | null
        ownerUserId?: number | null
        cdnUrl?: string | null
        createdAt?: string
        updatedAt?: string
    }

    // The upload route streams the upstream confirm response (a full
    // MediaAssetView); the fallbacks only cover degraded BFF replies.
    return {
        id: asset.id,
        s3Key: typeof asset.s3Key === 'string' ? asset.s3Key : '',
        visibility: typeof asset.visibility === 'string' ? asset.visibility : 'PRIVATE',
        scope: typeof asset.scope === 'string' ? asset.scope : '',
        status: typeof asset.status === 'string' ? asset.status : 'READY',
        assetType: typeof asset.assetType === 'string' ? asset.assetType : 'AUDIO',
        mimeType: asset.mimeType ?? null,
        originalFilename: asset.originalFilename ?? null,
        sizeBytes: typeof asset.sizeBytes === 'number' ? asset.sizeBytes : null,
        episodeId:
            typeof asset.episodeId === 'number' ? asset.episodeId : null,
        ownerUserId:
            typeof asset.ownerUserId === 'number' ? asset.ownerUserId : null,
        cdnUrl: typeof asset.cdnUrl === 'string' ? asset.cdnUrl : null,
        createdAt: typeof asset.createdAt === 'string' ? asset.createdAt : '',
        updatedAt: typeof asset.updatedAt === 'string' ? asset.updatedAt : '',
    }
}

/**
 * Upload a media file via the studio BFF (upload-url → stream to S3 → confirm).
 *
 * The raw file bytes are sent as the request body and streamed straight through
 * to object storage, so `onProgress` reflects the end-to-end upload (the BFF
 * applies backpressure and never buffers the file in memory).
 */
export async function uploadMediaFile(
    tenantHost: string,
    file: File,
    options?: {
        assetType?: AssetType
        visibility?: 'PUBLIC' | 'PRIVATE'
        episodeId?: number
        onProgress?: (percent: number) => void
    },
): Promise<MediaAsset> {
    const assetType = options?.assetType
    if (assetType !== undefined && exceedsMediaLimit(assetType, file.size)) {
        throw new Error(
            `Datei zu groß (max. ${mediaLimitLabel(assetType)} für ${assetType}).`,
        )
    }

    let accessToken: string
    try {
        accessToken = await getValidAccessToken()
    } catch {
        clearTokens()
        throw new Error(AUTH_REQUIRED)
    }

    return new Promise<MediaAsset>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/media/upload')
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
        xhr.setRequestHeader('X-Tenant-Host', tenantHost)
        xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name))
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
        xhr.setRequestHeader('X-Visibility', options?.visibility ?? 'PRIVATE')
        if (assetType !== undefined) {
            xhr.setRequestHeader('X-Asset-Type', assetType)
        }
        if (options?.episodeId !== undefined) {
            xhr.setRequestHeader('X-Episode-Id', String(options.episodeId))
        }

        const onProgress = options?.onProgress
        if (onProgress !== undefined) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && event.total > 0) {
                    onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
                }
            }
        }

        xhr.onload = () => {
            const status = xhr.status
            const contentType = xhr.getResponseHeader('content-type') ?? ''
            if (!contentType.toLowerCase().includes('application/json')) {
                reject(new Error('Der Server hat eine ungültige Upload-Antwort gesendet.'))
                return
            }

            let value: unknown
            try {
                value = JSON.parse(xhr.responseText)
            } catch {
                reject(new Error('Der Server hat eine ungültige Upload-Antwort gesendet.'))
                return
            }

            if (status === 401) {
                // A long upload can outlive the access-token TTL. The BFF returns
                // `retryConfirm` when the file reached S3 but the confirm call needs
                // a fresh token — retry the confirm instead of logging the user out.
                if (
                    typeof value === 'object' &&
                    value !== null &&
                    (value as {retryConfirm?: unknown}).retryConfirm === true &&
                    typeof (value as {assetId?: unknown}).assetId === 'number'
                ) {
                    confirmUpload(tenantHost, (value as {assetId: number}).assetId)
                        .then(resolve)
                        .catch(reject)
                    return
                }
                clearTokens()
                reject(new Error(AUTH_REQUIRED))
                return
            }
            if (status < 200 || status >= 300) {
                reject(new Error(errorMessage(value, status)))
                return
            }

            try {
                resolve(parseAssetBody(value))
            } catch (error) {
                reject(error)
            }
        }

        xhr.onerror = () => {
            reject(new Error('Upload fehlgeschlagen. Bitte erneut versuchen.'))
        }
        xhr.onabort = () => {
            reject(new Error('Upload abgebrochen.'))
        }

        xhr.send(file)
    })
}
