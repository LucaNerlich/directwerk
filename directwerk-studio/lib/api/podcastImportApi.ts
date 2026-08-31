'use client'

import {
    parseImportedEpisodeEnvelope,
    parseMediaAssetEnvelope,
    parseRssImportPreviewEnvelope,
} from '@directwerk/api/validation/catalog'

import type {
    ImportEpisodeInput,
    ImportedEpisodeResult,
    MediaAsset,
    RssImportPreview,
} from '@directwerk/api/types'
import {jsonInit, studioGet, studioMutate} from './studioApiCore'

export async function previewRssFeed(
    tenantHost: string,
    feedUrl: string,
): Promise<RssImportPreview> {
    return studioMutate(
        '/api/proxy/podcast/import/preview',
        tenantHost,
        jsonInit('POST', {feedUrl}),
        parseRssImportPreviewEnvelope,
        'Der Feed konnte nicht gelesen werden.',
    )
}

/**
 * Polls a remote-ingest asset started via {@link ingestRemoteAssetWithProgress} with `waitForCompletion: false`.
 */
export async function getIngestAsset(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return studioGet(
        `/api/proxy/podcast/import/assets/${assetId}`,
        tenantHost,
        parseMediaAssetEnvelope,
        'Der Server hat ein ungültiges Medium gesendet.',
    )
}

export async function importRssEpisode(
    tenantHost: string,
    input: ImportEpisodeInput,
): Promise<ImportedEpisodeResult> {
    return studioMutate(
        '/api/proxy/podcast/import/episodes',
        tenantHost,
        jsonInit('POST', input),
        parseImportedEpisodeEnvelope,
        'Die Folge konnte nicht importiert werden.',
    )
}
