'use client'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {AssetType, MediaAsset} from '@directwerk/api/types'
import {isRecord, parseMediaAssetEnvelope} from '@directwerk/api/validation'
import {confirmUpload} from '@/lib/api/tenantApi'
import {getValidAccessToken} from '@/lib/auth/session'
import {clearTokens} from '@/lib/auth/tokenStore'
import {exceedsMediaLimit, mediaLimitLabel} from '@/lib/media/limits'

interface MediaUploadRetryResponse {
    retryConfirm: true
    assetId: number
}

function isMediaUploadRetryResponse(
    value: unknown,
): value is MediaUploadRetryResponse {
    return (
        isRecord(value) &&
        value.retryConfirm === true &&
        typeof value.assetId === 'number'
    )
}

function errorMessage(value: unknown, status: number): string {
    if (
        isRecord(value) &&
        typeof value.error === 'string' &&
        value.error.length > 0 &&
        value.error.length <= 255
    ) {
        return value.error
    }

    return `Upload fehlgeschlagen (${status}).`
}

function parseAssetBody(body: unknown): MediaAsset {
    const asset = parseMediaAssetEnvelope(body)?.data
    if (asset === undefined) {
        throw new Error('Der Server hat ein ungültiges Medium gesendet.')
    }

    return asset
}

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
                if (isMediaUploadRetryResponse(value)) {
                    confirmUpload(tenantHost, value.assetId)
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
