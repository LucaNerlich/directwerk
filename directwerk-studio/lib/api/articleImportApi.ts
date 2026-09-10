'use client'

import {
    parseArticleBulkImportQueuedEnvelope,
    parseArticleRssImportPreviewEnvelope,
    parseImportedArticleEnvelope,
    parseMediaAssetEnvelope,
} from '@directwerk/api/validation/catalog'

import type {
    ArticleBulkImportInput,
    ArticleBulkImportQueuedResult,
    ArticleRssImportPreview,
    ImportArticleInput,
    ImportedArticleResult,
    MediaAsset,
} from '@directwerk/api/types'
import {jsonInit, studioGet, studioMutate} from './studioApiCore'

export async function previewArticleRssFeed(
    tenantHost: string,
    feedUrl: string,
): Promise<ArticleRssImportPreview> {
    return studioMutate(
        '/api/proxy/articles/import/preview',
        tenantHost,
        jsonInit('POST', {feedUrl}),
        parseArticleRssImportPreviewEnvelope,
        'Der Feed konnte nicht gelesen werden.',
    )
}

export async function getArticleIngestAsset(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return studioGet(
        `/api/proxy/articles/import/assets/${assetId}`,
        tenantHost,
        parseMediaAssetEnvelope,
        'Der Server hat ein ungültiges Medium gesendet.',
    )
}

export async function importRssArticle(
    tenantHost: string,
    input: ImportArticleInput,
): Promise<ImportedArticleResult> {
    return studioMutate(
        '/api/proxy/articles/import/articles',
        tenantHost,
        jsonInit('POST', input),
        parseImportedArticleEnvelope,
        'Der Beitrag konnte nicht importiert werden.',
    )
}

export async function bulkImportArticleRss(
    tenantHost: string,
    input: ArticleBulkImportInput,
): Promise<ArticleBulkImportQueuedResult> {
    return studioMutate(
        '/api/proxy/articles/import/bulk',
        tenantHost,
        jsonInit('POST', input),
        parseArticleBulkImportQueuedEnvelope,
        'Der Stapelimport konnte nicht gestartet werden.',
    )
}
