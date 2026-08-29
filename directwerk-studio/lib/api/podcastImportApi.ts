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
import {jsonInit, studioMutate} from './studioApiCore'

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
