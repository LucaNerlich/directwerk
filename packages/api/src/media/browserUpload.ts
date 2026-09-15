import {AUTH_REQUIRED} from '../constants'
import type {AssetType, MediaAsset} from '../types'
import {isRecord, parseMediaAssetEnvelope} from '../validation'
import {
    isMediaUploadRetryResponse,
    MEDIA_UPLOAD_HEADERS,
    type MediaUploadRetryResponse,
} from './uploadProtocol'

// The `{assetId, retryConfirm:true}` recovery contract is defined once in
// uploadProtocol and re-exported here for the browser upload client.
export {
    isMediaUploadRetryResponse,
    type MediaUploadRetryResponse,
} from './uploadProtocol'

export function parseUploadedMediaAsset(body: unknown): MediaAsset {
    const asset = parseMediaAssetEnvelope(body)?.data
    if (asset === undefined) {
        throw new Error('Der Server hat ein ungültiges Medium gesendet.')
    }

    return asset
}

export function uploadErrorMessage(value: unknown, status: number): string {
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

export interface BrowserMediaUploadConfig {
    tenantHost: string
    file: File
    assetType?: AssetType
    visibility?: 'PUBLIC' | 'PRIVATE'
    episodeId?: number
    folderId?: number
    onProgress?: (percent: number) => void
    getAccessToken: () => Promise<string>
    onAuthRequired: () => void
    confirmUpload: (tenantHost: string, assetId: number) => Promise<MediaAsset>
    uploadPath?: string
    exceedsLimit?: (assetType: AssetType, size: number) => boolean
    limitLabel?: (assetType: AssetType) => string
}

/**
 * Browser XHR upload to the studio BFF media route.
 * Auth retry delegates to confirmUpload when the server returns retryConfirm.
 */
export async function uploadMediaFileBrowser(
    config: BrowserMediaUploadConfig,
): Promise<MediaAsset> {
    const assetType = config.assetType
    if (
        assetType !== undefined &&
        config.exceedsLimit !== undefined &&
        config.exceedsLimit(assetType, config.file.size)
    ) {
        const label = config.limitLabel?.(assetType) ?? assetType
        throw new Error(`Datei zu groß (max. ${label} für ${assetType}).`)
    }

    let accessToken: string
    try {
        accessToken = await config.getAccessToken()
    } catch {
        config.onAuthRequired()
        throw new Error(AUTH_REQUIRED)
    }

    const uploadPath = config.uploadPath ?? '/api/media/upload'

    return new Promise<MediaAsset>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', uploadPath)
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
        xhr.setRequestHeader('X-Tenant-Host', config.tenantHost)
        xhr.setRequestHeader(
            MEDIA_UPLOAD_HEADERS.filename,
            encodeURIComponent(config.file.name),
        )
        xhr.setRequestHeader(
            'Content-Type',
            config.file.type || 'application/octet-stream',
        )
        xhr.setRequestHeader(MEDIA_UPLOAD_HEADERS.visibility, config.visibility ?? 'PRIVATE')
        if (assetType !== undefined) {
            xhr.setRequestHeader(MEDIA_UPLOAD_HEADERS.assetType, assetType)
        }
        if (config.episodeId !== undefined) {
            xhr.setRequestHeader(MEDIA_UPLOAD_HEADERS.episodeId, String(config.episodeId))
        }
        if (config.folderId !== undefined) {
            xhr.setRequestHeader(MEDIA_UPLOAD_HEADERS.folderId, String(config.folderId))
        }

        const onProgress = config.onProgress
        if (onProgress !== undefined) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && event.total > 0) {
                    onProgress(
                        Math.min(
                            100,
                            Math.round((event.loaded / event.total) * 100),
                        ),
                    )
                }
            }
        }

        xhr.onload = () => {
            const status = xhr.status
            const contentType = xhr.getResponseHeader('content-type') ?? ''
            if (!contentType.toLowerCase().includes('application/json')) {
                reject(
                    new Error(
                        'Der Server hat eine ungültige Upload-Antwort gesendet.',
                    ),
                )
                return
            }

            let value: unknown
            try {
                value = JSON.parse(xhr.responseText)
            } catch {
                reject(
                    new Error(
                        'Der Server hat eine ungültige Upload-Antwort gesendet.',
                    ),
                )
                return
            }

            if (status === 401) {
                if (isMediaUploadRetryResponse(value)) {
                    config
                        .confirmUpload(config.tenantHost, value.assetId)
                        .then(resolve)
                        .catch(reject)
                    return
                }
                config.onAuthRequired()
                reject(new Error(AUTH_REQUIRED))
                return
            }
            if (status < 200 || status >= 300) {
                reject(new Error(uploadErrorMessage(value, status)))
                return
            }

            resolve(parseUploadedMediaAsset(value))
        }

        xhr.onerror = () => {
            reject(new Error('Upload fehlgeschlagen. Bitte erneut versuchen.'))
        }
        xhr.onabort = () => {
            reject(new Error('Upload abgebrochen.'))
        }

        xhr.send(config.file)
    })
}
