'use client'

import {parseLevelListEnvelope} from '@directwerk/api/validation/catalog'
import {parsePublicFormatListEnvelope, parsePublicProductListEnvelope, parsePublicSiteConfigEnvelope} from '@directwerk/api/validation/public'

import type {
    ApiEnvelope,
    LevelSummary,
    PublicArticle,
    PublicEpisode,
    PublicFormat,
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

export async function getSiteConfig(
    tenantHost: string,
): Promise<ApiEnvelope<PublicSiteConfig>> {
    return envelopeResult(
        parsePublicSiteConfigEnvelope,
        await jsonRequest('/api/proxy/public/site-config'),
        'The server returned an invalid site configuration.',
    )
}

export async function listPublicArticles(
    tenantHost: string,
): Promise<PublicArticle[]> {
    return envelopeResult(
        parsePublicArticleListEnvelope,
        await jsonRequest('/api/proxy/public/articles'),
        'The server returned an invalid article list.',
    ).data
}

export async function listPublicSeries(
    tenantHost: string,
): Promise<PublicSeries[]> {
    return envelopeResult(
        parsePublicSeriesListEnvelope,
        await jsonRequest('/api/proxy/public/series'),
        'The server returned an invalid series list.',
    ).data
}

export async function listPublicEpisodes(
    tenantHost: string,
): Promise<PublicEpisode[]> {
    return envelopeResult(
        parsePublicEpisodeListEnvelope,
        await jsonRequest('/api/proxy/public/episodes'),
        'The server returned an invalid episode list.',
    ).data
}

export async function listPublicLevels(
    tenantHost: string,
): Promise<LevelSummary[]> {
    return envelopeResult(
        parseLevelListEnvelope,
        await jsonRequest('/api/proxy/public/levels'),
        'The server returned an invalid level list.',
    ).data
}

export async function listPublicFormats(
    tenantHost: string,
): Promise<PublicFormat[]> {
    return envelopeResult(
        parsePublicFormatListEnvelope,
        await jsonRequest('/api/proxy/public/formats'),
        'The server returned an invalid format list.',
    ).data
}

export async function listPublicProducts(
    tenantHost: string,
): Promise<PublicProduct[]> {
    return envelopeResult(
        parsePublicProductListEnvelope,
        await jsonRequest('/api/proxy/public/products'),
        'The server returned an invalid product list.',
    ).data
}
