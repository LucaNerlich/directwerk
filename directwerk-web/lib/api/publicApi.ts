'use client'

import {apiErrorCode} from '@directwerk/api/envelope'
import {parseLevelListEnvelope} from '@directwerk/api/validation/catalog'
import {
    parsePublicCategoryListEnvelope,
    parsePublicFormatListEnvelope,
    parsePublicNewsletterListEnvelope,
    parsePublicNewsletterListListEnvelope,
    parsePublicProductListEnvelope,
    parsePublicSiteConfigEnvelope,
} from '@directwerk/api/validation/public'

import type {
    ApiEnvelope,
    LevelSummary,
    PublicArticle,
    PublicCategory,
    PublicEpisode,
    PublicFormat,
    PublicNewsletterList,
    PublicProduct,
    PublicSeries,
    PublicSiteConfig,
} from '@directwerk/api/types'
import {createWebPublicParsers} from '@/lib/publicContent/parsers'
import {envelopeResult, jsonRequest} from './transport'

const publicParsers = createWebPublicParsers()
const parsePublicArticleListEnvelope = publicParsers.parsePublicArticleListEnvelope
const parsePublicSeriesListEnvelope = publicParsers.parsePublicSeriesListEnvelope
const parsePublicEpisodeListEnvelope = publicParsers.parsePublicEpisodeListEnvelope
const parsePublicEpisodeEnvelope = publicParsers.parsePublicEpisodeEnvelope

export async function getSiteConfig(
): Promise<ApiEnvelope<PublicSiteConfig>> {
    return envelopeResult(
        parsePublicSiteConfigEnvelope,
        await jsonRequest('/api/proxy/public/site-config'),
        'The server returned an invalid site configuration.',
    )
}

export async function listPublicArticles(
): Promise<PublicArticle[]> {
    return envelopeResult(
        parsePublicArticleListEnvelope,
        await jsonRequest('/api/proxy/public/articles'),
        'The server returned an invalid article list.',
    ).data
}

export async function listPublicSeries(
): Promise<PublicSeries[]> {
    return envelopeResult(
        parsePublicSeriesListEnvelope,
        await jsonRequest('/api/proxy/public/series'),
        'The server returned an invalid series list.',
    ).data
}

export async function listPublicEpisodes(
): Promise<PublicEpisode[]> {
    return envelopeResult(
        parsePublicEpisodeListEnvelope,
        await jsonRequest('/api/proxy/public/episodes'),
        'The server returned an invalid episode list.',
    ).data
}

export async function getPublicEpisode(
    slug: string,
): Promise<PublicEpisode | null> {
    try {
        return envelopeResult(
            parsePublicEpisodeEnvelope,
            await jsonRequest(`/api/proxy/public/episodes/${encodeURIComponent(slug)}`),
            'The server returned an invalid episode.',
        ).data
    } catch (error: unknown) {
        if (apiErrorCode(error) === 'EPISODE_NOT_FOUND') {
            return null
        }
        throw error
    }
}

export async function listPublicLevels(
): Promise<LevelSummary[]> {
    return envelopeResult(
        parseLevelListEnvelope,
        await jsonRequest('/api/proxy/public/levels'),
        'The server returned an invalid level list.',
    ).data
}

export async function listPublicFormats(
): Promise<PublicFormat[]> {
    return envelopeResult(
        parsePublicFormatListEnvelope,
        await jsonRequest('/api/proxy/public/formats'),
        'The server returned an invalid format list.',
    ).data
}

export async function listPublicArticleCategories(
): Promise<PublicCategory[]> {
    return envelopeResult(
        parsePublicCategoryListEnvelope,
        await jsonRequest('/api/proxy/public/article-categories'),
        'The server returned an invalid category list.',
    ).data
}

export async function listPublicProducts(
): Promise<PublicProduct[]> {
    return envelopeResult(
        parsePublicProductListEnvelope,
        await jsonRequest('/api/proxy/public/products'),
        'The server returned an invalid product list.',
    ).data
}

export async function listPublicNewsletterLists(): Promise<PublicNewsletterList[]> {
    return envelopeResult(
        parsePublicNewsletterListListEnvelope,
        await jsonRequest('/api/proxy/public/newsletter-lists'),
        'The server returned an invalid newsletter list catalog.',
    ).data
}

export async function getPublicNewsletterList(
    slug: string,
): Promise<PublicNewsletterList | null> {
    try {
        return envelopeResult(
            parsePublicNewsletterListEnvelope,
            await jsonRequest(`/api/proxy/public/newsletter-lists/${encodeURIComponent(slug)}`),
            'The server returned an invalid newsletter list.',
        ).data
    } catch (error: unknown) {
        // Real missing/archived list — not a missing route or upstream outage.
        if (apiErrorCode(error) === 'NEWSLETTER_LIST_NOT_FOUND') {
            return null
        }
        throw error
    }
}
