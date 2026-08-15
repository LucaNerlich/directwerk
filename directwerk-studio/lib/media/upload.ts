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
 *
 * Uses XMLHttpRequest so callers can observe upload progress via `onProgress`.
 */
export async function uploadMediaFile(
    tenantHost: string,
    file: File,
    options?: {
        assetType?: 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
        visibility?: 'PUBLIC' | 'PRIVATE'
        episodeId?: number
        onProgress?: (percent: number) => void
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

    return new Promise<MediaAsset>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/media/upload')
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
        xhr.setRequestHeader('X-Tenant-Host', tenantHost)

        if (options?.onProgress !== undefined) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && event.total > 0) {
                    options.onProgress?.(Math.round((event.loaded / event.total) * 100))
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
                clearTokens()
                reject(new Error(AUTH_REQUIRED))
                return
            }
            if (status < 200 || status >= 300) {
                reject(new Error(errorMessage(value, status)))
                return
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
                reject(new Error('Der Server hat ein ungültiges Medium gesendet.'))
                return
            }

            const asset = data as {
                id: number
                status?: string
                assetType?: string
                mimeType?: string | null
                originalFilename?: string | null
                sizeBytes?: number | null
            }

            resolve({
                id: asset.id,
                status: typeof asset.status === 'string' ? asset.status : 'READY',
                assetType: typeof asset.assetType === 'string' ? asset.assetType : 'AUDIO',
                mimeType: asset.mimeType ?? null,
                originalFilename: asset.originalFilename ?? null,
                sizeBytes: typeof asset.sizeBytes === 'number' ? asset.sizeBytes : null,
            })
        }

        xhr.onerror = () => {
            reject(new Error('Upload fehlgeschlagen. Bitte erneut versuchen.'))
        }
        xhr.ontimeout = () => {
            reject(new Error('Upload fehlgeschlagen (Zeitüberschreitung).'))
        }
        xhr.onabort = () => {
            reject(new Error('Upload abgebrochen.'))
        }

        xhr.send(body)
    })
}
