'use client'

import {parseMediaAssetEnvelope} from '@directwerk/api/validation/catalog'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {IngestRemoteAssetInput, MediaAsset} from '@directwerk/api/types'
import {getArticleIngestAsset} from '@/lib/api/articleImportApi'
import {getIngestAsset} from '@/lib/api/podcastImportApi'
import {jsonInit, studioMutate} from '@/lib/api/studioApiCore'

const POLL_INTERVAL_MS = 500
// The backend remote-ingest budget is 15 minutes (packages/api/src/constants.ts); poll past it
// with a small margin instead of giving up while the ingest is still running.
const POLL_DEADLINE_MS = 16 * 60 * 1000
const MAX_POLL_ATTEMPTS = Math.ceil(POLL_DEADLINE_MS / POLL_INTERVAL_MS)
/**
 * Issue #337 / #1250: a rolling deploy or gateway blip can fail the poll for several seconds
 * while the backend ingest keeps running, so tolerate a time window rather than a handful of
 * attempts. Any successful poll resets it.
 */
const MAX_POLL_FAILURE_WINDOW_MS = 90_000
const INGEST_FAILED_MESSAGE = 'Die Datei konnte nicht nach S3 gestreamt werden.'
const INGEST_TIMEOUT_MESSAGE = 'Der Import dauert zu lange — bitte versuche es erneut.'

export type RemoteIngestDesk = 'podcast' | 'articles'

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
    assetId: number,
    onProgress: (progress: number | null, asset: MediaAsset) => void,
    signal: AbortSignal | undefined,
    pollAsset: (assetId: number) => Promise<MediaAsset>,
): Promise<MediaAsset> {
    let firstFailureAt: number | null = null

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        if (signal?.aborted === true) {
            throw new DOMException('Aborted', 'AbortError')
        }
        let asset: MediaAsset
        try {
            asset = await pollAsset(assetId)
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                (error.message === AUTH_REQUIRED || error.name === 'AbortError')
            ) {
                throw error
            }
            const now = Date.now()
            firstFailureAt ??= now
            if (now - firstFailureAt >= MAX_POLL_FAILURE_WINDOW_MS) {
                throw new Error(INGEST_FAILED_MESSAGE)
            }
            await sleep(POLL_INTERVAL_MS)
            continue
        }

        firstFailureAt = null

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
    input: IngestRemoteAssetInput,
    onProgress: (progress: number | null, asset: MediaAsset) => void,
    options: {signal?: AbortSignal; desk?: RemoteIngestDesk} = {},
): Promise<MediaAsset> {
    const desk = options.desk ?? 'podcast'
    const startPath =
        desk === 'articles'
            ? '/api/proxy/articles/import/assets'
            : '/api/proxy/podcast/import/assets'
    const pollAsset = desk === 'articles' ? getArticleIngestAsset : getIngestAsset
    const started = await studioMutate(
        startPath,
        jsonInit('POST', {...input, waitForCompletion: false}),
        parseMediaAssetEnvelope,
        INGEST_FAILED_MESSAGE,
    )
    return waitForRemoteIngest(started.id, onProgress, options.signal, pollAsset)
}
