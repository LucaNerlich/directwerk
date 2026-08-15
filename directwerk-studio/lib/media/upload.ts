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

interface StreamEvent {
    type: 'progress' | 'result' | 'error'
    percent?: number
    status?: number
    body?: unknown
}

/**
 * Upload a media file via the studio BFF (upload-url → S3 PUT → confirm).
 * Browser cannot PUT Bunny S3 directly (no storage CORS).
 *
 * Uses XMLHttpRequest so we can observe upload progress for the browser → BFF
 * leg, while the BFF streams NDJSON progress events for the S3 leg. The two
 * legs are combined into a single 0–100 progress value.
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

        const onProgress = options?.onProgress
        let settled = false
        let leg1Percent = 0
        let leg2Percent = 0

        const reportProgress = (): void => {
            onProgress?.(Math.min(100, Math.round(leg1Percent * 0.5 + leg2Percent * 0.5)))
        }

        if (onProgress !== undefined) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && event.total > 0) {
                    leg1Percent = (event.loaded / event.total) * 100
                    reportProgress()
                }
            }
        }

        const resolveAsset = (value: unknown): void => {
            if (settled) {
                return
            }
            settled = true
            try {
                resolve(parseAssetBody(value))
            } catch (error) {
                reject(error)
            }
        }

        const rejectEvent = (status: number, value: unknown): void => {
            if (settled) {
                return
            }
            settled = true
            if (status === 401) {
                clearTokens()
                reject(new Error(AUTH_REQUIRED))
                return
            }
            reject(new Error(errorMessage(value, status)))
        }

        let buffer = ''
        let processedLength = 0

        const handleProgressLine = (line: string): void => {
            if (line.length === 0) {
                return
            }
            let event: StreamEvent
            try {
                event = JSON.parse(line) as StreamEvent
            } catch {
                return
            }
            if (event.type === 'progress' && typeof event.percent === 'number') {
                leg2Percent = event.percent
                reportProgress()
            }
        }

        const handleFinalLines = (chunk: string): void => {
            buffer += chunk
            const lines = buffer.split('\n')
            buffer = ''
            for (const line of lines) {
                if (line.length === 0) {
                    continue
                }
                let event: StreamEvent
                try {
                    event = JSON.parse(line) as StreamEvent
                } catch {
                    continue
                }
                if (event.type === 'progress' && typeof event.percent === 'number') {
                    leg2Percent = event.percent
                    reportProgress()
                } else if (event.type === 'result') {
                    resolveAsset(event.body)
                } else if (event.type === 'error') {
                    rejectEvent(
                        typeof event.status === 'number' ? event.status : 502,
                        event.body,
                    )
                }
            }
        }

        xhr.onprogress = () => {
            if (xhr.readyState === 3) {
                const text = xhr.responseText
                const chunk = text.slice(processedLength)
                processedLength = text.length

                buffer += chunk
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''
                for (const line of lines) {
                    handleProgressLine(line)
                }
            }
        }

        xhr.onload = () => {
            const status = xhr.status
            const contentType = xhr.getResponseHeader('content-type') ?? ''

            if (contentType.toLowerCase().includes('application/x-ndjson')) {
                const text = xhr.responseText
                handleFinalLines(text.slice(processedLength))
                if (!settled) {
                    reject(new Error('Der Server hat eine ungültige Upload-Antwort gesendet.'))
                }
                return
            }

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

            resolveAsset(value)
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
