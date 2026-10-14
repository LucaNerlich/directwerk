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
        feedUrl: string,
): Promise<ArticleRssImportPreview> {
    return studioMutate(
        '/api/proxy/articles/import/preview',
        
        jsonInit('POST', {feedUrl}),
        parseArticleRssImportPreviewEnvelope,
        'Der Feed konnte nicht gelesen werden.',
    )
}

export async function getArticleIngestAsset(
        assetId: number,
): Promise<MediaAsset> {
    return studioGet(
        `/api/proxy/articles/import/assets/${assetId}`,
        
        parseMediaAssetEnvelope,
        'Der Server hat ein ungültiges Medium gesendet.',
    )
}

export async function importRssArticle(
        input: ImportArticleInput,
): Promise<ImportedArticleResult> {
    return studioMutate(
        '/api/proxy/articles/import/articles',
        
        jsonInit('POST', input),
        parseImportedArticleEnvelope,
        'Der Beitrag konnte nicht importiert werden.',
    )
}

export async function bulkImportArticleRss(
        input: ArticleBulkImportInput,
): Promise<ArticleBulkImportQueuedResult> {
    return studioMutate(
        '/api/proxy/articles/import/bulk',
        
        jsonInit('POST', input),
        parseArticleBulkImportQueuedEnvelope,
        'Der Stapelimport konnte nicht gestartet werden.',
    )
}
