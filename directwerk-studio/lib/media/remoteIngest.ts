'use client'

import {parseMediaAssetEnvelope} from '@directwerk/api/validation/catalog'

import type {IngestRemoteAssetInput, MediaAsset} from '@directwerk/api/types'
import {getIngestAsset} from '@/lib/api/podcastImportApi'
import {jsonInit, studioMutate} from '@/lib/api/studioApiCore'

const POLL_INTERVAL_MS = 500
const INGEST_FAILED_MESSAGE = 'Die Datei konnte nicht nach S3 gestreamt werden.'

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export function computeRemoteIngestPercent(asset: MediaAsset): number | null {
    const transferred = asset.bytesTransferred ?? 0
    if (asset.sizeBytes !== null && asset.sizeBytes > 0) {
        return Math.min(100, Math.round((transferred / asset.sizeBytes) * 100))
    }
    return null
}

export async function waitForRemoteIngest(
    tenantHost: string,
    assetId: number,
    onProgress: (progress: number | null, asset: MediaAsset) => void,
): Promise<MediaAsset> {
    while (true) {
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
}

/**
 * Starts a background remote ingest and polls until the asset is READY.
 */
export async function ingestRemoteAssetWithProgress(
    tenantHost: string,
    input: IngestRemoteAssetInput,
    onProgress: (progress: number | null, asset: MediaAsset) => void,
): Promise<MediaAsset> {
    const started = await studioMutate(
        '/api/proxy/podcast/import/assets',
        tenantHost,
        jsonInit('POST', {...input, waitForCompletion: false}),
        parseMediaAssetEnvelope,
        INGEST_FAILED_MESSAGE,
    )
    return waitForRemoteIngest(tenantHost, started.id, onProgress)
}
