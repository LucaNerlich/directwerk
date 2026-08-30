'use client'

import {
    parseImportedEpisodeEnvelope,
    parseMediaAssetEnvelope,
    parseRssImportPreviewEnvelope,
} from '@directwerk/api/validation/catalog'

import type {
    ImportEpisodeInput,
    ImportedEpisodeResult,
    IngestRemoteAssetInput,
    MediaAsset,
    RssImportPreview,
} from '@directwerk/api/types'
import {jsonInit, studioGet, studioMutate} from './studioApiCore'

/**
 * Previews the episodes and metadata available in an RSS feed.
 *
 * @param feedUrl - The URL of the RSS feed to preview
 * @returns The parsed RSS import preview
 */
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
 * Ingests a remote media asset for podcast import.
 *
 * @param input - The remote asset details to ingest.
 * @returns The ingested media asset.
 */
export async function ingestRemoteAsset(
    tenantHost: string,
    input: IngestRemoteAssetInput,
): Promise<MediaAsset> {
    return studioMutate(
        '/api/proxy/podcast/import/assets',
        tenantHost,
        jsonInit('POST', input),
        parseMediaAssetEnvelope,
        'Die Datei konnte nicht nach S3 gestreamt werden.',
    )
}

/**
 * Polls a remote-ingest asset started via {@link ingestRemoteAsset} with `waitForCompletion: false`.
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

/**
 * Imports an RSS episode for the specified tenant.
 *
 * @param tenantHost - The tenant host used to route the request
 * @param input - The episode import details
 * @returns The imported episode result
 */
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
