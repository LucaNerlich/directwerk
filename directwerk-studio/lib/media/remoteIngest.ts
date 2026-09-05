'use client'

import {parseMediaAssetEnvelope} from '@directwerk/api/validation/catalog'

import type {IngestRemoteAssetInput, MediaAsset} from '@directwerk/api/types'
import {getIngestAsset} from '@/lib/api/podcastImportApi'
import {jsonInit, studioMutate} from '@/lib/api/studioApiCore'

const POLL_INTERVAL_MS = 500
const MAX_POLL_ATTEMPTS = 360 // ~3 minutes at 500ms intervals
const INGEST_FAILED_MESSAGE = 'Die Datei konnte nicht nach S3 gestreamt werden.'
const INGEST_TIMEOUT_MESSAGE = 'Der Import dauert zu lange — bitte versuche es erneut.'

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

function computeRemoteIngestPercent(asset: MediaAsset): number | null {
    const transferred = asset.bytesTransferred ?? 0
    if (asset.sizeBytes !== null && asset.sizeBytes > 0) {
        return Math.min(100, Math.round((transferred / asset.sizeBytes) * 100))
    }
    return null
}

async function waitForRemoteIngest(
    tenantHost: string,
    assetId: number,
    onProgress: (progress: number | null, asset: MediaAsset) => void,
    signal?: AbortSignal,
): Promise<MediaAsset> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        if (signal?.aborted === true) {
            throw new DOMException('Aborted', 'AbortError')
        }
        let asset: MediaAsset
        try {
            asset = await getIngestAsset(tenantHost, assetId)
        } catch {
            throw new Error(INGEST_FAILED_MESSAGE)
        }

        if (asset.status === 'READY') {
            onProgress(100, asset)
            return asset
        }

        if (asset.status === 'ARCHIVED') {
            throw new Error(INGEST_FAILED_MESSAGE)
        }

        if (asset.status !== 'PENDING') {
            throw new Error(INGEST_FAILED_MESSAGE)
        }

        onProgress(computeRemoteIngestPercent(asset), asset)
        await sleep(POLL_INTERVAL_MS)
    }
    throw new Error(INGEST_TIMEOUT_MESSAGE)
}

export async function ingestRemoteAssetWithProgress(
    tenantHost: string,
    input: IngestRemoteAssetInput,
    onProgress: (progress: number | null, asset: MediaAsset) => void,
    options: {signal?: AbortSignal} = {},
): Promise<MediaAsset> {
    const started = await studioMutate(
        '/api/proxy/podcast/import/assets',
        tenantHost,
        jsonInit('POST', {...input, waitForCompletion: false}),
        parseMediaAssetEnvelope,
        INGEST_FAILED_MESSAGE,
    )
    return waitForRemoteIngest(tenantHost, started.id, onProgress, options.signal)
}
